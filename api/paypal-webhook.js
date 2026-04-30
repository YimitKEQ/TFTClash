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
  // Server-side only: use PAYPAL_PLAN_* env vars (VITE_ prefix not available server-side)
  var proPlan    = process.env.PAYPAL_PLAN_PRO;
  var scrimPlan  = process.env.PAYPAL_PLAN_SCRIM;
  var bundlePlan = process.env.PAYPAL_PLAN_BUNDLE;
  var hostPlan   = process.env.PAYPAL_PLAN_HOST;
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
  var clientId = process.env.PAYPAL_CLIENT_ID;
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

async function verifyWebhookSignature(headers, rawBody, webhookId, parsedEvent) {
  // Validate cert_url domain to prevent SSRF
  var certUrl = headers['paypal-cert-url'] || '';
  if (!/^https:\/\/api\.paypal\.com\//.test(certUrl) && !/^https:\/\/api-m\.paypal\.com\//.test(certUrl) && !/^https:\/\/api\.sandbox\.paypal\.com\//.test(certUrl) && !/^https:\/\/api-m\.sandbox\.paypal\.com\//.test(certUrl)) {
    throw new Error('Invalid cert_url domain: ' + certUrl);
  }

  var auth = await getPayPalAccessToken();

  var resp = await fetch(auth.baseUrl + '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + auth.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: certUrl,
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: parsedEvent,
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

  // Parse body once
  var event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (parseErr) {
    console.error('PayPal webhook: invalid JSON body');
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Verify signature
  try {
    var verified = await verifyWebhookSignature(req.headers, rawBody, webhookId, event);
    if (!verified) {
      console.error('PayPal webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('PayPal webhook verify error:', err.message);
    return res.status(400).json({ error: 'Signature verification error' });
  }
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
    if (dedupRes.error) {
      console.error('Webhook dedup check failed:', dedupRes.error.message);
      return res.status(500).json({ error: 'Dedup check failed' });
    }
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

        // Out-of-order guard: don't overwrite a more-recent cancelled/suspended
        // record for the same user. We compare current_period_start dates: if
        // the existing row's start is later than this event's, we ignore it.
        var existingRes = await supabase.from('user_subscriptions')
          .select('current_period_start, status, provider_subscription_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (!existingRes.error && existingRes.data) {
          var existing = existingRes.data;
          var existingStart = existing.current_period_start ? new Date(existing.current_period_start).getTime() : 0;
          var eventStart = new Date(startTime).getTime();
          if (existingStart > eventStart && existing.provider_subscription_id !== subscriptionId) {
            // A newer subscription is already on file - don't downgrade it.
            console.warn('PayPal webhook: skipping ACTIVATED for stale subscription', subscriptionId);
            break;
          }
        }

        var activateRes = await supabase.from('user_subscriptions').upsert({
          user_id: userId,
          tier: tier || 'pro',
          provider: 'paypal',
          provider_subscription_id: subscriptionId,
          status: 'active',
          current_period_start: startTime,
          current_period_end: nextBilling,
          cancel_at_period_end: false,
        }, { onConflict: 'user_id' });
        if (activateRes.error) throw new Error('ACTIVATED upsert failed: ' + activateRes.error.message);
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        // Out-of-order delivery guard: only flip to cancelled if this event's
        // subscription matches what we have on file. Without this, a delayed
        // CANCELLED for an old subscription could clobber a freshly-ACTIVATED
        // one (same user_id, different provider_subscription_id).
        var cancelQuery = supabase.from('user_subscriptions')
          .update({
            status: 'cancelled',
            cancel_at_period_end: true,
          })
          .eq('user_id', userId);
        if (subscriptionId) cancelQuery = cancelQuery.eq('provider_subscription_id', subscriptionId);
        var cancelRes = await cancelQuery;
        if (cancelRes.error) throw new Error('CANCELLED update failed: ' + cancelRes.error.message);
        break;
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        var suspendQuery = supabase.from('user_subscriptions')
          .update({ status: 'suspended' })
          .eq('user_id', userId);
        if (subscriptionId) suspendQuery = suspendQuery.eq('provider_subscription_id', subscriptionId);
        var suspendRes = await suspendQuery;
        if (suspendRes.error) throw new Error('SUSPENDED update failed: ' + suspendRes.error.message);
        break;
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        var updates = { provider_subscription_id: subscriptionId };
        if (tier) updates.tier = tier;
        if (resource.billing_info && resource.billing_info.next_billing_time) {
          updates.current_period_end = resource.billing_info.next_billing_time;
        }
        var updateRes = await supabase.from('user_subscriptions')
          .update(updates)
          .eq('user_id', userId);
        if (updateRes.error) throw new Error('UPDATED update failed: ' + updateRes.error.message);
        break;
      }

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        // Same out-of-order guard: a payment-failed event for an old sub
        // should not flip a fresh active sub on the same user_id to past_due.
        var failQuery = supabase.from('user_subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', userId);
        if (subscriptionId) failQuery = failQuery.eq('provider_subscription_id', subscriptionId);
        var failRes = await failQuery;
        if (failRes.error) throw new Error('PAYMENT.FAILED update failed: ' + failRes.error.message);
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
