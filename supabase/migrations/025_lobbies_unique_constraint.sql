-- Add missing columns and unique constraint on lobbies for upsert support

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS lobby_number int;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS player_ids uuid[] DEFAULT '{}';
UPDATE lobbies SET lobby_number = game_num WHERE lobby_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lobbies_tournament_lobby_round_uniq
  ON lobbies (tournament_id, lobby_number, round_number);
