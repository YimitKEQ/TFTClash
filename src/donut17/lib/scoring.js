// Opener Advisor scoring: rank comp_lines by unit + trait overlap with picked
// openers, then break ties by meta tier (S > A > B > C > X).
//
// Points:
//   core unit match = 3, flex unit match = 2, shared trait = 1 per (trait, champ)
//   tier bonus: S=+0.4, A=+0.2, B=+0.1, C=+0.05, X=0, unknown=+0.15

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
    var coreSet = new Set(comp.core || [])
    var flexSet = new Set(comp.flex || [])
    var directHits = 0
    var traitHits = 0
    var hitUnits = []
    var i
    var keys = Array.from(picked)
    for (i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (coreSet.has(k)) {
        directHits += 3
        hitUnits.push({ key: k, type: 'core' })
      } else if (flexSet.has(k)) {
        directHits += 2
        hitUnits.push({ key: k, type: 'flex' })
      }
    }
    var compChamps = (comp.core || []).concat(comp.flex || [])
    for (i = 0; i < compChamps.length; i++) {
      var cc = champByKey[compChamps[i]]
      if (!cc || !cc.traits) continue
      var j
      for (j = 0; j < cc.traits.length; j++) {
        if (pickedTraits.has(cc.traits[j])) traitHits += 1
      }
    }
    var overlap = directHits + traitHits
    var tierBonus = tierBonusFor(comp)
    // Tier only influences ranking once there is real overlap, so zero-match
    // comps don't surface above a weak match just because they're S-tier.
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
