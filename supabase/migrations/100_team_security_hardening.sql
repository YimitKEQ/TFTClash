-- 100_team_security_hardening.sql
-- Hardens team-event surfaces flagged by the post-launch security review:
--   1. Block role escalation. The existing UPDATE policy on team_members
--      lets a player update their own row (any column). A non-captain could
--      promote themselves to 'captain' via a direct API call. We add a BEFORE
--      UPDATE trigger that rejects role changes initiated by a non-captain,
--      while still allowing a captain to demote themselves or promote a
--      teammate via transferCaptaincy.
--   2. Prevent cross-team lineup collisions. A player must not appear in
--      another team's lineup_player_ids for the same tournament. The result
--      trigger picks one team deterministically but the underlying state is
--      ambiguous, so we reject it at write time.
--   3. Lock down season_clash team_size. season_clash tournaments must be
--      solo. Add a CHECK constraint so an admin (or service role) cannot
--      accidentally insert a team_size > 1 row that would corrupt season
--      standings.

------------------------------------------------------------------------------
-- 1. Block non-captain role changes on team_members.
------------------------------------------------------------------------------
create or replace function public.enforce_team_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_service boolean := (select auth.role()) = 'service_role';
  is_admin boolean := coalesce(public.is_admin_or_mod((select auth.uid())), false);
  caller_player_id uuid;
  is_caller_captain boolean;
begin
  if is_service or is_admin then return new; end if;
  -- No-op when role is unchanged.
  if new.role is not distinct from old.role then return new; end if;
  select id into caller_player_id from public.players
    where auth_user_id = (select auth.uid()) limit 1;
  if caller_player_id is null then
    raise exception 'Cannot change member role: no linked player.'
      using errcode = 'P0001';
  end if;
  select exists (
    select 1 from public.teams t
    where t.id = new.team_id
      and t.captain_player_id = caller_player_id
  ) into is_caller_captain;
  if not is_caller_captain then
    raise exception 'Only the team captain can change member roles.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_team_members_role_guard on public.team_members;
create trigger trg_team_members_role_guard
  before update of role on public.team_members
  for each row execute function public.enforce_team_member_role_change();

------------------------------------------------------------------------------
-- 2. Reject lineup_player_ids that collide with another team in the same
--    tournament. Solo registrations (team_id IS NULL) are not affected.
------------------------------------------------------------------------------
create or replace function public.enforce_unique_player_per_tournament_lineup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  collision_exists boolean;
begin
  if new.team_id is null then return new; end if;
  if new.lineup_player_ids is null or array_length(new.lineup_player_ids, 1) is null then
    return new;
  end if;
  select exists (
    select 1 from public.registrations r
    where r.tournament_id = new.tournament_id
      and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and r.team_id is not null
      and r.team_id <> new.team_id
      and r.lineup_player_ids && new.lineup_player_ids
  ) into collision_exists;
  if collision_exists then
    raise exception 'A player in this lineup is already on another team for this tournament.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registrations_unique_lineup on public.registrations;
create trigger trg_registrations_unique_lineup
  before insert or update of lineup_player_ids, team_id on public.registrations
  for each row execute function public.enforce_unique_player_per_tournament_lineup();

------------------------------------------------------------------------------
-- 3. Lock down season_clash to team_size = 1.
------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournaments_season_clash_solo_only'
      and conrelid = 'public.tournaments'::regclass
  ) then
    alter table public.tournaments
      add constraint tournaments_season_clash_solo_only
      check (
        type <> 'season_clash'
        or team_size is null
        or team_size = 1
      );
  end if;
end $$;
