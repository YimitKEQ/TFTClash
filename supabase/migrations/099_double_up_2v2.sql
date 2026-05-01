-- 099_double_up_2v2.sql
--
-- Adds the 2v2 ("Double Up") tournament mode alongside the existing solo and
-- 4v4 squads modes. The big shape difference vs squads:
--
--   * Solo:        1 team per "lobby slot", 8 player placements (1-8)
--   * 4v4 Squads:  2 teams per lobby (8 players, each player has 1-8 placement)
--   * 2v2 Double:  4 teams per lobby (8 players, both partners SHARE a 1-4
--                   team placement; per-player placement is the team placement)
--
-- New `teams_per_lobby` column captures that shape. Existing 4v4 events get
-- backfilled to teams_per_lobby = 2 so behaviour is unchanged.
--
-- Points scales:
--   * standard       -> solo / 4v4: PTS = {1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}
--   * win_weighted   -> existing variant
--   * double_up      -> Riot official 4-3-2-1 (per partner)
--   * double_up_swiss-> Same as double_up but late-round multipliers (R4 1.25x, R5 1.5x)
--
-- Custom-only scope: Double Up tournaments never feed season standings. The
-- existing season filter `type = 'season_clash'` already isolates them, so no
-- extra guard is needed here.

------------------------------------------------------------------------------
-- 1. teams_per_lobby column on tournaments
------------------------------------------------------------------------------
alter table public.tournaments
  add column if not exists teams_per_lobby int
    check (teams_per_lobby in (1, 2, 4));

comment on column public.tournaments.teams_per_lobby is
  '1 = solo, 2 = 4v4 squads, 4 = 2v2 Double Up. NULL means inferred from team_size.';

------------------------------------------------------------------------------
-- 2. Extend points_scale check to allow Double Up scales
------------------------------------------------------------------------------
alter table public.tournaments
  drop constraint if exists tournaments_points_scale_check;

alter table public.tournaments
  add constraint tournaments_points_scale_check
  check (points_scale in ('standard', 'win_weighted', 'double_up', 'double_up_swiss'));

------------------------------------------------------------------------------
-- 3. Backfill existing tournaments
------------------------------------------------------------------------------
update public.tournaments
   set teams_per_lobby = case
     when team_size = 1 then 1
     when team_size = 4 then 2
     else teams_per_lobby
   end
 where teams_per_lobby is null
   and team_size in (1, 4);

------------------------------------------------------------------------------
-- 4. Sanity: make sure nothing is in a half-configured Double Up state
------------------------------------------------------------------------------
-- If team_size = 2 but teams_per_lobby is null, treat as Double Up by default.
update public.tournaments
   set teams_per_lobby = 4
 where team_size = 2
   and teams_per_lobby is null;
