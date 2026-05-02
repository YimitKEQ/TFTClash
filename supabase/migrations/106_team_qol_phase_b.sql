-- 106_team_qol_phase_b.sql
--
-- Phase B team quality-of-life:
--
-- 1. swap_team_lineup_player(team, tournament, out, in) — captain-only RPC.
--    Swap one player out of the registered lineup for another active member
--    or accepted ringer. Lets captains rebalance based on RSVP status without
--    cancelling and re-registering.
--
-- 2. lft_posts table — Looking-For-Team board. Players without a team can
--    publish their availability (region, formats, message) so captains can
--    discover and recruit them. Auto-archives 30 days after creation, or
--    immediately when the poster joins a team.
--
-- 3. team_event_ringers table — per-tournament guest slots. A captain can
--    invite a player from another team to fill a roster spot for a single
--    tournament without breaking the player's main team membership. The
--    lineup-on-checkin trigger is updated to accept active members OR
--    accepted ringers for that specific (team, tournament) pair.
--
-- All RPCs are SECURITY DEFINER, REVOKE from anon, GRANT to authenticated.

-- 1. swap_team_lineup_player ------------------------------------------------

CREATE OR REPLACE FUNCTION public.swap_team_lineup_player(
  p_team_id        uuid,
  p_tournament_id  uuid,
  p_out_player_id  uuid,
  p_in_player_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_pid uuid;
  v_team       record;
  v_phase      text;
  v_reg        record;
  v_lineup     uuid[];
  v_in_active  boolean;
  v_in_ringer  boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_caller_pid FROM public.players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_caller_pid IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, captain_player_id INTO v_team
    FROM public.teams WHERE id = p_team_id AND archived_at IS NULL;
  IF v_team.id IS NULL THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_team.captain_player_id <> v_caller_pid THEN
    RAISE EXCEPTION 'Captain only' USING ERRCODE = '42501';
  END IF;

  SELECT phase INTO v_phase FROM public.tournaments WHERE id = p_tournament_id;
  IF v_phase IS NULL THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_phase NOT IN ('registration','check_in') THEN
    RAISE EXCEPTION 'Lineup is locked for phase %', v_phase USING ERRCODE = 'P0001';
  END IF;

  SELECT id, lineup_player_ids INTO v_reg
    FROM public.registrations
    WHERE tournament_id = p_tournament_id AND team_id = p_team_id
    LIMIT 1;
  IF v_reg.id IS NULL THEN
    RAISE EXCEPTION 'Team is not registered for this tournament' USING ERRCODE = 'P0002';
  END IF;

  v_lineup := COALESCE(v_reg.lineup_player_ids, '{}'::uuid[]);
  IF NOT (p_out_player_id = ANY(v_lineup)) THEN
    RAISE EXCEPTION 'Outgoing player is not in current lineup' USING ERRCODE = 'P0001';
  END IF;
  IF p_in_player_id = ANY(v_lineup) THEN
    RAISE EXCEPTION 'Incoming player is already in lineup' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.team_members
     WHERE team_id = p_team_id AND player_id = p_in_player_id AND removed_at IS NULL
  ) INTO v_in_active;
  SELECT EXISTS(
    SELECT 1 FROM public.team_event_ringers
     WHERE team_id = p_team_id AND tournament_id = p_tournament_id
       AND player_id = p_in_player_id AND status = 'accepted'
  ) INTO v_in_ringer;
  IF NOT (v_in_active OR v_in_ringer) THEN
    RAISE EXCEPTION 'Incoming player is not on the team or an accepted ringer' USING ERRCODE = 'P0001';
  END IF;

  v_lineup := array_replace(v_lineup, p_out_player_id, p_in_player_id);
  UPDATE public.registrations SET lineup_player_ids = v_lineup WHERE id = v_reg.id;

  RETURN jsonb_build_object(
    'success', true,
    'lineup_player_ids', to_jsonb(v_lineup)
  );
END;
$$;

-- 2. lft_posts (Looking-For-Team board) ------------------------------------

CREATE TABLE IF NOT EXISTS public.lft_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  region       text NOT NULL DEFAULT 'EUW',
  formats      text[] NOT NULL DEFAULT ARRAY['2v2','4v4']::text[],
  message      text DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  archived_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS lft_posts_one_active_per_player
  ON public.lft_posts (player_id) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS lft_posts_active_idx
  ON public.lft_posts (region, created_at DESC) WHERE archived_at IS NULL;

ALTER TABLE public.lft_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lft_posts public read active" ON public.lft_posts;
CREATE POLICY "lft_posts public read active"
  ON public.lft_posts FOR SELECT
  TO anon, authenticated
  USING (archived_at IS NULL);

