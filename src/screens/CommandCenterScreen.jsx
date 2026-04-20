import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon, Btn } from '../components/ui'
import { TIER_PRICES } from '../lib/paypal.js'
import OpsOverview from './ops/OpsOverview'
import OpsTournaments from './ops/OpsTournaments'
import OpsPlayers from './ops/OpsPlayers'
import OpsComms from './ops/OpsComms'
import OpsRevenue from './ops/OpsRevenue'
import OpsFeed from './ops/OpsFeed'
import OpsMaintenance from './ops/OpsMaintenance'

var REFRESH_MS = 30000

var TABS = [
  { id: 'overview',    label: 'Overview',     icon: 'dashboard' },
  { id: 'tournaments', label: 'Tournaments',  icon: 'emoji_events' },
  { id: 'players',     label: 'Players',      icon: 'group' },
  { id: 'comms',       label: 'Comms',        icon: 'campaign' },
  { id: 'revenue',     label: 'Revenue',      icon: 'payments' },
  { id: 'feed',        label: 'Live Feed',    icon: 'dynamic_feed' },
  { id: 'maintenance', label: 'Maintenance',  icon: 'build' },
]

export default function CommandCenterScreen() {
  var ctx = useApp()
  var navigate = useNavigate()
  var isAdmin = ctx.isAdmin
  var toast = ctx.toast

  var _tab = useState('overview')
  var tab = _tab[0]
  var setTab = _tab[1]

  // Global data for overview KPIs
  var _stats = useState(null)
  var stats = _stats[0]
  var setStats = _stats[1]

  var _tournaments = useState([])
  var tournaments = _tournaments[0]
  var setTournaments = _tournaments[1]

  var _regCounts = useState({})
  var regCounts = _regCounts[0]
  var setRegCounts = _regCounts[1]

  var _subs = useState([])
  var subs = _subs[0]
  var setSubs = _subs[1]

  var _launch = useState(null)
  var launch = _launch[0]
  var setLaunch = _launch[1]

  var _lastRefresh = useState(null)
  var lastRefresh = _lastRefresh[0]
  var setLastRefresh = _lastRefresh[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var refreshTimer = useRef(null)
  var mountedRef = useRef(true)

  function fetchAll() {
    var promises = []

    // KPI stats
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

    // Tournaments
    promises.push(
      supabase.from('tournaments').select('*').order('created_at', { ascending: false }).limit(50)
        .then(function(res) {
          var ts = res.data || []
          setTournaments(ts)
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

    // Active subs
    promises.push(
      supabase.from('user_subscriptions').select('tier,status').eq('status', 'active')
        .then(function(res) { setSubs(res.data || []) })
    )

    // Launch analytics views (KPIs + 14d signup trend + 4w revenue trend)
    promises.push(
      Promise.all([
        supabase.from('v_launch_kpis').select('*').limit(1).maybeSingle(),
        supabase.from('v_daily_signups').select('*').limit(14),
        supabase.from('v_weekly_revenue').select('*').limit(20),
        supabase.from('v_daily_active_players').select('*').limit(7),
      ]).then(function(r) {
        setLaunch({
          kpis: (r[0] && r[0].data) || null,
          signups: (r[1] && r[1].data) || [],
          revenue: (r[2] && r[2].data) || [],
          active: (r[3] && r[3].data) || [],
        })
      }).catch(function() { /* views optional — ignore if missing */ })
    )

    Promise.all(promises).then(function() {
      setLoading(false)
      setLastRefresh(new Date())
    }).catch(function() {
      setLoading(false)
    }).finally(function() {
      // Schedule next refresh only after current completes (no overlapping fetches)
      if (mountedRef.current) refreshTimer.current = setTimeout(fetchAll, REFRESH_MS)
    })
  }

  useEffect(function() {
    fetchAll()
    return function() { mountedRef.current = false; clearTimeout(refreshTimer.current) }
  }, [])

  // Computed
  var tierCounts = {}
  subs.forEach(function(s) { tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1 })

  var mrr = (tierCounts.pro || 0) * TIER_PRICES.pro
    + (tierCounts.scrim || 0) * TIER_PRICES.scrim
    + (tierCounts.bundle || 0) * TIER_PRICES.bundle
    + (tierCounts.host || 0) * TIER_PRICES.host

  var activeTournaments = tournaments.filter(function(t) {
    return t.phase === 'registration' || t.phase === 'live' || t.phase === 'inprogress' || t.phase === 'checkin'
  })

  // Auth gate
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
          <span className="font-label text-sm uppercase tracking-widest">Initializing Command Center...</span>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* JARVIS Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon name="radar" size={32} className="text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-pulse border-2 border-[#13131A]" />
            </div>
            <div>
              <h1 className="font-editorial italic text-2xl font-bold text-on-surface tracking-tight">Command Center</h1>
              <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-widest flex items-center gap-2">
                <span className={'w-1.5 h-1.5 rounded-full animate-pulse ' + (stats && stats.openDisputes > 0 ? 'bg-error' : 'bg-success')} />
                <span>{stats && stats.openDisputes > 0 ? stats.openDisputes + ' open dispute' + (stats.openDisputes > 1 ? 's' : '') : 'All systems operational'}</span>
                {lastRefresh && (
                  <span className="text-on-surface/20">/ {lastRefresh.toLocaleTimeString()}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn v="dark" s="sm" onClick={function() { clearTimeout(refreshTimer.current); setLoading(true); fetchAll() }}>
              <Icon name="refresh" size={14} /> Refresh
            </Btn>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 border-b border-outline-variant/10 pb-0">
          {TABS.map(function(t) {
            var isActive = tab === t.id
            var hasBadge = t.id === 'comms' && stats && stats.openDisputes > 0
            return (
              <button
                key={t.id}
                onClick={function() { setTab(t.id) }}
                className={'flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all relative border-b-2 -mb-px ' + (isActive ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-on-surface/40 hover:text-on-surface/70 hover:bg-white/[0.02]')}
              >
                <Icon name={t.icon} size={15} />
                {t.label}
                {hasBadge && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-error text-white rounded-full leading-none">
                    {stats.openDisputes}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div>
          {tab === 'overview' && (
            <OpsOverview
              stats={stats}
              mrr={mrr}
              activeTournaments={activeTournaments}
              lastRefresh={lastRefresh}
              launch={launch}
              goTab={setTab}
              navigate={navigate}
            />
          )}
          {tab === 'tournaments' && (
            <OpsTournaments
              tournaments={tournaments}
              regCounts={regCounts}
              navigate={navigate}
              onRefresh={fetchAll}
            />
          )}
          {tab === 'players' && (
            <OpsPlayers navigate={navigate} />
          )}
          {tab === 'comms' && (
            <OpsComms />
          )}
          {tab === 'revenue' && (
            <OpsRevenue />
          )}
          {tab === 'feed' && (
            <OpsFeed />
          )}
          {tab === 'maintenance' && (
            <OpsMaintenance />
          )}
        </div>
      </div>
    </PageLayout>
  )
}
