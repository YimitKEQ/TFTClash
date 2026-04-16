-- 051: Tighten scrim_games / scrim_results RLS
-- Previous policy (048) allowed ANY authenticated user to delete/update scrim rows,
-- which lets a logged-in player nuke another host's session data.
-- Restrict mutations to rows owned by the caller via the parent scrim's created_by.

-- ─── scrim_games ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated insert scrim_games" ON scrim_games;
CREATE POLICY "scrim_games_insert_own" ON scrim_games
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scrims s
      WHERE s.id = scrim_games.scrim_id
        AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated update scrim_games" ON scrim_games;
CREATE POLICY "scrim_games_update_own" ON scrim_games
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scrims s
      WHERE s.id = scrim_games.scrim_id
        AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated delete scrim_games" ON scrim_games;
CREATE POLICY "scrim_games_delete_own" ON scrim_games
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scrims s
      WHERE s.id = scrim_games.scrim_id
        AND s.created_by = auth.uid()
    )
  );

-- ─── scrim_results ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated insert scrim_results" ON scrim_results;
CREATE POLICY "scrim_results_insert_own" ON scrim_results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scrim_games sg
      JOIN scrims s ON s.id = sg.scrim_id
      WHERE sg.id = scrim_results.scrim_game_id
        AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated update scrim_results" ON scrim_results;
CREATE POLICY "scrim_results_update_own" ON scrim_results
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scrim_games sg
      JOIN scrims s ON s.id = sg.scrim_id
      WHERE sg.id = scrim_results.scrim_game_id
        AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated delete scrim_results" ON scrim_results;
CREATE POLICY "scrim_results_delete_own" ON scrim_results
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scrim_games sg
      JOIN scrims s ON s.id = sg.scrim_id
      WHERE sg.id = scrim_results.scrim_game_id
        AND s.created_by = auth.uid()
    )
  );
