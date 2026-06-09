// Historical clash archive (display-only). These season-long clashes populate
// the Archive page's tournament history and each one expands into a full,
// generated final-standings sheet. Everything here is render-only: it never
// feeds the scoring engine, standings, Hall of Fame, or recaps.
//
// All players are EUW. Tournaments are champion-themed. No real pro/streamer
// handles are used; the filler pool is invented EUW-style summoner names.

function lobbies(n) { return Math.ceil(n / 8) }

var RAW = [
  { name: 'Aatrox Invitational',  date: '2026-01-10', winner: 'Levitate',    entries: 40,  topScore: 41, top3: ['Levitate', 'Uri', 'Ole'] },
  { name: 'Vex Open',             date: '2026-01-17', winner: 'Zounderkite', entries: 48,  topScore: 43, top3: ['Zounderkite', 'Wiwi', 'BingBing'] },
  { name: 'Zed Showdown',         date: '2026-01-24', winner: 'Uri',         entries: 48,  topScore: 44, top3: ['Uri', 'Levitate', 'Sybor'] },
  { name: 'Jhin Cup',             date: '2026-01-31', winner: 'Wiwi',        entries: 56,  topScore: 45, top3: ['Wiwi', 'Vlad', 'Zounderkite'] },
  { name: 'Morgana Masters',      date: '2026-02-07', winner: 'Levitate',    entries: 56,  topScore: 47, top3: ['Levitate', 'BingBing', 'Ivdim'] },
  { name: 'Sona Series',          date: '2026-02-14', winner: 'BingBing',    entries: 64,  topScore: 46, top3: ['BingBing', 'Ole', 'Uri'] },
  { name: 'Fiora Clash',          date: '2026-02-21', winner: 'Ole',         entries: 64,  topScore: 48, top3: ['Ole', 'Levitate', 'Ivdim'] },
  { name: 'Graves Gauntlet',      date: '2026-02-28', winner: 'Sybor',       entries: 72,  topScore: 49, top3: ['Sybor', 'Wiwi', 'Vlad'] },
  { name: 'Bard Brawl',           date: '2026-03-07', winner: 'Levitate',    entries: 80,  topScore: 50, top3: ['Levitate', 'Zounderkite', 'Wiwi'] },
  { name: 'Shen Open',            date: '2026-03-14', winner: 'Vlad',        entries: 80,  topScore: 49, top3: ['Vlad', 'Ivdim', 'BingBing'] },
  { name: 'Aurelion Sol Cup',     date: '2026-03-21', winner: 'Ivdim',       entries: 88,  topScore: 51, top3: ['Ivdim', 'Uri', 'Levitate'] },
  { name: 'Riven Rumble',         date: '2026-03-28', winner: 'Uri',         entries: 96,  topScore: 50, top3: ['Uri', 'Sybor', 'Ole'] },
  { name: 'Karma Classic',        date: '2026-04-04', winner: 'Ivdim',       entries: 96,  topScore: 52, top3: ['Ivdim', 'Levitate', 'Wiwi'] },
  { name: 'Kindred Cup',          date: '2026-04-11', winner: 'Zounderkite', entries: 104, topScore: 53, top3: ['Zounderkite', 'BingBing', 'Vlad'] },
  { name: 'Viktor Invitational',  date: '2026-04-18', winner: 'Levitate',    entries: 112, topScore: 56, top3: ['Levitate', 'Ole', 'Ivdim'] },
  { name: 'Samira Open',          date: '2026-04-25', winner: 'Wiwi',        entries: 104, topScore: 52, top3: ['Wiwi', 'Uri', 'Ole'] },
  { name: 'Diana Showdown',       date: '2026-05-02', winner: 'Vlad',        entries: 120, topScore: 53, top3: ['Vlad', 'Levitate', 'Sybor'] },
  { name: 'Blitzcrank Bash',      date: '2026-05-09', winner: 'BingBing',    entries: 120, topScore: 54, top3: ['BingBing', 'Zounderkite', 'Ole'] },
  { name: 'Xayah Open',           date: '2026-05-16', winner: 'Ole',         entries: 128, topScore: 55, top3: ['Ole', 'Wiwi', 'Vlad'] },
  { name: 'Aurora Championship',  date: '2026-05-23', winner: 'Levitate',    entries: 136, topScore: 58, top3: ['Levitate', 'Ivdim', 'Uri'] },
  { name: 'Pyke Cup',             date: '2026-05-30', winner: 'Sybor',       entries: 128, topScore: 54, top3: ['Sybor', 'BingBing', 'Vlad'] },
  { name: 'Galio Grand Finals',   date: '2026-06-06', winner: 'Zounderkite', entries: 144, topScore: 57, top3: ['Zounderkite', 'Levitate', 'Wiwi'] },
]

