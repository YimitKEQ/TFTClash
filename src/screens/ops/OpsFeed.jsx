import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { timeAgo } from '../../lib/utils.js'
import { Panel, Btn, Icon } from '../../components/ui'

var ICON_MAP = {
  registration: 'how_to_reg',
  checkin: 'check_circle',
  result: 'emoji_events',
  achievement: 'military_tech',
  subscription: 'star',
  admin: 'admin_panel_settings',
  tournament: 'emoji_events',
  scrim: 'sports_esports',
}

var TYPE_COLORS = {
  registration: 'text-tertiary',
  checkin: 'text-success',
  result: 'text-primary',
  achievement: 'text-secondary',
  subscription: 'text-primary',
  admin: 'text-on-surface/50',
  tournament: 'text-primary',
  scrim: 'text-tertiary',
}

export default function OpsFeed() {
  var _activity = useState([])
  var activity = _activity[0]
  var setActivity = _activity[1]

  var _recentRegs = useState([])
  var recentRegs = _recentRegs[0]
  var setRecentRegs = _recentRegs[1]

  var _auditLog = useState([])
  var auditLog = _auditLog[0]
  var setAuditLog = _auditLog[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _filter = useState('all')
  var filter = _filter[0]
  var setFilter = _filter[1]

  useEffect(function() {
    var cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('registrations').select('id, player_id, tournament_id, status, created_at, players(username), tournaments(name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
    ]).then(function(results) {
      if (cancelled) return
      if (results[0].error) console.warn('Activity feed query failed:', results[0].error.message)
      if (results[1].error) console.warn('Registrations query failed:', results[1].error.message)
      if (results[2].error) console.warn('Audit log query failed:', results[2].error.message)
      setActivity(results[0].data || [])
      setRecentRegs(results[1].data || [])
      setAuditLog(results[2].data || [])
      setLoading(false)
    }).catch(function(err) { if (!cancelled) { console.warn('Feed fetch error:', err); setLoading(false) } })
    return function() { cancelled = true }
  }, [])

  var filteredActivity = filter === 'all'
    ? activity
    : activity.filter(function(a) { return a.type === filter })

  if (loading) {
    return (
      <div className="py-12 text-center text-on-surface/30 text-xs font-label uppercase tracking-widest">Loading feed...</div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Activity Feed (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          <Panel className="!p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="dynamic_feed" size={18} className="text-tertiary" />
                <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
                  Activity Feed ({activity.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filter}
                  onChange={function(e) { setFilter(e.target.value) }}
                  className="bg-surface-container border border-outline-variant/10 rounded px-2 py-1 text-xs text-on-surface appearance-none cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="registration">Registrations</option>
                  <option value="checkin">Check-ins</option>
                  <option value="result">Results</option>
                  <option value="achievement">Achievements</option>
                  <option value="subscription">Subscriptions</option>
                  <option value="admin">Admin</option>
                </select>
                <Btn v="dark" s="sm" onClick={fetchFeed}>
                  <Icon name="refresh" size={14} />
                </Btn>
              </div>
            </div>
            {filteredActivity.length === 0 ? (
              <div className="py-12 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">No activity yet</div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                {filteredActivity.map(function(a) {
                  var ico = ICON_MAP[a.type] || 'info'
                  var color = TYPE_COLORS[a.type] || 'text-on-surface/30'
                  var detail = a.detail_json || {}
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 last:border-0 hover:bg-white/[0.01]">
                      <Icon name={ico} size={16} className={color + ' flex-shrink-0'} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-on-surface/70 truncate">{detail.text || a.type}</div>
                      </div>
                      <span className={'text-[9px] px-1.5 py-0.5 font-bold rounded uppercase shrink-0 ' + (a.type === 'admin' ? 'bg-on-surface/10 text-on-surface/40' : 'bg-primary/10 text-primary/60')}>
                        {a.type}
                      </span>
                      <div className="font-mono text-[10px] text-on-surface/25 flex-shrink-0">{timeAgo(a.created_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>

          {/* Audit Log */}
          <Panel className="!p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
              <Icon name="assignment" size={16} className="text-on-surface/40" />
              <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
                Audit Log ({auditLog.length})
              </span>
            </div>
            {auditLog.length === 0 ? (
              <div className="py-8 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">No audit entries</div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                {auditLog.map(function(entry, i) {
                  var details = entry.details || {}
                  var isDanger = entry.action === 'DANGER' || entry.action === 'WARN'
                  return (
                    <div key={entry.id || i} className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/5 last:border-0">
                      <span className={'text-[9px] px-1.5 py-0.5 font-bold rounded uppercase shrink-0 ' + (isDanger ? 'bg-error/15 text-error' : 'bg-on-surface/10 text-on-surface/40')}>
                        {entry.action}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-on-surface/60 truncate">{details.message || entry.action}</div>
                      </div>
                      <span className="text-[10px] text-on-surface/25 shrink-0">{entry.actor_name || '-'}</span>
                      <span className="font-mono text-[10px] text-on-surface/25 shrink-0">{timeAgo(entry.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* Recent Registrations */}
        <Panel className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/10 flex items-center gap-2">
            <Icon name="how_to_reg" size={16} className="text-tertiary" />
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Recent Registrations</span>
          </div>
          {recentRegs.length === 0 ? (
            <div className="py-8 text-center text-on-surface/20 text-[10px] font-label uppercase tracking-widest">No registrations</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {recentRegs.map(function(r) {
                var player = r.players || {}
                var tournament = r.tournaments || {}
                return (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-outline-variant/5 last:border-0">
                    <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-[9px] font-bold text-on-surface/50 flex-shrink-0">
                      {(player.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-on-surface truncate">{player.username || 'Unknown'}</div>
                      <div className="font-label text-[10px] text-on-surface/25 truncate">{tournament.name || 'Unknown tournament'}</div>
                    </div>
                    <div className="font-mono text-[10px] text-on-surface/25 shrink-0">{timeAgo(r.created_at)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
