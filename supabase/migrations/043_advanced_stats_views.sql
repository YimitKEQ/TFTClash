-- Migration 043: Advanced Stats Views
-- Two read-only views computed from existing game_results data.
-- No new tables. Views are idempotent (CREATE OR REPLACE).

-- ─── VIEW: player_h2h_stats ──────────────────────────────────────────────────
-- Head-to-head records between every pair of players who shared a lobby.
-- Uses a canonical pairing (LEAST/GREATEST on UUIDs) so each pair appears once.

DROP VIEW IF EXISTS player_h2h_stats;

CREATE OR REPLACE VIEW player_h2h_stats AS
SELECT
  LEAST(a.player_id, b.player_id)    AS player_a_id,
  GREATEST(a.player_id, b.player_id) AS player_b_id,
  pa.username                         AS player_a_name,
  pb.username                         AS player_b_name,
  COUNT(*)                            AS meetings,
  SUM(CASE
    WHEN a.player_id = LEAST(a.player_id, b.player_id)
         AND a.placement < b.placement THEN 1
    WHEN b.player_id = LEAST(a.player_id, b.player_id)
         AND b.placement < a.placement THEN 1
    ELSE 0
  END)                                AS player_a_wins,
  SUM(CASE
    WHEN a.player_id = GREATEST(a.player_id, b.player_id)
         AND a.placement < b.placement THEN 1
    WHEN b.player_id = GREATEST(a.player_id, b.player_id)
         AND b.placement < a.placement THEN 1
    ELSE 0
  END)                                AS player_b_wins,
  ROUND(AVG(CASE
    WHEN a.player_id = LEAST(a.player_id, b.player_id)
         THEN a.placement ELSE b.placement
  END)::numeric, 2)                   AS player_a_avg_placement,
  ROUND(AVG(CASE
    WHEN a.player_id = GREATEST(a.player_id, b.player_id)
         THEN a.placement ELSE b.placement
  END)::numeric, 2)                   AS player_b_avg_placement
FROM game_results a
JOIN game_results b
  ON  a.lobby_id      = b.lobby_id
  AND a.round_number  = b.round_number
  AND a.player_id    <> b.player_id
JOIN players pa ON pa.id = LEAST(a.player_id, b.player_id)
JOIN players pb ON pb.id = GREATEST(a.player_id, b.player_id)
WHERE a.placement BETWEEN 1 AND 8
  AND b.placement BETWEEN 1 AND 8
  AND (a.is_dnp = false OR a.is_dnp IS NULL)
  AND (b.is_dnp = false OR b.is_dnp IS NULL)
GROUP BY
  LEAST(a.player_id, b.player_id),
  GREATEST(a.player_id, b.player_id),
  pa.username,
  pb.username;

-- ─── VIEW: player_consistency_stats ─────────────────────────────────────────
-- Per-player aggregated stats including consistency score and clutch factor.
-- Uses a CTE to pre-compute per-player average (avoids window-fn-inside-aggregate error).
-- Clutch factor: % of games where placement <= FLOOR(personal average).
-- Minimum 3 games required for inclusion.

DROP VIEW IF EXISTS player_consistency_stats;

CREATE OR REPLACE VIEW player_consistency_stats AS
WITH base AS (
  SELECT
    p.id         AS player_id,
    p.username,
    gr.placement,
    gr.id        AS result_id
  FROM players p
  JOIN game_results gr ON gr.player_id = p.id
  WHERE gr.placement BETWEEN 1 AND 8
    AND (gr.is_dnp = false OR gr.is_dnp IS NULL)
),
player_avgs AS (
  SELECT player_id, AVG(placement) AS avg_placement
  FROM base
  GROUP BY player_id
)
SELECT
  b.player_id,
  b.username,
  COUNT(b.result_id)                                         AS games_played,
  ROUND(pa.avg_placement::numeric, 2)                        AS avg_placement,
  ROUND(STDDEV_POP(b.placement)::numeric, 2)                 AS stddev_placement,
  GREATEST(0, LEAST(100,
    100 - (STDDEV_POP(b.placement) * 10)
  ))::numeric(5,1)                                           AS consistency_score,
  ROUND(
    100.0 * SUM(CASE WHEN b.placement <= FLOOR(pa.avg_placement) THEN 1 ELSE 0 END)
           / COUNT(b.result_id), 2
  )                                                          AS clutch_factor,
  ROUND(100.0 * SUM(CASE WHEN b.placement = 1 THEN 1 ELSE 0 END) / COUNT(b.result_id), 2) AS win_rate,
  ROUND(100.0 * SUM(CASE WHEN b.placement <= 4 THEN 1 ELSE 0 END) / COUNT(b.result_id), 2) AS top4_rate,
  ROUND(100.0 * SUM(CASE WHEN b.placement >= 5 THEN 1 ELSE 0 END) / COUNT(b.result_id), 2) AS bot4_rate,
  ROUND(100.0 * SUM(CASE WHEN b.placement = 8 THEN 1 ELSE 0 END) / COUNT(b.result_id), 2) AS eighth_rate,
  MIN(b.placement)                                           AS best_finish,
  MAX(b.placement)                                           AS worst_finish
FROM base b
JOIN player_avgs pa ON pa.player_id = b.player_id
GROUP BY b.player_id, b.username, pa.avg_placement
HAVING COUNT(b.result_id) >= 3;
