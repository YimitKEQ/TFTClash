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
  return sub.tier || "free";
}

export function hasFeature(tier, feature) {
  var features = TIER_FEATURES[tier] || TIER_FEATURES.free;
  return !!features[feature];
}
