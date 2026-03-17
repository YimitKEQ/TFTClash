-- Add DELETE policies so admin actions can clear players and game_results
-- Previously only service_role could delete, so client-side clears silently failed

-- players: allow authenticated users to delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='players' AND policyname='Authenticated users can delete players') THEN
    CREATE POLICY "Authenticated users can delete players" ON players FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- game_results: allow authenticated users to delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_results' AND policyname='Authenticated users can delete game_results') THEN
    CREATE POLICY "Authenticated users can delete game_results" ON game_results FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- site_settings: allow authenticated users to delete
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_settings' AND policyname='write_authenticated_delete') THEN
    CREATE POLICY "write_authenticated_delete" ON site_settings FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
