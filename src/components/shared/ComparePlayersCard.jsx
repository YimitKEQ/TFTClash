import { Icon } from '../ui'
import { getStats } from '../../lib/stats.js'

function computeBestStreak(player) {
  if (!player) return 0
  var hist = player.clashHistory
  if (!Array.isArray(hist) || hist.length === 0) {
    return Number(player.bestStreak) || 0
  }
  var best = 0
  var run = 0
  for (var i = 0; i < hist.length; i++) {
    var place = hist[i].placement || hist[i].place || 0
    if (place === 1) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

function fmtSigned(n, digits) {
  if (typeof n !== 'number' || isNaN(n)) return '0'
  var rounded = digits != null ? n.toFixed(digits) : Math.round(n)
  if (n > 0) return '+' + rounded
  return String(rounded)
}

function deltaTone(d, betterIsHigher) {
  if (!d) return 'text-on-surface-variant/50'
  var positive = betterIsHigher ? d > 0 : d < 0
  return positive ? 'text-tertiary' : 'text-error'
}

function deltaIcon(d, betterIsHigher) {
  if (!d) return 'remove'
  var positive = betterIsHigher ? d > 0 : d < 0
  return positive ? 'arrow_upward' : 'arrow_downward'
}

function StatRow(props) {
  var label = props.label
  var mineRaw = props.mine
  var theirsRaw = props.theirs
  var digits = props.digits
  var betterIsHigher = props.betterIsHigher !== false
  var mine = typeof mineRaw === 'number' ? mineRaw : parseFloat(mineRaw) || 0
  var theirs = typeof theirsRaw === 'number' ? theirsRaw : parseFloat(theirsRaw) || 0
  var d = mine - theirs
  var tone = deltaTone(d, betterIsHigher)
  var icn = deltaIcon(d, betterIsHigher)

  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2 border-b border-outline-variant/10 last:border-b-0">
      <div className="col-span-4 text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60">
        {label}
      </div>
      <div className="col-span-3 text-right font-mono text-sm font-bold text-on-surface">
        {digits != null ? mine.toFixed(digits) : mine}
      </div>
      <div className="col-span-2 flex items-center justify-center">
        <span className={'inline-flex items-center gap-0.5 text-[10px] font-mono font-bold ' + tone}>
          <Icon name={icn} size={11} />
          {fmtSigned(d, digits)}
        </span>
      </div>
      <div className="col-span-3 text-right font-mono text-sm text-on-surface-variant/70">
        {digits != null ? theirs.toFixed(digits) : theirs}
      </div>
    </div>
  )
}

export default function ComparePlayersCard(props) {
  var mine = props.mine
  var theirs = props.theirs

  if (!mine || !theirs) return null
  if (mine.id && theirs.id && String(mine.id) === String(theirs.id)) return null

  var sMine = getStats(mine)
  var sTheirs = getStats(theirs)

  var top4RateMine = parseFloat(sMine.top4Rate) || 0
  var top4RateTheirs = parseFloat(sTheirs.top4Rate) || 0
  var avpMine = parseFloat(sMine.avgPlacement) || 0
  var avpTheirs = parseFloat(sTheirs.avgPlacement) || 0
  var bestStreakMine = computeBestStreak(mine)
  var bestStreakTheirs = computeBestStreak(theirs)

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="compare_arrows" className="text-secondary" />
          <h3 className="font-display text-base tracking-wide">HEAD-TO-HEAD</h3>
        </div>
        <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          Career snapshot
        </div>
      </div>
      <div className="grid grid-cols-12 items-center gap-2 pb-2 mb-1 border-b border-outline-variant/20">
        <div className="col-span-4"></div>
        <div className="col-span-3 text-right text-[10px] font-label tracking-widest uppercase text-primary font-bold truncate">
          {mine.name || 'You'}
        </div>
        <div className="col-span-2 text-center text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          DELTA
        </div>
        <div className="col-span-3 text-right text-[10px] font-label tracking-widest uppercase text-on-surface-variant/70 truncate">
          {theirs.name || 'Them'}
        </div>
      </div>
      <StatRow label="Points" mine={mine.pts || 0} theirs={theirs.pts || 0} betterIsHigher={true} />
      <StatRow label="Wins" mine={mine.wins || 0} theirs={theirs.wins || 0} betterIsHigher={true} />
      <StatRow label="Top 4s" mine={mine.top4 || 0} theirs={theirs.top4 || 0} betterIsHigher={true} />
      <StatRow label="Games" mine={mine.games || 0} theirs={theirs.games || 0} betterIsHigher={true} />
      <StatRow label="AVG Place" mine={avpMine} theirs={avpTheirs} digits={2} betterIsHigher={false} />
      <StatRow label="Top 4 %" mine={top4RateMine} theirs={top4RateTheirs} digits={1} betterIsHigher={true} />
      <StatRow label="Best Streak" mine={bestStreakMine} theirs={bestStreakTheirs} betterIsHigher={true} />
    </div>
  )
}
