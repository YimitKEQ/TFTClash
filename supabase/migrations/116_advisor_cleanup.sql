-- 116_advisor_cleanup.sql
-- Follow-up to 115: clear the remaining actionable advisor warnings.
-- (A) The three SECURITY DEFINER functions still flagged as anon-callable
--     carry the default PUBLIC execute grant (=X/postgres in proacl), which
--     anon inherits. Revoking from anon alone (mig 115) was not enough.
--     authenticated + service_role keep their explicit grants.
-- (B) auth_rls_initplan: wrap auth.uid() in (select auth.uid()) in the 7
--     flagged policies so it is evaluated once per query, not once per row.

-- ───────────────────────────────────────────────────────────────────────────
-- (A) Revoke the PUBLIC execute grants.
-- ───────────────────────────────────────────────────────────────────────────
revoke execute on function public.archive_lft_on_team_join() from public;
revoke execute on function public.leave_team(uuid, text) from public;
revoke execute on function public.transfer_captaincy(uuid, uuid) from public;

-- ───────────────────────────────────────────────────────────────────────────
-- (B) Recreate the 7 initplan-flagged policies with (select auth.uid()).
-- Definitions match live pg_policies output exactly, with only the
-- auth.uid() wrapping changed.
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists standby_pool_self_insert on public.standby_pool;
create policy standby_pool_self_insert on public.standby_pool
  for insert
  with check (
    player_id in (
      select p.id from public.players p
      where p.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists standby_pool_self_delete on public.standby_pool;
create policy standby_pool_self_delete on public.standby_pool
  for delete
  using (
    player_id in (
      select p.id from public.players p
      where p.auth_user_id = (select auth.uid())
    )
    or coalesce(public.is_admin_or_mod((select auth.uid())), false)
  );

drop policy if exists "Roster reads team RSVPs" on public.team_event_rsvps;
create policy "Roster reads team RSVPs" on public.team_event_rsvps
  for select to authenticated
  using (
    exists (
      select 1
      from public.team_members tm
      join public.players p on p.id = tm.player_id
      where tm.team_id = team_event_rsvps.team_id
        and tm.removed_at is null
        and p.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Ringer reads own and team rows" on public.team_event_ringers;
create policy "Ringer reads own and team rows" on public.team_event_ringers
  for select to authenticated
  using (
    exists (
      select 1 from public.players p
      where p.id = team_event_ringers.player_id
        and p.auth_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.team_members tm
      join public.players p on p.id = tm.player_id
      where tm.team_id = team_event_ringers.team_id
        and tm.removed_at is null
        and p.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists soft_bans_read on public.soft_bans;
create policy soft_bans_read on public.soft_bans
  for select
  using (
    player_id in (
      select p.id from public.players p
      where p.auth_user_id = (select auth.uid())
    )
    or coalesce(public.is_admin_or_mod((select auth.uid())), false)
  );

drop policy if exists soft_bans_admin_write on public.soft_bans;
create policy soft_bans_admin_write on public.soft_bans
  for all
  using (coalesce(public.is_admin_or_mod((select auth.uid())), false))
  with check (coalesce(public.is_admin_or_mod((select auth.uid())), false));

drop policy if exists "Admins read all subscriptions" on public.subscriptions;
create policy "Admins read all subscriptions" on public.subscriptions
  for select to authenticated
  using (public.is_admin_or_mod((select auth.uid())));
