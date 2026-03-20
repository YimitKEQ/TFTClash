-- game_num is NOT NULL with no default, but the frontend only sets game_number.
-- Add default so lobby inserts don't fail.
ALTER TABLE lobbies ALTER COLUMN game_num SET DEFAULT 1;
