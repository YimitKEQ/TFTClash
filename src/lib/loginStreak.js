// Daily login streak tracker. Increments when a fresh day is detected.
// Stored in localStorage. No DB schema, no auth required — purely visit-based.

var KEY = 'tft-login-streak-v1'

function todayKey() {
  var d = new Date()
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')
}

function read() {
  try {
    var raw = localStorage.getItem(KEY)
    if (!raw) return { lastDay: '', streak: 0, best: 0, total: 0 }
    var p = JSON.parse(raw)
    return {
      lastDay: p.lastDay || '',
      streak: p.streak || 0,
      best: p.best || 0,
      total: p.total || 0
    }
  } catch (e) {
    return { lastDay: '', streak: 0, best: 0, total: 0 }
  }
}

function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch (e) {}
}

export function tickStreak() {
  var s = read()
  var today = todayKey()
  if (s.lastDay === today) return s
  if (!s.lastDay) {
    s.streak = 1
  } else {
    var prev = new Date(s.lastDay + 'T00:00:00Z').getTime()
    var dayMs = 86400000
    var diffDays = Math.round((new Date(today + 'T00:00:00Z').getTime() - prev) / dayMs)
    if (diffDays === 1) s.streak = (s.streak || 0) + 1
    else s.streak = 1
  }
  if (s.streak > s.best) s.best = s.streak
  s.total = (s.total || 0) + 1
  s.lastDay = today
  write(s)
  return s
}

export function getStreak() { return read() }

export function streakTier(streak) {
  if (streak >= 30) return { label: 'Inferno', color: '#FF5050', icon: 'whatshot' }
  if (streak >= 14) return { label: 'Blazing', color: '#E8A838', icon: 'local_fire_department' }
  if (streak >= 7)  return { label: 'Hot',     color: '#D9B9FF', icon: 'bolt' }
  if (streak >= 3)  return { label: 'Warm',    color: '#74C7B5', icon: 'favorite' }
  return { label: 'Spark', color: '#5C7A8C', icon: 'spark' }
}
