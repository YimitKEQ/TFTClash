import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { writeAuditLog, createNotification } from '../../lib/notifications.js'
import { PTS } from '../../lib/constants.js'
import { Panel, Btn, Icon, Sel, Inp } from '../../components/ui'

function ActionCard(props) {
  var icon = props.icon
  var title = props.title
  var desc = props.desc
  var tone = props.tone || 'primary'
  var children = props.children
  var toneMap = {
    primary: 'border-primary/20 bg-primary/5',
    secondary: 'border-secondary/20 bg-secondary/5',
    tertiary: 'border-tertiary/20 bg-tertiary/5',
    error: 'border-error/30 bg-error/5',
    warn: 'border-secondary/30 bg-secondary/5',
  }
  var iconToneMap = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    error: 'text-error',
    warn: 'text-secondary',
  }
  return (
    <div className={'border rounded p-4 space-y-3 ' + (toneMap[tone] || toneMap.primary)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon name={icon} size={20} className={iconToneMap[tone] || iconToneMap.primary} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-label text-xs font-bold uppercase tracking-wider text-on-surface">{title}</div>
          <div className="text-xs text-on-surface/60 mt-1 leading-relaxed">{desc}</div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function OpsMaintenance(props) {
  var ctx = useApp() || {}
  var currentUser = ctx.currentUser
  var isAdmin = ctx.isAdmin
  var toast = ctx.toast || function() {}

  var _busy = useState('')
  var busy = _busy[0]
  var setBusy = _busy[1]

  var _seasons = useState([])
  var seasons = _seasons[0]
  var setSeasons = _seasons[1]

  var _roles = useState([])
  var roles = _roles[0]
  var setRoles = _roles[1]

  var _tournaments = useState([])
  var tournaments = _tournaments[0]
  var setTournaments = _tournaments[1]

  var _selectedDqT = useState('')
  var selectedDqT = _selectedDqT[0]
  var setSelectedDqT = _selectedDqT[1]

  var _dqRegs = useState([])
  var dqRegs = _dqRegs[0]
  var setDqRegs = _dqRegs[1]

  var _dqPicks = useState({})
  var dqPicks = _dqPicks[0]
  var setDqPicks = _dqPicks[1]

  var _dqReason = useState('')
  var dqReason = _dqReason[0]
  var setDqReason = _dqReason[1]

  var _subs = useState([])
  var subs = _subs[0]
  var setSubs = _subs[1]

  var _refundReason = useState('')
  var refundReason = _refundReason[0]
  var setRefundReason = _refundReason[1]

  useEffect(function() {
    supabase.from('seasons').select('id, name, number, status, start_date, end_date')
      .order('number', { ascending: false }).then(function(r) {
        if (!r.error && r.data) setSeasons(r.data)
      })
    supabase.from('user_roles').select('user_id, role, granted_at').in('role', ['admin', 'host'])
      .then(function(r) {
        if (!r.error && r.data) setRoles(r.data)
      })
    supabase.from('tournaments').select('id, name, phase, date')
      .in('phase', ['in_progress', 'complete'])
      .order('date', { ascending: false }).limit(20).then(function(r) {
        if (!r.error && r.data) setTournaments(r.data)
      })
    supabase.from('user_subscriptions').select('user_id, tier, status, updated_at')
      .eq('status', 'active').limit(100).then(function(r) {
        if (!r.error && r.data) setSubs(r.data)
      })
  }, [])

  function actorContext() {
    return {
      id: currentUser && currentUser.auth_user_id ? currentUser.auth_user_id : null,
      name: currentUser && (currentUser.username || currentUser.email) ? (currentUser.username || currentUser.email) : null
    }
  }

  function runUpdatesInChunks(ids, agg, chunkSize) {
    var idx = 0
    var failures = 0
    function next() {
      if (idx >= ids.length) return Promise.resolve(failures)
      var slice = ids.slice(idx, idx + chunkSize)
      idx += chunkSize
      var batch = slice.map(function(pid) {
        var a = agg[pid]
        var avg = a.games > 0 ? Math.round((a.totalPlace / a.games) * 10) / 10 : 0
        return supabase.from('players').update({
          season_pts: a.pts, wins: a.wins, top4: a.top4, games: a.games, avg_placement: avg
        }).eq('id', pid)
      })
      return Promise.all(batch).then(function(results) {
        failures += results.filter(function(r) { return r && r.error }).length
        return next()
      })
    }
    return next()
  }

  function recomputeStandings() {
    var active = seasons.filter(function(s) { return s.status === 'active' })[0]
    if (!active) { toast('No active season found', 'error'); return }
    if (!window.confirm('Recompute standings for season ' + active.number + ' (' + active.name + ')?\n\nThis recalculates season_pts, wins, top4, games, avg_placement for every player from the game_results table.')) return
    setBusy('recompute')
    supabase.from('tournaments').select('id').eq('season_id', active.id).eq('type', 'season_clash').then(function(tr) {
      if (tr.error) { toast('Load tournaments failed: ' + tr.error.message, 'error'); setBusy(''); return }
      var tids = (tr.data || []).map(function(x) { return x.id })
      if (tids.length === 0) { toast('No tournaments in active season', 'info'); setBusy(''); return }
      supabase.from('game_results').select('player_id, placement, points').in('tournament_id', tids).then(function(gr) {
        if (gr.error) { toast('Load game_results failed: ' + gr.error.message, 'error'); setBusy(''); return }
        var agg = {}
        var rows = gr.data || []
        rows.forEach(function(row) {
          if (!row.player_id || row.placement == null) return
          var a = agg[row.player_id] || { pts: 0, wins: 0, top4: 0, games: 0, totalPlace: 0 }
          var pts = row.points != null ? row.points : (PTS[row.placement] || 0)
          a.pts += pts
          a.games += 1
          a.totalPlace += row.placement
          if (row.placement === 1) a.wins += 1
          if (row.placement <= 4 && row.placement >= 1) a.top4 += 1
          agg[row.player_id] = a
        })
        var ids = Object.keys(agg)
        if (ids.length === 0) { toast('No game results to compute', 'info'); setBusy(''); return }
        runUpdatesInChunks(ids, agg, 25).then(function(failures) {
          writeAuditLog('ops.recompute_standings', actorContext(), { type: 'season', id: String(active.id) }, {
            season_number: active.number, players_updated: ids.length - failures, games_counted: rows.length
          })
          if (failures > 0) toast('Recompute finished with ' + failures + ' failures', 'warn')
          else toast('Standings recomputed for ' + ids.length + ' players', 'success')
          setBusy('')
        }).catch(function() { toast('Recompute failed', 'error'); setBusy('') })
      }).catch(function() { toast('Load game_results failed', 'error'); setBusy('') })
    }).catch(function() { toast('Load tournaments failed', 'error'); setBusy('') })
  }

  function snapshotSeason() {
    var active = seasons.filter(function(s) { return s.status === 'active' })[0]
    if (!active) { toast('No active season found', 'error'); return }
    var wkStr = window.prompt('Week number for snapshot (1-52):', '1')
    if (!wkStr) return
    var wk = parseInt(wkStr, 10)
    if (isNaN(wk) || wk < 1 || wk > 52) { toast('Invalid week number', 'error'); return }
    setBusy('snapshot')
    supabase.from('players').select('id, username, season_pts, wins, top4, games, avg_placement')
      .order('season_pts', { ascending: false }).limit(500).then(function(r) {
        if (r.error) { toast('Load players failed: ' + r.error.message, 'error'); setBusy(''); return }
        var rows = (r.data || []).map(function(p, i) {
          return {
            rank: i + 1, player_id: p.id, username: p.username,
            pts: p.season_pts || 0, wins: p.wins || 0, top4: p.top4 || 0,
            games: p.games || 0, avg_placement: p.avg_placement || 0
          }
        })
        supabase.from('season_snapshots').upsert({
          season_id: active.id, week_number: wk, standings: { players: rows, captured_at: new Date().toISOString() }
        }, { onConflict: 'season_id,week_number' }).then(function(ins) {
          if (ins.error) { toast('Snapshot write failed: ' + ins.error.message, 'error'); setBusy(''); return }
          writeAuditLog('ops.season_snapshot', actorContext(), { type: 'season', id: String(active.id) }, {
            season_number: active.number, week_number: wk, players_captured: rows.length
          })
          toast('Snapshot saved (week ' + wk + ', ' + rows.length + ' players)', 'success')
          setBusy('')
        })
      })
  }

  function rolloverSeason() {
    var active = seasons.filter(function(s) { return s.status === 'active' })[0]
    if (!active) { toast('No active season found', 'error'); return }
    var nextName = window.prompt('Name for next season (e.g., "Season 2"):', 'Season ' + (active.number + 1))
    if (!nextName) return
    if (!window.confirm('Roll over from ' + active.name + ' to ' + nextName + '?\n\n- Current season will be marked "completed"\n- A new season #' + (active.number + 1) + ' will be created and set active\n- Player season stats will be archived (run Snapshot first!)\n\nContinue?')) return
    setBusy('rollover')
    supabase.from('seasons').update({ status: 'completed', end_date: new Date().toISOString().slice(0, 10) }).eq('id', active.id).then(function(up) {
      if (up.error) { toast('Close season failed: ' + up.error.message, 'error'); setBusy(''); return }
      supabase.from('seasons').insert({
        name: nextName, number: active.number + 1,
        start_date: new Date().toISOString().slice(0, 10), status: 'active'
      }).select().single().then(function(ins) {
        if (ins.error) { toast('New season create failed: ' + ins.error.message, 'error'); setBusy(''); return }
        writeAuditLog('ops.season_rollover', actorContext(), { type: 'season', id: String(active.id) }, {
          closed_season: active.number, new_season: active.number + 1, new_season_name: nextName
        })
        toast('Season rolled over to ' + nextName, 'success')
        supabase.from('seasons').select('id, name, number, status, start_date, end_date')
          .order('number', { ascending: false }).then(function(r) {
            if (!r.error && r.data) setSeasons(r.data)
          })
        setBusy('')
      }).catch(function() { toast('New season create failed', 'error'); setBusy('') })
    }).catch(function() { toast('Close season failed', 'error'); setBusy('') })
  }

  function loadDqRegs(tid) {
    setSelectedDqT(tid)
    setDqPicks({})
    if (!tid) { setDqRegs([]); return }
    supabase.from('registrations').select('id, player_id, status, disqualified, players!inner(id, username, auth_user_id)')
      .eq('tournament_id', tid).order('created_at').then(function(r) {
        if (r.error) { toast('Load regs failed: ' + r.error.message, 'error'); return }
        setDqRegs(r.data || [])
      })
  }

  function bulkDisqualify() {
    var ids = Object.keys(dqPicks).filter(function(k) { return dqPicks[k] })
    if (ids.length === 0) { toast('No players selected', 'warn'); return }
    if (!dqReason.trim()) { toast('Reason required', 'warn'); return }
    if (!selectedDqT) { toast('No tournament selected', 'error'); return }
    if (!window.confirm('Disqualify ' + ids.length + ' player' + (ids.length > 1 ? 's' : '') + ' from this tournament?\n\nReason: ' + dqReason)) return
    setBusy('disqualify')
    var numIds = ids.map(function(x) { return parseInt(x, 10) }).filter(function(x) { return !isNaN(x) })
    var safeReason = dqReason.replace(/[<>]/g, '').slice(0, 500)
    supabase.from('registrations').update({
      disqualified: true, disqualified_at: new Date().toISOString(), disqualified_reason: safeReason, status: 'disqualified'
    }).eq('tournament_id', selectedDqT).in('id', numIds).then(function(up) {
      if (up.error) { toast('Disqualify failed: ' + up.error.message, 'error'); setBusy(''); return }
      var affected = dqRegs.filter(function(r) { return dqPicks[r.id] })
      affected.forEach(function(r) {
        var uid = r.players && r.players.auth_user_id ? r.players.auth_user_id : null
        if (uid) {
          createNotification(uid, 'Tournament Disqualification', 'You were disqualified. Reason: ' + safeReason.slice(0, 200), 'gavel')
        }
      })
      writeAuditLog('ops.bulk_disqualify', actorContext(), { type: 'tournament', id: selectedDqT }, {
        count: numIds.length, reason: safeReason,
        player_ids: affected.map(function(r) { return r.player_id })
      })
      toast('Disqualified ' + numIds.length + ' player' + (numIds.length > 1 ? 's' : ''), 'success')
      setDqPicks({})
      setDqReason('')
      loadDqRegs(selectedDqT)
      setBusy('')
    }).catch(function() { toast('Disqualify failed', 'error'); setBusy('') })
  }

  function flagRefund(sub) {
    if (!window.confirm('Flag refund for ' + sub.tier + ' subscription (user ' + sub.user_id.slice(0, 8) + '...)?\n\nThis does NOT process the PayPal refund. It writes an audit log + notifies the user. Process the actual refund via the PayPal dashboard or the refund MCP tool, then update subscription status manually.')) return
    if (!refundReason.trim()) { toast('Reason required above', 'warn'); return }
    setBusy('refund_' + sub.user_id)
    var safeReason = refundReason.replace(/[<>]/g, '').slice(0, 500)
    writeAuditLog('ops.refund_flagged', actorContext(), { type: 'subscription', id: sub.user_id }, {
      tier: sub.tier, reason: safeReason, flagged_at: new Date().toISOString()
    }).then(function() {
      return createNotification(sub.user_id, 'Refund In Progress', 'Your ' + sub.tier + ' subscription refund has been initiated. Expect it within 5-7 business days.', 'payments')
    }).then(function() {
      toast('Refund flagged. Process in PayPal next.', 'success')
      setBusy('')
    }).catch(function() { toast('Refund flag failed', 'error'); setBusy('') })
  }

  function exportUserData() {
    var idInput = window.prompt('Enter the player auth_user_id (UUID) to export:\n\nThis exports all rows tied to this user across players, registrations, game_results, notifications, subscriptions, roles, host data, prize claims, and audit log actions. Use for GDPR Article 15 requests.')
    if (!idInput || !idInput.trim()) return
    var authUserId = idInput.trim()
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(authUserId)) {
      toast('That does not look like a UUID', 'error')
      return
    }

    setBusy('gdpr_export')

    Promise.all([
      supabase.from('players').select('*').eq('auth_user_id', authUserId).maybeSingle(),
      supabase.from('registrations').select('*, players!inner(auth_user_id)').eq('players.auth_user_id', authUserId),
      supabase.from('game_results').select('*, players!inner(auth_user_id)').eq('players.auth_user_id', authUserId),
      supabase.from('notifications').select('*').eq('user_id', authUserId),
      supabase.from('user_subscriptions').select('*').eq('user_id', authUserId),
      supabase.from('user_roles').select('*').eq('user_id', authUserId),
      supabase.from('host_applications').select('*').eq('user_id', authUserId),
      supabase.from('host_profiles').select('*').eq('user_id', authUserId),
      supabase.from('prize_claims').select('*, players!inner(auth_user_id)').eq('players.auth_user_id', authUserId),
      supabase.from('audit_log').select('*').eq('actor_id', authUserId).limit(500),
    ]).then(function(results) {
      var bundle = {
        generated_at: new Date().toISOString(),
        auth_user_id: authUserId,
        player: results[0].data || null,
        registrations: results[1].data || [],
        game_results: results[2].data || [],
        notifications: results[3].data || [],
        user_subscriptions: results[4].data || [],
        user_roles: results[5].data || [],
        host_applications: results[6].data || [],
        host_profiles: results[7].data || [],
        prize_claims: results[8].data || [],
        audit_log_actions: results[9].data || [],
      }
      var json = JSON.stringify(bundle, null, 2)
      var blob = new Blob([json], { type: 'application/json' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = 'tftclash-export-' + authUserId + '.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      writeAuditLog('ops.gdpr_export', actorContext(), { type: 'user', id: authUserId }, {
        row_counts: {
          registrations: bundle.registrations.length,
          game_results: bundle.game_results.length,
          notifications: bundle.notifications.length,
          prize_claims: bundle.prize_claims.length,
          subscriptions: bundle.user_subscriptions.length,
        },
        exported_at: new Date().toISOString(),
      }).then(function() {})

      toast('Export downloaded', 'success')
      setBusy('')
    }).catch(function(err) {
      console.error('[gdpr-export] failed:', err)
      toast('Export failed: ' + (err && err.message ? err.message : 'unknown'), 'error')
      setBusy('')
    })
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <Panel className="!p-6">
          <div className="flex items-center gap-3 text-error">
            <Icon name="lock" size={24} />
            <div>
              <div className="font-label text-sm font-bold uppercase tracking-wider">Admin Only</div>
              <div className="text-xs text-on-surface/60 mt-1">Maintenance tools require admin role.</div>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  var activeSeason = seasons.filter(function(s) { return s.status === 'active' })[0]
  var selectedT = tournaments.filter(function(t) { return t.id === selectedDqT })[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-error/10 border border-error/20 rounded">
        <Icon name="warning" size={16} className="text-error" />
        <span className="font-label text-xs font-bold uppercase tracking-wider text-error">Danger Zone - Destructive actions write audit logs</span>
      </div>

      {/* Season Management */}
      <Panel className="!p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="event_repeat" size={16} className="text-primary" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Season Management</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ActionCard icon="calculate" title="Recompute Standings" tone="primary"
            desc={'Recalculate every player\'s season_pts, wins, top4, games, and avg_placement from game_results. Use after editing past placements. Active season: ' + (activeSeason ? activeSeason.name : 'none')}>
            <Btn variant="primary" size="sm" onClick={recomputeStandings} disabled={busy === 'recompute' || !activeSeason} className="w-full">
              {busy === 'recompute' ? 'Recomputing...' : 'Recompute Now'}
            </Btn>
          </ActionCard>

          <ActionCard icon="camera" title="Snapshot Standings" tone="secondary"
            desc="Freeze the current standings as a weekly snapshot. Stored in season_snapshots for archive and historical charts. Run before rollover.">
            <Btn variant="secondary" size="sm" onClick={snapshotSeason} disabled={busy === 'snapshot' || !activeSeason} className="w-full">
              {busy === 'snapshot' ? 'Saving...' : 'Take Snapshot'}
            </Btn>
          </ActionCard>

          <ActionCard icon="new_releases" title="Season Rollover" tone="warn"
            desc="Close the current season, archive standings, and spin up the next season. Run Snapshot first so week-by-week history stays intact.">
            <Btn variant="destructive" size="sm" onClick={rolloverSeason} disabled={busy === 'rollover' || !activeSeason} className="w-full">
              {busy === 'rollover' ? 'Rolling...' : 'Rollover Season'}
            </Btn>
          </ActionCard>
        </div>

        {seasons.length > 0 && (
          <div className="mt-4 border-t border-outline-variant/10 pt-3">
            <div className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/40 mb-2">Recent Seasons</div>
            <div className="space-y-1.5">
              {seasons.slice(0, 5).map(function(s) {
                var toneC = s.status === 'active' ? 'text-success' : s.status === 'completed' ? 'text-on-surface/50' : 'text-on-surface/40'
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-on-surface">#{s.number} - {s.name}</span>
                    <span className={'font-label uppercase tracking-wider font-bold ' + toneC}>{s.status}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Panel>

      {/* Bulk Disqualify */}
      <Panel className="!p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="person_cancel" size={16} className="text-error" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Bulk Disqualify</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface/50 mb-1.5">Tournament</div>
            <Sel value={selectedDqT} onChange={loadDqRegs}>
              <option value="">Select tournament...</option>
              {tournaments.map(function(t) {
                return <option key={t.id} value={t.id}>{t.name} ({t.phase})</option>
              })}
            </Sel>
          </div>

          {selectedT && dqRegs.length > 0 && (
            <>
              <div>
                <div className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface/50 mb-1.5">Reason (required)</div>
                <Inp
                  value={dqReason}
                  onChange={function(v) { setDqReason(typeof v === 'string' ? v : v.target.value) }}
                  placeholder="e.g., Confirmed rule violation in game 3"
                />
              </div>
              <div className="max-h-72 overflow-y-auto border border-outline-variant/10 rounded">
                <div className="bg-surface-container-low px-3 py-2 border-b border-outline-variant/10 flex items-center justify-between text-xs">
                  <span className="text-on-surface/60 font-label uppercase tracking-wider">
                    {Object.keys(dqPicks).filter(function(k) { return dqPicks[k] }).length} / {dqRegs.length} selected
                  </span>
                  <button
                    onClick={function() {
                      var all = {}
                      dqRegs.forEach(function(r) { if (!r.disqualified) all[r.id] = true })
                      setDqPicks(all)
                    }}
                    className="text-xs text-primary hover:text-primary/80 font-label uppercase tracking-wider"
                  >
                    Select all eligible
                  </button>
                </div>
                {dqRegs.map(function(r) {
                  var pName = r.players ? r.players.username : 'Unknown'
                  var isDq = r.disqualified
                  return (
                    <label key={r.id} className={'flex items-center gap-2 px-3 py-2 border-b border-outline-variant/5 cursor-pointer transition-colors ' + (isDq ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.03]')}>
                      <input
                        type="checkbox"
                        disabled={isDq}
                        checked={!!dqPicks[r.id]}
                        onChange={function(e) {
                          var next = Object.assign({}, dqPicks)
                          if (e.target.checked) next[r.id] = true
                          else delete next[r.id]
                          setDqPicks(next)
                        }}
                        className="accent-error"
                      />
                      <span className="flex-1 text-xs text-on-surface">{pName}</span>
                      <span className="font-label text-[10px] uppercase tracking-wider text-on-surface/40">{r.status}</span>
                      {isDq && <span className="font-label text-[10px] uppercase tracking-wider font-bold text-error">DQ</span>}
                    </label>
                  )
                })}
              </div>
              <Btn
                variant="destructive"
                size="sm"
                onClick={bulkDisqualify}
                disabled={busy === 'disqualify' || Object.keys(dqPicks).filter(function(k) { return dqPicks[k] }).length === 0 || !dqReason.trim()}
              >
                {busy === 'disqualify' ? 'Processing...' : 'Disqualify Selected'}
              </Btn>
            </>
          )}

          {selectedT && dqRegs.length === 0 && (
            <div className="text-xs text-on-surface/40">No registrations found.</div>
          )}
        </div>
      </Panel>

      {/* Refund Flow */}
      <Panel className="!p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="currency_exchange" size={16} className="text-secondary" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Subscription Refunds</span>
        </div>
        <div className="space-y-3">
          <div className="text-xs text-on-surface/50 leading-relaxed">
            Flag a subscription for refund. This logs an audit entry and notifies the user; the actual PayPal refund must be executed separately (PayPal dashboard or refund API), and subscription.status updated via service role.
          </div>
          <div>
            <div className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface/50 mb-1.5">Refund Reason</div>
            <Inp
              value={refundReason}
              onChange={function(v) { setRefundReason(typeof v === 'string' ? v : v.target.value) }}
              placeholder="e.g., User requested cancellation within 7 days"
            />
          </div>
          {subs.length === 0 ? (
            <div className="text-xs text-on-surface/40">No active subscriptions.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-outline-variant/10 rounded">
              {subs.map(function(s) {
                return (
                  <div key={s.user_id} className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-on-surface font-mono truncate">{s.user_id}</div>
                      <div className="font-label text-[10px] uppercase tracking-wider text-on-surface/40">{s.tier} - {s.status}</div>
                    </div>
                    <Btn
                      variant="ghost"
                      size="sm"
                      disabled={busy === 'refund_' + s.user_id || !refundReason.trim()}
                      onClick={function() { flagRefund(s) }}
                    >
                      {busy === 'refund_' + s.user_id ? '...' : 'Flag Refund'}
                    </Btn>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Panel>

      {/* GDPR Data Export */}
      <Panel className="!p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="folder_zip" size={16} className="text-primary" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">GDPR Data Export</span>
        </div>
        <div className="text-xs text-on-surface/50 leading-relaxed mb-3">
          Export all rows associated with a user's auth_user_id as a JSON file. Use to fulfill GDPR Article 15 (right of access) requests. Action is recorded in the audit log.
        </div>
        <Btn variant="primary" size="sm" onClick={exportUserData} disabled={busy === 'gdpr_export'}>
          {busy === 'gdpr_export' ? 'Exporting...' : 'Export by auth_user_id'}
        </Btn>
      </Panel>

      {/* Role Viewer */}
      <Panel className="!p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="admin_panel_settings" size={16} className="text-tertiary" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Admin & Host Roles</span>
        </div>
        <div className="text-xs text-on-surface/50 leading-relaxed mb-3">
          Read-only list. Role changes require service_role (update via Supabase SQL editor or a secure edge function).
        </div>
        {roles.length === 0 ? (
          <div className="text-xs text-on-surface/40">No admins or hosts configured.</div>
        ) : (
          <div className="space-y-1.5">
            {roles.map(function(r) {
              var toneC = r.role === 'admin' ? 'text-primary' : 'text-tertiary'
              return (
                <div key={r.user_id} className="flex items-center justify-between py-1.5 border-b border-outline-variant/5">
                  <span className="text-xs text-on-surface font-mono truncate mr-2">{r.user_id}</span>
                  <span className={'font-label text-[10px] font-bold uppercase tracking-widest ' + toneC}>{r.role}</span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}
