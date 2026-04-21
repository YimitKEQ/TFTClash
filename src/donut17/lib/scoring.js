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
    // Points: carry match = 5, board match = 3, early match = 2.5, flex match = 2.
    var boardSet = new Set(comp.board || [])
    var earlySet = new Set(comp.early || [])
    var flexSet = new Set(comp.flex || [])
    var carryKey = comp.carry
    var directHits = 0
    var traitHits = 0
    var hitUnits = []
    var i
    var keys = Array.from(picked)
    for (i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (k === carryKey) {
        directHits += 5
        hitUnits.push({ key: k, type: 'carry' })
      } else if (earlySet.has(k)) {
        directHits += 2.5
        hitUnits.push({ key: k, type: 'early' })
      } else if (boardSet.has(k)) {
        directHits += 3
        hitUnits.push({ key: k, type: 'board' })
      } else if (flexSet.has(k)) {
        directHits += 2
        hitUnits.push({ key: k, type: 'flex' })
      }
    }
    var compChamps = (comp.board || []).concat(comp.early || []).concat(comp.flex || [])
    var seen = {}
    for (i = 0; i < compChamps.length; i++) {
      if (seen[compChamps[i]]) continue
      seen[compChamps[i]] = 1
      var cc = champByKey[compChamps[i]]
      if (!cc || !cc.traits) continue
      var j
      for (j = 0; j < cc.traits.length; j++) {
        if (pickedTraits.has(cc.traits[j])) traitHits += 0.5
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
