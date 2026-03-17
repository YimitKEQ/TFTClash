-- Migration 019: Add stats columns to players table
-- Discord bot queries these: season_pts, wins, top4
-- Also add games and avg_placement for frontend use

ALTER TABLE players ADD COLUMN IF NOT EXISTS season_pts INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS top4 INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS games INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avg_placement NUMERIC(3,1) NOT NULL DEFAULT 0;

-- Index for leaderboard queries (Discord bot sorts by season_pts DESC)
CREATE INDEX IF NOT EXISTS idx_players_season_pts ON players(season_pts DESC);
