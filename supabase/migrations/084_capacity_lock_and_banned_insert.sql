-- 084_capacity_lock_and_banned_insert.sql
-- Two follow-ups to 082/083 surfaced by the post-commit code review:
--   1. The capacity trigger in 082 reads the current count without locking
--      the tournaments row, so two concurrent INSERTs on the last seat could
--      both pass the check. Add a SELECT ... FOR UPDATE on the tournaments
--      row inside the trigger so concurrent registrations serialise per
--      tournament.
--   2. 083 only added a banned check to UPDATE on registrations. A banned
--      player can still INSERT a brand-new row directly via the API. Replace
--      the INSERT policy ("Users register own player") to add the same
--      banned guard.

------------------------------------------------------------------------------
-- 1. Capacity trigger: serialise per-tournament inserts with FOR UPDATE.
------------------------------------------------------------------------------
create or replace function public.enforce_registration_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cap int;
  current_count int;
  was_counted boolean;
  is_counted boolean;
begin
  is_counted := new.status in ('registered', 'checked_in');

  if tg_op = 'UPDATE' then
    was_counted := old.status in ('registered', 'checked_in');
    if not is_counted then
      return new;
    end if;
    if was_counted and old.tournament_id = new.tournament_id then
      return new;
    end if;
  else
    if not is_counted then
      return new;
    end if;
  end if;

  -- Lock the tournaments row so concurrent INSERTs on the same tournament
  -- queue up. Without this, two simultaneous transactions on the last seat
  -- could both read current_count = cap-1 and both succeed.
  select max_players into cap
    from public.tournaments
    where id = new.tournament_id
    for update;

  if cap is null or cap <= 0 then
    return new;
  end if;

  select count(*) into current_count
    from public.registrations
    where tournament_id = new.tournament_id
      and status in ('registered', 'checked_in')
      and (tg_op = 'INSERT' or player_id <> new.player_id);

  if current_count >= cap then
    raise exception 'Tournament is full (% / % registered).', current_count, cap
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------------
-- 2. Banned INSERT guard on registrations.
--    Mirrors the UPDATE guard from migration 083. A banned player cannot
--    create a new row, so they cannot register for any tournament once they
--    are banned, regardless of how the request is constructed client-side.
------------------------------------------------------------------------------
drop policy if exists "Users register own player" on public.registrations;

create policy "Users register own player" on public.registrations
  for insert to authenticated
  with check (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    and not exists (
      select 1 from public.players p
      where p.id = registrations.player_id and coalesce(p.banned, false) = true
    )
  );
