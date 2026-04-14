import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Inp, Icon, Sel } from '../../components/ui'

function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-on-surface">{label}</div>
        {desc && <div className="text-xs text-on-surface/50">{desc}</div>}
      </div>
      <button
        onClick={function() { onChange(!checked) }}
        className={'relative w-12 h-6 rounded-full border-2 transition-all focus:outline-none ' + (checked ? 'bg-primary border-primary' : 'bg-surface-container-high border-outline-variant/30')}
      >
        <div className={'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ' + (checked ? 'left-6' : 'left-0.5')} />
      </button>
    </div>
  )
}

export default function SettingsTab() {
  var ctx = useApp()
  var seasonConfig = ctx.seasonConfig
  var setSeasonConfig = ctx.setSeasonConfig
  var players = ctx.players
  var setPlayers = ctx.setPlayers
  var tickerOverrides = ctx.tickerOverrides
  var setTickerOverrides = ctx.setTickerOverrides
  var setAnnouncement = ctx.setAnnouncement
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

  var _seasonName = useState((seasonConfig && seasonConfig.seasonName) || 'Season 1')
  var seasonName = _seasonName[0]
  var setSeasonName = _seasonName[1]

  function isoToLocalInput(iso) {
    if (!iso) return ''
    var d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    var pad = function(n) { return n < 10 ? '0' + n : '' + n }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  var _seasonStartLocal = useState(isoToLocalInput((seasonConfig && seasonConfig.seasonStartIso) || ''))
  var seasonStartLocal = _seasonStartLocal[0]
  var setSeasonStartLocal = _seasonStartLocal[1]

  var _totalWeeks = useState(String((seasonConfig && seasonConfig.totalWeeks) || ''))
  var totalWeeks = _totalWeeks[0]
  var setTotalWeeks = _totalWeeks[1]

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
      }).then(function(r) { }).catch(function() {})
    }
  }

  function upsertSetting(key, value) {
    return supabase.from('site_settings').upsert({ key: key, value: value }, { onConflict: 'key' })
  }

  function sendBroadcast() {
    if (!broadMsg.trim()) { toast('Write a message first', 'error'); return }
    var ann = { type: broadType, message: broadMsg.trim(), ts: Date.now() }
    setAnnouncement(ann)
    upsertSetting('announcement', JSON.stringify(ann)).then(function(r) {
      if (r.error) { toast('Broadcast failed: ' + r.error.message, 'error'); return }
      setAnnouncements(function(a) { return [ann].concat(a) })
      addAudit('BROADCAST', broadType + ': ' + broadMsg.trim())
      toast('Broadcast sent!', 'success')
      setBroadMsg('')
    }).catch(function() { toast('Broadcast failed', 'error') })
  }

  function dismissAnnouncement(idx) {
    setAnnouncements(function(a) { return a.filter(function(_, i) { return i !== idx }) })
    setAnnouncement(null)
    upsertSetting('announcement', null)
    addAudit('ACTION', 'Announcement dismissed')
  }

  function addTicker() {
    var t = newTicker.trim()
    if (!t) return
    var updated = (tickerOverrides || []).concat([t])
    setTickerOverrides(updated)
    upsertSetting('ticker_overrides', JSON.stringify(updated))
    addAudit('ACTION', 'Ticker item added: ' + t)
    setNewTicker('')
    toast('Ticker item added', 'success')
  }

  function removeTicker(item) {
    var updated = (tickerOverrides || []).filter(function(x) { return x !== item })
    setTickerOverrides(updated)
    upsertSetting('ticker_overrides', JSON.stringify(updated))
    addAudit('ACTION', 'Ticker item removed: ' + item)
  }

  function saveSeasonName() {
    var updated = Object.assign({}, seasonConfig, { seasonName: seasonName })
    setSeasonConfig(updated)
    upsertSetting('season_config', JSON.stringify(updated)).then(function(r) {
      if (r.error) { toast('Save failed', 'error'); return }
      addAudit('ACTION', 'Season name set: ' + seasonName)
      toast('Season name saved', 'success')
    }).catch(function() { toast('Save failed', 'error') })
  }

  function saveSeasonSchedule() {
    var weeks = parseInt(totalWeeks, 10)
    if (!Number.isFinite(weeks) || weeks <= 0 || weeks > 52) { toast('Total weeks must be 1-52', 'error'); return }
    var iso = ''
    if (seasonStartLocal) {
      var d = new Date(seasonStartLocal)
      if (isNaN(d.getTime())) { toast('Invalid start date', 'error'); return }
      iso = d.toISOString()
    }
    var updated = Object.assign({}, seasonConfig, { seasonStartIso: iso, totalWeeks: weeks })
    setSeasonConfig(updated)
    upsertSetting('season_config', JSON.stringify(updated)).then(function(r) {
      if (r.error) { toast('Save failed: ' + r.error.message, 'error'); return }
      addAudit('ACTION', 'Season schedule saved: ' + weeks + ' weeks, start ' + (iso || 'not set'))
      toast('Season schedule saved', 'success')
    }).catch(function() { toast('Save failed', 'error') })
  }

  function seasonProgressPreview() {
    if (!seasonConfig || !seasonConfig.seasonStartIso || !seasonConfig.totalWeeks) return null
    var start = new Date(seasonConfig.seasonStartIso)
    if (isNaN(start.getTime())) return null
    var weeks = parseInt(seasonConfig.totalWeeks, 10) || 0
    if (weeks <= 0) return null
    var end = new Date(start.getTime() + weeks * 7 * 86400000)
    var now = Date.now()
    var weeksElapsed = Math.floor((now - start.getTime()) / (7 * 86400000)) + 1
    var currentWeek = Math.max(1, Math.min(weeks, weeksElapsed))
    var status
    if (now < start.getTime()) status = 'Starts ' + start.toLocaleDateString()
    else if (now > end.getTime()) status = 'Season ended ' + end.toLocaleDateString()
    else status = 'Week ' + currentWeek + ' of ' + weeks + ' - ends ' + end.toLocaleDateString()
    return status
  }

  function toggleReg(val) {
    setRegOpen(val)
    var updated = Object.assign({}, seasonConfig, { registrationOpen: val })
    setSeasonConfig(updated)
    upsertSetting('season_config', JSON.stringify(updated))
    addAudit('ACTION', 'Registration ' + (val ? 'opened' : 'closed'))
    toast('Registration ' + (val ? 'open' : 'closed'), 'success')
  }

  function toggleSeason(val) {
    setSeasonActive(val)
    var updated = Object.assign({}, seasonConfig, { seasonActive: val })
    setSeasonConfig(updated)
    upsertSetting('season_config', JSON.stringify(updated))
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
    }).catch(function() { toast('DB reset failed', 'error') })
  }

  function clearAllPlayers() {
    if (!window.confirm('Delete ALL players? This cannot be undone.')) return
    if (!window.confirm('Final confirmation: wipe the entire roster?')) return
    supabase.from('players').delete().neq('id', 0).then(function(r) {
      if (r.error) { toast('Delete failed: ' + r.error.message, 'error'); return }
      setPlayers([])
      addAudit('DANGER', 'All players cleared by ' + (currentUser && currentUser.username || 'Admin'))
      toast('All players cleared', 'success')
    }).catch(function() { toast('Delete failed', 'error') })
  }

  var totalPts = (players || []).reduce(function(s, p) { return s + (p.pts || 0) }, 0)
  var totalGames = (players || []).reduce(function(s, p) { return s + (p.games || 0) }, 0)

  return (
    <div className="p-4 md:p-6 space-y-6">

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="toggle_on" size={16} className="text-primary" />
          <span className="font-bold text-sm text-on-surface">Site Toggles</span>
        </div>
        <div className="space-y-4">
          <Toggle checked={regOpen} onChange={toggleReg} label="Registration Open" desc="Allow new player sign-ups" />
          <Toggle checked={seasonActive} onChange={toggleSeason} label="Season Active" desc="Points are counting this season" />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="campaign" size={16} className="text-secondary" />
          <span className="font-bold text-sm text-on-surface">Broadcast</span>
        </div>
        <div className="flex gap-2 mb-2">
          <div className="w-36 flex-shrink-0">
            <Sel value={broadType} onChange={setBroadType}>
              {['NOTICE', 'ALERT', 'UPDATE', 'RESULT', 'INFO'].map(function(t) { return <option key={t} value={t}>{t}</option> })}
            </Sel>
          </div>
          <div className="flex-1">
            <Inp value={broadMsg} onChange={function(e) { setBroadMsg(typeof e === 'string' ? e : e.target.value) }} placeholder="Broadcast message..." onKeyDown={function(e) { if (e.key === 'Enter') sendBroadcast() }} />
          </div>
          <Btn variant="primary" size="sm" onClick={sendBroadcast}>Send</Btn>
        </div>
        {announcements.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {announcements.map(function(a, i) {
              return (
                <div key={a.type + '-' + a.message} className="flex items-center gap-2 px-3 py-2 bg-secondary/5 border border-secondary/20 rounded">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">{a.type}</span>
                  <span className="flex-1 text-sm text-on-surface">{a.message}</span>
                  <button onClick={function() { dismissAnnouncement(i) }} className="bg-transparent border-0 text-on-surface/40 cursor-pointer text-xs hover:text-error">x</button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

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
            <div key={item} className="flex items-center gap-2 px-3 py-2 bg-surface-container border border-outline-variant/5 rounded mb-1.5">
              <Icon name="chevron_right" size={14} className="text-tertiary flex-shrink-0" />
              <span className="flex-1 text-sm text-on-surface">{item}</span>
              <button onClick={function() { removeTicker(item) }} className="bg-transparent border-0 text-on-surface/40 cursor-pointer text-xs hover:text-error">x</button>
            </div>
          )
        })}
      </Panel>

      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="trophy" size={16} className="text-tertiary" />
          <span className="font-bold text-sm text-on-surface">Season Management</span>
        </div>
        <div className="flex gap-2 mb-4">
          <Inp value={seasonName} onChange={function(e) { setSeasonName(typeof e === 'string' ? e : e.target.value) }} placeholder="Season name" />
          <Btn variant="secondary" size="sm" onClick={saveSeasonName}>Save</Btn>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Season Start</label>
            <Inp type="datetime-local" value={seasonStartLocal} onChange={function(e) { setSeasonStartLocal(typeof e === 'string' ? e : e.target.value) }} />
          </div>
          <div>
            <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Total Weeks</label>
            <Inp type="number" value={totalWeeks} onChange={function(e) { setTotalWeeks(typeof e === 'string' ? e : e.target.value) }} placeholder="10" />
          </div>
          <div className="flex items-end">
            <Btn variant="secondary" size="sm" onClick={saveSeasonSchedule}>Save Schedule</Btn>
          </div>
        </div>
        {seasonProgressPreview() && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-tertiary/[0.08] border border-tertiary/20 text-[11px] font-bold text-tertiary">
            <Icon name="event_repeat" size={12} className="inline-block mr-1 -mt-0.5" />
            {seasonProgressPreview()}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-surface-container p-3 rounded">
            <div className="font-mono text-2xl font-black text-primary">{(players || []).length}</div>
            <div className="text-[10px] text-on-surface/40 uppercase tracking-wider mt-0.5">Players</div>
          </div>
          <div className="bg-surface-container p-3 rounded">
            <div className="font-mono text-2xl font-black text-secondary">{totalPts}</div>
            <div className="text-[10px] text-on-surface/40 uppercase tracking-wider mt-0.5">Total Pts</div>
          </div>
          <div className="bg-surface-container p-3 rounded">
            <div className="font-mono text-2xl font-black text-tertiary">{totalGames}</div>
            <div className="text-[10px] text-on-surface/40 uppercase tracking-wider mt-0.5">Games</div>
          </div>
        </div>
      </Panel>

      <Panel className="border border-error/20">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="warning" size={16} className="text-error" />
          <span className="font-bold text-sm text-error">Danger Zone</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 py-2 border border-error/10 rounded">
            <div>
              <div className="text-sm font-semibold text-on-surface">Reset Season Stats</div>
              <div className="text-xs text-on-surface/50">Zero all player pts, wins, top4, games</div>
            </div>
            <Btn variant="ghost" size="sm" onClick={resetSeasonStats}><span className="text-error">Reset</span></Btn>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border border-error/10 rounded">
            <div>
              <div className="text-sm font-semibold text-on-surface">Clear All Players</div>
              <div className="text-xs text-on-surface/50">Delete entire roster from DB</div>
            </div>
            <Btn variant="ghost" size="sm" onClick={clearAllPlayers}><span className="text-error">Clear</span></Btn>
          </div>
        </div>
      </Panel>
    </div>
  )
}
