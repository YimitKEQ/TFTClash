import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ACHIEVEMENTS, MILESTONES } from '../lib/stats.js'
import { Icon } from '../components/ui'
import PageLayout from '../components/layout/PageLayout'

var TIER_ORDER = ['bronze', 'silver', 'gold', 'legendary'];

var TIER_COLORS = {
  bronze:    { text: 'text-[#CD7F32]',  bg: 'bg-[#CD7F32]/10', border: 'border-[#CD7F32]/30', bar: 'bg-[#CD7F32]',  hex: '#CD7F32'  },
  silver:    { text: 'text-[#C0C0C0]',  bg: 'bg-[#C0C0C0]/10', border: 'border-[#C0C0C0]/30', bar: 'bg-[#C0C0C0]',  hex: '#C0C0C0'  },
  gold:      { text: 'text-primary',     bg: 'bg-primary/10',   border: 'border-primary/30',   bar: 'bg-primary',    hex: '#E8A838'  },
  legendary: { text: 'text-secondary',   bg: 'bg-secondary/10', border: 'border-secondary/30', bar: 'bg-secondary',  hex: '#D9B9FF'  },
};

var TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legendary: 'Legendary' };

var ICON_MAP = {
  'fire':                   'local_fire_department',
  'trophy-fill':            'emoji_events',
  'shield-fill':            'shield',
  'shield-check':           'verified_user',
  'award-fill':             'military_tech',
  'award':                  'military_tech',
  'bar-chart-line-fill':    'bar_chart',
  'lightning-charge-fill':  'bolt',
  'bullseye':               'my_location',
  'star-fill':              'star',
  'graph-up-arrow':         'trending_up',
  'rocket-takeoff-fill':    'rocket_launch',
  'moon-fill':              'nightlight_round',
  'coin':                   'paid',
  'gem':                    'diamond',
  'patch-check-fill':       'verified',
  'calendar-check-fill':    'event_available',
  'eye-fill':               'visibility',
  'sun-fill':               'wb_sunny',
  'diamond-half':           'diamond',
  'droplet-fill':           'water_drop',
  'droplet':                'water_drop',
  'mortarboard-fill':       'school',
  'gear-fill':              'settings',
};

function mapIcon(name) {
  return ICON_MAP[name] || name;
}

var RANK_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Challenger'];

function getRankTierIndex(pts) {
  if (pts >= 1000) return 5;
  if (pts >= 800)  return 4;
  if (pts >= 600)  return 3;
  if (pts >= 300)  return 2;
  if (pts >= 100)  return 1;
  return 0;
}

function getProgressPct(pts) {
  if (!pts) return 0;
  var maxPts = 1000;
  return Math.min(100, Math.round(pts / maxPts * 100));
}

