import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Inp, Icon } from '../../components/ui'

var SPONSOR_TIERS = [
  { id: 'associate', label: 'Associate', color: '#67e2d9' },
  { id: 'official', label: 'Official Sponsor', color: '#9B72CF' },
  { id: 'title', label: 'Title Partner', color: '#ffc66b' },
]

var PLACEMENT_OPTIONS = [
  { id: 'homepage', label: 'Homepage Banner', icon: 'home', desc: 'Logo displayed on the main landing page' },
  { id: 'bracket', label: 'Bracket Screen', icon: 'account_tree', desc: 'Visible during live tournament brackets' },
  { id: 'footer', label: 'Site Footer', icon: 'dock_to_bottom', desc: 'Logo strip in the global footer' },
  { id: 'hall_of_fame', label: 'Hall of Fame', icon: 'workspace_premium', desc: 'Named award category in HoF' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard', desc: 'Banner on seasonal standings page' },
  { id: 'recap', label: 'Season Recap', icon: 'auto_awesome', desc: 'Featured in end-of-season recap' },
]

var EMPTY_FORM = {
  name: '',
  logo_url: '',
  website: '',
  tier: 'associate',
  color: '#9B72CF',
  discount_code: '',
  contact_email: '',
  placements: [],
  notes: '',
}

function Sel(props) {
  var value = props.value
  var onChange = props.onChange
  var children = props.children
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value) }} className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2.5 text-on-surface text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary/40">
      {children}
    </select>
  )
}

