import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats } from '../lib/stats.js'
import useCountdown from '../lib/useCountdown'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon, Panel } from '../components/ui'
import SectionHeader from '../components/shared/SectionHeader'
import AdBanner from '../components/shared/AdBanner'
import SponsorShowcase from '../components/shared/SponsorShowcase'
import { getDonateUrl } from '../lib/paypal'

// ── HeroCountdown ─────────────────────────────────────────────────────────────

function HeroCountdown(props) {
  var tournamentState = props.tournamentState
  var onRegister = props.onRegister
  var onViewStandings = props.onViewStandings
  var isLoggedIn = props.isLoggedIn

  var countdown = useCountdown(tournamentState)

  function pad2(n) { return String(n).padStart(2, '0') }

  return (
    <div className="glass-panel px-6 py-8 sm:p-8 rounded-xl border border-outline-variant/15 max-w-lg mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
      <div className="relative z-10 space-y-4">
        <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
          Next Tournament Begins In
        </span>
        <div className="flex justify-center gap-3 sm:gap-6">
          <div className="flex flex-col items-center">
            <span className="font-mono text-4xl sm:text-5xl text-primary leading-none">{pad2(countdown.days)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Days</span>
          </div>
          <span className="font-mono text-4xl sm:text-5xl text-primary/20">:</span>
          <div className="flex flex-col items-center">
            <span className="font-mono text-4xl sm:text-5xl text-primary leading-none">{pad2(countdown.hours)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Hours</span>
          </div>
          <span className="font-mono text-4xl sm:text-5xl text-primary/20">:</span>
          <div className="flex flex-col items-center">
            <span className="font-mono text-4xl sm:text-5xl text-primary leading-none">{pad2(countdown.minutes)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Mins</span>
          </div>
          <span className="font-mono text-4xl sm:text-5xl text-primary/20">:</span>
          <div className="flex flex-col items-center">
            <span className="font-mono text-4xl sm:text-5xl text-primary leading-none">{pad2(countdown.seconds)}</span>
            <span className="font-label text-[10px] uppercase opacity-40">Secs</span>
          </div>
        </div>
        <Btn variant="primary" size="xl" onClick={onRegister}>
          {isLoggedIn ? 'Go to Dashboard' : 'Join This Tournament'}
        </Btn>
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
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Community</span>
        <span className="font-mono text-lg sm:text-xl text-primary font-bold">Free to Play</span>
      </Panel>
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Players</span>
        <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{playerCount}</span>
      </Panel>
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
        <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Clashes Run</span>
        <span className="font-mono text-lg sm:text-xl text-on-surface font-bold">{clashCount}</span>
      </Panel>
      <Panel padding="none" className="p-4 sm:p-6 hover:bg-surface-container transition-colors">
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
      </Panel>
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
        <Btn variant="link" onClick={onViewAll}>
          View All Standings
        </Btn>
      </div>

      <div className="space-y-3">
        {top5.map(function(player, i) {
          var isFirst = i === 0
          var stats = getStats(player)
          var playerPath = '/player/' + player.name

          function handleKey(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(playerPath) }
          }

          if (isFirst) {
            return (
              <div
                key={player.id || player.name}
                role="button"
                tabIndex={0}
                className="group relative overflow-hidden bg-surface-container-high p-4 rounded-lg flex items-center justify-between border-l-4 border-primary cursor-pointer hover:bg-surface-container-highest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={function() { onNavigate(playerPath) }}
                onKeyDown={handleKey}
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
                        <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 rounded uppercase tracking-tighter">
                          {player.rank || 'Challenger'}
                        </span>
                        <span className="text-on-surface-variant text-[10px] font-label px-2 rounded uppercase tracking-tighter">
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
              role="button"
              tabIndex={0}
              className={'bg-surface-container-low p-4 rounded-lg flex items-center justify-between hover:bg-surface-container transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' + opacity}
              onClick={function() { onNavigate(playerPath) }}
              onKeyDown={handleKey}
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
                      <span className="bg-tertiary/10 text-tertiary text-[10px] font-label px-2 rounded uppercase tracking-tighter">
                        {player.rank || 'Master'}
                      </span>
                      <span className="text-on-surface-variant text-[10px] font-label px-2 rounded uppercase tracking-tighter">
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
  var sharedCountdown = useCountdown(tournamentState)
  var hasCountdown = sharedCountdown.hasCountdown

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

  var seasonLabel = sharedCountdown.clashName || seasonConfig.seasonName || 'TFT Clash'

  return (
    <PageLayout showSidebar={false} maxWidth="max-w-[880px]">
      <style>{`
        .glass-panel {
          background: rgba(52, 52, 60, 0.6);
          backdrop-filter: blur(24px);
        }
      `}</style>

      <div className="space-y-8 sm:space-y-12">

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
            Free weekly tournaments. Real competition. One leaderboard to rule them all.
          </p>

          {/* Countdown or CTA */}
          {hasCountdown
            ? (
              <HeroCountdown
                tournamentState={tournamentState}
                onRegister={currentUser ? function() { navigate('/'); } : handleSignUp}
                onViewStandings={handleViewStandings}
                isLoggedIn={!!currentUser}
              />
            )
            : currentUser
            ? (
              <div className="glass-panel px-6 py-8 sm:p-8 rounded-xl border border-outline-variant/15 max-w-lg mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10 space-y-4">
                  <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
                    {'Welcome back, ' + (currentUser.username || 'Challenger')}
                  </span>
                  <Btn variant="primary" size="xl" onClick={function() { navigate('/'); }}>
                    Go to Dashboard
                  </Btn>
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
              <div className="glass-panel px-6 py-8 sm:p-8 rounded-xl border border-outline-variant/15 max-w-lg mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                <div className="relative z-10 space-y-4">
                  <span className="block text-center font-label text-xs tracking-widest uppercase text-on-surface-variant">
                    Takes 10 seconds with Discord
                  </span>
                  <Btn variant="primary" size="xl" onClick={handleSignUp}>
                    Join This Week's Tournament
                  </Btn>
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

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        {!currentUser && (
          <section className="space-y-6">
            <h2 className="text-center font-headline text-2xl sm:text-3xl italic text-on-surface">
              How It <span className="text-primary">Works</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Panel padding="default" className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="login" size={24} className="text-primary" />
                </div>
                <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">Sign in with Discord</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">One click. No passwords, no emails to verify. You already have Discord open.</p>
              </Panel>
              <Panel padding="default" className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="sports_esports" size={24} className="text-primary" />
                </div>
                <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">Join a Tournament</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Register for the next weekly clash. Check in when it starts, get assigned a lobby, play your games.</p>
              </Panel>
              <Panel padding="default" className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="trending_up" size={24} className="text-primary" />
                </div>
                <h3 className="font-label text-sm font-bold uppercase tracking-wider text-on-surface">Climb the Leaderboard</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Earn points based on placement. Track your stats, build streaks, compete for the season title.</p>
              </Panel>
            </div>
          </section>
        )}

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
              { label: 'Dashboard', icon: 'dashboard', path: '/' },
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

        {/* ── Sponsor Strip ─────────────────────────────────────────────────── */}
        <SponsorShowcase placement="homepage" variant="strip" />

        {/* ── Ad Banner ─────────────────────────────────────────────────────── */}
        <AdBanner size="banner" className="w-full" />

        {/* ── Common Questions ─────────────────────────────────────────────── */}
        {!currentUser && (
          <section className="space-y-6">
            <h2 className="text-center font-headline text-2xl sm:text-3xl italic text-on-surface">
              Common <span className="text-primary">Questions</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Is it really free?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Yes, forever. Competing in clashes and climbing the leaderboard costs nothing. Pro and Host tiers add optional extras.</p>
              </Panel>
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Do I need to be good?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">All skill levels are welcome. The points system rewards consistency, not just wins. Iron to Challenger, everyone competes.</p>
              </Panel>
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">How long does a clash take?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Each clash runs a set of TFT games in one session. Register in advance, check in when it starts, and play your games. Usually a couple of hours.</p>
              </Panel>
              <Panel padding="none" className="p-5 space-y-2">
                <h3 className="font-label text-xs font-bold uppercase tracking-wider text-primary">Is my Discord data safe?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">We only access your public Discord profile (username and avatar). We never read your messages, servers, or friends list.</p>
              </Panel>
            </div>
          </section>
        )}

        {/* ── Support the platform ─────────────────────────────────────────── */}
        <section className="mt-16 mb-4">
          <Panel padding="spacious" elevation="elevated" className="text-center">
            <SectionHeader
              eyebrow="Community Supported"
              title="Keep TFT Clash free forever"
              description="Running weekly tournaments costs real money. If you get value from competing here, a tip keeps the lights on, the servers fast, and the entry fee at zero."
              align="center"
            />
            <div className="mt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Btn
                href={getDonateUrl()}
                variant="primary"
                size="lg"
                icon="favorite"
                iconPosition="left"
              >
                Donate via PayPal
              </Btn>
              <Btn
                variant="link"
                onClick={function(){ navigate('/pricing') }}
              >
                Or go Pro
              </Btn>
            </div>
          </Panel>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        {!currentUser && (
          <section className="text-center space-y-4 pt-4">
            <p className="text-on-surface-variant text-sm">
              {players.length > 0 ? players.length.toLocaleString() + ' players are already on the leaderboard.' : 'Your spot on the leaderboard is waiting.'}
            </p>
            <Btn variant="primary" size="lg" onClick={handleSignUp}>
              Join This Week's Tournament
            </Btn>
          </section>
        )}

        {/* ── Footer Links ──────────────────────────────────────────────────── */}
        <footer className="pt-12 border-t border-outline-variant/10 text-center space-y-4">
          <div className="flex justify-center gap-4 flex-wrap">
            <Btn variant="secondary" size="md" onClick={handleViewRules}>
              Tournament Rules
            </Btn>
            <Btn variant="secondary" size="md" onClick={handleViewFaq}>
              How to Play
            </Btn>
          </div>
        </footer>

      </div>

      {/* ── FAB ───────────────────────────────────────────────────────────────── */}
      <button
        className="fixed bottom-8 right-8 z-50 w-16 h-16 rounded-xl flex items-center justify-center active:scale-95 transition-all group overflow-hidden border-0 cursor-pointer bg-gradient-to-br from-primary to-primary-fixed-dim shadow-[0_10px_30px_rgba(232,168,56,0.4)]"
        onClick={function() {
          if (currentUser) {
            navigate('/');
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