function AchievementCard(props) {
  var a = props.a;
  var unlocked = props.unlocked;
  var earnedBy = props.earnedBy;

  var tier = a.tier;
  var colors = TIER_COLORS[tier] || TIER_COLORS.bronze;
  var iconName = mapIcon(a.icon);

  var statusLabel = unlocked ? (tier === 'legendary' ? 'Legendary' : 'Unlocked') : 'Locked';
  var statusTextClass = unlocked
    ? (tier === 'legendary' ? 'text-secondary' : tier === 'gold' ? 'text-primary' : colors.text)
    : 'text-on-surface-variant';
  var statusBgClass = unlocked
    ? (tier === 'legendary' ? 'bg-secondary-container/10' : tier === 'gold' ? 'bg-primary-container/10' : colors.bg)
    : 'bg-surface-container-highest';

  var progressPct = unlocked ? 100 : 0;
  var barColorClass = unlocked ? (tier === 'legendary' ? 'bg-secondary' : tier === 'gold' ? 'bg-primary' : tier === 'silver' ? 'bg-[#C0C0C0]' : 'bg-[#CD7F32]') : 'bg-primary';

  return (
    <div className={'bg-surface-container-low p-6 group relative overflow-hidden transition-all duration-300 ' + (unlocked ? 'cursor-pointer hover:bg-surface-container-high' : 'opacity-60 grayscale cursor-not-allowed')}>
      {unlocked && (
        <div className={'absolute inset-0 bg-gradient-to-br ' + (tier === 'legendary' ? 'from-secondary/5' : 'from-primary/5') + ' to-transparent opacity-0 group-hover:opacity-100 transition-opacity'}></div>
      )}
      {unlocked && <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-primary/10"></div>}
      <div className="flex justify-between items-start relative z-10">
        <div className={'w-12 h-12 ' + colors.bg + ' flex items-center justify-center ' + colors.text + ' mb-6'}>
          <Icon name={iconName} fill={unlocked} size={28} />
        </div>
        <span className={'px-2 py-0.5 text-[10px] font-sans-condensed font-bold uppercase tracking-widest rounded-sm ' + statusBgClass + ' ' + statusTextClass}>
          {statusLabel}
        </span>
      </div>
      <h4 className="font-serif text-xl text-on-surface mb-2">{a.name}</h4>
      <p className="text-on-surface-variant text-sm mb-6 leading-snug">{a.desc}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 bg-surface-container-highest">
          <div className={'h-full ' + barColorClass} style={{ width: progressPct + '%' }}></div>
        </div>
        <span className={'font-mono text-[10px] ' + (unlocked ? colors.text : 'text-on-surface-variant')}>
          {unlocked ? (earnedBy > 0 ? earnedBy : 1) : 0}/{earnedBy > 0 ? earnedBy : 1}
        </span>
      </div>
    </div>
  );
}

function MilestoneRow(props) {
  var m = props.m;
  var myUnlocked = props.myUnlocked;
  var earnedBy = props.earnedBy;
  var myPlayer = props.myPlayer;

  var pctProgress = m.pts && myPlayer
    ? Math.min(100, Math.round(myPlayer.pts / m.pts * 100))
    : myUnlocked ? 100 : 0;

  var iconName = mapIcon(m.icon);

  return (
    <div className={'bg-surface-container-low p-6 relative overflow-hidden transition-all duration-300 ' + (myUnlocked ? 'border-l-4 border-primary' : 'border-l-4 border-outline-variant/20')}>
      <div className="flex gap-4 items-start">
        <div className={'w-12 h-12 flex items-center justify-center flex-shrink-0 ' + (myUnlocked ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant')}>
          <Icon name={iconName} fill={myUnlocked} size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="font-serif text-lg text-on-surface">{m.name}</span>
            {myUnlocked && (
              <span className="bg-tertiary/10 text-tertiary px-2 py-0.5 text-[10px] font-sans-condensed font-bold uppercase tracking-widest rounded-sm">Unlocked</span>
            )}
          </div>
          {m.pts && (
            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-xs text-on-surface-variant">{myPlayer ? myPlayer.pts : 0} / {m.pts} pts</span>
                <span className="font-mono text-xs text-primary font-bold">{pctProgress}%</span>
              </div>
              <div className="h-1 bg-surface-container-highest">
                <div className="h-full bg-gradient-to-r from-primary-container via-primary to-secondary transition-all duration-300" style={{ width: pctProgress + '%' }}></div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/20 px-3 py-1 rounded-sm">
              <Icon name="redeem" size={12} className="text-primary" />
              <span className="text-xs text-on-surface-variant">{m.reward}</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant">{earnedBy} player{earnedBy !== 1 ? 's' : ''} unlocked this</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow(props) {
  var p = props.p;
  var i = props.i;
  var earned = props.earned;
  var handleClick = props.handleClick;

  var legendary = earned.filter(function(a) { return a.tier === 'legendary'; }).length;
  var gold = earned.filter(function(a) { return a.tier === 'gold'; }).length;
  var rankColor = i === 0 ? 'text-primary' : i === 1 ? 'text-[#C0C0C0]' : i === 2 ? 'text-[#CD7F32]' : 'text-on-surface-variant';

  return (
    <div
      className="flex items-center gap-4 px-6 py-4 border-b border-outline-variant/10 cursor-pointer hover:bg-surface-container-high transition-colors"
      onClick={function() { handleClick(p); }}
    >
      <span className={'font-mono text-sm font-black w-6 flex-shrink-0 ' + rankColor}>{i + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="font-sans-condensed font-bold text-sm text-on-surface uppercase tracking-wide mb-1">{p.name}</div>
        <div className="flex gap-2">
          {legendary > 0 && (
            <span className="text-[10px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-sm">{legendary} Legendary</span>
          )}
          {gold > 0 && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-sm">{gold} Gold</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-lg font-black text-secondary">{earned.length}</div>
        <div className="text-[10px] font-sans-condensed uppercase tracking-widest text-on-surface-variant">achievements</div>
      </div>
    </div>
  );
}

export default function MilestonesScreen() {
  var navigate = useNavigate();
  var ctx = useApp();
  var players = ctx.players || [];
  var currentUser = ctx.currentUser;
  var setProfilePlayer = ctx.setProfilePlayer;

  var myPlayer = currentUser ? players.find(function(p) { return p.name === currentUser.username; }) : null;
  var sorted = players.slice().sort(function(a, b) { return b.pts - a.pts; });

  var _filterState = useState('all');
  var filterTier = _filterState[0];
  var setFilterTier = _filterState[1];

  var _tabState = useState('achievements');
  var tab = _tabState[0];
  var setTab = _tabState[1];

  var filteredAch = ACHIEVEMENTS.filter(function(a) {
    return filterTier === 'all' || a.tier === filterTier;
  });

  function handlePlayerClick(p) {
    setProfilePlayer(p);
    navigate('/player/' + p.name);
  }

  var myPts = myPlayer ? (myPlayer.pts || 0) : 0;
  var progressPct = getProgressPct(myPts);
  var tierIndex = getRankTierIndex(myPts);
  var currentTierLabel = RANK_TIERS[tierIndex];
  var nextTierLabel = tierIndex < RANK_TIERS.length - 1 ? RANK_TIERS[tierIndex + 1] : 'Max';

  var totalUnlocked = myPlayer
    ? ACHIEVEMENTS.filter(function(a) { try { return a.check(myPlayer); } catch(e) { return false; } }).length
    : 0;

  // Build activity feed from real data - most recent milestones unlocked
  var recentFeedItems = myPlayer
    ? ACHIEVEMENTS.filter(function(a) { try { return a.check(myPlayer); } catch(e) { return false; } }).slice(0, 3)
    : [];

  var feedBorderColors = ['border-primary', 'border-tertiary', 'border-secondary'];
  var feedTextColors = ['text-primary', 'text-tertiary', 'text-secondary'];
  var feedTimeLabels = ['Recent', 'Recent', 'Recent'];

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="mb-10">
          <h1 className="font-serif text-5xl md:text-7xl font-black text-on-surface mb-4 tracking-tight">Milestones</h1>
          <p className="text-on-surface-variant max-w-2xl text-lg leading-relaxed">
            Forge your legacy in the Obsidian Arena. Every match brings you closer to legendary status and exclusive season rewards.
          </p>
        </header>

        {/* Season Progression Bar */}
        <section className="mb-14">
          <div className="flex justify-between items-end mb-4 flex-wrap gap-4">
            <div>
              <span className="font-sans-condensed uppercase tracking-widest text-xs text-primary font-bold">Current Standing</span>
              <h2 className="font-serif text-3xl text-on-surface">
                {currentTierLabel}
                <span className="text-on-surface-variant font-mono text-xl ml-3 tracking-tighter">{myPts.toLocaleString()} pts</span>
              </h2>
            </div>
            <div className="text-right">
              <span className="font-sans-condensed uppercase tracking-widest text-xs text-on-surface-variant">Next Milestone</span>
              <div className="font-mono text-sm text-secondary">{nextTierLabel} Tier ({progressPct}% complete)</div>
            </div>
          </div>

          <div className="h-8 bg-surface-container-lowest relative rounded-full overflow-hidden flex items-center p-1">
            <div className="absolute inset-0 flex">
              {RANK_TIERS.map(function(_, idx) {
                return (
                  <div key={idx} className={'h-full ' + (idx < RANK_TIERS.length - 1 ? 'border-r border-outline-variant/10' : '') + ' flex-1'}></div>
                );
              })}
            </div>
            <div
              className="h-full bg-gradient-to-r from-primary-container via-primary to-secondary rounded-full relative z-10 transition-all duration-500"
              style={{ width: progressPct + '%' }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 blur-sm"></div>
            </div>
          </div>

          <div className="flex justify-between mt-4 px-2">
            {RANK_TIERS.map(function(tier, idx) {
              var isActive = idx === tierIndex;
              return (
                <span key={tier} className={'font-sans-condensed uppercase tracking-tighter text-[10px] ' + (isActive ? 'text-primary font-bold' : 'text-on-surface-variant')}>
                  {tier}
                </span>
              );
            })}
          </div>
        </section>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-8 bg-surface-container-lowest rounded-full p-1 w-fit">
          {[['achievements', 'Achievement Vault'], ['milestones', 'Season Milestones'], ['leaderboard', 'Leaders']].map(function(item) {
            var v = item[0];
            var l = item[1];
            var active = tab === v;
            return (
              <button
                key={v}
                onClick={function() { setTab(v); }}
                className={'px-5 py-2 rounded-full text-xs font-sans-condensed uppercase tracking-widest transition-all ' + (active ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface')}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* Achievements Tab */}
        {tab === 'achievements' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Achievement Grid - 8 cols */}
            <div className="lg:col-span-8 space-y-6">

              {/* My Progress Summary */}
              {myPlayer && (
                <div className="bg-surface-container-low p-6 border border-secondary/20">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="font-sans-condensed uppercase tracking-widest text-xs text-on-surface-variant mb-3">Your Progress</div>
                      <div className="flex gap-3 flex-wrap">
                        {TIER_ORDER.map(function(tier) {
                          var earned = ACHIEVEMENTS.filter(function(a) {
                            return a.tier === tier && (function() { try { return a.check(myPlayer); } catch(e) { return false; } })();
                          }).length;
                          var total = ACHIEVEMENTS.filter(function(a) { return a.tier === tier; }).length;
                          var colors = TIER_COLORS[tier];
                          return (
                            <div key={tier} className="bg-surface-container-highest px-4 py-2 text-center">
                              <div className={'font-sans-condensed uppercase text-[10px] font-bold tracking-widest ' + colors.text}>{TIER_LABELS[tier]}</div>
                              <div className={'font-mono text-lg font-black ' + colors.text}>
                                {earned}<span className="text-xs text-on-surface-variant font-normal">/{total}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-4xl font-black text-secondary">{totalUnlocked}</div>
                      <div className="font-sans-condensed uppercase text-[10px] tracking-widest text-on-surface-variant">of {ACHIEVEMENTS.length} unlocked</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tier filter + label row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-sans-condensed uppercase tracking-widest text-lg font-bold">Achievement Vault</h3>
                <div className="flex gap-2 flex-wrap">
                  {[['all', 'All'], ['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['legendary', 'Legendary']].map(function(item) {
                    var v = item[0];
                    var l = item[1];
                    var active = filterTier === v;
                    var colors = v !== 'all' ? TIER_COLORS[v] : null;
                    return (
                      <button
                        key={v}
                        onClick={function() { setFilterTier(v); }}
                        className={'px-4 py-1.5 rounded-full text-xs font-sans-condensed uppercase tracking-widest transition-colors border ' + (active
                          ? (v === 'all' ? 'bg-surface-container-highest text-on-surface border-outline-variant/40' : colors.bg + ' ' + colors.text + ' ' + colors.border)
                          : 'text-on-surface-variant border-outline-variant/10 hover:bg-surface-container-high'
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Achievement Cards Grid */}
              {filteredAch.length === 0 && (
                <div className="text-center py-16">
                  <Icon name="military_tech" size={40} className="text-on-surface-variant mb-4 mx-auto block" />
                  <div className="font-sans-condensed uppercase tracking-widest text-sm text-on-surface mb-2">No achievements match this filter</div>
                  <div className="text-on-surface-variant text-xs">Try selecting a different tier.</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAch.map(function(a) {
                  var unlocked = myPlayer ? (function() { try { return a.check(myPlayer); } catch(e) { return false; } })() : false;
                  var earnedBy = players.filter(function(p) { try { return a.check(p); } catch(e) { return false; } }).length;
                  return (
                    <AchievementCard key={a.id} a={a} unlocked={unlocked} earnedBy={earnedBy} />
                  );
                })}
              </div>
            </div>

            {/* Activity Feed - 4 cols */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-sans-condensed uppercase tracking-widest text-lg font-bold">Activity Feed</h3>
                <Icon name="history" size={20} className="text-on-surface-variant" />
              </div>

              <div className="space-y-4">
                {recentFeedItems.length === 0 && (
                  <div className="bg-surface-container-low p-6 text-center">
                    <div className="text-on-surface-variant text-sm">No recent activity yet. Keep playing to earn achievements!</div>
                  </div>
                )}
                {recentFeedItems.map(function(a, idx) {
                  var borderCol = feedBorderColors[idx] || 'border-outline-variant/30';
                  var textCol = feedTextColors[idx] || 'text-on-surface-variant';
                  var timeLabel = feedTimeLabels[idx] || 'Recently';
                  return (
                    <div key={a.id} className={'bg-surface-container p-4 flex gap-4 border-l-2 backdrop-blur-2xl ' + borderCol}>
                      <div className={'flex-shrink-0 w-10 h-10 flex items-center justify-center ' + TIER_COLORS[a.tier].bg + ' ' + TIER_COLORS[a.tier].text}>
                        <Icon name={mapIcon(a.icon)} fill={true} size={20} />
                      </div>
                      <div>
                        <div className={'text-[10px] font-mono mb-1 uppercase tracking-tighter ' + textCol}>{timeLabel}</div>
                        <p className="text-sm text-on-surface leading-tight">
                          Achievement Completed: <span className={'font-bold ' + textCol}>{a.name}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Fallback feed items if no real data */}
                {recentFeedItems.length < 3 && (
                  <div className="bg-surface-container p-4 flex gap-4 border-l-2 border-outline-variant/30 backdrop-blur-2xl">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-surface-container-highest text-on-surface-variant">
                      <Icon name="emoji_events" size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-on-surface-variant mb-1 uppercase tracking-tighter">This season</div>
                      <p className="text-sm text-on-surface leading-tight">
                        Season Points: <span className="font-bold text-primary">{myPts} pts accumulated</span>
                      </p>
                    </div>
                  </div>
                )}

                <button
                  className="w-full py-4 text-center font-sans-condensed uppercase tracking-widest text-xs text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/10 rounded-sm hover:bg-surface-container-high"
                  onClick={function() { navigate('/leaderboard'); }}
                >
                  View Leaderboard
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Milestones Tab */}
        {tab === 'milestones' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-3">
              <h3 className="font-sans-condensed uppercase tracking-widest text-lg font-bold mb-2">Season Milestones</h3>
              {MILESTONES.map(function(m) {
                var myUnlocked = myPlayer ? (function() { try { return m.check(myPlayer); } catch(e) { return false; } })() : false;
                var earnedBy = players.filter(function(p) { try { return m.check(p); } catch(e) { return false; } }).length;
                return (
                  <MilestoneRow key={m.id} m={m} myUnlocked={myUnlocked} earnedBy={earnedBy} myPlayer={myPlayer} />
                );
              })}
            </div>

            {/* Sidebar context */}
            <aside className="lg:col-span-4 space-y-4">
              <h3 className="font-sans-condensed uppercase tracking-widest text-lg font-bold">Your Progress</h3>
              <div className="bg-surface-container-low p-6">
                <div className="font-sans-condensed uppercase tracking-widest text-xs text-on-surface-variant mb-4">Season Points</div>
                <div className="font-mono text-4xl font-black text-primary mb-1">{myPts}</div>
                <div className="font-sans-condensed uppercase tracking-widest text-[10px] text-on-surface-variant mb-4">points this season</div>
                <div className="h-1 bg-surface-container-highest mb-4">
                  <div className="h-full bg-gradient-to-r from-primary-container to-primary transition-all duration-500" style={{ width: progressPct + '%' }}></div>
                </div>
                <div className="font-sans-condensed text-xs text-on-surface-variant">{currentTierLabel} tier - {100 - progressPct}% to {nextTierLabel}</div>
              </div>
              <div className="bg-surface-container-low p-6">
                <div className="font-sans-condensed uppercase tracking-widest text-xs text-on-surface-variant mb-4">Milestones Unlocked</div>
                <div className="font-mono text-4xl font-black text-secondary mb-1">
                  {myPlayer ? MILESTONES.filter(function(m) { try { return m.check(myPlayer); } catch(e) { return false; } }).length : 0}
                </div>
                <div className="font-sans-condensed uppercase tracking-widest text-[10px] text-on-surface-variant">of {MILESTONES.length} total</div>
              </div>
            </aside>
          </div>
        )}

        {/* Leaderboard Tab */}
        {tab === 'leaderboard' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-sans-condensed uppercase tracking-widest text-lg font-bold">Achievement Leaders</h3>
                <p className="text-on-surface-variant text-sm mt-1">Most achievements earned this season</p>
              </div>
              <Icon name="leaderboard" size={22} className="text-on-surface-variant" />
            </div>
            <div className="bg-surface-container-low overflow-hidden">
              {sorted.map(function(p, i) {
                var earned = ACHIEVEMENTS.filter(function(a) { try { return a.check(p); } catch(e) { return false; } });
                return (
                  <LeaderboardRow key={p.id} p={p} i={i} earned={earned} handleClick={handlePlayerClick} />
                );
              })}
              {sorted.length === 0 && (
                <div className="text-center py-16 text-on-surface-variant">
                  <Icon name="group" size={40} className="mx-auto block mb-4" />
                  <div className="font-sans-condensed uppercase tracking-widest text-sm">No players yet</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Featured Reward - Bottom Banner */}
        <section className="mt-14 bg-surface-container-low relative overflow-hidden p-8 flex flex-col md:flex-row items-center gap-12 border border-primary/5">
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px]"></div>

          <div className="relative z-10 w-full md:w-48 flex-shrink-0 aspect-square flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-secondary opacity-20 rounded-full animate-pulse"></div>
            <div className="w-4/5 h-4/5 flex items-center justify-center border-4 border-primary shadow-[0_0_50px_rgba(253,186,73,0.2)] bg-surface-container-high">
              <Icon name="emoji_events" fill={true} size={72} className="text-primary" />
            </div>
          </div>

          <div className="relative z-10 flex-1 text-center md:text-left">
            <span className="bg-primary text-on-primary px-3 py-1 text-xs font-sans-condensed font-bold uppercase tracking-widest mb-4 inline-block">
              Challenger Tier Exclusive
            </span>
            <h3 className="font-serif text-4xl lg:text-5xl text-on-surface mb-4">Season Champion Rewards</h3>
            <p className="text-on-surface-variant text-lg mb-8 max-w-xl">
              Command the arena with the season's ultimate prestige cosmetics. Only available to those who reach Challenger status before the season finale.
            </p>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <div className="px-6 py-3 bg-surface-container-high border border-outline-variant/20">
                <span className="font-sans-condensed uppercase tracking-widest text-xs block text-on-surface-variant mb-1">Season Progress</span>
                <span className="font-mono text-primary font-bold">{progressPct}% to Challenger</span>
              </div>
              <button
                className="px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-sans-condensed font-bold uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
                onClick={function() { navigate('/pricing'); }}
              >
                View Rewards
              </button>
            </div>
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
