import { useMemo } from 'react'
import Icon from '../ui/Icon'

// Computes win-probability odds from a roster + their season form.
// Pure-client probability model:
//   base = season-points share + recent-top4 rate (weighted)
//   normalized so sum == 1.0
//
// Props:
//   players: [{id, name, pts, top4, games}]   (the locked roster)
//   max: max rows to render (default 8)

function computeOdds(players) {
  if (!players || players.length === 0) return []
  var rows = players.map(function (p) {
    var pts = Math.max(1, p.pts || 0)
    var t4 = (p.top4 || 0)
    var g = (p.games || 0)
    var rate = g > 0 ? (t4 / g) : 0.4
    var base = (pts * 0.6) + (rate * 100 * 0.4)
    return { id: p.id, name: p.name, raw: base }
  })
  var sum = rows.reduce(function (s, r) { return s + r.raw }, 0) || 1
  rows.forEach(function (r) { r.prob = r.raw / sum })
  rows.sort(function (a, b) { return b.prob - a.prob })
  var totalAfterSort = rows.reduce(function (s, r) { return s + r.prob }, 0) || 1
  rows.forEach(function (r) { r.prob = r.prob / totalAfterSort })
  return rows
}

function decimalOdds(p) {
  if (!p || p <= 0) return '-'
  var o = 1 / p
  if (o < 1.01) return '1.01'
  if (o > 99) return '99+'
  return o.toFixed(2)
}

export default function LiveOdds(props) {
  var rows = useMemo(function () { return computeOdds(props.players || []) }, [props.players])
  var max = props.max || 8
  if (rows.length === 0) return null

  var top = rows.slice(0, max)
  var leader = top[0]

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="auto_graph" size={18} className="text-primary" />
          <span className="font-label uppercase text-xs tracking-widest text-on-surface">Live odds</span>
        </div>
        {leader && (
          <span className="font-mono text-[10px] text-on-surface-variant/40">
            favored: <span className="text-primary font-bold">{leader.name}</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        {top.map(function (r, i) {
          var pct = Math.round(r.prob * 100)
          var isLeader = i === 0
          return (
            <div key={r.id || r.name} className="flex items-center gap-3">
              <span className={'font-mono text-[10px] w-6 ' + (isLeader ? 'text-primary' : 'text-on-surface-variant/40')}>{i + 1}</span>
              <span className="text-sm text-on-surface flex-1 truncate font-bold">{r.name}</span>
              <div className="w-24 sm:w-32 h-2 bg-surface-container rounded-full overflow-hidden">
                <div className={'h-full rounded-full ' + (isLeader ? 'bg-primary' : 'bg-secondary/60')} style={{ width: Math.max(2, pct) + '%' }} />
              </div>
              <span className="font-mono text-xs w-12 text-right text-on-surface">{pct}%</span>
              <span className="font-mono text-[10px] w-12 text-right text-on-surface-variant/60">{decimalOdds(r.prob)}</span>
            </div>
          )
        })}
      </div>
      <div className="font-mono text-[10px] text-on-surface-variant/30 mt-3 pt-3 border-t border-outline-variant/15">
        For entertainment only. Based on season points + recent top-4 rate.
      </div>
    </div>
  )
}
