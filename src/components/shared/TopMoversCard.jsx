import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui'

function sortHistAsc(hist) {
  var copy = hist.slice()
  copy.sort(function (a, b) {
    var atid = String(a.tournamentId || a.tournament_id || '')
    var btid = String(b.tournamentId || b.tournament_id || '')
    if (atid < btid) return -1
    if (atid > btid) return 1
    var ag = Number(a.gameNumber || a.game_number || a.game || 0)
    var bg = Number(b.gameNumber || b.game_number || b.game || 0)
    return ag - bg
  })
  return copy
}

function computeMovers(players, gamesWindow) {
  if (!Array.isArray(players)) return []
  var movers = []
  for (var i = 0; i < players.length; i++) {
    var p = players[i]
    if (!p || !p.clashHistory || p.clashHistory.length === 0) continue
    var hist = sortHistAsc(p.clashHistory)
    var start = Math.max(0, hist.length - gamesWindow)
    var window = hist.slice(start)
    var gained = 0
    for (var j = 0; j < window.length; j++) {
      gained += window[j].points || window[j].pts || 0
    }
    // Players with zero or negative window gain are excluded so the panel only
    // celebrates upward momentum. Players whose clashHistory hasn't enriched
    // yet may briefly read as "no movement" until the AppContext fetch lands.
    if (gained <= 0) continue
    var avgPlace = 0
    for (var k = 0; k < window.length; k++) {
      avgPlace += window[k].placement || window[k].place || 0
    }
    avgPlace = avgPlace / Math.max(1, window.length)
    movers.push({
      id: p.id,
      name: p.name,
      pts: p.pts || 0,
      gained: gained,
      games: window.length,
      avgPlace: avgPlace,
    })
  }
  movers.sort(function (a, b) { return b.gained - a.gained })
  return movers
}

function placeColor(p) {
  if (p <= 1.5) return 'text-primary'
  if (p <= 3) return 'text-tertiary'
  if (p <= 4) return 'text-secondary'
  return 'text-on-surface-variant/60'
}

export default function TopMoversCard(props) {
  var players = props.players
  var gamesWindow = props.gamesWindow || 5
  var limit = props.limit || 5
  var navigate = useNavigate()

  var movers = useMemo(function () {
    return computeMovers(players || [], gamesWindow).slice(0, limit)
  }, [players, gamesWindow, limit])

  if (movers.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="trending_up" className="text-tertiary" />
          <h3 className="font-display text-base tracking-wide">RECENT MOVERS</h3>
        </div>
        <div className="text-xs text-on-surface-variant/60">
          No recent activity yet. Movers will appear once players post results.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="trending_up" className="text-tertiary" />
          <h3 className="font-display text-base tracking-wide">RECENT MOVERS</h3>
        </div>
        <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          last {gamesWindow} games
        </span>
      </div>
      <div className="space-y-2">
        {movers.map(function (m, idx) {
          return (
            <button
              key={m.id || m.name || idx}
              type="button"
              onClick={function () { navigate('/player/' + encodeURIComponent(m.name)) }}
              className="w-full text-left rounded-lg border border-outline-variant/15 bg-surface-container-low/60 hover:bg-surface-container hover:border-tertiary/30 transition-colors p-2.5 sm:p-3 flex items-center gap-3 group"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-tertiary/15 border border-tertiary/30 flex items-center justify-center font-mono font-bold text-tertiary text-xs">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm tracking-wide truncate">
                  {m.name}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-on-surface-variant/60">
                  <span>{m.pts} pts total</span>
                  <span className={placeColor(m.avgPlace)}>
                    AVP {m.avgPlace.toFixed(2)}
                  </span>
                  <span>{m.games}G</span>
                </div>
              </div>
              <div className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-tertiary/40 bg-tertiary/10 text-tertiary font-mono text-xs font-bold">
                <Icon name="north_east" size={12} />
                +{m.gained}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
