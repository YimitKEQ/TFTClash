import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui'
import { supabase } from '../../lib/supabase.js'
import { getPinnedIds, unpinId, PINNED_EVENT } from '../../lib/pinnedTournaments.js'

var PHASE_LABEL = {
  draft:        'Draft',
  registration: 'Open',
  check_in:     'Check-In',
  in_progress:  'Live',
  live:         'Live',
  complete:     'Done',
}

var PHASE_TONE = {
  draft:        'text-on-surface-variant/40',
  registration: 'text-secondary',
  check_in:     'text-primary',
  in_progress:  'text-tertiary',
  live:         'text-tertiary',
  complete:     'text-on-surface-variant/50',
}

export default function PinnedTournamentsBar(props) {
  var compact = props.compact !== false
  var navigate = useNavigate()

  var _ids = useState(getPinnedIds())
  var ids = _ids[0]
  var setIds = _ids[1]

  var _items = useState([])
  var items = _items[0]
  var setItems = _items[1]

  useEffect(function () {
    function onChange() { setIds(getPinnedIds()) }
    if (typeof window !== 'undefined') {
      window.addEventListener(PINNED_EVENT, onChange)
      window.addEventListener('storage', onChange)
    }
    return function () {
      if (typeof window !== 'undefined') {
        window.removeEventListener(PINNED_EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    }
  }, [])

  useEffect(function () {
    if (ids.length === 0) {
      setItems([])
      return
    }
    if (!supabase || !supabase.from) return
    var cancelled = false
    supabase.from('tournaments').select('id,name,phase,date,region,host,status').in('id', ids)
      .then(function (res) {
        if (cancelled) return
        if (res && !res.error && res.data) {
          var byId = {}
          res.data.forEach(function (t) { byId[t.id] = t })
          var ordered = ids.map(function (id) { return byId[id] }).filter(function (t) { return !!t })
          setItems(ordered)
          var missing = ids.filter(function (id) { return !byId[id] })
          missing.forEach(function (id) { unpinId(id) })
        }
      })
      .catch(function () {})
    return function () { cancelled = true }
  }, [ids])

  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon name="push_pin" size={14} className="text-primary" />
          <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant/60">
            Pinned ({items.length})
          </span>
        </div>
      </div>
      <div className={compact ? 'flex gap-2 overflow-x-auto pb-1' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
        {items.map(function (t) {
          var phaseLabel = PHASE_LABEL[t.phase] || t.phase
          var phaseTone = PHASE_TONE[t.phase] || 'text-on-surface-variant'
          return (
            <div
              key={t.id}
              className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/15 bg-surface-container-low/60 hover:border-primary/30 transition-colors flex-shrink-0 min-w-[200px]"
            >
              <button
                type="button"
                onClick={function () { navigate('/tournament/' + t.id) }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="font-display text-xs tracking-wide truncate text-on-surface">
                  {t.name || 'Untitled'}
                </div>
                <div className="flex items-center gap-2 text-[9px] font-label tracking-widest uppercase mt-0.5">
                  <span className={phaseTone + ' font-bold'}>{phaseLabel}</span>
                  {t.region && (
                    <span className="text-on-surface-variant/40">{t.region}</span>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={function () { unpinId(t.id) }}
                className="opacity-40 hover:opacity-100 hover:text-error flex-shrink-0"
                title="Unpin"
                aria-label={'Unpin ' + (t.name || 'tournament')}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
