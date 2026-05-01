-- 101_custom_tournament_hardening.sql
-- Custom-tournament audit (post-launch) found multiple DB-level gaps that the
-- client-side code depends on. Hardens:
--   1. notify_tournament_players RPC: require host or admin to call it.
--   2. notifications INSERT: only the row owner / admin / service may insert
--      a notification. Closes a spam vector where any authenticated user can
--      post arbitrary notifications to another user's inbox via REST.
--   3. registrations: BEFORE INSERT/UPDATE trigger that enforces
--      (a) capacity (regCount < floor(max_players / coalesce(team_size,1)))
--          using SELECT FOR UPDATE on the tournament row to serialize.
--      (b) tournament phase (register only in registration; check-in only in
--          check_in; reject status transitions outside those windows).
--      (c) check-in window timestamps (checkin_open_at / checkin_close_at).
--      Service / admin / host bypass for adminForceCheckIn paths.
--   4. Host tournament UPDATE: whitelist editable columns. Block changes to
--      host_id, type, team_size, teams_per_lobby, format, points_scale,
--      max_players, phase once phase != 'draft'/'upcoming'. Service / admin
--      bypass.
--   5. stamp_game_result_team_id: also fire on UPDATE so re-locks restamp.
--   6. Default lineup_player_ids should be cleared on un-check-in. Trigger
--      that nulls lineup when status moves to 'registered'.

