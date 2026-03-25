import { useApp } from '../context/AppContext'
import { getStats, computeClashAwards } from '../lib/stats.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildNarrativeParts(player, s, position, totalPlayers, seasonName) {
  var name = player.name || 'You'
  var winRate = s.top1Rate || 0
  var avp = s.avgPlacement || '-'
  var wins = s.wins || 0
  var games = s.games || 0
  var sn = seasonName || 'Season 1'
  if (!position || !totalPlayers || totalPlayers === 0) {
    return [
      { text: name + ' competed this season. ', italic: false },
      { text: wins + ' wins', italic: true },
      { text: ' recorded so far. Keep climbing.', italic: false },
    ]
  }
  if (position === 1) {
    return [
      { text: name + ' stood above every challenger this season. ', italic: false },
      { text: wins + ' victories', italic: true },
      { text: ' across ' + games + ' games, an average placement of ' + avp + ', and a ', italic: false },
      { text: winRate + '% win rate', italic: true },
      { text: ' cemented a historic ' + sn + ' run. Dominant, consistent, and clinical - a true ' + sn + ' Champion.', italic: false },
    ]
  }
  if (position <= 3) {
    return [
      { text: name + ' delivered a top-3 season to be proud of. ', italic: false },
      { text: wins + ' wins', italic: true },
      { text: ' and a ', italic: false },
      { text: avp + ' average placement', italic: true },
      { text: ' across ' + games + ' games shows the consistency of an elite competitor. A force in every lobby they entered.', italic: false },
    ]
  }
  var rawPct = Math.round(position / totalPlayers * 100)
  var clampedPct = Math.min(100, Math.max(1, rawPct))
  return [
    { text: name + ' competed hard across ' + sn + ' - ', italic: false },
    { text: wins + ' wins', italic: true },
    { text: ' and a ', italic: false },
    { text: avp + ' average placement', italic: true },
    { text: ' across ' + games + ' games. Top ' + clampedPct + '% overall. The grind continues.', italic: false },
  ]
}

function topPercentLabel(position, total) {
  if (!position || !total || total === 0) return 'UNRANKED'
  var raw = Math.round(position / total * 100)
  var pct = Math.min(100, Math.max(1, raw))
  if (pct <= 2) return 'TOP 2%'
  if (pct <= 5) return 'TOP 5%'
  if (pct <= 10) return 'TOP 10%'
  if (pct <= 25) return 'TOP 25%'
  return 'TOP ' + pct + '%'
}

function getRankLabel(player) {
  if (!player) return 'Unranked'
  return player.rank || 'Unranked'
}

function buildHighlights(player, s, awards, seasonTag) {
  var tag = seasonTag || 'S1'
  var items = []
  if (s.wins > 0) {
    items.push({
      icon: 'workspace_premium',
      color: 'text-primary',
      borderColor: 'border-primary/40',
      title: s.wins + (s.wins === 1 ? ' Victory' : ' Victories') + ' This Season',
      subtitle: 'Clash wins recorded in ' + tag,
      date: tag,
    })
  }
  if (player.bestStreak && player.bestStreak >= 2) {
    items.push({
      icon: 'bolt',
      color: 'text-tertiary',
      borderColor: 'border-tertiary/40',
      title: player.bestStreak + '-Game Win Streak',
      subtitle: 'Best consecutive first-place run',
      date: tag,
    })
  }
  if (awards && awards.length > 0) {
    items.push({
      icon: 'emoji_events',
      color: 'text-secondary',
      borderColor: 'border-secondary/40',
      title: awards[0].title,
      subtitle: 'Season award earned',
      date: tag,
    })
  }
  if (s.games >= 10) {
    items.push({
      icon: 'groups',
      color: 'text-primary',
      borderColor: 'border-primary/40',
      title: s.games + ' Clashes Entered',
      subtitle: 'Showed up every week',
      date: tag,
    })
  }
  return items.slice(0, 4)
}

