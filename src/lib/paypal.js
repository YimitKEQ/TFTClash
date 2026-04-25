// PayPal Subscriptions integration (link-based, no SDK)
// Usage: import { getSubscribeUrl, PAYPAL_PLANS, TIER_PRICES } from './lib/paypal.js';

// ─── Plan IDs ─────────────────────────────────────────────────────────────────

var CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';

export var PAYPAL_PLANS = {
  pro:    import.meta.env.VITE_PAYPAL_PLAN_PRO    || '',
  scrim:  import.meta.env.VITE_PAYPAL_PLAN_SCRIM  || '',
  bundle: import.meta.env.VITE_PAYPAL_PLAN_BUNDLE || '',
  host:   import.meta.env.VITE_PAYPAL_PLAN_HOST   || '',
};

export var TIER_PRICES = {
  free:   0,
  pro:    4.99,
  scrim:  7.99,
  bundle: 9.99,
  host:   19.99,
};

export var TIER_LABELS = {
  free:   'Player',
  pro:    'Pro',
  scrim:  'Scrim Pass',
  bundle: 'Pro + Scrim',
  host:   'Host',
};

// ─── Donate URL ──────────────────────────────────────────────────────────────
// One-time PayPal donation link. No account needed on our side.
export var DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=' + (import.meta.env.VITE_PAYPAL_DONATE_ID || '');

export function getDonateUrl() {
  var id = import.meta.env.VITE_PAYPAL_DONATE_ID || '';
  if (id) return 'https://www.paypal.com/donate/?hosted_button_id=' + encodeURIComponent(id);
  return 'https://paypal.me/monkelodie';
}

// ─── Subscribe URL ────────────────────────────────────────────────────────────
// Builds a direct PayPal subscription URL. User clicks our styled button,
// gets redirected to PayPal checkout, then comes back to /account?checkout=success.

export function getSubscribeUrl(tier, authUserId) {
  var planId = PAYPAL_PLANS[tier];
  if (!planId) return null;
  // SECURITY: never include tier in the return URL — PayPal webhook derives tier from plan_id server-side.
  var returnUrl = window.location.origin + '/account?checkout=success';
  var cancelUrl = window.location.origin + '/pricing';
  return 'https://www.paypal.com/webapps/billing/plans/subscribe'
    + '?plan_id=' + encodeURIComponent(planId)
    + '&custom_id=' + encodeURIComponent(authUserId || '')
    + '&return_url=' + encodeURIComponent(returnUrl)
    + '&cancel_url=' + encodeURIComponent(cancelUrl);
}

// ─── Activate Subscription (client-side) ──────────────────────────────────────
// After PayPal redirects back, record the subscription in the DB.
// The webhook will also fire and update the record, but this gives instant feedback.

// SECURITY: tier and activation status are ONLY set by the PayPal webhook (service role).
// The client polls for the webhook-created record — it never writes subscription data itself.
// This prevents any path where a client can forge their subscription tier.
export function pollForSubscription(supabase, userId, opts) {
  opts = opts || {};
  var attempts = opts.attempts || 10;
  var intervalMs = opts.intervalMs || 1500;
  return new Promise(function(resolve) {
    var tries = 0;
    function attempt() {
      tries++;
      supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .then(function(resp) {
          var row = resp && resp.data && resp.data[0];
          if (row && (row.status === 'active' || row.status === 'pending')) {
            resolve(row);
            return;
          }
          if (tries >= attempts) {
            resolve(null);
            return;
          }
          setTimeout(attempt, intervalMs);
        })
        .catch(function() {
          if (tries >= attempts) {
            resolve(null);
            return;
          }
          setTimeout(attempt, intervalMs);
        });
    }
    attempt();
  });
}

// ─── Cancel Subscription ──────────────────────────────────────────────────────
// Calls the server endpoint which talks to PayPal upstream and flags the row.
// The webhook then sets status='cancelled' once PayPal confirms.

export function cancelSubscription(supabase, _userId) {
  return supabase.auth.getSession().then(function(s) {
    var token = s && s.data && s.data.session && s.data.session.access_token;
    if (!token) throw new Error('Not authenticated');
    return fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({}),
    }).then(function(resp) {
      return resp.json().then(function(body) {
        if (!resp.ok) throw new Error(body && body.error ? body.error : 'Cancellation failed');
        return body.data || null;
      });
    });
  });
}

// ─── Get Subscription ─────────────────────────────────────────────────────────

export function getSubscription(supabase, userId) {
  if (!userId) return Promise.resolve(null);
  return supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
    .then(function(resp) {
      return resp.data || null;
    });
}

// ─── Check if PayPal is configured ────────────────────────────────────────────

export function isPayPalConfigured() {
  return !!CLIENT_ID && Object.values(PAYPAL_PLANS).some(function(id) { return !!id; });
}
