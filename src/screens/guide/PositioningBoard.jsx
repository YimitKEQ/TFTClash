// A simplified two-team board that teaches the one positioning rule that
// matters most. Rows 0-1 are the enemy, rows 2-3 are you. Mirrors the real TFT
// board shape (staggered 7-wide hex rows).

var BOARD_ROWS = 4
var BOARD_COLS = 7

var HIGHLIGHTS = {
  '0-4': { kind: 'enemyCarry', label: 'Their carry' },
  '1-4': { kind: 'enemyTank', label: 'Their tank' },
  '2-4': { kind: 'yourTank', label: 'Your tank' },
  '3-1': { kind: 'yourCarry', label: 'Your carry' },
}

var CELL_STYLES = {
  enemyCarry: 'bg-error/80 border-error',
  enemyTank: 'bg-error/30 border-error/50',
  yourTank: 'bg-tertiary/80 border-tertiary',
  yourCarry: 'bg-secondary/80 border-secondary',
}

var HEX_CLIP = { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }

function HexCell(props) {
  var hl = props.hl
  var isEnemy = props.rowIndex < 2
  var fill = hl
    ? CELL_STYLES[hl.kind]
    : isEnemy
      ? 'bg-error/[0.04] border-error/10'
      : 'bg-tertiary/[0.04] border-tertiary/10'
  return <div className={'aspect-square border transition-colors ' + fill} style={HEX_CLIP} />
}

function LegendDot(props) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={'w-3 h-3 flex-shrink-0 border ' + CELL_STYLES[props.kind]} style={HEX_CLIP} />
      <span className="font-body text-xs text-slate-400 leading-tight">{props.text}</span>
    </div>
  )
}

export default function PositioningBoard() {
  var rows = []
  var r = 0
  for (r = 0; r < BOARD_ROWS; r++) {
    var cells = []
    var c = 0
    for (c = 0; c < BOARD_COLS; c++) {
      var key = r + '-' + c
      cells.push(<HexCell key={key} hl={HIGHLIGHTS[key]} rowIndex={r} />)
    }
    var offset = r % 2 === 1 ? 'ml-[7%]' : ''
    rows.push(
      <div key={'row-' + r} className={'grid gap-1.5 ' + offset} style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-error/70 font-bold">Enemy side</span>
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-tertiary/70 font-bold">Your side</span>
      </div>
      <div className="space-y-1.5 mb-6">{rows}</div>
      <div className="grid grid-cols-2 gap-3">
        <LegendDot kind="yourTank" text="Tank in front of their carry" />
        <LegendDot kind="yourCarry" text="Carry in the far corner" />
        <LegendDot kind="enemyCarry" text="Their main damage" />
        <LegendDot kind="enemyTank" text="Their frontline" />
      </div>
    </div>
  )
}
