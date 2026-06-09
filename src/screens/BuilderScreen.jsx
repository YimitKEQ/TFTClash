import { useState, useEffect, useRef, useMemo } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'
import { CHAMPIONS, SET } from './builder/setData.js'
import {
  emptyBoard, decodeBoard, encodeBoard, computeTraits, unitCount,
  COST_COLORS, STYLE_COLORS, BOARD_SIZE, MAX_UNITS,
} from './builder/builderUtils.js'

var HEX_CLIP = { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }
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
  var _search = useState('')
  var search = _search[0]
  var setSearch = _search[1]
  var _cost = useState(0)
  var cost = _cost[0]
  var setCost = _cost[1]
  var _copied = useState(false)
  var copied = _copied[0]
  var setCopied = _copied[1]
  var dragRef = useRef(null)

  var traits = useMemo(function () { return computeTraits(board) }, [board])
  var count = unitCount(board)
  var activeTraits = traits.filter(function (t) { return t.active })

  // Keep the URL in sync so the board is shareable and survives refresh.
  useEffect(function () {
    if (typeof window === 'undefined') return
    var code = encodeBoard(board)
    var url = window.location.pathname + (code ? '?b=' + code : '')
    try { window.history.replaceState(null, '', url) } catch (e) {}
  }, [board])

  function setHex(i, val) {
    setBoard(function (b) {
      var n = b.slice()
      n[i] = val
      return n
    })
  }

  function firstEmpty(b) {
    var i = 0
    for (i = 0; i < BOARD_SIZE; i++) { if (!b[i]) return i }
    return -1
  }

  function placeChamp(cidx) {
    setBoard(function (b) {
      if (unitCount(b) >= MAX_UNITS) return b
      var i = firstEmpty(b)
      if (i < 0) return b
      var n = b.slice()
      n[i] = { cidx: cidx, star: 2 }
      return n
    })
  }

  function dropOnHex(i) {
    var d = dragRef.current
    dragRef.current = null
    if (!d) return
    setBoard(function (b) {
      var n = b.slice()
      if (d.type === 'pool') {
        if (!n[i] && unitCount(b) >= MAX_UNITS) return b
        n[i] = { cidx: d.cidx, star: 2 }
      } else if (d.type === 'hex') {
        var moved = n[d.index]
        n[d.index] = n[i] || null
        n[i] = moved
      }
      return n
    })
  }

  function cycleStar(i) {
    setBoard(function (b) {
      if (!b[i]) return b
      var n = b.slice()
      var s = b[i].star >= 3 ? 1 : b[i].star + 1
      n[i] = { cidx: b[i].cidx, star: s }
      return n
    })
  }

  function clearBoard() { setBoard(emptyBoard()) }

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
  board.forEach(function (u) { if (u) placedCounts[u.cidx] = (placedCounts[u.cidx] || 0) + 1 })

  var q = search.trim().toLowerCase()
  var pool = CHAMPIONS.map(function (c, idx) { return { c: c, idx: idx } }).filter(function (o) {
    if (cost && o.c.cost !== cost) return false
    if (!q) return true
    if (o.c.name.toLowerCase().indexOf(q) !== -1) return true
    return o.c.traits.some(function (t) { return t.toLowerCase().indexOf(q) !== -1 })
  })

  // Build 28 grid cells
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
            dragRef={dragRef}
            onDrop={dropOnHex}
            onClick={cycleStar}
            onRemove={function (idx) { setHex(idx, null) }}
          />
        </div>
      )
    }
  }

  return (
    <PageLayout showSidebar={true}>
      <div className="max-w-6xl mx-auto mb-16">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-label text-primary uppercase tracking-[0.2em] text-sm mb-2 block">Set {SET} Tools</span>
            <h1 className="font-display text-4xl md:text-6xl font-bold text-on-surface leading-[0.95]">Team Builder</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500 mr-1">{count}/{MAX_UNITS} units</span>
            <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary px-4 py-2 font-label uppercase tracking-wider text-[11px] font-bold hover:bg-primary/20 transition-colors">
              <Icon name={copied ? 'check' : 'ios_share'} size={15} />{copied ? 'Link copied' : 'Share'}
            </button>
            <button onClick={clearBoard} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 text-slate-400 px-4 py-2 font-label uppercase tracking-wider text-[11px] font-bold hover:text-error hover:border-error/30 transition-colors">
              <Icon name="delete" size={15} />Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Board + traits */}
          <div className="lg:col-span-7">
            {/* Active traits */}
            <div className="mb-4 min-h-[2.5rem] flex flex-wrap gap-2">
              {activeTraits.length === 0 && (
                <span className="font-body text-sm text-slate-600 italic py-1.5">Add champions to see active traits.</span>
              )}
              {activeTraits.map(function (t) {
                var col = STYLE_COLORS[t.style] || '#aab4c2'
                return (
                  <div key={t.name} className="inline-flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1" style={{ borderColor: col + '66', background: col + '1f' }}>
                    <img src={'/builder/traits/' + t.slug + '.png'} alt="" className="w-4 h-4" />
                    <span className="font-mono text-xs font-bold" style={{ color: col }}>{t.count}</span>
                    <span className="font-label uppercase tracking-wider text-[10px] font-bold text-on-surface/80">{t.name}</span>
                  </div>
                )
              })}
            </div>

            {/* Board */}
            <div className="rounded-xl bg-[#0b0b11] border border-white/5 px-3 md:px-5 py-5 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1/2 opacity-[0.05] pointer-events-none" style={{ background: 'radial-gradient(80% 100% at 50% 0%, #e8a838, transparent 70%)' }} />
              <div className="relative">
                <div className="mb-2 font-label text-[10px] uppercase tracking-[0.22em] text-error/50 font-bold">Front</div>
                <div className="grid items-center" style={{ gridTemplateColumns: 'repeat(15, 1fr)', rowGap: '8px' }}>{cells}</div>
                <div className="mt-2 text-right font-label text-[10px] uppercase tracking-[0.22em] text-tertiary/50 font-bold">Back</div>
              </div>
            </div>
            <p className="font-body text-xs text-slate-500 mt-3 leading-relaxed">
              Click a champion to drop it on the board. Drag units to reposition, click a unit to change its
              star level, hover to remove. Your board lives in the URL, so Share copies a link to this exact comp.
            </p>
          </div>

          {/* Champion pool */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[132px]">
              {/* Filters */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1 bg-surface-container-low/60 rounded-full p-1">
                  {COST_TABS.map(function (ct) {
                    var on = cost === ct
                    return (
                      <button key={ct} onClick={function () { setCost(ct) }} className={'w-8 h-7 rounded-full font-mono text-xs font-bold transition-colors ' + (on ? 'bg-primary/20 text-primary' : 'text-slate-500 hover:text-on-surface')}>
                        {ct === 0 ? 'All' : ct}
                      </button>
                    )
                  })}
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"><Icon name="search" size={16} /></span>
                  <input value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="Search name or trait" className="w-full bg-surface-container-lowest border border-white/8 rounded-full text-on-surface text-sm py-2 pl-9 pr-3 outline-none focus:border-primary/40 placeholder:text-slate-600" />
                </div>
              </div>

              {/* Pool grid */}
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[60vh] lg:max-h-[64vh] overflow-y-auto pr-1 -mr-1">
                {pool.map(function (o) {
                  return <ChampTile key={o.c.id} champ={o.c} idx={o.idx} placed={placedCounts[o.idx] || 0} dragRef={dragRef} onClick={placeChamp} />
                })}
                {pool.length === 0 && <div className="col-span-full text-center py-8 text-sm text-slate-600 font-body">No champions match.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
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
    return <div className="aspect-square" onDragOver={onDragOver} onDrop={onDrop} style={Object.assign({}, HEX_CLIP, { background: 'rgba(255,255,255,0.025)' })} />
  }
  var champ = CHAMPIONS[u.cidx]
  var color = COST_COLORS[champ.cost]
  return (
    <div className="relative group" draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <button
        type="button"
        onClick={function () { props.onClick(i) }}
        className="block w-full"
        title={champ.name + ' (click to star up)'}
      >
        <div className="p-[2px]" style={Object.assign({}, HEX_CLIP, { background: color })}>
          <div className="bg-surface-container-low" style={HEX_CLIP}>
            <img src={'/builder/champions/' + champ.icon + '.png'} alt={champ.name} className="w-full aspect-square object-cover pointer-events-none" style={HEX_CLIP} />
          </div>
        </div>
      </button>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20 flex gap-px pointer-events-none">
        {[1, 2, 3].map(function (s) {
          return <span key={s} className="text-[8px] leading-none" style={{ color: s <= u.star ? '#e8a838' : 'rgba(255,255,255,0.18)' }}>{'★'}</span>
        })}
      </div>
      <button
        type="button"
        onClick={function () { props.onRemove(i) }}
        className="absolute -top-1 -right-1 z-30 w-4 h-4 rounded-full bg-error text-white items-center justify-center hidden group-hover:flex"
        title="Remove"
      >
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
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={function () { props.onClick(props.idx) }}
      className="relative group flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-white/5 transition-colors"
      title={c.name + ' (' + c.cost + '-cost)'}
    >
      <div className="relative w-full rounded-md overflow-hidden" style={{ border: '1.5px solid ' + color }}>
        <img src={'/builder/champions/' + c.icon + '.png'} alt={c.name} loading="lazy" className="w-full aspect-square object-cover" />
        {props.placed > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-[9px] font-bold text-on-primary flex items-center justify-center font-mono">{props.placed}</span>
        )}
        <span className="absolute bottom-0.5 left-0.5 font-mono text-[9px] font-bold px-1 rounded" style={{ background: color, color: '#0b0b11' }}>{c.cost}</span>
      </div>
      <span className="font-label text-[9px] uppercase tracking-wide text-slate-400 leading-tight text-center truncate w-full">{c.name}</span>
    </button>
  )
}
