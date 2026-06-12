import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// TFT Clash Broadcast Studio - branded OBS overlay suite.
//
// OBS browser sources (1920x1080, transparent):
//   /overlay?view=spotlight    featured player card
//   /overlay?view=standings    live season standings
//   /overlay?view=rotate       auto-cycles standings + top players (set & forget)
//   /overlay?view=soon         pre-show countdown
//   /overlay?view=lobbies      lobby assignments
//
// Optional: ?player=Levitate (pin spotlight), ?bg=dark|gradient (default = transparent).
// Reads only public tables (players, site_settings) so it works unauthenticated.
// ─────────────────────────────────────────────────────────────────────────────

var LOGO_FULL = '/tftclash-logo-horizontal.svg'
var LOGO_ICON = '/tftclash-icon.svg'

var GOLD = '#E8C56A'

var RANK_META = {
  Challenger:  { color: '#E8C56A', glyph: '⚡' },
  Grandmaster: { color: '#E0556A', glyph: '🔥' },
  Master:      { color: '#B888F0', glyph: '✦' },
  Diamond:     { color: '#5AD1E6', glyph: '◆' },
  Emerald:     { color: '#2ECC71', glyph: '❖' },
  Platinum:    { color: '#48C9B0', glyph: '❖' },
  Gold:        { color: '#E8C56A', glyph: '★' },
  Silver:      { color: '#AEB9CC', glyph: '◆' },
  Bronze:      { color: '#C08A52', glyph: '◆' },
  Iron:        { color: '#8A93A6', glyph: '▰' }
}

function rankMeta(rank) { return RANK_META[rank] || { color: '#AEB9CC', glyph: '✦' } }

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

function starLevel(pos) { return pos <= 1 ? 3 : pos <= 4 ? 2 : 1 }

function euTimeLabel(iso) {
  if (!iso) return 'TBD'
  var d = new Date(iso)
  if (isNaN(d.getTime())) return 'TBD'
  var datePart = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })
  var timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' })
  return datePart + ', ' + timePart + ' CEST'
}

// ─── building blocks ─────────────────────────────────────────────────────────

function HexWatermark(props) {
  return (
    <svg className={'absolute pointer-events-none ' + (props.className || '')} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="none" stroke={GOLD} strokeWidth="1.5" />
      <polygon points="50,16 81,33 81,67 50,84 19,67 19,33" fill="none" stroke={GOLD} strokeWidth="1" />
    </svg>
  )
}

// Beveled, gold-framed plate - the core TFT panel shape.
function Plate(props) {
  var accent = props.accent || GOLD
  return (
    <div className={'relative bcs-shadow ' + (props.className || '')}>
      <div className="bcs-plate p-[2px]" style={{ background: 'linear-gradient(150deg,' + accent + ',rgba(232,197,106,0.12) 38%,rgba(255,255,255,0.05) 56%,' + accent + 'bb)' }}>
        <div className="bcs-plate bcs-fill relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,' + accent + ',transparent)' }} />
          <HexWatermark className="w-48 h-48 -right-10 -top-12 opacity-[0.06]" />
          <HexWatermark className="w-28 h-28 -left-8 -bottom-10 opacity-[0.05]" />
          <div className="relative">{props.children}</div>
        </div>
      </div>
    </div>
  )
}

function BrandLockup(props) {
  return (
    <div className={'flex items-center gap-2 ' + (props.className || '')}>
      <img src={LOGO_ICON} alt="" className="h-7 w-7" />
      <img src={LOGO_FULL} alt="TFT Clash" className={props.h || 'h-5'} />
    </div>
  )
}

function StarPips(props) {
  var n = props.n || 1
  var stars = []
  var i
  for (i = 0; i < n; i++) stars.push(i)
  return (
    <div className="flex items-center gap-1">
      {stars.map(function(k) {
        return <span key={k} className="bcs-gold text-[13px] leading-none" style={{ filter: 'drop-shadow(0 0 4px rgba(232,197,106,0.6))' }}>★</span>
      })}
    </div>
  )
}

