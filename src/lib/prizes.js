// Prize shape helpers shared across admin, display, and claim flows.
//
// Prize object shape (all fields optional except placement):
//   {
//     placement: 1,               // required - tier position 1..8
//     prize: 'text label',        // display text (e.g. "€50", "RP code", "Pro tier")
//     type: 'cash'|'rp'|'code'|'physical'|'other'|undefined,
//     amount: 50,                 // numeric, used for auto-sum of cash
//     currency: 'EUR',            // ISO code for cash/crypto prizes
//     image: 'https://...',       // display image
//     sponsor_id: 'uuid',          // ref to sponsors table
//     eligibility: 'top4'|'all'|'europe'|string // optional cohort restriction
//   }

export var PRIZE_TYPES = [
  { key: 'cash', label: 'Cash', icon: 'payments' },
  { key: 'rp', label: 'RP', icon: 'stars' },
  { key: 'code', label: 'Code', icon: 'qr_code_2' },
  { key: 'physical', label: 'Physical', icon: 'inventory_2' },
  { key: 'other', label: 'Other', icon: 'card_giftcard' }
]

export var PRIZE_CURRENCIES = ['EUR', 'USD', 'GBP']

export var MEDAL_STYLES = {
  1: { tone: 'text-medal-gold bg-medal-gold/10 border-medal-gold/30', icon: 'workspace_premium', label: '1st' },
  2: { tone: 'text-medal-silver bg-medal-silver/10 border-medal-silver/30', icon: 'military_tech', label: '2nd' },
  3: { tone: 'text-medal-bronze bg-medal-bronze/10 border-medal-bronze/30', icon: 'workspace_premium', label: '3rd' },
  4: { tone: 'text-tertiary bg-tertiary/10 border-tertiary/25', icon: 'emoji_events', label: '4th' },
  5: { tone: 'text-secondary bg-secondary/10 border-secondary/25', icon: 'emoji_events', label: '5th' },
  6: { tone: 'text-primary bg-primary/10 border-primary/25', icon: 'emoji_events', label: '6th' },
  7: { tone: 'text-on-surface-variant bg-on-surface/5 border-outline-variant/25', icon: 'emoji_events', label: '7th' },
  8: { tone: 'text-on-surface-variant bg-on-surface/5 border-outline-variant/25', icon: 'emoji_events', label: '8th' }
}

export function medalForPlacement(place) {
  var p = parseInt(place, 10)
  if (!Number.isFinite(p)) p = 1
  return MEDAL_STYLES[p] || MEDAL_STYLES[8]
}

export function currencySymbol(code) {
  if (code === 'USD') return '$'
  if (code === 'GBP') return '£'
  return '€'
}

// Sum numeric cash prizes. Returns { total, currency } or null when no cash prizes.
export function computeCashPool(prizes) {
  if (!Array.isArray(prizes) || prizes.length === 0) return null
  var total = 0
  var currency = null
  var hasCash = false
  for (var i = 0; i < prizes.length; i++) {
    var p = prizes[i]
    if (!p) continue
    var isCash = p.type === 'cash'
    var amt = parseFloat(p.amount)
    if (isCash && Number.isFinite(amt) && amt > 0) {
      hasCash = true
      total += amt
      if (!currency) currency = p.currency || 'EUR'
    }
  }
  return hasCash ? { total: total, currency: currency || 'EUR' } : null
}

// Normalize a prize row for DB storage. Preserves only valid, present fields.
export function normalizePrizeRow(r) {
  var place = parseInt(r && r.placement, 10)
  var entry = { placement: Number.isFinite(place) && place > 0 ? place : 1 }
  if (r && r.prize != null) {
    var txt = String(r.prize).trim()
    if (txt) entry.prize = txt
  }
  if (r && r.image != null) {
    var img = String(r.image).trim()
    if (img) entry.image = img
  }
  if (r && r.type) {
    var t = String(r.type).trim()
    if (t) entry.type = t
  }
  if (r && r.amount != null && r.amount !== '') {
    var amt = parseFloat(r.amount)
    if (Number.isFinite(amt) && amt >= 0) entry.amount = amt
  }
  if (r && r.currency) {
    var cur = String(r.currency).trim().toUpperCase()
    if (cur) entry.currency = cur
  }
  if (r && r.sponsor_id) {
    var sid = String(r.sponsor_id).trim()
    if (sid) entry.sponsor_id = sid
  }
  if (r && r.eligibility) {
    var elig = String(r.eligibility).trim()
    if (elig) entry.eligibility = elig
  }
  return entry
}

// Format a prize for display. Falls back to raw text when structured fields absent.
export function formatPrizeLabel(prize) {
  if (!prize) return ''
  if (prize.type === 'cash' && Number.isFinite(parseFloat(prize.amount))) {
    return currencySymbol(prize.currency) + parseFloat(prize.amount).toLocaleString()
  }
  return prize.prize || ''
}
