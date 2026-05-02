-- 104_team_invite_accept_and_team_reg_uq.sql
--
-- Two coupled fixes that unblock the 4v4 Squads + 2v2 Double Up flow:
--
-- 1. accept_team_invite(p_invite_id) RPC. The "Captain inserts members"
--    RLS policy on team_members requires the calling user to be the
--    team captain. That is correct for the captain-driven roster path
--    but it blocks the *invitee* from accepting their own invite, which
--    is the standard flow. We expose a SECURITY DEFINER RPC that runs
--    as the table owner, validates the calling player is the invitee,
--    inserts the membership row, and flips the invite to accepted in
--    one transaction. Roster triggers (single active membership, max
--    roster size, role guard) still fire because the INSERT path is
--    unchanged.
--
-- 2. Partial unique index on registrations(tournament_id, team_id).
--    The team registration call in FlashTournamentScreen does
--    `upsert(..., { onConflict: 'tournament_id,team_id' })` but no
--    such constraint existed, so Postgres returned
--    "no unique or exclusion constraint matching the ON CONFLICT
--    specification". A partial unique index keeps solo registrations
--    (team_id IS NULL) untouched while enforcing one row per (tournament, team).

-- 1. RPC: accept_team_invite ------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_invite    record;
  v_member    record;
  v_team_archived timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_player_id
  FROM players
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile for this account' USING ERRCODE = 'P0002';
  END IF;

  -- Lock the invite row so concurrent accepts cannot double-insert.
  SELECT * INTO v_invite
  FROM team_invites
  WHERE id = p_invite_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer pending (status=%)', v_invite.status
      USING ERRCODE = '22023';
  END IF;
  IF v_invite.invitee_player_id <> v_player_id THEN
    RAISE EXCEPTION 'Only the invitee can accept this invite' USING ERRCODE = '42501';
  END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    UPDATE team_invites SET status = 'expired', responded_at = now()
    WHERE id = p_invite_id;
    RAISE EXCEPTION 'Invite has expired' USING ERRCODE = '22023';
  END IF;

  SELECT archived_at INTO v_team_archived
  FROM teams WHERE id = v_invite.team_id;
  IF NOT FOUND OR v_team_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Team no longer exists' USING ERRCODE = 'P0002';
  END IF;

  -- enforce_team_member_rules trigger handles single-active-membership and
  -- roster cap. We let it raise if the invitee is already on another team.
  INSERT INTO team_members (team_id, player_id, role)
  VALUES (v_invite.team_id, v_invite.invitee_player_id, 'main')
  RETURNING * INTO v_member;

  UPDATE team_invites
  SET status = 'accepted', responded_at = now()
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object('id', p_invite_id, 'status', 'accepted'),
    'member', to_jsonb(v_member)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_team_invite(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(uuid) TO authenticated;

COMMENT ON FUNCTION public.accept_team_invite(uuid) IS
  'Atomically accepts a team invite for the calling player. SECURITY DEFINER bypasses the captain-only INSERT policy on team_members. Roster triggers still fire.';

-- 2. Partial unique index for team registrations ----------------------------

CREATE UNIQUE INDEX IF NOT EXISTS registrations_tournament_team_uq
  ON public.registrations (tournament_id, team_id)
  WHERE team_id IS NOT NULL;

COMMENT ON INDEX public.registrations_tournament_team_uq IS
  'One registration row per (tournament, team) for team events. Solo registrations (team_id IS NULL) keep using the existing (tournament_id, player_id) unique constraint.';
