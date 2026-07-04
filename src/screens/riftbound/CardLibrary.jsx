import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Sel } from '../../components/ui'
import { loadCards, setName, domainColor, cardDims, TYPE_ICONS } from '../../lib/riftbound/cards.js'
import { CardThumb, CardModal, DomainIcon } from './CardBits.jsx'

var DOMAIN_FILTERS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order', 'Colorless']
var TYPE_FILTERS = ['Unit', 'Spell', 'Gear', 'Legend', 'Battlefield', 'Rune']
var SET_FILTERS = ['OGN', 'OGS', 'SFD', 'UNL']
var RARITY_FILTERS = ['Common', 'Uncommon', 'Rare', 'Epic']
var PAGE_SIZE = 90

var SORTS = {
  name:   { label: 'Name',   fn: function(a, b) { return a.n.localeCompare(b.n) } },
  energy: { label: 'Energy', fn: function(a, b) { return (a.e == null ? 99 : a.e) - (b.e == null ? 99 : b.e) || a.n.localeCompare(b.n) } },
  might:  { label: 'Might',  fn: function(a, b) { return (b.m == null ? -1 : b.m) - (a.m == null ? -1 : a.m) || a.n.localeCompare(b.n) } },
  set:    { label: 'Set',    fn: function(a, b) { return a.s.localeCompare(b.s) || a.n.localeCompare(b.n) } },
  rarity: { label: 'Rarity', fn: function(a, b) {
    var order = { Epic: 0, Rare: 1, Uncommon: 2, Common: 3 }
    var ra = order[a.r] == null ? 4 : order[a.r]
    var rb = order[b.r] == null ? 4 : order[b.r]
    return ra - rb || a.n.localeCompare(b.n)
  } },
}

