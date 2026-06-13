// Google AdSense configuration + tier policy, in one place.
//
// ADSENSE_PUBLISHER_ID is the site/publisher id (public, not a secret). It is used
// to load the AdSense library script. An env override is supported but the known
// id is the fallback so ad serving and AdSense verification work without extra
// deploy config.
export var ADSENSE_PUBLISHER_ID = import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-3503630947026702';

// Optional ad-unit slot id. Real ad units only render once this is configured
// (create the unit in AdSense, then set VITE_ADSENSE_SLOT). Until then, AdBanner
// shows the Pro upsell house ad instead.
export var ADSENSE_SLOT = import.meta.env.VITE_ADSENSE_SLOT || '';

// Subscription tiers that are ad-free per the Pro/Host product promise ("zero ads").
// These users never load the AdSense library and never see ad slots.
export var AD_FREE_TIERS = ['pro', 'bundle', 'host'];

export function isAdFreeTier(tier) {
  return AD_FREE_TIERS.indexOf(tier) !== -1;
}
