import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Icon from '../components/ui/Icon'
import { Btn } from '../components/ui'
import PageLayout from '../components/layout/PageLayout'

// ClashReport: detailed round-by-round breakdown for a single clash
export default function ClashReportScreen({ clashData, players, embedded }) {
  var navigate = useNavigate()
  var ctx = useApp()
  var toast = ctx.toast

  if (!clashData || !players) {
    var emptyContent = (
      <div className="text-center py-20 text-on-surface/50 text-sm">
        <Icon name="search_off" size={40} className="text-on-surface/30 mb-4" />
        <p>No clash data available.</p>
      </div>
    )
    return embedded ? emptyContent : <PageLayout>{emptyContent}</PageLayout>
  }

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

  var champion = clashData && clashData.champion ? clashData.champion : (sorted[0] ? sorted[0].name : null)
  var clashName = clashData && clashData.name ? clashData.name : 'TFT Clash'
  var top3 = sorted.slice(0, 3)

  if (sorted.length === 0) {
    var emptySort = <div className="text-center py-8 text-on-surface/50 text-sm">No detailed data for this clash yet.</div>
    return embedded ? emptySort : <PageLayout>{emptySort}</PageLayout>
  }

  var mainContent = (
    <div>
      {/* Winner Banner */}
      <section className="flex flex-col items-center justify-center text-center py-12 relative overflow-hidden">
        <div className="relative z-10 mb-4">
          <Icon name="emoji_events" size={72} fill={true} className="text-primary" />
        </div>
        <h2 className="font-display text-6xl md:text-8xl text-primary uppercase tracking-tighter leading-none mb-3 italic drop-shadow-[0_0_50px_rgba(253,186,73,0.3)]">
          {champion || 'TBD'}
        </h2>
        <p className="font-editorial text-xl md:text-2xl italic text-on-surface-variant max-w-xl mx-auto"
          >
          {'"' + clashName + '" Grand Champion'}
        </p>
        <div className="mt-6 flex gap-4 flex-wrap justify-center">
          {sorted[0] && (
            <div className="bg-surface-container-high px-5 py-2 rounded-lg border border-outline-variant/10">
              <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-0.5"
                >
                Points Secured
              </p>
              <p className="font-mono text-2xl text-primary"
                >
                {sorted[0].entry ? (sorted[0].entry.clashPts || sorted[0].entry.pts || 0) : 0}
              </p>
            </div>
          )}
          <div className="bg-surface-container-high px-5 py-2 rounded-lg border border-outline-variant/10">
            <p className="font-label text-xs text-on-surface-variant uppercase tracking-widest mb-0.5">
              Players
            </p>
            <p className="font-mono text-2xl text-tertiary">
              {sorted.length}
            </p>
          </div>
        </div>
      </section>

      {/* Podium - top 3 */}
      {top3.length >= 1 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-12">
          {/* 2nd Place */}
          {top3[1] ? (
            <div className="order-2 md:order-1 bg-surface-container-low p-6 rounded-t-xl border-t-4 border-outline/30 flex flex-col items-center md:translate-y-6">
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full border-4 border-outline/40 bg-surface-container-highest flex items-center justify-center">
                  <Icon name="person" size={36} className="text-on-surface-variant" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-surface-container-highest p-1.5 rounded-full border border-outline/20">
                  <Icon name="military_tech" size={18} className="text-outline" />
                </div>
              </div>
              <h3 className="font-display text-xl font-bold mb-0.5"
                >
                {top3[1].name}
              </h3>
              <p className="font-label text-xs text-outline tracking-widest uppercase mb-2"
                >
                Silver Medalist
              </p>
              <div className="font-mono text-lg text-on-surface"
                >
                {(top3[1].entry ? (top3[1].entry.clashPts || top3[1].entry.pts || 0) : 0) + ' PTS'}
              </div>
            </div>
          ) : (
            <div className="order-2 md:order-1" />
          )}

          {/* 1st Place */}
          <div className="order-1 md:order-2 z-10 bg-gradient-to-br from-[#ffc66b] to-primary p-px rounded-t-xl">
            <div className="bg-surface-container-highest p-8 rounded-t-xl flex flex-col items-center shadow-[0_20px_60px_-15px_rgba(255,198,107,0.3)]">
              <div className="relative mb-6">
                <div className="w-28 h-28 rounded-full border-4 border-primary bg-surface-container flex items-center justify-center shadow-[0_0_30px_rgba(253,186,73,0.25)]">
                  <Icon name="person" size={48} className="text-primary" />
                </div>
                <div className="absolute -top-3 -right-3 bg-primary text-on-primary p-2 rounded-full animate-pulse">
                  <Icon name="star" size={18} fill={true} className="text-on-primary" />
                </div>
              </div>
              <h3 className="font-display text-2xl font-black text-primary mb-0.5"
                >
                {top3[0].name}
              </h3>
              <p className="font-label text-xs text-primary tracking-widest uppercase mb-4"
                >
                Clash Champion
              </p>
              <div className="font-mono text-3xl font-bold text-on-surface"
                >
                {(top3[0].entry ? (top3[0].entry.clashPts || top3[0].entry.pts || 0) : 0) + ' PTS'}
              </div>
            </div>
          </div>

          {/* 3rd Place */}
          {top3[2] ? (
            <div className="order-3 bg-surface-container-low p-6 rounded-t-xl flex flex-col items-center md:translate-y-10 border-t-4 border-t-[#CD7F32]/30">
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full border-4 bg-surface-container-highest flex items-center justify-center border-[#CD7F32]/40">
                  <Icon name="person" size={36} className="text-on-surface-variant" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-surface-container-highest p-1.5 rounded-full border border-[#CD7F32]/20">
                  <Icon name="military_tech" size={18} className="text-[#CD7F32]" />
                </div>
              </div>
              <h3 className="font-display text-xl font-bold mb-0.5"
                >
                {top3[2].name}
              </h3>
              <p className="font-label text-xs tracking-widest uppercase mb-2 text-[#CD7F32]">
                Bronze Medalist
              </p>
              <div className="font-mono text-lg text-on-surface"
                >
                {(top3[2].entry ? (top3[2].entry.clashPts || top3[2].entry.pts || 0) : 0) + ' PTS'}
              </div>
            </div>
          ) : (
            <div className="order-3" />
          )}
        </section>
      )}

      {/* Standings + Awards Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Full Standings Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end">
            <h4 className="font-label text-sm tracking-widest text-on-surface-variant uppercase">
              Final Standings
            </h4>
            <span className="font-label text-xs opacity-50 uppercase">
              {sorted.length + ' Players'}
            </span>
          </div>
          <div className="bg-surface-container-low overflow-x-auto rounded">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline-variant/10">
                  {['Rank', 'Player', 'R1', 'R2', 'R3', 'Finals', 'Points'].map(function(h) {
                    return (
                      <th key={h}
                        className={'px-4 py-3 font-label text-xs tracking-widest uppercase text-on-surface-variant ' + (h === 'Player' ? 'text-left' : 'text-right')}>
                        {h}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="text-sm">
                {sorted.map(function(p, i) {
                  var rp = (p.entry && p.entry.roundPlacements) || {}
                  var clashPts = (p.entry && (p.entry.clashPts || p.entry.pts)) || 0
                  var rankColor = i === 0 ? '#ffc66b' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(228,225,236,0.4)'
                  var rankStr = i < 9 ? ('0' + (i + 1)) : String(i + 1)

                  return (
                    <tr key={p.id || p.name}
                      className="hover:bg-surface-container-high transition-colors border-b border-outline-variant/5">
                      <td className="px-4 py-3 font-mono font-bold text-right"
                        style={{ color: rankColor }}>
                        {rankStr}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-on-surface">{p.name}</span>
                          {p.name === mostImproved && (
                            <span className="text-tertiary text-[10px] px-2 py-0.5 rounded border border-tertiary/20 font-label uppercase bg-tertiary/10">
                              Most Improved
                            </span>
                          )}
                        </div>
                      </td>
                      {['r1', 'r2', 'r3', 'finals'].map(function(rk) {
                        var v = rp[rk]
                        var valClass = v === 1 ? 'text-primary' : v <= 4 ? 'text-tertiary' : 'text-error'
                        return (
                          <td key={rk} className="px-4 py-3 text-right">
                            {v
                              ? <span className={'font-mono font-bold text-sm ' + valClass}>
                                  {'#' + v}
                                </span>
                              : <span className="text-on-surface/25 text-xs">-</span>
                            }
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-sm text-primary"
                          >
                          {'+' + clashPts}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Commentary + Awards Sidebar */}
        <div className="space-y-4">
          {/* Glass recap panel */}
          <div className="p-6 rounded-xl border border-outline-variant/15 relative bg-surface-container/60 backdrop-blur-2xl">
            <div className="absolute -top-3 left-5 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest font-label">
              Clash Recap
            </div>
            <h4 className="font-editorial text-xl mb-3 italic mt-1">
              {clashName}
            </h4>
            <p className="text-on-surface-variant leading-relaxed text-sm">
              {champion + ' claimed victory in ' + clashName + ' with dominant performances across all rounds.'}
              {top3[1] ? (' Runner-up ' + top3[1].name + ' put up a strong fight but could not overcome the champion.') : ''}
              {' ' + sorted.length + ' players competed across the tournament.'}
            </p>
            <div className="mt-6 pt-5 border-t border-outline-variant/10 grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1"
                  >
                  Total Players
                </span>
                <span className="font-mono text-xl text-primary"
                  >
                  {sorted.length}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-1"
                  >
                  Season
                </span>
                <span className="font-mono text-xl text-secondary"
                  >
                  {(clashData && clashData.season) || 'S1'}
                </span>
              </div>
            </div>
          </div>

          {/* Awards */}
          <div className="space-y-3">
            <h4 className="font-label text-xs tracking-widest text-on-surface-variant uppercase">
              Match Awards
            </h4>
            {mostImproved && (
              <div className="bg-surface-container-high p-4 flex items-center gap-3 rounded">
                <div className="w-11 h-11 rounded flex items-center justify-center flex-shrink-0 bg-tertiary/10">
                  <Icon name="trending_up" size={22} className="text-tertiary" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold mb-0.5"
                    >
                    Most Improved
                  </p>
                  <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest"
                    >
                    {mostImproved + ' - Above avg'}
                  </p>
                </div>
              </div>
            )}
            {biggestUpset && (
              <div className="bg-surface-container-high p-4 flex items-center gap-3 rounded">
                <div className="w-11 h-11 rounded flex items-center justify-center flex-shrink-0 bg-secondary/10">
                  <Icon name="bolt" size={22} className="text-secondary" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold mb-0.5"
                    >
                    Biggest Upset
                  </p>
                  <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest"
                    >
                    {biggestUpset}
                  </p>
                </div>
              </div>
            )}
            {!mostImproved && !biggestUpset && (
              <div className="bg-surface-container-high p-4 flex items-center gap-3 rounded">
                <div className="w-11 h-11 rounded flex items-center justify-center flex-shrink-0 bg-primary/10">
                  <Icon name="emoji_events" size={22} className="text-primary" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold mb-0.5"
                    >
                    Champion
                  </p>
                  <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest"
                    >
                    {champion || 'TBD'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share and Actions footer */}
      <section className="mt-6 border-t border-outline-variant/10 pt-8 flex flex-col items-center">
        <h5 className="font-editorial text-lg italic mb-6 text-on-surface-variant"
          >
          Share this clash
        </h5>
        <div className="flex flex-wrap justify-center gap-3">
          <Btn
            variant="secondary"
            size="md"
            icon="share"
            onClick={function() {
              var text = champion + ' won ' + clashName + '! ' + sorted.length + ' players competed.'
              navigator.clipboard.writeText(text).then(function() {
                toast('Copied to clipboard', 'success')
              }).catch(function() {
                toast('Could not copy to clipboard', 'error')
              })
            }}
          >
            Share Summary
          </Btn>
          <Btn
            variant="primary"
            size="md"
            icon="download"
            onClick={function() {
              var rows = [['Place', 'Player', 'Points', 'R1', 'R2', 'R3', 'Finals']]
              sorted.forEach(function(p, i) {
                var rp = (p.entry && p.entry.roundPlacements) || {}
                var clashPts = (p.entry && (p.entry.clashPts || p.entry.pts)) || 0
                rows.push([
                  i + 1,
                  p.name || p.username || '',
                  clashPts,
                  rp.r1 || '',
                  rp.r2 || '',
                  rp.r3 || '',
                  rp.finals || ''
                ])
              })
              var csv = rows.map(function(r) { return r.join(',') }).join('\n')
              var blob = new Blob([csv], {type: 'text/csv'})
              var url = URL.createObjectURL(blob)
              var a = document.createElement('a')
              a.href = url
              a.download = (clashName ? clashName.replace(/\s+/g, '-').toLowerCase() : 'clash') + '-results.csv'
              a.click()
              URL.revokeObjectURL(url)
              toast('Results exported', 'success')
            }}
          >
            Export Results
          </Btn>
          <Btn
            variant="secondary"
            size="md"
            icon="sports_esports"
            onClick={function() { navigate('/events') }}
          >
            Join Next Clash
          </Btn>
        </div>
      </section>
    </div>
  )
  return embedded ? mainContent : <PageLayout>{mainContent}</PageLayout>
}
