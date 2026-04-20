# Standings Reconciliation Runbook

Run before launch and after any incident that may have affected `players.season_pts`.

## Detect drift

In Supabase SQL Editor, run for the active season:

```sql
WITH active_season AS (
  SELECT id FROM seasons WHERE status = 'active' LIMIT 1
),
computed AS (
  SELECT
    gr.player_id,
    SUM(CASE gr.placement
      WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 6 WHEN 4 THEN 5
      WHEN 5 THEN 4 WHEN 6 THEN 3 WHEN 7 THEN 2 WHEN 8 THEN 1
      ELSE 0 END) AS pts,
    SUM(CASE WHEN gr.placement = 1 THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN gr.placement <= 4 THEN 1 ELSE 0 END) AS top4,
    COUNT(*) AS games
  FROM game_results gr
  WHERE gr.season_id = (SELECT id FROM active_season)
  GROUP BY gr.player_id
)
SELECT
  p.username,
  p.season_pts AS stored_pts,
  COALESCE(c.pts, 0) AS computed_pts,
  p.wins AS stored_wins,
  COALESCE(c.wins, 0) AS computed_wins,
  p.games AS stored_games,
  COALESCE(c.games, 0) AS computed_games
FROM players p
LEFT JOIN computed c ON c.player_id = p.id
WHERE p.season_pts <> COALESCE(c.pts, 0)
   OR p.wins <> COALESCE(c.wins, 0)
   OR p.games <> COALESCE(c.games, 0)
ORDER BY ABS(p.season_pts - COALESCE(c.pts, 0)) DESC;
```

Zero rows = green. Any row = drift.

## Fix drift

1. Sign in as admin -> Command Center -> Maintenance.
2. Click "Recompute Now" under Recompute Standings.
3. Wait for confirmation toast.
4. Re-run the detect query above. Confirm zero rows.
5. Append a dated entry to the drift log below.

## Acceptable drift

None. Any drift is a launch blocker per `docs/LAUNCH-CHECKLIST.md`.

## Drift log

| Date | Players drifted | Cause | Fixed |
|------|-----------------|-------|-------|
|      |                 |       |       |
