-- Add missing columns and unique constraint on lobbies for upsert support

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS lobby_number int;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS player_ids uuid[] DEFAULT '{}';
UPDATE lobbies SET lobby_number = game_num WHERE lobby_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lobbies_tournament_lobby_round_uniq
  ON lobbies (tournament_id, lobby_number, round_number);
-- Migration 026: Remove SVG from host-assets bucket (XSS vector)
-- SVGs can contain <script> tags and execute JavaScript when loaded

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']
WHERE id = 'host-assets';
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
-- Migration 028: Fix broken stats trigger + FK type mismatches
-- Fixes: H-5 (stats trigger UUID→BIGINT), H-6 (FK type mismatches), C-4 (tournament_results FK)

-- ============================================================
-- H-5: Fix stats trigger — pid was UUID, must be BIGINT
-- This is the MOST IMPACTFUL fix: player stats currently never refresh
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  pid BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.player_id;
  ELSE
    pid := NEW.player_id;
  END IF;

  UPDATE players SET
    season_pts    = COALESCE(s.total_pts, 0),
    wins          = COALESCE(s.wins, 0),
    top4          = COALESCE(s.top4, 0),
    games         = COALESCE(s.games, 0),
    avg_placement = COALESCE(s.avg_placement, 0),
    updated_at    = now()
  FROM (
    SELECT
      player_id,
      COUNT(*) FILTER (WHERE NOT is_dnp)       AS games,
      COALESCE(SUM(points), 0)                 AS total_pts,
      SUM(CASE WHEN placement = 1 AND NOT is_dnp THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN placement <= 4 AND NOT is_dnp THEN 1 ELSE 0 END) AS top4,
      ROUND(AVG(placement::numeric) FILTER (WHERE NOT is_dnp), 1) AS avg_placement
    FROM game_results
    WHERE player_id = pid
    GROUP BY player_id
  ) s
  WHERE players.id = pid AND s.player_id = pid;

  IF NOT FOUND AND TG_OP = 'DELETE' THEN
    UPDATE players SET
      season_pts = 0, wins = 0, top4 = 0,
      games = 0, avg_placement = 0, updated_at = now()
    WHERE id = pid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_player_stats ON game_results;
CREATE TRIGGER trg_refresh_player_stats
  AFTER INSERT OR UPDATE OR DELETE ON game_results
  FOR EACH ROW
  EXECUTE FUNCTION refresh_player_stats();

-- ============================================================
-- H-6: Fix seasons.champion_player_id UUID→BIGINT
-- ============================================================

ALTER TABLE seasons
  DROP CONSTRAINT IF EXISTS seasons_champion_player_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seasons' AND column_name = 'champion_player_id'
      AND data_type NOT IN ('bigint', 'integer')
  ) THEN
    ALTER TABLE seasons
      ALTER COLUMN champion_player_id TYPE bigint
        USING CASE WHEN champion_player_id IS NULL THEN NULL
                   ELSE champion_player_id::text::bigint END;
  END IF;
END $$;

ALTER TABLE seasons
  ADD CONSTRAINT seasons_champion_player_id_fkey
    FOREIGN KEY (champion_player_id) REFERENCES players(id) ON DELETE SET NULL;

-- ============================================================
-- H-6: Fix player_achievements.player_id UUID→BIGINT
-- ============================================================

ALTER TABLE player_achievements
  DROP CONSTRAINT IF EXISTS player_achievements_player_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_achievements' AND column_name = 'player_id'
      AND data_type NOT IN ('bigint', 'integer')
  ) THEN
    ALTER TABLE player_achievements
      ALTER COLUMN player_id TYPE bigint
        USING player_id::text::bigint;
  END IF;
END $$;

ALTER TABLE player_achievements
  ADD CONSTRAINT player_achievements_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- ============================================================
-- C-4: Fix tournament_results.player_id — add FK + NOT NULL + indexes
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tournament_results_player_id_fkey'
  ) THEN
    ALTER TABLE tournament_results
      ALTER COLUMN player_id SET NOT NULL;
    ALTER TABLE tournament_results
      ADD CONSTRAINT tournament_results_player_id_fkey
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tournament_results_tournament_idx
  ON tournament_results (tournament_id);
CREATE INDEX IF NOT EXISTS tournament_results_player_idx
  ON tournament_results (player_id);

-- ============================================================
-- Add game_number column (M-1) and updated_at trigger (M-10)
-- ============================================================

ALTER TABLE game_results ADD COLUMN IF NOT EXISTS game_number INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS game_results_tournament_game_order_idx
  ON game_results (tournament_id, round_number, game_number DESC);

-- Auto-update players.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
-- FIX-005: Add game_number column to game_results
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS game_number INT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS game_results_tournament_game_order_idx
  ON game_results (tournament_id, round_number, game_number DESC);

