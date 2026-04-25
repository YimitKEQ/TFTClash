import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import SectionHeader from '../components/shared/SectionHeader.jsx'
import {
  readListings,
  createListing,
  deleteListing,
  closeListing,
  expressInterest,
  interestsFor,
  TIER_LABELS,
  TIER_COLOR,
} from '../lib/marketplace.js'

function fmtAge(ts) {
  var diff = Date.now() - ts
  var days = Math.floor(diff / 86400000)
  if (days >= 1) return days + 'd ago'
  var hours = Math.floor(diff / 3600000)
  if (hours >= 1) return hours + 'h ago'
  var mins = Math.floor(diff / 60000)
  if (mins >= 1) return mins + 'm ago'
  return 'just now'
}

function ListingCard(props) {
  var l = props.listing
  var onDelete = props.onDelete
  var onClose = props.onClose
  var onInterest = props.onInterest
  var canManage = props.canManage
  var interestCount = props.interestCount || 0

  var _open = useState(false)
  var open = _open[0]
  var setOpen = _open[1]

  var _name = useState('')
  var name = _name[0]
  var setName = _name[1]
  var _contact = useState('')
  var contact = _contact[0]
  var setContact = _contact[1]
  var _note = useState('')
  var note = _note[0]
  var setNote = _note[1]

  function submit() {
    if (!name.trim() || !contact.trim()) return
    onInterest({
      listingId: l.id,
      sponsor: name.trim(),
      contact: contact.trim(),
      note: note.trim(),
    })
    setName('')
    setContact('')
    setNote('')
    setOpen(false)
  }

  var tierColor = TIER_COLOR[l.tier] || 'text-on-surface-variant'

  return (
    <Panel elevation="elevated" radius="xl" padding="default" className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={'font-label text-[10px] tracking-widest uppercase font-bold ' + tierColor}>
              {TIER_LABELS[l.tier] || l.tier}
            </span>
            {l.status === 'closed' && (
              <span className="font-label text-[10px] tracking-widest uppercase font-bold text-on-surface-variant/60 bg-surface-container-high px-2 py-0.5 rounded">closed</span>
            )}
            <span className="text-[10px] text-on-surface-variant/40">{fmtAge(l.createdAt)}</span>
          </div>
          <h3 className="font-display text-lg font-bold text-on-surface mb-1 leading-tight">{l.title}</h3>
          <p className="text-on-surface-variant text-sm">{'by ' + l.host}</p>
        </div>
        {l.budget && (
          <div className="text-right shrink-0">
            <div className="font-mono text-base font-bold text-tertiary">{l.budget}</div>
            <div className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant/40">budget</div>
          </div>
        )}
      </div>

      {l.description && (
        <p className="text-sm text-on-surface-variant leading-relaxed">{l.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {l.region && (
          <div className="bg-surface-container-high rounded px-3 py-2">
            <div className="text-[9px] font-label uppercase tracking-wider text-on-surface-variant/50 mb-0.5">Region</div>
            <div className="font-mono text-on-surface">{l.region}</div>
          </div>
        )}
        {l.deadline && (
          <div className="bg-surface-container-high rounded px-3 py-2">
            <div className="text-[9px] font-label uppercase tracking-wider text-on-surface-variant/50 mb-0.5">Deadline</div>
            <div className="font-mono text-on-surface">{l.deadline}</div>
          </div>
        )}
        {l.audience && (
          <div className="bg-surface-container-high rounded px-3 py-2 col-span-2">
            <div className="text-[9px] font-label uppercase tracking-wider text-on-surface-variant/50 mb-0.5">Audience</div>
            <div className="text-on-surface">{l.audience}</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/10">
        {interestCount > 0 && (
          <span className="text-xs text-on-surface-variant flex items-center gap-1">
            <Icon name="bookmark" size={14} className="text-tertiary" />
            {interestCount + ' interested'}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {canManage && l.status === 'open' && (
            <button
              onClick={function () { onClose(l.id) }}
              className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60 hover:text-on-surface px-2 py-1 rounded bg-surface-container-high"
            >
              Close
            </button>
          )}
          {canManage && (
            <button
              onClick={function () { onDelete(l.id) }}
              className="text-[10px] font-label uppercase tracking-widest text-error/70 hover:text-error px-2 py-1 rounded bg-surface-container-high"
            >
              Delete
            </button>
          )}
          {l.status === 'open' && (
            <Btn variant="primary" size="sm" onClick={function () { setOpen(function (v) { return !v }) }}>
              {open ? 'Cancel' : 'Express interest'}
            </Btn>
          )}
        </div>
      </div>

      {open && l.status === 'open' && (
        <div className="border-t border-outline-variant/10 pt-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={function (e) { setName(e.target.value.slice(0, 60)) }}
            placeholder="Brand or company name"
            className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40"
          />
          <input
            type="text"
            value={contact}
            onChange={function (e) { setContact(e.target.value.slice(0, 100)) }}
            placeholder="Email or Discord handle"
            className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40"
          />
          <textarea
            value={note}
            onChange={function (e) { setNote(e.target.value.slice(0, 300)) }}
            placeholder="What you'd bring to the slot (optional)"
            rows={3}
            className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 resize-none"
          />
          <Btn variant="primary" size="sm" onClick={submit} disabled={!name.trim() || !contact.trim()}>
            Submit interest
          </Btn>
        </div>
      )}
    </Panel>
  )
}

export default function MarketplaceScreen() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var hostApps = ctx.hostApps || []

  var _listings = useState(function () { return readListings() })
  var listings = _listings[0]
  var setListings = _listings[1]

  var _filter = useState('open')
  var filter = _filter[0]
  var setFilter = _filter[1]

  var _showForm = useState(false)
  var showForm = _showForm[0]
  var setShowForm = _showForm[1]

  var _form = useState({
    host: (currentUser && currentUser.username) || '',
    title: '',
    description: '',
    tier: 'associate',
    budget: '',
    region: '',
    deadline: '',
    contact: (currentUser && currentUser.email) || '',
    audience: '',
  })
  var form = _form[0]
  var setForm = _form[1]

  useEffect(function () {
    function onStorage(e) {
      if (!e.key) return
      if (e.key.indexOf('tft-marketplace-') === 0) setListings(readListings())
    }
    window.addEventListener('storage', onStorage)
    return function () { window.removeEventListener('storage', onStorage) }
  }, [])

  function refresh() { setListings(readListings()) }

  function onCreate() {
    if (!form.title.trim() || !form.host.trim()) {
      toast && toast('Title and host name are required', 'error')
      return
    }
    createListing(form)
    refresh()
    setShowForm(false)
    setForm({
      host: (currentUser && currentUser.username) || '',
      title: '',
      description: '',
      tier: 'associate',
      budget: '',
      region: '',
      deadline: '',
      contact: (currentUser && currentUser.email) || '',
      audience: '',
    })
    toast && toast('Listing posted to marketplace', 'success')
  }

  function onDelete(id) {
    deleteListing(id)
    refresh()
    toast && toast('Listing removed', 'info')
  }

  function onClose(id) {
    closeListing(id)
    refresh()
    toast && toast('Listing closed', 'info')
  }

  function onInterest(input) {
    expressInterest(input)
    refresh()
    toast && toast('Interest recorded — host can see your contact', 'success')
  }

  var isApprovedHost = currentUser && hostApps.some(function (a) {
    return a.status === 'approved' && a.user_id === currentUser.auth_user_id
  })

  var visible = listings.filter(function (l) {
    if (filter === 'open') return l.status === 'open'
    if (filter === 'closed') return l.status === 'closed'
    return true
  }).sort(function (a, b) { return b.createdAt - a.createdAt })

  function update(field, val) {
    setForm(function (f) {
      var n = Object.assign({}, f)
      n[field] = val
      return n
    })
  }

  return (
    <PageLayout maxWidth="max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 bg-tertiary/10 border border-tertiary/20 rounded-full px-4 py-2 inline-flex mb-4">
          <Icon name="storefront" className="text-tertiary text-sm" />
          <span className="font-label text-xs tracking-widest uppercase text-tertiary font-semibold">Sponsor Marketplace</span>
        </div>
        <h1 className="font-editorial italic text-on-background font-extrabold leading-tight mb-2" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>
          Find a sponsor.<br />
          <span className="text-tertiary">Or find a tournament to sponsor.</span>
        </h1>
        <p className="text-on-surface-variant max-w-2xl">
          Hosts list open sponsor slots. Sponsors browse, find a fit, and reach out directly.
          The platform doesn't take a cut on contacts here — only on revenue that flows through the platform's invoicing system.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="inline-flex items-center bg-surface-container-low border border-outline-variant/15 rounded-full p-1">
          {['open', 'closed', 'all'].map(function (f) {
            var active = filter === f
            return (
              <button
                key={f}
                onClick={function () { setFilter(f) }}
                className={'px-4 py-1.5 rounded-full text-xs font-label tracking-widest uppercase font-bold transition-colors ' + (active ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface')}
              >
                {f}
              </button>
            )
          })}
        </div>
        <span className="text-xs text-on-surface-variant/50 ml-2">{visible.length + ' listing' + (visible.length === 1 ? '' : 's')}</span>
        <div className="ml-auto flex gap-2">
          {isApprovedHost && (
            <Btn variant="primary" size="sm" icon="add" onClick={function () { setShowForm(function (v) { return !v }) }}>
              {showForm ? 'Cancel' : 'List a slot'}
            </Btn>
          )}
        </div>
      </div>

      {showForm && (
        <Panel elevation="elevated" radius="xl" padding="default" className="mb-6 space-y-3">
          <SectionHeader eyebrow="New listing" title="Post an open sponsor slot" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <input type="text" value={form.host} onChange={function (e) { update('host', e.target.value.slice(0, 60)) }} placeholder="Your host name" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40" />
            <input type="text" value={form.title} onChange={function (e) { update('title', e.target.value.slice(0, 100)) }} placeholder="Slot title (e.g. EUW Weekly Clash sponsor)" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40" />
            <select value={form.tier} onChange={function (e) { update('tier', e.target.value) }} className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40">
              <option value="associate">Associate tier</option>
              <option value="official">Official Sponsor</option>
              <option value="title">Title Partner</option>
            </select>
            <input type="text" value={form.budget} onChange={function (e) { update('budget', e.target.value.slice(0, 40)) }} placeholder="Budget (e.g. €500-1000)" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40" />
            <input type="text" value={form.region} onChange={function (e) { update('region', e.target.value.slice(0, 20)) }} placeholder="Region (e.g. EUW)" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40" />
            <input type="text" value={form.deadline} onChange={function (e) { update('deadline', e.target.value.slice(0, 20)) }} placeholder="Deadline (e.g. 2026-05-15)" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40" />
            <input type="text" value={form.contact} onChange={function (e) { update('contact', e.target.value.slice(0, 100)) }} placeholder="Your contact (email/discord)" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 md:col-span-2" />
            <textarea value={form.audience} onChange={function (e) { update('audience', e.target.value.slice(0, 200)) }} placeholder="Audience (e.g. 200+ avg viewers, EU prime time)" rows={2} className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 resize-none md:col-span-2" />
            <textarea value={form.description} onChange={function (e) { update('description', e.target.value.slice(0, 500)) }} placeholder="Describe what's on offer (logo placement, OBS overlay, etc.)" rows={3} className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 resize-none md:col-span-2" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Btn variant="secondary" size="sm" onClick={function () { setShowForm(false) }}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="campaign" onClick={onCreate}>Post listing</Btn>
          </div>
        </Panel>
      )}

      {visible.length === 0 && (
        <Panel elevation="elevated" radius="xl" padding="spacious" className="text-center">
          <Icon name="storefront" size={48} className="text-on-surface-variant/20 mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold text-on-surface mb-1">No listings yet</h3>
          <p className="text-on-surface-variant text-sm mb-5">
            {filter === 'open' ? 'Be the first host to list an open sponsor slot.' : 'No closed listings to show.'}
          </p>
          {currentUser && (
            <Btn variant="primary" size="sm" icon="add" onClick={function () { setShowForm(true); setFilter('open') }}>
              List a slot
            </Btn>
          )}
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map(function (l) {
          var canManage = currentUser && (
            (currentUser.username && l.host.toLowerCase() === currentUser.username.toLowerCase()) ||
            (currentUser.is_admin)
          )
          return (
            <ListingCard
              key={l.id}
              listing={l}
              canManage={canManage}
              interestCount={interestsFor(l.id).length}
              onDelete={onDelete}
              onClose={onClose}
              onInterest={onInterest}
            />
          )
        })}
      </div>
    </PageLayout>
  )
}
