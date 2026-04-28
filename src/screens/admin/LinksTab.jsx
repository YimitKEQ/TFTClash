import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Btn, Inp, Icon, Sel } from '../../components/ui'
import { SOCIAL_BRANDS, brandFor, brandAccent } from '../../lib/socialBrands.js'

var SETTING_KEY = 'social_links'

function makeId() {
  return 'l_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)
}

function newLink() {
  return {
    id: makeId(),
    kind: 'website',
    label: '',
    url: '',
    description: '',
    featured: false,
  }
}

function BrandPreview(props) {
  var kind = props.kind
  var brand = brandFor(kind)
  var accent = brandAccent(kind, 0.74)
  return (
    <div
      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
      style={{
        background: 'color-mix(in oklch, ' + accent + ' 15%, oklch(0.16 0 0))',
        color: accent,
        boxShadow: '0 0 0 1px color-mix(in oklch, ' + accent + ' 28%, transparent)',
      }}
      aria-hidden="true"
    >
      {brand.svg ? (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" focusable="false">
          <path d={brand.svg} />
        </svg>
      ) : (
        <Icon name={brand.mat} size={18} />
      )}
    </div>
  )
}

function LinkRow(props) {
  var link = props.link
  var idx = props.idx
  var total = props.total
  var onChange = props.onChange
  var onRemove = props.onRemove
  var onMove = props.onMove
  var onToggleFeatured = props.onToggleFeatured

  function patch(field, value) {
    onChange(Object.assign({}, link, (function(){ var o = {}; o[field] = value; return o })()))
  }

  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container/80 p-4">
      <div className="flex items-start gap-3">
        <BrandPreview kind={link.kind} />

        <div className="flex-1 min-w-0 grid gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Sel value={link.kind} onChange={function(v){ patch('kind', v) }}>
              {SOCIAL_BRANDS.map(function(b){
                return <option key={b.kind} value={b.kind}>{b.label}</option>
              })}
            </Sel>
            <Inp
              value={link.label}
              onChange={function(v){ patch('label', v) }}
              placeholder="Display label (e.g. @tftclash)"
            />
          </div>
          <Inp
            value={link.url}
            onChange={function(v){ patch('url', v) }}
            placeholder="https://"
          />
          <Inp
            value={link.description || ''}
            onChange={function(v){ patch('description', v) }}
            placeholder="Short description (optional)"
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-1">
          <button
            type="button"
            onClick={function(){ onMove(idx, -1) }}
            disabled={idx === 0}
            aria-label="Move up"
            className="w-7 h-7 rounded flex items-center justify-center text-on-surface/60 hover:text-on-surface hover:bg-on-surface/8 disabled:opacity-30 disabled:hover:bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="keyboard_arrow_up" size={18} />
          </button>
          <button
            type="button"
            onClick={function(){ onMove(idx, 1) }}
            disabled={idx === total - 1}
            aria-label="Move down"
            className="w-7 h-7 rounded flex items-center justify-center text-on-surface/60 hover:text-on-surface hover:bg-on-surface/8 disabled:opacity-30 disabled:hover:bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="keyboard_arrow_down" size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10">
        <button
          type="button"
          onClick={function(){ onToggleFeatured(link.id) }}
          className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-label text-[10px] uppercase tracking-widest border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ' + (link.featured ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-transparent border-outline-variant/30 text-on-surface/55 hover:text-on-surface hover:border-outline-variant/50')}
          aria-pressed={!!link.featured}
        >
          <Icon name="push_pin" size={13} />
          {link.featured ? 'Pinned' : 'Pin to top'}
        </button>
        <button
          type="button"
          onClick={function(){ onRemove(link.id) }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-error/80 hover:text-error hover:bg-error/10 border-0 bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60"
        >
          <Icon name="delete" size={14} />
          Remove
        </button>
      </div>
    </div>
  )
}

