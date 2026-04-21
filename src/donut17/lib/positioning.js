// Board positioning: canonical lookup first, smart trait-aware heuristic second.
//
// We finally use champion *traits* (not just stats) to pick the row, which is
// closer to how human players actually position. Vanguard / Bastion / Brawler
// always front. Sniper / Replicator / Psionic always back. Carries pulled to
// center horizontally; supports fan to the edges.
//
// Board convention: 4 rows x 7 columns (matches TFT's bottom-half board).
// Row 0 = frontline, row 3 = backline. Odd rows offset half a hex right.

import { canonicalFor } from './canonicalPositions'

var COLS = 7
var ROWS = 4

// Front-row trait gates: any of these and we want row 0 (unless ranged carry).
var FRONT_TRAITS = new Set([
  'TFT17_HPTank',           // Brawler
  'TFT17_ResistTank',        // Bastion
  'TFT17_ShieldTank',        // Vanguard
  'TFT17_ShenUniqueTrait',   // Bulwark
  'TFT17_TahmKenchUniqueTrait', // Oracle
  'TFT17_RhaastUniqueTrait', // Redeemer
  'TFT17_BlitzcrankUniqueTrait', // Party Animal (front-line tanky)
])

// Back-row trait gates: any of these AND range >= 2 -> row 3.
var BACK_TRAITS = new Set([
  'TFT17_RangedTrait',         // Sniper
  'TFT17_APTrait',             // Replicator
  'TFT17_PsyOps',              // Psionic
  'TFT17_JhinUniqueTrait',     // Eradicator
  'TFT17_MissFortuneUniqueTrait', // Gun Goddess
  'TFT17_MorganaUniqueTrait',  // Dark Lady
  'TFT17_VexUniqueTrait',      // Doomer
])

// Skirmish-row traits: melee bruisers and assassins.
var SKIRMISH_TRAITS = new Set([
  'TFT17_MeleeTrait',          // Marauder
  'TFT17_AssassinTrait',       // Rogue (jumps backline anyway, start mid)
  'TFT17_FioraUniqueTrait',    // Divine Duelist
  'TFT17_ZedUniqueTrait',      // Galaxy Hunter
])

function rangeOf(c) { return (c && c.stats && typeof c.stats.range === 'number') ? c.stats.range : 1 }
function hpOf(c) { return (c && c.stats && typeof c.stats.hp === 'number') ? c.stats.hp : 700 }

function hasAny(traits, set) {
  if (!traits) return false
  for (var i = 0; i < traits.length; i++) if (set.has(traits[i])) return true
  return false
}

// Which row a unit belongs to, 0 (front) -> 3 (back).
export function chooseRow(c, isCarry) {
  if (!c) return 2
  var range = rangeOf(c)
  var hp = hpOf(c)
  var traits = c.traits || []

  var isFront = hasAny(traits, FRONT_TRAITS)
  var isBack  = hasAny(traits, BACK_TRAITS)
  var isSkirm = hasAny(traits, SKIRMISH_TRAITS)

  // Carry overrides: range dictates row but never override a strong trait gate.
  if (isCarry) {
    if (range >= 3) return 3                       // ranged ADC carry
    if (isFront && range <= 1) return 0            // tanky carry (Nunu, TahmKench)
    if (range <= 1) return 1                       // melee bruiser carry (Jax, Aatrox)
    return 2                                        // mid-range carry (range 2)
  }

  // Strong trait signals first.
  if (isFront && range <= 2) return 0
  if (isBack && range >= 2) return 3
  if (isSkirm && range <= 2) return 1

  // Fall back to stat heuristic.
  if (range <= 1 && hp >= 850) return 0
  if (range <= 1) return 1
  if (range === 2) return 2
  return 3
}

// Spread units across columns, carries to center, supports to edges.
// Overflow rebalances to the adjacent row toward the center.
function distribute(buckets) {
  for (var i = 0; i < ROWS; i++) {
    while (buckets[i].length > COLS) {
      var overflow = buckets[i].pop()
      var target = i < ROWS / 2 ? i + 1 : i - 1
      buckets[target].push(overflow)
    }
  }
}

function arrangeCenteredRow(items) {
  var n = items.length
  if (n === 0) return []
  // Carries first so they take the middle slots.
  var carriesFirst = items.slice().sort(function (a, b) {
    if (a.isCarry !== b.isCarry) return a.isCarry ? -1 : 1
    return 0
  })
  var startCol = Math.floor((COLS - n) / 2)
  var ordered = new Array(n)
  var center = Math.floor((n - 1) / 2)
  ordered[center] = carriesFirst[0]
  var lPtr = center, rPtr = center + 1
  for (var idx = 1; idx < n; idx++) {
    var unit = carriesFirst[idx]
    if (idx % 2 === 1 && rPtr < n) {
      ordered[rPtr] = unit
      rPtr++
    } else if (lPtr > 0) {
      lPtr--
      ordered[lPtr] = unit
    } else if (rPtr < n) {
      ordered[rPtr] = unit
      rPtr++
    }
  }
  return ordered.map(function (u, i) {
    return u ? { key: u.key, col: startCol + i, isCarry: !!u.isCarry } : null
  }).filter(Boolean)
}

