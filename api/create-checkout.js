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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan, userId, email, successUrl, cancelUrl } = req.body ?? {};

  if (!plan || !email) return res.status(400).json({ error: 'plan and email are required' });
  if (!PRICE_MAP[plan]) return res.status(400).json({ error: 'Invalid plan: ' + plan });

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
      success_url: successUrl ?? `${req.headers.origin}/#account?checkout=success`,
      cancel_url:  cancelUrl  ?? `${req.headers.origin}/#pricing`,
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
