import { Icon } from '../ui'
import { ACHIEVEMENTS } from '../../lib/stats.js'

var TIER_ORDER = ['legendary', 'gold', 'silver', 'bronze']

var TIER_META = {
  legendary: { label: 'Legendary', ring: 'border-tertiary/60', glow: 'bg-tertiary/15', text: 'text-tertiary', dot: 'bg-tertiary' },
  gold:      { label: 'Gold',      ring: 'border-primary/60',  glow: 'bg-primary/15',  text: 'text-primary',  dot: 'bg-primary' },
  silver:    { label: 'Silver',    ring: 'border-on-surface-variant/40', glow: 'bg-on-surface-variant/10', text: 'text-on-surface', dot: 'bg-on-surface-variant' },
  bronze:    { label: 'Bronze',    ring: 'border-secondary/40', glow: 'bg-secondary/10', text: 'text-secondary', dot: 'bg-secondary' },
}

var ICON_MAP = {
  'droplet-fill': 'water_drop',
  'droplet': 'water_drop',
  'mortarboard-fill': 'school',
  'gear-fill': 'settings',
  'award-fill': 'workspace_premium',
  'lightning-charge-fill': 'bolt',
  'trophy-fill': 'emoji_events',
  'diamond-half': 'diamond',
  'moon-fill': 'dark_mode',
  'fire': 'local_fire_department',
  'graph-up-arrow': 'trending_up',
  'rocket-takeoff-fill': 'rocket_launch',
  'star-fill': 'star',
  'coin': 'paid',
  'gem': 'diamond',
  'sun-fill': 'wb_sunny',
  'calendar-check-fill': 'event_available',
  'shield-check': 'verified_user',
  'patch-check-fill': 'verified',
  'bullseye': 'gps_fixed',
  'eye-fill': 'visibility',
  'shield-fill': 'shield',
}

function mapIcon(name) {
  return ICON_MAP[name] || 'military_tech'
}

function safeCheck(achievement, player) {
  try { return achievement.check(player) } catch (e) { return false }
}

export default function TrophyCase(props) {
  var player = props.player
  var compact = props.compact === true
  var onShowAll = props.onShowAll

  if (!player) return null

  var unlocked = ACHIEVEMENTS.filter(function (a) { return safeCheck(a, player) })
  var byTier = { legendary: [], gold: [], silver: [], bronze: [] }
  unlocked.forEach(function (a) {
    var tier = a.tier || 'bronze'
    if (byTier[tier]) byTier[tier].push(a)
  })

  var totalUnlocked = unlocked.length
  var totalAchievements = ACHIEVEMENTS.length

  if (totalUnlocked === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-5 text-center">
        <Icon name="emoji_events" className="text-on-surface-variant/30 text-4xl mb-2" />
        <div className="font-display text-base text-on-surface mb-1">Trophy case is empty</div>
        <div className="text-xs text-on-surface-variant/60">
          Play a clash to start unlocking achievements.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="emoji_events" className="text-primary" />
          <h3 className="font-display text-base tracking-wide">TROPHY CASE</h3>
          <span className="text-xs text-on-surface-variant/60 font-mono">
            {totalUnlocked}/{totalAchievements}
          </span>
        </div>
        {onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            className="text-xs font-label tracking-wider uppercase text-primary hover:underline"
          >
            See all
          </button>
        )}
      </div>

      <div className="space-y-3">
        {TIER_ORDER.map(function (tier) {
          var items = byTier[tier]
          if (!items || items.length === 0) return null
          var meta = TIER_META[tier]
          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-2">
                <span className={'w-1.5 h-1.5 rounded-full ' + meta.dot}></span>
                <span className={'text-[10px] font-label tracking-widest uppercase ' + meta.text}>
                  {meta.label} · {items.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {items.slice(0, compact ? 4 : items.length).map(function (a) {
                  return (
                    <div
                      key={a.id}
                      title={a.desc}
                      className={'flex items-center gap-2 px-2.5 py-2 rounded-lg border ' + meta.ring + ' ' + meta.glow}
                    >
                      <Icon name={mapIcon(a.icon)} className={meta.text} size={18} />
                      <div className="min-w-0 flex-1">
                        <div className={'text-xs font-label font-bold uppercase tracking-wide truncate ' + meta.text}>
                          {a.name}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {compact && items.length > 4 && (
                  <div className="flex items-center justify-center px-2.5 py-2 rounded-lg border border-dashed border-outline-variant/30 text-xs text-on-surface-variant/60">
                    +{items.length - 4} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
