# Admin Panel Rebuild + Events & Host Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild AdminScreen.jsx into a 7-tab modular shell, then fix 12 confirmed bugs across EventsScreen, TournamentDetailScreen, and HostDashboardScreen.

**Architecture:** Each admin tab is a standalone file in `src/screens/admin/` that reads context via `useApp()` directly — no prop drilling through the shell. The shell (~150 lines) handles auth gate, sidebar nav, and tab rendering. Bug fixes are surgical edits to 3 existing screen files.

**Tech Stack:** React 18, Tailwind CSS 3, Supabase JS v2, `var` + `function(){}` style (no arrow functions, no IIFEs in JSX per CLAUDE.md)

---

## Code Style Rules (CLAUDE.md — enforced everywhere)

- `var` declarations only — no `const`, no `let`
- `function(){}` callbacks — no arrow functions
- No named function components defined inside another component's body
- `Sel` wrapper defined at the top of any file that uses `<select>`
- Each tab: `var ctx = useApp()` then destructure each field individually on its own `var` line
- `addAudit(type, msg)` defined locally in every tab that writes to the audit log

**Standard addAudit pattern (copy exactly into every tab that needs it):**
```js
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
    }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
  }
}
```

**Standard Sel component (copy exactly into every tab that uses a select):**
```jsx
function Sel({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={function(e) { onChange(e.target.value) }}
      className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40"
    >
      {children}
    </select>
  )
}
```

---

## File Structure

```
src/screens/
  AdminScreen.jsx          ~150 lines  (shell: auth gate, sidebar, tab router)
  admin/
    OverviewTab.jsx        ~200 lines
    PlayersTab.jsx         ~420 lines
    TournamentTab.jsx      ~420 lines
    ResultsTab.jsx         ~320 lines
    SettingsTab.jsx        ~380 lines
    AuditTab.jsx           ~200 lines
    HostsTab.jsx           ~260 lines
```

**Modified (bug fixes):**
- `src/screens/EventsScreen.jsx` — fixes 1–5
- `src/screens/TournamentDetailScreen.jsx` — fixes 6–8
- `src/screens/HostDashboardScreen.jsx` — fixes 9–12

---

## Task 1: OverviewTab.jsx

**Files:**
- Create: `src/screens/admin/OverviewTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
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
    })
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
      }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
    }
  }

  var ts = tournamentState || {}
  var checkedInIds = ts.checkedInIds || []
  var allPlayers = players || []
  var eligible = allPlayers.filter(function(p) { return !p.banned })
  var banned = allPlayers.filter(function(p) { return p.banned }).length
  var pendingHosts = (hostApps || []).filter(function(a) { return a.status === 'pending' }).length
  var scheduledEventsCount = 0

  function checkInAll() {
    if (!window.confirm('Check in all ' + eligible.length + ' eligible players?')) return
    var ids = eligible.map(function(p) { return p.id })
    setTournamentState(function(s) { return Object.assign({}, s, { checkedInIds: ids }) })
    supabase.from('players').update({ checked_in: true }).neq('banned', true).then(function(r) {
      if (r.error) { toast('DB sync failed: ' + r.error.message, 'error'); return }
      addAudit('ACTION', 'Check-in All: ' + ids.length + ' players')
      toast(ids.length + ' players checked in', 'success')
    })
  }

  function clearCheckIn() {
    if (!window.confirm('Clear all check-ins?')) return
    setTournamentState(function(s) { return Object.assign({}, s, { checkedInIds: [] }) })
    supabase.from('players').update({ checked_in: false }).then(function(r) {
      if (r.error) { toast('DB sync failed: ' + r.error.message, 'error'); return }
      addAudit('ACTION', 'Check-in cleared')
      toast('Check-in cleared', 'success')
    })
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
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 flex-shrink-0" style={{ color: col, background: col + '18', border: '1px solid ' + col + '33' }}>{entry.action}</span>
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
```

- [ ] **Step 2: Verify file created**

Run: `ls src/screens/admin/`
Expected: `OverviewTab.jsx`

- [ ] **Step 3: Commit**

```bash
git add src/screens/admin/OverviewTab.jsx
git commit -m "feat: add admin OverviewTab with stat cards, quick actions, recent activity"
```

---

## Task 2: PlayersTab.jsx

