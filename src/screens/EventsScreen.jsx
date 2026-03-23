import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon } from '../components/ui'

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
      <span className="flex items-center px-3 py-1 bg-error text-on-error font-label text-[10px] font-black uppercase tracking-widest rounded-sm">
        <span className="w-2 h-2 bg-on-error rounded-full mr-2 animate-pulse"></span>
        LIVE
      </span>
    )
  } else if (isRegistering) {
    badgeEl = (
      <span className="flex items-center px-3 py-1 bg-tertiary text-on-tertiary font-label text-[10px] font-black uppercase tracking-widest rounded-sm">
        REGISTERING
      </span>
    )
  } else {
    badgeEl = (
      <span className="flex items-center px-3 py-1 bg-surface-container-highest text-on-surface font-label text-[10px] font-black uppercase tracking-widest rounded-sm">
        UPCOMING
      </span>
    )
  }

  var actionBtn = null
  if (isLive) {
    actionBtn = (
      <button
        className="w-full py-3 border border-primary/20 text-primary font-label text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-all"
        style={{ background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
        onClick={function() { navigate('/tournament/' + ev.id) }}
      >
        WATCH BROADCAST
      </button>
    )
  } else if (amRegistered) {
    actionBtn = (
      <button
        className="w-full py-3 border border-primary/20 text-primary font-label text-xs font-bold uppercase tracking-widest cursor-default"
        style={{ background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
      >
        REGISTERED
      </button>
    )
  } else if (evFull) {
    actionBtn = (
      <button
        className="w-full py-3 border border-outline-variant/30 text-on-surface/50 cursor-not-allowed font-label text-xs font-bold uppercase tracking-widest"
        style={{ background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
      >
        FULL
      </button>
    )
  } else if (!currentUser) {
    actionBtn = (
      <button
        className="w-full py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary hover:opacity-90 transition-all"
        style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)' }}
        onClick={function(e) {
          e.stopPropagation()
          if (onAuthClick) onAuthClick('login')
        }}
      >
        SIGN IN TO REGISTER
      </button>
    )
  } else {
    actionBtn = (
      <button
        className="w-full py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary hover:opacity-90 transition-all"
        style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)' }}
        onClick={function(e) {
          e.stopPropagation()
          if (onRegister) onRegister(ev)
        }}
      >
        REGISTER NOW
      </button>
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
          <div className="text-on-surface font-stats font-bold text-xl">
            {ev.prizePool || '--'}
          </div>
          <div className="text-tertiary font-label text-[10px] uppercase tracking-widest">Prize Pool</div>
        </div>
      </div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-headline text-2xl font-bold leading-tight">{ev.name}</h3>
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

// ── Featured (live/upcoming community events) tab ─────────────────────────────

function FeaturedTab({ featuredEvents, setFeaturedEvents, currentUser, onAuthClick, navigate }) {
  var [filter, setFilter] = useState('all')
  var [sortBy, setSortBy] = useState('date')
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
              <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 font-label text-[10px] font-bold uppercase tracking-widest rounded-sm">
                Featured Event
              </span>
              {hero.prizePool && (
                <span className="flex items-center text-tertiary font-stats text-sm font-bold">
                  <Icon name="payments" size={16} className="mr-1" />
                  {hero.prizePool + ' PRIZE POOL'}
                </span>
              )}
            </div>
            <h1 className="font-headline text-5xl lg:text-7xl font-black mb-4 leading-none tracking-tight">
              {hero.name ? hero.name.split(' ').slice(0, 2).join(' ') : 'Featured'}
              <br />
              <span className="text-primary italic">
                {hero.name ? hero.name.split(' ').slice(2).join(' ') : 'Event'}
              </span>
            </h1>
            <p className="text-on-surface-variant text-lg max-w-xl mb-8 font-body leading-relaxed">
              {hero.description || 'The ultimate community clash. Join the competition and prove your tactical supremacy.'}
            </p>
            <div className="flex flex-wrap gap-4">
              {!currentUser ? (
                <button
                  className="px-8 py-4 rounded-full font-label font-bold text-sm uppercase tracking-widest text-on-primary hover:scale-105 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)', boxShadow: '0 40px 40px rgba(228, 225, 236, 0.06)' }}
                  onClick={function() { onAuthClick('login') }}
                >
                  REGISTER NOW
                </button>
              ) : (
                <button
                  className="px-8 py-4 rounded-full font-label font-bold text-sm uppercase tracking-widest text-on-primary hover:scale-105 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)', boxShadow: '0 40px 40px rgba(228, 225, 236, 0.06)' }}
                  onClick={function() { navigate('/tournament/' + hero.id) }}
                >
                  REGISTER NOW
                </button>
              )}
              <button
                className="px-8 py-4 border border-outline-variant/20 rounded-full font-label font-bold text-sm uppercase tracking-widest text-on-surface hover:bg-surface-variant/40 transition-colors"
                style={{ background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
                onClick={function() { navigate('/tournament/' + hero.id) }}
              >
                VIEW SCHEDULE
              </button>
            </div>
          </div>
        </section>
      )}

      {/* No events empty state */}
      {allEvents.length === 0 && (
        <section className="relative h-[500px] w-full mb-16 overflow-hidden bg-surface-container rounded-lg border border-outline-variant/10 flex items-center justify-center">
          <div className="text-center">
            <Icon name="event" size={48} className="text-on-surface-variant/20 block mb-4" />
            <h3 className="font-headline text-3xl font-bold text-on-surface mb-2">No Featured Events Yet</h3>
            <p className="text-on-surface-variant text-sm max-w-sm mx-auto">
              Featured tournaments and community events will appear here once created by event organizers.
            </p>
          </div>
        </section>
      )}

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
                  : 'text-on-surface/70 hover:text-on-surface'
                )}
                style={isActive ? {} : { background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
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
          <div className="bg-surface-container-high p-8 flex flex-col justify-between border-l-4 border-primary">
            <div>
              <span className="font-label text-xs text-primary uppercase tracking-widest mb-4 block">Quick FAQ</span>
              <h4 className="font-headline text-3xl font-bold mb-4">How to Join Community Events?</h4>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                Most community tournaments are open to all ranks. Ensure your Riot account is linked to your TFT Clash profile to automatically sync your stats and eligibility.
              </p>
            </div>
            <button
              className="inline-flex items-center text-primary font-label text-xs font-bold uppercase tracking-widest hover:translate-x-2 transition-transform w-fit"
              onClick={function() { navigate('/faq') }}
            >
              Learn More
              <Icon name="arrow_forward" size={16} className="ml-2" />
            </button>
          </div>
          <div className="bg-surface-container p-8 border border-outline-variant/10">
            <div className="flex items-center space-x-4 mb-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-tertiary"
                style={{ background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
              >
                <Icon name="verified_user" size={24} />
              </div>
              <h4 className="font-headline text-2xl font-bold">Safe and Fair Play</h4>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed mb-4">
              All tournaments are monitored by our proprietary Vanguard API. Cheating or unsportsmanlike behavior results in permanent league bans.
            </p>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Active Anticheat Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Past events list */}
      {past.length > 0 && (
        <div className="mt-16">
          <h3 className="font-headline text-2xl font-bold text-on-surface mb-6">Past Events</h3>
          <div className="flex flex-col gap-3">
            {past.map(function(ev) {
              return (
                <div
                  key={ev.id}
                  className="bg-surface-container-low border border-outline-variant/10 px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/30"
                  onClick={function() { navigate('/tournament/' + ev.id) }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-headline font-bold text-base text-on-surface mb-0.5">{ev.name}</div>
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
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Host CTA */}
      <div className="mt-16 bg-surface-container-high p-10 border border-outline-variant/10 text-center">
        <Icon name="sports_esports" size={40} className="text-primary block mx-auto mb-4" />
        <h3 className="font-headline text-3xl font-bold text-on-surface mb-3">Run Your Own Tournament</h3>
        <p className="text-on-surface-variant text-sm leading-relaxed max-w-md mx-auto mb-8">
          Get featured here. Create and manage TFT tournaments with our full host suite.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            className="px-8 py-4 rounded-full font-label font-bold text-sm uppercase tracking-widest text-on-primary hover:scale-105 transition-transform"
            style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)', boxShadow: '0 40px 40px rgba(228, 225, 236, 0.06)' }}
            onClick={function() { navigate(currentUser ? '/host/apply' : '/signup') }}
          >
            Apply to Host
          </button>
          <button
            className="px-8 py-4 border border-outline-variant/20 rounded-full font-label font-bold text-sm uppercase tracking-widest text-on-surface hover:bg-surface-variant/40 transition-colors"
            style={{ background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
            onClick={function() { navigate('/pricing') }}
          >
            View Host Plans
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tournaments tab (flash tournaments from DB) ────────────────────────────────

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
    registration: 'rgba(103,226,217,0.15)',
    check_in: 'rgba(232,168,56,0.15)',
    in_progress: 'rgba(255,198,107,0.15)',
    complete: 'rgba(78,205,196,0.15)',
  }

  var phaseBadgeColor = {
    draft: '#9AAABF',
    registration: '#67e2d9',
    check_in: '#E8A838',
    in_progress: '#ffc66b',
    complete: '#67e2d9',
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-on-surface-variant font-label uppercase tracking-widest text-xs">
        Loading tournaments...
      </div>
    )
  }

  if (tournaments.length === 0) {
    return (
      <div className="bg-surface-container-low border border-outline-variant/10 p-16 text-center">
        <Icon name="bolt" size={40} className="text-on-surface-variant/20 block mx-auto mb-4" />
        <div className="font-headline text-2xl font-bold text-on-surface mb-2">No Tournaments Yet</div>
        <div className="text-sm text-on-surface-variant leading-relaxed">
          Flash tournaments will appear here when admins create them.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-10">
        <p className="text-on-surface-variant text-sm font-body">
          Flash tournaments, competitive events, and community clashes. Free to enter, play to win.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
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
            <article
              key={t.id}
              className="group bg-surface-container-low overflow-hidden transition-all duration-300 hover:-translate-y-2 cursor-pointer"
              onClick={function() { navigate('/flash/' + t.id) }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-bold rounded-sm px-3 py-1 uppercase tracking-widest font-label"
                    style={{ background: badgeBg, color: badgeColor }}
                  >
                    {phaseLabels[t.phase] || t.phase}
                  </span>
                  <div className="flex items-center gap-2">
                    {countdownStr && (
                      <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-sm px-2 py-0.5 font-stats">
                        {countdownStr}
                      </span>
                    )}
                    <span className="text-[11px] text-on-surface-variant font-label">{dateStr}</span>
                  </div>
                </div>

                <h3 className="font-headline text-2xl font-bold text-on-surface mb-3">{t.name}</h3>

                {prizes.length > 0 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {prizes.slice(0, 3).map(function(p, i) {
                      return (
                        <span
                          key={i}
                          className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-sm px-2 py-0.5 font-label"
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
                    <span className="font-label uppercase tracking-wider">{regCount + ' / ' + maxP + ' players'}</span>
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

                <div className="text-xs text-on-surface-variant font-label uppercase tracking-wider">
                  {(t.round_count || 3) + ' games - ' + (t.seeding_method || 'snake') + ' seeding'}
                </div>
              </div>
            </article>
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
      <div className="bg-surface-container-low border border-outline-variant/10 p-16 text-center">
        <Icon name="archive" size={40} className="text-on-surface-variant/20 block mx-auto mb-4" />
        <div className="font-headline text-2xl font-bold text-on-surface mb-2">No Past Clashes</div>
        <div className="text-sm text-on-surface-variant">Completed clashes will be archived here.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {clashes.map(function(clash, idx) {
        return (
          <div
            key={clash.id || idx}
            className="bg-surface-container-low border border-outline-variant/10 px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:border-primary/30"
            onClick={function() { navigate('/results') }}
          >
            <div className="flex-shrink-0 w-10 h-10 bg-surface-container-high border border-outline-variant/20 flex items-center justify-center font-bold text-primary font-stats text-sm">
              {'#' + (clashes.length - idx)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-headline font-bold text-base text-on-surface mb-0.5">
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
          </div>
        )
      })}
    </div>
  )
}

// ── Main EventsScreen ──────────────────────────────────────────────────────────

export default function EventsScreen() {
  var { sub } = useParams()
  var navigate = useNavigate()
  var { featuredEvents, setFeaturedEvents, players, currentUser, pastClashes, setProfilePlayer } = useApp()

  var activeTab = sub || 'featured'

  var tabs = [
    { id: 'featured', label: 'Featured Events', icon: 'star' },
    { id: 'tournaments', label: 'Tournaments', icon: 'bolt' },
    { id: 'archive', label: 'Archive', icon: 'archive' },
  ]

  function handleAuthClick(mode) {
    navigate('/' + mode)
  }

  return (
    <PageLayout>
      <div className="pt-8 pb-24">
        {/* Tab bar */}
        <div className="flex items-center justify-between mb-12 flex-wrap gap-4">
          <div className="flex space-x-1">
            {tabs.map(function(t) {
              var isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={function() { navigate('/events/' + t.id) }}
                  className={'flex items-center gap-2 px-6 py-3 font-label text-xs font-bold uppercase tracking-widest transition-all duration-200 rounded-full ' + (isActive
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface/60 hover:text-on-surface'
                  )}
                  style={isActive ? {} : { background: 'rgba(52, 52, 60, 0.6)', backdropFilter: 'blur(24px)' }}
                >
                  <Icon name={t.icon} size={16} className={isActive ? '' : 'opacity-60'} />
                  {t.label}
                </button>
              )
            })}
          </div>
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
