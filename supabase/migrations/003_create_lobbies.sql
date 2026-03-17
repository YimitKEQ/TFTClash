-- Lobbies table: tracks lobby assignments per tournament round
CREATE TABLE IF NOT EXISTS lobbies (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  round_number int not null default 1,
  lobby_number int not null,
  lobby_code text,
  host_player_id bigint references players(id),
  player_ids bigint[] not null default '{}',
  status text not null default 'pending',  -- pending, active, completed
  created_at timestamptz default now(),
  UNIQUE (tournament_id, round_number, lobby_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS lobbies_tournament_round_idx ON lobbies (tournament_id, round_number);

-- RLS
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read lobbies"
  ON lobbies FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert lobbies"
  ON lobbies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lobbies"
  ON lobbies FOR UPDATE
  TO authenticated
  USING (true);
