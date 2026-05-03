import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import { Icon, Panel } from '../components/ui'
import PageLayout from '../components/layout/PageLayout'

function computeLifetimeRecords(pastClashes) {
  if (!Array.isArray(pastClashes) || pastClashes.length === 0) return null
  var champCounts = {}
  var topScore = 0
  var topScoreChamp = null
  var prizeTotal = 0
  for (var i = 0; i < pastClashes.length; i++) {
    var c = pastClashes[i]
    if (!c) continue
    if (c.champion) {
      var key = String(c.champion)
      champCounts[key] = (champCounts[key] || 0) + 1
    }
    // pastClashes[i].pts represents the winning champion's tournament point
    // total (set when the clash is finalized in ClashReportScreen). Treating
    // it as the per-champion run score is correct here.
    var pts = Number(c.pts || 0)
    if (pts > topScore) {
      topScore = pts
      topScoreChamp = c.champion || null
    }
    prizeTotal += Number(c.prize_pool || c.prizePool || 0) || 0
  }
  // Tiebreaker for mostCrowned: when two players share the highest crown
  // count, pick the alphabetically earlier name. Without this the result
  // depends on for-in insertion order (engine-defined).
  var mostCrowned = null
  var mostCrownedCount = 0
  for (var n in champCounts) {
    if (!Object.prototype.hasOwnProperty.call(champCounts, n)) continue
    var cnt = champCounts[n]
    if (cnt > mostCrownedCount || (cnt === mostCrownedCount && mostCrowned !== null && n < mostCrowned)) {
      mostCrownedCount = cnt
      mostCrowned = n
    }
  }
  return {
    totalClashes: pastClashes.length,
    mostCrowned: mostCrowned,
    mostCrownedCount: mostCrownedCount,
    topScore: topScore,
    topScoreChamp: topScoreChamp,
    prizeTotal: prizeTotal,
  }
}

function isPlayerInRoster(name, players) {
  if (!name || !Array.isArray(players)) return false
  var lc = String(name).toLowerCase()
  for (var i = 0; i < players.length; i++) {
    var p = players[i]
    if (p && p.name && String(p.name).toLowerCase() === lc) return true
  }
  return false
}

function compactDollar(n) {
  if (typeof n !== 'number' || isNaN(n) || n <= 0) return null
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return '$' + n
}

function LifetimeTile(props) {
  var icon = props.icon
  var label = props.label
  var value = props.value
  var sub = props.sub
  var tone = props.tone || 'primary'
  var onClick = props.onClick

  var ring = 'border-' + tone + '/30'
  var iconWrap = 'bg-' + tone + '/15 text-' + tone

  var inner = (
    <div className={'rounded-xl border ' + ring + ' bg-surface-container p-4 sm:p-5 flex items-start gap-3 h-full'}>
      <div className={'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ' + iconWrap}>
        <Icon name={icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 truncate">
          {label}
        </div>
        <div className="font-display text-xl sm:text-2xl tracking-wide text-on-surface mt-0.5 truncate">
          {value}
        </div>
        {sub && (
          <div className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5 truncate">
            {sub}
          </div>
        )}
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left transition-colors hover:opacity-90 cursor-pointer w-full">
        {inner}
      </button>
    )
  }
  return inner
}

