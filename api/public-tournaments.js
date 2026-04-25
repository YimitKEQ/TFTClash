// /api/public-tournaments -- read-only public tournament JSON
// Returns upcoming + recently completed events for third-party integration.

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

  var limit = Math.min(parseInt((req.query && req.query.limit) || '50', 10) || 50, 200)
  var status = req.query && req.query.status ? String(req.query.status).slice(0, 20) : 'upcoming'
  var region = req.query && req.query.region ? String(req.query.region).slice(0, 20) : ''

  var sb = createClient(url, key, { auth: { persistSession: false } })

  try {
    var nowIso = new Date().toISOString()
    var query = sb
      .from('scheduled_events')
      .select('id,name,starts_at,ends_at,description,event_type,host,region,max_players')
      .order('starts_at', { ascending: status === 'past' ? false : true })
      .limit(limit)

    if (status === 'upcoming') query = query.gte('starts_at', nowIso)
    else if (status === 'past') query = query.lt('starts_at', nowIso)

    if (region) query = query.eq('region', region)

    var resp = await query
    if (resp.error) {
      return res.status(500).json({ error: 'Query failed' })
    }

    var sanitized = (resp.data || []).map(function (t) {
      return {
        id: t.id,
        name: t.name,
        host: t.host,
        starts_at: t.starts_at,
        ends_at: t.ends_at,
        description: t.description,
        event_type: t.event_type,
        region: t.region,
        max_players: t.max_players,
        url: 'https://tftclash.com/tournament/' + t.id,
      }
    })

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    return res.status(200).json({
      ok: true,
      generated_at: new Date().toISOString(),
      filter: { status: status, region: region || null, limit: limit },
      count: sanitized.length,
      data: sanitized,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Server error' })
  }
}
