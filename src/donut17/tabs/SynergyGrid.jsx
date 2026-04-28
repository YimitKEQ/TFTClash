import { useMemo, useState } from 'react'
import { makeImgFallback, costColor } from '../lib/imgFallback'
import { computeActiveTraits } from '../lib/traitComputer'

export default function SynergyGrid(props) {
  var champions = props.data.champions
  var traits = props.data.traits
  var comps = props.data.comps || []

  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  var _sort = useState('roster')
  var sort = _sort[0]
  var setSort = _sort[1]

  // Map trait apiName -> array of champions that contribute to it.
  var grid = useMemo(function () {
    var byTrait = {}
    traits.forEach(function (t) { byTrait[t.apiName] = [] })
    champions.forEach(function (c) {
      (c.traits || []).forEach(function (tApi) {
        if (!byTrait[tApi]) byTrait[tApi] = []
        byTrait[tApi].push(c)
      })
    })
    return byTrait
  }, [champions, traits])

  // Map trait apiName -> count of comps that activate at least one breakpoint.
  var compUsage = useMemo(function () {
    var counts = {}
    comps.forEach(function (c) {
      var active = computeActiveTraits(c.board || [], champions, traits)
      active.forEach(function (a) {
        counts[a.apiName] = (counts[a.apiName] || 0) + 1
      })
    })
    return counts
  }, [comps, champions, traits])

  var filteredTraits = useMemo(function () {
    var list = traits.slice()
    if (query) {
      var q = query.toLowerCase()
      list = list.filter(function (t) { return (t.name || '').toLowerCase().indexOf(q) !== -1 })
    }
    if (sort === 'meta') {
      list.sort(function (a, b) { return (compUsage[b.apiName] || 0) - (compUsage[a.apiName] || 0) })
    } else if (sort === 'roster') {
      list.sort(function (a, b) { return (grid[b.apiName] || []).length - (grid[a.apiName] || []).length })
    } else {
      list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '') })
    }
    return list
  }, [traits, query, sort, grid, compUsage])

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Intersections</span>
        <h1 className="font-editorial text-5xl mt-2 d17-gold-text">Synergy Grid</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Every trait, its breakpoints, and the units that bring it. Counts to the right show how often each trait shows up in tracked meta comps.
        </p>
      </header>

      <div className="d17-panel p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <FilterBtn v="roster" l="Most units" current={sort} set={setSort}/>
          <FilterBtn v="meta"   l="Most meta usage" current={sort} set={setSort}/>
          <FilterBtn v="name"   l="A - Z" current={sort} set={setSort}/>
        </div>
        <input
          className="flex-1 min-w-[240px] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider"
          style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255,198,107,0.22)', color: '#e4e1ec' }}
          placeholder="SEARCH TRAIT..."
          type="text"
          value={query}
          onChange={function(e){ setQuery(e.target.value) }}
        />
      </div>

      <div className="space-y-2">
        {filteredTraits.map(function (t) {
          var champs = grid[t.apiName] || []
          var breaks = (t.effects || []).map(function (e) { return e.minUnits }).filter(function (n) { return typeof n === 'number' && n > 0 })
          var uniqueBreaks = []
          breaks.forEach(function (n) { if (uniqueBreaks.indexOf(n) === -1) uniqueBreaks.push(n) })
          uniqueBreaks.sort(function (a, b) { return a - b })
          var usage = compUsage[t.apiName] || 0
          return (
            <div key={t.apiName} className="d17-panel p-3 flex items-center gap-4">
              <div className="flex items-center gap-3 w-56 shrink-0">
                <img
                  alt={t.name}
                  src={t.icon}
                  onError={function(e){ e.target.style.display='none' }}
                  className="w-8 h-8"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-editorial text-base truncate" style={{ color: '#FFC66B' }}>{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>{champs.length} units</span>
                    {usage > 0 && (
                      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#67e2d9' }}>{usage} meta</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 w-28 shrink-0">
                {uniqueBreaks.length > 0 ? uniqueBreaks.map(function (n, i) {
                  return (
                    <span
                      key={i}
                      className="font-mono text-[10px] px-1.5 py-0.5"
                      style={{ background: 'rgba(255,198,107,0.08)', color: '#FFC66B', border: '1px solid rgba(255,198,107,0.22)' }}
                    >{n}</span>
                  )
                }) : (
                  <span className="font-mono text-[9px]" style={{ color: '#6b6673' }}>unique</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 flex-1">
                {champs.sort(function(a,b){return a.cost-b.cost}).map(function (c) {
                  return (
                    <img
                      key={c.apiName}
                      alt={c.name}
                      src={c.assets && c.assets.face}
                      onError={makeImgFallback(c.cost)}
                      className="w-8 h-8 object-cover"
                      style={{ border: '1px solid ' + costColor(c.cost) }}
                      title={c.name + ' (' + c.cost + '-cost)'}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
        {filteredTraits.length === 0 && (
          <div className="d17-panel p-8 text-center font-mono text-sm" style={{ color: '#9d8e7c' }}>
            NO TRAITS MATCH THESE FILTERS
          </div>
        )}
      </div>
    </div>
  )
}

function FilterBtn(props) {
  var active = props.current === props.v
  return (
    <button
      type="button"
      onClick={function(){ props.set(props.v) }}
      className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer"
      style={{
        background: active ? 'rgba(255,198,107,0.10)' : 'transparent',
        color: active ? '#FFC66B' : 'rgba(228,225,236,0.55)',
        border: active ? '1px solid rgba(255,198,107,0.40)' : '1px solid rgba(157,142,124,0.15)'
      }}
    >{props.l}</button>
  )
}
