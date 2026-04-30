-- 082_enforce_registration_capacity.sql
-- Server-side guard that prevents registrations beyond a tournament's
-- max_players cap. The TournamentDetailScreen already has a client-side
-- isFull check, but a determined caller can bypass it with a direct
-- supabase.from('registrations').upsert(...) call. With prize money on the
-- line this weekend we cannot rely on client trust.
--
-- Behavior:
--   * Counts active registrations (status in 'registered','checked_in').
--   * If max_players is null or <= 0, no cap is enforced.
--   * Status updates from registered -> dropped/waitlist are always allowed
--     (so admins can free a slot). Updates that flip into a counted state
--     are checked the same way as inserts.

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
    -- Going inactive (drop / waitlist) never breaks the cap.
    if not is_counted then
      return new;
    end if;
    -- Status was already counted and tournament didn't change: no new slot
    -- being consumed, allow.
    if was_counted and old.tournament_id = new.tournament_id then
      return new;
    end if;
  else
    -- INSERT path: only enforce on counted statuses.
    if not is_counted then
      return new;
    end if;
  end if;

  select max_players into cap
    from public.tournaments
    where id = new.tournament_id;

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

drop trigger if exists registrations_capacity_gate on public.registrations;
create trigger registrations_capacity_gate
  before insert or update on public.registrations
  for each row execute function public.enforce_registration_capacity();
