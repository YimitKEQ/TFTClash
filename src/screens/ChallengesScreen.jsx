import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { DAILY_CHALLENGES, WEEKLY_CHALLENGES, estimateXp, getXpProgress } from '../lib/stats.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

var MATERIAL_ICON_MAP = {
  'fire': 'local_fire_department',
  'bullseye': 'my_location',
  'lightning-charge-fill': 'bolt',
  'shield-fill': 'shield',
  'bar-chart-line-fill': 'bar_chart',
  'trophy-fill': 'emoji_events',
  'award-fill': 'military_tech',
  'star-fill': 'star',
  'rocket-takeoff-fill': 'rocket_launch',
  'moon-fill': 'dark_mode',
  'coin': 'monetization_on',
  'gem': 'diamond',
  'patch-check-fill': 'verified',
  'calendar-check-fill': 'event_available',
  'shield-check': 'verified_user',
  'eye-fill': 'visibility',
  'sun-fill': 'wb_sunny',
  'controller': 'sports_esports',
  'check-circle-fill': 'check_circle',
  'arrow-up-circle-fill': 'arrow_circle_up',
  'rosette-discount-check': 'workspace_premium',
};

function mapMaterialIcon(name) {
  return MATERIAL_ICON_MAP[name] || 'task_alt';
}

function getDailyReset() {
  var now = new Date();
  var utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  var diff = utcMidnight - now;
  var h = Math.floor(diff / 3600000);
  var m = Math.floor((diff % 3600000) / 60000);
  return h + 'h ' + m + 'm';
}

function getWeeklyReset() {
  var now = new Date();
  var dayOfWeek = now.getUTCDay();
  var daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  var nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 0, 0, 0));
  var diff = nextMonday - now;
  var d = Math.floor(diff / 86400000);
  var h = Math.floor((diff % 86400000) / 3600000);
  return d + 'd ' + h + 'h';
}

function buildHeatmapCells(challengeCompletions) {
  var intensityClasses = [
    'bg-surface-container-lowest',
    'bg-primary/20',
    'bg-primary/50',
    'bg-primary/90'
  ];
  var cells = [];
  var keys = Object.keys(challengeCompletions || {});
  for (var i = 0; i < 28; i++) {
    var intensity = keys.length > 0 ? (i < keys.length ? 2 : 0) : 0;
    cells.push(intensityClasses[intensity]);
  }
  return cells;
}

