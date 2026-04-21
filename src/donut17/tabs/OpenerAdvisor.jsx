import { useMemo, useState } from 'react'
import { scoreComps } from '../lib/scoring'
import { makeImgFallback, costColor } from '../lib/imgFallback'

export default function OpenerAdvisor(props) {
  var champions = props.data.champions
  var comps = props.data.comps
  var traits = props.data.traits
  var meta = props.data.meta || {}

  var _p = useState([])
  var picked = _p[0]
  var setPicked = _p[1]

  var _c = useState('all')
  var costFilter = _c[0]
  var setCostFilter = _c[1]

  var _s = useState('')
  var search = _s[0]
  var setSearch = _s[1]

  var traitByKey = useMemo(function () {
    var map = {}
    traits.forEach(function (t) { map[t.apiName] = t })
    return map
  }, [traits])

  var championsFiltered = useMemo(function () {
    var base = champions
    if (costFilter !== 'all') base = base.filter(function (c) { return c.cost === costFilter })
    if (search) {
      var q = search.toLowerCase()
      base = base.filter(function (c) { return c.name.toLowerCase().indexOf(q) !== -1 })
    }
    return base
  }, [champions, costFilter, search])

  var scored = useMemo(function () {
    return scoreComps(picked, champions, comps)
  }, [picked, champions, comps])

  function togglePick(k) {
    setPicked(function (arr) {
      if (arr.indexOf(k) !== -1) return arr.filter(function (x) { return x !== k })
      if (arr.length >= 4) return arr
      return arr.concat([k])
    })
  }

  var top = scored.slice(0, 3)

  return (
    <div>
      {/* Hero */}
      <header className="mb-10">
        <div className="flex justify-between items-end mb-3">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Divine Counsel</span>
            <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Opener Advisor</h1>
          </div>
          <div className="text-right">
            <span className="font-mono text-tertiary text-sm">{picked.length}/4 UNITS SELECTED</span>
          </div>
        </div>
        <div className="relative h-3 overflow-hidden" style={{ background: '#0e0d15', borderRadius: 2 }}>
          <div
            className="absolute inset-y-0 left-0 d17-gold-bg"
            style={{ width: (picked.length / 4 * 100) + '%', boxShadow: '0 0 15px rgba(255, 198, 107, 0.4)' }}
          />
        </div>
        <div className="flex justify-between mt-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.4)' }}>
          <span>PICK YOUR STAGE 2-1 OPENER (2-STAR 2-COSTS OR EARLY CARRIES)</span>
          <span>RANKED COMPS APPEAR BELOW</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Unit pool */}
        <section className="col-span-12 xl:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-label text-xl uppercase tracking-widest border-l-4 border-primary pl-4">Roster</h2>
            <div className="flex gap-2">
              <CostChip cost="all" active={costFilter==='all'} onClick={function(){setCostFilter('all')}}/>
              {[1,2,3,4,5].map(function (c) {
                return <CostChip key={c} cost={c} active={costFilter===c} onClick={function(){setCostFilter(c)}}/>
              })}
            </div>
          </div>
          <input
            className="w-full bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider mb-4"
            style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255,198,107,0.22)', color: '#e4e1ec' }}
            placeholder="FILTER UNITS..."
            type="text"
            value={search}
            onChange={function(e){ setSearch(e.target.value) }}
          />
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {championsFiltered.map(function (c) {
              var isPicked = picked.indexOf(c.key) !== -1
              return (
                <button
                  type="button"
                  key={c.apiName}
                  onClick={function(){ togglePick(c.key) }}
                  className="relative aspect-square cursor-pointer transition-all"
                  style={{
                    borderWidth: 2,
                    borderStyle: 'solid',
                    borderColor: isPicked ? '#FFC66B' : costColor(c.cost),
                    boxShadow: isPicked ? '0 0 16px rgba(255,198,107,0.55)' : 'none',
                    opacity: isPicked ? 1 : 0.85
                  }}
                  title={c.name + ' (' + c.cost + '-cost)'}
                >
                  <img
                    alt={c.name}
                    src={c.assets && c.assets.face_lg}
                    onError={makeImgFallback(c.cost)}
                    className="w-full h-full object-cover"
                  />
                  <span
                    className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-center py-0.5 truncate px-1"
                    style={{ background: 'rgba(0,0,0,0.75)', color: costColor(c.cost) }}
                  >{c.name}</span>
                  {isPicked && (
                    <span
                      className="material-symbols-outlined absolute top-0 right-0 text-[14px] p-0.5"
                      style={{ background: '#FFC66B', color: '#432c00' }}
                    >check</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Rankings */}
        <section className="col-span-12 xl:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-label text-xl uppercase tracking-widest border-l-4 border-primary pl-4">Divined Comps</h2>
            {picked.length > 0 && (
              <button
                type="button"
                onClick={function(){ setPicked([]) }}
                className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 cursor-pointer"
                style={{ background: '#0e0d15', color: '#9d8e7c' }}
              >Clear</button>
            )}
          </div>

          {picked.length === 0 && (
            <div className="d17-panel p-8 text-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 36 }}>touch_app</span>
              <p className="font-editorial italic text-lg mt-3" style={{ color: '#e4e1ec' }}>
                Pick a unit to begin
              </p>
              <p className="font-body text-xs mt-2" style={{ color: 'rgba(228,225,236,0.55)' }}>
                Every comp is scored by direct unit matches (3 pts) + shared traits (1 pt per overlap)
              </p>
            </div>
          )}

          <div className="space-y-4">
            {top.map(function (r, i) {
              return <RankedComp key={r.comp.id} rank={i+1} result={r} champions={champions} meta={meta}/>
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function RankedComp(props) {
  var c = props.result.comp
  var champions = props.champions
  var champByKey = {}
  champions.forEach(function(x){ champByKey[x.key] = x })
  var metaStats = (props.meta.comps && props.meta.comps[c.id]) || null

  return (
    <div className="d17-panel p-5 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, ' + c.color + '22 0%, transparent 60%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs" style={{ color: c.color }}>#{props.rank}</span>
              <h3 className="font-editorial italic text-xl" style={{ color: '#e4e1ec' }}>{c.name}</h3>
              {metaStats && metaStats.tier && (
                <span className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest" style={{ background: c.color + '22', color: c.color, border: '1px solid ' + c.color + '55' }}>
                  {metaStats.tier}
                </span>
              )}
            </div>
            <p className="text-xs mt-1 font-body" style={{ color: 'rgba(228,225,236,0.65)' }}>{c.desc}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-xl" style={{ color: c.color }}>{props.result.score}</p>
            <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>score</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {(c.core || []).map(function (k) {
            var ch = champByKey[k]
            if (!ch) return null
            return (
              <img
                key={k}
                alt={ch.name}
                src={ch.assets && ch.assets.face}
                onError={makeImgFallback(ch.cost)}
                className="w-8 h-8 object-cover"
                style={{ border: '1px solid ' + costColor(ch.cost) }}
                title={ch.name}
              />
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider">
          <div>
            <span style={{ color: '#9d8e7c' }}>GOD: </span>
            <span style={{ color: '#FFC66B' }}>{c.god}</span>
          </div>
          {metaStats && metaStats.avg_placement && (
            <div className="text-right">
              <span style={{ color: '#9d8e7c' }}>AVG: </span>
              <span style={{ color: '#67e2d9' }}>{Number(metaStats.avg_placement).toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CostChip(props) {
  var label = props.cost === 'all' ? 'ALL' : ('$' + props.cost)
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer transition-all"
      style={{
        background: props.active ? 'rgba(255,198,107,0.10)' : 'transparent',
        color: props.active ? '#FFC66B' : 'rgba(228,225,236,0.55)',
        border: props.active ? '1px solid rgba(255,198,107,0.40)' : '1px solid rgba(157,142,124,0.15)'
      }}
    >{label}</button>
  )
}
