-- Lobby game tracking and report completion
-- Note: host_player_id and lobby_code already exist from 003_create_lobbies.sql
-- Note: host_player_id was changed to BIGINT in 007_fix_fk_types.sql

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_number INT DEFAULT 1;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS reports_complete BOOLEAN DEFAULT false;