function LifetimeRecordsStrip(props) {
  var records = props.records
  var openProfile = props.openProfile
  var roster = props.roster || []
  if (!records) return null

  var prizeStr = compactDollar(records.prizeTotal)
  var crownLabel = records.mostCrownedCount > 0
    ? (records.mostCrownedCount + (records.mostCrownedCount === 1 ? ' clash crown' : ' clash crowns'))
    : null

  // Only attach onClick when the named champion still has an active player
  // record. openProfile silently no-ops for non-roster names; surfacing it as
  // a clickable button would mislead the user. The tile still renders, just
  // without the cursor-pointer affordance for retired/legacy champs.
  var crownClickable = records.mostCrowned && isPlayerInRoster(records.mostCrowned, roster)
  var topClickable = records.topScoreChamp && isPlayerInRoster(records.topScoreChamp, roster)

  return (
    <div>
      <h3 className="font-label text-primary tracking-[0.4em] text-xs mb-6">
        LIFETIME RECORDS
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <LifetimeTile
          icon="emoji_events"
          label="Past Clashes"
          value={records.totalClashes}
          sub="completed tournaments"
          tone="primary"
        />
        {records.mostCrowned ? (
          <LifetimeTile
            icon="workspace_premium"
            label="Most Decorated"
            value={records.mostCrowned}
            sub={crownLabel}
            tone="tertiary"
            onClick={crownClickable ? function () { openProfile(records.mostCrowned) } : null}
          />
        ) : (
          <LifetimeTile
            icon="workspace_premium"
            label="Most Decorated"
            value="-"
            sub="awaiting first crown"
            tone="tertiary"
          />
        )}
        {records.topScore > 0 ? (
          <LifetimeTile
            icon="local_fire_department"
            label="Best Clash Run"
            value={records.topScore + ' pts'}
            sub={records.topScoreChamp ? ('by ' + records.topScoreChamp) : null}
            tone="secondary"
            onClick={topClickable ? function () { openProfile(records.topScoreChamp) } : null}
          />
        ) : (
          <LifetimeTile
            icon="local_fire_department"
            label="Best Clash Run"
            value="-"
            sub="no scores recorded"
            tone="secondary"
          />
        )}
        <LifetimeTile
          icon="payments"
          label="All-Time Prize Pool"
          value={prizeStr || '-'}
          sub={prizeStr ? 'awarded across history' : 'no payouts yet'}
          tone="primary"
        />
      </div>
    </div>
  )
}

