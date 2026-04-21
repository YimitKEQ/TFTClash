import { useMemo, useState } from 'react'
import { scoreComps } from '../lib/scoring'
import { costColor } from '../lib/imgFallback'
import { computeActiveTraits, tierColor } from '../lib/traitComputer'
import ChampImg from '../lib/ChampImg'

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

  var championsFiltered = useMemo(function () {
    // Only playable units -- strip PVE, dummy, armory, summon, fakeunit, etc.
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

  return (
    <div>
      {/* Hero */}
      <header className="mb-10">
        <div className="flex justify-between items-end mb-3 flex-wrap gap-3">
          <div>
            <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Divine Counsel</span>
            <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Opener Advisor</h1>
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
          <span>TOP 3 COMPS WITH FULL GAMEPLAN APPEAR BELOW</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Unit pool */}
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

        {/* Rankings */}
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
                Carry match = 5 pts, board = 3, early opener = 2.5, flex = 2, shared trait = 0.5. Tier tiebreaker (S > A > B > X).
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
                  meta={meta}
                  pickedKeys={picked}
                />
              )
            })}
            {picked.length > 0 && top.every(function(r){ return r.score === 0 }) && (
              <div className="d17-panel p-6 text-center">
                <p className="font-body text-sm" style={{ color: 'rgba(228,225,236,0.7)' }}>
                  No matching meta comp for this opener. Try different units or keep the most flexible one.
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
  var champByKey = {}
  champions.forEach(function(x){ champByKey[x.key] = x })
  var metaStats = (props.meta.comps && props.meta.comps[c.id]) || null
  var tier = c.tier || (metaStats && metaStats.tier) || null

  var _exp = useState(props.rank === 1)
  var expanded = _exp[0]
  var setExpanded = _exp[1]

  var activeTraits = useMemo(function () {
    return computeActiveTraits(c.board, champions, traits)
  }, [c, champions, traits])

  var pickedSet = new Set(pickedKeys)
  var carryChamp = champByKey[c.carry]

  return (
    <div className="d17-panel p-5 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, ' + c.color + '22 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative">
        {/* Header: rank, name, tier, score */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs" style={{ color: c.color }}>#{props.rank}</span>
              <h3 className="font-editorial italic text-xl" style={{ color: '#e4e1ec' }}>{c.name}</h3>
              {tier && (
                <span className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest font-bold" style={{ background: c.color + '22', color: c.color, border: '1px solid ' + c.color + '55' }}>
                  {tier}
                </span>
              )}
              {c.strategy && (
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>
                  {c.strategy}
                </span>
              )}
              {c.difficulty && (
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'rgba(228,225,236,0.45)' }}>
                  | {c.difficulty}
                </span>
              )}
            </div>
            <p className="text-xs mt-1 font-body" style={{ color: 'rgba(228,225,236,0.65)' }}>{c.desc}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-xl" style={{ color: c.color }}>{props.result.score}</p>
            <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>match</p>
          </div>
        </div>

        {/* Full board -- the capped 8-9 unit board */}
        <div className="mt-4">
          <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>
            Final Board ({(c.board || []).length} units)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(c.board || []).map(function (k) {
              var ch = champByKey[k]
              if (!ch) return null
              var isCarry = k === c.carry
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

        {/* Active traits at capped board */}
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

        {/* Meta avg placement if available */}
        <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-mono uppercase tracking-wider">
          <div>
            <span style={{ color: '#9d8e7c' }}>GOD: </span>
            <span style={{ color: '#FFC66B' }}>{c.god}</span>
          </div>
          <div className="text-right">
            {metaStats && metaStats.avg_placement ? (
              <span>
                <span style={{ color: '#9d8e7c' }}>AVG: </span>
                <span style={{ color: '#67e2d9' }}>{Number(metaStats.avg_placement).toFixed(2)}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={function(){ setExpanded(function(v){ return !v }) }}
                className="font-mono text-[10px] uppercase tracking-widest cursor-pointer"
                style={{ color: c.color }}
              >
                {expanded ? 'Hide plan' : 'Show full plan'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded: opener, items, carousel, stage plan, augments */}
        {expanded && (
          <div className="mt-4 pt-4 space-y-4" style={{ borderTop: '1px solid rgba(255,198,107,0.15)' }}>
            {/* Early board */}
            {c.early && c.early.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#9d8e7c' }}>
                  Stage 2 Opener
                </p>
                <div className="flex flex-wrap gap-1">
                  {c.early.map(function (k) {
                    var ch = champByKey[k]
                    if (!ch) return null
                    return <ChampImg key={k} champion={ch} size={32} carry={k === c.carry}/>
                  })}
                </div>
              </div>
            )}

            {/* Carry items */}
            {c.carryItems && c.carryItems.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#9d8e7c' }}>
                  Carry Items ({carryChamp ? carryChamp.name : c.carry})
                </p>
                <div className="flex flex-wrap gap-1">
                  {c.carryItems.map(function (it, idx) {
                    return (
                      <span
                        key={idx}
                        className="font-mono text-[10px] px-2 py-0.5"
                        style={{ background: '#0e0d15', color: '#FFC66B', border: '1px solid rgba(255,198,107,0.3)' }}
                      >{it}</span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Support items */}
            {c.items && (
              <SupportItems items={c.items} carryName={carryChamp ? carryChamp.name : null} color={c.color}/>
            )}

            {/* Carousel priority */}
            {c.carousel && c.carousel.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#9d8e7c' }}>
                  Carousel Priority
                </p>
                <p className="font-body text-xs" style={{ color: 'rgba(228,225,236,0.8)' }}>
                  {c.carousel.join(' > ')}
                </p>
              </div>
            )}

            {/* Augments */}
            {c.augments && c.augments.length > 0 && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#9d8e7c' }}>
                  Augment Picks
                </p>
                <div className="flex flex-wrap gap-1">
                  {c.augments.map(function (a, idx) {
                    return (
                      <span
                        key={idx}
                        className="font-mono text-[10px] px-2 py-0.5"
                        style={{ background: c.color + '18', color: c.color, border: '1px solid ' + c.color + '44' }}
                      >{a}</span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stage-by-stage gameplan */}
            {c.stages && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>
                  Gameplan
                </p>
                <div className="space-y-1.5">
                  <StageRow label="STAGE 2" text={c.stages.stage_2} color={c.color}/>
                  <StageRow label="STAGE 3" text={c.stages.stage_3} color={c.color}/>
                  <StageRow label="STAGE 4" text={c.stages.stage_4} color={c.color}/>
                  <StageRow label="STAGE 5+" text={c.stages.stage_5} color={c.color}/>
                </div>
              </div>
            )}

            {/* God reasoning */}
            {c.godWhy && (
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#9d8e7c' }}>
                  Why {c.god}?
                </p>
                <p className="font-body text-xs italic" style={{ color: 'rgba(228,225,236,0.7)' }}>
                  {c.godWhy}
                </p>
              </div>
            )}

            {props.rank !== 1 && (
              <button
                type="button"
                onClick={function(){ setExpanded(false) }}
                className="font-mono text-[9px] uppercase tracking-widest cursor-pointer"
                style={{ color: '#9d8e7c' }}
              >Collapse</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StageRow(props) {
  if (!props.text) return null
  return (
    <div className="flex gap-3 items-start">
      <span className="font-mono text-[9px] uppercase tracking-widest pt-0.5 shrink-0" style={{ color: props.color, minWidth: 56 }}>
        {props.label}
      </span>
      <span className="font-body text-xs leading-relaxed" style={{ color: 'rgba(228,225,236,0.82)' }}>
        {props.text}
      </span>
    </div>
  )
}

function SupportItems(props) {
  var items = props.items || {}
  var carryName = props.carryName
  var entries = Object.keys(items).filter(function (u) { return u !== carryName && u !== 'carry' && Array.isArray(items[u]) && items[u].length > 0 })
  if (entries.length === 0) return null
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#9d8e7c' }}>
        Support Items
      </p>
      <div className="space-y-1">
        {entries.map(function (unit) {
          return (
            <div key={unit} className="text-[10px] font-mono">
              <span style={{ color: props.color }}>{unit}:</span>{' '}
              <span style={{ color: 'rgba(228,225,236,0.75)' }}>{items[unit].join(', ')}</span>
            </div>
          )
        })}
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
