-- Registrations table: tracks player registration + check-in for each tournament
-- Statuses: registered, checked_in, waitlisted, dropped, no_show
CREATE TABLE IF NOT EXISTS registrations (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references tournaments(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  status text not null default 'registered',
  registered_at timestamptz default now(),
  checked_in_at timestamptz,
  dropped_at timestamptz,
  waitlist_position int,
  UNIQUE (tournament_id, player_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS registrations_tournament_idx ON registrations (tournament_id);
CREATE INDEX IF NOT EXISTS registrations_player_idx ON registrations (player_id);
CREATE INDEX IF NOT EXISTS registrations_status_idx ON registrations (tournament_id, status);

-- RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can read registrations (see who's registered)
CREATE POLICY "Anyone can read registrations"
  ON registrations FOR SELECT
  USING (true);

-- Authenticated users can register themselves
CREATE POLICY "Authenticated users can register"
  ON registrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update their own registration (check-in, drop)
CREATE POLICY "Authenticated users can update own registration"
  ON registrations FOR UPDATE
  TO authenticated
  USING (true);

-- Service role can manage all registrations (admin operations)
CREATE POLICY "Service role can manage registrations"
  ON registrations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
