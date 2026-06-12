import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// TFT Clash Broadcast Studio - gorgeous OBS overlay suite.
//
// Add as a Browser Source in OBS at one of:
//   https://tftclash.com/overlay?view=spotlight     (featured player card)
//   https://tftclash.com/overlay?view=standings     (live season standings)
//   https://tftclash.com/overlay?view=soon          (pre-show countdown)
//   https://tftclash.com/overlay?view=lobbies        (lobby assignments)
//
// Optional query params:
//   ?player=Levitate    pin a specific player in the spotlight (else auto-rotates
//                        or follows the admin's Broadcast Studio pick)
//   ?bg=transparent      transparent background (default) for in-game overlays
//   ?bg=dark | ?bg=gradient   solid / animated background for full-screen scenes
//
// Reads only public, anon-readable tables (players, site_settings) so it works as
// an unauthenticated OBS source. Updates live via Supabase realtime.
// ─────────────────────────────────────────────────────────────────────────────

var LOGO_FULL = '/tftclash-logo-horizontal.svg'
var LOGO_ICON = '/tftclash-icon.svg'

var RANK_META = {
  Challenger:  { color: '#E8A838', glyph: '⚡' },
  Grandmaster: { color: '#C0392B', glyph: '🔥' },
  Master:      { color: '#9B72CF', glyph: '💎' },
  Diamond:     { color: '#4ECDC4', glyph: '💎' },
  Emerald:     { color: '#2ECC71', glyph: '🌿' },
  Platinum:    { color: '#3FB68B', glyph: '🍀' },
  Gold:        { color: '#E8A838', glyph: '⭐' },
  Silver:      { color: '#9AAABF', glyph: '◆' },
  Bronze:      { color: '#A9743B', glyph: '◆' },
  Iron:        { color: '#888888', glyph: '▫' }
}

function rankMeta(rank) {
  return RANK_META[rank] || { color: '#9AAABF', glyph: '🎮' }
}

function ordinal(n) {
  var s = ['th', 'st', 'nd', 'rd']
  var v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function countdownParts(ms) {
  if (!ms || ms < 0) ms = 0
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000)
  }
}

function pad2(n) { return n < 10 ? '0' + n : '' + n }

function ppg(p) {
  var g = p.games || 0
  if (g <= 0) return '0.0'
  return ((p.season_pts || 0) / g).toFixed(1)
}

// Localized clash time in Europe (CEST), the league's home region.
function euTimeLabel(iso) {
  if (!iso) return 'TBD'
  var d = new Date(iso)
  if (isNaN(d.getTime())) return 'TBD'
  var datePart = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
  var timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' })
  return datePart + ', ' + timePart + ' CEST'
}

// ─── small shared pieces ─────────────────────────────────────────────────────

function LiveChip(props) {
  var ts = props.ts || {}
  var phase = ts.phase || 'idle'
  if (phase === 'inprogress' || phase === 'live') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error/20 border border-error/40">
        <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
        <span className="font-label font-bold text-[12px] tracking-[0.2em] uppercase text-error">
          {'Live  Clash #' + (ts.clashNumber || '?') + '  Game ' + (ts.round || 1) + '/' + (ts.totalGames || 4)}
        </span>
      </div>
    )
  }
  var label = phase === 'checkin' ? 'Check-in open'
    : phase === 'registration' ? 'Registration open'
    : phase === 'complete' ? 'Complete'
    : 'Upcoming'
  var tone = phase === 'checkin' ? '#4ECDC4' : phase === 'registration' ? '#3FB68B' : '#9AAABF'
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border" style={{ borderColor: tone + '66', background: tone + '22' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: tone }} />
      <span className="font-label font-bold text-[12px] tracking-[0.2em] uppercase" style={{ color: tone }}>
        {'Clash #' + (ts.clashNumber || '?') + '  ' + label}
      </span>
    </div>
  )
}

function SignupCta(props) {
  if (!props.show) return null
  return (
    <div className="fixed left-1/2 bottom-10 -translate-x-1/2 z-50 bcs-cta-in">
      <div className="flex items-center gap-4 px-7 py-4 rounded-2xl border border-primary/40 bcs-glass bcs-cta-glow">
        <img src={LOGO_ICON} alt="" className="w-11 h-11" />
        <div className="leading-tight">
          <div className="font-display text-xl text-white uppercase tracking-wide">Sign up to <span className="text-primary">TFT Clash</span></div>
          <div className="font-label text-[12px] tracking-[0.18em] uppercase text-white/60">tftclash.com  -  Free to compete, weekly</div>
        </div>
      </div>
    </div>
  )
}

