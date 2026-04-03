import { useState, useEffect } from 'react'

// Deterministic fallback: next Saturday 20:00 CET (UTC+1 in winter, UTC+2 in summer)
// This ensures all pages show the same countdown even without a tournamentState timestamp
function getNextSaturday() {
  var now = new Date()
  // Calculate next Saturday in CET/CEST
  var cetOffset = now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' })
  var cetNow = new Date(cetOffset)
  var daysUntilSat = (6 - cetNow.getDay() + 7) % 7
  if (daysUntilSat === 0 && cetNow.getHours() >= 20) daysUntilSat = 7
  if (daysUntilSat === 0) daysUntilSat = 0 // today is Saturday, before 20:00
  var target = new Date(cetNow)
  target.setDate(cetNow.getDate() + daysUntilSat)
  target.setHours(20, 0, 0, 0)
  // Convert back to UTC by getting the offset
  var localTarget = new Date(now)
  localTarget.setTime(now.getTime() + (target.getTime() - cetNow.getTime()))
  return localTarget
}

function getTimeLeft(target) {
  var diff = Math.max(0, new Date(target).getTime() - Date.now())
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    total: diff
  }
}

export default function useCountdown(tournamentState) {
  var hasTimestamp = tournamentState && tournamentState.clashTimestamp
  var target = hasTimestamp ? new Date(tournamentState.clashTimestamp) : getNextSaturday()
  var hasCountdown = target.getTime() > Date.now()
  var clashName = (tournamentState && tournamentState.clashName) || 'Next Clash'

  var _state = useState(function() { return getTimeLeft(target) })
  var timeLeft = _state[0]
  var setTimeLeft = _state[1]

  useEffect(function() {
    var t = hasTimestamp ? new Date(tournamentState.clashTimestamp) : getNextSaturday()
    setTimeLeft(getTimeLeft(t))
    var timer = setInterval(function() {
      setTimeLeft(getTimeLeft(t))
    }, 1000)
    return function() { clearInterval(timer) }
  }, [hasTimestamp ? tournamentState.clashTimestamp : null])

  return {
    days: timeLeft.days,
    hours: timeLeft.hours,
    minutes: timeLeft.minutes,
    seconds: timeLeft.seconds,
    hasCountdown: hasCountdown,
    targetDate: target,
    clashName: clashName,
    total: timeLeft.total
  }
}

export { getNextSaturday, getTimeLeft }
