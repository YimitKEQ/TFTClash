import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui'
import { supabase } from '../../lib/supabase.js'

// Static routes (label, path, icon, keywords)
var ROUTES = [
  { label: 'Home',            path: '/',              icon: 'home',          keywords: 'dashboard landing' },
  { label: 'Standings',       path: '/standings',     icon: 'leaderboard',   keywords: 'season rank table' },
  { label: 'Leaderboard',     path: '/leaderboard',   icon: 'trending_up',   keywords: 'all-time points' },
  { label: 'Bracket',         path: '/bracket',       icon: 'account_tree',  keywords: 'tournament lobby' },
  { label: 'Results',         path: '/results',       icon: 'emoji_events',  keywords: 'games placements' },
  { label: 'Events',          path: '/events',        icon: 'event',         keywords: 'register schedule clash' },
  { label: 'Tournaments',     path: '/tournaments',   icon: 'military_tech', keywords: 'host browse' },
  { label: 'Hall of Fame',    path: '/hall-of-fame',  icon: 'workspace_premium', keywords: 'champions past seasons' },
  { label: 'Archive',         path: '/archive',       icon: 'archive',       keywords: 'past clashes history' },
  { label: 'Milestones',      path: '/milestones',    icon: 'flag',          keywords: 'badges achievements' },
  { label: 'Challenges',      path: '/challenges',    icon: 'task_alt',      keywords: 'goals quests' },
  { label: 'Sponsors',        path: '/sponsors',      icon: 'handshake',     keywords: 'partners' },
  { label: 'Season Recap',    path: '/season-recap',  icon: 'auto_stories',  keywords: 'year review' },
  { label: 'Pricing',         path: '/pricing',       icon: 'sell',          keywords: 'pro host subscribe' },
  { label: 'FAQ',             path: '/faq',           icon: 'help',          keywords: 'questions help support' },
  { label: 'Rules',           path: '/rules',         icon: 'gavel',         keywords: 'points tiebreakers' },
  { label: 'Gear',            path: '/gear',          icon: 'shopping_bag',  keywords: 'merch shop' },
  { label: 'Stats Hub',       path: '/stats',         icon: 'insights',      keywords: 'analytics data' },
  { label: 'Status',          path: '/status',        icon: 'monitor_heart', keywords: 'uptime health' },
  { label: 'Account',         path: '/account',       icon: 'manage_accounts', keywords: 'profile settings' },
]

// Fuzzy-ish scorer: exact > startsWith > contains > keyword contains
function score(item, q) {
  if (!q) return 0
  var lbl = item.label.toLowerCase()
  var kws = (item.keywords || '').toLowerCase()
  var full = (item.sub || '').toLowerCase()
  if (lbl === q) return 1000
  if (lbl.indexOf(q) === 0) return 800
  if (lbl.indexOf(q) > -1) return 600
  if (full.indexOf(q) === 0) return 500
  if (full.indexOf(q) > -1) return 400
  if (kws.indexOf(q) > -1) return 300
  return 0
}

function escapeIlike(raw) {
  // Supabase/PostgREST ilike treats %, _, , and * specially. Strip to safe chars.
  return String(raw).replace(/[%_*,()]/g, '')
}