export var ARCHIVE_SEED = RAW.map(function (r, i) {
  return {
    id: 'seed-' + (i + 1),
    name: r.name,
    date: r.date,
    season: 'S1',
    winner: r.winner,
    champion: r.winner,
    entries: r.entries,
    players: r.entries,
    lobbies: lobbies(r.entries),
    topScore: r.topScore,
    top3: r.top3,
    seeded: true,
  }
})

// ── Standings generation ────────────────────────────────────────────────────
// Deterministic per tournament so the same sheet renders every time.

// Single region: this is a EUW circuit. Taglines stay EUW-consistent.
export var REGION = 'EUW'

var FORMATS = [
  'Points Threshold Cut',
  'Ladder to Top 8',
  'Group Stage into Finals',
  'Swiss into Top 8',
]

// Invented EUW-style summoner handles. Community regulars come first; the rest
// are plausible EUW ladder names (no real pros/streamers) so a 144-player field
// reads like a genuine public bracket.
var NAME_POOL = [
  'Levitate', 'Zounderkite', 'Uri', 'BingBing', 'Wiwi', 'Ole', 'Sybor', 'Ivdim', 'Vlad',
  'xPandaa', 'Nyxara', 'Draelyn', 'Korvath', 'Milkshaked', 'ProbablyAFK', 'Slowrolled', 'OneMoreGame',
  'BaronSteal', 'SmiteThief', 'RecallNow', 'BackdoorBob', 'SplitPushd', 'TiltedTom', 'Copiumm', 'Hopiumm',
  'EzClapd', 'FullSendd', 'ClutchOrKick', 'FourthAgain', 'BottomFrag', 'HardStuckd', 'FreeEloo', 'SoloQHero',
  'DuoDiffd', 'KarthusUlt', 'Pentaaaa', 'QuadraK', 'ZhonyaGod', 'StopwatchK', 'FleetFooty', 'DoranShieldd',
  'Tearstackd', 'ManaGodd', 'OOMagain', 'TeleportTop', 'IgniteFlash', 'BarrierSupp', 'CleanseCC', 'GhostWalkd',
  'RadiantRNG', 'AnvilOpener', 'RerollGremlin', 'FastEightt', 'LevelDiffd', 'EconomyGodd', 'GreedyRolld', 'AllInRolld',
  'PixelKnight', 'ShadowVeil', 'FrostByted', 'EmberZ', 'NebulaNine', 'QuasarX', 'VortexEU', 'PhantomR',
  'SpecterK', 'WraithMain', 'GoblinKingg', 'OrcSlayerr', 'DragonHoard', 'MysticManaa', 'RuneWeaver', 'SpellThiefd',
  'ArcaneBolt', 'ManaBurnn', 'SilentBlade', 'VenomFangg', 'IronWilld', 'SteelHeartt', 'GoldenAxee', 'SilverFangg',
  'BronzeStuck', 'EmeraldDream', 'SapphireEU', 'RubyRosee', 'AmethystK', 'ObsidianEdge', 'GraniteWall', 'MarbleMage',
  'CrimsonTide', 'AzureSkyy', 'VerdantLeaf', 'GoldenHourr', 'MidnightOwl', 'DawnPatroll', 'DuskBlade', 'TwilightZ',
  'EclipseEU', 'SolsticeK', 'EquinoxR', 'ZenithPeak', 'ApexHunter', 'OmegaWolff', 'AlphaStrike', 'GammaRayy',
  'DeltaForcee', 'SigmaGrind', 'ThetaWave', 'KappaPridee', 'LambdaCore', 'OmicronEU', 'UpsilonX', 'PsiOnicc',
  'PhiGolden', 'TauProtein', 'EtaCarinae', 'IotaOnee', 'DigitalDrift', 'NeonGhostt', 'CyberPunkd', 'GlitchKingg',
  'PixelPirate', 'RetroWavee', 'SynthRider', 'VaporTraill', 'LaserFocuss', 'TurboNerdd', 'MegaByteEU', 'KiloWattt',
  'BinaryStarr', 'QuantumLeapp', 'NullPointer', 'SegFaultt', 'StackOverflw', 'VoidPointer', 'RaceCondition', 'DeadLockd',
  'AsyncAwaitt', 'PromiseChain', 'CallbackHell', 'RecursionEU', 'CacheMissd', 'HeapSortt', 'QuickSortd', 'MergeConflict',
  'GitBlamee', 'ForcePushd', 'RebaseHell', 'CommitCrime', 'BranchOffd', 'StashPopp', 'CherryPickd', 'HotFixxer',
  'ColdBrewEU', 'EspressoShot', 'LatteArtt', 'FlatWhitee', 'CortadoK', 'MacchiatoM', 'RistrettoR', 'AmericanoA',
  'NitroBrew', 'BeanCounter', 'GrindFineEU', 'FrenchPressd', 'AeroPressd', 'PourOverP', 'ChemexC', 'MokaPott',
  'TurkishCoffee', 'IcedVanilla', 'CaramelDrizzle', 'PumpkinSpicEU', 'HazelnutHype', 'ToffeeNutt', 'GingerbreadG', 'PeppermintP',
  'ChaiLattee', 'MatchaMann', 'TaroBubblee', 'BobaKingg', 'BrownSugarBoba', 'OatMilkLatte', 'AlmondBreeze', 'CoconutCreamm',
  'MorningGankk', 'NoonRecall', 'EveningWardd', 'NightCarry', 'WeekendWarrior', 'DailyGrindd', 'RankedAnxiety', 'PromoSeries',
  'DemotionFear', 'WinStreakk', 'LossStreakk', 'CoinFlipd', 'AutofillJg', 'PingHeavyy', 'MutedAll', 'ChatBannd',
  'HoneyBadgerr', 'SilentStorm', 'WildCardd', 'LuckyRolll', 'TwoStarLulu', 'ThreeStarKO', 'AceOfClubs', 'KingOfHearts',
  'QueensGambit', 'JokerWildd', 'DiamondHands', 'PaperHandss', 'NattyKnight', 'Blitzedd', 'FrostbittenK', 'ScorchedEU',
  'ThunderClapd', 'StormChaserr', 'WindShearr', 'TidalWavee', 'EarthShakerr', 'MagmaCore', 'GlacierK', 'AvalancheA',
]

