import Icon from '../ui/Icon'

// Visualizes a player's clashHistory as a heat grid.
// Rows = clashes, columns = round 1..4. Color intensity = points earned.
// Reads only from props.player.clashHistory.

function colorFor(pts) {
  if (pts >= 8) return '#E8A838'
  if (pts >= 7) return '#D9B9FF'
  if (pts >= 5) return '#74C7B5'
  if (pts >= 3) return '#5C7A8C'
  if (pts >= 1) return '#3A4452'
  return '#1B1B23'
}

export default function PerformanceHeatmap(props) {
  var player = props.player
  if (!player || !player.clashHistory || player.clashHistory.length === 0) return null

  var byClash = {}
  player.clashHistory.forEach(function (h) {
    var k = h.clashId || h.tournamentId || ('group_' + Math.floor(Math.random() * 1e6))
    if (!byClash[k]) byClash[k] = {}
    var rd = h.round || h.gameNumber || 1
    var cur = byClash[k][rd] || 0
    if (!cur || (h.pts || 0) > cur) byClash[k][rd] = h.pts || 0
  })

  var clashIds = Object.keys(byClash).slice(-12)
  if (clashIds.length === 0) return null

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="grid_on" size={18} className="text-secondary" />
          <span className="font-label uppercase text-xs tracking-widest text-on-surface">Performance heatmap</span>
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant/40">last {clashIds.length} clash{clashIds.length === 1 ? '' : 'es'}</span>
      </div>
      <div className="space-y-1.5">
        {clashIds.map(function (cid, i) {
          var rounds = byClash[cid]
          var roundKeys = [1, 2, 3, 4]
          var totalPts = roundKeys.reduce(function (s, r) { return s + (rounds[r] || 0) }, 0)
          return (
            <div key={cid} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-on-surface-variant/50 w-12 truncate">#{cid.toString().slice(-6)}</span>
              <div className="flex gap-1 flex-1">
                {roundKeys.map(function (r) {
                  var pts = rounds[r] || 0
                  return (
                    <div key={r} className="h-5 sm:h-6 flex-1 rounded-sm flex items-center justify-center font-mono text-[9px] font-bold text-black/80"
                      style={{ background: colorFor(pts) }}
                      title={'Round ' + r + ': ' + pts + ' pts'}>
                      {pts > 0 ? pts : ''}
                    </div>
                  )
                })}
              </div>
              <span className="font-mono text-xs font-bold text-primary w-8 text-right">{totalPts}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-outline-variant/15">
        <span className="font-mono text-[10px] text-on-surface-variant/40">cold</span>
        <div className="flex gap-0.5 flex-1">
          {[0, 2, 4, 6, 7, 8].map(function (p) {
            return <div key={p} className="h-2 flex-1 rounded-sm" style={{ background: colorFor(p) }} />
          })}
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant/40">hot</span>
      </div>
    </div>
  )
}
