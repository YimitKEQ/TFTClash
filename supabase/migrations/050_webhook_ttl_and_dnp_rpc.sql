-- Webhook events TTL cleanup + DNP increment RPC

CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM webhook_events
  WHERE received_at < (now() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_old_webhook_events() FROM public;
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_events() TO service_role;

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON webhook_events(received_at);

CREATE OR REPLACE FUNCTION increment_dnp_for_players(player_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE players
  SET dnp_count = COALESCE(dnp_count, 0) + 1
  WHERE id = ANY(player_ids);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_dnp_for_players(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION increment_dnp_for_players(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_dnp_for_players(uuid[]) TO service_role;
