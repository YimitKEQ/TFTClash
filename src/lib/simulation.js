/**
 * Local tournament simulation - activate with ?sim=1 in URL
 * Creates a fake 128-player tournament mid-round-2 with 16 lobbies
 * Does NOT touch Supabase or any remote data
 */
import { SEED, PTS, RANKS, RCOLS } from './constants.js'
import { buildLobbies } from './tournament.js'

var SIM_ACTIVE = import.meta.env.DEV && typeof window !== 'undefined' && window.location.search.indexOf('sim=1') > -1

function getSimKind() {
  if (typeof window === 'undefined') return 'season'
  var m = window.location.search.match(/[?&]kind=([a-z]+)/i)
  return m ? m[1].toLowerCase() : 'season'
}

export function isSimulation() { return SIM_ACTIVE }
export function isCustomSim() { return SIM_ACTIVE && getSimKind() === 'custom' }

var TARGET_PLAYERS = 128

// Generate 128 fake players (24 from SEED + 104 generated)
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
    'PearlDive', 'TopazGlint', 'OpalShine', 'GarnetFlash', 'SapphireRay',
    'ViperFang', 'OmegaPulse', 'NebulaCore', 'DraconisVex', 'AstralWyrm',
    'GraniteMaul', 'IronVault', 'ChromeKnight', 'MidnightSky', 'EclipseRay',
    'BronzeFist', 'CopperSpear', 'GlacierEdge', 'CinderAsh', 'TempestRoar',
    'ZephyrDance', 'MagmaCore', 'TidalCrash', 'SwiftQuiver', 'BoldStrike',
    'ValorBlade', 'NobleHunt', 'RogueShade', 'SilentEcho', 'WildSpirit',
    'DuskBringer', 'DawnHerald', 'TwilightVow', 'StormCaller', 'SunPiercer',
    'MoonWarden', 'StarChaser', 'AbyssWalker', 'SkyShatter', 'EarthRender',
    'FireBrand', 'WaterWeaver', 'WindRider', 'BoneCrusher', 'BloodMoon',
    'IceLance', 'ShadowDancer', 'LightBearer', 'NightOwl', 'DayBreaker',
    'GraveDigger', 'SpellSinger', 'RuneScribe', 'ChaosBringer', 'OrderKeeper',
    'PoisonDart', 'VenomKiss', 'PlagueDoctor', 'AshBringer', 'CinderHeart',
    'SteelMind', 'GlassCannon', 'MarbleHeart', 'CrystalEye', 'GoldenSword',
    'SilverArrow', 'BronzeShield', 'IronWill', 'GhostFire', 'SoulRender',
    'VoidPiercer', 'SkyForger', 'StoneShaper'
  ]

  var rankPool = ['Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Diamond', 'Platinum', 'Gold']
  var needed = TARGET_PLAYERS - players.length

  for (var i = 0; i < needed; i++) {
    var rank = rankPool[i % rankPool.length]
    var pts = Math.max(5, Math.floor(Math.random() * 400) + 20)
    var region = i % 3 === 0 ? 'NA' : 'EUW'
    var name = extraNames[i] || ('Player' + (i + 1))
    players.push({
      id: 100 + i,
      name: name,
      riotId: name + '#' + region,
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

// Fake custom/flash tournament records to display on /events/tournaments in sim mode.
// Matches the shape the TournamentsTab expects from supabase('tournaments').
export function buildSimTournaments() {
  if (!SIM_ACTIVE) return []
  var nowIso = new Date(Date.now() + 86400000 * 3).toISOString() // 3 days out
  var liveIso = new Date(Date.now() - 1800000).toISOString() // 30m ago
  return [
    {
      id: 'sim-custom-1',
      name: 'Saturday Night Showdown',
      type: 'flash_tournament',
      phase: 'registration',
      date: nowIso,
      region: 'EU',
      max_players: 64,
      round_count: 4,
      seeding_method: 'snake',
      prize_pool_json: [
        { placement: 1, prize: '$200' },
        { placement: 2, prize: '$100' },
        { placement: 3, prize: '$50' }
      ],
      host_profile_id: null
    },
    {
      id: 'sim-custom-2',
      name: 'Iron Tactics Cup',
      type: 'flash_tournament',
      phase: 'in_progress',
      date: liveIso,
      region: 'EU',
      max_players: 32,
      round_count: 3,
      seeding_method: 'random',
      prize_pool_json: [
        { placement: 1, prize: '$500' },
        { placement: 2, prize: '$250' },
        { placement: 3, prize: '$100' }
      ],
      host_profile_id: null
    },
    {
      id: 'sim-custom-3',
      name: 'Homies Brawl Vol. 4',
      type: 'flash_tournament',
      phase: 'check_in',
      date: nowIso,
      region: 'NA',
      max_players: 16,
      round_count: 3,
      seeding_method: 'snake',
      prize_pool_json: [
        { placement: 1, prize: 'Bragging Rights' }
      ],
      host_profile_id: null
    }
  ]
}

export function buildSimRegCounts() {
  if (!SIM_ACTIVE) return {}
  return {
    'sim-custom-1': 41,
    'sim-custom-2': 28,
    'sim-custom-3': 9
  }
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

  var completedRounds = 1
  var gameResults = []
  var roundHistory = {}
  var playerMap = {}
  allPlayers.forEach(function(p) { playerMap[String(p.id)] = p })

  // Generate results for round 1 only
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
            tournament_id: 'sim-128p',
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

  // Stamp clashHistory onto players from completed rounds
  gameResults.forEach(function(gr) {
    var p = playerMap[String(gr.player_id)]
    if (!p) return
    if (!p.clashHistory) p.clashHistory = []
    p.clashHistory.push({
      round: gr.round_number,
      place: gr.placement,
      placement: gr.placement,
      pts: gr.points,
      clashId: 'sim-128p',
      bonusPts: 0
    })
  })

  // Store original lobbies for past round results viewing
  var roundLobbies = {}
  for (var rl = 1; rl <= completedRounds; rl++) {
    roundLobbies[rl] = lobbies.map(function(lobby) {
      return lobby.map(function(p) { return {id: p.id, name: p.name, rank: p.rank, riotId: p.riotId} })
    })
  }

  // No cut line yet (cut happens after round 4). Round 2 lobbies are reseeded snake-style by current standings.
  var rankedAfterR1 = allPlayers.map(function(p) {
    var totalPts = 0
    ;(p.clashHistory || []).forEach(function(h) {
      if (h.clashId === 'sim-128p') totalPts += (h.pts || 0)
    })
    return Object.assign({}, p, { _seedPts: totalPts })
  }).sort(function(a, b) { return b._seedPts - a._seedPts })

  var newLobbies = buildLobbies(rankedAfterR1, 'snake', 8)
  var savedLobbies = newLobbies.map(function(lobby) {
    return lobby.map(function(p) { return p.id })
  })

  var checkedInIds = allPlayers.map(function(p) { return String(p.id) })
  var registeredIds = checkedInIds.slice()

  var kind = getSimKind()
  var isCustom = kind === 'custom'

  var tournamentState = {
    phase: 'live',
    round: 2,
    totalGames: isCustom ? 4 : 6,
    clashId: isCustom ? 'sim-custom-2' : 'sim-128p',
    clashName: isCustom ? 'Iron Tactics Cup' : 'Simulated Clash (128 Players)',
    tournamentType: isCustom ? 'custom' : 'season_clash',
    clashDate: new Date().toISOString().slice(0, 10),
    clashTimestamp: new Date(Date.now() - 1800000).toISOString(),
    lobbies: newLobbies,
    savedLobbies: savedLobbies,
    lockedLobbies: [],
    lockedPlacements: {},
    roundHistory: roundHistory,
    roundLobbies: roundLobbies,
    checkedInIds: checkedInIds,
    registeredIds: registeredIds,
    eliminatedIds: [],
    waitlistIds: [],
    maxPlayers: TARGET_PLAYERS,
    seedAlgo: 'snake',
    cutLine: 0,
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
