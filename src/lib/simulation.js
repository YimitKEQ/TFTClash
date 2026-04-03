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
    return Object.assign({}, p, { checkedIn: true })
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
    players.push({
      id: 100 + i,
      name: extraNames[i],
      rank: rank,
      region: i % 3 === 0 ? 'NA' : 'EUW',
      pts: pts,
      wins: Math.floor(Math.random() * 5),
      top4: Math.floor(Math.random() * 12),
      games: Math.floor(Math.random() * 30) + 4,
      checkedIn: true
    })
  }

  return players
}

// Generate random placements for a lobby (1-8, no duplicates)
function randomPlacements(lobbyPlayers) {
  var placements = []
  for (var i = 1; i <= lobbyPlayers.length; i++) placements.push(i)
  // Fisher-Yates shuffle
  for (var j = placements.length - 1; j > 0; j--) {
    var k = Math.floor(Math.random() * (j + 1))
    var tmp = placements[j]
    placements[j] = placements[k]
    placements[k] = tmp
  }
  var result = {}
  for (var m = 0; m < lobbyPlayers.length; m++) {
    result[String(lobbyPlayers[m].id)] = placements[m]
  }
  return result
}

// Build the full simulated state
export function buildSimulationState() {
  if (!SIM_ACTIVE) return null

  var allPlayers = generatePlayers()
  var lobbies = buildLobbies(allPlayers, 'snake', 8)

  // Generate results for game 1 (completed)
  var game1Placements = {}
  for (var i = 0; i < lobbies.length; i++) {
    game1Placements[i] = randomPlacements(lobbies[i])
  }

  // Build game_results array
  var gameResults = []
  for (var li = 0; li < lobbies.length; li++) {
    for (var pi = 0; pi < lobbies[li].length; pi++) {
      var player = lobbies[li][pi]
      var pid = String(player.id)
      if (game1Placements[li] && game1Placements[li][pid]) {
        var place1 = game1Placements[li][pid]
        gameResults.push({
          tournament_id: 'sim-64p',
          round_number: 1,
          game_number: 1,
          player_id: player.id,
          placement: place1,
          points: PTS[place1] || 0,
          is_dnp: false
        })
      }
    }
  }

  // Stamp clashHistory onto players from game 1 results
  var playerMap = {}
  allPlayers.forEach(function(p) { playerMap[String(p.id)] = p })

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

  // Build savedLobbies (array of arrays of player IDs)
  var savedLobbies = lobbies.map(function(lobby) {
    return lobby.map(function(p) { return p.id })
  })

  var allIds = allPlayers.map(function(p) { return String(p.id) })

  // Store per-round placement history so past rounds can be viewed
  var roundHistory = {
    1: game1Placements
  }

  var tournamentState = {
    phase: 'live',
    round: 2,
    totalGames: 6,
    clashId: 'sim-64p',
    clashName: 'Simulated Clash (64 Players)',
    clashDate: new Date().toISOString().slice(0, 10),
    clashTimestamp: new Date(Date.now() - 3600000).toISOString(),
    lobbies: lobbies,
    savedLobbies: savedLobbies,
    lockedLobbies: [],
    lockedPlacements: {},
    roundHistory: roundHistory,
    checkedInIds: allIds,
    registeredIds: allIds,
    waitlistIds: [],
    maxPlayers: 64,
    seedAlgo: 'snake',
    cutLine: 13,
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
