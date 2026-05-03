import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon, PillTab, PillTabGroup } from '../components/ui'
import AddToCalendarBtn from '../components/shared/AddToCalendarBtn'
import { canRegisterInRegion, regionMismatchMessage, normalizeRegion } from '../lib/regions.js'
import { resolveLinkedPlayer } from '../lib/linkedPlayer.js'
import { isSimulation, buildSimTournaments, buildSimRegCounts } from '../lib/simulation.js'

// ── Registration progress bar ──────────────────────────────────────────────────

function RegBar({ registered, size }) {
  var pct = size > 0 ? Math.min(100, Math.round((registered / size) * 100)) : 0
  var barColor = pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF'
  return (
    <div>
      <div className="flex justify-between text-[10px] text-on-surface-variant mb-1 font-label uppercase tracking-wider">
        <span>Registration</span>
        <span className="font-bold text-primary">{registered + '/' + size}</span>
      </div>
      <div className="h-1 bg-surface-container-highest rounded-full">
        <div
          className="h-1 rounded-full transition-all duration-300"
          style={{ width: pct + '%', background: barColor }}
        />
      </div>
    </div>
  )
}

// ── Tournament card ────────────────────────────────────────────────────────────

function TournamentCard({ ev, currentUser, onAuthClick, onRegister, navigate }) {
  var isLive = ev.status === 'live'
  var isRegistering = ev.status === 'upcoming'
  var evRegIds = ev.registeredIds || []
  var amRegistered = currentUser && evRegIds.indexOf(currentUser.username) !== -1
  var evFull = ev.registered >= ev.size

  var badgeEl = null
  if (isLive) {
    badgeEl = (
      <span className="flex items-center px-3 py-1 bg-error text-on-error font-label text-[10px] font-black uppercase tracking-widest rounded">
        <span className="w-2 h-2 bg-on-error rounded-full mr-2 animate-pulse"></span>
        LIVE
      </span>
    )
  } else if (isRegistering) {
    badgeEl = (
      <span className="flex items-center px-3 py-1 bg-tertiary text-on-tertiary font-label text-[10px] font-black uppercase tracking-widest rounded">
        REGISTERING
      </span>
    )
  } else {
    badgeEl = (
      <span className="flex items-center px-3 py-1 bg-surface-container-highest text-on-surface font-label text-[10px] font-black uppercase tracking-widest rounded">
        UPCOMING
      </span>
    )
  }

  var actionBtn = null
  if (isLive) {
    actionBtn = (
      <Btn
        variant="secondary"
        size="md"
        className="w-full"
        onClick={function() { navigate('/tournament/' + (ev.dbTournamentId || ev.id)) }}
      >
        Watch Broadcast
      </Btn>
    )
  } else if (amRegistered) {
    actionBtn = (
      <Btn variant="secondary" size="md" className="w-full" disabled>
        Registered
      </Btn>
    )
  } else if (evFull) {
    actionBtn = (
      <Btn variant="secondary" size="md" className="w-full" disabled>
        Full
      </Btn>
    )
  } else if (!currentUser) {
    actionBtn = (
      <Btn
        variant="primary"
        size="md"
        className="w-full"
        onClick={function(e) {
          e.stopPropagation()
          if (onAuthClick) onAuthClick('login')
        }}
      >
        Sign In to Register
      </Btn>
    )
  } else {
    actionBtn = (
      <Btn
        variant="primary"
        size="md"
        className="w-full"
        onClick={function(e) {
          e.stopPropagation()
          if (onRegister) onRegister(ev)
        }}
      >
        Register Now
      </Btn>
    )
  }

  return (
    <article
      className="group bg-surface-container-low overflow-hidden transition-all duration-300 hover:-translate-y-2 cursor-pointer"
      onClick={function() { navigate('/tournament/' + ev.id) }}
    >
      <div className="relative h-48 overflow-hidden bg-surface-container-highest">
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent z-10"></div>
        <div className="absolute top-4 left-4 flex space-x-2 z-20">
          {badgeEl}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-20">
          <div className="text-on-surface font-mono font-bold text-xl">
            {ev.prizePool || '--'}
          </div>
          <div className="text-tertiary font-label text-[10px] uppercase tracking-widest">Prize Pool</div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-display text-2xl font-bold leading-tight">{ev.name}</h3>
          <Icon name="share" className="text-on-surface-variant/40" size={20} />
        </div>
        <div className="space-y-4 mb-4">
          <div className="flex items-center text-on-surface-variant text-xs">
            <Icon name="group" className="mr-2" size={16} />
            <span className="font-label uppercase tracking-wider">
              {'Slots: ' + ev.registered + ' / ' + ev.size + (ev.registered >= ev.size ? ' (Full)' : ' Open')}
            </span>
          </div>
          {ev.date && (
            <div className="flex items-center text-on-surface-variant text-xs">
              <Icon name="event" className="mr-2" size={16} />
              <span className="font-label uppercase tracking-wider">{ev.date + (ev.time ? ', ' + ev.time : '')}</span>
            </div>
          )}
          {ev.description && (
            <div className="flex items-center text-on-surface-variant text-xs">
              <Icon name="info" className="mr-2" size={16} />
              <span className="font-label uppercase tracking-wider">{ev.description}</span>
            </div>
          )}
        </div>
        <div className="mb-4">
          <RegBar registered={ev.registered} size={ev.size} />
        </div>
        {actionBtn}
      </div>
    </article>
  )
}

// ── Prize pool podium strip (Wave 25) ─────────────────────────────────────────

function parsePrizeAmount(input) {
  if (input == null) return 0
  var s = String(input)
  var multiplier = 1
  if (/[kK]/.test(s)) multiplier = 1000
  else if (/[mM]/.test(s)) multiplier = 1000000
  var num = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (!isFinite(num)) return 0
  return num * multiplier
}

