// SVG share card generator. Returns image/svg+xml at /api/share-card?name=Levitate
// Public endpoint — uses anon key, only reads non-sensitive player fields.
//   name= player name (required)
//   v=   variant: 'profile' (default) | 'finish'
//   place= optional placement number for finish variant
//   pts=  optional points for finish variant
//
// Designed for OG/Twitter card embedding and right-click-share-as-image flows.

import { createClient } from '@supabase/supabase-js'

var SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
var SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function ordinal(n) {
  var s = ['th', 'st', 'nd', 'rd']
  var v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function buildSvg(opts) {
  var name = escapeXml(opts.name || 'Player')
  var rank = escapeXml(opts.rank || '')
  var pts = opts.pts || 0
  var wins = opts.wins || 0
  var top4 = opts.top4 || 0
  var games = opts.games || 0
  var winRate = games > 0 ? Math.round((top4 / games) * 100) : 0
  var place = opts.place
  var variant = opts.variant || 'profile'

  var headlineLeft = variant === 'finish'
    ? (place ? ordinal(place) + ' place' : 'Finished')
    : 'Season Stats'
  var headlineRight = variant === 'finish'
    ? '+' + (opts.placePts || 0) + ' pts'
    : pts + ' LP'

  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<defs>' +
      '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#0F0F16"/>' +
        '<stop offset="100%" stop-color="#1B1B27"/>' +
      '</linearGradient>' +
      '<linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#E8A838"/>' +
        '<stop offset="100%" stop-color="#D9B9FF"/>' +
      '</linearGradient>' +
    '</defs>' +
    '<rect width="1200" height="630" fill="url(#g)"/>' +
    '<circle cx="950" cy="120" r="280" fill="#D9B9FF" fill-opacity="0.04"/>' +
    '<circle cx="200" cy="500" r="220" fill="#E8A838" fill-opacity="0.04"/>' +
    '<text x="60" y="80" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="6" fill="#74C7B5">TFT CLASH</text>' +
    '<text x="60" y="110" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="500" letter-spacing="2" fill="#9aa0aa">' + escapeXml(headlineLeft.toUpperCase()) + '</text>' +
    '<text x="60" y="270" font-family="\'Russo One\', Impact, sans-serif" font-size="120" font-weight="900" fill="#FFFFFF" letter-spacing="-2">' + name.slice(0, 18).toUpperCase() + '</text>' +
    (rank ? '<text x="60" y="320" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="#D9B9FF">' + rank + '</text>' : '') +
    '<text x="1140" y="80" text-anchor="end" font-family="\'JetBrains Mono\', monospace" font-size="14" fill="#9aa0aa">tftclash.com</text>' +
    '<text x="1140" y="270" text-anchor="end" font-family="\'Russo One\', Impact, sans-serif" font-size="84" fill="url(#g2)">' + escapeXml(String(headlineRight)) + '</text>' +
    '<line x1="60" y1="420" x2="1140" y2="420" stroke="#2a2a35" stroke-width="2"/>' +
    '<g transform="translate(60, 470)" font-family="Inter, Arial, sans-serif" fill="#FFFFFF">' +
      '<text font-size="42" font-weight="800">' + wins + '</text>' +
      '<text y="32" font-size="14" font-weight="500" letter-spacing="3" fill="#9aa0aa">WINS</text>' +
    '</g>' +
    '<g transform="translate(280, 470)" font-family="Inter, Arial, sans-serif" fill="#FFFFFF">' +
      '<text font-size="42" font-weight="800">' + top4 + '</text>' +
      '<text y="32" font-size="14" font-weight="500" letter-spacing="3" fill="#9aa0aa">TOP-4</text>' +
    '</g>' +
    '<g transform="translate(500, 470)" font-family="Inter, Arial, sans-serif" fill="#FFFFFF">' +
      '<text font-size="42" font-weight="800">' + games + '</text>' +
      '<text y="32" font-size="14" font-weight="500" letter-spacing="3" fill="#9aa0aa">GAMES</text>' +
    '</g>' +
    '<g transform="translate(720, 470)" font-family="Inter, Arial, sans-serif" fill="#FFFFFF">' +
      '<text font-size="42" font-weight="800">' + winRate + '%</text>' +
      '<text y="32" font-size="14" font-weight="500" letter-spacing="3" fill="#9aa0aa">TOP-4 RATE</text>' +
    '</g>' +
    '<text x="1140" y="600" text-anchor="end" font-family="\'JetBrains Mono\', monospace" font-size="12" fill="#5C7A8C">tftclash.com/player/' + name.toLowerCase() + '</text>' +
  '</svg>'
}

export default async function handler(req, res) {
  try {
    var name = (req.query && req.query.name) || ''
    if (!name) {
      res.status(400).json({ error: 'name required' })
      return
    }
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      res.status(500).json({ error: 'supabase not configured' })
      return
    }
    var sb = createClient(SUPABASE_URL, SUPABASE_ANON)
    var r = await sb.from('players')
      .select('name, rank, pts, wins, top4, games')
      .ilike('name', name)
      .limit(1)
      .single()
    var p = r && r.data ? r.data : { name: name, pts: 0, wins: 0, top4: 0, games: 0 }
    var svg = buildSvg({
      name: p.name,
      rank: p.rank,
      pts: p.pts,
      wins: p.wins,
      top4: p.top4,
      games: p.games,
      variant: req.query.v || 'profile',
      place: req.query.place ? parseInt(req.query.place, 10) : null,
      placePts: req.query.pts ? parseInt(req.query.pts, 10) : null
    })
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')
    res.status(200).send(svg)
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) })
  }
}
