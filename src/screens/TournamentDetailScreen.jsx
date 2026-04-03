import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Icon } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'

var PLACE_POINTS = [
  { place: '1st', pts: '8 PTS', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  { place: '2nd', pts: '7 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
  { place: '3rd', pts: '6 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
  { place: '4th', pts: '5 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
]

var PRIZE_BARS = [
  { label: '1st PLACE', pct: '50%', barBg: 'bg-primary/20', barBorder: 'border-primary', textColor: 'text-primary' },
  { label: '2nd PLACE', pct: '25%', barBg: 'bg-on-surface/10', barBorder: 'border-on-surface/40', textColor: 'text-on-surface/70' },
  { label: '3rd PLACE', pct: '15%', barBg: 'bg-on-surface/5', barBorder: 'border-on-surface/20', textColor: 'text-on-surface/70' },
  { label: '4th PLACE', pct: '10%', barBg: 'bg-on-surface/5', barBorder: 'border-on-surface/10', textColor: 'text-on-surface/70' },
]

var TIEBREAKERS = [
  { n: '01', title: 'Total Tournament Points', desc: 'Sum of all placement points across games.' },
  { n: '02', title: 'Wins + Top 4s', desc: 'Wins count twice toward the tiebreaker score.' },
  { n: '03', title: 'Most of Each Placement', desc: 'Compare 1st counts, then 2nd, then 3rd...' },
  { n: '04', title: 'Most Recent Game Finish', desc: 'Higher placement in the most recent game wins.' },
]

var DETAIL_TABS = [
  ['overview', 'Overview'],
  ['bracket', 'Bracket'],
  ['standings', 'Standings'],
  ['rules', 'Rules'],
]

var PLACE_COLORS = ['#FFC66B', '#C0C0C0', '#CD7F32', '#67E2D9', '#D9B9FF', '#67E2D9', '#D5C4AF', '#8896A8']

function getPlaceColor(placement) {
  return PLACE_COLORS[Math.min(placement - 1, 7)] || '#8896A8'
}

function StatusBadge(props) {
  var status = props.status
  if (status === 'live') {
    return (
      <div className="inline-flex items-center gap-2 bg-success/10 border border-success/30 px-3 py-1 rounded-sm">
        <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
        <span className="font-sans text-success text-xs font-bold uppercase tracking-widest">LIVE</span>
      </div>
    )
  }
  if (status === 'upcoming') {
    return (
      <div className="inline-flex items-center gap-2 bg-tertiary/10 border border-tertiary/20 px-3 py-1 rounded-sm">
        <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
        <span className="font-sans text-tertiary text-xs font-bold uppercase tracking-widest">UPCOMING</span>
      </div>
    )
  }
  if (status === 'complete') {
    return (
      <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1 rounded-sm">
        <span className="font-sans text-primary text-xs font-bold uppercase tracking-widest">COMPLETED</span>
      </div>
    )
  }
  return null
}

function PlayerRow(props) {
  var username = props.username
  var index = props.index
  var borderColor = index === 0 ? 'border-primary' : index % 2 === 0 ? 'border-secondary' : 'border-tertiary'
  return (
    <div className={'flex items-center justify-between bg-surface-container p-3 border-l-2 ' + borderColor}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
          <Icon name="person" className="text-on-surface/40 text-base" />
        </div>
        <span className="font-mono text-sm font-bold text-on-surface">{username}</span>
      </div>
      <span className={'bg-surface-container-highest text-on-surface/60 text-[10px] font-sans px-2 py-0.5 rounded-sm border border-outline-variant/20 uppercase tracking-wider'}>
        {'#' + (index + 1)}
      </span>
    </div>
  )
}

function RoundCard(props) {
  var rk = props.rk
  var results = props.results
  var players = props.players
  return (
    <div className="bg-surface-container-low border-l-4 border-tertiary">
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <h3 className="font-serif text-xl italic font-bold text-on-surface">{rk}</h3>
        <Icon name="emoji_events" className="text-tertiary" />
      </div>
      <div className="flex flex-col gap-1 px-4 pb-4">
        {results.map(function(r, i) {
          var pc = getPlaceColor(r.placement)
          var playerName = ((players || []).find(function(p) { return p.id === r.player_id || p.dbId === r.player_id; }) || {}).name || r.player_id
          return (
            <div key={r.player_id} className={'flex items-center gap-3 px-3 py-2 rounded-sm ' + (r.placement <= 3 ? 'bg-primary/5 border border-primary/10' : 'bg-surface-container border border-outline-variant/5')}>
              <div className="w-7 text-center font-mono text-sm font-bold flex-shrink-0" style={{ color: pc }}>{r.placement}</div>
              <div className="flex-1 font-mono text-sm text-on-surface">{playerName}</div>
              <div className="font-mono text-sm font-bold text-primary">{r.points + 'pts'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TournamentDetailScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var featuredEvents = ctx.featuredEvents
  var setFeaturedEvents = ctx.setFeaturedEvents
  var currentUser = ctx.currentUser
  var setAuthScreen = ctx.setAuthScreen
  var toast = ctx.toast
  var players = ctx.players
  var screen = ctx.screen
  var setScreen = ctx.setScreen

  var eventId = screen && screen.indexOf('tournament-') === 0 ? screen.replace('tournament-', '') : null
  var contextEvent = (featuredEvents || []).find(function(e) { return String(e.id) === eventId || e.screen === screen; })

  var [fallbackEvent, setFallbackEvent] = useState(null)
  var [detailTab, setDetailTab] = useState('overview')
  var [tournamentResults, setTournamentResults] = useState([])
  var [loadingResults, setLoadingResults] = useState(false)

  useEffect(function() {
    if (!contextEvent && eventId && supabase.from) {
      supabase.from('tournaments').select('*').eq('id', eventId).single()
        .then(function(res) {
          if (res.data) setFallbackEvent(res.data)
        }).catch(function() {})
    }
  }, [contextEvent, eventId])

  var event = contextEvent || fallbackEvent

  useEffect(function() {
    if (!event || !event.dbTournamentId || !supabase.from) return
    setLoadingResults(true)
    supabase.from('game_results').select('*').eq('tournament_id', event.dbTournamentId).order('round_number', { ascending: true }).order('placement', { ascending: true })
      .then(function(res) {
        setLoadingResults(false)
        if (res.error) { toast('Failed to load results', 'error'); return; }
        if (res.data) setTournamentResults(res.data)
      }).catch(function() { setLoadingResults(false); toast('Failed to load results', 'error'); })
  }, [event ? event.dbTournamentId : null])

  if (!event) return null

  var isRegistered = currentUser && event.registeredIds && event.registeredIds.indexOf(currentUser.username) !== -1
  var isFull = event.registered >= event.size
  var isUpcoming = event.status === 'upcoming'
  var isLive = event.status === 'live'
  var isCompleted = event.status === 'complete'
  var canRegister = !isCompleted && !isFull && !isRegistered
  var regPercent = event.size > 0 ? Math.round((event.registered / event.size) * 100) : 0

  function handleRegister() {
    if (!currentUser) { setAuthScreen('login'); return; }
    if (isRegistered) {
      setFeaturedEvents(function(evts) { return evts.map(function(ev) {
        if (ev.id !== event.id) return ev
        var newIds = (ev.registeredIds || []).filter(function(u) { return u !== currentUser.username; })
        return Object.assign({}, ev, { registeredIds: newIds, registered: Math.max(0, (ev.registered || 0) - 1) })
      }); })
      if (supabase.from && currentUser && currentUser.auth_user_id && event.dbTournamentId) {
        supabase.from('registrations').delete().eq('tournament_id', event.dbTournamentId).eq('player_id', currentUser.id).then(function(r) { if (r.error) { toast('Unregister failed', 'error'); } }).catch(function() { toast('Unregister failed', 'error'); })
      }
      toast('Unregistered from ' + event.name, 'info')
    } else {
      if (isFull) { toast('Tournament is full', 'error'); return; }
      setFeaturedEvents(function(evts) { return evts.map(function(ev) {
        if (ev.id !== event.id) return ev
        var newIds = (ev.registeredIds || []).concat([currentUser.username])
        return Object.assign({}, ev, { registeredIds: newIds, registered: (ev.registered || 0) + 1 })
      }); })
      if (supabase.from && currentUser && currentUser.auth_user_id && event.dbTournamentId) {
        supabase.from('registrations').upsert({ tournament_id: event.dbTournamentId, player_id: currentUser.id, status: 'registered' }, { onConflict: 'tournament_id,player_id' })
          .then(function(r) { if (r && r.error) toast('Registration sync failed', 'error'); }).catch(function() { toast('Registration sync failed', 'error'); })
      }
      toast('Registered for ' + event.name + '!', 'success')
    }
  }

  // Build player name lookup map
  var playerNameMap = {}
  ;(players || []).forEach(function(p) { playerNameMap[p.id] = p.username || p.name; })

  // Derive standings from game_results
  var standings = []
  if (tournamentResults.length > 0) {
    var playerMap = {}
    tournamentResults.forEach(function(r) {
      if (!playerMap[r.player_id]) playerMap[r.player_id] = { player_id: r.player_id, playerName: playerNameMap[r.player_id] || 'Unknown Player', total: 0, games: [] }
      playerMap[r.player_id].total += r.points || 0
      playerMap[r.player_id].games.push({ round: r.round_number, placement: r.placement, points: r.points })
    })
    standings = Object.values(playerMap).sort(function(a, b) { return b.total - a.total; })
  }

  // Compute bracket rounds
  var bracketRounds = {}
  var bracketRoundKeys = []
  if (tournamentResults.length > 0) {
    tournamentResults.forEach(function(r) {
      var rk = 'Round ' + r.round_number
      if (!bracketRounds[rk]) bracketRounds[rk] = []
      bracketRounds[rk].push(r)
    })
    bracketRoundKeys = Object.keys(bracketRounds).sort()
  }

  var registeredIds = event.registeredIds || []

  return (
    <PageLayout>
      <style>{`
        .gold-gradient {
          background: linear-gradient(135deg, #FFC66B 0%, #E8A838 100%);
        }
        .text-shadow-glow {
          text-shadow: 0 0 15px rgba(253, 186, 73, 0.4);
        }
        .glass-panel-cta {
          background: rgba(52, 52, 60, 0.6);
          backdrop-filter: blur(24px);
        }
      `}</style>

      {/* Back nav */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={function() { setScreen('featured') }}
          className="inline-flex items-center gap-1.5 text-primary text-xs font-sans font-bold uppercase tracking-wider hover:opacity-80 transition-opacity"
        >
          <Icon name="arrow_back" className="text-sm" />
          Back to Events
        </button>
      </div>

      {/* Hero Banner */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden mb-0">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-surface-container-high to-surface-container-lowest">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"></div>
        </div>
        <div className="relative z-10 w-full px-6 pb-10 pt-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <StatusBadge status={event.status} />
              <h1 className="font-serif text-5xl md:text-7xl font-black italic text-on-surface leading-none tracking-tighter">
                {event.logo && <span className="mr-3 not-italic">{event.logo}</span>}
                <span className="text-primary text-shadow-glow">{event.name}</span>
              </h1>
              <div className="flex flex-wrap gap-6 pt-2">
                {event.prizePool && (
                  <div className="flex flex-col">
                    <span className="font-sans text-on-surface/40 text-[10px] uppercase tracking-widest">Prize Pool</span>
                    <span className="font-display text-3xl text-on-surface">{event.prizePool}</span>
                  </div>
                )}
                {event.date && (
                  <div className="flex flex-col">
                    <span className="font-sans text-on-surface/40 text-[10px] uppercase tracking-widest">Date</span>
                    <span className="font-display text-3xl text-on-surface">{event.date}</span>
                  </div>
                )}
                {event.format && (
                  <div className="flex flex-col">
                    <span className="font-sans text-on-surface/40 text-[10px] uppercase tracking-widest">Format</span>
                    <span className="font-display text-3xl text-on-surface">{event.format}</span>
                  </div>
                )}
                {event.region && (
                  <div className="flex flex-col">
                    <span className="font-sans text-on-surface/40 text-[10px] uppercase tracking-widest">Region</span>
                    <span className="font-display text-3xl text-on-surface">{event.region}</span>
                  </div>
                )}
              </div>
              {(event.tags || []).length > 0 && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {(event.tags || []).map(function(t) {
                    return (
                      <span key={t} className="bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-sans px-3 py-0.5 rounded-sm uppercase tracking-wider">
                        {t}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 md:items-end flex-shrink-0">
              {!isCompleted && currentUser && isRegistered && (
                <button
                  onClick={handleRegister}
                  className="px-10 py-4 rounded-full font-sans font-black text-lg uppercase tracking-widest border border-success/40 text-success bg-success/10 hover:bg-success/20 transition-colors"
                >
                  Registered - Withdraw
                </button>
              )}
              {!isCompleted && currentUser && canRegister && (
                <button
                  onClick={handleRegister}
                  className="gold-gradient px-10 py-4 rounded-full font-sans font-black text-lg text-on-primary uppercase tracking-widest shadow-[0_0_30px_rgba(253,186,73,0.3)] hover:scale-105 transition-transform"
                >
                  Register Now
                </button>
              )}
              {!isCompleted && currentUser && isFull && !isRegistered && (
                <button disabled className="px-10 py-4 rounded-full font-sans font-black text-lg uppercase tracking-widest border border-outline-variant/20 text-on-surface/40 cursor-not-allowed">
                  Tournament Full
                </button>
              )}
              {!isCompleted && !currentUser && (
                <button
                  onClick={function() { setAuthScreen('login') }}
                  className="gold-gradient px-10 py-4 rounded-full font-sans font-black text-lg text-on-primary uppercase tracking-widest shadow-[0_0_30px_rgba(253,186,73,0.3)] hover:scale-105 transition-transform"
                >
                  Sign In to Register
                </button>
              )}
              <p className="text-on-surface/40 text-xs text-center font-sans uppercase tracking-wider">
                {event.registered}/{event.size} players registered ({regPercent}%)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-outline-variant/15 px-4">
        <div className="flex gap-0 overflow-x-auto">
          {DETAIL_TABS.map(function(arr) {
            return (
              <button
                key={arr[0]}
                onClick={function() { setDetailTab(arr[0]) }}
                className={'px-5 py-4 font-sans font-bold text-sm uppercase tracking-widest border-b-2 transition-all flex-shrink-0 ' + (detailTab === arr[0] ? 'border-primary text-primary' : 'border-transparent text-on-surface/50 hover:text-on-surface/80')}
              >
                {arr[1]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Overview Tab */}
      {detailTab === 'overview' && (
        <section className="px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left column */}
            <div className="lg:col-span-8 space-y-8">

              {/* Champion banner */}
              {isCompleted && event.champion && (
                <div className="bg-surface-container-low p-8 border-l-4 border-primary">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon name="emoji_events" className="text-primary text-3xl" />
                    <h2 className="font-serif text-3xl italic font-bold text-primary">Champion</h2>
                  </div>
                  <div className="font-display text-4xl text-on-surface mb-4">{event.champion}</div>
                  {event.top4 && event.top4.length > 0 && (
                    <div>
                      <div className="font-sans text-on-surface/40 text-[10px] uppercase tracking-[0.2em] mb-3">Top 4 Finishers</div>
                      <div className="flex gap-3 flex-wrap">
                        {event.top4.map(function(p, i) {
                          return (
                            <div key={p} className={'flex items-center gap-2 bg-surface-container-high px-4 py-2 border border-outline-variant/10 ' + (i === 0 ? 'border-primary/30' : '')}>
                              <span className="font-mono text-xs font-bold" style={{ color: PLACE_COLORS[i] || '#D5C4AF' }}>{i + 1}.</span>
                              <span className="font-mono text-sm text-on-surface">{p}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scoring Breakdown */}
              <div className="bg-surface-container-low p-8 border-l-4 border-tertiary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-3xl italic font-bold">Scoring Breakdown</h2>
                  <Icon name="leaderboard" className="text-tertiary text-2xl" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {PLACE_POINTS.map(function(pp) {
                    return (
                      <div key={pp.place} className={'p-4 border border-outline-variant/10 ' + pp.bg}>
                        <span className="font-sans text-on-surface/40 text-[10px] block mb-1 uppercase tracking-widest">{pp.place + ' PLACE'}</span>
                        <span className={'font-mono text-2xl font-bold ' + pp.color}>{'+' + pp.pts}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-6 text-on-surface/60 text-sm font-body leading-relaxed">
                  Points are accumulated across all rounds of play using the official EMEA rulebook. Full scoring table: 1st=8, 2nd=7, 3rd=6, 4th=5, 5th=4, 6th=3, 7th=2, 8th=1.
                </p>
              </div>

              {/* Rules bento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-surface-container-low p-6 flex flex-col gap-4">
                  <Icon name="gavel" className="text-primary text-3xl" />
                  <h3 className="font-sans text-xl font-bold tracking-widest uppercase">General Rules</h3>
                  <ul className="space-y-3 text-sm text-on-surface/70">
                    <li className="flex gap-3"><span className="text-primary font-mono">01</span> All players must meet the minimum rank requirement.</li>
                    <li className="flex gap-3"><span className="text-primary font-mono">02</span> No third-party overlays that influence gameplay.</li>
                    <li className="flex gap-3"><span className="text-primary font-mono">03</span> Official tournament lobby must be used at all times.</li>
                    <li className="flex gap-3"><span className="text-primary font-mono">04</span> Late arrivals may be removed at the host's discretion.</li>
                  </ul>
                </div>
                <div className="bg-surface-container-low p-6 flex flex-col gap-4">
                  <Icon name="schedule" className="text-secondary text-3xl" />
                  <h3 className="font-sans text-xl font-bold tracking-widest uppercase">Schedule</h3>
                  <div className="space-y-4">
                    {event.time && (
                      <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                        <span className="text-sm text-on-surface/70">Start Time</span>
                        <span className="font-mono text-xs text-secondary">{event.time}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                      <span className="text-sm text-on-surface/70">Format</span>
                      <span className="font-mono text-xs text-secondary">{event.format || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-on-surface">Player Cap</span>
                      <span className="font-mono text-xs text-primary">{event.size} players</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prize Distribution */}
              {Array.isArray(event.prize_pool_json) && event.prize_pool_json.length > 0 && (
                <div className="bg-surface-container-low p-8">
                  <h2 className="font-serif text-3xl italic font-bold mb-6">Prize Distribution</h2>
                  <div className="space-y-3">
                    {event.prize_pool_json.map(function(p, i) {
                      var pb = PRIZE_BARS[i] || PRIZE_BARS[PRIZE_BARS.length - 1]
                      return (
                        <div key={p.placement} className="relative h-12 flex items-center bg-surface-container-lowest">
                          <div className={'absolute inset-y-0 left-0 border-r-2 ' + pb.barBg + ' ' + pb.barBorder} style={{ width: pb.pct }}></div>
                          <div className="relative z-10 w-full flex justify-between px-4 font-mono">
                            <span className={pb.textColor + ' font-bold text-sm'}>{'#' + p.placement}</span>
                            <span className={pb.textColor + ' text-sm'}>{p.prize}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Host-only management link */}
              {currentUser && event.dbTournamentId && currentUser.id === event.host_id && (
                <div>
                  <button
                    onClick={function() { navigate('/host/dashboard') }}
                    className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/20 text-secondary font-sans font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-sm hover:bg-secondary/20 transition-colors"
                  >
                    <Icon name="manage_accounts" className="text-base" />
                    Manage Tournament
                  </button>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-4 space-y-8">

              {/* Registered players */}
              {registeredIds.length > 0 && (
                <div className="bg-surface-container-low p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-sans text-lg font-bold tracking-widest uppercase">
                      {'Tacticians (' + event.registered + '/' + event.size + ')'}
                    </h3>
                    <Icon name="groups" className="text-on-surface/40 text-lg" />
                  </div>
                  <div className="space-y-2">
                    {registeredIds.slice(0, 12).map(function(username, i) {
                      return <PlayerRow key={username} username={username} index={i} />
                    })}
                    {registeredIds.length > 12 && (
                      <div className="text-center pt-2">
                        <span className="font-sans text-on-surface/40 text-xs uppercase tracking-wider">
                          {'+' + (registeredIds.length - 12) + ' more registered'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Host and sponsor */}
              <div className="bg-surface-container-high p-8 flex flex-col items-center text-center">
                <span className="font-sans text-on-surface/40 text-[10px] uppercase tracking-[0.2em] mb-4">Hosted By</span>
                <div className="text-2xl font-serif font-black italic text-primary mb-2">{event.host || 'TFT Clash'}</div>
                {event.sponsor && (
                  <div>
                    <div className="w-24 h-px bg-outline-variant/20 mx-auto my-6"></div>
                    <span className="font-sans text-on-surface/40 text-[10px] uppercase tracking-[0.2em] mb-4 block">Presented By</span>
                    <div className="text-lg font-serif font-bold italic text-on-surface/60">{event.sponsor}</div>
                  </div>
                )}
              </div>

              {/* Sticky CTA */}
              {!isCompleted && (
                <div className="glass-panel-cta p-6 border border-primary/20 sticky top-24">
                  <h4 className="font-sans text-primary font-bold text-sm uppercase tracking-wider mb-2">
                    {isUpcoming ? 'Registration Open' : 'Live Now'}
                  </h4>
                  <p className="text-xs text-on-surface/60 mb-5 font-body leading-relaxed">
                    {event.description || 'Compete for glory and bragging rights in this featured TFT clash event.'}
                  </p>
                  {currentUser && isRegistered && (
                    <button
                      onClick={handleRegister}
                      className="w-full py-4 rounded-full font-sans font-black text-sm uppercase tracking-widest border border-success/40 text-success bg-success/10 hover:bg-success/20 transition-colors"
                    >
                      Registered - Withdraw
                    </button>
                  )}
                  {currentUser && canRegister && (
                    <button
                      onClick={handleRegister}
                      className="w-full gold-gradient py-4 rounded-full font-sans font-black text-sm text-on-primary uppercase tracking-widest hover:shadow-[0_0_20px_rgba(253,186,73,0.5)] transition-shadow"
                    >
                      Register Now
                    </button>
                  )}
                  {currentUser && isFull && !isRegistered && (
                    <button disabled className="w-full py-4 rounded-full font-sans font-black text-sm uppercase tracking-widest border border-outline-variant/20 text-on-surface/30 cursor-not-allowed">
                      Tournament Full
                    </button>
                  )}
                  {!currentUser && (
                    <button
                      onClick={function() { setAuthScreen('login') }}
                      className="w-full gold-gradient py-4 rounded-full font-sans font-black text-sm text-on-primary uppercase tracking-widest hover:shadow-[0_0_20px_rgba(253,186,73,0.5)] transition-shadow"
                    >
                      Sign In to Register
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Bracket Tab */}
      {detailTab === 'bracket' && (
        <section className="px-4 py-8">
          {loadingResults && (
            <div className="bg-surface-container-low p-10 text-center">
              <Icon name="hourglass_empty" className="text-on-surface/30 text-4xl mb-3" />
              <p className="font-sans text-on-surface/50 text-sm uppercase tracking-widest">Loading bracket data...</p>
            </div>
          )}
          {!loadingResults && tournamentResults.length === 0 && (
            <div className="bg-surface-container-low p-12 text-center border-l-4 border-outline-variant/20">
              <Icon name="account_tree" className="text-on-surface/20 text-5xl mb-4" />
              <h3 className="font-serif text-2xl italic font-bold text-on-surface mb-2">No Bracket Data Yet</h3>
              <p className="text-on-surface/50 text-sm font-body">Bracket and lobby assignments will appear here once the tournament begins and results are entered.</p>
            </div>
          )}
          {!loadingResults && bracketRoundKeys.length > 0 && (
            <div className="flex flex-col gap-6">
              {bracketRoundKeys.map(function(rk) {
                var roundResults = bracketRounds[rk].sort(function(a, b) { return a.placement - b.placement; })
                return <RoundCard key={rk} rk={rk} results={roundResults} players={players} />
              })}
            </div>
          )}
        </section>
      )}

      {/* Standings Tab */}
      {detailTab === 'standings' && (
        <section className="px-4 py-8">
          {loadingResults && (
            <div className="bg-surface-container-low p-10 text-center">
              <Icon name="hourglass_empty" className="text-on-surface/30 text-4xl mb-3" />
              <p className="font-sans text-on-surface/50 text-sm uppercase tracking-widest">Loading standings...</p>
            </div>
          )}
          {!loadingResults && standings.length === 0 && (
            <div className="bg-surface-container-low p-12 text-center border-l-4 border-outline-variant/20">
              <Icon name="bar_chart" className="text-on-surface/20 text-5xl mb-4" />
              <h3 className="font-serif text-2xl italic font-bold text-on-surface mb-2">No Standings Yet</h3>
              <p className="text-on-surface/50 text-sm font-body">Standings will update as games are played and results are entered.</p>
            </div>
          )}
          {standings.length > 0 && (
            <div className="bg-surface-container-low border-l-4 border-tertiary">
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <h2 className="font-serif text-3xl italic font-bold">Tournament Standings</h2>
                <Icon name="leaderboard" className="text-tertiary text-2xl" />
              </div>
              <div className="flex flex-col gap-1 px-4 pb-4">
                {standings.map(function(s, i) {
                  var pc = PLACE_COLORS[Math.min(i, 7)] || '#D5C4AF'
                  return (
                    <div
                      key={s.player_id}
                      className={'flex items-center gap-3 px-4 py-3 ' + (i < 3 ? 'bg-primary/5 border border-primary/10' : 'bg-surface-container border border-outline-variant/5')}
                    >
                      <div className="w-8 text-center font-mono text-base font-bold flex-shrink-0" style={{ color: pc }}>{i + 1}</div>
                      <div className="flex-1 font-mono text-sm font-bold text-on-surface">{s.playerName}</div>
                      <div className="font-sans text-xs text-on-surface/40 uppercase tracking-wider">{s.games.length + ' games'}</div>
                      <div className="font-mono text-lg font-bold text-primary min-w-[3rem] text-right">{s.total}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Rules Tab */}
      {detailTab === 'rules' && (
        <section className="px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">

              {/* Full scoring table */}
              <div className="bg-surface-container-low p-8 border-l-4 border-primary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-3xl italic font-bold">Points System</h2>
                  <Icon name="leaderboard" className="text-primary text-2xl" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {['Place', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(function(h) {
                          return (
                            <th key={h} className="py-3 px-2 border-b border-outline-variant/20 text-center font-sans font-bold uppercase tracking-wider text-on-surface/50 text-[10px]">{h}</th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-2 text-center font-sans text-[10px] uppercase tracking-wider text-on-surface/50">Pts</td>
                        {[8, 7, 6, 5, 4, 3, 2, 1].map(function(p, i) {
                          return (
                            <td key={p} className={'py-3 px-2 text-center font-mono font-bold ' + (i === 0 ? 'text-primary' : 'text-on-surface/70')}>{p}</td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tiebreakers */}
              <div className="bg-surface-container-low p-8 border-l-4 border-secondary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-3xl italic font-bold">Tiebreaker Rules</h2>
                  <Icon name="gavel" className="text-secondary text-2xl" />
                </div>
                <div className="space-y-3">
                  {TIEBREAKERS.map(function(tb) {
                    return (
                      <div key={tb.n} className="flex gap-4 items-start bg-surface-container-high p-4 border border-outline-variant/10">
                        <span className="font-mono text-sm font-bold text-secondary flex-shrink-0">{tb.n}</span>
                        <div>
                          <div className="font-sans font-bold text-sm text-on-surface uppercase tracking-wide mb-1">{tb.title}</div>
                          <div className="text-sm text-on-surface/60 font-body">{tb.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tournament-specific rules */}
              <div className="bg-surface-container-low p-8 border-l-4 border-tertiary">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-3xl italic font-bold">Tournament Rules</h2>
                  <Icon name="description" className="text-tertiary text-2xl" />
                </div>
                <div className="text-sm text-on-surface/70 font-body leading-relaxed whitespace-pre-wrap">
                  {event.rulesText || event.rules_text || event.rules || 'Standard TFT Clash ruleset applies. All participants must adhere to the code of conduct and Riot Terms of Service.'}
                </div>
              </div>
            </div>

            {/* Rules sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-surface-container-low p-6">
                <h3 className="font-sans text-base font-bold tracking-widest uppercase mb-4 text-on-surface/80">Quick Reference</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                    <span className="font-sans text-xs uppercase tracking-wider text-on-surface/50">Players</span>
                    <span className="font-mono text-sm font-bold text-on-surface">{event.size}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                    <span className="font-sans text-xs uppercase tracking-wider text-on-surface/50">Format</span>
                    <span className="font-mono text-sm font-bold text-on-surface">{event.format || 'Standard'}</span>
                  </div>
                  {event.region && (
                    <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                      <span className="font-sans text-xs uppercase tracking-wider text-on-surface/50">Region</span>
                      <span className="font-mono text-sm font-bold text-on-surface">{event.region}</span>
                    </div>
                  )}
                  {event.time && (
                    <div className="flex justify-between items-center">
                      <span className="font-sans text-xs uppercase tracking-wider text-on-surface/50">Start Time</span>
                      <span className="font-mono text-sm font-bold text-on-surface">{event.time}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </PageLayout>
  )
}
