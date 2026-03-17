-- Fix FK type mismatches: child tables used uuid but parents use bigint
-- Safe: these tables should be empty in production (migrations not yet applied)

-- registrations
ALTER TABLE IF EXISTS registrations DROP CONSTRAINT IF EXISTS registrations_tournament_id_fkey;
ALTER TABLE IF EXISTS registrations DROP CONSTRAINT IF EXISTS registrations_player_id_fkey;
ALTER TABLE IF EXISTS registrations ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
ALTER TABLE IF EXISTS registrations ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;
ALTER TABLE IF EXISTS registrations ADD CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS registrations ADD CONSTRAINT registrations_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- lobbies
ALTER TABLE IF EXISTS lobbies DROP CONSTRAINT IF EXISTS lobbies_tournament_id_fkey;
ALTER TABLE IF EXISTS lobbies DROP CONSTRAINT IF EXISTS lobbies_host_player_id_fkey;
ALTER TABLE IF EXISTS lobbies ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
ALTER TABLE IF EXISTS lobbies ALTER COLUMN host_player_id TYPE bigint USING host_player_id::text::bigint;
ALTER TABLE IF EXISTS lobbies ALTER COLUMN player_ids TYPE bigint[] USING player_ids::text[]::bigint[];
ALTER TABLE IF EXISTS lobbies ADD CONSTRAINT lobbies_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS lobbies ADD CONSTRAINT lobbies_host_player_id_fkey FOREIGN KEY (host_player_id) REFERENCES players(id) ON DELETE SET NULL;

-- game_results
ALTER TABLE IF EXISTS game_results DROP CONSTRAINT IF EXISTS game_results_tournament_id_fkey;
ALTER TABLE IF EXISTS game_results DROP CONSTRAINT IF EXISTS game_results_player_id_fkey;
ALTER TABLE IF EXISTS game_results ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
ALTER TABLE IF EXISTS game_results ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;
ALTER TABLE IF EXISTS game_results ADD CONSTRAINT game_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS game_results ADD CONSTRAINT game_results_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
