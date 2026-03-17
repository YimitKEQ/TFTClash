-- Migration 018: Create tournament_rounds table for lobby assignment persistence
-- Part of Host System Overhaul Phase 1

CREATE TABLE IF NOT EXISTS tournament_rounds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  lobby_assignments JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, round_number)
);

-- Indexes
CREATE INDEX idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX idx_tournament_rounds_status ON tournament_rounds(status);

-- RLS
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;

-- Anyone can read rounds
CREATE POLICY "Anyone can read tournament_rounds"
  ON tournament_rounds FOR SELECT
  USING (true);

-- Authenticated users can insert (hosts create rounds)
CREATE POLICY "Authenticated users can insert tournament_rounds"
  ON tournament_rounds FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update (hosts update status/lobbies)
CREATE POLICY "Authenticated users can update tournament_rounds"
  ON tournament_rounds FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role manages tournament_rounds"
  ON tournament_rounds FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
