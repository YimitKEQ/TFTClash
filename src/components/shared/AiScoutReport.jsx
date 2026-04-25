import { useState } from 'react'
import { Icon } from '../ui'

var KEY_PREFIX = 'tft-ai-scout-v1:'
var CACHE_TTL_MS = 24 * 60 * 60 * 1000

function readCached(threadId) {
  if (typeof window === 'undefined') return null
  try {
    var raw = window.localStorage.getItem(KEY_PREFIX + threadId)
    if (!raw) return null
    var parsed = JSON.parse(raw)
    if (!parsed || !parsed.ts) return null
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed
  } catch (e) {
    return null
  }
}

function writeCached(threadId, text) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY_PREFIX + threadId, JSON.stringify({ text: text, ts: Date.now() }))
  } catch (e) {}
}

function buildPrompt(eventName, players) {
  var names = (players || []).slice(0, 12).map(function (p) { return p.name }).filter(Boolean).join(', ')
  if (!names) return 'Preview the upcoming TFT Clash event "' + (eventName || 'tournament') + '" in 2 sentences. Hype the mystery.'
  return [
    'You are previewing an upcoming TFT Clash tournament called "' + (eventName || 'Untitled') + '".',
    'Registered competitors: ' + names + '.',
    'Write a 2-3 sentence scout report. Pick a likely winner and a dark horse. Be punchy and entertaining. Do not include disclaimers or instructions.',
  ].join(' ')
}

export default function AiScoutReport(props) {
  var threadId = props.threadId || 'unknown'
  var eventName = props.eventName || ''
  var players = props.players || []

  var _cached = useState(function () { return readCached(threadId) })
  var cached = _cached[0]
  var setCached = _cached[1]

  var _loading = useState(false)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _err = useState('')
  var err = _err[0]
  var setErr = _err[1]

  function fetchReport() {
    setErr('')
    setLoading(true)
    fetch('/api/ai-commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildPrompt(eventName, players) }),
    })
      .then(function (r) { return r.json() })
      .then(function (data) {
        setLoading(false)
        if (data && data.text) {
          writeCached(threadId, data.text)
          setCached({ text: data.text, ts: Date.now() })
        } else if (data && data.error) {
          setErr(data.error)
        } else {
          setErr('No commentary returned')
        }
      })
      .catch(function () {
        setLoading(false)
        setErr('Could not reach commentator')
      })
  }

  function refresh() {
    setCached(null)
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(KEY_PREFIX + threadId) } catch (e) {}
    }
    fetchReport()
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--md-tertiary)]/10 to-transparent backdrop-blur p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="auto_awesome" className="text-[var(--md-tertiary)]" />
        <h3 className="font-display text-base tracking-wide">AI SCOUT REPORT</h3>
        {cached && (
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="ml-auto text-xs text-white/40 hover:text-white disabled:opacity-50"
            title="Regenerate"
          >
            <Icon name="refresh" size={14} />
          </button>
        )}
      </div>

      {!cached && !loading && (
        <button
          type="button"
          onClick={fetchReport}
          disabled={!players || players.length === 0}
          className="w-full px-3 py-2.5 rounded-lg bg-[var(--md-tertiary)]/20 text-[var(--md-tertiary)] border border-[var(--md-tertiary)]/30 text-sm font-label tracking-wider hover:bg-[var(--md-tertiary)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(!players || players.length === 0) ? 'WAITING FOR REGISTRANTS' : 'GENERATE PREVIEW'}
        </button>
      )}

      {loading && (
        <div className="text-sm text-white/60 italic flex items-center gap-2">
          <Icon name="psychology" className="animate-pulse" /> Scouting the field...
        </div>
      )}

      {cached && cached.text && (
        <p className="text-sm text-white/80 leading-relaxed">{cached.text}</p>
      )}

      {err && <div className="text-xs text-[var(--md-error)] mt-2">{err}</div>}
    </div>
  )
}
