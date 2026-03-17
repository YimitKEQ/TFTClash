-- Players table — formalize the existing dashboard-created table
-- Adds missing columns, indexes, and RLS policies

-- Create table if it doesn't exist (fresh installs)
CREATE TABLE IF NOT EXISTS players (
  id bigint generated always as identity primary key,
  username text not null,
  riot_id text,
  region text default 'EUW',
  rank text default 'Iron',
  created_at timestamptz default now()
);

-- Add columns that may be missing (safe: ADD COLUMN IF NOT EXISTS)
ALTER TABLE players ADD COLUMN IF NOT EXISTS bio text default '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS social_links jsonb default '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_user_id uuid references auth.users(id) on delete set null;
ALTER TABLE players ADD COLUMN IF NOT EXISTS discord_user_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

-- Indexes
CREATE INDEX IF NOT EXISTS players_username_idx ON players (lower(username));
CREATE INDEX IF NOT EXISTS players_auth_user_id_idx ON players (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_discord_user_id_idx ON players (discord_user_id) WHERE discord_user_id IS NOT NULL;

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policies (drop-if-exists pattern to avoid duplicates)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='players' AND policyname='Anyone can read players') THEN
    CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='players' AND policyname='Authenticated users can insert players') THEN
    CREATE POLICY "Authenticated users can insert players" ON players FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='players' AND policyname='Users can update own player') THEN
    CREATE POLICY "Users can update own player" ON players FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='players' AND policyname='Service role can manage players') THEN
    CREATE POLICY "Service role can manage players" ON players FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
