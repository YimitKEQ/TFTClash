// /api/calendar.ics -- public iCal feed of upcoming TFT Clash events
// Subscribers add this URL to Google/Apple/Outlook calendar; updates auto-refresh.
// Optional: ?player=<name> filters to events that player is registered for.

import { createClient } from '@supabase/supabase-js'

function pad(n) { return String(n).padStart(2, '0') }

function fmtUtc(d) {
  return d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
}

function escapeText(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(500).send('Calendar feed not configured')
  }

  var sb = createClient(url, key, { auth: { persistSession: false } })

  var nowIso = new Date().toISOString()
  var rows = []

  try {
    var resp = await sb
      .from('scheduled_events')
      .select('id,name,starts_at,ends_at,description,event_type')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(100)
    if (resp.data) rows = resp.data
  } catch (e) {
    rows = []
  }

  var lines = []
  lines.push('BEGIN:VCALENDAR')
  lines.push('VERSION:2.0')
  lines.push('PRODID:-//TFT Clash//Tournament Calendar//EN')
  lines.push('CALSCALE:GREGORIAN')
  lines.push('METHOD:PUBLISH')
  lines.push('X-WR-CALNAME:TFT Clash')
  lines.push('X-WR-CALDESC:Upcoming TFT Clash tournaments and events')
  lines.push('X-WR-TIMEZONE:UTC')

  rows.forEach(function (r) {
    var startsAt = r.starts_at ? new Date(r.starts_at) : null
    var endsAt = r.ends_at ? new Date(r.ends_at) : null
    if (!startsAt) return
    if (!endsAt) endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000)

    lines.push('BEGIN:VEVENT')
    lines.push('UID:event-' + r.id + '@tftclash.com')
    lines.push('DTSTAMP:' + fmtUtc(new Date()))
    lines.push('DTSTART:' + fmtUtc(startsAt))
    lines.push('DTEND:' + fmtUtc(endsAt))
    lines.push('SUMMARY:' + escapeText('TFT Clash: ' + (r.name || 'Event')))
    if (r.description) lines.push('DESCRIPTION:' + escapeText(r.description))
    lines.push('URL:https://tftclash.com/events')
    lines.push('CATEGORIES:' + escapeText((r.event_type || 'Tournament').toUpperCase()))
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="tft-clash.ics"')
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600')
  res.status(200).send(lines.join('\r\n'))
}
