import { TIER_FEATURES } from './constants.js';

export function getUserTier(subscriptions, userId) {
  if (!subscriptions || !userId) return "free";
  var sub = subscriptions[userId];
  if (!sub) return "free";
  if (sub.status !== "active") return "free";
  if (sub.current_period_end) {
    var grace = 3 * 24 * 60 * 60 * 1000;
    if (new Date(sub.current_period_end).getTime() + grace < Date.now()) return "free";
  }
  return sub.tier || sub.plan || "free";
}

export function hasFeature(tier, feature) {
  // Always fall back to free tier for null/undefined/unknown tiers - never crash
  var safeTier = tier && TIER_FEATURES[tier] ? tier : 'free';
  var features = TIER_FEATURES[safeTier];
  if (!features) return false;
  return !!features[feature];
}
