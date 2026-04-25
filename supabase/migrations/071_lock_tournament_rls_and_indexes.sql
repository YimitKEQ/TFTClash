-- 071: Tighten tournament RLS, index activity_feed, fix dangling FKs
--
-- Background:
-- - tournament_rounds and tournament_results have legacy WITH CHECK (true) policies
--   coexisting with later admin/host-only policies. Postgres OR-evaluates policies,
--   so any authenticated user can still write. Drop legacy policies explicitly.
-- - activity_feed orders by created_at on every dashboard/ops poll without an index.
-- - scrim_results.player_id and activity_feed.player_id reference players(id) without
--   ON DELETE, so deleting a player breaks constraints.

BEGIN;

-- ─── tournament_results: drop legacy open policies ───────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert tournament results" ON public.tournament_results;
DROP POLICY IF EXISTS "Authenticated users can update tournament results" ON public.tournament_results;

-- Replacement: admin-only writes (host_dashboard separately uses service role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tournament_results' AND policyname='Admins manage tournament results'
  ) THEN
    CREATE POLICY "Admins manage tournament results"
      ON public.tournament_results FOR ALL
      TO authenticated
      USING (public.is_admin_or_mod((SELECT auth.uid())))
      WITH CHECK (public.is_admin_or_mod((SELECT auth.uid())));
  END IF;
END $$;

-- ─── tournament_rounds: drop any open authenticated policies ─────────────────
DROP POLICY IF EXISTS "Authenticated users can manage tournament rounds" ON public.tournament_rounds;
DROP POLICY IF EXISTS "Authenticated users can insert tournament rounds" ON public.tournament_rounds;
DROP POLICY IF EXISTS "Authenticated users can update tournament rounds" ON public.tournament_rounds;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tournament_rounds' AND policyname='Admins manage tournament rounds'
  ) THEN
    CREATE POLICY "Admins manage tournament rounds"
      ON public.tournament_rounds FOR ALL
      TO authenticated
      USING (public.is_admin_or_mod((SELECT auth.uid())))
      WITH CHECK (public.is_admin_or_mod((SELECT auth.uid())));
  END IF;
END $$;

-- ─── sponsors: optimize is_admin_or_mod call into InitPlan ───────────────────
DROP POLICY IF EXISTS "Sponsors are visible to admins and mods" ON public.sponsors;
CREATE POLICY "Sponsors are visible to admins and mods"
  ON public.sponsors FOR SELECT
  TO authenticated
  USING (public.is_admin_or_mod((SELECT auth.uid())));

-- ─── activity_feed: add created_at index ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS activity_feed_created_at_idx
  ON public.activity_feed(created_at DESC);

-- ─── players partial index for stat lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS players_auth_stats_idx
  ON public.players(auth_user_id)
  INCLUDE (season_pts, wins, top4, games)
  WHERE auth_user_id IS NOT NULL;

-- ─── Fix dangling FKs that block player deletion ─────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='activity_feed'
      AND constraint_type='FOREIGN KEY'
      AND constraint_name='activity_feed_player_id_fkey'
  ) THEN
    ALTER TABLE public.activity_feed DROP CONSTRAINT activity_feed_player_id_fkey;
  END IF;
END $$;

ALTER TABLE public.activity_feed
  ADD CONSTRAINT activity_feed_player_id_fkey
  FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='scrim_results'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public' AND table_name='scrim_results'
        AND constraint_type='FOREIGN KEY'
        AND constraint_name='scrim_results_player_id_fkey'
    ) THEN
      ALTER TABLE public.scrim_results DROP CONSTRAINT scrim_results_player_id_fkey;
    END IF;
    ALTER TABLE public.scrim_results
      ADD CONSTRAINT scrim_results_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
