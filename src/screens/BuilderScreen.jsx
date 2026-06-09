import { useState, useEffect, useRef, useMemo } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'
import { CHAMPIONS, SET } from './builder/setData.js'
import {
  emptyBoard, decodeBoard, encodeBoard, computeTraits, unitCount,
  COST_COLORS, STYLE_COLORS, BOARD_SIZE, MAX_UNITS,
} from './builder/builderUtils.js'

var HEX_CLIP = { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }
var BOARD_BG = '#0a0a10'
var ROWS = 4
var COLS = 7
var COST_TABS = [0, 1, 2, 3, 4, 5]

function readCodeFromUrl() {
  if (typeof window === 'undefined') return ''
  try { return new URLSearchParams(window.location.search).get('b') || '' } catch (e) { return '' }
}

export default function BuilderScreen() {
  var _board = useState(function () { return decodeBoard(readCodeFromUrl()) })
  var board = _board[0]
  var setBoard = _board[1]
  var _past = useState([])
  var past = _past[0]
  var setPast = _past[1]
  var _future = useState([])
  var future = _future[0]
  var setFuture = _future[1]
  var _search = useState('')
  var search = _search[0]
  var setSearch = _search[1]
  var _cost = useState(0)
  var cost = _cost[0]
  var setCost = _cost[1]
  var _names = useState(true)
  var showNames = _names[0]
  var setShowNames = _names[1]
  var _copied = useState(false)
  var copied = _copied[0]
  var setCopied = _copied[1]
  var dragRef = useRef(null)
  var searchRef = useRef(null)

  var traits = useMemo(function () { return computeTraits(board) }, [board])
  var count = unitCount(board)

  // Keep the URL in sync so the board is shareable and survives refresh.
  useEffect(function () {
    if (typeof window === 'undefined') return
    var code = encodeBoard(board)
    var url = window.location.pathname + (code ? '?b=' + code : '')
    try { window.history.replaceState(null, '', url) } catch (e) {}
  }, [board])

  // Push a new board onto history (max 60 steps) and clear the redo stack.
  function commit(next) {
    if (next === board) return
    setPast(function (p) { return p.concat([board]).slice(-60) })
    setFuture([])
    setBoard(next)
  }

  function undo() {
    if (!past.length) return
    var prev = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture([board].concat(future))
    setBoard(prev)
  }

  function redo() {
    if (!future.length) return
    var nx = future[0]
    setFuture(future.slice(1))
    setPast(past.concat([board]))
    setBoard(nx)
  }

  // Global shortcuts: Ctrl+F focus search, Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo.
  useEffect(function () {
    function onKey(e) {
      var mod = e.ctrlKey || e.metaKey
      if (!mod) return
      var k = e.key.toLowerCase()
      if (k === 'f') {
        e.preventDefault()
        if (searchRef.current) searchRef.current.focus()
      } else if (k === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return function () { window.removeEventListener('keydown', onKey) }
  })

  function firstEmpty(b) {
    var i = 0
    for (i = 0; i < BOARD_SIZE; i++) { if (!b[i]) return i }
    return -1
  }

  function placeChamp(cidx) {
    if (unitCount(board) >= MAX_UNITS) return
    var i = firstEmpty(board)
    if (i < 0) return
    var n = board.slice()
    n[i] = { cidx: cidx, star: 2 }
    commit(n)
  }

  function removeHex(i) {
    if (!board[i]) return
    var n = board.slice()
    n[i] = null
    commit(n)
  }

  function dropOnHex(i) {
    var d = dragRef.current
    dragRef.current = null
    if (!d) return
    var n = board.slice()
    if (d.type === 'pool') {
      if (!n[i] && unitCount(board) >= MAX_UNITS) return
      n[i] = { cidx: d.cidx, star: 2 }
    } else if (d.type === 'hex') {
      var moved = n[d.index]
      n[d.index] = n[i] || null
      n[i] = moved
    }
    commit(n)
  }

  function cycleStar(i) {
    if (!board[i]) return
    var n = board.slice()
    var s = board[i].star >= 3 ? 1 : board[i].star + 1
    n[i] = { cidx: board[i].cidx, star: s }
    commit(n)
  }

  function clearBoard() {
    if (!count) return
    commit(emptyBoard())
  }

  function share() {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(function () { setCopied(false) }, 1600)
      }
    } catch (e) {}
  }

  var placedCounts = {}
  var totalCost = 0
  var costBuckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  board.forEach(function (u) {
    if (!u) return
    placedCounts[u.cidx] = (placedCounts[u.cidx] || 0) + 1
    var ch = CHAMPIONS[u.cidx]
    if (ch) { totalCost += ch.cost; costBuckets[ch.cost] = (costBuckets[ch.cost] || 0) + 1 }
  })

  var q = search.trim().toLowerCase()
  var pool = CHAMPIONS.map(function (c, idx) { return { c: c, idx: idx } }).filter(function (o) {
    if (cost && o.c.cost !== cost) return false
    if (!q) return true
    if (o.c.name.toLowerCase().indexOf(q) !== -1) return true
    return o.c.traits.some(function (t) { return t.toLowerCase().indexOf(q) !== -1 })
  })

  // Build the 28 staggered hex cells inside a 15-column micro-grid (each hex
  // spans 2 columns; odd rows shift right by one column to interlock).
  var cells = []
  var r = 0
  for (r = 0; r < ROWS; r++) {
    var c2 = 0
    for (c2 = 0; c2 < COLS; c2++) {
      var i = r * COLS + c2
      var startCol = (r % 2 === 0 ? 1 : 2) + c2 * 2
      cells.push(
        <div key={i} style={{ gridColumn: startCol + ' / span 2', gridRow: r + 1 }}>
          <HexCell
            unit={board[i]}
            index={i}
            showName={showNames}
            dragRef={dragRef}
            onDrop={dropOnHex}
            onClick={cycleStar}
            onRemove={removeHex}
          />
        </div>
      )
    }
  }

  return (
    <PageLayout>
      <div className="mb-16">

        {/* Page heading */}
        <div className="mb-5">
          <span className="font-label text-primary uppercase tracking-[0.2em] text-xs mb-1.5 block">Set {SET} Tools</span>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-on-surface leading-[0.95]">Team Builder</h1>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-surface-container-lowest/70 px-2.5 py-2 mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 text-primary px-3 py-1.5 font-display text-sm font-bold tracking-wide">
            <Icon name="grid_view" size={15} />SET {SET}
          </span>

          <div className="h-6 w-px bg-white/10 mx-0.5" />

          <ToolToggle on={showNames} onClick={function () { setShowNames(!showNames) }} icon="badge" label="Names" />

          <div className="h-6 w-px bg-white/10 mx-0.5" />

          <ToolBtn onClick={undo} disabled={!past.length} icon="undo" label="Undo" />
          <ToolBtn onClick={redo} disabled={!future.length} icon="redo" label="Redo" />
          <ToolBtn onClick={clearBoard} disabled={!count} icon="delete_sweep" label="Clear" danger />

          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500 hidden sm:block">{count}/{MAX_UNITS}</span>
            <button onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary px-3.5 py-1.5 font-label uppercase tracking-wider text-[11px] font-bold hover:bg-primary/20 transition-colors">
              <Icon name={copied ? 'check' : 'link'} size={15} />{copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        {/* Board + side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* Synergies */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <SynergyPanel traits={traits} units={count} totalCost={totalCost} />
          </div>

          {/* Board */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <div className="rounded-xl border border-white/8 px-4 md:px-8 py-7 relative overflow-hidden" style={{ background: BOARD_BG }}>
              <div className="absolute inset-x-0 top-0 h-1/2 opacity-[0.06] pointer-events-none" style={{ background: 'radial-gradient(80% 100% at 50% 0%, #e8a838, transparent 70%)' }} />
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-label text-[9px] uppercase tracking-[0.3em] text-white/15 font-bold rotate-180 pointer-events-none" style={{ writingMode: 'vertical-rl' }}>TFT Clash</span>
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 font-label text-[9px] uppercase tracking-[0.3em] text-white/15 font-bold pointer-events-none" style={{ writingMode: 'vertical-rl' }}>TFT Clash</span>
              <div className="relative">
                <div className="mb-2 font-label text-[10px] uppercase tracking-[0.22em] text-error/50 font-bold">Front</div>
                <div className="grid items-center" style={{ gridTemplateColumns: 'repeat(15, 1fr)', rowGap: '6px' }}>{cells}</div>
                <div className="mt-2 text-right font-label text-[10px] uppercase tracking-[0.22em] text-tertiary/50 font-bold">Back</div>
              </div>
            </div>
            <p className="font-body text-xs text-slate-500 mt-2.5 leading-relaxed">
              Click a unit in the tray to drop it on the board. Drag placed units to reposition, click one to change its
              star level, hover to remove. The board lives in the URL, so Share copies a link to this exact comp.
            </p>
          </div>

          {/* Cost curve */}
          <div className="lg:col-span-3 order-3">
            <CostCurvePanel buckets={costBuckets} totalCost={totalCost} units={count} />
          </div>
        </div>

        {/* Unit tray */}
        <div className="mt-4 rounded-xl border border-white/8 bg-surface-container-lowest/70 p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><Icon name="search" size={16} /></span>
              <input ref={searchRef} value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="Search name or trait" className="w-full bg-surface-container-lowest border border-white/8 rounded-lg text-on-surface text-sm py-2 pl-9 pr-16 outline-none focus:border-primary/40 placeholder:text-slate-600" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-600 border border-white/10 rounded px-1.5 py-0.5 hidden sm:block">Ctrl F</span>
            </div>
            <div className="flex gap-1 bg-surface-container-low/60 rounded-lg p-1">
              {COST_TABS.map(function (ct) {
                var on = cost === ct
                var col = ct === 0 ? null : COST_COLORS[ct]
                return (
                  <button key={ct} onClick={function () { setCost(ct) }} className={'min-w-[34px] h-7 px-1 rounded-md font-mono text-xs font-bold transition-colors ' + (on ? 'bg-primary/20 text-primary' : 'text-slate-500 hover:text-on-surface')} style={on && col ? { color: col, background: col + '22' } : undefined}>
                    {ct === 0 ? 'All' : ct}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-1.5">
            {pool.map(function (o) {
              return <ChampTile key={o.c.id} champ={o.c} idx={o.idx} placed={placedCounts[o.idx] || 0} dragRef={dragRef} onClick={placeChamp} />
            })}
            {pool.length === 0 && <div className="col-span-full text-center py-8 text-sm text-slate-600 font-body">No champions match.</div>}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

function ToolBtn(props) {
  var base = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-label uppercase tracking-wider text-[11px] font-bold transition-colors '
  var tone = props.disabled
    ? 'text-slate-700 cursor-not-allowed'
    : props.danger
      ? 'text-slate-400 hover:text-error hover:bg-error/10'
      : 'text-slate-300 hover:text-on-surface hover:bg-white/5'
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled} className={base + tone}>
      <Icon name={props.icon} size={15} /><span className="hidden md:inline">{props.label}</span>
    </button>
  )
}

function ToolToggle(props) {
  var on = props.on
  return (
    <button type="button" onClick={props.onClick} className={'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-label uppercase tracking-wider text-[11px] font-bold transition-colors ' + (on ? 'bg-primary/15 text-primary' : 'text-slate-400 hover:text-on-surface hover:bg-white/5')}>
      <Icon name={on ? 'toggle_on' : 'toggle_off'} size={17} /><span className="hidden md:inline">{props.label}</span>
    </button>
  )
}

function SynergyPanel(props) {
  var traits = props.traits
  var active = traits.filter(function (t) { return t.active })
  var near = traits.filter(function (t) { return !t.active })
  return (
    <div className="rounded-xl border border-white/8 bg-surface-container-lowest/70 p-3 h-full">
      <div className="font-label text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-3 px-0.5">Synergies</div>
      {traits.length === 0 && (
        <p className="font-body text-xs text-slate-600 italic px-0.5 py-2">Place units to see active traits.</p>
      )}
      <div className="space-y-1.5">
        {active.map(function (t) { return <SynergyRow key={t.name} t={t} /> })}
        {active.length > 0 && near.length > 0 && <div className="h-px bg-white/5 my-2" />}
        {near.map(function (t) { return <SynergyRow key={t.name} t={t} /> })}
      </div>
    </div>
  )
}

function SynergyRow(props) {
  var t = props.t
  var col = STYLE_COLORS[t.style] || '#7c8aa0'
  var dim = t.active ? '' : ' opacity-55'
  return (
    <div className={'flex items-center gap-2 rounded-lg px-2 py-1.5' + dim} style={t.active ? { background: col + '12' } : undefined}>
      <span className="flex items-center justify-center w-6 h-6 flex-shrink-0" style={Object.assign({}, HEX_CLIP, { background: t.active ? col + '33' : 'rgba(255,255,255,0.05)' })}>
        <img src={'/builder/traits/' + t.slug + '.png'} alt="" className="w-4 h-4 object-contain" />
      </span>
      <span className="font-label uppercase tracking-wider text-[11px] font-bold text-on-surface/90 truncate flex-1">{t.name}</span>
      <span className="font-mono text-[11px] font-bold flex-shrink-0" style={{ color: t.active ? col : '#7c8aa0' }}>
        {t.count}{t.nextMin ? '/' + t.nextMin : ''}
      </span>
    </div>
  )
}

function CostCurvePanel(props) {
  var buckets = props.buckets
  var max = 1
  var c = 0
  for (c = 1; c <= 5; c++) { if (buckets[c] > max) max = buckets[c] }
  var rows = []
  for (c = 1; c <= 5; c++) {
    var n = buckets[c] || 0
    var col = COST_COLORS[c]
    var pct = Math.round((n / max) * 100)
    rows.push(
      <div key={c} className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold w-7 flex-shrink-0 text-right" style={{ color: col }}>{c}<span className="text-slate-600">★</span></span>
        <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
          <div className="h-full rounded transition-all" style={{ width: (n ? Math.max(pct, 8) : 0) + '%', background: col }} />
        </div>
        <span className="font-mono text-[11px] font-bold w-4 text-right text-slate-400">{n}</span>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/8 bg-surface-container-lowest/70 p-3 h-full flex flex-col">
      <div className="font-label text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-3 px-0.5">Cost Curve</div>
      <div className="space-y-2">{rows}</div>
      <div className="mt-auto pt-3 flex items-center justify-between border-t border-white/5 mt-3">
        <span className="font-label text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total cost</span>
        <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-primary">
          <Icon name="paid" size={14} />{props.totalCost}
        </span>
      </div>
    </div>
  )
}

function HexCell(props) {
  var u = props.unit
  var i = props.index
  function onDragStart(e) {
    if (!u) { e.preventDefault(); return }
    props.dragRef.current = { type: 'hex', index: i }
    try { e.dataTransfer.effectAllowed = 'move' } catch (err) {}
  }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e) { e.preventDefault(); props.onDrop(i) }

  if (!u) {
    return (
      <div className="aspect-square" onDragOver={onDragOver} onDrop={onDrop} style={Object.assign({}, HEX_CLIP, { background: 'rgba(124,138,160,0.16)' })}>
        <div className="w-full h-full" style={Object.assign({}, HEX_CLIP, { background: BOARD_BG, transform: 'scale(0.92)' })} />
      </div>
    )
  }
  var champ = CHAMPIONS[u.cidx]
  var color = COST_COLORS[champ.cost]
  return (
    <div className="relative group" draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <button type="button" onClick={function () { props.onClick(i) }} className="block w-full" title={champ.name + ' (click to star up)'}>
        <div style={Object.assign({}, HEX_CLIP, { background: color })}>
          <div className="w-full h-full" style={Object.assign({}, HEX_CLIP, { background: BOARD_BG, transform: 'scale(0.9)' })}>
            <img src={'/builder/champions/' + champ.icon + '.png'} alt={champ.name} className="w-full aspect-square object-cover pointer-events-none" style={HEX_CLIP} />
          </div>
        </div>
      </button>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 flex gap-px pointer-events-none">
        {[1, 2, 3].map(function (s) {
          return <span key={s} className="text-[9px] leading-none" style={{ color: s <= u.star ? '#e8a838' : 'rgba(255,255,255,0.16)', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>{'★'}</span>
        })}
      </div>
      {props.showName && (
        <div className="absolute -bottom-0.5 inset-x-0 z-20 text-center pointer-events-none">
          <span className="font-label text-[8px] uppercase tracking-wide font-bold text-white px-1 leading-none inline-block max-w-full truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,1)' }}>{champ.name}</span>
        </div>
      )}
      <button type="button" onClick={function () { props.onRemove(i) }} className="absolute -top-1 -right-1 z-30 w-4 h-4 rounded-full bg-error text-white items-center justify-center hidden group-hover:flex" title="Remove">
        <Icon name="close" size={11} />
      </button>
    </div>
  )
}

function ChampTile(props) {
  var c = props.champ
  var color = COST_COLORS[c.cost]
  function onDragStart(e) {
    props.dragRef.current = { type: 'pool', cidx: props.idx }
    try { e.dataTransfer.effectAllowed = 'copy' } catch (err) {}
  }
  return (
    <button type="button" draggable onDragStart={onDragStart} onClick={function () { props.onClick(props.idx) }} className="relative group rounded-md overflow-hidden transition-transform hover:-translate-y-0.5" title={c.name + ' (' + c.cost + '-cost)'} style={{ border: '1.5px solid ' + color }}>
      <img src={'/builder/champions/' + c.icon + '.png'} alt={c.name} loading="lazy" className="w-full aspect-square object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-3 pb-0.5 px-1">
        <span className="font-label text-[8px] uppercase tracking-wide text-white/90 leading-tight block truncate text-center">{c.name}</span>
      </div>
      <span className="absolute top-0.5 left-0.5 font-mono text-[9px] font-bold px-1 rounded" style={{ background: color, color: '#0a0a10' }}>{c.cost}</span>
      {props.placed > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-primary text-[9px] font-bold text-on-primary flex items-center justify-center font-mono">{props.placed}</span>
      )}
    </button>
  )
}
