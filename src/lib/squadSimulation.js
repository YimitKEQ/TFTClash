/**
 * 4v4 Squads simulation - mock data factory.
 * No DB writes. Deterministic via seeded RNG so the user sees the same result on reload.
 */
import { SEED } from './constants.js';
import { snakeSeedTeams, scoreLobby, buildGroupRoundRobin, aggregateTeamStandings, seriesWinner } from './squad.js';

// ─── Seeded RNG ──────────────────────────────────────────────────────────────

var _seed = 1337;
export function resetSimSeed(s) { _seed = (typeof s === 'number') ? s : 1337; }
function rng() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ─── Team rosters ────────────────────────────────────────────────────────────

var EXTRA_NAMES = [
  'ShadowStep', 'BlazeFury', 'ArcticWolf', 'NeonPulse', 'ThunderBolt',
  'MysticRune', 'SteelClaw', 'CosmicDust', 'FlameHeart', 'FrostBite',
  'StormEagle', 'DarkViper', 'GoldenKoi', 'SilverFang', 'RubyStrike',
  'JadeDragon', 'OnyxShade', 'CrimsonTide', 'AzureKnight', 'EmberGlow',
  'PhantomAce', 'TitanForge', 'LunarEcho', 'SolarFlare', 'ZenithPeak',
  'NovaBurst', 'VortexRing', 'QuartzEdge', 'PrismShot', 'ObsidianRex',
  'CedarWind', 'MarbleDust', 'CoralReef', 'AmberWave', 'IndigoMist',
  'PearlDive', 'TopazGlint', 'OpalShine', 'GarnetFlash', 'SapphireRay',
  'ViperFang', 'OmegaPulse', 'NebulaCore', 'DraconisVex', 'AstralWyrm',
  'GraniteMaul', 'IronVault', 'ChromeKnight', 'MidnightSky', 'EclipseRay',
  'BronzeFist', 'CopperSpear', 'GlacierEdge', 'CinderAsh', 'TempestRoar',
  'ZephyrDance', 'MagmaCore', 'TidalCrash', 'SwiftQuiver', 'BoldStrike',
  'ValorBlade', 'NobleHunt', 'RogueShade', 'SilentEcho', 'WildSpirit'
];

var TEAM_NAMES = [
  { name: 'Homies United',      tag: 'HOM' },
  { name: 'Void Riders',        tag: 'VOID' },
  { name: 'Crystal Spire',      tag: 'CRYS' },
  { name: 'Iron Wolves',        tag: 'IRON' },
  { name: 'Sunset Tactics',     tag: 'SUN' },
  { name: 'Hexcore Legion',     tag: 'HEX' },
  { name: 'Nightfall Squad',    tag: 'NF' },
  { name: 'Ember Reavers',      tag: 'EMB' },
  { name: 'Lunar Tide',         tag: 'LT' },
  { name: 'Storm Vanguard',     tag: 'STR' },
  { name: 'Aether Drift',       tag: 'AE' },
  { name: 'Glacier Knights',    tag: 'GLK' },
  { name: 'Zephyr Cult',        tag: 'ZPH' },
  { name: 'Obsidian Reign',     tag: 'OBS' },
  { name: 'Solar Wraiths',      tag: 'SW' },
  { name: 'Twilight Pact',      tag: 'TWP' }
];

var RANK_POOL = ['Diamond', 'Master', 'Master', 'Grandmaster', 'Diamond', 'Platinum', 'Master', 'Diamond'];

function makePlayer(id, name, opts) {
  opts = opts || {};
  var rank = opts.rank || RANK_POOL[Math.floor(rng() * RANK_POOL.length)];
  var region = opts.region || 'EUW';
  return {
    id: id,
    playerId: id,
    name: name,
    rank: rank,
    region: region,
    riotId: name + '#' + region,
    pts: opts.pts != null ? opts.pts : Math.floor(rng() * 800) + 100,
    wins: Math.floor(rng() * 10),
    top4: Math.floor(rng() * 25),
    games: Math.floor(rng() * 40) + 10
  };
}

function makeTeam(idx, captain, members, opts) {
  opts = opts || {};
  var preset = TEAM_NAMES[idx] || { name: 'Team ' + (idx + 1), tag: 'T' + (idx + 1) };
  var allMembers = [{ ...captain, role: 'captain' }].concat(
    members.map(function(m) { return { ...m, role: 'main' }; })
  );
  if (opts.sub) allMembers.push({ ...opts.sub, role: 'sub' });
  var seedScore = allMembers.reduce(function(acc, m) { return acc + (m.pts || 0); }, 0);
  return {
    teamId: 'team-' + (idx + 1),
    name: preset.name,
    tag: preset.tag,
    region: captain.region || 'EUW',
    captainId: captain.id,
    members: allMembers,
    seedScore: seedScore,
    createdAt: new Date(Date.now() - (idx + 1) * 86400000).toISOString()
  };
}

