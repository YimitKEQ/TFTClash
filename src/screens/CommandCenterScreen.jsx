import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon, Btn } from '../components/ui'

// ── Refresh interval (30s) ──────────────────────────────────────────────────
var REFRESH_MS = 30000

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '-'
  var diff = Date.now() - new Date(dateStr).getTime()
  var mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  var hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  var days = Math.floor(hrs / 24)
  return days + 'd ago'
}

function phaseBadge(phase) {
  if (!phase) return { label: 'IDLE', color: 'bg-on-surface/10 text-on-surface/40' }
  if (phase === 'registration') return { label: 'REGISTRATION', color: 'bg-tertiary/20 text-tertiary' }
  if (phase === 'live' || phase === 'inprogress') return { label: 'LIVE', color: 'bg-error/20 text-error' }
  if (phase === 'complete') return { label: 'COMPLETE', color: 'bg-success/20 text-success' }
  return { label: phase.toUpperCase(), color: 'bg-on-surface/10 text-on-surface/40' }
}

function tierColor(tier) {
  if (tier === 'host') return '#9B72CF'
  if (tier === 'bundle') return '#E8A838'
  if (tier === 'pro') return '#4ECDC4'
  if (tier === 'scrim') return '#6EE7B7'
  return '#BECBD9'
}

// ── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard(props) {
  var icon = props.icon
  var label = props.label
  var value = props.value
  var sub = props.sub
  var accent = props.accent || 'text-on-surface'
  return (
    <div className="bg-surface-container-low border border-outline-variant/10 rounded-sm p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-on-surface/40">
        <Icon name={icon} size={16} />
        <span className="font-nav text-[10px] uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className={'font-mono text-3xl font-black leading-none ' + accent}>{value}</div>
      {sub && <div className="font-nav text-[10px] text-on-surface/30 uppercase tracking-wider">{sub}</div>}
    </div>
  )
}

// ── Activity Row ────────────────────────────────────────────────────────────

function ActivityRow(props) {
  var item = props.item
  var iconMap = {
    registration: 'how_to_reg',
    checkin: 'check_circle',
    result: 'emoji_events',
    achievement: 'military_tech',
    subscription: 'star',
    admin: 'admin_panel_settings',
  }
  var ico = iconMap[item.type] || 'info'
  var detail = item.detail_json || {}
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/5 last:border-0">
      <Icon name={ico} size={16} className="text-on-surface/30 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-on-surface/70 truncate">{detail.text || item.type}</div>
      </div>
      <div className="font-mono text-[10px] text-on-surface/25 flex-shrink-0">{timeAgo(item.created_at)}</div>
    </div>
  )
}

// ── Tournament Row ──────────────────────────────────────────────────────────

function TournamentRow(props) {
  var t = props.tournament
  var onClick = props.onClick
  var badge = phaseBadge(t.phase)
  var regCount = props.regCount || 0
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3 px-4 border-b border-outline-variant/5 last:border-0 cursor-pointer hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-on-surface truncate">{t.name || 'Unnamed'}</div>
        <div className="font-nav text-[10px] text-on-surface/30 uppercase tracking-wider mt-0.5">
          {t.date || '-'} {t.region ? '/ ' + t.region : ''}
        </div>
      </div>
      <div className="text-right flex items-center gap-3">
        <div className="font-mono text-xs text-on-surface/50">{regCount}/{t.max_players || t.player_cap || '?'}</div>
        <span className={'px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm ' + badge.color}>
          {badge.label}
        </span>
      </div>
    </div>
  )
}

// ── Player Row ──────────────────────────────────────────────────────────────

