-- 074: Fix players_guard_managed_cols NULL JWT bypass
--
-- Background:
-- The guard's bypass check used `current_setting(...) <> 'authenticated'`. When
-- the JWT claim is missing (service role, anon, or internal trigger context
-- such as refresh_player_stats firing on game_results INSERT), the comparison
-- evaluates to NULL rather than TRUE, so the bypass never fires and the guard
-- raises 'players.season_pts is server-managed'. Net effect in production:
-- inserting any game_result fails because the cascading trigger update of
-- players.season_pts/wins/games/top4/avg_placement is blocked. No host could
-- submit scores.
--
-- Fix: use `is distinct from` so NULL is treated as "not authenticated" and
-- the bypass fires for service-role / internal-trigger contexts.

create or replace function public.players_guard_managed_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Service role / anon / internal-trigger bypass.
  -- Use IS DISTINCT FROM so a NULL claim (no JWT) treats as bypass.
  if current_setting('request.jwt.claim.role', true) is distinct from 'authenticated' then
    return new;
  end if;

  -- Admin / mod bypass: panel actions like ban/unban, manual stat correction.
  if exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = any (array['admin','mod'])
  ) then
    return new;
  end if;

  -- Competitive stats - written via admin RPC only.
  if new.season_pts    is distinct from old.season_pts    then raise exception 'players.season_pts is server-managed'; end if;
  if new.wins          is distinct from old.wins          then raise exception 'players.wins is server-managed'; end if;
  if new.top4          is distinct from old.top4          then raise exception 'players.top4 is server-managed'; end if;
  if new.games         is distinct from old.games         then raise exception 'players.games is server-managed'; end if;
  if new.avg_placement is distinct from old.avg_placement then raise exception 'players.avg_placement is server-managed'; end if;

  -- Moderation state - admin only.
  if new.banned        is distinct from old.banned        then raise exception 'players.banned is admin-only'; end if;
  if new.dnp_count     is distinct from old.dnp_count     then raise exception 'players.dnp_count is server-managed'; end if;
  if new.checked_in    is distinct from old.checked_in    then raise exception 'players.checked_in is server-managed'; end if;

  return new;
end;
$function$;