**Files:**
- Create: `src/screens/admin/PlayersTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { RANKS, REGIONS } from '../../lib/constants.js'
import { sanitize } from '../../lib/utils.js'
import { Panel, Btn, Inp, Icon, Divider } from '../../components/ui'

function Sel({ value, onChange, children }) {
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value) }} className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40">
      {children}
    </select>
  )
}

export default function PlayersTab() {
  var ctx = useApp()
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var scrimAccess = ctx.scrimAccess
  var setScrimAccess = ctx.setScrimAccess
  var auditLog = ctx.auditLog
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _editP = useState(null)
  var editP = _editP[0]
  var setEditP = _editP[1]

  var _noteTarget = useState(null)
  var noteTarget = _noteTarget[0]
  var setNoteTarget = _noteTarget[1]

  var _noteText = useState('')
  var noteText = _noteText[0]
  var setNoteText = _noteText[1]

  var _showAdd = useState(false)
  var showAdd = _showAdd[0]
  var setShowAdd = _showAdd[1]

  var _addForm = useState({ name: '', riotId: '', region: 'EUW', rank: 'Gold' })
  var addForm = _addForm[0]
  var setAddForm = _addForm[1]

  var _newScrimUser = useState('')
  var newScrimUser = _newScrimUser[0]
  var setNewScrimUser = _newScrimUser[1]

  var _disputes = useState([])
  var disputes = _disputes[0]
  var setDisputes = _disputes[1]

  var _disputesLoading = useState(true)
  var disputesLoading = _disputesLoading[0]
  var setDisputesLoading = _disputesLoading[1]

  var _search = useState('')
  var search = _search[0]
  var setSearch = _search[1]

  useEffect(function() {
    supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(50).then(function(res) {
      setDisputesLoading(false)
      if (res.data) setDisputes(res.data)
    })
  }, [])

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
    }
  }

  function ban(id, name) {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { banned: true, checkedIn: false }) : p }) })
    if (supabase.from && id) { supabase.from('players').update({ banned: true, checked_in: false }).eq('id', id).then(function(r) { if (r.error) toast('Ban DB sync failed', 'error') }) }
    addAudit('WARN', 'Banned: ' + name)
    toast(name + ' banned', 'success')
  }

  function unban(id, name) {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { banned: false, dnpCount: 0 }) : p }) })
    if (supabase.from && id) { supabase.from('players').update({ banned: false, dnp_count: 0 }).eq('id', id).then(function(r) { if (r.error) toast('Unban DB sync failed', 'error') }) }
    addAudit('ACTION', 'Unbanned: ' + name)
    toast(name + ' unbanned', 'success')
  }

  function remove(id, name) {
    if (!window.confirm('Delete ' + name + '? This cannot be undone.')) return
    setPlayers(function(ps) { return ps.filter(function(p) { return p.id !== id }) })
    if (supabase.from && id) { supabase.from('players').delete().eq('id', id).then(function(r) { if (r.error) toast('Delete DB sync failed', 'error') }) }
    addAudit('ACTION', 'Removed player: ' + name)
    toast(name + ' removed', 'success')
  }

  function saveEdit() {
    if (!editP) return
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === editP.id ? Object.assign({}, p, editP) : p }) })
    var updates = { username: editP.name, riot_id: editP.riotId, region: editP.region, rank: editP.rank, role: editP.role, season_pts: editP.pts, banned: editP.banned, dnp_count: editP.dnpCount || 0 }
    if (supabase.from && editP.id) { supabase.from('players').update(updates).eq('id', editP.id).then(function(r) { if (r.error) toast('Save failed: ' + r.error.message, 'error') }) }
    if (editP._ptsChanged) addAudit('DANGER', 'Season pts override: ' + editP.name + ' -> ' + editP.pts)
    else addAudit('ACTION', 'Player updated: ' + editP.name)
    toast('Saved ' + editP.name, 'success')
    setEditP(null)
  }

  function saveNote() {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === noteTarget.id ? Object.assign({}, p, { notes: noteText }) : p }) })
    if (supabase.from && noteTarget.id) { supabase.from('players').update({ notes: noteText }).eq('id', noteTarget.id).then(function(r) { if (r.error) toast('Note save failed', 'error') }) }
    addAudit('ACTION', 'Note updated: ' + noteTarget.name)
    toast('Note saved', 'success')
    setNoteTarget(null)
  }

  function addPlayer() {
    var n = sanitize(addForm.name.trim())
    var r = sanitize(addForm.riotId.trim())
    if (!n || !r) { toast('Name and Riot ID required', 'error'); return }
    if ((players || []).find(function(p) { return p.name.toLowerCase() === n.toLowerCase() })) { toast('Name already taken', 'error'); return }
    var np = { id: Date.now() % 100000, name: n, riotId: r, rank: addForm.rank || 'Gold', region: addForm.region || 'EUW', pts: 0, wins: 0, top4: 0, games: 0, avg: '0', checkedIn: false, role: 'player', banned: false, dnpCount: 0, notes: '' }
    setPlayers(function(ps) { return ps.concat([np]) })
    if (supabase.from) {
      supabase.from('players').insert({ username: n, riot_id: r, rank: addForm.rank || 'Gold', region: addForm.region || 'EUW' }).select().single().then(function(res) {
        if (res.error) { toast('DB insert failed: ' + res.error.message, 'error'); return }
        if (res.data) { setPlayers(function(ps) { return ps.map(function(p) { return p.name === n ? Object.assign({}, p, { id: res.data.id }) : p }) }) }
      })
    }
    addAudit('ACTION', 'Player added: ' + n)
    toast(n + ' added!', 'success')
    setAddForm({ name: '', riotId: '', region: 'EUW', rank: 'Gold' })
    setShowAdd(false)
  }

  function addScrimUser() {
    var u = newScrimUser.trim()
    if (!u) { toast('Enter a username', 'error'); return }
    if ((scrimAccess || []).includes(u)) { toast('Already in list', 'error'); return }
    setScrimAccess(function(a) { return (a || []).concat([u]) })
    addAudit('ACTION', 'Scrims access granted: ' + u)
    setNewScrimUser('')
    toast(u + ' added to scrims access', 'success')
  }

  function removeScrimUser(u) {
    setScrimAccess(function(a) { return (a || []).filter(function(x) { return x !== u }) })
    addAudit('ACTION', 'Scrims access removed: ' + u)
    toast(u + ' removed from scrims access', 'success')
  }

  function resolveDispute(id) {
    setDisputes(function(ds) { return ds.map(function(d) { return d.id === id ? Object.assign({}, d, { status: 'resolved' }) : d }) })
    supabase.from('disputes').update({ status: 'resolved' }).eq('id', id).then(function(r) { if (r.error) toast('Resolve failed', 'error') })
    addAudit('ACTION', 'Dispute resolved: #' + id)
    toast('Dispute resolved', 'success')
  }

  function dismissDispute(id) {
    setDisputes(function(ds) { return ds.map(function(d) { return d.id === id ? Object.assign({}, d, { status: 'dismissed' }) : d }) })
    supabase.from('disputes').update({ status: 'dismissed' }).eq('id', id).then(function(r) { if (r.error) toast('Dismiss failed', 'error') })
    addAudit('ACTION', 'Dispute dismissed: #' + id)
    toast('Dispute dismissed', 'success')
  }

  var allPlayers = players || []
  var filtered = search ? allPlayers.filter(function(p) { return (p.name || '').toLowerCase().indexOf(search.toLowerCase()) !== -1 }) : allPlayers
  var pendingDisputes = disputes.filter(function(d) { return d.status === 'pending' }).length

  if (editP) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Btn variant="ghost" size="sm" onClick={function() { setEditP(null) }}>
            <Icon name="arrow_back" size={16} />
          </Btn>
          <h2 className="font-bold text-lg text-on-surface">Edit Player: {editP.name}</h2>
        </div>
        <Panel className="max-w-xl space-y-4">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Display Name</label>
            <Inp value={editP.name} onChange={function(v) { setEditP(Object.assign({}, editP, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Riot ID</label>
            <Inp value={editP.riotId || ''} onChange={function(v) { setEditP(Object.assign({}, editP, { riotId: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Region</label>
              <Sel value={editP.region || 'EUW'} onChange={function(v) { setEditP(Object.assign({}, editP, { region: v })) }}>
                {REGIONS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rank</label>
              <Sel value={editP.rank || 'Gold'} onChange={function(v) { setEditP(Object.assign({}, editP, { rank: v })) }}>
                {RANKS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Role</label>
              <Sel value={editP.role || 'player'} onChange={function(v) { setEditP(Object.assign({}, editP, { role: v })) }}>
                <option value="player">Player</option>
                <option value="pro">Pro</option>
                <option value="host">Host</option>
                <option value="admin">Admin</option>
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                Season Pts
                <span className="text-error font-bold ml-1">DANGER</span>
              </label>
              <Inp type="number" value={editP.pts || 0} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setEditP(Object.assign({}, editP, { pts: parseInt(val) || 0, _ptsChanged: true })) }} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!editP.banned} onChange={function(e) { setEditP(Object.assign({}, editP, { banned: e.target.checked })) }} />
              <span className="text-sm text-error font-bold">Banned</span>
            </label>
            <span className="text-sm text-on-surface/50">DNP Count: {editP.dnpCount || 0}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Btn variant="primary" onClick={saveEdit}>Save Changes</Btn>
            <Btn variant="secondary" onClick={function() { setEditP(null) }}>Cancel</Btn>
          </div>
        </Panel>
      </div>
    )
  }

  if (noteTarget) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Btn variant="ghost" size="sm" onClick={function() { setNoteTarget(null) }}>
            <Icon name="arrow_back" size={16} />
          </Btn>
          <h2 className="font-bold text-lg text-on-surface">Note: {noteTarget.name}</h2>
        </div>
        <Panel className="max-w-xl space-y-3">
          <div className="text-xs text-on-surface/40">Admin-only. Use for dispute history, warnings, context.</div>
          <Inp value={noteText} onChange={function(e) { setNoteText(typeof e === 'string' ? e : e.target.value) }} placeholder="e.g. known griefer, dispute 2026-03-10..." />
          <div className="flex gap-2">
            <Btn variant="primary" onClick={saveNote}>Save Note</Btn>
            <Btn variant="secondary" onClick={function() { setNoteTarget(null) }}>Cancel</Btn>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Roster */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="group" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Roster ({allPlayers.length})</span>
          </div>
          <Btn variant="primary" size="sm" onClick={function() { setShowAdd(function(v) { return !v }) }}>
            {showAdd ? 'Cancel' : '+ Add Player'}
          </Btn>
        </div>

        {showAdd && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-primary/5 border border-primary/10 rounded-sm">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
              <Inp value={addForm.name} onChange={function(v) { setAddForm(Object.assign({}, addForm, { name: typeof v === 'string' ? v : v.target.value })) }} placeholder="Display name" />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Riot ID</label>
              <Inp value={addForm.riotId} onChange={function(v) { setAddForm(Object.assign({}, addForm, { riotId: typeof v === 'string' ? v : v.target.value })) }} placeholder="Name#TAG" />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Region</label>
              <Sel value={addForm.region} onChange={function(v) { setAddForm(Object.assign({}, addForm, { region: v })) }}>
                {REGIONS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rank</label>
              <Sel value={addForm.rank} onChange={function(v) { setAddForm(Object.assign({}, addForm, { rank: v })) }}>
                {RANKS.map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div className="col-span-2 md:col-span-4">
              <Btn variant="primary" size="sm" onClick={addPlayer}>Add Player</Btn>
            </div>
          </div>
        )}

        <div className="mb-3">
          <Inp value={search} onChange={function(e) { setSearch(typeof e === 'string' ? e : e.target.value) }} placeholder="Search players..." />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10">
                {['Name', 'Riot ID', 'Region', 'Rank', 'Pts', 'Role', 'Status', 'Actions'].map(function(h) {
                  return <th key={h} className="text-left px-2 py-2 text-[11px] font-bold text-on-surface/40 uppercase tracking-wider">{h}</th>
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan="8" className="text-center py-8 text-on-surface/40 text-sm">No players found.</td></tr>
              )}
              {filtered.map(function(p) {
                return (
                  <tr key={p.id} className={'border-b border-outline-variant/5 hover:bg-white/[.02] ' + (p.banned ? 'opacity-50' : '')}>
                    <td className="px-2 py-2 font-semibold text-on-surface">{p.name}</td>
                    <td className="px-2 py-2 text-on-surface/60 font-mono text-xs">{p.riotId || '-'}</td>
                    <td className="px-2 py-2 text-on-surface/60">{p.region || '-'}</td>
                    <td className="px-2 py-2 text-on-surface/70">{p.rank}</td>
                    <td className="px-2 py-2 font-bold text-primary">{p.pts || 0}</td>
                    <td className="px-2 py-2 text-on-surface/60 capitalize">{p.role || 'player'}</td>
                    <td className="px-2 py-2">
                      {p.banned
                        ? <span className="text-[10px] font-bold text-error bg-error/10 px-1.5 py-0.5 rounded-sm">BANNED</span>
                        : p.dnpCount > 0
                          ? <span className="text-[10px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-sm">{'DNP x' + p.dnpCount}</span>
                          : <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-sm">OK</span>
                      }
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Btn variant="ghost" size="sm" onClick={function() { setEditP(Object.assign({}, p)) }}>Edit</Btn>
                        <Btn variant="ghost" size="sm" onClick={function() { setNoteTarget(p); setNoteText(p.notes || '') }}>Note</Btn>
                        {p.banned
                          ? <Btn variant="ghost" size="sm" onClick={function() { unban(p.id, p.name) }}>Unban</Btn>
                          : <Btn variant="ghost" size="sm" onClick={function() { ban(p.id, p.name) }}>Ban</Btn>
                        }
                        <Btn variant="ghost" size="sm" onClick={function() { remove(p.id, p.name) }}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Scrims Access */}
      <Panel accent="purple">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="swords" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Scrims Access</span>
        </div>
        <div className="text-xs text-on-surface/40 mb-3">Players in this list can access The Lab. Use exact usernames (case-sensitive).</div>
        <div className="flex gap-2 mb-3">
          <Inp value={newScrimUser} onChange={function(e) { setNewScrimUser(typeof e === 'string' ? e : e.target.value) }} placeholder="Username" onKeyDown={function(e) { if (e.key === 'Enter') addScrimUser() }} />
          <Btn variant="primary" size="sm" onClick={addScrimUser}>Add</Btn>
        </div>
        {(!scrimAccess || scrimAccess.length === 0) ? (
          <div className="text-center py-4 text-on-surface/40 text-sm">No users added yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(scrimAccess || []).map(function(u) {
              return (
                <div key={u} className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-sm">
                  <span className="text-sm font-semibold text-primary">{u}</span>
                  <button onClick={function() { removeScrimUser(u) }} className="bg-transparent border-0 text-error cursor-pointer text-base leading-none px-1">x</button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Disputes */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="gavel" size={16} className="text-error" />
          <span className="font-bold text-sm text-on-surface">
            Disputes
            {pendingDisputes > 0 && <span className="ml-2 text-[10px] font-bold text-error bg-error/10 px-1.5 py-0.5 rounded-sm">{pendingDisputes} PENDING</span>}
          </span>
        </div>
        {disputesLoading && <div className="text-center py-6 text-on-surface/40 text-sm">Loading...</div>}
        {!disputesLoading && disputes.length === 0 && <div className="text-center py-6 text-on-surface/40 text-sm">No disputes.</div>}
        {disputes.map(function(d) {
          return (
            <div key={d.id} className="flex items-start gap-3 py-3 border-b border-outline-variant/5 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-on-surface">{d.player_username || d.player_id}</span>
                  <span className="text-[10px] font-bold text-on-surface/50 bg-surface-container-high px-1.5 py-0.5 rounded-sm uppercase">{d.type || 'dispute'}</span>
                  <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded-sm ' + (d.status === 'pending' ? 'text-warning bg-warning/10' : 'text-on-surface/40 bg-surface-container-high')}>{d.status || 'pending'}</span>
                </div>
                <div className="text-sm text-on-surface/70">{d.description}</div>
                <div className="text-[11px] text-on-surface/40 mt-1">{d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}</div>
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-1 flex-shrink-0">
                  <Btn variant="primary" size="sm" onClick={function() { resolveDispute(d.id) }}>Resolve</Btn>
                  <Btn variant="ghost" size="sm" onClick={function() { dismissDispute(d.id) }}>Dismiss</Btn>
                </div>
              )}
            </div>
          )
        })}
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/admin/PlayersTab.jsx
git commit -m "feat: add admin PlayersTab with roster, edit modal, scrims access, disputes"
```

