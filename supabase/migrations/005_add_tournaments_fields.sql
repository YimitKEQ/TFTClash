-- Add missing fields to tournaments table for full tournament lifecycle
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS round_count int default 3;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS current_round int default 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_players int default 24;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_open_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_close_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS checkin_open_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS checkin_close_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS seeding_method text default 'snake';  -- snake, random, manual
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lobby_size int default 8;

-- Add index on phase for quick filtering
CREATE INDEX IF NOT EXISTS tournaments_phase_idx ON tournaments (phase);
CREATE INDEX IF NOT EXISTS tournaments_date_idx ON tournaments (date DESC);
