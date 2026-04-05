/**
 * Local tournament simulation - activate with ?sim=1 in URL
 * Creates a fake 64-player tournament in "live" phase with 8 lobbies
 * Does NOT touch Supabase or any remote data
 */
import { SEED, PTS, RANKS, RCOLS } from './constants.js'
import { buildLobbies } from './tournament.js'

var SIM_ACTIVE = typeof window !== 'undefined' && window.location.search.indexOf('sim=1') > -1

export function isSimulation() { return SIM_ACTIVE }

// Generate 64 fake players (24 from SEED + 40 generated)
function generatePlayers() {
  var players = SEED.map(function(p) {
    return Object.assign({}, p, { checkedIn: true, riotId: p.name + '#' + (p.region || 'EUW') })
  })

  var extraNames = [
    'ShadowStep', 'BlazeFury', 'ArcticWolf', 'NeonPulse', 'ThunderBolt',
    'MysticRune', 'SteelClaw', 'CosmicDust', 'FlameHeart', 'FrostBite',
    'StormEagle', 'DarkViper', 'GoldenKoi', 'SilverFang', 'RubyStrike',
    'JadeDragon', 'OnyxShade', 'CrimsonTide', 'AzureKnight', 'EmberGlow',
    'PhantomAce', 'TitanForge', 'LunarEcho', 'SolarFlare', 'ZenithPeak',
    'NovaBurst', 'VortexRing', 'QuartzEdge', 'PrismShot', 'ObsidianRex',
    'CedarWind', 'MarbleDust', 'CoralReef', 'AmberWave', 'IndigoMist',
    'PearlDive', 'TopazGlint', 'OpalShine', 'GarnetFlash', 'SapphireRay'
  ]

  var rankPool = ['Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Diamond', 'Platinum', 'Gold']

  for (var i = 0; i < 40; i++) {
    var rank = rankPool[i % rankPool.length]
    var pts = Math.max(5, Math.floor(Math.random() * 400) + 20)
    var region = i % 3 === 0 ? 'NA' : 'EUW'
    players.push({
      id: 100 + i,
      name: extraNames[i],
      riotId: extraNames[i] + '#' + region,
      rank: rank,
      region: region,
      pts: pts,
      wins: Math.floor(Math.random() * 5),
      top4: Math.floor(Math.random() * 12),
      games: Math.floor(Math.random() * 30) + 4,
      checkedIn: true
    })
  }

  return players
}

// Build the full simulated state
// Seeded random for deterministic sim (same results on each reload)
var _simSeed = 42
function simRandom() {
  _simSeed = (_simSeed * 16807 + 0) % 2147483647
  return (_simSeed - 1) / 2147483646
}

// Deterministic shuffle using seeded random
function seededShuffle(arr) {
  var a = arr.slice()
  for (var j = a.length - 1; j > 0; j--) {
    var k = Math.floor(simRandom() * (j + 1))
    var tmp = a[j]; a[j] = a[k]; a[k] = tmp
  }
  return a
}

// Generate placements with optional bias (lower number = better placement for biased player)
function randomPlacementsSeeded(lobbyPlayers, biasPlayerId) {
  var placements = []
  for (var i = 1; i <= lobbyPlayers.length; i++) placements.push(i)
  placements = seededShuffle(placements)
  var result = {}
  for (var m = 0; m < lobbyPlayers.length; m++) {
    result[String(lobbyPlayers[m].id)] = placements[m]
  }
  // Bias: give the target player a top-4 placement if they got unlucky
  if (biasPlayerId && result[String(biasPlayerId)] > 4) {
    var bestIdx = null
    var bestPlace = 9
    for (var key in result) {
      if (result[key] < bestPlace && key !== String(biasPlayerId)) {
        bestPlace = result[key]
        bestIdx = key
      }
    }
    if (bestIdx) {
      var tmp = result[bestIdx]
      result[bestIdx] = result[String(biasPlayerId)]
      result[String(biasPlayerId)] = tmp
    }
  }
  return result
}