function HexEmblem(props) {
  var rm = rankMeta(props.rank)
  var initial = (props.name || '?').charAt(0).toUpperCase()
  return (
    <div className="relative" style={{ width: 132, height: 132 }}>
      <div className="absolute inset-0 bcs-hex" style={{ background: 'linear-gradient(160deg,' + GOLD + ',rgba(232,197,106,0.25))', filter: 'drop-shadow(0 0 22px ' + rm.color + '66)' }} />
      <div className="absolute bcs-hex" style={{ inset: 4, background: 'radial-gradient(circle at 50% 30%,' + rm.color + '55,rgba(8,7,16,0.95) 72%)' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[52px] leading-none text-white" style={{ textShadow: '0 0 18px ' + rm.color + 'aa' }}>{initial}</span>
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">{props.pos ? <StarPips n={starLevel(props.pos)} /> : null}</div>
    </div>
  )
}

function LiveTag(props) {
  var ts = props.ts || {}
  var phase = ts.phase || 'idle'
  if (phase === 'inprogress' || phase === 'live') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 bcs-tag" style={{ background: 'rgba(224,85,90,0.16)', borderColor: 'rgba(224,85,90,0.5)' }}>
        <span className="w-2 h-2 rounded-full bg-[#E0555A] animate-pulse" />
        <span className="font-label font-bold text-[12px] tracking-[0.18em] uppercase text-[#F08A8E]">
          {'Live  Game ' + (ts.round || 1) + '/' + (ts.totalGames || 4)}
        </span>
      </div>
    )
  }
  var label = phase === 'checkin' ? 'Check-in open' : phase === 'registration' ? 'Registration open' : phase === 'complete' ? 'Complete' : 'Upcoming'
  var tone = phase === 'checkin' ? '#5AD1E6' : phase === 'registration' ? '#48C9B0' : GOLD
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bcs-tag" style={{ background: tone + '1f', borderColor: tone + '66' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: tone }} />
      <span className="font-label font-bold text-[12px] tracking-[0.18em] uppercase" style={{ color: tone }}>{label}</span>
    </div>
  )
}

function SponsorStrip(props) {
  var sponsors = props.sponsors || []
  if (sponsors.length === 0) return null
  var big = props.size === 'lg'
  return (
    <div className={'flex items-center ' + (big ? 'gap-7' : 'gap-4')}>
      {sponsors.slice(0, big ? 6 : 3).map(function(s) {
        return (
          <img key={s.name} src={s.logo_url} alt={s.name} title={s.name}
            className={(big ? 'h-11' : 'h-6') + ' w-auto object-contain'}
            style={{ filter: 'drop-shadow(0 1px 7px rgba(0,0,0,0.65))', maxWidth: big ? 180 : 96 }} />
        )
      })}
    </div>
  )
}

