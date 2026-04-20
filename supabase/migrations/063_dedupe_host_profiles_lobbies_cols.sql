-- 063_dedupe_host_profiles_lobbies_cols.sql
-- host_profiles grew a nullable auth_user_id alongside the canonical user_id
-- column (uuid NOT NULL, unique) during the PayPal abstraction. No code path
-- writes to auth_user_id; every query filters/writes user_id. Drop it.
--
-- lobbies has both game_num (integer NOT NULL default 1) and game_number
-- (integer nullable default 1). All React code, RPCs and reports key off
-- game_number. game_num is dead weight and both columns must be maintained
-- or one risks drifting. Drop game_num.
--
-- Both tables are empty at time of migration, so no backfill needed.

alter table public.host_profiles drop column if exists auth_user_id;
alter table public.lobbies drop column if exists game_num;
