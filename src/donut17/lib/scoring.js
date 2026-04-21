// Opener Advisor scoring: given a list of picked unit keys, rank comp_lines
// by overlap. Direct unit match = 3 pts, shared trait = 1 pt per (trait, champ).

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
    var compChamps = comp.core.concat(comp.flex || [])
    for (i = 0; i < compChamps.length; i++) {
      var cc = champByKey[compChamps[i]]
      if (!cc) continue
      if (!cc.traits) continue
      var j
      for (j = 0; j < cc.traits.length; j++) {
        if (pickedTraits.has(cc.traits[j])) traitHits += 1
      }
    }
    return {
      comp: comp,
      score: directHits + traitHits,
      directHits: directHits,
      traitHits: traitHits,
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
