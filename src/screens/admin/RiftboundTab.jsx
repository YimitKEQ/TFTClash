import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Btn, Inp, Icon, Sel } from '../../components/ui'
import { DOMAINS, TIER_ORDER, TIER_LABELS } from '../../lib/riftboundContent.js'

var SETTING_KEY = 'riftbound_meta'

function makeId() {
  return 'rb_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)
}

function newEntry() {
  return { id: makeId(), name: '', tier: '2', domains: [], blurb: '' }
}

function toggleDomain(entry, domainId) {
  var has = (entry.domains || []).indexOf(domainId) !== -1
  var next = has
    ? entry.domains.filter(function(d) { return d !== domainId })
    : (entry.domains || []).concat([domainId]).slice(0, 2)
  return Object.assign({}, entry, { domains: next })
}

function EntryRow(props) {
  var entry = props.entry
  var idx = props.idx
  var onChange = props.onChange
  var onRemove = props.onRemove

  function patch(field, value) {
    onChange(Object.assign({}, entry, (function() { var o = {}; o[field] = value; return o })()))
  }

  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container/80 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 mb-3">
        <Inp value={entry.name} onChange={function(v) { patch('name', v) }} placeholder="Legend / archetype name (e.g. Master Yi)" />
        <Sel value={entry.tier} onChange={function(v) { patch('tier', v) }}>
          {TIER_ORDER.map(function(t) {
            return <option key={t} value={t}>{(TIER_LABELS[t] || {}).label || ('Tier ' + t)}</option>
          })}
        </Sel>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {DOMAINS.map(function(d) {
          var active = (entry.domains || []).indexOf(d.id) !== -1
          return (
            <button
              key={d.id}
              type="button"
              onClick={function() { onChange(toggleDomain(entry, d.id)) }}
              className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-label uppercase tracking-wide transition-colors cursor-pointer ' + (active ? 'text-on-surface' : 'text-on-surface/40 border-outline-variant/20')}
              style={active ? { background: d.color + '22', borderColor: d.color + '60' } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              {d.name}
            </button>
          )
        })}
      </div>

      <textarea
        value={entry.blurb || ''}
        onChange={function(e) { patch('blurb', e.target.value) }}
        placeholder="Why it's good right now (1-2 sentences)"
        rows={2}
        className="w-full bg-surface-container-lowest border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 resize-none"
      />

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={function() { onRemove(entry.id) }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-error/80 hover:text-error hover:bg-error/10 border-0 bg-transparent cursor-pointer"
        >
          <Icon name="delete" size={14} />
          Remove
        </button>
      </div>
    </div>
  )
}

export default function RiftboundTab() {
  var _entries = useState([])
  var entries = _entries[0]
  var setEntries = _entries[1]
  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]
  var _saving = useState(false)
  var saving = _saving[0]
  var setSaving = _saving[1]
  var _status = useState('')
  var status = _status[0]
  var setStatus = _status[1]
  var _error = useState('')
  var error = _error[0]
  var setError = _error[1]

  useEffect(function() {
    var alive = true
    supabase.from('site_settings').select('value').eq('key', SETTING_KEY).maybeSingle()
      .then(function(res) {
        if (!alive) return
        setLoading(false)
        if (res.error) { setError('Could not load existing config: ' + res.error.message); return }
        if (!res.data) { setEntries([]); return }
        try {
          var raw = res.data.value
          var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(parsed)) setEntries(parsed.map(function(e) { return Object.assign({ id: makeId() }, e) }))
          else setEntries([])
        } catch (e) {
          setError('Stored value is not valid JSON. Save a fresh list to overwrite.')
          setEntries([])
        }
      })
    return function() { alive = false }
  }, [])

  function onAdd() {
    setEntries(entries.concat([newEntry()]))
    setStatus('')
  }

  function onChangeOne(idx, next) {
    var copy = entries.slice()
    copy[idx] = next
    setEntries(copy)
    setStatus('')
  }

  function onRemove(id) {
    setEntries(entries.filter(function(e) { return e.id !== id }))
    setStatus('')
  }

  function validate() {
    var problems = []
    entries.forEach(function(e, i) {
      if (!e.name || !e.name.trim()) problems.push('Row ' + (i + 1) + ' is missing a name.')
    })
    return problems
  }

  function onSave() {
    setError('')
    setStatus('')
    var problems = validate()
    if (problems.length > 0) { setError(problems.join(' ')); return }
    setSaving(true)
    var payload = entries.map(function(e) {
      return { id: e.id, name: e.name.trim(), tier: e.tier || '2', domains: e.domains || [], blurb: (e.blurb || '').trim() }
    })
    supabase.from('site_settings').upsert({ key: SETTING_KEY, value: JSON.stringify(payload) }, { onConflict: 'key' })
      .then(function(res) {
        setSaving(false)
        if (res.error) { setError('Save failed: ' + res.error.message); return }
        setStatus('Saved. Live at /riftbound.')
      })
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base uppercase tracking-tight text-on-surface">Riftbound Meta Tier List</h2>
          <p className="text-xs text-on-surface/55 max-w-prose mt-1">
            What appears at <span className="text-primary font-mono">/riftbound</span>. Add a legend or archetype, set its domains and tier, and a short note on why it's strong.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/riftbound" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs text-on-surface/70 hover:text-on-surface border border-outline-variant/20 hover:border-outline-variant/40 transition-colors">
            <Icon name="open_in_new" size={14} />
            Open page
          </a>
          <Btn variant="secondary" icon="add" iconPosition="left" onClick={onAdd}>Add entry</Btn>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map(function(k) { return <div key={k} className="h-32 rounded-xl border border-outline-variant/15 bg-surface-container/60 animate-pulse" /> })}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/30 p-8 text-center">
          <Icon name="auto_awesome" size={28} className="text-on-surface/35 block mx-auto mb-2" />
          <div className="text-sm text-on-surface/70 mb-1">No entries yet.</div>
          <div className="text-xs text-on-surface/45 mb-4">Add the current top legends/archetypes to seed the public tier list.</div>
          <Btn variant="primary" icon="add" iconPosition="left" onClick={onAdd}>Add your first entry</Btn>
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map(function(e, i) {
            return (
              <EntryRow
                key={e.id}
                entry={e}
                idx={i}
                onChange={function(next) { onChangeOne(i, next) }}
                onRemove={onRemove}
              />
            )
          })}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-surface-container/95 backdrop-blur border-t border-outline-variant/15 flex items-center justify-between gap-3">
        <div className="text-xs text-on-surface/55 truncate" role="status" aria-live="polite">
          {status || (entries.length === 1 ? '1 entry' : entries.length + ' entries')}
        </div>
        <Btn variant="primary" icon="save" iconPosition="left" disabled={saving || loading} onClick={onSave}>
          {saving ? 'Saving...' : 'Save changes'}
        </Btn>
      </div>
    </div>
  )
}
