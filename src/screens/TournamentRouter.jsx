/**
 * TournamentRouter -- thin wrapper for /tournament/:id
 *
 * The rich FlashTournamentScreen is the universal tournament view: it
 * carries the full info card (rules, prize pool, share link, region),
 * admin tools (open/close check-in, generate lobbies, finalize, broadcast,
 * dispute resolution, force placement, lineup edit), and the live
 * dashboard for solo + team events. We always render it so admins always
 * see the same admin surface no matter where they came from.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import PageLayout from '../components/layout/PageLayout';

var FlashTournamentScreen = lazy(function() { return import('./FlashTournamentScreen'); });

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

  if (!tournamentId) return <LoadingShell />;

  return (
    <Suspense fallback={<LoadingShell />}>
      <FlashTournamentScreen tournamentId={tournamentId} />
    </Suspense>
  );
}