function SponsorCard(props) {
  var sponsor = props.sponsor
  var onEdit = props.onEdit
  var onToggle = props.onToggle
  var onDelete = props.onDelete

  var tierInfo = SPONSOR_TIERS.find(function(t) { return t.id === sponsor.tier }) || SPONSOR_TIERS[0]
  var isActive = sponsor.status === 'active'
  var placements = sponsor.placements || []

  return (
    <div className={'rounded-xl border overflow-hidden transition-all ' + (isActive ? 'border-outline-variant/20 bg-surface-container' : 'border-outline-variant/10 bg-surface-container/50 opacity-60')}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10">
        {sponsor.logo_url ? (
          <img src={sponsor.logo_url} alt={sponsor.name} className="w-8 h-8 rounded object-contain bg-white/5 p-0.5" />
        ) : (
          <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ background: sponsor.color || tierInfo.color, color: '#1a1a2e' }}>
            {(sponsor.name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-on-surface truncate">{sponsor.name}</span>
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm" style={{ background: tierInfo.color + '20', color: tierInfo.color }}>
              {tierInfo.label}
            </span>
          </div>
          {sponsor.website && (
            <span className="text-[11px] text-on-surface/40 truncate block">{sponsor.website}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={function() { onToggle(sponsor) }}
            className={'w-7 h-7 rounded-sm flex items-center justify-center transition-colors border-0 cursor-pointer ' + (isActive ? 'bg-secondary/10 text-secondary' : 'bg-on-surface/5 text-on-surface/30')}
            title={isActive ? 'Deactivate' : 'Activate'}
          >
            <Icon name={isActive ? 'visibility' : 'visibility_off'} size={14} />
          </button>
          <button onClick={function() { onEdit(sponsor) }} className="w-7 h-7 rounded-sm flex items-center justify-center bg-primary/10 text-primary transition-colors border-0 cursor-pointer" title="Edit">
            <Icon name="edit" size={14} />
          </button>
          <button onClick={function() { onDelete(sponsor) }} className="w-7 h-7 rounded-sm flex items-center justify-center bg-error/10 text-error transition-colors border-0 cursor-pointer" title="Delete">
            <Icon name="delete" size={14} />
          </button>
        </div>
      </div>
      <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
        {placements.length === 0 && <span className="text-[11px] text-on-surface/30 italic">No placements configured</span>}
        {placements.map(function(pid) {
          var pl = PLACEMENT_OPTIONS.find(function(p) { return p.id === pid })
          if (!pl) return null
          return (
            <span key={pid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 border border-primary/10 rounded text-[10px] text-primary/80">
              <Icon name={pl.icon} size={10} />
              {pl.label}
            </span>
          )
        })}
        {sponsor.discount_code && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-tertiary/10 border border-tertiary/20 rounded text-[10px] text-tertiary">
            <Icon name="local_offer" size={10} />
            {sponsor.discount_code}
          </span>
        )}
      </div>
    </div>
  )
}

function SponsorForm(props) {
  var form = props.form
  var setForm = props.setForm
  var onSave = props.onSave
  var onCancel = props.onCancel
  var isEditing = props.isEditing

  function updateField(field, val) {
    setForm(Object.assign({}, form, (function() { var o = {}; o[field] = val; return o })()))
  }

  function togglePlacement(pid) {
    var current = form.placements || []
    var idx = current.indexOf(pid)
    if (idx > -1) {
      updateField('placements', current.filter(function(p) { return p !== pid }))
    } else {
      updateField('placements', current.concat([pid]))
    }
  }

  return (
    <Panel className="border-2 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Icon name={isEditing ? 'edit' : 'add_circle'} size={16} className="text-primary" />
        <span className="font-bold text-sm text-on-surface">{isEditing ? 'Edit Sponsor' : 'Add New Sponsor'}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Sponsor Name *</label>
          <Inp value={form.name} onChange={function(v) { updateField('name', typeof v === 'string' ? v : v.target.value) }} placeholder="e.g. SteelSeries" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Logo URL</label>
          <Inp value={form.logo_url} onChange={function(v) { updateField('logo_url', typeof v === 'string' ? v : v.target.value) }} placeholder="https://example.com/logo.png" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Website</label>
          <Inp value={form.website} onChange={function(v) { updateField('website', typeof v === 'string' ? v : v.target.value) }} placeholder="https://example.com" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Contact Email</label>
          <Inp value={form.contact_email} onChange={function(v) { updateField('contact_email', typeof v === 'string' ? v : v.target.value) }} placeholder="partner@example.com" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Partnership Tier</label>
          <Sel value={form.tier} onChange={function(v) { updateField('tier', v) }}>
            {SPONSOR_TIERS.map(function(t) { return <option key={t.id} value={t.id}>{t.label}</option> })}
          </Sel>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Brand Color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={form.color} onChange={function(e) { updateField('color', e.target.value) }} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
            <Inp value={form.color} onChange={function(v) { updateField('color', typeof v === 'string' ? v : v.target.value) }} placeholder="#9B72CF" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Discount / Affiliate Code</label>
          <Inp value={form.discount_code} onChange={function(v) { updateField('discount_code', typeof v === 'string' ? v : v.target.value) }} placeholder="TFTCLASH10" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-1 block">Notes (internal)</label>
          <Inp value={form.notes} onChange={function(v) { updateField('notes', typeof v === 'string' ? v : v.target.value) }} placeholder="Contract details, renewal date..." />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-2 block">Placements</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {PLACEMENT_OPTIONS.map(function(pl) {
            var isSelected = (form.placements || []).indexOf(pl.id) > -1
            return (
              <button
                key={pl.id}
                onClick={function() { togglePlacement(pl.id) }}
                className={'flex items-center gap-2 px-3 py-2.5 rounded-sm border text-left transition-all cursor-pointer ' + (isSelected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container border-outline-variant/10 text-on-surface/60 hover:border-on-surface/20')}
              >
                <Icon name={pl.icon} size={14} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{pl.label}</div>
                  <div className="text-[9px] opacity-60 truncate">{pl.desc}</div>
                </div>
                {isSelected && <Icon name="check_circle" size={14} className="ml-auto flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {form.logo_url && (
        <div className="mb-4 p-3 bg-surface-container-high rounded-sm">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface/40 mb-2 block">Logo Preview</label>
          <div className="flex items-center gap-3">
            <img src={form.logo_url} alt="Preview" className="h-10 object-contain bg-white/5 rounded p-1" onError={function(e) { e.target.style.display = 'none' }} />
            <span className="text-xs text-on-surface/50">How it will appear in sponsor strips</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Btn variant="primary" size="sm" onClick={onSave}>{isEditing ? 'Update Sponsor' : 'Add Sponsor'}</Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel}>Cancel</Btn>
      </div>
    </Panel>
  )
}

export default function SponsorsTab() {
  var ctx = useApp()
  var orgSponsors = ctx.orgSponsors
  var setOrgSponsors = ctx.setOrgSponsors
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _showForm = useState(false)
  var showForm = _showForm[0]
  var setShowForm = _showForm[1]

  var _editIdx = useState(-1)
  var editIdx = _editIdx[0]
  var setEditIdx = _editIdx[1]

  var _form = useState(Object.assign({}, EMPTY_FORM))
  var form = _form[0]
  var setForm = _form[1]

  function addAudit(type, msg) {
    if (supabase.from && currentUser) {
      supabase.from('audit_log').insert({
        action: type,
        actor_id: currentUser.id || null,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'sponsor',
        details: { message: msg, timestamp: Date.now() }
      }).then(function(r) { }).catch(function() {})
    }
  }

  function saveSponsor() {
    if (!form.name.trim()) { toast('Sponsor name is required', 'error'); return }

    var sponsors = orgSponsors || []
    var entry = Object.assign({}, form, { name: form.name.trim() })

    if (editIdx >= 0) {
      var updated = sponsors.map(function(s, i) { return i === editIdx ? Object.assign({}, s, entry) : s })
      setOrgSponsors(updated)
      addAudit('ACTION', 'Sponsor updated: ' + entry.name)
      toast('Sponsor updated', 'success')
    } else {
      entry.status = 'active'
      entry.created_at = new Date().toISOString()
      var updated = sponsors.concat([entry])
      setOrgSponsors(updated)
      addAudit('ACTION', 'Sponsor added: ' + entry.name)
      toast('Sponsor added', 'success')
    }

    setShowForm(false)
    setEditIdx(-1)
    setForm(Object.assign({}, EMPTY_FORM))
  }

  function startEdit(sponsor) {
    var idx = (orgSponsors || []).indexOf(sponsor)
    setEditIdx(idx)
    setForm(Object.assign({}, EMPTY_FORM, sponsor))
    setShowForm(true)
  }

  function toggleStatus(sponsor) {
    var sponsors = orgSponsors || []
    var updated = sponsors.map(function(s) {
      if (s === sponsor) {
        return Object.assign({}, s, { status: s.status === 'active' ? 'inactive' : 'active' })
      }
      return s
    })
    setOrgSponsors(updated)
    var newStatus = sponsor.status === 'active' ? 'inactive' : 'active'
    addAudit('ACTION', 'Sponsor ' + newStatus + ': ' + sponsor.name)
    toast('Sponsor ' + newStatus, 'success')
  }

  function deleteSponsor(sponsor) {
    if (!window.confirm('Remove ' + sponsor.name + ' from sponsors?')) return
    var updated = (orgSponsors || []).filter(function(s) { return s !== sponsor })
    setOrgSponsors(updated)
    addAudit('ACTION', 'Sponsor removed: ' + sponsor.name)
    toast('Sponsor removed', 'success')
  }

  function cancelForm() {
    setShowForm(false)
    setEditIdx(-1)
    setForm(Object.assign({}, EMPTY_FORM))
  }

  var sponsors = orgSponsors || []
  var active = sponsors.filter(function(s) { return s.status === 'active' })
  var inactive = sponsors.filter(function(s) { return s.status !== 'active' })

  var tierCounts = {}
  SPONSOR_TIERS.forEach(function(t) { tierCounts[t.id] = 0 })
  active.forEach(function(s) { tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1 })

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/10 text-center">
          <div className="font-stats text-2xl font-black text-primary">{sponsors.length}</div>
          <div className="text-[10px] text-on-surface/40 uppercase tracking-wider mt-0.5">Total Sponsors</div>
        </div>
        <div className="bg-surface-container rounded-xl p-4 border border-outline-variant/10 text-center">
          <div className="font-stats text-2xl font-black text-secondary">{active.length}</div>
          <div className="text-[10px] text-on-surface/40 uppercase tracking-wider mt-0.5">Active</div>
        </div>
        {SPONSOR_TIERS.map(function(t) {
          return (
            <div key={t.id} className="bg-surface-container rounded-xl p-4 border border-outline-variant/10 text-center">
              <div className="font-stats text-2xl font-black" style={{ color: t.color }}>{tierCounts[t.id] || 0}</div>
              <div className="text-[10px] text-on-surface/40 uppercase tracking-wider mt-0.5">{t.label}</div>
            </div>
          )
        })}
      </div>

      {/* Add button */}
      {!showForm && (
        <Btn variant="primary" size="sm" onClick={function() { setShowForm(true); setEditIdx(-1); setForm(Object.assign({}, EMPTY_FORM)) }}>
          <Icon name="add" size={14} className="mr-1" /> Add Sponsor
        </Btn>
      )}

      {/* Form */}
      {showForm && (
        <SponsorForm
          form={form}
          setForm={setForm}
          onSave={saveSponsor}
          onCancel={cancelForm}
          isEditing={editIdx >= 0}
        />
      )}

      {/* Active sponsors */}
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="verified" size={14} className="text-secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface/50">Active Sponsors ({active.length})</span>
          </div>
          <div className="space-y-2">
            {active.map(function(s, i) {
              return <SponsorCard key={s.id || s.name} sponsor={s} onEdit={startEdit} onToggle={toggleStatus} onDelete={deleteSponsor} />
            })}
          </div>
        </div>
      )}

      {/* Inactive sponsors */}
      {inactive.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="visibility_off" size={14} className="text-on-surface/30" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface/30">Inactive ({inactive.length})</span>
          </div>
          <div className="space-y-2">
            {inactive.map(function(s, i) {
              return <SponsorCard key={s.id || s.name} sponsor={s} onEdit={startEdit} onToggle={toggleStatus} onDelete={deleteSponsor} />
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sponsors.length === 0 && !showForm && (
        <Panel>
          <div className="text-center py-8">
            <Icon name="handshake" size={32} className="text-on-surface/20 mx-auto mb-3" />
            <div className="text-sm font-semibold text-on-surface/50 mb-1">No sponsors yet</div>
            <div className="text-xs text-on-surface/30 mb-4">Add your first sponsor to start managing partnerships</div>
            <Btn variant="secondary" size="sm" onClick={function() { setShowForm(true) }}>
              <Icon name="add" size={14} className="mr-1" /> Add First Sponsor
            </Btn>
          </div>
        </Panel>
      )}

      {/* Placement overview */}
      {active.length > 0 && (
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="grid_view" size={16} className="text-tertiary" />
            <span className="font-bold text-sm text-on-surface">Placement Overview</span>
          </div>
          <div className="space-y-2">
            {PLACEMENT_OPTIONS.map(function(pl) {
              var sponsorsHere = active.filter(function(s) { return (s.placements || []).indexOf(pl.id) > -1 })
              return (
                <div key={pl.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-container-high rounded-sm">
                  <Icon name={pl.icon} size={14} className="text-on-surface/40 flex-shrink-0" />
                  <span className="text-xs font-semibold text-on-surface/70 w-32 flex-shrink-0">{pl.label}</span>
                  <div className="flex-1 flex flex-wrap gap-1">
                    {sponsorsHere.length === 0 && <span className="text-[10px] text-on-surface/25 italic">No sponsors assigned</span>}
                    {sponsorsHere.map(function(s) {
                      var tierInfo = SPONSOR_TIERS.find(function(t) { return t.id === s.tier }) || SPONSOR_TIERS[0]
                      return (
                        <span key={s.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: tierInfo.color + '15', color: tierInfo.color }}>
                          {s.name}
                        </span>
                      )
                    })}
                  </div>
                  <span className="text-[10px] font-bold text-on-surface/30 flex-shrink-0">{sponsorsHere.length}</span>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Sponsor strip preview */}
      {active.length > 0 && (
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="preview" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Footer Strip Preview</span>
          </div>
          <div className="bg-surface-container-high rounded-lg p-4 border border-outline-variant/5">
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {active.filter(function(s) { return (s.placements || []).indexOf('footer') > -1 }).map(function(s) {
                return (
                  <div key={s.name} className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.name} className="h-6 object-contain grayscale hover:grayscale-0 transition-all" />
                    ) : (
                      <span className="text-xs font-bold text-on-surface/40" style={{ color: s.color }}>{s.name}</span>
                    )}
                  </div>
                )
              })}
              {active.filter(function(s) { return (s.placements || []).indexOf('footer') > -1 }).length === 0 && (
                <span className="text-xs text-on-surface/30 italic">No sponsors assigned to footer placement</span>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}
