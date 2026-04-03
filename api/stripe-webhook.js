// Vercel serverless function — Stripe webhook handler
// Requires: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET in Vercel env vars
// Also requires: SUPABASE_SERVICE_ROLE_KEY (for writing subscription status)
//
// In Stripe dashboard → Webhooks → Add endpoint:
//   URL: https://your-domain.vercel.app/api/stripe-webhook
//   Events: customer.subscription.created, customer.subscription.updated,
//            customer.subscription.deleted, checkout.session.completed

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const MAX_BODY_BYTES = 64 * 1024; // 64 KB

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on('data', c => {
      totalBytes += c.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripeKey  = process.env.STRIPE_SECRET_KEY;
  const webhookSec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSec) return res.status(500).json({ error: 'Stripe not configured' });

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('Webhook body error:', err.message);
    return res.status(413).json({ error: 'Request body too large' });
  }

  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSec);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Supabase admin client for writing subscription status
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  async function upsertSubscription(userId, plan, status, stripeCustomerId, stripeSubId) {
    if (!userId) return;
    const { error } = await supabase.from('subscriptions').upsert({
      user_id: userId,
      plan,
      status,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) {
      console.error('Subscription upsert failed:', error.message);
      throw new Error('Subscription DB write failed: ' + error.message);
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, plan } = session.metadata ?? {};
        await upsertSubscription(userId, plan, 'active', session.customer, session.subscription);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const { userId, plan } = sub.metadata ?? {};
        await upsertSubscription(userId, plan, sub.status, sub.customer, sub.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const { userId } = sub.metadata ?? {};
        if (userId) {
          await supabase.from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('user_id', userId);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook handler error [${event.type}]:`, err.message);
    res.status(500).json({ error: err.message });
  }
}
