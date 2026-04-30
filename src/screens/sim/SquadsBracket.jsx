/**
 * SquadsBracket - live 4v4 tournament replay view.
 * Renders group stage + playoff bracket from a runFullSquadsTournament() result.
 * Click any lobby/match to drill into placements per player.
 */
import { useState, useMemo } from 'react';
import { Panel, Btn, Tag, Icon } from '../../components/ui';

function teamName(teams, id) {
  for (var i = 0; i < teams.length; i++) {
    if (teams[i].teamId === id) return teams[i];
  }
  return null;
}

function TeamRow(props) {
  var team = props.team;
  var isWinner = props.isWinner;
  var isUser = props.isUser;
  var score = props.score;
  var bg = isWinner ? 'bg-primary/5 border-primary/30' : 'bg-surface-container-lowest border-outline-variant/10';
  var ring = isUser ? ' ring-1 ring-tertiary/40' : '';
  return (
    <div className={'flex items-center gap-2 px-3 py-2 rounded border ' + bg + ring}>
      <span className="font-label text-xs uppercase tracking-widest text-on-surface/40 w-10 shrink-0">{team.tag}</span>
      <span className="text-on-surface text-sm font-semibold flex-1 min-w-0 truncate">{team.name}{isUser ? ' (you)' : ''}</span>
      {score != null ? <span className="font-mono text-on-surface text-sm font-bold tabular-nums shrink-0">{score}</span> : null}
      {isWinner ? <Icon name="check_circle" size={16} className="text-primary shrink-0" /> : null}
    </div>
  );
}