-- Auto-archive a player's LFT post when they join a team.
CREATE OR REPLACE FUNCTION public.archive_lft_on_team_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.removed_at IS NULL THEN
    UPDATE public.lft_posts
       SET archived_at = now()
     WHERE player_id = NEW.player_id AND archived_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_members_archive_lft ON public.team_members;
CREATE TRIGGER team_members_archive_lft
  AFTER INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.archive_lft_on_team_join();

CREATE OR REPLACE FUNCTION public.upsert_lft_post(
  p_region   text,
  p_formats  text[],
  p_message  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid    uuid;
  v_active boolean;
  v_id     uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_pid FROM public.players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  -- Refuse if already on an active team
  SELECT EXISTS(
    SELECT 1 FROM public.team_members WHERE player_id = v_pid AND removed_at IS NULL
  ) INTO v_active;
  IF v_active THEN
    RAISE EXCEPTION 'Leave your current team before posting LFT' USING ERRCODE = 'P0001';
  END IF;

  IF p_formats IS NULL OR array_length(p_formats,1) IS NULL THEN
    RAISE EXCEPTION 'Pick at least one format' USING ERRCODE = '22023';
  END IF;

  -- Upsert the active post
  SELECT id INTO v_id FROM public.lft_posts
    WHERE player_id = v_pid AND archived_at IS NULL LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.lft_posts
       SET region = COALESCE(NULLIF(trim(p_region),''),'EUW'),
           formats = p_formats,
           message = COALESCE(p_message,''),
           expires_at = now() + interval '30 days'
     WHERE id = v_id;
  ELSE
    INSERT INTO public.lft_posts (player_id, region, formats, message)
    VALUES (v_pid, COALESCE(NULLIF(trim(p_region),''),'EUW'), p_formats, COALESCE(p_message,''))
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'post_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_lft_post(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_pid FROM public.players WHERE auth_user_id = auth.uid() LIMIT 1;
  UPDATE public.lft_posts SET archived_at = now()
   WHERE id = p_id AND player_id = v_pid AND archived_at IS NULL;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. team_event_ringers (per-tournament guest slots) -----------------------

CREATE TABLE IF NOT EXISTS public.team_event_ringers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tournament_id   uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  invited_by_pid  uuid REFERENCES public.players(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','declined','cancelled')),
  message         text DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz,
  UNIQUE (team_id, tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS team_event_ringers_player_idx
  ON public.team_event_ringers (player_id, status);
CREATE INDEX IF NOT EXISTS team_event_ringers_team_idx
  ON public.team_event_ringers (team_id, tournament_id);

ALTER TABLE public.team_event_ringers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ringer reads own and team rows" ON public.team_event_ringers;
CREATE POLICY "Ringer reads own and team rows"
  ON public.team_event_ringers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.players p WHERE p.id = team_event_ringers.player_id AND p.auth_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
       JOIN public.players p ON p.id = tm.player_id
       WHERE tm.team_id = team_event_ringers.team_id
         AND tm.removed_at IS NULL
         AND p.auth_user_id = auth.uid()
    )
  );

-- Captain invites a ringer. Sends a notification via SECURITY DEFINER write.
CREATE OR REPLACE FUNCTION public.invite_team_ringer(
  p_team_id        uuid,
  p_tournament_id  uuid,
  p_player_id      uuid,
  p_message        text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_pid  uuid;
  v_team        record;
  v_tour        record;
  v_player      record;
  v_ringer_id   uuid;
  v_already     boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_caller_pid FROM public.players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_caller_pid IS NULL THEN
    RAISE EXCEPTION 'No player profile' USING ERRCODE = 'P0002';
  END IF;

  SELECT id, name, captain_player_id INTO v_team
    FROM public.teams WHERE id = p_team_id AND archived_at IS NULL;
  IF v_team.id IS NULL THEN
    RAISE EXCEPTION 'Team not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_team.captain_player_id <> v_caller_pid THEN
    RAISE EXCEPTION 'Captain only' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, phase, team_size INTO v_tour
    FROM public.tournaments WHERE id = p_tournament_id;
  IF v_tour.id IS NULL THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_tour.team_size IS NULL OR v_tour.team_size <= 1 THEN
    RAISE EXCEPTION 'Ringers are only for team tournaments' USING ERRCODE = 'P0001';
  END IF;
  IF v_tour.phase NOT IN ('registration','check_in') THEN
    RAISE EXCEPTION 'Cannot add ringers in phase %', v_tour.phase USING ERRCODE = 'P0001';
  END IF;

  SELECT id, username, auth_user_id INTO v_player FROM public.players WHERE id = p_player_id;
  IF v_player.id IS NULL THEN
    RAISE EXCEPTION 'Player not found' USING ERRCODE = 'P0002';
  END IF;

  -- Already on this team? No need to ringer.
  SELECT EXISTS(
    SELECT 1 FROM public.team_members
     WHERE team_id = p_team_id AND player_id = p_player_id AND removed_at IS NULL
  ) INTO v_already;
  IF v_already THEN
    RAISE EXCEPTION 'Player is already an active member of this team' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.team_event_ringers (team_id, tournament_id, player_id, invited_by_pid, message)
  VALUES (p_team_id, p_tournament_id, p_player_id, v_caller_pid, COALESCE(p_message,''))
  ON CONFLICT (team_id, tournament_id, player_id) DO UPDATE
    SET status = CASE WHEN team_event_ringers.status IN ('declined','cancelled')
                      THEN 'pending' ELSE team_event_ringers.status END,
        message = COALESCE(EXCLUDED.message, team_event_ringers.message),
        responded_at = NULL
  RETURNING id INTO v_ringer_id;

  -- Notification (best effort)
  IF v_player.auth_user_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type, action_url)
      VALUES (
        v_player.auth_user_id,
        'Ringer invite: ' || COALESCE(v_tour.name,'a tournament'),
        COALESCE(v_team.name,'A team') || ' invited you to play ' ||
          (v_tour.team_size || 'v' || v_tour.team_size) || ' for this event.',
        'group',
        '/teams'
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'ringer_id', v_ringer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_team_ringer_invite(
  p_ringer_id uuid,
  p_status    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Invalid status' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_pid FROM public.players WHERE auth_user_id = auth.uid() LIMIT 1;
  SELECT * INTO v_row FROM public.team_event_ringers WHERE id = p_ringer_id;
  IF v_row.id IS NULL OR v_row.player_id <> v_pid THEN
    RAISE EXCEPTION 'Not your invite' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_event_ringers
     SET status = p_status, responded_at = now()
   WHERE id = p_ringer_id;
  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- Update the lineup-on-checkin trigger to allow accepted ringers.
CREATE OR REPLACE FUNCTION public.enforce_team_lineup_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t_team_size       int;
  is_service        boolean := (SELECT auth.role()) = 'service_role';
  is_admin          boolean := COALESCE(public.is_admin_or_mod((SELECT auth.uid())), false);
  eligible_count    int;
BEGIN
  IF is_service OR is_admin THEN RETURN NEW; END IF;
  IF NEW.team_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'checked_in' THEN RETURN NEW; END IF;

  SELECT team_size INTO t_team_size FROM public.tournaments WHERE id = NEW.tournament_id;
  IF t_team_size IS NULL OR t_team_size <= 1 THEN RETURN NEW; END IF;

  IF NEW.lineup_player_ids IS NULL OR array_length(NEW.lineup_player_ids, 1) IS DISTINCT FROM t_team_size THEN
    RAISE EXCEPTION 'Lineup must contain exactly % players to check in.', t_team_size USING ERRCODE = 'P0001';
  END IF;

  -- Eligible = active member OR accepted ringer for this exact tournament+team
  SELECT count(DISTINCT pid) INTO eligible_count
  FROM (
    SELECT tm.player_id AS pid
      FROM public.team_members tm
      WHERE tm.team_id = NEW.team_id
        AND tm.removed_at IS NULL
        AND tm.player_id = ANY(NEW.lineup_player_ids)
    UNION
    SELECT r.player_id AS pid
      FROM public.team_event_ringers r
      WHERE r.team_id = NEW.team_id
        AND r.tournament_id = NEW.tournament_id
        AND r.status = 'accepted'
        AND r.player_id = ANY(NEW.lineup_player_ids)
  ) eligible;

  IF eligible_count <> t_team_size THEN
    RAISE EXCEPTION 'Lineup includes a player who is not an active member or accepted ringer for this team.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Grants ----------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.swap_team_lineup_player(uuid,uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.swap_team_lineup_player(uuid,uuid,uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.swap_team_lineup_player(uuid,uuid,uuid,uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_lft_post(text,text[],text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_lft_post(text,text[],text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_lft_post(text,text[],text) TO authenticated;

REVOKE ALL ON FUNCTION public.archive_lft_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_lft_post(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.archive_lft_post(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.invite_team_ringer(uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_team_ringer(uuid,uuid,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.invite_team_ringer(uuid,uuid,uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_team_ringer_invite(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_team_ringer_invite(uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_team_ringer_invite(uuid,text) TO authenticated;
