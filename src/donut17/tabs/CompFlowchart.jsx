import { useMemo } from 'react'
import { computeFlowchart, splitAugments, carryItemPlan } from '../lib/flowchart'
import { tierColor as traitTierColor } from '../lib/traitComputer'
import { buildCompSummary } from '../lib/compSummary'
import { findPivots } from '../lib/pivots'
import { makeImgFallback, costColor } from '../lib/imgFallback'
import HexBoard from '../lib/HexBoard'
import ChampImg from '../lib/ChampImg'
import ItemIcon from '../lib/ItemIcon'

var TIER_COLOR = {
  'OP': '#ff6b9d',
  'S+': '#ff9d6b',
  'S': '#FFC66B',
  'A': '#67e2d9',
  'B': '#9d8eff',
  'C': '#9d8e7c',
  'D': '#554a42',
}

var ECON_LABEL = {
  fast8: 'Fast 8',
  fast9: 'Fast 9',
  reroll1: '1-Cost Reroll',
  reroll2: '2-Cost Reroll',
  reroll3: '3-Cost Reroll',
}

function econLabel(econ) {
  if (!econ) return ''
  return ECON_LABEL[econ] || econ
}

export default function CompFlowchart(props) {
  var comp = props.comp
  var champions = props.champions
  var traits = props.traits
  var items = props.items || []
  var allComps = props.allComps || []
  var onBack = props.onBack
  var onOpenComp = props.onOpenComp

  var champByKey = useMemo(function () {
    var m = {}
    champions.forEach(function (c) { m[c.key] = c })
    return m
  }, [champions])

  var flow = useMemo(function () {
    return computeFlowchart(comp, champions, traits, items)
  }, [comp, champions, traits, items])

  var carryPlans = useMemo(function () {
    return carryItemPlan(comp, champions, items)
  }, [comp, champions, items])

  var summary = useMemo(function () {
    return buildCompSummary(comp, champions)
  }, [comp, champions])

  var pivots = useMemo(function () {
    return findPivots(comp, allComps, { max: 4 })
  }, [comp, allComps])

  var bestTier = comp.tftflowBestTier || comp.tier || ''
  var accent = TIER_COLOR[bestTier] || '#FFC66B'
  var tierList = comp.tftflowTiers || (bestTier ? [bestTier] : [])
  var carrySet = new Set(comp.carries || (comp.carry ? [comp.carry] : []))
  var carryKeys = Array.from(carrySet)
  var augBuckets = splitAugments(comp.augments)

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[11px] uppercase tracking-widest mb-6 inline-flex items-center gap-1 cursor-pointer"
        style={{ color: 'rgba(228,225,236,0.65)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
        Back to Comps
      </button>

      <Hero comp={comp} accent={accent} tierList={tierList} carryKeys={carryKeys} champByKey={champByKey} summary={summary}/>

      {carryPlans.length > 0 && (
        <div className="mt-8">
          <SectionHead label="Carry Items" accent={accent}/>
          <p className="text-xs font-body mb-6" style={{ color: 'rgba(228,225,236,0.55)' }}>
            BIS items per carry. Curated recommendations for headline meta carries; archetype defaults for the rest.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {carryPlans.map(function (plan) {
              return <CarryItemCard key={plan.champion.key} plan={plan} accent={accent}/>
            })}
          </div>
        </div>
      )}

      {/* Stage rail */}
      <div className="mt-8 mb-10">
        <StageRail flow={flow} accent={accent}/>
      </div>

      <div>
        <SectionHead label="Flowchart" accent={accent}/>
        <p className="text-xs font-body mb-6" style={{ color: 'rgba(228,225,236,0.55)' }}>
          Stage-by-stage hex boards synthesized from the final comp + champion stats. Positioning is heuristic (tanks front, carries back) and you should flex it based on your lobby's threat.
        </p>
        <div>
          {flow.map(function (stage, i) {
            return (
              <div key={stage.key}>
                <StageCard stage={stage} accent={accent} champByKey={champByKey}/>
                {i < flow.length - 1 && (
                  <div className="flex justify-center" aria-hidden="true">
                    <div className="d17-stage-arrow" style={{ height: 36 }}/>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {comp.augments && comp.augments.length > 0 && (
        <div className="mt-10">
          <SectionHead label="Augment Priority" accent={accent}/>
          <p className="text-xs font-body mb-6" style={{ color: 'rgba(228,225,236,0.55)' }}>
            Ranked by the meta source. Top are bread-and-butter, strong are flex, rest are contextual.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <AugColumn label="Top" accent="#FFC66B" augs={augBuckets.top}/>
            <AugColumn label="Strong" accent="#67e2d9" augs={augBuckets.mid}/>
            <AugColumn label="Flex" accent="#9d8eff" augs={augBuckets.rest}/>
          </div>
        </div>
      )}

      {pivots.length > 0 && (
        <div className="mt-10">
          <SectionHead label="Pivot Lines" accent={accent}/>
          <p className="text-xs font-body mb-6" style={{ color: 'rgba(228,225,236,0.55)' }}>
            Other meta comps that share carries or board units with this one. If you get contested, these are the cleanest transitions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pivots.map(function (p) {
              return (
                <PivotCard
                  key={p.comp.id}
                  pivot={p}
                  champByKey={champByKey}
                  onOpen={onOpenComp ? function(){ onOpenComp(p.comp.id) } : null}
                />
              )
            })}
          </div>
        </div>
      )}

      {comp.url && (
        <div className="mt-10 d17-panel-lo p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Source</p>
            <p className="text-sm font-body mt-1" style={{ color: 'rgba(228,225,236,0.75)' }}>
              Board + tiers + augments mirrored from tftflow.com, {comp.patch || 'current patch'}. Positioning + stage transitions synthesized in-app.
            </p>
          </div>
          <a
            href={comp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
            style={{ color: accent }}
          >
            View on tftflow
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          </a>
        </div>
      )}
    </div>
  )
}

function StageRail(props) {
  var flow = props.flow
  var accent = props.accent
  return (
    <div className="d17-panel-lo p-4 flex items-center gap-2 md:gap-4 overflow-x-auto">
      {flow.map(function (s, i) {
        return (
          <div key={s.key} className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="flex flex-col items-start gap-0.5 min-w-[110px]">
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>{s.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="font-editorial text-lg" style={{ color: s.isFinal ? accent : '#e4e1ec' }}>{s.stage}</span>
                <span className="font-mono text-[10px]" style={{ color: '#67e2d9' }}>LVL {s.level}</span>
              </div>
            </div>
            {i < flow.length - 1 && (
              <span className="material-symbols-outlined" style={{ color: 'rgba(255,198,107,0.35)', fontSize: 18 }}>chevron_right</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Hero(props) {
  var comp = props.comp
  var accent = props.accent
  var tierList = props.tierList
  var carryKeys = props.carryKeys
  var champByKey = props.champByKey
  var summary = props.summary

  return (
    <div className="d17-panel-hi relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 15% 0%, ' + accent + '33 0%, transparent 55%)',
          pointerEvents: 'none'
        }}
      />
      <div className="relative p-6 md:p-8">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="flex gap-3">
            {carryKeys.slice(0, 3).map(function (k) {
              var ch = champByKey[k]
              if (!ch) return null
              return (
                <img
                  key={k}
                  alt={ch.name}
                  src={ch.assets && ch.assets.face_lg}
                  onError={makeImgFallback(ch.cost)}
                  className="w-20 h-20 md:w-24 md:h-24 object-cover"
                  style={{ border: '2px solid ' + accent, boxShadow: '0 0 24px ' + accent + '55' }}
                />
              )
            })}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>Flowchart</span>
              {comp.econ && (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5" style={{ background: 'rgba(14,13,21,0.8)', color: '#9d8e7c', border: '1px solid rgba(157,142,124,0.3)' }}>
                  {econLabel(comp.econ)}
                </span>
              )}
            </div>
            <h1 className="font-editorial text-4xl md:text-5xl mt-2" style={{ color: '#e4e1ec' }}>
              {comp.name}
            </h1>
            {summary && (
              <p className="font-body text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.70)' }}>
                {summary}
              </p>
            )}
            {tierList.length > 0 && (
              <div className="mt-5 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Tier</span>
                {tierList.map(function (t) {
                  var c = TIER_COLOR[t] || '#FFC66B'
                  return (
                    <span
                      key={t}
                      className="font-mono text-[11px] uppercase tracking-widest px-2 py-0.5"
                      style={{ background: c + '18', color: c, border: '1px solid ' + c + '55' }}
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
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHead(props) {
  return (
    <h2 className="font-editorial text-3xl mb-1" style={{ color: '#e4e1ec' }}>
      <span style={{ color: props.accent }}>/</span> {props.label}
    </h2>
  )
}

function StageCard(props) {
  var stage = props.stage
  var accent = props.accent
  var champByKey = props.champByKey

  return (
    <div className="d17-panel p-5 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: stage.isFinal ? accent : 'rgba(255,198,107,0.35)',
        }}
      />
      <div className="pl-3 grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Stage</span>
            <span className="font-editorial text-3xl" style={{ color: stage.isFinal ? accent : '#e4e1ec' }}>{stage.stage}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#67e2d9' }}>Level {stage.level}</span>
            <span className="font-mono text-[10px]" style={{ color: '#9d8e7c' }}>{stage.units.length} units</span>
          </div>
          <p className="font-label uppercase tracking-widest text-[10px] mt-2" style={{ color: stage.isFinal ? accent : 'rgba(228,225,236,0.55)' }}>
            {stage.label}
          </p>
          {stage.target && (
            <p className="font-body text-xs mt-2 leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
              {stage.target}
            </p>
          )}

          {stage.traits.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>Active Traits</p>
              <div className="flex flex-wrap gap-1">
                {stage.traits.map(function (t) {
                  var color = traitTierColor(t.tier)
                  return (
                    <span
                      key={t.apiName}
                      className="font-mono text-[10px] uppercase tracking-wide inline-flex items-center gap-1 px-2 py-0.5"
                      style={{ background: color + '14', color: color, border: '1px solid ' + color + '44' }}
                      title={t.name + ' ' + t.count + '/' + t.maxBreakpoint + ' (' + t.tier + ')'}
                    >
                      <span style={{ fontWeight: 700 }}>{t.count}</span>
                      <span>{t.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-9">
          <HexBoard
            placed={stage.placed}
            champByKey={champByKey}
            itemsByKey={stage.isFinal ? stage.itemsByKey : null}
            size={stage.isFinal ? 64 : 52}
            showLabels={true}
          />
        </div>
      </div>
    </div>
  )
}

function CarryItemCard(props) {
  var plan = props.plan
  var accent = props.accent
  var ch = plan.champion
  var ringColor = costColor(ch.cost)

  return (
    <div className="d17-panel p-4 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: ringColor,
        }}
      />
      <div className="pl-3 flex items-start gap-4">
        <div className="shrink-0 relative">
          <ChampImg
            champion={ch}
            size={64}
            style={{
              width: 64, height: 64,
              border: '2px solid ' + ringColor,
              boxShadow: '0 0 12px ' + ringColor + '88'
            }}
          />
          <span
            className="absolute font-mono text-[8px] font-bold leading-none"
            style={{
              top: 4, left: 4, padding: '2px 4px',
              background: 'rgba(0,0,0,0.85)', color: ringColor,
            }}
          >{ch.cost}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-editorial text-xl leading-tight" style={{ color: '#e4e1ec' }}>{ch.name}</h3>
            <span
              className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5"
              style={{
                background: plan.curated ? accent + '20' : 'rgba(157,142,124,0.10)',
                color: plan.curated ? accent : '#9d8e7c',
                border: '1px solid ' + (plan.curated ? accent + '55' : 'rgba(157,142,124,0.2)'),
              }}
            >{plan.curated ? 'Curated' : 'Archetype'}</span>
          </div>
          <p className="text-[11px] font-body mt-1.5 leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
            {plan.reason}
          </p>
          <div className="mt-3">
            <p className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#FFC66B' }}>BIS</p>
            <div className="flex flex-wrap gap-2">
              {plan.items.map(function (it) {
                return <ItemIcon key={it.apiName} item={it} size={36}/>
              })}
            </div>
          </div>
          {plan.altItems && plan.altItems.length > 0 && (
            <div className="mt-3">
              <p className="font-mono text-[9px] uppercase tracking-widest mb-1.5" style={{ color: '#9d8e7c' }}>Alternates</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.altItems.slice(0, 4).map(function (it) {
                  return <ItemIcon key={it.apiName} item={it} size={26}/>
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PivotCard(props) {
  var p = props.pivot
  var c = p.comp
  var champByKey = props.champByKey
  var onOpen = props.onOpen
  var tier = c.tftflowBestTier || c.tier || ''
  var accent = TIER_COLOR[tier] || '#FFC66B'

  return (
    <div className="d17-panel p-4 relative overflow-hidden">
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(120deg, ' + accent + '14 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div className="relative flex items-start gap-3">
        <div className="flex -space-x-2 shrink-0">
          {(c.carries || (c.carry ? [c.carry] : [])).slice(0, 2).map(function (k) {
            var ch = champByKey[k]
            if (!ch) return null
            return (
              <ChampImg
                key={k}
                champion={ch}
                carry
                size={44}
                style={{ width: 44, height: 44 }}
              />
            )
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-editorial text-lg truncate" style={{ color: '#e4e1ec' }}>{c.name}</p>
            {tier && (
              <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5"
                style={{ background: accent + '22', color: accent, border: '1px solid ' + accent + '55' }}>{tier}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            {p.sharedCarries.length > 0 && (
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#FFC66B' }}>
                {p.sharedCarries.length} shared carr{p.sharedCarries.length === 1 ? 'y' : 'ies'}
              </span>
            )}
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#67e2d9' }}>
              {p.sharedUnits.length} shared units
            </span>
          </div>
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="mt-3 font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 px-2 py-1 cursor-pointer"
              style={{ background: accent + '14', color: accent, border: '1px solid ' + accent + '44' }}
            >
              Inspect pivot
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>chevron_right</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AugColumn(props) {
  var label = props.label
  var accent = props.accent
  var augs = props.augs || []
  return (
    <div className="d17-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: accent }}>{label}</p>
      <ul className="space-y-1.5">
        {augs.map(function (a, i) {
          return (
            <li
              key={i}
              className="font-body text-sm px-2 py-1"
              style={{ background: 'rgba(14,13,21,0.45)', borderLeft: '2px solid ' + accent + '55', color: 'rgba(228,225,236,0.85)' }}
            >{a}</li>
          )
        })}
        {augs.length === 0 && (
          <li className="font-mono text-[10px]" style={{ color: '#504535' }}>-- none --</li>
        )}
      </ul>
    </div>
  )
}
