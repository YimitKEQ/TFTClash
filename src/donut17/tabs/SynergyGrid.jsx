import { useMemo, useState } from 'react'
import { makeImgFallback, costColor } from '../lib/imgFallback'

export default function SynergyGrid(props) {
  var champions = props.data.champions
  var traits = props.data.traits

  var _s = useState('all')
  var typeFilter = _s[0]
  var setTypeFilter = _s[1]

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

  var filteredTraits = useMemo(function () {
    if (typeFilter === 'all') return traits
    return traits.filter(function (t) { return (t.type || '').toLowerCase() === typeFilter })
  }, [traits, typeFilter])

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Intersections</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Synergy Grid</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Every trait and the units that bring it. Scan the rows to see what your board wants next.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterBtn v="all"    l="All"       current={typeFilter} set={setTypeFilter}/>
        <FilterBtn v="origin" l="Origins"   current={typeFilter} set={setTypeFilter}/>
        <FilterBtn v="class"  l="Classes"   current={typeFilter} set={setTypeFilter}/>
      </div>

      <div className="space-y-2">
        {filteredTraits.map(function (t) {
          var champs = grid[t.apiName] || []
          return (
            <div key={t.apiName} className="d17-panel p-3 flex items-center gap-4">
              <div className="flex items-center gap-3 w-48 shrink-0">
                <img
                  alt={t.name}
                  src={t.icon}
                  onError={function(e){ e.target.style.display='none' }}
                  className="w-8 h-8"
                />
                <div>
                  <p className="font-editorial italic text-base" style={{ color: '#FFC66B' }}>{t.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>{t.type || 'trait'} - {champs.length}</p>
                </div>
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
            NO TRAITS IN THIS CATEGORY
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
