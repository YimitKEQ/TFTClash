import { useMemo, useState } from 'react'
import { makeImgFallback, costColor } from '../lib/imgFallback'

export default function Champions(props) {
  var champions = props.data.champions
  var traits = props.data.traits
  var meta = props.data.meta || {}

  var _c = useState('all')
  var costFilter = _c[0]
  var setCostFilter = _c[1]

  var _t = useState('all')
  var traitFilter = _t[0]
  var setTraitFilter = _t[1]

  var _s = useState('')
  var search = _s[0]
  var setSearch = _s[1]

  var _sel = useState(null)
  var selected = _sel[0]
  var setSelected = _sel[1]

  var traitByApi = useMemo(function () {
    var m = {}
    traits.forEach(function (t) { m[t.apiName] = t })
    return m
  }, [traits])

  var filtered = useMemo(function () {
    return champions.filter(function (c) {
      if (costFilter !== 'all' && c.cost !== costFilter) return false
      if (traitFilter !== 'all' && c.traits.indexOf(traitFilter) === -1) return false
      if (search) {
        var q = search.toLowerCase()
        if (c.name.toLowerCase().indexOf(q) === -1) return false
      }
      return true
    })
  }, [champions, costFilter, traitFilter, search])

  var selectedChamp = selected ? champions.find(function(c){ return c.apiName === selected }) : null

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Roster of Set 17</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Champions</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Every unit in the pool. Click any champion for ability, scaling, and trait details.
        </p>
      </header>

      {/* Filter bar */}
      <div className="d17-panel p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Cost</span>
          <button type="button" onClick={function(){setCostFilter('all')}} className="font-mono text-[10px] py-1 px-2 uppercase cursor-pointer" style={pillStyle(costFilter === 'all')}>All</button>
          {[1,2,3,4,5].map(function(c){
            return (
              <button key={c} type="button" onClick={function(){setCostFilter(c)}} className="font-mono text-[10px] py-1 px-2 uppercase cursor-pointer" style={pillStyle(costFilter === c, costColor(c))}>${c}</button>
            )
          })}
        </div>

        <div className="flex-1 min-w-[240px]">
          <input
            className="w-full bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider"
            style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255,198,107,0.22)', color: '#e4e1ec' }}
            placeholder="SEARCH CHAMPION..."
            type="text"
            value={search}
            onChange={function(e){ setSearch(e.target.value) }}
          />
        </div>

        <select
          className="font-mono text-[11px] py-2 px-3 uppercase cursor-pointer"
          style={{ background: '#0e0d15', color: '#e4e1ec', border: '1px solid rgba(157,142,124,0.15)' }}
          value={traitFilter}
          onChange={function(e){ setTraitFilter(e.target.value) }}
        >
          <option value="all">All Traits</option>
          {traits.map(function(t){
            return <option key={t.apiName} value={t.apiName}>{t.name}</option>
          })}
        </select>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {filtered.map(function (c) {
              var isSelected = selectedChamp && selectedChamp.apiName === c.apiName
              return (
                <button
                  type="button"
                  key={c.apiName}
                  onClick={function(){ setSelected(c.apiName) }}
                  className="aspect-square relative cursor-pointer transition-all"
                  style={{
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor: isSelected ? '#FFC66B' : costColor(c.cost),
                    boxShadow: isSelected ? '0 0 16px rgba(255,198,107,0.55)' : 'none'
                  }}
                >
                  <img
                    alt={c.name}
                    src={c.assets && c.assets.face_lg}
                    onError={makeImgFallback(c.cost)}
                    className="w-full h-full object-cover"
                  />
                  <span
                    className="absolute bottom-0 left-0 right-0 text-[10px] font-mono text-center py-1 truncate px-1"
                    style={{ background: 'rgba(0,0,0,0.75)', color: costColor(c.cost) }}
                  >{c.name}</span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full d17-panel p-6 text-center font-mono text-xs" style={{ color: '#9d8e7c' }}>
                NO UNITS MATCH THESE FILTERS
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4">
          {selectedChamp ? (
            <Detail champ={selectedChamp} traitByApi={traitByApi} meta={meta}/>
          ) : (
            <div className="d17-panel p-6 sticky top-28">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>arrow_back</span>
              <p className="font-editorial italic text-lg mt-3" style={{ color: '#e4e1ec' }}>Select a champion</p>
              <p className="text-xs font-body mt-1" style={{ color: 'rgba(228,225,236,0.55)' }}>
                Detail, traits, and ability will load here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail(props) {
  var c = props.champ
  var traitByApi = props.traitByApi
  var metaStats = (props.meta.champions && props.meta.champions[c.key]) || null

  return (
    <div className="d17-panel-hi sticky top-28">
      <img
        alt={c.name}
        src={c.assets && c.assets.wide}
        onError={makeImgFallback(c.cost)}
        className="w-full h-40 object-cover"
      />
      <div className="p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-editorial italic text-2xl" style={{ color: '#e4e1ec' }}>{c.name}</h3>
          <span className="font-mono text-sm" style={{ color: costColor(c.cost) }}>${c.cost}</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {c.traits.map(function (tApi) {
            var t = traitByApi[tApi]
            var name = t ? t.name : tApi
            return (
              <span key={tApi} className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest" style={{ background: '#0e0d15', color: '#FFC66B', border: '1px solid rgba(255,198,107,0.18)' }}>
                {name}
              </span>
            )
          })}
        </div>

        <div className="d17-divider my-4"/>

        <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>Ability</p>
        <p className="font-editorial italic text-base" style={{ color: '#FFC66B' }}>{c.ability.name || 'Unknown'}</p>
        <p className="text-xs mt-2 leading-relaxed font-body" style={{ color: 'rgba(228,225,236,0.75)' }}>
          {stripHtml(c.ability.desc || '-- ability data pending --')}
        </p>

        <div className="d17-divider my-4"/>

        <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>Stats</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <Stat k="HP"  v={c.stats.hp}/>
          <Stat k="MANA" v={c.stats.initialMana + '/' + c.stats.mana}/>
          <Stat k="DMG" v={c.stats.damage}/>
          <Stat k="AS"  v={c.stats.attackSpeed}/>
          <Stat k="ARM" v={c.stats.armor}/>
          <Stat k="MR"  v={c.stats.magicResist}/>
          <Stat k="RNG" v={c.stats.range}/>
        </div>

        {metaStats && (
          <>
            <div className="d17-divider my-4"/>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>Meta</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {metaStats.play_rate != null && <Stat k="PLAY" v={metaStats.play_rate + '%'}/>}
              {metaStats.avg_placement != null && <Stat k="AVG" v={Number(metaStats.avg_placement).toFixed(2)}/>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat(props) {
  return (
    <div className="flex justify-between p-1" style={{ borderBottom: '1px solid rgba(157,142,124,0.05)' }}>
      <span style={{ color: '#9d8e7c' }}>{props.k}</span>
      <span style={{ color: '#e4e1ec' }}>{props.v || '-'}</span>
    </div>
  )
}

function stripHtml(s) {
  if (!s) return ''
  return s.replace(/<[^>]+>/g, '').replace(/@[A-Za-z0-9_]+@/g, '?').replace(/\s+/g, ' ').trim()
}

function pillStyle(active, accent) {
  return {
    background: active ? 'rgba(255,198,107,0.10)' : 'transparent',
    color: active ? (accent || '#FFC66B') : 'rgba(228,225,236,0.55)',
    border: active ? ('1px solid ' + (accent || 'rgba(255,198,107,0.40)')) : '1px solid rgba(157,142,124,0.15)'
  }
}