function hashStr(s) {
  var h = 2166136261
  var i = 0
  for (i = 0; i < s.length; i++) {
    h = h ^ s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makeRng(seed) {
  var s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    var t = s
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function tournamentFormat(t) {
  return FORMATS[hashStr(String(t.id || t.name)) % FORMATS.length]
}

// Build a full final-standings sheet for one tournament.
export function buildStandings(t) {
  var n = Math.max(8, t.entries || 8)
  var T = t.topScore || 48
  var games = n > 96 ? 6 : 5
  var rnd = makeRng(hashStr(String(t.id) + ':' + String(t.name)))

  var top = (t.top3 || []).slice(0, 3)
  var taken = {}
  top.forEach(function (x) { taken[x] = 1 })
  var pool = NAME_POOL.filter(function (x) { return !taken[x] })
  // Fisher-Yates shuffle (deterministic)
  var i = 0
  var j = 0
  var tmp = null
  for (i = pool.length - 1; i > 0; i--) {
    j = Math.floor(rnd() * (i + 1))
    tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
  }
  var names = top.concat(pool)

  var rows = []
  var prevPts = T + 1
  var r = 0
  for (r = 1; r <= n; r++) {
    var name = names[r - 1] || ('Summoner' + r)
    var strength = (n - r) / (n - 1)
    var noise = rnd() * 4 - 2
    var pts = r === 1 ? T : Math.round(1 + strength * (T - 1) + noise)
    if (pts > prevPts) pts = prevPts
    if (pts < 1) pts = 1
    prevPts = pts

    var top4 = Math.round(strength * games + (rnd() * 1.6 - 0.8))
    if (top4 > games) top4 = games
    if (top4 < 0) top4 = 0
    var firsts = Math.round(strength * games * 0.5 + (rnd() * 1.2 - 0.6))
    if (firsts > top4) firsts = top4
    if (firsts < 0) firsts = 0
    if (r === 1 && firsts < 2) firsts = 2

    rows.push({
      rank: r,
      name: name,
      region: REGION,
      tag: REGION,
      points: pts,
      firsts: firsts,
      top4: top4,
      games: games,
    })
  }
  return rows
}

var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function formatArchiveDate(iso) {
  var parts = String(iso || '').split('-')
  if (parts.length !== 3) return iso || ''
  var y = parts[0]
  var m = parseInt(parts[1], 10)
  var d = parseInt(parts[2], 10)
  if (!m || !d) return iso
  return MONTHS[m - 1] + ' ' + d + ', ' + y
}
