/**
 * Admin Payouts tab. Lists every row in prize_claims so the admin can
 * track who needs to be paid out, mark shipments, and close the loop.
 *
 * Workflow:
 *   unclaimed -> player fills the claim form on /account
 *   claimed   -> admin's job: send the prize, then "Mark Shipped"
 *   shipped   -> awaiting delivery confirmation, then "Mark Delivered"
 *   delivered -> done
 *   forfeited / refunded / disputed -> exceptions
 */
import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Icon, PillTab, PillTabGroup } from '../../components/ui'

var STATUS_META = {
  unclaimed: { label: 'Unclaimed',  tone: 'bg-on-surface/10 text-on-surface-variant border-on-surface/20',  icon: 'hourglass_empty' },
  claimed:   { label: 'Pending',    tone: 'bg-secondary/15 text-secondary border-secondary/30',             icon: 'mail' },
  shipped:   { label: 'Shipped',    tone: 'bg-tertiary/15 text-tertiary border-tertiary/30',                icon: 'local_shipping' },
  delivered: { label: 'Delivered',  tone: 'bg-success/15 text-success border-success/30',                   icon: 'check_circle' },
  disputed:  { label: 'Disputed',   tone: 'bg-error/15 text-error border-error/30',                         icon: 'gavel' },
  refunded:  { label: 'Refunded',   tone: 'bg-on-surface/10 text-on-surface-variant border-on-surface/20',  icon: 'undo' },
  forfeited: { label: 'Forfeited',  tone: 'bg-error/10 text-error/80 border-error/20',                      icon: 'block' }
}

function fmtAmount(row) {
  if (!row || row.prize_amount === null || row.prize_amount === undefined) return ''
  var amt = Number(row.prize_amount)
  if (!isFinite(amt) || amt <= 0) return ''
  var cur = (row.prize_currency || '').toString().toUpperCase()
  if (cur === 'EUR') return '€' + amt.toFixed(2)
  if (cur === 'USD') return '$' + amt.toFixed(2)
  if (cur === 'GBP') return '£' + amt.toFixed(2)
  if (cur) return amt.toFixed(2) + ' ' + cur
  return amt.toFixed(2)
}

