// PayPal Subscriptions integration
// Usage: import { loadPayPal, PAYPAL_PLANS, TIER_PRICES } from './lib/paypal.js';

import { loadScript } from '@paypal/paypal-js';

// ─── Plan IDs ─────────────────────────────────────────────────────────────────
// Set these in .env after creating Subscription Plans in PayPal dashboard.
// Each plan maps to a tier in user_subscriptions.

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

// ─── SDK Loader ───────────────────────────────────────────────────────────────
// Caches the loaded PayPal instance so we only load the script once.

var _paypalPromise = null;
var _paypalInstance = null;

export function loadPayPal() {
  if (_paypalInstance) return Promise.resolve(_paypalInstance);
  if (_paypalPromise) return _paypalPromise;
  if (!CLIENT_ID) {
    return Promise.reject(new Error('VITE_PAYPAL_CLIENT_ID not configured'));
  }
  _paypalPromise = loadScript({
    clientId: CLIENT_ID,
    vault: true,
    intent: 'subscription',
  }).then(function(paypal) {
    _paypalInstance = paypal;
    return paypal;
  }).catch(function(err) {
    _paypalPromise = null;
    throw err;
  });
  return _paypalPromise;
}

// ─── Render Subscribe Button ──────────────────────────────────────────────────
// Renders a hidden PayPal button into a container. Returns a handle with
// a .click() method so we can trigger it from our own styled button.

export function renderSubscribeButton(container, tier, options) {
  var planId = PAYPAL_PLANS[tier];
  if (!planId) {
    return Promise.reject(new Error('No PayPal plan configured for tier: ' + tier));
  }

  return loadPayPal().then(function(paypal) {
    if (!paypal || !paypal.Buttons) {
      throw new Error('PayPal SDK failed to load');
    }

    return paypal.Buttons({
      style: {
        shape: 'rect',
        color: 'gold',
        layout: 'vertical',
        label: 'subscribe',
      },
      createSubscription: function(data, actions) {
        return actions.subscription.create({
          plan_id: planId,
          custom_id: (options && options.authUserId) || '',
          application_context: {
            shipping_preference: 'NO_SHIPPING',
          },
        });
      },
      onApprove: function(data) {
        if (options && options.onApprove) {
          options.onApprove({
            subscriptionId: data.subscriptionID,
            tier: tier,
          });
        }
      },
      onError: function(err) {
        if (options && options.onError) {
          options.onError(err);
        }
      },
      onCancel: function() {
        if (options && options.onCancel) {
          options.onCancel();
        }
      },
    }).render(container);
  });
}

// ─── Activate Subscription (client-side) ──────────────────────────────────────
// After PayPal approval, call the server to record the subscription.
// This hits a Vercel serverless function that writes to user_subscriptions.

export function activateSubscription(supabase, userId, tier, subscriptionId) {
  return supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      tier: tier,
      provider: 'paypal',
      provider_subscription_id: subscriptionId,
      status: 'active',
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
// Marks subscription for cancellation at period end (no immediate revoke).

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