-- FIX-006: Add DNP/DQ tracking to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS dnp_count INT NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified_reason TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_notified_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_position INT;

CREATE INDEX IF NOT EXISTS registrations_disqualified_idx
  ON registrations (tournament_id, disqualified)
  WHERE disqualified = true;

CREATE INDEX IF NOT EXISTS registrations_waitlist_idx
  ON registrations (tournament_id, waitlist_position)
  WHERE status = 'waitlisted';

-- FIX-008: Add updated_at trigger to players
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- FIX-009: Add subscription billing columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT now();

-- FIX-010: Add GIN index on tournament_rounds.lobby_assignments
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_lobby_assignments_gin
  ON tournament_rounds USING GIN (lobby_assignments);
-- FIX-007: Normalize rank values and add CHECK constraint
UPDATE players SET rank = initcap(lower(rank)) WHERE rank IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_rank_check'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT players_rank_check
        CHECK (rank IS NULL OR rank IN (
          'Iron','Bronze','Silver','Gold','Platinum',
          'Emerald','Diamond','Master','Grandmaster','Challenger'
        ));
  END IF;
END $$;
-- Already applied in prior session (tables exist)
-- NEW-001: lobby_players junction table
-- NEW-002: head_to_head records table
-- See docs/RECOMMENDED-MIGRATIONS.sql for full DDL
-- Flash tournament support: type, prizes, cut-line, announcement, lobby host method, phase constraint
-- Note: prize_pool already exists as TEXT from create_tournaments.sql; we add prize_pool_json as JSONB

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'season_clash'
  CHECK (type IN ('season_clash', 'flash_tournament'));

-- Use a separate JSONB column for structured prize data (original prize_pool is TEXT)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool_json JSONB DEFAULT '[]';

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cut_line_pts INT;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS announcement TEXT DEFAULT '';

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lobby_host_method TEXT DEFAULT 'highest_rank'
  CHECK (lobby_host_method IN ('highest_rank', 'random', 'manual'));

-- Add phase CHECK constraint (drop existing if any, re-add with all valid values)
-- Note: tournaments.phase already exists from create_tournaments.sql, just add constraint
DO $$ BEGIN
  ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_phase_check;
  ALTER TABLE tournaments ADD CONSTRAINT tournaments_phase_check
    CHECK (phase IN ('upcoming', 'registration', 'check_in', 'in_progress', 'complete', 'cancelled'));
EXCEPTION WHEN others THEN NULL;
END $$;
-- Lobby game tracking and report completion
-- Note: host_player_id and lobby_code already exist from 003_create_lobbies.sql
-- Note: host_player_id was changed to BIGINT in 007_fix_fk_types.sql

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_number INT DEFAULT 1;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS reports_complete BOOLEAN DEFAULT false;
-- Player self-reported placements for flash tournaments
-- players.id and lobbies.id are BIGINT, tournaments.id is BIGINT

CREATE TABLE IF NOT EXISTS player_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  reported_placement INT CHECK (reported_placement BETWEEN 1 AND 8),
  reported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lobby_id, game_number, player_id)
);

ALTER TABLE player_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reports"
  ON player_reports FOR SELECT USING (true);

CREATE POLICY "Players report own placement"
  ON player_reports FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Players can update own report"
  ON player_reports FOR UPDATE USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Admins can manage reports"
  ON player_reports FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_player_reports_lobby ON player_reports(lobby_id, game_number);
CREATE INDEX IF NOT EXISTS idx_player_reports_tournament ON player_reports(tournament_id);
-- Disputes table for contested placement reports
-- players.id is BIGINT, lobbies.id is BIGINT, tournaments.id is BIGINT

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  claimed_placement INT CHECK (claimed_placement BETWEEN 1 AND 8),
  reported_placement INT,
  reason TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved_accepted', 'resolved_rejected')),
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read disputes"
  ON disputes FOR SELECT USING (true);