---

## Task 3: TournamentTab.jsx

**Files:**
- Create: `src/screens/admin/TournamentTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { TOURNAMENT_FORMATS } from '../../lib/tournament.js'
import { Panel, Btn, Inp, Icon, Divider } from '../../components/ui'

function Sel({ value, onChange, children }) {
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value) }} className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40">
      {children}
    </select>
  )
}

var PHASE_STEPS = ['registration', 'checkin', 'inprogress', 'complete']
var PHASE_LABELS = { registration: 'Registration', checkin: 'Check-in', inprogress: 'Live', complete: 'Complete' }

export default function TournamentTab() {
  var ctx = useApp()
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var scheduledEvents = ctx.scheduledEvents
  var setScheduledEvents = ctx.setScheduledEvents
  var players = ctx.players
  var auditLog = ctx.auditLog
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _clashForm = useState({ name: 'Weekly Clash', date: '', time: '', countdownIso: '', server: 'EU' })
  var clashForm = _clashForm[0]
  var setClashForm = _clashForm[1]

  var _roundConfig = useState({ maxPlayers: '24', roundCount: '3', checkinWindowMins: '30', cutLine: '0', cutAfterGame: '0' })
  var roundConfig = _roundConfig[0]
  var setRoundConfig = _roundConfig[1]

  var _seedAlgo = useState('rank-based')
  var seedAlgo = _seedAlgo[0]
  var setSeedAlgo = _seedAlgo[1]

  var _newEvent = useState({ name: '', type: 'SCHEDULED', date: '', time: '', cap: '8', format: 'Swiss' })
  var newEvent = _newEvent[0]
  var setNewEvent = _newEvent[1]

  var _flashForm = useState({ name: 'Flash Tournament', date: '', maxPlayers: '128', gameCount: '3', formatPreset: 'standard', seedingMethod: 'snake', prizeRows: [{ placement: '1', prize: '' }] })
  var flashForm = _flashForm[0]
  var setFlashForm = _flashForm[1]

  var _flashTournaments = useState([])
  var flashTournaments = _flashTournaments[0]
  var setFlashTournaments = _flashTournaments[1]

  useEffect(function() {
    supabase.from('tournaments').select('id, name, date, phase, type').eq('type', 'flash_tournament').order('date', { ascending: false }).limit(20).then(function(res) {
      if (res.data) setFlashTournaments(res.data)
    })
  }, [])

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
    }
  }

  var ts = tournamentState || {}
  var currentPhase = ts.phase || 'registration'
  var currentPhaseIdx = PHASE_STEPS.indexOf(currentPhase)

  function setPhase(phase) {
    setTournamentState(function(s) { return Object.assign({}, s, { phase: phase }) })
    supabase.from('tournaments').update({ phase: phase }).eq('type', 'weekly').then(function(r) {
      if (r.error) console.error('[TFT] Phase update failed:', r.error)
    })
    addAudit('ACTION', 'Phase set to: ' + phase)
    toast('Phase: ' + PHASE_LABELS[phase], 'success')
  }

  function openCheckin() {
    if (currentPhase !== 'registration') { toast('Must be in Registration phase', 'error'); return }
    setPhase('checkin')
  }

  function startTournament() {
    if (currentPhase !== 'checkin') { toast('Must be in Check-in phase', 'error'); return }
    setPhase('inprogress')
  }

  function resetToRegistration() {
    if (!window.confirm('Reset tournament to Registration? This will clear check-ins.')) return
    setTournamentState(function(s) { return Object.assign({}, s, { phase: 'registration', checkedInIds: [], round: 1 }) })
    supabase.from('players').update({ checked_in: false }).then(function(r) { if (r.error) console.error('[TFT] Reset failed:', r.error) })
    addAudit('WARN', 'Tournament reset to Registration')
    toast('Reset to Registration', 'success')
  }

  function addScheduledEvent() {
    if (!newEvent.name.trim() || !newEvent.date.trim()) { toast('Name and date required', 'error'); return }
    supabase.from('scheduled_events').insert({
      name: newEvent.name.trim(), type: newEvent.type, date: newEvent.date,
      time: newEvent.time, cap: parseInt(newEvent.cap) || 8, format: newEvent.format || 'Swiss'
    }).select().single().then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
      setScheduledEvents(function(evs) { return (evs || []).concat([res.data]) })
      addAudit('ACTION', 'Scheduled event added: ' + newEvent.name.trim())
      toast('Event scheduled!', 'success')
      setNewEvent({ name: '', type: 'SCHEDULED', date: '', time: '', cap: '8', format: 'Swiss' })
    })
  }

  function cancelScheduledEvent(id) {
    if (!window.confirm('Cancel this event?')) return
    supabase.from('scheduled_events').delete().eq('id', id).then(function(r) {
      if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
      setScheduledEvents(function(evs) { return (evs || []).filter(function(e) { return e.id !== id }) })
      addAudit('ACTION', 'Scheduled event cancelled: #' + id)
      toast('Event cancelled', 'success')
    })
  }

  function createFlashTournament() {
    if (!flashForm.name.trim()) { toast('Tournament name required', 'error'); return }
    if (!flashForm.date) { toast('Date/time required', 'error'); return }
    var prizePool = flashForm.prizeRows.filter(function(r) { return r.prize.trim() }).map(function(r) { return { placement: parseInt(r.placement), prize: r.prize.trim() } })
    supabase.from('tournaments').insert({
      name: flashForm.name.trim(), date: flashForm.date, phase: 'draft', type: 'flash_tournament',
      max_players: parseInt(flashForm.maxPlayers) || 128, round_count: parseInt(flashForm.gameCount) || 3,
      seeding_method: flashForm.seedingMethod || 'snake', prize_pool_json: prizePool.length > 0 ? prizePool : null,
      lobby_host_method: 'random'
    }).select().single().then(function(res) {
      if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
      setFlashTournaments(function(ts) { return (ts || []).concat([res.data]) })
      addAudit('ACTION', 'Flash tournament created: ' + flashForm.name.trim())
      toast('Flash tournament created!', 'success')
      setFlashForm({ name: 'Flash Tournament', date: '', maxPlayers: '128', gameCount: '3', formatPreset: 'standard', seedingMethod: 'snake', prizeRows: [{ placement: '1', prize: '' }] })
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Weekly Clash */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="calendar_month" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Weekly Clash</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={clashForm.name} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date (display text)</label>
            <Inp value={clashForm.date} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { date: typeof v === 'string' ? v : v.target.value })) }} placeholder="e.g. Saturday, March 29" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Time (display text)</label>
            <Inp value={clashForm.time} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { time: typeof v === 'string' ? v : v.target.value })) }} placeholder="e.g. 8:00 PM CET" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Countdown ISO</label>
            <Inp type="datetime-local" value={clashForm.countdownIso} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { countdownIso: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Server</label>
            <Sel value={clashForm.server} onChange={function(v) { setClashForm(Object.assign({}, clashForm, { server: v })) }}>
              <option value="EU">EU</option>
              <option value="NA">NA</option>
            </Sel>
          </div>
        </div>

        {/* Phase stepper */}
        <div className="mb-4">
          <div className="flex items-center gap-0">
            {PHASE_STEPS.map(function(phase, i) {
              var isActive = phase === currentPhase
              var isDone = PHASE_STEPS.indexOf(currentPhase) > i
              return (
                <div key={phase} className="flex items-center flex-1">
                  <div className={'flex-1 text-center text-[10px] font-bold uppercase tracking-wider py-2 border ' + (isActive ? 'bg-primary/10 border-primary text-primary' : isDone ? 'bg-success/10 border-success/30 text-success' : 'bg-surface-container border-outline-variant/10 text-on-surface/40')}>
                    {PHASE_LABELS[phase]}
                  </div>
                  {i < PHASE_STEPS.length - 1 && <div className="w-4 h-0.5 bg-outline-variant/20 flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" size="sm" onClick={openCheckin} disabled={currentPhase !== 'registration'}>Open Check-in</Btn>
          <Btn variant="primary" size="sm" onClick={startTournament} disabled={currentPhase !== 'checkin'}>Start Tournament</Btn>
          <Btn variant="secondary" size="sm" onClick={resetToRegistration}>Reset to Registration</Btn>
        </div>
      </Panel>

      {/* Round Config */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="tune" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Round Config</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
            <Inp type="number" value={roundConfig.maxPlayers} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { maxPlayers: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Round Count</label>
            <Inp type="number" value={roundConfig.roundCount} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { roundCount: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Check-in Window (min)</label>
            <Inp type="number" value={roundConfig.checkinWindowMins} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { checkinWindowMins: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cut Line</label>
            <Inp type="number" value={roundConfig.cutLine} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { cutLine: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cut After Game</label>
            <Inp type="number" value={roundConfig.cutAfterGame} onChange={function(v) { setRoundConfig(Object.assign({}, roundConfig, { cutAfterGame: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Seeding</label>
            <Sel value={seedAlgo} onChange={setSeedAlgo}>
              <option value="random">Random</option>
              <option value="rank-based">Rank-Based</option>
              <option value="snake">Snake</option>
              <option value="anti-stack">Anti-Stack</option>
            </Sel>
          </div>
        </div>
        <Btn variant="secondary" size="sm" onClick={function() {
          setTournamentState(function(s) { return Object.assign({}, s, { maxPlayers: parseInt(roundConfig.maxPlayers) || 24, roundCount: parseInt(roundConfig.roundCount) || 3, seedingMethod: seedAlgo }) })
          addAudit('ACTION', 'Round config updated')
          toast('Round config saved', 'success')
        }}>Save Config</Btn>
      </Panel>

      {/* Schedule Events */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="event_available" size={16} className="text-tertiary" />
          <span className="font-bold text-sm text-on-surface">Schedule Events</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={newEvent.name} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date</label>
            <Inp value={newEvent.date} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { date: typeof v === 'string' ? v : v.target.value })) }} placeholder="e.g. March 29" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Time</label>
            <Inp value={newEvent.time} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { time: typeof v === 'string' ? v : v.target.value })) }} placeholder="e.g. 8:00 PM" />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Cap</label>
            <Inp type="number" value={newEvent.cap} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { cap: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Format</label>
            <Inp value={newEvent.format} onChange={function(v) { setNewEvent(Object.assign({}, newEvent, { format: typeof v === 'string' ? v : v.target.value })) }} placeholder="Swiss" />
          </div>
        </div>
        <Btn variant="primary" size="sm" onClick={addScheduledEvent}>Schedule Event</Btn>

        {(scheduledEvents || []).length > 0 && (
          <div className="mt-4 space-y-1.5">
            {(scheduledEvents || []).map(function(ev) {
              return (
                <div key={ev.id} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded-sm">
                  <Icon name="event" size={14} className="text-on-surface/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-on-surface">{ev.name}</div>
                    <div className="text-[11px] text-on-surface/40">{ev.date + (ev.time ? ' - ' + ev.time : '')}</div>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={function() { cancelScheduledEvent(ev.id) }}>Cancel</Btn>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Custom Tournaments */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="emoji_events" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Custom Tournaments</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Name</label>
            <Inp value={flashForm.name} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { name: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Date & Time</label>
            <Inp type="datetime-local" value={flashForm.date} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { date: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Max Players</label>
            <Inp type="number" value={flashForm.maxPlayers} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { maxPlayers: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Game Count</label>
            <Inp type="number" value={flashForm.gameCount} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { gameCount: typeof v === 'string' ? v : v.target.value })) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Format</label>
            <Sel value={flashForm.formatPreset} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { formatPreset: v })) }}>
              <option value="casual">Casual</option>
              <option value="standard">Standard</option>
              <option value="competitive">Competitive</option>
            </Sel>
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Seeding</label>
            <Sel value={flashForm.seedingMethod} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { seedingMethod: v })) }}>
              <option value="snake">Snake</option>
              <option value="random">Random</option>
              <option value="rank-based">Rank-Based</option>
            </Sel>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-on-surface/60 font-bold uppercase tracking-wider">Prize Pool</label>
            <Btn variant="secondary" size="sm" onClick={function() { setFlashForm(Object.assign({}, flashForm, { prizeRows: flashForm.prizeRows.concat([{ placement: String(flashForm.prizeRows.length + 1), prize: '' }]) })) }}>+ Add</Btn>
          </div>
          {flashForm.prizeRows.map(function(row, idx) {
            return (
              <div key={idx} className="flex gap-2 mb-1.5 items-center">
                <div className="text-xs text-secondary font-bold w-7 text-center">#{row.placement}</div>
                <div className="flex-1">
                  <Inp value={row.prize} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; var updated = flashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { prize: val }) : r }); setFlashForm(Object.assign({}, flashForm, { prizeRows: updated })) }} placeholder="e.g. $50, RP, Skin code" />
                </div>
                {flashForm.prizeRows.length > 1 && <Btn variant="ghost" size="sm" onClick={function() { setFlashForm(Object.assign({}, flashForm, { prizeRows: flashForm.prizeRows.filter(function(_, i) { return i !== idx }) })) }}>X</Btn>}
              </div>
            )
          })}
        </div>

        <Btn variant="primary" onClick={createFlashTournament}>Create Tournament</Btn>

        {flashTournaments.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-[11px] text-on-surface/40 font-bold uppercase tracking-wider mb-2">Existing Tournaments</div>
            {flashTournaments.map(function(t) {
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/10 rounded-sm">
                  <Icon name="bolt" size={14} className="text-on-surface/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-on-surface">{t.name}</div>
                    <div className="text-[11px] text-on-surface/40">{t.date ? new Date(t.date).toLocaleDateString() : 'TBD'} - <span className="uppercase font-bold">{t.phase || 'draft'}</span></div>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={function() {
                    if (t.phase === 'draft') {
                      supabase.from('tournaments').update({ phase: 'registration' }).eq('id', t.id).then(function(r) {
                        if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
                        setFlashTournaments(function(ts) { return ts.map(function(x) { return x.id === t.id ? Object.assign({}, x, { phase: 'registration' }) : x }) })
                        addAudit('ACTION', 'Flash tournament registration opened: ' + t.name)
                        toast('Registration opened!', 'success')
                      })
                    }
                  }}>{t.phase === 'draft' ? 'Open Registration' : 'View'}</Btn>
                  <Btn variant="ghost" size="sm" onClick={function() {
                    if (!window.confirm('Delete ' + t.name + '?')) return
                    supabase.from('tournaments').delete().eq('id', t.id).then(function(r) {
                      if (r.error) { toast('Failed: ' + r.error.message, 'error'); return }
                      setFlashTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id }) })
                      addAudit('ACTION', 'Flash tournament deleted: ' + t.name)
                      toast('Deleted', 'success')
                    })
                  }}>Del</Btn>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/admin/TournamentTab.jsx
git commit -m "feat: add admin TournamentTab with phase stepper, round config, schedule events, custom tournaments"
```