function nextSeasonCountdown() {
  return 'Next Season - Coming Soon'
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SeasonRecapScreen() {
  var ctx = useApp()
  var players = ctx.players || []
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var seasonConfig = ctx.seasonConfig || {}
  var seasonName = seasonConfig.seasonName || 'Season 1'
  var seasonTag = seasonConfig.seasonTag || 'S1'

  var player = null
  if (currentUser) {
    player = players.find(function(p) { return p.id === currentUser.id }) || players[0] || null
  } else {
    player = players[0] || null
  }

  if (!player) {
    return (
      <PageLayout>
        <div className="pt-16 text-center text-on-surface/50">
          <Icon name="person_off" size={48} className="block mb-3 text-on-surface/20" />
          <div className="text-sm">No player data available.</div>
        </div>
      </PageLayout>
    )
  }

  var s = getStats(player)
  var awards = computeClashAwards(players).filter(function(a) {
    return a.winner && a.winner.id === player.id
  })
  var sorted = players.slice().sort(function(a, b) { return b.pts - a.pts })
  var position = sorted.findIndex(function(p) { return p.id === player.id }) + 1
  var totalPlayers = players.length

  var narrativeParts = buildNarrativeParts(player, s, position, totalPlayers, seasonName)
  var topPct = topPercentLabel(position, totalPlayers)
  var rankLabel = getRankLabel(player)
  var highlights = buildHighlights(player, s, awards, seasonTag)

  function handleShare() {
    var text = (
      'TFT Clash ' + seasonName + ' Recap - ' + player.name +
      ' | #' + position + ' overall (' + player.pts + ' pts)' +
      ' | ' + s.wins + ' wins' +
      ' | AVP ' + s.avgPlacement +
      ' | ' + awards.length + ' awards' +
      ' | #TFTClash #TFT'
    )
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        if (toast) toast('Recap copied to clipboard!', 'success')
      })
    } else {
      if (toast) toast('Copy: ' + text, 'info')
    }
  }

  return (
    <PageLayout>
      <div className="relative pb-24">

        {/* Background atmosphere */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-primary/10 to-transparent blur-[120px] -z-10 pointer-events-none" />

        {/* Hero header */}
        <header className="text-center mb-16 pt-10 relative">
          <div className="inline-block mb-4 px-6 py-1 bg-tertiary-container/10 text-tertiary font-condensed uppercase tracking-[0.2em] text-sm border border-tertiary/20 rounded-sm">
            Season Achievement Unlocked
          </div>
          <h1 className="text-6xl md:text-8xl font-serif font-black tracking-tight leading-none mb-4">
            {seasonName + ' '}
            <span className="font-serif gold-gradient-text">
              Recap
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-on-surface-variant text-lg leading-relaxed italic">
            A definitive record of your dominance across the Obsidian Arena.
          </p>
        </header>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Rank card */}
          <div
            className="md:col-span-4 flex flex-col items-center justify-center p-8 rounded-sm relative overflow-hidden glass-panel"
            style={{ boxShadow: '0 0 40px rgba(253, 186, 73, 0.15)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="relative mb-6">
              <Icon name="military_tech" fill size={96} className="text-primary" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-surface px-4 py-1 rounded-full border border-primary/30 shadow-xl whitespace-nowrap">
                <span className="font-mono text-primary font-bold text-sm">{topPct}</span>
              </div>
            </div>
            <h2 className="font-condensed text-on-surface-variant uppercase tracking-widest text-sm mb-1 mt-2">
              Final Tier
            </h2>
            <div className="text-4xl font-serif font-bold text-on-surface">{rankLabel}</div>
            <div className="mt-3 font-mono text-xs text-primary/60">
              {'Season Peak: ' + player.pts + ' pts'}
            </div>
          </div>

          {/* Narrative performance summary */}
          <div className="md:col-span-8 p-10 bg-surface-container-low rounded-sm flex flex-col justify-center">
            <Icon name="format_quote" fill size={32} className="text-primary mb-4" />
            <p className="text-2xl font-serif text-on-surface leading-snug">
              {narrativeParts.map(function(part, idx) {
                if (part.italic) {
                  return <span key={idx} className="text-primary italic">{part.text}</span>
                }
                return <span key={idx}>{part.text}</span>
              })}
            </p>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
              <span className="font-condensed uppercase tracking-widest text-primary text-xs">
                Tactical Review AI
              </span>
            </div>
          </div>

          {/* Stats row - 4 x col-span-3 */}
          <div className="md:col-span-3 p-6 bg-surface-container-high rounded-sm text-center border-b border-primary/20">
            <h3 className="font-condensed text-on-surface-variant uppercase tracking-widest text-xs mb-4">
              Total Clash Points
            </h3>
            <div className="font-mono text-4xl font-bold text-primary">{(player.pts || 0).toLocaleString()}</div>
            <div className="mt-2 text-[10px] text-tertiary flex items-center justify-center gap-1 font-mono">
              <Icon name="trending_up" size={12} />
              {'#' + position + ' overall'}
            </div>
          </div>

          <div className="md:col-span-3 p-6 bg-surface-container-high rounded-sm text-center">
            <h3 className="font-condensed text-on-surface-variant uppercase tracking-widest text-xs mb-4">
              Total Victories
            </h3>
            <div className="font-mono text-4xl font-bold text-on-surface">{s.wins}</div>
            <div className="mt-2 text-[10px] text-on-surface-variant font-mono">
              {'Out of ' + s.games + ' games'}
            </div>
          </div>

          <div className="md:col-span-3 p-6 bg-surface-container-high rounded-sm text-center">
            <h3 className="font-condensed text-on-surface-variant uppercase tracking-widest text-xs mb-4">
              Avg Placement
            </h3>
            <div className="font-mono text-4xl font-bold text-on-surface">{s.avgPlacement}</div>
            <div className="mt-2 text-[10px] text-on-surface-variant font-mono">
              {parseFloat(s.avgPlacement) <= 3.5 ? 'Consistent Top 4 Finisher' : 'Competitive Performer'}
            </div>
          </div>

          <div className="md:col-span-3 p-6 bg-surface-container-high rounded-sm text-center">
            <h3 className="font-condensed text-on-surface-variant uppercase tracking-widest text-xs mb-4">
              Top 4 Rate
            </h3>
            <div className="font-condensed text-2xl font-bold text-secondary-fixed-dim uppercase tracking-tight mt-2">
              {s.top4Rate + '%'}
            </div>
            <div className="mt-2 text-[10px] text-on-surface-variant font-mono">
              {s.top4 + ' top-4 finishes'}
            </div>
          </div>

          {/* Trophy visual */}
          <div className="md:col-span-12 lg:col-span-5 relative group overflow-hidden rounded-sm h-[300px] bg-surface-container-low">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] to-background" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon name="trophy" fill size={160} className="text-primary opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
            </div>
            <div className="absolute bottom-8 left-8 z-20">
              <h4 className="font-serif text-3xl font-bold">The Obsidian Trophy</h4>
              <p className="font-condensed text-primary uppercase tracking-widest text-sm">
                {seasonName + ' Commemorative Item'}
              </p>
            </div>
            <div className="absolute top-8 right-8 z-20">
              <Icon name="trophy" size={64} className="text-primary/20" />
            </div>
          </div>

          {/* Season highlights list */}
          <div className="md:col-span-12 lg:col-span-7 bg-surface-container-low rounded-sm p-8">
            <h3 className="font-condensed text-on-surface-variant uppercase tracking-[0.3em] text-xs mb-8">
              Season Highlights
            </h3>
            {highlights.length === 0 ? (
              <p className="text-on-surface-variant text-sm italic">
                Play in more clashes to unlock season highlights.
              </p>
            ) : (
              <div className="space-y-4">
                {highlights.map(function(item, idx) {
                  return (
                    <div
                      key={idx}
                      className={'flex items-center justify-between p-4 bg-surface-container-lowest border-l-4 ' + item.borderColor}
                    >
                      <div className="flex items-center gap-4">
                        <Icon name={item.icon} size={24} className={item.color} />
                        <div>
                          <p className="font-bold text-on-surface">{item.title}</p>
                          <p className="text-xs text-on-surface-variant">{item.subtitle}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-on-surface-variant">{item.date}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {awards.length > 0 && (
              <div className="mt-6 pt-6 border-t border-outline-variant/30">
                <p className="font-condensed text-on-surface-variant uppercase tracking-widest text-xs mb-3">
                  Awards Earned
                </p>
                <div className="flex flex-wrap gap-2">
                  {awards.map(function(a) {
                    return (
                      <span
                        key={a.id}
                        className="text-[10px] font-bold uppercase px-3 py-1 rounded-sm"
                        style={{
                          background: (a.color || '#d9b9ff') + '1A',
                          border: '1px solid ' + (a.color || '#d9b9ff') + '40',
                          color: a.color || '#d9b9ff',
                        }}
                      >
                        {a.title}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-col items-center">
          <button
            onClick={handleShare}
            className="bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-condensed font-bold uppercase tracking-widest px-12 py-5 rounded-full hover:shadow-[0_0_30px_rgba(253,186,73,0.3)] transition-all active:scale-95 text-lg"
          >
            SHARE RECAP
          </button>
          <p className="mt-6 text-on-surface-variant font-mono text-xs uppercase tracking-tighter">
            {nextSeasonCountdown()}
          </p>
        </div>

      </div>
    </PageLayout>
  )
}
