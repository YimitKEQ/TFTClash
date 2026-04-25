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