// ─── views ───────────────────────────────────────────────────────────────────

function SpotlightView(props) {
  var p = props.player
  var ts = props.ts || {}
  if (!p) {
    return (
      <div className="flex items-center gap-3 px-6 py-5 rounded-2xl bcs-glass">
        <img src={LOGO_ICON} alt="" className="w-10 h-10 opacity-70" />
        <span className="font-label text-white/60 uppercase tracking-[0.2em] text-sm">Waiting for players...</span>
      </div>
    )
  }
  var rm = rankMeta(p.rank)
  var pos = props.standingPos
  return (
    <div className="relative w-[560px] max-w-[92vw]">
      <div className="absolute -inset-3 rounded-3xl blur-2xl opacity-40" style={{ background: 'radial-gradient(120% 120% at 0% 0%, ' + rm.color + '66 0%, transparent 60%)' }} />
      <div className="relative rounded-3xl overflow-hidden bcs-glass border" style={{ borderColor: rm.color + '55' }}>
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, ' + rm.color + ', transparent)' }} />
        <div className="px-7 pt-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <img src={LOGO_FULL} alt="TFT Clash" className="h-6" />
            <LiveChip ts={ts} />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className="font-label text-[12px] tracking-[0.22em] uppercase text-white/50">Featured Player</span>
            {props.hot && <span className="text-orange-400 text-sm">{'🔥 Hot streak'}</span>}
          </div>

          <div className="font-display text-[58px] leading-[0.95] uppercase text-white bcs-name" style={{ textShadow: '0 0 28px ' + rm.color + '55' }}>
            {p.username}
          </div>

          <div className="flex items-center gap-3 mt-3 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label font-bold text-[13px] tracking-widest uppercase"
              style={{ background: rm.color + '22', color: rm.color, border: '1px solid ' + rm.color + '55' }}>
              <span>{rm.glyph}</span>{p.rank || 'Unranked'}
            </span>
            {pos ? (
              <span className="font-label text-[13px] tracking-widest uppercase text-white/55">{'Season ' + ordinal(pos)}</span>
            ) : null}
          </div>

          <div className="flex items-end gap-6">
            <div>
              <div className="font-display text-[64px] leading-none text-primary" style={{ textShadow: '0 0 26px rgba(155,114,207,0.55)' }}>
                {p.season_pts || 0}
              </div>
              <div className="font-label text-[12px] tracking-[0.25em] uppercase text-white/45 mt-1">Season points</div>
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-1 pb-1">
              <Stat label="Wins" value={p.wins || 0} />
              <Stat label="Top 4" value={p.top4 || 0} />
              <Stat label="Games" value={p.games || 0} />
              <Stat label="Pts/Game" value={ppg(p)} wide />
            </div>
          </div>
        </div>
        <div className="px-7 py-2.5 bg-black/30 flex items-center justify-between border-t border-white/5">
          <span className="font-label text-[11px] tracking-[0.25em] uppercase text-white/40">tftclash.com</span>
          <span className="font-label text-[11px] tracking-[0.25em] uppercase text-primary/70">Season 1</span>
        </div>
      </div>
    </div>
  )
}

function Stat(props) {
  return (
    <div className={props.wide ? 'col-span-3 flex items-baseline gap-2 mt-1' : ''}>
      <span className="font-mono font-bold text-white text-xl">{props.value}</span>
      <span className="font-label text-[11px] tracking-[0.18em] uppercase text-white/45 ml-1.5">{props.label}</span>
    </div>
  )
}

