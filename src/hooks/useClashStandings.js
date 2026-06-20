import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { buildClashDayStandings } from '../lib/clashSummary'

// Module-level cache so switching between clashes is instant and we never refetch
// a clash we already loaded this session. Keyed by tournament id.
var clashStandingsCache = {}

export function useClashStandings(tournamentId) {
  var ctx = useApp()
  var players = ctx.players || []

  var _state = useState({ standings: [], champion: null, loading: false, error: null })
  var state = _state[0]
  var setState = _state[1]

  useEffect(function () {
    if (!tournamentId || !supabase || !supabase.from) {
      setState({ standings: [], champion: null, loading: false, error: null })
      return
    }

    var cached = clashStandingsCache[tournamentId]
    if (cached) {
      var rebuilt = buildClashDayStandings(cached.results, players, cached.gameResults)
      setState({ standings: rebuilt, champion: rebuilt[0] || null, loading: false, error: null })
      return
    }

    var cancelled = false
    setState(function (s) { return Object.assign({}, s, { loading: true, error: null }) })

    Promise.all([
      supabase.from('tournament_results')
        .select('player_id,final_placement,total_points')
        .eq('tournament_id', tournamentId)
        .order('final_placement', { ascending: true }),
      supabase.from('game_results')
        .select('player_id,placement,game_number')
        .eq('tournament_id', tournamentId)
    ]).then(function (res) {
      if (cancelled) return
      var rRes = res[0]
      var gRes = res[1]
      if (rRes && rRes.error) {
        setState({ standings: [], champion: null, loading: false, error: rRes.error })
        return
      }
      var results = (rRes && rRes.data) || []
      var gameResults = (gRes && !gRes.error && gRes.data) ? gRes.data : []
      clashStandingsCache[tournamentId] = { results: results, gameResults: gameResults }
      var standings = buildClashDayStandings(results, players, gameResults)
      setState({ standings: standings, champion: standings[0] || null, loading: false, error: null })
    }).catch(function (e) {
      if (cancelled) return
      setState({ standings: [], champion: null, loading: false, error: e })
    })

    return function () { cancelled = true }
  }, [tournamentId, players])

  return state
}
