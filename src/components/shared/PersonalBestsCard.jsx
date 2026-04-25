import { useMemo } from 'react'
import { Icon } from '../ui'

function tournamentKey(entry) {
  return String(entry.tournamentId || entry.tournament_id || entry.clashId || entry.clash_id || '')
}

function gameOrder(entry) {
  return Number(entry.gameNumber || entry.game_number || entry.game || 0)
}

function groupByClash(hist) {
  if (!Array.isArray(hist)) return []
  var groups = {}
  for (var i = 0; i < hist.length; i++) {
    var e = hist[i]
    var key = tournamentKey(e) || ('idx_' + i)
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  }
  var arr = []
  for (var k in groups) {
    if (Object.prototype.hasOwnProperty.call(groups, k)) {
      var games = groups[k].slice().sort(function (a, b) { return gameOrder(a) - gameOrder(b) })
      arr.push({ key: k, games: games })
    }
  }
  return arr
}

function computeBests(player) {
  var hist = player && player.clashHistory
  if (!Array.isArray(hist) || hist.length === 0) {
    return null
  }

  var clashes = groupByClash(hist)
  var bestClashPts = 0
  var bestClashAvp = 0
  var bestClashAvpKey = null
  var mostTop4InClash = 0
  var bestClashGames = 0

  for (var i = 0; i < clashes.length; i++) {
    var games = clashes[i].games
    var pts = 0
    var top4 = 0
    var placeSum = 0
    var counted = 0
    for (var j = 0; j < games.length; j++) {
      var g = games[j]
      pts += Number(g.points || g.pts || 0)
      var place = Number(g.placement || g.place || 0)
      if (place > 0) {
        placeSum += place
        counted += 1
        if (place <= 4) top4 += 1
      }
    }
    if (pts > bestClashPts) bestClashPts = pts
    if (top4 > mostTop4InClash) mostTop4InClash = top4
    if (counted >= 3) {
      var avp = placeSum / counted
      if (bestClashAvpKey === null || avp < bestClashAvp) {
        bestClashAvp = avp
        bestClashAvpKey = clashes[i].key
        bestClashGames = counted
      }
    }
  }

  var longestWinStreak = 0
  var run = 0
  var allGames = hist.slice().sort(function (a, b) {
    var ka = tournamentKey(a)
    var kb = tournamentKey(b)
    if (ka < kb) return -1
    if (ka > kb) return 1
    return gameOrder(a) - gameOrder(b)
  })
  for (var k = 0; k < allGames.length; k++) {
    var pl = Number(allGames[k].placement || allGames[k].place || 0)
    if (pl === 1) {
      run += 1
      if (run > longestWinStreak) longestWinStreak = run
    } else {
      run = 0
    }
  }

  return {
    bestClashPts: bestClashPts,
    bestClashAvp: bestClashAvpKey ? bestClashAvp : 0,
    bestClashAvpGames: bestClashGames,
    mostTop4InClash: mostTop4InClash,
    longestWinStreak: longestWinStreak,
    totalClashes: clashes.length,
  }
}

function StatBlock(props) {
  var icon = props.icon
  var label = props.label
  var value = props.value
  var sub = props.sub
  var tone = props.tone || 'primary'
  var ring = 'border-' + tone + '/30'
  var iconWrap = 'bg-' + tone + '/15 text-' + tone

  return (
    <div className={'rounded-xl border ' + ring + ' bg-surface-container-low/60 p-3 sm:p-4 flex items-start gap-3'}>
      <div className={'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ' + iconWrap}>
        <Icon name={icon} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 truncate">
          {label}
        </div>
        <div className="font-display text-xl tracking-wide text-on-surface mt-0.5">
          {value}
        </div>
        {sub && (
          <div className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5 truncate">
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PersonalBestsCard(props) {
  var player = props.player

  var bests = useMemo(function () {
    return computeBests(player)
  }, [player])

  if (!bests) return null
  if (bests.totalClashes === 0) return null

  var anyValue = bests.bestClashPts > 0 || bests.longestWinStreak > 0 || bests.mostTop4InClash > 0 || bests.bestClashAvpGames >= 3
  if (!anyValue) return null

  var avpStr = bests.bestClashAvpGames >= 3 ? bests.bestClashAvp.toFixed(2) : '-'
  var avpSub = bests.bestClashAvpGames >= 3 ? (bests.bestClashAvpGames + ' games in clash') : 'Need 3+ games'
  var streakStr = bests.longestWinStreak > 0 ? String(bests.longestWinStreak) : '-'
  var streakSub = bests.longestWinStreak >= 2 ? 'consecutive wins' : (bests.longestWinStreak === 1 ? 'lone wins so far' : 'no wins yet')

  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/40 backdrop-blur p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="auto_awesome" className="text-primary" />
          <h3 className="font-display text-base tracking-wide">PERSONAL BESTS</h3>
        </div>
        <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          {bests.totalClashes} clashes tracked
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <StatBlock
          icon="local_fire_department"
          label="Top Clash Points"
          value={bests.bestClashPts > 0 ? bests.bestClashPts : '-'}
          sub={bests.bestClashPts > 0 ? 'single tournament total' : 'no clash recorded'}
          tone="primary"
        />
        <StatBlock
          icon="emoji_events"
          label="Best Clash AVP"
          value={avpStr}
          sub={avpSub}
          tone="tertiary"
        />
        <StatBlock
          icon="bolt"
          label="Longest Win Streak"
          value={streakStr}
          sub={streakSub}
          tone="secondary"
        />
        <StatBlock
          icon="military_tech"
          label="Most Top4s in a Clash"
          value={bests.mostTop4InClash > 0 ? bests.mostTop4InClash : '-'}
          sub={bests.mostTop4InClash > 0 ? 'top4 finishes in one tournament' : 'no top4 yet'}
          tone="primary"
        />
      </div>
    </div>
  )
}
