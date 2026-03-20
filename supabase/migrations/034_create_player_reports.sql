-- Player self-reported placements for flash tournaments
-- players.id and lobbies.id are BIGINT, tournaments.id is BIGINT

CREATE TABLE IF NOT EXISTS player_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  lobby_id BIGINT REFERENCES lobbies(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  reported_placement INT CHECK (reported_placement BETWEEN 1 AND 8),
  reported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lobby_id, game_number, player_id)
);

ALTER TABLE player_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reports"
  ON player_reports FOR SELECT USING (true);

CREATE POLICY "Players report own placement"
  ON player_reports FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Players can update own report"
  ON player_reports FOR UPDATE USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Admins can manage reports"
  ON player_reports FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_player_reports_lobby ON player_reports(lobby_id, game_number);
CREATE INDEX IF NOT EXISTS idx_player_reports_tournament ON player_reports(tournament_id);
