// Tournament template store - localStorage-backed.
// Hosts save tournament configs once, spin up future events from a saved template.

var KEY = 'tft-tournament-templates-v1'
var MAX_TEMPLATES = 25

export function readTemplates() {
  if (typeof window === 'undefined') return []
  try {
    var raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    var parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export function writeTemplates(list) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_TEMPLATES)))
  } catch (e) {}
}

export function saveTemplate(template) {
  var list = readTemplates()
  var name = (template.name || 'Unnamed').toString().slice(0, 80)
  var id = 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
  var entry = {
    id: id,
    name: name,
    format: template.format || 'Standard',
    rounds: template.rounds || 4,
    size: template.size || 8,
    region: template.region || '',
    description: (template.description || '').toString().slice(0, 500),
    rulesText: (template.rulesText || '').toString().slice(0, 2000),
    prizePool: Array.isArray(template.prizePool) ? template.prizePool.slice(0, 8) : [],
    tags: Array.isArray(template.tags) ? template.tags.slice(0, 12) : [],
    createdAt: Date.now(),
  }
  var next = list.concat([entry])
  writeTemplates(next)
  return entry
}

export function deleteTemplate(id) {
  var list = readTemplates().filter(function (t) { return t.id !== id })
  writeTemplates(list)
  return list
}

export function applyTemplate(template, overrides) {
  var o = overrides || {}
  return {
    name: o.name || template.name,
    format: template.format,
    rounds: template.rounds,
    size: template.size,
    region: o.region || template.region,
    description: template.description,
    rulesText: template.rulesText,
    prizePool: template.prizePool,
    tags: template.tags,
    date: o.date || '',
  }
}
