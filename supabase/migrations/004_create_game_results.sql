-- Game results table: per-game per-player placement tracking
-- This is more granular than tournament_results (which stores aggregates)
-- Enables: live standings, tiebreaker computation, round-by-round history
CREATE TABLE IF NOT EXISTS game_results (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  lobby_id bigint references lobbies(id) on delete set null,
  round_number int not null,
  player_id bigint not null references players(id) on delete cascade,
  placement int not null check (placement between 0 and 8),  -- 0 = DNP
  points int not null default 0,
  is_dnp boolean default false,
  created_at timestamptz default now(),
  UNIQUE (tournament_id, round_number, player_id)
);

-- Indexes for fast standings computation
CREATE INDEX IF NOT EXISTS game_results_tournament_idx ON game_results (tournament_id);
CREATE INDEX IF NOT EXISTS game_results_player_idx ON game_results (player_id);
CREATE INDEX IF NOT EXISTS game_results_tournament_round_idx ON game_results (tournament_id, round_number);

-- RLS
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game results"
  ON game_results FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert game results"
  ON game_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update game results"
  ON game_results FOR UPDATE
  TO authenticated
  USING (true);
