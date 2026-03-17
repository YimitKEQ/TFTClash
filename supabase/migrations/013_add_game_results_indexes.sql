-- Additional indexes for efficient standings computation and player stats
CREATE INDEX IF NOT EXISTS game_results_player_tournament_idx ON game_results (player_id, tournament_id);
CREATE INDEX IF NOT EXISTS game_results_placement_idx ON game_results (tournament_id, placement);
