import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getSeasonChampion } from '../lib/constants.js'
import { ARCHIVE_SEED, buildStandings, formatArchiveDate, tournamentFormat } from '../lib/archiveSeed.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon } from '../components/ui'

function SeasonHero(props) {
  var season = props.season
  var isLegacy = season.status === 'legacy'

  return (
    <div
      className={'lg:col-span-4 relative h-64 lg:h-auto overflow-hidden' + (isLegacy ? ' opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500' : '')}
    >
      <div
        className="absolute inset-0 w-full h-full"
        style={{ background: season.bgGradient }}
      />
      {/* Grid texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Glow orb */}
      <div
        className="absolute"
        style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: isLegacy
            ? 'radial-gradient(circle, rgba(155,114,207,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(232,168,56,0.20) 0%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      {/* Large season number watermark */}
      <div className="absolute bottom-6 left-6">
        <div
          className={'font-editorial text-7xl font-bold leading-none select-none ' + (isLegacy ? 'text-white/10' : 'text-primary/20')}
        >
          {season.number}
        </div>
      </div>
      {/* Gradient fade to content (desktop) */}
      <div className="absolute inset-0 bg-gradient-to-r from-surface-container-low via-transparent to-transparent hidden lg:block" />
      {/* Gradient fade to content (mobile) */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent lg:hidden" />
      {/* Status badge */}
      <div className="absolute top-6 left-6">
        {isLegacy ? (
          <span className="bg-surface-variant px-4 py-1 text-on-surface-variant font-label font-bold uppercase tracking-tighter rounded text-sm">
            LEGACY
          </span>
        ) : (
          <span className="bg-primary px-4 py-1 text-on-primary font-label font-bold uppercase tracking-tighter rounded text-sm">
            ACTIVE ERA
          </span>
        )}
      </div>
    </div>
  )
}

function SeasonCard(props) {
  var season = props.season
  var navigate = props.navigate
  var isLegacy = season.status === 'legacy'

  return (
    <section className={'rounded-lg overflow-hidden group' + (isLegacy ? ' bg-surface-container-low/50 border border-white/5' : ' bg-surface-container-low')}>
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <SeasonHero season={season} />

        {/* Season Data Content */}
        <div className="lg:col-span-8 p-8 flex flex-col justify-between">
          {/* Header row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className={'font-editorial text-4xl text-on-surface' + (isLegacy ? ' opacity-80' : '')}>
                {season.title}
              </h2>
              <p className="font-label text-slate-500 uppercase tracking-widest text-sm">
                {season.subtitle + ' - ' + season.year}
              </p>
            </div>

            {/* Champion spotlight */}
            <div className={'flex items-center gap-4 p-4' + (isLegacy ? ' bg-surface-container-lowest/50 border border-outline-variant/20' : ' bg-surface-container-lowest border border-primary/30')}>
              <div className="flex flex-col">
                <span className="font-label text-xs text-slate-500 uppercase">CHAMPION</span>
                <span className={'font-display text-xl tracking-tight' + (isLegacy ? ' text-on-surface opacity-70' : ' text-primary')}>
                  {season.champion.toUpperCase()}
                </span>
              </div>
              <div className={'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0' + (isLegacy ? ' bg-white/5' : ' bg-primary/10')}>
                <Icon
                  name={isLegacy ? 'history_edu' : 'workspace_premium'}
                  fill={!isLegacy}
                  className={'text-2xl' + (isLegacy ? ' text-slate-500' : ' text-primary')}
                />
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className={'rounded p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-on-surface')}>{season.participants}</p>
              <p className={'font-label text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>PARTICIPANTS</p>
            </div>
            <div className={'rounded p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-on-surface')}>{season.clashes}</p>
              <p className={'font-label text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>CLASHES PLAYED</p>
            </div>
            <div className={'rounded p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-tertiary')}>{season.topScore}</p>
              <p className={'font-label text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>TOP SCORE</p>
            </div>
            <div className={'rounded p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-secondary')}>{season.players}</p>
              <p className={'font-label text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>TOTAL PLAYERS</p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex justify-end items-center gap-4">
            {isLegacy ? (
              <span className="font-label uppercase tracking-wider flex items-center gap-2 text-sm text-slate-600 cursor-default">
                SEASON COMPLETE
                <Icon name="lock" className="text-sm" />
              </span>
            ) : (
              <button
                className="font-label uppercase tracking-wider flex items-center gap-2 text-sm transition-colors text-slate-400 hover:text-on-surface"
                onClick={function() { navigate('/standings') }}
              >
                VIEW STANDINGS
                <Icon name="arrow_forward" className="text-sm" />
              </button>
            )}
            {isLegacy ? (
              <span className="px-8 py-3 font-label font-bold uppercase tracking-widest rounded-full text-sm bg-surface-variant/30 text-on-surface-variant/40 border border-white/5 cursor-default select-none">
                ARCHIVED
              </span>
            ) : (
              <Btn
                variant="primary"
                size="md"
                onClick={function() { navigate('/season-recap') }}
              >
                Season Recap
              </Btn>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function ArchiveScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var players = ctx.players || []
  var pastClashes = ctx.pastClashes || []
  var seasonConfig = ctx.seasonConfig || {}

  var [search, setSearch] = useState('')
  var [selected, setSelected] = useState(null)

  // Build season card from live context data
  var champion = getSeasonChampion()
  var championName = (champion && champion.name) || (players.length > 0 ? players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })[0].name : 'TBD')
  var topPlayer = players.length > 0 ? players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })[0] : null
  var topScore = topPlayer ? String(topPlayer.pts || 0) : '0'

  var currentSeason = {
    key: 'current',
    number: seasonConfig.seasonTag || 'S1',
    title: seasonConfig.seasonName || 'Season 1',
    subtitle: 'CURRENT SEASON',
    year: new Date().getFullYear().toString(),
    status: 'active',
    champion: championName,
    participants: String(players.length),
    clashes: String(pastClashes.length),
    topScore: topScore,
    players: String(players.length),
    bgGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  }

  // Reflect the full archived history (live + seeded) in the clashes metric.
  currentSeason.clashes = String(pastClashes.length + ARCHIVE_SEED.length)

  var seasonDefs = [currentSeason]

  // Full tournament objects: live pastClashes plus seeded historical archive,
  // newest first. Each is clickable to open a generated final-standings sheet.
  var liveEvents = pastClashes.map(function(clash) {
    return {
      id: 'live-' + clash.id,
      name: clash.name || ('Clash #' + clash.id),
      winner: clash.champion || '',
      entries: clash.players || 8,
      lobbies: clash.lobbies || Math.ceil((clash.players || 8) / 8),
      date: clash.date || '',
      top3: clash.top3 || (clash.champion ? [clash.champion] : []),
      topScore: clash.topScore || 50,
      seeded: false,
    }
  })
  var minorEvents = liveEvents.concat(ARCHIVE_SEED).sort(function(a, b) {
    return String(b.date).localeCompare(String(a.date))
  })

  var filteredMinor = minorEvents.filter(function(e) {
    if (!search) return true
    var q = search.toLowerCase()
    return (
      (e.name||'').toLowerCase().indexOf(q) !== -1 ||
      (e.winner && e.winner.toLowerCase().indexOf(q) !== -1)
    )
  })

  return (
    <PageLayout>
      <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">

        {/* Page header */}
        <header className="mb-12">
          <h1 className="font-editorial text-5xl md:text-7xl text-on-surface mb-4">
            Season Archive
          </h1>
          <p className="text-on-surface-variant max-w-2xl text-lg leading-relaxed">
            Every past season, every champion, every stat line. A permanent record of who ran it and when.
          </p>
        </header>

        {/* Seasons Archive Grid */}
        <div className="flex flex-col gap-8">
          {seasonDefs.map(function(season) {
            return (
              <SeasonCard
                key={season.key}
                season={season}
                navigate={navigate}
              />
            )
          })}

          {/* Tournament detail (opens when a row is clicked) */}
          {selected && (
            <TournamentDetail tournament={selected} onBack={function() { setSelected(null) }} />
          )}

          {/* Minor Tournaments Table */}
          {!selected && (
          <div className="mt-4 bg-surface-container-low rounded p-1">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5">
              <h3 className="font-label text-xl uppercase tracking-widest text-primary flex items-center gap-3">
                <Icon name="summarize" className="text-xl" />
                Minor Tournaments and Qualifiers
              </h3>
              {/* Search */}
              <div className="relative">
                <Icon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-500 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={search}
                  onChange={function(e) { setSearch(e.target.value) }}
                  className="bg-surface-container-lowest border-0 border-b border-transparent focus:border-primary focus:ring-0 text-sm pl-10 pr-4 py-2 w-56 transition-all text-on-surface placeholder:text-slate-600 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-body">
                <thead>
                  <tr className="font-label uppercase text-xs text-slate-500 tracking-tighter border-b border-white/5">
                    <th className="px-8 py-4">Event Name</th>
                    <th className="px-8 py-4">Winner</th>
                    <th className="px-8 py-4">Entries</th>
                    <th className="px-8 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMinor.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center">
                        {minorEvents.length === 0 ? (
                          <div>
                            <Icon name="history" size={48} className="mx-auto text-on-surface/20 block mb-4" />
                            <p className="text-sm text-slate-500">
                              No past clashes recorded yet. Results from each weekly clash will be archived here.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Icon name="search_off" size={48} className="mx-auto text-on-surface/20 block mb-4" />
                            <p className="text-sm text-on-surface/50">No events match your search.</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {filteredMinor.map(function(event, i) {
                    return (
                      <tr
                        key={event.id || event.name}
                        onClick={function() { setSelected(event); if (typeof window !== 'undefined') window.scrollTo(0, 0) }}
                        className="hover:bg-primary/5 transition-colors cursor-pointer group"
                      >
                        <td className="px-8 py-5 font-bold text-on-surface group-hover:text-primary transition-colors">
                          <span className="inline-flex items-center gap-2">{event.name}<Icon name="chevron_right" size={16} className="opacity-0 group-hover:opacity-60 transition-opacity" /></span>
                        </td>
                        <td className="px-8 py-5 font-mono text-tertiary">{event.winner}</td>
                        <td className="px-8 py-5 font-mono text-on-surface">{event.entries}</td>
                        <td className="px-8 py-5 font-mono text-slate-500">{formatArchiveDate(event.date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

        </div>
      </div>
    </PageLayout>
  )
}

var MEDALS = ['#e8a838', '#c0c8d4', '#cd7f32']

function StatTile(props) {
  return (
    <div className="bg-surface-container rounded p-4 text-center">
      <p className={'font-mono text-2xl ' + (props.color || 'text-on-surface')}>{props.value}</p>
      <p className="font-label text-xs uppercase text-slate-500">{props.label}</p>
    </div>
  )
}

function PodiumCard(props) {
  var row = props.row
  var place = props.place
  var col = MEDALS[place]
  var labels = ['Champion', 'Runner-up', 'Third place']
  return (
    <div className="flex-1 min-w-[150px] rounded-lg border p-4 flex items-center gap-4" style={{ borderColor: col + '4d', background: col + '12' }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-display text-lg font-bold" style={{ background: col + '22', color: col }}>
        {place + 1}
      </div>
      <div className="min-w-0">
        <p className="font-label text-[10px] uppercase tracking-wider text-slate-500">{labels[place]}</p>
        <p className="font-display text-lg text-on-surface truncate">{row.name}</p>
        <p className="font-mono text-xs" style={{ color: col }}>{row.points} pts <span className="text-slate-500">/ #{row.region}</span></p>
      </div>
    </div>
  )
}

function TournamentDetail(props) {
  var t = props.tournament
  var standings = buildStandings(t)
  var podium = standings.slice(0, 3)
  var fmt = tournamentFormat(t)
  var games = standings.length ? standings[0].games : 5
  var hasFinalsCut = t.entries > 8

  return (
    <div className="mt-4">
      <button
        onClick={props.onBack}
        className="inline-flex items-center gap-2 mb-6 font-label uppercase tracking-wider text-sm text-slate-400 hover:text-on-surface transition-colors"
      >
        <Icon name="arrow_back" size={18} />Back to archive
      </button>

      {/* Header */}
      <div className="bg-surface-container-low rounded-lg overflow-hidden mb-6">
        <div className="relative p-8 border-b border-white/5">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ background: 'radial-gradient(70% 120% at 0% 0%, #e8a838, transparent 60%)' }} />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-label text-[11px] uppercase tracking-wider font-bold rounded px-2 py-1 bg-primary/15 text-primary">{fmt}</span>
              <span className="font-label text-[11px] uppercase tracking-wider font-bold rounded px-2 py-1 bg-white/5 text-slate-400">EUW</span>
              <span className="font-label text-[11px] uppercase tracking-wider font-bold rounded px-2 py-1 bg-white/5 text-slate-400">Season 1</span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-on-surface leading-tight">{t.name}</h2>
            <p className="font-label text-slate-500 uppercase tracking-widest text-sm mt-2">{formatArchiveDate(t.date)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          <StatTile label="Players" value={t.entries} />
          <StatTile label="Lobbies" value={t.lobbies || Math.ceil(t.entries / 8)} color="text-on-surface" />
          <StatTile label="Games" value={games} color="text-secondary" />
          <StatTile label="Top Score" value={t.topScore} color="text-tertiary" />
        </div>
      </div>

      {/* Podium */}
      <div className="flex flex-wrap gap-3 mb-6">
        {podium.map(function(row, idx) {
          return <PodiumCard key={row.rank} row={row} place={idx} />
        })}
      </div>

      {/* Full standings */}
      <div className="bg-surface-container-low rounded-lg overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-label text-lg uppercase tracking-widest text-primary flex items-center gap-3">
            <Icon name="leaderboard" className="text-xl" />Final Standings
          </h3>
          <span className="font-mono text-xs text-slate-500">{standings.length} entries</span>
        </div>
        <div className="max-h-[72vh] overflow-y-auto">
          <table className="w-full text-left font-body">
            <thead className="sticky top-0 bg-surface-container-low z-10">
              <tr className="font-label uppercase text-xs text-slate-500 tracking-tighter border-b border-white/5">
                <th className="px-6 py-3 w-16">#</th>
                <th className="px-6 py-3">Player</th>
                <th className="px-6 py-3 text-right">Pts</th>
                <th className="px-6 py-3 text-right hidden sm:table-cell">1st</th>
                <th className="px-6 py-3 text-right hidden sm:table-cell">Top 4</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {standings.map(function(row) {
                var medal = row.rank <= 3 ? MEDALS[row.rank - 1] : null
                var rowsOut = [
                  <tr key={row.rank} className={'transition-colors ' + (medal ? 'bg-white/[0.02]' : 'hover:bg-white/5')}>
                    <td className="px-6 py-3">
                      <span className="font-mono font-bold text-sm" style={{ color: medal || '#7c8aa0' }}>{row.rank}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-bold text-on-surface">{row.name}</span>
                      <span className="font-mono text-xs text-slate-600 ml-1.5">#{row.region}</span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-bold text-on-surface">{row.points}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">{row.firsts}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-400 hidden sm:table-cell">{row.top4}</td>
                  </tr>,
                ]
                if (hasFinalsCut && row.rank === 8) {
                  rowsOut.push(
                    <tr key="cut" className="bg-primary/5">
                      <td colSpan={5} className="px-6 py-1.5 text-center font-label text-[10px] uppercase tracking-widest text-primary/70 font-bold">
                        Finals cut - Top 8 advanced
                      </td>
                    </tr>
                  )
                }
                return rowsOut
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
