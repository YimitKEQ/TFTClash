// /api/public-players -- read-only public leaderboard JSON
// Third parties build on top: stat trackers, Discord bots, custom dashboards.
// Caches aggressively at the edge.

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    return res.status(500).json({ error: 'Public API not configured' })
  }

  var limit = Math.min(parseInt((req.query && req.query.limit) || '100', 10) || 100, 500)
  var region = req.query && req.query.region ? String(req.query.region).slice(0, 20) : ''

  var sb = createClient(url, key, { auth: { persistSession: false } })

  try {
    var query = sb
      .from('players')
      .select('id,name,rank,region,season_pts,wins,top4,games')
      .order('season_pts', { ascending: false })
      .limit(limit)
    if (region) query = query.eq('region', region)

    var resp = await query
    if (resp.error) {
      return res.status(500).json({ error: 'Query failed' })
    }

    var sanitized = (resp.data || []).map(function (p) {
      return {
        id: p.id,
        name: p.name,
        rank: p.rank,
        region: p.region,
        season_pts: p.season_pts || 0,
        wins: p.wins || 0,
        top4: p.top4 || 0,
        games: p.games || 0,
      }
    })

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    return res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      count: sanitized.length,
      data: sanitized,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Server error' })
  }
}