function StandingsView(props) {
  var rows = (props.players || []).slice(0, 10)
  var ts = props.ts || {}
  return (
    <div className="w-[480px] max-w-[92vw] rounded-2xl overflow-hidden bcs-glass border border-white/10">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={LOGO_ICON} alt="" className="w-7 h-7" />
          <div>
            <div className="font-display text-lg uppercase text-white leading-none">Season Standings</div>
            <div className="font-label text-[10px] tracking-[0.22em] uppercase text-white/40 mt-1">{ts.clashName || 'TFT Clash'}</div>
          </div>
        </div>
        <LiveChip ts={ts} />
      </div>
      <div>
        {rows.length === 0 && <div className="px-5 py-6 text-white/40 font-label text-sm">No players yet.</div>}
        {rows.map(function(p, i) {
          var rm = rankMeta(p.rank)
          var medal = i === 0 ? '#E8A838' : i === 1 ? '#C8D0DC' : i === 2 ? '#A9743B' : null
          return (
            <div key={p.id} className={'flex items-center gap-3 px-5 py-2 border-b border-white/[.04] ' + (i < 3 ? 'bg-white/[.03]' : '')}>
              <span className="w-7 text-center font-mono font-bold text-[15px]" style={{ color: medal || 'rgba(255,255,255,0.4)' }}>
                {i + 1}
              </span>
              <span className="w-1 h-6 rounded-full" style={{ background: rm.color }} />
              <span className="flex-1 min-w-0 truncate font-semibold text-white text-[15px]">{p.username}</span>
              <span className="font-label text-[10px] tracking-wider uppercase text-white/35 hidden sm:inline">{p.rank}</span>
              <span className="font-mono text-[11px] text-white/40 w-14 text-right">{(p.wins || 0) + 'W ' + (p.top4 || 0) + 'T4'}</span>
              <span className="font-mono font-bold text-primary text-[17px] w-12 text-right">{p.season_pts || 0}</span>
            </div>
          )
        })}
      </div>
      <div className="px-5 py-2 bg-black/30 flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[0.25em] uppercase text-white/40">tftclash.com</span>
        <span className="font-label text-[10px] tracking-[0.25em] uppercase text-primary/70">Free to compete</span>
      </div>
    </div>
  )
}

function SoonView(props) {
  var ts = props.ts || {}
  var parts = props.parts
  var live = ts.phase === 'inprogress' || ts.phase === 'live'
  return (
    <div className="w-[720px] max-w-[94vw] text-center">
      <img src={LOGO_FULL} alt="TFT Clash" className="h-12 mx-auto mb-7 bcs-float" />
      {live ? (
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-error/20 border border-error/40 mb-5">
            <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
            <span className="font-label font-bold text-sm tracking-[0.25em] uppercase text-error">Live now</span>
          </div>
          <div className="font-display text-[64px] leading-none uppercase text-white mb-3">{ts.clashName || ('Clash #' + (ts.clashNumber || 1))}</div>
          <div className="font-label text-base tracking-[0.2em] uppercase text-white/50">Game {ts.round || 1} of {ts.totalGames || 4} in progress</div>
        </div>
      ) : (
        <div>
          <div className="font-label text-sm tracking-[0.3em] uppercase text-primary/80 mb-2">{ts.clashName || ('Clash #' + (ts.clashNumber || 1))}</div>
          <div className="font-display text-[40px] uppercase text-white/90 mb-7">Starting soon</div>
          <div className="flex items-center justify-center gap-3 mb-7">
            <TimeBlock value={parts.d} label="Days" />
            <Colon />
            <TimeBlock value={parts.h} label="Hours" />
            <Colon />
            <TimeBlock value={parts.m} label="Mins" />
            <Colon />
            <TimeBlock value={parts.s} label="Secs" />
          </div>
          <div className="font-label text-base tracking-[0.18em] uppercase text-white/60 mb-1">{euTimeLabel(ts.clashTimestamp)}</div>
          {typeof props.registered === 'number' && props.registered > 0 && (
            <div className="font-label text-sm tracking-[0.18em] uppercase text-white/40">{props.registered + ' players registered'}</div>
          )}
        </div>
      )}
      <div className="mt-9 inline-flex items-center gap-3 px-6 py-3 rounded-full border border-primary/40 bcs-glass">
        <img src={LOGO_ICON} alt="" className="w-7 h-7" />
        <span className="font-display text-lg uppercase text-white">Register at <span className="text-primary">tftclash.com</span></span>
      </div>
    </div>
  )
}

function TimeBlock(props) {
  return (
    <div className="w-[110px] py-4 rounded-2xl bcs-glass border border-white/10">
      <div className="font-mono font-bold text-[52px] leading-none text-white">{pad2(props.value)}</div>
      <div className="font-label text-[11px] tracking-[0.25em] uppercase text-white/40 mt-2">{props.label}</div>
    </div>
  )
}

function Colon() {
  return <div className="font-mono font-bold text-[40px] text-primary/50 pb-5">:</div>
}

