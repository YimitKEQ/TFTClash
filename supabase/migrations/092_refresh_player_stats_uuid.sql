-- 092_refresh_player_stats_uuid.sql
-- refresh_player_stats() declared pid as BIGINT, but game_results.player_id
-- and players.id are both uuid. Locking a lobby therefore failed with
-- "invalid input syntax for type bigint: <uuid>" the moment the trigger
-- fired on the new row. Fix the variable type to uuid.

CREATE OR REPLACE FUNCTION public.refresh_player_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pid uuid;
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

  IF NOT FOUND THEN
    UPDATE players SET
      season_pts = 0, wins = 0, top4 = 0,
      games = 0, avg_placement = 0, updated_at = now()
    WHERE id = pid;
  END IF;

  RETURN NULL;
END;
$function$;
