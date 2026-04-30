-- 091_notify_tournament_players_uuid.sql
-- tournaments.id is uuid but notify_tournament_players was declared with
-- p_tournament_id bigint. Calling it from the admin broadcast button
-- threw "invalid input syntax for type bigint". Recreate it with uuid.

DROP FUNCTION IF EXISTS public.notify_tournament_players(bigint, text, text, text, text[]);

CREATE OR REPLACE FUNCTION public.notify_tournament_players(
  p_tournament_id uuid,
  p_title text,
  p_body text,
  p_icon text DEFAULT 'bell'::text,
  p_statuses text[] DEFAULT ARRAY['checked_in'::text, 'registered'::text]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  notified int := 0;
BEGIN
  INSERT INTO notifications (user_id, title, body, message, icon, type, read, created_at)
  SELECT
    p.auth_user_id,
    p_title,
    p_body,
    p_body,
    COALESCE(p_icon, 'bell'),
    'info',
    false,
    now()
  FROM registrations r
  JOIN players p ON r.player_id = p.id
  WHERE r.tournament_id = p_tournament_id
    AND r.status = ANY(p_statuses)
    AND p.auth_user_id IS NOT NULL;

  GET DIAGNOSTICS notified = ROW_COUNT;
  RETURN notified;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.notify_tournament_players(uuid, text, text, text, text[]) TO authenticated, service_role;