function LobbyDrillIn(props) {
  var sim = props.sim;
  var teamA = props.teamA;
  var teamB = props.teamB;
  var scaleId = props.scaleId || 'standard';
  if (!sim) return null;
  var outcome = sim.outcome;
  var aRow = outcome.teams.filter(function(t) { return t.teamId === teamA.teamId; })[0];
  var bRow = outcome.teams.filter(function(t) { return t.teamId === teamB.teamId; })[0];
  if (!aRow || !bRow) return null;
  var winnerTeam = outcome.winnerTeamId === teamA.teamId ? teamA : teamB;

  function placementBadge(p) {
    if (p === 1) return 'gold';
    if (p === 2) return 'silver';
    if (p === 3) return 'bronze';
    if (p <= 4) return 'tertiary';
    return 'ghost';
  }

  return (
    <Panel padding="default" elevation="default" className="mt-2">
      <div className="grid md:grid-cols-2 gap-4">
        {[{ team: teamA, row: aRow }, { team: teamB, row: bRow }].map(function(side) {
          var isW = side.team.teamId === outcome.winnerTeamId;
          return (
            <div key={side.team.teamId} className={'p-3 rounded ' + (isW ? 'bg-primary/5 border border-primary/30' : 'bg-surface-container-lowest border border-outline-variant/10')}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-label text-xs uppercase tracking-widest text-on-surface/40">{side.team.tag}</span>
                  <div className="text-on-surface font-semibold">{side.team.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl text-on-surface font-bold tabular-nums">{side.row.score}</div>
                  <div className="text-on-surface/40 text-xs">{side.row.wins} win {side.row.top4} top4 {side.row.top2} top2</div>
                </div>
              </div>
              <div className="space-y-1 mt-2">
                {side.row.members.map(function(m) {
                  return (
                    <div key={m.playerId} className="flex items-center gap-2 text-sm">
                      <Tag variant={placementBadge(m.placement)} size="xs">{m.placement}</Tag>
                      <span className="text-on-surface/80 flex-1 truncate">{m.name}</span>
                      <span className="font-mono text-on-surface/60">{m.points}p</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-xs">
        <span className="text-on-surface/50 font-label uppercase tracking-widest">
          Winner: <span className="text-primary font-bold ml-2">{winnerTeam.name}</span>
        </span>
        <span className="text-on-surface/40 font-mono">
          scale: {scaleId}{outcome.tiebreakerUsed ? (' - tiebreaker: ' + outcome.tiebreakerUsed) : ''}
        </span>
      </div>
    </Panel>
  );
}

function GroupCard(props) {
  var group = props.group;
  var teams = props.teams;
  var userTeamId = props.userTeamId;
  var [open, setOpen] = useState(false);
  var [drill, setDrill] = useState(null);

  var teamLookup = useMemo(function() {
    var m = {};
    group.teams.forEach(function(t) { m[t.teamId] = t; });
    return m;
  }, [group.teams]);

  return (
    <Panel padding="default" elevation="elevated">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-on-surface uppercase">Group {group.groupId}</h3>
        <Btn variant="ghost" size="sm" icon={open ? 'expand_less' : 'expand_more'} onClick={function() { setOpen(!open); }}>
          {open ? 'Hide' : 'Detail'}
        </Btn>
      </div>
      <div className="space-y-2 mb-3">
        {group.standings.map(function(row, i) {
          var t = teamLookup[row.teamId];
          var advancing = i < 2;
          var isUser = t && t.teamId === userTeamId;
          return (
            <div key={row.teamId} className={'flex items-center gap-2 p-2 rounded ' + (advancing ? 'bg-tertiary/5 border border-tertiary/20' : 'bg-surface-container-lowest border border-outline-variant/10') + (isUser ? ' ring-1 ring-primary/40' : '')}>
              <span className="font-mono text-xs text-on-surface/40 w-6 shrink-0">{i + 1}.</span>
              <span className="font-label text-xs uppercase tracking-widest text-on-surface/40 w-10 shrink-0">{t ? t.tag : ''}</span>
              <span className="text-on-surface text-sm font-semibold flex-1 min-w-0 truncate">{t ? t.name : ''}{isUser ? ' (you)' : ''}</span>
              <span className="font-mono text-on-surface text-sm tabular-nums shrink-0 w-12 text-right">{row.lobbyWins}W</span>
              <span className="font-mono text-on-surface/70 text-sm tabular-nums shrink-0 w-12 text-right">{row.totalScore}p</span>
              {advancing ? <Icon name="trending_up" size={16} className="text-tertiary shrink-0" /> : null}
            </div>
          );
        })}
      </div>
      {open ? (
        <div className="space-y-2 mt-4 pt-4 border-t border-outline-variant/10">
          <div className="font-label text-xs uppercase tracking-widest text-on-surface/40 mb-2">Lobbies (single round-robin)</div>
          {group.lobbies.map(function(lobby, i) {
            var a = teamLookup[lobby.teamA];
            var b = teamLookup[lobby.teamB];
            if (!a || !b) return null;
            var aRow = lobby.outcome.teams.filter(function(t) { return t.teamId === a.teamId; })[0];
            var bRow = lobby.outcome.teams.filter(function(t) { return t.teamId === b.teamId; })[0];
            var isOpen = drill === i;
            return (
              <div key={i}>
                <button onClick={function() { setDrill(isOpen ? null : i); }} className="w-full text-left">
                  <div className="flex items-center gap-2 p-2 bg-surface-container-lowest border border-outline-variant/10 rounded hover:border-primary/30 transition-colors">
                    <span className="font-mono text-xs text-on-surface/40 w-12 shrink-0">R{lobby.round}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                      <div className={'flex items-center gap-2 ' + (lobby.outcome.winnerTeamId === a.teamId ? 'text-primary' : 'text-on-surface/70')}>
                        <span className="text-xs font-semibold truncate">{a.name}</span>
                        <span className="font-mono text-xs tabular-nums">{aRow ? aRow.score : 0}</span>
                      </div>
                      <div className={'flex items-center gap-2 ' + (lobby.outcome.winnerTeamId === b.teamId ? 'text-primary' : 'text-on-surface/70')}>
                        <span className="text-xs font-semibold truncate">{b.name}</span>
                        <span className="font-mono text-xs tabular-nums">{bRow ? bRow.score : 0}</span>
                      </div>
                    </div>
                    <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={16} className="text-on-surface/40 shrink-0" />
                  </div>
                </button>
                {isOpen ? <LobbyDrillIn sim={lobby} teamA={a} teamB={b} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}

function MatchCard(props) {
  var match = props.match;
  var userTeamId = props.userTeamId;
  var bestOf = props.bestOf;
  var [open, setOpen] = useState(false);
  var [drillIdx, setDrillIdx] = useState(null);

  var aWins = (match.series.score && match.series.score[match.a.teamId]) || 0;
  var bWins = (match.series.score && match.series.score[match.b.teamId]) || 0;
  var aIsWinner = match.winner && match.winner.teamId === match.a.teamId;
  var bIsWinner = match.winner && match.winner.teamId === match.b.teamId;
  var aIsUser = match.a.teamId === userTeamId;
  var bIsUser = match.b.teamId === userTeamId;

  return (
    <Panel padding="default" elevation="elevated" className={(aIsUser || bIsUser) ? 'ring-1 ring-tertiary/40' : ''}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-label text-xs uppercase tracking-widest text-on-surface/40">{match.matchId}</span>
        <Tag variant="ghost" size="xs">Bo{bestOf}</Tag>
      </div>
      <div className="space-y-1 mb-3">
        <TeamRow team={match.a} isWinner={aIsWinner} isUser={aIsUser} score={aWins} />
        <TeamRow team={match.b} isWinner={bIsWinner} isUser={bIsUser} score={bWins} />
      </div>
      <Btn variant="ghost" size="sm" className="w-full" icon={open ? 'expand_less' : 'expand_more'} onClick={function() { setOpen(!open); }}>
        {open ? 'Hide games' : ('Show ' + match.series.games.length + ' game' + (match.series.games.length === 1 ? '' : 's'))}
      </Btn>
      {open ? (
        <div className="mt-3 space-y-2 pt-3 border-t border-outline-variant/10">
          {match.series.games.map(function(game, i) {
            var aRow = game.outcome.teams.filter(function(t) { return t.teamId === match.a.teamId; })[0];
            var bRow = game.outcome.teams.filter(function(t) { return t.teamId === match.b.teamId; })[0];
            var isOpen = drillIdx === i;
            return (
              <div key={i}>
                <button onClick={function() { setDrillIdx(isOpen ? null : i); }} className="w-full text-left">
                  <div className="flex items-center gap-2 p-2 bg-surface-container-lowest border border-outline-variant/10 rounded text-xs hover:border-primary/30">
                    <span className="font-mono text-on-surface/40 w-10">G{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                      <span className={'truncate ' + (game.outcome.winnerTeamId === match.a.teamId ? 'text-primary font-semibold' : 'text-on-surface/60')}>{match.a.tag} {aRow ? aRow.score : 0}</span>
                      <span className={'truncate ' + (game.outcome.winnerTeamId === match.b.teamId ? 'text-primary font-semibold' : 'text-on-surface/60')}>{match.b.tag} {bRow ? bRow.score : 0}</span>
                    </div>
                    <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={14} className="text-on-surface/40" />
                  </div>
                </button>
                {isOpen ? <LobbyDrillIn sim={game} teamA={match.a} teamB={match.b} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}

function ChampionBanner(props) {
  var champion = props.champion;
  var isUser = props.isUser;
  if (!champion) return null;
  return (
    <Panel padding="spacious" elevation="elevated" accent="gold" glow>
      <div className="text-center">
        <Icon name="trophy" size={56} className="text-primary" />
        <div className="font-label text-xs uppercase tracking-widest text-primary/80 mt-2">Champion</div>
        <h2 className="font-display text-4xl text-on-surface uppercase mt-2 mb-1">{champion.name}</h2>
        <div className="font-mono text-on-surface/60 text-sm">[{champion.tag}] - {champion.region}</div>
        {isUser ? <div className="mt-4 text-tertiary font-label text-sm uppercase tracking-widest">Your team won.</div> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {champion.members.filter(function(m) { return m.role !== 'sub'; }).map(function(m) {
            return (
              <Tag key={m.id} variant={m.role === 'captain' ? 'gold' : 'tertiary'} size="md">
                {m.name}{m.role === 'captain' ? ' (C)' : ''}
              </Tag>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

export default function SquadsBracket(props) {
  var run = props.run; // runFullSquadsTournament result
  var meta = props.meta;
  var userTeamId = props.userTeamId;
  var onRestart = props.onRestart;

  var [tab, setTab] = useState('groups');

  if (!run) return null;
  var teams = run.teams;
  var champion = run.champion;
  var isUserChampion = champion && champion.teamId === userTeamId;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Tag variant="primary" size="md">Live (sim)</Tag>
          <h1 className="font-display text-4xl text-on-surface uppercase mt-3">{meta ? meta.name : 'Squads Tournament'}</h1>
          <p className="text-on-surface/60 text-sm mt-1">
            16 teams - {meta ? meta.format.group : 'Bo1'} groups -> {meta ? meta.format.quarter : 'Bo3'} QF -> {meta ? meta.format.final : 'Bo5'} Final
          </p>
        </div>
        <div className="flex gap-2">
          {onRestart ? <Btn variant="ghost" icon="refresh" onClick={onRestart}>Restart sim</Btn> : null}
          <Btn variant="secondary" icon="dashboard" onClick={function() { setTab(tab === 'groups' ? 'playoffs' : 'groups'); }}>
            View {tab === 'groups' ? 'playoffs' : 'groups'}
          </Btn>
        </div>
      </div>

      {/* Tab rail */}
      <div className="flex gap-2 border-b border-outline-variant/10">
        {[
          { id: 'groups', label: 'Group stage', count: 4 },
          { id: 'playoffs', label: 'Playoffs', count: 7 }
        ].map(function(t) {
          var active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={function() { setTab(t.id); }}
              className={'px-4 py-3 font-label text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ' + (active ? 'border-primary text-primary' : 'border-transparent text-on-surface/50 hover:text-on-surface')}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'groups' ? (
        <div className="grid md:grid-cols-2 gap-6">
          {run.groupStage.groups.map(function(group) {
            return <GroupCard key={group.groupId} group={group} teams={teams} userTeamId={userTeamId} />;
          })}
          <div className="md:col-span-2">
            <Panel padding="default" elevation="default">
              <div className="flex items-center gap-3">
                <Icon name="info" size={20} className="text-tertiary shrink-0" />
                <div className="text-sm text-on-surface/70">
                  Top 2 from each group advance to playoffs. Standings sort by lobby wins, then total score, then 1st-place finishes.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'playoffs' ? (
        <div className="space-y-8">
          <div>
            <div className="font-label text-xs uppercase tracking-widest text-on-surface/40 mb-3">Quarterfinals - Bo3</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {run.playoffs.quarters.map(function(m) {
                return <MatchCard key={m.matchId} match={m} userTeamId={userTeamId} bestOf={3} />;
              })}
            </div>
          </div>

          <div>
            <div className="font-label text-xs uppercase tracking-widest text-on-surface/40 mb-3">Semifinals - Bo3</div>
            <div className="grid md:grid-cols-2 gap-4">
              {run.playoffs.semis.map(function(m) {
                return <MatchCard key={m.matchId} match={m} userTeamId={userTeamId} bestOf={3} />;
              })}
            </div>
          </div>

          <div>
            <div className="font-label text-xs uppercase tracking-widest text-on-surface/40 mb-3">Grand Final - Bo5</div>
            <div className="grid md:grid-cols-2 gap-4">
              <MatchCard match={run.playoffs.final} userTeamId={userTeamId} bestOf={5} />
              <ChampionBanner champion={champion} isUser={isUserChampion} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
