import { useState } from 'react'
import { Icon } from '../../components/ui'
import { COMP, COST_COLORS } from './guideData.js'

// Renders the example comp the way a builder tool does: units on a true offset
// hex board, active traits up top, items under the carry, hover for detail.
// The board uses a 15-track grid so alternating rows interlock and stay aligned.

var HEX_CLIP = { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }
var ROWS = 4
var COLS = 7

function unitAt(row, col) {
  return COMP.units.find(function (u) { return u.row === row && u.col === col }) || null
}

function buildShareText() {
  var back = COMP.units.filter(function (u) { return u.row >= 2 }).map(function (u) { return u.name })
  var front = COMP.units.filter(function (u) { return u.row < 2 }).map(function (u) { return u.name })
  return COMP.name + ' (Lvl ' + COMP.level + ') | Back: ' + back.join(', ') + ' | Front: ' + front.join(', ')
}

export default function CompShowcase() {
  var carry = COMP.units.find(function (u) { return u.role === 'Main Carry' })
  var _hover = useState(null)
  var hovered = _hover[0]
  var setHovered = _hover[1]
  var _copied = useState(false)
  var copied = _copied[0]
  var setCopied = _copied[1]

  var active = hovered || carry

  function copyBoard() {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(buildShareText())
        setCopied(true)
        setTimeout(function () { setCopied(false) }, 1600)
      }
    } catch (e) {}
  }

  // Flat list of 28 grid-placed cells.
  var cells = []
  var r = 0
  for (r = 0; r < ROWS; r++) {
    var c = 0
    for (c = 0; c < COLS; c++) {
      var u = unitAt(r, c)
      var startCol = (r % 2 === 0 ? 1 : 2) + c * 2
      cells.push(
        <div key={r + '-' + c} style={{ gridColumn: startCol + ' / span 2', gridRow: r + 1 }}>
          <Hex
            unit={u}
            isActive={u && active && u.file === active.file}
            onEnter={function () { if (u) setHovered(u) }}
          />
        </div>
      )
    }
  }

  return (
    <div onMouseLeave={function () { setHovered(null) }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-display text-2xl font-bold text-on-surface">{COMP.name}</h3>
          <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 border border-primary/25 rounded px-1.5 py-0.5">LVL {COMP.level}</span>
        </div>
        <button onClick={copyBoard} className="inline-flex items-center gap-1.5 font-label uppercase tracking-wider text-[11px] font-bold text-slate-400 hover:text-primary transition-colors">
          <Icon name={copied ? 'check' : 'content_copy'} size={15} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Trait bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {COMP.traits.map(function (t) {
          var cls = t.hot ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-white/[0.05] border-white/10 text-slate-300'
          return (
            <div key={t.name} className={'inline-flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1 ' + cls}>
              <img src={'/guide/traits/' + t.file + '.png'} alt="" className="w-4 h-4 opacity-90" />
              <span className="font-mono text-xs font-bold">{t.count}</span>
              <span className="font-label uppercase tracking-wider text-[10px] font-bold">{t.name}</span>
            </div>
          )
        })}
      </div>

      {/* Board */}
      <div className="rounded-xl bg-[#0b0b11] border border-white/5 px-3 md:px-5 py-4 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1/2 opacity-[0.05] pointer-events-none" style={{ background: 'radial-gradient(80% 100% at 50% 0%, #e8a838, transparent 70%)' }} />
        <div className="relative">
          <div className="mb-2 font-label text-[10px] uppercase tracking-[0.22em] text-error/50 font-bold">Front</div>
          <div className="grid items-center" style={{ gridTemplateColumns: 'repeat(15, 1fr)', rowGap: '8px' }}>
            {cells}
          </div>
          <div className="mt-2 text-right font-label text-[10px] uppercase tracking-[0.22em] text-tertiary/50 font-bold">Back</div>
        </div>
      </div>

      {/* Hover detail */}
      <div className="mt-4 flex items-center flex-wrap gap-x-3 gap-y-1 min-h-[40px]">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COST_COLORS[active.cost] }} />
        <span className="font-display text-lg font-bold text-on-surface">{active.name}</span>
        <span className="font-mono text-xs text-amber-400">{'★'.repeat(active.star)}</span>
        <span className="font-mono text-xs text-slate-500">{active.cost}-cost</span>
        <span className="font-label uppercase tracking-wider text-[10px] font-bold text-secondary">{active.role}</span>
        <span className="font-body text-xs text-slate-500 hidden sm:inline">{active.traits.join(' / ')}</span>
      </div>
    </div>
  )
}

function Hex(props) {
  var u = props.unit
  if (!u) {
    return <div className="aspect-square" style={Object.assign({}, HEX_CLIP, { background: 'rgba(255,255,255,0.02)' })} />
  }
  var color = COST_COLORS[u.cost]
  return (
    <div className="relative" onMouseEnter={props.onEnter}>
      {u.label && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-20 font-label uppercase tracking-wider text-[7px] md:text-[8px] font-bold px-1.5 py-px rounded-full whitespace-nowrap" style={{ background: color, color: '#0b0b11' }}>
          {u.label}
        </span>
      )}
      <div className="p-[2px] transition-transform duration-200" style={Object.assign({}, HEX_CLIP, { background: color, transform: props.isActive ? 'scale(1.09)' : 'scale(1)', filter: props.isActive ? 'drop-shadow(0 0 7px ' + color + 'cc)' : 'none' })}>
        <div className="bg-surface-container-low" style={HEX_CLIP}>
          <img src={'/guide/champions/' + u.file + '.png'} alt={u.name} loading="lazy" className="w-full aspect-square object-cover" style={HEX_CLIP} />
        </div>
      </div>
      {u.items && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex gap-0.5">
          {u.items.map(function (it) {
            return <img key={it} src={'/guide/items/' + it + '.png'} alt="" className="w-3 h-3 md:w-4 md:h-4 rounded-sm ring-1 ring-black/60" />
          })}
        </div>
      )}
    </div>
  )
}
