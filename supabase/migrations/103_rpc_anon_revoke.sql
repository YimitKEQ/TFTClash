-- 103_rpc_anon_revoke.sql
-- Closes the remaining Supabase advisor warnings:
--   1. anon_security_definer_function_executable (9 RPCs)
--   2. authenticated_security_definer_function_executable for RPCs that should
--      never be callable by signed-in users (cron-only / admin-only).
--
-- Functions kept callable by `authenticated` (advisor will still warn — these
-- are intentional and the warning is informational only):
--   - is_admin_or_mod, is_scrim_host, get_own_player_fields (RLS helpers; the
--     RLS engine evaluates as the calling role and must be able to call them)
--   - get_my_player (self-fetch; filters by auth.uid())
--   - clear_stale_tournament_state (self-checks auth.uid() IS NOT NULL)
--   - notify_tournament_players (host-gated internally)
--   - increment_dnp_for_players (admin-gated internally — added below)

------------------------------------------------------------------------------
-- 1. Revoke EXECUTE from anon on every flagged RPC.
------------------------------------------------------------------------------
revoke execute on function public.cleanup_old_webhook_events()                                                              from anon;
revoke execute on function public.clear_stale_tournament_state(text)                                                        from anon;
revoke execute on function public.get_my_player()                                                                           from anon;
revoke execute on function public.get_own_player_fields(uuid)                                                               from anon;
revoke execute on function public.increment_dnp_for_players(uuid[])                                                         from anon;
revoke execute on function public.increment_player_stats(uuid, integer, integer)                                            from anon;
revoke execute on function public.is_admin_or_mod(uuid)                                                                     from anon;
revoke execute on function public.is_scrim_host(uuid)                                                                       from anon;
revoke execute on function public.notify_tournament_players(uuid, text, text, text, text[])                                 from anon;

------------------------------------------------------------------------------
-- 2. Revoke from PUBLIC where Postgres' default grant still leaks access.
--    PUBLIC = "every role", which silently re-includes anon/authenticated.
------------------------------------------------------------------------------
revoke execute on function public.get_my_player()                                                                           from public;
revoke execute on function public.get_own_player_fields(uuid)                                                               from public;
revoke execute on function public.increment_player_stats(uuid, integer, integer)                                            from public;
revoke execute on function public.is_admin_or_mod(uuid)                                                                     from public;
revoke execute on function public.is_scrim_host(uuid)                                                                       from public;
revoke execute on function public.notify_tournament_players(uuid, text, text, text, text[])                                 from public;

------------------------------------------------------------------------------
-- 3. Cron-only / admin-only RPCs should not be callable by `authenticated`.
------------------------------------------------------------------------------
-- cleanup_old_webhook_events: invoked by pg_cron / service_role only.
revoke execute on function public.cleanup_old_webhook_events() from authenticated;

-- increment_player_stats: already revoked from authenticated in mig 079, but
-- the PUBLIC default grant was still leaking it. Revoke again for safety.
revoke execute on function public.increment_player_stats(uuid, integer, integer) from authenticated;

------------------------------------------------------------------------------
-- 4. Add server-side admin gate to increment_dnp_for_players.
--    Previously relied on a client-side `if(!isAdmin)return;` check, which
--    is trivially bypassable. Now any non-admin caller raises an exception.
------------------------------------------------------------------------------
create or replace function public.increment_dnp_for_players(player_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if not public.is_admin_or_mod(auth.uid()) then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  update players
  set dnp_count = coalesce(dnp_count, 0) + 1
  where id = any(player_ids);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- Re-state the grants we want after CREATE OR REPLACE (REPLACE preserves the
-- existing ACL, but be explicit so future migrations are easy to audit).
revoke execute on function public.increment_dnp_for_players(uuid[]) from public;
revoke execute on function public.increment_dnp_for_players(uuid[]) from anon;
grant  execute on function public.increment_dnp_for_players(uuid[]) to authenticated;
grant  execute on function public.increment_dnp_for_players(uuid[]) to service_role;
