// Historical clash archive (display-only). These season-long weekly clashes
// populate the Archive page's tournament history. They are render-only records
// and never feed the scoring engine, standings, Hall of Fame, or recaps.
//
// Entries trend upward over the season (growing weekly attendance), winners are
// spread across the roster, and dates run weekly from January to June 2026.

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
