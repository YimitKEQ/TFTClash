// /api/cron — background jobs, multiplexed by ?job=
// Consolidates cron-retention-notify and ping-search-engines into one Vercel
// function (Hobby plan caps at 12). Old URLs are preserved via rewrites.
//
// Jobs:
//   ?job=retention-notify  — writes day-3/day-7 retention notifications.
//   ?job=ping-search       — pings IndexNow (Bing/Yandex) with sitemap URLs.
//
// Auth: x-vercel-cron header (platform) OR x-ping-secret header.

import { createClient } from '@supabase/supabase-js'

function isAuthorised(req) {
  if (req.headers['x-vercel-cron']) return true
  var secret = process.env.PING_SECRET
  if (!secret) return false
  return req.headers['x-ping-secret'] === secret
}

// ----- retention-notify -----

var D3 = {
  variant: 'retention_d3',
  title: 'Your first clash is waiting',
  message: 'Your first weekly TFT Clash is just around the corner. Register your spot on the events page.',
  action_url: '/events'
}
var D7 = {
  variant: 'retention_d7',
  title: 'See where you stack up',
  message: 'Seven days in. Check the live leaderboard and climb the seasonal standings in the next clash.',
  action_url: '/leaderboard'
}

function buildSupabase() {
  var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function notifyCohort(client, opts) {
  var now = Date.now()
  var dayMs = 24 * 60 * 60 * 1000
  var upper = new Date(now - (opts.dayOffset - 0.5) * dayMs).toISOString()
  var lower = new Date(now - (opts.dayOffset + 0.5) * dayMs).toISOString()

  var lookup = await client
    .from('players')
    .select('auth_user_id, created_at, username')
    .gte('created_at', lower)
    .lt('created_at', upper)
    .not('auth_user_id', 'is', null)

  if (lookup.error) return { variant: opts.variant, error: lookup.error.message }
  var players = lookup.data || []
  if (players.length === 0) return { variant: opts.variant, skipped: 0, written: 0 }

  var userIds = players.map(function (p) { return p.auth_user_id })

  var existing = await client
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('variant', opts.variant)
  var alreadyNotified = {};
  (existing.data || []).forEach(function (row) { alreadyNotified[row.user_id] = true })

  var rows = []
  players.forEach(function (p) {
    if (alreadyNotified[p.auth_user_id]) return
    rows.push({
      user_id: p.auth_user_id,
      type: 'info',
      title: opts.title,
      message: opts.message,
      action_url: opts.action_url,
      variant: opts.variant,
      read: false
    })
  })

  if (rows.length === 0) return { variant: opts.variant, skipped: players.length, written: 0 }

  // notifications has no (user_id, variant) unique index, so onConflict on
  // .insert() would be a silent no-op. The pre-check above is the dedup gate.
  var ins = await client
    .from('notifications')
    .insert(rows)
  if (ins.error) return { variant: opts.variant, error: ins.error.message }
  return { variant: opts.variant, skipped: players.length - rows.length, written: rows.length }
}

async function runRetentionNotify(req, res) {
  try {
    var client = buildSupabase()
    var d3 = await notifyCohort(client, Object.assign({ dayOffset: 3 }, D3))
    var d7 = await notifyCohort(client, Object.assign({ dayOffset: 7 }, D7))
    return res.status(200).json({
      ok: true,
      job: 'retention-notify',
      timestamp: new Date().toISOString(),
      results: [d3, d7]
    })
  } catch (err) {
    console.error('[cron-retention] error:', err && err.message)
    return res.status(500).json({ ok: false, error: err && err.message })
  }
}

// ----- ping-search -----

var SITE_DOMAIN = 'https://tftclash.com'
var URLS = [
  SITE_DOMAIN + '/',
  SITE_DOMAIN + '/leaderboard',
  SITE_DOMAIN + '/standings',
  SITE_DOMAIN + '/bracket',
  SITE_DOMAIN + '/results',
  SITE_DOMAIN + '/hall-of-fame',
  SITE_DOMAIN + '/events',
  SITE_DOMAIN + '/archive',
  SITE_DOMAIN + '/milestones',
  SITE_DOMAIN + '/challenges',
  SITE_DOMAIN + '/pricing',
  SITE_DOMAIN + '/rules',
  SITE_DOMAIN + '/faq',
  SITE_DOMAIN + '/signup',
  SITE_DOMAIN + '/tft-clash-weekly-tournament.html',
  SITE_DOMAIN + '/how-to-host-tft-tournament.html',
  SITE_DOMAIN + '/tft-tournament-points-system.html',
  SITE_DOMAIN + '/free-tft-tournament-platform.html',
]

async function runPingSearch(req, res) {
  var INDEXNOW_KEY = process.env.INDEXNOW_KEY || ''
  if (!INDEXNOW_KEY) return res.status(503).json({ error: 'INDEXNOW_KEY not configured' })

  var body = JSON.stringify({
    host: 'tftclash.com',
    key: INDEXNOW_KEY,
    keyLocation: SITE_DOMAIN + '/tftclash-indexnow.txt',
    urlList: URLS,
  })

  var results = {}
  try {
    var bingRes = await fetch('https://www.bing.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body,
    })
    results.bing = bingRes.status
  } catch (err) {
    results.bing = 'error: ' + err.message
  }

  try {
    var indexnowRes = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body,
    })
    results.indexnow = indexnowRes.status
  } catch (err) {
    results.indexnow = 'error: ' + err.message
  }

  console.log('[SEO] IndexNow ping results:', results)

  return res.status(200).json({
    ok: true,
    job: 'ping-search',
    pinged: URLS.length + ' URLs',
    results: results,
    timestamp: new Date().toISOString(),
  })
}

// ----- entry point -----

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorised(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  var job = req.query && req.query.job ? String(req.query.job).toLowerCase() : ''
  if (job === 'retention-notify') return runRetentionNotify(req, res)
  if (job === 'ping-search') return runPingSearch(req, res)
  return res.status(400).json({ error: 'Missing or invalid ?job (expected: retention-notify | ping-search)' })
}
