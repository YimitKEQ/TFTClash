import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/layout/PageLayout'
import Icon from '../components/ui/Icon'
import { FAQ_DATA } from '../lib/constants.js'

var CATEGORIES = FAQ_DATA.map(function (cat) {
  return cat.cat
})

var FEATURED = {
  label: 'Essential Knowledge',
  q: 'What is the scoring system?',
  a: 'Standard EMEA scoring: 1st gets 8 pts, 2nd gets 7 pts, down to 8th getting 1 pt. Points accumulate across all games in a clash.'
}

export default function FAQScreen() {
  var navigate = useNavigate()
  var [openKey, setOpenKey] = useState(null)
  var [faqSearch, setFaqSearch] = useState('')
  var [activeTab, setActiveTab] = useState(null)

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
    if (activeTab && cat.cat !== activeTab) return false
    return cat.items.length > 0
  })

  function toggleItem(key) {
    setOpenKey(function (prev) {
      return prev === key ? null : key
    })
  }

  function handleTabClick(tab) {
    setActiveTab(function (prev) {
      return prev === tab ? null : tab
    })
    setOpenKey(null)
  }

  function handleSearchChange(e) {
    setFaqSearch(e.target.value)
    setOpenKey(null)
  }

  var allItems = filteredData.reduce(function (acc, cat) {
    return acc.concat(cat.items.map(function (item) {
      return { item: item, catName: cat.cat }
    }))
  }, [])

  return (
    <PageLayout showSidebar={false} maxWidth="max-w-5xl">

      {/* Hero Header & Search */}
      <section className="text-center mb-16 mt-4">
        <h1 className="text-5xl md:text-7xl font-editorial text-on-background mb-6 leading-tight">
          {'How can we '}
          <span className="text-primary italic">assist</span>
          {' you?'}
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-10 font-body">
          Everything you need to know about the TFT Clash ecosystem, from your first roll to the Grandmaster podium.
        </p>
        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
          <input
            type="text"
            value={faqSearch}
            onChange={handleSearchChange}
            placeholder="Search for rules, scoring, or schedules..."
            className="relative w-full bg-surface-container-lowest border-none py-5 px-14 text-lg font-body focus:outline-none focus:ring-1 focus:ring-primary-container shadow-2xl text-on-surface placeholder:text-on-surface-variant/50"
          />
          <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-primary text-3xl" />
        </div>
      </section>

      {/* Category Tabs */}
      <section className="mb-12">
        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map(function (cat) {
            var isActive = activeTab === cat
            return (
              <button
                key={cat}
                onClick={function () { handleTabClick(cat) }}
                className={
                  'px-6 py-2 rounded-full font-condensed font-bold uppercase tracking-wider text-sm transition-all ' +
                  (isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                    : 'bg-surface-container-high text-slate-400 hover:text-on-surface')
                }
              >
                {cat}
              </button>
            )
          })}
        </div>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Featured Card */}
        <div className="lg:col-span-4 bg-surface-container-low p-8 flex flex-col justify-between border-l-2 border-primary">
          <div>
            <span className="text-primary font-mono text-xs uppercase tracking-[0.2em] mb-4 block">
              {FEATURED.label}
            </span>
            <h3 className="text-2xl font-editorial leading-tight mb-4 text-on-surface">
              {FEATURED.q}
            </h3>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6 font-body">
              {FEATURED.a}
            </p>
          </div>
          <div className="h-20 bg-surface-container-high flex items-center justify-center">
            <div className="flex gap-3">
              {[1,2,3,4,5,6,7,8].map(function (place) {
                var pts = [8,7,6,5,4,3,2,1][place - 1]
                return (
                  <div key={place} className="text-center">
                    <div className={'text-xs font-mono font-bold ' + (place === 1 ? 'text-primary' : 'text-on-surface-variant')}>
                      {pts}
                    </div>
                    <div className="text-[10px] font-mono text-on-surface-variant/50 uppercase">
                      {'#' + place}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Accordion List */}
        <div className="lg:col-span-8 space-y-3">
          {allItems.length === 0 && (
            <div className="bg-surface-container-low p-8 text-center text-on-surface-variant font-body">
              {faqSearch
                ? 'No results for "' + faqSearch + '". Try a different search term.'
                : 'No questions in this category.'}
            </div>
          )}

          {allItems.map(function (entry) {
            var item = entry.item
            var key = entry.catName + '|' + item.q
            var isOpen = openKey === key
            return (
              <div
                key={key}
                className={'bg-surface-container-low group ' + (isOpen ? '' : 'hover:bg-surface-container transition-colors')}
              >
                <button
                  onClick={function () { toggleItem(key) }}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="text-xl font-editorial text-on-surface pr-4">
                    {item.q}
                  </span>
                  <Icon
                    name="expand_more"
                    className={
                      'flex-shrink-0 transition-all ' +
                      (isOpen ? 'text-primary rotate-180' : 'text-slate-500 group-hover:text-primary')
                    }
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-on-surface-variant font-body leading-relaxed border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* CTA Banner */}
      <section className="mt-24 mb-12">
        <div className="relative bg-surface-container-low p-12 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px]"></div>
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl font-editorial mb-4 text-on-background">
              {'Still need '}
              <span className="italic text-primary">human</span>
              {' support?'}
            </h2>
            <p className="text-on-surface-variant font-body">
              Our admins are available via Discord to handle technical disputes and account inquiries.
            </p>
          </div>
          <div className="relative z-10 flex gap-4 flex-wrap">
            <button
              onClick={function () { window.open('https://discord.gg/HJH3NQqqXH', '_blank') }}
              className="bg-surface-variant/30 border border-outline-variant px-8 py-4 font-condensed font-bold uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 text-on-surface"
            >
              Join Discord
            </button>
            <button
              onClick={function () { navigate('/') }}
              className="bg-surface-variant/30 border border-outline-variant px-8 py-4 font-condensed font-bold uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 text-on-surface"
            >
              Back to Home
            </button>
          </div>
        </div>
      </section>

      {/* Footer Stats */}
      <footer className="py-12 flex flex-col md:flex-row justify-between border-t border-white/5 text-xs font-mono text-slate-500 uppercase tracking-widest gap-6">
        <div className="flex gap-8">
          <span>Season: Active</span>
          <span>{'Status: '}<span className="text-tertiary">Operational</span></span>
        </div>
        <div>
          2026 TFT CLASH - ALL RIGHTS RESERVED
        </div>
      </footer>

    </PageLayout>
  )
}
