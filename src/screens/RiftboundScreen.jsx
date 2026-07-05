import { useEffect, useMemo, useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { PillTab, PillTabGroup } from '../components/ui'
import { loadCards, thumbUrl } from '../lib/riftbound/cards.js'
import LearnSection from './riftbound/LearnSection.jsx'
import TutorialSection from './riftbound/TutorialSection.jsx'
import DomainsSection from './riftbound/DomainsSection.jsx'
import CardLibrary from './riftbound/CardLibrary.jsx'
import KeywordsSection from './riftbound/KeywordsSection.jsx'
import MetaSection from './riftbound/MetaSection.jsx'
import SetsSection from './riftbound/SetsSection.jsx'
import CompanionSection from './riftbound/CompanionSection.jsx'

var TABS = [
  { id: 'tutorial',  label: 'Tutorial',     icon: 'play_circle' },
  { id: 'learn',     label: 'How to Play',  icon: 'school' },
  { id: 'companion', label: 'Companion',    icon: 'table_restaurant' },
  { id: 'domains',   label: 'Domains',      icon: 'category' },
  { id: 'cards',     label: 'Card Library', icon: 'style' },
  { id: 'keywords',  label: 'Keywords',     icon: 'menu_book' },
  { id: 'meta',      label: 'Meta',         icon: 'trending_up' },
  { id: 'sets',      label: 'Sets',         icon: 'inventory_2' },
]

// Legends fanned behind the hero. Picked for art variety across domains.
var HERO_LEGENDS = ['Jinx - Loose Cannon', 'Ahri - Nine-Tailed Fox', 'Master Yi - Wuju Bladesman', 'Darius - Hand of Noxus', 'Diana - Scorn of the Moon']

function tabFromHash() {
  var h = (typeof window !== 'undefined' && window.location && window.location.hash) ? String(window.location.hash).replace(/^#/, '') : ''
  var ok = TABS.some(function(t) { return t.id === h })
  return ok ? h : 'tutorial'
}

function HeroFan(props) {
  var cards = props.cards
  var fanCards = useMemo(function() {
    if (!cards) return []
    return HERO_LEGENDS
      .map(function(n) {
        var q = n.toLowerCase()
        return cards.find(function(c) { return c.t === 'Legend' && c.n.toLowerCase() === q })
      })
      .filter(Boolean)
  }, [cards])
  if (fanCards.length === 0) return null
  var mid = (fanCards.length - 1) / 2
  return (
    <div className="relative h-44 sm:h-56 w-full max-w-md mx-auto lg:mx-0 select-none" aria-hidden="true">
      <style>{'@keyframes rb-fan-in{from{opacity:0;transform:translateX(-50%) translateY(24px) rotate(0deg)}}@media (prefers-reduced-motion: reduce){.rb-fan-card{animation:none !important}}'}</style>
      {fanCards.map(function(c, i) {
        var off = i - mid
        return (
          <span
            key={c.id}
            className="rb-fan-card absolute top-4 left-1/2 block hover:z-20"
            style={{
              transform: 'translateX(-50%) translateX(' + (off * 42) + 'px) rotate(' + (off * 9) + 'deg)',
              transformOrigin: '50% 120%',
              zIndex: 10 - Math.abs(off),
              animation: 'rb-fan-in 0.5s ease-out backwards',
              animationDelay: (Math.abs(off) * 90) + 'ms',
            }}
          >
            <img
              src={thumbUrl(c, 220)}
              alt=""
              loading="lazy"
              className="w-28 sm:w-36 rounded-lg shadow-2xl shadow-black/60 border border-white/10 transition-transform duration-300 hover:-translate-y-3"
              style={{ aspectRatio: '744 / 1039' }}
            />
          </span>
        )
      })}
    </div>
  )
}

function StatStrip(props) {
  var cards = props.cards
  var stats = useMemo(function() {
    if (!cards || cards.length === 0) return null
    var sets = {}
    var legends = 0
    var battlefields = 0
    cards.forEach(function(c) {
      sets[c.s] = true
      if (c.t === 'Legend') legends++
      if (c.t === 'Battlefield') battlefields++
    })
    return [
      { n: cards.length, label: 'Cards' },
      { n: legends, label: 'Legends' },
      { n: 6, label: 'Domains' },
      { n: battlefields, label: 'Battlefields' },
      { n: Object.keys(sets).length, label: 'Sets' },
    ]
  }, [cards])
  if (!stats) return null
  return (
    <div className="grid grid-cols-5 gap-px rounded-xl overflow-hidden border border-outline-variant/15 bg-outline-variant/10 mb-8">
      {stats.map(function(s) {
        return (
          <div key={s.label} className="bg-surface-container-low px-2 py-3 text-center">
            <div className="font-display text-lg sm:text-2xl text-primary">{s.n}</div>
            <div className="font-label text-[9px] sm:text-[10px] uppercase tracking-widest text-on-surface-variant/50">{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function RiftboundScreen() {
  var _tab = useState(tabFromHash)
  var tab = _tab[0]
  var setTab = _tab[1]
  var _cards = useState(null)
  var cards = _cards[0]
  var setCards = _cards[1]

  useEffect(function() {
    function onHash() {
      // Only react to hashes that name a tab. In-page anchors (e.g. the
      // Learn chapter jump links, #rb-goal) must scroll natively without
      // being hijacked into a tab switch.
      var h = String(window.location.hash || '').replace(/^#/, '')
      var isTab = TABS.some(function(t) { return t.id === h })
      if (isTab) setTab(h)
    }
    window.addEventListener('hashchange', onHash)
    return function() { window.removeEventListener('hashchange', onHash) }
  }, [])

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    return function() { alive = false }
  }, [])

  function go(id) {
    setTab(id)
    try { window.history.replaceState(null, '', '#' + id) } catch (e) {}
  }

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-6xl mx-auto mb-12">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden border border-outline-variant/15 bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low mb-8 px-6 pt-8 pb-6 sm:px-10">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/8 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center relative">
            <div>
              <span className="font-label text-primary uppercase tracking-[0.2em] text-sm mb-2 block">The League of Legends TCG</span>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-on-surface mb-3">Riftbound Hub</h1>
              <p className="font-body text-on-surface-variant text-sm max-w-md">
                Learn the game in 5 minutes with the interactive tutorial, browse every card ever printed, and track what is winning right now.
              </p>
            </div>
            <HeroFan cards={cards} />
          </div>
        </div>

        <StatStrip cards={cards} />

        <PillTabGroup align="start" className="mb-8">
          {TABS.map(function(t) {
            return (
              <PillTab key={t.id} icon={t.icon} active={tab === t.id} aria-pressed={tab === t.id} onClick={function() { go(t.id) }}>
                {t.label}
              </PillTab>
            )
          })}
        </PillTabGroup>

        {tab === 'tutorial'  && <TutorialSection />}
        {tab === 'learn'     && <LearnSection />}
        {tab === 'companion' && <CompanionSection />}
        {tab === 'domains'   && <DomainsSection />}
        {tab === 'cards'     && <CardLibrary />}
        {tab === 'keywords'  && <KeywordsSection />}
        {tab === 'meta'      && <MetaSection />}
        {tab === 'sets'      && <SetsSection />}

        <p className="mt-10 text-[10px] text-on-surface-variant/35 leading-relaxed max-w-2xl">
          TFT Clash is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riftbound, League of Legends, and Riot Games are trademarks or registered trademarks of Riot Games, Inc. Card images are property of Riot Games.
        </p>
      </div>
    </PageLayout>
  )
}
