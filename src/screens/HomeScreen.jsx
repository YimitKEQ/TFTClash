import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon } from '../components/ui'

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

function HeroCountdown({ clashTimestamp, onRegister }) {
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
          className="w-full py-4 rounded-xl font-label text-sm font-bold text-on-primary-fixed uppercase tracking-widest active:scale-[0.98] transition-all hover:shadow-[0_0_30px_rgba(232,168,56,0.3)]"
          style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)' }}
          onClick={onRegister}
        >
          Register Your Team
        </button>
      </div>
    </div>
  )
}

// ── SeasonStatsBar ────────────────────────────────────────────────────────────

function SeasonStatsBar({ players, pastClashes }) {
  var activeTeams = players.length > 0 ? players.length.toLocaleString() : 'Growing'
  var tournamentCount = (pastClashes && pastClashes.length > 0) ? String(pastClashes.length) : '0'

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Community</span>
        <span className="font-mono text-xl text-primary">Free to Play</span>
      </div>
      <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Players</span>
        <span className="font-mono text-xl text-on-surface">{activeTeams}</span>
      </div>
      <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Clashes Run</span>
        <span className="font-mono text-xl text-on-surface">{tournamentCount}</span>
      </div>
      <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Status</span>
        <span className="flex items-center gap-2 font-mono text-xl text-tertiary">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
          LIVE
        </span>
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
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline underline-offset-4"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={onViewAll}
        >
          View All Standings
        </button>
      </div>

      <div className="space-y-3">
        {top5.map(function(player, i) {
          var isFirst = i === 0
          var stats = getStats(player)

          function handleClick() {
            onNavigate('/player/' + player.name)
          }

          if (isFirst) {
            return (
              <div
                key={player.id || player.name}
                className="group relative overflow-hidden bg-surface-container-high p-4 rounded-lg flex items-center justify-between border-l-4 border-primary cursor-pointer"
                onClick={handleClick}
              >
                <div className="flex items-center gap-6">
                  <span className="font-display text-2xl text-primary w-8">{RANK_LABELS[i]}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-surface-container-highest flex items-center justify-center border border-primary/20">
                      <span className="material-symbols-outlined text-primary">military_tech</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface">{player.name}</h3>
                      <div className="flex gap-2">
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
                <div className="flex gap-12 text-right">
                  <div>
                    <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">PTS</span>
                    <span className="font-mono text-on-surface">{(player.pts || 0).toLocaleString()}</span>
                  </div>
                  <div>
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
              onClick={handleClick}
            >
              <div className="flex items-center gap-6">
                <span className="font-display text-2xl text-on-surface-variant w-8">{RANK_LABELS[i]}</span>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-surface-container-highest flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-surface-variant">person</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface">{player.name}</h3>
                    <div className="flex gap-2">
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
              <div className="flex gap-12 text-right">
                <div>
                  <span className="block font-label text-[10px] text-on-surface-variant uppercase tracking-widest">PTS</span>
                  <span className="font-mono text-on-surface">{(player.pts || 0).toLocaleString()}</span>
                </div>
                <div>
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
  var countText = playerCount > 0 ? 'Join ' + playerCount.toLocaleString() + ' players competing for glory and rewards.' : 'Join our growing community and compete for glory and rewards.'

  return (
    <footer className="pt-12 border-t border-outline-variant/10 text-center space-y-4">
      <p className="text-on-surface-variant text-sm">
        {countText}
      </p>
      <div className="flex justify-center gap-4">
        <button
          className="bg-surface-container-high px-6 py-2 rounded-xl font-label text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors"
          style={{ border: 'none', cursor: 'pointer', color: 'inherit' }}
          onClick={onRules}
        >
          Tournament Rules
        </button>
        <button
          className="bg-surface-container-high px-6 py-2 rounded-xl font-label text-xs uppercase tracking-widest hover:bg-surface-container-highest transition-colors"
          style={{ border: 'none', cursor: 'pointer', color: 'inherit' }}
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

      <main className="pt-12 pb-20 px-4 max-w-[880px] mx-auto space-y-12">

        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="relative text-center space-y-8">

          {/* Season pill */}
          <div className="inline-block px-4 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary font-label text-xs tracking-[0.2em] uppercase">
            {seasonLabel}
          </div>

          {/* Main title */}
          <h1 className="text-7xl font-display text-primary tracking-tighter uppercase leading-none">
            TFT <span className="text-on-surface">CLASH</span>
          </h1>

          {/* Tagline */}
          <p className="max-w-xl mx-auto text-on-surface-variant font-headline text-2xl italic opacity-80">
            Where legends are forged in the convergence.
          </p>

          {/* Countdown or CTA */}
          {hasCountdown
            ? (
              <HeroCountdown clashTimestamp={clashTimestamp} onRegister={handleSignUp} />
            )
            : (
              <div className="glass-panel p-8 rounded-xl border border-outline-variant/15 max-w-md mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10 space-y-4">
                  <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
                    Join the Competition
                  </span>
                  <button
                    className="w-full py-4 rounded-xl font-label text-sm font-bold text-on-primary-fixed uppercase tracking-widest active:scale-[0.98] transition-all hover:shadow-[0_0_30px_rgba(232,168,56,0.3)]"
                    style={{ background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)' }}
                    onClick={handleSignUp}
                  >
                    Create Free Account
                  </button>
                </div>
              </div>
            )
          }
        </section>

        {/* ── Season Stats Bar ──────────────────────────────────────────────── */}
        <SeasonStatsBar players={players} pastClashes={pastClashes} />

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
        className="fixed bottom-8 right-8 w-16 h-16 rounded-xl flex items-center justify-center active:scale-95 transition-all group overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ffc66b 0%, #e8a838 100%)',
          boxShadow: '0 10px 30px rgba(232,168,56,0.4)',
          border: 'none',
          cursor: 'pointer',
          zIndex: 50,
        }}
        onClick={handleSignUp}
      >
        <span className="material-symbols-outlined text-on-primary-fixed group-hover:scale-110 transition-transform" style={{ fontSize: '30px' }}>
          add_circle
        </span>
      </button>
    </PageLayout>
  )
}