// Bottom-right lockup: partner logos + the TFT Clash brand mark, always on
// screen for the lower-third views.
function FixedFooter(props) {
  var sponsors = props.sponsors || []
  return (
    <div className="fixed right-8 bottom-7 z-40 flex items-center gap-4">
      {sponsors.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="font-label text-[10px] tracking-[0.22em] uppercase text-white/40">{sponsors.length > 1 ? 'Partners' : 'Partner'}</span>
          <SponsorStrip sponsors={sponsors} />
          <span className="w-px h-6 bg-white/15" />
        </div>
      )}
      <div className="flex items-center gap-2">
        <img src={LOGO_ICON} alt="" className="h-6 w-6" style={{ filter: 'drop-shadow(0 0 8px rgba(232,197,106,0.4))' }} />
        <span className="font-display text-sm uppercase tracking-wide text-white/85">TFT <span className="bcs-gold">Clash</span></span>
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
      <Plate className="w-[420px]">
        <div className="flex items-center gap-3 px-6 py-6">
          <img src={LOGO_ICON} alt="" className="w-10 h-10 opacity-70" />
          <span className="font-label text-white/60 uppercase tracking-[0.2em] text-sm">Waiting for players...</span>
        </div>
      </Plate>
    )
  }
  var rm = rankMeta(p.rank)
  return (
    <Plate accent={rm.color} className="w-[640px] max-w-[94vw] bcs-seg-in">
      <div className="px-6 pt-4 pb-5">
        <div className="flex items-center justify-between mb-3">
          <BrandLockup h="h-5" />
          <LiveTag ts={ts} />
        </div>
        <div className="flex items-center gap-6">
          <HexEmblem rank={p.rank} name={p.username} pos={props.standingPos} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-label text-[12px] tracking-[0.24em] uppercase" style={{ color: rm.color }}>Featured Player</span>
              {props.hot && <span className="text-[#FF9A4D] text-sm font-bold">{'🔥 HOT'}</span>}
            </div>
            <div className="font-display text-[50px] leading-[0.92] uppercase text-white truncate" style={{ textShadow: '0 0 26px ' + rm.color + '66' }}>{p.username}</div>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bcs-tag font-label font-bold text-[12px] tracking-widest uppercase"
                style={{ background: rm.color + '22', color: rm.color, borderColor: rm.color + '66' }}>
                {rm.glyph}<span>{p.rank || 'Unranked'}</span>
              </span>
              {props.standingPos ? <span className="font-label text-[12px] tracking-widest uppercase text-white/45">{'Season ' + ordinal(props.standingPos)}</span> : null}
            </div>
            <div className="flex items-end gap-5 mt-4">
              <div className="leading-none">
                <div className="font-display text-[56px] leading-none bcs-gold" style={{ filter: 'drop-shadow(0 0 18px rgba(232,197,106,0.45))' }}>{p.season_pts || 0}</div>
                <div className="font-label text-[11px] tracking-[0.25em] uppercase text-white/40 mt-1">Season points</div>
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 pb-1">
                <Stat label="Wins" value={p.wins || 0} />
                <Stat label="Top 4" value={p.top4 || 0} />
                <Stat label="Games" value={p.games || 0} />
                <Stat label="Pts/Game" value={ppg(p)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Plate>
  )
}

function Stat(props) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono font-bold text-white text-lg">{props.value}</span>
      <span className="font-label text-[10px] tracking-[0.16em] uppercase text-white/40">{props.label}</span>
    </div>
  )
}

function StandingsView(props) {
  var rows = (props.players || []).slice(0, 10)
  var ts = props.ts || {}
  return (
    <Plate className="w-[460px] max-w-[94vw] bcs-seg-in">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[.06]">
        <div className="flex items-center gap-3">
          <img src={LOGO_ICON} alt="" className="w-8 h-8" />
          <div>
            <div className="font-display text-lg uppercase text-white leading-none">Season <span className="bcs-gold">Standings</span></div>
            <div className="font-label text-[10px] tracking-[0.22em] uppercase text-white/40 mt-1">{ts.clashName || 'TFT Clash'}</div>
          </div>
        </div>
        <LiveTag ts={ts} />
      </div>
      <div className="px-2 py-1.5">
        {rows.length === 0 && <div className="px-3 py-6 text-white/40 font-label text-sm">No players yet.</div>}
        {rows.map(function(p, i) {
          var rm = rankMeta(p.rank)
          var medal = i === 0 ? GOLD : i === 1 ? '#C8D0DC' : i === 2 ? '#C08A52' : null
          return (
            <div key={p.id} className={'flex items-center gap-3 px-3 py-[7px] rounded ' + (i < 3 ? 'bg-white/[.04]' : '')}>
              <span className="w-6 h-6 bcs-hex flex items-center justify-center font-mono font-bold text-[13px]"
                style={{ background: medal ? medal + '26' : 'rgba(255,255,255,0.05)', color: medal || 'rgba(255,255,255,0.5)' }}>{i + 1}</span>
              <span className="w-1 h-6 rounded-full" style={{ background: rm.color }} />
              <span className="flex-1 min-w-0 truncate font-semibold text-white text-[15px]">{p.username}</span>
              <span className="font-mono text-[11px] text-white/40 w-12 text-right">{(p.wins || 0) + 'W ' + (p.top4 || 0) + 'T4'}</span>
              <span className="font-mono font-bold bcs-gold text-[17px] w-10 text-right">{p.season_pts || 0}</span>
            </div>
          )
        })}
      </div>
      <div className="px-5 py-2 border-t border-white/[.06] flex items-center justify-between">
        <span className="font-label text-[10px] tracking-[0.25em] uppercase text-white/40">tftclash.com</span>
        <span className="font-label text-[10px] tracking-[0.25em] uppercase" style={{ color: GOLD }}>Free to compete</span>
      </div>
    </Plate>
  )
}

