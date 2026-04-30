-- 087_squads_team_registrations.sql
-- Extends the registrations table to support team-based tournaments (team_size > 1).
-- Solo tournaments keep using player_id only (team_id stays null).
-- Team tournaments: one registration row per team. The captain registers,
-- the row stores both player_id (the captain who registered) and team_id.

------------------------------------------------------------------------------
-- 1. Schema: add team_id column.
------------------------------------------------------------------------------
alter table public.registrations
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

create index if not exists idx_registrations_team_id
  on public.registrations(team_id) where team_id is not null;

-- Prevent double-registering the same team in the same tournament. Active rows
-- only (status filter is implicit by uniqueness on team_id; cancelled rows are
-- removed by the unregister flow that DELETEs the row).
create unique index if not exists registrations_unique_team_per_tournament
  on public.registrations(tournament_id, team_id)
  where team_id is not null;

------------------------------------------------------------------------------
-- 2. RLS: allow captains to register / unregister their own team.
--    Existing per-player policies stay in place for solo events.
------------------------------------------------------------------------------
drop policy if exists "Captains register their team" on public.registrations;
create policy "Captains register their team" on public.registrations
  for insert to authenticated
  with check (
    team_id is not null
    and exists (
      select 1 from public.teams t
      join public.players p on p.id = t.captain_player_id
      where t.id = registrations.team_id
        and t.archived_at is null
        and p.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Captains unregister their team" on public.registrations;
create policy "Captains unregister their team" on public.registrations
  for delete to authenticated
  using (
    team_id is not null
    and exists (
      select 1 from public.teams t
      join public.players p on p.id = t.captain_player_id
      where t.id = registrations.team_id
        and p.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Captains update their team registration" on public.registrations;
create policy "Captains update their team registration" on public.registrations
  for update to authenticated
  using (
    team_id is not null
    and exists (
      select 1 from public.teams t
      join public.players p on p.id = t.captain_player_id
      where t.id = registrations.team_id
        and p.auth_user_id = (select auth.uid())
    )
  )
  with check (
    team_id is not null
    and exists (
      select 1 from public.teams t
      join public.players p on p.id = t.captain_player_id
      where t.id = registrations.team_id
        and p.auth_user_id = (select auth.uid())
    )
  );

------------------------------------------------------------------------------
-- 3. Validation trigger: a registration must be either solo OR team-shaped,
--    and team-shaped registrations must come from a team whose captain matches
--    the row's player_id (so the captain is always the registering player).
--    Admins/service_role bypass.
------------------------------------------------------------------------------
create or replace function public.enforce_registration_team_shape()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t_team_size int;
  is_service boolean := (select auth.role()) = 'service_role';
  is_admin boolean := coalesce(public.is_admin_or_mod((select auth.uid())), false);
  team_captain_id uuid;
begin
  if is_service or is_admin then
    return new;
  end if;

  select team_size into t_team_size from public.tournaments where id = new.tournament_id;
  if t_team_size is null then t_team_size := 1; end if;

  if t_team_size > 1 then
    if new.team_id is null then
      raise exception 'This tournament requires team registration (team_size = %).', t_team_size
        using errcode = 'P0001';
    end if;
    select captain_player_id into team_captain_id from public.teams where id = new.team_id;
    if team_captain_id is null or team_captain_id <> new.player_id then
      raise exception 'Only the team captain may register or update the team.'
        using errcode = 'P0001';
    end if;
  else
    if new.team_id is not null then
      raise exception 'This tournament does not accept team registrations.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_enforce_team_shape on public.registrations;
create trigger registrations_enforce_team_shape
  before insert or update on public.registrations
  for each row execute function public.enforce_registration_team_shape();
