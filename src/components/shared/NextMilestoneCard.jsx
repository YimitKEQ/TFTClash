import { Icon } from '../ui'
import { MILESTONES } from '../../lib/stats.js'

function ptsTier(pts) {
  // Tones map to MD3 tokens. Champion/Diamond share tertiary because Diamond is
  // a stepping stone to Champion; Bronze uses the neutral on-surface so Silver
  // (secondary) and Gold (primary) read distinctly between them.
  if (pts >= 1000) return { tone: 'tertiary', label: 'CHAMPION' }
  if (pts >= 800) return { tone: 'tertiary', label: 'DIAMOND' }
  if (pts >= 600) return { tone: 'primary', label: 'GOLD' }
  if (pts >= 300) return { tone: 'secondary', label: 'SILVER' }
  if (pts >= 100) return { tone: 'on-surface', label: 'BRONZE' }
  return { tone: 'on-surface-variant', label: 'UNRANKED' }
}

function findNextMilestone(player) {
  if (!player) return null
  var unmet = []
  for (var i = 0; i < MILESTONES.length; i++) {
    var m = MILESTONES[i]
    var earned = false
    try { earned = !!m.check(player) } catch (e) { earned = false }
    if (!earned) unmet.push(m)
  }
  if (unmet.length === 0) return null
  var withPts = unmet.filter(function (m) { return typeof m.pts === 'number' })
  if (withPts.length > 0) {
    withPts.sort(function (a, b) { return a.pts - b.pts })
    return withPts[0]
  }
  // Only condition-based milestones remain. Their checks read clashHistory and
  // currentStreak which are populated asynchronously by AppContext enrichment.
  // If those fields aren't present, the checks return false for all players and
  // would mislead the card. Suppress the card until enrichment lands.
  var hasHistData = player.clashHistory && player.clashHistory.length > 0
  if (!hasHistData) return null
  return unmet[0]
}

function iconForMilestone(m) {
  if (!m) return 'flag'
  if (m.icon === 'shield-fill') return 'shield'
  if (m.icon === 'gem') return 'diamond'
  if (m.icon === 'trophy-fill') return 'emoji_events'
  if (m.icon === 'fire') return 'local_fire_department'
  if (m.icon === 'lightning-charge-fill') return 'bolt'
  if (typeof console !== 'undefined' && console.warn && import.meta && import.meta.env && import.meta.env.DEV) {
    console.warn('[NextMilestoneCard] Unmapped milestone icon:', m.icon)
  }
  return 'flag'
}

export default function NextMilestoneCard(props) {
  var player = props.player
  var dense = !!props.dense
  var hideHeader = !!props.hideHeader

  if (!player) return null

  var pts = player.pts || 0
  var tier = ptsTier(pts)
  var next = findNextMilestone(player)

  if (!next) {
    return (
      <div className={'rounded-2xl border border-tertiary/30 bg-tertiary/5 ' + (dense ? 'p-4' : 'p-5')}>
        {!hideHeader && (
          <div className="flex items-center gap-2 mb-2">
            <Icon name="workspace_premium" className="text-tertiary" />
            <h3 className={'font-display tracking-wide ' + (dense ? 'text-sm' : 'text-base')}>ALL MILESTONES UNLOCKED</h3>
          </div>
        )}
        <div className="text-xs text-on-surface-variant/70">
          You've cleared every milestone on the board. Hall of Fame territory.
        </div>
      </div>
    )
  }

  var icon = iconForMilestone(next)
  var hasPts = typeof next.pts === 'number'
  var pct = hasPts ? Math.min(100, Math.round((pts / next.pts) * 100)) : 0
  var remaining = hasPts ? Math.max(0, next.pts - pts) : 0

  var toneText = tier.tone === 'on-surface-variant' ? 'text-on-surface' : 'text-' + tier.tone
  var toneBg = tier.tone === 'on-surface-variant' ? 'bg-on-surface/10' : 'bg-' + tier.tone + '/10'
  var toneBorder = tier.tone === 'on-surface-variant' ? 'border-outline-variant/20' : 'border-' + tier.tone + '/30'
  var toneFill = tier.tone === 'on-surface-variant' ? 'bg-on-surface' : 'bg-' + tier.tone

  return (
    <div className={'rounded-2xl border ' + toneBorder + ' bg-surface-container ' + (dense ? 'p-4' : 'p-5')}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="flag" size={dense ? 14 : 16} className="text-secondary" />
            <h3 className={'font-display tracking-wide ' + (dense ? 'text-sm' : 'text-base')}>NEXT MILESTONE</h3>
          </div>
          <span className={'text-[10px] font-label tracking-widest uppercase font-bold ' + toneText}>
            {tier.label}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className={'flex-shrink-0 w-12 h-12 rounded-xl border ' + toneBorder + ' ' + toneBg + ' flex items-center justify-center'}>
          <Icon name={icon} size={24} className={toneText} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className={'font-display ' + (dense ? 'text-sm' : 'text-base') + ' tracking-wide truncate'}>
              {next.name}
            </div>
            {hasPts && (
              <div className="text-[10px] font-mono font-bold text-on-surface-variant/70 flex-shrink-0">
                {pts}/{next.pts}
              </div>
            )}
          </div>
          {next.reward && (
            <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/50 mt-0.5 truncate">
              UNLOCKS: {next.reward}
            </div>
          )}
          {hasPts ? (
            <div className="mt-2">
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={next.name + ' progress'}
                className="h-1.5 rounded-full bg-surface-container-high overflow-hidden"
              >
                <div className={'h-full rounded-full ' + toneFill} style={{ width: pct + '%' }}></div>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] font-mono text-on-surface-variant/40">
                  {pct}% complete
                </span>
                <span className={'text-[9px] font-mono font-bold ' + toneText}>
                  {remaining > 0 ? remaining + ' pts to go' : 'Ready!'}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60">
              CONDITION-BASED - keep grinding to unlock
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
