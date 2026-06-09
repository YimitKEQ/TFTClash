-- 115_launch_hardening.sql
-- Launch-readiness hardening (2026-06-09 audit, docs/LAUNCH-READINESS-AUDIT.md).
-- Contents: (A) claim_standby_seat ownership check, (B) revoke anon EXECUTE on
-- SECURITY DEFINER RPCs, (C) pin search_path on flagged functions,
-- (D) drop duplicate index, (E) covering indexes for hot foreign keys,
-- (F) promote_next_waitlisted RPC (DB-backed waitlist auto-promotion),
-- (G) drop notifications from the realtime publication (no client subscribes).

-- ───────────────────────────────────────────────────────────────────────────
-- (A) claim_standby_seat: any authenticated user could promote ANY player off
-- standby and could pass an arbitrary p_seat_cap (or NULL) to over-fill a
-- tournament. Callers must now be: service_role (Discord bot), admin/mod, or
-- the owner of p_player_id. Seat cap is clamped to tournaments.max_players.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.claim_standby_seat(
  p_tournament_id uuid,
  p_player_id uuid,
  p_seat_cap integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count int;
  v_lock_row       record;
  v_max_players    int;
  v_cap            int;
  v_caller_role    text := coalesce(auth.role(), '');
begin
  -- Authorisation: service role (bot), admin/mod, or self.
  if v_caller_role <> 'service_role'
     and not coalesce(public.is_admin_or_mod(auth.uid()), false)
     and not exists (
       select 1 from public.players p
       where p.id = p_player_id and p.auth_user_id = auth.uid()
     )
  then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select id, max_players into v_lock_row
    from public.tournaments
    where id = p_tournament_id
    for update;
  if v_lock_row is null then
    return 'tournament_missing';
  end if;
  v_max_players := v_lock_row.max_players;

  if exists (
    select 1 from public.registrations r
    where r.tournament_id = p_tournament_id
      and r.player_id = p_player_id
  ) then
    delete from public.standby_pool
      where tournament_id = p_tournament_id and player_id = p_player_id;
    return 'already_registered';
  end if;

  if not exists (
    select 1 from public.standby_pool s
    where s.tournament_id = p_tournament_id and s.player_id = p_player_id
  ) then
    return 'not_on_standby';
  end if;

  -- Never trust the caller-supplied cap beyond the tournament's own cap.
  v_cap := least(
    coalesce(nullif(p_seat_cap, 0), coalesce(v_max_players, 1024)),
    coalesce(v_max_players, 1024)
  );
  select count(*) into v_existing_count
    from public.registrations r
    where r.tournament_id = p_tournament_id
      and r.status in ('registered', 'checked_in');
  if v_existing_count >= v_cap then
    return 'full';
  end if;

  insert into public.registrations (tournament_id, player_id, status, created_at)
    values (p_tournament_id, p_player_id, 'registered', now())
    on conflict do nothing;

  delete from public.standby_pool
    where tournament_id = p_tournament_id and player_id = p_player_id;

  return 'promoted';
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- (B) SECURITY DEFINER functions callable by anon (advisor 0028). None of
-- these have a legitimate signed-out caller.
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on function public.archive_lft_on_team_join() from anon;
revoke execute on function public.leave_team(uuid, text) from anon;
revoke execute on function public.transfer_captaincy(uuid, uuid) from anon;
revoke execute on function public.claim_standby_seat(uuid, uuid, integer) from anon;

-- ───────────────────────────────────────────────────────────────────────────
-- (C) Pin search_path on flagged functions (advisor 0011).
-- ───────────────────────────────────────────────────────────────────────────
alter function public.discord_role_pickers_touch() set search_path = public;
alter function public.gen_team_invite_code() set search_path = public;

-- ───────────────────────────────────────────────────────────────────────────
-- (D) Duplicate index (advisor): identical pair on activity_feed.
-- ───────────────────────────────────────────────────────────────────────────
drop index if exists public.activity_feed_created_idx;

-- ───────────────────────────────────────────────────────────────────────────
-- (E) Covering indexes for foreign keys on tables that are hit during a live
-- clash (registrations/lobbies/pending_results join paths). The long tail of
-- 30 other unindexed FKs is cold and intentionally skipped.
-- ───────────────────────────────────────────────────────────────────────────
create index if not exists lobby_players_lobby_idx on public.lobby_players (lobby_id);
create index if not exists lobby_players_player_idx on public.lobby_players (player_id);
create index if not exists pending_results_player_idx on public.pending_results (player_id);
create index if not exists standby_pool_player_idx on public.standby_pool (player_id);
create index if not exists soft_bans_consumed_tournament_idx on public.soft_bans (consumed_tournament_id);

-- ───────────────────────────────────────────────────────────────────────────
-- (F) promote_next_waitlisted: waitlist rows now live in registrations with
-- status='waitlisted' (DB-backed, ordered by created_at). When a seat frees
-- up, any client may call this; it atomically promotes the OLDEST waitlisted
-- player iff capacity allows. No caller-controlled target, so it is safe for
-- the authenticated role. Notifies the promoted player.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.promote_next_waitlisted(p_tournament_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t           record;
  v_reg_count   int;
  v_next        record;
  v_auth_uid    uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    return 'not_authorised';
  end if;

  select id, max_players into v_t
    from public.tournaments
    where id = p_tournament_id
    for update;
  if v_t is null then
    return 'tournament_missing';
  end if;

  select count(*) into v_reg_count
    from public.registrations r
    where r.tournament_id = p_tournament_id
      and r.status in ('registered', 'checked_in');
  if v_t.max_players is not null and v_reg_count >= v_t.max_players then
    return 'full';
  end if;

  select r.id, r.player_id into v_next
    from public.registrations r
    where r.tournament_id = p_tournament_id
      and r.status = 'waitlisted'
    order by r.created_at asc
    limit 1
    for update skip locked;
  if v_next is null then
    return 'no_waitlist';
  end if;

  update public.registrations
    set status = 'registered'
    where id = v_next.id;

  select p.auth_user_id into v_auth_uid
    from public.players p where p.id = v_next.player_id;
  if v_auth_uid is not null then
    insert into public.notifications (user_id, type, title, message, icon)
    values (v_auth_uid, 'tournament', 'You are in!',
            'A seat opened up and you were promoted from the waitlist. Remember to check in before the clash starts.',
            'how_to_reg');
  end if;

  return 'promoted';
end;
$$;

revoke all on function public.promote_next_waitlisted(uuid) from public, anon;
grant execute on function public.promote_next_waitlisted(uuid) to authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- (G) notifications has no realtime subscriber in the client; remove it from
-- the publication so its writes stop costing WAL-poller fan-out work.
-- ───────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime drop table public.notifications;
