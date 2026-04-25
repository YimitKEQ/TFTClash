// Sponsor marketplace store - localStorage-backed pre-DB.
// Hosts list open sponsor slots. Sponsors register interest. Both surface
// in the public marketplace. Backed by localStorage with cross-tab sync.

var LISTINGS_KEY = 'tft-marketplace-listings-v1'
var INTERESTS_KEY = 'tft-marketplace-interests-v1'
var MAX_LISTINGS = 100
var MAX_INTERESTS = 500

function readJson(key) {
  if (typeof window === 'undefined') return []
  try {
    var raw = window.localStorage.getItem(key)
    if (!raw) return []
    var parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function writeJson(key, list, cap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(-cap)))
  } catch (e) {}
}

export function readListings() { return readJson(LISTINGS_KEY) }
export function readInterests() { return readJson(INTERESTS_KEY) }

export function createListing(input) {
  var list = readListings()
  var entry = {
    id: 'l-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    host: (input.host || 'Anonymous host').toString().slice(0, 60),
    title: (input.title || 'Open sponsor slot').toString().slice(0, 100),
    description: (input.description || '').toString().slice(0, 500),
    tier: input.tier || 'associate',
    budget: (input.budget || '').toString().slice(0, 40),
    region: (input.region || '').toString().slice(0, 20),
    deadline: (input.deadline || '').toString().slice(0, 20),
    contact: (input.contact || '').toString().slice(0, 100),
    audience: (input.audience || '').toString().slice(0, 200),
    createdAt: Date.now(),
    status: 'open',
  }
  var next = list.concat([entry])
  writeJson(LISTINGS_KEY, next, MAX_LISTINGS)
  return entry
}

export function deleteListing(id) {
  var next = readListings().filter(function (l) { return l.id !== id })
  writeJson(LISTINGS_KEY, next, MAX_LISTINGS)
  return next
}

export function closeListing(id) {
  var next = readListings().map(function (l) {
    if (l.id !== id) return l
    return Object.assign({}, l, { status: 'closed' })
  })
  writeJson(LISTINGS_KEY, next, MAX_LISTINGS)
  return next
}

export function expressInterest(input) {
  var list = readInterests()
  var entry = {
    id: 'i-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    listingId: input.listingId,
    sponsor: (input.sponsor || '').toString().slice(0, 60),
    contact: (input.contact || '').toString().slice(0, 100),
    note: (input.note || '').toString().slice(0, 300),
    createdAt: Date.now(),
  }
  var next = list.concat([entry])
  writeJson(INTERESTS_KEY, next, MAX_INTERESTS)
  return entry
}

export function interestsFor(listingId) {
  return readInterests().filter(function (i) { return i.listingId === listingId })
}

export var TIER_LABELS = {
  title: 'Title Partner',
  official: 'Official Sponsor',
  associate: 'Associate',
}

export var TIER_COLOR = {
  title: 'text-primary',
  official: 'text-secondary',
  associate: 'text-tertiary',
}