function LobbiesView(props) {
  var lobbies = props.lobbies || []
  var ts = props.ts || {}
  var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  return (
    <div className="w-[860px] max-w-[96vw] rounded-2xl overflow-hidden bcs-glass border border-white/10">
      <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={LOGO_FULL} alt="TFT Clash" className="h-6" />
          <span className="font-label text-[11px] tracking-[0.22em] uppercase text-white/40">Lobby Assignments</span>
        </div>
        <LiveChip ts={ts} />
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
        {lobbies.length === 0 && <div className="col-span-3 text-white/40 font-label text-sm py-4">Lobbies not set yet.</div>}
        {lobbies.map(function(lobby, li) {
          return (
            <div key={li} className="rounded-xl bg-white/[.03] border border-white/8 overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
                <span className="font-display text-sm uppercase text-primary">{'Lobby ' + (letters[li] || (li + 1))}</span>
                <span className="font-mono text-[11px] text-white/35">{lobby.length}</span>
              </div>
              <div className="px-3 py-2 space-y-1">
                {lobby.map(function(pl) {
                  var rm = rankMeta(pl.rank)
                  return (
                    <div key={pl.id} className="flex items-center gap-2">
                      <span className="w-1 h-3.5 rounded-full" style={{ background: rm.color }} />
                      <span className="flex-1 min-w-0 truncate text-[13px] text-white/85">{pl.username}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── orchestrator ────────────────────────────────────────────────────────────

export default function BroadcastStudioScreen() {
  var search = new URLSearchParams(window.location.search || '')
  var view = search.get('view') || 'spotlight'
  var pinnedName = (search.get('player') || '').trim()
  var bg = search.get('bg') || 'transparent'

  var _ts = useState(null); var ts = _ts[0]; var setTs = _ts[1]
  var _players = useState([]); var players = _players[0]; var setPlayers = _players[1]
  var _control = useState(null); var control = _control[0]; var setControl = _control[1]
  var _rot = useState(0); var rot = _rot[0]; var setRot = _rot[1]
  var _now = useState(Date.now()); var now = _now[0]; var setNow = _now[1]
  var _cta = useState(false); var ctaShow = _cta[0]; var setCtaShow = _cta[1]

  var aliveRef = useRef(true)

  // Background handling for OBS: transparent by default so the overlay composites
  // over gameplay; dark/gradient for full-screen scenes.
  useEffect(function() {
    document.body.classList.add('bcs-body')
    return function() { document.body.classList.remove('bcs-body') }
  }, [])

  // Data load + realtime.
  useEffect(function() {
    aliveRef.current = true
    function loadSettings() {
      supabase.from('site_settings').select('key,value').in('key', ['tournament_state', 'broadcast_control']).then(function(res) {
        if (!aliveRef.current || res.error || !res.data) return
        res.data.forEach(function(row) {
          var parsed = null
          try { parsed = JSON.parse(row.value) } catch (e) { parsed = null }
          if (row.key === 'tournament_state') setTs(parsed)
          if (row.key === 'broadcast_control') setControl(parsed)
        })
      })
    }
    function loadPlayers() {
      supabase.from('players').select('id,username,rank,season_pts,wins,top4,games,lp,riot_id_eu')
        .order('season_pts', { ascending: false }).then(function(res) {
          if (!aliveRef.current || res.error || !res.data) return
          setPlayers(res.data)
        })
    }
    loadSettings(); loadPlayers()

    var fallback = null
    var channel = supabase.channel('bcs-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, loadSettings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadPlayers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_results' }, loadPlayers)
      .subscribe(function(status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!fallback) fallback = setInterval(function() { loadSettings(); loadPlayers() }, 20000)
        } else if (fallback) { clearInterval(fallback); fallback = null }
      })

    return function() {
      aliveRef.current = false
      if (fallback) clearInterval(fallback)
      supabase.removeChannel(channel)
    }
  }, [])

  // 1s tick for the countdown view.
  useEffect(function() {
    if (view !== 'soon') return
    var iv = setInterval(function() { setNow(Date.now()) }, 1000)
    return function() { clearInterval(iv) }
  }, [view])

  // Spotlight auto-rotation when no player is pinned and no admin override.
  useEffect(function() {
    if (view !== 'spotlight') return
    var iv = setInterval(function() { setRot(function(r) { return r + 1 }) }, 10000)
    return function() { clearInterval(iv) }
  }, [view])

  // Periodic signup CTA on spotlight + standings (every 75s, visible 8s).
  useEffect(function() {
    if (view !== 'spotlight' && view !== 'standings') return
    var showTimer = null
    var cycle = setInterval(function() {
      setCtaShow(true)
      showTimer = setTimeout(function() { setCtaShow(false) }, 8000)
    }, 75000)
    return function() { clearInterval(cycle); if (showTimer) clearTimeout(showTimer); setCtaShow(false) }
  }, [view])

  // Resolve the spotlight player: pinned name > admin override > auto-rotate.
  var spotlightPlayer = null
  var spotlightPos = 0
  if (players.length > 0) {
    var chosen = null
    if (pinnedName) {
      chosen = players.find(function(p) { return (p.username || '').toLowerCase() === pinnedName.toLowerCase() }) || null
    }
    if (!chosen && control && control.mode === 'manual' && control.spotlightPlayerId) {
      chosen = players.find(function(p) { return String(p.id) === String(control.spotlightPlayerId) }) || null
    }
    if (!chosen) {
      var pool = players.slice(0, Math.min(8, players.length))
      chosen = pool[rot % pool.length]
    }
    if (chosen) {
      spotlightPlayer = chosen
      spotlightPos = players.findIndex(function(p) { return String(p.id) === String(chosen.id) }) + 1
    }
  }

  // Build lobby objects from saved id-arrays + player lookup.
  var playersById = {}
  players.forEach(function(p) { playersById[p.id] = p })
  var lobbyObjs = []
  if (ts && Array.isArray(ts.savedLobbies)) {
    lobbyObjs = ts.savedLobbies.map(function(ids) {
      return (ids || []).map(function(id) { return playersById[id] }).filter(Boolean)
    }).filter(function(l) { return l.length > 0 })
  }

  var registeredCount = ts && Array.isArray(ts.registeredIds) ? ts.registeredIds.length : 0
  var parts = countdownParts((ts && ts.clashTimestamp ? new Date(ts.clashTimestamp).getTime() : 0) - now)

  var hot = spotlightPlayer && (spotlightPlayer.games || 0) >= 3 && ((spotlightPlayer.top4 || 0) / Math.max(1, spotlightPlayer.games || 1)) >= 0.7

  var wrapBg = bg === 'dark'
    ? 'bcs-bg-dark'
    : bg === 'gradient'
      ? 'bcs-bg-gradient'
      : 'bcs-bg-transparent'

  // Spotlight + standings sit bottom-left (classic lower-third); soon + lobbies center.
  var anchor = (view === 'spotlight' || view === 'standings') ? 'items-end justify-start' : 'items-center justify-center'

  return (
    <div className={'fixed inset-0 ' + wrapBg + ' flex ' + anchor + ' p-10 overflow-hidden'}>
      <BcsStyle />
      {view === 'standings' && <StandingsView players={players} ts={ts || {}} />}
      {view === 'soon' && <SoonView ts={ts || {}} parts={parts} registered={registeredCount} />}
      {view === 'lobbies' && <LobbiesView lobbies={lobbyObjs} ts={ts || {}} />}
      {view !== 'standings' && view !== 'soon' && view !== 'lobbies' && (
        <SpotlightView player={spotlightPlayer} standingPos={spotlightPos} ts={ts || {}} hot={hot} />
      )}
      <SignupCta show={ctaShow} />
    </div>
  )
}

// Scoped overlay CSS (glass, glow, animations). Kept inline so the overlay is a
// single self-contained route with no global stylesheet dependency.
function BcsStyle() {
  var css = [
    '.bcs-body{background:transparent!important;}',
    '.bcs-bg-transparent{background:transparent;}',
    '.bcs-bg-dark{background:#08080F;}',
    '.bcs-bg-gradient{background:radial-gradient(120% 120% at 80% 0%,rgba(155,114,207,0.25),transparent 55%),radial-gradient(120% 120% at 0% 100%,rgba(78,205,196,0.18),transparent 55%),#07070D;}',
    '.bcs-glass{background:rgba(13,13,20,0.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}',
    '.bcs-name{letter-spacing:-0.01em;}',
    '.bcs-cta-glow{box-shadow:0 0 40px rgba(155,114,207,0.35);}',
    '@keyframes bcsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
    '.bcs-float{animation:bcsFloat 4s ease-in-out infinite;}',
    '@keyframes bcsCtaIn{0%{opacity:0;transform:translate(-50%,24px)}10%{opacity:1;transform:translate(-50%,0)}90%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,16px)}}',
    '.bcs-cta-in{animation:bcsCtaIn 8s ease-in-out forwards;}'
  ].join('')
  return <style>{css}</style>
}
