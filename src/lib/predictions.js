var KEY = 'tft-predictions-v1'
var GUEST_KEY = 'tft-predictions-guest-v1'
var MAX_ENTRIES = 1000

function read() {
  if (typeof window === 'undefined') return {}
  try {
    var raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    var p = JSON.parse(raw)
    return p && typeof p === 'object' ? p : {}
  } catch (e) {
    return {}
  }
}

function write(map) {
  if (typeof window === 'undefined') return
  try {
    var keys = Object.keys(map)
    if (keys.length > MAX_ENTRIES) {
      var trimmed = {}
      keys.slice(-MAX_ENTRIES).forEach(function (k) { trimmed[k] = map[k] })
      map = trimmed
    }
    window.localStorage.setItem(KEY, JSON.stringify(map))
  } catch (e) {}
}

export function userKey(currentUser) {
  if (currentUser && currentUser.id) return 'u:' + currentUser.id
  if (typeof window === 'undefined') return 'g:anon'
  try {
    var g = window.localStorage.getItem(GUEST_KEY)
    if (g) return 'g:' + g
    var fresh = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    window.localStorage.setItem(GUEST_KEY, fresh)
    return 'g:' + fresh
  } catch (e) { return 'g:anon' }
}

export function readMyPrediction(threadId, currentUser) {
  var all = read()
  var k = userKey(currentUser)
  return (all[threadId] && all[threadId][k]) || null
}

export function readAllPredictions(threadId) {
  var all = read()
  return all[threadId] || {}
}

export function savePrediction(threadId, currentUser, prediction) {
  var all = read()
  if (!all[threadId]) all[threadId] = {}
  var k = userKey(currentUser)
  all[threadId][k] = {
    winner: prediction.winner || null,
    top4: Array.isArray(prediction.top4) ? prediction.top4.slice(0, 4) : [],
    name: (currentUser && currentUser.name) || prediction.guestName || 'Anon',
    ts: Date.now(),
  }
  write(all)
}

export function clearPrediction(threadId, currentUser) {
  var all = read()
  if (!all[threadId]) return
  var k = userKey(currentUser)
  delete all[threadId][k]
  write(all)
}

// Score: +5 winner, +2 each top4 hit (max 13)
export function scorePrediction(prediction, actualWinnerId, actualTop4Ids) {
  if (!prediction) return 0
  var s = 0
  if (prediction.winner && actualWinnerId && String(prediction.winner) === String(actualWinnerId)) s += 5
  var top4 = Array.isArray(actualTop4Ids) ? actualTop4Ids.map(function (i) { return String(i) }) : []
  ;(prediction.top4 || []).forEach(function (id) {
    if (top4.indexOf(String(id)) >= 0) s += 2
  })
  return s
}

export function leaderboard(threadId, actualWinnerId, actualTop4Ids) {
  var entries = readAllPredictions(threadId)
  var rows = Object.keys(entries).map(function (k) {
    var p = entries[k]
    return {
      key: k,
      name: p.name || 'Anon',
      score: scorePrediction(p, actualWinnerId, actualTop4Ids),
      prediction: p,
    }
  })
  rows.sort(function (a, b) { return b.score - a.score })
  return rows
}