---

## Task 4: ResultsTab.jsx

**Files:**
- Create: `src/screens/admin/ResultsTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { PTS } from '../../lib/constants.js'
import { Panel, Btn, Icon } from '../../components/ui'

function Sel({ value, onChange, children }) {
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value) }} className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-2 py-1.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40">
      {children}
    </select>
  )
}

export default function ResultsTab() {
  var ctx = useApp()
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var tournamentState = ctx.tournamentState
  var auditLog = ctx.auditLog
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _lobby = useState(1)
  var lobby = _lobby[0]
  var setLobby = _lobby[1]

  var _placements = useState({})
  var placements = _placements[0]
  var setPlacements = _placements[1]

  var _published = useState([])
  var published = _published[0]
  var setPublished = _published[1]

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
    }
  }

  var ts = tournamentState || {}
  var checkedInIds = ts.checkedInIds || []
  var checkedIn = (players || []).filter(function(p) { return checkedInIds.indexOf(p.id) !== -1 || checkedInIds.indexOf(String(p.id)) !== -1 })

  // Split checkedIn into lobbies of 8
  var lobbySize = 8
  var numLobbies = Math.max(1, Math.ceil(checkedIn.length / lobbySize))
  var lobbyPlayers = checkedIn.slice((lobby - 1) * lobbySize, lobby * lobbySize)

  var lobbyKey = 'lobby' + lobby
  var isPublished = published.indexOf(lobbyKey) !== -1

  function setPlace(playerId, place) {
    setPlacements(function(p) { return Object.assign({}, p, { [lobbyKey + '_' + playerId]: place }) })
  }

  function getPlace(playerId) {
    return placements[lobbyKey + '_' + playerId] || ''
  }

  function validate() {
    if (lobbyPlayers.length === 0) { toast('No checked-in players in this lobby', 'error'); return false }
    var placed = lobbyPlayers.map(function(p) { return getPlace(p.id) }).filter(function(v) { return v !== '' })
    if (placed.length !== lobbyPlayers.length) { toast('All slots must be filled', 'error'); return false }
    var uniq = Array.from(new Set(placed))
    if (uniq.length !== placed.length) { toast('Duplicate placements found', 'error'); return false }
    return true
  }

  function publishResults() {
    if (isPublished) {
      if (!window.confirm('This lobby is already published. Edit override?')) return
    }
    if (!validate()) return
    var rows = lobbyPlayers.map(function(p) {
      var place = parseInt(getPlace(p.id))
      return { player_id: p.id, placement: place, pts_earned: PTS[place] || 0, lobby: lobby, tournament_id: ts.activeTournamentId || null }
    })
    supabase.from('game_results').insert(rows).then(function(r) {
      if (r.error) { toast('Publish failed: ' + r.error.message, 'error'); return }
      rows.forEach(function(row) {
        supabase.from('players').update({ season_pts: (row.pts_earned > 0 ? { expression: 'season_pts + ' + row.pts_earned } : undefined) }).eq('id', row.player_id)
      })
      setPlayers(function(ps) {
        return ps.map(function(p) {
          var row = rows.find(function(r) { return r.player_id === p.id })
          if (!row) return p
          return Object.assign({}, p, { pts: (p.pts || 0) + row.pts_earned, games: (p.games || 0) + 1, wins: row.placement === 1 ? (p.wins || 0) + 1 : (p.wins || 0), top4: row.placement <= 4 ? (p.top4 || 0) + 1 : (p.top4 || 0) })
        })
      })
      setPublished(function(pub) { return pub.concat([lobbyKey]) })
      addAudit('ACTION', 'Results published: Lobby ' + lobby + ', ' + rows.length + ' players')
      toast('Results published for Lobby ' + lobby + '!', 'success')
    })
  }

  if (checkedIn.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Panel>
          <div className="text-center py-10 text-on-surface/40">
            <Icon name="how_to_reg" size={36} className="block mx-auto mb-3" />
            <div className="text-sm">No checked-in players. Open check-in from the Overview tab first.</div>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="leaderboard" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Enter Results</span>
          </div>
          {numLobbies > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface/50">Lobby:</span>
              {Array.from({ length: numLobbies }, function(_, i) { return i + 1 }).map(function(n) {
                return (
                  <button key={n} onClick={function() { setLobby(n) }} className={'px-2.5 py-1 text-xs font-bold rounded-sm border ' + (lobby === n ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant/20 text-on-surface/50 hover:bg-white/5')}>
                    {n}
                    {published.indexOf('lobby' + n) !== -1 && <Icon name="check_circle" size={10} className="inline ml-1 text-success" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {isPublished && (
          <div className="mb-4 px-3 py-2 bg-success/10 border border-success/30 rounded-sm text-xs text-success font-bold">
            Published - showing read-only. Click Publish again to override.
          </div>
        )}

        <div className="space-y-2 mb-4">
          {lobbyPlayers.map(function(p) {
            var place = getPlace(p.id)
            var pts = place ? (PTS[parseInt(place)] || 0) : null
            return (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-surface-container border border-outline-variant/5 rounded-sm">
                <div className="flex-1 font-semibold text-on-surface text-sm">{p.name}</div>
                <div className="text-xs text-on-surface/40">{p.rank}</div>
                {pts !== null && <div className="text-sm font-bold text-primary min-w-[3rem] text-right">+{pts} pts</div>}
                <div className="w-20">
                  <Sel value={place} onChange={function(v) { setPlace(p.id, v) }}>
                    <option value="">Place</option>
                    {[1,2,3,4,5,6,7,8].map(function(n) { return <option key={n} value={String(n)}>{n}</option> })}
                  </Sel>
                </div>
              </div>
            )
          })}
        </div>

        <Btn variant="primary" onClick={publishResults}>
          {isPublished ? 'Override Published Results' : 'Publish Results'}
        </Btn>
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/admin/ResultsTab.jsx
git commit -m "feat: add admin ResultsTab with placement grid and publish to DB"
```

---

## Task 5: SettingsTab.jsx

