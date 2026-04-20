// Vercel cron endpoint — writes day-3 and day-7 retention notifications
// for players created in those cohorts. Idempotent per (user_id, variant).
//
// Scheduled via vercel.json crons; also callable manually with x-ping-secret.
// POST only. Auth: Vercel-Cron header (set by platform) OR x-ping-secret match.

import { createClient } from '@supabase/supabase-js';

var D3 = {
  variant: 'retention_d3',
  title: 'Your first clash is waiting',
  message: 'Your first weekly TFT Clash is just around the corner. Register your spot on the events page.',
  action_url: '/events'
};
var D7 = {
  variant: 'retention_d7',
  title: 'See where you stack up',
  message: 'Seven days in. Check the live leaderboard and climb the seasonal standings with another clash this Saturday.',
  action_url: '/leaderboard'
};

function isAuthorised(req) {
  // Vercel automatically adds `x-vercel-cron: 1` on scheduled invocations.
  if (req.headers['x-vercel-cron']) return true;
  var secret = process.env.PING_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  return req.headers['x-ping-secret'] === secret;
}

function buildClient() {
  var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function notifyCohort(client, opts) {
  // opts: { dayOffset, variant, title, message, action_url }
  var now = Date.now();
  var dayMs = 24 * 60 * 60 * 1000;
  // 24-hour window around (now - dayOffset days)
  var upper = new Date(now - (opts.dayOffset - 0.5) * dayMs).toISOString();
  var lower = new Date(now - (opts.dayOffset + 0.5) * dayMs).toISOString();

  var lookup = await client
    .from('players')
    .select('auth_user_id, created_at, username')
    .gte('created_at', lower)
    .lt('created_at', upper)
    .not('auth_user_id', 'is', null);

  if (lookup.error) {
    return { variant: opts.variant, error: lookup.error.message };
  }
  var players = lookup.data || [];
  if (players.length === 0) return { variant: opts.variant, skipped: 0, written: 0 };

  var userIds = players.map(function(p) { return p.auth_user_id; });

  // Skip users already notified for this variant (idempotency).
  var existing = await client
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .ilike('title', opts.title);
  var alreadyNotified = {};
  (existing.data || []).forEach(function(row) { alreadyNotified[row.user_id] = true; });

  var rows = [];
  players.forEach(function(p) {
    if (alreadyNotified[p.auth_user_id]) return;
    rows.push({
      user_id: p.auth_user_id,
      type: 'info',
      title: opts.title,
      message: opts.message,
      action_url: opts.action_url,
      read: false
    });
  });

  if (rows.length === 0) return { variant: opts.variant, skipped: players.length, written: 0 };

  var ins = await client.from('notifications').insert(rows);
  if (ins.error) return { variant: opts.variant, error: ins.error.message };
  return { variant: opts.variant, skipped: players.length - rows.length, written: rows.length };
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorised(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    var client = buildClient();
    var d3 = await notifyCohort(client, Object.assign({ dayOffset: 3 }, D3));
    var d7 = await notifyCohort(client, Object.assign({ dayOffset: 7 }, D7));
    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      results: [d3, d7]
    });
  } catch (err) {
    console.error('[cron-retention] error:', err && err.message);
    return res.status(500).json({ ok: false, error: err && err.message });
  }
}
