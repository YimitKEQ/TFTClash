var KEY = 'tft-pinned-tournaments-v1'
var MAX = 8

function readRaw() {
  if (typeof window === 'undefined') return []
  try {
    var raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    var parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(function (id) { return typeof id === 'string' && id.length > 0 }) : []
  } catch (e) {
    return []
  }
}

function writeRaw(ids) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)))
    window.dispatchEvent(new CustomEvent('tft-pinned-tournaments-changed'))
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn && import.meta && import.meta.env && import.meta.env.DEV) {
      console.warn('[pinnedTournaments] localStorage write failed:', e && e.message)
    }
  }
}

export function getPinnedIds() {
  return readRaw()
}

export function isPinned(id) {
  if (!id) return false
  return readRaw().indexOf(String(id)) !== -1
}

export function togglePinned(id) {
  if (!id) return false
  var sid = String(id)
  var ids = readRaw()
  var idx = ids.indexOf(sid)
  if (idx === -1) {
    var pinned = [sid].concat(ids)
    if (pinned.length > MAX) pinned = pinned.slice(0, MAX)
    writeRaw(pinned)
    return true
  }
  var unpinned = ids.filter(function (x) { return x !== sid })
  writeRaw(unpinned)
  return false
}

export function unpinId(id) {
  if (!id) return
  var sid = String(id)
  var ids = readRaw().filter(function (x) { return x !== sid })
  writeRaw(ids)
}

export function clearPinned() {
  writeRaw([])
}

export var PINNED_MAX = MAX
export var PINNED_EVENT = 'tft-pinned-tournaments-changed'
