import { useState, useEffect } from 'react'
import { Icon } from '../ui'

var KEY_PREFIX = 'tft-bounty-v1:'
var GUEST_KEY = 'tft-bounty-guest-handle-v1'
var MAX_BOUNTIES = 50
var MAX_NOTE = 140

function readBounties(threadId) {
  if (typeof window === 'undefined') return []
  try {
    var raw = window.localStorage.getItem(KEY_PREFIX + threadId)
    if (!raw) return []
    var parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

function writeBounties(threadId, list) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY_PREFIX + threadId, JSON.stringify(list.slice(-MAX_BOUNTIES)))
  } catch (e) {}
}

function readGuestHandle() {
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(GUEST_KEY) || '' } catch (e) { return '' }
}

function writeGuestHandle(handle) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(GUEST_KEY, handle) } catch (e) {}
}

export default function BountyBoard(props) {
  var threadId = props.threadId || 'unknown'
  var currentUser = props.currentUser
  var registeredIds = props.registeredIds || []

  var _bounties = useState(function () { return readBounties(threadId) })
  var bounties = _bounties[0]
  var setBounties = _bounties[1]

  var _amount = useState('5')
  var amount = _amount[0]
  var setAmount = _amount[1]

  var _target = useState('pool')
  var target = _target[0]
  var setTarget = _target[1]

  var _note = useState('')
  var note = _note[0]
  var setNote = _note[1]

  var _guest = useState(function () { return readGuestHandle() })
  var guestHandle = _guest[0]
  var setGuestHandle = _guest[1]

  useEffect(function () {
    function onStorage(e) {
      if (e.key !== KEY_PREFIX + threadId) return
      setBounties(readBounties(threadId))
    }
    window.addEventListener('storage', onStorage)
    return function () { window.removeEventListener('storage', onStorage) }
  }, [threadId])

  function onPledge() {
    var amt = parseFloat(amount)
    if (!amt || amt <= 0 || amt > 9999) return
    var pledger = currentUser && currentUser.username
      ? currentUser.username
      : (guestHandle && guestHandle.trim())
    if (!pledger) return
    if (!currentUser) writeGuestHandle(pledger)

    var entry = {
      id: 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      pledger: pledger,
      amount: Math.round(amt * 100) / 100,
      target: target,
      note: (note || '').trim().slice(0, MAX_NOTE),
      ts: Date.now(),
    }
    var next = bounties.concat([entry])
    setBounties(next)
    writeBounties(threadId, next)
    setNote('')
    setAmount('5')
  }

  var totalPool = bounties.filter(function (b) { return b.target === 'pool' })
    .reduce(function (s, b) { return s + (b.amount || 0) }, 0)

  var byPlayer = {}
  bounties.forEach(function (b) {
    if (b.target && b.target !== 'pool') {
      byPlayer[b.target] = (byPlayer[b.target] || 0) + (b.amount || 0)
    }
  })
  var topPlayer = Object.keys(byPlayer).sort(function (a, b) { return byPlayer[b] - byPlayer[a] })[0]

  var sorted = bounties.slice().sort(function (a, b) { return b.ts - a.ts }).slice(0, 8)

  return (
    <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
        <Icon name="redeem" size={18} className="text-tertiary" />
        <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface flex-1">Fan Bounties</span>
        {bounties.length > 0 && (
          <span className="font-mono text-xs text-on-surface-variant/60">{bounties.length}</span>
        )}
      </div>

      {totalPool > 0 || topPlayer ? (
        <div className="grid grid-cols-2 gap-px bg-outline-variant/5">
          <div className="bg-surface-container-low p-4">
            <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">Pool Boost</div>
            <div className="font-mono text-base font-bold text-tertiary">{'+€' + totalPool.toFixed(2)}</div>
          </div>
          <div className="bg-surface-container-low p-4">
            <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">Top Bountied</div>
            <div className="font-mono text-base font-bold text-on-surface truncate">
              {topPlayer ? topPlayer + ': €' + byPlayer[topPlayer].toFixed(2) : '-'}
            </div>
          </div>
        </div>
      ) : null}

      <div className="px-5 py-3 border-t border-outline-variant/10 space-y-2">
        {!currentUser && (
          <input
            type="text"
            value={guestHandle}
            onChange={function (e) { setGuestHandle(e.target.value.slice(0, 24)) }}
            placeholder="Your handle (guest)"
            className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-xs text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40"
          />
        )}
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="9999"
            step="1"
            value={amount}
            onChange={function (e) { setAmount(e.target.value) }}
            className="w-20 bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-tertiary/40"
            aria-label="Bounty amount in EUR"
          />
          <select
            value={target}
            onChange={function (e) { setTarget(e.target.value) }}
            className="flex-1 bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-tertiary/40"
          >
            <option value="pool">Boost prize pool</option>
            {registeredIds.slice(0, 32).map(function (un) {
              return <option key={un} value={un}>{'For ' + un}</option>
            })}
          </select>
        </div>
        <input
          type="text"
          value={note}
          onChange={function (e) { setNote(e.target.value.slice(0, MAX_NOTE)) }}
          placeholder="Optional note (e.g. first to top-4)"
          className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-xs text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-tertiary/40"
        />
        <button
          onClick={onPledge}
          disabled={!parseFloat(amount) || parseFloat(amount) <= 0 || (!currentUser && !guestHandle.trim())}
          className="w-full px-3 py-2 bg-tertiary/15 border border-tertiary/30 text-tertiary font-label font-bold text-[11px] uppercase tracking-widest rounded hover:bg-tertiary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Pledge €{amount || '0'}
        </button>
        <p className="text-[10px] text-on-surface-variant/40 leading-snug">
          Bounties are public pledges only. The host collects payment off-platform; we just track it.
        </p>
      </div>

      {sorted.length > 0 && (
        <div className="border-t border-outline-variant/10 divide-y divide-outline-variant/5 max-h-60 overflow-y-auto">
          {sorted.map(function (b) {
            var label = b.target === 'pool' ? 'pool' : 'for ' + b.target
            return (
              <div key={b.id} className="px-5 py-2.5 text-xs flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-tertiary">€{(b.amount || 0).toFixed(2)}</span>
                  <span className="text-on-surface-variant/50">→</span>
                  <span className={'font-mono ' + (b.target === 'pool' ? 'text-on-surface' : 'text-primary')}>{label}</span>
                  <span className="text-on-surface-variant/40 ml-auto truncate">{b.pledger}</span>
                </div>
                {b.note && <div className="text-on-surface-variant/60 italic pl-1">"{b.note}"</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
