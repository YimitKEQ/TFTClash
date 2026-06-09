import { CHAMPIONS, TRAITS } from './setData.js'

export var BOARD_SIZE = 28 // 4 rows x 7 cols
export var MAX_UNITS = 10

export var COST_COLORS = {
  1: '#9aa4b2',
  2: '#11b288',
  3: '#2c8fd6',
  4: '#b65ad6',
  5: '#e8a838',
}

// TFT trait tier styles -> colors. 1 bronze, 2 silver, 3 gold, 4/5 prismatic/unique.
export var STYLE_COLORS = {
  1: '#cd7f32',
  2: '#aab4c2',
  3: '#e8a838',
  4: '#86e8e0',
  5: '#86e8e0',
}

var TRAIT_BY_NAME = {}
TRAITS.forEach(function (t) { TRAIT_BY_NAME[t.name] = t })

export function emptyBoard() {
  var a = []
  var i = 0
  for (i = 0; i < BOARD_SIZE; i++) a.push(null)
  return a
}

export function unitCount(board) {
  return board.filter(Boolean).length
}

// Active + near traits, computed from placed units. Duplicate copies of the same
// champion count once toward a trait, matching real TFT behaviour.
export function computeTraits(board) {
  var unique = {}
  board.forEach(function (u) { if (u) unique[u.cidx] = true })
  var counts = {}
  Object.keys(unique).forEach(function (ci) {
    var champ = CHAMPIONS[ci]
    if (!champ) return
    champ.traits.forEach(function (tn) { counts[tn] = (counts[tn] || 0) + 1 })
  })

  var rows = Object.keys(counts).map(function (name) {
    var def = TRAIT_BY_NAME[name]
    var count = counts[name]
    var breaks = (def && def.breaks) || []
    var tier = null
    var nextMin = null
    var minBreak = breaks.length ? breaks[0].min : 99
    breaks.forEach(function (b) {
      if (count >= b.min) tier = b
      else if (nextMin === null) nextMin = b.min
    })
    return {
      name: name,
      slug: def ? def.slug : name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      count: count,
      active: count >= minBreak,
      style: tier ? tier.style : 0,
      nextMin: nextMin,
    }
  })

  rows.sort(function (a, b) {
    if (a.active !== b.active) return a.active ? -1 : 1
    if (a.style !== b.style) return b.style - a.style
    return b.count - a.count
  })
  return rows
}

// Compact, URL-safe board code. Each unit = hexIndex.champIndex.star in base36.
export function encodeBoard(board) {
  var parts = []
  board.forEach(function (u, i) {
    if (u) parts.push(i.toString(36) + '.' + u.cidx.toString(36) + '.' + u.star)
  })
  return parts.join('_')
}

export function decodeBoard(code) {
  var board = emptyBoard()
  if (!code) return board
  code.split('_').forEach(function (p) {
    var a = p.split('.')
    if (a.length < 2) return
    var i = parseInt(a[0], 36)
    var cidx = parseInt(a[1], 36)
    var star = parseInt(a[2], 10) || 1
    if (i >= 0 && i < BOARD_SIZE && CHAMPIONS[cidx]) {
      board[i] = { cidx: cidx, star: Math.min(3, Math.max(1, star)) }
    }
  })
  return board
}
