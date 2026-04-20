-- 065_drop_duplicate_game_results_indexes.sql
-- game_results had two pairs of identical btree indexes. Each duplicate
-- forces an extra write on every insert/update and wastes pg_buffercache.
-- Keep the ones tied to a constraint or the original (older) definition.

drop index if exists public.game_results_tournament_game_order_idx;
drop index if exists public.game_results_unique_per_game;
