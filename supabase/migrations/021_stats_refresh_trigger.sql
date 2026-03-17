-- Migration 021: Auto-refresh player stats columns from game_results
-- Trigger fires AFTER INSERT/UPDATE/DELETE on game_results
-- Updates the denormalized columns on players table for fast reads

CREATE OR REPLACE FUNCTION refresh_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  pid UUID;
BEGIN
  -- Determine which player_id was affected
  IF TG_OP = 'DELETE' THEN
    pid := OLD.player_id;
  ELSE
    pid := NEW.player_id;
  END IF;

  -- Update the denormalized stats columns from the view
  UPDATE players SET
    season_pts = COALESCE(s.total_pts, 0),
    wins = COALESCE(s.wins, 0),
    top4 = COALESCE(s.top4, 0),
    games = COALESCE(s.games, 0),
    avg_placement = COALESCE(s.avg_placement, 0)
  FROM (
    SELECT
      player_id,
      COUNT(*) AS games,
      COALESCE(SUM(points), 0) AS total_pts,
      SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN placement <= 4 THEN 1 ELSE 0 END) AS top4,
      ROUND(AVG(placement)::numeric, 1) AS avg_placement
    FROM game_results
    WHERE player_id = pid AND NOT is_dnp
    GROUP BY player_id
  ) s
  WHERE players.id = pid AND s.player_id = pid;

  -- Handle case where all results for this player were deleted
  IF NOT FOUND AND TG_OP = 'DELETE' THEN
    UPDATE players SET season_pts = 0, wins = 0, top4 = 0, games = 0, avg_placement = 0
    WHERE id = pid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (AFTER so the row is committed before we aggregate)
DROP TRIGGER IF EXISTS trg_refresh_player_stats ON game_results;
CREATE TRIGGER trg_refresh_player_stats
  AFTER INSERT OR UPDATE OR DELETE ON game_results
  FOR EACH ROW
  EXECUTE FUNCTION refresh_player_stats();
