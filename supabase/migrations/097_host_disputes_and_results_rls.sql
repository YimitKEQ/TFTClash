-- 097_host_disputes_and_results_rls.sql
-- Allow hosts to resolve disputes and write game_results for their own non-season tournaments.
-- Closes RLS gaps that prevented FlashTournamentScreen iAmHost branches from succeeding.

-- Hosts manage own tournament disputes
DROP POLICY IF EXISTS "Hosts manage own tournament disputes" ON public.disputes;
CREATE POLICY "Hosts manage own tournament disputes" ON public.disputes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = disputes.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND COALESCE(t.type, '') IS DISTINCT FROM 'season_clash'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = disputes.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND COALESCE(t.type, '') IS DISTINCT FROM 'season_clash'
    )
  );

-- Hosts manage own tournament game_results
DROP POLICY IF EXISTS "Hosts manage own tournament game_results" ON public.game_results;
CREATE POLICY "Hosts manage own tournament game_results" ON public.game_results
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = game_results.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND COALESCE(t.type, '') IS DISTINCT FROM 'season_clash'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = game_results.tournament_id
        AND t.host_id = (SELECT auth.uid())
        AND COALESCE(t.type, '') IS DISTINCT FROM 'season_clash'
    )
  );

COMMENT ON POLICY "Hosts manage own tournament disputes" ON public.disputes IS
  'Allows hosts (role host) to resolve disputes on tournaments where host_id matches and type is not season_clash. Season clash disputes remain admin-only.';
COMMENT ON POLICY "Hosts manage own tournament game_results" ON public.game_results IS
  'Allows hosts to insert/update/delete game results for their own non-season tournaments. Season clash results remain admin-only.';
