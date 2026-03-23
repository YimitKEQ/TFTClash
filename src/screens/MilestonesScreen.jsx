import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ACHIEVEMENTS, MILESTONES } from '../lib/stats.js'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Icon } from '../components/ui'

var ICON_REMAP = {
  'fire':'flame','trophy-fill':'trophy','shield-fill':'shield-filled','award-fill':'award',
  'bar-chart-line-fill':'chart-bar','lightning-charge-fill':'bolt','bullseye':'target',
  'star-fill':'star-filled','graph-up-arrow':'trending-up','rocket-takeoff-fill':'rocket',
  'moon-fill':'moon','coin':'coin','gem':'diamond','patch-check-fill':'rosette',
  'calendar-check-fill':'calendar-check','shield-check':'shield-check','eye-fill':'eye',
  'sun-fill':'sun','diamond-half':'diamond','droplet-fill':'droplet','droplet':'droplet',
  'mortarboard-fill':'school','gear-fill':'settings','award':'award',
};

function mapIcon(name) {
  return ICON_REMAP[name] || name;
}

var TIER_ORDER = ['bronze', 'silver', 'gold', 'legendary'];
var TIER_COLS = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#E8A838', legendary: '#9B72CF' };
var TIER_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legendary: 'Legendary' };

function AchievementCard({ a, unlocked, earnedBy }) {
  var col = TIER_COLS[a.tier];
  var rgbBase = a.tier === 'legendary' ? '155,114,207' : a.tier === 'gold' ? '232,168,56' : a.tier === 'silver' ? '192,192,192' : '205,127,50';
  return (
    <div style={{
      background: unlocked ? 'rgba(' + rgbBase + ',.06)' : 'rgba(255,255,255,.02)',
      border: '1px solid ' + (unlocked ? col + '44' : 'rgba(242,237,228,.07)'),
      borderRadius: 12,
      padding: '16px',
      opacity: unlocked ? 1 : 0.55,
      transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: unlocked ? col + '22' : 'rgba(255,255,255,.04)',
          border: '1px solid ' + (unlocked ? col + '55' : 'rgba(242,237,228,.08)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
          boxShadow: unlocked ? '0 0 12px ' + col + '33' : 'none',
        }}>
          <i className={'ti ti-' + mapIcon(a.icon)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: unlocked ? col : '#C8D4E0' }}>{a.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: col + '22', color: col, border: '1px solid ' + col + '44' }}>
              {TIER_LABELS[a.tier]}
            </span>
            {unlocked && <span style={{ fontSize: 12, color: '#6EE7B7' }}>v</span>}
          </div>
          <div style={{ fontSize: 12, color: '#BECBD9', lineHeight: 1.5, marginBottom: 6 }}>{a.desc}</div>
          <div style={{ fontSize: 11, color: '#9AAABF' }}>{earnedBy} player{earnedBy !== 1 ? 's' : ''} earned this</div>
        </div>
      </div>
    </div>
  );
}

