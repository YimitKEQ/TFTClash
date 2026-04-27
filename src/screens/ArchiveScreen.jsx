import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getSeasonChampion } from '../lib/constants.js'
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

  var seasonDefs = [currentSeason]

  // Minor events from pastClashes
  var minorEvents = pastClashes.map(function(clash) {
    return {
      name: clash.name || ('Clash #' + clash.id),
      winner: clash.champion || '',
      entries: clash.players || 8,
      date: clash.date || '',
    }
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
          <h1 className="font-editorial italic text-5xl md:text-7xl text-on-surface mb-4">
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

          {/* Minor Tournaments Table */}
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
                          <p className="text-sm text-slate-500">No events match your search.</p>
                        )}
                      </td>
                    </tr>
                  )}
                  {filteredMinor.map(function(event, i) {
                    return (
                      <tr key={event.name} className="hover:bg-white/5 transition-colors">
                        <td className="px-8 py-5 font-bold text-on-surface">{event.name}</td>
                        <td className="px-8 py-5 font-mono text-tertiary">{event.winner}</td>
                        <td className="px-8 py-5 font-mono text-on-surface">{event.entries}</td>
                        <td className="px-8 py-5 font-mono text-slate-500">{event.date}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </PageLayout>
  )
}
