import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/ui'
import { loadCards, setName, domainColor } from '../../lib/riftbound/cards.js'
import { CardThumb, CardModal } from './CardBits.jsx'

var DOMAIN_FILTERS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order', 'Colorless']
var TYPE_FILTERS = ['Unit', 'Spell', 'Gear', 'Legend', 'Battlefield', 'Rune']
var SET_FILTERS = ['OGN', 'OGS', 'SFD', 'UNL']
var PAGE_SIZE = 60

function FilterPill(props) {
  var active = props.active
  var onClick = props.onClick
  var color = props.color
  var label = props.label
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-label text-[10px] uppercase tracking-widest transition-colors cursor-pointer flex-shrink-0 ' + (active ? 'text-on-surface' : 'text-on-surface/45 border-outline-variant/20 hover:text-on-surface/80')}
      style={active ? { background: (color || '#E8A838') + '22', borderColor: (color || '#E8A838') + '66' } : {}}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  )
}

export default function CardLibrary() {
  var _cards = useState(null)
  var cards = _cards[0]
  var setCards = _cards[1]
  var _q = useState('')
  var q = _q[0]
  var setQ = _q[1]
  var _dom = useState([])
  var dom = _dom[0]
  var setDom = _dom[1]
  var _type = useState('')
  var type = _type[0]
  var setType = _type[1]
  var _set = useState('')
  var set = _set[0]
  var setSet = _set[1]
  var _limit = useState(PAGE_SIZE)
  var limit = _limit[0]
  var setLimit = _limit[1]
  var _open = useState(null)
  var open = _open[0]
  var setOpen = _open[1]

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    return function() { alive = false }
  }, [])

  function toggleDom(d) {
    setDom(function(prev) {
      return prev.indexOf(d) !== -1
        ? prev.filter(function(x) { return x !== d })
        : prev.concat([d])
    })
    setLimit(PAGE_SIZE)
  }

  var filtered = useMemo(function() {
    if (!cards) return []
    var query = q.trim().toLowerCase()
    return cards.filter(function(c) {
      if (type && c.t !== type) return false
      if (set && c.s !== set) return false
      if (dom.length > 0) {
        var cd = c.d && c.d.length ? c.d : ['Colorless']
        var hit = dom.some(function(d) { return cd.indexOf(d) !== -1 })
        if (!hit) return false
      }
      if (query) {
        var hay = (c.n + ' ' + (c.x || '') + ' ' + (c.g || []).join(' ')).toLowerCase()
        if (hay.indexOf(query) === -1) return false
      }
      return true
    })
  }, [cards, q, dom, type, set])

  var visible = filtered.slice(0, limit)

  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">
          <Icon name="search" size={18} />
        </span>
        <input
          type="text"
          value={q}
          onChange={function(e) { setQ(e.target.value); setLimit(PAGE_SIZE) }}
          placeholder="Search cards by name, rules text, or tag..."
          aria-label="Search cards"
          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface text-sm py-3 pl-12 pr-4 placeholder:text-on-surface-variant/35 focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DOMAIN_FILTERS.map(function(d) {
          return <FilterPill key={d} label={d} color={domainColor(d)} active={dom.indexOf(d) !== -1} onClick={function() { toggleDom(d) }} />
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map(function(t) {
          return <FilterPill key={t} label={t} active={type === t} onClick={function() { setType(type === t ? '' : t); setLimit(PAGE_SIZE) }} />
        })}
        <span className="w-px h-5 bg-outline-variant/20 mx-1 self-center" aria-hidden="true" />
        {SET_FILTERS.map(function(s) {
          return <FilterPill key={s} label={setName(s)} active={set === s} onClick={function() { setSet(set === s ? '' : s); setLimit(PAGE_SIZE) }} />
        })}
      </div>

      {!cards ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {[0,1,2,3,4,5,6,7,8,9,10,11].map(function(k) {
            return <div key={k} className="rounded-lg bg-surface-container/60 animate-pulse" style={{ aspectRatio: '744 / 1039' }} />
          })}
        </div>
      ) : (
        <div>
          <div className="text-xs text-on-surface-variant/50 mb-3" role="status">
            {filtered.length + ' card' + (filtered.length === 1 ? '' : 's')}
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="search_off" size={28} className="text-on-surface-variant/35 block mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant/60">No cards match those filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {visible.map(function(c) {
                return <CardThumb key={c.id} card={c} onOpen={setOpen} width={220} />
              })}
            </div>
          )}
          {filtered.length > limit && (
            <div className="text-center mt-5">
              <button
                type="button"
                onClick={function() { setLimit(limit + PAGE_SIZE) }}
                className="px-6 py-2.5 bg-surface-container-high text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                {'Show more (' + (filtered.length - limit) + ' left)'}
              </button>
            </div>
          )}
        </div>
      )}

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
