-- 089_squads_post_review_patches.sql
-- Post-review hardening for the 4v4 Squads in-event flow:
--   * Freeze lineup_player_ids once a team is checked_in (prevents mid-event
--     starter swaps via direct API calls).
--   * Make team_id resolution on game_results inserts deterministic when a
--     player happens to appear on more than one team registration in the
--     same tournament (data anomaly, but no DB constraint prevents it yet).

------------------------------------------------------------------------------
-- 1. Freeze lineup once checked in. Admins/service still bypass.
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

  -- Lineup is locked once the team has checked in. Any further attempt to
  -- mutate lineup_player_ids while status remains checked_in is rejected.
  if TG_OP = 'UPDATE' and old.status = 'checked_in' then
    if new.lineup_player_ids is distinct from old.lineup_player_ids then
      raise exception 'Lineup is locked after check-in.'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

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

------------------------------------------------------------------------------
-- 2. Deterministic team_id resolution on game_results inserts.
--    Earliest-created registration wins when a player appears in multiple
--    team lineups for the same tournament. Solo registrations (player_id
--    direct match) are still preferred over lineup-array hits.
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

  -- Prefer the direct solo registration first.
  select r.team_id into resolved_team
    from public.registrations r
    where r.tournament_id = new.tournament_id
      and r.player_id = new.player_id
    order by r.created_at asc
    limit 1;

  if resolved_team is null then
    select r.team_id into resolved_team
      from public.registrations r
      where r.tournament_id = new.tournament_id
        and new.player_id = any(coalesce(r.lineup_player_ids, '{}'::uuid[]))
      order by r.created_at asc
      limit 1;
  end if;

  if resolved_team is not null then
    new.team_id := resolved_team;
  end if;
  return new;
end;
$$;
