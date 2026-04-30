/**
 * SquadsSimScreen - orchestrates the 4v4 sim:
 *  1. Team Lab walkthrough (5 steps)
 *  2. Live tournament replay (groups + playoffs + champion)
 *
 * No DB writes. Sandbox accessible at /sim/squads.
 */
import { useState, useMemo } from 'react';
import PageLayout from '../../components/layout/PageLayout';
import TeamLab from './TeamLab';
import SquadsBracket from './SquadsBracket';
import { runFullSquadsTournament } from '../../lib/squadSimulation.js';

export default function SquadsSimScreen() {
  var [phase, setPhase] = useState('lab');
  var [registered, setRegistered] = useState(null);
  var [seed, setSeed] = useState(1337);

  // Run full tournament once we hit the bracket phase. Memoized on seed so
  // restart-with-different-seed produces a different result.
  var run = useMemo(function() {
    if (phase !== 'tournament') return null;
    return runFullSquadsTournament({ seed: seed });
  }, [phase, seed]);

  // Identify "your team" - team 1 in the field (Homies United / Levitate).
  var userTeamId = run ? run.teams[0].teamId : null;

  function onLabComplete(reg) {
    setRegistered(reg);
    setPhase('tournament');
  }

  function restart() {
    setSeed(Math.floor(Math.random() * 100000) + 1);
    setRegistered(null);
    setPhase('lab');
  }

  return (
    <PageLayout>
      {phase === 'lab' ? <TeamLab onComplete={onLabComplete} /> : null}
      {phase === 'tournament' && run ? (
        <SquadsBracket
          run={run}
          meta={registered ? registered.tournament : null}
          userTeamId={userTeamId}
          onRestart={restart}
        />
      ) : null}
    </PageLayout>
  );
}
