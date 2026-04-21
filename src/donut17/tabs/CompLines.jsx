import { useState, useMemo } from 'react'
import { makeImgFallback, costColor } from '../lib/imgFallback'

export default function CompLines(props) {
  var comps = props.data.comps
  var champions = props.data.champions
  var meta = props.data.meta || {}

  var _s = useState('all')
  var godFilter = _s[0]
  var setGodFilter = _s[1]

  var champByKey = useMemo(function () {
    var m = {}
    champions.forEach(function (c) { m[c.key] = c })
    return m
  }, [champions])

  var gods = useMemo(function () {
    var set = {}
    comps.forEach(function (c) { if (c.god) set[c.god] = true })
    return Object.keys(set).sort()
  }, [comps])

  var filtered = useMemo(function () {
    var base = comps
    if (godFilter !== 'all') base = base.filter(function (c) { return c.god === godFilter })
    return base
  }, [comps, godFilter])

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Strategic Lines</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Comp Lines</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Curated comps for Set 17. Each line names a carry, a divine patron, and a gameplan you can execute start to finish.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest mr-2" style={{ color: '#9d8e7c' }}>God</span>
        <button type="button" onClick={function(){setGodFilter('all')}} className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer" style={pillStyle(godFilter === 'all')}>All</button>
        {gods.map(function (g) {
          return (
            <button key={g} type="button" onClick={function(){setGodFilter(g)}} className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer" style={pillStyle(godFilter === g)}>{g}</button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(function (comp) {
          return <CompCard key={comp.id} comp={comp} champByKey={champByKey} meta={meta}/>
        })}
        {filtered.length === 0 && (
          <div className="md:col-span-2 d17-panel p-8 text-center font-mono text-sm" style={{ color: '#9d8e7c' }}>
            NO COMP LINES MATCH THIS FILTER
          </div>
        )}
      </div>
    </div>
  )
}

function CompCard(props) {
  var comp = props.comp
  var champByKey = props.champByKey
  var carry = champByKey[comp.carry]
  var metaStats = (props.meta.comps && props.meta.comps[comp.id]) || null

  return (
    <article className="d17-panel relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, ' + comp.color + '22 0%, transparent 55%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          {carry && (
            <img
              alt={carry.name}
              src={carry.assets && carry.assets.face_lg}
              onError={makeImgFallback(carry.cost)}
              className="w-16 h-16 object-cover shrink-0"
              style={{ border: '2px solid ' + comp.color }}
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-editorial italic text-xl" style={{ color: '#e4e1ec' }}>{comp.name}</h3>
              {metaStats && metaStats.tier && (
                <span className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest" style={{ background: comp.color + '22', color: comp.color, border: '1px solid ' + comp.color + '55' }}>{metaStats.tier}</span>
              )}
            </div>
            <p className="text-xs mt-1 font-body" style={{ color: 'rgba(228,225,236,0.65)' }}>{comp.desc}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-4">
          {(comp.core || []).map(function (k) {
            var ch = champByKey[k]
            if (!ch) return (
              <span key={k} className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest" style={{ background: '#0e0d15', color: '#504535' }} title={k + ' (missing)'}>?</span>
            )
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

        <div className="d17-divider my-4"/>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>God</p>
            <p className="font-editorial italic text-base" style={{ color: '#FFC66B' }}>{comp.god}</p>
            <p className="text-[10px] mt-1 font-body" style={{ color: 'rgba(228,225,236,0.55)' }}>{comp.godWhy}</p>
          </div>
          {metaStats && metaStats.avg_placement != null && (
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Avg Placement</p>
              <p className="font-mono text-2xl" style={{ color: '#67e2d9' }}>{Number(metaStats.avg_placement).toFixed(2)}</p>
            </div>
          )}
        </div>

        <div className="mt-4 d17-panel-lo p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: '#FFC66B' }}>Gameplan</p>
          <p className="text-xs font-body leading-relaxed" style={{ color: 'rgba(228,225,236,0.75)' }}>{comp.gameplan}</p>
        </div>

        <div className="mt-3 d17-panel-lo p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: '#FFC66B' }}>Items</p>
          {comp.items && Object.keys(comp.items).map(function (k) {
            return (
              <div key={k} className="text-[11px] mt-1 font-body" style={{ color: 'rgba(228,225,236,0.70)' }}>
                <span className="font-mono uppercase" style={{ color: '#9d8e7c' }}>{k}: </span>
                <span>{(comp.items[k] || []).join(' | ')}</span>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

function pillStyle(active) {
  return {
    background: active ? 'rgba(255,198,107,0.10)' : 'transparent',
    color: active ? '#FFC66B' : 'rgba(228,225,236,0.55)',
    border: active ? '1px solid rgba(255,198,107,0.40)' : '1px solid rgba(157,142,124,0.15)'
  }
}
