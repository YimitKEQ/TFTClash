// /api/public — read-only public JSON, multiplexed by ?type=
// Consolidates public-players and public-tournaments into one Vercel function
// (Hobby plan caps at 12). Old URLs are preserved via vercel.json rewrites.

import { createClient } from '@supabase/supabase-js'

function getClient() {
  var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  var key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function handlePlayers(req, res, sb) {
  var limit = Math.min(parseInt((req.query && req.query.limit) || '100', 10) || 100, 500)
  var region = req.query && req.query.region ? String(req.query.region).slice(0, 20) : ''

  var query = sb
    .from('players')
    .select('id,name,rank,region,season_pts,wins,top4,games')
    .order('season_pts', { ascending: false })
    .limit(limit)
  if (region) query = query.eq('region', region)

  var resp = await query
  if (resp.error) return res.status(500).json({ error: 'Query failed' })

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
}

async function handleTournaments(req, res, sb) {
  var limit = Math.min(parseInt((req.query && req.query.limit) || '50', 10) || 50, 200)
  var status = req.query && req.query.status ? String(req.query.status).slice(0, 20) : 'upcoming'
  var region = req.query && req.query.region ? String(req.query.region).slice(0, 20) : ''

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
  if (resp.error) return res.status(500).json({ error: 'Query failed' })

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
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  var type = req.query && req.query.type ? String(req.query.type).toLowerCase() : ''
  if (type !== 'players' && type !== 'tournaments') {
    return res.status(400).json({ error: 'Missing or invalid ?type (expected: players | tournaments)' })
  }

  var sb = getClient()
  if (!sb) return res.status(500).json({ error: 'Public API not configured' })

  try {
    if (type === 'players') return await handlePlayers(req, res, sb)
    return await handleTournaments(req, res, sb)
  } catch (e) {
    return res.status(500).json({ error: 'Server error' })
  }
}