function fmtDate(iso) {
  if (!iso) return ''
  var d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAddress(addr) {
  if (!addr) return ''
  if (typeof addr === 'string') return addr
  if (addr.text) return addr.text
  return JSON.stringify(addr)
}

export default function PayoutsTab() {
  var ctx = useApp()
  var currentUser = ctx.currentUser

  var _rows = useState({ loading: true, list: [], byTournament: {}, byPlayer: {} })
  var rows = _rows[0]
  var setRows = _rows[1]

  var _filter = useState('claimed')
  var filter = _filter[0]
  var setFilter = _filter[1]

  var _toast = useState(null)
  var toast = _toast[0]
  var setToast = _toast[1]

  function toastMsg(text, tone) {
    setToast({ text: text, tone: tone || 'info' })
    setTimeout(function() { setToast(null) }, 2400)
  }

  function loadAll() {
    setRows(function(p) { return Object.assign({}, p, { loading: true }) })
    supabase.from('prize_claims').select('*').order('created_at', { ascending: false }).then(function(res) {
      if (res.error) { toastMsg('Load failed: ' + res.error.message, 'error'); setRows({ loading: false, list: [], byTournament: {}, byPlayer: {} }); return }
      var list = res.data || []
      var tIds = Array.from(new Set(list.map(function(r) { return r.tournament_id }).filter(Boolean)))
      var pIds = Array.from(new Set(list.map(function(r) { return r.player_id }).filter(Boolean)))
      Promise.all([
        tIds.length ? supabase.from('tournaments').select('id, name, type, date').in('id', tIds) : Promise.resolve({ data: [] }),
        pIds.length ? supabase.from('players').select('id, username').in('id', pIds) : Promise.resolve({ data: [] })
      ]).then(function(out) {
        var tMap = {}; (out[0].data || []).forEach(function(t) { tMap[t.id] = t })
        var pMap = {}; (out[1].data || []).forEach(function(p) { pMap[p.id] = p })
        setRows({ loading: false, list: list, byTournament: tMap, byPlayer: pMap })
      }).catch(function() {
        setRows({ loading: false, list: list, byTournament: {}, byPlayer: {} })
      })
    }).catch(function() { setRows({ loading: false, list: [], byTournament: {}, byPlayer: {} }) })
  }

  useEffect(function() { loadAll() }, [])

  function addAudit(action, message) {
    if (!currentUser) return
    supabase.from('audit_log').insert({
      type: 'ACTION',
      action: action,
      actor_id: currentUser.id || null,
      actor_name: currentUser.username || currentUser.email || 'Admin',
      target_type: 'prize_claim',
      details: { message: message, timestamp: new Date().toISOString() }
    }).then(function() {}).catch(function() {})
  }

  function updateClaim(row, patch, label) {
    // Capture the player name BEFORE the async update — otherwise the closure
    // may read a stale rows.byPlayer if state has already advanced.
    var playerLabel = (rows.byPlayer && rows.byPlayer[row.player_id] && rows.byPlayer[row.player_id].username) ? rows.byPlayer[row.player_id].username : row.player_id
    supabase.from('prize_claims').update(patch).eq('id', row.id).select().single().then(function(res) {
      if (res.error) { toastMsg(label + ' failed: ' + res.error.message, 'error'); return }
      setRows(function(prev) {
        var list = prev.list.map(function(r) { return r.id === row.id ? res.data : r })
        return Object.assign({}, prev, { list: list })
      })
      addAudit(label.toUpperCase().replace(/\s+/g, '_'), label + ': ' + playerLabel + ' / ' + row.prize_label)
      toastMsg(label + ' saved', 'success')
    }).catch(function() { toastMsg(label + ' failed', 'error') })
  }

  function markShipped(row) {
    if (!window.confirm('Mark this prize as shipped? This records the timestamp and audit log.')) return
    updateClaim(row, { claim_status: 'shipped', shipped_at: new Date().toISOString() }, 'Mark Shipped')
  }
  function markDelivered(row) {
    if (!window.confirm('Mark as delivered (final state)?')) return
    updateClaim(row, { claim_status: 'delivered', delivered_at: new Date().toISOString() }, 'Mark Delivered')
  }
  function markForfeited(row) {
    var note = window.prompt('Forfeit reason (saved to notes):', '')
    if (note === null) return
    updateClaim(row, { claim_status: 'forfeited', notes: note || 'forfeited by admin' }, 'Forfeit')
  }
  function markRefunded(row) {
    if (!window.confirm('Mark as refunded? Use when prize was canceled / withdrawn.')) return
    updateClaim(row, { claim_status: 'refunded' }, 'Refund')
  }
  function reopenClaim(row) {
    if (!window.confirm('Reopen this claim back to pending? Status returns to "claimed".')) return
    updateClaim(row, { claim_status: 'claimed' }, 'Reopen')
  }
  function editNotes(row) {
    var note = window.prompt('Admin note (private):', row.notes || '')
    if (note === null) return
    updateClaim(row, { notes: note }, 'Notes Updated')
  }

  // Stats
  var statusCounts = { unclaimed: 0, claimed: 0, shipped: 0, delivered: 0, disputed: 0, refunded: 0, forfeited: 0 }
  var totalOutstandingByCur = {}
  var totalPaidByCur = {}
  rows.list.forEach(function(r) {
    statusCounts[r.claim_status] = (statusCounts[r.claim_status] || 0) + 1
    var cur = (r.prize_currency || '').toUpperCase()
    var amt = Number(r.prize_amount)
    if (!isFinite(amt) || amt <= 0 || !cur) return
    if (r.claim_status === 'claimed' || r.claim_status === 'shipped') {
      totalOutstandingByCur[cur] = (totalOutstandingByCur[cur] || 0) + amt
    } else if (r.claim_status === 'delivered') {
      totalPaidByCur[cur] = (totalPaidByCur[cur] || 0) + amt
    }
  })

  // Filter
  var filtered = rows.list.filter(function(r) {
    if (filter === 'all') return true
    if (filter === 'issues') return r.claim_status === 'disputed' || r.claim_status === 'refunded' || r.claim_status === 'forfeited'
    return r.claim_status === filter
  })

  var FILTERS = [
    { id: 'claimed',   label: 'Pending',   icon: 'mail',          count: statusCounts.claimed },
    { id: 'unclaimed', label: 'Unclaimed', icon: 'hourglass_empty', count: statusCounts.unclaimed },
    { id: 'shipped',   label: 'Shipped',   icon: 'local_shipping', count: statusCounts.shipped },
    { id: 'delivered', label: 'Delivered', icon: 'check_circle',   count: statusCounts.delivered },
    { id: 'issues',    label: 'Issues',    icon: 'report',         count: statusCounts.disputed + statusCounts.refunded + statusCounts.forfeited },
    { id: 'all',       label: 'All',       icon: 'list',           count: rows.list.length }
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {toast && (
        <div className={'fixed top-4 right-4 z-50 px-4 py-2 rounded border text-sm font-semibold shadow-lg ' + (toast.tone === 'error' ? 'bg-error/15 text-error border-error/40' : toast.tone === 'success' ? 'bg-success/15 text-success border-success/40' : 'bg-surface-container text-on-surface border-outline-variant/40')}>
          {toast.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Panel className="p-3">
          <div className="text-[10px] font-label uppercase tracking-widest text-on-surface/50">Pending action</div>
          <div className="font-display text-2xl text-secondary mt-1">{statusCounts.claimed}</div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-label uppercase tracking-widest text-on-surface/50">Unclaimed</div>
          <div className="font-display text-2xl text-on-surface mt-1">{statusCounts.unclaimed}</div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-label uppercase tracking-widest text-on-surface/50">Outstanding $</div>
          <div className="font-mono text-sm text-tertiary mt-2">
            {Object.keys(totalOutstandingByCur).length === 0 ? <span className="text-on-surface/40">—</span> : Object.keys(totalOutstandingByCur).map(function(c) { return c + ' ' + totalOutstandingByCur[c].toFixed(2) }).join(' / ')}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-label uppercase tracking-widest text-on-surface/50">Paid out</div>
          <div className="font-mono text-sm text-success mt-2">
            {Object.keys(totalPaidByCur).length === 0 ? <span className="text-on-surface/40">—</span> : Object.keys(totalPaidByCur).map(function(c) { return c + ' ' + totalPaidByCur[c].toFixed(2) }).join(' / ')}
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PillTabGroup align="start">
          {FILTERS.map(function(f) {
            return (
              <PillTab key={f.id} icon={f.icon} active={filter === f.id} onClick={function() { setFilter(f.id) }}>
                {f.label}{f.count > 0 ? ' ' + f.count : ''}
              </PillTab>
            )
          })}
        </PillTabGroup>
        <Btn variant="ghost" size="sm" onClick={loadAll}><Icon name="refresh" size={14} className="mr-1" />Refresh</Btn>
      </div>

      {rows.loading ? (
        <Panel className="p-8 text-center text-on-surface/50">Loading payouts…</Panel>
      ) : filtered.length === 0 ? (
        <Panel className="p-8 text-center text-on-surface/50">
          <Icon name="inbox" size={32} className="mx-auto mb-2 block text-on-surface/30" />
          No claims in this view.
        </Panel>
      ) : (
        <div className="space-y-2">
          {filtered.map(function(row) {
            var meta = STATUS_META[row.claim_status] || STATUS_META.unclaimed
            var t = rows.byTournament[row.tournament_id]
            var p = rows.byPlayer[row.player_id]
            var amt = fmtAmount(row)
            return (
              <Panel key={row.id} className="p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-label font-bold uppercase tracking-widest ' + meta.tone}>
                        <Icon name={meta.icon} size={11} />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface/40">#{row.placement}</span>
                      <span className="text-[10px] font-label uppercase tracking-widest text-on-surface/50">{row.prize_type}</span>
                    </div>
                    <div className="font-display text-base text-on-surface font-bold">{row.prize_label || ('Prize #' + row.placement)}</div>
                    <div className="text-[12px] text-on-surface-variant mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span><span className="text-on-surface/40">Player: </span>{p ? p.username : row.player_id.slice(0, 8)}</span>
                      <span><span className="text-on-surface/40">Tournament: </span>{t ? t.name : row.tournament_id.slice(0, 8)}</span>
                      {amt && <span><span className="text-on-surface/40">Amount: </span><span className="font-mono">{amt}</span></span>}
                    </div>
                    {(row.claim_status !== 'unclaimed' && (row.claim_email || row.claim_address)) && (
                      <div className="mt-2 p-2 bg-surface-container rounded border border-outline-variant/20 text-[11px] space-y-0.5">
                        {row.claim_email && <div><span className="text-on-surface/40">Email: </span><span className="font-mono">{row.claim_email}</span></div>}
                        {row.claim_address && <div><span className="text-on-surface/40">Address: </span>{fmtAddress(row.claim_address)}</div>}
                        {row.claimed_at && <div className="text-on-surface/50">Claimed {fmtDate(row.claimed_at)}{row.shipped_at ? ' · Shipped ' + fmtDate(row.shipped_at) : ''}{row.delivered_at ? ' · Delivered ' + fmtDate(row.delivered_at) : ''}</div>}
                      </div>
                    )}
                    {row.notes && (
                      <div className="mt-1.5 text-[11px] text-tertiary"><Icon name="sticky_note_2" size={11} className="inline mr-1" />{row.notes}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {row.claim_status === 'claimed' && (
                      <Btn variant="primary" size="sm" onClick={function() { markShipped(row) }}><Icon name="local_shipping" size={13} className="mr-1" />Mark Shipped</Btn>
                    )}
                    {row.claim_status === 'shipped' && (
                      <Btn variant="primary" size="sm" onClick={function() { markDelivered(row) }}><Icon name="check_circle" size={13} className="mr-1" />Mark Delivered</Btn>
                    )}
                    {(row.claim_status === 'shipped' || row.claim_status === 'delivered') && (
                      <Btn variant="ghost" size="sm" onClick={function() { reopenClaim(row) }}>Reopen</Btn>
                    )}
                    {(row.claim_status === 'claimed' || row.claim_status === 'unclaimed') && (
                      <Btn variant="ghost" size="sm" onClick={function() { markForfeited(row) }}>Forfeit</Btn>
                    )}
                    {row.claim_status !== 'refunded' && row.claim_status !== 'delivered' && (
                      <Btn variant="ghost" size="sm" onClick={function() { markRefunded(row) }}>Refund</Btn>
                    )}
                    <Btn variant="ghost" size="sm" onClick={function() { editNotes(row) }}><Icon name="edit_note" size={13} className="mr-1" />Notes</Btn>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
