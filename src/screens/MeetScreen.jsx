import { useState, useMemo, useEffect } from 'react'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Icon, Inp } from '../components/ui'
import meetData from '../donut17/data/meet.json'

var TYPE_ORDER = [
  'Opener',
  'Augment',
  'Emblem',
  'God',
  'Arbiter',
  'Item',
  'Worth the Wait 1',
  'Worth the Wait 2',
  'Fast 9'
]

var TYPE_ICON = {
  'Opener': 'rocket_launch',
  'Augment': 'auto_awesome',
  'Emblem': 'workspace_premium',
  'God': 'flare',
  'Arbiter': 'gavel',
  'Item': 'inventory_2',
  'Worth the Wait 1': 'hourglass_top',
  'Worth the Wait 2': 'hourglass_bottom',
  'Fast 9': 'speed'
}

function normalizeType(raw) {
  if (!raw) return 'Other'
  return raw.trim()
}

function buildTypes(rows) {
  var seen = {}
  rows.forEach(function (r) { seen[normalizeType(r.type)] = true })
  var ordered = []
  TYPE_ORDER.forEach(function (t) { if (seen[t]) { ordered.push(t); delete seen[t] } })
  Object.keys(seen).sort().forEach(function (t) { ordered.push(t) })
  return ordered
}

function highlight(text, query) {
  if (!query) return text
  var q = query.toLowerCase()
  var lower = text.toLowerCase()
  var idx = lower.indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/30 text-on-surface rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function MeetCard(props) {
  var row = props.row
  var query = props.query
  var icon = TYPE_ICON[normalizeType(row.type)] || 'menu_book'

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon name={icon} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant">
              {row.type || 'Other'}
            </span>
            {row.stage && row.stage !== 'Any' && (
              <span className="font-label uppercase tracking-widest text-[10px] text-tertiary bg-tertiary/10 rounded px-1.5 py-0.5">
                Stage {row.stage}
              </span>
            )}
            {row.stage === 'Any' && (
              <span className="font-label uppercase tracking-widest text-[10px] text-on-surface-variant/70 bg-surface-container-low rounded px-1.5 py-0.5">
                Any Stage
              </span>
            )}
          </div>
          <h3 className="font-display text-lg leading-tight text-on-surface">
            {highlight(row.condition || '', query)}
          </h3>
        </div>
      </div>

      {row.comp && (
        <div className="mb-2 flex items-start gap-2">
          <Icon name="groups" size={16} className="text-on-surface-variant mt-0.5 shrink-0" />
          <p className="font-body text-sm text-on-surface">
            {highlight(row.comp, query)}
          </p>
        </div>
      )}

      {row.notes && (
        <div className="flex items-start gap-2 mt-3 pt-3 border-t border-outline-variant/20">
          <Icon name="sticky_note_2" size={16} className="text-on-surface-variant mt-0.5 shrink-0" />
          <p className="font-body text-sm text-on-surface-variant whitespace-pre-line">
            {highlight(row.notes, query)}
          </p>
        </div>
      )}
    </div>
  )
}

export default function MeetScreen() {
  useEffect(function () {
    var prev = document.title
    document.title = 'Meet - Donut 17 Conditions'
    return function () { document.title = prev }
  }, [])

  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  var _t = useState('All')
  var typeFilter = _t[0]
  var setTypeFilter = _t[1]

  var rows = meetData
  var types = useMemo(function () { return buildTypes(rows) }, [rows])

  var filtered = useMemo(function () {
    var q = query.trim().toLowerCase()
    return rows.filter(function (r) {
      if (typeFilter !== 'All' && normalizeType(r.type) !== typeFilter) return false
      if (!q) return true
      var hay = ((r.condition || '') + ' ' + (r.comp || '') + ' ' + (r.notes || '') + ' ' + (r.type || '') + ' ' + (r.stage || '')).toLowerCase()
      return hay.indexOf(q) !== -1
    })
  }, [rows, query, typeFilter])

  var grouped = useMemo(function () {
    var map = {}
    filtered.forEach(function (r) {
      var t = normalizeType(r.type)
      if (!map[t]) map[t] = []
      map[t].push(r)
    })
    var orderedKeys = []
    TYPE_ORDER.forEach(function (t) { if (map[t]) orderedKeys.push(t) })
    Object.keys(map).sort().forEach(function (t) {
      if (orderedKeys.indexOf(t) === -1) orderedKeys.push(t)
    })
    return orderedKeys.map(function (k) { return { type: k, rows: map[k] } })
  }, [filtered])

  var totalCount = rows.length
  var visibleCount = filtered.length

  return (
    <PageLayout>
      <PageHeader
        subtitle="Donut 17"
        title="Meet"
        description="Conditions, openers, and comp lines for TFT Set 17. Pulled from the live Donut 17 prep sheet."
      />

      <Panel className="p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            <Inp
              value={query}
              onChange={function (e) { setQuery(e.target.value) }}
              placeholder="Search conditions, comps, notes..."
              className="pl-10"
            />
          </div>
          <div className="font-mono text-xs text-on-surface-variant whitespace-nowrap">
            {visibleCount} / {totalCount} entries
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={function () { setTypeFilter('All') }}
            className={'px-3 py-1.5 rounded-full font-label uppercase tracking-widest text-[11px] border transition-colors ' + (typeFilter === 'All' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-primary/40')}
          >
            All
          </button>
          {types.map(function (t) {
            var active = typeFilter === t
            return (
              <button
                key={t}
                type="button"
                onClick={function () { setTypeFilter(t) }}
                className={'px-3 py-1.5 rounded-full font-label uppercase tracking-widest text-[11px] border transition-colors flex items-center gap-1.5 ' + (active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-primary/40')}
              >
                <Icon name={TYPE_ICON[t] || 'menu_book'} size={14} />
                {t}
              </button>
            )
          })}
        </div>
      </Panel>

      {grouped.length === 0 && (
        <Panel className="p-8 text-center">
          <Icon name="search_off" size={32} className="text-on-surface-variant mb-2" />
          <div className="font-display text-lg text-on-surface mb-1">No matches</div>
          <div className="font-body text-sm text-on-surface-variant">
            Try clearing your search or picking a different category.
          </div>
        </Panel>
      )}

      {grouped.map(function (group) {
        return (
          <section key={group.type} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Icon name={TYPE_ICON[group.type] || 'menu_book'} size={22} className="text-primary" />
              <h2 className="font-display text-2xl text-on-surface">{group.type}</h2>
              <span className="font-mono text-xs text-on-surface-variant">{group.rows.length}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.rows.map(function (r) {
                return <MeetCard key={r.id} row={r} query={query} />
              })}
            </div>
          </section>
        )
      })}

      <p className="font-mono text-[10px] text-on-surface-variant/60 mt-8 text-center">
        Source: Donut 17 prep sheet. Snapshot at build time.
      </p>
    </PageLayout>
  )
}
