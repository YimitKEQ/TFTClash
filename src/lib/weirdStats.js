// Algorithmic "weird stat awards" — mines a player's clashHistory for absurd patterns.
// Output: array of {id, label, blurb}. UI renders them as flair on the profile.

export var WEIRD_AWARDS = {
  curse_of_4th:  { id: "curse_of_4th",  label: "Curse of 4th",   blurb: "3+ fourth places in a row." },
  hot_streak:    { id: "hot_streak",    label: "Hot Streak",     blurb: "3+ wins in a row." },
  iron_butt:     { id: "iron_butt",     label: "Iron Butt",      blurb: "20+ games played this season." },
  glass_cannon:  { id: "glass_cannon",  label: "Glass Cannon",   blurb: "Wins or eighths only, no middle ground." },
  iceman:        { id: "iceman",        label: "The Iceman",     blurb: "All placements within two of average. Consistency king." },
  comeback_king: { id: "comeback_king", label: "Comeback King",  blurb: "Won the last game after starting 7th or 8th." },
  bridesmaid:    { id: "bridesmaid",    label: "Always 2nd",     blurb: "More 2nds than any other place." },
  donut_dread:   { id: "donut_dread",   label: "Donut Dread",    blurb: "Five or more 8ths this season." },
  freight_train: { id: "freight_train", label: "Freight Train",  blurb: "Climbed 3+ placements between game 1 and game 4." }
}

function streakOf(arr, pred) {
  var best = 0
  var cur = 0
  for (var i = 0; i < arr.length; i++) {
    if (pred(arr[i])) { cur++; if (cur > best) best = cur }
    else cur = 0
  }
  return best
}

export function computeAwards(player) {
  var hist = (player && player.clashHistory) || []
  if (hist.length < 3) return []

  var places = hist
    .map(function (h) { return h.place || h.placement || 0 })
    .filter(function (p) { return p > 0 })

  if (places.length < 3) return []

  var awards = []

  if (streakOf(places, function (p) { return p === 4 }) >= 3) awards.push(WEIRD_AWARDS.curse_of_4th)
  if (streakOf(places, function (p) { return p === 1 }) >= 3) awards.push(WEIRD_AWARDS.hot_streak)
  if (places.length >= 20) awards.push(WEIRD_AWARDS.iron_butt)

  var eighths = places.filter(function (p) { return p === 8 }).length
  if (eighths >= 5) awards.push(WEIRD_AWARDS.donut_dread)

  var winsOrEighths = places.filter(function (p) { return p === 1 || p === 8 }).length
  if (places.length >= 8 && winsOrEighths / places.length >= 0.7) {
    awards.push(WEIRD_AWARDS.glass_cannon)
  }

  var avg = places.reduce(function (s, p) { return s + p }, 0) / places.length
  var consistent = places.filter(function (p) { return Math.abs(p - avg) <= 2 }).length
  if (places.length >= 10 && consistent / places.length >= 0.85) {
    awards.push(WEIRD_AWARDS.iceman)
  }

  // Bridesmaid: more 2nds than any other place
  var counts = {}
  places.forEach(function (p) { counts[p] = (counts[p] || 0) + 1 })
  var topPlace = 0
  var topCount = 0
  Object.keys(counts).forEach(function (k) {
    if (counts[k] > topCount) { topCount = counts[k]; topPlace = parseInt(k, 10) }
  })
  if (topPlace === 2 && (counts[2] || 0) >= 3) awards.push(WEIRD_AWARDS.bridesmaid)

  // Comeback / freight train need round/clash grouping. Only check if we have round info.
  var byClash = {}
  hist.forEach(function (h) {
    var k = h.clashId || h.tournamentId
    if (!k) return
    if (!byClash[k]) byClash[k] = []
    byClash[k].push(h)
  })

  var clashes = Object.values(byClash)
  for (var i = 0; i < clashes.length; i++) {
    var c = clashes[i]
    if (c.length < 4) continue
    var sorted = c.slice().sort(function (a, b) { return (a.round || 0) - (b.round || 0) })
    var first = sorted[0].place || sorted[0].placement
    var last = sorted[sorted.length - 1].place || sorted[sorted.length - 1].placement
    if (first >= 7 && last === 1) {
      awards.push(WEIRD_AWARDS.comeback_king)
      break
    }
  }
  for (var j = 0; j < clashes.length; j++) {
    var cj = clashes[j]
    if (cj.length < 4) continue
    var sj = cj.slice().sort(function (a, b) { return (a.round || 0) - (b.round || 0) })
    var firstP = sj[0].place || sj[0].placement
    var lastP = sj[sj.length - 1].place || sj[sj.length - 1].placement
    if (firstP - lastP >= 3) {
      awards.push(WEIRD_AWARDS.freight_train)
      break
    }
  }

  // Dedupe by id
  var seen = {}
  return awards.filter(function (a) {
    if (seen[a.id]) return false
    seen[a.id] = true
    return true
  })
}
