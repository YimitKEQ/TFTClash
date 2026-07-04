// Riftbound card database access. The dataset lives in /riftbound/cards.json
// (public folder, ~295KB), sourced from the community riftcodex API with card
// images served from Riot's official CDN. Loaded lazily on first use and
// cached for the session.

var _cache = null
var _pending = null

export function loadCards() {
  if (_cache) return Promise.resolve(_cache)
  if (_pending) return _pending
  _pending = fetch('/riftbound/cards.json')
    .then(function(res) {
      if (!res.ok) throw new Error('cards.json ' + res.status)
      return res.json()
    })
    .then(function(data) {
      _cache = Array.isArray(data) ? data : []
      _pending = null
      return _cache
    })
    .catch(function(err) {
      _pending = null
      console.error('[riftbound] card db load failed:', err && err.message)
      return []
    })
  return _pending
}

// Thumbnail via Riot CDN on-the-fly resize (~20KB webp instead of ~800KB png).
export function thumbUrl(card, width) {
  if (!card || !card.img) return ''
  var w = width || 320
  return card.img + '&w=' + w + '&fm=webp&q=80'
}

export function fullUrl(card) {
  if (!card || !card.img) return ''
  return card.img + '&w=744&fm=webp&q=90'
}

export function findByName(cards, name) {
  if (!name) return null
  var q = String(name).toLowerCase()
  var exact = cards.find(function(c) { return c.n.toLowerCase() === q })
  if (exact) return exact
  return cards.find(function(c) { return c.n.toLowerCase().indexOf(q) !== -1 }) || null
}

// Match an admin tier-list entry name like "Master Yi, Wuju Bladesman" to a
// Legend card named like "Master Yi - Wuju Bladesman". Falls back to matching
// on the champion name alone.
export function findLegendCard(cards, entryName) {
  if (!entryName) return null
  var norm = String(entryName).toLowerCase().replace(/[,-]/g, ' ').replace(/\s+/g, ' ').trim()
  var legends = cards.filter(function(c) { return c.t === 'Legend' })
  var hit = legends.find(function(c) {
    var cn = c.n.toLowerCase().replace(/[,-]/g, ' ').replace(/\s+/g, ' ').trim()
    return cn === norm
  })
  if (hit) return hit
  var champ = norm.split(' ').slice(0, 2).join(' ')
  hit = legends.find(function(c) { return c.n.toLowerCase().indexOf(champ) === 0 })
  if (hit) return hit
  var first = norm.split(' ')[0]
  return legends.find(function(c) { return c.n.toLowerCase().indexOf(first) === 0 }) || null
}

// Find a good example card whose rules text mentions a keyword, preferring
// low-cost commons/uncommons (simpler examples for a learn page).
export function exampleForKeyword(cards, keyword) {
  var tag = '[' + keyword + ']'
  var matches = cards.filter(function(c) { return (c.x || '').indexOf(tag) !== -1 })
  if (matches.length === 0) {
    matches = cards.filter(function(c) { return (c.x || '').indexOf(keyword) !== -1 })
  }
  matches.sort(function(a, b) {
    var ra = a.r === 'Common' ? 0 : a.r === 'Uncommon' ? 1 : 2
    var rb = b.r === 'Common' ? 0 : b.r === 'Uncommon' ? 1 : 2
    if (ra !== rb) return ra - rb
    return (a.e || 0) - (b.e || 0)
  })
  return matches[0] || null
}

export var DOMAIN_META = {
  Fury:  { color: '#E5484D' },
  Calm:  { color: '#2FB380' },
  Mind:  { color: '#3B82F6' },
  Body:  { color: '#F2994A' },
  Chaos: { color: '#9B59B6' },
  Order: { color: '#E8C93B' },
  Colorless: { color: '#8B8B96' },
}

export function domainColor(name) {
  var meta = DOMAIN_META[name]
  return meta ? meta.color : '#8B8B96'
}

export var SET_NAMES = {
  OGN: 'Origins',
  OGS: 'Origins: Proving Grounds',
  OPP: 'Origins Promos',
  PR:  'Promo',
  SFD: 'Spiritforged',
  UNL: 'Unleashed',
}

export function setName(code) {
  return SET_NAMES[code] || code
}
