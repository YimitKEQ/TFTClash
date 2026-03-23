import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

var SEASON_DEFS = [
  {
    key: 's1',
    number: 1,
    title: 'Season 1',
    subtitle: 'NEON ASCENSION',
    year: '2025',
    status: 'active',
    champion: 'Levitate',
    participants: '96',
    clashes: '12',
    topScore: '1024',
    players: '9',
    bgGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  {
    key: 's0',
    number: 0,
    title: 'Season 0',
    subtitle: 'GENESIS PROTOCOL',
    year: '2024',
    status: 'legacy',
    champion: 'Zounderkite',
    participants: '64',
    clashes: '8',
    topScore: '880',
    players: '7',
    bgGradient: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #252525 100%)',
  },
]

var MINOR_EVENTS = [
  { name: 'Genesis Warmup #3', winner: 'BingBing', entries: 16, date: 'Dec 12, 2024' },
  { name: 'Neon Circuit Qualifier', winner: 'Ole', entries: 24, date: 'Jan 04, 2025' },
  { name: 'Community Clash #01', winner: 'Sybor', entries: 16, date: 'Jan 18, 2025' },
  { name: 'Weekly Clash #04', winner: 'Uri', entries: 8, date: 'Feb 01, 2025' },
  { name: 'Weekly Clash #07', winner: 'Wiwi', entries: 8, date: 'Feb 22, 2025' },
  { name: 'Weekly Clash #11', winner: 'Ivdim', entries: 8, date: 'Mar 08, 2025' },
]

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
          className="font-serif text-7xl font-bold leading-none select-none"
          style={{ color: isLegacy ? 'rgba(255,255,255,0.10)' : 'rgba(232,168,56,0.20)' }}
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
          <span className="bg-surface-variant px-4 py-1 text-on-surface-variant font-condensed font-bold uppercase tracking-tighter rounded-sm text-sm">
            LEGACY
          </span>
        ) : (
          <span className="bg-primary px-4 py-1 text-on-primary font-condensed font-bold uppercase tracking-tighter rounded-sm text-sm">
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
              <h2 className={'font-serif text-4xl text-on-surface' + (isLegacy ? ' opacity-80' : '')}>
                {season.title}
              </h2>
              <p className="font-condensed text-slate-500 uppercase tracking-widest text-sm">
                {season.subtitle + ' - ' + season.year}
              </p>
            </div>

            {/* Champion spotlight */}
            <div className={'flex items-center gap-4 p-4' + (isLegacy ? ' bg-surface-container-lowest/50 border-l-4 border-slate-700' : ' bg-surface-container-lowest border-l-4 border-primary')}>
              <div className="flex flex-col">
                <span className="font-condensed text-xs text-slate-500 uppercase">CHAMPION</span>
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
            <div className={'rounded-sm p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-on-surface')}>{season.participants}</p>
              <p className={'font-condensed text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>PARTICIPANTS</p>
            </div>
            <div className={'rounded-sm p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-on-surface')}>{season.clashes}</p>
              <p className={'font-condensed text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>CLASHES PLAYED</p>
            </div>
            <div className={'rounded-sm p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-tertiary')}>{season.topScore}</p>
              <p className={'font-condensed text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>TOP SCORE</p>
            </div>
            <div className={'rounded-sm p-4 text-center' + (isLegacy ? ' bg-surface-container/40' : ' bg-surface-container')}>
              <p className={'font-mono text-2xl' + (isLegacy ? ' text-slate-400' : ' text-secondary')}>{season.players}</p>
              <p className={'font-condensed text-xs uppercase' + (isLegacy ? ' text-slate-600' : ' text-slate-500')}>TOTAL PLAYERS</p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex justify-end items-center gap-4">
            <button
              className={'font-condensed uppercase tracking-wider flex items-center gap-2 text-sm transition-colors' + (isLegacy ? ' text-slate-500 hover:text-on-surface' : ' text-slate-400 hover:text-on-surface')}
              onClick={function() { navigate('/standings') }}
            >
              {isLegacy ? 'ARCHIVE DATA' : 'VIEW STANDINGS'}
              <Icon name={isLegacy ? 'database' : 'arrow_forward'} className="text-sm" />
            </button>
            <button
              className={'px-8 py-3 font-condensed font-bold uppercase tracking-widest rounded-full transition-all text-sm' + (isLegacy ? ' bg-surface-variant/30 text-on-surface-variant border border-white/5 hover:bg-surface-variant/50' : ' hover:scale-105')}
              style={isLegacy ? {} : { background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)', color: '#281800' }}
              onClick={function() { navigate('/season-recap') }}
            >
              SEASON RECAP
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function ArchiveScreen() {
  var navigate = useNavigate()
  var ctx = useApp()

  var [search, setSearch] = useState('')

  var filteredMinor = MINOR_EVENTS.filter(function(e) {
    if (!search) return true
    var q = search.toLowerCase()
    return (
      e.name.toLowerCase().indexOf(q) !== -1 ||
      e.winner.toLowerCase().indexOf(q) !== -1
    )
  })

  return (
    <PageLayout>
      <div className="p-8 md:p-12 max-w-7xl mx-auto w-full">

        {/* Page header */}
        <header className="mb-12">
          <h1 className="font-serif text-5xl md:text-7xl text-on-surface mb-4">
            The Hall of Victory
          </h1>
          <p className="text-slate-400 max-w-2xl text-lg">
            A chronological record of past seasons, eternalizing the champions who rose through
            the Obsidian Arena and the statistics that defined their legacy.
          </p>
        </header>

        {/* Seasons Archive Grid */}
        <div className="flex flex-col gap-8">
          {SEASON_DEFS.map(function(season) {
            return (
              <SeasonCard
                key={season.key}
                season={season}
                navigate={navigate}
              />
            )
          })}

          {/* Minor Tournaments Table */}
          <div className="mt-4 bg-surface-container-low rounded-sm p-1">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5">
              <h3 className="font-condensed text-xl uppercase tracking-widest text-primary flex items-center gap-3">
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
                  <tr className="font-condensed uppercase text-xs text-slate-500 tracking-tighter border-b border-white/5">
                    <th className="px-8 py-4">Event Name</th>
                    <th className="px-8 py-4">Winner</th>
                    <th className="px-8 py-4">Entries</th>
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMinor.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-10 text-center text-sm text-slate-500">
                        No events match your search.
                      </td>
                    </tr>
                  )}
                  {filteredMinor.map(function(event, i) {
                    return (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-8 py-5 font-bold text-on-surface">{event.name}</td>
                        <td className="px-8 py-5 font-mono text-tertiary">{event.winner}</td>
                        <td className="px-8 py-5 font-mono text-on-surface">{event.entries}</td>
                        <td className="px-8 py-5 font-mono text-slate-500">{event.date}</td>
                        <td className="px-8 py-5 text-right">
                          <button
                            className="text-primary text-xs font-condensed font-bold uppercase hover:underline"
                            onClick={function() { navigate('/archive') }}
                          >
                            DETAILS
                          </button>
                        </td>
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
