import { useMemo, useState } from 'react'
import HexBoard from '../lib/HexBoard'
import ChampImg from '../lib/ChampImg'
import { costColor } from '../lib/imgFallback'
import { computeActiveTraits, tierColor } from '../lib/traitComputer'
import { BOARD_ROWS, BOARD_COLS } from '../lib/positioning'

// Team Planner: an interactive 4x7 hex board for sketching out a comp.
//
// Click a champion in the roster to "arm" it, then click a hex to place it
// (or click an occupied hex to remove). Trait sidebar updates live. Carries
// can be marked by clicking an already-placed unit; this re-arms it as a
// carry-toggle (the placed unit can also be deleted by clicking again).
//
// Pure local state. No persistence -- intentionally ephemeral so the user
// can experiment without polluting saved data.

function emptyBoard() {
  return [] // [{ key, row, col, isCarry }]
}

export default function TeamPlanner(props) {
  var champions = props.data.champions
  var traits = props.data.traits

  var _b = useState(emptyBoard())
  var board = _b[0]
  var setBoard = _b[1]

  var _armed = useState(null)  // champion key currently armed for placement
  var armed = _armed[0]
  var setArmed = _armed[1]

  var _q = useState('')
  var query = _q[0]
  var setQuery = _q[1]

  var _c = useState('all')
  var costFilter = _c[0]
  var setCostFilter = _c[1]

  var _carryMode = useState(false)
  var carryMode = _carryMode[0]
  var setCarryMode = _carryMode[1]

  var champByKey = useMemo(function () {
    var m = {}
    champions.forEach(function (c) { m[c.key] = c })
    return m
  }, [champions])

  var rosterFiltered = useMemo(function () {
    return champions.filter(function (c) {
      var k = c.key
      if (!k) return false
      if (k.indexOf('pve_') !== -1) return false
      if (k.indexOf('enemy_') !== -1) return false
      if (k.indexOf('dummy') !== -1) return false
      if (k.indexOf('summon') === 0) return false
      if (k.indexOf('armorykey') !== -1) return false
      if (k.indexOf('emblemarmorykey') !== -1) return false
      if (k.indexOf('fakeunit') !== -1) return false
      if (!c.cost || c.cost < 1 || c.cost > 5) return false
      if (costFilter !== 'all' && c.cost !== costFilter) return false
      if (query) {
        var qq = query.toLowerCase()
        if ((c.name || '').toLowerCase().indexOf(qq) === -1) return false
      }
      return true
    })
  }, [champions, query, costFilter])

  var unitKeys = useMemo(function () {
    return board.map(function (b) { return b.key })
  }, [board])

  var carrySet = useMemo(function () {
    var s = new Set()
    board.forEach(function (b) { if (b.isCarry) s.add(b.key) })
    return s
  }, [board])

  var activeTraits = useMemo(function () {
    return computeActiveTraits(unitKeys, champions, traits)
  }, [unitKeys, champions, traits])

  function findAt(row, col) {
    for (var i = 0; i < board.length; i++) {
      if (board[i].row === row && board[i].col === col) return i
    }
    return -1
  }

  function handleHex(row, col, currentKey) {
    var idx = findAt(row, col)
    if (idx !== -1) {
      // Hex is occupied. If carry mode is on, toggle carry. Otherwise remove.
      if (carryMode) {
        var next = board.slice()
        next[idx] = Object.assign({}, next[idx], { isCarry: !next[idx].isCarry })
        setBoard(next)
      } else if (armed && armed !== currentKey) {
        // Replace existing unit with armed unit.
        var swap = board.slice()
        swap[idx] = { key: armed, row: row, col: col, isCarry: false }
        setBoard(swap)
      } else {
        setBoard(board.filter(function (_, i) { return i !== idx }))
      }
      return
    }
    if (!armed) return
    // Empty hex + armed unit: place. Allow duplicates (TFT does, even if rare).
    setBoard(board.concat([{ key: armed, row: row, col: col, isCarry: false }]))
  }

  function clearBoard() {
    setBoard(emptyBoard())
    setArmed(null)
  }

  return (
    <div>
      <header className="mb-8">
        <span className="font-label text-xs uppercase tracking-[0.2em]" style={{ color: '#FFC66B' }}>Sandbox</span>
        <h1 className="font-editorial italic text-5xl mt-2 d17-gold-text">Team Planner</h1>
        <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(228,225,236,0.65)' }}>
          Pick a unit from the roster, then tap a hex to place it. Click a placed unit to remove. Toggle "Carry mode" to mark damage carries (gold ring). Trait counter updates live.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Board + controls */}
        <section className="col-span-12 xl:col-span-8 space-y-4">
          <div className="d17-panel p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#9d8e7c' }}>Armed</span>
              {armed && champByKey[armed] ? (
                <span className="inline-flex items-center gap-2">
                  <ChampImg champion={champByKey[armed]} size={28} style={{ width: 28, height: 28 }}/>
                  <span className="font-editorial italic text-sm" style={{ color: '#FFC66B' }}>{champByKey[armed].name}</span>
                  <button
                    type="button"
                    onClick={function(){ setArmed(null) }}
                    className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 cursor-pointer"
                    style={{ color: 'rgba(228,225,236,0.55)', border: '1px solid rgba(157,142,124,0.25)' }}
                  >Clear</button>
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#504535' }}>None — pick a unit below</span>
              )}
            </div>
            <div className="flex-1"/>
            <button
              type="button"
              onClick={function(){ setCarryMode(!carryMode) }}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 cursor-pointer"
              style={{
                background: carryMode ? 'rgba(255,198,107,0.18)' : 'transparent',
                color: carryMode ? '#FFC66B' : 'rgba(228,225,236,0.55)',
                border: carryMode ? '1px solid rgba(255,198,107,0.55)' : '1px solid rgba(157,142,124,0.20)'
              }}
            >Carry mode {carryMode ? 'ON' : 'OFF'}</button>
            <button
              type="button"
              onClick={clearBoard}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1 cursor-pointer"
              style={{ color: 'rgba(228,225,236,0.55)', border: '1px solid rgba(157,142,124,0.20)' }}
            >Clear board</button>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#67e2d9' }}>
              {board.length}/{BOARD_ROWS * BOARD_COLS} hexes used
            </span>
          </div>

          <HexBoard
            placed={board}
            champByKey={champByKey}
            size={64}
            showLabels={true}
            onHexClick={handleHex}
          />

          {/* Roster */}
          <div className="d17-panel p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex gap-1 flex-wrap">
                <CostChip cost="all" active={costFilter==='all'} onClick={function(){setCostFilter('all')}}/>
                {[1,2,3,4,5].map(function (c) {
                  return <CostChip key={c} cost={c} active={costFilter===c} onClick={function(){setCostFilter(c)}}/>
                })}
              </div>
              <input
                className="flex-1 min-w-[200px] bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider"
                style={{ background: '#0e0d15', borderBottom: '1px solid rgba(255,198,107,0.22)', color: '#e4e1ec' }}
                placeholder="FILTER UNITS..."
                type="text"
                value={query}
                onChange={function(e){ setQuery(e.target.value) }}
              />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {rosterFiltered.map(function (c) {
                var isArmed = armed === c.key
                var onBoard = unitKeys.indexOf(c.key) !== -1
                return (
                  <button
                    type="button"
                    key={c.apiName || c.key}
                    onClick={function(){ setArmed(c.key) }}
                    title={c.name + ' (' + c.cost + '-cost)'}
                    className="relative aspect-square cursor-pointer p-0"
                    style={{
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: isArmed ? '#FFC66B' : costColor(c.cost),
                      boxShadow: isArmed ? '0 0 14px rgba(255,198,107,0.55)' : 'none',
                      background: '#0e0d15',
                      opacity: onBoard ? 0.65 : 1
                    }}
                  >
                    <ChampImg champion={c} size={'100%'} style={{ width: '100%', height: '100%', border: 'none', boxShadow: 'none' }}/>
                    <span
                      className="absolute bottom-0 inset-x-0 text-[8px] font-mono text-center py-0.5 truncate px-1"
                      style={{ background: 'rgba(0,0,0,0.85)', color: costColor(c.cost) }}
                    >{c.name}</span>
                    {onBoard && (
                      <span
                        className="material-symbols-outlined absolute top-0 left-0 text-[12px] p-0.5"
                        style={{ background: '#67e2d9', color: '#0e0d15' }}
                      >check</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* Trait sidebar */}
        <aside className="col-span-12 xl:col-span-4 space-y-4">
          <div className="d17-panel p-4">
            <p className="font-label uppercase tracking-widest text-xs mb-3" style={{ color: '#FFC66B' }}>Active Synergies</p>
            {activeTraits.length === 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#504535' }}>
                — place units to activate traits —
              </p>
            ) : (
              <ul className="space-y-2">
                {activeTraits.map(function (t) {
                  var color = tierColor(t.tier)
                  var pct = Math.min(100, (t.count / t.maxBreakpoint) * 100)
                  return (
                    <li key={t.apiName} className="d17-panel-lo p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {t.icon && (
                            <img alt={t.name} src={t.icon} onError={function(e){e.target.style.display='none'}} className="w-5 h-5 shrink-0"/>
                          )}
                          <span className="font-editorial italic text-sm truncate" style={{ color: color }}>{t.name}</span>
                        </div>
                        <span className="font-mono text-[10px] tabular-nums shrink-0" style={{ color: color }}>
                          {t.count}/{t.maxBreakpoint}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1" style={{ background: '#0e0d15' }}>
                        <div style={{ width: pct + '%', height: '100%', background: color }}/>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {carrySet.size > 0 && (
            <div className="d17-panel p-4">
              <p className="font-label uppercase tracking-widest text-xs mb-3" style={{ color: '#FFC66B' }}>Carries</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(carrySet).map(function (k) {
                  var ch = champByKey[k]
                  if (!ch) return null
                  return (
                    <span key={k} className="inline-flex items-center gap-2 px-2 py-1"
                      style={{ background: 'rgba(255,198,107,0.10)', border: '1px solid rgba(255,198,107,0.40)' }}>
                      <ChampImg champion={ch} size={20} style={{ width: 20, height: 20 }}/>
                      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#FFC66B' }}>{ch.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <div className="d17-panel-lo p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#9d8e7c' }}>How it works</p>
            <ol className="space-y-1.5 text-[11px] font-body" style={{ color: 'rgba(228,225,236,0.65)' }}>
              <li>1. Tap a champion below to arm it.</li>
              <li>2. Tap a hex to place. Tap an occupied hex to clear.</li>
              <li>3. Toggle Carry mode then tap a placed unit to mark / unmark.</li>
              <li>4. Synergy panel reflects active breakpoints in real time.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CostChip(props) {
  var label = props.cost === 'all' ? 'ALL' : ('$' + props.cost)
  var accent = props.cost === 'all' ? '#FFC66B' : costColor(props.cost)
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="font-mono text-[10px] py-1 px-3 uppercase cursor-pointer transition-all"
      style={{
        background: props.active ? accent + '18' : 'transparent',
        color: props.active ? accent : 'rgba(228,225,236,0.55)',
        border: props.active ? '1px solid ' + accent + '88' : '1px solid rgba(157,142,124,0.15)'
      }}
    >{label}</button>
  )
}
