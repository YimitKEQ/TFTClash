// Vercel serverless function — Stripe Checkout session creator
// Requires: STRIPE_SECRET_KEY in Vercel env vars
// Optional: STRIPE_PRO_PRICE_ID, STRIPE_HOST_PRICE_ID

import Stripe from 'stripe';

const PRICE_MAP = {
  pro:          process.env.STRIPE_PRO_PRICE_ID,
  pro_annual:   process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  host:         process.env.STRIPE_HOST_PRICE_ID,
  host_annual:  process.env.STRIPE_HOST_ANNUAL_PRICE_ID,
};

// Map variant back to base plan name for metadata
const BASE_PLAN = { pro: 'pro', pro_annual: 'pro', host: 'host', host_annual: 'host' };

// ---------------------------------------------------------------------------
// In-memory rate limiter (IP-based, 20 requests / 60 seconds)
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const attempts = new Map();

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
// Validation helpers
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSameOriginUrl(url, origin) {
  try {
    const parsed = new URL(url);
    const orig = new URL(origin);
    return parsed.origin === orig.origin;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
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
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan, userId, email, successUrl, cancelUrl } = req.body ?? {};

  // Validate required fields
  if (!plan || !email) return res.status(400).json({ error: 'plan and email are required' });
  if (!PRICE_MAP[plan]) return res.status(400).json({ error: 'Invalid plan: ' + plan });

  // Validate email format
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate userId format if provided
  if (userId != null && userId !== '' && !UUID_RE.test(String(userId))) {
    return res.status(400).json({ error: 'Invalid userId format — expected UUID' });
  }

  // Validate redirect URLs — fall back to defaults if not same-origin
  const origin = req.headers.origin ?? '';
  const defaultSuccess = origin ? `${origin}/#account?checkout=success` : undefined;
  const defaultCancel = origin ? `${origin}/#pricing` : undefined;

  const safeSuccessUrl =
    (typeof successUrl === 'string' && isSameOriginUrl(successUrl, origin))
      ? successUrl
      : defaultSuccess;

  const safeCancelUrl =
    (typeof cancelUrl === 'string' && isSameOriginUrl(cancelUrl, origin))
      ? cancelUrl
      : defaultCancel;

  const priceId = PRICE_MAP[plan];
  const basePlan = BASE_PLAN[plan];
  if (!priceId) return res.status(500).json({ error: `Price ID not configured for plan: ${plan}` });

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: userId ?? '', plan: basePlan },
      success_url: safeSuccessUrl,
      cancel_url:  safeCancelUrl,
      subscription_data: {
        metadata: { userId: userId ?? '', plan: basePlan },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
