// Derive a staged flowchart progression from a comp's final board.
//
// tftflow and similar sites author hand-crafted stage-by-stage transitions;
// we don't have that data (their variation boards are JS-hydrated, not
// server-rendered). Instead we synthesize a cost-curve progression: the
// common TFT arc where your opener leans on low-cost units, you push levels
// and roll for 3+ cost carries, then cap with 4/5 costs. This is inferred
// from the final board -- no copied prose.

import { computeActiveTraits } from './traitComputer'

var STAGE_DEFS = [
  { key: 'opener',  label: 'Opener',     stage: '2-1',  level: 4, maxCost: 2, size: 4 },
  { key: 'midgame', label: 'Stabilize',  stage: '3-2',  level: 6, maxCost: 3, size: 6 },
  { key: 'spike',   label: 'Power Spike', stage: '4-1', level: 7, maxCost: 4, size: 7 },
  { key: 'final',   label: 'Final Board', stage: '5+',  level: 9, maxCost: 5, size: 9 },
]

function champByKey(champions) {
  var m = {}
  champions.forEach(function (c) { m[c.key] = c })
  return m
}

// Pick up to `size` units from board biased toward lower-cost where appropriate.
// We always include carries if their cost fits; fill remaining slots with lowest
// cost units from the remainder (reflects opener/stabilize reality).
function pickStageUnits(board, champByKeyMap, carrySet, opts) {
  var maxCost = opts.maxCost
  var size = opts.size
  var eligible = (board || []).filter(function (k) {
    var c = champByKeyMap[k]
    if (!c) return true
    return (c.cost || 1) <= maxCost
  })

  // sort: carries first, then ascending cost, then preserve order
  var indexed = eligible.map(function (k, idx) {
    var c = champByKeyMap[k]
    return {
      key: k,
      cost: c ? (c.cost || 1) : 1,
      carry: carrySet.has(k),
      idx: idx,
    }
  })
  indexed.sort(function (a, b) {
    if (a.carry !== b.carry) return a.carry ? -1 : 1
    if (a.cost !== b.cost) return a.cost - b.cost
    return a.idx - b.idx
  })

  return indexed.slice(0, size).map(function (e) { return e.key })
}

export function computeFlowchart(comp, champions, traits) {
  var byKey = champByKey(champions)
  var carrySet = new Set(comp.carries || (comp.carry ? [comp.carry] : []))
  var board = comp.board || []

  return STAGE_DEFS.map(function (def) {
    var isFinal = def.key === 'final'
    var units = isFinal
      ? board.slice()
      : pickStageUnits(board, byKey, carrySet, { maxCost: def.maxCost, size: def.size })
    var activeTraits = computeActiveTraits(units, champions, traits)
    return {
      key: def.key,
      label: def.label,
      stage: def.stage,
      level: def.level,
      units: units,
      traits: activeTraits,
      carrySet: carrySet,
      isFinal: isFinal,
    }
  })
}

export function splitAugments(augs) {
  var list = Array.isArray(augs) ? augs : []
  // tftflow lists augments ranked; we bucket into silver/gold/prismatic tiers
  // only by list position since tftflow doesn't tag tier here. Callers should
  // treat these as "priority order" not absolute tier.
  return {
    top: list.slice(0, 3),
    mid: list.slice(3, 7),
    rest: list.slice(7),
  }
}
