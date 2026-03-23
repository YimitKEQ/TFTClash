import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Btn, Icon } from '../components/ui'

// ── Registration progress bar ─────────────────────────────────────────────────

function RegBar({ registered, size }) {
  var pct = size > 0 ? Math.min(100, Math.round((registered / size) * 100)) : 0
  var barColor = pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF'
  return (
    <div>
      <div className="flex justify-between text-[10px] text-on-surface/40 mb-1">
        <span>Registration</span>
        <span className="font-bold text-[#E8A838]">{registered + '/' + size}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5">
        <div
          className="h-1 rounded-full transition-all duration-300"
          style={{ width: pct + '%', background: barColor }}
        />
      </div>
    </div>
  )
}

// ── Featured (live/upcoming community events) tab ─────────────────────────────

function FeaturedTab({ featuredEvents, setFeaturedEvents, currentUser, onAuthClick, navigate }) {
  var [filter, setFilter] = useState('all')
  var allEvents = featuredEvents || []
  var live = allEvents.filter(function(e) { return e.status === 'live' })
  var upcoming = allEvents.filter(function(e) { return e.status === 'upcoming' })
  var past = allEvents.filter(function(e) { return e.status === 'complete' })
  var active = live.concat(upcoming)
  var shown = filter === 'all' ? active : filter === 'live' ? live : upcoming

  function handleRegister(ev) {
    if (!setFeaturedEvents) return
    setFeaturedEvents(function(evts) {
      return evts.map(function(evt) {
        if (evt.id !== ev.id) return evt
        return Object.assign({}, evt, {
          registeredIds: (evt.registeredIds || []).concat([currentUser.username]),
          registered: (evt.registered || 0) + 1,
        })
      })
    })
  }

  var filterOptions = [
    ['all', 'All Active'],
    ['live', 'Live Now'],
    ['upcoming', 'Upcoming'],
  ]

  // Live hero card
  var hero = live.length > 0 ? live[0] : null

  return (
    <div>
      {/* Live count pill */}
      {live.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {live.length} LIVE NOW
          </span>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filterOptions.map(function(arr) {
          var f = arr[0]
          var label = arr[1]
          var active = filter === f
          return (
            <button
              key={f}
              onClick={function() { setFilter(f) }}
              className={'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 border ' + (active
                ? 'bg-secondary/20 border-secondary/50 text-secondary'
                : 'bg-white/4 border-white/8 text-on-surface/50 hover:bg-white/8')}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Empty state */}
      {allEvents.length === 0 && (
        <div className="text-center py-16">
          <i className="ti ti-building text-5xl text-on-surface/20 block mb-4" />
          <h3 className="text-on-surface font-bold text-lg mb-2">No Featured Events Yet</h3>
          <p className="text-on-surface/50 text-sm max-w-sm mx-auto">
            Featured tournaments and community events will appear here once created by event organizers.
          </p>
        </div>
      )}

      {/* Live hero */}
      {hero && (
        <div
          className="bg-[#0D1520] border border-[#E8A838]/30 rounded-xl overflow-hidden mb-5 cursor-pointer"
          onClick={function() { navigate('/tournament/' + hero.id) }}
        >
          <div className="bg-[#E8A838]/7 border-b border-[#E8A838]/18 px-4 py-2 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 rounded-full px-3 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE NOW
            </span>
            <span className="text-[#E8A838] font-semibold text-xs">Round in progress</span>
          </div>
          <div className="p-5">
            <div className="flex gap-4 items-start flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center justify-center text-2xl flex-shrink-0">
                {hero.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg text-on-surface mb-1">{hero.name}</div>
                <div className="text-xs text-secondary font-semibold mb-2.5">
                  {'Hosted by ' + hero.host + (hero.sponsor ? ' - Presented by ' + hero.sponsor : '')}
                </div>
                <div className="text-sm text-on-surface/70 leading-relaxed mb-3">{hero.description}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {(hero.tags || []).map(function(t) {
                    return (
                      <span key={t} className="text-[10px] font-bold text-secondary bg-secondary/10 border border-secondary/25 rounded-full px-2.5 py-0.5">
                        {t}
                      </span>
                    )
                  })}
                  <span className="text-[10px] font-bold text-[#E8A838] bg-[#E8A838]/8 border border-[#E8A838]/20 rounded-full px-2.5 py-0.5">
                    {hero.registered + '/' + hero.size + ' players'}
                  </span>
                  {hero.prizePool && (
                    <span className="text-[10px] font-bold text-tertiary bg-tertiary/8 border border-tertiary/20 rounded-full px-2.5 py-0.5">
                      {hero.prizePool}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event cards grid */}
      {shown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {shown.map(function(ev) {
            var isLive = ev.status === 'live'
            var evRegIds = ev.registeredIds || []
            var amRegistered = currentUser && evRegIds.indexOf(currentUser.username) !== -1
            var evFull = ev.registered >= ev.size

            return (
              <div
                key={ev.id}
                className="bg-[#0D1520] border border-secondary/20 rounded-xl overflow-hidden cursor-pointer transition-colors duration-200 hover:border-secondary/50"
                onClick={function() { navigate('/tournament/' + ev.id) }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <div className="w-9 h-9 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-base flex-shrink-0">
                      {ev.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-on-surface leading-tight mb-0.5">{ev.name}</div>
                      <div className="text-[11px] text-secondary font-semibold">{ev.host}</div>
                    </div>
                    <div className="flex-shrink-0">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-500/12 border border-emerald-500/30 rounded-full px-2 py-0.5">
                          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                          LIVE
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-tertiary bg-tertiary/8 border border-tertiary/20 rounded-full px-2 py-0.5">
                          UPCOMING
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-on-surface/60 leading-relaxed mb-3">{ev.description}</div>

                  <div className="flex gap-1.5 flex-wrap mb-3">
                    <span className="text-[10px] text-on-surface/40 bg-white/4 rounded px-2 py-0.5">{ev.date}</span>
                    {ev.time && <span className="text-[10px] text-on-surface/40 bg-white/4 rounded px-2 py-0.5">{ev.time}</span>}
                    {ev.region && <span className="text-[10px] text-on-surface/40 bg-white/4 rounded px-2 py-0.5">{ev.region}</span>}
                  </div>

                  <div className="mb-3">
                    <RegBar registered={ev.registered} size={ev.size} />
                  </div>

                  <div className="flex gap-1.5 items-center flex-wrap">
                    {ev.prizePool && (
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary/8 border border-tertiary/20 rounded-full px-2 py-0.5">
                        {ev.prizePool}
                      </span>
                    )}
                    {ev.sponsor && (
                      <span className="text-[10px] font-semibold text-secondary bg-secondary/8 border border-secondary/20 rounded-full px-2 py-0.5">
                        {'by ' + ev.sponsor}
                      </span>
                    )}
                    {amRegistered && (
                      <span className="ml-auto text-[11px] font-bold text-emerald-300 bg-emerald-500/12 border border-emerald-500/30 rounded-lg px-3 py-1">
                        Registered
                      </span>
                    )}
                    {!amRegistered && evFull && (
                      <span className="ml-auto text-[11px] font-bold text-on-surface/40 bg-white/4 border border-white/10 rounded-lg px-3 py-1">
                        Full
                      </span>
                    )}
                    {!amRegistered && !evFull && !currentUser && (
                      <button
                        className="ml-auto text-[11px] font-bold text-[#E8A838] bg-[#E8A838]/12 border border-[#E8A838]/30 rounded-lg px-3 py-1 cursor-pointer"
                        onClick={function(e) {
                          e.stopPropagation()
                          if (onAuthClick) onAuthClick('login')
                        }}
                      >
                        Sign In
                      </button>
                    )}
                    {!amRegistered && !evFull && currentUser && (
                      <button
                        className="ml-auto text-[11px] font-bold text-secondary bg-secondary/12 border border-secondary/30 rounded-lg px-3 py-1 cursor-pointer"
                        onClick={function(e) {
                          e.stopPropagation()
                          handleRegister(ev)
                        }}
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No results for filter */}
      {shown.length === 0 && allEvents.length > 0 && (
        <div className="text-center py-12 text-on-surface/50 mb-6">
          <i className="ti ti-calendar-event text-3xl block mb-3" />
          <div className="text-sm">No events matching this filter right now.</div>
        </div>
      )}

      {/* Past events list */}
      {past.length > 0 && (
        <div className="mb-8">
          <h3 className="text-on-surface font-bold text-sm mb-3 uppercase tracking-wider">Past Events</h3>
          <div className="flex flex-col gap-2">
            {past.map(function(ev) {
              return (
                <div
                  key={ev.id}
                  className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-3 flex items-center gap-4 cursor-pointer transition-colors hover:border-secondary/30"
                  onClick={function() { navigate('/tournament/' + ev.id) }}
                >
                  <div className="text-xl flex-shrink-0">{ev.logo}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-on-surface mb-0.5">{ev.name}</div>
                    <div className="text-[11px] text-on-surface/40">
                      {ev.date + ' - ' + ev.registered + ' players - ' + ev.format}
                    </div>
                  </div>
                  {ev.champion && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-on-surface/40 mb-0.5">Champion</div>
                      <div className="text-xs font-bold text-[#E8A838] flex items-center gap-1">
                        <i className="ti ti-trophy text-xs" />
                        {ev.champion}
                      </div>
                    </div>
                  )}
                  <span className="text-xs text-secondary flex-shrink-0">{'>'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Host CTA */}
      <div className="bg-gradient-to-br from-secondary/8 to-tertiary/5 border border-secondary/20 rounded-xl p-7 text-center">
        <i className="ti ti-device-gamepad-2 text-3xl text-secondary block mb-3" />
        <h3 className="text-on-surface font-bold text-lg mb-2">Run Your Own Tournament</h3>
        <p className="text-sm text-on-surface/50 leading-relaxed max-w-md mx-auto mb-5">
          Get featured here. Create and manage TFT tournaments with our full host suite.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Btn
            variant="primary"
            size="sm"
            onClick={function() { navigate(currentUser ? '/host-apply' : '/signup') }}
          >
            Apply to Host
          </Btn>
          <Btn
            variant="secondary"
            size="sm"
            onClick={function() { navigate('/pricing') }}
          >
            View Host Plans
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Tournaments tab (flash tournaments from DB) ───────────────────────────────

function TournamentsTab({ navigate }) {
  var [tournaments, setTournaments] = useState([])
  var [loading, setLoading] = useState(true)
  var [regCounts, setRegCounts] = useState({})

  useEffect(function() {
    supabase
      .from('tournaments')
      .select('*')
      .eq('type', 'flash_tournament')
      .order('date', { ascending: false })
      .then(function(res) {
        if (res.data) setTournaments(res.data)
        setLoading(false)
      })
  }, [])

  useEffect(function() {
    if (tournaments.length === 0) return
    var ids = tournaments.map(function(t) { return t.id })
    supabase
      .from('registrations')
      .select('tournament_id')
      .in('tournament_id', ids)
      .then(function(res) {
        if (!res.data) return
        var counts = {}
        res.data.forEach(function(r) {
          counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1
        })
        setRegCounts(counts)
      })
  }, [tournaments])

  var phaseLabels = {
    draft: 'Draft',
    registration: 'Registration Open',
    check_in: 'Check-In Open',
    in_progress: 'In Progress',
    complete: 'Completed',
  }

  var phaseBadgeBg = {
    draft: 'rgba(154,170,191,0.1)',
    registration: 'rgba(155,114,207,0.15)',
    check_in: 'rgba(232,168,56,0.15)',
    in_progress: 'rgba(82,196,124,0.15)',
    complete: 'rgba(78,205,196,0.15)',
  }

  var phaseBadgeColor = {
    draft: '#9AAABF',
    registration: '#9B72CF',
    check_in: '#E8A838',
    in_progress: '#52C47C',
    complete: '#4ECDC4',
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-on-surface/40">Loading tournaments...</div>
    )
  }

  if (tournaments.length === 0) {
    return (
      <Panel className="py-12 text-center">
        <i className="ti ti-bolt text-4xl text-on-surface/20 block mb-3" />
        <div className="font-bold text-base text-on-surface mb-1.5">No Tournaments Yet</div>
        <div className="text-sm text-on-surface/40 leading-relaxed">
          Flash tournaments will appear here when admins create them.
        </div>
      </Panel>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-on-surface/50 text-sm">
          Flash tournaments, competitive events, and community clashes. Free to enter, play to win.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map(function(t) {
          var regCount = regCounts[t.id] || 0
          var maxP = t.max_players || 128
          var pct = Math.min(100, Math.round((regCount / maxP) * 100))
          var barColor = pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF'
          var dateStr = t.date
            ? new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'TBD'
          var prizes = Array.isArray(t.prize_pool_json) ? t.prize_pool_json : []
          var badgeBg = phaseBadgeBg[t.phase] || 'rgba(154,170,191,0.1)'
          var badgeColor = phaseBadgeColor[t.phase] || '#9AAABF'

          // Countdown
          var now = new Date()
          var tDate = t.date ? new Date(t.date) : null
          var diff = tDate ? (tDate - now) : 0
          var countdownStr = ''
          if (diff > 0) {
            var days = Math.floor(diff / 86400000)
            var hours = Math.floor((diff % 86400000) / 3600000)
            var mins = Math.floor((diff % 3600000) / 60000)
            countdownStr = days > 0 ? (days + 'd ' + hours + 'h') : (hours > 0 ? (hours + 'h ' + mins + 'm') : (mins + 'm'))
          }

          return (
            <div
              key={t.id}
              className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-5 cursor-pointer transition-colors hover:border-secondary/30"
              onClick={function() { navigate('/flash/' + t.id) }}
            >
              <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
                <span
                  className="text-[11px] font-bold rounded-full px-2.5 py-0.5 uppercase tracking-wide"
                  style={{ background: badgeBg, color: badgeColor }}
                >
                  {phaseLabels[t.phase] || t.phase}
                </span>
                <div className="flex items-center gap-2">
                  {countdownStr && (
                    <span className="text-[11px] font-bold text-[#E8A838] bg-[#E8A838]/10 border border-[#E8A838]/20 rounded-xl px-2 py-0.5">
                      {countdownStr}
                    </span>
                  )}
                  <span className="text-[11px] text-on-surface/40">{dateStr}</span>
                </div>
              </div>

              <div className="font-bold text-base text-on-surface mb-2">{t.name}</div>

              {prizes.length > 0 && (
                <div className="flex gap-1.5 mb-2.5 flex-wrap">
                  {prizes.slice(0, 3).map(function(p, i) {
                    return (
                      <span
                        key={i}
                        className="text-[11px] font-semibold text-[#E8A838] bg-[#E8A838]/10 border border-[#E8A838]/20 rounded px-2 py-0.5"
                      >
                        {'#' + p.placement + ' ' + p.prize}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="mb-1.5">
                <div className="flex justify-between text-[11px] text-on-surface/40 mb-1">
                  <span>{regCount + ' / ' + maxP + ' players'}</span>
                  <span>{pct + '%'}</span>
                </div>
                <div className="h-1 rounded-full bg-white/6">
                  <div
                    className="h-1 rounded-full transition-all duration-300"
                    style={{ width: pct + '%', background: barColor }}
                  />
                </div>
              </div>

              <div className="text-xs text-on-surface/40 mt-2">
                {(t.round_count || 3) + ' games - ' + (t.seeding_method || 'snake') + ' seeding'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Archive tab (past clashes) ─────────────────────────────────────────────────

function ArchiveTab({ pastClashes, players, navigate, setProfilePlayer }) {
  var clashes = pastClashes || []

  if (clashes.length === 0) {
    return (
      <div className="text-center py-16">
        <i className="ti ti-archive text-4xl text-on-surface/20 block mb-3" />
        <div className="font-bold text-base text-on-surface mb-1.5">No Past Clashes</div>
        <div className="text-sm text-on-surface/40">Completed clashes will be archived here.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {clashes.map(function(clash, idx) {
        return (
          <Panel key={clash.id || idx} className="flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-lg font-bold text-secondary">
              {'#' + (clashes.length - idx)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-on-surface mb-0.5">
                {clash.name || ('Clash #' + (clashes.length - idx))}
              </div>
              <div className="text-[11px] text-on-surface/40">
                {clash.date || ''}
                {clash.playerCount ? (' - ' + clash.playerCount + ' players') : ''}
              </div>
            </div>
            {clash.winner && (
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] text-on-surface/40 mb-0.5">Winner</div>
                <div className="text-xs font-bold text-[#E8A838] flex items-center gap-1">
                  <i className="ti ti-trophy text-xs" />
                  {clash.winner}
                </div>
              </div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

// ── Main EventsScreen ─────────────────────────────────────────────────────────

export default function EventsScreen() {
  var { sub } = useParams()
  var navigate = useNavigate()
  var { featuredEvents, setFeaturedEvents, players, currentUser, pastClashes, setProfilePlayer } = useApp()

  var activeTab = sub || 'featured'

  var tabs = [
    { id: 'featured', label: 'Featured', icon: 'ti-star' },
    { id: 'tournaments', label: 'Tournaments', icon: 'ti-tournament' },
    { id: 'archive', label: 'Archive', icon: 'ti-archive' },
  ]

  function handleAuthClick(mode) {
    navigate('/' + mode)
  }

  return (
    <PageLayout>
      <div className="pt-8 pb-16">
        <PageHeader
          title="Community"
          goldWord="Events"
          description="Partner tournaments, community clashes and special events. Free to watch, free to enter."
        />

        {/* Tab bar */}
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {tabs.map(function(t) {
            var isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={function() { navigate('/events/' + t.id) }}
                className={'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border ' + (isActive
                  ? 'bg-secondary/12 border-secondary/30 text-on-surface shadow-[0_0_12px_rgba(155,114,207,0.1)]'
                  : 'bg-white/3 border-white/6 text-on-surface/50 hover:bg-white/6 hover:text-on-surface/80')}
              >
                <i className={'ti ' + t.icon + ' text-base ' + (isActive ? 'text-secondary' : 'text-on-surface/30')} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'featured' && (
          <FeaturedTab
            featuredEvents={featuredEvents}
            setFeaturedEvents={setFeaturedEvents}
            currentUser={currentUser}
            onAuthClick={handleAuthClick}
            navigate={navigate}
          />
        )}
        {activeTab === 'tournaments' && (
          <TournamentsTab navigate={navigate} />
        )}
        {activeTab === 'archive' && (
          <ArchiveTab
            pastClashes={pastClashes}
            players={players}
            navigate={navigate}
            setProfilePlayer={setProfilePlayer}
          />
        )}
      </div>
    </PageLayout>
  )
}
