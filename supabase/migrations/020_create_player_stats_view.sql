-- Migration 020: Create player_stats_v view
-- Aggregates game_results into per-player stats
-- This is the canonical source of truth for standings

CREATE OR REPLACE VIEW player_stats_v AS
SELECT
  player_id,
  COUNT(*) AS games,
  COALESCE(SUM(points), 0) AS total_pts,
  SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS wins,
  SUM(CASE WHEN placement <= 4 THEN 1 ELSE 0 END) AS top4,
  ROUND(AVG(placement)::numeric, 1) AS avg_placement
FROM game_results
WHERE NOT is_dnp
GROUP BY player_id;
