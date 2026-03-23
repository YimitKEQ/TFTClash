import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Panel, Btn } from '../components/ui'
import { supabase } from '../lib/supabase.js'

function Bar(props) {
  var val = props.val || 0;
  var max = props.max || 1;
  var color = props.color || '#9B72CF';
  var h = props.h || 6;
  var pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  return (
    <div style={{height: h, borderRadius: h, background: 'rgba(255,255,255,.06)'}}>
      <div style={{height: h, borderRadius: h, background: color, width: pct + '%', transition: 'width .3s'}}/>
    </div>
  );
}

export default function TournamentDetailScreen() {
  var ctx = useApp();
  var featuredEvents = ctx.featuredEvents;
  var setFeaturedEvents = ctx.setFeaturedEvents;
  var currentUser = ctx.currentUser;
  var setAuthScreen = ctx.setAuthScreen;
  var toast = ctx.toast;
  var players = ctx.players;
  var screen = ctx.screen;
  var setScreen = ctx.setScreen;

  var eventId = screen && screen.indexOf('tournament-') === 0 ? screen.replace('tournament-', '') : null;
  var event = (featuredEvents || []).find(function(e) { return String(e.id) === eventId || e.screen === screen; });

  var [detailTab, setDetailTab] = useState('overview');
  var [tournamentResults, setTournamentResults] = useState([]);
  var [loadingResults, setLoadingResults] = useState(false);

  useEffect(function() {
    if (!event || !event.dbTournamentId || !supabase.from) return;
    setLoadingResults(true);
    supabase.from('game_results').select('*').eq('tournament_id', event.dbTournamentId).order('round_number', {ascending: true}).order('placement', {ascending: true})
      .then(function(res) {
        setLoadingResults(false);
        if (res.error) { console.error('[TFT] Failed to load game results:', res.error); toast('Failed to load results', 'error'); return; }
        if (res.data) setTournamentResults(res.data);
      });
  }, [event && event.dbTournamentId]);

  if (!event) return null;

  var isRegistered = currentUser && event.registeredIds && event.registeredIds.indexOf(currentUser.username) !== -1;
  var isFull = event.registered >= event.size;
  var isUpcoming = event.status === 'upcoming';
  var isLive = event.status === 'live';
  var isCompleted = event.status === 'complete';
  var canRegister = !isCompleted && !isFull && !isRegistered;

  function handleRegister() {
    if (!currentUser) { setAuthScreen('login'); return; }
    if (isRegistered) {
      setFeaturedEvents(function(evts) { return evts.map(function(ev) {
        if (ev.id !== event.id) return ev;
        var newIds = (ev.registeredIds || []).filter(function(u) { return u !== currentUser.username; });
        return Object.assign({}, ev, {registeredIds: newIds, registered: Math.max(0, (ev.registered || 0) - 1)});
      }); });
      if (supabase.from && currentUser && event.dbTournamentId) {
        supabase.from('players').select('id').eq('auth_user_id', currentUser.id).single().then(function(pRes) {
          if (pRes.data) supabase.from('registrations').delete().eq('tournament_id', event.dbTournamentId).eq('player_id', pRes.data.id).then(function(r) { if (r.error) { console.error('[TFT] unregister failed:', r.error); toast('Unregister failed', 'error'); } });
        });
      }
      toast('Unregistered from ' + event.name, 'info');
    } else {
      if (isFull) { toast('Tournament is full', 'error'); return; }
      setFeaturedEvents(function(evts) { return evts.map(function(ev) {
        if (ev.id !== event.id) return ev;
        var newIds = (ev.registeredIds || []).concat([currentUser.username]);
        return Object.assign({}, ev, {registeredIds: newIds, registered: (ev.registered || 0) + 1});
      }); });
      if (supabase.from && currentUser && event.dbTournamentId) {
        supabase.from('players').select('id').eq('auth_user_id', currentUser.id).single().then(function(pRes) {
          if (pRes.data) supabase.from('registrations').upsert({tournament_id: event.dbTournamentId, player_id: pRes.data.id, status: 'registered'}, {onConflict: 'tournament_id,player_id'})
            .then(function(r) { if (r.error) console.error('[TFT] registration insert failed:', r.error); });
        });
      }
      toast('Registered for ' + event.name + '!', 'success');
    }
  }

  var regPercent = event.size > 0 ? Math.round((event.registered / event.size) * 100) : 0;

  // Derive standings from game_results
  var standings = [];
  if (tournamentResults.length > 0) {
    var playerMap = {};
    tournamentResults.forEach(function(r) {
      if (!playerMap[r.player_id]) playerMap[r.player_id] = {player_id: r.player_id, total: 0, games: []};
      playerMap[r.player_id].total += r.points || 0;
      playerMap[r.player_id].games.push({round: r.round_number, placement: r.placement, points: r.points});
    });
    standings = Object.values(playerMap).sort(function(a, b) { return b.total - a.total; });
  }

  var DETAIL_TABS = [['overview', 'Overview'], ['bracket', 'Bracket'], ['standings', 'Standings'], ['rules', 'Rules']];

  return (
    <div className="page wrap">
      <div style={{marginBottom: 20}}>
        <button onClick={function() { setScreen('featured'); }} style={{background: 'none', border: 'none', color: '#9B72CF', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit'}}>{'\u2190 Back to Featured Events'}</button>
      </div>

      <Panel glow style={{padding: '28px 24px', marginBottom: 20}}>
        <div style={{display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20}}>
          <div style={{width: 56, height: 56, borderRadius: 14, background: 'rgba(155,114,207,.12)', border: '1px solid rgba(155,114,207,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0}}>{event.logo}</div>
          <div style={{flex: 1, minWidth: 200}}>
            <h1 style={{fontSize: 22, fontWeight: 700, color: '#F2EDE4', margin: '0 0 6px 0'}}>{event.name}</h1>
            <div style={{fontSize: 13, color: '#9B72CF', fontWeight: 600, marginBottom: 4}}>{'Hosted by ' + event.host + (event.sponsor ? ' \u00b7 Presented by ' + event.sponsor : '')}</div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8}}>
              {event.date && <span style={{background: 'rgba(255,255,255,.04)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#BECBD9'}}>{event.date}</span>}
              {event.time && <span style={{background: 'rgba(255,255,255,.04)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#BECBD9'}}>{event.time}</span>}
              {event.format && <span style={{background: 'rgba(255,255,255,.04)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#BECBD9'}}>{event.format}</span>}
              {event.region && <span style={{background: 'rgba(255,255,255,.04)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#BECBD9'}}>{event.region}</span>}
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0}}>
            {isLive && <span style={{display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(82,196,124,.12)', border: '1px solid rgba(82,196,124,.3)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#6EE7B7'}}><span style={{width: 5, height: 5, borderRadius: '50%', background: '#52C47C', animation: 'pulse 2s infinite', display: 'inline-block'}}/>{'LIVE'}</span>}
            {isUpcoming && <span style={{background: 'rgba(78,205,196,.08)', border: '1px solid rgba(78,205,196,.2)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#4ECDC4'}}>{'UPCOMING'}</span>}
            {isCompleted && <span style={{background: 'rgba(232,168,56,.08)', border: '1px solid rgba(232,168,56,.2)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#E8A838'}}>{'COMPLETED'}</span>}
          </div>
        </div>
        {event.description && <div style={{fontSize: 14, color: '#C8D4E0', lineHeight: 1.6, marginBottom: 20}}>{event.description}</div>}
        <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
          {(event.tags || []).map(function(t) { return <span key={t} style={{background: 'rgba(155,114,207,.1)', border: '1px solid rgba(155,114,207,.25)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#C4B5FD'}}>{t}</span>; })}
          {event.prizePool && <span style={{background: 'rgba(78,205,196,.08)', border: '1px solid rgba(78,205,196,.2)', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#4ECDC4'}}>{event.prizePool + ' Prize Pool'}</span>}
        </div>
      </Panel>

      <div style={{display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.025)', borderRadius: 10, padding: 4, border: '1px solid rgba(242,237,228,.06)'}}>
        {DETAIL_TABS.map(function(arr) { return (
          <button key={arr[0]} onClick={function() { setDetailTab(arr[0]); }} style={{flex: 1, padding: '10px 6px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.04em', transition: 'all .15s', background: detailTab === arr[0] ? 'rgba(155,114,207,.22)' : 'transparent', color: detailTab === arr[0] ? '#C4B5FD' : '#BECBD9', outline: 'none', textTransform: 'uppercase'}}>{arr[1]}</button>
        ); })}
      </div>

      {detailTab === 'overview' && (
        <div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20}}>
            <Panel style={{padding: '20px', textAlign: 'center'}}>
              <div style={{marginBottom: 10}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span style={{fontSize: 11, color: '#BECBD9'}}>{'Registration'}</span>
                  <span style={{fontSize: 11, fontWeight: 700, color: '#E8A838'}}>{event.registered + '/' + event.size + ' (' + regPercent + '%)'}</span>
                </div>
                <Bar val={event.registered} max={event.size} color="#E8A838" h={6}/>
              </div>
              {!isCompleted && (
                currentUser ? (
                  isRegistered ?
                    <button onClick={handleRegister} style={{width: '100%', padding: '10px 16px', background: 'rgba(82,196,124,.12)', border: '1px solid rgba(82,196,124,.3)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#6EE7B7', cursor: 'pointer', fontFamily: 'inherit'}}>{'Registered \u2713 (Click to Unregister)'}</button>
                  : canRegister ?
                    <button onClick={handleRegister} style={{width: '100%', padding: '10px 16px', background: 'linear-gradient(90deg,#9B72CF,#7C5BB0)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit'}}>{'Register Now'}</button>
                  :
                    <button disabled style={{width: '100%', padding: '10px 16px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(242,237,228,.1)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#9AAABF', cursor: 'not-allowed', fontFamily: 'inherit'}}>{'Full'}</button>
                ) : (
                  <button onClick={function() { setAuthScreen('login'); }} style={{width: '100%', padding: '10px 16px', background: 'rgba(232,168,56,.12)', border: '1px solid rgba(232,168,56,.3)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#E8A838', cursor: 'pointer', fontFamily: 'inherit'}}>{'Sign In to Register'}</button>
                )
              )}
            </Panel>
            <Panel style={{padding: '20px', textAlign: 'center'}}>
              <div className="mono" style={{fontSize: 28, fontWeight: 700, color: '#E8A838', lineHeight: 1}}>{event.size}</div>
              <div className="cond" style={{fontSize: 10, color: '#BECBD9', fontWeight: 700, textTransform: 'uppercase', marginTop: 6, letterSpacing: '.06em'}}>{'Max Players'}</div>
              {event.format && <div style={{fontSize: 12, color: '#C8D4E0', marginTop: 8}}>{event.format}</div>}
            </Panel>
          </div>

          {isCompleted && event.champion && (
            <Panel glow style={{padding: '24px', marginBottom: 20, border: '1px solid rgba(232,168,56,.3)'}}>
              <h3 style={{fontSize: 16, fontWeight: 700, color: '#E8A838', marginBottom: 14}}>{'\ud83c\udfc6 Champion'}</h3>
              <div style={{fontSize: 20, fontWeight: 700, color: '#F2EDE4', marginBottom: 12}}>{event.champion}</div>
              {event.top4 && event.top4.length > 0 && (
                <div>
                  <div style={{fontSize: 11, color: '#BECBD9', marginBottom: 8, fontWeight: 600}}>{'Top 4'}</div>
                  <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                    {event.top4.map(function(p, i) { return <span key={i} style={{background: 'rgba(232,168,56,.08)', border: '1px solid rgba(232,168,56,.15)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: i === 0 ? '#E8A838' : '#C8D4E0'}}>{(i + 1) + '. ' + p}</span>; })}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {(event.registeredIds || []).length > 0 && (
            <Panel style={{padding: '20px', marginBottom: 20}}>
              <h3 style={{fontSize: 14, fontWeight: 700, color: '#F2EDE4', marginBottom: 14}}>{'Registered Players (' + (event.registeredIds || []).length + ')'}</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                {(event.registeredIds || []).map(function(username, i) {
                  return (
                    <div key={username} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,.02)', borderRadius: 8}}>
                      <span style={{fontSize: 12, fontWeight: 700, color: '#E8A838', minWidth: 20}}>{i + 1}</span>
                      <span style={{fontSize: 13, fontWeight: 600, color: '#F2EDE4'}}>{username}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {detailTab === 'bracket' && (
        <div>
          {tournamentResults.length === 0 && !loadingResults && (
            <Panel style={{padding: '40px 24px', textAlign: 'center'}}>
              <div style={{fontSize: 36, marginBottom: 12}}>{'\u2694\ufe0f'}</div>
              <h3 style={{color: '#F2EDE4', marginBottom: 8}}>No Bracket Data Yet</h3>
              <p style={{color: '#BECBD9', fontSize: 13}}>Bracket and lobby assignments will appear here once the tournament begins and results are entered.</p>
            </Panel>
          )}
          {loadingResults && (
            <Panel style={{padding: '40px 24px', textAlign: 'center'}}>
              <div style={{fontSize: 14, color: '#BECBD9'}}>Loading bracket data...</div>
            </Panel>
          )}
          {tournamentResults.length > 0 && (function() {
            var rounds = {};
            tournamentResults.forEach(function(r) {
              var rk = 'Round ' + r.round_number;
              if (!rounds[rk]) rounds[rk] = [];
              rounds[rk].push(r);
            });
            var roundKeys = Object.keys(rounds).sort();
            return (
              <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
                {roundKeys.map(function(rk) {
                  var results = rounds[rk].sort(function(a, b) { return a.placement - b.placement; });
                  return (
                    <Panel key={rk} style={{padding: '18px'}}>
                      <h3 style={{fontSize: 15, fontWeight: 700, color: '#E8A838', marginBottom: 12}}>{rk}</h3>
                      <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                        {results.map(function(r, i) {
                          var placeColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#52C47C', '#9B72CF', '#4ECDC4', '#BECBD9', '#8896A8'];
                          var pc = placeColors[Math.min(r.placement - 1, 7)] || '#8896A8';
                          return (
                            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: r.placement <= 3 ? 'rgba(232,168,56,.05)' : 'rgba(255,255,255,.02)', borderRadius: 6, border: '1px solid ' + (r.placement <= 3 ? 'rgba(232,168,56,.12)' : 'rgba(242,237,228,.04)')}}>
                              <div style={{width: 24, fontWeight: 700, fontSize: 13, color: pc, textAlign: 'center', flexShrink: 0}}>{r.placement}</div>
                              <div style={{flex: 1, fontSize: 13, color: '#F2EDE4'}}>{((players || []).find(function(p) { return p.id === r.player_id || p.dbId === r.player_id; }) || {}).name || r.player_id}</div>
                              <div className="mono" style={{fontSize: 14, fontWeight: 700, color: '#E8A838'}}>{r.points}pts</div>
                            </div>
                          );
                        })}
                      </div>
                    </Panel>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {detailTab === 'standings' && (
        <div>
          {standings.length === 0 && !loadingResults && (
            <Panel style={{padding: '40px 24px', textAlign: 'center'}}>
              <div style={{fontSize: 36, marginBottom: 12}}>{'\ud83d\udcca'}</div>
              <h3 style={{color: '#F2EDE4', marginBottom: 8}}>No Standings Yet</h3>
              <p style={{color: '#BECBD9', fontSize: 13}}>Standings will update as games are played and results are entered.</p>
            </Panel>
          )}
          {standings.length > 0 && (
            <Panel style={{padding: '20px'}}>
              <h3 style={{fontSize: 16, fontWeight: 700, color: '#E8A838', marginBottom: 16}}>Tournament Standings</h3>
              <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                {standings.map(function(s, i) {
                  var placeColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#52C47C'];
                  var pc = placeColors[Math.min(i, 3)] || '#BECBD9';
                  return (
                    <div key={s.player_id} style={{display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: i < 3 ? 'rgba(232,168,56,.05)' : 'rgba(255,255,255,.02)', borderRadius: 8, border: '1px solid ' + (i < 3 ? 'rgba(232,168,56,.12)' : 'rgba(242,237,228,.04)')}}>
                      <div style={{width: 28, fontWeight: 700, fontSize: 15, color: pc, textAlign: 'center', flexShrink: 0}}>{i + 1}</div>
                      <div style={{flex: 1, fontSize: 14, fontWeight: 600, color: '#F2EDE4'}}>{s.player_id}</div>
                      <div style={{fontSize: 11, color: '#BECBD9'}}>{s.games.length} games</div>
                      <div className="mono" style={{fontSize: 16, fontWeight: 700, color: '#E8A838', minWidth: 40, textAlign: 'right'}}>{s.total}</div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {detailTab === 'rules' && (
        <div>
          <Panel style={{padding: '24px', marginBottom: 16}}>
            <h3 style={{fontSize: 16, fontWeight: 700, color: '#E8A838', marginBottom: 14}}>Points System</h3>
            <div style={{overflowX: 'auto'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
                <thead>
                  <tr>
                    {['Place', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(function(h) { return (
                      <th key={h} style={{padding: '8px 12px', borderBottom: '1px solid rgba(242,237,228,.12)', color: '#E8A838', fontWeight: 700, textAlign: 'center'}}>{h}</th>
                    ); })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{padding: '8px 12px', borderBottom: '1px solid rgba(242,237,228,.06)', color: '#BECBD9', fontWeight: 600, textAlign: 'center'}}>Points</td>
                    {[8, 7, 6, 5, 4, 3, 2, 1].map(function(p) { return (
                      <td key={p} style={{padding: '8px 12px', borderBottom: '1px solid rgba(242,237,228,.06)', color: '#F2EDE4', fontWeight: 700, textAlign: 'center', fontFamily: 'monospace'}}>{p}</td>
                    ); })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel style={{padding: '24px', marginBottom: 16}}>
            <h3 style={{fontSize: 16, fontWeight: 700, color: '#9B72CF', marginBottom: 14}}>Tiebreaker Rules</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
              {[
                {n: '1', t: 'Total Tournament Points', d: 'Sum of all placement points across games.'},
                {n: '2', t: 'Wins + Top 4s', d: 'Wins count twice.'},
                {n: '3', t: 'Most of Each Placement', d: 'Compare 1st counts, then 2nd, then 3rd...'},
                {n: '4', t: 'Most Recent Game Finish', d: 'Higher placement in the most recent game wins.'}
              ].map(function(tb) { return (
                <div key={tb.n} style={{display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(155,114,207,.05)', border: '1px solid rgba(155,114,207,.15)', borderRadius: 10, padding: '10px 12px'}}>
                  <div style={{width: 24, height: 24, borderRadius: '50%', background: 'rgba(155,114,207,.15)', border: '1px solid rgba(155,114,207,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#C4B5FD', flexShrink: 0}}>{tb.n}</div>
                  <div>
                    <div style={{fontWeight: 700, fontSize: 13, color: '#F2EDE4', marginBottom: 2}}>{tb.t}</div>
                    <div style={{fontSize: 12, color: '#BECBD9', lineHeight: 1.4}}>{tb.d}</div>
                  </div>
                </div>
              ); })}
            </div>
          </Panel>
          {event.rules && (
            <Panel style={{padding: '24px'}}>
              <h3 style={{fontSize: 16, fontWeight: 700, color: '#4ECDC4', marginBottom: 14}}>Tournament-Specific Rules</h3>
              <div style={{fontSize: 13, color: '#C8D4E0', lineHeight: 1.7, whiteSpace: 'pre-wrap'}}>{event.rules}</div>
            </Panel>
          )}
        </div>
      )}

      {currentUser && event.hostTournamentId && event.host === (currentUser.username) && (
        <div style={{textAlign: 'center', marginTop: 16}}>
          <button onClick={function() { setScreen('host-dashboard'); }} style={{background: 'rgba(155,114,207,.12)', border: '1px solid rgba(155,114,207,.3)', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#C4B5FD', cursor: 'pointer', fontFamily: 'inherit'}}>{'Manage Tournament \u2192'}</button>
        </div>
      )}
    </div>
  );
}
