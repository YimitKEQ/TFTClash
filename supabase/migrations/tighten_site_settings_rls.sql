-- Tighten site_settings RLS: restrict writes to authenticated users only

-- Drop the overly permissive write policy if it exists
DROP POLICY IF EXISTS "Allow all writes" ON site_settings;
DROP POLICY IF EXISTS "write_all" ON site_settings;
DROP POLICY IF EXISTS "Enable insert for all" ON site_settings;
DROP POLICY IF EXISTS "Enable update for all" ON site_settings;

-- Create authenticated-only write policies
CREATE POLICY "write_authenticated_insert"
  ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "write_authenticated_update"
  ON site_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Keep read-all for realtime subscriptions
-- (read policy should already exist, but ensure it does)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_settings'
    AND policyname = 'read_all'
  ) THEN
    CREATE POLICY "read_all"
      ON site_settings FOR SELECT
      USING (true);
  END IF;
END $$;
