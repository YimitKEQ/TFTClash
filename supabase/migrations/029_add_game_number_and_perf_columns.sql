-- FIX-005: Add game_number column to game_results
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS game_number INT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS game_results_tournament_game_order_idx
  ON game_results (tournament_id, round_number, game_number DESC);

-- FIX-006: Add DNP/DQ tracking to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS dnp_count INT NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified_reason TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_notified_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_position INT;

CREATE INDEX IF NOT EXISTS registrations_disqualified_idx
  ON registrations (tournament_id, disqualified)
  WHERE disqualified = true;

CREATE INDEX IF NOT EXISTS registrations_waitlist_idx
  ON registrations (tournament_id, waitlist_position)
  WHERE status = 'waitlisted';

-- FIX-008: Add updated_at trigger to players
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- FIX-009: Add subscription billing columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT now();

-- FIX-010: Add GIN index on tournament_rounds.lobby_assignments
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_lobby_assignments_gin
  ON tournament_rounds USING GIN (lobby_assignments);
