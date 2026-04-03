import { useState, useEffect } from 'react'
import { getNextSaturday, getTimeLeft } from '../../lib/useCountdown'

export default function CountdownTimer(props) {
  var targetDate = props.targetDate
  var className = props.className || ''
  var tournamentState = props.tournamentState

  // If tournamentState is provided, derive the target from it (single source of truth)
  var target = tournamentState && tournamentState.clashTimestamp
    ? new Date(tournamentState.clashTimestamp)
    : targetDate || getNextSaturday()

  var _state = useState(function() { return getTimeLeft(target) })
  var timeLeft = _state[0]
  var setTimeLeft = _state[1]

  useEffect(function() {
    setTimeLeft(getTimeLeft(target))
    var timer = setInterval(function() { setTimeLeft(getTimeLeft(target)) }, 1000)
    return function() { clearInterval(timer) }
  }, [target && target.getTime ? target.getTime() : target])

  var segments = [
    { value: timeLeft.days, label: 'DAYS' },
    { value: timeLeft.hours, label: 'HRS' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SEC' }
  ]

  return (
    <div className={'glass-panel p-6 rounded-sm flex items-center justify-center gap-6 ' + className}>
      {segments.map(function(seg) {
        return (
          <div key={seg.label} className="flex flex-col items-center">
            <span className="font-mono text-3xl md:text-4xl font-bold text-on-surface">{String(seg.value).padStart(2, '0')}</span>
            <span className="font-sans text-[10px] uppercase tracking-widest text-on-surface/40 mt-1">{seg.label}</span>
          </div>
        )
      })}
    </div>
  )
}
