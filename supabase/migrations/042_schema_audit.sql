-- =============================================================
-- Migration 042: Schema Audit
-- Date: 2026-03-25
-- Adds missing columns identified during full schema audit
-- =============================================================

-- -------------------------------------------------------------
-- 1. players: add avatar_url (alias for profile_pic_url)
--    The spec calls this avatar_url; DB has profile_pic_url.
--    Add avatar_url as a separate nullable text column so both
--    names work until the frontend is unified on one.
-- -------------------------------------------------------------
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill avatar_url from profile_pic_url where set
UPDATE players SET avatar_url = profile_pic_url
WHERE avatar_url IS NULL AND profile_pic_url IS NOT NULL;

-- -------------------------------------------------------------
-- 2. players: add tier column (text, default 'free')
--    Used by tiers.js / hasFeature() to gate Pro/Host features.
--    tier_override already exists; tier is the canonical value.
-- -------------------------------------------------------------
ALTER TABLE players ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';

-- Backfill from tier_override where set
UPDATE players SET tier = tier_override
WHERE tier_override IS NOT NULL AND tier = 'free';

-- -------------------------------------------------------------
-- 3. activity_events: create as a view over activity_feed
--    The spec/frontend references activity_events; the real table
--    is activity_feed (created in 20260321_content_overhaul.sql).
--    A view provides compatibility without duplicating data.
--    Columns mapped: id, type, actor_id (player_id), data (detail_json), created_at
-- -------------------------------------------------------------
CREATE OR REPLACE VIEW activity_events AS
  SELECT
    id,
    type,
    player_id   AS actor_id,
    detail_json AS data,
    created_at
  FROM activity_feed;

-- -------------------------------------------------------------
-- 4. host_profiles: add name, email, tier columns
--    Current schema uses org_name (not name) and has no email or
--    tier. Add the columns the spec requires without dropping
--    the existing org_name column.
-- -------------------------------------------------------------
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'host';

-- Backfill name from org_name
UPDATE host_profiles SET name = org_name WHERE name IS NULL AND org_name IS NOT NULL;

-- -------------------------------------------------------------
-- 5. host_profiles: ensure logo_url and banner_url exist
--    (already present in current schema -- these are no-ops)
-- -------------------------------------------------------------
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- -------------------------------------------------------------
-- 6. host_profiles: add auth_user_id alias column
--    Current schema uses user_id (uuid ref auth.users).
--    Add auth_user_id so the spec column name resolves.
-- -------------------------------------------------------------
ALTER TABLE host_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Backfill auth_user_id from user_id
UPDATE host_profiles SET auth_user_id = user_id WHERE auth_user_id IS NULL AND user_id IS NOT NULL;

-- -------------------------------------------------------------
-- 7. disputes: add reporter_id and accused_id columns
--    Current schema uses player_id (the disputing player) and
--    has no accused_id. Add both for spec compliance.
-- -------------------------------------------------------------
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS accused_id UUID REFERENCES auth.users(id);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS description TEXT;

-- Backfill description from reason
UPDATE disputes SET description = reason WHERE description IS NULL AND reason IS NOT NULL;

-- -------------------------------------------------------------
-- 8. notifications: ensure body column exists
--    (already present from migration 038 -- no-op)
-- -------------------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;

-- -------------------------------------------------------------
-- 9. Verify RLS is enabled on all sensitive tables
--    (already enabled -- these are idempotent guards)
-- -------------------------------------------------------------
ALTER TABLE players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrims          ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes        ENABLE ROW LEVEL SECURITY;
