-- Create players table (was previously created via dashboard, now formalized)
-- This is the source of truth for the player roster
CREATE TABLE IF NOT EXISTS players (
  id bigint generated always as identity primary key,
  username text not null,
  riot_id text,
  region text default 'EUW',
  rank text default 'Iron',
  bio text default '',
  social_links jsonb default '{}',
  auth_user_id uuid references auth.users(id) on delete set null,
  discord_user_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS players_username_idx ON players (lower(username));
CREATE INDEX IF NOT EXISTS players_auth_user_id_idx ON players (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_discord_user_id_idx ON players (discord_user_id) WHERE discord_user_id IS NOT NULL;

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Anyone can read players (public leaderboard)
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT
  USING (true);

-- Authenticated users can insert (signup creates a player row)
CREATE POLICY "Authenticated users can insert players"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own player row
CREATE POLICY "Users can update own player"
  ON players FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- Admins (service_role) can update any player
CREATE POLICY "Service role can manage players"
  ON players FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
