-- Game results table: per-game per-player placement tracking
-- Enables: live standings, tiebreaker computation, round-by-round history

CREATE TABLE IF NOT EXISTS game_results (
  id bigint generated always as identity primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  round_number int not null,
  player_id bigint not null references players(id) on delete cascade,
  placement int not null check (placement between 0 and 8),
  points int not null default 0,
  is_dnp boolean default false,
  created_at timestamptz default now()
);

-- Add columns that may be missing
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS lobby_id bigint references lobbies(id) on delete set null;

-- Indexes
CREATE INDEX IF NOT EXISTS game_results_tournament_idx ON game_results (tournament_id);
CREATE INDEX IF NOT EXISTS game_results_player_idx ON game_results (player_id);
CREATE INDEX IF NOT EXISTS game_results_tournament_round_idx ON game_results (tournament_id, round_number);

-- RLS
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_results' AND policyname='Anyone can read game results') THEN
    CREATE POLICY "Anyone can read game results" ON game_results FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_results' AND policyname='Authenticated users can insert game results') THEN
    CREATE POLICY "Authenticated users can insert game results" ON game_results FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='game_results' AND policyname='Authenticated users can update game results') THEN
    CREATE POLICY "Authenticated users can update game results" ON game_results FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;
