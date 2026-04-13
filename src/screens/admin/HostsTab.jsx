import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Icon } from '../../components/ui'

export default function HostsTab() {
  var ctx = useApp()
  var hostApps = ctx.hostApps
  var setHostApps = ctx.setHostApps
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _view = useState('pending')
  var view = _view[0]
  var setView = _view[1]

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { }).catch(function() {})
    }
  }

  function approveApp(app) {
    var applicantId = app.user_id
    supabase.from('host_applications').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', app.id).then(function(r) {
      if (r.error) { toast('Approve failed: ' + r.error.message, 'error'); return }
      if (applicantId) {
        // Grant host role
        supabase.from('user_roles').upsert(
          { user_id: applicantId, role: 'host', granted_by: currentUser && currentUser.auth_user_id },
          { onConflict: 'user_id,role' }
        ).then(function(r2) {
        }).catch(function() {})
        // Create host_profiles entry so they can manage branding
        var slug = (app.org || app.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'host-' + Date.now()
        supabase.from('host_profiles').upsert({
          user_id: applicantId,
          org_name: app.org || app.name || '',
          slug: slug,
          bio: app.reason || '',
          status: 'approved',
          approved_at: new Date().toISOString()
        }, { onConflict: 'user_id' }).then(function(r3) {
        }).catch(function() {})
      }
      setHostApps(function(apps) { return apps.map(function(a) { return a.id === app.id ? Object.assign({}, a, { status: 'approved' }) : a }) })
      addAudit('ACTION', 'Host application approved: ' + (app.name || app.email))
      toast((app.name || 'Applicant') + ' approved as host!', 'success')
    }).catch(function() { toast('Approve failed', 'error') })
  }

  function rejectApp(app) {
    if (!window.confirm('Reject application from ' + (app.name || app.email) + '?')) return
    supabase.from('host_applications').update({ status: 'rejected' }).eq('id', app.id).then(function(r) {
      if (r.error) { toast('Reject failed: ' + r.error.message, 'error'); return }
      setHostApps(function(apps) { return apps.map(function(a) { return a.id === app.id ? Object.assign({}, a, { status: 'rejected' }) : a }) })
      addAudit('ACTION', 'Host application rejected: ' + (app.name || app.email))
      toast('Application rejected', 'success')
    }).catch(function() { toast('Reject failed', 'error') })
  }

  var apps = hostApps || []
  var pending = apps.filter(function(a) { return a.status === 'pending' })
  var approved = apps.filter(function(a) { return a.status === 'approved' })
  var rejected = apps.filter(function(a) { return a.status === 'rejected' })

  var shown = view === 'pending' ? pending : view === 'approved' ? approved : rejected

  var tabs = [
    { id: 'pending', label: 'Pending', count: pending.length, urgent: pending.length > 0 },
    { id: 'approved', label: 'Approved', count: approved.length, urgent: false },
    { id: 'rejected', label: 'Rejected', count: rejected.length, urgent: false },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        {tabs.map(function(t) {
          return (
            <button
              key={t.id}
              onClick={function() { setView(t.id) }}
              className={'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded border transition-all ' + (view === t.id ? (t.urgent ? 'bg-error/10 border-error text-error' : 'bg-primary/10 border-primary text-primary') : 'border-outline-variant/20 text-on-surface/50 hover:bg-white/5')}
            >
              {t.label + ' (' + t.count + ')'}
            </button>
          )
        })}
      </div>

      {pending.length > 0 && view === 'pending' && (
        <div className="px-3 py-2 bg-error/5 border border-error/20 rounded text-xs text-error font-bold">
          {pending.length} application{pending.length > 1 ? 's' : ''} waiting for review
        </div>
      )}

      <Panel>
        {shown.length === 0 && (
          <div className="text-center py-10 text-on-surface/40">
            <Icon name="sports_esports" size={32} className="block mx-auto mb-2" />
            <div className="text-sm">No {view} applications.</div>
          </div>
        )}
        {shown.map(function(app) {
          var name = app.name || app.applicant_name || app.email || 'Unknown'
          return (
            <div key={app.id} className="py-4 border-b border-outline-variant/5 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1.5">
                    <span className="font-bold text-on-surface">{name}</span>
                    {app.org && <span className="text-xs text-on-surface/50 bg-surface-container px-1.5 py-0.5 rounded">{app.org}</span>}
                  </div>
                  {app.email && <div className="text-xs text-on-surface/50 mb-1">{app.email}</div>}
                  {app.frequency && <div className="text-xs text-on-surface/50 mb-1">Frequency: {app.frequency}</div>}
                  {app.reason && (
                    <div className="text-sm text-on-surface/70 mt-2 leading-relaxed border-l-2 border-outline-variant/20 pl-3">{app.reason}</div>
                  )}
                  {app.experience && (
                    <div className="text-xs text-on-surface/50 mt-2">Experience: {app.experience}</div>
                  )}
                  <div className="text-[11px] text-on-surface/30 mt-2">
                    Applied {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'unknown'}
                  </div>
                </div>
                {view === 'pending' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <Btn variant="primary" size="sm" onClick={function() { approveApp(app) }}>Approve</Btn>
                    <Btn variant="ghost" size="sm" onClick={function() { rejectApp(app) }}>Reject</Btn>
                  </div>
                )}
                {view === 'approved' && (
                  <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded flex-shrink-0">APPROVED</span>
                )}
                {view === 'rejected' && (
                  <span className="text-[10px] font-bold text-error bg-error/10 px-2 py-1 rounded flex-shrink-0">REJECTED</span>
                )}
              </div>
            </div>
          )
        })}
      </Panel>
    </div>
  )
}