export function buildSimulationState() {
  if (!SIM_ACTIVE) return null
  _simSeed = 42 // reset for deterministic results

  var allPlayers = generatePlayers()
  var lobbies = buildLobbies(allPlayers, 'snake', 8)

  // Find Levitate's ID for bias
  var levitateId = null
  allPlayers.forEach(function(p) { if (p.name === 'Levitate') levitateId = p.id })

  // Find which lobby Levitate is in
  var levitateLobbyIdx = -1
  lobbies.forEach(function(lobby, li) {
    lobby.forEach(function(p) { if (p.id === levitateId) levitateLobbyIdx = li })
  })

  var completedRounds = 4
  var gameResults = []
  var roundHistory = {}
  var playerMap = {}
  allPlayers.forEach(function(p) { playerMap[String(p.id)] = p })

  // Generate results for rounds 1-4
  for (var r = 1; r <= completedRounds; r++) {
    var roundPlacements = {}
    for (var i = 0; i < lobbies.length; i++) {
      var bias = (i === levitateLobbyIdx) ? levitateId : null
      roundPlacements[i] = randomPlacementsSeeded(lobbies[i], bias)
    }
    roundHistory[r] = roundPlacements

    for (var li = 0; li < lobbies.length; li++) {
      for (var pi = 0; pi < lobbies[li].length; pi++) {
        var player = lobbies[li][pi]
        var pid = String(player.id)
        if (roundPlacements[li] && roundPlacements[li][pid]) {
          var place = roundPlacements[li][pid]
          gameResults.push({
            tournament_id: 'sim-64p',
            round_number: r,
            game_number: r,
            player_id: player.id,
            placement: place,
            points: PTS[place] || 0,
            is_dnp: false
          })
        }
      }
    }
  }

  // Stamp clashHistory onto players from all completed rounds
  gameResults.forEach(function(gr) {
    var p = playerMap[String(gr.player_id)]
    if (!p) return
    if (!p.clashHistory) p.clashHistory = []
    p.clashHistory.push({
      round: gr.round_number,
      place: gr.placement,
      placement: gr.placement,
      pts: gr.points,
      clashId: 'sim-64p',
      bonusPts: 0
    })
  })

  // Apply cut line after round 4: eliminate bottom players, keeping lobbies even (multiples of 8)
  // Sort all players by total points descending, then cut to nearest multiple of 8
  var ranked = allPlayers.map(function(p) {
    var totalPts = 0
    ;(p.clashHistory || []).forEach(function(h) {
      if (h.clashId === 'sim-64p') totalPts += (h.pts || 0)
    })
    return { player: p, totalPts: totalPts }
  }).sort(function(a, b) { return b.totalPts - a.totalPts })

  // Keep top N players where N is the largest multiple of 8 that's <= 75% of total (target ~48 from 64)
  var targetSurvivors = Math.floor(allPlayers.length * 0.75)
  var survivorCount = Math.floor(targetSurvivors / 8) * 8
  if (survivorCount < 8) survivorCount = 8

  var cutLine = ranked.length > survivorCount ? ranked[survivorCount - 1].totalPts : 0
  var survivingIds = []
  var eliminatedIds = []
  ranked.forEach(function(entry, idx) {
    if (idx < survivorCount) {
      survivingIds.push(String(entry.player.id))
    } else {
      eliminatedIds.push(String(entry.player.id))
      entry.player.checkedIn = false
      entry.player.eliminated = true
    }
  })

  // Store original lobbies for past round results viewing
  var roundLobbies = {}
  for (var rl = 1; rl <= completedRounds; rl++) {
    roundLobbies[rl] = lobbies.map(function(lobby) {
      return lobby.map(function(p) { return {id: p.id, name: p.name, rank: p.rank, riotId: p.riotId} })
    })
  }

  // Rebuild lobbies from surviving players only for round 5
  var survivingPlayers = allPlayers.filter(function(p) { return !p.eliminated })
  var newLobbies = buildLobbies(survivingPlayers, 'snake', 8)

  var savedLobbies = newLobbies.map(function(lobby) {
    return lobby.map(function(p) { return p.id })
  })

  var tournamentState = {
    phase: 'live',
    round: 5,
    totalGames: 6,
    clashId: 'sim-64p',
    clashName: 'Simulated Clash (64 Players)',
    clashDate: new Date().toISOString().slice(0, 10),
    clashTimestamp: new Date(Date.now() - 3600000).toISOString(),
    lobbies: newLobbies,
    savedLobbies: savedLobbies,
    lockedLobbies: [],
    lockedPlacements: {},
    roundHistory: roundHistory,
    roundLobbies: roundLobbies,
    checkedInIds: survivingIds,
    registeredIds: allPlayers.map(function(p) { return String(p.id) }),
    eliminatedIds: eliminatedIds,
    waitlistIds: [],
    maxPlayers: 64,
    seedAlgo: 'snake',
    cutLine: cutLine,
    cutAfterGame: 4,
    dbTournamentId: null,
    format: 'competitive'
  }

  return {
    tournamentState: tournamentState,
    players: allPlayers,
    gameResults: gameResults
  }
}
