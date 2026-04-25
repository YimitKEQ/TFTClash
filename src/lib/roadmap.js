// Public roadmap with localStorage voting + idea submission.

var IDEAS_KEY = 'tft-roadmap-ideas-v1'
var VOTES_KEY = 'tft-roadmap-my-votes-v1'
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

export function readIdeas() {
  var stored = readJson(IDEAS_KEY, null)
  if (!stored || !Array.isArray(stored)) {
    writeJson(IDEAS_KEY, DEFAULT_ROADMAP)
    return DEFAULT_ROADMAP.slice()
  }
  return stored
}

export function writeIdeas(list) {
  writeJson(IDEAS_KEY, list.slice(-MAX_IDEAS))
}

export function readMyVotes() {
  var stored = readJson(VOTES_KEY, {})
  return stored && typeof stored === 'object' ? stored : {}
}

export function toggleVote(ideaId) {
  var ideas = readIdeas()
  var myVotes = readMyVotes()
  var hadVote = !!myVotes[ideaId]
  var updated = ideas.map(function (idea) {
    if (idea.id !== ideaId) return idea
    var delta = hadVote ? -1 : 1
    return Object.assign({}, idea, { votes: Math.max(0, (idea.votes || 0) + delta) })
  })
  writeIdeas(updated)
  if (hadVote) {
    delete myVotes[ideaId]
  } else {
    myVotes[ideaId] = Date.now()
  }
  writeJson(VOTES_KEY, myVotes)
  return { ideas: updated, myVotes: myVotes }
}

export function submitIdea(input) {
  var ideas = readIdeas()
  var entry = {
    id: 'r-user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    title: (input.title || 'Untitled').toString().slice(0, 100),
    body: (input.body || '').toString().slice(0, 500),
    status: 'considering',
    votes: 1,
    submittedBy: (input.submittedBy || 'anonymous').toString().slice(0, 40),
    createdAt: Date.now(),
  }
  var updated = ideas.concat([entry])
  writeIdeas(updated)
  var myVotes = readMyVotes()
  myVotes[entry.id] = Date.now()
  writeJson(VOTES_KEY, myVotes)
  return { idea: entry, ideas: updated, myVotes: myVotes }
}