function FilterPill(props) {
  var active = props.active
  var onClick = props.onClick
  var color = props.color
  var label = props.label
  var domain = props.domain
  var typeIcon = props.typeIcon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-label text-[10px] uppercase tracking-widest transition-colors cursor-pointer flex-shrink-0 ' + (active ? 'text-on-surface' : 'text-on-surface/45 border-outline-variant/20 hover:text-on-surface/80')}
      style={active ? { background: (color || '#E8A838') + '22', borderColor: (color || '#E8A838') + '66' } : {}}
    >
      {domain
        ? <DomainIcon name={domain} size={13} />
        : typeIcon
          ? <img src={typeIcon} alt="" width={12} height={12} loading="lazy" className={'inline-block ' + (active ? 'opacity-100' : 'opacity-60')} aria-hidden="true" />
          : color ? <span className="w-2 h-2 rounded-full" style={{ background: color }} /> : null}
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
  var _rarity = useState('')
  var rarity = _rarity[0]
  var setRarity = _rarity[1]
  var _sort = useState('name')
  var sort = _sort[0]
  var setSort = _sort[1]
  var _limit = useState(PAGE_SIZE)
  var limit = _limit[0]
  var setLimit = _limit[1]
  var _open = useState(null)
  var open = _open[0]
  var setOpen = _open[1]
  var sentinelRef = useRef(null)
  var searchRef = useRef(null)

  useEffect(function() {
    var alive = true
    loadCards().then(function(data) { if (alive) setCards(data) })
    // A set link from the Sets tab pre-applies that set's filter here.
    try {
      var preset = sessionStorage.getItem('rb-lib-set')
      if (preset) { sessionStorage.removeItem('rb-lib-set'); setSet(preset) }
    } catch (e) {}
    return function() { alive = false }
  }, [])

  // Press "/" anywhere in the section to jump to search.
  useEffect(function() {
    function onKey(e) {
      if (e.key !== '/') return
      var tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (searchRef.current) searchRef.current.focus()
    }
    window.addEventListener('keydown', onKey)
    return function() { window.removeEventListener('keydown', onKey) }
  }, [])

  var hasFilters = q.trim() !== '' || dom.length > 0 || type !== '' || set !== '' || rarity !== ''
  function resetFilters() {
    setQ(''); setDom([]); setType(''); setSet(''); setRarity(''); setLimit(PAGE_SIZE)
  }

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
    var out = cards.filter(function(c) {
      if (type && c.t !== type) return false
      if (set && c.s !== set) return false
      if (rarity && c.r !== rarity) return false
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
    var sorter = SORTS[sort] || SORTS.name
    return out.slice().sort(sorter.fn)
  }, [cards, q, dom, type, set, rarity, sort])

  // Infinite scroll: grow the rendered window whenever the sentinel comes
  // into view, until every matching card is on the page. The observer is
  // re-armed whenever the result set or the window changes, because
  // IntersectionObserver only fires on transitions: after a filter change
  // while scrolled deep, the sentinel can already be intersecting and would
  // otherwise never fire again (stalling the list). observe() always
  // delivers an initial callback, so re-arming re-checks the current state.
  var filteredLenRef = useRef(0)
  filteredLenRef.current = filtered.length
  useEffect(function() {
    var el = sentinelRef.current
    if (!el) return
    var io = new IntersectionObserver(function(entries) {
      if (entries[0] && entries[0].isIntersecting) {
        setLimit(function(prev) {
          return prev >= filteredLenRef.current ? prev : prev + PAGE_SIZE
        })
      }
    }, { rootMargin: '900px' })
    io.observe(el)
    return function() { io.disconnect() }
  }, [cards, filtered, limit])

  var visible = filtered.slice(0, limit)
  var allShown = limit >= filtered.length

  return (
    <div className="space-y-4">
      {/* Filter bar: pinned under the navbar on desktop while the 770-card
          grid scrolls; on phones it scrolls away normally (search + three
          pill rows would otherwise eat half the viewport). */}
      <div className="sm:sticky sm:top-20 z-30 bg-surface/92 backdrop-blur-md -mx-4 px-4 py-3 space-y-2.5 border-b border-outline-variant/10">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              ref={searchRef}
              value={q}
              onChange={function(e) { setQ(e.target.value); setLimit(PAGE_SIZE) }}
              placeholder="Search cards... (press / to focus)"
              aria-label="Search cards"
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-on-surface text-sm py-3 pl-12 pr-4 placeholder:text-on-surface-variant/35 focus:outline-none focus:border-primary/50"
            />
          </div>
          <Sel value={sort} onChange={function(v) { setSort(v) }}>
            {Object.keys(SORTS).map(function(k) {
              return <option key={k} value={k}>{'Sort: ' + SORTS[k].label}</option>
            })}
          </Sel>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {DOMAIN_FILTERS.map(function(d) {
            return <FilterPill key={d} label={d} domain={d} color={domainColor(d)} active={dom.indexOf(d) !== -1} onClick={function() { toggleDom(d) }} />
          })}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {TYPE_FILTERS.map(function(t) {
            return <FilterPill key={t} label={t} typeIcon={TYPE_ICONS[t]} active={type === t} onClick={function() { setType(type === t ? '' : t); setLimit(PAGE_SIZE) }} />
          })}
          <span className="w-px h-5 bg-outline-variant/20 mx-1 self-center" aria-hidden="true" />
          {RARITY_FILTERS.map(function(r) {
            return <FilterPill key={r} label={r} active={rarity === r} onClick={function() { setRarity(rarity === r ? '' : r); setLimit(PAGE_SIZE) }} />
          })}
          <span className="w-px h-5 bg-outline-variant/20 mx-1 self-center" aria-hidden="true" />
          {SET_FILTERS.map(function(s) {
            return <FilterPill key={s} label={setName(s)} active={set === s} onClick={function() { setSet(set === s ? '' : s); setLimit(PAGE_SIZE) }} />
          })}
          {cards && (
            <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-on-surface-variant/50 flex-shrink-0" role="status">
              {filtered.length + ' / ' + cards.length}
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-primary hover:underline cursor-pointer font-label uppercase text-[10px] tracking-widest"
                >
                  Reset
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {!cards ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {[0,1,2,3,4,5,6,7,8,9,10,11].map(function(k) {
            return <div key={k} className="rounded-lg bg-surface-container/60 animate-pulse" style={{ aspectRatio: '744 / 1039' }} />
          })}
        </div>
      ) : (
        <div>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="search_off" size={28} className="text-on-surface-variant/35 block mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant/60 mb-3">No cards match those filters.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-5 py-2 bg-primary/10 border border-primary/30 text-primary font-label font-bold text-xs uppercase tracking-widest rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3" style={{ gridAutoFlow: 'dense' }}>
              {visible.map(function(c) {
                var dims = cardDims(c)
                return (
                  <div key={c.id} className={dims.landscape ? 'col-span-2 self-center' : ''}>
                    <CardThumb card={c} onOpen={setOpen} width={dims.landscape ? 440 : 220} />
                  </div>
                )
              })}
            </div>
          )}
          {/* Infinite-scroll sentinel */}
          <div ref={sentinelRef} aria-hidden="true" />
          {!allShown && filtered.length > 0 && (
            <div className="text-center mt-5 text-xs text-on-surface-variant/40" role="status">
              {'Loading more... (' + visible.length + ' of ' + filtered.length + ')'}
            </div>
          )}
        </div>
      )}

      <CardModal card={open} onClose={function() { setOpen(null) }} />
    </div>
  )
}
