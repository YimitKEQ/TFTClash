/**
 * TeamProfileScreen - public team profile.
 *
 * Routes: /team/:id
 *
 * Shows: team header (name, tag, region, bio, logo), captain badge,
 * roster (active members), tournament history (registrations + computed
 * team points per tournament). Anyone can view.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase.js';
import { getTeamWithRoster } from '../lib/teams.js';
import PageLayout from '../components/layout/PageLayout';
import { Panel, Btn, Icon, Tag } from '../components/ui';

function statusVariant(status) {
  if (status === 'checked_in') return 'success';
  if (status === 'registered') return 'secondary';
  if (status === 'waitlisted') return 'tertiary';
  if (status === 'dropped') return 'ghost';
  return 'ghost';
}

function phaseLabel(phase) {
  if (!phase) return 'Scheduled';
  var p = String(phase).toLowerCase();
  if (p === 'registration' || p === 'open') return 'Registration';
  if (p === 'check_in' || p === 'checkin' || p === 'check-in') return 'Check-in';
  if (p === 'in_progress' || p === 'inprogress' || p === 'between_rounds') return 'In Progress';
  if (p === 'complete' || p === 'completed') return 'Complete';
  return phase;
}

function fmtDate(s) {
  if (!s) return '';
  try {
    var d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) { return ''; }
}

function MemberRow(props) {
  var m = props.member;
  var isCaptain = props.isCaptain;
  var p = m.player || {};
  return (
    <div className="flex items-center gap-3 p-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg">
      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden flex-shrink-0">
        {p.profile_pic_url ? (
          <img src={p.profile_pic_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon name="person" className="text-on-surface/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-bold text-on-surface truncate">{p.username || 'Unknown'}</div>
          {isCaptain ? <Tag variant="gold">Captain</Tag> : null}
          {m.role === 'sub' ? <Tag variant="ghost">Sub</Tag> : null}
        </div>
        {p.riot_id ? <div className="text-xs font-mono text-on-surface/50 truncate">{p.riot_id}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {p.rank ? <Tag variant="secondary">{p.rank}</Tag> : null}
        {p.username ? (
          <Btn size="sm" v="ghost" icon="open_in_new" onClick={function(){ if (props.onOpen) props.onOpen(p.username); }}>Profile</Btn>
        ) : null}
      </div>
    </div>
  );
}

function HistoryRow(props) {
  var row = props.row;
  var t = row.tournament || {};
  return (
    <button
      type="button"
      onClick={function(){ if (props.onOpen && t.id) props.onOpen(t.id); }}
      className="w-full text-left flex items-center gap-3 p-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg hover:bg-surface-container-low/70 hover:border-primary/30 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-bold text-on-surface truncate">{t.name || 'Tournament'}</div>
          <Tag variant={statusVariant(row.status)}>{row.status || 'unknown'}</Tag>
          <Tag variant="ghost">{phaseLabel(t.phase)}</Tag>
        </div>
        <div className="text-xs text-on-surface/50 mt-1">
          {fmtDate(t.date)}
          {t.team_size > 1 ? ' · ' + t.team_size + 'v' + t.team_size : ''}
        </div>
      </div>
      {row.totalPts > 0 ? (
        <div className="text-right">
          <div className="font-mono text-lg text-primary">{row.totalPts}</div>
          <div className="text-[10px] uppercase tracking-wider text-on-surface/50">pts</div>
        </div>
      ) : null}
      <Icon name="chevron_right" className="text-on-surface/30" />
    </button>
  );
}

export default function TeamProfileScreen() {
  var ctx = useApp();
  var screen = ctx.screen;
  var toast = ctx.toast;
  var navigate = useNavigate();

  var teamId = screen && screen.indexOf('team-') === 0 ? screen.replace('team-', '') : null;

  var [loading, setLoading] = useState(true);
  var [err, setErr] = useState(null);
  var [team, setTeam] = useState(null);
  var [history, setHistory] = useState([]);

  useEffect(function() {
    if (!teamId) { setLoading(false); setErr('Invalid team link'); return; }
    var cancelled = false;
    setLoading(true);
    setErr(null);
    getTeamWithRoster(teamId)
      .then(function(t) {
        if (cancelled) return;
        if (!t) { setErr('Team not found'); setLoading(false); return; }
        setTeam(t);
        return supabase.from('registrations')
          .select('id, status, lineup_player_ids, tournament:tournaments!registrations_tournament_id_fkey(id, name, phase, team_size, date, status)')
          .eq('team_id', teamId)
          .order('id', { ascending: false });
      })
      .then(function(regsRes) {
        if (cancelled || !regsRes) return;
        if (regsRes.error) { setHistory([]); setLoading(false); return; }
        var regs = regsRes.data || [];
        if (regs.length === 0) { setHistory([]); setLoading(false); return; }
        var tIds = regs.map(function(r){ return r.tournament && r.tournament.id; }).filter(Boolean);
        if (tIds.length === 0) { setHistory(regs.map(function(r){ return Object.assign({}, r, { totalPts: 0 }); })); setLoading(false); return; }
        supabase.from('game_results')
          .select('tournament_id, points')
          .eq('team_id', teamId)
          .in('tournament_id', tIds)
          .then(function(gRes) {
            if (cancelled) return;
            var ptsByT = {};
            ((gRes && gRes.data) || []).forEach(function(g){
              if (!g.tournament_id) return;
              ptsByT[g.tournament_id] = (ptsByT[g.tournament_id] || 0) + (g.points || 0);
            });
            var rows = regs.map(function(r){
              var tid = r.tournament && r.tournament.id;
              return Object.assign({}, r, { totalPts: tid ? (ptsByT[tid] || 0) : 0 });
            });
            setHistory(rows);
            setLoading(false);
          })
          .catch(function() { setHistory(regs.map(function(r){ return Object.assign({}, r, { totalPts: 0 }); })); setLoading(false); });
      })
      .catch(function(e) {
        if (cancelled) return;
        setErr((e && e.message) || 'Failed to load team');
        setLoading(false);
      });
    return function() { cancelled = true; };
  }, [teamId]);

  if (loading) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-surface-container-high/40 rounded-2xl"></div>
            <div className="h-48 bg-surface-container-high/40 rounded-2xl"></div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (err || !team) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto py-20 text-center">
          <Icon name="error_outline" size={48} className="text-on-surface-variant/20 mx-auto mb-4" />
          <h2 className="text-on-surface text-xl font-bold mb-2">Team Unavailable</h2>
          <p className="text-on-surface-variant text-sm mb-6">{err || 'This team could not be found.'}</p>
          <Btn variant="primary" size="sm" onClick={function() { navigate('/teams'); }}>Back to Teams</Btn>
        </div>
      </PageLayout>
    );
  }

  var members = team.members || [];
  var captain = members.find(function(m){ return String(m.player_id) === String(team.captain_player_id); });
  var mains = members.filter(function(m){ return m.role !== 'sub'; });
  var subs = members.filter(function(m){ return m.role === 'sub'; });

  var totalPts = history.reduce(function(s, r){ return s + (r.totalPts || 0); }, 0);
  var completedCount = history.filter(function(r){ var p = (r.tournament && r.tournament.phase) || ''; return String(p).toLowerCase().indexOf('complete') !== -1; }).length;
  var registeredCount = history.filter(function(r){ return r.status === 'registered' || r.status === 'checked_in'; }).length;

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        <Btn size="sm" v="ghost" icon="arrow_back" onClick={function(){ navigate('/teams'); }}>Back to Teams</Btn>

        <Panel padding="default" className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-high flex items-center justify-center overflow-hidden flex-shrink-0 border border-outline-variant/20">
              {team.logo_url ? (
                <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon name="groups" size={32} className="text-on-surface/40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-3xl text-on-surface">{team.name}</h1>
                {team.tag ? <Tag variant="secondary">{team.tag}</Tag> : null}
                {team.region ? <Tag variant="ghost">{team.region}</Tag> : null}
                {team.archived_at ? <Tag variant="warning">Disbanded</Tag> : null}
              </div>
              {team.bio ? (
                <p className="text-sm text-on-surface/70 mt-2 whitespace-pre-line">{team.bio}</p>
              ) : null}
              <div className="text-xs text-on-surface/50 mt-2">
                Founded {fmtDate(team.created_at)}
                {captain && captain.player ? ' · Captain ' + (captain.player.username || '') : ''}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-3 gap-3">
          <Panel padding="tight" className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Members</div>
            <div className="font-display text-2xl text-on-surface">{members.length}</div>
          </Panel>
          <Panel padding="tight" className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Tournaments</div>
            <div className="font-display text-2xl text-on-surface">{registeredCount}</div>
            <div className="text-[10px] text-on-surface/50">{completedCount} completed</div>
          </Panel>
          <Panel padding="tight" className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Total Points</div>
            <div className="font-display text-2xl text-primary">{totalPts}</div>
          </Panel>
        </div>

        <Panel padding="default" className="space-y-3">
          <div>
            <h2 className="font-display text-xl text-on-surface">Roster</h2>
            <p className="text-sm text-on-surface/60 mt-1">{mains.length} main {mains.length === 1 ? 'player' : 'players'}{subs.length ? ' · ' + subs.length + ' sub' + (subs.length > 1 ? 's' : '') : ''}</p>
          </div>
          {members.length === 0 ? (
            <div className="text-sm text-on-surface/50 italic">No active members.</div>
          ) : (
            <div className="space-y-2">
              {mains.map(function(m){
                return (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isCaptain={String(m.player_id) === String(team.captain_player_id)}
                    onOpen={function(name){ navigate('/player/' + encodeURIComponent(name)); }}
                  />
                );
              })}
              {subs.length ? (
                <div className="pt-2">
                  <div className="text-[10px] uppercase tracking-wider text-on-surface/50 mb-2">Substitutes</div>
                  <div className="space-y-2">
                    {subs.map(function(m){
                      return (
                        <MemberRow
                          key={m.id}
                          member={m}
                          isCaptain={false}
                          onOpen={function(name){ navigate('/player/' + encodeURIComponent(name)); }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel padding="default" className="space-y-3">
          <div>
            <h2 className="font-display text-xl text-on-surface">Tournament History</h2>
            <p className="text-sm text-on-surface/60 mt-1">Registrations and finishes for {team.name}.</p>
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-on-surface/50 italic">No tournament history yet.</div>
          ) : (
            <div className="space-y-2">
              {history.map(function(row){
                return (
                  <HistoryRow
                    key={row.id}
                    row={row}
                    onOpen={function(tid){ navigate('/tournament/' + tid); }}
                  />
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </PageLayout>
  );
}
