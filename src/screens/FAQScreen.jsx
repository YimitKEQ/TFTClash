import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Btn } from '../components/ui'
import { FAQ_DATA } from '../lib/constants.js'

var DEFAULT_EXPANDED_CATS = FAQ_DATA.reduce(function (acc, cat) {
  acc[cat.cat] = true
  return acc
}, {})

export default function FAQScreen() {
  var navigate = useNavigate()
  var [openKey, setOpenKey] = useState(null)
  var [faqSearch, setFaqSearch] = useState('')
  var [expandedCats, setExpandedCats] = useState(DEFAULT_EXPANDED_CATS)

  var q = faqSearch.trim().toLowerCase()

  var filteredData = FAQ_DATA.map(function (cat) {
    var items = q
      ? cat.items.filter(function (item) {
          return (
            item.q.toLowerCase().indexOf(q) !== -1 ||
            item.a.toLowerCase().indexOf(q) !== -1
          )
        })
      : cat.items
    return Object.assign({}, cat, { items: items })
  }).filter(function (cat) {
    return cat.items.length > 0
  })

  var totalResults = filteredData.reduce(function (acc, cat) {
    return acc + cat.items.length
  }, 0)

  function toggleCat(catName) {
    setExpandedCats(function (prev) {
      var next = Object.assign({}, prev)
      next[catName] = !prev[catName]
      return next
    })
  }

  function toggleItem(key) {
    setOpenKey(function (prev) {
      return prev === key ? null : key
    })
  }

  return (
    <PageLayout showSidebar={false}>
      <PageHeader title="FAQ" goldWord="FAQ" description="Frequently asked questions about TFT Clash" />

      {/* Search */}
      <input
        type="text"
        placeholder="Search FAQ..."
        value={faqSearch}
        onChange={function (e) {
          setFaqSearch(e.target.value)
          setOpenKey(null)
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

      {totalResults === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: '#9AAABF' }}>
          {'No results for "' + faqSearch + '". Try a different search term.'}
        </div>
      )}

      {/* Categories */}
      <div className="flex flex-col gap-4">
        {filteredData.map(function (cat) {
          var isCatOpen = expandedCats[cat.cat] !== false
          return (
            <div key={cat.cat}>
              {/* Category Header */}
              <button
                onClick={function () {
                  toggleCat(cat.cat)
                }}
                className="w-full flex items-center gap-2.5 text-left"
                style={{
                  padding: '10px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid rgba(242,237,228,.1)',
                  cursor: 'pointer',
                  marginBottom: 10,
                }}
              >
                <span className="text-base" style={{ color: '#9B72CF' }}>
                  <i className={'ti ti-' + cat.icon} />
                </span>
                <span
                  className="flex-1 text-xs font-bold uppercase tracking-widest"
                  style={{
                    color: '#C4B5FD',
                    fontFamily: "'Barlow Condensed',sans-serif",
                    letterSpacing: '.1em',
                  }}
                >
                  {cat.cat}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#9AAABF' }}>
                  {cat.items.length + ' Q'}
                </span>
                <span
                  className="text-base"
                  style={{
                    color: '#9AAABF',
                    transition: 'transform .2s',
                    transform: isCatOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <i className="ti ti-chevron-down" />
                </span>
              </button>

              {/* Items */}
              {isCatOpen && (
                <div className="flex flex-col gap-1.5">
                  {cat.items.map(function (item) {
                    var key = cat.cat + '|' + item.q
                    var isOpen = openKey === key
                    return (
                      <div
                        key={key}
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
                            toggleItem(key)
                          }}
                          className="w-full flex items-center justify-between gap-3 text-left"
                          style={{
                            padding: '14px 16px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            className="text-sm font-semibold leading-snug"
                            style={{ color: isOpen ? '#C4B5FD' : '#F2EDE4' }}
                          >
                            {item.q}
                          </span>
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
                          <div style={{ padding: '0 16px 16px 16px' }}>
                            <div className="text-sm leading-relaxed" style={{ color: '#BECBD9' }}>
                              {item.a}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CTA */}
      {totalResults > 0 && (
        <div
          className="mt-8 rounded-2xl text-center"
          style={{
            background: 'rgba(155,114,207,.06)',
            border: '1px solid rgba(155,114,207,.2)',
            padding: '20px 24px',
          }}
        >
          <div className="text-base font-bold mb-1.5" style={{ color: '#C4B5FD' }}>
            Still have questions?
          </div>
          <div className="text-sm leading-relaxed mb-3.5" style={{ color: '#BECBD9' }}>
            Join the community on Discord or reach out to an admin directly.
          </div>
          <div className="flex gap-2.5 justify-center flex-wrap">
            <Btn
              v="primary"
              s="sm"
              onClick={function () {
                window.open('https://discord.gg/tftclash', '_blank')
              }}
            >
              <i className="ti ti-brand-discord" style={{ marginRight: 5 }} />
              Join Discord
            </Btn>
            <Btn
              v="dark"
              s="sm"
              onClick={function () {
                navigate('/')
              }}
            >
              Back to Home
            </Btn>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
