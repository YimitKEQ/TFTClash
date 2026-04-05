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
  host:   24.99,
};

export var TIER_LABELS = {
  free:   'Player',
  pro:    'Pro',
  scrim:  'Scrim Pass',
  bundle: 'Pro + Scrim',
  host:   'Host',
};

// ─── Subscribe URL ────────────────────────────────────────────────────────────
// Builds a direct PayPal subscription URL. User clicks our styled button,
// gets redirected to PayPal checkout, then comes back to /account?checkout=success.

export function getSubscribeUrl(tier, authUserId) {
  var planId = PAYPAL_PLANS[tier];
  if (!planId) return null;
  var returnUrl = window.location.origin + '/account?checkout=success&tier=' + tier;
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

// Client-side: writes as 'pending'. Only the webhook (service role) sets 'active'.
// This gives instant UI feedback while preventing users from self-activating.
export function activateSubscription(supabase, userId, tier, subscriptionId) {
  return supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      tier: tier,
      provider: 'paypal',
      provider_subscription_id: subscriptionId || '',
      status: 'pending',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
    }, { onConflict: 'user_id' })
    .select()
    .single()
    .then(function(resp) {
      if (resp.error) throw resp.error;
      return resp.data;
    });
}

// ─── Cancel Subscription ──────────────────────────────────────────────────────

export function cancelSubscription(supabase, userId) {
  return supabase
    .from('user_subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('user_id', userId)
    .select()
    .single()
    .then(function(resp) {
      if (resp.error) throw resp.error;
      return resp.data;
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