export default function HofScreen(props) {
  var embedded = props.embedded || false
  var ctx = useApp()
  var players = ctx.players || []
  var pastClashes = ctx.pastClashes || []
  var setProfilePlayer = ctx.setProfilePlayer
  var setScreen = ctx.setScreen
  var seasonConfig = ctx.seasonConfig
  var orgSponsors = ctx.orgSponsors || []
  var navigate = useNavigate()

  var hofSponsors = orgSponsors.filter(function(s) {
    return s.status === 'active' && s.placements && s.placements.indexOf('hall_of_fame') > -1
  })

  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var competedSorted = sorted.filter(function(p) { return (p.games || 0) > 0 || (p.pts || 0) > 0 || (p.wins || 0) > 0 })
  var king = competedSorted[0] || null
  var kingStats = king ? getStats(king) : null
  var challengers = competedSorted.slice(1, 4)
  var kingGap = challengers[0] ? (king.pts || 0) - (challengers[0].pts || 0) : 0

  function openProfile(name) {
    if (!name) return
    var lower = String(name).toLowerCase()
    var p = players.find(function(pl) { return pl.name === name })
    if (!p) p = players.find(function(pl) { return pl.name && pl.name.toLowerCase() === lower })
    if (p) {
      setProfilePlayer(p)
      setScreen('profile')
      navigate('/player/' + p.name)
    }
  }

  var pastChamps = pastClashes.map(function(c) {
    return {
      season: c.season || ('S' + (c.id || '?')),
      champion: c.champion || 'Unknown',
      pts: c.pts || 0,
      rank: c.rank || '',
      wins: c.wins || 0,
      status: 'past',
    }
  })

  var SEASON_CHAMPS = king
    ? pastChamps.concat([{ season: 'S1', champion: king.name, pts: king.pts, rank: king.rank, wins: king.wins, status: 'active' }])
    : pastChamps

  var wp = players.filter(function(p) { return (p.games || 0) > 0 })

  var lifetimeRecords = computeLifetimeRecords(pastClashes)

  var hofRecs = []

  if (wp.length > 0) {
    var byPts = wp.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
    var byWins = wp.slice().sort(function(a, b) { return (b.wins || 0) - (a.wins || 0) })
    var byAvg = wp.slice().filter(function(p) { return p.avg }).sort(function(a, b) { return parseFloat(a.avg) - parseFloat(b.avg) })
    var byStreak = wp.slice().sort(function(a, b) { return (b.bestStreak || 0) - (a.bestStreak || 0) })
    var byGames = wp.slice().sort(function(a, b) { return (b.games || 0) - (a.games || 0) })
    var byTop4 = wp.slice().sort(function(a, b) {
      var aRate = a.games > 0 ? (a.top4 || 0) / a.games : 0
      var bRate = b.games > 0 ? (b.top4 || 0) / b.games : 0
      return bRate - aRate
    })

    hofRecs = [
      byPts[0] ? {
        id: 'pts', icon: 'trending_up', title: 'Season Points Leader',
        value: (byPts[0].pts || 0).toLocaleString(), holder: byPts[0].name, rank: byPts[0].rank,
        runner: [byPts[1] && byPts[1].name, byPts[2] && byPts[2].name].filter(Boolean),
        desc: 'Most cumulative points in a single competitive split.',
      } : null,
      byWins[0] && (byWins[0].wins || 0) > 0 ? {
        id: 'wins', icon: 'swords', title: 'Win Machine',
        value: (byWins[0].wins || 0) + ' Wins', holder: byWins[0].name, rank: byWins[0].rank,
        runner: [byWins[1] && byWins[1].name, byWins[2] && byWins[2].name].filter(Boolean),
        desc: 'Record for most 1st place finishes in the current arena.',
      } : null,
      byAvg[0] ? {
        id: 'avg', icon: 'target', title: 'Consistency King',
        value: byAvg[0].avg + ' Avg', holder: byAvg[0].name, rank: byAvg[0].rank,
        runner: [byAvg[1] && byAvg[1].name, byAvg[2] && byAvg[2].name].filter(Boolean),
        desc: 'Highest average placement across 50+ matches.',
      } : null,
      byStreak[0] && (byStreak[0].bestStreak || 0) > 1 ? {
        id: 'streak', icon: 'local_fire_department', title: 'Hot Streak',
        value: (byStreak[0].bestStreak || 0) + ' Streak', holder: byStreak[0].name, rank: byStreak[0].rank,
        runner: [byStreak[1] && byStreak[1].name, byStreak[2] && byStreak[2].name].filter(Boolean),
        desc: 'Longest consecutive win streak in ranked play.',
      } : null,
      byGames[0] ? {
        id: 'games', icon: 'shield', title: 'Iron Presence',
        value: (byGames[0].games || 0) + ' Games', holder: byGames[0].name, rank: byGames[0].rank,
        runner: [byGames[1] && byGames[1].name, byGames[2] && byGames[2].name].filter(Boolean),
        desc: 'Most time spent in active tournament combat.',
      } : null,
      byTop4[0] && (byTop4[0].games || 0) > 0 ? {
        id: 'top4r', icon: 'star', title: 'Top 4 Machine',
        value: Math.round(((byTop4[0].top4 || 0) / byTop4[0].games) * 100) + '% Rate',
        holder: byTop4[0].name, rank: byTop4[0].rank,
        runner: [byTop4[1] && byTop4[1].name, byTop4[2] && byTop4[2].name].filter(Boolean),
        desc: 'Highest Top 4 conversion rate in competitive play.',
      } : null,
    ].filter(Boolean)
  }

  var challengerMedalColors = ['#C0C0C0', '#CD7F32', 'rgba(212,212,212,0.4)']
  var challengerBadgeColors = ['#C0C0C0', '#CD7F32', 'rgba(212,212,212,0.4)']
  var challengerIconColors = ['#C0C0C0', '#CD7F32', 'rgba(212,212,212,0.4)']
  var challengerIcons = ['workspace_premium', 'workspace_premium', 'military_tech']

  var content = (
    <div className="pb-16 space-y-16">

        {/* Hero Header */}
        <div className="mb-0 text-center md:text-left">
          <span className="font-label text-primary tracking-[0.4em] uppercase text-sm mb-4 block">
            Seasonal Honors
          </span>
          <h1 className="font-display text-4xl sm:text-6xl md:text-8xl text-primary leading-none tracking-tight drop-shadow-2xl">
            HALL OF FAME
          </h1>
          <p className="font-editorial text-lg sm:text-2xl text-on-surface-variant mt-4 opacity-80">
            Celebrating the Architects of Victory
          </p>
        </div>

        {/* Hall of Fame Sponsors */}
        {hofSponsors.length > 0 && (
          <div className="flex items-center justify-center gap-6 flex-wrap py-4 border-y border-primary/10">
            <span className="text-[9px] font-bold text-primary/40 uppercase tracking-widest">Hall of Fame presented by</span>
            {hofSponsors.map(function(sp) {
              return (
                <div key={sp.name} className="flex items-center gap-2 opacity-50 hover:opacity-90 transition-opacity">
                  {sp.logo_url ? (
                    <img src={sp.logo_url} alt={sp.name + ' logo'} loading="lazy" decoding="async" className="h-5 object-contain" />
                  ) : (
                    <span className="text-sm font-bold" style={{ color: sp.color || '#ffc66b' }}>{sp.name}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Featured Section: Reigning Champ and Challengers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Reigning Champion */}
          {king && kingStats ? (
            <div className="lg:col-span-7 relative group">
              <div className="absolute -inset-1 opacity-20 blur-2xl group-hover:opacity-40 transition-opacity bg-gradient-to-br from-primary to-primary-fixed-dim"></div>
              <Panel
                padding="none"
                radius="xl"
                className="relative overflow-hidden h-full flex flex-col justify-end p-6 sm:p-8 border border-primary/40 min-h-[280px] sm:min-h-[400px] shadow-[0_0_40px_10px_rgba(253,186,73,0.15)]"
              >
                {/* Trophy background icon */}
                <Icon
                  name="emoji_events"
                  fill
                  size={160}
                  className="absolute top-8 right-8 pointer-events-none text-primary/5"
                />

                <div className="relative z-10">
                  <div className="inline-block px-4 py-1 font-label font-bold text-xs tracking-widest mb-4 bg-primary text-on-primary">
                    {'SEASON ' + (seasonConfig && seasonConfig.seasonNumber || 1) + ' LEADER'}
                  </div>
                  <h2
                    className="font-editorial text-3xl sm:text-5xl md:text-7xl text-on-surface mb-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={function() { openProfile(king.name) }}
                  >
                    {king.name}
                  </h2>
                  <div className="flex items-center gap-6 sm:gap-8 mt-4 sm:mt-6 flex-wrap gap-y-4">
                    {kingStats && (
                      <>
                        <div className="text-center">
                          <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase">Win Rate</p>
                          <p className="font-mono text-primary text-2xl sm:text-3xl font-bold">{kingStats.top1Rate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase">Avg Place</p>
                          <p className="font-mono text-primary text-2xl sm:text-3xl font-bold">{kingStats.avgPlacement}</p>
                        </div>
                        <div className="text-center">
                          <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase">Season Pts</p>
                          <p className="font-mono text-primary text-2xl sm:text-3xl font-bold">{king.pts}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Panel>
            </div>
          ) : (
            <div className="lg:col-span-7 relative">
              <Panel
                padding="none"
                radius="xl"
                className="overflow-hidden h-full flex flex-col items-center justify-center p-8 border border-primary/15 min-h-[400px]"
              >
                <Icon name="emoji_events" size={64} className="text-primary/20 mb-4" />
                <p className="font-label text-on-surface-variant tracking-widest text-xs text-center">
                  A champion yet to be crowned
                </p>
              </Panel>
            </div>
          )}

          {/* Challengers Column */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <h3 className="font-label text-on-surface-variant tracking-[0.2em] text-xs mb-2">
              CONTENDERS CIRCLE
            </h3>

            {challengers.length === 0 && (
              <Panel
                elevation="highest"
                padding="default"
                className="flex-1 flex items-center justify-center"
              >
                <p className="font-label text-on-surface-variant/50 tracking-widest text-xs text-center">
                  Challengers will appear once more players have competed.
                </p>
              </Panel>
            )}

            {challengers.map(function(p, i) {
              var iconName = challengerIcons[i] || 'military_tech'
              var badgeColor = challengerBadgeColors[i] || 'rgba(212,212,212,0.4)'
              var iconColor = challengerIconColors[i] || 'rgba(212,212,212,0.4)'
              var diff = king ? (king.pts || 0) - (p.pts || 0) : 0
              var top4Rate = p.games > 0 ? Math.round(((p.top4 || 0) / p.games) * 100) : 0
              return (
                <Panel
                  key={p.id || p.name}
                  elevation="highest"
                  padding="default"
                  className="flex items-center justify-between cursor-pointer transition-colors hover:bg-surface-container-highest"
                  onClick={function() { openProfile(p.name) }}
                >
                  <div className="flex items-center space-x-6">
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-14 h-14 flex items-center justify-center bg-surface-container-low border border-outline-variant/20"
                      >
                        <Icon
                          name={iconName}
                          fill={i < 2}
                          size={28}
                          style={{ color: iconColor }}
                        />
                      </div>
                      <span
                        className="absolute -top-2 -right-2 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full text-background"
                        style={{ background: badgeColor }}
                      >
                        {i + 2}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-editorial text-xl text-on-surface">{p.name}</h4>
                      <p className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
                        {p.rank ? p.rank + ' | ' : ''}{p.pts || 0} PTS
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-on-surface-variant text-sm">
                      TOP4: {top4Rate > 0 ? top4Rate + '%' : '-'}
                    </p>
                    {king && (
                      <p className="font-mono text-xs text-error">-{diff} pts</p>
                    )}
                  </div>
                </Panel>
              )
            })}
          </div>
        </div>

        {/* Season Champions Wall */}
        {SEASON_CHAMPS.length === 0 && (
          <div>
            <h3 className="font-label text-primary tracking-[0.4em] text-xs mb-8">
              SEASON CHAMPIONS
            </h3>
            <Panel elevation="elevated" padding="none" className="p-12 text-center">
              <Icon name="workspace_premium" size={48} className="mx-auto mb-4 text-on-surface/20" />
              <p className="font-label text-on-surface-variant/50 tracking-widest text-xs">
                No champions yet - be the first!
              </p>
            </Panel>
          </div>
        )}
        {SEASON_CHAMPS.length > 0 && (
          <div>
            <h3 className="font-label text-primary tracking-[0.4em] text-xs mb-8">
              SEASON CHAMPIONS
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {SEASON_CHAMPS.map(function(s, i) {
                var isActive = s.status === 'active'
                return (
                  <Panel
                    key={i + '-' + s.season + '-' + (s.champion || '')}
                    elevation={isActive ? 'default' : 'elevated'}
                    padding="default"
                    radius="xl"
                    onClick={function() { if (!isActive) openProfile(s.champion) }}
                    className={'relative overflow-hidden border transition-all duration-200 ' + (isActive ? 'border-primary/40 cursor-default' : 'border-primary/15 cursor-pointer hover:border-primary/30')}
                    style={isActive ? { boxShadow: '0 0 24px rgba(255,198,107,0.1)' } : undefined}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={'font-label text-[10px] font-bold px-2 py-0.5 tracking-widest border ' + (isActive ? 'text-primary bg-primary/15 border-primary/35' : 'text-on-surface/60 bg-white/5 border-white/[0.08]')}
                      >
                        {s.season}
                      </span>
                      {isActive && (
                        <span
                          className="font-label text-[9px] font-bold px-1.5 py-0.5 tracking-widest bg-tertiary/10 border border-tertiary/25 text-tertiary"
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                    <Icon
                      name="emoji_events"
                      fill={isActive}
                      size={32}
                      className={'mb-3 ' + (isActive ? 'text-primary' : 'text-on-surface/40')}
                    />
                    <div className={'font-editorial text-base font-bold leading-tight mb-1 ' + (isActive ? 'text-primary' : 'text-on-surface')}>
                      {s.champion}
                    </div>
                    <div className={'font-mono text-lg font-bold ' + (isActive ? 'text-primary' : 'text-on-surface-variant')}>
                      {s.pts}
                      <span className="font-label text-[10px] text-on-surface/40 font-normal ml-1">pts</span>
                    </div>
                    <div className="font-label text-[11px] text-on-surface-variant/50 mt-0.5">
                      {s.wins} wins
                    </div>
                  </Panel>
                )
              })}
            </div>
          </div>
        )}

        {/* Lifetime Records — distinct from season-only Legacy Archives below */}
        {lifetimeRecords && lifetimeRecords.totalClashes > 0 && (
          <LifetimeRecordsStrip records={lifetimeRecords} openProfile={openProfile} roster={players} />
        )}

        {/* Legacy Archives / Trophy Cabinet */}
        <div>
          <h3 className="font-label text-primary tracking-[0.4em] text-xs mb-8">
            LEGACY ARCHIVES
          </h3>

          {hofRecs.length === 0 && (
            <Panel elevation="elevated" padding="none" className="p-12 text-center">
              <Icon name="workspace_premium" size={48} className="mx-auto mb-4 text-on-surface/20" />
              <p className="font-label text-on-surface-variant/50 tracking-widest text-xs">
                Season records will be enshrined here.
              </p>
            </Panel>
          )}

          {hofRecs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hofRecs.map(function(r) {
                return (
                  <Panel
                    key={r.id}
                    elevation="elevated"
                    padding="none"
                    className="p-6 sm:p-8 group transition-all hover:border-t-primary/40 hover:bg-surface-container-high"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <Icon
                        name={r.icon}
                        fill={r.id === 'streak' || r.id === 'top4r'}
                        size={36}
                        className="text-primary"
                      />
                      <p className="font-mono text-primary font-bold text-lg">{r.value}</p>
                    </div>
                    <h5 className="font-label text-on-surface-variant tracking-widest text-xs uppercase mb-1">
                      {r.title}
                    </h5>
                    <p
                      className="font-editorial text-2xl text-on-surface cursor-pointer hover:text-primary transition-colors"
                      onClick={function() { openProfile(r.holder) }}
                    >
                      {r.holder}
                    </p>
                    <div className="mt-4 pt-4 border-t border-outline-variant/5">
                      <p className="text-[11px] text-on-surface-variant/60">
                        {r.desc}
                      </p>
                      {r.runner.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {r.runner.map(function(ru, i) {
                            var runnerClasses = ['text-[#C0C0C0]', 'text-[#CD7F32]']
                            var labels = ['2nd', '3rd']
                            return (
                              <div key={i + '-' + ru} className="flex items-center gap-2 text-xs text-on-surface/50">
                                <span className={'font-label text-[10px] font-bold min-w-[24px] ' + runnerClasses[i]}>
                                  {labels[i]}
                                </span>
                                <span>{ru}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </Panel>
                )
              })}
            </div>
          )}
        </div>

      </div>
  )
  return embedded ? content : <PageLayout>{content}</PageLayout>
}
