// Vercel serverless function — replaces the Supabase Edge Function
// Deploy: happens automatically when you push to Vercel
// Set ADMIN_PASSWORD in Vercel dashboard → Settings → Environment Variables

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter (IP-based, 10 attempts / 5 min)
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 10;
const attempts = new Map();          // ip → [timestamp, …]

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  const prev = attempts.get(ip) ?? [];
  const recent = prev.filter(t => t > windowStart);

  recent.push(now);
  attempts.set(ip, recent);

  return recent.length > RATE_MAX;
}

function retryAfterSeconds(ip) {
  const entries = attempts.get(ip) ?? [];
  if (entries.length === 0) return 0;
  const oldest = entries[0];
  return Math.ceil((oldest + RATE_WINDOW_MS - Date.now()) / 1000);
}

// Periodic cleanup so the Map doesn't grow unbounded
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [ip, timestamps] of attempts) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) {
      attempts.delete(ip);
    } else {
      attempts.set(ip, fresh);
    }
  }
}, RATE_WINDOW_MS);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // CORS — restrict to known origins
  const allowedOrigins = [
    'https://tft-clash.vercel.app',
    'https://tftclash.com',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const origin = req.headers.origin ?? '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Content-Type check
  const ct = (req.headers['content-type'] ?? '').toLowerCase();
  if (!ct.includes('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';
  if (isRateLimited(ip)) {
    const retryAfter = retryAfterSeconds(ip);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  // Input validation
  const { password } = req.body ?? {};
  if (typeof password !== 'string' || password.length === 0 || password.length > 128) {
    return res.status(400).json({ isAdmin: false, error: 'Invalid password input' });
  }

  // Derive userId from auth token (never trust body)
  let userId = null;
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ') && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data } = await supabaseAuth.auth.getUser(authHeader.replace('Bearer ', ''));
      if (data && data.user) userId = data.user.id;
    } catch (e) { /* token invalid, userId stays null */ }
  }

  // Server-side config check
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) {
    return res.status(500).json({ isAdmin: false, error: 'ADMIN_PASSWORD not set' });
  }

  // Require a valid authenticated session — never grant admin without identity
  if (!userId) {
    console.warn(`[check-admin] Admin attempt without valid session from ${ip}`);
    return res.status(401).json({ isAdmin: false, error: 'Valid session required' });
  }

  // Constant-time comparison to prevent timing attacks
  // Hash both sides so timingSafeEqual always compares equal-length buffers,
  // eliminating the length-leak timing oracle.
  const hash = (b) => crypto.createHash('sha256').update(b).digest();
  const isMatch = crypto.timingSafeEqual(hash(Buffer.from(password)), hash(Buffer.from(adminPw)));

  if (!isMatch) {
    console.warn(`[check-admin] Failed login attempt from ${ip} at ${new Date().toISOString()}`);
    return res.json({ isAdmin: false });
  }

  // On success, ensure user_roles entry exists so RLS admin policies work
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('user_roles').upsert(
      { user_id: userId, role: 'admin' },
      { onConflict: 'user_id,role' }
    );
  } catch (err) {
    console.error('[check-admin] user_roles upsert failed:', err.message);
    return res.status(500).json({ isAdmin: false, error: 'Failed to provision admin role' });
  }

  res.json({ isAdmin: true });
}
