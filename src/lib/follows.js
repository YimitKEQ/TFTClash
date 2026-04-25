// Follow/rival tracking. localStorage-only — no DB schema required.
// Lets a fan flag a player as Following or Rival and surfaces it on their profile.

var STORAGE_KEY = 'tft-follows-v1'

function read() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { follows: [], rivals: [] }
    var parsed = JSON.parse(raw)
    return {
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
      rivals: Array.isArray(parsed.rivals) ? parsed.rivals : []
    }
  } catch (e) {
    return { follows: [], rivals: [] }
  }
}

function write(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (e) {}
}

export function getFollowState() { return read() }

export function isFollowing(name) {
  if (!name) return false
  return read().follows.indexOf(name) > -1
}

export function isRival(name) {
  if (!name) return false
  return read().rivals.indexOf(name) > -1
}

export function toggleFollow(name) {
  if (!name) return false
  var st = read()
  var idx = st.follows.indexOf(name)
  if (idx > -1) st.follows.splice(idx, 1)
  else st.follows.push(name)
  write(st)
  return st.follows.indexOf(name) > -1
}

export function toggleRival(name) {
  if (!name) return false
  var st = read()
  var idx = st.rivals.indexOf(name)
  if (idx > -1) st.rivals.splice(idx, 1)
  else st.rivals.push(name)
  write(st)
  return st.rivals.indexOf(name) > -1
}

export function clearAll() { write({ follows: [], rivals: [] }) }
