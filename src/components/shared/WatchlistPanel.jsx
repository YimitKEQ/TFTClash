import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Icon } from '../ui'
import { getWatched, unwatch, WATCHLIST_EVENT } from '../../lib/watchlist.js'
import { getStats } from '../../lib/stats.js'

function trendForAvg(avg) {
  if (!avg || avg === '-') return { icon: 'horizontal_rule', cls: 'text-on-surface-variant/50' }
  var n = parseFloat(avg)
  if (isNaN(n)) return { icon: 'horizontal_rule', cls: 'text-on-surface-variant/50' }
  if (n <= 3.0) return { icon: 'trending_up',  cls: 'text-tertiary' }
  if (n <= 5.0) return { icon: 'horizontal_rule', cls: 'text-on-surface-variant/70' }
  return { icon: 'trending_down', cls: 'text-error' }
}

export default function WatchlistPanel(props) {
  var ctx = useApp()
  var players = ctx.players || []
  var navigate = useNavigate()

  var maxItems = props.limit || 6

  var _names = useState(getWatched())
  var names = _names[0]
  var setNames = _names[1]

  useEffect(function () {
    function onChange() { setNames(getWatched()) }
    if (typeof window !== 'undefined') {
      window.addEventListener(WATCHLIST_EVENT, onChange)
      window.addEventListener('storage', onChange)
    }
    return function () {
      if (typeof window !== 'undefined') {
        window.removeEventListener(WATCHLIST_EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    }
  }, [])

  var sortedPlayers = players.slice().sort(function (a, b) { return (b.pts || 0) - (a.pts || 0) })
  var rankByName = {}
  sortedPlayers.forEach(function (p, i) {
    if (p && p.name) rankByName[p.name.toLowerCase()] = i + 1
  })

  var resolved = names.map(function (n) {
    var key = String(n).toLowerCase()
    var match = sortedPlayers.find(function (p) { return p.name && p.name.toLowerCase() === key })
    return { name: n, player: match || null, rank: match ? rankByName[key] : null }
  })

  var visible = resolved.slice(0, maxItems)
  var hidden = Math.max(0, resolved.length - visible.length)

  if (resolved.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="visibility" className="text-secondary" />
          <h3 className="font-display text-base tracking-wide">WATCHLIST</h3>
        </div>
        <div className="text-xs text-on-surface-variant/60 leading-relaxed">
          Tap the <span className="text-secondary font-bold">Watch</span> button on any player profile or leaderboard row
          to follow their progress here.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="visibility" className="text-secondary" />
          <h3 className="font-display text-base tracking-wide">WATCHLIST</h3>
          <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
            {resolved.length} watched
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        {visible.map(function (entry) {
          var p = entry.player
          var stats = p ? getStats(p) : null
          var trend = trendForAvg(stats ? stats.avgPlacement : null)
          return (
            <div
              key={entry.name}
              className="group flex items-center gap-3 px-3 py-2 rounded-lg border border-outline-variant/10 bg-surface-container-low/60 hover:border-secondary/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-on-surface/60 text-sm">
                  {(entry.name || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={function () { navigate('/player/' + entry.name) }}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-sm text-on-surface truncate">{entry.name}</span>
                  {entry.rank && (
                    <span className="text-[10px] font-mono text-on-surface-variant/50">#{entry.rank}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-on-surface-variant/60 mt-0.5">
                  {p ? (
                    <>
                      <span className="text-tertiary">{(p.pts || 0)} pts</span>
                      <span>AVP {stats ? stats.avgPlacement : '-'}</span>
                      <span>{(p.wins || 0)}W</span>
                    </>
                  ) : (
                    <span className="text-on-surface-variant/40 italic">Not in current season</span>
                  )}
                </div>
              </button>
              <Icon name={trend.icon} size={16} className={trend.cls + ' flex-shrink-0'} />
              <button
                type="button"
                onClick={function () { unwatch(entry.name) }}
                className="opacity-30 hover:opacity-100 hover:text-error flex-shrink-0"
                title="Remove from watchlist"
                aria-label={'Remove ' + entry.name + ' from watchlist'}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )
        })}
      </div>
      {hidden > 0 && (
        <div className="mt-2 text-center">
          <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
            +{hidden} more
          </span>
        </div>
      )}
    </div>
  )
}
