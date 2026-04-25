import { useState, useMemo } from 'react'
import { Icon } from '../ui'
import {
  readMyPrediction,
  savePrediction,
  clearPrediction,
  leaderboard,
} from '../../lib/predictions'

export default function PredictionGame(props) {
  var threadId = props.threadId || 'unknown'
  var currentUser = props.currentUser
  var registeredPlayers = props.registeredPlayers || []
  var startsAt = props.startsAt
  var isCompleted = !!props.isCompleted
  var actualWinnerId = props.actualWinnerId || null
  var actualTop4Ids = props.actualTop4Ids || []

  var lockTime = startsAt ? new Date(startsAt).getTime() : 0
  var locked = isCompleted || (lockTime > 0 && Date.now() >= lockTime)

  var _prediction = useState(function () { return readMyPrediction(threadId, currentUser) })
  var prediction = _prediction[0]
  var setPrediction = _prediction[1]

  var _winner = useState((prediction && prediction.winner) || '')
  var winner = _winner[0]
  var setWinner = _winner[1]

  var _top4 = useState((prediction && prediction.top4) || [])
  var top4 = _top4[0]
  var setTop4 = _top4[1]

  var _err = useState('')
  var err = _err[0]
  var setErr = _err[1]

  var _showBoard = useState(isCompleted)
  var showBoard = _showBoard[0]
  var setShowBoard = _showBoard[1]

  var board = useMemo(function () {
    return leaderboard(threadId, actualWinnerId, actualTop4Ids)
  }, [threadId, actualWinnerId, actualTop4Ids, prediction])

  function toggleTop4(id) {
    if (top4.indexOf(id) >= 0) {
      setTop4(top4.filter(function (x) { return x !== id }))
    } else {
      if (top4.length >= 4) return
      setTop4([].concat(top4, [id]))
    }
  }

  function submit() {
    setErr('')
    if (!winner) { setErr('Pick a winner'); return }
    if (top4.length !== 4) { setErr('Pick exactly 4 top4 players'); return }
    if (top4.indexOf(winner) < 0) { setErr('Your winner must also be in top4'); return }
    savePrediction(threadId, currentUser, { winner: winner, top4: top4 })
    setPrediction({ winner: winner, top4: top4, ts: Date.now() })
  }

  function unlock() {
    clearPrediction(threadId, currentUser)
    setPrediction(null)
    setWinner('')
    setTop4([])
  }

  var pool = (registeredPlayers || []).filter(function (p) { return p && p.id && p.name })

  if (pool.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="psychology" className="text-[var(--md-secondary)]" />
        <h3 className="font-display text-base tracking-wide">PREDICTION GAME</h3>
        <span className="ml-auto text-xs text-white/50">
          {isCompleted ? 'FINAL' : locked ? 'LOCKED' : 'OPEN'}
        </span>
      </div>

      {!isCompleted && !locked && (
        <p className="text-xs text-white/60 mb-3">Pick the winner + top 4. Locks at start. +5 for winner, +2 per top4.</p>
      )}

      {!locked && !prediction && (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-label tracking-wider text-white/50 mb-1.5">YOUR TOP 4 ({top4.length}/4)</div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {pool.map(function (p) {
                var picked = top4.indexOf(p.id) >= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={function () { toggleTop4(p.id) }}
                    className={
                      'px-2 py-1.5 rounded-lg text-xs text-left border ' +
                      (picked
                        ? 'bg-[var(--md-secondary)]/20 border-[var(--md-secondary)]/40 text-[var(--md-secondary)]'
                        : 'bg-black/20 border-white/10 text-white/70 hover:border-white/20')
                    }
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-label tracking-wider text-white/50 mb-1.5">YOUR WINNER</div>
            <select
              value={winner}
              onChange={function (e) { setWinner(e.target.value) }}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:border-white/30"
            >
              <option value="">— pick —</option>
              {pool.map(function (p) {
                return <option key={p.id} value={p.id}>{p.name}</option>
              })}
            </select>
          </div>

          {err && <div className="text-xs text-[var(--md-error)]">{err}</div>}
          <button
            type="button"
            onClick={submit}
            className="w-full px-3 py-2 rounded-lg bg-[var(--md-secondary)]/20 text-[var(--md-secondary)] border border-[var(--md-secondary)]/30 text-sm font-label tracking-wider hover:bg-[var(--md-secondary)]/30"
          >
            LOCK IN PREDICTION
          </button>
        </div>
      )}

      {!locked && prediction && (
        <div className="space-y-2">
          <div className="text-xs text-white/60">
            <span className="text-white/40">Winner:</span> {nameOf(pool, prediction.winner)}
          </div>
          <div className="text-xs text-white/60">
            <span className="text-white/40">Top 4:</span> {(prediction.top4 || []).map(function (id) { return nameOf(pool, id) }).join(', ')}
          </div>
          <button
            type="button"
            onClick={unlock}
            className="text-xs text-[var(--md-secondary)] hover:underline"
          >
            edit pick
          </button>
        </div>
      )}

      {locked && !isCompleted && (
        <div className="text-xs text-white/50 italic">Predictions locked. Check back when results post.</div>
      )}

      {isCompleted && prediction && (
        <div className="rounded-lg bg-black/20 border border-white/5 p-3 mb-3">
          <div className="text-[10px] font-label tracking-wider text-white/50 mb-1">YOUR PICK</div>
          <div className="text-sm">
            Winner: {nameOf(pool, prediction.winner)}
            {actualWinnerId && String(prediction.winner) === String(actualWinnerId) && (
              <span className="ml-2 text-[var(--md-success)] text-xs">+5 hit!</span>
            )}
          </div>
          <div className="text-xs text-white/60 mt-1">
            Top 4: {(prediction.top4 || []).map(function (id) {
              var hit = actualTop4Ids.indexOf(id) >= 0
              return (hit ? '+ ' : '') + nameOf(pool, id)
            }).join(', ')}
          </div>
        </div>
      )}

      {(isCompleted || prediction) && board.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={function () { setShowBoard(!showBoard) }}
            className="text-xs font-label tracking-wider text-white/60 hover:text-white flex items-center gap-1"
          >
            <Icon name={showBoard ? 'expand_less' : 'expand_more'} size={14} />
            LEADERBOARD ({board.length})
          </button>
          {showBoard && (
            <ol className="mt-2 space-y-1 text-xs">
              {board.slice(0, 10).map(function (r, i) {
                return (
                  <li key={r.key} className="flex items-center gap-2">
                    <span className="text-white/40 w-5 text-right">{i + 1}.</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span className="text-[var(--md-tertiary)] font-mono">{r.score} pt</span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

function nameOf(pool, id) {
  if (!id) return '—'
  var p = pool.find(function (x) { return String(x.id) === String(id) })
  return p ? p.name : '?'
}