**Files:**
- Create: `src/screens/admin/SettingsTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Inp, Icon, Divider } from '../../components/ui'

function Sel({ value, onChange, children }) {
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value) }} className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40">
      {children}
    </select>
  )
}

export default function SettingsTab() {
  var ctx = useApp()
  var seasonConfig = ctx.seasonConfig
  var setSeasonConfig = ctx.setSeasonConfig
  var orgSponsors = ctx.orgSponsors
  var setOrgSponsors = ctx.setOrgSponsors
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var tickerOverrides = ctx.tickerOverrides
  var setTickerOverrides = ctx.setTickerOverrides
  var setAnnouncement = ctx.setAnnouncement
  var auditLog = ctx.auditLog
  var setAuditLog = ctx.setAuditLog
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _broadType = useState('NOTICE')
  var broadType = _broadType[0]
  var setBroadType = _broadType[1]

  var _broadMsg = useState('')
  var broadMsg = _broadMsg[0]
  var setBroadMsg = _broadMsg[1]

  var _announcements = useState([])
  var announcements = _announcements[0]
  var setAnnouncements = _announcements[1]

  var _newTicker = useState('')
  var newTicker = _newTicker[0]
  var setNewTicker = _newTicker[1]

  var _spForm = useState({ name: '', logo: '', color: '#9B72CF', playerId: '' })
  var spForm = _spForm[0]
  var setSpForm = _spForm[1]

  var _seasonName = useState((seasonConfig && seasonConfig.seasonName) || 'Season 1')
  var seasonName = _seasonName[0]
  var setSeasonName = _seasonName[1]

  var _regOpen = useState(!!(seasonConfig && seasonConfig.registrationOpen))
  var regOpen = _regOpen[0]
  var setRegOpen = _regOpen[1]

  var _seasonActive = useState(!!(seasonConfig && seasonConfig.seasonActive))
  var seasonActive = _seasonActive[0]
  var setSeasonActive = _seasonActive[1]

  function addAudit(type, msg) {
    var entry = { ts: Date.now(), type: type, msg: msg }
    setAuditLog(function(l) { return [entry].concat(l.slice(0, 199)) })
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type, actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'admin_action', details: { message: msg, timestamp: entry.ts }
      }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
    }
  }

  function saveSiteSetting(key, value) {
    return supabase.from('site_settings').upsert({ key: key, value: value }, { onConflict: 'key' })
  }

  function sendBroadcast() {
    if (!broadMsg.trim()) { toast('Write a message first', 'error'); return }
    var ann = { type: broadType, message: broadMsg.trim(), ts: Date.now() }
    setAnnouncement(ann)
    saveSiteSetting('announcement', JSON.stringify(ann)).then(function(r) {
      if (r.error) { toast('Broadcast failed: ' + r.error.message, 'error'); return }
      setAnnouncements(function(a) { return [ann].concat(a) })
      addAudit('BROADCAST', broadType + ': ' + broadMsg.trim())
      toast('Broadcast sent!', 'success')
      setBroadMsg('')
    })
  }

  function dismissAnnouncement(idx) {
    setAnnouncements(function(a) { return a.filter(function(_, i) { return i !== idx }) })
    setAnnouncement(null)
    saveSiteSetting('announcement', null)
    addAudit('ACTION', 'Announcement dismissed')
  }

  function addTicker() {
    var t = newTicker.trim()
    if (!t) return
    var updated = (tickerOverrides || []).concat([t])
    setTickerOverrides(updated)
    saveSiteSetting('ticker_overrides', JSON.stringify(updated))
    addAudit('ACTION', 'Ticker item added: ' + t)
    setNewTicker('')
    toast('Ticker item added', 'success')
  }

  function removeTicker(item) {
    var updated = (tickerOverrides || []).filter(function(x) { return x !== item })
    setTickerOverrides(updated)
    saveSiteSetting('ticker_overrides', JSON.stringify(updated))
    addAudit('ACTION', 'Ticker item removed: ' + item)
  }

  function addSponsor() {
    if (!spForm.name.trim()) { toast('Org name required', 'error'); return }
    var updated = (orgSponsors || []).concat([Object.assign({}, spForm)])
    setOrgSponsors(updated)
    saveSiteSetting('org_sponsors', JSON.stringify(updated))
    addAudit('ACTION', 'Sponsor added: ' + spForm.name)
    toast('Sponsor added', 'success')
    setSpForm({ name: '', logo: '', color: '#9B72CF', playerId: '' })
  }

  function removeSponsor(idx) {
    var updated = (orgSponsors || []).filter(function(_, i) { return i !== idx })
    setOrgSponsors(updated)
    saveSiteSetting('org_sponsors', JSON.stringify(updated))
    addAudit('ACTION', 'Sponsor removed')
    toast('Sponsor removed', 'success')
  }

  function saveSeasonName() {
    setSeasonConfig(function(c) { return Object.assign({}, c, { seasonName: seasonName }) })
    saveSiteSetting('season_name', seasonName).then(function(r) {
      if (r.error) { toast('Save failed', 'error'); return }
      addAudit('ACTION', 'Season name set: ' + seasonName)
      toast('Season name saved', 'success')
    })
  }

  function toggleReg(val) {
    setRegOpen(val)
    setSeasonConfig(function(c) { return Object.assign({}, c, { registrationOpen: val }) })
    saveSiteSetting('registration_open', String(val))
    addAudit('ACTION', 'Registration ' + (val ? 'opened' : 'closed'))
    toast('Registration ' + (val ? 'open' : 'closed'), 'success')
  }

  function toggleSeason(val) {
    setSeasonActive(val)
    setSeasonConfig(function(c) { return Object.assign({}, c, { seasonActive: val }) })
    saveSiteSetting('season_active', String(val))
    addAudit('ACTION', 'Season ' + (val ? 'activated' : 'deactivated'))
    toast('Season ' + (val ? 'active' : 'inactive'), 'success')
  }

  function resetSeasonStats() {
    if (!window.confirm('Reset all player season stats to 0? This cannot be undone.')) return
    setPlayers(function(ps) { return ps.map(function(p) { return Object.assign({}, p, { pts: 0, wins: 0, top4: 0, games: 0, avg: '0' }) }) })
    supabase.from('players').update({ season_pts: 0, wins: 0, top4: 0, games: 0 }).neq('id', 0).then(function(r) {
      if (r.error) { toast('DB reset failed: ' + r.error.message, 'error'); return }
      addAudit('DANGER', 'Season stats reset by ' + (currentUser && currentUser.username || 'Admin'))
      toast('Season stats reset', 'success')
    })
  }

  function clearAllPlayers() {
    if (!window.confirm('Delete ALL players? This cannot be undone.')) return
    if (!window.confirm('Are you sure? This will wipe the entire roster.')) return
    supabase.from('players').delete().neq('id', 0).then(function(r) {
      if (r.error) { toast('Delete failed: ' + r.error.message, 'error'); return }
      setPlayers([])
      addAudit('DANGER', 'All players cleared by ' + (currentUser && currentUser.username || 'Admin'))
      toast('All players cleared', 'success')
    })
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Site Toggles */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="toggle_on" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Site Toggles</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-on-surface">Registration Open</div>
              <div className="text-xs text-on-surface/50">Allow new player sign-ups</div>
            </div>
            <button onClick={function() { toggleReg(!regOpen) }} className={'w-12 h-6 rounded-full border-2 transition-all ' + (regOpen ? 'bg-primary border-primary' : 'bg-surface-container-high border-outline-variant/30')}>
              <div className={'w-4 h-4 rounded-full bg-white transition-all mx-0.5 ' + (regOpen ? 'translate-x-6' : 'translate-x-0')} style={{ transform: regOpen ? 'translateX(24px)' : 'translateX(0)' }} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-on-surface">Season Active</div>
              <div className="text-xs text-on-surface/50">Points are counting this season</div>
            </div>
            <button onClick={function() { toggleSeason(!seasonActive) }} className={'w-12 h-6 rounded-full border-2 transition-all ' + (seasonActive ? 'bg-success border-success' : 'bg-surface-container-high border-outline-variant/30')}>
              <div className="w-4 h-4 rounded-full bg-white transition-all mx-0.5" style={{ transform: seasonActive ? 'translateX(24px)' : 'translateX(0)' }} />
            </button>
          </div>
        </div>
      </Panel>

      {/* Broadcast */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="campaign" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Broadcast</span>
        </div>
        <div className="flex gap-2 mb-2">
          <div className="w-40">
            <Sel value={broadType} onChange={setBroadType}>
              {['NOTICE', 'ALERT', 'UPDATE', 'RESULT', 'INFO'].map(function(t) { return <option key={t} value={t}>{t}</option> })}
            </Sel>
          </div>
          <div className="flex-1">
            <Inp value={broadMsg} onChange={function(e) { setBroadMsg(typeof e === 'string' ? e : e.target.value) }} placeholder="Broadcast message..." />
          </div>
          <Btn variant="primary" size="sm" onClick={sendBroadcast}>Send</Btn>
        </div>
        {announcements.map(function(a, i) {
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-secondary/5 border border-secondary/20 rounded-sm mt-1.5">
              <span className="text-[10px] font-bold text-secondary uppercase">{a.type}</span>
              <span className="flex-1 text-sm text-on-surface">{a.message}</span>
              <button onClick={function() { dismissAnnouncement(i) }} className="bg-transparent border-0 text-on-surface/40 cursor-pointer text-xs hover:text-error">x</button>
            </div>
          )
        })}
      </Panel>

      {/* Ticker */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="rss_feed" size={16} className="text-tertiary" />
          <span className="font-bold text-sm text-on-surface">Ticker Overrides</span>
        </div>
        <div className="flex gap-2 mb-3">
          <Inp value={newTicker} onChange={function(e) { setNewTicker(typeof e === 'string' ? e : e.target.value) }} placeholder="Ticker message..." onKeyDown={function(e) { if (e.key === 'Enter') addTicker() }} />
          <Btn variant="secondary" size="sm" onClick={addTicker}>Add</Btn>
        </div>
        {(tickerOverrides || []).length === 0 && <div className="text-center py-3 text-on-surface/40 text-sm">No custom ticker items.</div>}
        {(tickerOverrides || []).map(function(item, i) {
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/5 rounded-sm mb-1.5">
              <Icon name="chevron_right" size={14} className="text-tertiary flex-shrink-0" />
              <span className="flex-1 text-sm text-on-surface">{item}</span>
              <button onClick={function() { removeTicker(item) }} className="bg-transparent border-0 text-on-surface/40 cursor-pointer text-xs hover:text-error">x</button>
            </div>
          )
        })}
      </Panel>

      {/* Sponsorships */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="apartment" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Sponsorships</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Inp value={spForm.name} onChange={function(v) { setSpForm(Object.assign({}, spForm, { name: typeof v === 'string' ? v : v.target.value })) }} placeholder="Org name" />
          <Inp value={spForm.logo} onChange={function(v) { setSpForm(Object.assign({}, spForm, { logo: typeof v === 'string' ? v : v.target.value })) }} placeholder="Logo text/URL" />
          <Inp value={spForm.color} onChange={function(v) { setSpForm(Object.assign({}, spForm, { color: typeof v === 'string' ? v : v.target.value })) }} placeholder="Hex color" />
          <Sel value={spForm.playerId} onChange={function(v) { setSpForm(Object.assign({}, spForm, { playerId: v }) )} }>
            <option value="">Assign player</option>
            {(players || []).map(function(p) { return <option key={p.id} value={String(p.id)}>{p.name}</option> })}
          </Sel>
        </div>
        <Btn variant="secondary" size="sm" onClick={addSponsor}>Add Sponsor</Btn>
        <div className="mt-3 space-y-1.5">
          {(orgSponsors || []).map(function(sp, i) {
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/5 rounded-sm">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sp.color || '#9B72CF' }} />
                <span className="flex-1 text-sm font-semibold text-on-surface">{sp.name}</span>
                <span className="text-xs text-on-surface/50">{sp.logo}</span>
                <Btn variant="ghost" size="sm" onClick={function() { removeSponsor(i) }}>Remove</Btn>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Season Management */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="trophy" size={16} className="text-tertiary" />
          <span className="font-bold text-sm text-on-surface">Season Management</span>
        </div>
        <div className="flex gap-2 mb-3">
          <Inp value={seasonName} onChange={function(e) { setSeasonName(typeof e === 'string' ? e : e.target.value) }} placeholder="Season name" />
          <Btn variant="secondary" size="sm" onClick={saveSeasonName}>Save</Btn>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3 text-center">
          <div className="bg-surface-container p-3 rounded-sm">
            <div className="font-stats text-2xl font-black text-primary">{(players || []).length}</div>
            <div className="text-[10px] text-on-surface/40 uppercase tracking-wider">Players</div>
          </div>
          <div className="bg-surface-container p-3 rounded-sm">
            <div className="font-stats text-2xl font-black text-secondary">{(players || []).reduce(function(s, p) { return s + (p.pts || 0) }, 0)}</div>
            <div className="text-[10px] text-on-surface/40 uppercase tracking-wider">Total Pts</div>
          </div>
          <div className="bg-surface-container p-3 rounded-sm">
            <div className="font-stats text-2xl font-black text-tertiary">{(players || []).reduce(function(s, p) { return s + (p.games || 0) }, 0)}</div>
            <div className="text-[10px] text-on-surface/40 uppercase tracking-wider">Games Played</div>
          </div>
        </div>
      </Panel>

      {/* Danger Zone */}
      <Panel className="border border-error/20">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="warning" size={16} className="text-error" />
          <span className="font-bold text-sm text-error">Danger Zone</span>
        </div>
        <div className="flex flex-col gap-2">
          <Btn variant="ghost" onClick={resetSeasonStats}>
            <span className="text-error">Reset Season Stats</span>
          </Btn>
          <Btn variant="ghost" onClick={clearAllPlayers}>
            <span className="text-error">Clear All Players</span>
          </Btn>
        </div>
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/admin/SettingsTab.jsx
git commit -m "feat: add admin SettingsTab with toggles, broadcast, ticker, sponsors, season, danger zone"
```

