/**
 * TournamentRouter -- thin dispatcher for /tournament/:id
 *
 * Looks up the tournament's team_size once and renders the right detail
 * screen:
 *   - team_size <= 1 -> FlashTournamentScreen (solo, has admin tools,
 *     player self-report, lobby management)
 *   - team_size  > 1 -> TournamentDetailScreen (legacy team captain
 *     register / check-in / lineup flow)
 *
 * This lets us collapse /flash/:id and /tournament/:id into a single URL
 * without losing the team captain UI that only lives in
 * TournamentDetailScreen today.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import PageLayout from '../components/layout/PageLayout';

var FlashTournamentScreen = lazy(function() { return import('./FlashTournamentScreen'); });
var TournamentDetailScreen = lazy(function() { return import('./TournamentDetailScreen'); });

function LoadingShell() {
  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto py-10">
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-surface-container-high/40 rounded-2xl"></div>
          <div className="h-48 bg-surface-container-high/40 rounded-2xl"></div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function TournamentRouter() {
  var ctx = useApp();
  var screen = ctx.screen;

  var rawId = null;
  if (screen) {
    if (screen.indexOf('tournament-') === 0) rawId = screen.replace('tournament-', '');
    else if (screen.indexOf('flash-') === 0) rawId = screen.replace('flash-', '');
  }
  var tournamentId = rawId && rawId.indexOf('host-') === 0 ? rawId.replace('host-', '') : rawId;

  var [teamSize, setTeamSize] = useState(null);

  useEffect(function() {
    if (!tournamentId) return;
    var cancelled = false;
    supabase
      .from('tournaments')
      .select('team_size')
      .eq('id', tournamentId)
      .maybeSingle()
      .then(function(res) {
        if (cancelled) return;
        if (res && res.data && res.data.team_size != null) {
          setTeamSize(parseInt(res.data.team_size, 10) || 1);
        } else {
          setTeamSize(1);
        }
      })
      .catch(function() { if (!cancelled) setTeamSize(1); });
    return function() { cancelled = true; };
  }, [tournamentId]);

  if (!tournamentId) return <LoadingShell />;
  if (teamSize == null) return <LoadingShell />;

  if (teamSize > 1) {
    return (
      <Suspense fallback={<LoadingShell />}>
        <TournamentDetailScreen />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingShell />}>
      <FlashTournamentScreen tournamentId={tournamentId} />
    </Suspense>
  );
}
