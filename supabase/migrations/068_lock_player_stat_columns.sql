-- 068_lock_player_stat_columns.sql
-- Closes RLS gap: prior policy 'Users can update own player safely' (064_rls_initplan_optimize)
-- only blocked is_admin/role mutations. Authenticated users could freely write
-- season_pts, wins, top4, games, avg_placement, banned, dnp_count, checked_in
-- on their own row, breaking leaderboard integrity and enabling ban evasion.
--
-- Strategy: trigger-based column guard. Service role bypasses (admin RPCs and
-- webhook-driven stat writes); admins/mods bypass (legitimate ban toggles); only
-- regular authenticated user writes are constrained.

begin;

create or replace function public.players_guard_managed_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role bypass: admin RPCs (increment_player_stats), seed scripts, webhook writes.
  if current_setting('request.jwt.claim.role', true) <> 'authenticated' then
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

  -- Competitive stats — written via admin RPC only.
  if new.season_pts    is distinct from old.season_pts    then raise exception 'players.season_pts is server-managed'; end if;
  if new.wins          is distinct from old.wins          then raise exception 'players.wins is server-managed'; end if;
  if new.top4          is distinct from old.top4          then raise exception 'players.top4 is server-managed'; end if;
  if new.games         is distinct from old.games         then raise exception 'players.games is server-managed'; end if;
  if new.avg_placement is distinct from old.avg_placement then raise exception 'players.avg_placement is server-managed'; end if;

  -- Moderation state — admin only.
  if new.banned        is distinct from old.banned        then raise exception 'players.banned is admin-only'; end if;
  if new.dnp_count     is distinct from old.dnp_count     then raise exception 'players.dnp_count is server-managed'; end if;
  if new.checked_in    is distinct from old.checked_in    then raise exception 'players.checked_in is server-managed'; end if;

  return new;
end;
$$;

drop trigger if exists trg_players_guard_managed on public.players;
create trigger trg_players_guard_managed
  before update on public.players
  for each row
  execute function public.players_guard_managed_cols();

commit;