function SoonView(props) {
  var ts = props.ts || {}
  var parts = props.parts
  var live = ts.phase === 'inprogress' || ts.phase === 'live'
  return (
    <div className="w-[760px] max-w-[95vw] text-center">
      <img src={LOGO_FULL} alt="TFT Clash" className="h-14 mx-auto mb-7 bcs-float" style={{ filter: 'drop-shadow(0 0 24px rgba(232,197,106,0.35))' }} />
      {live ? (
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bcs-tag mb-5" style={{ background: 'rgba(224,85,90,0.18)', borderColor: 'rgba(224,85,90,0.5)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-[#E0555A] animate-pulse" />
            <span className="font-label font-bold text-sm tracking-[0.25em] uppercase text-[#F08A8E]">Live now</span>
          </div>
          <div className="font-display text-[64px] leading-none uppercase text-white mb-3">{ts.clashName || ('Clash #' + (ts.clashNumber || 1))}</div>
          <div className="font-label text-base tracking-[0.2em] uppercase text-white/50">Game {ts.round || 1} of {ts.totalGames || 4} in progress</div>
        </div>
      ) : (
        <div>
          <div className="font-label text-sm tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>{ts.clashName || ('Clash #' + (ts.clashNumber || 1))}</div>
          <div className="font-display text-[42px] uppercase text-white mb-7">Starting <span className="bcs-gold">Soon</span></div>
          <div className="flex items-center justify-center gap-3 mb-7">
            <TimeBlock value={parts.d} label="Days" />
            <Colon />
            <TimeBlock value={parts.h} label="Hours" />
            <Colon />
            <TimeBlock value={parts.m} label="Mins" />
            <Colon />
            <TimeBlock value={parts.s} label="Secs" />
          </div>
          <div className="font-label text-base tracking-[0.18em] uppercase text-white/65 mb-1">{euTimeLabel(ts.clashTimestamp)}</div>
          {typeof props.registered === 'number' && props.registered > 0 && (
            <div className="font-label text-sm tracking-[0.18em] uppercase text-white/40">{props.registered + ' players registered'}</div>
          )}
        </div>
      )}
      <div className="mt-9 inline-flex items-center gap-3 px-6 py-3 bcs-tag" style={{ borderColor: GOLD + '66', background: 'rgba(8,7,16,0.7)' }}>
        <img src={LOGO_ICON} alt="" className="w-7 h-7" />
        <span className="font-display text-lg uppercase text-white">Register at <span className="bcs-gold">tftclash.com</span></span>
      </div>
      {props.sponsors && props.sponsors.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <span className="font-label text-[11px] tracking-[0.3em] uppercase text-white/35">{props.sponsors.length > 1 ? 'Proud Partners' : 'Proud Partner'}</span>
          <SponsorStrip sponsors={props.sponsors} size="lg" />
        </div>
      )}
    </div>
  )
}

function TimeBlock(props) {
  return (
    <div className="w-[112px] py-4 bcs-plate p-[2px]" style={{ background: 'linear-gradient(150deg,' + GOLD + ',rgba(232,197,106,0.15) 50%,' + GOLD + 'aa)' }}>
      <div className="bcs-plate bcs-fill py-4">
        <div className="font-mono font-bold text-[50px] leading-none bcs-gold">{pad2(props.value)}</div>
        <div className="font-label text-[11px] tracking-[0.25em] uppercase text-white/40 mt-2">{props.label}</div>
      </div>
    </div>
  )
}

