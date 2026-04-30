import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { PTS } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import SponsorShowcase from '../components/shared/SponsorShowcase'
import LiveDashboardLayout from '../components/shared/LiveDashboardLayout'

function ClashLiveDashboard() {
  var ctx = useApp()
  var navigate = useNavigate()
  var players = ctx.players || []
  var tournamentState = ctx.tournamentState || {}
  var currentUser = ctx.currentUser

  var clashId = tournamentState.clashId || ''
  var clashName = tournamentState.clashName || 'TFT Clash'
  var round = tournamentState.round || 1
  var totalGames = tournamentState.totalGames || 4
  var cutLine = tournamentState.cutLine || 0
  var cutAfterGame = tournamentState.cutAfterGame || 0
  var lobbies = tournamentState.lobbies || []
  var lockedLobbies = tournamentState.lockedLobbies || []
  var region = tournamentState.region || 'EU'
  var tournamentType = tournamentState.tournamentType || 'season_clash'

  var checkedIn = useMemo(function () {
    return players.filter(function (p) { return p.checkedIn })
  }, [players])

  var totalLobbies = lobbies.length || Math.max(1, Math.ceil(checkedIn.length / 8))

  var standings = useMemo(function () {
    var rows = checkedIn.map(function (p) {
      var earned = 0
      var games = 0
      ;(p.clashHistory || []).forEach(function (h) {
        if (h.clashId === clashId) {
          earned += (PTS[h.place || h.placement] || 0)
          games += 1
        }
      })
      return { id: p.id, name: p.name, points: earned, games: games }
    })
    rows.sort(function (a, b) { return b.points - a.points })
    return rows
  }, [checkedIn, clashId])

  var myStatus = useMemo(function () {
    if (!currentUser) return null
    var myName = currentUser.username || currentUser.name
    if (!myName) return null
    var idx = -1
    for (var i = 0; i < standings.length; i++) {
      if (standings[i].name === myName) { idx = i; break }
    }
    if (idx < 0) return null
    var me = standings[idx]
    var myLobbyNumber = null
    for (var j = 0; j < lobbies.length; j++) {
      var L = lobbies[j]
      var roster = L.players || L.roster || []
      var found = false
      for (var k = 0; k < roster.length; k++) {
        var rp = roster[k]
        if (rp && (rp.name === myName || rp.id === currentUser.id)) { found = true; break }
      }
      if (found) { myLobbyNumber = L.lobby_number || (j + 1); break }
    }
    return { position: idx + 1, points: me.points, games: me.games, lobbyNumber: myLobbyNumber }
  }, [currentUser, standings, lobbies])

  var ticker = useMemo(function () {
    var entries = []
    var locked = lockedLobbies.slice().reverse()
    for (var i = 0; i < locked.length && entries.length < 6; i++) {
      entries.push({ icon: 'lock', tone: 'muted', text: 'Lobby ' + locked[i] + ' locked' })
    }
    var winners = []
    checkedIn.forEach(function (p) {
      ;(p.clashHistory || []).forEach(function (h) {
        if (h.clashId === clashId && (h.place || h.placement) === 1) {
          winners.push({ name: p.name, lobby: h.lobbyNumber || h.lobby_number || null, round: h.round || null })
        }
      })
    })
    winners.sort(function (a, b) { return (b.round || 0) - (a.round || 0) })
    winners.slice(0, 6).forEach(function (w) {
      entries.push({
        icon: 'star',
        tone: 'win',
        text: w.name + ' won ' + (w.lobby ? 'Lobby ' + w.lobby : 'their lobby') + (w.round ? ' (R' + w.round + ')' : '')
      })
    })
    return entries.slice(0, 12)
  }, [lockedLobbies, checkedIn, clashId])

  var titleParts = clashName.includes(':')
    ? { left: clashName.split(':')[0].trim(), right: clashName.split(':').slice(1).join(':').trim() }
    : { left: 'TFT Clash', right: clashName }

  var bracketHref = '/bracket' + (window.location.search || '')
  function goBracket() { navigate(bracketHref) }

  return (
    <PageLayout>
      <LiveDashboardLayout
        titleParts={titleParts}
        pills={[
          { label: 'LIVE', tone: 'live' },
          { label: region, tone: 'neutral' },
          { label: tournamentType === 'season_clash' ? 'SEASON CLASH' : 'CUSTOM', tone: 'muted' }
        ]}
        secondaryMeta={'Round ' + round + ' of ' + totalGames}
        cta={{ label: 'View Full Bracket', icon: 'grid_view', onClick: goBracket }}
        kpis={[
          { icon: 'schedule', label: 'Round', value: round + ' / ' + totalGames, sub: round < totalGames ? ((totalGames - round) + ' to go') : 'final round' },
          { icon: 'groups', label: 'Players', value: String(checkedIn.length), sub: 'checked in' },
          { icon: 'lock', label: 'Lobbies', value: lockedLobbies.length + ' / ' + totalLobbies, sub: 'locked this round' },
          { icon: 'content_cut', label: 'Cut Line', value: cutLine > 0 ? (cutLine + ' pts') : 'None', sub: cutLine > 0 ? ('after R' + cutAfterGame) : 'no cut configured', accent: cutLine > 0 }
        ]}
        myStatus={myStatus ? Object.assign({}, myStatus, { onJump: goBracket }) : null}
        standings={standings}
        cutLine={cutLine}
        cutAfterRound={cutAfterGame}
        currentRound={round}
        ticker={ticker}
        timeline={{ round: round, totalRounds: totalGames, lockedThisRound: lockedLobbies.length, lobbiesThisRound: totalLobbies }}
        fullStandingsLink={{ label: 'See full standings in bracket', onClick: goBracket }}
        footer={<SponsorShowcase />}
      />
    </PageLayout>
  )
}

export default ClashLiveDashboard
