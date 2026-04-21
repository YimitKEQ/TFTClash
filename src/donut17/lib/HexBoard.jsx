import ChampImg from './ChampImg'
import { costColor } from './imgFallback'
import { BOARD_ROWS, BOARD_COLS, ROW_LABELS } from './positioning'

// HexBoard renders a 4x7 honeycomb board.
//
// Props:
//   placed       -- array of { key, row, col, isCarry } produced by positionBoard
//   champByKey   -- lookup map for champion records
//   size         -- hex tile width in px (default 56)
//   showLabels   -- show 'Frontline / Backline' labels along the left edge
//   onHexClick   -- optional (row, col, currentUnitKey) -> void; when set, empty
//                   and filled hexes become buttons (Team Planner uses this)
//   highlightKey -- champion key to glow extra-bright (e.g. carry on hover)
//   compact      -- smaller hexes (40px) without labels, for inline cards

var HEX_RING = 'rgba(80, 69, 53, 0.45)'

export default function HexBoard(props) {
  var placed = props.placed || []
  var champByKey = props.champByKey || {}
  var size = props.size || 56
  var showLabels = props.showLabels !== false
  var onHexClick = props.onHexClick
  var highlightKey = props.highlightKey

  var rowGap = size * 0.78
  var colGap = size
  var oddOffset = size / 2

  var grid = {}
  placed.forEach(function (p) { grid[p.row + '_' + p.col] = p })

  var width = BOARD_COLS * colGap + oddOffset
  var height = (BOARD_ROWS - 1) * rowGap + size

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
              style={{ top: r * rowGap + size / 2 - 6 }}
            >{ROW_LABELS[r]}</span>
          )
        })}
        {rows.map(function (r) {
          return cols.map(function (c) {
            var key = r + '_' + c
            var p = grid[key]
            var ch = p ? champByKey[p.key] : null
            var x = c * colGap + (r % 2 === 1 ? oddOffset : 0)
            var y = r * rowGap
            return (
              <Hex
                key={key}
                x={x}
                y={y}
                size={size}
                placement={p}
                champion={ch}
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
  var p = props.placement
  var ch = props.champion
  var carry = p && p.isCarry
  var highlight = props.highlight
  var clickable = !!props.onClick

  var ringColor = carry ? '#FFC66B' : (ch ? costColor(ch.cost) : HEX_RING)
  var ringStyle = {
    background: ringColor,
    filter: carry || highlight ? 'drop-shadow(0 0 6px rgba(255,198,107,0.55))' : 'none',
  }

  var Tag = clickable ? 'button' : 'div'
  var commonProps = {
    style: {
      position: 'absolute',
      left: props.x,
      top: props.y,
      width: size,
      height: size,
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
        <div className="d17-hex d17-hex-empty w-full h-full" style={{ width: size, height: size }}/>
      </Tag>
    )
  }

  return (
    <Tag {...commonProps}>
      <div className="d17-hex-ring" style={ringStyle}/>
      <div className="d17-hex-fg">
        <ChampImg
          champion={ch}
          size={size - 4}
          style={{ width: size - 4, height: size - 4, border: 'none', boxShadow: 'none' }}
        />
        {carry && (
          <span
            aria-hidden="true"
            className="absolute font-mono text-[8px] font-bold leading-none"
            style={{
              top: 4, right: 4, padding: '2px 4px',
              background: '#FFC66B', color: '#1a1420',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)'
            }}
          >C</span>
        )}
      </div>
    </Tag>
  )
}
