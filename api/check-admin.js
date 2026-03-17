// Vercel serverless function — replaces the Supabase Edge Function
// Deploy: happens automatically when you push to Vercel
// Set ADMIN_PASSWORD in Vercel dashboard → Settings → Environment Variables

import crypto from 'crypto';

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
export default function handler(req, res) {
  // CORS — same-origin only
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

  // Server-side config check
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) {
    return res.status(500).json({ isAdmin: false, error: 'ADMIN_PASSWORD not set' });
  }

  // Constant-time comparison to prevent timing attacks
  const pwBuf = Buffer.from(password);
  const adminBuf = Buffer.from(adminPw);

  const isMatch =
    pwBuf.length === adminBuf.length &&
    crypto.timingSafeEqual(pwBuf, adminBuf);

  if (!isMatch) {
    console.warn(`[check-admin] Failed login attempt from ${ip} at ${new Date().toISOString()}`);
  }

  res.json({ isAdmin: isMatch });
}