// Special handling for the back row: spread carries to opposite corners
// (anti-assassin protection), supports cluster behind front-line tanks.
function arrangeBackRow(items) {
  if (items.length === 0) return []
  var carries = items.filter(function (i) { return i.isCarry })
  var supports = items.filter(function (i) { return !i.isCarry })
  var placed = []
  if (carries.length === 1) {
    placed.push({ key: carries[0].key, col: 6, isCarry: true })
    supports.forEach(function (s, i) { placed.push({ key: s.key, col: i, isCarry: false }) })
  } else if (carries.length >= 2) {
    placed.push({ key: carries[0].key, col: 0, isCarry: true })
    placed.push({ key: carries[1].key, col: 6, isCarry: true })
    var midStart = Math.max(1, Math.floor((COLS - supports.length) / 2))
    supports.forEach(function (s, i) { placed.push({ key: s.key, col: midStart + i, isCarry: false }) })
  } else {
    // No carries -> just center
    return arrangeCenteredRow(items)
  }
  // Dedupe collisions
  var seen = {}
  return placed.filter(function (p) {
    if (seen[p.col]) return false
    seen[p.col] = true
    return true
  }).slice(0, COLS)
}

// Apply heuristic to (unitKeys, champByKey, carrySet) when no canonical exists.
function heuristicLayout(unitKeys, champByKey, carrySet) {
  var buckets = { 0: [], 1: [], 2: [], 3: [] }
  ;(unitKeys || []).forEach(function (k) {
    var c = champByKey[k]
    var row = chooseRow(c, carrySet && carrySet.has(k))
    buckets[row].push({ key: k, isCarry: carrySet && carrySet.has(k) })
  })
  distribute(buckets)

  var placed = []
  for (var r = 0; r < ROWS; r++) {
    var items = buckets[r]
    if (items.length === 0) continue
    var arranged = r === 3 ? arrangeBackRow(items) : arrangeCenteredRow(items)
    arranged.forEach(function (p) {
      placed.push({ key: p.key, row: r, col: p.col, isCarry: !!p.isCarry })
    })
  }
  return placed
}

// Top-level: try canonical first, then heuristic. compId is optional.
export function positionBoard(unitKeys, champByKey, carrySet, compId) {
  if (compId) {
    var canon = canonicalFor(compId)
    if (canon && Array.isArray(canon)) {
      // Filter canonical to units actually on the board, fall back for any missing.
      var canonKeys = new Set(canon.map(function (p) { return p.key }))
      var unitSet = new Set(unitKeys || [])
      var canonHits = canon.filter(function (p) { return unitSet.has(p.key) })
      var missing = (unitKeys || []).filter(function (k) { return !canonKeys.has(k) })
      if (missing.length === 0) return canonHits.map(function (p) {
        return { key: p.key, row: p.row, col: p.col, isCarry: !!p.isCarry || (carrySet && carrySet.has(p.key)) }
      })
      // Mix: keep canonical + heuristically place the missing ones in empty slots.
      var occupied = {}
      canonHits.forEach(function (p) { occupied[p.row + '_' + p.col] = true })
      var fills = heuristicLayout(missing, champByKey, carrySet)
      var safeFills = []
      fills.forEach(function (p) {
        var key = p.row + '_' + p.col
        if (occupied[key]) {
          // bump column outward
          for (var d = 1; d < COLS && occupied[p.row + '_' + ((p.col + d) % COLS)]; d++) {}
          var newCol = (p.col + 1) % COLS
          for (var k = 0; k < COLS; k++) {
            if (!occupied[p.row + '_' + k]) { newCol = k; break }
          }
          p.col = newCol
        }
        occupied[p.row + '_' + p.col] = true
        safeFills.push(p)
      })
      return canonHits.map(function (p) {
        return { key: p.key, row: p.row, col: p.col, isCarry: !!p.isCarry || (carrySet && carrySet.has(p.key)) }
      }).concat(safeFills)
    }
  }
  return heuristicLayout(unitKeys, champByKey, carrySet)
}

export var BOARD_ROWS = ROWS
export var BOARD_COLS = COLS
export var ROW_LABELS = ['Frontline', 'Skirmish', 'Midline', 'Backline']
