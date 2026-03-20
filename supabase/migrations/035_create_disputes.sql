-- Disputes table for contested placement reports
-- players.id is BIGINT, lobbies.id is BIGINT, tournaments.id is BIGINT

CREATE TABLE IF NOT EXISTS disputes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  lobby_id BIGINT REFERENCES lobbies(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  claimed_placement INT CHECK (claimed_placement BETWEEN 1 AND 8),
  reported_placement INT,
  reason TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved_accepted', 'resolved_rejected')),
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read disputes"
  ON disputes FOR SELECT USING (true);

CREATE POLICY "Players can create disputes"
  ON disputes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update disputes"
  ON disputes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_disputes_tournament ON disputes(tournament_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_lobby ON disputes(lobby_id, game_number);
