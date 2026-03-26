import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon } from '../components/ui'
import AdBanner from '../components/shared/AdBanner'

// ── Countdown logic ──────────────────────────────────────────────────────────

function getTimeLeft(target) {
  var diff = Math.max(0, new Date(target) - new Date())
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// ── HeroCountdown ─────────────────────────────────────────────────────────────

function HeroCountdown({ clashTimestamp, onRegister, onViewStandings, isLoggedIn }) {
  var initial = clashTimestamp ? getTimeLeft(clashTimestamp) : { days: 0, hours: 0, minutes: 0, seconds: 0 }
  var [timeLeft, setTimeLeft] = useState(initial)

  useEffect(function() {
    if (!clashTimestamp) return
    var timer = setInterval(function() {
      setTimeLeft(getTimeLeft(clashTimestamp))
    }, 1000)
    return function() { clearInterval(timer) }
  }, [clashTimestamp])

  return (
    <div className="glass-panel p-8 rounded-xl border border-outline-variant/15 max-w-md mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
      <div className="relative z-10 space-y-4">
        <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
          Next Tournament Begins In
        </span>
        <div className="flex justify-center gap-6">
          <div className="flex flex-col items-center">
            <span className="font-mono text-5xl text-primary leading-none">{pad2(timeLeft.days)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Days</span>
          </div>
          <span className="font-mono text-5xl text-primary/20">:</span>
          <div className="flex flex-col items-center">
            <span className="font-mono text-5xl text-primary leading-none">{pad2(timeLeft.hours)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Hours</span>
          </div>
          <span className="font-mono text-5xl text-primary/20">:</span>
          <div className="flex flex-col items-center">
            <span className="font-mono text-5xl text-primary leading-none">{pad2(timeLeft.minutes)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Mins</span>
          </div>
        </div>
        <button
          className="w-full py-4 rounded-xl font-label text-sm font-bold text-on-primary-fixed uppercase tracking-widest active:scale-[0.98] transition-all hover:shadow-[0_0_30px_rgba(232,168,56,0.3)] bg-gradient-to-br from-primary to-primary-fixed-dim border-0 cursor-pointer"
          onClick={onRegister}
        >
          {isLoggedIn ? 'Go to Dashboard' : 'Sign Up Free'}
        </button>
        <a
          href="/standings"
          className="block text-center text-sm text-on-surface-variant underline-offset-2 hover:underline mt-1 cursor-pointer no-underline"
          onClick={function(e) { e.preventDefault(); onViewStandings && onViewStandings(); }}
        >
          View Standings
        </a>
      </div>
    </div>
  )
}

// ── SeasonStatsBar ────────────────────────────────────────────────────────────

function SeasonStatsBar({ players, pastClashes, tournamentState, seasonConfig }) {
  var phase = tournamentState && tournamentState.phase
  var isLive = phase === 'live' || phase === 'inprogress'
  var playerCount = players && players.length > 0 ? players.length.toLocaleString() : '\u2014'
  var clashCount = pastClashes && pastClashes.length > 0 ? String(pastClashes.length) : '\u2014'
  var seasonName = (seasonConfig && seasonConfig.seasonName) || 'Season 1'

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg border border-outline-variant/5 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Community</span>
        <span className="font-mono text-lg sm:text-xl text-primary font-bold">Free to Play</span>
      </div>
      <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg border border-outline-variant/5 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Players</span>
        <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{playerCount}</span>
      </div>
      <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg border border-outline-variant/5 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Clashes Run</span>
        <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{clashCount}</span>
      </div>
      <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg border border-outline-variant/5 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Status</span>
        {isLive
          ? (
            <span className="flex items-center gap-2 font-mono text-lg sm:text-xl text-tertiary font-bold">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              LIVE
            </span>
          )
          : (
            <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{seasonName}</span>
          )
        }
      </div>
    </section>
  )
}

// ── LeaderboardPreview ────────────────────────────────────────────────────────

function LeaderboardPreview({ top5, onNavigate, onViewAll }) {
  var RANK_LABELS = ['01', '02', '03', '04', '05']

  return (
    <section className="space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="font-headline text-3xl italic">
          Elite <span className="text-primary">Leaderboard</span>
        </h2>
        <button
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline underline-offset-4 bg-transparent border-0 cursor-pointer"
          onClick={onViewAll}
        >
          View All Standings
        </button>
      </div>

      <div className="space-y-3">
        {top5.map(function(player, i) {
          var isFirst = i === 0
          var stats = getStats(player)
          var playerPath = '/player/' + player.name

          if (isFirst) {
            return (
              <div
                key={player.id || player.name}
                className="group relative overflow-hidden bg-surface-container-high p-4 rounded-lg flex items-center justify-between border-l-4 border-primary cursor-pointer hover:bg-surface-container-highest transition-colors"
                onClick={function() { onNavigate(playerPath) }}
              >
                <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                  <span className="font-display text-2xl text-primary w-8 flex-shrink-0">{RANK_LABELS[i]}</span>
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-surface-container-highest flex items-center justify-center border border-primary/20 flex-shrink-0">
                      <Icon name="military_tech" size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-on-surface truncate">{player.name}</h3>
                      <div className="flex gap-2 flex-wrap">
                        <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 rounded-sm uppercase tracking-tighter">
                          {player.rank || 'Challenger'}
                        </span>
                        <span className="text-on-surface-variant text-[10px] font-label px-2 rounded-sm uppercase tracking-tighter">
                          {player.region || 'EUW'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 sm:gap-12 text-right flex-shrink-0 ml-2">
                  <div>
                    <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">PTS</span>
                    <span className="font-mono text-on-surface font-bold">{(player.pts || 0).toLocaleString()}</span>
                  </div>
                  <div className="hidden sm:block">
                    <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Win Rate</span>
                    <span className="font-mono text-primary">{stats.top1Rate ? stats.top1Rate + '%' : (player.wins || 0) + 'W'}</span>
                  </div>
                </div>
              </div>
            )
          }

          var opacity = i === 3 ? 'opacity-80' : i === 4 ? 'opacity-60' : ''

          return (
            <div
              key={player.id || player.name}
              className={'bg-surface-container-low p-4 rounded-lg flex items-center justify-between hover:bg-surface-container transition-colors cursor-pointer ' + opacity}
              onClick={function() { onNavigate(playerPath) }}
            >
              <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                <span className="font-display text-2xl text-on-surface-variant w-8 flex-shrink-0">{RANK_LABELS[i]}</span>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                    <Icon name="person" size={20} className="text-on-surface-variant" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-on-surface truncate">{player.name}</h3>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 rounded-sm uppercase tracking-tighter">
                        {player.rank || 'Master'}
                      </span>
                      <span className="text-on-surface-variant text-[10px] font-label px-2 rounded-sm uppercase tracking-tighter">
                        {player.region || 'EUW'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 sm:gap-12 text-right flex-shrink-0 ml-2">
                <div>
                  <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">PTS</span>
                  <span className="font-mono text-on-surface font-bold">{(player.pts || 0).toLocaleString()}</span>
                </div>
                <div className="hidden sm:block">
                  <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">Win Rate</span>
                  <span className="font-mono text-on-surface">{stats.top1Rate ? stats.top1Rate + '%' : (player.wins || 0) + 'W'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── PromotionFooter ───────────────────────────────────────────────────────────

function PromotionFooter({ playerCount, onRules, onHowToPlay }) {
  var countText = playerCount > 0 ? playerCount.toLocaleString() + ' players are already on the leaderboard. Your spot is free.' : 'Your spot on the leaderboard is free. Sign up and compete this week.'

  return (
    <footer className="pt-12 border-t border-outline-variant/10 text-center space-y-4">
      <p className="text-on-surface-variant text-sm">
        {countText}
      </p>
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          className="bg-surface-container-high px-6 py-3 min-h-[44px] rounded-xl font-label text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors border-0 cursor-pointer text-inherit"
          onClick={onRules}
        >
          Tournament Rules
        </button>
        <button
          className="bg-surface-container-high px-6 py-3 min-h-[44px] rounded-xl font-label text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors border-0 cursor-pointer text-inherit"
          onClick={onHowToPlay}
        >
          How to Play
        </button>
      </div>
    </footer>
  )
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  var ctx = useApp()
  var players = ctx.players || []
  var currentUser = ctx.currentUser
  var tournamentState = ctx.tournamentState
  var setAuthScreen = ctx.setAuthScreen
  var pastClashes = ctx.pastClashes || []
  var seasonConfig = ctx.seasonConfig || {}
  var navigate = useNavigate()

  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var top5 = sorted.slice(0, 5)
  var clashTimestamp = tournamentState && tournamentState.clashTimestamp
  var clashName = tournamentState && tournamentState.clashName
  var hasCountdown = clashTimestamp && new Date(clashTimestamp) > new Date()

  function handleSignUp() {
    setAuthScreen && setAuthScreen('signup')
  }

  function handleViewStandings() {
    navigate('/standings')
  }

  function handleNavigate(path) {
    navigate(path)
  }

  function handleViewLeaderboard() {
    navigate('/leaderboard')
  }

  function handleViewRules() {
    navigate('/rules')
  }

  function handleViewFaq() {
    navigate('/faq')
  }

  var seasonLabel = clashName || seasonConfig.seasonName || 'TFT Clash'

  return (
    <PageLayout showSidebar={false} maxWidth="max-w-[880px]">
      <style>{`
        .glass-panel {
          background: rgba(52, 52, 60, 0.6);
          backdrop-filter: blur(24px);
        }
      `}</style>

      <main className="pt-8 sm:pt-12 pb-20 px-4 max-w-[880px] mx-auto space-y-8 sm:space-y-12">

        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="relative text-center space-y-6 sm:space-y-8">

          {/* Season pill */}
          <div className="inline-block px-4 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary font-label text-xs tracking-[0.2em] uppercase">
            {seasonLabel}
          </div>

          {/* Main title */}
          <h1 className="text-5xl sm:text-7xl font-display text-primary tracking-tighter uppercase leading-none">
            TFT <span className="text-on-surface">CLASH</span>
          </h1>

          {/* Tagline */}
          <p className="max-w-xl mx-auto text-on-surface-variant font-headline text-xl opacity-60">
            The ranked TFT league for you. Compete weekly, climb the ladder.
          </p>

          {/* Countdown or CTA */}
          {hasCountdown
            ? (
              <HeroCountdown
                clashTimestamp={clashTimestamp}
                onRegister={currentUser ? function() { navigate('/dashboard'); } : handleSignUp}
                onViewStandings={handleViewStandings}
                isLoggedIn={!!currentUser}
              />
            )
            : currentUser
            ? (
              <div className="glass-panel p-8 rounded-xl border border-outline-variant/15 max-w-md mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10 space-y-4">
                  <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
                    {'Welcome back, ' + (currentUser.username || 'Challenger')}
                  </span>
                  <button
                    className="w-full py-4 rounded-xl font-label text-sm font-bold text-on-primary-fixed uppercase tracking-widest active:scale-[0.98] transition-all hover:shadow-[0_0_30px_rgba(232,168,56,0.3)] bg-gradient-to-br from-primary to-primary-fixed-dim border-0 cursor-pointer"
                    onClick={function() { navigate('/dashboard'); }}
                  >
                    Go to Dashboard
                  </button>
                  <a
                    href="/standings"
                    className="block text-center text-sm text-on-surface-variant underline-offset-2 hover:underline mt-1 cursor-pointer no-underline"
                    onClick={function(e) { e.preventDefault(); handleViewStandings(); }}
                  >
                    View Current Standings
                  </a>
                </div>
              </div>
            )
            : (
              <div className="glass-panel p-8 rounded-xl border border-outline-variant/15 max-w-md mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10 space-y-4">
                  <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
                    Free to compete, forever
                  </span>
                  <button
                    className="w-full py-4 rounded-xl font-label text-sm font-bold text-on-primary-fixed uppercase tracking-widest active:scale-[0.98] transition-all hover:shadow-[0_0_30px_rgba(232,168,56,0.3)] bg-gradient-to-br from-primary to-primary-fixed-dim border-0 cursor-pointer"
                    onClick={handleSignUp}
                  >
                    Enter the Arena - Free
                  </button>
                  <a
                    href="/standings"
                    className="block text-center text-sm text-on-surface-variant underline-offset-2 hover:underline mt-1 cursor-pointer no-underline"
                    onClick={function(e) { e.preventDefault(); handleViewStandings(); }}
                  >
                    View Current Standings
                  </a>
                </div>
              </div>
            )
          }
        </section>

        {/* ── Value Props ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-3">
          {['Free to compete, always', 'EUW \u00b7 EUNE \u00b7 NA', 'Results every week', 'Full stats + career history'].map(function(chip) {
            return (
              <span key={chip} className="px-4 py-1.5 rounded-full text-xs font-label tracking-widest uppercase border border-outline-variant/20 text-on-surface-variant bg-surface-container-low">
                {chip}
              </span>
            );
          })}
        </div>

        {/* ── Logged-in quick actions ───────────────────────────────────────── */}
        {currentUser && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
              { label: 'My Stats', icon: 'bar_chart', path: '/player/' + (currentUser.username || '') },
              { label: 'Standings', icon: 'leaderboard', path: '/standings' },
              { label: 'Events', icon: 'event', path: '/events' },
            ].map(function(item) {
              return (
                <button
                  key={item.label}
                  onClick={function() { navigate(item.path); }}
                  className="flex flex-col items-center gap-2 p-4 bg-surface-container-low rounded-lg border border-outline-variant/10 hover:bg-surface-container hover:border-primary/20 transition-all cursor-pointer group"
                >
                  <Icon name={item.icon} size={22} className="text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{item.label}</span>
                </button>
              );
            })}
          </section>
        )}

        {/* ── Ad Banner ─────────────────────────────────────────────────────── */}
        <AdBanner size="banner" className="w-full" />

        {/* ── Season Stats Bar ──────────────────────────────────────────────── */}
        <SeasonStatsBar
          players={players}
          pastClashes={pastClashes}
          tournamentState={tournamentState}
          seasonConfig={seasonConfig}
        />

        {/* ── Leaderboard Preview ───────────────────────────────────────────── */}
        {top5.length > 0 && (
          <LeaderboardPreview
            top5={top5}
            onNavigate={handleNavigate}
            onViewAll={handleViewLeaderboard}
          />
        )}

        {/* ── Promotion Footer ──────────────────────────────────────────────── */}
        <PromotionFooter
          playerCount={players.length}
          onRules={handleViewRules}
          onHowToPlay={handleViewFaq}
        />

      </main>

      {/* ── FAB ───────────────────────────────────────────────────────────────── */}
      <button
        className="fixed bottom-8 right-8 z-50 w-16 h-16 rounded-xl flex items-center justify-center active:scale-95 transition-all group overflow-hidden border-0 cursor-pointer bg-gradient-to-br from-primary to-primary-fixed-dim shadow-[0_10px_30px_rgba(232,168,56,0.4)]"
        onClick={function() {
          if (currentUser) {
            navigate('/dashboard');
          } else {
            handleSignUp();
          }
        }}
      >
        <Icon name={currentUser ? 'dashboard' : 'add_circle'} size={30} className="text-on-primary-fixed group-hover:scale-110 transition-transform" />
      </button>
    </PageLayout>
  )
}
