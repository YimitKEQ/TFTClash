import { useState } from 'react'
import { Icon } from '../ui'

// Downloads an .ics file for a tournament / clash. Single-event, all-day by default
// if no time is supplied. Duration defaults to 3 hours.
function pad(n) { return n < 10 ? '0' + n : '' + n }
function toIcsDate(d) {
  // UTC format: YYYYMMDDTHHMMSSZ
  return d.getUTCFullYear()
    + pad(d.getUTCMonth() + 1)
    + pad(d.getUTCDate())
    + 'T'
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds())
    + 'Z'
}
function escapeIcs(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}
function buildIcs(opts) {
  var start = opts.start
  var end = opts.end || new Date(start.getTime() + (opts.durationMinutes || 180) * 60 * 1000)
  var uid = (opts.uid || ('tftclash-' + start.getTime())) + '@tftclash.com'
  var url = opts.url || 'https://tftclash.com/events'
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TFT Clash//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + toIcsDate(new Date()),
    'DTSTART:' + toIcsDate(start),
    'DTEND:' + toIcsDate(end),
    'SUMMARY:' + escapeIcs(opts.title || 'TFT Clash'),
    'DESCRIPTION:' + escapeIcs(opts.description || 'Weekly TFT Clash tournament on tftclash.com'),
    'URL:' + escapeIcs(url),
    'LOCATION:' + escapeIcs(opts.location || 'tftclash.com'),
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  return lines.join('\r\n')
}

export default function AddToCalendarBtn(props) {
  var start = props.start
  var end = props.end
  var durationMinutes = props.durationMinutes
  var title = props.title
  var description = props.description
  var url = props.url
  var uid = props.uid
  var filename = props.filename || 'tft-clash.ics'
  var variant = props.variant || 'secondary'
  var onClick = props.onClick

  var _busy = useState(false)
  var busy = _busy[0]
  var setBusy = _busy[1]

  var startDate = typeof start === 'string' ? new Date(start) : start
  var endDate = typeof end === 'string' ? new Date(end) : end

  if (!startDate || isNaN(startDate.getTime())) return null

  function handle(e) {
    if (e) { e.preventDefault(); e.stopPropagation() }
    if (busy) return
    setBusy(true)
    try {
      var ics = buildIcs({
        start: startDate,
        end: endDate,
        durationMinutes: durationMinutes,
        title: title,
        description: description,
        url: url,
        uid: uid
      })
      var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      var href = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = href
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(function() { URL.revokeObjectURL(href) }, 2000)
      if (onClick) onClick()
    } finally {
      setTimeout(function() { setBusy(false) }, 400)
    }
  }

  var styles = variant === 'ghost'
    ? 'text-xs text-on-surface/60 hover:text-primary border border-outline-variant/20 hover:border-primary/40 rounded px-3 py-1.5'
    : 'text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg px-3 py-2'

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className={'inline-flex items-center gap-1.5 cursor-pointer transition-colors ' + styles}
    >
      <Icon name="event" size={14} />
      Add to calendar
    </button>
  )
}
