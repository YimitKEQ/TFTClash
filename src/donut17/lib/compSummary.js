// Data-driven one-line summary per comp, built from our own structured data.
// We don't reproduce meta-site prose; we describe the comp in terms of its
// econ archetype, carry count, trait focus, and cost curve.

var ECON_HUMAN = {
  fast8: 'Fast 8 lineup',
  fast9: 'Fast 9 lineup',
  reroll1: '1-cost reroll',
  reroll2: '2-cost reroll',
  reroll3: '3-cost reroll',
}

export function buildCompSummary(comp, champions) {
  var byKey = {}
  champions.forEach(function (c) { byKey[c.key] = c })

  var board = comp.board || []
  var carries = comp.carries || (comp.carry ? [comp.carry] : [])
  var carryNames = carries
    .map(function (k) { return byKey[k] && byKey[k].name })
    .filter(Boolean)

  var parts = []

  if (comp.econ && ECON_HUMAN[comp.econ]) {
    parts.push(ECON_HUMAN[comp.econ])
  }

  if (carryNames.length === 1) {
    parts.push('carried by ' + carryNames[0])
  } else if (carryNames.length === 2) {
    parts.push('dual carry: ' + carryNames.join(' + '))
  } else if (carryNames.length >= 3) {
    parts.push(carryNames.length + ' carries (' + carryNames.slice(0, 2).join(', ') + ', ...)')
  }

  if (board.length > 0) {
    var costs = board
      .map(function (k) { return byKey[k] && byKey[k].cost })
      .filter(function (c) { return typeof c === 'number' })
    if (costs.length > 0) {
      var max = Math.max.apply(null, costs)
      if (max === 5) parts.push('5-cost capped')
      else if (max === 4) parts.push('4-cost capped')
    }
  }

  if (parts.length === 0) return ''
  // Capitalize first letter
  var out = parts.join(' · ')
  return out.charAt(0).toUpperCase() + out.slice(1) + '.'
}
