import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui'
import { supabase } from '../../lib/supabase.js'
import RegionBadge from './RegionBadge'

var ACTIVE_PHASES = ['registration', 'check_in', 'in_progress', 'live']

var PHASE_META = {
  registration: { label: 'Registration', icon: 'how_to_reg', tone: 'secondary' },
  check_in:     { label: 'Check-In',     icon: 'task_alt',   tone: 'primary' },
  in_progress:  { label: 'Live Now',     icon: 'bolt',       tone: 'tertiary' },
  live:         { label: 'Live Now',     icon: 'bolt',       tone: 'tertiary' },
}

var TONE_BADGE = {
  primary:   'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-secondary/15 text-secondary border-secondary/30',
  tertiary:  'bg-tertiary/15 text-tertiary border-tertiary/30',
}

function shortDate(d) {
  if (!d) return ''
  try {
    var dt = new Date(d)
    if (isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return ''
  }
}

function LiveTournamentRow(props) {
  var t = props.tournament
  var regCount = props.regCount || 0
  var onView = props.onView
  var meta = PHASE_META[t.phase] || PHASE_META.registration
  var badge = TONE_BADGE[meta.tone] || TONE_BADGE.primary
  var maxP = t.max_players || 128
  var pct = Math.min(100, Math.round((regCount / maxP) * 100))
  var pulse = t.phase === 'in_progress' || t.phase === 'live'

  return (
    <button
      type="button"
      onClick={onView}
      className="w-full text-left rounded-xl border border-outline-variant/15 bg-surface-container-low/60 hover:bg-surface-container hover:border-primary/30 transition-colors p-3 sm:p-4 flex items-center gap-3 group"
    >
      <span className="relative flex-shrink-0">
        <span className={'inline-flex items-center justify-center w-9 h-9 rounded-lg border ' + badge}>
          <Icon name={meta.icon} size={18} />
        </span>
        {pulse && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary"></span>
          </span>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={'text-[9px] font-label tracking-widest uppercase font-bold px-1.5 py-0.5 rounded border ' + badge}>
            {meta.label}
          </span>
          {t.region && <RegionBadge region={t.region} size="sm" />}
          {t.host && (
            <span className="text-[9px] font-label tracking-widest uppercase text-on-surface-variant/40">
              {String(t.host).slice(0, 16)}
            </span>
          )}
        </div>
        <div className="font-display text-sm tracking-wide text-on-surface mt-1 truncate">
          {t.name || 'Untitled tournament'}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-on-surface-variant/60">
          {t.date && <span>{shortDate(t.date)}</span>}
          <span>{regCount}/{maxP}</span>
          <span className="flex-1 h-1 rounded-full bg-surface-container-high overflow-hidden max-w-[100px]">
            <span
              className={'block h-full rounded-full ' + (meta.tone === 'tertiary' ? 'bg-tertiary' : meta.tone === 'secondary' ? 'bg-secondary' : 'bg-primary')}
              style={{ width: pct + '%' }}
            ></span>
          </span>
        </div>
      </div>
      <Icon name="chevron_right" size={20} className="text-on-surface-variant/40 group-hover:text-primary flex-shrink-0" />
    </button>
  )
}

export default function LiveNowPanel(props) {
  var limit = props.limit || 4
  var navigate = useNavigate()

  var _items = useState([])
  var items = _items[0]
  var setItems = _items[1]

  var _counts = useState({})
  var counts = _counts[0]
  var setCounts = _counts[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  useEffect(function () {
    if (!supabase || !supabase.from) {
      setLoading(false)
      return
    }
    var cancelled = false
    supabase.from('tournaments').select('id,name,phase,date,region,host,max_players,status').in('phase', ACTIVE_PHASES).order('date', { ascending: true }).limit(20)
      .then(function (res) {
        if (cancelled) return
        setLoading(false)
        if (res && res.data) {
          var visible = res.data.filter(function (t) { return t.status !== 'draft' })
          setItems(visible)
        }
      })
      .catch(function () { if (!cancelled) setLoading(false) })
    return function () { cancelled = true }
  }, [])

  useEffect(function () {
    if (items.length === 0) return
    var ids = items.map(function (t) { return t.id })
    var cancelled = false
    // Cap defensively. With up to 20 active tournaments the realistic ceiling is
    // ~2k regs total; if we ever exceed this the count becomes a lower bound,
    // which is a benign UX degradation (bar fill caps at max_players anyway).
    supabase.from('registrations').select('tournament_id').in('tournament_id', ids).limit(2000)
      .then(function (res) {
        if (cancelled || !res || !res.data) return
        var c = {}
        res.data.forEach(function (r) {
          c[r.tournament_id] = (c[r.tournament_id] || 0) + 1
        })
        setCounts(c)
      })
      .catch(function () {})
    return function () { cancelled = true }
  }, [items])

  if (loading) {
    return (
      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="bolt" className="text-tertiary" />
          <h3 className="font-display text-base tracking-wide">LIVE NOW</h3>
        </div>
        <div className="text-xs text-on-surface-variant/50 font-mono">Loading active tournaments...</div>
      </div>
    )
  }

  if (items.length === 0) return null

  var visibleItems = items.slice(0, limit)
  var hidden = Math.max(0, items.length - visibleItems.length)

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary"></span>
          </span>
          <h3 className="font-display text-base tracking-wide">LIVE NOW</h3>
          <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
            {items.length} active
          </span>
        </div>
        <button
          type="button"
          onClick={function () { navigate('/events') }}
          className="text-[10px] font-label tracking-widest uppercase text-primary hover:text-primary/80 flex items-center gap-1"
        >
          See all
          <Icon name="arrow_forward" size={12} />
        </button>
      </div>
      <div className="space-y-2">
        {visibleItems.map(function (t) {
          return (
            <LiveTournamentRow
              key={t.id}
              tournament={t}
              regCount={counts[t.id] || 0}
              onView={function () { navigate('/tournament/' + t.id) }}
            />
          )
        })}
      </div>
      {hidden > 0 && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={function () { navigate('/events') }}
            className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/50 hover:text-on-surface"
          >
            +{hidden} more active
          </button>
        </div>
      )}
    </div>
  )
}
