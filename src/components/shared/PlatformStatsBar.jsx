import { useState, useEffect } from 'react'
import { Icon } from '../ui'
import { supabase } from '../../lib/supabase.js'

function compact(n) {
  if (typeof n !== 'number' || isNaN(n)) return '-'
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function StatTile(props) {
  var icon = props.icon
  var label = props.label
  var value = props.value
  var tone = props.tone || 'primary'
  var loading = !!props.loading

  var ring = 'border-' + tone + '/30'
  var iconWrap = 'bg-' + tone + '/15 text-' + tone

  return (
    <div className={'rounded-2xl border ' + ring + ' bg-surface-container p-4 sm:p-5 flex items-center gap-3'}>
      <div className={'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ' + iconWrap}>
        <Icon name={icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 truncate">
          {label}
        </div>
        <div className="font-display text-2xl tracking-wide text-on-surface mt-0.5">
          {loading ? '-' : value}
        </div>
      </div>
    </div>
  )
}

export default function PlatformStatsBar(props) {
  var compactMode = !!props.compact

  var _stats = useState({ tournaments: 0, players: 0, prizePool: 0, totalGames: 0 })
  var stats = _stats[0]
  var setStats = _stats[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  useEffect(function () {
    if (!supabase || !supabase.from) {
      setLoading(false)
      return
    }
    var cancelled = false

    function load() {
      // Marketing stats are season-only — completed tournament count and
      // total games shown publicly must not include custom or flash events.
      // Read the canonical prize pool from prize_pool_json (the flat
      // prize_pool column is legacy and was never populated by the rebuilt
      // admin flow).
      var tournamentsQ = supabase.from('tournaments').select('id,prize_pool,prize_pool_json').eq('type', 'season_clash').eq('phase', 'complete').limit(2000)
      var playersQ = supabase.from('players').select('id', { count: 'exact', head: true }).eq('banned', false)

      tournamentsQ
        .then(function (tRes) {
          if (cancelled) return
          var seasonIds = (tRes && tRes.data ? tRes.data : []).map(function (t) { return t.id })
          var gamesQ = seasonIds.length === 0
            ? Promise.resolve({ count: 0 })
            : supabase.from('game_results').select('id', { count: 'exact', head: true }).in('tournament_id', seasonIds)
          Promise.all([Promise.resolve(tRes), playersQ, gamesQ])
            .then(function (results) {
              if (cancelled) return
              var tournRes = results[0]
              var playerRes = results[1]
              var gamesRes = results[2]

              var completedTournaments = 0
              var prizePool = 0
              if (tournRes && tournRes.data) {
                completedTournaments = tournRes.data.length
                for (var i = 0; i < tournRes.data.length; i++) {
                  var row = tournRes.data[i]
                  var poolJson = row.prize_pool_json
                  if (typeof poolJson === 'string') { try { poolJson = JSON.parse(poolJson) } catch (e) { poolJson = null } }
                  if (Array.isArray(poolJson)) {
                    for (var j = 0; j < poolJson.length; j++) prizePool += Number(poolJson[j].amount) || 0
                  } else {
                    prizePool += Number(row.prize_pool) || 0
                  }
                }
              }
              var playerCount = (playerRes && typeof playerRes.count === 'number') ? playerRes.count : 0
              var gameCount = (gamesRes && typeof gamesRes.count === 'number') ? gamesRes.count : 0

              setStats({
                tournaments: completedTournaments,
                players: playerCount,
                prizePool: prizePool,
                totalGames: gameCount,
              })
              setLoading(false)
            })
            .catch(function () {
              if (!cancelled) setLoading(false)
            })
        })
        .catch(function () {
          if (!cancelled) setLoading(false)
        })
    }

    load()
    return function () { cancelled = true }
  }, [])

  var prizeStr = stats.prizePool > 0 ? '$' + compact(stats.prizePool) : '-'

  if (compactMode) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatTile icon="emoji_events" label="Clashes Run" value={compact(stats.tournaments)} tone="primary" loading={loading} />
        <StatTile icon="group" label="Players" value={compact(stats.players)} tone="secondary" loading={loading} />
        <StatTile icon="payments" label="Prize Pool" value={prizeStr} tone="tertiary" loading={loading} />
        <StatTile icon="sports_esports" label="Games Played" value={compact(stats.totalGames)} tone="primary" loading={loading} />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-outline-variant/15 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="leaderboard" className="text-primary" />
        <h3 className="font-display text-base tracking-wide">PLATFORM STATS</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatTile icon="emoji_events" label="Clashes Run" value={compact(stats.tournaments)} tone="primary" loading={loading} />
        <StatTile icon="group" label="Players" value={compact(stats.players)} tone="secondary" loading={loading} />
        <StatTile icon="payments" label="Prize Pool" value={prizeStr} tone="tertiary" loading={loading} />
        <StatTile icon="sports_esports" label="Games Played" value={compact(stats.totalGames)} tone="primary" loading={loading} />
      </div>
    </div>
  )
}
