import { useState, useEffect } from 'react'
import { Icon } from '../ui'

var KEY_PREFIX = 'tft-vods-v1:'
var MAX_VODS = 20
var MAX_LABEL = 160

function readVods(threadId) {
  if (typeof window === 'undefined') return []
  try {
    var raw = window.localStorage.getItem(KEY_PREFIX + threadId)
    if (!raw) return []
    var parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function writeVods(threadId, list) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY_PREFIX + threadId, JSON.stringify(list.slice(-MAX_VODS)))
  } catch (e) {}
}

function detectPlatform(url) {
  var u = String(url || '').toLowerCase()
  if (u.indexOf('youtu.be') >= 0 || u.indexOf('youtube.com') >= 0) return 'youtube'
  if (u.indexOf('twitch.tv') >= 0) return 'twitch'
  return 'other'
}

function youtubeId(url) {
  try {
    var m1 = String(url).match(/[?&]v=([A-Za-z0-9_\-]{6,})/)
    if (m1) return m1[1]
    var m2 = String(url).match(/youtu\.be\/([A-Za-z0-9_\-]{6,})/)
    if (m2) return m2[1]
    var m3 = String(url).match(/youtube\.com\/(?:embed|live|shorts)\/([A-Za-z0-9_\-]{6,})/)
    if (m3) return m3[1]
  } catch (e) {}
  return ''
}

function twitchVodId(url) {
  try {
    var m1 = String(url).match(/twitch\.tv\/videos\/(\d+)/)
    if (m1) return m1[1]
  } catch (e) {}
  return ''
}

function isValidUrl(u) {
  try {
    var parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch (e) {
    return false
  }
}

export default function VodGallery(props) {
  var threadId = props.threadId || 'unknown'
  var currentUser = props.currentUser
  var registeredIds = props.registeredIds || []
  var hostId = props.hostId

  var _vods = useState(function () { return readVods(threadId) })
  var vods = _vods[0]
  var setVods = _vods[1]

  var _url = useState('')
  var url = _url[0]
  var setUrl = _url[1]

  var _label = useState('')
  var label = _label[0]
  var setLabel = _label[1]

  var _err = useState('')
  var err = _err[0]
  var setErr = _err[1]

  useEffect(function () {
    function onStorage(e) {
      if (e.key === KEY_PREFIX + threadId) {
        setVods(readVods(threadId))
      }
    }
    window.addEventListener('storage', onStorage)
    return function () { window.removeEventListener('storage', onStorage) }
  }, [threadId])

  var canAdd = false
  if (currentUser && currentUser.id) {
    if (hostId && currentUser.id === hostId) canAdd = true
    if (registeredIds.indexOf(currentUser.id) >= 0) canAdd = true
  }

  function addVod() {
    setErr('')
    var trimmedUrl = String(url || '').trim()
    var trimmedLabel = String(label || '').trim()
    if (!trimmedUrl) { setErr('Paste a VOD URL'); return }
    if (!isValidUrl(trimmedUrl)) { setErr('That URL looks invalid'); return }
    if (!trimmedLabel) { setErr('Add a short label'); return }
    if (trimmedLabel.length > MAX_LABEL) { setErr('Label too long'); return }
    if (vods.length >= MAX_VODS) { setErr('VOD limit reached'); return }

    var entry = {
      id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: trimmedUrl,
      label: trimmedLabel.slice(0, MAX_LABEL),
      platform: detectPlatform(trimmedUrl),
      addedBy: currentUser && currentUser.name ? currentUser.name : 'Anon',
      addedById: currentUser && currentUser.id ? currentUser.id : '',
      ts: Date.now(),
    }
    var next = [].concat(vods, [entry])
    writeVods(threadId, next)
    setVods(next)
    setUrl('')
    setLabel('')
  }

  function deleteVod(id) {
    var next = vods.filter(function (v) { return v.id !== id })
    writeVods(threadId, next)
    setVods(next)
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="play_circle" className="text-[var(--md-tertiary)]" />
        <h3 className="font-display text-base tracking-wide">VOD GALLERY</h3>
        <span className="text-xs text-white/50 ml-auto">{vods.length}/{MAX_VODS}</span>
      </div>

      {canAdd && (
        <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
          <input
            type="text"
            placeholder="https://youtu.be/... or https://twitch.tv/videos/..."
            value={url}
            onChange={function (e) { setUrl(e.target.value) }}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:border-white/30"
          />
          <input
            type="text"
            placeholder="Round 4 final lobby (Levitate POV)"
            value={label}
            onChange={function (e) { setLabel(e.target.value) }}
            maxLength={MAX_LABEL}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:border-white/30"
          />
          {err && <div className="text-xs text-[var(--md-error)]">{err}</div>}
          <button
            type="button"
            onClick={addVod}
            className="w-full px-3 py-2 rounded-lg bg-[var(--md-tertiary)]/20 text-[var(--md-tertiary)] border border-[var(--md-tertiary)]/30 text-sm font-label tracking-wider hover:bg-[var(--md-tertiary)]/30"
          >
            ADD VOD
          </button>
        </div>
      )}

      {!canAdd && currentUser && (
        <div className="text-xs text-white/50 mb-3">Only the host or registered players can post VODs.</div>
      )}
      {!currentUser && (
        <div className="text-xs text-white/50 mb-3">Sign in to contribute VODs.</div>
      )}

      {vods.length === 0 ? (
        <div className="text-sm text-white/40 py-4 text-center">No VODs yet. Be the first.</div>
      ) : (
        <ul className="space-y-3">
          {vods.slice().reverse().map(function (v) {
            var ownsEntry = v.addedById ? currentUser && currentUser.id === v.addedById : currentUser && currentUser.name === v.addedBy
            var canDelete = currentUser && currentUser.id && (ownsEntry || (hostId && currentUser.id === hostId))
            var ytId = v.platform === 'youtube' ? youtubeId(v.url) : ''
            var twId = v.platform === 'twitch' ? twitchVodId(v.url) : ''
            return (
              <li key={v.id} className="rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                {ytId && (
                  <a href={v.url} target="_blank" rel="noreferrer" className="block aspect-video bg-black relative group">
                    <img
                      src={'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg'}
                      alt={v.label}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon name="play_circle" className="text-white text-5xl drop-shadow-lg" />
                    </div>
                  </a>
                )}
                {twId && (
                  <a href={v.url} target="_blank" rel="noreferrer" className="block aspect-video bg-[#9146ff]/10 flex items-center justify-center hover:bg-[#9146ff]/20">
                    <div className="text-center">
                      <Icon name="play_circle" className="text-[#9146ff] text-5xl" />
                      <div className="text-xs text-white/70 mt-1 font-label tracking-wider">TWITCH VOD</div>
                    </div>
                  </a>
                )}
                {!ytId && !twId && (
                  <a href={v.url} target="_blank" rel="noreferrer" className="block aspect-video bg-white/5 flex items-center justify-center hover:bg-white/10">
                    <Icon name="open_in_new" className="text-white/60 text-4xl" />
                  </a>
                )}
                <div className="p-2.5">
                  <div className="text-sm font-medium leading-snug">{v.label}</div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-white/40">
                    <span>by {v.addedBy}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={function () { deleteVod(v.id) }}
                        className="text-[var(--md-error)] hover:underline"
                      >
                        remove
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
