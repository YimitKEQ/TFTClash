-- 088_squads_lineup_and_results.sql
-- In-event flow for 4v4 squads:
--   * registrations.lineup_player_ids stores the captain-chosen starting
--     lineup for the tournament (set when the captain checks the team in).
--   * game_results.team_id stamps each per-player result with their team so
--     team standings can be aggregated cheaply.
--
-- Both fields stay null for solo (team_size = 1) events.

------------------------------------------------------------------------------
-- 1. Schema additions.
------------------------------------------------------------------------------
alter table public.registrations
  add column if not exists lineup_player_ids uuid[];

alter table public.game_results
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_game_results_team_id
  on public.game_results(tournament_id, team_id) where team_id is not null;

------------------------------------------------------------------------------
-- 2. Lineup validation: when a team event registration is updated to
--    checked_in, the captain must provide a lineup that:
--      a) has exactly tournaments.team_size entries
--      b) every entry is an active member of the registering team
--    Service / admin bypass.
------------------------------------------------------------------------------
create or replace function public.enforce_team_lineup_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t_team_size int;
  is_service boolean := (select auth.role()) = 'service_role';
  is_admin boolean := coalesce(public.is_admin_or_mod((select auth.uid())), false);
  active_member_count int;
begin
  if is_service or is_admin then return new; end if;
  if new.team_id is null then return new; end if;
  if new.status is distinct from 'checked_in' then return new; end if;

  select team_size into t_team_size from public.tournaments where id = new.tournament_id;
  if t_team_size is null or t_team_size <= 1 then return new; end if;

  if new.lineup_player_ids is null or array_length(new.lineup_player_ids, 1) is distinct from t_team_size then
    raise exception 'Lineup must contain exactly % players to check in.', t_team_size
      using errcode = 'P0001';
  end if;

  select count(*) into active_member_count
    from public.team_members
    where team_id = new.team_id
      and removed_at is null
      and player_id = any(new.lineup_player_ids);

  if active_member_count <> t_team_size then
    raise exception 'Lineup includes a player who is not an active member of this team.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists registrations_enforce_team_lineup on public.registrations;
create trigger registrations_enforce_team_lineup
  before insert or update on public.registrations
  for each row execute function public.enforce_team_lineup_on_checkin();

------------------------------------------------------------------------------
-- 3. Auto-stamp team_id on game_results inserts when the player has a team
--    registration in this tournament. Admin-entered scores get the team
--    column filled automatically without needing a code change in every
--    results path.
------------------------------------------------------------------------------
create or replace function public.stamp_game_result_team_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_team uuid;
begin
  if new.team_id is not null then return new; end if;
  if new.player_id is null or new.tournament_id is null then return new; end if;

  select r.team_id into resolved_team
    from public.registrations r
    where r.tournament_id = new.tournament_id
      and (
        r.player_id = new.player_id
        or new.player_id = any(coalesce(r.lineup_player_ids, '{}'::uuid[]))
      )
    limit 1;

  if resolved_team is not null then
    new.team_id := resolved_team;
  end if;
  return new;
end;
$$;

drop trigger if exists game_results_stamp_team_id on public.game_results;
create trigger game_results_stamp_team_id
  before insert on public.game_results
  for each row execute function public.stamp_game_result_team_id();