function PlayerRow(props) {
  var p = props.player
  var onClick = props.onClick
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2 px-3 hover:bg-white/[0.02] cursor-pointer transition-colors border-b border-outline-variant/5 last:border-0"
    >
      <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface/50 flex-shrink-0">
        {(p.username || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-on-surface truncate">{p.username}</div>
        <div className="font-nav text-[10px] text-on-surface/25 uppercase">{p.rank || 'Unranked'} / {p.region || '?'}</div>
      </div>
      <div className="font-mono text-xs text-primary font-bold">{p.season_pts || 0}</div>
    </div>
  )
}

// ── Sub tier bar ────────────────────────────────────────────────────────────

function TierBar(props) {
  var tier = props.tier
  var count = props.count
  var total = props.total
  var pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="font-nav text-[10px] uppercase tracking-wider font-bold w-16 text-on-surface/50">{tier}</div>
      <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + '%', backgroundColor: tierColor(tier) }} />
      </div>
      <div className="font-mono text-xs font-bold text-on-surface/60 w-8 text-right">{count}</div>
    </div>
  )
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function CommandCenterScreen() {
  var ctx = useApp()
  var navigate = useNavigate()
  var currentUser = ctx.currentUser
  var isAdmin = ctx.isAdmin
  var toast = ctx.toast

  // Data state
  var _stats = useState(null)
  var stats = _stats[0]
  var setStats = _stats[1]

  var _tournaments = useState([])
  var tournaments = _tournaments[0]
  var setTournaments = _tournaments[1]

  var _regCounts = useState({})
  var regCounts = _regCounts[0]
  var setRegCounts = _regCounts[1]

  var _players = useState([])
  var players = _players[0]
  var setPlayers = _players[1]

  var _activity = useState([])
  var activity = _activity[0]
  var setActivity = _activity[1]

  var _subs = useState([])
  var subs = _subs[0]
  var setSubs = _subs[1]

  var _recentRegs = useState([])
  var recentRegs = _recentRegs[0]
  var setRecentRegs = _recentRegs[1]

  var _disputes = useState([])
  var disputes = _disputes[0]
  var setDisputes = _disputes[1]

  var _lastRefresh = useState(null)
  var lastRefresh = _lastRefresh[0]
  var setLastRefresh = _lastRefresh[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var refreshTimer = useRef(null)

  // ── Fetch all data ──────────────────────────────────────────────────────
  function fetchAll() {
    var promises = []

    // KPI stats via multiple count queries
    promises.push(
      Promise.all([
        supabase.from('players').select('id', { count: 'exact', head: true }),
        supabase.from('user_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('tournaments').select('id', { count: 'exact', head: true }),
        supabase.from('registrations').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
        supabase.from('host_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]).then(function(results) {
        setStats({
          players: results[0].count || 0,
          activeSubs: results[1].count || 0,
          tournaments: results[2].count || 0,
          registrations: results[3].count || 0,
          newsletter: results[4].count || 0,
          pendingHosts: results[5].count || 0,
          openDisputes: results[6].count || 0,
        })
      })
    )

    // Tournaments with registration counts
    promises.push(
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }).limit(20)
        .then(function(res) {
          var ts = res.data || []
          setTournaments(ts)
          // Get reg counts per tournament
          if (ts.length > 0) {
            var ids = ts.map(function(t) { return t.id })
            supabase.from('registrations').select('tournament_id').in('tournament_id', ids)
              .then(function(regRes) {
                var counts = {}
                ;(regRes.data || []).forEach(function(r) {
                  counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1
                })
                setRegCounts(counts)
              })
          }
        })
    )

    // Top players
    promises.push(
      supabase.from('players').select('id,username,rank,region,season_pts,wins,games,tier')
        .order('season_pts', { ascending: false }).limit(15)
        .then(function(res) { setPlayers(res.data || []) })
    )

    // Recent activity
    promises.push(
      supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(20)
        .then(function(res) { setActivity(res.data || []) })
    )

    // Active subscriptions
    promises.push(
      supabase.from('user_subscriptions').select('tier,status,created_at').eq('status', 'active')
        .then(function(res) { setSubs(res.data || []) })
    )

    // Recent registrations
    promises.push(
      supabase.from('registrations').select('id,player_id,tournament_id,status,created_at')
        .order('created_at', { ascending: false }).limit(10)
        .then(function(res) { setRecentRegs(res.data || []) })
    )

    // Open disputes
    promises.push(
      supabase.from('disputes').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(5)
        .then(function(res) { setDisputes(res.data || []) })
    )

    Promise.all(promises).then(function() {
      setLoading(false)
      setLastRefresh(new Date())
    }).catch(function() {
      setLoading(false)
    })
  }

  useEffect(function() {
    fetchAll()
    refreshTimer.current = setInterval(fetchAll, REFRESH_MS)
    return function() { clearInterval(refreshTimer.current) }
  }, [])

  // ── Computed ────────────────────────────────────────────────────────────
  var tierCounts = {}
  subs.forEach(function(s) { tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1 })
  var totalSubs = subs.length

  var activeTournaments = tournaments.filter(function(t) {
    return t.phase === 'registration' || t.phase === 'live' || t.phase === 'inprogress'
  })

  var mrr = (tierCounts.pro || 0) * 4.99
    + (tierCounts.scrim || 0) * 9.99
    + (tierCounts.bundle || 0) * 14.99
    + (tierCounts.host || 0) * 24.99

  // ── Auth gate ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-on-surface/40">
            <Icon name="lock" size={40} className="block mx-auto mb-3" />
            <div className="text-sm font-semibold">Command Center requires admin access</div>
          </div>
        </div>
      </PageLayout>
    )
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[60vh] gap-3 text-on-surface/30">
          <Icon name="radar" size={24} className="animate-spin" />
          <span className="font-nav text-sm uppercase tracking-widest">Loading Command Center...</span>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="radar" size={28} className="text-primary" />
            <div>
              <h1 className="font-display text-2xl font-bold text-on-surface tracking-tight">Command Center</h1>
              <div className="font-nav text-[10px] text-on-surface/30 uppercase tracking-widest">
                Live platform overview
                {lastRefresh && (' / refreshed ' + lastRefresh.toLocaleTimeString())}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn v="dark" s="sm" onClick={function() { setLoading(true); fetchAll() }}>
              <Icon name="refresh" size={14} /> Refresh
            </Btn>
            <Btn v="dark" s="sm" onClick={function() { navigate('/admin') }}>
              <Icon name="admin_panel_settings" size={14} /> Admin Panel
            </Btn>
          </div>
        </div>

        {/* ── KPI Strip ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KpiCard icon="group" label="Players" value={stats ? stats.players : '-'} accent="text-on-surface" />
          <KpiCard icon="star" label="Active Subs" value={stats ? stats.activeSubs : '-'} accent="text-tertiary" />
          <KpiCard icon="payments" label="MRR" value={'$' + mrr.toFixed(0)} accent="text-primary" sub="Monthly recurring" />
          <KpiCard icon="emoji_events" label="Tournaments" value={stats ? stats.tournaments : '-'} accent="text-on-surface" />
          <KpiCard icon="how_to_reg" label="Registrations" value={stats ? stats.registrations : '-'} accent="text-on-surface" />
          <KpiCard icon="mail" label="Newsletter" value={stats ? stats.newsletter : '-'} accent="text-on-surface" />
          <KpiCard icon="gavel" label="Open Disputes" value={stats ? stats.openDisputes : '-'} accent={stats && stats.openDisputes > 0 ? 'text-error' : 'text-on-surface'} />
        </div>

        {/* ── Alerts strip ─────────────────────────────────────────────── */}
        {(stats && (stats.pendingHosts > 0 || stats.openDisputes > 0)) && (
          <div className="flex flex-wrap gap-3">
            {stats.pendingHosts > 0 && (
              <div
                onClick={function() { navigate('/admin') }}
                className="flex items-center gap-2 px-4 py-2.5 bg-secondary/10 border border-secondary/20 rounded-sm cursor-pointer hover:bg-secondary/15 transition-colors"
              >
                <Icon name="pending_actions" size={16} className="text-secondary" />
                <span className="font-nav text-xs font-bold uppercase tracking-wider text-secondary">
                  {stats.pendingHosts} pending host application{stats.pendingHosts > 1 ? 's' : ''}
                </span>
              </div>
            )}
            {stats.openDisputes > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-error/10 border border-error/20 rounded-sm">
                <Icon name="report" size={16} className="text-error" />
                <span className="font-nav text-xs font-bold uppercase tracking-wider text-error">
                  {stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left: Tournaments + Activity (2 cols) ────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Active tournaments */}
            <Panel className="!p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="emoji_events" size={18} className="text-primary" />
                  <span className="font-nav text-xs font-bold uppercase tracking-widest text-on-surface/60">
                    Tournaments ({tournaments.length})
                  </span>
                </div>
                <Btn v="dark" s="sm" onClick={function() { navigate('/admin') }}>
                  Manage
                </Btn>
              </div>
              {tournaments.length === 0 ? (
                <div className="py-10 text-center text-on-surface/20 text-xs font-nav uppercase tracking-widest">No tournaments yet</div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  {tournaments.map(function(t) {
                    return (
                      <TournamentRow
                        key={t.id}
                        tournament={t}
                        regCount={regCounts[t.id] || 0}
                        onClick={function() { navigate('/tournament/' + t.id) }}
                      />
                    )
                  })}
                </div>
              )}
            </Panel>

            {/* Recent activity feed */}
            <Panel className="!p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
                <Icon name="dynamic_feed" size={18} className="text-tertiary" />
                <span className="font-nav text-xs font-bold uppercase tracking-widest text-on-surface/60">
                  Activity Feed
                </span>
              </div>
              {activity.length === 0 ? (
                <div className="py-10 text-center text-on-surface/20 text-xs font-nav uppercase tracking-widest">No activity yet</div>
              ) : (
                <div className="px-4 max-h-[280px] overflow-y-auto">
                  {activity.map(function(a) {
                    return <ActivityRow key={a.id} item={a} />
                  })}
                </div>
              )}
            </Panel>

            {/* Open disputes */}
            {disputes.length > 0 && (
              <Panel className="!p-0 overflow-hidden border-error/20">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
                  <Icon name="gavel" size={18} className="text-error" />
                  <span className="font-nav text-xs font-bold uppercase tracking-widest text-error/80">
                    Open Disputes ({disputes.length})
                  </span>
                </div>
                <div className="px-4 py-2">
                  {disputes.map(function(d) {
                    return (
                      <div key={d.id} className="py-2.5 border-b border-outline-variant/5 last:border-0">
                        <div className="text-xs font-bold text-on-surface">{d.title || 'Dispute #' + d.id}</div>
                        <div className="text-[10px] text-on-surface/30 mt-0.5">{timeAgo(d.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )}
          </div>

          {/* ── Right sidebar ────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Quick actions */}
            <Panel className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="bolt" size={16} className="text-primary" />
                <span className="font-nav text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Quick Actions</span>
              </div>
              <div className="space-y-2">
                <button
                  onClick={function() { navigate('/admin') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/10 rounded-sm text-left transition-colors cursor-pointer"
                >
                  <Icon name="add_circle" size={16} className="text-primary" />
                  <span className="text-xs font-bold text-on-surface">Create Tournament</span>
                </button>
                <button
                  onClick={function() { navigate('/admin') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/10 rounded-sm text-left transition-colors cursor-pointer"
                >
                  <Icon name="group_add" size={16} className="text-tertiary" />
                  <span className="text-xs font-bold text-on-surface">Manage Players</span>
                </button>
                <button
                  onClick={function() { navigate('/bracket') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/10 rounded-sm text-left transition-colors cursor-pointer"
                >
                  <Icon name="view_kanban" size={16} className="text-secondary" />
                  <span className="text-xs font-bold text-on-surface">Open Bracket</span>
                </button>
                <button
                  onClick={function() { navigate('/events') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant/10 rounded-sm text-left transition-colors cursor-pointer"
                >
                  <Icon name="calendar_today" size={16} className="text-on-surface/50" />
                  <span className="text-xs font-bold text-on-surface">View Events</span>
                </button>
              </div>
            </Panel>

            {/* Revenue / Subscriptions */}
            <Panel className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="monetization_on" size={16} className="text-primary" />
                <span className="font-nav text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Subscriptions</span>
              </div>
              {totalSubs === 0 ? (
                <div className="text-center py-4 text-on-surface/20 text-[10px] font-nav uppercase tracking-widest">No active subs yet</div>
              ) : (
                <div className="space-y-1">
                  <TierBar tier="host" count={tierCounts.host || 0} total={totalSubs} />
                  <TierBar tier="bundle" count={tierCounts.bundle || 0} total={totalSubs} />
                  <TierBar tier="pro" count={tierCounts.pro || 0} total={totalSubs} />
                  <TierBar tier="scrim" count={tierCounts.scrim || 0} total={totalSubs} />
                  <div className="border-t border-outline-variant/10 mt-2 pt-2 flex justify-between items-center">
                    <span className="font-nav text-[10px] uppercase tracking-wider text-on-surface/40 font-bold">MRR</span>
                    <span className="font-mono text-lg font-black text-primary">${mrr.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </Panel>

            {/* Top players */}
            <Panel className="!p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center gap-2">
                <Icon name="leaderboard" size={16} className="text-primary" />
                <span className="font-nav text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Top Players</span>
              </div>
              {players.length === 0 ? (
                <div className="py-8 text-center text-on-surface/20 text-[10px] font-nav uppercase tracking-widest">No players yet</div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  {players.map(function(p) {
                    return (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        onClick={function() { navigate('/player/' + p.username) }}
                      />
                    )
                  })}
                </div>
              )}
            </Panel>

            {/* System health */}
            <Panel className="!p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="monitor_heart" size={16} className="text-success" />
                <span className="font-nav text-[10px] font-bold uppercase tracking-widest text-on-surface/50">System</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface/40 font-nav uppercase tracking-wider">Database</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-[10px] font-bold text-success">Connected</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface/40 font-nav uppercase tracking-wider">Active Tourney</span>
                  <span className="text-[10px] font-bold text-on-surface/60">
                    {activeTournaments.length > 0 ? activeTournaments.length + ' running' : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface/40 font-nav uppercase tracking-wider">Auto-refresh</span>
                  <span className="text-[10px] font-bold text-on-surface/60">Every {REFRESH_MS / 1000}s</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
