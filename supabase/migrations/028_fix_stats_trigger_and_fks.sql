-- Migration 028: Fix broken stats trigger + FK type mismatches
-- Fixes: H-5 (stats trigger UUID→BIGINT), H-6 (FK type mismatches), C-4 (tournament_results FK)

-- ============================================================
-- H-5: Fix stats trigger — pid was UUID, must be BIGINT
-- This is the MOST IMPACTFUL fix: player stats currently never refresh
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  pid BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.player_id;
  ELSE
    pid := NEW.player_id;
  END IF;

  UPDATE players SET
    season_pts    = COALESCE(s.total_pts, 0),
    wins          = COALESCE(s.wins, 0),
    top4          = COALESCE(s.top4, 0),
    games         = COALESCE(s.games, 0),
    avg_placement = COALESCE(s.avg_placement, 0),
    updated_at    = now()
  FROM (
    SELECT
      player_id,
      COUNT(*) FILTER (WHERE NOT is_dnp)       AS games,
      COALESCE(SUM(points), 0)                 AS total_pts,
      SUM(CASE WHEN placement = 1 AND NOT is_dnp THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN placement <= 4 AND NOT is_dnp THEN 1 ELSE 0 END) AS top4,
      ROUND(AVG(placement::numeric) FILTER (WHERE NOT is_dnp), 1) AS avg_placement
    FROM game_results
    WHERE player_id = pid
    GROUP BY player_id
  ) s
  WHERE players.id = pid AND s.player_id = pid;

  IF NOT FOUND AND TG_OP = 'DELETE' THEN
    UPDATE players SET
      season_pts = 0, wins = 0, top4 = 0,
      games = 0, avg_placement = 0, updated_at = now()
    WHERE id = pid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_player_stats ON game_results;
CREATE TRIGGER trg_refresh_player_stats
  AFTER INSERT OR UPDATE OR DELETE ON game_results
  FOR EACH ROW
  EXECUTE FUNCTION refresh_player_stats();

-- ============================================================
-- H-6: Fix seasons.champion_player_id UUID→BIGINT
-- ============================================================

ALTER TABLE seasons
  DROP CONSTRAINT IF EXISTS seasons_champion_player_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'champion_player_id'
      AND data_type NOT IN ('bigint', 'integer')
  ) THEN
    ALTER TABLE seasons
      ALTER COLUMN champion_player_id TYPE bigint
        USING CASE WHEN champion_player_id IS NULL THEN NULL
                   ELSE champion_player_id::text::bigint END;
  END IF;
END $$;

ALTER TABLE seasons
  ADD CONSTRAINT seasons_champion_player_id_fkey
    FOREIGN KEY (champion_player_id) REFERENCES players(id) ON DELETE SET NULL;

-- ============================================================
-- H-6: Fix player_achievements.player_id UUID→BIGINT
-- ============================================================

ALTER TABLE player_achievements
  DROP CONSTRAINT IF EXISTS player_achievements_player_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_achievements' AND column_name = 'player_id'
      AND data_type NOT IN ('bigint', 'integer')
  ) THEN
    ALTER TABLE player_achievements
      ALTER COLUMN player_id TYPE bigint
        USING player_id::text::bigint;
  END IF;
END $$;

ALTER TABLE player_achievements
  ADD CONSTRAINT player_achievements_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- ============================================================
-- C-4: Fix tournament_results.player_id — add FK + NOT NULL + indexes
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tournament_results_player_id_fkey'
  ) THEN
    ALTER TABLE tournament_results
      ALTER COLUMN player_id SET NOT NULL;
    ALTER TABLE tournament_results
      ADD CONSTRAINT tournament_results_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tournament_results_tournament_idx
  ON tournament_results (tournament_id);
CREATE INDEX IF NOT EXISTS tournament_results_player_idx
  ON tournament_results (player_id);

-- ============================================================
-- Add game_number column (M-1) and updated_at trigger (M-10)
-- ============================================================

ALTER TABLE game_results ADD COLUMN IF NOT EXISTS game_number INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS game_results_tournament_game_order_idx
  ON game_results (tournament_id, round_number, game_number DESC);

-- Auto-update players.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
