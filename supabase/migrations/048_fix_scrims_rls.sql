-- Migration 048: Fix scrims table RLS policies
-- RLS was enabled (migration 042) but NO policies were created,
-- so all reads and writes silently fail for authenticated users.
-- Also adds missing target_games column if not present.

-- Add target_games column (used by ScrimsScreen but may not exist)
ALTER TABLE scrims ADD COLUMN IF NOT EXISTS target_games INT DEFAULT 5;

-- Allow all authenticated users to read scrims (scrim access is app-level gated)
DROP POLICY IF EXISTS "authenticated read scrims" ON scrims;
CREATE POLICY "authenticated read scrims" ON scrims
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert scrims (scrim host check is app-level)
DROP POLICY IF EXISTS "authenticated insert scrims" ON scrims;
CREATE POLICY "authenticated insert scrims" ON scrims
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Allow scrim creators to update their own scrims (end, edit)
DROP POLICY IF EXISTS "creator update scrims" ON scrims;
CREATE POLICY "creator update scrims" ON scrims
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- Allow scrim creators to delete their own scrims
DROP POLICY IF EXISTS "creator delete scrims" ON scrims;
CREATE POLICY "creator delete scrims" ON scrims
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Service role full access (for admin operations)
DROP POLICY IF EXISTS "service role manages scrims" ON scrims;
CREATE POLICY "service role manages scrims" ON scrims
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Also fix child tables: allow authenticated users to INSERT
-- (they could only SELECT before, making game submission impossible)
DROP POLICY IF EXISTS "authenticated insert scrim_players" ON scrim_players;
CREATE POLICY "authenticated insert scrim_players" ON scrim_players
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated insert scrim_games" ON scrim_games;
CREATE POLICY "authenticated insert scrim_games" ON scrim_games
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated insert scrim_results" ON scrim_results;
CREATE POLICY "authenticated insert scrim_results" ON scrim_results
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow updates to scrim_games (for editing notes/tags)
DROP POLICY IF EXISTS "authenticated update scrim_games" ON scrim_games;
CREATE POLICY "authenticated update scrim_games" ON scrim_games
  FOR UPDATE TO authenticated USING (true);

-- Allow deletes on scrim_games (for removing games)
DROP POLICY IF EXISTS "authenticated delete scrim_games" ON scrim_games;
CREATE POLICY "authenticated delete scrim_games" ON scrim_games
  FOR DELETE TO authenticated USING (true);
