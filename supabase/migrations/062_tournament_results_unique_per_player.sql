-- 062_tournament_results_unique_per_player.sql
-- Prevent duplicate rows if an admin re-finalizes a tournament, and enable
-- upsert-on-conflict from both the flash and clash finalize flows. No unique
-- constraint existed on (tournament_id, player_id), so the earlier code paths
-- would happily insert a second row instead of updating the first.

alter table public.tournament_results
  drop constraint if exists tournament_results_unique_per_player;

alter table public.tournament_results
  add constraint tournament_results_unique_per_player
  unique (tournament_id, player_id);