// ─── Build the 16-team field ─────────────────────────────────────────────────

export function buildSquadField() {
  resetSimSeed(1337);

  // Team 1 = Homies United (Levitate's team) - pulls from SEED homies
  var homies = SEED.slice(0, 9); // ids 1-9 are the homies per CLAUDE.md
  var captain = homies[0];       // Levitate
  var teams = [];
  teams.push(makeTeam(0, captain, [homies[1], homies[2], homies[3]], { sub: homies[4] }));

  // Teams 2-16: generated rosters from EXTRA_NAMES
  var nextId = 100;
  var nameIdx = 0;
  for (var t = 1; t < 16; t++) {
    var members = [];
    for (var m = 0; m < 5; m++) {
      var nm = EXTRA_NAMES[nameIdx++] || ('Player' + nextId);
      members.push(makePlayer(nextId++, nm, { region: t % 4 === 0 ? 'NA' : 'EUW' }));
    }
    teams.push(makeTeam(t, members[0], [members[1], members[2], members[3]], { sub: members[4] }));
  }

  return teams;
}

// ─── Lobby simulation ────────────────────────────────────────────────────────

// Build a lobby payload for scoreLobby() given two teams. Pulls each team's
// 4 main/captain members (subs sit out by default).
function buildLobbyPayload(teamA, teamB) {
  var actives = function(team) {
    return team.members
      .filter(function(m) { return m.role === 'captain' || m.role === 'main'; })
      .slice(0, 4)
      .map(function(m) { return { playerId: m.id, name: m.name, teamId: team.teamId }; });
  };
  return { players: actives(teamA).concat(actives(teamB)) };
}

// Generate placements 1..8 for the 8 players in the lobby. Optional bias
// toward a specific team gives that team better expected placements.
function rollPlacements(lobby, biasTeamId) {
  var slots = [1, 2, 3, 4, 5, 6, 7, 8];
  var picks = shuffle(slots);
  var placements = {};
  lobby.players.forEach(function(p, i) { placements[p.playerId] = picks[i]; });
  if (biasTeamId) {
    // Swap a worst placement on bias team with a best from non-bias team to nudge.
    var biasPids = lobby.players.filter(function(p) { return p.teamId === biasTeamId; }).map(function(p) { return p.playerId; });
    var otherPids = lobby.players.filter(function(p) { return p.teamId !== biasTeamId; }).map(function(p) { return p.playerId; });
    var worstBias = biasPids.reduce(function(acc, id) { return placements[id] > placements[acc] ? id : acc; }, biasPids[0]);
    var bestOther = otherPids.reduce(function(acc, id) { return placements[id] < placements[acc] ? id : acc; }, otherPids[0]);
    if (placements[worstBias] > placements[bestOther]) {
      var tmp = placements[worstBias];
      placements[worstBias] = placements[bestOther];
      placements[bestOther] = tmp;
    }
  }
  return placements;
}

// Simulate a single lobby outcome between two teams. Returns the scoreLobby() result
// plus the raw placements (for replay/inspection).
export function simulateLobby(teamA, teamB, opts) {
  opts = opts || {};
  var lobby = buildLobbyPayload(teamA, teamB);
  var placements = rollPlacements(lobby, opts.biasTeamId || null);
  var outcome = scoreLobby(lobby, placements, opts.scaleId || 'standard');
  return {
    lobby: lobby,
    placements: placements,
    outcome: outcome,
    teamA: teamA.teamId,
    teamB: teamB.teamId
  };
}

// Simulate a Bo1/Bo3/Bo5 series between two teams.
export function simulateSeries(teamA, teamB, bestOf, opts) {
  opts = opts || {};
  var games = [];
  for (var g = 0; g < bestOf; g++) {
    var gameOpts = { scaleId: opts.scaleId, biasTeamId: opts.biasTeamId };
    var sim = simulateLobby(teamA, teamB, gameOpts);
    games.push(sim);
    var sw = seriesWinner(games.map(function(s) { return s.outcome; }), bestOf);
    if (sw) return { games: games, winner: sw.winnerTeamId, decidedAt: sw.decidedAtLobby, score: sw.score };
  }
  var final = seriesWinner(games.map(function(s) { return s.outcome; }), bestOf);
  return { games: games, winner: final ? final.winnerTeamId : null, decidedAt: games.length, score: final ? final.score : {} };
}

// ─── Group stage simulation ──────────────────────────────────────────────────

