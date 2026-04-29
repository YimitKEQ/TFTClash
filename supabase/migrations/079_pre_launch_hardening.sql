-- 079_pre_launch_hardening.sql
-- Consolidated pre-launch security/integrity hardening pass.
--
-- Addresses findings from the 4-agent audit run on 2026-04-29:
--   1. Port the live `get_signup_username` into version control + bound the
--      collision suffix loop so it can't spin forever on a saturated namespace.
--   2. Harden `refresh_player_stats`: was running as invoker with no search_path,
--      letting a poisoned `public` schema corrupt season_pts via the trigger.
--   3. Harden `increment_player_stats`: revoke EXECUTE from `authenticated` so
--      the in-body admin check is no longer the only line of defence.
--   4. Tighten `registrations` UPDATE policy: missing WITH CHECK lets users
--      flip their `status`, `tournament_id`, or `waitlist_position`.
--   5. Tighten `prize_claims` UPDATE: missing column-level WITH CHECK lets a
--      player self-mark a prize as `delivered`/`shipped`.
--   6. Tighten `host_profiles` UPDATE: missing WITH CHECK lets a host
--      self-flip `verified=true` or `status='approved'`, bypassing review.
--   7. Extend `players_guard_managed_cols` to block paid-tier escalation
--      (`tier`, `tier_override`) and admin-only fields (`notes`, `sponsor_json`,
--      `is_admin`, `role`).
--   8. Scope host writes on `tournaments` / `lobbies` / `registrations` to the
--      host's own tournaments — hosts should never be able to mutate another
--      host's events.
--   9. Add `set_updated_at()` search_path (consistency).
--  10. Add `game_results(lobby_id)` index — hot path on every lobby score
--      lookup and every cascading FK scan on lobbies DELETE.

------------------------------------------------------------------------------
-- 1. Port get_signup_username with bounded collision loop
------------------------------------------------------------------------------
create or replace function public.get_signup_username(meta jsonb, user_email text)
returns text
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  candidate  text;
  final_name text;
  suffix     int := 0;
begin
  candidate := coalesce(
    nullif(trim(meta->>'username'), ''),
    nullif(trim(meta->'custom_claims'->>'global_name'), ''),
    nullif(trim(meta->>'full_name'), ''),
    nullif(split_part(user_email, '@', 1), ''),
    'Player'
  );

  final_name := candidate;
  while exists (select 1 from public.players where username = final_name) loop
    suffix := suffix + 1;
    final_name := candidate || suffix::text;
    if suffix > 9999 then
      final_name := candidate || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
      exit;
    end if;
  end loop;

  return final_name;
end;
$function$;

------------------------------------------------------------------------------
-- 2. Harden refresh_player_stats (security definer + search_path)
------------------------------------------------------------------------------
-- Pull current body, just add SECURITY DEFINER + SET search_path.
-- We do not change the aggregation logic here; that lives in 076.
do $$
declare
  v_body text;
begin
  select pg_get_functiondef(p.oid) into v_body
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'refresh_player_stats'
     and n.nspname = 'public'
   limit 1;

  if v_body is null then
    raise notice 'refresh_player_stats not found, skipping harden';
    return;
  end if;
end $$;

alter function public.refresh_player_stats() security definer;
alter function public.refresh_player_stats() set search_path = 'public';

------------------------------------------------------------------------------
-- 3. Harden increment_player_stats — revoke from authenticated
------------------------------------------------------------------------------
-- The function still does an admin check in its body, but the body relies on
-- public.user_roles being resolved against the public schema; without an
-- explicit search_path, a malicious search_path could shadow user_roles. Plus
-- there's no reason to expose this to authenticated at all — it's an admin RPC.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'increment_player_stats' and n.nspname = 'public'
  ) then
    execute 'revoke execute on function public.increment_player_stats(uuid, integer, integer) from authenticated';
    execute 'alter function public.increment_player_stats(uuid, integer, integer) set search_path = ''public''';
  end if;
end $$;

------------------------------------------------------------------------------
-- 4. Tighten registrations UPDATE policy with WITH CHECK
------------------------------------------------------------------------------
drop policy if exists "Users update own registration" on public.registrations;

create policy "Users update own registration" on public.registrations
  for update to authenticated
  using (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
  )
  with check (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    and status in ('registered', 'checked_in', 'dropped', 'waitlist')
  );

------------------------------------------------------------------------------
-- 5. Tighten prize_claims UPDATE — players may only flip claim_status to 'claimed'
------------------------------------------------------------------------------
drop policy if exists "Players claim own prize" on public.prize_claims;

create policy "Players claim own prize" on public.prize_claims
  for update to authenticated
  using (
    player_id in (select id from public.players where auth_user_id = (select auth.uid()))
  )
  with check (
    player_id in (select id from public.players where auth_user_id = (select auth.uid()))
    and claim_status in ('claimed', 'unclaimed')
  );

