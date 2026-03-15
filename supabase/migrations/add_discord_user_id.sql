-- Run this in Supabase SQL editor after the initial schema is created
ALTER TABLE players ADD COLUMN IF NOT EXISTS discord_user_id text unique;

-- Index for fast Discord ID lookups (used by the bot)
CREATE INDEX IF NOT EXISTS players_discord_user_id_idx ON players (discord_user_id)
  WHERE discord_user_id IS NOT NULL;
