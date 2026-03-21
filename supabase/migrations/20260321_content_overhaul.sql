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
