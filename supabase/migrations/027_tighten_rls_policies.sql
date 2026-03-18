-- Migration 027: Tighten RLS policies across all sensitive tables
-- Fixes: C-1, C-2, C-3, H-1, H-2, H-3, H-4, M-3, M-4

-- ============================================================
-- C-3: Drop leftover permissive "write all" on site_settings
-- ============================================================
DROP POLICY IF EXISTS "write all" ON site_settings;

-- ============================================================
-- C-2: Remove open game_results write policies
-- Writes must go through service_role (admin backend only)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert game results" ON game_results;
DROP POLICY IF EXISTS "Authenticated users can update game results" ON game_results;
DROP POLICY IF EXISTS "Authenticated users can delete game_results" ON game_results;
DROP POLICY IF EXISTS "Authenticated users can delete game results" ON game_results;

-- ============================================================
-- C-1: Fix registrations UPDATE — only own registration
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can update registrations" ON registrations;
DROP POLICY IF EXISTS "Authenticated users can update own registration" ON registrations;
CREATE POLICY "Users can update own registration"
  ON registrations FOR UPDATE
  TO authenticated
  USING (
    player_id = (
      SELECT id FROM players WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1
    )
  );

-- ============================================================
-- H-1: Players INSERT — must match own auth_user_id
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert players" ON players;
CREATE POLICY "Users can insert own player"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- ============================================================
-- H-2: Players DELETE — restrict to service_role only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete players" ON players;

-- ============================================================
-- H-3: Seasons INSERT — restrict to service_role only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert seasons" ON seasons;
DROP POLICY IF EXISTS "Authenticated users can insert seasons" ON seasons;

-- ============================================================
-- H-4: Tournament rounds — require tournament host ownership
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert tournament_rounds" ON tournament_rounds;
DROP POLICY IF EXISTS "Authenticated users can update tournament_rounds" ON tournament_rounds;

-- ============================================================
-- M-3: Notifications INSERT — restrict to service_role only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

-- ============================================================
-- M-4: Audit log INSERT — restrict to service_role only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit_log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON audit_log;

-- ============================================================
-- L-4: Remove redundant permissive user_roles SELECT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read roles" ON user_roles;
