// /api/widget -- SVG widget for Discord/embed showing the next upcoming tournament.
// Optional ?host=<slug> filter; otherwise platform-wide next event.

import { createClient } from '@supabase/supabase-js'

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fmtCountdown(ms) {
  if (ms <= 0) return 'STARTING NOW'
  var totalMins = Math.floor(ms / 60000)
  var days = Math.floor(totalMins / 1440)
  var hours = Math.floor((totalMins % 1440) / 60)
  var mins = totalMins % 60
  if (days >= 1) return days + 'd ' + hours + 'h ' + mins + 'm'
  if (hours >= 1) return hours + 'h ' + mins + 'm'
  return mins + 'm'
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  var hostFilter = req.query && req.query.host ? String(req.query.host).slice(0, 60) : ''
  var theme = req.query && req.query.theme ? String(req.query.theme).slice(0, 12) : 'dark'

  var event = null
  if (url && key) {
    try {
      var sb = createClient(url, key, { auth: { persistSession: false } })
      var query = sb
        .from('scheduled_events')
        .select('name,starts_at,host,region,event_type')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(1)
      if (hostFilter) query = query.eq('host', hostFilter)
      var resp = await query.maybeSingle()
      if (resp && resp.data) event = resp.data
    } catch (e) {}
  }

  var bg = theme === 'light' ? '#f6f4ef' : '#0e0e14'
  var fg = theme === 'light' ? '#1a1a25' : '#f6f4ef'
  var dim = theme === 'light' ? '#7a7585' : '#9c97a8'
  var accent = '#9B72CF'
  var tertiary = '#67e2d9'

  var width = 480
  var height = 160

  var title = event ? event.name : 'No upcoming tournaments'
  var subtitle = event
    ? (event.host ? 'Hosted by ' + event.host : 'TFT Clash')
    : 'Check back soon at tftclash.com'
  var countdown = ''
  if (event && event.starts_at) {
    var ms = new Date(event.starts_at).getTime() - Date.now()
    countdown = fmtCountdown(ms)
  }
  var dateStr = event && event.starts_at
    ? new Date(event.starts_at).toUTCString().replace(/:\d\d GMT/, ' UTC').slice(0, 25)
    : ''

  var svg = ''
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">'
    + '<defs>'
    + '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0%" stop-color="' + accent + '" stop-opacity="0.18"/>'
    + '<stop offset="100%" stop-color="' + tertiary + '" stop-opacity="0.06"/>'
    + '</linearGradient>'
    + '</defs>'
    + '<rect width="' + width + '" height="' + height + '" fill="' + bg + '" rx="14"/>'
    + '<rect width="' + width + '" height="' + height + '" fill="url(#g)" rx="14"/>'
    + '<rect x="0" y="0" width="4" height="' + height + '" fill="' + accent + '"/>'
    + '<text x="24" y="34" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700" fill="' + accent + '" letter-spacing="2">NEXT TOURNAMENT</text>'
    + '<text x="24" y="68" font-family="Georgia, serif" font-style="italic" font-size="22" font-weight="700" fill="' + fg + '">' + escapeXml(title.slice(0, 38)) + '</text>'
    + '<text x="24" y="92" font-family="Inter, system-ui, sans-serif" font-size="13" fill="' + dim + '">' + escapeXml(subtitle.slice(0, 60)) + '</text>'
  if (countdown) {
    svg += '<text x="' + (width - 24) + '" y="68" text-anchor="end" font-family="ui-monospace, SF Mono, Menlo, monospace" font-size="28" font-weight="700" fill="' + tertiary + '">' + escapeXml(countdown) + '</text>'
    svg += '<text x="' + (width - 24) + '" y="92" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="11" fill="' + dim + '">' + escapeXml(dateStr) + '</text>'
  }
  svg += '<text x="24" y="' + (height - 18) + '" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600" fill="' + dim + '" letter-spacing="1.2">tftclash.com</text>'
  svg += '<text x="' + (width - 24) + '" y="' + (height - 18) + '" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="10" fill="' + dim + '">'
  svg += event && event.region ? escapeXml(event.region.toUpperCase() + ' • ' + (event.event_type || 'CLASH').toUpperCase()) : 'CLASH PLATFORM'
  svg += '</text>'
  svg += '</svg>'

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).send(svg)
}
