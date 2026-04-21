// Given a comp board (array of champion keys), compute active traits with
// their count and active breakpoint tier (bronze/silver/gold/prismatic).

export function computeActiveTraits(boardKeys, champions, traits) {
  var champByKey = {}
  champions.forEach(function (c) { champByKey[c.key] = c })
  var traitByApi = {}
  traits.forEach(function (t) { traitByApi[t.apiName] = t })

  // Count unique champions contributing to each trait apiName.
  var counts = {}
  var seenByTrait = {}
  ;(boardKeys || []).forEach(function (k) {
    var ch = champByKey[k]
    if (!ch || !ch.traits) return
    ch.traits.forEach(function (tApi) {
      if (!seenByTrait[tApi]) seenByTrait[tApi] = new Set()
      if (seenByTrait[tApi].has(k)) return
      seenByTrait[tApi].add(k)
      counts[tApi] = (counts[tApi] || 0) + 1
    })
  })

  var active = []
  Object.keys(counts).forEach(function (api) {
    var t = traitByApi[api]
    if (!t) return
    var breaks = (t.effects || []).map(function (e) { return e.minUnits }).filter(function (n) { return typeof n === 'number' && n > 0 })
    if (breaks.length === 0) return
    var count = counts[api]
    var hitBreaks = breaks.filter(function (b) { return count >= b })
    if (hitBreaks.length === 0) return
    var topBreak = Math.max.apply(null, hitBreaks)
    var tierIndex = hitBreaks.length - 1 // 0=first, 1=second, ...
    var tier = ['bronze', 'silver', 'gold', 'prismatic'][Math.min(tierIndex, 3)]
    active.push({
      apiName: api,
      name: t.name,
      icon: t.icon,
      count: count,
      breakpoint: topBreak,
      maxBreakpoint: Math.max.apply(null, breaks),
      tier: tier,
      isUnique: breaks.length === 1 && breaks[0] === 1
    })
  })

  // Sort: prismatic first, then gold, silver, bronze. Then by count descending.
  var order = { prismatic: 4, gold: 3, silver: 2, bronze: 1 }
  active.sort(function (a, b) {
    if (order[b.tier] !== order[a.tier]) return order[b.tier] - order[a.tier]
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })
  return active
}

export function tierColor(tier) {
  if (tier === 'prismatic') return '#e4e1ec'
  if (tier === 'gold') return '#FFC66B'
  if (tier === 'silver') return '#b8c1d1'
  if (tier === 'bronze') return '#c87a4b'
  return '#6b6673'
}
