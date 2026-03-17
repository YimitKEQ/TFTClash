-- Migration 022: Add season_id to tournaments and game_results
-- Enables multi-season filtering and historical season queries

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS season_id BIGINT REFERENCES seasons(id);
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS season_id BIGINT REFERENCES seasons(id);

CREATE INDEX IF NOT EXISTS idx_tournaments_season ON tournaments(season_id);
CREATE INDEX IF NOT EXISTS idx_game_results_season ON game_results(season_id);
