import { useState, useMemo } from 'react'
import meetData from '../data/meet.json'

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
      <mark style={{ background: 'rgba(255, 198, 107, 0.30)', color: '#FFC66B', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function MeetCard(props) {
  var row = props.row
  var query = props.query
  var icon = TYPE_ICON[normalizeType(row.type)] || 'menu_book'

  return (
    <div
      className="d17-panel p-5 transition-colors"
      style={{ minHeight: 0 }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="shrink-0 w-10 h-10 flex items-center justify-center"
          style={{ background: 'rgba(255, 198, 107, 0.10)', border: '1px solid rgba(255, 198, 107, 0.25)' }}
        >
          <span className="material-symbols-outlined" style={{ color: '#FFC66B', fontSize: 20 }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono uppercase tracking-widest text-[10px]" style={{ color: '#9d8e7c' }}>
              {row.type || 'Other'}
            </span>
            {row.stage && row.stage !== 'Any' && (
              <span
                className="font-mono uppercase tracking-widest text-[10px] px-1.5 py-0.5"
                style={{ background: 'rgba(103, 226, 217, 0.10)', color: '#67e2d9', border: '1px solid rgba(103, 226, 217, 0.25)' }}
              >
                Stage {row.stage}
              </span>
            )}
            {row.stage === 'Any' && (
              <span
                className="font-mono uppercase tracking-widest text-[10px] px-1.5 py-0.5"
                style={{ background: 'rgba(157, 142, 124, 0.08)', color: '#9d8e7c' }}
              >
                Any Stage
              </span>
            )}
          </div>
          <h3 className="font-editorial italic text-lg leading-tight" style={{ color: '#E4E1EC' }}>
            {highlight(row.condition || '', query)}
          </h3>
        </div>
      </div>

      {row.comp && (
        <div className="mb-2 flex items-start gap-2">
          <span className="material-symbols-outlined shrink-0" style={{ color: '#9d8e7c', fontSize: 16, marginTop: 2 }}>groups</span>
          <p className="font-body text-sm" style={{ color: '#E4E1EC' }}>
            {highlight(row.comp, query)}
          </p>
        </div>
      )}

      {row.notes && (
        <div
          className="flex items-start gap-2 mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(157, 142, 124, 0.15)' }}
        >
          <span className="material-symbols-outlined shrink-0" style={{ color: '#9d8e7c', fontSize: 16, marginTop: 2 }}>sticky_note_2</span>
          <p className="font-body text-sm whitespace-pre-line" style={{ color: 'rgba(228, 225, 236, 0.75)' }}>
            {highlight(row.notes, query)}
          </p>
        </div>
      )}
    </div>
  )
}

export default function Meet() {
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
    <div>
      <header className="mb-8">
        <p className="font-mono uppercase tracking-widest text-[11px]" style={{ color: '#9d8e7c' }}>Donut 17 - Decision Sheet</p>
        <h1 className="font-editorial italic text-4xl mt-1 d17-gold-text">Meet</h1>
        <p className="font-body text-sm mt-2" style={{ color: 'rgba(228, 225, 236, 0.70)' }}>
          Conditions, openers, and comp lines pulled from the live prep sheet. Search or filter by category.
        </p>
      </header>

      <div className="d17-panel p-5 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div
            className="flex items-center px-3 py-2 flex-1"
            style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255, 198, 107, 0.20)' }}
          >
            <span className="material-symbols-outlined mr-2" style={{ color: '#FFC66B', fontSize: 16 }}>search</span>
            <input
              type="text"
              className="bg-transparent border-none focus:ring-0 text-xs font-mono uppercase placeholder:text-outline w-full"
              style={{ color: '#E4E1EC' }}
              placeholder="SEARCH CONDITIONS, COMPS, NOTES..."
              value={query}
              onChange={function (e) { setQuery(e.target.value) }}
            />
          </div>
          <div className="font-mono text-[11px] whitespace-nowrap" style={{ color: '#9d8e7c' }}>
            {visibleCount} / {totalCount} ENTRIES
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={function () { setTypeFilter('All') }}
            className="px-3 py-1.5 font-label uppercase tracking-widest text-[11px] transition-colors"
            style={typeFilter === 'All'
              ? { background: '#FFC66B', color: '#13131a', border: '1px solid #FFC66B' }
              : { background: '#0e0d15', color: 'rgba(228,225,236,0.70)', border: '1px solid rgba(157,142,124,0.20)' }}
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
                className="px-3 py-1.5 font-label uppercase tracking-widest text-[11px] transition-colors flex items-center gap-1.5"
                style={active
                  ? { background: '#FFC66B', color: '#13131a', border: '1px solid #FFC66B' }
                  : { background: '#0e0d15', color: 'rgba(228,225,236,0.70)', border: '1px solid rgba(157,142,124,0.20)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{TYPE_ICON[t] || 'menu_book'}</span>
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="d17-panel p-10 text-center">
          <span className="material-symbols-outlined" style={{ color: '#9d8e7c', fontSize: 32 }}>search_off</span>
          <p className="font-editorial italic text-lg mt-3" style={{ color: '#E4E1EC' }}>No matches</p>
          <p className="font-body text-sm mt-1" style={{ color: 'rgba(228,225,236,0.60)' }}>
            Try clearing your search or picking a different category.
          </p>
        </div>
      )}

      {grouped.map(function (group) {
        return (
          <section key={group.type} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined" style={{ color: '#FFC66B', fontSize: 22 }}>{TYPE_ICON[group.type] || 'menu_book'}</span>
              <h2 className="font-editorial italic text-2xl d17-gold-text">{group.type}</h2>
              <span className="font-mono text-xs" style={{ color: '#9d8e7c' }}>{group.rows.length}</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.rows.map(function (r) {
                return <MeetCard key={r.id} row={r} query={query} />
              })}
            </div>
          </section>
        )
      })}

      <p className="font-mono text-[10px] mt-8 text-center" style={{ color: 'rgba(157, 142, 124, 0.60)' }}>
        Source: Donut 17 prep sheet. Snapshot at build time.
      </p>
    </div>
  )
}
