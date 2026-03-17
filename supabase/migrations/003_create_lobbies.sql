-- Lobbies table: tracks lobby assignments per tournament round
-- Safe for both fresh installs and existing partial tables

CREATE TABLE IF NOT EXISTS lobbies (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references tournaments(id) on delete cascade,
  lobby_number int not null,
  created_at timestamptz default now()
);

-- Add columns that may be missing
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS round_number int not null default 1;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS lobby_code text;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS host_player_id uuid references players(id);
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS player_ids uuid[] not null default '{}';
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS status text not null default 'pending';

-- Index
CREATE INDEX IF NOT EXISTS lobbies_tournament_round_idx ON lobbies (tournament_id, round_number);

-- RLS
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lobbies' AND policyname='Anyone can read lobbies') THEN
    CREATE POLICY "Anyone can read lobbies" ON lobbies FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lobbies' AND policyname='Authenticated users can insert lobbies') THEN
    CREATE POLICY "Authenticated users can insert lobbies" ON lobbies FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lobbies' AND policyname='Authenticated users can update lobbies') THEN
    CREATE POLICY "Authenticated users can update lobbies" ON lobbies FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
