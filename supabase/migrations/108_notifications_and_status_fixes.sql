-- 108_notifications_and_status_fixes.sql
-- Three critical fixes from the 2026-05-03 DB audit:
--
-- B-1 (CRITICAL): notifications INSERT RLS only allowed admins/mods, so every
--   player-facing bell event silently failed in prod since migration 101. Owners
--   must be able to insert their own notification rows (writeActivityEvent +
--   createNotification) and admins/mods retain full insert.
--
-- H-1: players_guard_managed_cols used current_setting('request.jwt.claim.role')
--   to detect service role. That setting is unreliable across Supabase versions
--   (sometimes empty for service role tokens routed via PostgREST). Switch to
--   the canonical auth.role() = 'service_role' check.
--
-- H-2: registrations UPDATE WITH CHECK whitelist (079) only allowed
--   ('registered', 'checked_in', 'dropped', 'waitlist') but the app writes
--   'waitlisted' (with the 'd'), 'no_show', and 'cancelled' from multiple
--   screens. Update whitelist to match actual writes.

begin;

------------------------------------------------------------------------------
-- B-1: Notifications INSERT — owners may create their own rows
------------------------------------------------------------------------------
drop policy if exists "Notifications insert admin or service only" on public.notifications;

create policy "Notifications insert own or admin" on public.notifications
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or coalesce(public.is_admin_or_mod((select auth.uid())), false)
  );

------------------------------------------------------------------------------
-- H-1: players_guard_managed_cols — use auth.role() instead of jwt.claim.role
------------------------------------------------------------------------------
create or replace function public.players_guard_managed_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role bypass: admin RPCs (increment_player_stats), seed scripts, webhook writes.
  if auth.role() = 'service_role' then
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

------------------------------------------------------------------------------
-- H-2: registrations UPDATE — expand status whitelist to match app writes
------------------------------------------------------------------------------
drop policy if exists "Users update own registration" on public.registrations;

create policy "Users update own registration" on public.registrations
  for update to authenticated
  using (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
  )
  with check (
    player_id = (select id from public.players where auth_user_id = (select auth.uid()) limit 1)
    and status in ('registered', 'checked_in', 'dropped', 'waitlist', 'waitlisted', 'no_show', 'cancelled', 'withdrawn')
  );

commit;