function formatPrizeShort(amount) {
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (amount >= 1000) return '$' + (amount / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return '$' + Math.round(amount)
}

function PrizePoolPodium(props) {
  var events = props.events || []
  var navigate = props.navigate

  var ranked = events
    .map(function(ev) {
      return { ev: ev, amount: parsePrizeAmount(ev.prizePool) }
    })
    .filter(function(x) { return x.amount > 0 })
    .sort(function(a, b) { return b.amount - a.amount })
    .slice(0, 3)

  if (ranked.length === 0) return null

  // Visual order: 2nd place left, 1st center, 3rd right (classic podium).
  // We still navigate by id and label by their actual rank.
  var visualOrder = []
  if (ranked[1]) visualOrder.push({ rank: 2, row: ranked[1] })
  visualOrder.push({ rank: 1, row: ranked[0] })
  if (ranked[2]) visualOrder.push({ rank: 3, row: ranked[2] })

  var heightForRank = function(rank) {
    if (rank === 1) return 'h-32 sm:h-36'
    if (rank === 2) return 'h-24 sm:h-28'
    return 'h-20 sm:h-24'
  }

  var medalColor = function(rank) {
    if (rank === 1) return 'text-primary'
    if (rank === 2) return 'text-on-surface'
    return 'text-tertiary'
  }

  var borderColor = function(rank) {
    if (rank === 1) return 'border-primary/40'
    if (rank === 2) return 'border-on-surface/30'
    return 'border-tertiary/40'
  }

  return (
    <section className="mb-8 rounded-2xl border border-outline-variant/15 bg-surface-container p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="emoji_events" className="text-primary" />
          <h3 className="font-display text-base tracking-wide">PRIZE POOL PODIUM</h3>
        </div>
        <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          Top {ranked.length} {ranked.length === 1 ? 'event' : 'events'} by purse
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        {visualOrder.map(function(slot) {
          var ev = slot.row.ev
          var amount = slot.row.amount
          var rank = slot.rank
          var label = ev.name || 'Untitled Event'
          return (
            <button
              key={ev.id || ('rank-' + rank)}
              type="button"
              onClick={function() {
                var dest = ev.dbTournamentId || ev.id
                if (navigate && dest) navigate('/tournament/' + dest)
              }}
              className={'rounded-xl bg-surface-container-low/60 hover:bg-surface-container hover:border-primary/30 transition-colors border p-4 flex flex-col items-center text-center ' + borderColor(rank) + ' ' + heightForRank(rank) + ' justify-end'}
            >
              <div className={'font-display text-2xl sm:text-3xl ' + medalColor(rank)}>
                {formatPrizeShort(amount)}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60 mt-1">
                {rank === 1 ? 'GRAND PURSE' : rank === 2 ? 'RUNNER UP' : 'THIRD'}
              </div>
              <div className="font-label uppercase tracking-wide text-xs text-on-surface mt-2 line-clamp-2 w-full" title={label}>
                {label}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// ── Featured (live/upcoming community events) tab ─────────────────────────────

function FeaturedTab({ featuredEvents, setFeaturedEvents, currentUser, onAuthClick, navigate, toast }) {
  var [filter, setFilter] = useState('all')
  var [sortBy, setSortBy] = useState('date')

  useEffect(function() {
    if (!currentUser || !featuredEvents || featuredEvents.length === 0) return
    var ids = featuredEvents
      .map(function(e) { return e.id })
      .filter(function(id) { return typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)) })
    if (ids.length === 0) return
    supabase
      .from('event_registrations')
      .select('event_id')
      .eq('player_id', currentUser.id)
      .in('event_id', ids)
      .then(function(res) {
        if (res.error || !res.data || res.data.length === 0) return
        var regEventIds = res.data.map(function(r) { return r.event_id })
        if (setFeaturedEvents) {
          setFeaturedEvents(function(evts) {
            return evts.map(function(evt) {
              if (regEventIds.indexOf(evt.id) === -1) return evt
              var username = currentUser.username || ''
              if ((evt.registeredIds || []).indexOf(username) !== -1) return evt
              return Object.assign({}, evt, {
                registeredIds: (evt.registeredIds || []).concat([username])
              })
            })
          })
        }
      }).catch(function() {})
  }, [currentUser ? currentUser.id : null])

  var allEvents = featuredEvents || []
  var live = allEvents.filter(function(e) { return e.status === 'live' })
  var upcoming = allEvents.filter(function(e) { return e.status === 'upcoming' })
  var past = allEvents.filter(function(e) { return e.status === 'complete' })
  var active = live.concat(upcoming)

  var filtered
  if (filter === 'all') {
    filtered = active
  } else if (filter === 'live') {
    filtered = live
  } else {
    filtered = active.filter(function(e) {
      return Array.isArray(e.tags) && e.tags.indexOf(filter) !== -1
    })
  }

  var shown = filtered.slice().sort(function(a, b) {
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '')
    }
    if (sortBy === 'prize') {
      // Use the shared parser so the prize sort honors k/M suffixes the
      // same way the podium does — otherwise '$5K' sorts below '$2000'.
      return parsePrizeAmount(b.prizePool) - parsePrizeAmount(a.prizePool)
    }
    if (sortBy === 'status') {
      var order = { live: 0, upcoming: 1, complete: 2 }
      return (order[a.status] || 1) - (order[b.status] || 1)
    }
    // default: date - soonest first
    var aDate = a.date ? new Date(a.date).getTime() : Infinity
    var bDate = b.date ? new Date(b.date).getTime() : Infinity
    return aDate - bDate
  })

  function handleRegister(ev) {
    if (!currentUser) { if (onAuthClick) { onAuthClick('login') } return }
    var evRegIds = ev.registeredIds || []
    if (evRegIds.indexOf(currentUser.username) !== -1) {
      if (toast) toast('You are already registered', 'info')
      return
    }
    if (ev.registered >= ev.size) {
      if (toast) toast('This event is full', 'error')
      return
    }
    supabase.from('event_registrations').upsert({
      event_id: ev.id,
      player_username: currentUser.username,
      player_id: currentUser.id
    }, { onConflict: 'event_id,player_username' }).then(function(res) {
      if (res.error) {
        if (toast) toast('Registration failed: ' + res.error.message, 'error')
        return
      }
      if (setFeaturedEvents) {
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
      if (toast) toast('Registered for ' + ev.name, 'success')
    }).catch(function() { if (toast) toast('Registration failed', 'error') })
  }

  var hero = live.length > 0 ? live[0] : upcoming.length > 0 ? upcoming[0] : null

  var filterBtns = [
    ['all', 'All Events'],
    ['community', 'Community'],
    ['official', 'Official'],
    ['regional', 'Regional'],
  ]

  return (
    <div>
      {/* Hero Section: Featured Event */}
      {hero && (
        <section className="relative h-[500px] w-full mb-16 overflow-hidden bg-surface-container rounded-lg border border-outline-variant/10">
          <div className="absolute inset-0 bg-surface-container-high"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent"></div>
          <div className="relative h-full flex flex-col justify-end p-8 lg:p-16 max-w-4xl">
            <div className="flex items-center space-x-3 mb-6">
              <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 font-label text-[10px] font-bold uppercase tracking-widest rounded">
                Featured Event
              </span>
              {hero.prizePool && (
                <span className="flex items-center text-tertiary font-mono text-sm font-bold">
                  <Icon name="payments" size={16} className="mr-1" />
                  {hero.prizePool + ' PRIZE POOL'}
                </span>
              )}
            </div>
            <h1 className="font-editorial text-5xl lg:text-7xl font-black mb-4 leading-none tracking-tight">
              {hero.name ? hero.name.split(' ').slice(0, 2).join(' ') : 'Featured'}
              <br />
              <span className="text-primary">
                {hero.name ? hero.name.split(' ').slice(2).join(' ') : 'Event'}
              </span>
            </h1>
            <p className="text-on-surface-variant text-lg max-w-xl mb-8 font-body leading-relaxed">
              {hero.description || 'The ultimate community clash. Join the competition and prove your tactical supremacy.'}
            </p>
            <div className="flex flex-wrap gap-4">
              {!currentUser ? (
                <Btn
                  variant="primary"
                  size="lg"
                  onClick={function() { onAuthClick('login') }}
                >
                  Register Now
                </Btn>
              ) : (
                <Btn
                  variant="primary"
                  size="lg"
                  onClick={function() {
                    var evRegIds = hero.registeredIds || []
                    var alreadyIn = evRegIds.indexOf(currentUser.username) !== -1
                    if (alreadyIn) { navigate('/tournament/' + hero.id); return; }
                    if (hero.registered >= hero.size) { navigate('/tournament/' + hero.id); return; }
                    handleRegister(hero)
                  }}
                >
                  Register Now
                </Btn>
              )}
              <Btn
                variant="secondary"
                size="lg"
                onClick={function() { navigate('/tournament/' + hero.id) }}
              >
                View Schedule
              </Btn>
            </div>
          </div>
        </section>
      )}

      {/* No events empty state */}
      {allEvents.length === 0 && (
        <Panel elevation="elevated" padding="none" className="relative h-[500px] w-full mb-16 overflow-hidden flex items-center justify-center">
          <div className="text-center">
            <Icon name="event" size={48} className="text-on-surface-variant/20 block mb-4" />
            <h3 className="font-display text-3xl font-bold text-on-surface mb-2">No Featured Events Yet</h3>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
              Featured tournaments and community events will appear here once created by event organizers.
            </p>
          </div>
        </Panel>
      )}

      {/* Prize pool podium - Wave 25 (active events only, completed events
          retire from the podium so it always reflects what players can
          still register for) */}
      <PrizePoolPodium events={active} navigate={navigate} />

      {/* Calendar subscribe banner */}
      <Panel className="mb-8 p-4 flex items-center gap-4 flex-wrap">
        <Icon name="event_available" size={22} className="text-secondary" />
        <div className="flex-1 min-w-[200px]">
          <div className="font-label uppercase text-xs tracking-widest text-on-surface mb-0.5">Never miss a clash</div>
          <div className="text-on-surface-variant text-sm">Subscribe to the live calendar feed in Google, Apple, or Outlook.</div>
        </div>
        <Btn
          variant="ghost"
          size="sm"
          onClick={function() {
            var url = window.location.origin + '/api/calendar'
            navigator.clipboard.writeText(url).then(function() {}).catch(function() {})
            window.open(url, '_blank')
          }}
        >
          <Icon name="calendar_add_on" size={16} className="mr-1.5" />
          Subscribe (.ics)
        </Btn>
      </Panel>

      {/* Tournament Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex space-x-2 flex-wrap gap-y-2">
          {filterBtns.map(function(pair) {
            var val = pair[0]
            var label = pair[1]
            var isActive = filter === val
            return (
              <button
                key={val}
                onClick={function() { setFilter(val) }}
                className={'px-6 py-2 font-label text-xs font-bold uppercase tracking-tighter rounded-full transition-colors ' + (isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface/70 hover:text-on-surface glass-panel'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center space-x-4">
          <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Sort By:</span>
          <select
            className="bg-surface-container-low border-none text-xs font-label uppercase tracking-widest text-on-surface py-2 pl-4 pr-10 rounded focus:ring-1 focus:ring-primary"
            value={sortBy}
            onChange={function(e) { setSortBy(e.target.value) }}
          >
            <option value="date">Start Date (Soonest)</option>
            <option value="prize">Prize Pool (Highest)</option>
            <option value="name">Name (A-Z)</option>
            <option value="status">Status (Live First)</option>
          </select>
        </div>
      </div>

      {/* Tournament Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {shown.map(function(ev) {
          return (
            <TournamentCard
              key={ev.id}
              ev={ev}
              currentUser={currentUser}
              onAuthClick={onAuthClick}
              onRegister={handleRegister}
              navigate={navigate}
            />
          )
        })}

        {/* Bento info panels - shown when we have at least some events or always */}
        <div className="col-span-1 md:col-span-2 xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
          <Panel elevation="highest" padding="spacious" accent="gold" className="flex flex-col justify-between">
            <div>
              <span className="font-label text-xs text-primary uppercase tracking-widest mb-4 block">Quick FAQ</span>
              <h4 className="font-display text-3xl font-bold mb-4">How to Join Community Events?</h4>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                Most community tournaments are open to all ranks. Ensure your Riot account is linked to your TFT Clash profile to automatically sync your stats and eligibility.
              </p>
            </div>
            <Btn
              variant="link"
              icon="arrow_forward"
              iconPosition="right"
              onClick={function() { navigate('/faq') }}
            >
              Learn More
            </Btn>
          </Panel>
          <Panel elevation="elevated" padding="spacious">
            <div className="flex items-center space-x-4 mb-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-tertiary glass-panel"
              >
                <Icon name="verified_user" size={24} />
              </div>
              <h4 className="font-display text-2xl font-bold">Safe and Fair Play</h4>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
              All tournaments are monitored by TFT Clash staff and community moderators. Cheating or unsportsmanlike behavior results in permanent bans from the platform.
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-on-surface-variant">Community moderated</span>
            </div>
          </Panel>
        </div>
      </div>

      {/* Past events list */}
      {past.length > 0 && (
        <div className="mt-16">
          <h3 className="font-display text-2xl font-bold text-on-surface mb-6">Past Events</h3>
          <div className="flex flex-col gap-3">
            {past.map(function(ev) {
              return (
                <Panel
                  key={ev.id}
                  padding="none"
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/30"
                  onClick={function() { navigate('/tournament/' + ev.id) }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-base text-on-surface mb-0.5">{ev.name}</div>
                    <div className="text-[11px] text-on-surface-variant font-label uppercase tracking-wider">
                      {ev.date + ' - ' + ev.registered + ' players'}
                    </div>
                  </div>
                  {ev.champion && (
                    <div className="text-right flex-shrink-0">
                      <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mb-0.5">Champion</div>
                      <div className="text-xs font-bold text-primary flex items-center gap-1 justify-end">
                        <Icon name="trophy" size={14} />
                        {ev.champion}
                      </div>
                    </div>
                  )}
                  <Icon name="chevron_right" size={18} className="text-on-surface-variant/40 flex-shrink-0" />
                </Panel>
              )
            })}
          </div>
        </div>
      )}

      {/* Host CTA */}
      <Panel elevation="highest" padding="none" className="mt-16 p-10 text-center">
        <Icon name="sports_esports" size={40} className="text-primary block mx-auto mb-4" />
        <h3 className="font-display text-3xl font-bold text-on-surface mb-3">Run Your Own Tournament</h3>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-md mx-auto mb-8">
          Get featured here. Create and manage TFT tournaments with our full host suite.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Btn
            variant="primary"
            size="lg"
            onClick={function() { navigate(currentUser ? '/host/apply' : '/signup') }}
          >
            Apply to Host
          </Btn>
          <Btn
            variant="secondary"
            size="lg"
            onClick={function() { navigate('/pricing') }}
          >
            View Host Plans
          </Btn>
        </div>
      </Panel>
    </div>
  )
}

// ── Live & Upcoming tab (consolidated: clashes top via WeeklyClashesPanel,
//    then custom tournaments + featured/sponsored events in one feed) ─────────

function LiveAndUpcomingTab(props) {
  var navigate = props.navigate
  var currentUser = props.currentUser
  var players = props.players
  var featuredEvents = props.featuredEvents || []
  var onAuthClick = props.onAuthClick
  var toast = props.toast

  return (
    <div>
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Tournaments & Featured Events</h2>
        <p className="text-on-surface-variant text-sm font-body">
          Custom tournaments, sponsored events, and community clashes. Free to enter, play to win.
        </p>
      </div>

      {/* Custom tournaments section */}
      <TournamentsTab
        navigate={navigate}
        currentUser={currentUser}
        players={players}
        onAuthClick={onAuthClick}
        toast={toast}
        hideHeader={true}
      />

      {/* Featured / sponsored events section, only if any are active */}
      <FeaturedEventsGrid
        featuredEvents={featuredEvents}
        currentUser={currentUser}
        navigate={navigate}
        onAuthClick={onAuthClick}
        toast={toast}
      />

      {/* Host CTA */}
      <Panel elevation="highest" padding="none" className="mt-16 p-10 text-center">
        <Icon name="sports_esports" size={40} className="text-primary block mx-auto mb-4" />
        <h3 className="font-display text-3xl font-bold text-on-surface mb-3">Run Your Own Tournament</h3>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-md mx-auto mb-8">
          Get featured here. Create and manage TFT tournaments with our full host suite.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Btn
            variant="primary"
            size="lg"
            onClick={function() { navigate(currentUser ? '/host/apply' : '/signup') }}
          >
            Apply to Host
          </Btn>
          <Btn
            variant="secondary"
            size="lg"
            onClick={function() { navigate('/pricing') }}
          >
            View Host Plans
          </Btn>
        </div>
      </Panel>
    </div>
  )
}

// Compact featured-events grid -- no hero, no filter chips. Used by the
// consolidated Live & Upcoming feed.
function FeaturedEventsGrid(props) {
  var featuredEvents = props.featuredEvents || []
  var currentUser = props.currentUser
  var navigate = props.navigate
  var onAuthClick = props.onAuthClick
  var toast = props.toast

  var active = featuredEvents.filter(function(e) { return e.status === 'live' || e.status === 'upcoming' })
  active = active.slice().sort(function(a, b) {
    var aDate = a.date ? new Date(a.date).getTime() : Infinity
    var bDate = b.date ? new Date(b.date).getTime() : Infinity
    return aDate - bDate
  })
  if (active.length === 0) return null

  function handleRegister(ev) {
    if (!currentUser) { if (onAuthClick) { onAuthClick('login') } return }
    var evRegIds = ev.registeredIds || []
    if (evRegIds.indexOf(currentUser.username) !== -1) {
      if (toast) toast('You are already registered', 'info')
      return
    }
    if (ev.registered >= ev.size) {
      if (toast) toast('This event is full', 'error')
      return
    }
    supabase.from('event_registrations').upsert({
      event_id: ev.id,
      player_username: currentUser.username,
      player_id: currentUser.id
    }, { onConflict: 'event_id,player_username' }).then(function(res) {
      if (res.error) { if (toast) toast('Registration failed: ' + res.error.message, 'error'); return }
      if (toast) toast('Registered for ' + ev.name, 'success')
    }).catch(function() { if (toast) toast('Registration failed', 'error') })
  }

  return (
    <div className="mt-14">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-2xl font-bold text-on-surface">Featured & Sponsored</h3>
        <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">{active.length + ' active'}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {active.map(function(ev) {
          return (
            <TournamentCard
              key={ev.id}
              ev={ev}
              currentUser={currentUser}
              onAuthClick={onAuthClick}
              onRegister={handleRegister}
              navigate={navigate}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Tournaments tab (flash tournaments from DB) ────────────────────────────────

function TournamentsTab({ navigate, currentUser, players, onAuthClick, toast, hideHeader }) {
  var [tournaments, setTournaments] = useState([])
  var [loading, setLoading] = useState(true)
  var [regCounts, setRegCounts] = useState({})
  var [myRegIds, setMyRegIds] = useState([])

  var linkedPlayer = resolveLinkedPlayer(currentUser, players)
  var linkedPlayerId = linkedPlayer ? linkedPlayer.id : null

  useEffect(function() {
    if (isSimulation()) {
      var simRows = buildSimTournaments()
      setTournaments(simRows)
      setRegCounts(buildSimRegCounts())
      setLoading(false)
      return
    }
    supabase
      .from('tournaments')
      .select('*')
      .eq('type', 'flash_tournament')
      .is('archived_at', null)
      .order('date', { ascending: false })
      .then(function(res) {
        if (res.data) setTournaments(res.data)
        setLoading(false)
      }).catch(function() { setLoading(false) })
  }, [])

  useEffect(function() {
    if (tournaments.length === 0) return
    if (isSimulation()) return
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
      }).catch(function() {})
    if (!linkedPlayerId) return
    supabase
      .from('registrations')
      .select('tournament_id')
      .eq('player_id', linkedPlayerId)
      .in('tournament_id', ids)
      .then(function(res) {
        if (res.data) setMyRegIds(res.data.map(function(r) { return r.tournament_id }))
      }).catch(function() {})
  }, [tournaments, linkedPlayerId])

  function handleRegister(t) {
    if (!currentUser) { if (onAuthClick) onAuthClick('login'); return }
    if (!linkedPlayer) { if (toast) toast('Link your player profile before registering', 'error'); navigate('/account'); return }
    if (linkedPlayer.banned) { if (toast) toast('Your account is banned from registering', 'error'); return }
    if (t.region && !canRegisterInRegion(linkedPlayer.region, t.region)) {
      var msg = regionMismatchMessage(linkedPlayer.region, t.region)
      if (toast) toast(msg || 'Region mismatch. Check your account region.', 'error')
      if (!linkedPlayer.region) navigate('/account')
      return
    }
    var maxP = t.max_players || 128
    var regCount = regCounts[t.id] || 0
    if (regCount >= maxP) { if (toast) toast('Tournament is full', 'error'); return }
    if (myRegIds.indexOf(t.id) !== -1) { if (toast) toast('Already registered', 'info'); return }
    supabase.from('registrations').upsert({
      tournament_id: t.id,
      player_id: linkedPlayer.id,
      status: 'registered'
    }, { onConflict: 'tournament_id,player_id' }).then(function(res) {
      if (res.error) { if (toast) toast('Registration failed: ' + res.error.message, 'error'); return }
      setMyRegIds(function(ids) { return ids.concat([t.id]) })
      setRegCounts(function(c) { return Object.assign({}, c, { [t.id]: (c[t.id] || 0) + 1 }) })
      if (toast) toast('Registered for ' + t.name, 'success')
    }).catch(function() { if (toast) toast('Registration failed', 'error') })
  }

  var phaseLabels = {
    draft: 'Draft',
    registration: 'Registration Open',
    check_in: 'Check-In Open',
    in_progress: 'In Progress',
    complete: 'Completed',
  }

  var phaseBadgeClasses = {
    draft: 'bg-surface-variant/40 text-on-surface-variant',
    registration: 'bg-tertiary/15 text-tertiary',
    check_in: 'bg-secondary/15 text-secondary',
    in_progress: 'bg-primary/15 text-primary',
    complete: 'bg-tertiary/15 text-tertiary',
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-on-surface-variant font-label uppercase tracking-widest text-xs">
        Loading tournaments...
      </div>
    )
  }

  if (tournaments.length === 0) {
    if (hideHeader) {
      return (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-2xl font-bold text-on-surface">Custom Tournaments</h3>
          </div>
          <Panel padding="none" className="p-10 text-center">
            <Icon name="bolt" size={32} className="text-on-surface-variant/20 block mx-auto mb-3" />
            <div className="text-sm text-on-surface-variant">No active custom tournaments right now.</div>
          </Panel>
        </div>
      )
    }
    return (
      <Panel padding="none" className="p-16 text-center">
        <Icon name="bolt" size={40} className="text-on-surface-variant/20 block mx-auto mb-4" />
        <div className="font-display text-2xl font-bold text-on-surface mb-2">No Tournaments Yet</div>
        <div className="text-sm text-on-surface-variant leading-relaxed">
          Flash tournaments will appear here when admins create them.
        </div>
      </Panel>
    )
  }

  return (
    <div>
      {!hideHeader && (
        <div className="mb-10">
          <p className="text-on-surface-variant text-sm font-body">
            Flash tournaments, competitive events, and community clashes. Free to enter, play to win.
          </p>
        </div>
      )}
      {hideHeader && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-2xl font-bold text-on-surface">Custom Tournaments</h3>
          <span className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant">{tournaments.length + ' total'}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {tournaments.map(function(t) {
          var regCount = regCounts[t.id] || 0
          var rawMaxP = t.max_players || 128
          var teamSzRaw = t && t.team_size != null ? parseInt(t.team_size, 10) : 1
          var teamSzNum = Number.isFinite(teamSzRaw) && teamSzRaw > 0 ? teamSzRaw : 1
          var isTeamEvt = teamSzNum > 1
          var maxP = isTeamEvt ? Math.max(1, Math.floor(rawMaxP / teamSzNum)) : rawMaxP
          var capUnit = isTeamEvt ? 'teams' : 'players'
          var pct = Math.min(100, Math.round((regCount / maxP) * 100))
          var barColor = pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF'
          var _startTs = t.started_at || t.checkin_close_at || t.checkin_open_at || t.registration_close_at || null
          var dateStr
          if (_startTs) {
            dateStr = new Date(_startTs).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          } else if (t.date) {
            dateStr = new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          } else {
            dateStr = 'TBD'
          }
          var prizes = Array.isArray(t.prize_pool_json) ? t.prize_pool_json : []
          var badgeClass = phaseBadgeClasses[t.phase] || 'bg-surface-variant/40 text-on-surface-variant'

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

          var cardHref = isSimulation()
            ? '/bracket?sim=1&kind=custom'
            : '/tournament/' + t.id

          return (
            <article
              key={t.id}
              className="group bg-surface-container-low overflow-hidden transition-all duration-300 hover:-translate-y-2 cursor-pointer"
              onClick={function() { navigate(cardHref) }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={'text-[11px] font-bold rounded px-3 py-1 uppercase tracking-widest font-label ' + badgeClass}
                    >
                      {phaseLabels[t.phase] || t.phase}
                    </span>
                    {(function() {
                      var modeLbl = null;
                      if (teamSzNum === 4) modeLbl = 'Squads 4v4';
                      else if (teamSzNum === 2) modeLbl = (t.points_scale === 'double_up_swiss') ? 'Double Up Swiss' : 'Double Up 2v2';
                      if (!modeLbl) return null;
                      return (
                        <span className="text-[11px] font-bold rounded px-2 py-1 uppercase tracking-widest font-label bg-secondary/15 text-secondary border border-secondary/30">
                          {modeLbl}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {countdownStr && (
                      <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 font-mono">
                        {countdownStr}
                      </span>
                    )}
                    <span className="text-[11px] text-on-surface-variant font-label">{dateStr}</span>
                  </div>
                </div>

                <h3 className="font-display text-2xl font-bold text-on-surface mb-3">{t.name}</h3>

                {prizes.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {prizes.slice(0, 3).map(function(p, i) {
                      return (
                        <span
                          key={p.placement + '-' + p.prize}
                          className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 font-label"
                        >
                          {'#' + p.placement + ' ' + p.prize}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-on-surface-variant text-xs">
                    <Icon name="group" size={14} className="mr-2" />
                    <span className="font-label uppercase tracking-wider">{regCount + ' / ' + maxP + ' ' + capUnit}</span>
                  </div>
                  <div className="flex items-center text-on-surface-variant text-xs">
                    <Icon name="event" size={14} className="mr-2" />
                    <span className="font-label uppercase tracking-wider">{dateStr}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="h-1 rounded-full bg-surface-container-highest">
                    <div
                      className="h-1 rounded-full transition-all duration-300"
                      style={{ width: pct + '%', background: barColor }}
                    />
                  </div>
                </div>

                <div className="text-xs text-on-surface-variant font-label uppercase tracking-wider mb-4">
                  {(t.round_count || 3) + ' games - ' + (t.seeding_method || 'snake') + ' seeding'}
                </div>

                {t.phase === 'in_progress' && (
                  <Btn
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={function(e) { e.stopPropagation(); navigate(cardHref) }}
                  >
                    Watch Live
                  </Btn>
                )}
                {t.phase !== 'in_progress' && myRegIds.indexOf(t.id) !== -1 && (
                  <Btn variant="secondary" size="sm" className="w-full" disabled>
                    Registered
                  </Btn>
                )}
                {t.phase !== 'in_progress' && myRegIds.indexOf(t.id) === -1 && regCount >= maxP && (
                  <Btn variant="secondary" size="sm" className="w-full" disabled>
                    Full
                  </Btn>
                )}
                {t.phase !== 'in_progress' && myRegIds.indexOf(t.id) === -1 && regCount < maxP && (
                  <Btn
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={function(e) { e.stopPropagation(); handleRegister(t) }}
                  >
                    Register Now
                  </Btn>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

// ── Season tab (public calendar from seasonConfig) ────────────────────────────

function SeasonTab({ seasonConfig, tournamentState, navigate }) {
  var startIso = seasonConfig && seasonConfig.seasonStartIso
  var totalWeeks = parseInt(seasonConfig && seasonConfig.totalWeeks, 10) || 0
  var dayOfWeek = (seasonConfig && seasonConfig.dayOfWeek) || 'Sunday'
  var startTime = (seasonConfig && seasonConfig.startTime) || '20:00'

  if (!startIso || totalWeeks <= 0) {
    return (
      <Panel padding="none" className="p-16 text-center">
        <Icon name="calendar_month" size={40} className="text-on-surface-variant/20 block mx-auto mb-4" />
        <div className="font-display text-2xl font-bold text-on-surface mb-2">Season Calendar Coming Soon</div>
        <div className="text-sm text-on-surface-variant max-w-md mx-auto">
          Once the admin sets the season start date and number of weeks, the full calendar will appear here.
        </div>
      </Panel>
    )
  }

  var startDate = new Date(startIso)
  if (isNaN(startDate.getTime())) {
    return (
      <Panel padding="none" className="p-16 text-center">
        <div className="text-sm text-on-surface-variant">Season start date is invalid.</div>
      </Panel>
    )
  }

  var now = Date.now()
  var weeks = []
  var i
  for (i = 0; i < totalWeeks; i++) {
    var weekStart = new Date(startDate.getTime() + i * 7 * 86400000)
    var weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    var status = 'upcoming'
    if (now >= weekEnd.getTime()) status = 'complete'
    else if (now >= weekStart.getTime()) status = 'current'
    weeks.push({
      number: i + 1,
      date: weekStart,
      status: status,
    })
  }

  var statusBadge = {
    complete: { label: 'Complete', cls: 'bg-tertiary/15 text-tertiary border-tertiary/20' },
    current: { label: 'This Week', cls: 'bg-primary/15 text-primary border-primary/30' },
    upcoming: { label: 'Upcoming', cls: 'bg-surface-container-high text-on-surface-variant border-outline-variant/20' },
  }

  return (
    <div>
      <div className="mb-10">
        <h2 className="font-display text-3xl font-bold text-on-surface mb-2">Season Calendar</h2>
        <p className="text-on-surface-variant text-sm font-body">
          {totalWeeks + ' weeks of competition. Every ' + dayOfWeek + ' at ' + startTime + '. Free to enter.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {weeks.map(function(w) {
          var badge = statusBadge[w.status]
          var dateStr = w.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          var timeStr = startTime
          var isCurrent = w.status === 'current'
          var isComplete = w.status === 'complete'
          return (
            <Panel
              key={w.number}
              padding="none"
              className={'px-5 py-4 transition-colors ' + (isCurrent ? 'border-primary/40' : '') + (isComplete ? ' opacity-60' : '')}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-display font-bold text-base text-on-surface">{'Week ' + w.number}</div>
                <span className={'text-[10px] font-bold rounded px-2 py-0.5 uppercase tracking-widest font-label border ' + badge.cls}>
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant text-xs mb-1">
                <Icon name="event" size={14} />
                <span className="font-label uppercase tracking-wider">{dateStr}</span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                <Icon name="schedule" size={14} />
                <span className="font-label uppercase tracking-wider">{timeStr + ' EU'}</span>
              </div>
              {!isComplete && (
                <div className="mt-3">
                  <AddToCalendarBtn
                    start={(function(){
                      var parts = timeStr.split(':')
                      var d = new Date(w.date.getTime())
                      d.setHours(parseInt(parts[0], 10) || 20, parseInt(parts[1], 10) || 0, 0, 0)
                      return d
                    })()}
                    durationMinutes={180}
                    title={'TFT Clash - Week ' + w.number}
                    description={'Free weekly TFT tournament. Register at https://tftclash.com/events'}
                    url={'https://tftclash.com/events'}
                    uid={'tftclash-week-' + w.number + '-' + w.date.getTime()}
                    filename={'tftclash-week-' + w.number + '.ics'}
                    variant="ghost"
                  />
                </div>
              )}
            </Panel>
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
      <Panel padding="none" className="p-16 text-center">
        <Icon name="archive" size={40} className="text-on-surface-variant/20 block mx-auto mb-4" />
        <div className="font-display text-2xl font-bold text-on-surface mb-2">No Past Clashes</div>
        <div className="text-sm text-on-surface-variant">Completed clashes will be archived here.</div>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {clashes.map(function(clash, idx) {
        return (
          <Panel
            key={clash.id || clash.name}
            padding="none"
            className="px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/30"
            onClick={function() { navigate('/results', { state: { clash: clash } }) }}
          >
            <div className="flex-shrink-0 w-10 h-10 bg-surface-container-high border border-outline-variant/20 flex items-center justify-center font-bold text-primary font-mono text-sm">
              {'#' + (clashes.length - idx)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-base text-on-surface mb-0.5">
                {clash.name || ('Clash #' + (clashes.length - idx))}
              </div>
              <div className="font-label text-[11px] text-on-surface-variant uppercase tracking-wider">
                {clash.date || ''}
                {clash.playerCount ? (' - ' + clash.playerCount + ' players') : ''}
              </div>
            </div>
            {clash.winner && (
              <div className="text-right flex-shrink-0">
                <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest mb-0.5">Winner</div>
                <div className="text-xs font-bold text-primary flex items-center gap-1 justify-end">
                  <Icon name="trophy" size={14} />
                  {clash.winner}
                </div>
              </div>
            )}
            <Icon name="chevron_right" size={18} className="text-on-surface-variant/40 flex-shrink-0" />
          </Panel>
        )
      })}
    </div>
  )
}

// ── Weekly Clashes (EU + NA) — top of /events ─────────────────────────────────

// Build a synthetic clash from site_settings tournament_state when no DB row
// exists yet (admin scheduled but didn't open registration). Mirrors the logic
// HomeScreen uses so both surfaces stay in sync.
function previewFromState(state, region) {
  if (!state || !state.clashTimestamp) return null
  var when = new Date(state.clashTimestamp)
  if (isNaN(when.getTime())) return null
  if (when.getTime() < Date.now() - 6 * 60 * 60 * 1000) return null
  var statePhase = state.phase
  var phase = statePhase && statePhase !== 'idle' && statePhase !== 'registration' ? statePhase : 'draft'
  if (phase === 'checkin') phase = 'check_in'
  if (phase === 'inprogress') phase = 'in_progress'
  return {
    id: 'preview-' + region,
    name: state.clashName || 'Weekly Clash',
    date: state.clashTimestamp,
    region: region,
    phase: phase,
    type: 'season_clash',
    is_finale: !!state.isFinale,
    max_players: state.maxPlayers || 24,
    prize_pool_json: Array.isArray(state.prizePool) ? state.prizePool : null,
    __preview: true
  }
}

function formatCountdown(target) {
  if (!target) return ''
  var diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return ''
  var days = Math.floor(diff / 86400000)
  var hours = Math.floor((diff % 86400000) / 3600000)
  var mins = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return days + 'd ' + hours + 'h'
  if (hours > 0) return hours + 'h ' + mins + 'm'
  return mins + 'm'
}

var WEEKLY_PHASE_LABELS = {
  draft: 'Scheduled',
  registration: 'Registering',
  check_in: 'Check-in Open',
  in_progress: 'Live Now',
  complete: 'Complete'
}
var WEEKLY_PHASE_BADGE = {
  draft: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/20',
  registration: 'bg-tertiary/15 text-tertiary border-tertiary/30',
  check_in: 'bg-secondary/15 text-secondary border-secondary/30',
  in_progress: 'bg-error/15 text-error border-error/30',
  complete: 'bg-success/15 text-success border-success/30'
}

function WeeklyRegionCard(props) {
  var clash = props.clash
  var region = props.region
  var regCount = props.regCount || 0
  var amRegistered = !!props.amRegistered
  var currentUser = props.currentUser
  var linkedPlayer = props.linkedPlayer
  var navigate = props.navigate
  var onAuthClick = props.onAuthClick
  var toast = props.toast
  var onRegister = props.onRegister
  var highlighted = !!props.highlighted

  var anchorId = 'weekly-' + region

  if (!clash) {
    return (
      <Panel
        id={anchorId}
        padding="none"
        className={'p-6 ' + (highlighted ? 'border-primary/60 ring-2 ring-primary/30' : '')}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {region} Region
          </span>
          <span className={'text-[10px] font-bold rounded px-2 py-0.5 uppercase tracking-widest font-label border bg-surface-container-highest text-on-surface-variant border-outline-variant/20'}>
            No Clash Scheduled
          </span>
        </div>
        <div className="font-display text-xl text-on-surface mb-2">No upcoming {region} clash</div>
        <div className="text-on-surface-variant text-sm font-body leading-relaxed">
          The next {region} weekly clash will appear here as soon as a host schedules it.
        </div>
      </Panel>
    )
  }

  var phase = clash.phase || 'draft'
  var phaseLabel = WEEKLY_PHASE_LABELS[phase] || 'Scheduled'
  var badgeCls = WEEKLY_PHASE_BADGE[phase] || WEEKLY_PHASE_BADGE.draft
  var maxP = clash.max_players || 24
  var pct = maxP > 0 ? Math.min(100, Math.round((regCount / maxP) * 100)) : 0
  var barColor = pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF'
  var _startTs = clash.started_at || clash.checkin_close_at || clash.checkin_open_at || clash.registration_close_at || null
  var when = _startTs ? new Date(_startTs) : (clash.date ? new Date(clash.date + 'T00:00:00') : null)
  var dateStr
  if (when && !isNaN(when.getTime())) {
    if (_startTs) {
      dateStr = when.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      dateStr = when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    }
  } else {
    dateStr = 'TBD'
  }
  var countdown = formatCountdown(clash.date)
  var prizes = Array.isArray(clash.prize_pool_json) ? clash.prize_pool_json : []
  var isPreview = !!clash.__preview

  var actionBtn = null
  if (phase === 'in_progress') {
    actionBtn = (
      <Btn variant="primary" size="md" className="w-full" onClick={function() { navigate('/bracket') }}>
        Watch Live
      </Btn>
    )
  } else if (phase === 'complete') {
    actionBtn = (
      <Btn variant="secondary" size="md" className="w-full" onClick={function() { navigate('/results') }}>
        View Results
      </Btn>
    )
  } else if (isPreview || phase === 'draft') {
    actionBtn = (
      <Btn variant="secondary" size="md" className="w-full" disabled>
        Registration Opens Soon
      </Btn>
    )
  } else if (!currentUser) {
    actionBtn = (
      <Btn variant="primary" size="md" className="w-full" onClick={function() { onAuthClick && onAuthClick('login') }}>
        Sign In to Register
      </Btn>
    )
  } else if (amRegistered) {
    actionBtn = (
      <Btn variant="secondary" size="md" className="w-full" disabled>
        Registered
      </Btn>
    )
  } else if (regCount >= maxP) {
    actionBtn = (
      <Btn variant="secondary" size="md" className="w-full" disabled>
        Full
      </Btn>
    )
  } else if (phase === 'check_in') {
    actionBtn = (
      <Btn variant="primary" size="md" className="w-full" onClick={function() { navigate('/clash') }}>
        Check In Now
      </Btn>
    )
  } else {
    // registration phase
    actionBtn = (
      <Btn
        variant="primary"
        size="md"
        className="w-full"
        onClick={function() {
          if (!linkedPlayer) {
            if (toast) toast('Link your player profile in Account first', 'error')
            navigate('/account')
            return
          }
          if (clash.region && !canRegisterInRegion(linkedPlayer.region, clash.region)) {
            var msg = regionMismatchMessage(linkedPlayer.region, clash.region)
            if (toast) toast(msg || 'Region mismatch. Check your account region.', 'error')
            return
          }
          onRegister && onRegister(clash)
        }}
      >
        Register Now
      </Btn>
    )
  }

  var regionLabel = region === 'NA' ? 'North America' : 'Europe'

  return (
    <Panel
      id={anchorId}
      padding="none"
      className={'p-6 transition-all ' + (highlighted ? 'border-primary/60 ring-2 ring-primary/30 shadow-[0_0_36px_rgba(255,198,107,0.18)]' : '')}
    >
      <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/30 font-label text-[10px] font-bold uppercase tracking-widest rounded">
            {region}
          </span>
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {regionLabel}
          </span>
          {clash.is_finale && (
            <span className="px-2 py-0.5 bg-primary/20 text-primary font-label text-[9px] font-bold uppercase tracking-widest rounded border border-primary/30">
              Finale
            </span>
          )}
        </div>
        <span className={'text-[10px] font-bold rounded px-2.5 py-1 uppercase tracking-widest font-label border ' + badgeCls}>
          {phaseLabel}
        </span>
      </div>

      <h3 className="font-display text-2xl font-bold text-on-surface mb-3">{clash.name || 'Weekly Clash'}</h3>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-on-surface-variant text-xs font-label uppercase tracking-wider">
          <Icon name="event" size={14} className="mr-2" />
          {dateStr}
          {countdown && (
            <span className="ml-auto font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 normal-case tracking-normal">
              {countdown}
            </span>
          )}
        </div>
        {!isPreview && (phase === 'registration' || phase === 'check_in') && (
          <div className="flex items-center text-on-surface-variant text-xs font-label uppercase tracking-wider">
            <Icon name="group" size={14} className="mr-2" />
            {regCount + ' / ' + maxP + ' players'}
          </div>
        )}
      </div>

      {(phase === 'registration' || phase === 'check_in') && !isPreview && (
        <div className="mb-4 h-1 rounded-full bg-surface-container-highest">
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: pct + '%', background: barColor }}
          />
        </div>
      )}

      {prizes.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {prizes.slice(0, 3).map(function(p, i) {
            var label = p.prize || (p.amount ? p.amount + (p.currency || '') : '')
            if (!label) return null
            return (
              <span
                key={'p-' + i}
                className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 font-label"
              >
                {'#' + (p.placement || (i + 1)) + ' ' + label}
              </span>
            )
          })}
        </div>
      )}

      {actionBtn}
    </Panel>
  )
}

function WeeklyClashesPanel(props) {
  var navigate = props.navigate
  var currentUser = props.currentUser
  var onAuthClick = props.onAuthClick
  var toast = props.toast
  var players = props.players

  var ctx = useApp()
  var tournamentStateEu = ctx.tournamentState
  var tournamentStateNa = ctx.tournamentStateNa
  var location = useLocation()
  var euRef = useRef(null)
  var naRef = useRef(null)

  var _euRow = useState(null); var euRow = _euRow[0]; var setEuRow = _euRow[1]
  var _naRow = useState(null); var naRow = _naRow[0]; var setNaRow = _naRow[1]
  var _regCounts = useState({}); var regCounts = _regCounts[0]; var setRegCounts = _regCounts[1]
  var _myRegIds = useState([]); var myRegIds = _myRegIds[0]; var setMyRegIds = _myRegIds[1]

  var linkedPlayer = resolveLinkedPlayer(currentUser, players)
  var linkedPlayerId = linkedPlayer ? linkedPlayer.id : null

  var euTsId = tournamentStateEu ? tournamentStateEu.dbTournamentId : null
  var euTsPhase = tournamentStateEu ? tournamentStateEu.phase : null
  var euTsAt = tournamentStateEu ? tournamentStateEu.clashTimestamp : null
  var naTsId = tournamentStateNa ? tournamentStateNa.dbTournamentId : null
  var naTsPhase = tournamentStateNa ? tournamentStateNa.phase : null
  var naTsAt = tournamentStateNa ? tournamentStateNa.clashTimestamp : null

  // Pull live EU + NA weekly clashes from DB; fall back to scheduled-but-unopened
  // previews from site_settings so a region card never blanks out for the public.
  useEffect(function() {
    if (!supabase || !supabase.from) return
    var cancelled = false
    supabase.from('tournaments')
      .select('id,name,date,region,phase,type,is_finale,max_players,prize_pool_json')
      .eq('type', 'season_clash')
      .in('phase', ['registration', 'check_in', 'in_progress', 'draft'])
      .is('archived_at', null)
      .order('date', { ascending: true })
      .limit(40)
      .then(function(res) {
        if (cancelled || res.error || !res.data) return
        var eu = null
        var na = null
        var priority = { in_progress: 0, check_in: 1, registration: 2, draft: 3 }
        res.data.forEach(function(t) {
          var r = normalizeRegion(t.region)
          if (!r) return
          if (r === 'EU') {
            if (!eu || (priority[t.phase] || 9) < (priority[eu.phase] || 9)) eu = t
          } else if (r === 'NA') {
            if (!na || (priority[t.phase] || 9) < (priority[na.phase] || 9)) na = t
          }
        })
        if (!eu) eu = previewFromState(tournamentStateEu, 'EU')
        if (!na) na = previewFromState(tournamentStateNa, 'NA')
        setEuRow(eu)
        setNaRow(na)
      }).catch(function() { /* swallow — region cards just stay empty */ })
    return function() { cancelled = true }
  }, [euTsId, euTsPhase, euTsAt, naTsId, naTsPhase, naTsAt])

  // Registration counts for whatever real clash rows we landed on.
  useEffect(function() {
    var ids = []
    if (euRow && !euRow.__preview) ids.push(euRow.id)
    if (naRow && !naRow.__preview) ids.push(naRow.id)
    if (ids.length === 0) return
    supabase.from('registrations').select('tournament_id, player_id').in('tournament_id', ids)
      .then(function(res) {
        if (!res.data) return
        var counts = {}
        var mine = []
        res.data.forEach(function(r) {
          counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1
          if (linkedPlayerId && r.player_id === linkedPlayerId) mine.push(r.tournament_id)
        })
        setRegCounts(counts)
        setMyRegIds(mine)
      }).catch(function() {})
  }, [euRow && euRow.id, naRow && naRow.id, linkedPlayerId])

  // Scroll the matching card into view + briefly highlight it whenever the
  // hash matches (set by HomeScreen "Check event details" CTA).
  useEffect(function() {
    var hash = (location.hash || '').replace('#', '')
    if (hash !== 'weekly-EU' && hash !== 'weekly-NA') return
    var el = hash === 'weekly-EU' ? euRef.current : naRef.current
    if (!el) {
      // wait one tick for DOM
      var t = setTimeout(function() {
        var lateEl = hash === 'weekly-EU' ? euRef.current : naRef.current
        if (lateEl && lateEl.scrollIntoView) lateEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
      return function() { clearTimeout(t) }
    }
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, euRow && euRow.id, naRow && naRow.id])

  function handleRegister(clash) {
    if (!currentUser) { if (onAuthClick) onAuthClick('login'); return }
    if (!linkedPlayer) { if (toast) toast('Link your Riot ID in Account first', 'error'); navigate('/account'); return }
    if (clash.__preview) { if (toast) toast('Registration is not open yet for this clash', 'info'); return }
    var maxP = clash.max_players || 24
    if ((regCounts[clash.id] || 0) >= maxP) { if (toast) toast('Tournament is full', 'error'); return }
    if (myRegIds.indexOf(clash.id) !== -1) { if (toast) toast('Already registered', 'info'); return }
    supabase.from('registrations').upsert({
      tournament_id: clash.id,
      player_id: linkedPlayer.id,
      status: 'registered'
    }, { onConflict: 'tournament_id,player_id' }).then(function(res) {
      if (res.error) { if (toast) toast('Registration failed: ' + res.error.message, 'error'); return }
      setMyRegIds(function(ids) { return ids.concat([clash.id]) })
      setRegCounts(function(c) {
        var next = Object.assign({}, c)
        next[clash.id] = (c[clash.id] || 0) + 1
        return next
      })
      if (toast) toast('Registered for ' + (clash.name || 'Weekly Clash'), 'success')
    }).catch(function() { if (toast) toast('Registration failed', 'error') })
  }

  // Hide entirely if BOTH regions have nothing scheduled — keeps the page tidy
  // before a season starts.
  if (!euRow && !naRow) return null

  var hash = (location.hash || '').replace('#', '')

  return (
    <section className="mb-12">
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-bold text-on-surface tracking-wide">Weekly Clash</h2>
          <p className="text-on-surface-variant text-sm font-body mt-1">
            The official EU + NA brackets. Free to enter every week.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div ref={euRef}>
          <WeeklyRegionCard
            clash={euRow}
            region="EU"
            regCount={euRow && !euRow.__preview ? (regCounts[euRow.id] || 0) : 0}
            amRegistered={euRow && myRegIds.indexOf(euRow.id) !== -1}
            currentUser={currentUser}
            linkedPlayer={linkedPlayer}
            navigate={navigate}
            onAuthClick={onAuthClick}
            toast={toast}
            onRegister={handleRegister}
            highlighted={hash === 'weekly-EU'}
          />
        </div>
        <div ref={naRef}>
          <WeeklyRegionCard
            clash={naRow}
            region="NA"
            regCount={naRow && !naRow.__preview ? (regCounts[naRow.id] || 0) : 0}
            amRegistered={naRow && myRegIds.indexOf(naRow.id) !== -1}
            currentUser={currentUser}
            linkedPlayer={linkedPlayer}
            navigate={navigate}
            onAuthClick={onAuthClick}
            toast={toast}
            onRegister={handleRegister}
            highlighted={hash === 'weekly-NA'}
          />
        </div>
      </div>
    </section>
  )
}

// ── Main EventsScreen ──────────────────────────────────────────────────────────

export default function EventsScreen() {
  var navigate = useNavigate()
  var { featuredEvents, setFeaturedEvents, players, currentUser, pastClashes, setProfilePlayer, toast, subRoute, seasonConfig, tournamentState } = useApp()

  // Migrated from the old four-tab layout. Old subRoutes ('featured',
  // 'tournaments') redirect to the unified feed so existing deep links keep
  // working without showing a blank tab.
  var rawTab = subRoute || 'all'
  if (rawTab === 'featured' || rawTab === 'tournaments') rawTab = 'all'
  var activeTab = rawTab

  var tabs = [
    { id: 'all', label: 'Live & Upcoming', icon: 'bolt' },
    { id: 'season', label: 'Season Calendar', icon: 'calendar_month' },
    { id: 'archive', label: 'Archive', icon: 'archive' },
  ]

  function handleAuthClick(mode) {
    navigate('/' + mode)
  }

  return (
    <PageLayout>
      <div className="pt-8 pb-24">
        {/* Weekly Clash overview — deep-link target for HomeScreen "Check event details" */}
        <WeeklyClashesPanel
          navigate={navigate}
          currentUser={currentUser}
          onAuthClick={handleAuthClick}
          toast={toast}
          players={players}
        />

        {/* Tab bar */}
        <PillTabGroup align="start" className="mb-12">
          {tabs.map(function(t) {
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={activeTab === t.id}
                onClick={function() { navigate('/events/' + t.id) }}
              >
                {t.label}
              </PillTab>
            )
          })}
        </PillTabGroup>

        {/* Tab content */}
        {activeTab === 'all' && (
          <LiveAndUpcomingTab
            featuredEvents={featuredEvents}
            currentUser={currentUser}
            players={players}
            onAuthClick={handleAuthClick}
            navigate={navigate}
            toast={toast}
          />
        )}
        {activeTab === 'season' && (
          <SeasonTab seasonConfig={seasonConfig} tournamentState={tournamentState} navigate={navigate} />
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
