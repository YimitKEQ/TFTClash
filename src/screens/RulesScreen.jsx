import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { RULES_SECTIONS } from '../lib/constants.js'

var PT_COLORS = ['#E8A838', '#C4B5FD', '#4ECDC4', '#34D399', '#9AAABF', '#8896A8', '#6B7280', '#4B5563']

var QUICK_FACTS = [
  { label: '1st Place', value: '8 pts', color: '#E8A838', icon: 'trophy' },
  { label: 'Games per Clash', value: '3-5', color: '#9B72CF', icon: 'cards' },
  { label: 'Check-in Opens', value: '60 min before', color: '#4ECDC4', icon: 'clock' },
]

export default function RulesScreen() {
  var navigate = useNavigate()
  var [expanded, setExpanded] = useState(null)
  var [rulesSearch, setRulesSearch] = useState('')

  var q = rulesSearch.trim().toLowerCase()
  var filtered = q
    ? RULES_SECTIONS.filter(function (s) {
        return (
          s.title.toLowerCase().indexOf(q) !== -1 ||
          s.content.toLowerCase().indexOf(q) !== -1
        )
      })
    : RULES_SECTIONS

  function toggleSection(id) {
    setExpanded(function (prev) {
      return prev === id ? null : id
    })
  }

  return (
    <PageLayout showSidebar={false}>
      <PageHeader title="Rules" goldWord="Rules" description="Official tournament rules and regulations" />

      {/* Quick Facts */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {QUICK_FACTS.map(function (fact) {
          return (
            <div
              key={fact.label}
              className="rounded-xl border text-center"
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(242,237,228,.08)',
                padding: '14px 12px',
              }}
            >
              <div className="text-xl mb-1.5" style={{ color: fact.color }}>
                <i className={'ti ti-' + fact.icon} />
              </div>
              <div
                className="text-base font-bold mb-0.5"
                style={{
                  color: fact.color,
                  fontFamily: "'Barlow Condensed',sans-serif",
                }}
              >
                {fact.value}
              </div>
              <div
                className="text-xs uppercase tracking-wider"
                style={{ color: '#9AAABF', letterSpacing: '.08em' }}
              >
                {fact.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search rules..."
        value={rulesSearch}
        onChange={function (e) {
          setRulesSearch(e.target.value)
          setExpanded(null)
        }}
        className="w-full mb-4 rounded-xl text-sm outline-none"
        style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(242,237,228,.1)',
          color: '#F2EDE4',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {/* Sections */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: '#9AAABF' }}>
            {'No results for "' + rulesSearch + '". Try a different term.'}
          </div>
        )}

        {filtered.map(function (sec) {
          var isOpen = expanded === sec.id
          return (
            <div
              key={sec.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: isOpen ? 'rgba(155,114,207,.06)' : 'rgba(255,255,255,.02)',
                border:
                  '1px solid ' +
                  (isOpen ? 'rgba(155,114,207,.25)' : 'rgba(242,237,228,.08)'),
                transition: 'all .2s',
              }}
            >
              <button
                onClick={function () {
                  toggleSection(sec.id)
                }}
                className="w-full flex items-center justify-between gap-3 text-left"
                style={{
                  padding: '16px 18px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg" style={{ color: isOpen ? '#9B72CF' : '#8896A8' }}>
                    <i className={'ti ti-' + sec.icon} />
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isOpen ? '#C4B5FD' : '#F2EDE4' }}
                  >
                    {sec.title}
                  </span>
                </div>
                <span
                  className="text-lg flex-shrink-0"
                  style={{
                    color: isOpen ? '#9B72CF' : '#8896A8',
                    transition: 'transform .2s',
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                >
                  +
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 18px 18px' }}>
                  {sec.isPointsTable ? (
                    <div style={{ overflowX: 'auto' }}>
                      <div className="flex gap-1.5" style={{ minWidth: 360 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(function (place) {
                          var ordinal =
                            place === 1
                              ? '1st'
                              : place === 2
                              ? '2nd'
                              : place === 3
                              ? '3rd'
                              : place + 'th'
                          return (
                            <div
                              key={place}
                              className="flex-1 text-center rounded-lg"
                              style={{
                                background: 'rgba(255,255,255,.03)',
                                border: '1px solid rgba(242,237,228,.08)',
                                padding: '10px 4px',
                              }}
                            >
                              <div
                                className="text-xs mb-1.5 uppercase tracking-wide"
                                style={{
                                  color: '#9AAABF',
                                  fontFamily: "'Barlow Condensed',sans-serif",
                                  letterSpacing: '.06em',
                                }}
                              >
                                {ordinal}
                              </div>
                              <div
                                className="text-xl font-bold"
                                style={{
                                  color: PT_COLORS[place - 1],
                                  fontFamily: "'Barlow Condensed',sans-serif",
                                }}
                              >
                                {9 - place}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: '#9AAABF' }}>
                                pts
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed" style={{ color: '#BECBD9' }}>
                      {sec.content}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </PageLayout>
  )
}
