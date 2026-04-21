// Compute pivot suggestions: when looking at a comp, which other comps share
// enough overlap with the current board to be a viable pivot if you get
// contested or get an off-meta opener?
//
// Score = shared carries (weighted x3) + shared board units + shared traits.
// Returns top N comps with their score and the units / traits in common.

export function findPivots(comp, allComps, opts) {
  var max = (opts && opts.max) || 4
  var ownBoard = new Set(comp.board || [])
  var ownCarries = new Set(comp.carries || (comp.carry ? [comp.carry] : []))

  var scored = (allComps || []).filter(function (c) { return c.id !== comp.id }).map(function (c) {
    var board = c.board || []
    var carries = c.carries || (c.carry ? [c.carry] : [])
    var sharedUnits = []
    var sharedCarries = []
    board.forEach(function (k) {
      if (ownBoard.has(k)) sharedUnits.push(k)
    })
    carries.forEach(function (k) {
      if (ownCarries.has(k)) sharedCarries.push(k)
    })
    var score = sharedCarries.length * 3 + sharedUnits.length
    return {
      comp: c,
      score: score,
      sharedUnits: sharedUnits,
      sharedCarries: sharedCarries,
    }
  })

  scored.sort(function (a, b) { return b.score - a.score })
  return scored.filter(function (r) { return r.score >= 2 }).slice(0, max)
}

// Stage anchors: typical level + gold cushion at each beat. These are
// general TFT pacing facts (not authored prose), tweaked per econ archetype
// so reroll comps don't get the same level targets as fast 9 lineups.
export function stageBeats(econ) {
  if (econ === 'reroll1') {
    return [
      { stage: '2-1', level: 4, target: 'Survive opener, save 50' },
      { stage: '3-2', level: 6, target: 'Slow roll for 1-cost 3-stars' },
      { stage: '4-1', level: 6, target: 'Hit 3-star carry, level 7' },
      { stage: '5+',  level: 8, target: 'Cap with 4 / 5-cost frontline' },
    ]
  }
  if (econ === 'reroll2') {
    return [
      { stage: '2-1', level: 4, target: 'Survive opener, save 50' },
      { stage: '3-2', level: 6, target: 'Roll down for 2-cost 3-stars' },
      { stage: '4-1', level: 7, target: 'Stabilize with 3-cost flex' },
      { stage: '5+',  level: 8, target: 'Add 4-cost cap' },
    ]
  }
  if (econ === 'reroll3') {
    return [
      { stage: '2-1', level: 4, target: 'Win streak or lose streak hard' },
      { stage: '3-2', level: 6, target: 'Push level 7 next round' },
      { stage: '4-1', level: 7, target: 'Slow roll for 3-cost 3-stars' },
      { stage: '5+',  level: 8, target: 'Cap with 4-cost upgrade' },
    ]
  }
  if (econ === 'fast9') {
    return [
      { stage: '2-1', level: 4, target: 'Lose streak, save 50' },
      { stage: '3-2', level: 6, target: 'Hold gold, do not roll' },
      { stage: '4-2', level: 8, target: 'Push level 8, hold' },
      { stage: '5+',  level: 9, target: 'Roll level 9 for 5-cost carry' },
    ]
  }
  // default fast8
  return [
    { stage: '2-1', level: 4, target: 'Open with strongest board' },
    { stage: '3-2', level: 6, target: 'Hit econ thresholds' },
    { stage: '4-1', level: 7, target: 'Push level 8 if HP allows' },
    { stage: '5+',  level: 8, target: 'Roll level 8 for 4-cost carry' },
  ]
}
