// Opener Advisor scoring: rank tftflow comp_lines by unit + trait overlap with
// the player's picked shop units, then break ties by meta tier bonus.
//
// Points per picked unit:
//   carry match = 5   (unit appears in comp.carries[])
//   board match = 3   (unit appears in comp.board but is not a carry)
//   trait match = 0.5 per (comp-unit, shared-trait) pair
//
// Tier bonus (added when overlap > 0):
//   S=+0.4, A=+0.2, B=+0.1, C=+0.05, X=0, unknown=+0.15

var TIER_BONUS = { S: 0.4, A: 0.2, B: 0.1, C: 0.05, X: 0 }

function tierBonusFor(comp) {
  var t = comp && comp.tier
  if (!t) return 0.15
  var v = TIER_BONUS[String(t).toUpperCase()]
  return typeof v === 'number' ? v : 0.15
}

export function scoreComps(pickedKeys, champions, comps) {
  var picked = new Set(pickedKeys || [])
  var pickedTraits = new Set()
  var champByKey = {}
  champions.forEach(function (c) { champByKey[c.key] = c })
  picked.forEach(function (k) {
    var c = champByKey[k]
    if (c && c.traits) c.traits.forEach(function (t) { pickedTraits.add(t) })
  })

  var results = comps.map(function (comp) {
    var carries = new Set(comp.carries || (comp.carry ? [comp.carry] : []))
    var boardSet = new Set(comp.board || [])
    var directHits = 0
    var traitHits = 0
    var hitUnits = []
    var keys = Array.from(picked)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (carries.has(k)) {
        directHits += 5
        hitUnits.push({ key: k, type: 'carry' })
      } else if (boardSet.has(k)) {
        directHits += 3
        hitUnits.push({ key: k, type: 'board' })
      }
    }
    var seen = {}
    var compChamps = comp.board || []
    for (var j = 0; j < compChamps.length; j++) {
      var ck = compChamps[j]
      if (seen[ck]) continue
      seen[ck] = 1
      var cc = champByKey[ck]
      if (!cc || !cc.traits) continue
      for (var t = 0; t < cc.traits.length; t++) {
        if (pickedTraits.has(cc.traits[t])) traitHits += 0.5
      }
    }
    var overlap = directHits + traitHits
    var tierBonus = tierBonusFor(comp)
    var score = overlap + (overlap > 0 ? tierBonus : 0)
    return {
      comp: comp,
      score: Math.round(score * 10) / 10,
      directHits: directHits,
      traitHits: traitHits,
      tierBonus: tierBonus,
      hitUnits: hitUnits,
    }
  })

  results.sort(function (a, b) { return b.score - a.score })
  return results
}

export function pickableUnits(champions, costFilter) {
  if (!costFilter || costFilter === 'all') return champions
  return champions.filter(function (c) { return c.cost === costFilter })
}