---

## Task 6: AuditTab.jsx

**Files:**
- Create: `src/screens/admin/AuditTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Icon } from '../../components/ui'

var AUDIT_COLS = { INFO: '#4ECDC4', ACTION: '#52C47C', WARN: '#E8A838', RESULT: '#9B72CF', BROADCAST: '#E8A838', DANGER: '#F87171' }
var FILTERS = ['All', 'ACTION', 'WARN', 'DANGER', 'BROADCAST']
var PAGE_SIZE = 25

export default function AuditTab() {
  var _entries = useState([])
  var entries = _entries[0]
  var setEntries = _entries[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _filter = useState('All')
  var filter = _filter[0]
  var setFilter = _filter[1]

  var _page = useState(0)
  var page = _page[0]
  var setPage = _page[1]

  var _hasMore = useState(true)
  var hasMore = _hasMore[0]
  var setHasMore = _hasMore[1]

  useEffect(function() {
    setEntries([])
    setPage(0)
    setHasMore(true)
    loadPage(0, filter)
  }, [filter])

  function loadPage(pageNum, currentFilter) {
    setLoading(true)
    var q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
    if (currentFilter && currentFilter !== 'All') q = q.eq('action', currentFilter)
    q.then(function(res) {
      setLoading(false)
      if (res.error) return
      var data = res.data || []
      if (pageNum === 0) {
        setEntries(data)
      } else {
        setEntries(function(prev) { return prev.concat(data) })
      }
      if (data.length < PAGE_SIZE) setHasMore(false)
    })
  }

  function loadMore() {
    var nextPage = page + 1
    setPage(nextPage)
    loadPage(nextPage, filter)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex gap-2">
        {FILTERS.map(function(f) {
          var col = AUDIT_COLS[f]
          return (
            <button
              key={f}
              onClick={function() { setFilter(f) }}
              className={'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm border transition-all ' + (filter === f ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant/20 text-on-surface/50 hover:bg-white/5')}
            >
              {f}
            </button>
          )
        })}
      </div>

      <Panel>
        {loading && entries.length === 0 && (
          <div className="text-center py-10 text-on-surface/40 text-sm">Loading...</div>
        )}
        {!loading && entries.length === 0 && (
          <div className="text-center py-10 text-on-surface/40 text-sm">No audit entries found.</div>
        )}
        {entries.map(function(entry) {
          var col = AUDIT_COLS[entry.action] || '#888'
          return (
            <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-outline-variant/5 last:border-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 flex-shrink-0 whitespace-nowrap" style={{ color: col, background: col + '18', border: '1px solid ' + col + '33' }}>{entry.action}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-on-surface">{entry.details && entry.details.message || entry.action}</div>
                <div className="text-[11px] text-on-surface/40 mt-0.5">
                  {entry.actor_name || 'System'} - {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                </div>
              </div>
            </div>
          )
        })}
        {hasMore && !loading && entries.length > 0 && (
          <div className="pt-3 text-center">
            <Btn variant="secondary" size="sm" onClick={loadMore}>Load More</Btn>
          </div>
        )}
        {loading && entries.length > 0 && (
          <div className="pt-3 text-center text-on-surface/40 text-xs">Loading...</div>
        )}
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/admin/AuditTab.jsx
git commit -m "feat: add admin AuditTab with server-side pagination and filter"
```

---

## Task 7: HostsTab.jsx

**Files:**
- Create: `src/screens/admin/HostsTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Icon } from '../../components/ui'

export default function HostsTab() {
  var ctx = useApp()
  var hostApps = ctx.hostApps
  var setHostApps = ctx.setHostApps
  var auditLog = ctx.auditLog
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
      }).then(function(r) { if (r.error) console.error('[TFT] Audit write failed:', r.error) })
    }
  }

  function approveApp(app) {
    supabase.from('host_applications').update({ status: 'approved' }).eq('id', app.id).then(function(r) {
      if (r.error) { toast('Approve failed: ' + r.error.message, 'error'); return }
      supabase.from('user_roles').upsert({ user_id: app.user_id || app.applicant_id, role: 'host', granted_by: currentUser && currentUser.id }, { onConflict: 'user_id' }).then(function(r2) {
        if (r2.error) console.error('[TFT] user_roles upsert failed:', r2.error)
      })
      setHostApps(function(apps) { return apps.map(function(a) { return a.id === app.id ? Object.assign({}, a, { status: 'approved' }) : a }) })
      addAudit('ACTION', 'Host application approved: ' + (app.name || app.applicant_name))
      toast((app.name || app.applicant_name) + ' approved as host!', 'success')
    })
  }

  function rejectApp(app) {
    if (!window.confirm('Reject application from ' + (app.name || app.applicant_name) + '?')) return
    supabase.from('host_applications').update({ status: 'rejected' }).eq('id', app.id).then(function(r) {
      if (r.error) { toast('Reject failed: ' + r.error.message, 'error'); return }
      setHostApps(function(apps) { return apps.map(function(a) { return a.id === app.id ? Object.assign({}, a, { status: 'rejected' }) : a }) })
      addAudit('ACTION', 'Host application rejected: ' + (app.name || app.applicant_name))
      toast('Application rejected', 'success')
    })
  }

  var apps = hostApps || []
  var pending = apps.filter(function(a) { return a.status === 'pending' })
  var approved = apps.filter(function(a) { return a.status === 'approved' })
  var rejected = apps.filter(function(a) { return a.status === 'rejected' })

  var shown = view === 'pending' ? pending : view === 'approved' ? approved : rejected

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        {[['pending', pending.length], ['approved', approved.length], ['rejected', rejected.length]].map(function(pair) {
          return (
            <button
              key={pair[0]}
              onClick={function() { setView(pair[0]) }}
              className={'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm border transition-all ' + (view === pair[0] ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant/20 text-on-surface/50 hover:bg-white/5')}
            >
              {pair[0]} ({pair[1]})
            </button>
          )
        })}
      </div>

      <Panel>
        {shown.length === 0 && (
          <div className="text-center py-10 text-on-surface/40 text-sm">No {view} applications.</div>
        )}
        {shown.map(function(app) {
          return (
            <div key={app.id} className="py-4 border-b border-outline-variant/5 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-on-surface">{app.name || app.applicant_name}</span>
                    {app.org && <span className="text-xs text-on-surface/50">{app.org}</span>}
                  </div>
                  {app.email && <div className="text-xs text-on-surface/50 mb-1">{app.email}</div>}
                  {app.frequency && <div className="text-xs text-on-surface/50 mb-1">Frequency: {app.frequency}</div>}
                  {app.reason && <div className="text-sm text-on-surface/70 mt-2 leading-relaxed">{app.reason}</div>}
                  <div className="text-[11px] text-on-surface/40 mt-2">{app.created_at ? new Date(app.created_at).toLocaleDateString() : ''}</div>
                </div>
                {view === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Btn variant="primary" size="sm" onClick={function() { approveApp(app) }}>Approve</Btn>
                    <Btn variant="ghost" size="sm" onClick={function() { rejectApp(app) }}>Reject</Btn>
                  </div>
                )}
                {view === 'approved' && (
                  <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded-sm flex-shrink-0">APPROVED</span>
                )}
              </div>
            </div>
          )
        })}
      </Panel>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/admin/HostsTab.jsx
git commit -m "feat: add admin HostsTab with application review, approve/reject, user_roles upsert"
```