export default function ChallengesScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var players = ctx.players || [];
  var challengeCompletions = ctx.challengeCompletions || {};
  var setChallengeCompletions = ctx.setChallengeCompletions;
  var toast = ctx.toast;
  var seasonConfig = ctx.seasonConfig;
  var seasonName = (seasonConfig && seasonConfig.seasonName) || 'Season Battlepass';

  function markComplete(challenge) {
    if (!currentUser) { toast('Sign in to track challenge progress', 'error'); return; }
    if (challengeCompletions[challenge.id]) return;
    var newCompletions = Object.assign({}, challengeCompletions);
    newCompletions[challenge.id] = { completedAt: new Date().toISOString(), xp: challenge.xp };
    setChallengeCompletions(newCompletions);
    toast('+' + challenge.xp + ' XP: ' + challenge.name + ' completed!', 'success');
  }

  var [questTab, setQuestTab] = useState('daily');
  var [mainTab, setMainTab] = useState('active');
  var [xpLog, setXpLog] = useState([]);
  var [xpLogLoading, setXpLogLoading] = useState(false);

  useEffect(function() {
    if (mainTab !== 'xp-log' || !currentUser) return;
    setXpLogLoading(true);
    supabase.from('xp_events')
      .select('*')
      .eq('player_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(function(res) {
        if (res.data) setXpLog(res.data);
        setXpLogLoading(false);
      });
  }, [mainTab, currentUser && currentUser.id]);

  var dailyReset = getDailyReset();
  var weeklyReset = getWeeklyReset();

  var linked = players.find(function(p) { return p.name === (currentUser && currentUser.username); });
  var playerWins = linked ? (linked.wins || 0) : 0;
  var playerTop4 = linked ? (linked.top4 || 0) : 0;
  var playerGames = linked ? (linked.games || 0) : 0;

  var dailyChallenges = DAILY_CHALLENGES.map(function(c) {
    var prog = c.progress;
    if (linked) {
      if (c.id === 'd1') prog = Math.min(c.goal, playerWins > 0 ? 1 : 0);
      if (c.id === 'd2') prog = Math.min(c.goal, playerGames > 0 ? 1 : 0);
      if (c.id === 'd3') prog = Math.min(c.goal, playerTop4 > 0 ? 1 : 0);
    }
    if (challengeCompletions[c.id]) prog = c.goal;
    return Object.assign({}, c, { progress: prog });
  });

  var weeklyChallenges = WEEKLY_CHALLENGES.map(function(c) {
    var prog = c.progress;
    if (linked) {
      if (c.id === 'w1') prog = Math.min(c.goal, playerWins);
      if (c.id === 'w2') prog = Math.min(c.goal, playerTop4);
      if (c.id === 'w3') prog = Math.min(c.goal, playerTop4 > 0 ? 1 : 0);
    }
    if (challengeCompletions[c.id]) prog = c.goal;
    return Object.assign({}, c, { progress: prog });
  });

  var xp = linked ? estimateXp(linked) : 12450;
  var rankInfo = getXpProgress(xp);
  var xpNeeded = rankInfo.needed || 15000;
  var xpPct = rankInfo.needed > 0 ? Math.min(100, Math.round((rankInfo.current / rankInfo.needed) * 100)) : 100;

  var completedChallenges = dailyChallenges.concat(weeklyChallenges).filter(function(c) { return c.progress >= c.goal; });

  var activeQuests = questTab === 'daily' ? dailyChallenges : weeklyChallenges;
  var resetLabel = questTab === 'daily' ? ('Resets in ' + dailyReset) : ('Resets in ' + weeklyReset);

  return (
    <PageLayout>
      <div className="p-8 min-h-screen bg-surface">

        {/* Hero XP Section */}
        <header className="mb-12">
          <div className="flex justify-between items-end mb-4">
            <div>
              <span className="font-condensed text-primary uppercase tracking-[0.2em] text-xs font-bold">{seasonName}</span>
              <h1 className="font-serif text-5xl mt-2 italic">Challenges &amp; Progression</h1>
            </div>
            <div className="text-right">
              {rankInfo.next && (
                <span className="font-mono text-tertiary text-sm">{'NEXT RANK: ' + rankInfo.next.name.toUpperCase()}</span>
              )}
            </div>
          </div>
          <div className="relative h-4 bg-surface-container-lowest rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 shadow-[0_0_15px_rgba(253,186,73,0.3)] bg-gradient-to-br from-primary to-primary-fixed-dim"
              style={{ width: xpPct + '%' }}
            />
            <div
              className="absolute inset-y-0 w-1 bg-white animate-pulse"
              style={{ left: xpPct + '%' }}
            />
          </div>
          <div className="flex justify-between mt-3 font-mono text-[10px] text-on-surface/40 uppercase tracking-widest">
            <span>{'Rank ' + (rankInfo.rank.name || '') + ' (' + xp.toLocaleString() + ' XP)'}</span>
            <span>{xpNeeded.toLocaleString() + ' XP REQUIRED'}</span>
          </div>
        </header>

        {/* Main tab selector */}
        <div className="flex gap-4 mb-8">
          {['active', 'completed', 'xp-log'].map(function(t) {
            var label = t === 'xp-log' ? 'XP Log' : t.charAt(0).toUpperCase() + t.slice(1);
            var isActive = mainTab === t;
            return (
              <button
                key={t}
                onClick={function() { setMainTab(t); }}
                className={'font-condensed text-xs py-1 px-4 rounded-full border transition-colors ' + (isActive
                  ? 'border-primary/30 text-primary bg-primary/5'
                  : 'border-on-surface/10 text-on-surface/40 hover:text-on-surface')}
              >
                {label.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Active Tab */}
        {mainTab === 'active' && (
          <div className="grid grid-cols-12 gap-6">

            {/* Active Challenges Column */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-condensed text-xl uppercase tracking-widest border-l-4 border-primary pl-4">Active Quests</h2>
                <div className="flex gap-4">
                  <button
                    onClick={function() { setQuestTab('daily'); }}
                    className={'font-condensed text-xs py-1 px-4 rounded-full border transition-colors ' + (questTab === 'daily'
                      ? 'border-primary/30 text-primary bg-primary/5'
                      : 'border-on-surface/10 text-on-surface/40 hover:text-on-surface')}
                  >
                    DAILY
                  </button>
                  <button
                    onClick={function() { setQuestTab('weekly'); }}
                    className={'font-condensed text-xs py-1 px-4 rounded-full border transition-colors ' + (questTab === 'weekly'
                      ? 'border-primary/30 text-primary bg-primary/5'
                      : 'border-on-surface/10 text-on-surface/40 hover:text-on-surface')}
                  >
                    WEEKLY
                  </button>
                </div>
              </div>

              <div className="font-mono text-[10px] text-on-surface/30 uppercase tracking-widest -mt-2">
                {resetLabel}
              </div>

              {activeQuests.map(function(c, idx) {
                var done = c.progress >= c.goal;
                var pct = Math.min(100, Math.round((c.progress / Math.max(c.goal, 1)) * 100));
                var isWeekly = c.type === 'weekly';
                var accentColor = done ? 'text-tertiary' : (isWeekly ? 'text-secondary' : 'text-primary');
                var borderAccent = done ? 'border-l-4 border-tertiary/50' : (isWeekly && idx === 1 ? 'border-l-4 border-secondary/50' : '');
                var progressBg = done ? 'bg-tertiary' : (isWeekly ? 'bg-secondary-container' : '');
                var progressStyle = done ? {} : (isWeekly ? {} : { background: 'linear-gradient(135deg, #FFC66B 0%, #E8A838 100%)' });
                var iconName = mapMaterialIcon(c.icon);

                return (
                  <div
                    key={c.id}
                    className={'bg-surface-container-low p-6 flex items-center gap-6 group hover:bg-surface-container transition-colors ' + borderAccent}
                  >
                    <div className="w-16 h-16 bg-surface-container-high flex items-center justify-center border border-outline-variant/20 flex-shrink-0">
                      <Icon name={iconName} fill size={28} className={accentColor} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-serif text-xl">{c.name}</h3>
                          <p className={'text-xs text-on-surface/60 font-body ' + (done ? 'line-through' : '')}>{c.desc}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <span className={'font-mono text-sm ' + accentColor}>{'+' + c.xp + ' XP'}</span>
                          {done && (
                            <div className="text-[10px] font-mono text-tertiary uppercase tracking-widest mt-0.5">DONE</div>
                          )}
                        </div>
                      </div>
                      <div className="relative h-1.5 bg-surface-container-lowest mt-4">
                        <div
                          className={'absolute inset-y-0 left-0 ' + progressBg}
                          style={Object.assign({ width: pct + '%' }, progressStyle)}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="font-mono text-[10px] text-on-surface/30 flex gap-4">
                          <span>PROGRESS</span>
                          <span>{c.progress + ' / ' + c.goal + ' COMPLETED'}</span>
                        </div>
                        {!done && currentUser && (
                          <button
                            onClick={function() { markComplete(c); }}
                            className="font-mono text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/50 px-2 py-0.5 transition-colors"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Heatmap and Stats Column */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Activity Heatmap */}
              <div className="bg-surface-container p-6 border-t-2 border-primary/20">
                <h2 className="font-condensed text-xs uppercase tracking-[0.2em] text-on-surface/40 mb-6">Activity Frequency</h2>
                <div className="grid grid-cols-7 gap-1">
                  {buildHeatmapCells(challengeCompletions).map(function(cls, i) {
                    return (
                      <div
                        key={i}
                        className={'aspect-square ' + cls}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span className="text-[10px] font-mono text-on-surface/30">LESS</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-surface-container-lowest" />
                    <div className="w-2 h-2 bg-primary/20" />
                    <div className="w-2 h-2 bg-primary/50" />
                    <div className="w-2 h-2 bg-primary/90" />
                  </div>
                  <span className="text-[10px] font-mono text-on-surface/30">MORE</span>
                </div>
              </div>

              {/* Stats Card */}
              <div className="glass-panel p-6 border border-outline-variant/10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="font-condensed text-xs uppercase text-on-surface/50">COMPLETION RATE</span>
                    <span className="font-mono text-primary">
                      {completedChallenges.length > 0
                        ? Math.round((completedChallenges.length / (dailyChallenges.length + weeklyChallenges.length)) * 100) + '%'
                        : '0%'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-condensed text-xs uppercase text-on-surface/50">CURRENT STREAK</span>
                    <span className="font-mono text-secondary">
                      {linked && linked.currentStreak ? (linked.currentStreak + ' DAYS') : '0 DAYS'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-condensed text-xs uppercase text-on-surface/50">TOTAL EARNED XP</span>
                    <span className="font-mono text-tertiary">
                      {xp >= 1000 ? (xp / 1000).toFixed(1) + 'K' : xp}
                    </span>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-outline-variant/10">
                  <p className="font-serif italic text-on-surface/80 text-center text-sm leading-relaxed">
                    "The master of the arena is not born, but forged in the heat of daily discipline."
                  </p>
                </div>
              </div>


            </div>
          </div>
        )}

        {/* Completed Tab */}
        {mainTab === 'completed' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-condensed text-xl uppercase tracking-widest border-l-4 border-primary pl-4">Completed Challenges</h2>
              <span className="font-mono text-xs text-on-surface/40">{completedChallenges.length + ' TOTAL'}</span>
            </div>

            {completedChallenges.length === 0 ? (
              <div className="bg-surface-container-low p-12 text-center">
                <Icon name="workspace_premium" size={56} className="text-on-surface/20 block mb-4 mx-auto" />
                <p className="font-condensed text-on-surface/40 uppercase tracking-widest text-sm">No completed challenges yet</p>
                <p className="text-xs text-on-surface/30 mt-2 font-body">Keep playing to unlock rewards</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedChallenges.map(function(c) {
                  return (
                    <div key={c.id} className="bg-surface-container-low p-5 flex items-center gap-5 border-l-4 border-tertiary/50">
                      <div className="w-12 h-12 bg-surface-container-high flex items-center justify-center border border-tertiary/20 flex-shrink-0">
                        <Icon name="check_circle" fill size={22} className="text-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-lg text-tertiary">{c.name}</h3>
                        <p className="text-xs text-on-surface/50 font-body mt-0.5">{c.desc}</p>
                      </div>
                      <span className="font-mono text-tertiary text-sm flex-shrink-0">{'+' + c.xp + ' XP'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mainTab === 'xp-log' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-condensed text-xl uppercase tracking-widest border-l-4 border-primary pl-4">XP History</h2>
            </div>
            {xpLogLoading && (
              <div className="text-center py-10 text-on-surface/40 text-sm">Loading...</div>
            )}
            {!xpLogLoading && xpLog.length === 0 && (
              <div className="bg-surface-container-low p-12 text-center">
                <Icon name="history" size={56} className="text-on-surface/20 block mb-4 mx-auto" />
                <p className="font-condensed text-on-surface/40 uppercase tracking-widest text-sm">No XP history yet</p>
                <p className="text-xs text-on-surface/30 mt-2 font-body">Complete challenges to build your XP history</p>
              </div>
            )}
            {!xpLogLoading && xpLog.length > 0 && (
              <div className="space-y-2">
                {xpLog.map(function(entry) {
                  return (
                    <div key={entry.id} className="flex items-center justify-between px-4 py-3 bg-surface-container-low border border-outline-variant/10 rounded">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">{entry.reason}</div>
                        <div className="text-xs text-on-surface/40 font-mono mt-0.5">{new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <span className="font-mono text-tertiary font-bold text-sm flex-shrink-0">{'+' + entry.amount + ' XP'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </PageLayout>
  );
}
