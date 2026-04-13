import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Icon } from '../../components/ui'

var AUDIT_COLS = { INFO: '#4ECDC4', ACTION: '#52C47C', WARN: '#E8A838', RESULT: '#9B72CF', BROADCAST: '#E8A838', DANGER: '#F87171' }

export default function OverviewTab({ setTab }) {
  var ctx = useApp()
  var players = ctx.players
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var auditLog = ctx.auditLog
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var hostApps = ctx.hostApps
  var scheduledEvents = ctx.scheduledEvents

  var _recentActivity = useState([])
  var recentActivity = _recentActivity[0]
  var setRecentActivity = _recentActivity[1]

  var _actLoading = useState(true)
  var actLoading = _actLoading[0]
  var setActLoading = _actLoading[1]

  useEffect(function() {
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(10).then(function(res) {
      setActLoading(false)
      if (res.data) setRecentActivity(res.data)
    }).catch(function() { setActLoading(false) })
  }, [])

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type,
        actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action',
        details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { }).catch(function() {})
    }
  }

  var ts = tournamentState || {}
  var checkedInIds = ts.checkedInIds || []
  var allPlayers = players || []
  var eligible = allPlayers.filter(function(p) { return !p.banned })
  var banned = allPlayers.filter(function(p) { return p.banned }).length
  var pendingHosts = (hostApps || []).filter(function(a) { return a.status === 'pending' }).length

  function checkInAll() {
    if (!window.confirm('Check in all ' + eligible.length + ' eligible players?')) return
    var ids = eligible.map(function(p) { return p.id })
    setTournamentState(function(s) { return Object.assign({}, s, { checkedInIds: ids }) })
    supabase.from('players').update({ checked_in: true }).neq('banned', true).then(function(r) {
      if (r.error) { toast('DB sync failed: ' + r.error.message, 'error'); return }
      addAudit('ACTION', 'Check-in All: ' + ids.length + ' players')
      toast(ids.length + ' players checked in', 'success')
    }).catch(function() { toast('Check-in failed', 'error') })
  }

  function clearCheckIn() {
    if (!window.confirm('Clear all check-ins?')) return
    setTournamentState(function(s) { return Object.assign({}, s, { checkedInIds: [] }) })
    supabase.from('players').update({ checked_in: false }).then(function(r) {
      if (r.error) { toast('DB sync failed: ' + r.error.message, 'error'); return }
      addAudit('ACTION', 'Check-in cleared')
      toast('Check-in cleared', 'success')
    }).catch(function() { toast('Clear check-in failed', 'error') })
  }

  var statCards = [
    { label: 'Players', value: allPlayers.length, icon: 'group', color: 'text-primary' },
    { label: 'Checked In', value: checkedInIds.length, icon: 'how_to_reg', color: 'text-success' },
    { label: 'Banned', value: banned, icon: 'block', color: 'text-error' },
    { label: 'Pending Hosts', value: pendingHosts, icon: 'pending', color: 'text-tertiary' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(function(s) {
          return (
            <Panel key={s.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Icon name={s.icon} size={16} className={s.color} />
                <span className="text-[11px] text-on-surface/50 font-bold uppercase tracking-wider">{s.label}</span>
              </div>
              <div className={'font-stats text-3xl font-black ' + s.color}>{s.value}</div>
            </Panel>
          )
        })}
      </div>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="bolt" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Quick Actions</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" size="sm" onClick={checkInAll}>Check In All</Btn>
          <Btn variant="secondary" size="sm" onClick={clearCheckIn}>Clear Check-In</Btn>
          <Btn variant="secondary" size="sm" onClick={function() { setTab('tournament') }}>Round Controls</Btn>
          <Btn variant="secondary" size="sm" onClick={function() { setTab('settings') }}>Broadcast</Btn>
          {pendingHosts > 0 && (
            <Btn variant="ghost" size="sm" onClick={function() { setTab('hosts') }}>
              {'Review ' + pendingHosts + ' Host App' + (pendingHosts > 1 ? 's' : '')}
            </Btn>
          )}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="history" size={16} className="text-tertiary" />
          <span className="font-bold text-sm text-on-surface">Recent Activity</span>
        </div>
        {actLoading && (
          <div className="text-center py-6 text-on-surface/40 text-sm">Loading...</div>
        )}
        {!actLoading && recentActivity.length === 0 && (
          <div className="text-center py-6 text-on-surface/40 text-sm">No activity logged yet.</div>
        )}
        {recentActivity.map(function(entry) {
          var col = AUDIT_COLS[entry.action] || '#888'
          return (
            <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-outline-variant/5 last:border-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0" style={{ color: col, background: col + '18', border: '1px solid ' + col + '33' }}>{entry.action}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-on-surface">{entry.details && entry.details.message || entry.action}</div>
                <div className="text-[11px] text-on-surface/40 mt-0.5">{entry.actor_name} - {new Date(entry.created_at).toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </Panel>
    </div>
  )
}