export default function CommandPalette(props) {
  var open = props.open
  var onClose = props.onClose

  var navigate = useNavigate()
  var _q = useState('')
  var q = _q[0]
  var setQ = _q[1]
  var _sel = useState(0)
  var sel = _sel[0]
  var setSel = _sel[1]
  var _tournaments = useState([])
  var tournaments = _tournaments[0]
  var setTournaments = _tournaments[1]
  var _tournamentsLoaded = useState(false)
  var tournamentsLoaded = _tournamentsLoaded[0]
  var setTournamentsLoaded = _tournamentsLoaded[1]
  var _playerResults = useState([])
  var playerResults = _playerResults[0]
  var setPlayerResults = _playerResults[1]
  var _playerLoading = useState(false)
  var playerLoading = _playerLoading[0]
  var setPlayerLoading = _playerLoading[1]
  var inputRef = useRef(null)
  var itemsRef = useRef([])
  var searchTokenRef = useRef(0)

  // Lazy-load tournaments (small list) on first open. Players are searched on demand.
  useEffect(function() {
    if (!open || tournamentsLoaded) return
    supabase.from('tournaments').select('id,name,phase').order('created_at', { ascending: false }).limit(50)
      .then(function(r) {
        setTournaments((r && r.data) || [])
        setTournamentsLoaded(true)
      }).catch(function() { setTournamentsLoaded(true) })
  }, [open, tournamentsLoaded])

  // Debounced player search: only fire when query has >= 2 chars.
  useEffect(function() {
    if (!open) return
    var raw = q.trim()
    if (raw.length < 2) {
      setPlayerResults([])
      setPlayerLoading(false)
      return
    }
    searchTokenRef.current += 1
    var myToken = searchTokenRef.current
    setPlayerLoading(true)
    var handle = setTimeout(function() {
      var term = escapeIlike(raw)
      if (!term) { setPlayerResults([]); setPlayerLoading(false); return }
      supabase.from('players')
        .select('id,username,rank,region')
        .ilike('username', term + '%')
        .order('season_pts', { ascending: false })
        .limit(20)
        .then(function(r) {
          if (myToken !== searchTokenRef.current) return
          setPlayerResults((r && r.data) || [])
          setPlayerLoading(false)
        }).catch(function() {
          if (myToken !== searchTokenRef.current) return
          setPlayerResults([])
          setPlayerLoading(false)
        })
    }, 180)
    return function() { clearTimeout(handle) }
  }, [q, open])

  // Focus input on open, reset on close
  useEffect(function() {
    if (open) {
      setSel(0)
      setTimeout(function() { if (inputRef.current) inputRef.current.focus() }, 30)
    } else {
      setQ('')
      setPlayerResults([])
    }
  }, [open])

  // ESC / arrows / enter handling
  useEffect(function() {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose && onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(function(s) { return s + 1 }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel(function(s) { return Math.max(0, s - 1) }); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        var items = itemsRef.current || []
        var item = items[sel]
        if (item) go(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return function() { window.removeEventListener('keydown', onKey) }
  }, [open, sel])

  var items = useMemo(function() {
    var query = q.trim().toLowerCase()
    var routeItems = ROUTES.map(function(r) {
      return { type: 'route', label: r.label, path: r.path, icon: r.icon, keywords: r.keywords }
    })
    var tournamentItems = tournaments.map(function(t) {
      var nm = t.name || ('Tournament ' + t.id)
      return {
        type: 'tournament',
        label: nm,
        sub: t.phase || '',
        path: '/tournament/' + t.id,
        icon: 'emoji_events',
        keywords: 'tournament clash ' + (t.phase || '')
      }
    })
    var playerItems = playerResults.map(function(p) {
      return {
        type: 'player',
        label: p.username || '',
        sub: [p.rank, p.region].filter(Boolean).join(' - '),
        path: '/player/' + encodeURIComponent(p.username || ''),
        icon: 'person',
        keywords: 'player profile'
      }
    })

    if (!query) {
      // No query: just show nav + tournaments. Players are search-only.
      return routeItems.concat(tournamentItems).slice(0, 40)
    }

    // Score routes + tournaments by query, then prepend player results (already server-filtered).
    var local = routeItems.concat(tournamentItems)
      .map(function(it) { return { it: it, s: score(it, query) } })
      .filter(function(x) { return x.s > 0 })
      .sort(function(a, b) { return b.s - a.s })
      .map(function(x) { return x.it })

    return playerItems.concat(local).slice(0, 40)
  }, [q, tournaments, playerResults])

  // Stash items for Enter handler (avoids closure staleness) — scoped via ref,
  // not a window global.
  useEffect(function() { itemsRef.current = items }, [items])

  // Clamp selection
  useEffect(function() {
    if (sel >= items.length) setSel(Math.max(0, items.length - 1))
  }, [items, sel])

  function go(item) {
    if (!item) return
    navigate(item.path)
    onClose && onClose()
  }

  if (!open) return null

  var query = q.trim()
  var showPlayerHint = query.length >= 1 && query.length < 2
  var showPlayerLoading = playerLoading && query.length >= 2
  var showNoMatches = items.length === 0 && !showPlayerLoading && !showPlayerHint

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={function(e) { if (e.target === e.currentTarget) onClose && onClose() }}
    >
      <div className="w-full max-w-xl bg-surface-container-low border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/10">
          <Icon name="search" size={18} className="text-on-surface/40" />
          <input
            ref={inputRef}
            value={q}
            onChange={function(e) { setQ(e.target.value); setSel(0) }}
            placeholder="Jump to a page, tournament, or search players..."
            className="flex-1 bg-transparent outline-none text-sm text-on-surface placeholder-on-surface/30"
          />
          <kbd className="font-mono text-[10px] text-on-surface/40 border border-outline-variant/20 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {showPlayerHint && (
            <div className="text-center py-3 text-[11px] text-on-surface/40 font-label uppercase tracking-widest">
              Keep typing to search players...
            </div>
          )}
          {showPlayerLoading && items.length === 0 && (
            <div className="text-center py-6 text-[11px] text-on-surface/40 font-label uppercase tracking-widest">
              Searching players...
            </div>
          )}
          {showNoMatches && (
            <div className="text-center py-10 text-xs text-on-surface/40 font-label uppercase tracking-widest">
              No matches
            </div>
          )}
          {items.map(function(it, i) {
            var active = i === sel
            return (
              <button
                key={it.type + ':' + it.path + ':' + i}
                onClick={function() { go(it) }}
                onMouseEnter={function() { setSel(i) }}
                className={'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ' + (active ? 'bg-primary/10 text-on-surface' : 'text-on-surface/80 hover:bg-white/[0.03]')}
              >
                <Icon name={it.icon} size={16} className={active ? 'text-primary' : 'text-on-surface/40'} />
                <span className="flex-1 truncate">{it.label}</span>
                {it.sub && (
                  <span className="text-[10px] font-label uppercase tracking-wider text-on-surface/30">{it.sub}</span>
                )}
                <span className="text-[10px] font-mono text-on-surface/20 uppercase tracking-wider">{it.type}</span>
              </button>
            )
          })}
          {showPlayerLoading && items.length > 0 && (
            <div className="text-center py-2 text-[10px] text-on-surface/30 font-label uppercase tracking-widest">
              Searching players...
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-outline-variant/10 text-[10px] text-on-surface/30 font-label uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono border border-outline-variant/20 rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono border border-outline-variant/20 rounded px-1">↵</kbd> open</span>
          </div>
          <span>{items.length} result{items.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  )
}