---

## Task 8: Replace AdminScreen.jsx shell

**Files:**
- Modify: `src/screens/AdminScreen.jsx`

This replaces the entire 1,777-line file with a ~150-line shell.

- [ ] **Step 1: Overwrite AdminScreen.jsx**

```jsx
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'
import OverviewTab from './admin/OverviewTab'
import PlayersTab from './admin/PlayersTab'
import TournamentTab from './admin/TournamentTab'
import ResultsTab from './admin/ResultsTab'
import SettingsTab from './admin/SettingsTab'
import AuditTab from './admin/AuditTab'
import HostsTab from './admin/HostsTab'

var ADMIN_GROUPS = [
  { label: 'LIVE', items: [
    { id: 'overview', label: 'Overview', icon: 'speed' },
    { id: 'tournament', label: 'Tournament', icon: 'bolt' },
    { id: 'results', label: 'Results', icon: 'leaderboard' },
  ]},
  { label: 'MANAGE', items: [
    { id: 'players', label: 'Players', icon: 'group' },
    { id: 'hosts', label: 'Hosts', icon: 'sports_esports' },
  ]},
  { label: 'SYSTEM', items: [
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'audit', label: 'Audit Log', icon: 'assignment' },
  ]},
]

var TAB_INFO = {
  overview: 'Command center: stat cards, quick actions, and recent activity.',
  tournament: 'Run weekly clashes and create custom tournaments.',
  results: 'Enter per-game placements and publish earned points.',
  players: 'Full roster: edit, ban, note, scrims access, disputes.',
  hosts: 'Review host applications and manage approved hosts.',
  settings: 'Broadcast, ticker, sponsors, season management, danger zone.',
  audit: 'Full server-side log of every admin action.',
}

export default function AdminScreen() {
  var ctx = useApp()
  var isAdmin = ctx.isAdmin
  var currentUser = ctx.currentUser
  var hostApps = ctx.hostApps
  var tournamentState = ctx.tournamentState

  var _tab = useState('overview')
  var tab = _tab[0]
  var setTab = _tab[1]

  var _sidebarOpen = useState(true)
  var sidebarOpen = _sidebarOpen[0]
  var setSidebarOpen = _sidebarOpen[1]

  if (!isAdmin) {
    return (
      <PageLayout>
        <div className="text-center max-w-md mx-auto py-20">
          <Icon name="lock" size={38} className="text-on-surface/40 mb-4" />
          <h2 className="text-on-surface font-bold text-lg mb-2">Admin Required</h2>
          <p className="text-on-surface/50 text-sm">Contact an admin to get access.</p>
        </div>
      </PageLayout>
    )
  }

  var pendingHosts = (hostApps || []).filter(function(a) { return a.status === 'pending' }).length
  var currentPhase = (tournamentState && tournamentState.phase) || 'registration'
  var phaseLabel = { registration: 'Registration', checkin: 'Check-in', inprogress: 'Live', complete: 'Complete' }
  var phaseColor = { registration: 'text-primary border-primary', checkin: 'text-secondary border-secondary', inprogress: 'text-success border-success', complete: 'text-tertiary border-tertiary' }

  return (
    <PageLayout maxWidth="max-w-full">
      <div className="flex gap-0 min-h-[calc(100vh-80px)] -mx-4 -mb-4">

        {/* Sidebar */}
        <div className={'bg-surface-container-lowest border-r border-outline-variant/10 flex-shrink-0 flex flex-col transition-all duration-200 relative z-10 overflow-hidden ' + (sidebarOpen ? 'w-[230px]' : 'w-0')}>
          <div className="px-4 pt-4 pb-3 border-b border-outline-variant/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center flex-shrink-0">
                <Icon name="admin_panel_settings" size={17} className="text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm text-on-surface leading-none">Admin</div>
                <div className="text-[10px] text-on-surface/40 mt-0.5">{currentUser && currentUser.username || 'Admin'}</div>
              </div>
            </div>
            <div className={'mt-2.5 px-2.5 py-1 rounded-sm text-center text-[10px] font-bold border bg-transparent ' + (phaseColor[currentPhase] || phaseColor.registration)}>
              {phaseLabel[currentPhase]}
            </div>
            {pendingHosts > 0 && (
              <div className="mt-1.5 px-2.5 py-1 bg-error/5 border border-error/20 rounded-sm text-center text-[10px] font-bold text-error cursor-pointer" onClick={function() { setTab('hosts') }}>
                {pendingHosts + ' pending host app' + (pendingHosts > 1 ? 's' : '')}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
            {ADMIN_GROUPS.map(function(group) {
              return (
                <div key={group.label} className="mb-1">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-on-surface/40 tracking-widest uppercase">{group.label}</div>
                  {group.items.map(function(item) {
                    var active = tab === item.id
                    var label = item.id === 'hosts' && pendingHosts > 0 ? item.label + ' (' + pendingHosts + ')' : item.label
                    return (
                      <button
                        key={item.id}
                        onClick={function() { setTab(item.id) }}
                        className={'flex items-center gap-2.5 w-full px-4 py-2 border-none text-left text-sm cursor-pointer transition-all duration-100 ' + (active ? 'bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary' : 'bg-transparent text-on-surface/50 hover:bg-white/5')}
                      >
                        <Icon name={item.icon} size={16} className={'flex-shrink-0 ' + (active ? 'opacity-100' : 'opacity-60')} />
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3 border-t border-outline-variant/10 text-[11px] text-on-surface/40 leading-snug">
            <Icon name="info" size={12} className="mr-1 inline-block" />
            {TAB_INFO[tab] || ''}
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={function() { setSidebarOpen(function(v) { return !v }) }}
          className="w-5 bg-surface-container-lowest border-r border-outline-variant/10 flex items-center justify-center text-on-surface/30 hover:text-on-surface/60 hover:bg-white/5 transition-all flex-shrink-0 cursor-pointer border-0"
        >
          <Icon name={sidebarOpen ? 'chevron_left' : 'chevron_right'} size={14} />
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'overview' && <OverviewTab setTab={setTab} />}
          {tab === 'players' && <PlayersTab />}
          {tab === 'tournament' && <TournamentTab />}
          {tab === 'results' && <ResultsTab />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'hosts' && <HostsTab />}
        </div>

      </div>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Verify the app loads**

Run: `npm run dev` (in another terminal) then navigate to `/admin`
Expected: Admin panel renders with 7-tab sidebar, no console errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/AdminScreen.jsx
git commit -m "feat: replace AdminScreen monolith with 7-tab modular shell (150 lines)"
```

---

## Task 9: EventsScreen Fix 1 - Registration persistence on mount

**Files:**
- Modify: `src/screens/EventsScreen.jsx`

The `FeaturedTab` component doesn't load existing registrations from DB on mount, so they vanish on refresh.

- [ ] **Step 1: Add useEffect to FeaturedTab to load registrations**

Find the `FeaturedTab` function (starts around line 165). Add a `useEffect` import is already present. Add this useEffect inside the function, after the existing state declarations:

```js
// In FeaturedTab, after the existing state vars (filter, sortBy):
useEffect(function() {
  if (!currentUser || !currentUser.username) return
  supabase.from('event_registrations').select('event_id').eq('player_username', currentUser.username).then(function(res) {
    if (res.error || !res.data) return
    var ids = res.data.map(function(r) { return r.event_id })
    if (ids.length === 0) return
    if (setFeaturedEvents) {
      setFeaturedEvents(function(evts) {
        return evts.map(function(ev) {
          var matched = ids.indexOf(ev.id) !== -1 || ids.indexOf(String(ev.id)) !== -1
          if (!matched) return ev
          var alreadyIn = (ev.registeredIds || []).indexOf(currentUser.username) !== -1
          if (alreadyIn) return ev
          return Object.assign({}, ev, { registeredIds: (ev.registeredIds || []).concat([currentUser.username]) })
        })
      })
    }
  })
}, [currentUser && currentUser.username])
```

- [ ] **Step 2: Fix filter pills to use tags instead of type**

Find the `filtered` variable calculation in `FeaturedTab` (around line 174-183). Replace the `filter !== 'all' && filter !== 'live'` branch:

Old:
```js
} else {
    filtered = active.filter(function(e) {
      return !e.type || e.type === filter
    })
  }
```

New:
```js
} else {
    filtered = active.filter(function(e) {
      var tags = (e.tags || []).map(function(t) { return t.toLowerCase() })
      return tags.indexOf(filter.toLowerCase()) !== -1
    })
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/EventsScreen.jsx
git commit -m "fix: EventsScreen - load registrations from DB on mount, filter by tags not type"
```

---

## Task 10: EventsScreen Fixes 2 - Archive links, tournament register buttons, ID mismatch

**Files:**
- Modify: `src/screens/EventsScreen.jsx`

- [ ] **Step 1: Fix archive navigate links**

Find `ArchiveTab` in EventsScreen.jsx. Find the line that does `navigate('/results')` (there may be multiple). Replace each hardcoded `navigate('/results')` with navigation that passes the clash ID:

Old (in the archive item click handler):
```js
navigate('/results')
```

New:
```js
navigate('/results', { state: { clashId: clash.id, clashName: clash.name } })
```

- [ ] **Step 2: Fix TournamentCard WATCH BROADCAST link (Fix 5)**

Find `TournamentCard` (around line 31). Find the two `navigate('/tournament/' + ev.id)` calls. Update them to use `ev.dbTournamentId` when available:

Old:
```js
onClick={function() { navigate('/tournament/' + ev.id) }}
```

New (in the container `article` onClick and in the WATCH BROADCAST button):
```js
onClick={function() { navigate('/tournament/' + (ev.dbTournamentId || ev.id)) }}
```

Apply this to BOTH the article `onClick` and the WATCH BROADCAST button `onClick`.

- [ ] **Step 3: Add register buttons to TournamentsTab cards (Fix 4)**

Find `TournamentsTab` in EventsScreen.jsx. Locate where tournament cards are rendered. Add a `useEffect` to load registrations and a register function.

Find the `TournamentsTab` function and add the following inside it (after the existing state/logic):

