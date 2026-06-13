// Self-heal legacy Bootstrap/Tabler icon names left over from earlier icon sets
// to their Material Symbols equivalents, so they render as icons instead of raw
// text. Valid Material Symbol names are not in this map and pass through as-is.
var ICON_ALIASES = {
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
  'spark': 'auto_awesome'
};

export default function Icon({ name, children, fill = false, size = 24, className = '' }) {
  var resolved = (name && ICON_ALIASES[name]) || name;
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`
      }}
    >
      {resolved || children}
    </span>
  )
}
