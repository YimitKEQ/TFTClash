var KEY = 'tft-watchlist-players-v1'
var MAX = 12

function readRaw() {
  if (typeof window === 'undefined') return []
  try {
    var raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    var parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(function (n) { return typeof n === 'string' && n.length > 0 }).map(function (n) { return n.trim() })
  } catch (e) {
    return []
  }
}

function writeRaw(names) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(names.slice(0, MAX)))
    window.dispatchEvent(new CustomEvent('tft-watchlist-changed'))
  } catch (e) {}
}

function norm(name) {
  return String(name == null ? '' : name).trim().toLowerCase()
}

export function getWatched() {
  return readRaw()
}

export function isWatched(name) {
  if (!name) return false
  var target = norm(name)
  return readRaw().some(function (n) { return norm(n) === target })
}

export function toggleWatched(name) {
  if (!name) return false
  var target = norm(name)
  var current = readRaw()
  var idx = current.findIndex(function (n) { return norm(n) === target })
  if (idx === -1) {
    var next = [String(name).trim()].concat(current)
    if (next.length > MAX) next = next.slice(0, MAX)
    writeRaw(next)
    return true
  } else {
    var pruned = current.slice()
    pruned.splice(idx, 1)
    writeRaw(pruned)
    return false
  }
}

export function unwatch(name) {
  if (!name) return
  var target = norm(name)
  writeRaw(readRaw().filter(function (n) { return norm(n) !== target }))
}

export function clearWatched() {
  writeRaw([])
}

export var WATCHLIST_MAX = MAX
export var WATCHLIST_EVENT = 'tft-watchlist-changed'
