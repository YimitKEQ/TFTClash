import ChampImg from './ChampImg'
import { costColor } from './imgFallback'
import { BOARD_ROWS, BOARD_COLS, ROW_LABELS } from './positioning'

// HexBoard renders a 4x7 honeycomb board.
//
// Props:
//   placed       -- [{ key, row, col, isCarry }] from positionBoard
//   champByKey   -- lookup map for champion records
//   itemsByKey   -- optional { [championKey]: [{ apiName, name, icon }] }
//                   each champion can have up to 3 items rendered as a strip
//                   below the hex (tftacademy style)
//   size         -- hex tile width in px (default 64)
//   showLabels   -- show 'Frontline / Backline' labels along the left edge
//   onHexClick   -- optional (row, col, currentUnitKey) -> void; makes hexes clickable
//   highlightKey -- champion key to glow extra-bright

var HEX_RING = 'rgba(80, 69, 53, 0.45)'
// Pointy-top regular hex aspect ratio: height = width * 2/sqrt(3) ~= 1.1547
var HEX_RATIO = 1.1547

export default function HexBoard(props) {
  var placed = props.placed || []
  var champByKey = props.champByKey || {}
  var itemsByKey = props.itemsByKey || {}
  var size = props.size || 64
  var hexHeight = size * HEX_RATIO
  var showLabels = props.showLabels !== false
  var onHexClick = props.onHexClick
  var highlightKey = props.highlightKey

  // Honeycomb spacing: vertical step = 3/4 hex height.
  var rowGap = hexHeight * 0.75
  var colGap = size
  var oddOffset = size / 2

  var grid = {}
  placed.forEach(function (p) { grid[p.row + '_' + p.col] = p })

  var width = BOARD_COLS * colGap + oddOffset
  // Add room for the items strip under the bottom row.
  var itemsStripH = 22
  var height = (BOARD_ROWS - 1) * rowGap + hexHeight + itemsStripH

  var rows = []
  for (var r = 0; r < BOARD_ROWS; r++) rows.push(r)
  var cols = []
  for (var c = 0; c < BOARD_COLS; c++) cols.push(c)

  return (
    <div className="d17-hex-board-bg p-4 md:p-6 relative" style={{ overflowX: 'auto' }}>
      <div
        className="relative mx-auto"
        style={{ width: width, height: height + (showLabels ? 14 : 0), minWidth: width }}
      >
        {showLabels && rows.map(function (r) {
          return (
            <span
              key={'lbl-' + r}
              className="d17-row-label hidden md:block"
              style={{ top: r * rowGap + hexHeight / 2 - 6 }}
            >{ROW_LABELS[r]}</span>
          )
        })}
        {/* Enemy-side indicator at top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,80,80,0.30), transparent)' }}
        />
        <span
          className="absolute font-mono text-[8px] uppercase tracking-[0.2em] hidden md:block pointer-events-none"
          style={{ top: -10, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,80,80,0.55)' }}
        >Enemy ↑</span>
        {rows.map(function (r) {
          return cols.map(function (c) {
            var key = r + '_' + c
            var p = grid[key]
            var ch = p ? champByKey[p.key] : null
            var items = p && itemsByKey[p.key] ? itemsByKey[p.key] : null
            var x = c * colGap + (r % 2 === 1 ? oddOffset : 0)
            var y = r * rowGap
            return (
              <Hex
                key={key}
                x={x}
                y={y}
                size={size}
                hexHeight={hexHeight}
                placement={p}
                champion={ch}
                items={items}
                highlight={ch && highlightKey === ch.key}
                onClick={onHexClick ? function () { onHexClick(r, c, p ? p.key : null) } : null}
              />
            )
          })
        })}
      </div>
    </div>
  )
}

function Hex(props) {
  var size = props.size
  var hexHeight = props.hexHeight
  var p = props.placement
  var ch = props.champion
  var items = props.items || []
  var carry = p && p.isCarry
  var highlight = props.highlight
  var clickable = !!props.onClick

  var ringColor = carry ? '#FFC66B' : (ch ? costColor(ch.cost) : HEX_RING)
  var glow = carry ? '0 0 12px rgba(255,198,107,0.65), 0 0 22px rgba(255,198,107,0.25)'
    : highlight ? '0 0 10px rgba(103,226,217,0.50)' : 'none'

  var Tag = clickable ? 'button' : 'div'
  var commonProps = {
    style: {
      position: 'absolute',
      left: props.x,
      top: props.y,
      width: size,
      height: hexHeight,
      padding: 0,
      background: 'transparent',
      border: 'none',
      cursor: clickable ? 'pointer' : 'default',
    },
    title: ch ? ch.name + (carry ? ' (carry)' : '') : (clickable ? 'Place a unit' : ''),
  }
  if (clickable) commonProps.onClick = props.onClick

  if (!ch) {
    return (
      <Tag {...commonProps}>
        <div className="d17-hex d17-hex-empty w-full h-full" style={{ width: size, height: hexHeight }}/>
      </Tag>
    )
  }

  // Items strip is rendered as a sibling absolute overlay so it sits BELOW the hex
  // (outside the clip-path).
  var itemSlotSize = Math.max(14, Math.round(size * 0.30))
  var itemSlots = items.slice(0, 3)
  var stripWidth = itemSlots.length * itemSlotSize + (itemSlots.length - 1) * 1
  var stripLeft = (size - stripWidth) / 2

  return (
    <div style={{ position: 'absolute', left: props.x, top: props.y, width: size, height: hexHeight + 22 }}>
      <Tag
        style={Object.assign({}, commonProps.style, { left: 0, top: 0 })}
        onClick={clickable ? props.onClick : undefined}
        title={commonProps.title}
      >
        <div className="d17-hex-ring" style={{ background: ringColor, boxShadow: glow, filter: glow !== 'none' ? 'drop-shadow(0 0 4px ' + ringColor + ')' : 'none' }}/>
        <div className="d17-hex-fg">
          <ChampImg
            champion={ch}
            size={size - 4}
            style={{ width: size - 4, height: hexHeight - 4, border: 'none', boxShadow: 'none', objectFit: 'cover' }}
          />
          {/* Cost number top-left chip */}
          <span
            className="absolute font-mono text-[8px] font-bold leading-none"
            style={{
              top: 6, left: 6, padding: '2px 4px',
              background: 'rgba(0,0,0,0.75)', color: ringColor,
              border: '1px solid ' + ringColor + 'aa',
            }}
          >{ch.cost}</span>
          {carry && (
            <span
              aria-hidden="true"
              className="absolute font-mono text-[10px] font-bold leading-none"
              style={{
                top: 4, right: 4, padding: '2px 4px',
                background: '#FFC66B', color: '#1a1420',
                boxShadow: '0 0 6px rgba(255,198,107,0.65)',
              }}
            >★</span>
          )}
          {/* Champion name strip at bottom of hex */}
          <span
            className="absolute inset-x-0 bottom-0 text-[8px] font-mono text-center px-1 py-0.5 truncate uppercase tracking-wider"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.85))',
              color: '#FFC66B',
            }}
          >{ch.name}</span>
        </div>
      </Tag>
      {itemSlots.length > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: stripLeft,
            top: hexHeight - 4,
            display: 'flex',
            gap: 1,
            zIndex: 5,
          }}
        >
          {itemSlots.map(function (it, idx) {
            return (
              <img
                key={idx}
                src={it.icon ? it.icon.replace(/\.tex$/, '.png') : ''}
                alt={it.name}
                title={it.name}
                style={{
                  width: itemSlotSize,
                  height: itemSlotSize,
                  border: '1px solid rgba(255,198,107,0.55)',
                  background: '#0e0d15',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
                }}
                onError={function (e) { e.target.style.opacity = '0.3' }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