// Splits 16 teams into 4 groups of 4 via team-snake seeding, runs single
// round-robin Bo1 in each group, returns advancing teams (top 2 per group).
export function simulateGroupStage(allTeams, opts) {
  opts = opts || {};
  var lobbyCount = 4;
  var groupedSeeds = snakeSeedTeams(allTeams, lobbyCount);
  // Each "lobby" from snakeSeedTeams gives us a 4-team group.
  var groups = groupedSeeds.map(function(group, gi) {
    var rounds = buildGroupRoundRobin(group);
    var lobbyOutcomes = [];
    rounds.forEach(function(round, ri) {
      round.forEach(function(pair) {
        var sim = simulateLobby(pair[0], pair[1], { scaleId: opts.scaleId, biasTeamId: opts.biasTeamId });
        lobbyOutcomes.push({
          round: ri + 1,
          teamA: pair[0].teamId,
          teamB: pair[1].teamId,
          ...sim
        });
      });
    });
    var standings = aggregateTeamStandings(lobbyOutcomes.map(function(o) { return o.outcome; }));
    return {
      groupId: 'G' + (gi + 1),
      teams: group,
      lobbies: lobbyOutcomes,
      standings: standings
    };
  });
  var advancing = [];
  groups.forEach(function(g) {
    var teamLookup = {};
    g.teams.forEach(function(t) { teamLookup[t.teamId] = t; });
    advancing.push(teamLookup[g.standings[0].teamId]);
    advancing.push(teamLookup[g.standings[1].teamId]);
  });
  return { groups: groups, advancing: advancing };
}

// ─── Playoff simulation ──────────────────────────────────────────────────────

// Single-elim Bo3 quarters/semis -> Bo5 grand final. Re-seeds top 8.
export function simulatePlayoffs(advancing, opts) {
  opts = opts || {};
  // Re-seed by group performance: simple approach, alternate group winners.
  var seeded = advancing.slice();
  var matches = {
    quarters: [
      { matchId: 'QF1', a: seeded[0], b: seeded[7] },
      { matchId: 'QF2', a: seeded[3], b: seeded[4] },
      { matchId: 'QF3', a: seeded[1], b: seeded[6] },
      { matchId: 'QF4', a: seeded[2], b: seeded[5] }
    ],
    semis: [],
    final: null
  };
  matches.quarters = matches.quarters.map(function(m) {
    var s = simulateSeries(m.a, m.b, 3, { scaleId: opts.scaleId });
    return { ...m, series: s, winner: s.winner === m.a.teamId ? m.a : m.b };
  });
  matches.semis = [
    { matchId: 'SF1', a: matches.quarters[0].winner, b: matches.quarters[1].winner },
    { matchId: 'SF2', a: matches.quarters[2].winner, b: matches.quarters[3].winner }
  ].map(function(m) {
    var s = simulateSeries(m.a, m.b, 3, { scaleId: opts.scaleId });
    return { ...m, series: s, winner: s.winner === m.a.teamId ? m.a : m.b };
  });
  matches.final = (function() {
    var m = { matchId: 'GF', a: matches.semis[0].winner, b: matches.semis[1].winner };
    var s = simulateSeries(m.a, m.b, 5, { scaleId: opts.scaleId });
    return { ...m, series: s, winner: s.winner === m.a.teamId ? m.a : m.b };
  })();
  return matches;
}

// Run a full tournament end-to-end. One call, returns everything needed for replay UI.
export function runFullSquadsTournament(opts) {
  opts = opts || {};
  resetSimSeed(opts.seed || 1337);
  var teams = buildSquadField();
  var groupStage = simulateGroupStage(teams, opts);
  var playoffs = simulatePlayoffs(groupStage.advancing, opts);
  return {
    teams: teams,
    groupStage: groupStage,
    playoffs: playoffs,
    champion: playoffs.final.winner
  };
}

// ─── Mock 4v4 tournament metadata ────────────────────────────────────────────

export function buildSquadsTournamentMeta() {
  return {
    id: 'sim-squads-1',
    name: 'TFT Clash Squads Open',
    type: 'squads_tournament',
    teamSize: 4,
    teamsPerLobby: 2,
    maxTeams: 16,
    subsAllowed: 2,
    pointsScale: 'standard',
    region: 'EU',
    date: new Date(Date.now() + 86400000 * 7).toISOString(),
    prizePool: [
      { placement: 1, prize: '\u20AC1,200 + Trophy' },
      { placement: 2, prize: '\u20AC600' },
      { placement: 3, prize: '\u20AC300' },
      { placement: 4, prize: '\u20AC150' }
    ],
    format: { group: 'Bo1', quarter: 'Bo3', semi: 'Bo3', final: 'Bo5' }
  };
}