export default function LinksTab() {
  var _links = useState([])
  var links = _links[0]
  var setLinks = _links[1]
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

  useEffect(function(){
    var alive = true
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle()
      .then(function(res){
        if (!alive) return
        setLoading(false)
        if (res.error) {
          setError('Could not load existing config: ' + res.error.message)
          return
        }
        if (!res.data) {
          setLinks([])
          return
        }
        try {
          var raw = res.data.value
          var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (Array.isArray(parsed)) {
            setLinks(parsed.map(function(l){ return Object.assign({ id: makeId() }, l) }))
          } else {
            setLinks([])
          }
        } catch (e) {
          setError('Stored value is not valid JSON. Save a fresh list to overwrite.')
          setLinks([])
        }
      })
    return function(){ alive = false }
  }, [])

  function onAdd() {
    setLinks(links.concat([newLink()]))
    setStatus('')
  }

  function onChangeOne(idx, next) {
    var copy = links.slice()
    copy[idx] = next
    setLinks(copy)
    setStatus('')
  }

  function onRemove(id) {
    setLinks(links.filter(function(l){ return l.id !== id }))
    setStatus('')
  }

  function onMove(idx, delta) {
    var to = idx + delta
    if (to < 0 || to >= links.length) return
    var copy = links.slice()
    var tmp = copy[idx]
    copy[idx] = copy[to]
    copy[to] = tmp
    setLinks(copy)
    setStatus('')
  }

  function onToggleFeatured(id) {
    var copy = links.map(function(l){
      if (l.id === id) return Object.assign({}, l, { featured: !l.featured })
      return Object.assign({}, l, { featured: false })
    })
    setLinks(copy)
    setStatus('')
  }

  function validate() {
    var problems = []
    for (var i = 0; i < links.length; i++) {
      var l = links[i]
      if (!l.label || !l.label.trim()) problems.push('Row ' + (i + 1) + ' is missing a label.')
      if (!l.url || !l.url.trim()) problems.push('Row ' + (i + 1) + ' is missing a URL.')
      if (l.url && !/^https?:\/\//i.test(l.url) && !/^mailto:/i.test(l.url)) {
        problems.push('Row ' + (i + 1) + ': URL should start with https:// or mailto:.')
      }
    }
    return problems
  }

  function onSave() {
    setError('')
    setStatus('')
    var problems = validate()
    if (problems.length > 0) {
      setError(problems.join(' '))
      return
    }
    setSaving(true)
    var payload = links.map(function(l){
      return {
        id: l.id,
        kind: l.kind,
        label: l.label.trim(),
        url: l.url.trim(),
        description: (l.description || '').trim(),
        featured: !!l.featured,
      }
    })
    supabase
      .from('site_settings')
      .upsert({ key: SETTING_KEY, value: JSON.stringify(payload) }, { onConflict: 'key' })
      .then(function(res){
        setSaving(false)
        if (res.error) {
          setError('Save failed: ' + res.error.message)
          return
        }
        setStatus('Saved. Live at /links.')
      })
  }

  var pinnedCount = links.filter(function(l){ return l.featured }).length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base uppercase tracking-tight text-on-surface">Public Links Page</h2>
          <p className="text-xs text-on-surface/55 max-w-prose mt-1">
            What appears at <span className="text-primary font-mono">/links</span>. Pin one as the hero, reorder the rest with the arrows. Saves go live instantly via realtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/links"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs text-on-surface/70 hover:text-on-surface border border-outline-variant/20 hover:border-outline-variant/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="open_in_new" size={14} />
            Open page
          </a>
          <Btn variant="secondary" icon="add" iconPosition="left" onClick={onAdd}>
            Add link
          </Btn>
        </div>
      </header>

      {pinnedCount > 1 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Only one link can be pinned. Toggle off the extras before saving.
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[0,1,2].map(function(k){
            return <div key={k} className="h-28 rounded-xl border border-outline-variant/15 bg-surface-container/60 animate-pulse" />
          })}
        </div>
      ) : links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/30 p-8 text-center">
          <Icon name="link" size={28} className="text-on-surface/35 block mx-auto mb-2" />
          <div className="text-sm text-on-surface/70 mb-1">No links yet.</div>
          <div className="text-xs text-on-surface/45 mb-4">Add Twitter, Discord, your shop, anywhere your audience should find you.</div>
          <Btn variant="primary" icon="add" iconPosition="left" onClick={onAdd}>Add your first link</Btn>
        </div>
      ) : (
        <div className="grid gap-3">
          {links.map(function(l, i){
            return (
              <LinkRow
                key={l.id}
                link={l}
                idx={i}
                total={links.length}
                onChange={function(next){ onChangeOne(i, next) }}
                onRemove={onRemove}
                onMove={onMove}
                onToggleFeatured={onToggleFeatured}
              />
            )
          })}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-surface-container/95 backdrop-blur border-t border-outline-variant/15 flex items-center justify-between gap-3">
        <div className="text-xs text-on-surface/55 truncate" role="status" aria-live="polite">
          {status || (links.length === 1 ? '1 link' : links.length + ' links')}
        </div>
        <Btn variant="primary" icon="save" iconPosition="left" disabled={saving || loading} onClick={onSave}>
          {saving ? 'Saving...' : 'Save changes'}
        </Btn>
      </div>
    </div>
  )
}
