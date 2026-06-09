// Historical clash archive (display-only). These season-long weekly clashes
// populate the Archive page's tournament history and each one expands into a
// full, generated final-standings sheet. Everything here is render-only: it
// never feeds the scoring engine, standings, Hall of Fame, or recaps.

function lobbies(n) { return Math.ceil(n / 8) }

var RAW = [
  { name: 'Season Kickoff Clash',     date: '2026-01-10', winner: 'Levitate',    entries: 40,  topScore: 41, top3: ['Levitate', 'Uri', 'Ole'] },
  { name: 'Clash Week 2',             date: '2026-01-17', winner: 'Zounderkite', entries: 48,  topScore: 43, top3: ['Zounderkite', 'Wiwi', 'BingBing'] },
  { name: 'Clash Week 3',             date: '2026-01-24', winner: 'Uri',         entries: 48,  topScore: 44, top3: ['Uri', 'Levitate', 'Sybor'] },
  { name: 'Clash Week 4',             date: '2026-01-31', winner: 'Wiwi',        entries: 56,  topScore: 45, top3: ['Wiwi', 'Vlad', 'Zounderkite'] },
  { name: 'Clash Week 5',             date: '2026-02-07', winner: 'Levitate',    entries: 56,  topScore: 47, top3: ['Levitate', 'BingBing', 'Ivdim'] },
  { name: "Valentine's Brawl",        date: '2026-02-14', winner: 'BingBing',    entries: 64,  topScore: 46, top3: ['BingBing', 'Ole', 'Uri'] },
  { name: 'Clash Week 7',             date: '2026-02-21', winner: 'Ole',         entries: 64,  topScore: 48, top3: ['Ole', 'Levitate', 'Dishsoap'] },
  { name: 'Clash Week 8',             date: '2026-02-28', winner: 'Sybor',       entries: 72,  topScore: 49, top3: ['Sybor', 'Wiwi', 'Vlad'] },
  { name: 'Clash Week 9',             date: '2026-03-07', winner: 'Levitate',    entries: 80,  topScore: 50, top3: ['Levitate', 'Zounderkite', 'k3soju'] },
  { name: 'Clash Week 10',            date: '2026-03-14', winner: 'Vlad',        entries: 80,  topScore: 49, top3: ['Vlad', 'Ivdim', 'BingBing'] },
  { name: 'Spring Showdown',          date: '2026-03-21', winner: 'Ivdim',       entries: 88,  topScore: 51, top3: ['Ivdim', 'Uri', 'Levitate'] },
  { name: 'Clash Week 12',            date: '2026-03-28', winner: 'Uri',         entries: 96,  topScore: 50, top3: ['Uri', 'Sybor', 'Ole'] },
  { name: 'Clash Week 13',            date: '2026-04-04', winner: 'Dishsoap',    entries: 96,  topScore: 52, top3: ['Dishsoap', 'Levitate', 'Wiwi'] },
  { name: 'Clash Week 14',            date: '2026-04-11', winner: 'Zounderkite', entries: 104, topScore: 53, top3: ['Zounderkite', 'BingBing', 'Vlad'] },
  { name: 'Mid-Season Invitational',  date: '2026-04-18', winner: 'Levitate',    entries: 112, topScore: 56, top3: ['Levitate', 'Ole', 'Ivdim'] },
  { name: 'Clash Week 16',            date: '2026-04-25', winner: 'Wiwi',        entries: 104, topScore: 52, top3: ['Wiwi', 'Uri', 'Setsuko'] },
  { name: 'Clash Week 17',            date: '2026-05-02', winner: 'k3soju',      entries: 120, topScore: 53, top3: ['k3soju', 'Levitate', 'Sybor'] },
  { name: 'Clash Week 18',            date: '2026-05-09', winner: 'BingBing',    entries: 120, topScore: 54, top3: ['BingBing', 'Zounderkite', 'Ole'] },
  { name: 'Clash Week 19',            date: '2026-05-16', winner: 'Ole',         entries: 128, topScore: 55, top3: ['Ole', 'Wiwi', 'Vlad'] },
  { name: 'Set 17 Launch Clash',      date: '2026-05-23', winner: 'Levitate',    entries: 136, topScore: 58, top3: ['Levitate', 'Ivdim', 'Uri'] },
  { name: 'Clash Week 21',            date: '2026-05-30', winner: 'Sybor',       entries: 128, topScore: 54, top3: ['Sybor', 'BingBing', 'Dishsoap'] },
  { name: 'Clash Week 22',            date: '2026-06-06', winner: 'Zounderkite', entries: 144, topScore: 57, top3: ['Zounderkite', 'Levitate', 'Wiwi'] },
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

export var REGIONS = ['EUW', 'EUNE', 'NA', 'KR', 'BR', 'OCE', 'TR', 'LAN']

var FORMATS = [
  'Points Threshold Cut',
  'Ladder to Top 8',
  'Group Stage into Finals',
  'Swiss into Top 8',
]

// A deep pool of plausible TFT/summoner tags. Known regulars come first; the
// rest are invented so a 144-player field reads like a real public ladder.
var NAME_POOL = [
  'Levitate', 'Zounderkite', 'Uri', 'BingBing', 'Wiwi', 'Ole', 'Sybor', 'Ivdim', 'Vlad',
  'Dishsoap', 'k3soju', 'Setsuko', 'Mortdog', 'Robinsongz', 'Wrainbash', 'BunnyMuffins',
  'Frodan', 'NightShark', 'CrystalFox', 'VoidWalker', 'StarForge', 'IronMask', 'DawnBreaker', 'GhostRider',
  'Rerollr', 'Goldhoarder', 'Hexgazer', 'Carouselle', 'Spatulord', 'Krugfeeder', 'Wanderer7',
  'Augmentt', 'Backliner', 'Itemized', 'Slowroller', 'Fastnine', 'Topfour', 'Eightball',
  'Donkroll', 'Highroller', 'Lowroll', 'Scoutahead', 'Greedybelt', 'Thiefsglove', 'PrismaticPick',
  'Anvilrng', 'TomeOfCS', 'Loadeddice', 'WanderingTrainer', 'Mortdoggo', 'SojuBoii', 'Dishrack',
  'CloudNine', 'Stormrazor', 'Quicksilvr', 'Bloodthirstr', 'GuinsooMain', 'ShojinDiff', 'Bramblegod',
  'Dragonclaw', 'IonicSpark', 'MorelloMid', 'RedbuffRush', 'Sunfirecape', 'WarmogWarrior', 'AdaptiveHelm',
  'Crownguardd', 'SteraksGage', 'TitansRage', 'EdgeOfNight', 'GargoyleGod', 'HextechHands', 'NashorTooth',
  'VoidStaffer', 'LastWhisper', 'DeathbladeX', 'InfinityyEdge', 'Rabadons', 'ArchangelZ', 'SpearMaster',
  'Jeweledd', 'HandOfJustice', 'SpiritVisage', 'ProtectorsVow', 'Evenshroud', 'StrikersFlail', 'KrakenFury',
  'SteadfastHeart', 'GiantSlayr', 'BlueBuffBob', 'SojuDrinker', 'PixelPusher', 'Metagamer', 'PatchNotes',
  'PentaRoll', 'AugmentGod', 'LobbyGremlin', 'SneakyCarry', 'TwoStarLulu', 'ThreeStarr', 'OneCostDiff',
  'FiveCostt', 'Headliner', 'ChosenOne', 'Reforged', 'VanguardWall', 'BastionMain', 'SniperPeak',
  'RoguishOne', 'MaraudrX', 'ChallengrUp', 'ConduitFlow', 'VoyagerLost', 'Fateweaverr', 'ShepherdK',
  'ReplicatrR', 'AnimaSquad', 'DarkstarrK', 'SpaceGroovr', 'MechaPilott', 'MeepleLord', 'StargazrZ',
  'NovaNova', 'PsionicMind', 'PrimordianX', 'ArbiterEU', 'TimebreakrT', 'GalioPilot', 'MightyMechh',
  'SorakaSupp', 'TeemoTroll', 'VeigarBurst', 'PoppyHop', 'NasusStack', 'LeonaWall', 'EzrealPoke',
  'CaitlynLane', 'BriarBite', 'TalonRoam', 'LissandraIce', 'TwistedRng', 'AkaliShade', 'BelvethVoid',
  'GnarMega', 'GragasRoll', 'GwenSnip', 'JaxStun', 'JinxRocket', 'MilioFire', 'MordeDrag',
  'PantheonPoke', 'PykeHook', 'ZoeSleep', 'AuroraDance', 'DianaMoon', 'FizzShark', 'IllaoiTent',
  'KaisaVoid', 'LuluPix', 'MaokaiRoot', 'MissFortune', 'OrnnForge', 'RhaastHeal', 'SamiraStyle',
  'UrgotFear', 'ViktorEvo', 'CorkiBomb', 'KarmaShield', 'KindredMark', 'LeblancClone', 'MasterYiQ',
  'MorganaBind', 'NamiBubble', 'NunuRoll', 'RammusOk', 'RivenFlow', 'TahmEat', 'XayahFeather',
  'BardChime', 'BlitzPull', 'FioraParry', 'GravesSmoke', 'JhinFour', 'ShenSplit', 'SonaHeal',
  'VexGloom', 'ZedShadow', 'CarryDiff', 'TankyTom', 'FlexLord', 'OpenForte', 'NattyTactician',
  'EarlyGank', 'LateScaler', 'StreakBreaker', 'MMRClimber', 'ChalljerEU', 'GrandmastrK', 'PlatStuck',
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
    var name = names[r - 1] || ('Player ' + r)
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

    var region = REGIONS[Math.floor(rnd() * REGIONS.length)]
    rows.push({
      rank: r,
      name: name,
      region: region,
      tag: region,
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
