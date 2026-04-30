/**
 * Team Lab - 5-step walkthrough showing how 4v4 team formation works on TFT Clash.
 * Sandbox only. No DB writes. Drives the parent SquadsSimScreen via onComplete().
 */
import { useEffect, useState } from 'react';
import { Panel, Btn, Inp, Tag, Icon } from '../../components/ui';
import { SEED } from '../../lib/constants.js';
import { canPlayerJoinTeam, validateTeamForRegistration, SQUAD_DEFAULTS } from '../../lib/squad.js';
import { buildSquadsTournamentMeta } from '../../lib/squadSimulation.js';

var STEPS = [
  { id: 1, label: 'Intro' },
  { id: 2, label: 'Create' },
  { id: 3, label: 'Roster' },
  { id: 4, label: 'Register' },
  { id: 5, label: 'Confirm' }
];

function StepRail(props) {
  return (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto">
      {STEPS.map(function(s, i) {
        var isActive = props.current === s.id;
        var isDone = props.current > s.id;
        var dotClass = isActive ? 'bg-primary text-surface' : isDone ? 'bg-tertiary text-surface' : 'bg-surface-container text-on-surface/40';
        var labelClass = isActive ? 'text-primary' : isDone ? 'text-tertiary' : 'text-on-surface/40';
        return (
          <div key={s.id} className="flex items-center gap-2 shrink-0">
            <span className={'inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-xs font-bold ' + dotClass}>{s.id}</span>
            <span className={'font-label text-xs uppercase tracking-widest ' + labelClass}>{s.label}</span>
            {i < STEPS.length - 1 ? <span className="text-on-surface/20 mx-1">/</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function PlayerChip(props) {
  var p = props.player;
  var roleColor = p.role === 'captain' ? 'gold' : p.role === 'sub' ? 'ghost' : 'tertiary';
  return (
    <div className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
      <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface/70 font-bold">
        {p.name.slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-on-surface text-sm font-semibold truncate">{p.name}</div>
        <div className="text-on-surface/50 text-xs font-mono truncate">{p.riotId || (p.name + '#' + (p.region || 'EUW'))}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Tag variant={roleColor} size="xs">{p.role || 'main'}</Tag>
        <span className="text-on-surface/50 text-xs font-mono">{p.rank}</span>
      </div>
      {props.onRemove ? (
        <button onClick={props.onRemove} className="text-on-surface/30 hover:text-error p-1" aria-label="Remove">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export default function TeamLab(props) {
  var onComplete = props.onComplete; // (registeredTeam) => void

  var [step, setStep] = useState(1);
  var [teamName, setTeamName] = useState('Homies United');
  var [teamTag, setTeamTag] = useState('HOM');
  var [region, setRegion] = useState('EUW');

  // Captain = Levitate (the user). Pulled from SEED.
  var captain = Object.assign({}, SEED[0], { role: 'captain', riotId: SEED[0].riot_id_eu });
  var [members, setMembers] = useState([captain]);
  var [pendingInvites, setPendingInvites] = useState([]);
  var [search, setSearch] = useState('');

  // Auto-accept simulation: pending invites flip to members after 1.2s each.
  useEffect(function() {
    if (pendingInvites.length === 0) return;
    var t = setTimeout(function() {
      var first = pendingInvites[0];
      var rest = pendingInvites.slice(1);
      var newRole = members.filter(function(m) { return m.role !== 'sub'; }).length < 4 ? 'main' : 'sub';
      setMembers(function(prev) { return prev.concat([Object.assign({}, first, { role: newRole })]); });
      setPendingInvites(rest);
    }, 1200);
    return function() { clearTimeout(t); };
  }, [pendingInvites, members]);

  // Pool of available players (excludes those already on team or invited)
  var memberIds = members.map(function(m) { return m.id; });
  var inviteIds = pendingInvites.map(function(p) { return p.id; });
  var pool = SEED.filter(function(p) {
    if (memberIds.indexOf(p.id) >= 0) return false;
    if (inviteIds.indexOf(p.id) >= 0) return false;
    if (p.region && p.region !== region && p.region !== 'EUW') return false;
    var s = (search || '').toLowerCase();
    if (s && p.name.toLowerCase().indexOf(s) < 0) return false;
    return true;
  }).slice(0, 8);

  function invite(p) {
    var canJoin = canPlayerJoinTeam({ currentTeamId: null, lastLeftTeamAt: null }, {});
    if (!canJoin.allowed) return;
    setPendingInvites(function(prev) { return prev.concat([p]); });
  }
  function removeMember(id) {
    setMembers(function(prev) { return prev.filter(function(m) { return m.id !== id; }); });
  }

  // ─── Step 4: Tournament register ──────────────────────────────────────────
  var tournament = buildSquadsTournamentMeta();
  var [lineupActives, setLineupActives] = useState([]);
  var [lineupSubs, setLineupSubs] = useState([]);

  useEffect(function() {
    if (step === 4 && lineupActives.length === 0) {
      var actives = members.filter(function(m) { return m.role === 'captain' || m.role === 'main'; }).slice(0, 4);
      var subs = members.filter(function(m) { return m.role === 'sub'; }).slice(0, 2);
      setLineupActives(actives.map(function(m) { return m.id; }));
      setLineupSubs(subs.map(function(m) { return m.id; }));
    }
  }, [step, members, lineupActives.length]);

  // ─── Step 5: Per-member confirmations ────────────────────────────────────
  var [confirmed, setConfirmed] = useState({});
  useEffect(function() {
    if (step !== 5) return;
    var actives = members.filter(function(m) { return lineupActives.indexOf(m.id) >= 0; });
    var idx = 0;
    var iv = setInterval(function() {
      if (idx >= actives.length) {
        clearInterval(iv);
        return;
      }
      var nextId = actives[idx].id;
      setConfirmed(function(prev) { var next = Object.assign({}, prev); next[nextId] = true; return next; });
      idx += 1;
    }, 700);
    return function() { clearInterval(iv); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  var allConfirmed = members
    .filter(function(m) { return lineupActives.indexOf(m.id) >= 0; })
    .every(function(m) { return !!confirmed[m.id]; });

  // ─── Validation ───────────────────────────────────────────────────────────
  var actives = members.filter(function(m) { return m.role === 'captain' || m.role === 'main'; });
  var subs = members.filter(function(m) { return m.role === 'sub'; });
  var validation = validateTeamForRegistration({ members: members }, { teamSize: 4, subsAllowed: 2 });

  function next() { setStep(function(s) { return Math.min(5, s + 1); }); }
  function back() { setStep(function(s) { return Math.max(1, s - 1); }); }

  function finish() {
    var registered = {
      team: { name: teamName, tag: teamTag, region: region, members: members },
      lineup: { actives: lineupActives, subs: lineupSubs },
      tournament: tournament
    };
    if (onComplete) onComplete(registered);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Tag variant="gold" size="md">Sandbox</Tag>
        <h1 className="font-display text-4xl text-on-surface mt-3 mb-2 uppercase">Team Lab</h1>
        <p className="text-on-surface/60 text-sm max-w-2xl">
          Walk through how a 4v4 team gets created, invited, and registered for a tournament.
          Nothing here writes to a database. This is a working prototype to lock the flow.
        </p>
      </div>

      <StepRail current={step} />

      {/* STEP 1 - INTRO */}
      {step === 1 ? (
        <Panel padding="spacious" elevation="elevated">
          <h2 className="font-display text-2xl text-on-surface uppercase mb-4">What is a 4v4 Squads tournament?</h2>
          <ul className="space-y-3 text-on-surface/80 text-sm leading-relaxed mb-6">
            <li className="flex gap-3"><Icon name="groups" size={20} className="text-primary shrink-0 mt-0.5" /><span><b>One lobby = 8 players = 2 teams of 4.</b> Mechanically identical to solo TFT, no shared economy.</span></li>
            <li className="flex gap-3"><Icon name="scoreboard" size={20} className="text-primary shrink-0 mt-0.5" /><span><b>Team score = sum of placement points.</b> Standard 8 / 7 / 6 / 5 / 4 / 3 / 2 / 1 scale.</span></li>
            <li className="flex gap-3"><Icon name="balance" size={20} className="text-primary shrink-0 mt-0.5" /><span><b>Tiebreakers (in order):</b> team with 1st-place finisher, top-4 count, top-2 count, last-game finish.</span></li>
            <li className="flex gap-3"><Icon name="schedule" size={20} className="text-primary shrink-0 mt-0.5" /><span><b>Match format:</b> Bo1 group stage, Bo3 quarters and semis, Bo5 grand final.</span></li>
            <li className="flex gap-3"><Icon name="record_voice_over" size={20} className="text-primary shrink-0 mt-0.5" /><span><b>Voice comms allowed in-team.</b> Cross-team chat is off by default. Discord handles team-finding.</span></li>
          </ul>
          <div className="flex justify-end">
            <Btn variant="primary" size="lg" icon="arrow_forward" iconPosition="right" onClick={next}>Start the lab</Btn>
          </div>
        </Panel>
      ) : null}

      {/* STEP 2 - CREATE TEAM */}
      {step === 2 ? (
        <Panel padding="spacious" elevation="elevated">
          <h2 className="font-display text-2xl text-on-surface uppercase mb-2">Create your team</h2>
          <p className="text-on-surface/60 text-sm mb-6">You become the captain. You can rename the team or transfer captaincy later.</p>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Inp label="Team name" value={teamName} onChange={function(e) { setTeamName(e.target.value); }} />
            <Inp label="Tag (3-4 chars)" value={teamTag} maxLength={4} onChange={function(e) { setTeamTag((e.target.value || '').toUpperCase()); }} />
            <div className="space-y-2">
              <label className="font-label text-xs uppercase tracking-widest text-on-surface/70 block ml-1">Region</label>
              <div className="relative">
                <select value={region} onChange={function(e) { setRegion(e.target.value); }} className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/60 py-4 px-4 rounded-none text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus-visible:outline-none">
                  <option value="EUW">EUW</option>
                  <option value="NA">NA</option>
                </select>
              </div>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-4 rounded-lg mb-6">
            <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-2">Captain</div>
            <PlayerChip player={Object.assign({}, captain, { role: 'captain' })} />
          </div>
          <div className="flex justify-between">
            <Btn variant="ghost" onClick={back}>Back</Btn>
            <Btn variant="primary" size="lg" icon="arrow_forward" iconPosition="right" onClick={next} disabled={!teamName || !teamTag}>Create team</Btn>
          </div>
        </Panel>
      ) : null}

      {/* STEP 3 - INVITE & ROSTER */}
      {step === 3 ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Panel padding="spacious" elevation="elevated">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl text-on-surface uppercase">Roster</h2>
              <Tag variant={validation.ok ? 'success' : 'warning'} size="sm">
                {actives.length}/4 mains{subs.length ? (' + ' + subs.length + ' sub' + (subs.length > 1 ? 's' : '')) : ''}
              </Tag>
            </div>
            <div className="space-y-2 mb-4">
              {members.map(function(m) {
                return <PlayerChip key={m.id} player={m} onRemove={m.role === 'captain' ? null : function() { removeMember(m.id); }} />;
              })}
              {pendingInvites.map(function(p) {
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-dashed border-outline-variant/30 opacity-70">
                    <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface/40 font-bold">{p.name.slice(0, 1)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-on-surface/70 text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-on-surface/40 text-xs font-mono truncate">Invite pending...</div>
                    </div>
                    <span className="inline-block w-3 h-3 border-2 border-on-surface/30 border-t-transparent rounded-full animate-spin" />
                  </div>
                );
              })}
            </div>
            <div className="text-on-surface/40 text-xs">
              Need 4 mains. Up to 2 subs allowed. All members must share a region.
            </div>
          </Panel>

          <Panel padding="spacious" elevation="elevated">
            <h2 className="font-display text-xl text-on-surface uppercase mb-4">Invite players</h2>
            <Inp icon="search" placeholder="Search by name..." value={search} onChange={function(e) { setSearch(e.target.value); }} className="mb-4" />
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {pool.length === 0 ? (
                <div className="text-on-surface/40 text-sm text-center py-8">No players match.</div>
              ) : pool.map(function(p) {
                var fullActives = actives.length >= 4;
                var fullSubs = subs.length >= 2;
                var disabled = fullActives && fullSubs;
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10">
                    <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface/70 font-bold">{p.name.slice(0, 1)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-on-surface text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-on-surface/50 text-xs">{p.rank} - {p.region || 'EUW'}</div>
                    </div>
                    <Btn variant="secondary" size="sm" disabled={disabled} onClick={function() { invite(p); }}>Invite</Btn>
                  </div>
                );
              })}
            </div>
          </Panel>

          <div className="md:col-span-2 flex justify-between">
            <Btn variant="ghost" onClick={back}>Back</Btn>
            <Btn variant="primary" size="lg" icon="arrow_forward" iconPosition="right" disabled={!validation.ok || pendingInvites.length > 0} onClick={next}>
              {validation.ok ? 'Continue to tournament' : ('Need ' + (validation.need || 0) + ' more main' + (validation.need === 1 ? '' : 's'))}
            </Btn>
          </div>
        </div>
      ) : null}

      {/* STEP 4 - REGISTER */}
      {step === 4 ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Panel padding="spacious" elevation="elevated" accent="gold">
            <Tag variant="primary" size="sm">Open registration</Tag>
            <h2 className="font-display text-2xl text-on-surface uppercase mt-3 mb-2">{tournament.name}</h2>
            <div className="text-on-surface/60 text-sm mb-6">
              {new Date(tournament.date).toDateString()} - {tournament.region} - up to {tournament.maxTeams} teams
            </div>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm py-2 border-b border-outline-variant/10">
                <span className="text-on-surface/60 font-label uppercase tracking-wider text-xs">Format</span>
                <span className="text-on-surface font-mono">{tournament.format.group} groups -> {tournament.format.quarter} QF -> {tournament.format.final} Final</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-outline-variant/10">
                <span className="text-on-surface/60 font-label uppercase tracking-wider text-xs">Roster size</span>
                <span className="text-on-surface font-mono">4 actives + up to {tournament.subsAllowed} subs</span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-on-surface/60 font-label uppercase tracking-wider text-xs">Points scale</span>
                <span className="text-on-surface font-mono">Standard (8 to 1)</span>
              </div>
            </div>
            <div>
              <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-3">Prize pool</div>
              <div className="space-y-2">
                {tournament.prizePool.map(function(p) {
                  var medal = p.placement === 1 ? 'gold' : p.placement === 2 ? 'silver' : p.placement === 3 ? 'bronze' : 'ghost';
                  return (
                    <div key={p.placement} className="flex justify-between items-center bg-surface-container-lowest rounded p-2 px-3">
                      <Tag variant={medal} size="sm">{p.placement === 1 ? '1st' : p.placement === 2 ? '2nd' : p.placement === 3 ? '3rd' : (p.placement + 'th')}</Tag>
                      <span className="text-on-surface text-sm font-semibold">{p.prize}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <Panel padding="spacious" elevation="elevated">
            <h2 className="font-display text-xl text-on-surface uppercase mb-2">Lineup picker</h2>
            <p className="text-on-surface/60 text-sm mb-4">Pick 4 actives + up to 2 subs from your roster.</p>
            <div className="space-y-2 mb-4">
              {members.map(function(m) {
                var isActive = lineupActives.indexOf(m.id) >= 0;
                var isSub = lineupSubs.indexOf(m.id) >= 0;
                var label = isActive ? 'Active' : isSub ? 'Sub' : 'Bench';
                var labelVar = isActive ? 'tertiary' : isSub ? 'ghost' : 'ghost';
                function cycle() {
                  if (isActive) {
                    setLineupActives(function(p) { return p.filter(function(x) { return x !== m.id; }); });
                    if (lineupSubs.length < 2) setLineupSubs(function(p) { return p.concat([m.id]); });
                  } else if (isSub) {
                    setLineupSubs(function(p) { return p.filter(function(x) { return x !== m.id; }); });
                  } else {
                    if (lineupActives.length < 4) setLineupActives(function(p) { return p.concat([m.id]); });
                    else if (lineupSubs.length < 2) setLineupSubs(function(p) { return p.concat([m.id]); });
                  }
                }
                return (
                  <button key={m.id} onClick={cycle} className="w-full text-left">
                    <div className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/10 hover:border-primary/30 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface/70 font-bold">{m.name.slice(0, 1)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-on-surface text-sm font-semibold truncate">{m.name}</div>
                        <div className="text-on-surface/50 text-xs">{m.rank}</div>
                      </div>
                      <Tag variant={labelVar} size="sm">{label}</Tag>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-on-surface/40 text-xs mb-4">Tap a player to cycle Active / Sub / Bench.</div>
            <Btn
              variant="primary"
              size="lg"
              className="w-full"
              icon="how_to_reg"
              disabled={lineupActives.length !== 4}
              onClick={next}
            >
              Submit lineup ({lineupActives.length}/4 active)
            </Btn>
          </Panel>

          <div className="md:col-span-2 flex justify-start">
            <Btn variant="ghost" onClick={back}>Back to roster</Btn>
          </div>
        </div>
      ) : null}

      {/* STEP 5 - CONFIRMATIONS */}
      {step === 5 ? (
        <Panel padding="spacious" elevation="elevated">
          <h2 className="font-display text-2xl text-on-surface uppercase mb-2">Member confirmations</h2>
          <p className="text-on-surface/60 text-sm mb-6">
            Each active player must confirm their participation. Captains can't sign anyone up without consent.
          </p>
          <div className="space-y-2 mb-8">
            {members.filter(function(m) { return lineupActives.indexOf(m.id) >= 0; }).map(function(m) {
              var ok = !!confirmed[m.id];
              return (
                <div key={m.id} className={'flex items-center gap-3 p-4 rounded-lg border transition-colors ' + (ok ? 'bg-tertiary/5 border-tertiary/30' : 'bg-surface-container-lowest border-outline-variant/10')}>
                  <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface/70 font-bold">{m.name.slice(0, 1)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-on-surface font-semibold">{m.name}</div>
                    <div className="text-on-surface/50 text-xs">{m.role === 'captain' ? 'Captain' : 'Main'} - {m.rank}</div>
                  </div>
                  {ok ? (
                    <div className="flex items-center gap-2 text-tertiary">
                      <Icon name="check_circle" size={20} />
                      <span className="font-label text-xs uppercase tracking-widest">Confirmed</span>
                    </div>
                  ) : (
                    <span className="inline-block w-4 h-4 border-2 border-on-surface/30 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center">
            <Btn variant="ghost" onClick={back}>Back</Btn>
            <Btn
              variant="primary"
              size="lg"
              icon="sports_esports"
              disabled={!allConfirmed}
              onClick={finish}
            >
              {allConfirmed ? 'Begin tournament' : 'Waiting for confirmations...'}
            </Btn>
          </div>
        </Panel>
      ) : null}

      {/* Bottom config debug strip */}
      <div className="mt-8 pt-4 border-t border-outline-variant/10 flex flex-wrap gap-2 text-xs text-on-surface/40 font-mono">
        <span>defaults: team_size {SQUAD_DEFAULTS.teamSize}</span>
        <span>- subs {SQUAD_DEFAULTS.subsAllowed}</span>
        <span>- leave cooldown {SQUAD_DEFAULTS.leaveCooldownMinutes}m</span>
        <span>- one team per player at a time</span>
      </div>
    </div>
  );
}
