import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import CountdownTimer from '../components/shared/CountdownTimer'
import RankBadge from '../components/shared/RankBadge'

var RANK_MEDAL_COLORS = ['#E8A838', '#C0C0C0', '#CD7F32']

function StatBar({ players, totalGames, totalPts }) {
  var stats = [
    { label: 'Active Players', value: players.length, icon: 'group', color: 'text-primary' },
    { label: 'Games Played', value: totalGames, icon: 'sports_esports', color: 'text-tertiary' },
    { label: 'Season Points', value: totalPts, icon: 'star', color: 'text-secondary' },
    { label: 'Status', value: 'Live', icon: 'circle', color: 'text-success' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-outline-variant/10 border border-outline-variant/10 rounded-sm overflow-hidden mb-8">
      {stats.map(function(s) {
        return (
          <div key={s.label} className="bg-surface-container-low p-4 text-center">
            <Icon name={s.icon} size={16} className={'mb-1 ' + s.color} />
            <div className={'font-mono text-2xl font-bold ' + s.color}>{s.value}</div>
            <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface/40 mt-1">{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function ChampionCard({ champion, onNavigate }) {
  var stats = getStats(champion)

  function handleClick() {
    onNavigate('/player/' + champion.name)
  }

  return (
    <Panel accent="gold" className="cursor-pointer hover:bg-surface-container transition-colors" onClick={handleClick}>
      <div className="flex items-center gap-2 mb-4">
        <Icon name="crown" fill size={14} className="text-primary" />
        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Season Champion</span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center text-xl font-black text-primary">
          {champion.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-bold text-lg text-on-surface mb-1">{champion.name}</div>
          <div className="flex items-center gap-2">
            <RankBadge rank={champion.rank || 'Challenger'} />
            <span className="text-[11px] text-on-surface/40">{champion.region || 'EUW'}</span>
          </div>
          <div className="flex gap-4 mt-2">
            <div>
              <span className="font-mono text-base font-bold text-primary">{champion.pts}</span>
              <span className="font-sans text-[10px] text-on-surface/40 ml-1 uppercase tracking-wide">PTS</span>
            </div>
            <div>
              <span className="font-mono text-base font-bold text-tertiary">{champion.wins || 0}</span>
              <span className="font-sans text-[10px] text-on-surface/40 ml-1 uppercase tracking-wide">WINS</span>
            </div>
            <div>
              <span className="font-mono text-base font-bold text-secondary">{stats.avgPlacement}</span>
              <span className="font-sans text-[10px] text-on-surface/40 ml-1 uppercase tracking-wide">AVG</span>
            </div>
          </div>
        </div>
        <Icon name="chevron_right" size={18} className="text-on-surface/40" />
      </div>
    </Panel>
  )
}

function LeaderboardPreview({ top5, onNavigate, onViewAll }) {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10 bg-surface-container-highest/30">
        <div className="flex items-center gap-2">
          <Icon name="trophy" fill size={13} className="text-primary" />
          <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface/60">Top Players</span>
        </div>
        <Btn variant="ghost" size="sm" onClick={onViewAll}>View All</Btn>
      </div>

      {top5.length === 0 && (
        <div className="text-center py-8 text-on-surface/40 text-sm">No players yet</div>
      )}

      {top5.map(function(player, i) {
        var medalColor = i < 3 ? RANK_MEDAL_COLORS[i] : null

        function handleClick() {
          onNavigate('/player/' + player.name)
        }

        return (
          <div
            key={player.id}
            className="grid grid-cols-[28px_1fr_auto] items-center px-4 py-3 border-b border-outline-variant/5 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={handleClick}
          >
            <div
              className="font-mono text-sm font-black text-center"
              style={medalColor ? { color: medalColor } : { color: '#9AAABF' }}
            >
              {i < 3
                ? <Icon name="emoji_events" fill size={16} style={{ color: medalColor }} />
                : i + 1
              }
            </div>
            <div className="min-w-0 pl-2">
              <div className={'font-medium text-sm truncate ' + (i < 3 ? 'text-on-surface' : 'text-on-surface/70')}>
                {player.name}
              </div>
              <div className="text-[11px] text-on-surface/40 mt-0.5">
                {player.rank || 'Unranked'} {' - '} {player.wins || 0}W
              </div>
            </div>
            <div
              className={'font-mono text-right ' + (i < 3 ? 'text-lg font-black' : 'text-sm font-bold text-on-surface/60')}
              style={i === 0 ? { color: '#E8A838' } : undefined}
            >
              {player.pts}
            </div>
          </div>
        )
      })}
    </Panel>
  )
}

function HowItWorksCards() {
  var steps = [
    { num: '01', title: 'Sign Up', desc: 'Free account, link your Riot ID', icon: 'person_add', color: 'text-secondary' },
    { num: '02', title: 'Register', desc: 'Join the Saturday clash', icon: 'assignment_turned_in', color: 'text-tertiary' },
    { num: '03', title: 'Compete', desc: 'Play lobbies, earn points', icon: 'sports_esports', color: 'text-primary' },
    { num: '04', title: 'Rise', desc: 'Climb the leaderboard', icon: 'trending_up', color: 'text-tertiary' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {steps.map(function(step) {
        return (
          <Panel key={step.num} className="text-center">
            <Icon name={step.icon} fill size={24} className={'mb-3 ' + step.color} />
            <div className="font-sans text-[9px] uppercase tracking-[0.2em] text-on-surface/30 mb-1">{step.num}</div>
            <div className="font-bold text-sm text-on-surface mb-1">{step.title}</div>
            <div className="text-xs text-on-surface/50 leading-relaxed">{step.desc}</div>
          </Panel>
        )
      })}
    </div>
  )
}

function AnnouncementBanner({ text }) {
  if (!text) return null
  return (
    <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-sm px-4 py-3 mb-6">
      <Icon name="campaign" fill size={15} className="text-primary shrink-0" />
      <span className="text-primary font-medium text-sm">{text}</span>
    </div>
  )
}

function FeaturedEventCard({ event, onNavigate }) {
  if (!event) return null

  function handleClick() {
    onNavigate('/events')
  }

  return (
    <Panel glass className="cursor-pointer hover:bg-white/5 transition-colors p-0 mb-6" onClick={handleClick}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant/10 bg-surface-container-highest/20">
        <Icon name="event" fill size={12} className="text-secondary" />
        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Featured Event</span>
        <Icon name="chevron_right" size={14} className="text-on-surface/40 ml-auto" />
      </div>
      <div className="px-4 py-3">
        <div className="font-bold text-sm text-on-surface mb-1 truncate">{event.name || 'Upcoming Event'}</div>
        <div className="text-xs text-on-surface/40">
          {'Hosted by ' + (event.host || 'TFT Clash') + (event.date ? ' - ' + event.date : '')}
        </div>
      </div>
    </Panel>
  )
}

export default function HomeScreen() {
  var ctx = useApp()
  var players = ctx.players
  var currentUser = ctx.currentUser
  var tournamentState = ctx.tournamentState
  var announcement = ctx.announcement
  var featuredEvents = ctx.featuredEvents
  var setProfilePlayer = ctx.setProfilePlayer
  var setAuthScreen = ctx.setAuthScreen
  var navigate = useNavigate()

  // Derived data
  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var top5 = sorted.slice(0, 5)
  var totalGames = players.reduce(function(s, p) { return s + (p.games || 0) }, 0)
  var totalPts = players.reduce(function(s, p) { return s + (p.pts || 0) }, 0)
  var champion = top5.length > 0 ? top5[0] : null
  var featuredEvent = featuredEvents && featuredEvents.length > 0 ? featuredEvents[0] : null

  // Clash countdown
  var clashTimestamp = tournamentState && tournamentState.clashTimestamp
  var clashName = tournamentState && tournamentState.clashName
  var hasCountdown = clashTimestamp && new Date(clashTimestamp) > new Date()

  function handleNavigate(path) {
    setProfilePlayer && setProfilePlayer(null)
    navigate(path)
  }

  function handlePlayerNavigate(path) {
    navigate(path)
  }

  function handleSignUp() {
    setAuthScreen('signup')
  }

  function handleLogin() {
    navigate('/login')
  }

  function handleViewLeaderboard() {
    navigate('/leaderboard')
  }

  function handleViewEvents() {
    navigate('/events')
  }

  // If logged in, this screen should not be shown (handled by router)
  // But we gracefully handle it just in case
  if (currentUser) {
    return null
  }

  return (
    <PageLayout showSidebar={false} maxWidth="max-w-4xl">
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/10 blur-[120px] opacity-50" />
      </div>

      <div className="relative">
        {/* Announcement */}
        <AnnouncementBanner text={announcement} />

        {/* Hero Header */}
        <div className="text-center mb-16 pt-8">
          <span className="inline-block px-6 py-1 bg-tertiary/10 text-tertiary font-sans uppercase tracking-[0.2em] text-sm border border-tertiary/20 rounded-sm mb-6">
            {clashName || 'Season 1 - Free to Compete'}
          </span>

          <h1 className="text-6xl md:text-8xl font-serif font-black tracking-tight leading-none text-on-surface mb-6">
            TFT CLASH
          </h1>

          <p className="max-w-2xl mx-auto text-on-surface/60 text-lg leading-relaxed italic mb-10">
            Weekly tournaments, seasonal rankings, and a permanent record of every champion crowned.
            The competitive TFT platform built for players who want more than ranked.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Btn variant="primary" size="lg" onClick={handleSignUp}>
              Create Free Account
            </Btn>
            <Btn variant="secondary" size="lg" onClick={handleLogin}>
              Sign In
            </Btn>
          </div>
        </div>

        {/* Countdown Timer */}
        {hasCountdown && (
          <div className="mb-8">
            <div className="text-center mb-3">
              <span className="font-sans text-[10px] uppercase tracking-[0.15em] text-on-surface/40">
                Next Clash Starts In
              </span>
              {clashName && (
                <div className="font-medium text-sm text-on-surface/60 mt-1">{clashName}</div>
              )}
            </div>
            <CountdownTimer targetDate={clashTimestamp} />
            <div className="text-center mt-4">
              <Btn variant="primary" size="md" onClick={handleSignUp}>
                Register Your Team
              </Btn>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <StatBar players={players} totalGames={totalGames} totalPts={totalPts} />

        {/* Featured Event */}
        {featuredEvent && (
          <FeaturedEventCard event={featuredEvent} onNavigate={handleViewEvents} />
        )}

        {/* Two-column: Champion + Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="flex flex-col gap-4">
            {champion && (
              <ChampionCard champion={champion} onNavigate={handlePlayerNavigate} />
            )}
          </div>

          <LeaderboardPreview
            top5={top5}
            onNavigate={handlePlayerNavigate}
            onViewAll={handleViewLeaderboard}
          />
        </div>

        {/* How It Works */}
        <HowItWorksCards />

        {/* Bottom CTA */}
        <Panel accent="purple" className="text-center mb-8">
          <h2 className="font-bold text-lg text-on-surface mb-2">Ready to Compete?</h2>
          <p className="text-sm text-on-surface/50 mb-6 max-w-sm mx-auto">
            {'Join ' + players.length + ' players competing this season. Always free.'}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Btn variant="primary" onClick={handleSignUp}>
              Create Free Account
            </Btn>
            <Btn variant="secondary" onClick={handleLogin}>
              Sign In
            </Btn>
          </div>
        </Panel>
      </div>
    </PageLayout>
  )
}
