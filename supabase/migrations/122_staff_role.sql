-- 122_staff_role.sql
-- "Staff" (mod) role: lets trusted helpers run live clash scoring -- enter
-- placements, lock/unlock lobbies -- WITHOUT full admin powers (no payouts,
-- bans, settings, season-point edits, or role granting).
--
-- The scoring tables (game_results, lobbies, tournament_results) already allow
-- role = ANY('admin','mod') from earlier migrations. The two missing pieces:
--   1. Staff must be able to PERSIST live clash state, which lives in the
--      site_settings blob keys 'tournament_state' / 'tournament_state_na'
--      (and 'broadcast_control' for the overlay). site_settings is otherwise
--      admin-only and STAYS that way for every other key.
--   2. An admin-only, mod-only-scoped way to grant/revoke the role from the UI
--      (user_roles is service-role-write only, so this goes through RPCs).

-- ── (1) Staff may write ONLY the live-clash keys of site_settings ───────────
drop policy if exists "Staff write live clash settings" on site_settings;
create policy "Staff write live clash settings" on site_settings
  for all to authenticated
  using (
    key in ('tournament_state', 'tournament_state_na', 'broadcast_control')
    and exists (
      select 1 from user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = any (array['admin', 'mod'])
    )
  )
  with check (
    key in ('tournament_state', 'tournament_state_na', 'broadcast_control')
    and exists (
      select 1 from user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = any (array['admin', 'mod'])
    )
  );

-- ── (2a) Grant / revoke the staff (mod) role -- admins only, mod role only ───
-- SECURITY DEFINER so it can write user_roles (service-role-only table).
-- Hard-coded to the 'mod' role so this can NEVER be used to grant 'admin'.
create or replace function set_staff_role(p_user_id uuid, p_enable boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Only admins can manage staff roles';
  end if;

  if p_user_id is null then
    raise exception 'Target user is required';
  end if;

  if p_enable then
    insert into user_roles (user_id, role, granted_by)
    values (p_user_id, 'mod', (select auth.uid()))
    on conflict (user_id, role) do nothing;
  else
    delete from user_roles where user_id = p_user_id and role = 'mod';
  end if;
end;
$$;

revoke all on function set_staff_role(uuid, boolean) from public, anon;
grant execute on function set_staff_role(uuid, boolean) to authenticated;

-- ── (2b) List current staff -- admins only ──────────────────────────────────
create or replace function list_staff()
returns table(user_id uuid, granted_at timestamptz, granted_by uuid)
language sql
security definer
set search_path = public
as $$
  select ur.user_id, ur.granted_at, ur.granted_by
  from user_roles ur
  where ur.role = 'mod'
    and exists (
      select 1 from user_roles a
      where a.user_id = (select auth.uid()) and a.role = 'admin'
    );
$$;

revoke all on function list_staff() from public, anon;
grant execute on function list_staff() to authenticated;
