// Vercel serverless function — Stripe Checkout session creator
// Requires: STRIPE_SECRET_KEY in Vercel env vars
// Optional: STRIPE_PRO_PRICE_ID, STRIPE_HOST_PRICE_ID

import Stripe from 'stripe';

const PRO_PRICE_ID  = process.env.STRIPE_PRO_PRICE_ID;
const HOST_PRICE_ID = process.env.STRIPE_HOST_PRICE_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan, userId, email, successUrl, cancelUrl } = req.body ?? {};

  if (!plan || !email) return res.status(400).json({ error: 'plan and email are required' });
  if (!['pro', 'host'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });

  const priceId = plan === 'pro' ? PRO_PRICE_ID : HOST_PRICE_ID;
  if (!priceId) return res.status(500).json({ error: `STRIPE_${plan.toUpperCase()}_PRICE_ID not set` });

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: userId ?? '', plan },
      success_url: successUrl ?? `${req.headers.origin}/#account?checkout=success`,
      cancel_url:  cancelUrl  ?? `${req.headers.origin}/#pricing`,
      subscription_data: {
        metadata: { userId: userId ?? '', plan },
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
