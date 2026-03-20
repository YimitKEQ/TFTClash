-- RLS Hardening: lock down site_settings, lobbies, tournaments writes to admin/host only

-- ============================================================
-- site_settings: admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert" ON site_settings;
DROP POLICY IF EXISTS "Anyone can update" ON site_settings;
DROP POLICY IF EXISTS "Allow insert for all" ON site_settings;
DROP POLICY IF EXISTS "Allow update for all" ON site_settings;
DROP POLICY IF EXISTS "write_authenticated_insert" ON site_settings;
DROP POLICY IF EXISTS "write_authenticated_update" ON site_settings;

CREATE POLICY "Admins can insert site_settings"
  ON site_settings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update site_settings"
  ON site_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- lobbies: admin/host only for writes (keep existing read policy)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert lobbies" ON lobbies;
DROP POLICY IF EXISTS "Authenticated users can update lobbies" ON lobbies;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON lobbies;
DROP POLICY IF EXISTS "Allow update for authenticated" ON lobbies;

CREATE POLICY "Admins can manage lobbies"
  ON lobbies FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'host'))
  );

-- ============================================================
-- tournaments: admin/host only for writes (keep existing read policy)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON tournaments;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON tournaments;
DROP POLICY IF EXISTS "Allow update for authenticated" ON tournaments;

CREATE POLICY "Admins can manage tournaments"
  ON tournaments FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'host'))
  );
