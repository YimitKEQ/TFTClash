-- 076: scope refresh_player_stats to season_clash tournaments only
--
-- Background: refresh_player_stats aggregates every game_results row for a
-- player and writes the totals into players.season_pts/wins/top4/games. That
-- aggregation does not look at tournaments.type, so a custom or
-- flash_tournament event that records game_results would inflate the
-- season standings as if it were an official Clash. The Official Clash and
-- custom/flash flows are intended to be fully isolated; this migration
-- restores that isolation at the source of truth.

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
      gr.player_id,
      COUNT(*) FILTER (WHERE NOT gr.is_dnp)                              AS games,
      COALESCE(SUM(gr.points), 0)                                        AS total_pts,
      SUM(CASE WHEN gr.placement = 1 AND NOT gr.is_dnp THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN gr.placement <= 4 AND NOT gr.is_dnp THEN 1 ELSE 0 END) AS top4,
      ROUND(AVG(gr.placement::numeric) FILTER (WHERE NOT gr.is_dnp), 1)  AS avg_placement
    FROM game_results gr
    JOIN tournaments t ON t.id = gr.tournament_id
    WHERE gr.player_id = pid
      AND t.type = 'season_clash'
    GROUP BY gr.player_id
  ) s
  WHERE players.id = pid AND s.player_id = pid;

  -- If no season_clash games remain, zero the row out so the standings
  -- collapse cleanly when an admin nukes the last clash result.
  IF NOT FOUND THEN
    UPDATE players SET
      season_pts = 0, wins = 0, top4 = 0,
      games = 0, avg_placement = 0, updated_at = now()
    WHERE id = pid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Backfill: recompute every player's stats now that custom/flash rows are
-- excluded. Without this, anyone who previously placed in a non-clash event
-- keeps the inflated total until their next clash result lands.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM players LOOP
    UPDATE players p SET
      season_pts    = COALESCE(s.total_pts, 0),
      wins          = COALESCE(s.wins, 0),
      top4          = COALESCE(s.top4, 0),
      games         = COALESCE(s.games, 0),
      avg_placement = COALESCE(s.avg_placement, 0),
      updated_at    = now()
    FROM (
      SELECT
        gr.player_id,
        COUNT(*) FILTER (WHERE NOT gr.is_dnp)                              AS games,
        COALESCE(SUM(gr.points), 0)                                        AS total_pts,
        SUM(CASE WHEN gr.placement = 1 AND NOT gr.is_dnp THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN gr.placement <= 4 AND NOT gr.is_dnp THEN 1 ELSE 0 END) AS top4,
        ROUND(AVG(gr.placement::numeric) FILTER (WHERE NOT gr.is_dnp), 1)  AS avg_placement
      FROM game_results gr
      JOIN tournaments t ON t.id = gr.tournament_id
      WHERE gr.player_id = rec.id
        AND t.type = 'season_clash'
      GROUP BY gr.player_id
    ) s
    WHERE p.id = rec.id;

    IF NOT FOUND THEN
      UPDATE players SET
        season_pts = 0, wins = 0, top4 = 0,
        games = 0, avg_placement = 0, updated_at = now()
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