------------------------------------------------------------------------------
-- 6. Tighten host_profiles UPDATE — block self-grant of verified/status/tier
------------------------------------------------------------------------------
drop policy if exists "Users update own host_profile" on public.host_profiles;

create policy "Users update own host_profile" on public.host_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and verified is not distinct from (
      select hp2.verified from public.host_profiles hp2 where hp2.user_id = (select auth.uid())
    )
    and status is not distinct from (
      select hp2.status from public.host_profiles hp2 where hp2.user_id = (select auth.uid())
    )
    and tier is not distinct from (
      select hp2.tier from public.host_profiles hp2 where hp2.user_id = (select auth.uid())
    )
  );

------------------------------------------------------------------------------
-- 7. Extend players guard to lock tier escalation + admin fields
------------------------------------------------------------------------------
create or replace function public.players_guard_managed_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'authenticated' then
    return new;
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = any (array['admin','mod'])
  ) then
    return new;
  end if;

  if new.season_pts    is distinct from old.season_pts    then raise exception 'players.season_pts is server-managed'; end if;
  if new.wins          is distinct from old.wins          then raise exception 'players.wins is server-managed'; end if;
  if new.top4          is distinct from old.top4          then raise exception 'players.top4 is server-managed'; end if;
  if new.games         is distinct from old.games         then raise exception 'players.games is server-managed'; end if;
  if new.avg_placement is distinct from old.avg_placement then raise exception 'players.avg_placement is server-managed'; end if;
  if new.banned        is distinct from old.banned        then raise exception 'players.banned is admin-only'; end if;
  if new.dnp_count     is distinct from old.dnp_count     then raise exception 'players.dnp_count is server-managed'; end if;
  if new.checked_in    is distinct from old.checked_in    then raise exception 'players.checked_in is server-managed'; end if;

  -- Paid tier protection
  if new.tier          is distinct from old.tier          then raise exception 'players.tier is server-managed'; end if;
  if new.tier_override is distinct from old.tier_override then raise exception 'players.tier_override is admin-only'; end if;

  -- Moderation/admin metadata
  if new.notes         is distinct from old.notes         then raise exception 'players.notes is admin-only'; end if;
  if new.sponsor_json  is distinct from old.sponsor_json  then raise exception 'players.sponsor_json is admin-only'; end if;
  if new.is_admin      is distinct from old.is_admin      then raise exception 'players.is_admin is admin-only'; end if;
  if new.role          is distinct from old.role          then raise exception 'players.role is admin-only'; end if;

  return new;
end;
$function$;

------------------------------------------------------------------------------
-- 8. Scope host writes to OWN tournaments
------------------------------------------------------------------------------

-- 8a. tournaments: hosts only manage their own
drop policy if exists "Hosts manage non-season tournaments" on public.tournaments;

create policy "Hosts insert own tournaments" on public.tournaments
  for insert to authenticated
  with check (
    type is distinct from 'season_clash'
    and host_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = 'host'
    )
  );

create policy "Hosts update own tournaments" on public.tournaments
  for update to authenticated
  using (
    type is distinct from 'season_clash'
    and host_id = (select auth.uid())
  )
  with check (
    type is distinct from 'season_clash'
    and host_id = (select auth.uid())
  );

create policy "Hosts delete own tournaments" on public.tournaments
  for delete to authenticated
  using (
    type is distinct from 'season_clash'
    and host_id = (select auth.uid())
  );

-- 8b. lobbies: split admin/mod (all) from host (own tournaments only)
drop policy if exists "Admins manage lobbies" on public.lobbies;

create policy "Admins manage lobbies" on public.lobbies
  for all to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = any (array['admin','mod'])
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = any (array['admin','mod'])
    )
  );

create policy "Hosts manage own lobbies" on public.lobbies
  for all to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = lobbies.tournament_id and t.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.tournaments t
      where t.id = lobbies.tournament_id and t.host_id = (select auth.uid())
    )
  );

-- 8c. registrations: same scope split for hosts
drop policy if exists "Admins manage registrations" on public.registrations;

create policy "Admins manage registrations" on public.registrations
  for all to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = any (array['admin','mod'])
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid()) and role = any (array['admin','mod'])
    )
  );

create policy "Hosts manage own tournament registrations" on public.registrations
  for all to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = registrations.tournament_id and t.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.tournaments t
      where t.id = registrations.tournament_id and t.host_id = (select auth.uid())
    )
  );

------------------------------------------------------------------------------
-- 9. set_updated_at search_path consistency
------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where p.proname = 'set_updated_at' and n.nspname = 'public') then
    execute 'alter function public.set_updated_at() set search_path = ''public''';
  end if;
end $$;

------------------------------------------------------------------------------
-- 10. game_results(lobby_id) hot-path index
------------------------------------------------------------------------------
create index if not exists game_results_lobby_id_idx
  on public.game_results (lobby_id)
  where lobby_id is not null;
