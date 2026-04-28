import { lazy, Suspense, useEffect, useState } from 'react'
import './theme.css'

import TopNav from './layout/TopNav'
import SideNav from './layout/SideNav'
import { useActiveTab } from './lib/useActiveTab'

// Tabs are lazy so each renders as its own chunk.
var OpenerAdvisor = lazy(function(){ return import('./tabs/OpenerAdvisor') })
var SynergyGrid   = lazy(function(){ return import('./tabs/SynergyGrid') })
var Champions     = lazy(function(){ return import('./tabs/Champions') })
var CompLines     = lazy(function(){ return import('./tabs/CompLines') })
var Gods          = lazy(function(){ return import('./tabs/Gods') })
var Items         = lazy(function(){ return import('./tabs/Items') })
var Augments      = lazy(function(){ return import('./tabs/Augments') })
var TeamPlanner   = lazy(function(){ return import('./tabs/TeamPlanner') })
var Meet          = lazy(function(){ return import('./tabs/Meet') })

// Datasets are loaded asynchronously so the route shell stays small.
// Vite gives each dynamic JSON import its own chunk.
function loadDataset() {
  return Promise.all([
    import('./data/champions.json').then(function(m){ return m.default }),
    import('./data/traits.json').then(function(m){ return m.default }),
    import('./data/items.json').then(function(m){ return m.default }),
    import('./data/augments.json').then(function(m){ return m.default }),
    import('./data/gods.json').then(function(m){ return m.default }),
    import('./data/comp_lines.json').then(function(m){ return m.default }),
    import('./data/synergy_grid.json').then(function(m){ return m.default }),
    import('./data/meta.json').then(function(m){ return m.default }),
  ]).then(function(parts){
    return {
      champions: parts[0] || [],
      traits: parts[1] || [],
      items: parts[2] || [],
      augments: parts[3] || [],
      gods: parts[4] || [],
      comps: parts[5] || [],
      synergy: parts[6] || {},
      meta: parts[7] || {},
    }
  })
}

function TabSkeleton() {
  return (
    <div className="d17-panel p-10">
      <div className="h-6 w-40 rounded bg-white/[0.05] animate-pulse mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="h-24 rounded bg-white/[0.04] animate-pulse" />
        <div className="h-24 rounded bg-white/[0.04] animate-pulse" />
        <div className="h-24 rounded bg-white/[0.04] animate-pulse" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="d17-panel p-10 text-center">
      <span className="material-symbols-outlined text-primary" style={{ fontSize: 56 }}>rocket_launch</span>
      <h2 className="font-display text-2xl uppercase tracking-tight mt-4 d17-gold-text">Awaiting Launch</h2>
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

export default function Donut17Screen() {
  var _t = useActiveTab('opener')
  var tab = _t[0]
  var setTab = _t[1]

  var _ds = useState(null)
  var dataset = _ds[0]
  var setDataset = _ds[1]

  useEffect(function(){
    var alive = true
    loadDataset().then(function(d){
      if (alive) setDataset(d)
    }).catch(function(){
      if (alive) setDataset({
        champions: [], traits: [], items: [], augments: [],
        gods: [], comps: [], synergy: {}, meta: {},
      })
    })
    return function(){ alive = false }
  }, [])

  useEffect(function () {
    var prev = document.title
    document.title = 'Donut 17 - Space Gods Prep'
    return function () { document.title = prev }
  }, [])

  var loading = dataset === null
  var hasData = !loading && dataset.champions.length > 0

  return (
    <div className="d17">
      <TopNav tab={tab} onTab={setTab}/>
      <div className="flex">
        <SideNav tab={tab} onTab={setTab}/>
        <main className="flex-1 lg:ml-64 p-6 md:p-10 min-h-screen">
          {loading && <TabSkeleton/>}
          {!loading && !hasData && <EmptyState/>}
          {hasData && (
            <Suspense fallback={<TabSkeleton/>}>
              {tab === 'opener'    && <OpenerAdvisor data={dataset}/>}
              {tab === 'synergy'   && <SynergyGrid data={dataset}/>}
              {tab === 'champions' && <Champions data={dataset}/>}
              {tab === 'comps'     && <CompLines data={dataset}/>}
              {tab === 'planner'   && <TeamPlanner data={dataset}/>}
              {tab === 'gods'      && <Gods data={dataset}/>}
              {tab === 'items'     && <Items data={dataset}/>}
              {tab === 'augments'  && <Augments data={dataset}/>}
              {tab === 'meet'      && <Meet data={dataset}/>}
            </Suspense>
          )}
        </main>
      </div>
    </div>
  )
}
