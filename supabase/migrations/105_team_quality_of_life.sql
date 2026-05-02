-- 105_team_quality_of_life.sql
--
-- Three QoL upgrades for team tournaments:
--
-- 1. Lineup presets per team. Captains save their default 2v2 pair and
--    4v4 starting four. The check-in lineup picker prefills from the
--    appropriate preset so captains do not re-pick at every event.
--
-- 2. Shareable invite codes. Each team gets a short URL-safe code so
--    captains can share `/teams/join/<code>` instead of having to know
--    every prospect's exact username. accept_team_invite_by_code(code)
--    creates the membership row directly via SECURITY DEFINER, with
--    the same trigger guards as the existing invite-accept path.
--
-- 3. Member RSVP for tournament registration. When a captain registers
--    the team, every roster member gets an RSVP row plus a bell
--    notification with Accept / Decline. Captains see availability at
--    a glance before lineups need to be locked.
--
-- All RPCs are SECURITY DEFINER, REVOKE from anon, GRANT to authenticated.

-- 1. Team columns ----------------------------------------------------------

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS lineup_2v2 uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS lineup_4v4 uuid[] DEFAULT '{}'::uuid[];

CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_uq
  ON public.teams (invite_code)
  WHERE invite_code IS NOT NULL AND archived_at IS NULL;

-- Generate a URL-safe 8-character code. Caller-side retry on collision.
CREATE OR REPLACE FUNCTION public.gen_team_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.gen_team_invite_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gen_team_invite_code() TO authenticated;

-- Backfill invite codes for any existing teams.
DO $$
DECLARE
  v_team record;
  v_code text;
  v_attempts int;
BEGIN
  FOR v_team IN SELECT id FROM public.teams WHERE invite_code IS NULL LOOP
    v_attempts := 0;
    LOOP
      v_code := public.gen_team_invite_code();
      v_attempts := v_attempts + 1;
      BEGIN
        UPDATE public.teams SET invite_code = v_code WHERE id = v_team.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempts > 10 THEN
          RAISE EXCEPTION 'Could not allocate unique invite_code for team %', v_team.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 2. accept_team_invite_by_code RPC ---------------------------------------

CREATE OR REPLACE FUNCTION public.accept_team_invite_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_team      record;
  v_member    record;
  v_existing  uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'Invite code is required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_player_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_team
  FROM teams
  WHERE upper(invite_code) = upper(trim(p_code))
    AND archived_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite code not recognised' USING ERRCODE = 'P0002';
  END IF;

  -- Already on this team? idempotent return.
  SELECT id INTO v_existing
  FROM team_members
  WHERE team_id = v_team.id AND player_id = v_player_id AND removed_at IS NULL
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'team', jsonb_build_object('id', v_team.id, 'name', v_team.name),
      'member', jsonb_build_object('id', v_existing, 'role', 'main'),
      'already_member', true
    );
  END IF;

  -- Roster triggers fire (single-active-membership, max-roster, role guard).
  INSERT INTO team_members (team_id, player_id, role)
  VALUES (v_team.id, v_player_id, 'main')
  RETURNING * INTO v_member;

  RETURN jsonb_build_object(
    'team',   jsonb_build_object('id', v_team.id, 'name', v_team.name, 'tag', v_team.tag),
    'member', to_jsonb(v_member),
    'already_member', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invite_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_team_invite_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite_by_code(text) TO authenticated;

COMMENT ON FUNCTION public.accept_team_invite_by_code(text) IS
  'Redeem a shareable team invite code. Idempotent if already a member.';

-- 3. team_event_rsvps table -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_event_rsvps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id     uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending',
  responded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_event_rsvps_status_check
    CHECK (status IN ('pending','accepted','declined')),
  CONSTRAINT team_event_rsvps_uq
    UNIQUE (team_id, tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS team_event_rsvps_team_idx
  ON public.team_event_rsvps (team_id, tournament_id);
CREATE INDEX IF NOT EXISTS team_event_rsvps_player_idx
  ON public.team_event_rsvps (player_id, status);

ALTER TABLE public.team_event_rsvps ENABLE ROW LEVEL SECURITY;

-- SELECT: roster members of the team can see the team's RSVPs.
DROP POLICY IF EXISTS "Roster reads team RSVPs" ON public.team_event_rsvps;
CREATE POLICY "Roster reads team RSVPs" ON public.team_event_rsvps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM team_members tm
    JOIN players p ON p.id = tm.player_id
    WHERE tm.team_id = team_event_rsvps.team_id
      AND tm.removed_at IS NULL
      AND p.auth_user_id = auth.uid()
  ));

-- All writes go through SECURITY DEFINER RPCs; no direct INSERT/UPDATE policy.

-- 4. register_team_with_rsvps RPC -----------------------------------------

