import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { RANKS, REGIONS, PAST_CLASHES } from '../lib/constants.js'
import { TOURNAMENT_FORMATS } from '../lib/tournament.js'
import { sanitize } from '../lib/utils.js'
import { isComebackEligible } from '../lib/stats.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Inp, Tag, Divider, Icon } from '../components/ui'

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

function ScrimAccessPanel({ scrimAccess, setScrimAccess, toast, addAudit }) {
  var _newUser = useState('')
  var newUser = _newUser[0]
  var setNewUser = _newUser[1]

  function addUser() {
    var u = newUser.trim()
    if (!u) { toast('Enter a username', 'error'); return }
    if ((scrimAccess || []).includes(u)) { toast('Already in list', 'error'); return }
    setScrimAccess(function(a) { return (a || []).concat([u]) })
    addAudit('ACTION', 'Scrims access granted to ' + u)
    setNewUser('')
    toast(u + ' added to Scrims access', 'success')
  }

  function removeUser(u) {
    setScrimAccess(function(a) { return (a || []).filter(function(x) { return x !== u }) })
    addAudit('ACTION', 'Scrims access removed from ' + u)
    toast(u + ' removed from Scrims access', 'success')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Panel accent="purple">
        <h3 className="text-sm font-bold text-on-surface mb-1">Scrims Access</h3>
        <div className="text-xs text-on-surface/40 mb-4">Players in this list can access The Lab (Scrims). Admin always has access. Use exact usernames.</div>
        <div className="flex gap-2 mb-4">
          <Inp value={newUser} onChange={function(e) { setNewUser(typeof e === 'string' ? e : e.target.value) }} placeholder="Username" onKeyDown={function(e) { if (e.key === 'Enter') addUser() }} />
          <Btn variant="primary" size="sm" onClick={addUser}>Add</Btn>
        </div>
        {(!scrimAccess || scrimAccess.length === 0) ? (
          <div className="text-center py-4 text-on-surface/40 text-sm">No users added yet.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(scrimAccess || []).map(function(u) {
              return (
                <div key={u} className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-sm">
                  <span className="text-sm font-semibold text-primary">{u}</span>
                  <button onClick={function() { removeUser(u) }} className="bg-transparent border-0 text-error cursor-pointer text-base leading-none px-1">x</button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
      <Panel>
        <h3 className="text-sm font-bold text-on-surface mb-2">About Scrims Access</h3>
        <div className="text-sm text-on-surface/60 leading-relaxed space-y-2">
          <p>The Lab is the private scrims section where your friend group logs practice games, tracks stats, and sees head-to-head records.</p>
          <p>Only users on this allowlist (plus admin) can see and access the Scrims tab in the nav.</p>
          <p>Usernames must match exactly - they are case-sensitive and must match the account username on this platform.</p>
        </div>
      </Panel>
    </div>
  )
}

function TickerAdminPanel({ tickerOverrides, setTickerOverrides, toast, addAudit }) {
  var _newItem = useState('')
  var newItem = _newItem[0]
  var setNewItem = _newItem[1]
  var items = tickerOverrides || []

  function add() {
    var t = newItem.trim()
    if (!t) { toast('Enter ticker text', 'error'); return }
    if (items.includes(t)) { toast('Already exists', 'error'); return }
    setTickerOverrides(items.concat([t]))
    addAudit('BROADCAST', 'Admin added ticker item: ' + t)
    setNewItem('')
    toast('Ticker item added')
  }

  function remove(item) {
    setTickerOverrides(items.filter(function(x) { return x !== item }))
    addAudit('ACTION', 'Admin removed ticker item: ' + item)
    toast('Removed')
  }

  return (
    <Panel>
      <div className="font-bold text-sm text-on-surface mb-1">Ticker Management</div>
      <div className="text-xs text-on-surface/40 mb-4">Custom items appear first in the community pulse ticker on the home screen. Auto-stats are appended after.</div>
      <div className="flex gap-2 mb-4">
        <Inp value={newItem} onChange={function(e) { setNewItem(typeof e === 'string' ? e : e.target.value) }} placeholder="e.g. Next clash: Saturday 8PM EST" />
        <Btn variant="primary" size="sm" onClick={add}>Add</Btn>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-6 text-on-surface/40 text-sm">No custom ticker items. Auto-stats will still show.</div>
      ) : (
        <div>
          {items.map(function(item, i) {
            return (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[.03] border border-outline-variant/10 rounded-sm mb-1.5">
                <span className="flex-1 text-sm text-on-surface/60">{item}</span>
                <Btn variant="ghost" size="sm" onClick={function() { remove(item) }}>Remove</Btn>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

var AUDIT_COLS = { INFO: '#4ECDC4', ACTION: '#52C47C', WARN: '#E8A838', RESULT: '#9B72CF', BROADCAST: '#E8A838', DANGER: '#F87171' }
var EVENT_COLS = { SCHEDULED: '#E8A838', FLASH: '#F87171', INVITATIONAL: '#9B72CF', WEEKLY: '#4ECDC4' }

var ADMIN_ICON_MAP = {
  dashboard: 'speed', round: 'bolt', quickclash: 'casino', flash: 'emoji_events',
  players: 'group', scores: 'edit', broadcast: 'campaign', schedule: 'calendar_month',
  featured: 'star', season: 'trophy', sponsorships: 'apartment', hosts: 'sports_esports',
  friends: 'swords', ticker: 'rss_feed', audit: 'assignment', settings: 'settings'
}

export default function AdminScreen() {
  var ctx = useApp()
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var toast = ctx.toast
  var setAnnouncement = ctx.setAnnouncement
  var tournamentState = ctx.tournamentState
  var setTournamentState = ctx.setTournamentState
  var seasonConfig = ctx.seasonConfig
  var setSeasonConfig = ctx.setSeasonConfig
  var quickClashes = ctx.quickClashes
  var setQuickClashes = ctx.setQuickClashes
  var orgSponsors = ctx.orgSponsors
  var setOrgSponsors = ctx.setOrgSponsors
  var scheduledEvents = ctx.scheduledEvents
  var setScheduledEvents = ctx.setScheduledEvents
  var auditLog = ctx.auditLog
  var setAuditLog = ctx.setAuditLog
  var hostApps = ctx.hostApps
  var setHostApps = ctx.setHostApps
  var scrimAccess = ctx.scrimAccess
  var setScrimAccess = ctx.setScrimAccess
  var tickerOverrides = ctx.tickerOverrides
  var setTickerOverrides = ctx.setTickerOverrides
  var setNotifications = ctx.setNotifications
  var featuredEvents = ctx.featuredEvents
  var setFeaturedEvents = ctx.setFeaturedEvents
  var currentUser = ctx.currentUser
  var isAdmin = ctx.isAdmin
  var setScreen = ctx.setScreen
  var navigate = ctx.navigate

  var _tab = useState('dashboard')
  var tab = _tab[0]
  var setTab = _tab[1]

  var _editP = useState(null)
  var editP = _editP[0]
  var setEditP = _editP[1]

  var _noteTarget = useState(null)
  var noteTarget = _noteTarget[0]
  var setNoteTarget = _noteTarget[1]

  var _noteText = useState('')
  var noteText = _noteText[0]
  var setNoteText = _noteText[1]

  var _broadMsg = useState('')
  var broadMsg = _broadMsg[0]
  var setBroadMsg = _broadMsg[1]

  var _broadType = useState('NOTICE')
  var broadType = _broadType[0]
  var setBroadType = _broadType[1]

  var _announcements = useState([])
  var announcements = _announcements[0]
  var setAnnouncements = _announcements[1]

  var _newEvent = useState({ name: '', type: 'SCHEDULED', date: '', time: '', cap: '8', format: 'Swiss', notes: '' })
  var newEvent = _newEvent[0]
  var setNewEvent = _newEvent[1]

  var _seedAlgo = useState('rank-based')
  var seedAlgo = _seedAlgo[0]
  var setSeedAlgo = _seedAlgo[1]

  var _paused = useState(false)
  var paused = _paused[0]
  var setPaused = _paused[1]

  var _scoreEdit = useState({})
  var scoreEdit = _scoreEdit[0]
  var setScoreEdit = _scoreEdit[1]

  var _seasonName = useState(seasonConfig && seasonConfig.seasonName || 'Season 1')
  var seasonName = _seasonName[0]
  var setSeasonName = _seasonName[1]

  var _addPlayerForm = useState({ name: '', riotId: '', region: 'EUW', rank: 'Gold' })
  var addPlayerForm = _addPlayerForm[0]
  var setAddPlayerForm = _addPlayerForm[1]

  var _showAddPlayer = useState(false)
  var showAddPlayer = _showAddPlayer[0]
  var setShowAddPlayer = _showAddPlayer[1]

  var _flashForm = useState({ name: 'Flash Tournament', date: '', maxPlayers: '128', gameCount: '3', formatPreset: 'standard', seedingMethod: 'snake', prizeRows: [{ placement: '1', prize: '' }] })
  var flashForm = _flashForm[0]
  var setFlashForm = _flashForm[1]

  var _qcPlacements = useState({})
  var qcPlacements = _qcPlacements[0]
  var setQcPlacements = _qcPlacements[1]

  var _roundConfig = useState({ maxPlayers: '24', roundCount: '3', checkinWindowMins: '30', cutLine: '0', cutAfterGame: '0' })
  var roundConfig = _roundConfig[0]
  var setRoundConfig = _roundConfig[1]

  var _flashEvents = useState([])
  var flashEvents = _flashEvents[0]
  var setFlashEvents = _flashEvents[1]

  var _spForm = useState({ name: '', logo: '', color: '', playerId: '' })
  var spForm = _spForm[0]
  var setSpForm = _spForm[1]

  var _auditFilter = useState('All')
  var auditFilter = _auditFilter[0]
  var setAuditFilter = _auditFilter[1]

  var _sidebarOpen = useState(true)
  var sidebarOpen = _sidebarOpen[0]
  var setSidebarOpen = _sidebarOpen[1]

  var _dbAuditEntries = useState([])
  var dbAuditEntries = _dbAuditEntries[0]
  var setDbAuditEntries = _dbAuditEntries[1]

  var _auditSource = useState('session')
  var auditSource = _auditSource[0]
  var setAuditSource = _auditSource[1]

  var _serverVal = useState(tournamentState && tournamentState.server || 'EU')
  var serverVal = _serverVal[0]
  var setServerVal = _serverVal[1]

  useEffect(function() {
    if (tournamentState && tournamentState.server) setServerVal(tournamentState.server)
  }, [tournamentState && tournamentState.server])

  useEffect(function() {
    supabase.from('tournaments').select('*').eq('type', 'flash_tournament').order('date', { ascending: false }).then(function(res) {
      if (res.data) setFlashEvents(res.data)
    })
  }, [])

  useEffect(function() {
    supabase.from('scheduled_events').select('*').order('created_at', { ascending: false }).then(function(res) {
      if (res.data && res.data.length > 0) setScheduledEvents(res.data)
    })
  }, [])

  useEffect(function() {
    supabase.from('host_applications').select('*').order('created_at', { ascending: false }).then(function(res) {
      if (res.data && res.data.length > 0) {
        setHostApps(res.data.map(function(a) {
          return { id: a.id, userId: a.user_id, name: a.name, email: a.email, org: a.org || '', reason: a.reason || '', freq: a.freq || '', status: a.status || 'pending', submittedAt: a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '', approvedAt: a.approved_at ? new Date(a.approved_at).toLocaleDateString() : '' }
        }))
      }
    })
  }, [])

  useEffect(function() {
    supabase.from('site_settings').select('value').eq('key', 'org_sponsors').single().then(function(res) {
      if (res.data && res.data.value) {
        try { var parsed = JSON.parse(res.data.value); if (parsed && typeof parsed === 'object') setOrgSponsors(parsed) } catch (e) { /* ignore */ }
      }
    })
  }, [])

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

  function loadDbAudit() {
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100).then(function(res) {
      if (res.data) setDbAuditEntries(res.data)
    })
  }

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
      }).then(function(res) { if (res.error) console.error('[TFT] Audit log write failed:', res.error) })
    }
  }

  function ban(id, name) {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { banned: true, checkedIn: false }) : p }) })
    setTournamentState(function(ts) { return Object.assign({}, ts, { checkedInIds: (ts.checkedInIds || []).filter(function(cid) { return String(cid) !== String(id) }) }) })
    if (supabase.from && id) { supabase.from('players').update({ banned: true, checked_in: false }).eq('id', id).then(function(r) { if (r.error) console.error('[TFT] Ban sync failed:', r.error) }) }
    addAudit('WARN', 'Banned: ' + name)
    toast(name + ' banned', 'success')
  }

  function unban(id, name) {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { banned: false, dnpCount: 0 }) : p }) })
    if (supabase.from && id) { supabase.from('players').update({ banned: false, dnp_count: 0 }).eq('id', id).then(function(r) { if (r.error) console.error('[TFT] Unban sync failed:', r.error) }) }
    addAudit('ACTION', 'Unbanned: ' + name)
    toast(name + ' unbanned', 'success')
  }

  function markDNP(id, name) {
    setPlayers(function(ps) { return ps.map(function(p) {
      if (p.id !== id) return p
      var newCount = (p.dnpCount || 0) + 1
      var isDQ = newCount >= 2
      addAudit('WARN', 'DNP #' + newCount + ': ' + name + (isDQ ? ' - AUTO-DQ' : ''))
      if (isDQ) toast(name + ' has 2 DNPs - DISQUALIFIED', 'error')
      else toast(name + ' marked DNP (' + newCount + '/2 before DQ)', 'success')
      if (isDQ) { setTournamentState(function(ts) { return Object.assign({}, ts, { checkedInIds: (ts.checkedInIds || []).filter(function(cid) { return String(cid) !== String(id) }) }) }) }
      if (supabase.from && id) { supabase.from('players').update({ dnp_count: newCount, banned: isDQ ? true : p.banned, checked_in: isDQ ? false : p.checkedIn }).eq('id', id).then(function(r) { if (r.error) console.error('[TFT] DNP sync failed:', r.error) }) }
      return Object.assign({}, p, { dnpCount: newCount, banned: isDQ ? true : p.banned, checkedIn: isDQ ? false : p.checkedIn })
    }) })
  }

  function clearDNP(id, name) {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === id ? Object.assign({}, p, { dnpCount: 0 }) : p }) })
    if (supabase.from && id) { supabase.from('players').update({ dnp_count: 0 }).eq('id', id).then(function(r) { if (r.error) console.error('[TFT] Clear DNP sync failed:', r.error) }) }
    addAudit('ACTION', 'DNP cleared: ' + name)
    toast('DNP cleared for ' + name, 'success')
  }

  function remove(id, name) {
    setPlayers(function(ps) { return ps.filter(function(p) { return p.id !== id }) })
    if (supabase.from && id) { supabase.from('players').delete().eq('id', id).then(function(r) { if (r.error) console.error('[TFT] Player delete failed:', r.error) }) }
    addAudit('ACTION', 'Removed: ' + name)
    toast(name + ' removed', 'success')
  }

  function saveNote() {
    setPlayers(function(ps) { return ps.map(function(p) { return p.id === noteTarget.id ? Object.assign({}, p, { notes: noteText }) : p }) })
    if (supabase.from && noteTarget.id) { supabase.from('players').update({ notes: noteText }).eq('id', noteTarget.id).then(function(r) { if (r.error) console.error('[TFT] Note sync failed:', r.error) }) }
    addAudit('ACTION', 'Note updated: ' + noteTarget.name)
    setNoteTarget(null)
  }

  function addPlayer() {
    var n = sanitize(addPlayerForm.name.trim())
    var r = sanitize(addPlayerForm.riotId.trim())
    if (!n || !r) { toast('Name and Riot ID required', 'error'); return }
    if (players.find(function(p) { return p.name.toLowerCase() === n.toLowerCase() })) { toast('Name already taken', 'error'); return }
    var np = { id: Date.now() % 100000, name: n, riotId: r, rank: addPlayerForm.rank || 'Gold', lp: 1000, region: addPlayerForm.region || 'EUW', pts: 0, wins: 0, top4: 0, games: 0, avg: '0', bestStreak: 0, currentStreak: 0, tiltStreak: 0, bestHaul: 0, checkedIn: false, role: 'player', banned: false, dnpCount: 0, notes: '', clashHistory: [], sparkline: [], attendanceStreak: 0, lastClashId: null, sponsor: null }
    setPlayers(function(ps) { return ps.concat([np]) })
    if (supabase.from) {
      supabase.from('players').insert({ username: n, riot_id: r, rank: addPlayerForm.rank || 'Gold', region: addPlayerForm.region || 'EUW', auth_user_id: null }).select().single()
        .then(function(res) { if (res.error) console.error('[TFT] Failed to insert player to DB:', res.error); else if (res.data) { setPlayers(function(ps) { return ps.map(function(p) { return p.name === n ? Object.assign({}, p, { id: res.data.id }) : p }) }) } })
    }
    addAudit('ACTION', 'Player added: ' + n)
    toast(n + ' added!', 'success')
    setAddPlayerForm({ name: '', riotId: '', region: 'EUW', rank: 'Gold' })
    setShowAddPlayer(false)
  }

  var currentPhase = tournamentState ? tournamentState.phase : 'registration'
  var phaseColor = { registration: 'text-primary', checkin: 'text-secondary', inprogress: 'text-success', complete: 'text-tertiary' }
  var phaseLabel = { registration: 'Registration Open', checkin: 'Check-in Open', inprogress: 'Round ' + (tournamentState ? tournamentState.round : 1) + ' in Progress', complete: 'Complete' }
  var pendingHosts = (hostApps || []).filter(function(a) { return a.status === 'pending' }).length

  var ADMIN_GROUPS = [
    { label: 'TOURNAMENT', items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'round', label: 'Round Control' },
      { id: 'quickclash', label: 'Quick Clash' },
      { id: 'flash', label: 'Flash Tournaments' },
    ]},
    { label: 'MANAGEMENT', items: [
      { id: 'players', label: 'Players' },
      { id: 'scores', label: 'Scores' },
      { id: 'broadcast', label: 'Broadcast' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'featured', label: 'Featured' },
    ]},
    { label: 'CONFIGURE', items: [
      { id: 'season', label: 'Season' },
      { id: 'sponsorships', label: 'Sponsors' },
      { id: 'hosts', label: 'Hosts' + (pendingHosts > 0 ? ' (' + pendingHosts + ')' : '') },
      { id: 'friends', label: 'Scrims Access' },
      { id: 'ticker', label: 'Ticker' },
    ]},
    { label: 'SYSTEM', items: [
      { id: 'audit', label: 'Audit Log' },
      { id: 'settings', label: 'Settings' },
    ]},
  ]

  var TAB_INFO = {
    dashboard: 'At-a-glance clash status. Use quick actions to check in all players, pause the round, or jump to broadcast.',
    round: 'Full tournament lifecycle: open check-in, start, advance rounds, complete. Configure seeding and round settings here.',
    quickclash: 'Spin up an instant open clash (4-16 players, no registration). Appears live on the home screen.',
    schedule: 'Add upcoming clashes to the public calendar. Players see scheduled events on the home screen.',
    players: 'Full roster. Edit info, assign roles, mark DNP (no-show), ban/unban, and add internal notes.',
    scores: 'Override a player\'s season point total. All changes are flagged as DANGER in Audit.',
    broadcast: 'Send a sitewide announcement banner visible to all logged-in players.',
    hosts: 'Review host applications submitted via the Pricing page. Approved hosts get lobby management access.',
    season: 'Season name, health rules, and Danger Zone.',
    sponsorships: 'Assign org sponsors to players.',
    audit: 'Full chronological log of every admin action.',
    settings: 'Role permission reference and admin quickstart guide.',
    featured: 'Manage featured events shown on the Featured Events page.',
    flash: 'Create and manage flash tournaments.',
  }

  var activeLabel = 'Admin'
  ADMIN_GROUPS.forEach(function(g) {
    g.items.forEach(function(item) {
      if (item.id === tab) activeLabel = item.label
    })
  })

  return (
    <PageLayout maxWidth="max-w-full">
      {/* NOTE MODAL */}
      {noteTarget && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[300] p-4">
          <Panel className="w-full max-w-[400px]">
            <h3 className="text-on-surface font-bold mb-1">Internal Note</h3>
            <div className="text-xs text-on-surface/40 mb-3">Only admins can see this. Use for dispute history, warnings, etc.</div>
            <div className="text-sm font-bold text-primary mb-2">{noteTarget.name}</div>
            <Inp value={noteText} onChange={function(e) { setNoteText(typeof e === 'string' ? e : e.target.value) }} placeholder="e.g. known griefer, dispute 2026-03-10..." />
            <div className="flex gap-2.5 mt-3">
              <Btn variant="primary" onClick={saveNote}>Save Note</Btn>
              <Btn variant="secondary" onClick={function() { setNoteTarget(null) }}>Cancel</Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* ADMIN LAYOUT - SIDEBAR + CONTENT */}
      <div className="flex gap-0 min-h-[calc(100vh-80px)] -mx-4 -mb-4">

        {/* SIDEBAR */}
        <div className={'bg-surface-container-lowest border-r border-outline-variant/10 flex-shrink-0 flex flex-col transition-all duration-200 relative z-10 overflow-hidden ' + (sidebarOpen ? 'w-[230px]' : 'w-0')}>
          {/* Sidebar Header */}
          <div className="px-4 pt-4 pb-3 border-b border-outline-variant/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center flex-shrink-0">
                <Icon name="admin_panel_settings" size={17} className="text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm text-on-surface leading-none">Admin</div>
                <div className="text-[10px] text-on-surface/40 mt-0.5">{seasonName}</div>
              </div>
            </div>
            <div className={'mt-2.5 px-2.5 py-1 rounded-sm text-center text-[10px] font-bold border ' + (currentPhase === 'registration' ? 'bg-primary/5 border-primary/20 text-primary' : currentPhase === 'checkin' ? 'bg-secondary/5 border-secondary/20 text-secondary' : currentPhase === 'inprogress' ? 'bg-success/5 border-success/20 text-success' : 'bg-tertiary/5 border-tertiary/20 text-tertiary')}>
              {phaseLabel[currentPhase]}
            </div>
            {pendingHosts > 0 && (
              <div className="mt-1.5 px-2.5 py-1 bg-error/5 border border-error/20 rounded-sm text-center text-[10px] font-bold text-error cursor-pointer" onClick={function() { setTab('hosts') }}>
                {pendingHosts} pending host app{pendingHosts > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Nav Groups */}
          <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
            {ADMIN_GROUPS.map(function(group) {
              return (
                <div key={group.label} className="mb-1">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-on-surface/40 tracking-widest uppercase">{group.label}</div>
                  {group.items.map(function(item) {
                    var active = tab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={function() { setTab(item.id) }}
                        className={'flex items-center gap-2.5 w-full px-4 py-2 border-none text-left text-sm cursor-pointer transition-all duration-100 ' + (active ? 'bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary' : 'bg-transparent text-on-surface/50 hover:bg-white/5')}
                      >
                        <Icon name={ADMIN_ICON_MAP[item.id] || 'settings'} size={16} className={'flex-shrink-0 ' + (active ? 'opacity-100' : 'opacity-60')} />
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="px-4 py-3 border-t border-outline-variant/10 text-[11px] text-on-surface/40 leading-snug">
            <Icon name="info" size={12} className="mr-1 inline-block" />
            {TAB_INFO[tab] || ''}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 min-w-0 px-6 py-5 overflow-y-auto">

          {/* Top bar with toggle + breadcrumb */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={function() { setSidebarOpen(function(v) { return !v }) }} className="w-8 h-8 bg-white/[.04] border border-outline-variant/10 rounded-sm flex items-center justify-center cursor-pointer text-on-surface/50 flex-shrink-0">
              <Icon name={sidebarOpen ? 'left_panel_close' : 'left_panel_open'} size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-on-surface text-lg font-extrabold leading-none">{activeLabel}</h2>
            </div>
            <Tag size="sm">{phaseLabel[currentPhase]}</Tag>
          </div>

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div>
              <div className="mb-6 p-4 bg-surface-container rounded-lg border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-label text-sm font-bold text-on-surface uppercase tracking-widest">Clash Engine</div>
                    <span className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ' + (tournamentState && tournamentState.server === 'NA' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-tertiary/10 text-tertiary border border-tertiary/20')}>{tournamentState && tournamentState.server || 'EU'}</span>
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">Manage the live weekly tournament</div>
                </div>
                <Btn variant="primary" onClick={function() { navigate('/clash') }}>
                  <Icon name="play_arrow" size={16} />
                  Run Clash
                </Btn>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Players', value: players.length, icon: 'group', color: 'text-secondary', sub: players.filter(function(p) { return p.role === 'admin' }).length + ' admin' },
                  { label: 'Checked In', value: players.filter(function(p) { return p.checkedIn }).length, icon: 'check_circle', color: 'text-success', sub: 'of ' + players.length + ' total' },
                  { label: 'Banned', value: players.filter(function(p) { return p.banned }).length, icon: 'block', color: 'text-error', sub: players.filter(function(p) { return (p.dnpCount || 0) > 0 && !p.banned }).length + ' with DNP' },
                  { label: 'Events', value: (scheduledEvents || []).length, icon: 'calendar_month', color: 'text-primary', sub: (quickClashes || []).length + ' quick clash' + ((quickClashes || []).length !== 1 ? 'es' : '') },
                ].map(function(c) {
                  return (
                    <Panel key={c.label} className="text-center">
                      <Icon name={c.icon} fill size={20} className={'mb-1 ' + c.color} />
                      <div className={'font-mono text-2xl font-bold ' + c.color}>{c.value}</div>
                      <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/40 mt-1">{c.label}</div>
                      <div className="text-[11px] text-on-surface/40 mt-1">{c.sub}</div>
                    </Panel>
                  )
                })}
              </div>

              <Panel className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="bolt" fill size={14} className="text-primary" />
                    <span className="font-bold text-sm text-on-surface">Quick Actions</span>
                  </div>
                  <Tag size="sm">{phaseLabel[currentPhase]}</Tag>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Btn variant="primary" size="sm" onClick={function() {
                    setPlayers(function(ps) { return ps.map(function(p) { return Object.assign({}, p, { checkedIn: true }) }) })
                    setTournamentState(function(ts) { return Object.assign({}, ts, { checkedInIds: players.map(function(p) { return String(p.id) }) }) })
                    if (supabase.from) { supabase.from('players').update({ checked_in: true }).neq('id', '00000000-0000-0000-0000-000000000000').then(function(r) { if (r.error) console.error('[TFT] Check-in all sync failed:', r.error) }) }
                    addAudit('ACTION', 'Check In All'); toast('All players checked in', 'success')
                  }}>
                    <Icon name="check_circle" size={14} className="mr-1" />Check In All
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={function() {
                    setPlayers(function(ps) { return ps.map(function(p) { return Object.assign({}, p, { checkedIn: false }) }) })
                    setTournamentState(function(ts) { return Object.assign({}, ts, { checkedInIds: [] }) })
                    if (supabase.from) { supabase.from('players').update({ checked_in: false }).neq('id', '00000000-0000-0000-0000-000000000000').then(function(r) { if (r.error) console.error('[TFT] Check-out all sync failed:', r.error) }) }
                    addAudit('ACTION', 'Check Out All'); toast('All players checked out', 'success')
                  }}>
                    <Icon name="cancel" size={14} className="mr-1" />Clear Check-In
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={function() { setPaused(function(p) { return !p }); addAudit('ACTION', paused ? 'Round resumed' : 'Round paused') }}>
                    <Icon name={paused ? 'play_arrow' : 'pause'} size={14} className="mr-1" />{paused ? 'Resume' : 'Pause'}
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={function() { setTab('broadcast') }}>
                    <Icon name="campaign" size={14} className="mr-1" />Broadcast
                  </Btn>
                  <Btn variant="secondary" size="sm" onClick={function() { setTab('round') }}>
                    <Icon name="bolt" size={14} className="mr-1" />Round Controls
                  </Btn>
                </div>
              </Panel>

              <Panel>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="timeline" fill size={14} className="text-tertiary" />
                    <span className="font-bold text-sm text-on-surface">Recent Activity</span>
                  </div>
                  <Btn variant="ghost" size="sm" onClick={function() { setTab('audit') }}>Full Log</Btn>
                </div>
                {(auditLog || []).length === 0 && (
                  <div className="text-center py-10">
                    <Icon name="timeline" size={36} className="text-on-surface/10 mb-2" />
                    <div className="text-on-surface/40 text-sm">No activity yet</div>
                  </div>
                )}
                <div className="max-h-[400px] overflow-y-auto">
                  {(auditLog || []).slice(0, 15).map(function(l, i) {
                    return (
                      <div key={i} className="flex items-start gap-2.5 py-2 border-b border-outline-variant/5">
                        <div className={'w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ' + (l.type === 'DANGER' ? 'bg-error' : l.type === 'WARN' ? 'bg-secondary' : l.type === 'BROADCAST' ? 'bg-primary' : 'bg-success')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Tag size="sm">{l.type}</Tag>
                            <span className="font-mono text-[10px] text-on-surface/30">{new Date(l.ts).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-sm text-on-surface/60">{l.msg}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            </div>
          )}

          {/* ── PLAYERS ── */}
          {tab === 'players' && (
            <div>
              {editP ? (
                <Panel className="mb-4 border-l-[3px] border-l-primary">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Icon name="person_edit" size={16} className="text-primary" />
                      <span className="font-bold text-sm text-on-surface">Edit Player</span>
                      <span className="text-primary font-normal ml-1">{editP.name}</span>
                    </div>
                    <Btn variant="ghost" size="sm" onClick={function() { setEditP(null) }}>Back</Btn>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {[['Display Name', 'name'], ['Riot ID', 'riotId'], ['Region', 'region']].map(function(pair) {
                      var l = pair[0]; var k = pair[1]
                      return (
                        <div key={k}>
                          <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">{l}</label>
                          <Inp value={editP[k] || ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setEditP(function(e) { return Object.assign({}, e, { [k]: val }) }) }} placeholder={l} />
                        </div>
                      )
                    })}
                    <div>
                      <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Role</label>
                      <Sel value={editP.role || 'player'} onChange={function(v) { setEditP(function(e) { return Object.assign({}, e, { role: v }) }) }}>
                        {['player', 'host', 'mod', 'admin'].map(function(r) { return <option key={r} value={r}>{r}</option> })}
                      </Sel>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <Btn variant="primary" onClick={function() {
                      setPlayers(function(ps) { return ps.map(function(p) { return p.id === editP.id ? editP : p }) })
                      if (supabase.from && editP.id) {
                        supabase.from('players').update({ username: editP.name, riot_id: editP.riotId, region: editP.region, rank: editP.rank, role: editP.role || 'player' }).eq('id', editP.id).then(function(r) { if (r.error) console.error('[TFT] Player edit sync failed:', r.error) })
                        if (editP.auth_user_id && editP.role) { supabase.from('user_roles').upsert({ user_id: editP.auth_user_id, role: editP.role }).then(function(r) { if (r.error) console.error('[TFT] Role sync failed:', r.error) }) }
                      }
                      addAudit('ACTION', 'Edited: ' + editP.name); setEditP(null); toast('Saved', 'success')
                    }}>Save Changes</Btn>
                    <Btn variant="secondary" onClick={function() { setEditP(null) }}>Cancel</Btn>
                  </div>
                </Panel>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-on-surface/60">{players.length} players</span>
                      <Tag size="sm">{players.filter(function(p) { return p.checkedIn }).length} checked in</Tag>
                      {players.filter(function(p) { return p.banned }).length > 0 && <Tag size="sm">{players.filter(function(p) { return p.banned }).length} banned</Tag>}
                    </div>
                    <Btn variant="primary" size="sm" onClick={function() { setShowAddPlayer(function(v) { return !v }) }}>{showAddPlayer ? 'Cancel' : '+ Add Player'}</Btn>
                  </div>

                  {showAddPlayer && (
                    <Panel accent="purple" className="mb-3">
                      <h4 className="text-primary font-bold text-sm mb-3">Add New Player</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Display Name</label><Inp value={addPlayerForm.name} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setAddPlayerForm(function(f) { return Object.assign({}, f, { name: val }) }) }} placeholder="Username" /></div>
                        <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Riot ID</label><Inp value={addPlayerForm.riotId} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setAddPlayerForm(function(f) { return Object.assign({}, f, { riotId: val }) }) }} placeholder="Name#TAG" /></div>
                        <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Region</label><Sel value={addPlayerForm.region} onChange={function(v) { setAddPlayerForm(function(f) { return Object.assign({}, f, { region: v }) }) }}>{REGIONS.map(function(r) { return <option key={r} value={r}>{r}</option> })}</Sel></div>
                        <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Rank</label><Sel value={addPlayerForm.rank} onChange={function(v) { setAddPlayerForm(function(f) { return Object.assign({}, f, { rank: v }) }) }}>{RANKS.map(function(r) { return <option key={r} value={r}>{r}</option> })}</Sel></div>
                      </div>
                      <Btn variant="primary" onClick={addPlayer}>Add Player</Btn>
                    </Panel>
                  )}

                  {players.length === 0 && (
                    <Panel className="text-center py-12">
                      <Icon name="group" size={40} className="text-on-surface/10 mb-3" />
                      <div className="text-on-surface/40 text-sm font-medium">No players yet</div>
                      <div className="text-on-surface/30 text-xs mt-1">Add your first player above</div>
                    </Panel>
                  )}

                  {players.length > 0 && (
                    <Panel className="overflow-hidden p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant/10 bg-surface-container-highest/30">
                            <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface/40">Player</th>
                            <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface/40">Rank</th>
                            <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface/40">Points</th>
                            <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface/40">Status</th>
                            <th className="text-right px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface/40">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {players.map(function(p) {
                            return (
                              <tr key={p.id} className={'border-b border-outline-variant/5 ' + (p.banned ? 'bg-error/[.03]' : '')}>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className={'w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 text-sm font-bold border ' + (p.banned ? 'bg-error/10 border-error/20 text-error' : p.checkedIn ? 'bg-success/10 border-success/20 text-success' : 'bg-primary/10 border-primary/15 text-primary')}>
                                      {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className={'font-semibold text-sm flex items-center gap-1.5 ' + (p.banned ? 'text-error' : 'text-on-surface')}>
                                        {p.name}
                                        {p.role !== 'player' && <Tag size="sm">{p.role}</Tag>}
                                      </div>
                                      <div className="text-[11px] text-on-surface/30 mt-0.5">{p.riotId || 'No Riot ID'}{p.notes ? (' - ' + p.notes.slice(0, 30) + (p.notes.length > 30 ? '...' : '')) : ''}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-xs text-on-surface/60">{p.rank}</span>
                                  <br /><span className="text-[10px] text-on-surface/30">{p.region || 'EUW'}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="font-mono text-sm font-bold text-secondary">{p.pts}</span>
                                  <br /><span className="text-[10px] text-on-surface/30">{p.games || 0}G - {p.wins || 0}W</span>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-1 flex-wrap">
                                    {p.banned && <Tag size="sm">{(p.dnpCount || 0) >= 2 ? 'DQ' : 'BANNED'}</Tag>}
                                    {!p.banned && (p.dnpCount || 0) > 0 && <Tag size="sm">{'DNP ' + p.dnpCount + '/2'}</Tag>}
                                    {p.checkedIn && <Tag size="sm">In</Tag>}
                                    {isComebackEligible(p, PAST_CLASHES.map(function(c) { return 'c' + c.id })) && <Tag size="sm">Comeback</Tag>}
                                    {(p.attendanceStreak || 0) >= 3 && <Tag size="sm">{p.attendanceStreak + '-streak'}</Tag>}
                                    {!p.banned && !p.checkedIn && (p.dnpCount || 0) === 0 && <span className="text-on-surface/20 text-[11px]">-</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-1 justify-end">
                                    <Btn size="sm" variant="secondary" onClick={function() { setEditP(p) }}>Edit</Btn>
                                    <Btn size="sm" variant="ghost" onClick={function() { setNoteTarget(p); setNoteText(p.notes || '') }} title="Add internal note"><Icon name="push_pin" size={12} /></Btn>
                                    {!p.banned && <Btn size="sm" variant="secondary" onClick={function() { markDNP(p.id, p.name) }} title="Mark no-show">DNP</Btn>}
                                    {(p.dnpCount || 0) > 0 && !p.banned && <Btn size="sm" variant="secondary" onClick={function() { clearDNP(p.id, p.name) }} title="Clear DNP">CLR</Btn>}
                                    {p.banned
                                      ? <Btn size="sm" variant="primary" onClick={function() { unban(p.id, p.name) }}>Unban</Btn>
                                      : <Btn size="sm" variant="ghost" onClick={function() { ban(p.id, p.name) }}>Ban</Btn>
                                    }
                                    <Btn size="sm" variant="ghost" onClick={function() { remove(p.id, p.name) }} title="Remove permanently"><Icon name="delete" size={12} /></Btn>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </Panel>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SCORES ── */}
          {tab === 'scores' && (
            <div>
              <div className="flex items-center gap-2.5 px-4 py-3 bg-error/5 border border-error/15 rounded-sm mb-4">
                <Icon name="warning" size={18} className="text-error flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-error">Danger Zone</div>
                  <div className="text-xs text-on-surface/60 mt-0.5">Score overrides are logged as DANGER in the audit trail. Leave blank to keep current value. Enter 0 to reset.</div>
                </div>
              </div>

              <Panel className="overflow-hidden p-0 mb-3 border border-error/10">
                <div className="px-4 py-3 bg-error/[.03] border-b border-error/10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Icon name="edit" size={15} className="text-error" />
                    <span className="font-bold text-sm text-on-surface">Season Points Override</span>
                  </div>
                  <span className="font-mono text-[11px] text-on-surface/50">{Object.keys(scoreEdit).filter(function(k) { return scoreEdit[k] !== undefined && scoreEdit[k] !== '' }).length} pending changes</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/10 bg-black/15">
                  <span className="flex-1 text-[10px] font-bold text-on-surface/40 uppercase tracking-wider">Player</span>
                  <span className="w-[70px] text-[10px] font-bold text-on-surface/40 uppercase tracking-wider text-right">Current</span>
                  <span className="w-[110px] text-[10px] font-bold text-on-surface/40 uppercase tracking-wider text-center">New Value</span>
                </div>
                {players.map(function(p) {
                  var hasChange = scoreEdit[p.id] !== undefined && scoreEdit[p.id] !== ''
                  return (
                    <div key={p.id} className={'flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 transition-colors ' + (hasChange ? 'bg-error/[.03]' : '')}>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className={'font-semibold text-sm ' + (hasChange ? 'text-on-surface' : 'text-on-surface/60')}>{p.name}</span>
                        {p.banned && <Tag size="sm">BANNED</Tag>}
                      </div>
                      <span className="font-mono w-[70px] text-sm text-secondary font-bold text-right">{p.pts}</span>
                      <div className="w-[110px] flex-shrink-0">
                        <Inp value={scoreEdit[p.id] !== undefined ? scoreEdit[p.id] : ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setScoreEdit(function(e) { return Object.assign({}, e, { [p.id]: val }) }) }} placeholder={String(p.pts)} type="number" />
                      </div>
                    </div>
                  )
                })}
              </Panel>

              <div className="flex gap-2.5 items-center">
                <Btn variant="primary" onClick={function() {
                  var changeCount = Object.keys(scoreEdit).filter(function(k) { return scoreEdit[k] !== undefined && scoreEdit[k] !== '' }).length
                  if (changeCount === 0) { toast('No changes to apply', 'error'); return }
                  if (!window.confirm('Apply ' + changeCount + ' score override' + (changeCount > 1 ? 's' : '') + '? This is logged as DANGER.')) return
                  setPlayers(function(ps) { return ps.map(function(p) { var nv = scoreEdit[p.id]; if (nv === undefined || nv === '') return p; addAudit('DANGER', 'Score override: ' + p.name + ' ' + p.pts + ' -> ' + nv); var parsed = parseInt(nv); return Object.assign({}, p, { pts: isNaN(parsed) ? p.pts : parsed }) }) })
                  if (supabase.from) { players.forEach(function(p) { var nv = scoreEdit[p.id]; if (nv === undefined || nv === '') return; var parsed = parseInt(nv); if (isNaN(parsed)) return; supabase.from('players').update({ season_pts: parsed }).eq('id', p.id).then(function(r) { if (r.error) console.error('[TFT] Score sync failed for', p.name, r.error) }) }) }
                  setScoreEdit({}); toast('Score changes applied & synced to DB', 'success')
                }}>Apply Changes</Btn>
                <Btn variant="secondary" onClick={function() { setScoreEdit({}) }}>Clear All</Btn>
              </div>
            </div>
          )}

          {/* ── ROUND ── */}
          {tab === 'round' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel className="md:col-span-2">
                <div className="font-bold text-sm text-on-surface mb-3">Clash Details</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Clash Name</label><Inp value={tournamentState && tournamentState.clashName || ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setTournamentState(function(ts) { return Object.assign({}, ts, { clashName: val }) }) }} placeholder="e.g. Clash #1" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Date</label><Inp value={tournamentState && tournamentState.clashDate || ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setTournamentState(function(ts) { return Object.assign({}, ts, { clashDate: val }) }) }} placeholder="e.g. Apr 5 2026" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Time</label><Inp value={tournamentState && tournamentState.clashTime || ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setTournamentState(function(ts) { return Object.assign({}, ts, { clashTime: val }) }) }} placeholder="e.g. 8PM EST" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Countdown (ISO)</label><Inp value={tournamentState && tournamentState.clashTimestamp || ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setTournamentState(function(ts) { return Object.assign({}, ts, { clashTimestamp: val }) }) }} placeholder="2026-04-05T20:00:00" /></div>
                </div>
                <div className="flex flex-col gap-1 mt-3">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Server</div>
                  <Sel
                    value={serverVal}
                    onChange={function(e) { var v = e.target.value; setServerVal(v); setTournamentState(function(ts) { return Object.assign({}, ts, { server: v }) }) }}
                  >
                    <option value="EU">EU -- EUW / EUNE</option>
                    <option value="NA">NA -- NA1</option>
                  </Sel>
                </div>
              </Panel>

              <Panel>
                <div className="font-bold text-sm text-on-surface mb-3">Tournament Phase</div>
                <div className="grid grid-cols-4 gap-px bg-outline-variant/10 rounded-sm overflow-hidden border border-outline-variant/10 mb-4">
                  {['registration', 'checkin', 'inprogress', 'complete'].map(function(ph) {
                    var phases = ['registration', 'checkin', 'inprogress', 'complete']
                    var ci = phases.indexOf(currentPhase)
                    var pi = phases.indexOf(ph)
                    var isDone = pi < ci
                    var isActive = ph === currentPhase
                    return (
                      <div key={ph} className={'text-center py-3 text-xs font-bold ' + (isActive ? 'bg-primary/10 text-primary' : isDone ? 'bg-success/5 text-success' : 'bg-surface-container text-on-surface/30')}>
                        {isDone ? <Icon name="check_circle" fill size={14} className="text-success mb-1" /> : <Icon name={ph === 'registration' ? 'person_add' : ph === 'checkin' ? 'assignment_turned_in' : ph === 'inprogress' ? 'local_fire_department' : 'flag'} size={14} className={'mb-1 ' + (isActive ? 'text-primary' : 'text-on-surface/20')} />}
                        <div>{ph === 'registration' ? 'Register' : ph === 'checkin' ? 'Check-in' : ph === 'inprogress' ? 'Live' : 'Complete'}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-2.5">
                  <Btn variant="primary" disabled={currentPhase !== 'registration'} onClick={function() {
                    setTournamentState(function(ts) { return Object.assign({}, ts, { phase: 'checkin', checkedInIds: ts.registeredIds && ts.registeredIds.length > 0 ? ts.registeredIds.slice() : ts.checkedInIds || [] }) })
                    if (supabase.from && tournamentState && tournamentState.dbTournamentId) { supabase.from('tournaments').update({ phase: 'check_in' }).eq('id', tournamentState.dbTournamentId).then(function(r) { if (r.error) console.error('[TFT] Check-in phase sync failed:', r.error) }) }
                    addAudit('ACTION', 'Check-in opened - ' + ((tournamentState && tournamentState.registeredIds || []).length) + ' pre-registered players carried over')
                    toast('Check-in is now open!', 'success')
                  }}>Open Check-in</Btn>
                  <Btn variant="primary" disabled={currentPhase !== 'checkin'} onClick={function() {
                    var games = parseInt(roundConfig.roundCount) || 3
                    var cutL = parseInt(roundConfig.cutLine) || 0
                    var cutG = parseInt(roundConfig.cutAfterGame) || 0
                    setTournamentState(function(ts) { return Object.assign({}, ts, { phase: 'inprogress', round: 1, totalGames: games, lockedLobbies: [], savedLobbies: [], clashId: 'c' + Date.now(), seedAlgo: seedAlgo || 'rank-based', cutLine: cutL, cutAfterGame: cutG, maxPlayers: parseInt(roundConfig.maxPlayers) || 24 }) })
                    if (supabase.from) {
                      var existingId = tournamentState && tournamentState.dbTournamentId
                      if (existingId) {
                        supabase.from('tournaments').update({ phase: 'upcoming', format: cutL > 0 ? 'two_stage' : 'single_stage', round_count: games, seeding_method: seedAlgo || 'snake' }).eq('id', existingId).then(function(r) { if (r.error) console.error('[TFT] Failed to update tournament:', r.error) })
                      } else {
                        supabase.from('tournaments').insert({ name: (tournamentState && tournamentState.clashName) || 'Clash', date: new Date().toISOString().split('T')[0], phase: 'upcoming', format: cutL > 0 ? 'two_stage' : 'single_stage', max_players: parseInt(roundConfig.maxPlayers) || 24, seeding_method: seedAlgo || 'snake', round_count: games }).select().single().then(function(res) { if (!res.error && res.data) { setTournamentState(function(ts) { return Object.assign({}, ts, { dbTournamentId: res.data.id }) }) } else if (res.error) console.error('[TFT] Failed to create tournament in DB:', res.error) })
                      }
                    }
                    addAudit('ACTION', 'Tournament started - ' + games + ' games' + (cutL > 0 ? ', cut at ' + cutL + 'pts after game ' + cutG : ''))
                    toast('Tournament started! Bracket ready.', 'success')
                  }}>Start Tournament</Btn>
                  <Btn variant="ghost" onClick={function() {
                    if (window.confirm('Reset tournament to registration?')) {
                      var oldId = tournamentState && tournamentState.dbTournamentId
                      setTournamentState({ phase: 'registration', round: 1, lobbies: [], lockedLobbies: [], savedLobbies: [], checkedInIds: [], registeredIds: [], waitlistIds: [], maxPlayers: 24 })
                      setPlayers(function(ps) { return ps.map(function(p) { return Object.assign({}, p, { checkedIn: false }) }) })
                      if (supabase.from && oldId) { supabase.from('registrations').delete().eq('tournament_id', oldId).then(function() {}); supabase.from('tournaments').update({ phase: 'cancelled' }).eq('id', oldId).then(function() {}) }
                      addAudit('DANGER', 'Tournament reset'); toast('Tournament reset', 'success')
                    }
                  }}>Reset to Registration</Btn>
                </div>
              </Panel>

              <Panel>
                <div className="font-bold text-sm text-on-surface mb-3">Round Controls</div>
                <div className="flex flex-col gap-2.5">
                  <Btn variant="secondary" onClick={function() { setPaused(function(p) { return !p }); addAudit('ACTION', paused ? 'Resumed' : 'Paused') }}>
                    <Icon name={paused ? 'play_arrow' : 'pause'} size={14} className="mr-1" />{paused ? 'Resume Round' : 'Pause Round'}
                  </Btn>
                  <Btn variant="secondary" onClick={function() {
                    var nextRound = (tournamentState && tournamentState.round || 1) + 1
                    var maxG = (tournamentState && tournamentState.totalGames) || 4
                    var willComplete = nextRound > maxG
                    setTournamentState(function(ts) { if (!ts || ts.phase !== 'inprogress') return ts; if (willComplete) return Object.assign({}, ts, { phase: 'complete' }); return Object.assign({}, ts, { round: nextRound, lockedLobbies: [], savedLobbies: [] }) })
                    if (supabase.from && tournamentState && tournamentState.dbTournamentId) { supabase.from('tournaments').update({ phase: willComplete ? 'complete' : 'in_progress' }).eq('id', tournamentState.dbTournamentId).then(function(r) { if (r.error) console.error('[TFT] Force advance sync failed:', r.error) }) }
                    addAudit('ACTION', 'Force advance game' + (willComplete ? ' - tournament complete' : '')); toast('Force advancing', 'success')
                  }}>Force Advance Game</Btn>
                  <Btn variant="primary" onClick={function() {
                    setTournamentState(function(ts) { return Object.assign({}, ts, { lockedLobbies: [], savedLobbies: [], seedAlgo: seedAlgo }) })
                    addAudit('ACTION', 'Reseeded - ' + seedAlgo); toast('Lobbies reseeded', 'success')
                  }}>Reseed Lobbies</Btn>
                </div>
              </Panel>

              <Panel className="md:col-span-2">
                <div className="font-bold text-sm text-on-surface mb-1">Seeding Mode</div>
                <div className="text-xs text-on-surface/40 mb-4">Choose how players are distributed across lobbies.</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
                  {[
                    ['random', 'Random', 'Fully shuffled, no weighting', 'shuffle'],
                    ['rank-based', 'By Rank', 'Top players spread evenly', 'sort'],
                    ['snake', 'Snake Draft', 'Alternating pick order', 'route'],
                    ['swiss', 'Swiss', 'Matched by similar score', 'emoji_events']
                  ].map(function(item) {
                    var v = item[0]; var l = item[1]; var d = item[2]; var icon = item[3]
                    var active = seedAlgo === v
                    return (
                      <button key={v} onClick={function() { setSeedAlgo(v) }} className={'flex flex-col items-center gap-2 p-4 cursor-pointer text-center rounded-sm transition-all border-2 ' + (active ? 'bg-primary/10 border-primary shadow-[0_0_16px_rgba(155,114,207,.2)]' : 'bg-white/[.02] border-outline-variant/10 hover:border-outline-variant/20')}>
                        <Icon name={icon} size={22} className={active ? 'text-primary' : 'text-on-surface/40'} />
                        <span className={'text-sm font-bold ' + (active ? 'text-primary' : 'text-on-surface/60')}>{l}</span>
                        <span className={'text-[11px] leading-snug ' + (active ? 'text-primary/70' : 'text-on-surface/30')}>{d}</span>
                        {active && <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/30 rounded-sm px-2 py-0.5 mt-0.5">SELECTED</span>}
                      </button>
                    )
                  })}
                </div>
                <button onClick={function() { setSeedAlgo('anti-stack') }} className={'flex items-center gap-2.5 w-full px-3 py-2.5 cursor-pointer text-left rounded-sm border ' + (seedAlgo === 'anti-stack' ? 'bg-error/5 border-error/40' : 'bg-white/[.02] border-outline-variant/10')}>
                  <Icon name="cancel" size={16} className="text-error" />
                  <span className={'text-sm flex-1 ' + (seedAlgo === 'anti-stack' ? 'font-bold text-error' : 'text-on-surface/60')}>Anti-Stack</span>
                  <span className="text-[11px] text-on-surface/40">Prevents friend groups from stacking same lobby</span>
                  {seedAlgo === 'anti-stack' && <span className="text-[10px] font-bold text-error bg-error/10 border border-error/25 rounded-sm px-2 py-0.5">SELECTED</span>}
                </button>
              </Panel>

              <Panel className="md:col-span-2">
                <div className="font-bold text-sm text-on-surface mb-2">Quick Clash Setup</div>
                <div className="text-xs text-on-surface/40 mb-3">One-click presets - fills Max Players and Round Count below.</div>
                <div className="flex gap-2 flex-wrap">
                  {[['3 Games - 24p', '24', '3', '0', '0'], ['3 Games - 16p', '16', '3', '0', '0'], ['5 Games - 24p', '24', '5', '0', '0'], ['6 Games - 128p (Cut at 4)', '128', '6', '13', '4']].map(function(preset) {
                    return (
                      <Btn key={preset[0]} variant="secondary" size="sm" onClick={function() {
                        setRoundConfig(function(c) { return Object.assign({}, c, { maxPlayers: preset[1], roundCount: preset[2], cutLine: preset[3], cutAfterGame: preset[4] }) })
                        if (preset[3] !== '0') toast('Preset loaded: ' + preset[0] + ' - cut line: ' + preset[3] + 'pts after game ' + preset[4], 'success')
                        else toast('Preset loaded: ' + preset[0], 'success')
                      }}>{preset[0]}</Btn>
                    )
                  })}
                </div>
              </Panel>

              <Panel className="md:col-span-2">
                <div className="font-bold text-sm text-on-surface mb-3">Round Settings</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Max Players</label><Inp type="number" value={roundConfig.maxPlayers} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setRoundConfig(function(c) { return Object.assign({}, c, { maxPlayers: val }) }) }} placeholder="24" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Games</label><Sel value={roundConfig.roundCount} onChange={function(v) { setRoundConfig(function(c) { return Object.assign({}, c, { roundCount: v }) }) }}><option value="2">2 Games</option><option value="3">3 Games</option><option value="4">4 Games</option><option value="5">5 Games</option><option value="6">6 Games</option></Sel></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Check-in Window</label><Sel value={roundConfig.checkinWindowMins} onChange={function(v) { setRoundConfig(function(c) { return Object.assign({}, c, { checkinWindowMins: v }) }) }}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></Sel></div>
                </div>
                <div className="mt-3 p-3 bg-secondary/[.04] border border-secondary/15 rounded-sm">
                  <div className="font-bold text-sm text-secondary mb-2">Cut Line (Elimination)</div>
                  <div className="text-xs text-on-surface/60 mb-3">Players at or below this point threshold after the specified game are eliminated. Set to 0 to disable.</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Cut After Game #</label><Sel value={roundConfig.cutAfterGame || '0'} onChange={function(v) { setRoundConfig(function(c) { return Object.assign({}, c, { cutAfterGame: v }) }) }}><option value="0">No Cut</option><option value="2">After Game 2</option><option value="3">After Game 3</option><option value="4">After Game 4</option><option value="5">After Game 5</option></Sel></div>
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Min Points to Advance</label><Inp type="number" value={roundConfig.cutLine || ''} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setRoundConfig(function(c) { return Object.assign({}, c, { cutLine: val }) }) }} placeholder="14" /></div>
                  </div>
                  {roundConfig.cutAfterGame && parseInt(roundConfig.cutAfterGame) > 0 && parseInt(roundConfig.cutLine) > 0 && (
                    <div className="mt-2.5 px-3 py-2 bg-tertiary/5 border border-tertiary/15 rounded-sm text-xs text-tertiary">
                      Players with {roundConfig.cutLine} pts or fewer after Game {roundConfig.cutAfterGame} will be eliminated. You need at least {parseInt(roundConfig.cutLine) + 1} pts to advance.
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* ── QUICK CLASH ── */}
          {tab === 'quickclash' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Panel accent="purple">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-center">
                    <Icon name="casino" size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-on-surface">New Quick Clash</div>
                    <div className="text-[11px] text-on-surface/50 mt-0.5">Opens immediately, no registration phase</div>
                  </div>
                </div>
                <div className="grid gap-3 mb-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Event Name</label><Inp value={flashForm.name} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setFlashForm(function(f) { return Object.assign({}, f, { name: val }) }) }} placeholder="Flash Clash" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Player Cap</label><Sel value={flashForm.cap || '8'} onChange={function(v) { setFlashForm(function(f) { return Object.assign({}, f, { cap: v }) }) }}>{[4, 8, 16].map(function(n) { return <option key={n} value={n}>{n} players</option> })}</Sel></div>
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Rounds</label><Sel value={flashForm.rounds || '2'} onChange={function(v) { setFlashForm(function(f) { return Object.assign({}, f, { rounds: v }) }) }}>{[1, 2, 3].map(function(n) { return <option key={n} value={n}>{n} round{n > 1 ? 's' : ''}</option> })}</Sel></div>
                  </div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Format</label><Sel value={flashForm.format || 'Single Lobby'} onChange={function(v) { setFlashForm(function(f) { return Object.assign({}, f, { format: v }) }) }}>{['Single Lobby', 'Two Lobbies', 'Finals Only'].map(function(fm) { return <option key={fm}>{fm}</option> })}</Sel></div>
                </div>
                <Btn variant="primary" onClick={function() {
                  if (!flashForm.name || !flashForm.name.trim()) return
                  var ev = { id: Date.now(), name: flashForm.name.trim(), cap: parseInt(flashForm.cap || '8'), rounds: parseInt(flashForm.rounds || '2'), format: flashForm.format || 'Single Lobby', status: 'open', players: [], startedAt: null, createdAt: new Date().toLocaleTimeString() }
                  if (setQuickClashes) setQuickClashes(function(qs) { return [ev].concat(qs || []) })
                  addAudit('ACTION', 'Quick Clash created: ' + flashForm.name)
                  toast(flashForm.name + ' is open - ' + (flashForm.cap || '8') + ' spots', 'success')
                  setFlashForm(function(f) { return Object.assign({}, f, { name: 'Flash Clash', cap: '8', rounds: '2', format: 'Single Lobby' }) })
                }}>Open Quick Clash</Btn>
              </Panel>

              <div className="flex flex-col gap-2.5">
                <div className="text-[11px] font-bold text-on-surface/40 tracking-widest uppercase mb-0.5">Active Quick Clashes</div>
                {(!quickClashes || quickClashes.length === 0) && (
                  <Panel className="text-center py-10">
                    <Icon name="bolt" size={24} className="text-primary/30 mb-3" />
                    <div className="text-on-surface/40 text-sm font-semibold">No quick clashes active</div>
                    <div className="text-on-surface/30 text-[11px] mt-1">Create one using the form</div>
                  </Panel>
                )}
                {(quickClashes || []).map(function(ev) {
                  return (
                    <Panel key={ev.id} className="border border-primary/20">
                      <div className="flex justify-between items-start gap-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="font-bold text-sm text-on-surface">{ev.name}</span>
                            <Tag size="sm">QUICK</Tag>
                            {ev.status === 'open' && <Tag size="sm">OPEN</Tag>}
                            {ev.status === 'full' && <Tag size="sm">FULL</Tag>}
                            {ev.status === 'live' && <Tag size="sm">LIVE</Tag>}
                            {ev.status === 'complete' && <Tag size="sm">DONE</Tag>}
                          </div>
                          <div className="text-xs text-on-surface/50">{ev.players ? ev.players.length : 0}/{ev.cap}p - {ev.rounds}R - {ev.format}</div>
                          <div className="text-[11px] text-on-surface/30 mt-0.5">Created {ev.createdAt}</div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {(ev.status === 'open' || ev.status === 'full') && <Btn size="sm" variant="primary" onClick={function() { if (setQuickClashes) setQuickClashes(function(qs) { return (qs || []).map(function(q) { return q.id === ev.id ? Object.assign({}, q, { status: 'live', startedAt: new Date().toLocaleTimeString() }) : q }) }); addAudit('ACTION', 'Quick Clash started: ' + ev.name); toast(ev.name + ' is LIVE!', 'success') }}>Start</Btn>}
                          {ev.status === 'live' && <Btn size="sm" variant="secondary" onClick={function() { if (setQuickClashes) setQuickClashes(function(qs) { return (qs || []).map(function(q) { return q.id === ev.id ? Object.assign({}, q, { status: 'complete' }) : q }) }); addAudit('RESULT', 'Quick Clash complete: ' + ev.name); toast(ev.name + ' complete', 'success') }}>End</Btn>}
                          {ev.status === 'complete' && <Btn size="sm" variant="ghost" onClick={function() { if (setQuickClashes) setQuickClashes(function(qs) { return (qs || []).filter(function(q) { return q.id !== ev.id }) }); addAudit('ACTION', 'Quick Clash removed: ' + ev.name) }}>Remove</Btn>}
                        </div>
                      </div>
                    </Panel>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SCHEDULE ── */}
          {tab === 'schedule' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Panel accent="purple">
                <div className="font-bold text-sm text-on-surface mb-4">Schedule New Event</div>
                <div className="grid gap-3 mb-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Event Name</label><Inp value={newEvent.name} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setNewEvent(function(e) { return Object.assign({}, e, { name: val }) }) }} placeholder="Clash #15" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Type</label><Sel value={newEvent.type} onChange={function(v) { setNewEvent(function(e) { return Object.assign({}, e, { type: v }) }) }}>{['SCHEDULED', 'FLASH', 'INVITATIONAL', 'WEEKLY'].map(function(t) { return <option key={t}>{t}</option> })}</Sel></div>
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Format</label><Sel value={newEvent.format} onChange={function(v) { setNewEvent(function(e) { return Object.assign({}, e, { format: v }) }) }}>{['Swiss', 'Single Lobby', 'Round Robin', 'Finals Only'].map(function(f) { return <option key={f}>{f}</option> })}</Sel></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Date</label><Inp type="date" value={newEvent.date} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setNewEvent(function(e) { return Object.assign({}, e, { date: val }) }) }} /></div>
                    <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Time</label><Inp type="time" value={newEvent.time} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setNewEvent(function(e) { return Object.assign({}, e, { time: val }) }) }} /></div>
                  </div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Player Cap</label><Sel value={newEvent.cap} onChange={function(v) { setNewEvent(function(e) { return Object.assign({}, e, { cap: v }) }) }}>{[8, 16, 24, 32, 48, 64].map(function(n) { return <option key={n} value={n}>{n} players</option> })}</Sel></div>
                </div>
                <Btn variant="primary" onClick={function() {
                  if (!newEvent.name || !newEvent.date) { toast('Name and date required', 'error'); return }
                  var evObj = Object.assign({}, newEvent, { id: Date.now(), status: 'upcoming', cap: parseInt(newEvent.cap) || 8 })
                  setScheduledEvents(function(es) { return (es || []).concat([evObj]) })
                  if (supabase.from) {
                    supabase.from('scheduled_events').insert({ name: newEvent.name, type: newEvent.type || 'SCHEDULED', format: newEvent.format || 'Swiss', date: newEvent.date, time: newEvent.time || '', cap: parseInt(newEvent.cap) || 8, status: 'upcoming', created_by: currentUser ? currentUser.id : null }).select().single().then(function(r) {
                      if (r.error) console.error('[TFT] Schedule event insert failed:', r.error)
                      else if (r.data) setScheduledEvents(function(es) { return (es || []).map(function(e) { return e.id === evObj.id ? Object.assign({}, e, { id: r.data.id }) : e }) })
                    })
                  }
                  addAudit('ACTION', 'Scheduled: ' + newEvent.name)
                  setNewEvent({ name: '', type: 'SCHEDULED', date: '', time: '', cap: '8', format: 'Swiss', notes: '' })
                  toast('Event scheduled', 'success')
                }}>Schedule Event</Btn>
              </Panel>

              <div className="flex flex-col gap-2.5">
                <div className="text-[11px] font-bold text-on-surface/40 tracking-widest uppercase mb-0.5">{(scheduledEvents || []).length} Upcoming</div>
                {(scheduledEvents || []).length === 0 && <Panel className="text-center py-8"><div className="text-on-surface/40 text-sm">No events scheduled yet</div></Panel>}
                {(scheduledEvents || []).map(function(ev) {
                  return (
                    <Panel key={ev.id}>
                      <div className="flex justify-between items-start gap-2.5">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="font-bold text-sm text-on-surface">{ev.name}</span>
                            <Tag size="sm">{ev.type}</Tag>
                          </div>
                          <div className="text-xs text-on-surface/50">{ev.date}{ev.time ? ' - ' + ev.time : ''}</div>
                          <div className="text-[11px] text-on-surface/40 mt-0.5">{ev.format} - {ev.cap} players</div>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={function() {
                          setScheduledEvents(function(es) { return (es || []).filter(function(e) { return e.id !== ev.id }) })
                          if (supabase.from && ev.id) { supabase.from('scheduled_events').delete().eq('id', ev.id).then(function(r) { if (r.error) console.error('[TFT] Event cancel sync failed:', r.error) }) }
                          addAudit('ACTION', 'Cancelled: ' + ev.name)
                        }}>Cancel</Btn>
                      </div>
                    </Panel>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── BROADCAST ── */}
          {tab === 'broadcast' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel accent="purple">
                <div className="font-bold text-sm text-on-surface mb-4">Send Broadcast</div>
                <div className="mb-3">
                  <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Type</label>
                  <Sel value={broadType} onChange={setBroadType}>{['NOTICE', 'ALERT', 'UPDATE', 'RESULT', 'INFO'].map(function(t) { return <option key={t}>{t}</option> })}</Sel>
                </div>
                <div className="mb-4">
                  <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Message</label>
                  <Inp value={broadMsg} onChange={function(v) { setBroadMsg(typeof v === 'string' ? v : v.target.value) }} placeholder="e.g. Clash starts in 10 min - check in now!" />
                </div>
                <Btn variant="primary" onClick={function() {
                  if (!broadMsg.trim()) return
                  var cleanMsg = sanitize(broadMsg.trim())
                  var a = { id: Date.now(), type: broadType, msg: cleanMsg, ts: Date.now() }
                  setAnnouncements(function(as) { return [a].concat(as) })
                  setAnnouncement(cleanMsg)
                  if (supabase.from) supabase.from('site_settings').upsert({ key: 'announcement', value: JSON.stringify(cleanMsg), updated_at: new Date().toISOString() }).then(function(res) { if (res.error) console.error('[TFT] Broadcast save failed:', res.error) })
                  addAudit('BROADCAST', '[' + broadType + '] ' + cleanMsg)
                  setBroadMsg(''); toast('Broadcast sent', 'success')
                }}>Send Broadcast</Btn>
              </Panel>

              <Panel>
                <div className="font-bold text-sm text-on-surface mb-3">Active Announcements</div>
                {announcements.length === 0 && (
                  <div className="text-center py-8">
                    <Icon name="campaign" size={32} className="text-on-surface/10 mb-2" />
                    <div className="text-on-surface/40 text-sm">No active announcements</div>
                    <div className="text-on-surface/30 text-[11px] mt-1">Send one using the form</div>
                  </div>
                )}
                {announcements.map(function(a) {
                  return (
                    <div key={a.id} className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <Tag size="sm">{a.type}</Tag>
                        <div className="text-sm text-on-surface/60 mt-1.5">{a.msg}</div>
                      </div>
                      <Btn variant="ghost" size="sm" onClick={function() {
                        setAnnouncements(function(as) { return as.filter(function(x) { return x.id !== a.id }) })
                        setAnnouncement('')
                        if (supabase.from) supabase.from('site_settings').upsert({ key: 'announcement', value: JSON.stringify(''), updated_at: new Date().toISOString() }).then(function(res) { if (res && res.error) console.error('[TFT] Sync error:', res.error) })
                      }}><Icon name="close" size={12} /></Btn>
                    </div>
                  )
                })}
              </Panel>
            </div>
          )}

          {/* ── SEASON ── */}
          {tab === 'season' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel>
                <div className="font-bold text-sm text-on-surface mb-3">Season Config</div>
                <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Season Name</label>
                <Inp value={seasonName} onChange={function(v) { setSeasonName(typeof v === 'string' ? v : v.target.value) }} placeholder="e.g. Season 1" />
                <Btn variant="primary" size="sm" className="mt-3" onClick={function() {
                  if (supabase.from && seasonConfig && seasonConfig.seasonId) { supabase.from('seasons').update({ name: seasonName }).eq('id', seasonConfig.seasonId).then(function(r) { if (r.error) console.error('[TFT] Season rename sync failed:', r.error) }) }
                  else if (supabase.from) { supabase.from('site_settings').upsert({ key: 'season_name', value: JSON.stringify(seasonName), updated_at: new Date().toISOString() }).then(function(r) { if (r.error) console.error('[TFT] Season name setting sync failed:', r.error) }) }
                  addAudit('ACTION', 'Season renamed: ' + seasonName); toast('Season name saved', 'success')
                }}>Save Name</Btn>
                <Divider label="Stats" />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[['Players', players.length], ['Total Pts', players.reduce(function(s, p) { return s + p.pts }, 0)], ['Games', players.reduce(function(s, p) { return s + (p.games || 0) }, 0)], ['Clashes', PAST_CLASHES.length + 1]].map(function(pair) {
                    return (
                      <div key={pair[0]} className="bg-white/[.02] border border-outline-variant/5 rounded-sm p-3 text-center">
                        <div className="font-mono text-xl font-bold text-secondary">{pair[1]}</div>
                        <div className="text-[10px] text-on-surface/40 font-bold uppercase tracking-wider mt-1">{pair[0]}</div>
                      </div>
                    )
                  })}
                </div>
              </Panel>

              <Panel>
                <div className="font-bold text-sm text-on-surface mb-3">Health Rules</div>
                <div className="grid gap-4">
                  <div>
                    <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Drop Weeks</label>
                    <div className="text-[11px] text-on-surface/30 mb-1.5">Player's worst N weeks excluded from season score.</div>
                    <Sel value={String(seasonConfig ? seasonConfig.dropWeeks || 0 : 0)} onChange={function(v) { if (setSeasonConfig) setSeasonConfig(function(c) { return Object.assign({}, c, { dropWeeks: parseInt(v) }) }) }}>
                      <option value="0">Off (0)</option><option value="1">Drop 1 week</option><option value="2">Drop 2 weeks</option>
                    </Sel>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" checked={seasonConfig ? !!seasonConfig.comebackBonus : false} onChange={function(e) { if (setSeasonConfig) setSeasonConfig(function(c) { return Object.assign({}, c, { comebackBonus: e.target.checked }) }) }} className="w-4 h-4 accent-primary mt-0.5 flex-shrink-0" />
                    <label className="text-xs text-on-surface/60 cursor-pointer">
                      <div className="font-bold mb-0.5">Comeback Bonus</div>
                      <div className="text-on-surface/30 text-[11px]">+2 pts for players returning after 2+ missed clashes</div>
                    </label>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <input type="checkbox" checked={seasonConfig ? !!seasonConfig.attendanceBonus : false} onChange={function(e) { if (setSeasonConfig) setSeasonConfig(function(c) { return Object.assign({}, c, { attendanceBonus: e.target.checked }) }) }} className="w-4 h-4 accent-secondary mt-0.5 flex-shrink-0" />
                    <label className="text-xs text-on-surface/60 cursor-pointer">
                      <div className="font-bold mb-0.5">Attendance Streak Bonus</div>
                      <div className="text-on-surface/30 text-[11px]">+3 at 3 consecutive, +5 at 5 consecutive clashes</div>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Finale Multiplier</label>
                    <Sel value={String(seasonConfig ? seasonConfig.finalBoost || 1.0 : 1.0)} onChange={function(v) { if (setSeasonConfig) setSeasonConfig(function(c) { return Object.assign({}, c, { finalBoost: parseFloat(v) }) }) }}>
                      <option value="1">Off (1x)</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option>
                    </Sel>
                  </div>
                  <div>
                    <label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Finale Clashes (last N boosted)</label>
                    <Sel value={String(seasonConfig ? seasonConfig.finaleClashes || 2 : 2)} onChange={function(v) { if (setSeasonConfig) setSeasonConfig(function(c) { return Object.assign({}, c, { finaleClashes: parseInt(v) }) }) }}>
                      <option value="1">Last 1</option><option value="2">Last 2</option><option value="3">Last 3</option>
                    </Sel>
                  </div>
                  <Btn variant="primary" size="sm" onClick={function() {
                    if (supabase.from) { supabase.from('site_settings').upsert({ key: 'season_health_rules', value: JSON.stringify(seasonConfig || {}), updated_at: new Date().toISOString() }).then(function(r) { if (r.error) console.error('[TFT] Health rules sync failed:', r.error) }) }
                    addAudit('ACTION', 'Season health rules updated'); toast('Health rules saved', 'success')
                  }}>Save Rules</Btn>
                </div>
              </Panel>

              <Panel className="md:col-span-2 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="calendar_month" size={18} />
                  <div className="font-bold text-sm text-on-surface">Season Lifecycle</div>
                </div>
                <div className="text-xs text-on-surface/50 mb-4">Create a new season in the database or end the current one. Ending a season snapshots all player stats and creates a new season record.</div>
                <div className="flex gap-2.5 flex-wrap">
                  <Btn variant="primary" onClick={function() {
                    var name = window.prompt('New season name:', 'Season ' + (parseInt((seasonName || 'Season 1').replace(/\D/g, '')) || 1))
                    if (!name) return
                    if (supabase.from) {
                      supabase.from('seasons').insert({ name: name, number: Date.now() % 10000, status: 'active', start_date: new Date().toISOString().split('T')[0] }).select().single()
                        .then(function(res) {
                          if (res.error) { toast('Failed to create season: ' + res.error.message, 'error'); return }
                          if (setSeasonConfig) setSeasonConfig(function(c) { return Object.assign({}, c, { seasonId: res.data.id }) })
                          setSeasonName(name)
                          addAudit('ACTION', 'New season created: ' + name + ' (id: ' + res.data.id + ')')
                          toast('Season \'' + name + '\' created!', 'success')
                        })
                    } else { setSeasonName(name); toast('Season renamed to ' + name, 'success') }
                  }}>Create New Season</Btn>
                  <Btn variant="secondary" onClick={function() {
                    if (!window.confirm('End the current season? This will snapshot all stats and mark the season as completed.')) return
                    if (supabase.from && seasonConfig && seasonConfig.seasonId) {
                      var sorted = players.slice().sort(function(a, b) { return b.pts - a.pts })
                      var standingsData = sorted.map(function(p, idx) { return { player_id: p.id, username: p.name || p.username, pts: p.pts || 0, wins: p.wins || 0, top4: p.top4 || 0, games: p.games || 0, avg_placement: parseFloat(p.avg) || 0, final_rank: idx + 1 } })
                      supabase.from('season_snapshots').insert({ season_id: seasonConfig.seasonId, week_number: 0, standings: standingsData, snapshot_date: new Date().toISOString().split('T')[0] }).then(function(r) { if (r.error) console.error('[TFT] snapshot insert failed:', r.error) })
                      supabase.from('seasons').update({ status: 'completed', end_date: new Date().toISOString().split('T')[0] }).eq('id', seasonConfig.seasonId).then(function(r) { if (r.error) console.error('[TFT] season end failed:', r.error) })
                      addAudit('ACTION', 'Season ended: ' + (seasonName || 'Season') + ' - ' + players.length + ' players snapshotted')
                      toast('Season ended. Stats snapshotted.', 'success')
                    } else { toast('No active season found in database', 'error') }
                  }}>End Current Season</Btn>
                </div>
              </Panel>

              <Panel className="md:col-span-2 border border-error/25">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="warning" size={18} className="text-secondary" />
                  <div className="font-bold text-sm text-error">Danger Zone</div>
                </div>
                <div className="text-xs text-on-surface/50 mb-4">These actions are permanent and cannot be undone. All are logged to Audit.</div>
                <div className="flex gap-2.5 flex-wrap">
                  <Btn variant="ghost" onClick={function() {
                    if (window.confirm('Reset ALL player stats? Points, wins, and games will be zeroed. This syncs to the database.')) {
                      setPlayers(function(ps) { return ps.map(function(p) { return Object.assign({}, p, { pts: 0, wins: 0, top4: 0, games: 0, avg: '0', bestStreak: 0, currentStreak: 0, tiltStreak: 0, bestHaul: 0, clashHistory: [], sparkline: [], attendanceStreak: 0, lastClashId: null }) }) })
                      if (supabase.from) { supabase.from('game_results').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(function(r) { if (r.error) console.error('[TFT] Failed to clear game_results:', r.error) }) }
                      addAudit('DANGER', 'Stats reset'); toast('All stats reset and synced', 'success')
                    }
                  }}>Reset Season Stats</Btn>
                  <Btn variant="ghost" onClick={function() {
                    if (window.confirm('Remove ALL players from the roster? This syncs to the database.')) {
                      setPlayers([]); if (supabase.from) { supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(function(r) { if (r.error) console.error('[TFT] Failed to clear players table:', r.error) }) }
                      addAudit('DANGER', 'Players cleared'); toast('All players removed', 'success')
                    }
                  }}>Clear All Players</Btn>
                  <Btn variant="ghost" onClick={function() {
                    if (window.confirm('Full season reset? Clears ALL players, stats, history, events, featured events, and tournament state.')) {
                      setPlayers([]); setTournamentState({ phase: 'registration', round: 1, lobbies: [], lockedLobbies: [], checkedInIds: [], registeredIds: [] }); setScheduledEvents([]); if (setFeaturedEvents) setFeaturedEvents([])
                      if (supabase.from) { supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(function(r) { if (r.error) console.error('[TFT] Failed to clear players table:', r.error) }); supabase.from('game_results').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(function(r) { if (r.error) console.error('[TFT] Failed to clear game_results:', r.error) }) }
                      setAuditLog([{ ts: Date.now(), type: 'DANGER', msg: 'Full season reset - all players, stats, events, and featured events cleared' }]); toast('Full season reset complete', 'success')
                    }
                  }}>Full Season Reset</Btn>
                </div>
              </Panel>
            </div>
          )}

          {/* ── HOSTS ── */}
          {tab === 'hosts' && (
            <div>
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <div>
                  <div className="font-bold text-base text-on-surface mb-0.5">Host Applications</div>
                  <div className="text-xs text-on-surface/50">{(hostApps || []).filter(function(a) { return a.status === 'pending' }).length} pending - {(hostApps || []).filter(function(a) { return a.status === 'approved' }).length} approved</div>
                </div>
              </div>
              {(!hostApps || hostApps.length === 0) && (
                <Panel className="text-center py-10">
                  <Icon name="sports_esports" size={36} className="text-on-surface/10 mb-2" />
                  <div className="text-on-surface/40 text-sm">No host applications yet</div>
                  <div className="text-on-surface/30 text-xs mt-1">Applications from the Pricing page will appear here</div>
                </Panel>
              )}
              <div className="flex flex-col gap-3">
                {(hostApps || []).map(function(app) {
                  return (
                    <Panel key={app.id} className={'border ' + (app.status === 'pending' ? 'border-secondary/20' : app.status === 'approved' ? 'border-success/15' : 'border-error/15')}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-bold text-sm text-on-surface">{app.name}</span>
                            {app.org && <Tag size="sm">{app.org}</Tag>}
                            <Tag size="sm">{app.status === 'pending' ? 'Pending' : app.status === 'approved' ? 'Approved' : 'Rejected'}</Tag>
                          </div>
                          <div className="text-xs text-on-surface/40 mb-2">{app.email} - {app.freq} - Applied {app.submittedAt}</div>
                          <div className="text-sm text-on-surface/50 bg-white/[.02] rounded-sm border border-outline-variant/5 px-3 py-2">{app.reason}</div>
                        </div>
                        {app.status === 'pending' && (
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <Btn variant="primary" size="sm" onClick={function() {
                              setHostApps(function(apps) { return (apps || []).map(function(a) { return a.id === app.id ? Object.assign({}, a, { status: 'approved', approvedAt: new Date().toLocaleDateString() }) : a }) })
                              if (supabase.from && app.id) { supabase.from('host_applications').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', app.id).then(function(r) { if (r.error) console.error('[TFT] Host approve sync failed:', r.error) }); if (app.userId) { supabase.from('user_roles').upsert({ user_id: app.userId, role: 'host' }).then(function(r) { if (r.error) console.error('[TFT] Host role assign failed:', r.error) }) } }
                              if (setNotifications) setNotifications(function(ns) { return [{ id: Date.now(), icon: 'controller', title: 'Host Application Approved', body: app.name + ' has been approved as a Host.', time: new Date().toLocaleTimeString(), read: false }].concat(ns || []) })
                              addAudit('ACTION', 'Host approved: ' + app.name); toast(app.name + ' approved as host', 'success')
                            }}>Approve</Btn>
                            <Btn variant="ghost" size="sm" onClick={function() {
                              setHostApps(function(apps) { return (apps || []).map(function(a) { return a.id === app.id ? Object.assign({}, a, { status: 'rejected' }) : a }) })
                              if (supabase.from && app.id) { supabase.from('host_applications').update({ status: 'rejected' }).eq('id', app.id).then(function(r) { if (r.error) console.error('[TFT] Host reject sync failed:', r.error) }) }
                              addAudit('WARN', 'Host rejected: ' + app.name); toast(app.name + ' rejected', 'success')
                            }}>Reject</Btn>
                          </div>
                        )}
                      </div>
                    </Panel>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── SPONSORSHIPS ── */}
          {tab === 'sponsorships' && (
            <div>
              <div className="flex flex-col gap-2.5 mb-5">
                {Object.entries(orgSponsors || {}).map(function(entry) {
                  var pid = entry[0]; var s = entry[1]
                  var p = players.find(function(pl) { return String(pl.id) === String(pid) })
                  return (
                    <Panel key={pid} className="flex items-center gap-3 flex-wrap">
                      <div className="w-11 h-11 rounded-sm flex items-center justify-center font-bold text-sm flex-shrink-0 border" style={{ background: (s.color || '#9B72CF') + '18', borderColor: (s.color || '#9B72CF') + '44', color: s.color || '#9B72CF' }}>{s.logo}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-on-surface mb-0.5">{s.org}</div>
                        <div className="text-xs text-on-surface/40">Sponsoring <span className="font-bold" style={{ color: s.color || '#9B72CF' }}>{p ? p.name : 'Player #' + pid}</span></div>
                      </div>
                      <Btn variant="ghost" size="sm" onClick={function() {
                        var updated = Object.assign({}, orgSponsors); delete updated[pid]
                        if (setOrgSponsors) setOrgSponsors(function() { return updated })
                        if (supabase.from) { supabase.from('site_settings').upsert({ key: 'org_sponsors', value: JSON.stringify(updated), updated_at: new Date().toISOString() }).then(function(r) { if (r.error) console.error('[TFT] Sponsor remove sync failed:', r.error) }) }
                        addAudit('ACTION', 'Sponsor removed: ' + s.org); toast(s.org + ' removed', 'success')
                      }}>Remove</Btn>
                    </Panel>
                  )
                })}
              </div>

              <Panel className="border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="add" size={15} className="text-primary" />
                  <div className="font-bold text-sm text-primary">Add New Sponsorship</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Org Name</label><Inp value={spForm.name} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setSpForm(function(f) { return Object.assign({}, f, { name: val }) }) }} placeholder="e.g. ProGuides" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Logo Text</label><Inp value={spForm.logo} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setSpForm(function(f) { return Object.assign({}, f, { logo: val }) }) }} placeholder="e.g. PG" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Accent Colour</label><Inp value={spForm.color} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setSpForm(function(f) { return Object.assign({}, f, { color: val }) }) }} placeholder="#4ECDC4" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Assign to Player</label><Sel value={spForm.playerId} onChange={function(v) { setSpForm(function(f) { return Object.assign({}, f, { playerId: v }) }) }}><option value="">- Select Player -</option>{players.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option> })}</Sel></div>
                </div>
                <Btn variant="primary" onClick={function() {
                  if (!spForm.name.trim() || !spForm.playerId) { toast('Org name and player required', 'error'); return }
                  var updated = Object.assign({}, orgSponsors || {})
                  updated[spForm.playerId] = { org: spForm.name.trim(), logo: spForm.logo.trim() || spForm.name.trim().slice(0, 2).toUpperCase(), color: spForm.color.trim() || '#9B72CF' }
                  if (setOrgSponsors) setOrgSponsors(function() { return updated })
                  if (supabase.from) { supabase.from('site_settings').upsert({ key: 'org_sponsors', value: JSON.stringify(updated), updated_at: new Date().toISOString() }).then(function(r) { if (r.error) console.error('[TFT] Sponsor add sync failed:', r.error) }) }
                  addAudit('ACTION', 'Sponsor added: ' + spForm.name.trim()); toast(spForm.name.trim() + ' sponsorship added', 'success')
                  setSpForm({ name: '', logo: '', color: '', playerId: '' })
                }}>Add Sponsorship</Btn>
              </Panel>
            </div>
          )}

          {/* ── AUDIT ── */}
          {tab === 'audit' && (
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 bg-surface-container-highest/30">
                <div className="flex items-center gap-2">
                  <Icon name="assignment" fill size={14} className="text-primary" />
                  <span className="font-bold text-sm text-on-surface">Audit Log</span>
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  <div className="flex gap-0 mr-2 rounded-sm overflow-hidden border border-outline-variant/10">
                    {['session', 'database'].map(function(src) {
                      return (
                        <button key={src} onClick={function() { setAuditSource(src); if (src === 'database') loadDbAudit() }} className={'px-3 py-1 text-[11px] font-bold cursor-pointer border-none uppercase tracking-wider ' + (auditSource === src ? 'bg-primary/25 text-primary' : 'bg-white/[.03] text-on-surface/40')}>
                          {src === 'session' ? 'Session' : 'Database'}
                        </button>
                      )
                    })}
                  </div>
                  {['All', 'ACTION', 'DANGER', 'BROADCAST', 'WARN', 'INFO', 'RESULT'].map(function(ft) {
                    return (
                      <button key={ft} onClick={function() { setAuditFilter(ft) }} className={'px-2.5 py-0.5 rounded-sm text-[11px] font-bold cursor-pointer border ' + (auditFilter === ft ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-white/[.04] border-outline-variant/10 text-on-surface/40')}>
                        {ft}
                      </button>
                    )
                  })}
                  <span className="font-mono text-[11px] text-on-surface/40 ml-1">{auditSource === 'session' ? (auditFilter === 'All' ? (auditLog || []) : (auditLog || []).filter(function(l) { return l.type === auditFilter })).length + ' entries' : dbAuditEntries.length + ' DB entries'}</span>
                </div>
              </div>

              {auditSource === 'session' && (auditLog || []).length === 0 && <div className="py-8 text-center text-on-surface/40 text-sm">No audit entries yet.</div>}
              {auditSource === 'database' && dbAuditEntries.length === 0 && <div className="py-8 text-center text-on-surface/40 text-sm">No database audit entries. Click "Database" to refresh.</div>}

              <div className="max-h-[540px] overflow-y-auto">
                {auditSource === 'session' && (auditFilter === 'All' ? (auditLog || []) : (auditLog || []).filter(function(l) { return l.type === auditFilter })).map(function(l, i) {
                  return (
                    <div key={i} className={'flex items-center gap-2.5 px-4 py-2 border-b border-outline-variant/5 border-l-[3px] ' + (l.type === 'DANGER' ? 'border-l-error' : l.type === 'BROADCAST' ? 'border-l-primary' : l.type === 'WARN' ? 'border-l-secondary' : l.type === 'INFO' ? 'border-l-tertiary' : 'border-l-outline-variant/10')}>
                      <Tag size="sm">{l.type}</Tag>
                      <span className="flex-1 text-sm text-on-surface/60">{l.msg}</span>
                      <span className="font-mono text-[10px] text-on-surface/30 whitespace-nowrap flex-shrink-0">{new Date(l.ts).toLocaleString()}</span>
                    </div>
                  )
                })}
                {auditSource === 'database' && dbAuditEntries.map(function(entry, i) {
                  var actionType = entry.action || 'ACTION'
                  var msg = (entry.details && entry.details.message) ? entry.details.message : (entry.action + (entry.target_id ? ' on ' + entry.target_id : ''))
                  return (
                    <div key={entry.id || i} className={'flex items-center gap-2.5 px-4 py-2 border-b border-outline-variant/5 border-l-[3px] ' + (actionType === 'DANGER' ? 'border-l-error' : actionType === 'BROADCAST' ? 'border-l-primary' : actionType === 'WARN' ? 'border-l-secondary' : actionType === 'INFO' ? 'border-l-tertiary' : 'border-l-outline-variant/10')}>
                      <Tag size="sm">{actionType}</Tag>
                      <span className="text-[11px] text-primary font-semibold flex-shrink-0">{entry.actor_name || 'System'}</span>
                      <span className="flex-1 text-sm text-on-surface/60">{msg}</span>
                      <span className="font-mono text-[10px] text-on-surface/30 whitespace-nowrap flex-shrink-0">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}

          {/* ── FRIENDS (Scrims Access) ── */}
          {tab === 'friends' && (
            <ScrimAccessPanel scrimAccess={scrimAccess} setScrimAccess={setScrimAccess} toast={toast} addAudit={addAudit} />
          )}

          {/* ── TICKER ── */}
          {tab === 'ticker' && (
            <TickerAdminPanel tickerOverrides={tickerOverrides} setTickerOverrides={setTickerOverrides} toast={toast} addAudit={addAudit} />
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="shield" fill size={14} className="text-secondary" />
                  <span className="font-bold text-sm text-on-surface">Role Permissions</span>
                </div>
                {[
                  { r: 'Admin', d: 'Full access to all tabs and actions', color: 'text-secondary', perms: 'All tabs' },
                  { r: 'Mod', d: 'Disputes, check-in, score corrections', color: 'text-primary', perms: 'Dashboard, Players, Scores, Broadcast' },
                  { r: 'Host', d: 'Runs lobbies during a clash', color: 'text-tertiary', perms: 'Scrims Lab, bracket view' },
                  { r: 'Player', d: 'Self-service account only', color: 'text-on-surface/50', perms: 'Profile, Standings, Results' },
                ].map(function(item) {
                  return (
                    <div key={item.r} className="p-3 bg-white/[.02] border border-outline-variant/5 rounded-sm mb-2">
                      <div className="flex items-center gap-2.5 mb-1">
                        <Tag size="sm">{item.r}</Tag>
                        <span className="text-sm text-on-surface font-semibold">{item.d}</span>
                      </div>
                      <div className="text-[11px] text-on-surface/30">{item.perms}</div>
                    </div>
                  )
                })}
              </Panel>

              <Panel>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="rocket_launch" fill size={14} className="text-primary" />
                  <span className="font-bold text-sm text-on-surface">Admin Quickstart</span>
                </div>
                {[
                  ['Before a clash', 'Set Clash Name + Date in Round. Open Check-in when ready. Seeding mode defaults to Rank-Based.'],
                  ['Starting the clash', 'Round - Open Check-in - Start Tournament. The bracket screen updates live for all players.'],
                  ['During a clash', 'Use Force Advance between rounds. Pause if there\'s a technical issue. Reseed if lobbies need reshuffling.'],
                  ['After a clash', 'Post a Broadcast with results. Check Audit for any disputes. Season stats update automatically.'],
                  ['Player issues', 'Players tab: DNP = no-show (2 auto-DQ). Ban blocks re-registration. Add Notes for dispute history.'],
                  ['Score disputes', 'Scores tab: override individual point totals. Changes are tagged DANGER in the Audit log.'],
                ].map(function(item) {
                  return (
                    <div key={item[0]} className="py-3 border-b border-outline-variant/5">
                      <div className="text-sm font-bold text-primary mb-0.5">{item[0]}</div>
                      <div className="text-xs text-on-surface/40 leading-relaxed">{item[1]}</div>
                    </div>
                  )
                })}
              </Panel>
            </div>
          )}

          {/* ── FEATURED ── */}
          {tab === 'featured' && (
            <div>
              <Panel className="overflow-hidden p-0 mb-4">
                <div className="px-4 py-3 bg-surface-container-highest/30 border-b border-outline-variant/10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Icon name="star" fill size={15} className="text-secondary" />
                    <span className="font-bold text-sm text-on-surface">Featured Events</span>
                  </div>
                  <Tag size="sm">{(featuredEvents || []).length} event{(featuredEvents || []).length !== 1 ? 's' : ''}</Tag>
                </div>
                {(featuredEvents || []).map(function(ev, idx) {
                  return (
                    <div key={ev.id || idx} className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/5">
                      <div className="w-9 h-9 bg-secondary/10 border border-secondary/20 rounded-sm flex items-center justify-center flex-shrink-0">
                        <Icon name="trophy" fill size={16} className="text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-on-surface truncate">{ev.name}</div>
                        <div className="text-[11px] text-on-surface/40 mt-0.5">{ev.host} - {ev.date} - <Tag size="sm">{ev.status}</Tag></div>
                      </div>
                      <Btn variant="ghost" size="sm" onClick={function() { if (setFeaturedEvents) setFeaturedEvents((featuredEvents || []).filter(function(e) { return e.id !== ev.id })); toast('Event removed', 'success') }}>Remove</Btn>
                    </div>
                  )
                })}
                {(featuredEvents || []).length === 0 && (
                  <div className="text-center py-10">
                    <Icon name="star" size={36} className="text-on-surface/10 mb-2" />
                    <div className="text-on-surface/40 text-sm">No featured events yet</div>
                    <div className="text-on-surface/30 text-xs mt-1">Add community tournaments and partner events below</div>
                  </div>
                )}
              </Panel>

              <Panel className="border border-secondary/10">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="add" size={15} className="text-secondary" />
                  <span className="font-bold text-sm text-on-surface">Add Featured Event</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Event Name</label><Inp placeholder="Tournament name..." onChange={function() {}} /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Host</label><Inp placeholder="Host org..." onChange={function() {}} /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Date</label><Inp placeholder="Mar 22 2026" onChange={function() {}} /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Status</label><Sel value="upcoming" onChange={function() {}}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></Sel></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Format</label><Inp placeholder="Swiss" onChange={function() {}} /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Size</label><Inp type="number" placeholder="16" onChange={function() {}} /></div>
                </div>
                <div className="text-xs text-on-surface/30 mb-2">Note: Featured event form uses refs in the original - use the form fields and click Add Event.</div>
                <Btn variant="primary">Add Event</Btn>
              </Panel>
            </div>
          )}

          {/* ── FLASH ── */}
          {tab === 'flash' && (
            <div>
              <Panel className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="emoji_events" size={18} className="text-primary" />
                  <span className="font-bold text-base text-on-surface">Create Flash Tournament</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Tournament Name</label><Inp value={flashForm.name} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setFlashForm(Object.assign({}, flashForm, { name: val })) }} placeholder="Flash Tournament #1" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Date & Time</label><Inp value={flashForm.date} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setFlashForm(Object.assign({}, flashForm, { date: val })) }} placeholder="2026-04-01T20:00" type="datetime-local" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Max Players</label><Inp type="number" value={flashForm.maxPlayers} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setFlashForm(Object.assign({}, flashForm, { maxPlayers: val })) }} placeholder="128" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Game Count</label><Inp type="number" value={flashForm.gameCount} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; setFlashForm(Object.assign({}, flashForm, { gameCount: val })) }} placeholder="3" /></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Format Preset</label><Sel value={flashForm.formatPreset} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { formatPreset: v })) }}><option value="casual">Casual</option><option value="standard">Standard</option><option value="competitive">Competitive (128p)</option></Sel></div>
                  <div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Seeding Method</label><Sel value={flashForm.seedingMethod} onChange={function(v) { setFlashForm(Object.assign({}, flashForm, { seedingMethod: v })) }}><option value="snake">Snake Seeding</option><option value="random">Random</option><option value="rank-based">Rank-Based</option></Sel></div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] text-on-surface/60 font-bold uppercase tracking-wider">Prize Pool</label>
                    <Btn variant="secondary" size="sm" onClick={function() { setFlashForm(Object.assign({}, flashForm, { prizeRows: flashForm.prizeRows.concat([{ placement: String(flashForm.prizeRows.length + 1), prize: '' }]) })) }}>+ Add Prize</Btn>
                  </div>
                  {flashForm.prizeRows.map(function(row, idx) {
                    return (
                      <div key={idx} className="flex gap-2 mb-1.5 items-center">
                        <div className="text-xs text-secondary font-bold w-7 text-center">#{row.placement}</div>
                        <div className="flex-1"><Inp value={row.prize} onChange={function(v) { var val = typeof v === 'string' ? v : v.target.value; var updated = flashForm.prizeRows.map(function(r, i) { return i === idx ? Object.assign({}, r, { prize: val }) : r }); setFlashForm(Object.assign({}, flashForm, { prizeRows: updated })) }} placeholder="e.g. $50, RP, Skin code..." /></div>
                        {flashForm.prizeRows.length > 1 && <Btn variant="ghost" size="sm" onClick={function() { setFlashForm(Object.assign({}, flashForm, { prizeRows: flashForm.prizeRows.filter(function(_, i) { return i !== idx }) })) }}>X</Btn>}
                      </div>
                    )
                  })}
                </div>

                <Btn variant="primary" onClick={function() {
                  if (!flashForm.name.trim()) { toast('Tournament name required', 'error'); return }
                  if (!flashForm.date) { toast('Date/time required', 'error'); return }
                  var preset = TOURNAMENT_FORMATS[flashForm.formatPreset] || TOURNAMENT_FORMATS.standard
                  var prizePool = flashForm.prizeRows.filter(function(r) { return r.prize.trim() }).map(function(r) { return { placement: parseInt(r.placement), prize: r.prize.trim() } })
                  supabase.from('tournaments').insert({
                    name: flashForm.name.trim(), date: flashForm.date, phase: 'draft', type: 'flash_tournament',
                    max_players: parseInt(flashForm.maxPlayers) || 128, round_count: parseInt(flashForm.gameCount) || 3,
                    seeding_method: flashForm.seedingMethod || 'snake', prize_pool_json: prizePool.length > 0 ? prizePool : null,
                    lobby_host_method: 'random'
                  }).select().single().then(function(res) {
                    if (res.error) { toast('Failed to create: ' + res.error.message, 'error'); return }
                    toast('Flash tournament created!', 'success')
                    addAudit('ACTION', 'Flash tournament created: ' + flashForm.name.trim())
                    setFlashEvents(flashEvents.concat([res.data]))
                    setFlashForm({ name: 'Flash Tournament', date: '', maxPlayers: '128', gameCount: '3', formatPreset: 'standard', seedingMethod: 'snake', prizeRows: [{ placement: '1', prize: '' }] })
                  })
                }}>Create Tournament</Btn>
              </Panel>

              <Panel>
                <div className="font-bold text-sm text-on-surface mb-3">Existing Flash Tournaments ({flashEvents.length})</div>
                {flashEvents.length === 0 && <div className="text-center py-7 text-on-surface/40 text-sm">No flash tournaments yet. Create one above.</div>}
                {flashEvents.map(function(ev) {
                  return (
                    <div key={ev.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[.025] border border-outline-variant/5 rounded-sm mb-1.5">
                      <Icon name="bolt" size={16} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-on-surface truncate">{ev.name}</div>
                        <div className="text-[11px] text-on-surface/40">{ev.date ? new Date(ev.date).toLocaleDateString() : 'TBD'} - <span className="font-bold uppercase">{(ev.phase || 'draft').replace('_', ' ')}</span></div>
                      </div>
                      <Btn variant="ghost" size="sm" onClick={function() {
                        if (ev.phase === 'draft') {
                          supabase.from('tournaments').update({ phase: 'registration', registration_open_at: new Date().toISOString() }).eq('id', ev.id).then(function(res) {
                            if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
                            setFlashEvents(flashEvents.map(function(e) { return e.id === ev.id ? Object.assign({}, e, { phase: 'registration' }) : e }))
                            toast('Registration opened!', 'success')
                            addAudit('ACTION', 'Flash tournament registration opened: ' + ev.name)
                          })
                        } else {
                          if (setScreen) setScreen('flash-' + ev.id)
                        }
                      }}>{ev.phase === 'draft' ? 'Open Registration' : 'View'}</Btn>
                      <Btn variant="ghost" size="sm" onClick={function() {
                        if (!confirm('Delete tournament \'' + ev.name + '\'?')) return
                        supabase.from('tournaments').delete().eq('id', ev.id).then(function(res) {
                          if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
                          setFlashEvents(flashEvents.filter(function(e) { return e.id !== ev.id }))
                          toast('Tournament deleted', 'success')
                          addAudit('DANGER', 'Flash tournament deleted: ' + ev.name)
                        })
                      }}>Delete</Btn>
                    </div>
                  )
                })}
              </Panel>
            </div>
          )}

        </div>{/* main content */}
      </div>{/* flex layout */}
    </PageLayout>
  )
}
