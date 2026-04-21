// Derive a staged flowchart progression from a comp's final board.
//
// Final board uses canonical positions (hand-authored for top S-tier comps)
// or trait-aware heuristic. Items are recommended per carry from the item
// recommender. Earlier stages (opener / stabilize / spike) synthesize a
// cost-curve progression: opener leans on low-cost units, you push levels
// and roll for 3+ cost carries, cap with 4/5 costs.

import { computeActiveTraits } from './traitComputer'
import { positionBoard } from './positioning'
import { stageBeats } from './pivots'
import { recommendItems, buildItemMap, lookupItems } from './itemRecommender'

var STAGE_DEFS = [
  { key: 'opener',  label: 'Opener',     maxCost: 2, size: 4 },
  { key: 'midgame', label: 'Stabilize',  maxCost: 3, size: 6 },
  { key: 'spike',   label: 'Power Spike', maxCost: 4, size: 7 },
  { key: 'final',   label: 'Final Board', maxCost: 5, size: 9 },
]

function champByKey(champions) {
  var m = {}
  champions.forEach(function (c) { m[c.key] = c })
  return m
}

function pickStageUnits(board, champByKeyMap, carrySet, opts) {
  var maxCost = opts.maxCost
  var size = opts.size

  var indexed = (board || []).map(function (k, idx) {
    var c = champByKeyMap[k]
    return {
      key: k,
      cost: c ? (c.cost || 1) : 1,
      carry: carrySet.has(k),
      eligible: !c || (c.cost || 1) <= maxCost,
      idx: idx,
    }
  })

  var eligible = indexed.filter(function (e) { return e.eligible })
  var pool = eligible.length > 0 ? eligible : indexed.slice()

  pool.sort(function (a, b) {
    if (a.carry !== b.carry) return a.carry ? -1 : 1
    if (a.cost !== b.cost) return a.cost - b.cost
    return a.idx - b.idx
  })

  return pool.slice(0, size).map(function (e) { return e.key })
}

// Build a { championKey: [item, item, item] } map for the hex board to render.
// Carries get their primary 3 items. Non-carries get nothing (board would
// be too cluttered with 27 item icons).
function buildItemsByKey(units, carrySet, champByKeyMap, itemMap) {
  var map = {}
  units.forEach(function (k) {
    if (!carrySet.has(k)) return
    var ch = champByKeyMap[k]
    if (!ch) return
    var rec = recommendItems(ch)
    if (!rec) return
    map[k] = lookupItems(itemMap, rec.primary)
  })
  return map
}

export function computeFlowchart(comp, champions, traits, items) {
  var byKey = champByKey(champions)
  var itemMap = buildItemMap(items || [])
  var carrySet = new Set(comp.carries || (comp.carry ? [comp.carry] : []))
  var board = comp.board || []
  var beats = stageBeats(comp.econ)

  return STAGE_DEFS.map(function (def, i) {
    var isFinal = def.key === 'final'
    var units = isFinal
      ? board.slice()
      : pickStageUnits(board, byKey, carrySet, { maxCost: def.maxCost, size: def.size })
    var activeTraits = computeActiveTraits(units, champions, traits)
    var placed = positionBoard(units, byKey, carrySet, isFinal ? comp.id : null)
    var itemsByKey = buildItemsByKey(units, carrySet, byKey, itemMap)
    var beat = beats[i] || beats[beats.length - 1]
    return {
      key: def.key,
      label: def.label,
      stage: beat.stage,
      level: beat.level,
      target: beat.target,
      units: units,
      placed: placed,
      itemsByKey: itemsByKey,
      traits: activeTraits,
      carrySet: carrySet,
      isFinal: isFinal,
    }
  })
}

export function splitAugments(augs) {
  var list = Array.isArray(augs) ? augs : []
  return {
    top: list.slice(0, 3),
    mid: list.slice(3, 7),
    rest: list.slice(7),
  }
}

// Compute carry item recommendations for the comp hero/sidebar UI.
// Returns [{ champion, items: [item], altItems: [item], reason, archetype, curated }]
export function carryItemPlan(comp, champions, items) {
  var byKey = champByKey(champions)
  var itemMap = buildItemMap(items || [])
  var carries = comp.carries || (comp.carry ? [comp.carry] : [])
  return carries.map(function (k) {
    var ch = byKey[k]
    if (!ch) return null
    var rec = recommendItems(ch)
    if (!rec) return null
    return {
      champion: ch,
      items: lookupItems(itemMap, rec.primary),
      altItems: lookupItems(itemMap, rec.alts),
      reason: rec.reason,
      archetype: rec.archetype,
      curated: rec.curated,
    }
  }).filter(Boolean)
}
