-- Migration 046: Create get_my_player RPC
-- Secure function to fetch the current user's player row without exposing the full table

CREATE OR REPLACE FUNCTION get_my_player()
RETURNS SETOF players
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM players WHERE auth_user_id = auth.uid()
$$;

COMMENT ON FUNCTION get_my_player IS 'Returns the player row for the authenticated user';
