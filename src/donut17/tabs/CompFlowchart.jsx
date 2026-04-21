import { useMemo } from 'react'
import { makeImgFallback, costColor } from '../lib/imgFallback'
import { computeFlowchart, splitAugments } from '../lib/flowchart'
import { tierColor as traitTierColor } from '../lib/traitComputer'
import { buildCompSummary } from '../lib/compSummary'

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
  var onBack = props.onBack

  var champByKey = useMemo(function () {
    var m = {}
    champions.forEach(function (c) { m[c.key] = c })
    return m
  }, [champions])

  var flow = useMemo(function () {
    return computeFlowchart(comp, champions, traits)
  }, [comp, champions, traits])

  var summary = useMemo(function () {
    return buildCompSummary(comp, champions)
  }, [comp, champions])

  var bestTier = comp.tftflowBestTier || comp.tier || ''
  var accent = TIER_COLOR[bestTier] || '#FFC66B'
  var tierList = comp.tftflowTiers || (bestTier ? [bestTier] : [])
  var carrySet = new Set(comp.carries || (comp.carry ? [comp.carry] : []))
  var carryKeys = Array.from(carrySet)
  var augBuckets = splitAugments(comp.augments)

  var traitByApi = useMemo(function () {
    var m = {}
    traits.forEach(function (t) { m[t.apiName] = t })
    return m
  }, [traits])

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

      <div className="mt-8">
        <SectionHead label="Flowchart" accent={accent}/>
        <p className="text-xs font-body mb-6" style={{ color: 'rgba(228,225,236,0.55)' }}>
          Synthetic progression derived from the final board + cost curve. Your real transitions flex with rolls, econ, and lobby contest.
        </p>
        <div className="space-y-5">
          {flow.map(function (stage, i) {
            return (
              <StageCard
                key={stage.key}
                stage={stage}
                accent={accent}
                champByKey={champByKey}
                traitByApi={traitByApi}
                showArrow={i < flow.length - 1}
              />
            )
          })}
        </div>
      </div>

      {comp.augments && comp.augments.length > 0 && (
        <div className="mt-10">
          <SectionHead label="Augment Priority" accent={accent}/>
          <p className="text-xs font-body mb-6" style={{ color: 'rgba(228,225,236,0.55)' }}>
            Ranked by the meta source. Top 3 are bread-and-butter, next 4 are strong flex, last are contextual.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <AugColumn label="Top" accent="#FFC66B" augs={augBuckets.top}/>
            <AugColumn label="Strong" accent="#67e2d9" augs={augBuckets.mid}/>
            <AugColumn label="Flex" accent="#9d8eff" augs={augBuckets.rest}/>
          </div>
        </div>
      )}

      {comp.url && (
        <div className="mt-10 d17-panel-lo p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Source</p>
            <p className="text-sm font-body mt-1" style={{ color: 'rgba(228,225,236,0.75)' }}>
              Board + tiers + augments sourced from tftflow.com, {comp.patch || 'current patch'}.
            </p>
          </div>
          <a
            href={comp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
            style={{ color: accent }}
          >
            Open original flowchart
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          </a>
        </div>
      )}
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
            <h1 className="font-editorial italic text-4xl md:text-5xl mt-2" style={{ color: '#e4e1ec' }}>
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
    <h2 className="font-editorial italic text-3xl mb-1" style={{ color: '#e4e1ec' }}>
      <span style={{ color: props.accent }}>/</span> {props.label}
    </h2>
  )
}

function StageCard(props) {
  var stage = props.stage
  var accent = props.accent
  var champByKey = props.champByKey
  var traitByApi = props.traitByApi
  var showArrow = props.showArrow

  return (
    <div className="relative">
      <div className="d17-panel p-5 relative overflow-hidden">
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: stage.isFinal ? accent : 'rgba(255,198,107,0.35)',
          }}
        />
        <div className="pl-3 flex flex-col md:flex-row md:items-start md:gap-6 gap-4">
          {/* Step number + level */}
          <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-1 shrink-0 md:w-32">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Stage</span>
              <span className="font-editorial italic text-2xl" style={{ color: stage.isFinal ? accent : '#e4e1ec' }}>{stage.stage}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>LVL</span>
              <span className="font-mono text-lg" style={{ color: '#e4e1ec' }}>{stage.level}</span>
            </div>
            <p className="font-label uppercase tracking-widest text-[10px]" style={{ color: stage.isFinal ? accent : 'rgba(228,225,236,0.55)' }}>
              {stage.label}
            </p>
          </div>

          {/* Units hex row */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {stage.units.map(function (k, i) {
                var ch = champByKey[k]
                var isCarry = stage.carrySet.has(k)
                if (!ch) {
                  return (
                    <div
                      key={i + k}
                      className="w-12 h-12 flex items-center justify-center font-mono text-[10px]"
                      style={{ background: '#0e0d15', color: '#504535', border: '1px dashed #504535' }}
                    >?</div>
                  )
                }
                return (
                  <div key={i + k} className="relative group">
                    <img
                      alt={ch.name}
                      src={ch.assets && ch.assets.face}
                      onError={makeImgFallback(ch.cost)}
                      className="w-12 h-12 object-cover"
                      style={{
                        border: isCarry ? '2px solid #FFC66B' : '1px solid ' + costColor(ch.cost),
                        boxShadow: isCarry ? '0 0 10px rgba(255,198,107,0.55)' : 'none',
                      }}
                      title={ch.name + (isCarry ? ' (carry)' : '')}
                    />
                    {isCarry && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -right-1 font-mono text-[8px] font-bold px-1 leading-none"
                        style={{ background: '#FFC66B', color: '#0e0d15' }}
                      >C</span>
                    )}
                    <span
                      className="absolute bottom-0 inset-x-0 text-center font-mono text-[8px] uppercase py-0.5"
                      style={{ background: 'rgba(14,13,21,0.85)', color: 'rgba(228,225,236,0.85)' }}
                    >
                      {ch.name}
                    </span>
                  </div>
                )
              })}
              {stage.units.length === 0 && (
                <span className="font-mono text-xs" style={{ color: '#504535' }}>-- no eligible units --</span>
              )}
            </div>

            {/* Active traits */}
            {stage.traits.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {stage.traits.map(function (t) {
                  var color = traitTierColor(t.tier)
                  return (
                    <span
                      key={t.apiName}
                      className="font-mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 px-2 py-0.5"
                      style={{ background: color + '14', color: color, border: '1px solid ' + color + '44' }}
                      title={t.name + ' ' + t.count + '/' + t.maxBreakpoint}
                    >
                      <span style={{ fontWeight: 700 }}>{t.count}</span>
                      <span>{t.name}</span>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {showArrow && (
        <div
          className="flex justify-center"
          style={{ height: 14, color: 'rgba(255,198,107,0.35)' }}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_downward</span>
        </div>
      )}
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
