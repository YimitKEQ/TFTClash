-- 124_user_roles_allow_mod.sql
-- The user_roles.role CHECK constraint only permitted player/pro/host/admin,
-- so inserting the 'mod' (Staff) role failed -- even though the RLS policies on
-- game_results/lobbies/tournament_results already reference role='mod'. Add 'mod'
-- to the allowed set.
alter table user_roles drop constraint if exists user_roles_role_check;
alter table user_roles add constraint user_roles_role_check
  check (role = any (array['player', 'pro', 'host', 'admin', 'mod']));
