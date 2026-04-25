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
  } catch (e) {}
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
    ids.unshift(sid)
    if (ids.length > MAX) ids = ids.slice(0, MAX)
    writeRaw(ids)
    return true
  } else {
    ids.splice(idx, 1)
    writeRaw(ids)
    return false
  }
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
