-- 098_review_hardening.sql
-- Pre-launch review hardening pass:
--   1. Tighten host RLS on disputes (no DELETE) and game_results (registration membership).
--   2. Add hot-path indexes flagged by DB review (tournaments.type, host_id, active partial; game_results active partial; news_posts.created_by).
--   3. Drop the prize_claims single-column status index that is now subsumed by the (status, created_at) composite added in 093.
--   4. Simplify news_posts public read policy so the partial index can serve the hot path; clients already filter published_at.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Hosts can read + resolve disputes on their own non-season tournaments.
--    Previously FOR ALL allowed INSERT and DELETE which would let a host
--    erase the audit trail. Replace with explicit SELECT + UPDATE only.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Hosts manage own tournament disputes" ON public.disputes;

CREATE POLICY "Hosts read own tournament disputes" ON public.disputes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = disputes.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND (t.type IS NULL OR t.type <> 'season_clash')
    )
  );

CREATE POLICY "Hosts update own tournament disputes" ON public.disputes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = disputes.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND (t.type IS NULL OR t.type <> 'season_clash')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = disputes.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND (t.type IS NULL OR t.type <> 'season_clash')
    )
  );

COMMENT ON POLICY "Hosts read own tournament disputes" ON public.disputes IS
  'Hosts may view disputes on their own non-season tournaments. Disputes themselves are still player-initiated; admin retains full access.';
COMMENT ON POLICY "Hosts update own tournament disputes" ON public.disputes IS
  'Hosts may resolve (UPDATE) disputes on their own non-season tournaments. INSERT/DELETE are intentionally excluded so the audit trail is preserved.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hosts manage game_results on own non-season tournaments AND only for
--    players who actually registered for that tournament. Previously a host
--    could write a result row for any player_id in the system as long as the
--    tournament_id was theirs - cross-tenant noise/abuse vector.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Hosts manage own tournament game_results" ON public.game_results;

CREATE POLICY "Hosts manage own tournament game_results" ON public.game_results
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = game_results.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND (t.type IS NULL OR t.type <> 'season_clash')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = game_results.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND (t.type IS NULL OR t.type <> 'season_clash')
    )
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.tournament_id = game_results.tournament_id
        AND r.player_id = game_results.player_id
    )
  );

COMMENT ON POLICY "Hosts manage own tournament game_results" ON public.game_results IS
  'Hosts may insert/update/delete game results only for players actually registered to their non-season tournament.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. news_posts public read - drop the volatile NOW() check from RLS so the
--    partial index (WHERE archived_at IS NULL) actually covers the query.
--    Client-side fetchNewsPosts already applies .lte("published_at", now())
--    when filtering for the public feed.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS news_posts_public_read ON public.news_posts;
CREATE POLICY news_posts_public_read ON public.news_posts
  FOR SELECT
  USING (archived_at IS NULL);

COMMENT ON POLICY news_posts_public_read ON public.news_posts IS
  'Anyone can read non-archived news posts. Publication-window filtering (published_at <= now()) is applied client-side; keeping NOW() out of RLS lets PostgreSQL use the partial index.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Indexes flagged by DB review.
-- ─────────────────────────────────────────────────────────────────────────────

-- tournaments.type - filtered in AppContext, refresh_player_stats trigger,
-- HostDashboardScreen and host RLS policies.
CREATE INDEX IF NOT EXISTS tournaments_type_season_idx
  ON public.tournaments (type)
  WHERE type = 'season_clash';

-- tournaments.host_id - host RLS sub-selects on disputes / game_results
-- evaluate this on every host read.
CREATE INDEX IF NOT EXISTS tournaments_host_id_idx
  ON public.tournaments (host_id)
  WHERE host_id IS NOT NULL;

-- "Active tournaments" hot path: tournaments WHERE archived_at IS NULL,
-- ordered/filtered by phase + type.
CREATE INDEX IF NOT EXISTS tournaments_active_phase_type_idx
  ON public.tournaments (phase, type)
  WHERE archived_at IS NULL;

-- game_results stats refresh and per-player history: filter NOT is_dnp.
CREATE INDEX IF NOT EXISTS game_results_player_active_idx
  ON public.game_results (player_id, tournament_id)
  WHERE is_dnp = FALSE;

-- news_posts.created_by FK - small but follows project convention of
-- indexing every FK.
CREATE INDEX IF NOT EXISTS news_posts_created_by_idx
  ON public.news_posts (created_by)
  WHERE created_by IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Drop the prize_claims_status_idx now subsumed by
--    prize_claims_status_created_idx (claim_status, created_at DESC).
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.prize_claims_status_idx;
