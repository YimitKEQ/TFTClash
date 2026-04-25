// Vercel serverless function - Cancel a user's PayPal subscription
// Calls PayPal upstream cancel + flags DB row. Final status is set by the webhook.
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET

import { createClient } from '@supabase/supabase-js';

var ALLOWED_ORIGINS = [
  'https://tftclash.com',
  'https://tft-clash.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

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

async function cancelPayPalSubscription(subscriptionId, reason) {
  var auth = await getPayPalAccessToken();
  // PayPal expects a subscription ID like "I-XXXXXXXX". Reject anything else
  // before we hit the API to avoid path-injection or strange ids.
  if (!/^I-[A-Z0-9]{10,30}$/.test(subscriptionId)) {
    throw new Error('Invalid subscription id format');
  }
  var resp = await fetch(auth.baseUrl + '/v1/billing/subscriptions/' + subscriptionId + '/cancel', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + auth.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: (reason || 'User requested cancellation').slice(0, 128) }),
  });
  // PayPal returns 204 on success, 422 if already cancelled (which we treat as success).
  if (resp.status === 204) return { ok: true };
  if (resp.status === 422) return { ok: true, alreadyCancelled: true };
  var errText = '';
  try { errText = await resp.text(); } catch (e) {}
  throw new Error('PayPal cancel failed: ' + resp.status + ' ' + errText);
}

export default async function handler(req, res) {
  var origin = req.headers.origin || '';
  var allowed = ALLOWED_ORIGINS.indexOf(origin) > -1;

  if (req.method === 'OPTIONS') {
    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Access-Control-Allow-Origin', origin);

  var authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  var token = authHeader.slice(7);

  var supabaseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  var supabase = createClient(supabaseUrl, serviceKey);

  var userRes = await supabase.auth.getUser(token);
  if (userRes.error || !userRes.data || !userRes.data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  var authUserId = userRes.data.user.id;

  try {
    var subRes = await supabase
      .from('user_subscriptions')
      .select('user_id, provider, provider_subscription_id, status, cancel_at_period_end')
      .eq('user_id', authUserId)
      .single();

    if (subRes.error || !subRes.data) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    var sub = subRes.data;

    if (sub.cancel_at_period_end || sub.status === 'cancelled') {
      return res.json({ success: true, alreadyCancelled: true });
    }

    if (sub.provider === 'paypal' && sub.provider_subscription_id) {
      try {
        await cancelPayPalSubscription(sub.provider_subscription_id, 'User cancelled from account page');
      } catch (err) {
        console.error('[cancel-subscription] PayPal upstream cancel failed:', err.message);
        return res.status(502).json({ error: 'Could not cancel with PayPal. Please try again.' });
      }
    }

    var updateRes = await supabase
      .from('user_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('user_id', authUserId)
      .select()
      .single();

    if (updateRes.error) {
      console.error('[cancel-subscription] DB update failed:', updateRes.error.message);
      return res.status(500).json({ error: 'Cancellation flagged with PayPal but failed to update record' });
    }

    return res.json({ success: true, data: updateRes.data });
  } catch (err) {
    console.error('[cancel-subscription] error:', err.message);
    return res.status(500).json({ error: 'Cancellation failed' });
  }
}
