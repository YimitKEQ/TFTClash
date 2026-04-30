-- 086_squads_admin_overrides.sql
-- Lets admins/mods manage 4v4 teams from the Admin Panel without going
-- through the service-role key. Also extends the cooldown trigger so admins
-- can bypass the 60-minute leave cooldown when fixing roster issues
-- (e.g. moving a player after a malicious kick).

------------------------------------------------------------------------------
-- 1. Cooldown trigger: bypass for admin/mod, not just service_role.
------------------------------------------------------------------------------
create or replace function public.enforce_team_member_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_count int;
  cooldown_until timestamptz;
  cooldown_minutes int := 60;
  is_service boolean := (select auth.role()) = 'service_role';
  is_admin boolean := coalesce(public.is_admin_or_mod((select auth.uid())), false);
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.removed_at is not null and new.removed_at is null) then
    select count(*) into active_count
      from public.team_members
      where team_id = new.team_id
        and removed_at is null
        and id <> new.id;

    if active_count >= 6 then
      raise exception 'Team roster is full (6 / 6 active members).' using errcode = 'P0001';
    end if;

    if not is_service and not is_admin then
      select last_left_team_at into cooldown_until from public.players where id = new.player_id;
      if cooldown_until is not null
         and cooldown_until + (cooldown_minutes || ' minutes')::interval > now() then
        raise exception 'Player is on a leave cooldown until %.',
          cooldown_until + (cooldown_minutes || ' minutes')::interval
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------------
-- 2. Admin/mod policies on the three squads tables.
--    Captain policies stay in place; admin gets a parallel "manage all" policy.
------------------------------------------------------------------------------
drop policy if exists "Admins manage teams" on public.teams;
create policy "Admins manage teams" on public.teams
  for all to authenticated
  using (public.is_admin_or_mod((select auth.uid())))
  with check (public.is_admin_or_mod((select auth.uid())));

drop policy if exists "Admins manage team_members" on public.team_members;
create policy "Admins manage team_members" on public.team_members
  for all to authenticated
  using (public.is_admin_or_mod((select auth.uid())))
  with check (public.is_admin_or_mod((select auth.uid())));

drop policy if exists "Admins manage team_invites" on public.team_invites;
create policy "Admins manage team_invites" on public.team_invites
  for all to authenticated
  using (public.is_admin_or_mod((select auth.uid())))
  with check (public.is_admin_or_mod((select auth.uid())));
