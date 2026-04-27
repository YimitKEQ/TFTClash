import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Btn, Icon, PillTab, PillTabGroup } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import PrizePoolCard from '../components/shared/PrizePoolCard'
import Podium from '../components/shared/Podium'
import RegionBadge from '../components/shared/RegionBadge'
import LiveOdds from '../components/shared/LiveOdds'
import PredictionGame from '../components/shared/PredictionGame'
import AiMatchRecap from '../components/shared/AiMatchRecap'
import SocialShareBar from '../components/shared/SocialShareBar'
import AddToCalendarBtn from '../components/shared/AddToCalendarBtn'
import { canRegisterInRegion, regionMismatchMessage } from '../lib/regions.js'
import { resolveLinkedPlayer } from '../lib/linkedPlayer.js'
import { isPinned, togglePinned, PINNED_EVENT } from '../lib/pinnedTournaments.js'

var PLACE_POINTS = [
  { place: '1st', pts: '8 PTS', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  { place: '2nd', pts: '7 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
  { place: '3rd', pts: '6 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
  { place: '4th', pts: '5 PTS', color: 'text-on-surface/70', bg: 'bg-surface-container-high', border: 'border-outline-variant/10' },
]

var TIEBREAKERS = [
  { n: '01', title: 'Total Tournament Points', desc: 'Sum of all placement points across games.' },
  { n: '02', title: 'Wins + Top 4s', desc: 'Wins count twice toward the tiebreaker score.' },
  { n: '03', title: 'Most of Each Placement', desc: 'Compare 1st counts, then 2nd, then 3rd...' },
  { n: '04', title: 'Most Recent Game Finish', desc: 'Higher placement in the most recent game wins.' },
]

var DETAIL_TABS = [
  { id: 'overview', label: 'Overview', icon: 'info' },
  { id: 'bracket', label: 'Bracket', icon: 'groups' },
  { id: 'standings', label: 'Standings', icon: 'bar_chart' },
  { id: 'rules', label: 'Rules', icon: 'gavel' },
]

var PLACE_CLASSES = ['text-primary', 'text-on-surface-variant', 'text-on-surface-variant/70', 'text-tertiary', 'text-secondary', 'text-tertiary/70', 'text-on-surface-variant/50', 'text-on-surface-variant/40']

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

  var _fallbackEvent = useState(null)
  var fallbackEvent = _fallbackEvent[0]
  var setFallbackEvent = _fallbackEvent[1]
  var _detailTab = useState('overview')
  var detailTab = _detailTab[0]
  var setDetailTab = _detailTab[1]
  var _tournamentResults = useState([])
  var tournamentResults = _tournamentResults[0]
  var setTournamentResults = _tournamentResults[1]
  var _loadingResults = useState(false)
  var loadingResults = _loadingResults[0]
  var setLoadingResults = _loadingResults[1]
  var _liveReg = useState({loaded:false, isRegistered:false, count:0, busy:false})
  var liveReg = _liveReg[0]
  var setLiveReg = _liveReg[1]

  var _pinned = useState(false)
  var pinned = _pinned[0]
  var setPinned = _pinned[1]

  useEffect(function() {
    if (!contextEvent && eventId && supabase.from) {
      supabase.from('tournaments').select('*').eq('id', eventId).single()
        .then(function(res) {
          if (res.data) setFallbackEvent(res.data)
        }).catch(function() {})
    }
  }, [contextEvent, eventId])

  var event = contextEvent || fallbackEvent
  var dbTournamentId = event && (event.dbTournamentId || (typeof event.id === 'string' && event.id.length > 20 ? event.id : null))

  var pinTargetId = dbTournamentId || (event && event.id) || eventId

  useEffect(function () {
    if (!pinTargetId) return
    setPinned(isPinned(pinTargetId))
    function onChange() { setPinned(isPinned(pinTargetId)) }
    if (typeof window !== 'undefined') {
      window.addEventListener(PINNED_EVENT, onChange)
      window.addEventListener('storage', onChange)
    }
    return function () {
      if (typeof window !== 'undefined') {
        window.removeEventListener(PINNED_EVENT, onChange)
        window.removeEventListener('storage', onChange)
      }
    }
  }, [pinTargetId])

  useEffect(function() {
    if (!dbTournamentId || !supabase.from) return
    setLoadingResults(true)
    supabase.from('game_results').select('*').eq('tournament_id', dbTournamentId).order('round_number', { ascending: true }).order('placement', { ascending: true })
      .then(function(res) {
        setLoadingResults(false)
        if (res.error) { toast('Failed to load results', 'error'); return; }
        if (res.data) setTournamentResults(res.data)
      }).catch(function() { setLoadingResults(false); toast('Failed to load results', 'error'); })
  }, [dbTournamentId])

  var linkedPlayer = resolveLinkedPlayer(currentUser, players)
  var linkedPlayerId = linkedPlayer ? linkedPlayer.id : null

  function refreshLiveReg() {
    if (!dbTournamentId || !supabase.from) return
    supabase.from('registrations').select('player_id,status', { count: 'exact' })
      .eq('tournament_id', dbTournamentId)
      .in('status', ['registered','checked_in'])
      .then(function(res) {
        if (res.error) return
        var isReg = !!(linkedPlayerId && (res.data || []).some(function(r) { return String(r.player_id) === String(linkedPlayerId) }))
        setLiveReg({loaded:true, isRegistered:isReg, count:(res.data || []).length, busy:false})
      }).catch(function() {})
  }

  useEffect(refreshLiveReg, [dbTournamentId, linkedPlayerId])

  useEffect(function() {
    if (!dbTournamentId || !supabase.channel) return
    var ch = supabase.channel('tournament_detail_regs_' + dbTournamentId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations', filter: 'tournament_id=eq.' + dbTournamentId }, function() {
        refreshLiveReg()
      })
      .subscribe()
    return function() { supabase.removeChannel(ch) }
  }, [dbTournamentId])

  if (!event) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto text-center py-20">
          <Icon name="error_outline" size={48} className="text-on-surface-variant/20 mx-auto mb-4" />
          <h2 className="text-on-surface text-xl font-bold mb-2">Tournament Not Found</h2>
          <p className="text-on-surface-variant text-sm mb-6">This tournament may have been removed or the link is invalid.</p>
          <Btn variant="primary" size="sm" onClick={function() { navigate('/events'); }}>
            Back to Events
          </Btn>
        </div>
      </PageLayout>
    )
  }

  var blobIsRegistered = currentUser && event.registeredIds && event.registeredIds.indexOf(currentUser.username) !== -1
  var isRegistered = liveReg.loaded ? liveReg.isRegistered : blobIsRegistered
  var liveCount = liveReg.loaded ? liveReg.count : (event.registered || 0)
  var size = event.size || event.max_players || 0
  var isFull = size > 0 && liveCount >= size
  var isCompleted = event.status === 'complete' || event.phase === 'complete' || event.phase === 'completed'
  var canRegister = !isCompleted && !isFull && !isRegistered
  var regPercent = size > 0 ? Math.round((liveCount / size) * 100) : 0

  function handleRegister() {
    if (!currentUser) { setAuthScreen('login'); return; }
    if (!currentUser.auth_user_id) { toast('Sign in required to register', 'error'); return; }
    if (!dbTournamentId) { toast('Tournament unavailable', 'error'); return; }
    if (liveReg.busy) return
    if (!linkedPlayer) { toast('Link your player profile before registering', 'error'); navigate('/account'); return; }
    if (!isRegistered && event.region && !canRegisterInRegion(linkedPlayer.region, event.region)) {
      var regMsg = regionMismatchMessage(linkedPlayer.region, event.region)
      toast(regMsg || 'Region mismatch. Check your account region.', 'error')
      if (!linkedPlayer.region) navigate('/account')
      return
    }
    setLiveReg(function(s) { return Object.assign({}, s, {busy:true}) })

    if (isRegistered) {
      var prevFeatured = null
      setFeaturedEvents(function(evts) {
        prevFeatured = evts
        return evts.map(function(ev) {
          if (ev.id !== event.id) return ev
          var newIds = (ev.registeredIds || []).filter(function(u) { return u !== currentUser.username; })
          return Object.assign({}, ev, { registeredIds: newIds, registered: Math.max(0, (ev.registered || 0) - 1) })
        })
      })
      supabase.from('registrations').delete()
        .eq('tournament_id', dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function(r) {
          if (r.error) {
            if (prevFeatured) setFeaturedEvents(prevFeatured)
            setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
            toast('Unregister failed: ' + r.error.message, 'error')
            return
          }
          toast('Unregistered from ' + event.name, 'info')
          refreshLiveReg()
        })
        .catch(function() {
          if (prevFeatured) setFeaturedEvents(prevFeatured)
          setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
          toast('Unregister failed', 'error')
        })
      return
    }

    if (isFull) {
      setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
      toast('Tournament is full', 'error'); return
    }

    var prevFeatured2 = null
    setFeaturedEvents(function(evts) {
      prevFeatured2 = evts
      return evts.map(function(ev) {
        if (ev.id !== event.id) return ev
        var newIds = (ev.registeredIds || []).concat([currentUser.username])
        return Object.assign({}, ev, { registeredIds: newIds, registered: (ev.registered || 0) + 1 })
      })
    })
    supabase.from('registrations').upsert(
      { tournament_id: dbTournamentId, player_id: linkedPlayer.id, status: 'registered' },
      { onConflict: 'tournament_id,player_id' }
    )
      .then(function(r) {
        if (r && r.error) {
          if (prevFeatured2) setFeaturedEvents(prevFeatured2)
          setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
          toast('Registration failed: ' + r.error.message, 'error')
          return
        }
        toast('Registered for ' + event.name + '!', 'success')
        refreshLiveReg()
      })
      .catch(function() {
        if (prevFeatured2) setFeaturedEvents(prevFeatured2)
        setLiveReg(function(s) { return Object.assign({}, s, {busy:false}) })
        toast('Registration failed', 'error')
      })
  }

  var playerNameMap = {}
  ;(players || []).forEach(function(p) { playerNameMap[p.id] = p.username || p.name; })

  var standings = []
  if (tournamentResults.length > 0) {
    var playerMap = {}
    tournamentResults.forEach(function(r) {
      if (!playerMap[r.player_id]) playerMap[r.player_id] = { player_id: r.player_id, playerName: playerNameMap[r.player_id] || 'Unknown Player', total: 0, games: [], wins: 0, top4: 0 }
      playerMap[r.player_id].total += r.points || 0
      playerMap[r.player_id].games.push({ round: r.round_number, placement: r.placement, points: r.points })
      if (r.placement === 1) playerMap[r.player_id].wins += 1
      if (r.placement <= 4) playerMap[r.player_id].top4 += 1
    })
    standings = Object.values(playerMap).sort(function(a, b) { return b.total - a.total; })
  }

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
  var prizes = Array.isArray(event.prize_pool_json) ? event.prize_pool_json : []

  var champRow = standings[0] || null
  var champName = (champRow && champRow.playerName) || event.champion || ''
  var champPts = champRow ? champRow.total : null
  var champWins = champRow ? champRow.wins : 0
  var champGames = champRow && champRow.games ? champRow.games.length : 0
  var champTop4 = champRow ? champRow.top4 : 0
  var champTop4Pct = champGames > 0 ? Math.round((champTop4 / champGames) * 100) : null
  var podiumPlayers = standings.slice(0, 3).map(function(s) { return { name: s.playerName, pts: s.total } })

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto">

        {/* Back nav */}
        <button
          onClick={function() { navigate('/events'); }}
          className="flex items-center gap-1.5 text-on-surface-variant/50 hover:text-primary text-xs font-label font-bold tracking-wider uppercase mb-6 bg-transparent border-0 cursor-pointer transition-colors"
        >
          <Icon name="arrow_back" size={14} />
          {"Back to Events"}
        </button>

        {/* Page hero */}
        <div className="mb-8">
          <div className="font-label text-[11px] font-bold text-secondary tracking-[.18em] uppercase mb-1.5">
            {event.host ? "Hosted by " + event.host : "Custom Tournament"}
          </div>
          <h1 className="font-editorial italic text-on-background font-extrabold leading-none mb-3" style={{ fontSize: "clamp(28px,4.2vw,46px)" }}>
            {event.logo && <span className="mr-3 not-italic">{event.logo}</span>}
            {event.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={"px-3 py-1 rounded font-label text-xs tracking-wider font-bold border " + (isCompleted ? "bg-primary/10 text-primary border-primary/20" : event.status === 'live' ? "bg-tertiary/10 text-tertiary border-tertiary/20" : "bg-secondary/10 text-secondary border-secondary/20")}>
              {isCompleted ? 'COMPLETED' : event.status === 'live' ? 'LIVE' : 'UPCOMING'}
            </span>
            {event.date && (
              <div className="flex items-center gap-2 text-on-surface-variant/50 font-mono text-xs">
                <Icon name="calendar_today" size={13} />
                {event.date}
              </div>
            )}
            {event.format && (
              <div className="flex items-center gap-2 text-on-surface-variant/50 font-mono text-xs">
                <Icon name="sports_esports" size={13} />
                {event.format}
              </div>
            )}
            {event.region && <RegionBadge region={event.region} size="md" />}
          </div>
          {(event.tags || []).length > 0 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {(event.tags || []).map(function(t) {
                return (
                  <span key={t} className="bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-label px-2 py-0.5 rounded uppercase tracking-wider">
                    {t}
                  </span>
                )
              })}
            </div>
          )}
          <div className="flex gap-2 flex-wrap mt-4">
            <button
              type="button"
              onClick={function() {
                var url = '/api/share-card?v=tournament' +
                  '&name=' + encodeURIComponent(event.name || '') +
                  (event.host ? '&host=' + encodeURIComponent(String(event.host).slice(0, 60)) : '') +
                  (event.starts_at ? '&start=' + encodeURIComponent(event.starts_at) : '') +
                  (event.region ? '&region=' + encodeURIComponent(event.region) : '');
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="text-[10px] font-label uppercase tracking-widest text-tertiary hover:text-tertiary/80 flex items-center gap-1 border border-tertiary/30 bg-tertiary/10 px-2.5 py-1 rounded"
            >
              <Icon name="image" size={12} />
              Share card
            </button>
            <button
              type="button"
              onClick={function() {
                try {
                  var url = window.location.href;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url);
                    toast && toast('Link copied', 'success');
                  } else {
                    toast && toast('Copy not supported', 'error');
                  }
                } catch (e) { toast && toast('Copy failed', 'error') }
              }}
              className="text-[10px] font-label uppercase tracking-widest text-on-surface/60 hover:text-on-surface flex items-center gap-1 border border-outline-variant/20 bg-surface-container-high px-2.5 py-1 rounded"
            >
              <Icon name="link" size={12} />
              Copy link
            </button>
            <button
              type="button"
              onClick={function () {
                if (!pinTargetId) return
                var nowPinned = togglePinned(pinTargetId)
                setPinned(nowPinned)
                if (toast) toast(nowPinned ? 'Pinned' : 'Unpinned', 'success')
              }}
              disabled={!pinTargetId}
              className={'text-[10px] font-label uppercase tracking-widest flex items-center gap-1 border px-2.5 py-1 rounded ' + (pinned ? 'text-primary border-primary/40 bg-primary/10' : 'text-on-surface/60 hover:text-on-surface border-outline-variant/20 bg-surface-container-high')}
              title={pinned ? 'Unpin tournament' : 'Pin tournament'}
              aria-pressed={pinned}
            >
              <Icon name={pinned ? 'push_pin' : 'keep'} size={12} />
              {pinned ? 'Pinned' : 'Pin'}
            </button>
            {event.starts_at && (
              <AddToCalendarBtn
                start={event.starts_at}
                end={event.ends_at}
                durationMinutes={180}
                title={event.name || 'TFT Clash'}
                description={event.description || 'TFT Clash tournament on tftclash.com'}
                url={typeof window !== 'undefined' ? window.location.href : 'https://tftclash.com'}
                uid={'tftclash-' + (eventId || 'unknown')}
                filename={'tft-clash-' + (eventId || 'event') + '.ics'}
                variant="ghost"
              />
            )}
          </div>
        </div>

        {prizes.length > 0 && (
          <div className="mb-6">
            <PrizePoolCard prizes={prizes} sponsors={ctx.orgSponsors} />
          </div>
        )}

        {/* Registration bar */}
        <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-on-surface">{liveCount}</span>
                <span className="text-on-surface-variant/50 font-mono text-sm">{"/ " + size}</span>
              </div>
              <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mt-0.5">
                {"players registered (" + regPercent + "%)"}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {!isCompleted && currentUser && isRegistered && (
                <button
                  onClick={handleRegister}
                  disabled={liveReg.busy}
                  className={"px-5 py-2.5 font-label font-bold text-xs tracking-widest uppercase rounded transition-all border border-success/30 text-success bg-success/10 hover:bg-success/20 " + (liveReg.busy ? "opacity-50 cursor-not-allowed" : "")}>
                  {liveReg.busy ? 'Updating...' : 'Registered - Withdraw'}
                </button>
              )}
              {!isCompleted && currentUser && canRegister && (
                <Btn variant="primary" size="sm" onClick={handleRegister} disabled={liveReg.busy}>
                  {liveReg.busy ? 'Registering...' : 'Register Now'}
                </Btn>
              )}
              {!isCompleted && currentUser && isFull && !isRegistered && (
                <Btn variant="secondary" size="sm" disabled>
                  Tournament Full
                </Btn>
              )}
              {!isCompleted && !currentUser && (
                <Btn variant="primary" size="sm" onClick={function() { setAuthScreen('login'); }}>
                  Sign In to Register
                </Btn>
              )}
            </div>
          </div>
          <div className="w-full bg-surface-container-lowest rounded-full h-1.5 overflow-hidden mt-3">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{width: Math.min(100, regPercent) + '%'}} />
          </div>
        </div>

        {/* Champion banner - clash-style for completed tournaments */}
        {isCompleted && champName && (
          <div className="relative overflow-hidden rounded-xl px-6 md:px-8 py-6 md:py-7 mb-6 flex items-center gap-5 md:gap-6 flex-wrap" style={{
            background: "linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))",
            border: "1px solid rgba(232,168,56,.55)",
            boxShadow: "0 0 60px rgba(232,168,56,.18),inset 0 0 80px rgba(232,168,56,.04)"
          }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)" }} />
            <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(232,168,56,.3),transparent)" }} />
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0" style={{
              background: "linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))",
              border: "2px solid rgba(232,168,56,.7)",
              boxShadow: "0 0 24px rgba(232,168,56,.35)"
            }}>
              <Icon name="emoji_events" size={36} fill className="text-primary" />
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="font-label text-[11px] font-bold text-primary tracking-[.16em] uppercase mb-1 flex items-center gap-1">
                <Icon name="emoji_events" size={11} className="text-primary" />
                Tournament Champion
              </div>
              <div className="font-editorial text-on-surface font-extrabold leading-none mb-2" style={{ fontSize: "clamp(24px,3.6vw,40px)" }}>{champName}</div>
              {event.top4 && event.top4.length > 0 && !champRow && (
                <div className="text-on-surface-variant text-xs">{"Top 4: " + event.top4.join(', ')}</div>
              )}
            </div>
            {champPts != null && (
              <div className="flex gap-3 flex-wrap">
                <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                  <div className="font-mono text-lg md:text-xl font-bold leading-none text-primary">{champPts}</div>
                  <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Pts</div>
                </div>
                <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                  <div className="font-mono text-lg md:text-xl font-bold leading-none text-success">{champWins}</div>
                  <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Wins</div>
                </div>
                <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                  <div className="font-mono text-lg md:text-xl font-bold leading-none text-secondary">{champGames}</div>
                  <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Games</div>
                </div>
                {champTop4Pct != null && (
                  <div className="text-center px-3 md:px-4 py-2 md:py-2.5 bg-black/30 rounded-lg min-w-[60px]">
                    <div className="font-mono text-lg md:text-xl font-bold leading-none text-tertiary">{champTop4Pct + '%'}</div>
                    <div className="font-label text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">Top4%</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Podium - top 3 standings (mirrors HoF / Clash layout) */}
        {isCompleted && podiumPlayers.length >= 3 && (
          <Podium players={podiumPlayers} className="mb-2" />
        )}

        {/* Tabs */}
        <PillTabGroup align="start" className="mb-6">
          {DETAIL_TABS.map(function(t) {
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={detailTab === t.id}
                onClick={function() { setDetailTab(t.id); }}
              >
                {t.label}
              </PillTab>
            )
          })}
        </PillTabGroup>

        {/* TAB: OVERVIEW */}
        {detailTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">

              {/* Tournament details */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="tune" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Tournament Details</span>
                </div>
                <div className="grid grid-cols-2 gap-px bg-outline-variant/5">
                  {[
                    {label: 'Format', value: event.format || 'Standard', icon: 'shuffle'},
                    {label: 'Players', value: liveCount + ' / ' + size, icon: 'group'},
                    {label: 'Date', value: event.date || 'TBD', icon: 'calendar_today'},
                    {label: 'Region', value: event.region || 'All', icon: 'public'}
                  ].map(function(item) {
                    return (
                      <div key={item.label} className="bg-surface-container-low p-4">
                        <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">{item.label}</div>
                        <div className="font-mono text-sm font-bold text-on-surface">{item.value}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="description" size={16} className="text-primary" />
                    <span className="text-xs font-label font-bold text-primary tracking-widest uppercase">About</span>
                  </div>
                  <div className="text-sm text-on-surface leading-relaxed">{event.description}</div>
                </div>
              )}

              {/* Scoring */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="leaderboard" size={18} className="text-tertiary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Scoring</span>
                </div>
                <div className="grid grid-cols-4 gap-px bg-outline-variant/5">
                  {PLACE_POINTS.map(function(pp) {
                    return (
                      <div key={pp.place} className={"p-4 text-center " + pp.bg}>
                        <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-1">{pp.place}</div>
                        <div className={"font-mono text-lg font-bold " + pp.color}>{"+" + pp.pts.replace(' PTS', '')}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="px-5 py-3 text-xs text-on-surface-variant/50">
                  {"Full scoring: 1st=8, 2nd=7, 3rd=6, 4th=5, 5th=4, 6th=3, 7th=2, 8th=1"}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-5 space-y-5">

              {/* Registered players */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="group" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {"Players (" + registeredIds.length + ")"}
                  </span>
                </div>
                {registeredIds.length === 0 ? (
                  <div className="text-center py-12 px-5">
                    <Icon name="person_add" size={32} className="text-on-surface-variant/20 mx-auto mb-3" />
                    <div className="text-on-surface text-sm font-semibold mb-1">Be the first to register</div>
                    <div className="text-on-surface-variant text-xs">Seats fill fast once the first name drops.</div>
                  </div>
                ) : (
                  <div className="divide-y divide-outline-variant/5">
                    {registeredIds.slice(0, 12).map(function(username, i) {
                      var borderColor = i === 0 ? 'border-l-primary' : 'border-l-transparent'
                      return (
                        <div key={username} className={"flex items-center gap-3 px-5 py-2.5 border-l-2 " + borderColor}>
                          <div className="w-7 h-7 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
                            <Icon name="person" size={14} className="text-on-surface-variant/40" />
                          </div>
                          <span className="font-mono text-sm font-bold text-on-surface flex-1">{username}</span>
                          <span className="text-[10px] font-label text-on-surface-variant/40 tracking-wider">{"#" + (i + 1)}</span>
                        </div>
                      )
                    })}
                    {registeredIds.length > 12 && (
                      <div className="text-center py-3">
                        <span className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-wider">
                          {"+" + (registeredIds.length - 12) + " more"}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Host info */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 p-5 text-center">
                <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-2">Hosted By</div>
                <div className="font-editorial italic text-xl text-primary">{event.host || 'TFT Clash'}</div>
                {event.sponsor && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/10">
                    <div className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider mb-2">Presented By</div>
                    <div className="font-editorial italic text-lg text-on-surface/60">{event.sponsor}</div>
                  </div>
                )}
              </div>

              {/* Live odds (computed from registered roster) */}
              {registeredIds.length > 1 && (
                <LiveOdds players={registeredIds.map(function (un) {
                  var p = (players || []).find(function (pl) { return pl.name && pl.name.toLowerCase() === String(un).toLowerCase() })
                  return p || { id: un, name: un, pts: 0, top4: 0, games: 0 }
                })} max={8} />
              )}

              {/* AI match recap - completed events */}
              {isCompleted && standings && standings.length > 0 && (
                <AiMatchRecap
                  threadId={'t-' + (eventId || 'unknown')}
                  eventName={event.name || event.title || ''}
                  podium={standings.slice(0, 3).map(function (s) {
                    var p = (players || []).find(function (pl) { return String(pl.id) === String(s.player_id) })
                    return { id: s.player_id, name: p ? p.name : (s.player_name || 'Unknown') }
                  })}
                />
              )}

              {/* Social share bar - always visible on tournament pages */}
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container/60 backdrop-blur p-4">
                <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mb-2">Spread the word</div>
                <SocialShareBar
                  url={typeof window !== 'undefined' ? window.location.href : 'https://tftclash.com'}
                  text={isCompleted
                    ? ((event.name || 'TFT Clash') + ' just wrapped on tftclash.com')
                    : ((event.name || 'TFT Clash tournament') + ' — coming up on tftclash.com')}
                />
              </div>

              {/* Prediction game - fans pick winner + top4 */}
              <PredictionGame
                threadId={'t-' + (eventId || 'unknown')}
                currentUser={currentUser}
                registeredPlayers={registeredIds.map(function (un) {
                  var p = (players || []).find(function (pl) { return pl.name && pl.name.toLowerCase() === String(un).toLowerCase() })
                  return p || { id: un, name: un }
                })}
                startsAt={event.starts_at || event.startTime || event.startsAt}
                isCompleted={isCompleted}
                actualWinnerId={isCompleted && standings[0] ? standings[0].player_id : null}
                actualTop4Ids={isCompleted ? standings.slice(0, 4).map(function (s) { return s.player_id }) : []}
              />

              {/* Host management link */}
              {currentUser && event.dbTournamentId && currentUser.auth_user_id === event.host_id && (
                <button
                  onClick={function() { navigate('/host/dashboard'); }}
                  className="w-full flex items-center justify-center gap-2 bg-secondary/10 border border-secondary/20 text-secondary font-label font-bold text-xs uppercase tracking-widest px-5 py-3 rounded hover:bg-secondary/20 transition-colors"
                >
                  <Icon name="manage_accounts" size={16} />
                  Manage Tournament
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB: BRACKET */}
        {detailTab === 'bracket' && (
          <div>
            {loadingResults && (
              <div className="text-center py-16">
                <Icon name="hourglass_empty" size={32} className="text-on-surface-variant/30 mx-auto mb-3 animate-spin" />
                <span className="font-label uppercase tracking-widest text-sm text-on-surface-variant">Loading bracket...</span>
              </div>
            )}
            {!loadingResults && tournamentResults.length === 0 && (
              <div className="text-center py-16">
                <Icon name="account_tree" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                <div className="text-on-surface text-lg font-bold mb-1">No Bracket Data Yet</div>
                <div className="text-on-surface-variant text-sm">Results will appear once games are played.</div>
              </div>
            )}
            {!loadingResults && bracketRoundKeys.length > 0 && (
              <div className="space-y-5">
                {bracketRoundKeys.map(function(rk) {
                  var roundResults = bracketRounds[rk].sort(function(a, b) { return a.placement - b.placement; })
                  return (
                    <div key={rk} className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                        <Icon name="emoji_events" size={18} className="text-tertiary" />
                        <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">{rk}</span>
                      </div>
                      <div className="divide-y divide-outline-variant/5">
                        {roundResults.map(function(r) {
                          var playerName = playerNameMap[r.player_id] || 'Player ' + r.player_id
                          var placeClass = PLACE_CLASSES[Math.min(r.placement - 1, 7)] || 'text-on-surface-variant/40'
                          return (
                            <div key={r.player_id} className={"flex items-center gap-3 px-5 py-2.5 " + (r.placement <= 3 ? 'bg-primary/3' : '')}>
                              <span className={"font-mono text-sm font-bold min-w-[22px] text-center " + placeClass}>
                                {r.placement}
                              </span>
                              <span className="flex-1 text-sm text-on-surface">{playerName}</span>
                              <span className="font-mono text-xs font-bold text-primary">{r.points + " pts"}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: STANDINGS */}
        {detailTab === 'standings' && (
          <div>
            {loadingResults && (
              <div className="text-center py-16">
                <Icon name="hourglass_empty" size={32} className="text-on-surface-variant/30 mx-auto mb-3 animate-spin" />
                <span className="font-label uppercase tracking-widest text-sm text-on-surface-variant">Loading standings...</span>
              </div>
            )}
            {!loadingResults && standings.length === 0 && (
              <div className="text-center py-16">
                <Icon name="bar_chart" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
                <div className="text-on-surface text-lg font-bold mb-1">No Standings Yet</div>
                <div className="text-on-surface-variant text-sm">Standings update as games are played.</div>
              </div>
            )}
            {standings.length > 0 && (
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="bar_chart" size={18} className="text-tertiary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {isCompleted ? 'Final Results' : 'Current Standings'}
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {standings.map(function(s, i) {
                    var placeClass = PLACE_CLASSES[Math.min(i, 7)] || 'text-on-surface-variant/40'
                    return (
                      <div key={s.player_id} className={"flex items-center gap-3 px-5 py-3 " + (i === 0 ? 'bg-primary/5' : '')}>
                        <span className={"font-mono text-sm font-bold min-w-[22px] text-center " + placeClass}>
                          {i + 1}
                        </span>
                        <span className={"flex-1 text-sm " + (i === 0 ? "text-primary font-bold" : "text-on-surface")}>
                          {s.playerName}
                        </span>
                        <span className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-wider">
                          {s.games.length + " games"}
                        </span>
                        <span className="font-mono text-sm font-bold text-tertiary min-w-[3rem] text-right">
                          {s.total + " pts"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: RULES */}
        {detailTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">

              {/* Points system */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="leaderboard" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Points System</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {['Place', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(function(h) {
                          return (
                            <th key={h} className="py-3 px-2 border-b border-outline-variant/10 text-center font-label font-bold uppercase tracking-wider text-on-surface-variant/50 text-[10px]">{h}</th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-2 text-center font-label text-[10px] uppercase tracking-wider text-on-surface-variant/50">Pts</td>
                        {[8, 7, 6, 5, 4, 3, 2, 1].map(function(p, i) {
                          return (
                            <td key={p} className={"py-3 px-2 text-center font-mono font-bold " + (i === 0 ? 'text-primary' : 'text-on-surface/70')}>{p}</td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tiebreakers */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="gavel" size={18} className="text-secondary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Tiebreaker Rules</span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {TIEBREAKERS.map(function(tb) {
                    return (
                      <div key={tb.n} className="flex gap-4 items-start px-5 py-3">
                        <span className="font-mono text-xs font-bold text-secondary flex-shrink-0 mt-0.5">{tb.n}</span>
                        <div>
                          <div className="font-label font-bold text-xs text-on-surface uppercase tracking-wider mb-0.5">{tb.title}</div>
                          <div className="text-xs text-on-surface-variant/60">{tb.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tournament rules text */}
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="description" size={18} className="text-tertiary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Tournament Rules</span>
                </div>
                <div className="px-5 py-4 text-sm text-on-surface/70 leading-relaxed whitespace-pre-wrap">
                  {event.rulesText || event.rules_text || event.rules || 'Standard TFT Clash ruleset applies. All participants must adhere to the code of conduct and Riot Terms of Service.'}
                </div>
              </div>
            </div>

            {/* Rules sidebar */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="info" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Quick Reference</span>
                </div>
                <div className="divide-y divide-outline-variant/5">
                  {[
                    {label: 'Players', value: event.size || 'TBD'},
                    {label: 'Format', value: event.format || 'Standard'},
                    event.region ? {label: 'Region', value: event.region} : null,
                    event.time ? {label: 'Start Time', value: event.time} : null
                  ].filter(Boolean).map(function(item) {
                    return (
                      <div key={item.label} className="flex justify-between items-center px-5 py-3">
                        <span className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant/50">{item.label}</span>
                        <span className="font-mono text-sm font-bold text-on-surface">{item.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageLayout>
  )
}
