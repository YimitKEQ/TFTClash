// Vercel serverless function - PayPal webhook handler
// Requires in Vercel env vars:
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// In PayPal Developer Dashboard > Webhooks > Add webhook:
//   URL: https://your-domain.vercel.app/api/paypal-webhook
//   Events: BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
//           BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.EXPIRED,
//           BILLING.SUBSCRIPTION.UPDATED, BILLING.SUBSCRIPTION.PAYMENT.FAILED

import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

var MAX_BODY_BYTES = 64 * 1024;

// ── Tier lookup from PayPal plan ID ─────────────────────────────────────────

var PLAN_TO_TIER = {};

function buildPlanMap() {
  // Server-side: use PAYPAL_PLAN_* (non-VITE_ prefixed) env vars.
  // Falls back to VITE_ prefix for local dev compatibility.
  var proPlan    = process.env.PAYPAL_PLAN_PRO    || process.env.VITE_PAYPAL_PLAN_PRO;
  var scrimPlan  = process.env.PAYPAL_PLAN_SCRIM  || process.env.VITE_PAYPAL_PLAN_SCRIM;
  var bundlePlan = process.env.PAYPAL_PLAN_BUNDLE || process.env.VITE_PAYPAL_PLAN_BUNDLE;
  var hostPlan   = process.env.PAYPAL_PLAN_HOST   || process.env.VITE_PAYPAL_PLAN_HOST;
  if (proPlan)    PLAN_TO_TIER[proPlan]    = 'pro';
  if (scrimPlan)  PLAN_TO_TIER[scrimPlan]  = 'scrim';
  if (bundlePlan) PLAN_TO_TIER[bundlePlan] = 'bundle';
  if (hostPlan)   PLAN_TO_TIER[hostPlan]   = 'host';
}

// ── Raw body reader ─────────────────────────────────────────────────────────

function getRawBody(req) {
  return new Promise(function(resolve, reject) {
    var chunks = [];
    var totalBytes = 0;
    req.on('data', function(c) {
      totalBytes += c.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', function() { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

// ── PayPal webhook signature verification ───────────────────────────────────
// Uses PayPal's /v1/notifications/verify-webhook-signature endpoint.

async function getPayPalAccessToken() {
  var clientId = process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID;
  var secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PayPal credentials not configured');

  var baseUrl = (process.env.PAYPAL_MODE === 'sandbox')
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com';

  var resp = await fetch(baseUrl + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) throw new Error('PayPal auth failed: ' + resp.status);
  var data = await resp.json();
  return { token: data.access_token, baseUrl: baseUrl };
}

async function verifyWebhookSignature(headers, rawBody, webhookId) {
  var auth = await getPayPalAccessToken();

  var resp = await fetch(auth.baseUrl + '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + auth.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody.toString()),
    }),
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('Webhook verify failed: ' + resp.status + ' ' + errText);
  }

  var result = await resp.json();
  return result.verification_status === 'SUCCESS';
}

// ── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  var webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return res.status(500).json({ error: 'PayPal webhook not configured' });

  buildPlanMap();

  var rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(413).json({ error: 'Request body too large' });
  }

  // Verify signature
  try {
    var verified = await verifyWebhookSignature(req.headers, rawBody, webhookId);
    if (!verified) {
      console.error('PayPal webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('PayPal webhook verify error:', err.message);
    return res.status(400).json({ error: 'Signature verification error' });
  }

  var event = JSON.parse(rawBody.toString());
  var eventType = event.event_type;
  var resource = event.resource || {};

  // Supabase admin client
  var supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Idempotency: deduplicate webhook events (atomic upsert) ────────────���─
  var eventId = event.id || null;
  if (eventId) {
    // Atomic check: upsert returns the row; if it already existed with a
    // processed_at timestamp, this is a duplicate we already handled.
    var dedupRes = await supabase
      .from('webhook_events')
      .upsert({
        event_id: eventId,
        event_type: eventType,
        received_at: new Date().toISOString()
      }, { onConflict: 'event_id', ignoreDuplicates: false })
      .select('processed_at')
      .single();
    if (dedupRes.data && dedupRes.data.processed_at) {
      // Already fully processed this event
      return res.json({ received: true, duplicate: true });
    }
  }

  // Extract user ID from custom_id (we pass it when creating the subscription)
  var userId = resource.custom_id || null;
  var subscriptionId = resource.id || null;
  var planId = resource.plan_id || null;
  var tier = planId ? (PLAN_TO_TIER[planId] || null) : null;

  // If no userId from custom_id, try to look up by subscription ID
  if (!userId && subscriptionId) {
    var lookup = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('provider_subscription_id', subscriptionId)
      .single();
    if (lookup.data) userId = lookup.data.user_id;
  }

  if (!userId) {
    console.error('PayPal webhook: could not determine user_id for subscription', subscriptionId);
    return res.json({ received: true, warning: 'no user_id found' });
  }

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        var startTime = resource.start_time || new Date().toISOString();
        var billingInfo = resource.billing_info || {};
        var nextBilling = billingInfo.next_billing_time || null;

        await supabase.from('user_subscriptions').upsert({
          user_id: userId,
          tier: tier || 'pro',
          provider: 'paypal',
          provider_subscription_id: subscriptionId,
          status: 'active',
          current_period_start: startTime,
          current_period_end: nextBilling,
          cancel_at_period_end: false,
        }, { onConflict: 'user_id' });
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        await supabase.from('user_subscriptions')
          .update({
            status: 'cancelled',
            cancel_at_period_end: true,
          })
          .eq('user_id', userId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        await supabase.from('user_subscriptions')
          .update({ status: 'suspended' })
          .eq('user_id', userId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        var updates = { provider_subscription_id: subscriptionId };
        if (tier) updates.tier = tier;
        if (resource.billing_info && resource.billing_info.next_billing_time) {
          updates.current_period_end = resource.billing_info.next_billing_time;
        }
        await supabase.from('user_subscriptions')
          .update(updates)
          .eq('user_id', userId);
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        await supabase.from('user_subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', userId);
        break;
      }
    }

    // Mark event as fully processed (only after success)
    if (eventId) {
      await supabase.from('webhook_events')
        .update({ processed_at: new Date().toISOString() })
        .eq('event_id', eventId);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('PayPal webhook handler error [' + eventType + ']:', err.message);
    // Don't mark as processed on failure - PayPal will retry
    res.status(500).json({ error: 'internal error' });
  }
}
