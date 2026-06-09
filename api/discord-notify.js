// Server-side Discord webhook proxy.
// Webhook URL is read from DISCORD_WEBHOOK_URL env var (Vercel) — never exposed to clients.
// Caller must be an authenticated admin (verified via Supabase JWT).

import { createClient } from '@supabase/supabase-js';

const allowedOrigins = [
  'https://tft-clash.vercel.app',
  'https://tftclash.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  const origin = req.headers.origin ?? '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ct = (req.headers['content-type'] ?? '').toLowerCase();
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  // ── Sentry relay: Sentry webhook → private #admin-alerts channel ─────────
  // URL: /api/discord-notify?source=sentry&secret=<SENTRY_WEBHOOK_SECRET>
  // Sentry cannot send a Supabase JWT, so this branch authenticates with a
  // shared secret and posts ONLY to the dedicated admin alert webhook
  // (DISCORD_ALERT_WEBHOOK_URL) — never the public announcement webhook.
  if (req.query && req.query.source === 'sentry') {
    const secret = process.env.SENTRY_WEBHOOK_SECRET;
    const alertHook = process.env.DISCORD_ALERT_WEBHOOK_URL;
    if (!secret || !alertHook) {
      return res.status(503).json({ error: 'Alert relay not configured' });
    }
    if (req.query.secret !== secret) {
      return res.status(401).json({ error: 'Invalid secret' });
    }

    // Parse defensively: Sentry's legacy WebHooks plugin and the newer
    // issue-alert payloads put the interesting bits in different places.
    const b = req.body ?? {};
    const ev = b.event ?? (b.data && b.data.event) ?? {};
    const issue = (b.data && b.data.issue) ?? {};
    const title = ev.title || b.message || issue.title || 'Sentry alert';
    const level = String(ev.level || b.level || issue.level || 'error').toUpperCase();
    const link = b.url || ev.web_url || issue.permalink || '';
    const project = b.project_name || b.project || (issue.project && issue.project.name) || '';
    const culprit = b.culprit || ev.culprit || issue.culprit || '';

    const embed = {
      title: ('[' + level + '] ' + title).slice(0, 250),
      description: ((culprit ? '`' + String(culprit).slice(0, 200) + '`\n' : '') +
        (link ? '[Open in Sentry](' + link + ')' : '')).slice(0, 2000),
      color: 0xC0392B,
      footer: { text: 'Sentry' + (project ? ' · ' + project : '') },
      timestamp: new Date().toISOString(),
    };

    try {
      const r = await fetch(alertHook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (!r.ok) return res.status(502).json({ error: 'Discord rejected the alert' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(502).json({ error: 'Failed to reach Discord' });
    }
  }

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    return res.status(503).json({ error: 'Discord notifications not configured' });
  }

  // Verify admin via Supabase JWT
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ') || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let userId = null;
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (data && data.user) userId = data.user.id;
    if (!userId) return res.status(401).json({ error: 'Invalid session' });

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'mod']);
    if (!roles || roles.length === 0) {
      return res.status(403).json({ error: 'Admin only' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Auth check failed' });
  }

  const { content } = req.body ?? {};
  if (typeof content !== 'string' || content.length === 0 || content.length > 2000) {
    return res.status(400).json({ error: 'content must be 1-2000 chars' });
  }

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!r.ok) {
      return res.status(502).json({ error: 'Discord rejected the message' });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach Discord' });
  }
}
