// Heuristic board positioning.
//
// We do not have authored positioning data from any meta source -- tftflow's
// position arrays are hydrated client-side and we deliberately do not replicate
// authors' creative positioning choices. Instead we infer a defensible board
// layout from the factual champion stats in our own data: range, HP, and role
// (carry vs support). Players can drag units in the Team Planner if they
// disagree with the heuristic.
//
// Board convention: 4 rows x 7 columns (matches TFT's bottom-half board).
// Row 0 = frontline (closest to the enemy when rendered at the top of our
// display). Row 3 = backline. Odd rows are offset half a hex to the right
// for a honeycomb pattern.

function rangeOf(c) {
  return (c && c.stats && typeof c.stats.range === 'number') ? c.stats.range : 1
}
function hpOf(c) {
  return (c && c.stats && typeof c.stats.hp === 'number') ? c.stats.hp : 700
}

// Which row a unit belongs to, 0 (front) -> 3 (back).
export function chooseRow(c, isCarry) {
  if (!c) return 2
  var range = rangeOf(c)
  var hp = hpOf(c)

  // Backline carry: ranged AD or AP main damage.
  if (isCarry && range >= 3) return 3
  // Melee carry: bruiser with a kit that wants to be up front (think Jax, Rhaast, Aatrox).
  if (isCarry && range <= 2) return 1

  // Tanks: short range, high HP.
  if (range <= 1 && hp >= 850) return 0
  // Bruisers: short range, medium HP.
  if (range <= 1) return 1
  // Mid-range flex.
  if (range === 2) return 2
  // Long-range supports stay back.
  return 3
}

// Spread a list of units across 7 columns with carries centered.
// When a row has more units than columns, the overflow is pushed to
// the adjacent row (toward the back for supports, toward the front
// for tanks) so the board never drops units.
var COLS = 7
var ROWS = 4

export function positionBoard(unitKeys, champByKey, carrySet) {
  var buckets = { 0: [], 1: [], 2: [], 3: [] }

  ;(unitKeys || []).forEach(function (k) {
    var c = champByKey[k]
    var row = chooseRow(c, carrySet && carrySet.has(k))
    buckets[row].push({ key: k, isCarry: carrySet && carrySet.has(k) })
  })

  // Rebalance overflow.
  for (var i = 0; i < ROWS; i++) {
    while (buckets[i].length > COLS) {
      var overflow = buckets[i].pop()
      var target = i < ROWS - 1 ? i + 1 : i - 1
      buckets[target].push(overflow)
    }
  }

  var placed = []
  Object.keys(buckets).forEach(function (rk) {
    var row = Number(rk)
    var items = buckets[row]
    if (items.length === 0) return
    // Carries to center, supports to edges. Sort: carry flag desc, then stable.
    var carriesFirst = items.slice().sort(function (a, b) {
      if (a.isCarry !== b.isCarry) return a.isCarry ? -1 : 1
      return 0
    })
    // Build a centered order: middle out. carry[0] at center, carry[1] +1, support[0] -1, etc.
    var n = carriesFirst.length
    var startCol = Math.floor((COLS - n) / 2)
    var ordered = new Array(n)
    // Interleave carries to middle and supports to edges.
    var left = Math.floor((n - 1) / 2)
    var right = Math.ceil((n - 1) / 2)
    var lPtr = left
    var rPtr = left + 1
    // Place the first carry in the middle slot and alternate outward.
    ordered[left] = carriesFirst[0]
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
    ordered.forEach(function (u, i) {
      if (!u) return
      placed.push({ key: u.key, row: row, col: startCol + i, isCarry: !!u.isCarry })
    })
  })

  return placed
}

export var BOARD_ROWS = ROWS
export var BOARD_COLS = COLS
export var ROW_LABELS = ['Frontline', 'Skirmish', 'Midline', 'Backline']