CREATE OR REPLACE FUNCTION public.register_team_with_rsvps(
  p_team_id       uuid,
  p_tournament_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id     uuid;
  v_team          record;
  v_tour          record;
  v_reg_id        uuid;
  v_inserted_rsvps int := 0;
  v_member        record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_player_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_team.captain_player_id <> v_player_id THEN
    RAISE EXCEPTION 'Only the team captain can register the team' USING ERRCODE = '42501';
  END IF;

  SELECT id, team_size, max_players, phase INTO v_tour
  FROM tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_tour.phase NOT IN ('registration','check_in') THEN
    RAISE EXCEPTION 'Tournament is not open for registration (phase=%)', v_tour.phase
      USING ERRCODE = '22023';
  END IF;

  -- Upsert the registration row by (tournament, team) without ON CONFLICT
  -- inference (partial index can't be inferred from columns alone).
  SELECT id INTO v_reg_id
  FROM registrations
  WHERE tournament_id = p_tournament_id AND team_id = p_team_id
  LIMIT 1;
  IF v_reg_id IS NULL THEN
    INSERT INTO registrations (tournament_id, team_id, player_id, status)
    VALUES (p_tournament_id, p_team_id, v_player_id, 'registered')
    RETURNING id INTO v_reg_id;
  ELSE
    UPDATE registrations
    SET status = 'registered', player_id = v_player_id
    WHERE id = v_reg_id;
  END IF;

  -- Create RSVP rows for every active roster member. Captain is auto-accepted.
  FOR v_member IN
    SELECT player_id FROM team_members
    WHERE team_id = p_team_id AND removed_at IS NULL
  LOOP
    INSERT INTO team_event_rsvps (team_id, tournament_id, player_id, status, responded_at)
    VALUES (
      p_team_id,
      p_tournament_id,
      v_member.player_id,
      CASE WHEN v_member.player_id = v_player_id THEN 'accepted' ELSE 'pending' END,
      CASE WHEN v_member.player_id = v_player_id THEN now() ELSE NULL END
    )
    ON CONFLICT (team_id, tournament_id, player_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted_rsvps = ROW_COUNT;
  END LOOP;

  RETURN jsonb_build_object(
    'registration_id', v_reg_id,
    'team_id', p_team_id,
    'tournament_id', p_tournament_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_team_with_rsvps(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_team_with_rsvps(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_team_with_rsvps(uuid, uuid) TO authenticated;

-- 5. respond_team_event_rsvp RPC ------------------------------------------

CREATE OR REPLACE FUNCTION public.respond_team_event_rsvp(
  p_rsvp_id uuid,
  p_status  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_rsvp      record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_player_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_rsvp FROM team_event_rsvps WHERE id = p_rsvp_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RSVP not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_rsvp.player_id <> v_player_id THEN
    RAISE EXCEPTION 'Only the invited player can respond' USING ERRCODE = '42501';
  END IF;

  UPDATE team_event_rsvps
  SET status = p_status, responded_at = now()
  WHERE id = p_rsvp_id;

  RETURN jsonb_build_object('id', p_rsvp_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_team_event_rsvp(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_team_event_rsvp(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_team_event_rsvp(uuid, text) TO authenticated;

-- 6. update_team_lineup_preset RPC ----------------------------------------

CREATE OR REPLACE FUNCTION public.update_team_lineup_preset(
  p_team_id uuid,
  p_size    int,
  p_lineup  uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_team      record;
  v_invalid   int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_size NOT IN (2, 4) THEN
    RAISE EXCEPTION 'Lineup size must be 2 or 4 (got %)', p_size USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_player_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND archived_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_team.captain_player_id <> v_player_id THEN
    RAISE EXCEPTION 'Only the captain can update lineup presets' USING ERRCODE = '42501';
  END IF;
  IF p_lineup IS NULL OR array_length(p_lineup, 1) IS NULL THEN
    -- Empty lineup is allowed (clears the preset).
    p_lineup := ARRAY[]::uuid[];
  ELSIF array_length(p_lineup, 1) <> p_size THEN
    RAISE EXCEPTION 'Lineup must have exactly % players (got %)',
      p_size, array_length(p_lineup, 1) USING ERRCODE = '22023';
  END IF;

  -- Every player must be an active roster member.
  IF array_length(p_lineup, 1) IS NOT NULL THEN
    SELECT count(*) INTO v_invalid
    FROM unnest(p_lineup) AS pid
    WHERE NOT EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = p_team_id
        AND tm.player_id = pid
        AND tm.removed_at IS NULL
    );
    IF v_invalid > 0 THEN
      RAISE EXCEPTION 'Lineup contains % player(s) not on the active roster', v_invalid
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_size = 2 THEN
    UPDATE teams SET lineup_2v2 = p_lineup WHERE id = p_team_id;
  ELSE
    UPDATE teams SET lineup_4v4 = p_lineup WHERE id = p_team_id;
  END IF;

  RETURN jsonb_build_object('team_id', p_team_id, 'size', p_size, 'lineup', p_lineup);
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_lineup_preset(uuid, int, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_team_lineup_preset(uuid, int, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_team_lineup_preset(uuid, int, uuid[]) TO authenticated;
