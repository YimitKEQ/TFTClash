-- 109_team_atomic_ops.sql
-- Audit BLOCKER #2 + #3: transferCaptaincy and leaveTeam in src/lib/teams.js
-- run as multiple non-atomic client-side updates. Failure modes:
--   - Captaincy transfer demotes the old captain, then a row-level error on
--     promote leaves the team with no captain.
--   - leaveTeam has no role check, so a captain can leave and orphan the team.
--
-- Both flows now go through SECURITY DEFINER RPCs that wrap the work in a
-- single transaction and enforce invariants. RLS still runs for read-back via
-- subsequent SELECTs from the client, but the atomic mutations bypass per-row
-- policy plumbing.

begin;

------------------------------------------------------------------------------
-- transfer_captaincy(p_team_id, p_to_member_id)
------------------------------------------------------------------------------
create or replace function public.transfer_captaincy(
  p_team_id uuid,
  p_to_member_id uuid
)
returns table (team_id uuid, new_captain_player_id uuid, new_captain_member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_old_captain_member_id uuid;
  v_new_captain_player_id uuid;
  v_is_admin boolean;
begin
  -- Resolve the calling player. Admins/mods may transfer for any team.
  select p.id into v_caller_player_id
    from public.players p
    where p.auth_user_id = auth.uid()
    limit 1;

  v_is_admin := coalesce(public.is_admin_or_mod(auth.uid()), false);

  -- Locate the current active captain row for the team (single source of truth).
  select tm.id into v_old_captain_member_id
    from public.team_members tm
    where tm.team_id = p_team_id
      and tm.role = 'captain'
      and tm.removed_at is null
    limit 1;

  if v_old_captain_member_id is null then
    raise exception 'No active captain on team %', p_team_id using errcode = 'P0001';
  end if;

  -- Caller must be the captain or an admin/mod.
  if not v_is_admin then
    if v_caller_player_id is null then
      raise exception 'Only the team captain may transfer captaincy' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.team_members tm
      where tm.id = v_old_captain_member_id and tm.player_id = v_caller_player_id
    ) then
      raise exception 'Only the team captain may transfer captaincy' using errcode = '42501';
    end if;
  end if;

  -- Validate target: must be an active member of the same team.
  select tm.player_id into v_new_captain_player_id
    from public.team_members tm
    where tm.id = p_to_member_id
      and tm.team_id = p_team_id
      and tm.removed_at is null
    limit 1;

  if v_new_captain_player_id is null then
    raise exception 'Target member is not on this team' using errcode = 'P0001';
  end if;

  if v_old_captain_member_id = p_to_member_id then
    raise exception 'Target is already the captain' using errcode = 'P0001';
  end if;

  -- Atomic two-row swap + teams pointer.
  update public.team_members set role = 'main' where id = v_old_captain_member_id;
  update public.team_members set role = 'captain' where id = p_to_member_id;
  update public.teams set captain_player_id = v_new_captain_player_id where id = p_team_id;

  return query select p_team_id, v_new_captain_player_id, p_to_member_id;
end;
$$;

revoke execute on function public.transfer_captaincy(uuid, uuid) from anon;
grant execute on function public.transfer_captaincy(uuid, uuid) to authenticated;

------------------------------------------------------------------------------
-- leave_team(p_member_id, p_reason)
-- Refuses if the leaving member is the captain (must transfer first).
------------------------------------------------------------------------------
create or replace function public.leave_team(
  p_member_id uuid,
  p_reason text
)
returns table (member_id uuid, team_id uuid, player_id uuid, removed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_member_player_id uuid;
  v_member_team_id uuid;
  v_member_role text;
  v_is_admin boolean;
  v_now timestamptz := now();
begin
  select p.id into v_caller_player_id
    from public.players p
    where p.auth_user_id = auth.uid()
    limit 1;

  v_is_admin := coalesce(public.is_admin_or_mod(auth.uid()), false);

  select tm.player_id, tm.team_id, tm.role
    into v_member_player_id, v_member_team_id, v_member_role
    from public.team_members tm
    where tm.id = p_member_id and tm.removed_at is null
    limit 1;

  if v_member_player_id is null then
    raise exception 'Membership not found or already removed' using errcode = 'P0001';
  end if;

  if not v_is_admin then
    if v_caller_player_id is null or v_caller_player_id <> v_member_player_id then
      raise exception 'Members may only leave their own seat' using errcode = '42501';
    end if;
  end if;

  if v_member_role = 'captain' then
    raise exception 'Captain must transfer captaincy before leaving' using errcode = 'P0001';
  end if;

  update public.team_members
    set removed_at = v_now,
        removed_reason = coalesce(p_reason, 'left_voluntarily')
    where id = p_member_id;

  return query select p_member_id, v_member_team_id, v_member_player_id, v_now;
end;
$$;

revoke execute on function public.leave_team(uuid, text) from anon;
grant execute on function public.leave_team(uuid, text) to authenticated;

commit;
