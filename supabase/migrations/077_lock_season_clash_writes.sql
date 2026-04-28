-- 077: lock writes that create or mutate season_clash tournaments
--
-- Background: the prior `Admins manage tournaments` policy granted ALL on
-- public.tournaments to any user with role IN ('admin','host'), with no
-- WITH CHECK constraint. That meant a host-role user could INSERT a row
-- with `type='season_clash'`, then post game_results to it; the
-- refresh_player_stats trigger (post-mig 076) would aggregate those
-- results into players.season_pts because the trigger filters on
-- `tournaments.type = 'season_clash'`. The two layers combined would let
-- any host inflate the official season standings. Hosts must only be
-- allowed to create their own custom or flash tournaments.

DROP POLICY IF EXISTS "Admins manage tournaments" ON public.tournaments;

-- Admins: full write access on every row, including type='season_clash'.
CREATE POLICY "Admins manage tournaments full"
  ON public.tournaments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'admin'
    )
  );

-- Hosts: write access ONLY for non-season_clash tournaments. They cannot
-- create, update, or convert a row into the official season type.
CREATE POLICY "Hosts manage non-season tournaments"
  ON public.tournaments
  FOR ALL
  TO authenticated
  USING (
    type IS DISTINCT FROM 'season_clash'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'host'
    )
  )
  WITH CHECK (
    type IS DISTINCT FROM 'season_clash'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
        AND user_roles.role = 'host'
    )
  );

-- Public read remains as-is via the existing "Anyone can read tournaments"
-- policy. We do not touch it here.

-- Neutralize the unnumbered tighten_site_settings_rls.sql so it cannot
-- silently re-introduce permissive `write_authenticated_*` policies on a
-- future migration run that sorts it after the admin-only policy.
DROP POLICY IF EXISTS "write_authenticated_insert" ON public.site_settings;
DROP POLICY IF EXISTS "write_authenticated_update" ON public.site_settings;

-- Helper RPC so a stuck site_settings.tournament_state pointing at a
-- deleted tournament can be cleared from the client without granting
-- write access to site_settings broadly. Anyone authenticated can call
-- it, but it only clears when the referenced tournament truly does not
-- exist — preventing abuse to wipe an in-flight clash.
CREATE OR REPLACE FUNCTION public.clear_stale_tournament_state(p_region TEXT DEFAULT 'EU')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key   TEXT;
  v_value JSONB;
  v_id    TEXT;
  v_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  v_key := CASE WHEN upper(coalesce(p_region, 'EU')) = 'NA' THEN 'tournament_state_na' ELSE 'tournament_state' END;

  SELECT value INTO v_value FROM public.site_settings WHERE key = v_key;
  IF v_value IS NULL THEN
    RETURN FALSE;
  END IF;

  -- value is stored as a JSON-encoded string; parse defensively.
  IF jsonb_typeof(v_value) = 'string' THEN
    v_value := (v_value #>> '{}')::jsonb;
  END IF;

  v_id := v_value ->> 'dbTournamentId';
  IF v_id IS NULL OR length(v_id) = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.tournaments WHERE id::text = v_id) INTO v_exists;
  IF v_exists THEN
    RETURN FALSE;
  END IF;

  v_value := v_value
    || jsonb_build_object('dbTournamentId', NULL, 'activeTournamentId', NULL, 'phase', 'idle',
                          'registeredIds', '[]'::jsonb, 'checkedInIds', '[]'::jsonb,
                          'waitlistIds', '[]'::jsonb, 'lobbies', '[]'::jsonb, 'lockedLobbies', '[]'::jsonb);

  UPDATE public.site_settings
     SET value = to_jsonb(v_value::text), updated_at = now()
   WHERE key = v_key;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_stale_tournament_state(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_stale_tournament_state(TEXT) TO authenticated;
