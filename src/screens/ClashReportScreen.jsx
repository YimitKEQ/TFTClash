import { useApp } from '../context/AppContext'
import Panel from '../components/ui/Panel'
import Tag from '../components/ui/Tag'
import Icon from '../components/ui/Icon'

// ClashReport: detailed round-by-round breakdown for a single clash
export default function ClashReportScreen({ clashData, players }) {
  var allP = (players && players.length > 0) ? players : []

  var report = clashData ? clashData.report : null

  var playerData = allP.map(function(p) {
    var entry = (p.clashHistory || []).find(function(h) {
      return h.clashId === clashData.id || h.name === clashData.name
    })
    return Object.assign({}, p, { entry: entry })
  }).filter(function(p) { return p.entry })

  var sorted = playerData.slice().sort(function(a, b) {
    var pa = a.entry.place || a.entry.placement || 99
    var pb = b.entry.place || b.entry.placement || 99
    return pa - pb
  })

  var mostImproved = (report && report.mostImproved) || null
  var biggestUpset = (report && report.biggestUpset) || null

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-on-surface/50 text-sm">
        No detailed data for this clash yet.
      </div>
    )
  }

  return (
    <div>
      {/* Per-player round breakdown */}
      <div className="overflow-x-auto mb-5">
        <table className="w-full border-collapse" style={{ minWidth: 420 }}>
          <thead>
            <tr className="bg-surface-container-highest/30">
              {['#', 'Player', 'R1', 'R2', 'R3', 'Finals', 'Clash Pts'].map(function(h) {
                return (
                  <th
                    key={h}
                    className="font-sans text-[10px] font-bold uppercase tracking-widest text-on-surface/40 border-b border-outline-variant/10"
                    style={{ padding: '9px 12px', textAlign: h === 'Player' ? 'left' : 'center' }}
                  >
                    {h}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(function(p, i) {
              var rp = (p.entry && p.entry.roundPlacements) || {}
              var clashPts = (p.entry && (p.entry.clashPts || p.entry.pts)) || 0
              var rankColor = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(242,237,228,0.4)'
              var rowBg = i === 0
                ? 'rgba(232,168,56,0.04)'
                : i % 2 === 0
                  ? 'rgba(255,255,255,0.01)'
                  : 'transparent'

              return (
                <tr
                  key={p.id || p.name}
                  style={{ background: rowBg, borderBottom: '1px solid rgba(242,237,228,0.04)' }}
                >
                  <td
                    className="font-mono text-sm font-extrabold text-center"
                    style={{ padding: '11px 12px', color: rankColor }}
                  >
                    {i + 1}
                  </td>

                  <td style={{ padding: '11px 12px' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-on-surface">{p.name}</span>
                      {p.name === mostImproved && (
                        <Tag color="#52C47C">
                          <Icon name="trending_up" size={10} className="text-emerald-400 mr-0.5" />
                          Improved
                        </Tag>
                      )}
                    </div>
                  </td>

                  {['r1', 'r2', 'r3', 'finals'].map(function(rk) {
                    var v = rp[rk]
                    var valColor = v === 1 ? '#E8A838' : v <= 4 ? '#4ECDC4' : '#F87171'
                    return (
                      <td key={rk} className="text-center" style={{ padding: '11px 8px' }}>
                        {v
                          ? <span className="font-mono text-sm font-bold" style={{ color: valColor }}>{'#' + v}</span>
                          : <span className="text-on-surface/25 text-xs">-</span>
                        }
                      </td>
                    )
                  })}

                  <td className="text-center" style={{ padding: '11px 12px' }}>
                    <span className="font-mono text-sm font-bold text-primary">{'+' + clashPts}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Awards row */}
      {(mostImproved || biggestUpset) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mostImproved && (
            <Panel className="p-4 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <Icon name="trending_up" size={22} className="text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm text-emerald-400 mb-0.5">Most Improved</div>
                  <div className="font-bold text-on-surface text-sm">{mostImproved}</div>
                  <div className="text-[11px] text-on-surface/40">Above their season average</div>
                </div>
              </div>
            </Panel>
          )}

          {biggestUpset && (
            <Panel className="p-4 border border-secondary/20">
              <div className="flex items-center gap-3">
                <Icon name="target" size={22} className="text-secondary flex-shrink-0" />
                <div>
                  <div className="font-bold text-sm text-secondary mb-0.5">Biggest Upset</div>
                  <div className="font-bold text-on-surface text-sm leading-snug">{biggestUpset}</div>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}
