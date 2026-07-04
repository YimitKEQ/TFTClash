import { useEffect, useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { PillTab, PillTabGroup } from '../components/ui'
import LearnSection from './riftbound/LearnSection.jsx'
import DomainsSection from './riftbound/DomainsSection.jsx'
import CardLibrary from './riftbound/CardLibrary.jsx'
import KeywordsSection from './riftbound/KeywordsSection.jsx'
import MetaSection from './riftbound/MetaSection.jsx'
import SetsSection from './riftbound/SetsSection.jsx'

var TABS = [
  { id: 'learn',    label: 'How to Play', icon: 'school' },
  { id: 'domains',  label: 'Domains',     icon: 'category' },
  { id: 'cards',    label: 'Card Library', icon: 'style' },
  { id: 'keywords', label: 'Keywords',    icon: 'menu_book' },
  { id: 'meta',     label: 'Meta',        icon: 'trending_up' },
  { id: 'sets',     label: 'Sets',        icon: 'inventory_2' },
]

function tabFromHash() {
  var h = (typeof window !== 'undefined' && window.location && window.location.hash) ? String(window.location.hash).replace(/^#/, '') : ''
  var ok = TABS.some(function(t) { return t.id === h })
  return ok ? h : 'learn'
}

export default function RiftboundScreen() {
  var _tab = useState(tabFromHash)
  var tab = _tab[0]
  var setTab = _tab[1]

  useEffect(function() {
    function onHash() { setTab(tabFromHash()) }
    window.addEventListener('hashchange', onHash)
    return function() { window.removeEventListener('hashchange', onHash) }
  }, [])

  function go(id) {
    setTab(id)
    try { window.history.replaceState(null, '', '#' + id) } catch (e) {}
  }

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-6xl mx-auto mb-12">
        <div className="mb-8">
          <span className="font-label text-primary uppercase tracking-[0.2em] text-sm mb-2 block">The League of Legends TCG</span>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-on-surface mb-3">Riftbound Hub</h1>
          <p className="font-body text-on-surface-variant text-sm max-w-2xl">
            Learn the game from zero, browse every card ever printed, and track what is winning right now. Built by the TFT Clash crew for our card game corner.
          </p>
        </div>

        <PillTabGroup align="start" className="mb-8">
          {TABS.map(function(t) {
            return (
              <PillTab key={t.id} icon={t.icon} active={tab === t.id} onClick={function() { go(t.id) }}>
                {t.label}
              </PillTab>
            )
          })}
        </PillTabGroup>

        {tab === 'learn'    && <LearnSection />}
        {tab === 'domains'  && <DomainsSection />}
        {tab === 'cards'    && <CardLibrary />}
        {tab === 'keywords' && <KeywordsSection />}
        {tab === 'meta'     && <MetaSection />}
        {tab === 'sets'     && <SetsSection />}

        <p className="mt-10 text-[10px] text-on-surface-variant/35 leading-relaxed max-w-2xl">
          TFT Clash is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riftbound, League of Legends, and Riot Games are trademarks or registered trademarks of Riot Games, Inc. Card images are property of Riot Games.
        </p>
      </div>
    </PageLayout>
  )
}
