import { useState, useEffect } from 'react'

function getTimeLeft(target) {
  const diff = Math.max(0, new Date(target) - new Date())
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

export default function CountdownTimer({ targetDate, className = '' }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate))

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className={`glass-panel p-6 rounded-sm flex items-center justify-center gap-6 ${className}`}>
      {[
        { value: timeLeft.days, label: 'DAYS' },
        { value: timeLeft.hours, label: 'HRS' },
        { value: timeLeft.minutes, label: 'MIN' },
        { value: timeLeft.seconds, label: 'SEC' },
      ].map(({ value, label }) => (
        <div key={label} className="flex flex-col items-center">
          <span className="font-mono text-3xl md:text-4xl font-bold text-on-surface">{String(value).padStart(2, '0')}</span>
          <span className="font-sans text-[10px] uppercase tracking-widest text-on-surface/40 mt-1">{label}</span>
        </div>
      ))}
    </div>
  )
}
