// Single source of truth for healing legacy Bootstrap/Tabler icon names to their
// Material Symbols equivalents. Used by the <Icon> component at render time AND by
// the icons unit test (src/lib/__tests__/icons.test.js), which validates that every
// icon name in the codebase resolves to a real Material Symbol.
//
// Why this exists: <Icon> renders its name as a Material Symbols ligature. Any name
// that is neither a valid Material Symbol nor mapped here renders as raw text. Prefer
// using real Material Symbols names directly in new code; this map is the safety net
// for legacy names and dynamic (DB-sourced) values that still arrive in old forms.
export var ICON_ALIASES = {
  // Bootstrap/Tabler kebab-case names left over from earlier icon sets
  'gear-fill': 'settings', 'shield-fill': 'shield', 'diamond-half': 'diamond',
  'eye-fill': 'visibility', 'trophy-fill': 'emoji_events',
  'chart-bar': 'bar_chart', 'bar-chart-line-fill': 'bar_chart',
  'arrows-sort': 'swap_vert', 'clipboard-check': 'fact_check',
  'clipboard-data-fill': 'assignment', 'droplet-fill': 'water_drop',
  'mortarboard-fill': 'school', 'award-fill': 'military_tech',
  'lightning-charge-fill': 'bolt', 'moon-fill': 'bedtime',
  'graph-up-arrow': 'trending_up', 'rocket-takeoff-fill': 'rocket_launch',
  'star-fill': 'star', 'sun-fill': 'wb_sunny',
  'calendar-check-fill': 'event_available', 'shield-check': 'verified_user',
  'patch-check-fill': 'verified', 'emoji-dizzy': 'sentiment_dissatisfied',
  // single-word Bootstrap/Tabler names
  'droplet': 'water_drop', 'gem': 'diamond', 'fire': 'local_fire_department',
  'coin': 'paid', 'bullseye': 'adjust', 'crosshair': 'adjust',
  'snow': 'ac_unit', 'crown': 'workspace_premium', 'tournament': 'account_tree',
  'trophy': 'emoji_events', 'checkmark': 'check', 'bell': 'notifications',
  'spark': 'auto_awesome', 'target': 'adjust', 'discord': 'forum'
};

// Resolve a raw icon name through the alias map. Non-string or unmapped values
// pass through unchanged so valid Material Symbols names are untouched.
export function resolveIconName(raw) {
  return (typeof raw === 'string' && ICON_ALIASES[raw]) ? ICON_ALIASES[raw] : raw;
}
