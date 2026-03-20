-- Flash tournament support: type, prizes, cut-line, announcement, lobby host method, phase constraint
-- Note: prize_pool already exists as TEXT from create_tournaments.sql; we add prize_pool_json as JSONB

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'season_clash'
  CHECK (type IN ('season_clash', 'flash_tournament'));

-- Use a separate JSONB column for structured prize data (original prize_pool is TEXT)
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool_json JSONB DEFAULT '[]';

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cut_line_pts INT;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS announcement TEXT DEFAULT '';

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lobby_host_method TEXT DEFAULT 'highest_rank'
  CHECK (lobby_host_method IN ('highest_rank', 'random', 'manual'));

-- Add phase CHECK constraint (drop existing if any, re-add with all valid values)
-- Note: tournaments.phase already exists from create_tournaments.sql, just add constraint
DO $$ BEGIN
  ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_phase_check;
  ALTER TABLE tournaments ADD CONSTRAINT tournaments_phase_check
    CHECK (phase IN ('upcoming', 'registration', 'check_in', 'in_progress', 'complete', 'cancelled'));
EXCEPTION WHEN others THEN NULL;
END $$;
