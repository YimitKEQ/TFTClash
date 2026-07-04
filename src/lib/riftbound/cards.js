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

// Real print dimensions parsed from the CDN URL. Battlefields are landscape
// cards (1039x744); everything else is portrait (744x1039). Rendering each
// card in its true format matters: a battlefield squeezed into a portrait
// frame looks broken.
export function cardDims(card) {
  var m = card && card.img ? card.img.match(/-(\d+)x(\d+)\.png/) : null
  var w = m ? parseInt(m[1]) : 744
  var h = m ? parseInt(m[2]) : 1039
  return { w: w, h: h, landscape: w > h }
}

// Thumbnail via Riot CDN on-the-fly resize (~20KB webp instead of ~800KB png).
// Most image URLs have NO query string (only ~20% carry ?accountingTag=RB), so
// the first param separator must be chosen per URL - appending '&' to a bare
// URL makes the CDN return HTTP 400.
function withParams(url, params) {
  return url + (url.indexOf('?') === -1 ? '?' : '&') + params
}

export function thumbUrl(card, width) {
  if (!card || !card.img) return ''
  var w = width || 320
  return withParams(card.img, 'w=' + w + '&fm=webp&q=80')
}

export function fullUrl(card) {
  if (!card || !card.img) return ''
  var dims = cardDims(card)
  return withParams(card.img, 'w=' + (dims.landscape ? 1039 : 744) + '&fm=webp&q=90')
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

// Official Riot glyph assets (assetcdn.rgpub.io, the same CDN the official
// site uses). Self-contained circular SVG badges, verified live 2026-07-04.
// Components fall back to colored dots when an entry is missing.
var GLYPH_BASE = 'https://assetcdn.rgpub.io/public/live/riot-shared/player-experiences/riot-glyphs/rb/latest/'

export var DOMAIN_ICONS = {
  Fury:  GLYPH_BASE + 'rune_fury.svg',
  Calm:  GLYPH_BASE + 'rune_calm.svg',
  Mind:  GLYPH_BASE + 'rune_mind.svg',
  Body:  GLYPH_BASE + 'rune_body.svg',
  Chaos: GLYPH_BASE + 'rune_chaos.svg',
  Order: GLYPH_BASE + 'rune_order.svg',
  Colorless: GLYPH_BASE + 'rune_rainbow.svg',
}

export function domainIconUrl(name) {
  return DOMAIN_ICONS[name] || ''
}

export var TYPE_ICONS = {
  Unit:        GLYPH_BASE + 'card_type_unit.svg',
  Spell:       GLYPH_BASE + 'card_type_spell.svg',
  Gear:        GLYPH_BASE + 'card_type_gear.svg',
  Battlefield: GLYPH_BASE + 'card_type_battlefield.svg',
  Legend:      GLYPH_BASE + 'card_type_legend.svg',
  Rune:        GLYPH_BASE + 'card_type_rune.svg',
}

export var MIGHT_ICON = GLYPH_BASE + 'might.svg'
export var EXHAUST_ICON = GLYPH_BASE + 'exhaust.svg'

// Official energy-cost badge (dark circle + numeral), available 0 through 12.
export function energyIconUrl(n) {
  if (n == null || n < 0 || n > 12) return ''
  return GLYPH_BASE + 'energy_' + n + '.svg'
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
