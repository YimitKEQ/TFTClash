import { useState } from 'react'
import { Icon } from '../ui'

var KEY_PREFIX = 'tft-ai-recap-v1:'
var CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

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

function sanitize(s) {
  return String(s == null ? '' : s).replace(/[<>"'`\\{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function buildPrompt(eventName, podium) {
  var safeName = sanitize(eventName) || 'Untitled'
  var first = sanitize(podium[0] && podium[0].name) || 'Unknown'
  var second = sanitize(podium[1] && podium[1].name) || ''
  var third = sanitize(podium[2] && podium[2].name) || ''
  var podiumStr = first + (second ? ', second ' + second : '') + (third ? ', third ' + third : '')
  return [
    'You are recapping a completed TFT Clash tournament called "' + safeName + '".',
    'Final podium: winner ' + podiumStr + '.',
    'Write a 2-3 sentence recap. Be punchy and entertaining. Mention the winner. Do not include disclaimers or instructions.',
  ].join(' ')
}

export default function AiMatchRecap(props) {
  var threadId = props.threadId || 'unknown'
  var eventName = props.eventName || ''
  var podium = props.podium || []

  var _cached = useState(function () { return readCached(threadId) })
  var cached = _cached[0]
  var setCached = _cached[1]

  var _loading = useState(false)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _err = useState('')
  var err = _err[0]
  var setErr = _err[1]

  function fetchRecap() {
    setErr('')
    setLoading(true)
    fetch('/api/ai-commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildPrompt(eventName, podium) }),
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
          setErr('No recap returned')
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
    fetchRecap()
  }

  return (
    <div className="rounded-2xl border border-success/20 bg-gradient-to-br from-success/10 to-transparent backdrop-blur p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="emoji_events" className="text-success" />
        <h3 className="font-display text-base tracking-wide">MATCH RECAP</h3>
        {cached && (
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="ml-auto text-xs text-on-surface-variant/40 hover:text-on-surface disabled:opacity-50"
            title="Regenerate"
          >
            <Icon name="refresh" size={14} />
          </button>
        )}
      </div>

      {!cached && !loading && (
        <button
          type="button"
          onClick={fetchRecap}
          disabled={!podium || podium.length === 0}
          className="w-full px-3 py-2.5 rounded-lg bg-success/15 text-success border border-success/30 text-sm font-label tracking-wider hover:bg-success/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(!podium || podium.length === 0) ? 'WAITING FOR RESULTS' : 'GENERATE RECAP'}
        </button>
      )}

      {loading && (
        <div className="text-sm text-on-surface-variant italic flex items-center gap-2">
          <Icon name="psychology" className="animate-pulse" /> Writing the recap...
        </div>
      )}

      {cached && cached.text && (
        <p className="text-sm text-on-surface leading-relaxed">{cached.text}</p>
      )}

      {err && <div className="text-xs text-error mt-2">{err}</div>}
    </div>
  )
}
