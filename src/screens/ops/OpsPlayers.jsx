import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { RANKS, REGIONS } from '../../lib/constants.js'
import { sanitize, addAudit as sharedAddAudit } from '../../lib/utils.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'

export default function OpsPlayers(props) {
  var navigate = props.navigate

  var ctx = useApp()
  var players = ctx.players || []
  var setPlayers = ctx.setPlayers
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _search = useState('')
  var search = _search[0]
  var setSearch = _search[1]

  var _editP = useState(null)
  var editP = _editP[0]
  var setEditP = _editP[1]

  var _showAdd = useState(false)
  var showAdd = _showAdd[0]
  var setShowAdd = _showAdd[1]

  var _addForm = useState({ name: '', riotId: '', region: 'EU', rank: 'Gold' })
  var addForm = _addForm[0]
  var setAddForm = _addForm[1]

  var _noteTarget = useState(null)
  var noteTarget = _noteTarget[0]
  var setNoteTarget = _noteTarget[1]

  var _noteText = useState('')
  var noteText = _noteText[0]
  var setNoteText = _noteText[1]

  var _sortBy = useState('pts')
  var sortBy = _sortBy[0]
  var setSortBy = _sortBy[1]

  function addAudit(type, msg) { sharedAddAudit(supabase, currentUser, type, msg) }

  function ban(id, name) {
    if (!window.confirm('Ban ' + name + '? They will be removed from active play.')) return
    supabase.from('players').update({ banned: true, checked_in: false }).eq('id', id)
      .then(function(r) {
        if (r.error) { toast('Ban failed: ' + r.error.message, 'error'); return }
        setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { banned: true, checkedIn: false }) : p }) })
        addAudit('WARN', 'Banned: ' + name)
        toast(name + ' banned', 'success')
      })
      .catch(function() { toast('Ban failed', 'error') })
  }

  function unban(id, name) {
    if (!window.confirm('Unban ' + name + '?')) return
    supabase.from('players').update({ banned: false, dnp_count: 0 }).eq('id', id)
      .then(function(r) {
        if (r.error) { toast('Unban failed: ' + r.error.message, 'error'); return }
        setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { banned: false, dnpCount: 0 }) : p }) })
        addAudit('ACTION', 'Unbanned: ' + name)
        toast(name + ' unbanned', 'success')
      })
      .catch(function() { toast('Unban failed', 'error') })
  }

  function remove(id, name) {
    if (!window.confirm('Delete ' + name + '? This cannot be undone.')) return
    supabase.from('players').delete().eq('id', id)
      .then(function(r) {
        if (r.error) { toast('Delete failed: ' + r.error.message, 'error'); return }
        setPlayers(function(ps) { return ps.filter(function(p) { return p.id !== id }) })
        addAudit('ACTION', 'Removed player: ' + name)
        toast(name + ' removed', 'success')
      })
      .catch(function() { toast('Delete failed', 'error') })
  }

  function saveEdit() {
    if (!editP) return
    var updates = {
      username: editP.name, riot_id: editP.riotId, region: editP.region, rank: editP.rank,
      role: editP.role, season_pts: editP.pts, banned: editP.banned, dnp_count: editP.dnpCount || 0
    }
    supabase.from('players').update(updates).eq('id', editP.id)
      .then(function(r) {
        if (r.error) { toast('Save failed: ' + r.error.message, 'error'); return }
        setPlayers(function(ps) { return ps.map(function(p) { return p.id === editP.id ? Object.assign({}, p, editP) : p }) })
        if (editP._ptsChanged) addAudit('DANGER', 'Season pts override: ' + editP.name + ' -> ' + editP.pts)
        else addAudit('ACTION', 'Player updated: ' + editP.name)
        toast('Saved ' + editP.name, 'success')
        setEditP(null)
      })
      .catch(function() { toast('Save failed', 'error') })
  }

  function saveNote() {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === noteTarget.id ? Object.assign({}, p, { notes: noteText }) : p }) })
    supabase.from('players').update({ notes: noteText }).eq('id', noteTarget.id)
      .then(function(r) { if (r.error) toast('Note save failed', 'error') })
      .catch(function() { toast('Note save failed', 'error') })
    addAudit('ACTION', 'Note updated: ' + noteTarget.name)
    toast('Note saved', 'success')
    setNoteTarget(null)
  }

  function addPlayer() {
    var n = sanitize(addForm.name.trim())
    var r = sanitize(addForm.riotId.trim())
    if (!n || !r) { toast('Name and Riot ID required', 'error'); return }
    if (players.find(function(p) { return (p.name || '').toLowerCase() === n.toLowerCase() })) { toast('Name taken', 'error'); return }
    supabase.from('players').insert({ username: n, riot_id: r, rank: addForm.rank || 'Gold', region: addForm.region || 'EU' }).select().single()
      .then(function(res) {
        if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
        setPlayers(function(ps) { return ps.concat([Object.assign({}, res.data, { name: n, pts: 0, wins: 0, games: 0 })]) })
        addAudit('ACTION', 'Player added: ' + n)
        toast(n + ' added!', 'success')
        setAddForm({ name: '', riotId: '', region: 'EU', rank: 'Gold' })
        setShowAdd(false)
      }).catch(function() { toast('Failed to add', 'error') })
  }

  function adjustPoints(id, name, amount) {
    var newPts = (players.find(function(p) { return p.id === id }) || {}).pts || 0
    newPts = Math.max(0, newPts + amount)
    supabase.from('players').update({ season_pts: newPts }).eq('id', id)
      .then(function(r) {
        if (r.error) { toast('Adjust failed: ' + r.error.message, 'error'); return }
        setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { pts: newPts }) : p }) })
        supabase.from('point_adjustments').insert({
          player_id: id, amount: amount, reason: 'Admin adjustment from Command Center',
          admin_id: currentUser ? currentUser.id : null
        }).then(function() {}).catch(function() {})
        addAudit('DANGER', 'Points adjusted: ' + name + ' ' + (amount > 0 ? '+' : '') + amount + ' -> ' + newPts)
        toast(name + ': ' + (amount > 0 ? '+' : '') + amount + ' pts', 'success')
      })
      .catch(function() { toast('Adjust failed', 'error') })
  }

  // Sort
  var sorted = players.slice().sort(function(a, b) {
    if (sortBy === 'pts') return (b.pts || 0) - (a.pts || 0)
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
    if (sortBy === 'games') return (b.games || 0) - (a.games || 0)
    return 0
  })
  var filtered = search
    ? sorted.filter(function(p) { return (p.name || '').toLowerCase().indexOf(search.toLowerCase()) !== -1 || (p.riotId || '').toLowerCase().indexOf(search.toLowerCase()) !== -1 })
    : sorted

  // Edit view
  if (editP) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Btn v="ghost" s="sm" onClick={function() { setEditP(null) }}>
            <Icon name="arrow_back" size={16} /> Back
          </Btn>
          <h2 className="font-display text-lg font-bold text-on-surface">Edit: {editP.name}</h2>
        </div>
        <Panel className="max-w-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Display Name</label>
              <Inp value={editP.name || ''} onChange={function(v) { setEditP(Object.assign({}, editP, { name: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Riot ID</label>
              <Inp value={editP.riotId || ''} onChange={function(v) { setEditP(Object.assign({}, editP, { riotId: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Region</label>
              <Sel value={editP.region || 'EU'} onChange={function(v) { setEditP(Object.assign({}, editP, { region: v })) }}>
                {(REGIONS || ['EU', 'EUNE', 'NA', 'KR', 'TR']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rank</label>
              <Sel value={editP.rank || 'Gold'} onChange={function(v) { setEditP(Object.assign({}, editP, { rank: v })) }}>
                {(RANKS || ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Role</label>
              <Sel value={editP.role || 'player'} onChange={function(v) { setEditP(Object.assign({}, editP, { role: v })) }}>
                <option value="player">Player</option>
                <option value="pro">Pro</option>
                <option value="host">Host</option>
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
            <span className="text-sm text-on-surface/50">DNP: {editP.dnpCount || 0}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Btn v="primary" onClick={saveEdit}>Save Changes</Btn>
            <Btn v="dark" onClick={function() { setEditP(null) }}>Cancel</Btn>
          </div>
        </Panel>
      </div>
    )
  }

  // Note view
  if (noteTarget) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Btn v="ghost" s="sm" onClick={function() { setNoteTarget(null) }}>
            <Icon name="arrow_back" size={16} /> Back
          </Btn>
          <h2 className="font-display text-lg font-bold text-on-surface">Note: {noteTarget.name}</h2>
        </div>
        <Panel className="max-w-xl space-y-3">
          <textarea
            value={noteText}
            onChange={function(e) { setNoteText(e.target.value) }}
            rows={6}
            className="w-full bg-surface-container border border-outline-variant/10 rounded px-3 py-2.5 text-on-surface text-sm resize-y focus:outline-none focus:border-primary/40"
            placeholder="Admin notes about this player..."
          />
          <div className="flex gap-2">
            <Btn v="primary" onClick={saveNote}>Save Note</Btn>
            <Btn v="dark" onClick={function() { setNoteTarget(null) }}>Cancel</Btn>
          </div>
        </Panel>
      </div>
    )
  }

  // Add player form
  if (showAdd) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Btn v="ghost" s="sm" onClick={function() { setShowAdd(false) }}>
            <Icon name="arrow_back" size={16} /> Back
          </Btn>
          <h2 className="font-display text-lg font-bold text-on-surface">Add Player</h2>
        </div>
        <Panel className="max-w-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Username</label>
              <Inp value={addForm.name} onChange={function(v) { setAddForm(Object.assign({}, addForm, { name: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Riot ID</label>
              <Inp value={addForm.riotId} onChange={function(v) { setAddForm(Object.assign({}, addForm, { riotId: typeof v === 'string' ? v : v.target.value })) }} />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Region</label>
              <Sel value={addForm.region} onChange={function(v) { setAddForm(Object.assign({}, addForm, { region: v })) }}>
                {(REGIONS || ['EU', 'EUNE', 'NA', 'KR', 'TR']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Rank</label>
              <Sel value={addForm.rank} onChange={function(v) { setAddForm(Object.assign({}, addForm, { rank: v })) }}>
                {(RANKS || ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger']).map(function(r) { return <option key={r} value={r}>{r}</option> })}
              </Sel>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Btn v="primary" onClick={addPlayer}>Add Player</Btn>
            <Btn v="dark" onClick={function() { setShowAdd(false) }}>Cancel</Btn>
          </div>
        </Panel>
      </div>
    )
  }

  // Player list (default)
  return (
    <div className="space-y-5">
      {/* Search + actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Icon name="search" size={16} className="text-on-surface/30" />
          <Inp
            value={search}
            onChange={function(v) { setSearch(typeof v === 'string' ? v : v.target.value) }}
            placeholder="Search players..."
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Sel value={sortBy} onChange={setSortBy}>
            <option value="pts">Sort: Points</option>
            <option value="name">Sort: Name</option>
            <option value="games">Sort: Games</option>
          </Sel>
          <Btn v="primary" s="sm" onClick={function() { setShowAdd(true) }}>
            <Icon name="person_add" size={14} /> Add Player
          </Btn>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs font-label uppercase tracking-wider text-on-surface/40">
        <span>{players.length} total</span>
        <span>{players.filter(function(p) { return p.banned }).length} banned</span>
        <span>{players.filter(function(p) { return (p.games || 0) > 0 }).length} active</span>
      </div>

      {/* Player table */}
      <Panel className="!p-0 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-on-surface/20 text-xs font-label uppercase tracking-widest">
              {search ? 'No matches' : 'No players yet'}
            </div>
          ) : filtered.map(function(p) {
            return (
              <div key={p.id} className={'flex items-center gap-3 px-4 py-3 border-b border-outline-variant/5 last:border-0 hover:bg-white/[0.02] transition-colors ' + (p.banned ? 'opacity-50' : '')}>
                <div
                  className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-[11px] font-bold text-on-surface/50 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/30"
                  onClick={function() { navigate('/player/' + (p.name || p.username)) }}
                >
                  {(p.name || p.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-on-surface truncate cursor-pointer hover:text-primary" onClick={function() { navigate('/player/' + (p.name || p.username)) }}>
                      {p.name || p.username}
                    </span>
                    {p.banned && <span className="text-[9px] px-1.5 py-0.5 bg-error/20 text-error font-bold rounded uppercase">Banned</span>}
                    {p.role === 'admin' && <span className="text-[9px] px-1.5 py-0.5 bg-primary/20 text-primary font-bold rounded uppercase">Admin</span>}
                    {p.role === 'host' && <span className="text-[9px] px-1.5 py-0.5 bg-secondary/20 text-secondary font-bold rounded uppercase">Host</span>}
                  </div>
                  <div className="font-label text-[10px] text-on-surface/25 uppercase">
                    {p.rank || 'Unranked'} / {p.region || '?'} / {p.games || 0} games
                  </div>
                </div>
                <div className="font-mono text-sm text-primary font-bold w-14 text-right">{p.pts || 0}</div>
                <div className="flex items-center gap-0.5">
                  <Btn v="ghost" s="sm" onClick={function() { adjustPoints(p.id, p.name, 1) }} title="+1 pt">
                    <Icon name="add" size={14} className="text-success" />
                  </Btn>
                  <Btn v="ghost" s="sm" onClick={function() { adjustPoints(p.id, p.name, -1) }} title="-1 pt">
                    <Icon name="remove" size={14} className="text-error" />
                  </Btn>
                  <Btn v="ghost" s="sm" onClick={function() { setEditP(Object.assign({}, p)) }} title="Edit">
                    <Icon name="edit" size={14} />
                  </Btn>
                  <Btn v="ghost" s="sm" onClick={function() { setNoteTarget(p); setNoteText(p.notes || '') }} title="Notes">
                    <Icon name="sticky_note_2" size={14} />
                  </Btn>
                  {p.banned
                    ? <Btn v="ghost" s="sm" onClick={function() { unban(p.id, p.name) }} title="Unban"><Icon name="lock_open" size={14} className="text-success" /></Btn>
                    : <Btn v="ghost" s="sm" onClick={function() { ban(p.id, p.name) }} title="Ban"><Icon name="block" size={14} className="text-error" /></Btn>
                  }
                  <Btn v="ghost" s="sm" onClick={function() { remove(p.id, p.name) }} title="Delete">
                    <Icon name="delete" size={14} className="text-error/50" />
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
