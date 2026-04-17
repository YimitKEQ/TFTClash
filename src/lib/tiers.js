import { TIER_FEATURES } from './constants.js';

// Leaderboard placement tiers (not subscription tiers).
// Used by StandingsTable dividers and DashboardScreen progression rings.
export var LEADERBOARD_TIERS = [
  { name: 'Champion', minRank: 1, maxRank: 1, color: '#E8A838', icon: 'crown' },
  { name: 'Challenger', minRank: 2, maxRank: 3, color: '#9B72CF', icon: 'diamond' },
  { name: 'Contender', minRank: 4, maxRank: 8, color: '#4ECDC4', icon: 'shield' }
];

export function getPlayerTierInfo(rank, totalPlayers) {
  for (var i = 0; i < LEADERBOARD_TIERS.length; i++) {
    if (rank >= LEADERBOARD_TIERS[i].minRank && rank <= LEADERBOARD_TIERS[i].maxRank) {
      return LEADERBOARD_TIERS[i];
    }
  }
  return { name: 'Competitor', minRank: 9, maxRank: totalPlayers || 9999, color: '#9AAABF', icon: 'person' };
}

export function getNextTierInfo(rank) {
  for (var i = LEADERBOARD_TIERS.length - 1; i >= 0; i--) {
    if (rank > LEADERBOARD_TIERS[i].maxRank) {
      return LEADERBOARD_TIERS[i];
    }
  }
  return null;
}

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

export function getMaxScrimPlayers(tier) {
  var safeTier = tier && TIER_FEATURES[tier] ? tier : 'free';
  var features = TIER_FEATURES[safeTier];
  if (!features || typeof features.maxScrimPlayers !== 'number') return 0;
  return features.maxScrimPlayers;
}
