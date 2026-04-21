import { useMemo, useState, useEffect } from 'react'
import { makeImgFallback, costColor } from '../lib/imgFallback'
import { buildCompSummary } from '../lib/compSummary'
import CompFlowchart from './CompFlowchart'

var ECON_LABEL = {
  fast8: 'Fast 8',
  fast9: 'Fast 9',
  reroll1: '1-Cost Reroll',
  reroll2: '2-Cost Reroll',
  reroll3: '3-Cost Reroll',
}

var TIER_COLOR = {
  'OP': '#ff6b9d',
  'S+': '#ff9d6b',
  'S': '#FFC66B',
  'A': '#67e2d9',
  'B': '#9d8eff',
  'C': '#9d8e7c',
  'D': '#554a42',
}

var TIER_RANK = { 'OP': 0, 'S+': 1, 'S': 2, 'A': 3, 'B': 4, 'C': 5, 'D': 6 }

function tierRank(t) {
  var r = TIER_RANK[t]
  return typeof r === 'number' ? r : 99
}

function bestTierOf(comp) {
  return comp.tftflowBestTier || comp.tier || ''
}

function econLabel(econ) {
  if (!econ) return ''
  return ECON_LABEL[econ] || econ
}

export default function CompLines(props) {
  var comps = props.data.comps
  var champions = props.data.champions
  var traits = props.data.traits
  var items = props.data.items

  var _sel = useState(null)
  var selectedId = _sel[0]
  var setSelectedId = _sel[1]

  var _t = useState('all')
  var tierFilter = _t[0]
  var setTierFilter = _t[1]

  var _e = useState('all')
  var econFilter = _e[0]
  var setEconFilter = _e[1]

  var selectedComp = useMemo(function () {
    if (!selectedId) return null
    return comps.find(function (c) { return c.id === selectedId }) || null
  }, [selectedId, comps])

  useEffect(function () {
    if (selectedComp) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) {}
    }
  }, [selectedId])

  var champByKey = useMemo(function () {
    var m = {}
    champions.forEach(function (c) { m[c.key] = c })
    return m
  }, [champions])

  var econs = useMemo(function () {
    var seen = {}
    comps.forEach(function (c) { if (c.econ) seen[c.econ] = true })
    return Object.keys(seen).sort()
  }, [comps])

  var tiers = useMemo(function () {
    var seen = {}
    comps.forEach(function (c) {
      var arr = c.tftflowTiers || (bestTierOf(c) ? [bestTierOf(c)] : [])
      arr.forEach(function (t) { seen[t] = true })
    })
    return Object.keys(seen).sort(function (a, b) { return tierRank(a) - tierRank(b) })
  }, [comps])

  var filtered = useMemo(function () {
    var base = comps.slice()
    if (tierFilter !== 'all') {
      base = base.filter(function (c) {
        var arr = c.tftflowTiers || (bestTierOf(c) ? [bestTierOf(c)] : [])
        return arr.indexOf(tierFilter) !== -1
      })
    }
    if (econFilter !== 'all') base = base.filter(function (c) { return c.econ === econFilter })
    base.sort(function (a, b) { return tierRank(bestTierOf(a)) - tierRank(bestTierOf(b)) })
    return base
  }, [comps, tierFilter, econFilter])

  if (selectedComp) {
    return (
      <CompFlowchart
        comp={selectedComp}
        champions={champions}
        traits={traits}
        items={items}
        allComps={comps}
        onBack={function () { setSelectedId(null) }}
        onOpenComp={function(id){ setSelectedId(id) }}
      />
    )
  }

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Patch 17.1 Meta</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Comp Lines</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          {comps.length} comps from tftflow.com, sorted by their best tier placement. Tier chips are conditional on augments + emblems. Click any card for the full flowchart.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest mr-2" style={{ color: '#9d8e7c' }}>Tier</span>
        <button type="button" onClick={function(){setTierFilter('all')}} className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer" style={pillStyle(tierFilter === 'all')}>All</button>
        {tiers.map(function (t) {
          var color = TIER_COLOR[t] || '#FFC66B'
          var active = tierFilter === t
          return (
            <button
              key={t}
              type="button"
              onClick={function(){ setTierFilter(t) }}
              className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer"
              style={{
                background: active ? color + '22' : 'transparent',
                color: active ? color : 'rgba(228,225,236,0.55)',
                border: active ? '1px solid ' + color + '88' : '1px solid rgba(157,142,124,0.15)'
              }}
            >{t}</button>
          )
        })}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest mr-2" style={{ color: '#9d8e7c' }}>Econ</span>
        <button type="button" onClick={function(){setEconFilter('all')}} className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer" style={pillStyle(econFilter === 'all')}>All</button>
        {econs.map(function (e) {
          return (
            <button key={e} type="button" onClick={function(){setEconFilter(e)}} className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer" style={pillStyle(econFilter === e)}>{econLabel(e)}</button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map(function (comp) {
          return <CompCard key={comp.id} comp={comp} champByKey={champByKey} onOpen={function(){setSelectedId(comp.id)}}/>
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
  var onOpen = props.onOpen
  var bestTier = bestTierOf(comp)
  var accent = TIER_COLOR[bestTier] || '#FFC66B'
  var tierList = comp.tftflowTiers || (bestTier ? [bestTier] : [])
  var carrySet = new Set(comp.carries || (comp.carry ? [comp.carry] : []))
  var board = comp.board || []
  var primaryCarryKey = (comp.carries && comp.carries[0]) || comp.carry
  var primaryCarry = primaryCarryKey ? champByKey[primaryCarryKey] : null
  var summary = useMemo(function () {
    var chs = Object.values(champByKey)
    return buildCompSummary(comp, chs)
  }, [comp, champByKey])

  return (
    <article
      className="d17-panel relative overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5"
      onClick={onOpen}
      onKeyDown={function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); onOpen() } }}
      role="button"
      tabIndex={0}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, ' + accent + '22 0%, transparent 55%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative p-5">
        <div className="flex items-start gap-4">
          {primaryCarry && (
            <img
              alt={primaryCarry.name}
              src={primaryCarry.assets && primaryCarry.assets.face_lg}
              onError={makeImgFallback(primaryCarry.cost)}
              className="w-16 h-16 object-cover shrink-0"
              style={{ border: '2px solid ' + accent }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-editorial italic text-xl" style={{ color: '#e4e1ec' }}>{comp.name}</h3>
              {comp.econ && (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5" style={{ background: 'rgba(14,13,21,0.8)', color: '#9d8e7c', border: '1px solid rgba(157,142,124,0.3)' }}>
                  {econLabel(comp.econ)}
                </span>
              )}
            </div>
            {summary && (
              <p className="text-xs mt-1 font-body leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>{summary}</p>
            )}
          </div>
        </div>

        {tierList.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Tier</span>
            {tierList.map(function (t) {
              var color = TIER_COLOR[t] || '#FFC66B'
              return (
                <span
                  key={t}
                  className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5"
                  style={{ background: color + '18', color: color, border: '1px solid ' + color + '55' }}
                >{t}</span>
              )
            })}
            {tierList.length > 1 && (
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.4)' }}>
                conditional on augments + emblems
              </span>
            )}
          </div>
        )}

        <div className="d17-divider my-4"/>

        <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>
          Board · {board.length} units · {carrySet.size} {carrySet.size === 1 ? 'carry' : 'carries'}
        </p>
        <div className="flex flex-wrap gap-1">
          {board.map(function (k) {
            var ch = champByKey[k]
            var isCarry = carrySet.has(k)
            if (!ch) {
              return (
                <span key={k} className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest" style={{ background: '#0e0d15', color: '#504535' }} title={k + ' (missing)'}>?</span>
              )
            }
            return (
              <div key={k} className="relative">
                <img
                  alt={ch.name}
                  src={ch.assets && ch.assets.face}
                  onError={makeImgFallback(ch.cost)}
                  className="w-9 h-9 object-cover"
                  style={{ border: isCarry ? '2px solid #FFC66B' : '1px solid ' + costColor(ch.cost) }}
                  title={ch.name + (isCarry ? ' (carry)' : '')}
                />
                {isCarry && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 font-mono text-[8px] font-bold px-1 leading-none"
                    style={{ background: '#FFC66B', color: '#0e0d15', borderRadius: 1 }}
                  >C</span>
                )}
              </div>
            )
          })}
        </div>

        {comp.augments && comp.augments.length > 0 && (
          <div className="mt-4 d17-panel-lo p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: '#FFC66B' }}>Augments</p>
            <div className="flex flex-wrap gap-1">
              {comp.augments.slice(0, 12).map(function (a, i) {
                return (
                  <span
                    key={i}
                    className="px-2 py-0.5 font-mono text-[10px]"
                    style={{ background: 'rgba(255,198,107,0.08)', color: 'rgba(228,225,236,0.75)', border: '1px solid rgba(255,198,107,0.18)' }}
                  >{a}</span>
                )
              })}
              {comp.augments.length > 12 && (
                <span className="font-mono text-[10px] px-2 py-0.5" style={{ color: 'rgba(228,225,236,0.45)' }}>+{comp.augments.length - 12} more</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.4)' }}>
            {comp.patch || 'Patch 17'}
          </span>
          <span
            className="font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1"
            style={{ color: accent }}
          >
            Open flowchart
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          </span>
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