```js
// In TournamentsTab - add this state and logic:
var _tourRegIds = useState([])
var tourRegIds = _tourRegIds[0]
var setTourRegIds = _tourRegIds[1]

useEffect(function() {
  if (!currentUser || !currentUser.username) return
  supabase.from('registrations').select('tournament_id').eq('player_username', currentUser.username).then(function(res) {
    if (res.data) setTourRegIds(res.data.map(function(r) { return r.tournament_id }))
  })
}, [currentUser && currentUser.username])

function handleTourRegister(t) {
  if (!currentUser) { if (onAuthClick) onAuthClick('login'); return }
  supabase.from('registrations').upsert({
    tournament_id: t.id,
    player_username: currentUser.username,
    player_id: currentUser.id
  }, { onConflict: 'tournament_id,player_username' }).then(function(res) {
    if (res.error) { if (toast) toast('Registration failed: ' + res.error.message, 'error'); return }
    setTourRegIds(function(ids) { return ids.concat([t.id]) })
    if (toast) toast('Registered for ' + t.name, 'success')
  })
}
```

Then in the tournament card render (inside the `TournamentsTab` return), add a register button at the bottom of each card. Find where tournament cards are mapped and add before closing the card element:

```jsx
{/* Add register button to tournament card - add after existing card content */}
<div className="mt-3">
  {tourRegIds.indexOf(t.id) !== -1
    ? <button className="w-full py-2 border border-primary/20 text-primary font-label text-xs font-bold uppercase tracking-widest cursor-default glass-panel">REGISTERED</button>
    : <button className="w-full py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary bg-gradient-to-br from-primary to-primary-fixed-dim hover:opacity-90 transition-all" onClick={function(e) { e.stopPropagation(); handleTourRegister(t) }}>REGISTER</button>
  }
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/EventsScreen.jsx
git commit -m "fix: EventsScreen - archive links pass clash ID/name, tournament cards get register buttons, WATCH BROADCAST uses dbTournamentId"
```

---

## Task 11: TournamentDetailScreen fixes (6, 7, 8)

**Files:**
- Modify: `src/screens/TournamentDetailScreen.jsx`

- [ ] **Step 1: Fix rules panel to read from rules_text column (Fix 6)**

Find the Rules Tab section (around line 622). Find the hardcoded rules list. The section renders `TIEBREAKERS` below the points table. Add rules_text rendering above the tiebreakers section.

Find this block in the Rules tab (inside `{detailTab === 'rules' && ...}`):
```jsx
{/* Full scoring table */}
```

Insert before the scoring table (or find the section that shows generic rules and replace it). Look for any hardcoded rules text and replace the rules panel with:

```jsx
{/* Tournament Rules */}
<div className="bg-surface-container-low p-8 border-l-4 border-secondary">
  <div className="flex items-center justify-between mb-6">
    <h2 className="font-serif text-3xl italic font-bold">Tournament Rules</h2>
    <Icon name="gavel" className="text-secondary text-2xl" />
  </div>
  {(event.rulesText || event.rules_text) ? (
    <pre className="text-sm text-on-surface/80 whitespace-pre-wrap font-body leading-relaxed">{event.rulesText || event.rules_text}</pre>
  ) : (
    <div className="space-y-3 text-sm text-on-surface/70">
      <p>1. All participants must be checked in before the round starts.</p>
      <p>2. Placements are reported by lobby hosts immediately after each game.</p>
      <p>3. Disputes must be submitted within 10 minutes of the game ending.</p>
      <p>4. Unsportsmanlike conduct may result in disqualification.</p>
    </div>
  )}
</div>
```

- [ ] **Step 2: Fix prize distribution to use real data (Fix 7)**

Find the `PRIZE_BARS` usage in the Rules or Overview tab. It's used in a prize bar section. Find where `PRIZE_BARS` is mapped and replace the entire prize section with:

```jsx
{/* Prize Distribution - only render if real data exists */}
{event.prize_pool_json && event.prize_pool_json.length > 0 && (
  <div className="bg-surface-container-low p-8 border-l-4 border-tertiary">
    <div className="flex items-center justify-between mb-6">
      <h2 className="font-serif text-3xl italic font-bold">Prize Pool</h2>
      <Icon name="payments" className="text-tertiary text-2xl" />
    </div>
    <div className="space-y-3">
      {event.prize_pool_json.map(function(entry) {
        var ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
        return (
          <div key={entry.placement} className="flex items-center justify-between px-4 py-3 bg-surface-container border border-outline-variant/10 rounded-sm">
            <span className="font-label text-xs font-bold uppercase tracking-wider text-on-surface/60">{ordinals[entry.placement] || entry.placement + 'th'} PLACE</span>
            <span className="font-stats font-bold text-lg text-tertiary">{entry.prize}</span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

Find the existing `PRIZE_BARS.map(...)` section and remove it (replace with the above).

- [ ] **Step 3: Fix Manage Tournament link (Fix 8)**

Find the "Manage Tournament" button/link in TournamentDetailScreen.jsx. It currently checks `event.hostTournamentId && event.host === currentUser.username`.

Replace the condition with:
```jsx
{(event.dbTournamentId || event.hostTournamentId) && currentUser && (currentUser.id === event.host_id || currentUser.username === event.host) && (
  <button
    className="px-4 py-2 border border-secondary/30 text-secondary font-label text-xs font-bold uppercase tracking-widest hover:bg-secondary/10 transition-all rounded-sm"
    onClick={function() { navigate('/host/dashboard') }}
  >
    Manage Tournament
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/TournamentDetailScreen.jsx
git commit -m "fix: TournamentDetailScreen - rules from DB, real prize data, manage link uses DB ID and host_id"
```

---

## Task 12: HostDashboardScreen fixes (9, 10, 11, 12)

**Files:**
- Modify: `src/screens/HostDashboardScreen.jsx`

- [ ] **Step 1: Fix image uploads to use host-assets bucket (Fix 9)**

Find the `uploadImage` function (around line 363). It has two occurrences of `supabase.storage.from("avatars")`. Replace both:

Old:
```js
supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true })
```

New:
```js
supabase.storage.from("host-assets").upload(path, file, { cacheControl: "3600", upsert: true })
```

And the getPublicUrl call:

Old:
```js
var url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
```

New:
```js
var url = supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
```

- [ ] **Step 2: Fix tournament query to use auth user ID (Fix 10)**

Find the `useEffect` that loads host tournaments (around line 340-361). Change:

Old:
```js
.eq("host_id", currentUser.id)
```

New:
```js
.eq("host_id", currentUser.auth_user_id || currentUser.id)
```

- [ ] **Step 3: Fix submitWizard to write flash_tournament type (Fix 11)**

Find `submitWizard` (around line 444). Find the Supabase insert call. Change:

Old:
```js
type: savedWizData.type,
```

New:
```js
type: 'flash_tournament',
format_type: savedWizData.type,
host_id: currentUser ? (currentUser.auth_user_id || currentUser.id) : null,
```

Also update the `created_by` line below it — change:
```js
created_by: currentUser ? currentUser.id : null,
```
to:
```js
created_by: currentUser ? (currentUser.auth_user_id || currentUser.id) : null,
```

- [ ] **Step 4: Fix sendAnnouncement to persist to DB (Fix 12)**

Find `sendAnnouncement` (around line 541). After the existing local state update, add DB writes:

Old (end of function):
```js
setAnnounceMsg("");
toast("Announcement sent to " + (announceTo === "all" ? "all players" : announceTo + " players"), "success");
```

New (replace those two lines with):
```js
var activeTournamentId = null
if (tournaments && tournaments.length > 0) {
  var live = tournaments.filter(function(t) { return t.status === "live" })
  if (live.length > 0) activeTournamentId = live[0].dbId || live[0].id
}
supabase.from('notifications').insert({
  type: 'host_announce',
  body: a.msg,
  target_user_id: null,
  tournament_id: activeTournamentId || null
}).then(function(r) { if (r.error) console.error('[TFT] Notification insert failed:', r.error) })
if (activeTournamentId) {
  supabase.from('site_settings').upsert({ key: 'host_announcement_' + activeTournamentId, value: JSON.stringify(a) }, { onConflict: 'key' }).then(function(r) { if (r.error) console.error('[TFT] Site settings write failed:', r.error) })
}
setAnnounceMsg("");
toast("Announcement sent to " + (announceTo === "all" ? "all players" : announceTo + " players"), "success");
```

- [ ] **Step 5: Verify the app still runs**

Run: `npm run dev` and navigate to `/host/dashboard`
Expected: Tournament wizard creates with `type: 'flash_tournament'`, images upload to host-assets, announcements log to DB.

- [ ] **Step 6: Commit**

```bash
git add src/screens/HostDashboardScreen.jsx
git commit -m "fix: HostDashboardScreen - host-assets bucket, auth_user_id for queries, flash_tournament type, announcements persist to DB"
```

---

## Verification Checklist

After all tasks are complete, run through these manually:

**Admin Panel:**
- [ ] Navigate to `/admin` - sidebar renders with 7 tabs
- [ ] Overview: stat cards show player/check-in counts, Quick Actions buttons work
- [ ] Players: roster loads, Edit player saves to DB, Ban/Unban works, scrims list persists
- [ ] Tournament: Phase stepper advances Registration -> Check-in -> Live, custom tournament creates in DB
- [ ] Results: only shows when players are checked in, placement grid validates duplicates, Publish writes to game_results
- [ ] Settings: broadcast sends and appears as announcement, ticker items save, danger zone requires confirm
- [ ] Audit: server-side pagination loads 25 at a time, filters work
- [ ] Hosts: pending applications load, Approve updates host_applications and upserts user_roles

**EventsScreen:**
- [ ] Refresh page while registered for an event - registration status persists
- [ ] Filter pills (Community/Official/Regional) filter by tags correctly
- [ ] Archive items navigate to `/results` with state (not all to same generic page)
- [ ] Tournaments tab cards have Register button that writes to DB

**TournamentDetailScreen:**
- [ ] If tournament has `rules_text`, it appears in the Rules tab instead of generic text
- [ ] If tournament has `prize_pool_json`, real prize rows render (no fake % bars)
- [ ] Manage Tournament link only shows for the host and uses DB tournament ID

**HostDashboardScreen:**
- [ ] Image uploads succeed (check browser network for host-assets bucket in URL)
- [ ] Tournaments created via wizard appear in EventsScreen Tournaments tab (type=flash_tournament)
- [ ] Announcements show toast AND insert to notifications table (check Supabase dashboard)
