-- ============================================================
-- 044_security_hardening.sql
-- Fixes CRITICAL and HIGH security issues found in audit
-- ============================================================

-- ── C-2: Enable RLS on 13 unprotected tables from content overhaul ──
ALTER TABLE IF EXISTS activity_feed       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scrim_players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scrim_games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scrim_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS point_adjustments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gear_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS player_penalties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS referrals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS player_challenges   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS player_milestones   ENABLE ROW LEVEL SECURITY;

-- Public read-only tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_feed') THEN
    DROP POLICY IF EXISTS "public read activity_feed" ON activity_feed;
    CREATE POLICY "public read activity_feed" ON activity_feed FOR SELECT USING (true);
    DROP POLICY IF EXISTS "service role manages activity_feed" ON activity_feed;
    CREATE POLICY "service role manages activity_feed" ON activity_feed FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gear_items') THEN
    DROP POLICY IF EXISTS "public read gear_items" ON gear_items;
    CREATE POLICY "public read gear_items" ON gear_items FOR SELECT USING (true);
    DROP POLICY IF EXISTS "service role manages gear_items" ON gear_items;
    CREATE POLICY "service role manages gear_items" ON gear_items FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements') THEN
    DROP POLICY IF EXISTS "public read announcements" ON announcements;
    CREATE POLICY "public read announcements" ON announcements FOR SELECT USING (true);
    DROP POLICY IF EXISTS "service role manages announcements" ON announcements;
    CREATE POLICY "service role manages announcements" ON announcements FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Player-scoped read tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_milestones') THEN
    DROP POLICY IF EXISTS "public read milestones" ON player_milestones;
    CREATE POLICY "public read milestones" ON player_milestones FOR SELECT USING (true);
    DROP POLICY IF EXISTS "service role manages milestones" ON player_milestones;
    CREATE POLICY "service role manages milestones" ON player_milestones FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_challenges') THEN
    DROP POLICY IF EXISTS "public read challenges" ON player_challenges;
    CREATE POLICY "public read challenges" ON player_challenges FOR SELECT USING (true);
    DROP POLICY IF EXISTS "service role manages challenges" ON player_challenges;
    CREATE POLICY "service role manages challenges" ON player_challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
    DROP POLICY IF EXISTS "users read own subscription" ON user_subscriptions;
    CREATE POLICY "users read own subscription" ON user_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
    DROP POLICY IF EXISTS "service role manages subscriptions" ON user_subscriptions;
    CREATE POLICY "service role manages subscriptions" ON user_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Admin/service-role only sensitive tables
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'point_adjustments') THEN
    DROP POLICY IF EXISTS "service role manages point_adjustments" ON point_adjustments;
    CREATE POLICY "service role manages point_adjustments" ON point_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "admins read point_adjustments" ON point_adjustments;
    CREATE POLICY "admins read point_adjustments" ON point_adjustments FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_penalties') THEN
    DROP POLICY IF EXISTS "service role manages player_penalties" ON player_penalties;
    CREATE POLICY "service role manages player_penalties" ON player_penalties FOR ALL TO service_role USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "admins read player_penalties" ON player_penalties;
    CREATE POLICY "admins read player_penalties" ON player_penalties FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_log') THEN
    DROP POLICY IF EXISTS "service role manages admin_audit_log" ON admin_audit_log;
    CREATE POLICY "service role manages admin_audit_log" ON admin_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "admins read admin_audit_log" ON admin_audit_log;
    CREATE POLICY "admins read admin_audit_log" ON admin_audit_log FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals') THEN
    DROP POLICY IF EXISTS "service role manages referrals" ON referrals;
    CREATE POLICY "service role manages referrals" ON referrals FOR ALL TO service_role USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "users read own referrals" ON referrals;
    CREATE POLICY "users read own referrals" ON referrals FOR SELECT TO authenticated
      USING (referrer_id = (SELECT id FROM players WHERE auth_user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- Scrim tables: read by authenticated, write by service_role
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scrim_players') THEN
    DROP POLICY IF EXISTS "authenticated read scrim_players" ON scrim_players;
    CREATE POLICY "authenticated read scrim_players" ON scrim_players FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "service role manages scrim_players" ON scrim_players;
    CREATE POLICY "service role manages scrim_players" ON scrim_players FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scrim_games') THEN
    DROP POLICY IF EXISTS "authenticated read scrim_games" ON scrim_games;
    CREATE POLICY "authenticated read scrim_games" ON scrim_games FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "service role manages scrim_games" ON scrim_games;
    CREATE POLICY "service role manages scrim_games" ON scrim_games FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scrim_results') THEN
    DROP POLICY IF EXISTS "authenticated read scrim_results" ON scrim_results;
    CREATE POLICY "authenticated read scrim_results" ON scrim_results FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "service role manages scrim_results" ON scrim_results;
    CREATE POLICY "service role manages scrim_results" ON scrim_results FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── C-3: Restrict increment_player_stats to admin only ──
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_player_id integer,
  p_pts integer,
  p_wins integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_pts NOT BETWEEN 0 AND 8 THEN
    RAISE EXCEPTION 'p_pts must be between 0 and 8';
  END IF;
  IF p_wins NOT IN (0, 1) THEN
    RAISE EXCEPTION 'p_wins must be 0 or 1';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  UPDATE players
  SET
    season_pts = COALESCE(season_pts, 0) + p_pts,
    wins = COALESCE(wins, 0) + p_wins
  WHERE id = p_player_id;
END;
$$;

-- ── C-4: Fix pending_results admin policy to use user_roles ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pending_results') THEN
    DROP POLICY IF EXISTS "admin full access pending_results" ON pending_results;
    CREATE POLICY "admin full access pending_results" ON pending_results FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── C-5: Fix disputes INSERT to own player only ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
    DROP POLICY IF EXISTS "Players can create disputes" ON disputes;
    CREATE POLICY "Players can create disputes" ON disputes FOR INSERT TO authenticated
      WITH CHECK (
        player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid() LIMIT 1)
      );
  END IF;
END $$;

-- ── H-1: Add game_results admin write policies ──
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can insert game_results" ON game_results;
  CREATE POLICY "Admins can insert game_results" ON game_results FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

  DROP POLICY IF EXISTS "Admins can update game_results" ON game_results;
  CREATE POLICY "Admins can update game_results" ON game_results FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

  DROP POLICY IF EXISTS "Admins can delete game_results" ON game_results;
  CREATE POLICY "Admins can delete game_results" ON game_results FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
END $$;

-- ── H-4: Fix registrations INSERT to own player only ──
DROP POLICY IF EXISTS "Authenticated users can register" ON registrations;
CREATE POLICY "Users can register own player" ON registrations FOR INSERT TO authenticated
  WITH CHECK (
    player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- ── H-5: Create avatars bucket with MIME restrictions ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'],
  file_size_limit = 2097152;

-- ── M-3: Fix audit_log INSERT for admins ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    DROP POLICY IF EXISTS "Admins can insert audit_log" ON audit_log;
    CREATE POLICY "Admins can insert audit_log" ON audit_log FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
