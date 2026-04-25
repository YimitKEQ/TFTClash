// Public roadmap with localStorage voting + idea submission.
// User-submitted ideas are stored separately so the seeded list can evolve
// across deploys without being shadowed by the user's first-visit snapshot.

var USER_IDEAS_KEY = 'tft-roadmap-user-ideas-v2'
var VOTES_KEY = 'tft-roadmap-my-votes-v1'
var SEED_VOTE_DELTAS_KEY = 'tft-roadmap-seed-deltas-v2'
var MAX_IDEAS = 200

export var DEFAULT_ROADMAP = [
  { id: 'r-shipping-riot-api', title: 'Riot API auto-scoring', body: 'Pull placements directly from Riot match data — no more manual entry.', status: 'shipping', votes: 47 },
  { id: 'r-shipping-custom-domain', title: 'Custom host domains', body: 'Run tournaments under events.<yourbrand>.com to white-label the experience.', status: 'shipping', votes: 38 },
  { id: 'r-planned-multi-host', title: 'Multi-host events', body: 'Co-host tournaments with revenue split between two organizers.', status: 'planned', votes: 29 },
  { id: 'r-planned-tournament-series', title: 'Tournament series (8-week leagues)', body: 'Cumulative standings across multi-week leagues with a season finale.', status: 'planned', votes: 24 },
  { id: 'r-planned-vod-gallery', title: 'VOD gallery with player tagging', body: 'Embedded VODs from past tournaments, taggable per player + per round.', status: 'planned', votes: 18 },
  { id: 'r-planned-discord-widget', title: 'Discord countdown widget', body: 'Embed live tournament countdowns into your Discord server.', status: 'planned', votes: 15 },
  { id: 'r-considering-public-api', title: 'Public read-only API', body: 'Expose tournaments + leaderboards so third parties can build on top.', status: 'considering', votes: 11 },
  { id: 'r-shipped-share-cards', title: 'Auto-generated share cards', body: 'Every player + every podium gets a 1200x630 SVG share card.', status: 'shipped', votes: 22 },
  { id: 'r-shipped-obs-overlay', title: 'OBS overlay browser source', body: 'Transparent live overlay with phase, round, and lobby placements.', status: 'shipped', votes: 19 },
  { id: 'r-shipped-match-thread', title: 'Per-tournament match threads', body: 'Live chat boards for spectators + players, cross-tab synced.', status: 'shipped', votes: 14 },
]

export var STATUS_LABELS = {
  shipping: 'Shipping now',
  planned: 'Planned',
  considering: 'Considering',
  shipped: 'Shipped',
}

export var STATUS_COLORS = {
  shipping: 'text-tertiary',
  planned: 'text-primary',
  considering: 'text-on-surface-variant',
  shipped: 'text-success',
}

export var STATUS_ORDER = ['shipping', 'planned', 'considering', 'shipped']

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    var raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

function writeJson(key, val) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, JSON.stringify(val)) } catch (e) {}
}

function readUserIdeas() {
  var stored = readJson(USER_IDEAS_KEY, null)
  return Array.isArray(stored) ? stored : []
}

function readSeedDeltas() {
  var stored = readJson(SEED_VOTE_DELTAS_KEY, {})
  return stored && typeof stored === 'object' ? stored : {}
}

export function readIdeas() {
  var seeded = DEFAULT_ROADMAP.map(function (idea) { return Object.assign({}, idea) })
  var deltas = readSeedDeltas()
  for (var i = 0; i < seeded.length; i++) {
    var d = deltas[seeded[i].id]
    if (typeof d === 'number') {
      seeded[i] = Object.assign({}, seeded[i], { votes: Math.max(0, (seeded[i].votes || 0) + d) })
    }
  }
  return seeded.concat(readUserIdeas())
}

export function writeIdeas() {
  // No-op: kept for backward compatibility. Ideas are split into seeded (read from
  // DEFAULT_ROADMAP + delta map) and user-submitted (USER_IDEAS_KEY).
}

export function readMyVotes() {
  var stored = readJson(VOTES_KEY, {})
  return stored && typeof stored === 'object' ? stored : {}
}

function isSeed(ideaId) {
  for (var i = 0; i < DEFAULT_ROADMAP.length; i++) {
    if (DEFAULT_ROADMAP[i].id === ideaId) return true
  }
  return false
}

export function toggleVote(ideaId) {
  var myVotes = readMyVotes()
  var hadVote = !!myVotes[ideaId]
  var delta = hadVote ? -1 : 1

  if (isSeed(ideaId)) {
    var deltas = readSeedDeltas()
    var nextDeltas = Object.assign({}, deltas)
    nextDeltas[ideaId] = (deltas[ideaId] || 0) + delta
    writeJson(SEED_VOTE_DELTAS_KEY, nextDeltas)
  } else {
    var userIdeas = readUserIdeas()
    var nextUserIdeas = userIdeas.map(function (idea) {
      if (idea.id !== ideaId) return idea
      return Object.assign({}, idea, { votes: Math.max(0, (idea.votes || 0) + delta) })
    })
    writeJson(USER_IDEAS_KEY, nextUserIdeas.slice(-MAX_IDEAS))
  }

  var nextVotes = Object.assign({}, myVotes)
  if (hadVote) {
    delete nextVotes[ideaId]
  } else {
    nextVotes[ideaId] = Date.now()
  }
  writeJson(VOTES_KEY, nextVotes)
  return { ideas: readIdeas(), myVotes: nextVotes }
}

export function submitIdea(input) {
  var entry = {
    id: 'r-user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    title: (input.title || 'Untitled').toString().slice(0, 100),
    body: (input.body || '').toString().slice(0, 500),
    status: 'considering',
    votes: 1,
    submittedBy: (input.submittedBy || 'anonymous').toString().slice(0, 40),
    createdAt: Date.now(),
  }
  var userIdeas = readUserIdeas()
  var nextUserIdeas = userIdeas.concat([entry])
  writeJson(USER_IDEAS_KEY, nextUserIdeas.slice(-MAX_IDEAS))

  var myVotes = readMyVotes()
  var nextVotes = Object.assign({}, myVotes)
  nextVotes[entry.id] = Date.now()
  writeJson(VOTES_KEY, nextVotes)
  return { idea: entry, ideas: readIdeas(), myVotes: nextVotes }
}