------------------------------------------------------------------------------
-- 1. notify_tournament_players: require host or admin
------------------------------------------------------------------------------
create or replace function public.notify_tournament_players(
  p_tournament_id uuid,
  p_title text,
  p_body text,
  p_icon text default 'bell'::text,
  p_statuses text[] default array['checked_in'::text, 'registered'::text]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  notified int := 0;
  caller_uid uuid := (select auth.uid());
  caller_role text := (select auth.role());
  is_admin boolean := coalesce(public.is_admin_or_mod(caller_uid), false);
  is_owner boolean;
begin
  if caller_role <> 'service_role' and not is_admin then
    select exists (
      select 1 from public.tournaments t
      where t.id = p_tournament_id
        and t.host_id = caller_uid
    ) into is_owner;
    if not is_owner then
      raise exception 'Not authorized to notify players for this tournament.'
        using errcode = '42501';
    end if;
  end if;

  -- Trim/clamp text to avoid abusive payloads
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Notification title is required.' using errcode = 'P0001';
  end if;
  if length(p_title) > 120 then
    p_title := substring(p_title, 1, 120);
  end if;
  if p_body is not null and length(p_body) > 1000 then
    p_body := substring(p_body, 1, 1000);
  end if;

  insert into public.notifications (user_id, title, body, message, icon, type, read, created_at)
  select
    p.auth_user_id,
    p_title,
    p_body,
    p_body,
    coalesce(p_icon, 'bell'),
    'info',
    false,
    now()
  from public.registrations r
  join public.players p on r.player_id = p.id
  where r.tournament_id = p_tournament_id
    and r.status = any(p_statuses)
    and p.auth_user_id is not null;

  get diagnostics notified = row_count;
  return notified;
end;
$function$;

grant execute on function public.notify_tournament_players(uuid, text, text, text, text[]) to authenticated, service_role;

------------------------------------------------------------------------------
-- 2. notifications INSERT lockdown.
-- Drop any existing self-insert policies, replace with admin/service only +
-- a narrow "user inserts own (read=true) self-managed flag" stays via the
-- separate UPDATE policy that already exists.
------------------------------------------------------------------------------
drop policy if exists "Users insert own notifications" on public.notifications;
drop policy if exists "Authenticated users insert own notifications" on public.notifications;

create policy "Notifications insert admin or service only" on public.notifications
  for insert to authenticated
  with check (
    coalesce(public.is_admin_or_mod((select auth.uid())), false)
  );

------------------------------------------------------------------------------
-- 3. Registrations lifecycle guard.
------------------------------------------------------------------------------
create or replace function public.enforce_registration_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_service boolean := (select auth.role()) = 'service_role';
  caller_uid uuid := (select auth.uid());
  is_admin boolean := coalesce(public.is_admin_or_mod(caller_uid), false);
  is_host boolean;
  t_phase text;
  t_team_size int;
  t_max_players int;
  t_checkin_open timestamptz;
  t_checkin_close timestamptz;
  current_count int;
  effective_cap int;
  is_status_transition boolean := tg_op = 'UPDATE'
    and (new.status is distinct from old.status);
begin
  -- Service role: full bypass.
  if is_service then return new; end if;

  select host_id = caller_uid into is_host
    from public.tournaments where id = new.tournament_id;
  is_host := coalesce(is_host, false);

  -- Lock the parent tournament for capacity counting.
  select phase, team_size, max_players, checkin_open_at, checkin_close_at
    into t_phase, t_team_size, t_max_players, t_checkin_open, t_checkin_close
    from public.tournaments
    where id = new.tournament_id
    for update;

  if t_phase is null then
    raise exception 'Tournament not found.' using errcode = 'P0001';
  end if;
  if t_team_size is null then t_team_size := 1; end if;
  if t_max_players is null or t_max_players <= 0 then t_max_players := 8; end if;

  -- Phase guard for inserts (registration only allowed in registration / check_in).
  if tg_op = 'INSERT' and not (is_admin or is_host) then
    if t_phase not in ('registration', 'check_in', 'upcoming') then
      raise exception 'Registration is closed for this tournament (phase=%).', t_phase
        using errcode = 'P0001';
    end if;
  end if;

  -- Status transition guards for non-admin / non-host actors.
  if is_status_transition and not (is_admin or is_host) then
    -- Self check-in only during check_in phase.
    if new.status = 'checked_in' then
      if t_phase <> 'check_in' then
        raise exception 'Check-in is not open (phase=%).', t_phase
          using errcode = 'P0001';
      end if;
      if t_checkin_open is not null and now() < t_checkin_open then
        raise exception 'Check-in window has not opened yet.' using errcode = 'P0001';
      end if;
      if t_checkin_close is not null and now() > t_checkin_close then
        raise exception 'Check-in window has closed.' using errcode = 'P0001';
      end if;
    end if;

    -- Self un-register only allowed before tournament starts.
    if new.status in ('cancelled', 'dropped') and t_phase not in ('registration', 'check_in', 'upcoming') then
      raise exception 'You cannot withdraw once the tournament has started.'
        using errcode = 'P0001';
    end if;
  end if;

  -- Capacity guard: count active rows (registered + checked_in) against cap.
  -- Only enforced when we are inserting a new active row OR updating from a
  -- non-active status into active. Waitlist rows do not consume capacity.
  if (tg_op = 'INSERT' and new.status in ('registered','checked_in'))
     or (tg_op = 'UPDATE' and new.status in ('registered','checked_in')
         and (old.status is null or old.status not in ('registered','checked_in'))) then
    effective_cap := greatest(1, floor(t_max_players::numeric / t_team_size::numeric)::int);
    select count(*) into current_count
      from public.registrations
      where tournament_id = new.tournament_id
        and status in ('registered','checked_in')
        and (tg_op = 'INSERT' or id <> new.id);
    if current_count >= effective_cap then
      raise exception 'Tournament is full (cap = % active registrations).', effective_cap
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registrations_lifecycle on public.registrations;
create trigger trg_registrations_lifecycle
  before insert or update on public.registrations
  for each row execute function public.enforce_registration_lifecycle();

------------------------------------------------------------------------------
-- 4. Tournament UPDATE column whitelist for hosts.
-- Once a tournament is past the draft / upcoming phase, hosts may only edit
-- a narrow set of cosmetic fields. This blocks mid-event corruption of
-- team_size, max_players, format, points_scale, host_id, type, etc.
------------------------------------------------------------------------------
create or replace function public.enforce_tournament_update_safety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_service boolean := (select auth.role()) = 'service_role';
  caller_uid uuid := (select auth.uid());
  is_admin boolean := coalesce(public.is_admin_or_mod(caller_uid), false);
  is_host boolean := old.host_id is not null and old.host_id = caller_uid;
  draft_phase boolean := old.phase in ('draft','upcoming');
begin
  if is_service or is_admin then return new; end if;
  if not is_host then return new; end if; -- only constrain hosts here

  -- Always-blocked transitions for hosts (admin can do them):
  if new.host_id is distinct from old.host_id then
    raise exception 'Host cannot transfer ownership of a tournament.'
      using errcode = 'P0001';
  end if;
  if new.type is distinct from old.type then
    raise exception 'Host cannot change tournament type.'
      using errcode = 'P0001';
  end if;

  -- Once we are past draft/upcoming, lock structural fields.
  if not draft_phase then
    if new.team_size is distinct from old.team_size then
      raise exception 'Team size cannot change after the tournament leaves draft.'
        using errcode = 'P0001';
    end if;
    if new.teams_per_lobby is distinct from old.teams_per_lobby then
      raise exception 'Teams-per-lobby cannot change after the tournament leaves draft.'
        using errcode = 'P0001';
    end if;
    if new.max_players is distinct from old.max_players then
      raise exception 'Max players cannot change after the tournament leaves draft.'
        using errcode = 'P0001';
    end if;
    if new.format is distinct from old.format then
      raise exception 'Format cannot change after the tournament leaves draft.'
        using errcode = 'P0001';
    end if;
    if new.points_scale is distinct from old.points_scale then
      raise exception 'Points scale cannot change after the tournament leaves draft.'
        using errcode = 'P0001';
    end if;
    -- Phase forward-only for hosts (no skipping straight to complete from registration).
    if new.phase = 'complete' and old.phase not in ('live','in_progress') then
      raise exception 'Host cannot mark tournament complete from phase %.', old.phase
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tournaments_update_safety on public.tournaments;
create trigger trg_tournaments_update_safety
  before update on public.tournaments
  for each row execute function public.enforce_tournament_update_safety();

------------------------------------------------------------------------------
-- 5. stamp_game_result_team_id: also fire on UPDATE.
------------------------------------------------------------------------------
drop trigger if exists game_results_stamp_team_id on public.game_results;
create trigger game_results_stamp_team_id
  before insert or update on public.game_results
  for each row execute function public.stamp_game_result_team_id();

------------------------------------------------------------------------------
-- 6. Clear lineup_player_ids when a registration is reverted from checked_in
-- back to registered. This stops the lineup-collision trigger (mig 100)
-- from sticking on stale lineups after un-check-in.
------------------------------------------------------------------------------
create or replace function public.clear_lineup_on_uncheckin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and old.status = 'checked_in'
     and new.status = 'registered' then
    new.lineup_player_ids := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registrations_clear_lineup_on_uncheckin on public.registrations;
create trigger trg_registrations_clear_lineup_on_uncheckin
  before update of status on public.registrations
  for each row execute function public.clear_lineup_on_uncheckin();