CREATE POLICY "Players can create disputes"
  ON disputes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update disputes"
  ON disputes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON disputes(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_lobby ON disputes(lobby_id, game_number);
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
-- Add profile_pic_url column to players table
-- NOTE: The 'avatars' storage bucket must be created manually in the Supabase dashboard.
--   Go to Storage > New bucket > name it "avatars" > set it to public.
ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
-- Add body and icon columns that the frontend expects
-- Keep existing message/type columns for backwards compatibility
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'bell';

-- Copy any existing message data to body
UPDATE notifications SET body = message WHERE body IS NULL AND message IS NOT NULL;
-- game_num is NOT NULL with no default, but the frontend only sets game_number.
-- Add default so lobby inserts don't fail.
ALTER TABLE lobbies ALTER COLUMN game_num SET DEFAULT 1;
-- Content & Visual Overhaul - Database Migration
-- Created: 2026-03-21

-- Activity feed for home dashboard
CREATE TABLE IF NOT EXISTS activity_feed (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  player_id BIGINT REFERENCES players(id),
  detail_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrim system
CREATE TABLE IF NOT EXISTS scrims (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  notes TEXT,
  tag TEXT
);

CREATE TABLE IF NOT EXISTS scrim_players (
  scrim_id BIGINT REFERENCES scrims(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (scrim_id, player_id)
);

CREATE TABLE IF NOT EXISTS scrim_games (
  id BIGSERIAL PRIMARY KEY,
  scrim_id BIGINT REFERENCES scrims(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrim_results (
  id BIGSERIAL PRIMARY KEY,
  scrim_game_id BIGINT REFERENCES scrim_games(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id),
  placement INT NOT NULL,
  points INT NOT NULL
);

-- Subscription/pricing (provider-agnostic)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free','pro','host')),
  provider TEXT DEFAULT 'manual',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_end TIMESTAMPTZ
);

-- Achievements
CREATE TABLE IF NOT EXISTS player_achievements (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  progress JSONB DEFAULT '{}',
  UNIQUE(player_id, achievement_id)
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  criteria_json JSONB NOT NULL,
  start_date DATE,
  end_date DATE,
  reward TEXT
);

CREATE TABLE IF NOT EXISTS player_challenges (
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  challenge_id BIGINT REFERENCES challenges(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (player_id, challenge_id)
);

-- Milestones
CREATE TABLE IF NOT EXISTS player_milestones (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  progress JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  UNIQUE(player_id, milestone_id)
);

-- Host system
CREATE TABLE IF NOT EXISTS host_applications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  community_name TEXT NOT NULL,
  discord_link TEXT,
  player_count TEXT,
  experience TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS host_profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  community_name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#9B72CF',
  banner_url TEXT,
  status TEXT DEFAULT 'active'
);

-- Point adjustments audit trail
CREATE TABLE IF NOT EXISTS point_adjustments (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id),
  admin_id UUID REFERENCES auth.users(id),
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gear items
CREATE TABLE IF NOT EXISTS gear_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price TEXT,
  external_url TEXT,
  category TEXT DEFAULT 'general',
  sort_order INT DEFAULT 0
);

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  champion_id BIGINT REFERENCES players(id),
  config_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active'
);

-- Player penalties
CREATE TABLE IF NOT EXISTS player_penalties (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id),
  admin_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  type TEXT DEFAULT 'ticker',
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  detail_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT REFERENCES players(id),
  referred_id BIGINT REFERENCES players(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend existing tables (safe ADD COLUMN IF NOT EXISTS)
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_clash_rank INT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS consistency_grade TEXT;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES auth.users(id);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{}';

-- Extend user_profiles for onboarding, social, notifications, tier
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS social_twitter TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS social_discord TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS social_twitch TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tier_override TEXT;
-- supabase/migrations/040_clash_engine_sprint1.sql

-- 1. Add Riot ID columns to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS riot_id_na text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS riot_id_eu text;

-- 2. Add is_admin column to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE players SET is_admin = true WHERE id = 1;

-- 3. NOTE: `server` is NOT a DB column -- it lives inside the tournamentState JSON blob
-- stored in site_settings (key='tournament_state'). No ALTER TABLE needed here.
-- The admin sets it via setTournamentState({ server: 'EU' }) which AppContext auto-persists.

-- 4. Create pending_results table
CREATE TABLE IF NOT EXISTS pending_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id),
  round integer NOT NULL,
  lobby_number integer NOT NULL,
  player_id integer REFERENCES players(id),
  placement integer NOT NULL CHECK (placement BETWEEN 1 AND 8),
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
  UNIQUE (tournament_id, round, player_id)
);

CREATE INDEX IF NOT EXISTS pending_results_lookup
  ON pending_results (tournament_id, round, lobby_number);

ALTER TABLE pending_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players insert own pending_results"
  ON pending_results FOR INSERT
  WITH CHECK (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE POLICY "players read own pending_results"
  ON pending_results FOR SELECT
  USING (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE POLICY "admin full access pending_results"
  ON pending_results
  USING (EXISTS (
    SELECT 1 FROM players
    WHERE auth_user_id = auth.uid() AND is_admin = true
  ));

-- 5. Atomic player stats increment RPC
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
  UPDATE players
  SET
    season_pts = COALESCE(season_pts, 0) + p_pts,
    wins = COALESCE(wins, 0) + p_wins
  WHERE id = p_player_id;
END;
$$;

-- Grant execute permission so authenticated users (browser clients) can call this RPC
GRANT EXECUTE ON FUNCTION increment_player_stats(integer, integer, integer) TO authenticated;
