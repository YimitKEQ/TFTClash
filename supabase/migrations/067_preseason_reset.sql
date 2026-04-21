-- Migration 067: Preseason reset for public launch
--
-- Purges competitive, notification, and audit data so Season 1 starts clean.
-- Preserves: players (rows, with stats zeroed), host_profiles, sponsors,
-- subscriptions, site_settings, user_roles, seasons, gear_items, challenges,
-- content_* / social_connections (operator-configured), referrals config.
--
-- Idempotent: safe to re-run. TRUNCATE on an empty table is a no-op.
--
-- DO NOT include in CI automated runs. This is a one-shot launch operation
-- intended to be applied manually via Supabase MCP / dashboard before flipping
-- the public launch flag.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Game + tournament result history
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pending_results',
    'game_results',
    'tournament_results',
    'tournament_rounds',
    'head_to_head',
    'lobby_players',
    'lobbies',
    'registrations'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Player-linked competitive data
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'player_achievements',
    'player_challenges',
    'player_milestones',
    'player_penalties',
    'player_reports',
    'disputes',
    'point_adjustments',
    'prize_claims'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Scrim history
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'scrim_results',
    'scrim_games',
    'scrim_players',
    'scrims'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Activity, notifications, audit trails, season snapshots
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'notifications',
    'activity_feed',
    'audit_log',
    'admin_audit_log',
    'season_snapshots',
    'host_applications'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Tournaments: delete all. Launch starts with a clean slate; hosts can
-- re-draft their templates post-launch.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.tournaments') IS NOT NULL THEN
    DELETE FROM public.tournaments;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5b. Clear cached tournament_state in site_settings.
--
-- The client caches `tournament_state` (phase, registeredIds, dbTournamentId,
-- activeTournamentId, etc.) in site_settings. If we leave a dbTournamentId
-- pointing to a deleted tournament, the next register click hits a FK
-- violation against registrations. Reset the whole payload to a clean
-- pre-tournament shape so the admin panel can seed Season 1 fresh.
--
-- Note: value is stored as a JSON-stringified JSON (historical double-encode);
-- we match that by writing a quoted JSON string.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fresh_state text;
BEGIN
  IF to_regclass('public.site_settings') IS NOT NULL THEN
    fresh_state := jsonb_build_object(
      'phase', 'registration',
      'round', 1,
      'lobbies', '[]'::jsonb,
      'lockedLobbies', '[]'::jsonb,
      'checkedInIds', '[]'::jsonb,
      'registeredIds', '[]'::jsonb,
      'waitlistIds', '[]'::jsonb,
      'maxPlayers', 128,
      'clashName', 'Clash Week 1',
      'server', 'EU',
      'region', 'EU',
      'isFinale', false,
      'rulesOverride', '',
      'prizePool', '[]'::jsonb,
      'roundCount', 4,
      'seedingMethod', 'snake',
      'clashNumber', 1,
      'totalGames', 4,
      'cutLine', 13,
      'cutAfterGame', 4,
      'checkinWindowMins', 30,
      'formatPreset', 'custom'
    )::text;

    UPDATE public.site_settings
    SET value = to_jsonb(fresh_state)
    WHERE key = 'tournament_state';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If site_settings schema diverges, skip silently; the rest of the reset
  -- still succeeded. Admin can clear the row manually.
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Reset player competitive stats (keep rows, bio, socials, auth links,
-- region, rank, profile_pic_url, is_admin, tier).
-- ---------------------------------------------------------------------------
UPDATE public.players
SET
  season_pts = 0,
  wins = 0,
  top4 = 0,
  games = 0,
  avg_placement = 0,
  last_clash_rank = NULL,
  consistency_grade = NULL,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 7. Audit marker: stamp the launch reset in the now-empty audit log so
-- ops has a timestamp to anchor Season 1 against.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    INSERT INTO public.audit_log (actor_id, action, actor_name, target_type, target_id, details, created_at)
    VALUES (NULL, 'preseason_reset', 'system', 'system', NULL,
            jsonb_build_object('migration', '067_preseason_reset', 'note', 'Season 1 launch reset'),
            NOW());
  END IF;
EXCEPTION WHEN undefined_column THEN
  -- Older audit_log shape without details/target_type. Skip marker; reset still succeeded.
  NULL;
END $$;

COMMIT;
