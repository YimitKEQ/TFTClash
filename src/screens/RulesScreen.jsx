import { useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'
import { PTS, DISCORD_URL } from '../lib/constants.js'

var QUICK_FACTS = [
  {
    icon: 'gavel',
    label: 'Competitive Integrity',
    title: 'Fair Play Policy',
    desc: 'Collusion, win-trading, or third-party automation results in immediate permanent ban from all future events.',
  },
  {
    icon: 'schedule',
    label: 'Timing & Latency',
    title: '15m Check-in',
    desc: 'Players must be present in the lobby 15 minutes before the scheduled start time. Tardiness results in a point penalty.',
  },
  {
    icon: 'star',
    label: 'Prize Pool',
    title: 'Distribution',
    desc: 'Rewards are distributed within 72 hours of tournament conclusion after a fair play audit has been cleared.',
  },
]

var ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

var SCORING_ROWS = [1, 2, 3, 4, 5, 6, 7, 8].map(function(place) {
  return {
    place: ORDINALS[place - 1] + ' Place',
    pts: PTS[place] + ' Point' + (PTS[place] === 1 ? '' : 's'),
    bonus: place === 1 ? '+2 Streak' : place === 2 ? '+1 Streak' : '-',
    isFirst: place === 1,
    isStreak: place <= 2,
    isDim: false,
  }
})

var TIEBREAKER_ITEMS = [
  'Total tournament points',
  'Wins + top 4s (wins count twice)',
  'Most of each placement (1st, then 2nd, then 3rd...)',
  'Most recent game finish',
]

var ACCORDIONS = [
  {
    id: 'registration',
    num: '01.',
    title: 'Registration & Eligibility',
    type: 'text',
    content: 'All participants must be at least 16 years of age and hold a valid account on the respective regional server. Smurf accounts are strictly prohibited; players must register with their highest-ranking primary account.',
  },
  {
    id: 'scoring',
    num: '02.',
    title: 'Scoring System',
    type: 'scoring',
    content: '',
  },
  {
    id: 'tiebreakers',
    num: '03.',
    title: 'Tiebreakers',
    type: 'text',
    content: '',
  },
  {
    id: 'disputes',
    num: '04.',
    title: 'Dispute Process',
    type: 'text',
    content: 'Click Dispute on any result submission to flag it for admin review. An admin will review within 24 hours. Decisions are final. Admins can always override any result.',
  },
]

function ScoringTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-outline-variant/20">
            <th className="py-4 font-condensed uppercase tracking-widest text-xs text-slate-500">Placement</th>
            <th className="py-4 font-condensed uppercase tracking-widest text-xs text-slate-500">Points</th>
            <th className="py-4 font-condensed uppercase tracking-widest text-xs text-slate-500">Bonus</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {SCORING_ROWS.map(function (row) {
            return (
              <tr key={row.place} className="border-b border-outline-variant/10">
                <td className={'py-3 font-bold ' + (row.isFirst ? 'text-primary' : row.isDim ? 'text-slate-500' : 'text-on-surface')}>
                  {row.place}
                </td>
                <td className={'py-3 ' + (row.isDim ? 'text-slate-500' : '')}>
                  {row.pts}
                </td>
                <td className={'py-3 ' + (row.isStreak ? 'text-tertiary' : '')}>
                  {row.bonus}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function RulesScreen() {
  var [expanded, setExpanded] = useState('scoring')
  var [search, setSearch] = useState('')

  function toggleSection(id) {
    setExpanded(function (prev) {
      return prev === id ? null : id
    })
  }

  var q = search.trim().toLowerCase()
  var filtered = q
    ? ACCORDIONS.filter(function (a) {
        if (a.title.toLowerCase().indexOf(q) !== -1) return true
        if (a.content && a.content.toLowerCase().indexOf(q) !== -1) return true
        if (a.id === 'scoring') {
          var scoringMatch = SCORING_ROWS.some(function(row) {
            return row.place.toLowerCase().indexOf(q) !== -1 || row.pts.toLowerCase().indexOf(q) !== -1
          })
          if (scoringMatch) return true
        }
        if (a.id === 'tiebreakers') {
          var tbMatch = TIEBREAKER_ITEMS.some(function(item) {
            return item.toLowerCase().indexOf(q) !== -1
          })
          if (tbMatch) return true
        }
        return false
      })
    : ACCORDIONS

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-6xl mx-auto mb-12">

        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="font-condensed text-primary uppercase tracking-[0.2em] text-sm mb-2 block">
              Handbook v4.2
            </span>
            <h1 className="font-editorial text-5xl md:text-7xl text-on-surface">
              Rules &amp; Regulations
            </h1>
          </div>
          <div className="relative w-full md:w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              placeholder="SEARCH RULES..."
              value={search}
              onChange={function (e) { setSearch(e.target.value) }}
              className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface font-condensed tracking-wider py-4 pl-12 pr-4 transition-all placeholder:text-slate-600 outline-none"
            />
          </div>
        </div>

        {/* 3-Column Quick Facts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {QUICK_FACTS.map(function (fact) {
            return (
              <div
                key={fact.label}
                className="bg-surface-container-low p-8 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                  <Icon name={fact.icon} size={80} />
                </div>
                <h3 className="font-condensed text-primary uppercase tracking-widest text-xs mb-4">
                  {fact.label}
                </h3>
                <p className="font-editorial text-2xl text-on-surface mb-2 leading-tight">
                  {fact.title}
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {fact.desc}
                </p>
              </div>
            )
          })}
        </div>

        {/* Main Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Left: Accordions */}
          <div className="lg:col-span-7 space-y-4">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-sm text-slate-500">
                {'No results for "' + search + '". Try a different search term.'}
              </div>
            )}

            {filtered.map(function (acc) {
              var isOpen = expanded === acc.id
              return (
                <div
                  key={acc.id}
                  className={'bg-surface-container-low group' + (isOpen ? ' border-l-2 border-primary' : '')}
                >
                  <button
                    onClick={function () { toggleSection(acc.id) }}
                    className={'w-full flex items-center justify-between p-6 text-left transition-all' + (isOpen ? ' bg-white/5' : ' hover:bg-white/5')}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-primary text-sm">{acc.num}</span>
                      <span className="font-editorial text-xl">{acc.title}</span>
                    </div>
                    <span className={'transition-colors ' + (isOpen ? 'text-primary' : 'text-slate-500 group-hover:text-primary')}>
                      <Icon name={isOpen ? 'remove' : 'add'} size={20} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-14 pb-6 text-slate-400 leading-relaxed text-sm">
                      {acc.type === 'scoring' ? (
                        <ScoringTable />
                      ) : acc.id === 'tiebreakers' ? (
                        <ol className="space-y-3">
                          {TIEBREAKER_ITEMS.map(function (item, i) {
                            return (
                              <li key={i} className="flex items-start gap-3">
                                <span
                                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold font-condensed rounded bg-primary/[0.12] text-primary"
                                >
                                  {i + 1}
                                </span>
                                <span className="text-sm leading-relaxed pt-0.5">{item}</span>
                              </li>
                            )
                          })}
                        </ol>
                      ) : (
                        <p>{acc.content}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: Sticky Cards */}
          <div className="lg:col-span-5 space-y-6">

            {/* Need Assistance glass panel */}
            <div
              className="p-8 rounded-xl border border-white/5 bg-surface-container/60 backdrop-blur-2xl"
            >
              <h4 className="font-condensed text-secondary uppercase tracking-widest text-xs mb-6">
                Need Assistance?
              </h4>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-secondary/20">
                  <span className="text-secondary">
                    <Icon name="support_agent" size={22} />
                  </span>
                </div>
                <div>
                  <p className="font-editorial text-lg text-on-surface mb-1">Live Admin Support</p>
                  <p className="text-sm text-slate-400">Reach us on Discord</p>
                </div>
              </div>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[rgba(103,226,217,0.08)] border border-[rgba(103,226,217,0.2)] text-[#67E2D9] text-sm font-semibold transition-colors hover:bg-[rgba(103,226,217,0.12)] no-underline"
              >
                Join Discord
              </a>
            </div>

          </div>
        </div>
      </div>
    </PageLayout>
  )
}