function MilestoneCard({ m, myUnlocked, earnedBy, myPlayer }) {
  var pctProgress = m.pts && myPlayer ? Math.min(100, Math.round(myPlayer.pts / m.pts * 100)) : myUnlocked ? 100 : 0;
  return (
    <Panel style={{ padding: '18px', border: '1px solid ' + (myUnlocked ? 'rgba(232,168,56,.3)' : 'rgba(242,237,228,.08)') }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: myUnlocked ? 'rgba(232,168,56,.12)' : 'rgba(255,255,255,.03)',
          border: '1px solid ' + (myUnlocked ? 'rgba(232,168,56,.4)' : 'rgba(242,237,228,.08)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
        }}>
          <i className={'ti ti-' + mapIcon(m.icon)} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#F2EDE4' }}>{m.name}</span>
            {myUnlocked && <span style={{ fontSize: 12, color: '#6EE7B7', fontWeight: 700 }}>Unlocked</span>}
          </div>
          {m.pts && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#BECBD9' }}>{myPlayer ? myPlayer.pts : 0} / {m.pts} pts</span>
                <span style={{ fontSize: 12, color: '#E8A838', fontWeight: 700 }}>{pctProgress}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(242,237,228,.08)', borderRadius: 4 }}>
                <div style={{ width: pctProgress + '%', height: '100%', background: 'linear-gradient(90deg,#E8A838,#C8882A)', borderRadius: 4, transition: 'width .3s' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,168,56,.06)', border: '1px solid rgba(232,168,56,.2)', borderRadius: 6, padding: '4px 10px' }}>
            <i className="ti ti-gift" style={{ fontSize: 11 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#E8A838' }}>{m.reward}</span>
          </div>
          <div style={{ fontSize: 11, color: '#9AAABF', marginTop: 6 }}>{earnedBy} player{earnedBy !== 1 ? 's' : ''} unlocked this</div>
        </div>
      </div>
    </Panel>
  );
}

export default function MilestonesScreen() {
  var navigate = useNavigate();
  var ctx = useApp();
  var players = ctx.players || [];
  var currentUser = ctx.currentUser;
  var setProfilePlayer = ctx.setProfilePlayer;
  var setScreen = ctx.setScreen;

  var myPlayer = currentUser ? players.find(function(p) { return p.name === currentUser.username; }) : null;

  var sorted = players.slice().sort(function(a, b) { return b.pts - a.pts; });

  var [filterTier, setFilterTier] = useState('all');
  var [tab, setTab] = useState('achievements');

  var filteredAch = ACHIEVEMENTS.filter(function(a) { return filterTier === 'all' || a.tier === filterTier; });

  function handlePlayerClick(p) {
    setProfilePlayer(p);
    setScreen('profile');
    navigate('/profile');
  }

  return (
    <div className="page wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={function() { navigate(-1); }}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(242,237,228,.12)', background: 'rgba(255,255,255,.04)', color: '#C8D4E0', fontSize: 13, cursor: 'pointer' }}
        >
          Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#F2EDE4', fontSize: 20, margin: 0 }}>Achievements and Milestones</h2>
          <p style={{ color: '#BECBD9', fontSize: 13, marginTop: 4 }}>Earn badges. Collect titles. Leave a mark.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#111827', borderRadius: 10, padding: 4 }}>
        {[['achievements', 'Achievements'], ['milestones', 'Season Milestones'], ['leaderboard', 'Achievement Leaders']].map(function(item) {
          var v = item[0];
          var l = item[1];
          return (
            <button key={v} onClick={function() { setTab(v); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: tab === v ? '#1E2A3A' : 'transparent',
                color: tab === v ? '#F2EDE4' : '#BECBD9',
                transition: 'all .15s',
              }}>
              {l}
            </button>
          );
        })}
      </div>

      {tab === 'achievements' && (
        <>
          {myPlayer && (
            <Panel style={{ padding: '16px', marginBottom: 20, background: 'rgba(155,114,207,.04)', border: '1px solid rgba(155,114,207,.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#F2EDE4', marginBottom: 4 }}>Your Progress</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TIER_ORDER.map(function(tier) {
                      var earned = ACHIEVEMENTS.filter(function(a) { return a.tier === tier && a.check(myPlayer); }).length;
                      var total = ACHIEVEMENTS.filter(function(a) { return a.tier === tier; }).length;
                      return (
                        <div key={tier} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: TIER_COLS[tier] }}>{TIER_LABELS[tier]}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#F2EDE4', marginTop: 2 }}>
                            {earned}<span style={{ fontSize: 12, color: '#BECBD9' }}>/{total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: '#9B72CF' }}>
                    {ACHIEVEMENTS.filter(function(a) { try { return a.check(myPlayer); } catch(e) { return false; } }).length}
                  </div>
                  <div style={{ fontSize: 11, color: '#BECBD9' }}>of {ACHIEVEMENTS.length} unlocked</div>
                </div>
              </div>
            </Panel>
          )}

          {/* Tier filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['legendary', 'Legendary']].map(function(item) {
              var v = item[0];
              var l = item[1];
              var active = filterTier === v;
              var col = v === 'all' ? null : TIER_COLS[v];
              return (
                <button key={v} onClick={function() { setFilterTier(v); }}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: '1px solid ' + (active ? (v === 'all' ? 'rgba(242,237,228,.4)' : col + '88') : 'rgba(242,237,228,.1)'),
                    background: active ? (v === 'all' ? 'rgba(242,237,228,.06)' : col + '22') : 'transparent',
                    color: active ? (v === 'all' ? '#F2EDE4' : col) : '#BECBD9',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                  }}>
                  {l}
                </button>
              );
            })}
          </div>

          {/* Achievement grid */}
          <div className="grid-2" style={{ gap: 10 }}>
            {filteredAch.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 20px' }}>
                <i className="ti ti-award" style={{ fontSize: 32, display: 'block', marginBottom: 12 }} />
                <div style={{ fontWeight: 700, fontSize: 14, color: '#F2EDE4', marginBottom: 4 }}>No achievements match this filter</div>
                <div style={{ fontSize: 12, color: '#9AAABF' }}>Try selecting a different tier or category.</div>
              </div>
            )}
            {filteredAch.map(function(a) {
              var unlocked = myPlayer ? (function() { try { return a.check(myPlayer); } catch(e) { return false; } })() : false;
              var earnedBy = players.filter(function(p) { try { return a.check(p); } catch(e) { return false; } }).length;
              return (
                <AchievementCard key={a.id} a={a} unlocked={unlocked} earnedBy={earnedBy} />
              );
            })}
          </div>
        </>
      )}

      {tab === 'milestones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MILESTONES.map(function(m) {
            var myUnlocked = myPlayer ? (function() { try { return m.check(myPlayer); } catch(e) { return false; } })() : false;
            var earnedBy = players.filter(function(p) { try { return m.check(p); } catch(e) { return false; } }).length;
            return (
              <MilestoneCard key={m.id} m={m} myUnlocked={myUnlocked} earnedBy={earnedBy} myPlayer={myPlayer} />
            );
          })}
        </div>
      )}

      {tab === 'leaderboard' && (
        <Panel style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', background: '#0A0F1A', borderBottom: '1px solid rgba(242,237,228,.07)' }}>
            <h3 style={{ fontSize: 15, color: '#F2EDE4', margin: 0 }}>Achievement Leaderboard</h3>
            <p style={{ fontSize: 12, color: '#BECBD9', margin: '4px 0 0' }}>Most achievements earned this season</p>
          </div>
          {sorted.map(function(p, i) {
            var earned = ACHIEVEMENTS.filter(function(a) { try { return a.check(p); } catch(e) { return false; } });
            var legendary = earned.filter(function(a) { return a.tier === 'legendary'; }).length;
            var gold = earned.filter(function(a) { return a.tier === 'gold'; }).length;
            var rankColor = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#9AAABF';
            return (
              <div key={p.id} onClick={function() { handlePlayerClick(p); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: '1px solid rgba(242,237,228,.05)', cursor: 'pointer',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)',
                  transition: 'background .15s',
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(232,168,56,.04)'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)'; }}
              >
                <div className="mono" style={{ minWidth: 24, fontSize: 13, fontWeight: 800, color: rankColor }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#F2EDE4', marginBottom: 2 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {legendary > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(155,114,207,.15)', color: '#9B72CF', padding: '2px 7px', borderRadius: 8 }}>{legendary}</span>
                    )}
                    {gold > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(232,168,56,.12)', color: '#E8A838', padding: '2px 7px', borderRadius: 8 }}>{gold}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: '#9B72CF' }}>{earned.length}</div>
                  <div style={{ fontSize: 10, color: '#BECBD9' }}>achievements</div>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
