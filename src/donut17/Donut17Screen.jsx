import { useEffect } from 'react'
import './theme.css'

import TopNav from './layout/TopNav'
import SideNav from './layout/SideNav'
import { useActiveTab } from './lib/useActiveTab'

import OpenerAdvisor from './tabs/OpenerAdvisor'
import SynergyGrid   from './tabs/SynergyGrid'
import Champions     from './tabs/Champions'
import CompLines     from './tabs/CompLines'
import Gods          from './tabs/Gods'
import Items         from './tabs/Items'
import Augments      from './tabs/Augments'
import TeamPlanner   from './tabs/TeamPlanner'
import Meet          from './tabs/Meet'

import champions  from './data/champions.json'
import traits     from './data/traits.json'
import items      from './data/items.json'
import augments   from './data/augments.json'
import gods       from './data/gods.json'
import comps      from './data/comp_lines.json'
import synergy    from './data/synergy_grid.json'
import meta       from './data/meta.json'

export default function Donut17Screen() {
  var _t = useActiveTab('opener')
  var tab = _t[0]
  var setTab = _t[1]

  useEffect(function () {
    var prev = document.title
    document.title = 'Donut 17 - Space Gods Prep'
    return function () { document.title = prev }
  }, [])

  var dataset = {
    champions: champions || [],
    traits: traits || [],
    items: items || [],
    augments: augments || [],
    gods: gods || [],
    comps: comps || [],
    synergy: synergy || {},
    meta: meta || {},
  }

  var hasData = dataset.champions.length > 0

  return (
    <div className="d17">
      <TopNav tab={tab} onTab={setTab}/>
      <div className="flex">
        <SideNav tab={tab} onTab={setTab}/>
        <main className="flex-1 lg:ml-64 p-6 md:p-10 min-h-screen">
          {!hasData && <EmptyState/>}
          {hasData && tab === 'opener'    && <OpenerAdvisor data={dataset}/>}
          {hasData && tab === 'synergy'   && <SynergyGrid data={dataset}/>}
          {hasData && tab === 'champions' && <Champions data={dataset}/>}
          {hasData && tab === 'comps'     && <CompLines data={dataset}/>}
          {hasData && tab === 'planner'   && <TeamPlanner data={dataset}/>}
          {hasData && tab === 'gods'      && <Gods data={dataset}/>}
          {hasData && tab === 'items'     && <Items data={dataset}/>}
          {hasData && tab === 'augments'  && <Augments data={dataset}/>}
          {tab === 'meet'      && <Meet/>}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="d17-panel p-10 text-center">
      <span className="material-symbols-outlined text-primary" style={{ fontSize: 56 }}>rocket_launch</span>
      <h2 className="font-editorial italic text-3xl mt-4 d17-gold-text">Awaiting Launch</h2>
      <p className="font-body text-sm mt-2" style={{ color: 'rgba(228,225,236,0.60)' }}>
        No Set 17 data loaded yet. Run the scraper to populate:
      </p>
      <pre
        className="inline-block mt-4 px-4 py-3 text-left font-mono text-xs whitespace-pre"
        style={{ background: '#0e0d15', color: '#FFC66B', border: '1px solid rgba(255,198,107,0.18)' }}
      >
        {'pip install -r scraper/requirements.txt\npython scraper/scrape_all.py\npython scraper/scrape_meta.py   # optional meta enrichment'}
      </pre>
    </div>
  )
}
