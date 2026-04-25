import { useEffect, useState } from 'react'
import { Btn, Icon, Inp } from '../ui'

// Per-tournament chat board. Persisted to localStorage so the feature works
// without auth + without server-side moderation. Capped to 100 messages per
// thread to avoid runaway growth. Display name is auto-derived from
// currentUser if available, else 'Guest-XXXX' (random per-browser handle).
//
// Props:
//   threadId: any string (tournamentId, clashId, etc.)
//   currentUser: { username?, id? } — optional
//   max: max messages to keep (default 100)

var KEY_PREFIX = 'tft-thread-v1:'
var GUEST_KEY = 'tft-thread-guest-handle-v1'

function getGuestHandle() {
  try {
    var h = localStorage.getItem(GUEST_KEY)
    if (h) return h
    h = 'Guest-' + Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    localStorage.setItem(GUEST_KEY, h)
    return h
  } catch (e) { return 'Guest' }
}

function readThread(id) {
  try {
    var raw = localStorage.getItem(KEY_PREFIX + id)
    if (!raw) return []
    var arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch (e) { return [] }
}

function writeThread(id, msgs) {
  try { localStorage.setItem(KEY_PREFIX + id, JSON.stringify(msgs)) } catch (e) {}
}

function formatTime(ts) {
  var d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MatchThread(props) {
  var threadId = props.threadId
  var max = props.max || 100
  var currentUser = props.currentUser

  var _msgs = useState(function () { return readThread(threadId) })
  var msgs = _msgs[0]; var setMsgs = _msgs[1]

  var _draft = useState('')
  var draft = _draft[0]; var setDraft = _draft[1]

  useEffect(function () { setMsgs(readThread(threadId)) }, [threadId])

  // Cross-tab sync: refresh when localStorage changes elsewhere
  useEffect(function () {
    function onStorage(e) {
      if (e.key === KEY_PREFIX + threadId) setMsgs(readThread(threadId))
    }
    window.addEventListener('storage', onStorage)
    return function () { window.removeEventListener('storage', onStorage) }
  }, [threadId])

  function send() {
    var txt = draft.trim()
    if (!txt) return
    if (txt.length > 280) txt = txt.slice(0, 280)
    var who = (currentUser && currentUser.username) || getGuestHandle()
    var entry = { id: 'm-' + Date.now() + '-' + Math.floor(Math.random() * 1e6), who: who, text: txt, ts: Date.now() }
    var next = msgs.concat([entry]).slice(-max)
    setMsgs(next)
    writeThread(threadId, next)
    setDraft('')
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!threadId) return null

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-xl flex flex-col" style={{ minHeight: 320 }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-outline-variant/10 bg-surface-container">
        <Icon name="forum" size={16} className="text-secondary" />
        <span className="font-label uppercase text-xs tracking-widest text-on-surface">Match thread</span>
        <span className="font-mono text-[10px] text-on-surface-variant/40 ml-auto">{msgs.length}/{max}</span>
      </div>

      <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 380 }}>
        {msgs.length === 0 && (
          <div className="text-center py-6">
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/40">Be the first to post</span>
          </div>
        )}
        {msgs.map(function (m) {
          return (
            <div key={m.id} className="flex items-start gap-2">
              <span className="font-mono text-[10px] text-on-surface-variant/40 w-12 flex-shrink-0 pt-0.5">{formatTime(m.ts)}</span>
              <span className="font-bold text-xs text-secondary flex-shrink-0">{m.who}</span>
              <span className="text-sm text-on-surface break-words flex-1">{m.text}</span>
            </div>
          )
        })}
      </div>

      <div className="px-3 py-2 border-t border-outline-variant/10 flex gap-2">
        <Inp
          value={draft}
          onChange={function (e) { setDraft(e.target.value.slice(0, 280)) }}
          onKeyDown={onKey}
          placeholder={'Say something' + ((currentUser && currentUser.username) ? ' as ' + currentUser.username : '')}
          className="flex-1"
        />
        <Btn onClick={send} disabled={!draft.trim()} icon="send">Post</Btn>
      </div>
    </div>
  )
}