function Colon() { return <div className="font-mono font-bold text-[38px] pb-5" style={{ color: GOLD + '88' }}>:</div> }

function LobbiesView(props) {
  var lobbies = props.lobbies || []
  var ts = props.ts || {}
  var letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
  return (
    <Plate className="w-[880px] max-w-[96vw]">
      <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-white/[.06]">
        <BrandLockup h="h-6" />
        <div className="flex items-center gap-3">
          <span className="font-label text-[11px] tracking-[0.22em] uppercase text-white/40">Lobby Assignments</span>
          <LiveTag ts={ts} />
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
        {lobbies.length === 0 && <div className="col-span-3 text-white/40 font-label text-sm py-4">Lobbies not set yet.</div>}
        {lobbies.map(function(lobby, li) {
          return (
            <div key={li} className="bcs-plate bg-white/[.03] border border-white/[.06] overflow-hidden">
              <div className="px-3 py-2 flex items-center justify-between border-b border-white/[.06]">
                <span className="font-display text-sm uppercase bcs-gold">{'Lobby ' + (letters[li] || (li + 1))}</span>
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
    </Plate>
  )
}

// Dramatic signup CTA: the icon pops + spins in, then a gold-framed banner
// unfurls beside it reading "Sign up at TFT Clash".
function SignupCta(props) {
  if (!props.show) return null
  return (
    <div className="fixed left-1/2 bottom-14 -translate-x-1/2 z-50 bcs-cta-wrap">
      <div className="relative flex items-center">
        <div className="absolute left-1 w-[96px] h-[96px] rounded-full bcs-burst" style={{ background: 'radial-gradient(circle, rgba(232,197,106,0.55), transparent 62%)' }} />
        <div className="relative z-10 bcs-pop">
          <div className="w-[92px] h-[92px] bcs-hex flex items-center justify-center" style={{ background: 'linear-gradient(160deg,' + GOLD + ',rgba(232,197,106,0.3))', filter: 'drop-shadow(0 0 26px rgba(232,197,106,0.6))' }}>
            <div className="w-[84px] h-[84px] bcs-hex flex items-center justify-center" style={{ background: 'radial-gradient(circle at 50% 32%, rgba(232,197,106,0.2), rgba(8,7,16,0.96) 72%)' }}>
              <img src={LOGO_ICON} alt="TFT Clash" className="w-12 h-12" />
            </div>
          </div>
        </div>
        <div className="bcs-reveal -ml-5">
          <div className="bcs-plate p-[2px]" style={{ background: 'linear-gradient(150deg,' + GOLD + ',rgba(232,197,106,0.15) 55%,' + GOLD + 'aa)' }}>
            <div className="bcs-plate bcs-fill pl-9 pr-7 py-3.5">
              <div className="font-display text-2xl uppercase text-white leading-none tracking-wide">Sign up at <span className="bcs-gold">TFT Clash</span></div>
              <div className="font-label text-[12px] tracking-[0.22em] uppercase text-white/55 mt-1.5">tftclash.com  -  free to compete</div>
            </div>
          </div>
        </div>
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
  var _sponsors = useState([]); var sponsors = _sponsors[0]; var setSponsors = _sponsors[1]
  var _rot = useState(0); var rot = _rot[0]; var setRot = _rot[1]
  var _seg = useState(0); var seg = _seg[0]; var setSeg = _seg[1]
  var _now = useState(Date.now()); var now = _now[0]; var setNow = _now[1]
  var _cta = useState(false); var ctaShow = _cta[0]; var setCtaShow = _cta[1]
  var aliveRef = useRef(true)

  // Force a transparent page so the overlay composites over gameplay in OBS.
  useEffect(function() {
    var root = document.documentElement
    root.classList.add('bcs-active')
    return function() { root.classList.remove('bcs-active') }
  }, [])

  useEffect(function() {
    aliveRef.current = true
    function loadSettings() {
      supabase.from('site_settings').select('key,value').in('key', ['tournament_state', 'broadcast_control', 'org_sponsors']).then(function(res) {
        if (!aliveRef.current || res.error || !res.data) return
        res.data.forEach(function(row) {
          var parsed = null
          try { parsed = JSON.parse(row.value) } catch (e) { parsed = null }
          if (row.key === 'tournament_state') setTs(parsed)
          if (row.key === 'broadcast_control') setControl(parsed)
          if (row.key === 'org_sponsors') {
            var list = Array.isArray(parsed) ? parsed : []
            setSponsors(list.filter(function(s) {
              return s && s.logo_url && (s.status === undefined || s.status === 'active') && (s.active === undefined || s.active)
            }))
          }
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

  useEffect(function() {
    if (view !== 'soon') return
    var iv = setInterval(function() { setNow(Date.now()) }, 1000)
    return function() { clearInterval(iv) }
  }, [view])

  useEffect(function() {
    if (view !== 'spotlight') return
    var iv = setInterval(function() { setRot(function(r) { return r + 1 }) }, 10000)
    return function() { clearInterval(iv) }
  }, [view])

  // Rotate view: cycle standings -> top-4 spotlights -> repeat.
  var rotateLen = 1 + Math.min(4, players.length)
  useEffect(function() {
    if (view !== 'rotate' || rotateLen <= 1) return
    var dur = seg === 0 ? 11000 : 8000
    var t = setTimeout(function() { setSeg(function(s) { return (s + 1) % rotateLen }) }, dur)
    return function() { clearTimeout(t) }
  }, [view, seg, rotateLen])

  // Periodic dramatic signup CTA (spotlight / standings / rotate): once shortly
  // after the scene loads, then every 60s.
  useEffect(function() {
    if (view !== 'spotlight' && view !== 'standings' && view !== 'rotate') return
    var hideTimer = null
    function fire() {
      setCtaShow(true)
      hideTimer = setTimeout(function() { setCtaShow(false) }, 6500)
    }
    var initial = setTimeout(fire, 4000)
    var cycle = setInterval(fire, 60000)
    return function() { clearTimeout(initial); clearInterval(cycle); if (hideTimer) clearTimeout(hideTimer); setCtaShow(false) }
  }, [view])

  // Resolve spotlight player: pinned name > admin override > auto-rotate.
  function resolveSpotlight(rotIndex) {
    if (players.length === 0) return { player: null, pos: 0 }
    var chosen = null
    if (pinnedName) chosen = players.find(function(p) { return (p.username || '').toLowerCase() === pinnedName.toLowerCase() }) || null
    if (!chosen && control && control.mode === 'manual' && control.spotlightPlayerId) {
      chosen = players.find(function(p) { return String(p.id) === String(control.spotlightPlayerId) }) || null
    }
    if (!chosen) {
      var pool = players.slice(0, Math.min(8, players.length))
      chosen = pool[rotIndex % pool.length]
    }
    var pos = chosen ? players.findIndex(function(p) { return String(p.id) === String(chosen.id) }) + 1 : 0
    return { player: chosen, pos: pos }
  }

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

  function isHot(pl) { return pl && (pl.games || 0) >= 3 && ((pl.top4 || 0) / Math.max(1, pl.games || 1)) >= 0.7 }

  var wrapBg = bg === 'dark' ? 'bcs-bg-dark' : bg === 'gradient' ? 'bcs-bg-gradient' : ''
  var lowerThird = view === 'spotlight' || view === 'standings' || view === 'rotate'
  var anchor = lowerThird ? 'items-end justify-start' : 'items-center justify-center'

  // Build the active piece of content.
  var content = null
  if (view === 'standings') {
    content = <StandingsView players={players} ts={ts || {}} />
  } else if (view === 'soon') {
    content = <SoonView ts={ts || {}} parts={parts} registered={registeredCount} sponsors={sponsors} />
  } else if (view === 'lobbies') {
    content = <LobbiesView lobbies={lobbyObjs} ts={ts || {}} />
  } else if (view === 'rotate') {
    if (seg === 0 || rotateLen <= 1) {
      content = <div key={'std'}><StandingsView players={players} ts={ts || {}} /></div>
    } else {
      var rs = resolveSpotlight(seg - 1)
      content = <div key={'spot' + seg}><SpotlightView player={rs.player} standingPos={rs.pos} ts={ts || {}} hot={isHot(rs.player)} /></div>
    }
  } else {
    var sp = resolveSpotlight(rot)
    content = <SpotlightView player={sp.player} standingPos={sp.pos} ts={ts || {}} hot={isHot(sp.player)} />
  }

  return (
    <div className={'fixed inset-0 ' + wrapBg + ' flex ' + anchor + ' p-12 overflow-hidden'}>
      <BcsStyle />
      {content}
      {lowerThird && <FixedFooter sponsors={sponsors} />}
      <SignupCta show={ctaShow} />
    </div>
  )
}

function BcsStyle() {
  var css = [
    'html.bcs-active,html.bcs-active body,html.bcs-active #root{background:transparent !important;}',
    '.bcs-bg-dark{background:#07060D;}',
    '.bcs-bg-gradient{background:radial-gradient(120% 120% at 80% 0%,rgba(155,114,207,0.22),transparent 55%),radial-gradient(120% 120% at 0% 100%,rgba(78,205,196,0.16),transparent 55%),#06060C;}',
    '.bcs-plate{clip-path:polygon(16px 0,calc(100% - 16px) 0,100% 16px,100% calc(100% - 16px),calc(100% - 16px) 100%,16px 100%,0 calc(100% - 16px),0 16px);}',
    '.bcs-fill{background:linear-gradient(160deg,rgba(20,16,32,0.93),rgba(8,7,14,0.92));}',
    '.bcs-hex{clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);}',
    '.bcs-tag{border:1px solid;clip-path:polygon(7px 0,100% 0,calc(100% - 7px) 100%,0 100%);}',
    '.bcs-gold{background:linear-gradient(180deg,#FCEFC2,#E8C56A 48%,#B07E2E);-webkit-background-clip:text;background-clip:text;color:transparent;}',
    '.bcs-shadow{filter:drop-shadow(0 10px 34px rgba(0,0,0,0.55));}',
    '@keyframes bcsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
    '.bcs-float{animation:bcsFloat 4s ease-in-out infinite;}',
    '@keyframes bcsSegIn{0%{opacity:0;transform:translateY(14px) scale(0.98)}100%{opacity:1;transform:translateY(0) scale(1)}}',
    '.bcs-seg-in{animation:bcsSegIn 0.5s cubic-bezier(.2,.8,.2,1) both;}',
    '@keyframes bcsPop{0%{opacity:0;transform:scale(0) rotate(-330deg)}55%{opacity:1;transform:scale(1.18) rotate(16deg)}72%{transform:scale(0.93) rotate(-7deg)}100%{opacity:1;transform:scale(1) rotate(0)}}',
    '.bcs-pop{animation:bcsPop 0.95s cubic-bezier(.2,.85,.25,1) both;}',
    '@keyframes bcsBurst{0%{opacity:0;transform:scale(0.3)}45%{opacity:0.9}100%{opacity:0;transform:scale(2)}}',
    '.bcs-burst{animation:bcsBurst 1s ease-out both;animation-delay:0.2s;}',
    '@keyframes bcsReveal{0%{opacity:0;clip-path:inset(0 100% 0 0)}100%{opacity:1;clip-path:inset(0 0 0 0)}}',
    '.bcs-reveal{animation:bcsReveal 0.7s ease-out both;animation-delay:0.7s;}',
    '@keyframes bcsCtaWrap{0%{opacity:0;transform:translate(-50%,10px)}5%{opacity:1;transform:translate(-50%,0)}88%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,12px)}}',
    '.bcs-cta-wrap{animation:bcsCtaWrap 6.5s ease-in-out both;}'
  ].join('')
  return <style>{css}</style>
}
