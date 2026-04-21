import { useMemo, useState } from 'react'
import { scoreComps } from '../lib/scoring'
import { costColor } from '../lib/imgFallback'
import { computeActiveTraits, tierColor } from '../lib/traitComputer'
import ChampImg from '../lib/ChampImg'
import CompFlowchart from './CompFlowchart'
import { buildCompSummary } from '../lib/compSummary'

// Comp data sourced from tftflow.com: tier placements, boards, carries, augments,
// and patch notes. Boards and tier ranges are factual game data we mirror.
// Stage-by-stage flowcharts are synthesized in-app from the final board (see
// lib/flowchart.js) since tftflow's variation boards are JS-hydrated client-side.

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

function econLabel(econ) {
  if (!econ) return ''
  return ECON_LABEL[econ] || econ
}

export default function OpenerAdvisor(props) {
  var champions = props.data.champions
  var comps = props.data.comps
  var traits = props.data.traits
  var items = props.data.items

  var _p = useState([])
  var picked = _p[0]
  var setPicked = _p[1]

  var _sel = useState(null)
  var expandedId = _sel[0]
  var setExpandedId = _sel[1]

  var _c = useState('all')
  var costFilter = _c[0]
  var setCostFilter = _c[1]

  var _s = useState('')
  var search = _s[0]
  var setSearch = _s[1]

  var championsFiltered = useMemo(function () {
    var base = champions.filter(function (c) {
      var k = c.key
      if (!k) return false
      if (k.indexOf('pve_') !== -1) return false
      if (k.indexOf('enemy_') !== -1) return false
      if (k.indexOf('dummy') !== -1) return false
      if (k.indexOf('summon') === 0) return false
      if (k.indexOf('armorykey') !== -1) return false
      if (k.indexOf('emblemarmorykey') !== -1) return false
      if (k.indexOf('fakeunit') !== -1) return false
      if (k.indexOf('timebreaker') !== -1 && k.indexOf('core') !== -1) return false
      if (k === 'slime_crab' || k === 'bluegolem' || k === 'mercenarychest') return false
      if (!c.cost || c.cost < 1 || c.cost > 5) return false
      return true
    })
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
      if (arr.length >= 6) return arr
      return arr.concat([k])
    })
  }

  var top = scored.slice(0, 3)
  var sourcePatch = comps && comps[0] && comps[0].patch ? comps[0].patch : ''

  var expandedComp = useMemo(function () {
    if (!expandedId) return null
    return comps.find(function (c) { return c.id === expandedId }) || null
  }, [expandedId, comps])

  if (expandedComp) {
    return (
      <CompFlowchart
        comp={expandedComp}
        champions={champions}
        traits={traits}
        items={items}
        allComps={comps}
        onBack={function(){ setExpandedId(null) }}
        onOpenComp={function(id){ setExpandedId(id) }}
      />
    )
  }

  return (
    <div>
      <header className="mb-10">
        <div className="flex justify-between items-end mb-3 flex-wrap gap-3">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Divine Counsel</span>
            <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Opener Advisor</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest mt-2" style={{ color: 'rgba(228,225,236,0.45)' }}>
              Data sourced from tftflow.com{sourcePatch ? ' · ' + sourcePatch : ''} · {comps.length} comps
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-tertiary text-sm">{picked.length}/6 UNITS PICKED</span>
          </div>
        </div>
        <div className="relative h-3 overflow-hidden" style={{ background: '#0e0d15', borderRadius: 2 }}>
          <div
            className="absolute inset-y-0 left-0 d17-gold-bg"
            style={{ width: (picked.length / 6 * 100) + '%', boxShadow: '0 0 15px rgba(255, 198, 107, 0.4)' }}
          />
        </div>
        <div className="flex justify-between mt-2 font-mono text-[10px] uppercase tracking-widest gap-4 flex-wrap" style={{ color: 'rgba(228,225,236,0.4)' }}>
          <span>PICK 2-6 UNITS YOU HAVE AFTER STAGE 2 CAROUSEL</span>
          <span>TOP 3 TFTFLOW COMPS APPEAR BELOW</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 xl:col-span-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-label text-xl uppercase tracking-widest border-l-4 border-primary pl-4">Roster</h2>
            <div className="flex gap-1 flex-wrap">
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
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2">
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
                    opacity: isPicked ? 1 : 0.88,
                    padding: 0,
                    background: '#0e0d15'
                  }}
                  title={c.name + ' (' + c.cost + '-cost)'}
                >
                  <ChampImg champion={c} size="100%" style={{ width: '100%', height: '100%', border: 'none', boxShadow: 'none' }}/>
                  <span
                    className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-center py-0.5 truncate px-1"
                    style={{ background: 'rgba(0,0,0,0.8)', color: costColor(c.cost) }}
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

        <section className="col-span-12 xl:col-span-7">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
                Pick units to begin
              </p>
              <p className="font-body text-xs mt-2" style={{ color: 'rgba(228,225,236,0.55)' }}>
                Carry match = 5 pts, board = 3, shared trait = 0.5. Ties broken by tftflow tier (OP {'>'} S+ {'>'} S {'>'} A {'>'} B {'>'} C).
              </p>
            </div>
          )}

          <div className="space-y-4">
            {top.map(function (r, i) {
              if (r.score === 0) return null
              return (
                <RankedComp
                  key={r.comp.id}
                  rank={i+1}
                  result={r}
                  champions={champions}
                  traits={traits}
                  pickedKeys={picked}
                  onOpen={function(){ setExpandedId(r.comp.id) }}
                />
              )
            })}
            {picked.length > 0 && top.every(function(r){ return r.score === 0 }) && (
              <div className="d17-panel p-6 text-center">
                <p className="font-body text-sm" style={{ color: 'rgba(228,225,236,0.7)' }}>
                  No matching tftflow meta comp for this opener. Try different units or keep the most flexible one.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function RankedComp(props) {
  var c = props.result.comp
  var champions = props.champions
  var traits = props.traits
  var pickedKeys = props.pickedKeys || []
  var onOpen = props.onOpen
  var champByKey = {}
  champions.forEach(function(x){ champByKey[x.key] = x })

  var bestTier = c.tftflowBestTier || c.tier || ''
  var accent = TIER_COLOR[bestTier] || '#FFC66B'

  var activeTraits = useMemo(function () {
    return computeActiveTraits(c.board, champions, traits)
  }, [c, champions, traits])

  var summary = useMemo(function () {
    return buildCompSummary(c, champions)
  }, [c, champions])

  var pickedSet = new Set(pickedKeys)
  var carrySet = new Set(c.carries || (c.carry ? [c.carry] : []))
  var tiers = c.tftflowTiers || (bestTier ? [bestTier] : [])

  return (
    <div className="d17-panel p-5 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, ' + accent + '22 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs" style={{ color: accent }}>#{props.rank}</span>
              <h3 className="font-editorial italic text-xl" style={{ color: '#e4e1ec' }}>{c.name}</h3>
              {c.econ && (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5" style={{ background: 'rgba(14,13,21,0.8)', color: '#9d8e7c', border: '1px solid rgba(157,142,124,0.3)' }}>
                  {econLabel(c.econ)}
                </span>
              )}
            </div>
            {summary && (
              <p className="text-xs mt-1 font-body" style={{ color: 'rgba(228,225,236,0.7)' }}>{summary}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-xl" style={{ color: accent }}>{props.result.score}</p>
            <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>match</p>
          </div>
        </div>

        {/* Tier placements from tftflow — conditional, so we show the range */}
        {tiers.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>
              tftflow tier{tiers.length > 1 ? 's' : ''}:
            </span>
            {tiers.map(function (t) {
              var col = TIER_COLOR[t] || '#9d8e7c'
              return (
                <span
                  key={t}
                  className="px-2 py-0.5 font-mono text-[10px] font-bold"
                  style={{ background: col + '22', color: col, border: '1px solid ' + col + '55' }}
                >{t}</span>
              )
            })}
            {tiers.length > 1 && (
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.45)' }}>
                conditional on augments + emblems
              </span>
            )}
          </div>
        )}

        <div className="mt-4">
          <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>
            Final Board ({(c.board || []).length} units) · {carrySet.size} carr{carrySet.size === 1 ? 'y' : 'ies'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(c.board || []).map(function (k) {
              var ch = champByKey[k]
              if (!ch) return null
              var isCarry = carrySet.has(k)
              var isPicked = pickedSet.has(k)
              return (
                <div key={k} className="relative">
                  <ChampImg
                    champion={ch}
                    carry={isCarry}
                    size={40}
                    style={isPicked && !isCarry ? { border: '2px solid #67e2d9', boxShadow: '0 0 8px rgba(103,226,217,0.5)' } : {}}
                  />
                  {isCarry && (
                    <span
                      className="absolute -top-1 -right-1 text-[8px] font-mono font-bold px-1"
                      style={{ background: '#FFC66B', color: '#1a1420', borderRadius: 2 }}
                    >C</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {activeTraits.length > 0 && (
          <div className="mt-4">
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>
              Trait Activations
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeTraits.map(function (t) {
                var col = tierColor(t.tier)
                return (
                  <span
                    key={t.apiName}
                    className="font-mono text-[10px] px-2 py-0.5 inline-flex items-center gap-1"
                    style={{
                      background: 'rgba(14,13,21,0.8)',
                      color: col,
                      border: '1px solid ' + col + '55'
                    }}
                    title={t.tier + ' tier (' + t.count + '/' + t.maxBreakpoint + ')'}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block' }}/>
                    {t.count} {t.name}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {c.augments && c.augments.length > 0 && (
          <div className="mt-4">
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>
              Augments ({c.augments.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {c.augments.slice(0, 18).map(function (a, idx) {
                return (
                  <span
                    key={idx}
                    className="font-mono text-[10px] px-2 py-0.5"
                    style={{ background: accent + '18', color: accent, border: '1px solid ' + accent + '44' }}
                  >{a}</span>
                )
              })}
              {c.augments.length > 18 && (
                <span className="font-mono text-[10px] px-2 py-0.5" style={{ color: '#9d8e7c' }}>
                  +{c.augments.length - 18} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(255,198,107,0.15)' }}>
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.4)' }}>
            {c.patch || 'Patch 17'}
          </span>
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="font-mono text-[11px] uppercase tracking-widest inline-flex items-center gap-1 px-3 py-1 cursor-pointer"
              style={{ background: accent + '18', color: accent, border: '1px solid ' + accent + '55' }}
            >
              Open flowchart
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
            </button>
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
