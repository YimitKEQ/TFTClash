import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { sanitize, timeAgo, addAudit as sharedAddAudit } from '../../lib/utils.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'

export default function OpsComms() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var setAnnouncement = ctx.setAnnouncement
  var tickerOverrides = ctx.tickerOverrides
  var setTickerOverrides = ctx.setTickerOverrides

  // Announcements
  var _broadType = useState('NOTICE')
  var broadType = _broadType[0]
  var setBroadType = _broadType[1]

  var _broadMsg = useState('')
  var broadMsg = _broadMsg[0]
  var setBroadMsg = _broadMsg[1]

  var _announcements = useState([])
  var announcements = _announcements[0]
  var setAnnouncements = _announcements[1]

  // Ticker
  var _newTicker = useState('')
  var newTicker = _newTicker[0]
  var setNewTicker = _newTicker[1]

  // Disputes
  var _disputes = useState([])
  var disputes = _disputes[0]
  var setDisputes = _disputes[1]

  var _disputesLoading = useState(true)
  var disputesLoading = _disputesLoading[0]
  var setDisputesLoading = _disputesLoading[1]

  // Notifications
  var _notifMsg = useState('')
  var notifMsg = _notifMsg[0]
  var setNotifMsg = _notifMsg[1]

  var _notifTarget = useState('all')
  var notifTarget = _notifTarget[0]
  var setNotifTarget = _notifTarget[1]

  useEffect(function() {
    supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(50)
      .then(function(res) {
        setDisputesLoading(false)
        if (res.data) setDisputes(res.data)
      }).catch(function() { setDisputesLoading(false) })

    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(20)
      .then(function(res) {
        if (res.data) setAnnouncements(res.data)
      }).catch(function() {})
  }, [])

  function addAudit(type, msg) { sharedAddAudit(supabase, currentUser, type, msg) }

  function sendBroadcast() {
    if (!broadMsg.trim()) { toast('Message required', 'error'); return }
    var safeMsg = sanitize(broadMsg.trim())
    supabase.from('announcements').insert({
      type: broadType, message: safeMsg,
      created_by: currentUser ? currentUser.id : null
    }).then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
      setAnnouncement(broadType + ': ' + safeMsg)
      setAnnouncements(function(a) { return [{ type: broadType, message: safeMsg, created_at: new Date().toISOString(), created_by: currentUser ? currentUser.id : null }].concat(a) })
      addAudit('ACTION', 'Broadcast: [' + broadType + '] ' + safeMsg)
      toast('Broadcast sent!', 'success')
      setBroadMsg('')
    }).catch(function() { toast('Broadcast failed', 'error') })
  }

  function sendNotification() {
    if (!notifMsg.trim()) { toast('Message required', 'error'); return }
    if (notifMsg.trim().length > 500) { toast('Message too long (500 char max)', 'error'); return }
    if (!window.confirm('Send notification to all players?')) return
    if (notifTarget === 'all') {
      supabase.from('players').select('id').then(function(res) {
        var playerIds = (res.data || []).map(function(p) { return p.id })
        var rows = playerIds.map(function(pid) {
          return { user_id: pid, type: 'admin', title: 'Admin Notification', message: sanitize(notifMsg.trim()), read: false }
        })
        if (rows.length === 0) { toast('No players to notify', 'error'); return }
        supabase.from('notifications').insert(rows).then(function(r) {
          if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
          addAudit('ACTION', 'Mass notification sent to ' + rows.length + ' players')
          toast('Notification sent to ' + rows.length + ' players!', 'success')
          setNotifMsg('')
        }).catch(function() { toast('Failed', 'error') })
      }).catch(function() { toast('Failed to load players', 'error') })
    }
  }

  function addTicker() {
    var msg = newTicker.trim()
    if (!msg) { toast('Enter ticker text', 'error'); return }
    var updated = (tickerOverrides || []).concat([msg])
    setTickerOverrides(updated)
    supabase.from('site_settings').upsert({ key: 'ticker_overrides', value: JSON.stringify(updated) }, { onConflict: 'key' })
      .then(function() {}).catch(function() {})
    addAudit('ACTION', 'Ticker added: ' + msg)
    setNewTicker('')
    toast('Ticker added', 'success')
  }

  function removeTicker(idx) {
    var updated = (tickerOverrides || []).filter(function(_, i) { return i !== idx })
    setTickerOverrides(updated)
    supabase.from('site_settings').upsert({ key: 'ticker_overrides', value: JSON.stringify(updated) }, { onConflict: 'key' })
      .then(function() {}).catch(function() {})
    toast('Ticker removed', 'success')
  }

  function resolveDispute(id) {
    setDisputes(function(ds) { return ds.map(function(d) { return d.id === id ? Object.assign({}, d, { status: 'resolved_accepted' }) : d }) })
    supabase.from('disputes').update({ status: 'resolved_accepted', resolved_by: currentUser ? currentUser.auth_user_id : null, resolved_at: new Date().toISOString() }).eq('id', id)
      .then(function(r) { if (r.error) toast('Resolve failed', 'error') })
      .catch(function() { toast('Resolve failed', 'error') })
    addAudit('ACTION', 'Dispute resolved: #' + id)
    toast('Dispute resolved', 'success')
  }

  function dismissDispute(id) {
    setDisputes(function(ds) { return ds.map(function(d) { return d.id === id ? Object.assign({}, d, { status: 'resolved_rejected' }) : d }) })
    supabase.from('disputes').update({ status: 'resolved_rejected', resolved_by: currentUser ? currentUser.auth_user_id : null, resolved_at: new Date().toISOString() }).eq('id', id)
      .then(function(r) { if (r.error) toast('Dismiss failed', 'error') })
      .catch(function() { toast('Dismiss failed', 'error') })
    addAudit('ACTION', 'Dispute dismissed: #' + id)
    toast('Dispute dismissed', 'success')
  }

  var openDisputes = disputes.filter(function(d) { return d.status === 'open' })
  var closedDisputes = disputes.filter(function(d) { return d.status !== 'open' })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Broadcast */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="campaign" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Send Announcement</span>
          </div>
          <div className="space-y-3">
            <Sel value={broadType} onChange={setBroadType}>
              <option value="NOTICE">Notice</option>
              <option value="ALERT">Alert</option>
              <option value="UPDATE">Update</option>
              <option value="HYPE">Hype</option>
            </Sel>
            <textarea
              value={broadMsg}
              onChange={function(e) { setBroadMsg(e.target.value) }}
              rows={3}
              className="w-full bg-surface-container border border-outline-variant/10 rounded px-3 py-2.5 text-on-surface text-sm resize-y focus:outline-none focus:border-primary/40"
              placeholder="Type your announcement..."
            />
            <Btn v="primary" onClick={sendBroadcast}>
              <Icon name="send" size={14} /> Broadcast
            </Btn>
          </div>
          {announcements.length > 0 && (
            <div className="mt-4 border-t border-outline-variant/10 pt-3">
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-2">Recent</div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {announcements.slice(0, 10).map(function(a, i) {
                  return (
                    <div key={i} className="text-xs text-on-surface/60 flex items-start gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary font-bold rounded uppercase shrink-0">{a.type}</span>
                      <span className="flex-1">{a.message}</span>
                      <span className="font-mono text-[10px] text-on-surface/25 shrink-0">{timeAgo(a.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Panel>

        {/* Notifications */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="notifications" size={16} className="text-tertiary" />
            <span className="font-bold text-sm text-on-surface">Push Notification</span>
          </div>
          <div className="space-y-3">
            <Sel value={notifTarget} onChange={setNotifTarget}>
              <option value="all">All Players</option>
            </Sel>
            <textarea
              value={notifMsg}
              onChange={function(e) { setNotifMsg(e.target.value) }}
              rows={3}
              className="w-full bg-surface-container border border-outline-variant/10 rounded px-3 py-2.5 text-on-surface text-sm resize-y focus:outline-none focus:border-primary/40"
              placeholder="Notification message..."
            />
            <Btn v="primary" onClick={sendNotification}>
              <Icon name="send" size={14} /> Send to All
            </Btn>
          </div>
        </Panel>
      </div>

      {/* Ticker Control */}
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="subtitles" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Ticker Messages</span>
        </div>
        <div className="flex gap-2 mb-3">
          <Inp value={newTicker} onChange={function(v) { setNewTicker(typeof v === 'string' ? v : v.target.value) }} placeholder="Add ticker message..." className="flex-1" />
          <Btn v="primary" s="sm" onClick={addTicker}>Add</Btn>
        </div>
        {(tickerOverrides || []).length > 0 && (
          <div className="space-y-1.5">
            {(tickerOverrides || []).map(function(msg, idx) {
              return (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded">
                  <Icon name="chevron_right" size={12} className="text-on-surface/30" />
                  <span className="flex-1 text-xs text-on-surface/70">{msg}</span>
                  <Btn v="ghost" s="sm" onClick={function() { removeTicker(idx) }}>
                    <Icon name="close" size={14} className="text-error" />
                  </Btn>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Disputes */}
      <Panel className="!p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
          <Icon name="gavel" size={18} className={openDisputes.length > 0 ? 'text-error' : 'text-on-surface/40'} />
          <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
            Disputes ({openDisputes.length} open, {closedDisputes.length} resolved)
          </span>
        </div>
        {disputesLoading ? (
          <div className="py-6 text-center text-on-surface/30 text-xs">Loading...</div>
        ) : disputes.length === 0 ? (
          <div className="py-8 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">No disputes</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {disputes.map(function(d) {
              var isOpen = d.status === 'open'
              return (
                <div key={d.id} className={'px-5 py-3.5 border-b border-outline-variant/5 last:border-0 ' + (isOpen ? '' : 'opacity-50')}>
                  <div className="flex items-start gap-3">
                    <Icon name={isOpen ? 'report' : 'check_circle'} size={16} className={isOpen ? 'text-error mt-0.5' : 'text-success mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-on-surface">{d.title || 'Dispute #' + d.id}</div>
                      {d.description && <div className="text-xs text-on-surface/50 mt-0.5">{d.description}</div>}
                      <div className="font-mono text-[10px] text-on-surface/25 mt-1">{timeAgo(d.created_at)} / {d.status}</div>
                    </div>
                    {isOpen && (
                      <div className="flex gap-1 shrink-0">
                        <Btn v="ghost" s="sm" onClick={function() { resolveDispute(d.id) }}>
                          <Icon name="check" size={14} className="text-success" /> Accept
                        </Btn>
                        <Btn v="ghost" s="sm" onClick={function() { dismissDispute(d.id) }}>
                          <Icon name="close" size={14} className="text-error" /> Dismiss
                        </Btn>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
