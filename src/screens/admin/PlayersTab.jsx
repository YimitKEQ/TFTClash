import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { RANKS, REGIONS } from '../../lib/constants.js'
import { sanitize } from '../../lib/utils.js'
import { Panel, Btn, Inp, Icon } from '../../components/ui'

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
  var scrimHostAccess = ctx.scrimHostAccess
  var setScrimHostAccess = ctx.setScrimHostAccess
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

  var _newScrimHostUser = useState('')
  var newScrimHostUser = _newScrimHostUser[0]
  var setNewScrimHostUser = _newScrimHostUser[1]

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
    var updatedList = (scrimAccess || []).concat([u])
    setScrimAccess(updatedList)
    if (supabase.from) {
      supabase.from('site_settings').upsert({
        key: 'scrim_access',
        value: JSON.stringify(updatedList)
      }, { onConflict: 'key' })
    }
    addAudit('ACTION', 'Scrims access granted: ' + u)
    setNewScrimUser('')
    toast(u + ' added to scrims access', 'success')
  }

  function removeScrimUser(u) {
    var updatedList = (scrimAccess || []).filter(function(x) { return x !== u })
    setScrimAccess(updatedList)
    if (supabase.from) {
      supabase.from('site_settings').upsert({
        key: 'scrim_access',
        value: JSON.stringify(updatedList)
      }, { onConflict: 'key' })
    }
    addAudit('ACTION', 'Scrims access removed: ' + u)
    toast(u + ' removed from scrims access', 'success')
  }

  function addScrimHostUser() {
    var u = newScrimHostUser.trim()
    if (!u) { toast('Enter a username', 'error'); return }
    if ((scrimHostAccess || []).includes(u)) { toast('Already a host', 'error'); return }
    var updatedList = (scrimHostAccess || []).concat([u])
    setScrimHostAccess(updatedList)
    if (supabase.from) {
      supabase.from('site_settings').upsert({
        key: 'scrim_host_access',
        value: JSON.stringify(updatedList)
      }, { onConflict: 'key' })
    }
    addAudit('ACTION', 'Scrim host access granted: ' + u)
    setNewScrimHostUser('')
    toast(u + ' added as scrim host', 'success')
  }

  function removeScrimHostUser(u) {
    var updatedList = (scrimHostAccess || []).filter(function(x) { return x !== u })
    setScrimHostAccess(updatedList)
    if (supabase.from) {
      supabase.from('site_settings').upsert({
        key: 'scrim_host_access',
        value: JSON.stringify(updatedList)
      }, { onConflict: 'key' })
    }
    addAudit('ACTION', 'Scrim host access removed: ' + u)
    toast(u + ' removed from scrim host access', 'success')
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
                {(REGIONS || ['EUW', 'EUNE', 'NA', 'KR', 'TR']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rank</label>
              <Sel value={editP.rank || 'Gold'} onChange={function(v) { setEditP(Object.assign({}, editP, { rank: v })) }}>
                {(RANKS || ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
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
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">
                Season Pts <span className="text-error font-bold">DANGER</span>
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
                {(REGIONS || ['EUW', 'EUNE', 'NA']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rank</label>
              <Sel value={addForm.rank} onChange={function(v) { setAddForm(Object.assign({}, addForm, { rank: v })) }}>
                {(RANKS || ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
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
                          ? <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded-sm">{'DNP x' + p.dnpCount}</span>
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

      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="swords" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Scrims Access</span>
        </div>
        <div className="text-xs text-on-surface/40 mb-3">Scrimmers can view sessions, stats and history. Use exact usernames (case-sensitive).</div>
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

      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="manage_accounts" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Scrim Host Access</span>
        </div>
        <div className="text-xs text-on-surface/40 mb-3">Hosts can create sessions, enter placements and lock games. Use exact usernames (case-sensitive).</div>
        <div className="flex gap-2 mb-3">
          <Inp value={newScrimHostUser} onChange={function(e) { setNewScrimHostUser(typeof e === 'string' ? e : e.target.value) }} placeholder="Username" onKeyDown={function(e) { if (e.key === 'Enter') addScrimHostUser() }} />
          <Btn variant="primary" size="sm" onClick={addScrimHostUser}>Add</Btn>
        </div>
        {(!scrimHostAccess || scrimHostAccess.length === 0) ? (
          <div className="text-center py-4 text-on-surface/40 text-sm">No hosts added yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(scrimHostAccess || []).map(function(u) {
              return (
                <div key={u} className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-sm">
                  <span className="text-sm font-semibold text-primary">{u}</span>
                  <button onClick={function() { removeScrimHostUser(u) }} className="bg-transparent border-0 text-error cursor-pointer text-base leading-none px-1">x</button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

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
                  <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded-sm ' + (d.status === 'pending' ? 'text-tertiary bg-tertiary/10' : 'text-on-surface/40 bg-surface-container-high')}>{d.status || 'pending'}</span>
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
