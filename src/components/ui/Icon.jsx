// Self-heal legacy Bootstrap/Tabler icon names left over from earlier icon sets
// to their Material Symbols equivalents, so they render as icons instead of raw
// text. Valid Material Symbol names are not in this map and pass through as-is.
var ICON_ALIASES = {
  'droplet-fill': 'water_drop', 'droplet': 'water_drop',
  'mortarboard-fill': 'school', 'gear-fill': 'settings',
  'award-fill': 'military_tech', 'lightning-charge-fill': 'bolt',
  'trophy-fill': 'emoji_events', 'diamond-half': 'diamond',
  'moon-fill': 'bedtime', 'fire': 'local_fire_department',
  'graph-up-arrow': 'trending_up', 'rocket-takeoff-fill': 'rocket_launch',
  'star-fill': 'star', 'coin': 'paid', 'gem': 'diamond',
  'sun-fill': 'wb_sunny', 'calendar-check-fill': 'event_available',
  'shield-check': 'verified_user', 'patch-check-fill': 'verified',
  'bullseye': 'adjust', 'eye-fill': 'visibility', 'crown': 'workspace_premium'
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
