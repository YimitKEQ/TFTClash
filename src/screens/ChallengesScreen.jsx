import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DAILY_CHALLENGES, WEEKLY_CHALLENGES, estimateXp, getXpProgress } from '../lib/stats.js'
import { Panel, Icon } from '../components/ui'

var ICON_REMAP = {
  'fire':'flame','trophy-fill':'trophy','shield-fill':'shield-filled','award-fill':'award',
  'bar-chart-line-fill':'chart-bar','lightning-charge-fill':'bolt','bullseye':'target',
  'star-fill':'star-filled','graph-up-arrow':'trending-up','rocket-takeoff-fill':'rocket',
  'moon-fill':'moon','coin':'coin','gem':'diamond','patch-check-fill':'rosette',
  'calendar-check-fill':'calendar-check','shield-check':'shield-check','eye-fill':'eye',
  'sun-fill':'sun','controller':'device-gamepad-2','rosette-discount-check':'rosette-discount-check',
  'check-circle-fill':'circle-check-filled','arrow-up-circle-fill':'circle-arrow-up-filled',
};

function mapIcon(name) {
  return ICON_REMAP[name] || name;
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

function ProgressBar({ val, max, color, h }) {
  var pct = Math.min(100, (val / Math.max(max || 1, 1)) * 100);
  return (
    <div style={{ height: h || 4, background: '#1C2030', borderRadius: 99, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: pct + '%', background: color || 'linear-gradient(90deg,#E8A838,#D4922A)', borderRadius: 99, transition: 'width .7s ease' }} />
    </div>
  );
}

var XP_LOG = [
  { icon: 'trophy-fill', action: 'Won Clash #13', xp: '+40 XP', time: 'Mar 1 2026', c: '#E8A838' },
  { icon: 'bullseye', action: 'Weekly challenge: On A Roll', xp: '+120 XP', time: 'Mar 1 2026', c: '#9B72CF' },
  { icon: 'award-fill', action: '1st place - Top 2 finish', xp: '+50 XP', time: 'Feb 28 2026', c: '#E8A838' },
  { icon: 'shield-fill', action: 'Survived top 4', xp: '+15 XP', time: 'Feb 28 2026', c: '#4ECDC4' },
  { icon: 'arrow-up-circle-fill', action: 'Ranked up: Silver to Gold', xp: 'RANK UP', time: 'Feb 22 2026', c: '#EAB308' },
  { icon: 'controller', action: 'Completed a game', xp: '+25 XP', time: 'Feb 22 2026', c: '#BECBD9' },
];

export default function ChallengesScreen() {
  var navigate = useNavigate();
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var players = ctx.players || [];
  var challengeCompletions = ctx.challengeCompletions || {};

  var [tab, setTab] = useState('active');

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

  var xp = linked ? estimateXp(linked) : 0;
  var rankInfo = getXpProgress(xp);

  var completedChallenges = dailyChallenges.concat(weeklyChallenges).filter(function(c) { return c.progress >= c.goal; });

  return (
    <div className="page wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={function() { navigate(-1); }}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(242,237,228,.12)', background: 'rgba(255,255,255,.04)', color: '#C8D4E0', fontSize: 13, cursor: 'pointer' }}
        >
          Back
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#F2EDE4', fontSize: 20, marginBottom: 4 }}>Challenges</h2>
        <p style={{ fontSize: 13, color: '#BECBD9' }}>Complete challenges to earn XP and climb the platform ranks.</p>
      </div>

      {/* XP / Rank overview */}
      <Panel style={{ padding: '20px', marginBottom: 20, background: 'linear-gradient(135deg,rgba(232,168,56,.06),rgba(8,8,15,.98))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 36 }}>
            <i className={'ti ti-' + mapIcon(rankInfo.rank.icon)} style={{ color: rankInfo.rank.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: rankInfo.rank.color }}>{rankInfo.rank.name}</span>
              {rankInfo.next && (
                <span style={{ fontSize: 12, color: '#BECBD9' }}>
                  to <i className={'ti ti-' + mapIcon(rankInfo.next.icon)} style={{ fontSize: 12, color: rankInfo.next.color }} /> {rankInfo.next.name}
                </span>
              )}
            </div>
            <ProgressBar val={rankInfo.current} max={rankInfo.needed || 1} color={rankInfo.rank.color} h={6} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span className="mono" style={{ fontSize: 11, color: '#BECBD9' }}>{xp} total XP</span>
              <span className="mono" style={{ fontSize: 11, color: rankInfo.rank.color }}>{rankInfo.pct}% to next rank</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {['active', 'completed', 'xp-log'].map(function(t) {
          var label = t === 'xp-log' ? 'XP Log' : t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <button key={t} onClick={function() { setTab(t); }}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid',
                borderColor: tab === t ? '#9B72CF' : 'rgba(242,237,228,.1)',
                background: tab === t ? 'rgba(155,114,207,.15)' : 'rgba(255,255,255,.04)',
                color: tab === t ? '#9B72CF' : '#C8D4E0',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'active' && (
        <div>
          {/* Daily challenges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="cond" style={{ fontSize: 11, fontWeight: 700, color: '#E8A838', letterSpacing: '.14em', textTransform: 'uppercase' }}>Daily Challenges</div>
            <div style={{ fontSize: 11, color: '#BECBD9' }}>Resets in <span style={{ color: '#F87171', fontWeight: 700 }}>{dailyReset}</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {dailyChallenges.map(function(c) {
              return (
                <div key={c.id} className="task-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, background: 'rgba(232,168,56,.08)', border: '1px solid rgba(232,168,56,.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      <i className={'ti ti-' + mapIcon(c.icon)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#F2EDE4', marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#C8D4E0' }}>{c.desc}</div>
                      <div style={{ marginTop: 8 }}>
                        <ProgressBar val={c.progress} max={c.goal} color="#E8A838" h={4} />
                        <div style={{ fontSize: 10, color: '#BECBD9', marginTop: 3 }}>{c.progress}/{c.goal} completed</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#E8A838' }}>+{c.xp}</div>
                      <div style={{ fontSize: 10, color: '#BECBD9', fontWeight: 700, textTransform: 'uppercase' }}>XP</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekly challenges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="cond" style={{ fontSize: 11, fontWeight: 700, color: '#9B72CF', letterSpacing: '.14em', textTransform: 'uppercase' }}>Weekly Challenges</div>
            <div style={{ fontSize: 11, color: '#BECBD9' }}>Resets in <span style={{ color: '#9B72CF', fontWeight: 700 }}>{weeklyReset}</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weeklyChallenges.map(function(c) {
              var done = c.progress >= c.goal;
              var iconName = done ? 'circle-check-filled' : mapIcon(c.icon);
              return (
                <div key={c.id} className="weekly-card"
                  style={{
                    background: done ? 'rgba(82,196,124,.05)' : undefined,
                    border: done ? '1px solid rgba(82,196,124,.3)' : undefined,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, background: 'rgba(155,114,207,.08)', border: '1px solid rgba(155,114,207,.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      <i className={'ti ti-' + iconName} style={{ color: done ? '#52C47C' : undefined }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: done ? '#6EE7B7' : '#F2EDE4', marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#C8D4E0' }}>{c.desc}</div>
                      <div style={{ marginTop: 8 }}>
                        <ProgressBar val={c.progress} max={c.goal} color={done ? '#6EE7B7' : '#9B72CF'} h={4} />
                        <div style={{ fontSize: 10, color: '#BECBD9', marginTop: 3 }}>{c.progress}/{c.goal} {done ? '- Completed!' : ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: done ? '#6EE7B7' : '#9B72CF' }}>+{c.xp}</div>
                      <div style={{ fontSize: 10, color: '#BECBD9', fontWeight: 700, textTransform: 'uppercase' }}>XP</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'completed' && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#BECBD9' }}>
          <i className="ti ti-rosette-discount-check" style={{ fontSize: 36, display: 'block', marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#F2EDE4', marginBottom: 6 }}>
            {completedChallenges.length} challenge{completedChallenges.length !== 1 ? 's' : ''} completed
          </div>
          {completedChallenges.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16, textAlign: 'left', maxWidth: 360, margin: '16px auto 0' }}>
              {completedChallenges.map(function(c) {
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(82,196,124,.06)', border: '1px solid rgba(82,196,124,.2)', borderRadius: 8 }}>
                    <i className={'ti ti-' + mapIcon(c.icon)} style={{ fontSize: 16 }} />
                    <span style={{ flex: 1, fontSize: 13, color: '#6EE7B7', fontWeight: 600 }}>{c.name}</span>
                    <span className="mono" style={{ fontSize: 12, color: '#52C47C' }}>+{c.xp} XP</span>
                  </div>
                );
              })}
            </div>
          )}
          {completedChallenges.length === 0 && (
            <div style={{ fontSize: 13 }}>Keep playing to unlock more</div>
          )}
        </div>
      )}

      {tab === 'xp-log' && (
        <Panel style={{ padding: '18px' }}>
          <h3 style={{ fontSize: 15, color: '#F2EDE4', marginBottom: 14 }}>XP History</h3>
          {XP_LOG.map(function(e, i) {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < XP_LOG.length - 1 ? '1px solid rgba(242,237,228,.05)' : 'none' }}>
                <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,.04)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={'ti ti-' + mapIcon(e.icon)} style={{ fontSize: 15, color: e.c }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#F2EDE4' }}>{e.action}</div>
                  <div style={{ fontSize: 11, color: '#BECBD9' }}>{e.time}</div>
                </div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: e.c, flexShrink: 0 }}>{e.xp}</div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
