/**
 * Admin TeamsTab - manage all 4v4 teams.
 *
 * Capabilities:
 *  - Browse all teams (active + archived).
 *  - View per-team roster with role badges.
 *  - Force-disband a team.
 *  - Kick a member (with admin cooldown bypass for re-add).
 *  - Clear a player's leave cooldown.
 *  - Cancel pending invites.
 *
 * Admin RLS overrides (migration 086) make this work from the regular client.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { Panel, Btn, Inp, Icon, Tag } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { disbandTeam, kickMember } from '../../lib/teams.js';
import { writeAuditLog, createNotification } from '../../lib/notifications.js';

function TeamRow(props) {
  var team = props.team;
  var members = props.members || [];
  var pendingInvites = props.pendingInvites || 0;
  var registrations = props.registrations || [];
  var onDisband = props.onDisband;
  var onKick = props.onKick;
  var onClearCooldown = props.onClearCooldown;
  var onAdminWithdraw = props.onAdminWithdraw;
  var onAdminCheckIn = props.onAdminCheckIn;
  var onAdminUnCheckIn = props.onAdminUnCheckIn;
  var onOpenTournament = props.onOpenTournament;

  var isArchived = !!team.archived_at;
  var captain = members.find(function(m){ return m.role === 'captain'; });
  var actives = members.filter(function(m){ return m.role !== 'sub'; });
  var subs = members.filter(function(m){ return m.role === 'sub'; });

  return (
    <Panel padding="default" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-on-surface text-base">{team.name}</div>
            {team.tag ? <Tag variant="secondary">{team.tag}</Tag> : null}
            <Tag variant="ghost">{team.region}</Tag>
            {isArchived
              ? <Tag variant="danger">Archived</Tag>
              : <Tag variant="success">Active</Tag>}
            {pendingInvites > 0 ? <Tag variant="warning">{pendingInvites} pending invites</Tag> : null}
          </div>
          <div className="text-xs text-on-surface/50 font-mono mt-1">{team.id}</div>
          {team.bio ? <div className="text-sm text-on-surface/60 mt-2">{team.bio}</div> : null}
        </div>
        {!isArchived ? (
          <Btn size="sm" v="destructive" icon="delete" onClick={function(){ onDisband(team); }}>Force disband</Btn>
        ) : null}
      </div>

      <div>
        <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-2">
          Roster ({actives.length} active · {subs.length} subs)
        </div>
        <div className="space-y-1.5">
          {members.map(function(m) {
            var p = m.player || {};
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 bg-surface-container-low/40 border border-outline-variant/10 rounded p-2.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-on-surface truncate">{p.username || 'Unknown'}</span>
                  {p.riot_id ? <span className="text-xs font-mono text-on-surface/50 truncate">{p.riot_id}</span> : null}
                  <Tag variant={m.role === 'captain' ? 'gold' : m.role === 'sub' ? 'tertiary' : 'secondary'}>
                    {m.role.toUpperCase()}
                  </Tag>
                  {p.last_left_team_at ? (
                    <Tag variant="warning">cooldown</Tag>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.last_left_team_at ? (
                    <Btn size="sm" v="ghost" onClick={function(){ onClearCooldown(p); }}>Clear cooldown</Btn>
                  ) : null}
                  {!isArchived ? (
                    <Btn size="sm" v="destructive" onClick={function(){ onKick(team, m); }}>Kick</Btn>
                  ) : null}
                </div>
              </div>
            );
          })}
          {members.length === 0 ? <div className="text-sm text-on-surface/40">No members.</div> : null}
        </div>
      </div>

      {captain ? null : (
        <div className="text-xs text-error">Warning: team has no captain. Reassign manually.</div>
      )}

      {registrations.length > 0 ? (
        <div>
          <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-2">
            Tournament Registrations ({registrations.length})
          </div>
          <div className="space-y-1.5">
            {registrations.map(function(r) {
              var t = r.tournament || {};
              var phase = t.phase || 'draft';
              var teamSize = t.team_size || 1;
              var lineupCount = Array.isArray(r.lineup_player_ids) ? r.lineup_player_ids.length : 0;
              var lineupOk = teamSize > 1 && lineupCount === teamSize;
              var phaseColor = phase === 'in_progress' ? 'success' : phase === 'check_in' ? 'warning' : phase === 'registration' ? 'secondary' : phase === 'complete' ? 'ghost' : 'tertiary';
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-surface-container-low/40 border border-outline-variant/10 rounded p-2.5 text-sm flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-bold text-on-surface truncate">{t.name || 'Tournament'}</span>
                    <Tag variant={phaseColor}>{phase.toUpperCase()}</Tag>
                    <Tag variant={r.status === 'checked_in' ? 'success' : r.status === 'dropped' ? 'danger' : 'secondary'}>
                      {(r.status || 'registered').toUpperCase()}
                    </Tag>
                    {teamSize > 1 ? (
                      <Tag variant={lineupOk ? 'success' : 'warning'}>{lineupCount + '/' + teamSize + ' lineup'}</Tag>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.status !== 'checked_in' && r.status !== 'dropped' && phase !== 'complete' ? (
                      <Btn size="sm" v="ghost" onClick={function(){ onAdminCheckIn(r); }}>Force check-in</Btn>
                    ) : null}
                    {r.status === 'checked_in' && phase !== 'complete' ? (
                      <Btn size="sm" v="ghost" onClick={function(){ onAdminUnCheckIn(r); }}>Un-check-in</Btn>
                    ) : null}
                    {phase !== 'complete' ? (
                      <Btn size="sm" v="destructive" onClick={function(){ onAdminWithdraw(r); }}>Withdraw</Btn>
                    ) : null}
                    <Btn size="sm" v="primary" icon="open_in_new" onClick={function(){ onOpenTournament(t.id); }}>Open</Btn>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-on-surface/40 mt-1.5">
            Use Open to jump to the tournament admin and edit the lineup or override placements.
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

export default function TeamsTab() {
  var ctx = useApp();
  var toast = ctx.toast;
  var currentUser = ctx.currentUser;
  var navigate = useNavigate();
  var [teams, setTeams] = useState([]);
  var [membersByTeam, setMembersByTeam] = useState({});
  var [invitesByTeam, setInvitesByTeam] = useState({});
  var [regsByTeam, setRegsByTeam] = useState({});
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [showArchived, setShowArchived] = useState(false);
  var [reload, setReload] = useState(0);

  function actorContext() {
    return {
      id: currentUser ? currentUser.auth_user_id : null,
      name: currentUser ? (currentUser.username || currentUser.email || '') : ''
    };
  }

  useEffect(function() {
    var cancelled = false;
    setLoading(true);

    var teamQ = supabase.from('teams')
      .select('id, name, tag, region, captain_player_id, logo_url, bio, created_at, archived_at')
      .order('created_at', { ascending: false });
    if (!showArchived) teamQ = teamQ.is('archived_at', null);

    teamQ.then(function(teamRes) {
      if (cancelled) return;
      if (teamRes.error) { setLoading(false); if (toast) toast('Load failed: ' + teamRes.error.message); return; }
      var allTeams = teamRes.data || [];
      setTeams(allTeams);
      if (allTeams.length === 0) {
        setMembersByTeam({}); setInvitesByTeam({}); setRegsByTeam({}); setLoading(false); return;
      }
      var teamIds = allTeams.map(function(t){ return t.id; });
      Promise.all([
        supabase.from('team_members')
          .select('id, team_id, player_id, role, joined_at, removed_at')
          .in('team_id', teamIds)
          .is('removed_at', null),
        supabase.from('team_invites')
          .select('id, team_id, status')
          .in('team_id', teamIds)
          .eq('status', 'pending'),
        supabase.from('registrations')
          .select('id, team_id, player_id, status, lineup_player_ids, tournament:tournaments!registrations_tournament_id_fkey(id, name, phase, team_size, date)')
          .in('team_id', teamIds)
          .neq('status', 'dropped'),
      ]).then(function(out) {
        if (cancelled) return;
        var memRes = out[0];
        var invRes = out[1];
        var regRes = out[2];
        if (memRes.error) { if (toast) toast('Members load failed: ' + memRes.error.message); }
        if (invRes.error) { if (toast) toast('Invites load failed: ' + invRes.error.message); }
        if (regRes && regRes.error) { if (toast) toast('Registrations load failed: ' + regRes.error.message); }
        var members = memRes.data || [];
        var invites = invRes.data || [];
        var regs = (regRes && regRes.data) || [];

        var regsByTeamMap = {};
        regs.forEach(function(r) {
          if (!r.team_id) return;
          if (!regsByTeamMap[r.team_id]) regsByTeamMap[r.team_id] = [];
          regsByTeamMap[r.team_id].push(r);
        });

        var playerIds = Array.from(new Set(members.map(function(m){ return m.player_id; })));
        if (playerIds.length === 0) {
          var byTeamEmpty = {};
          allTeams.forEach(function(t){ byTeamEmpty[t.id] = []; });
          var invByTeam = {};
          invites.forEach(function(i){ invByTeam[i.team_id] = (invByTeam[i.team_id] || 0) + 1; });
          setMembersByTeam(byTeamEmpty);
          setInvitesByTeam(invByTeam);
          setRegsByTeam(regsByTeamMap);
          setLoading(false);
          return;
        }
        supabase.from('players')
          .select('id, username, riot_id, profile_pic_url, last_left_team_at')
          .in('id', playerIds)
          .then(function(playersRes) {
            if (cancelled) return;
            if (playersRes.error) { if (toast) toast('Players load failed: ' + playersRes.error.message); }
            var byPid = {};
            (playersRes.data || []).forEach(function(p){ byPid[p.id] = p; });
            var byTeam = {};
            members.forEach(function(m) {
              if (!byTeam[m.team_id]) byTeam[m.team_id] = [];
              byTeam[m.team_id].push(Object.assign({}, m, { player: byPid[m.player_id] || null }));
            });
            var invByTeam = {};
            invites.forEach(function(i){ invByTeam[i.team_id] = (invByTeam[i.team_id] || 0) + 1; });
            setMembersByTeam(byTeam);
            setInvitesByTeam(invByTeam);
            setRegsByTeam(regsByTeamMap);
            setLoading(false);
          });
      });
    });

    return function() { cancelled = true; };
  }, [reload, showArchived]);

  function refresh() { setReload(function(n){ return n + 1; }); }

  function handleDisband(team) {
    if (!window.confirm('Force-disband ' + team.name + '? This archives the team and removes all members.')) return;
    disbandTeam(team.id, 'admin_disband')
      .then(function(){ if (toast) toast('Team disbanded.'); refresh(); })
      .catch(function(err){ if (toast) toast('Disband failed: ' + (err.message || 'unknown')); });
  }

  function handleKick(team, member) {
    if (!window.confirm('Kick ' + (member.player && member.player.username || 'player') + ' from ' + team.name + '?')) return;
    kickMember(member.id, 'admin_kick')
      .then(function(){ if (toast) toast('Player kicked.'); refresh(); })
      .catch(function(err){ if (toast) toast('Kick failed: ' + (err.message || 'unknown')); });
  }

  function handleClearCooldown(player) {
    if (!window.confirm('Clear leave cooldown for ' + (player.username || 'player') + '?')) return;
    supabase.from('players')
      .update({ last_left_team_at: null })
      .eq('id', player.id)
      .then(function(res){
        if (res.error) { if (toast) toast('Clear failed: ' + res.error.message); return; }
        if (toast) toast('Cooldown cleared.');
        refresh();
      });
  }

  function handleAdminWithdraw(reg) {
    var t = reg.tournament || {};
    if (!window.confirm('Force withdraw this team from "' + (t.name || 'tournament') + '"? This deletes the registration.')) return;
    supabase.from('registrations').delete().eq('id', reg.id).then(function(res) {
      if (res.error) { if (toast) toast('Withdraw failed: ' + res.error.message); return; }
      writeAuditLog('tournament.admin_force_withdraw', actorContext(), { type: 'registration', id: reg.id }, { tournament_id: t.id, team_id: reg.team_id });
      if (toast) toast('Team withdrawn from ' + (t.name || 'tournament') + '.');
      refresh();
    }).catch(function() { if (toast) toast('Network error'); });
  }

  function handleAdminCheckIn(reg) {
    var t = reg.tournament || {};
    var teamSize = t.team_size || 1;
    if (teamSize > 1) {
      var lineup = Array.isArray(reg.lineup_player_ids) ? reg.lineup_player_ids : [];
      if (lineup.length !== teamSize) {
        if (toast) toast('Team has no lineup yet. Open the tournament to set the lineup first.');
        return;
      }
    }
    if (!window.confirm('Force check-in this team for "' + (t.name || 'tournament') + '"?')) return;
    supabase.from('registrations').update({status: 'checked_in', checked_in_at: new Date().toISOString()}).eq('id', reg.id).then(function(res) {
      if (res.error) { if (toast) toast('Check-in failed: ' + res.error.message); return; }
      writeAuditLog('tournament.admin_force_checkin', actorContext(), { type: 'registration', id: reg.id }, { tournament_id: t.id, team_id: reg.team_id });
      if (reg.player_id) {
        createNotification(reg.player_id, 'Team Checked In by Admin', 'An admin has checked your team in to ' + (t.name || 'the tournament') + '.', 'checkmark');
      }
      if (toast) toast('Team checked in.');
      refresh();
    }).catch(function() { if (toast) toast('Network error'); });
  }

  function handleAdminUnCheckIn(reg) {
    var t = reg.tournament || {};
    if (!window.confirm('Revert check-in for this team in "' + (t.name || 'tournament') + '"?')) return;
    supabase.from('registrations').update({status: 'registered', checked_in_at: null}).eq('id', reg.id).then(function(res) {
      if (res.error) { if (toast) toast('Failed: ' + res.error.message); return; }
      writeAuditLog('tournament.admin_uncheckin', actorContext(), { type: 'registration', id: reg.id }, { tournament_id: t.id, team_id: reg.team_id });
      if (toast) toast('Reverted to registered.');
      refresh();
    }).catch(function() { if (toast) toast('Network error'); });
  }

  function handleOpenTournament(tournamentId) {
    if (!tournamentId) return;
    navigate('/flash/' + tournamentId);
  }

  var filtered = teams.filter(function(t) {
    if (!filter) return true;
    var q = filter.toLowerCase();
    return (t.name || '').toLowerCase().indexOf(q) !== -1
        || (t.tag || '').toLowerCase().indexOf(q) !== -1;
  });

  return (
    <div className="space-y-4">
      <Panel padding="tight" className="flex items-center gap-3 flex-wrap">
        <Icon name="groups" className="text-primary" />
        <div className="flex-1 min-w-[180px]">
          <Inp placeholder="Search by team name or tag" value={filter} onChange={function(e){ setFilter(e.target.value); }} />
        </div>
        <Btn
          size="sm"
          v={showArchived ? 'primary' : 'secondary'}
          onClick={function(){ setShowArchived(function(s){ return !s; }); }}
          icon={showArchived ? 'visibility' : 'visibility_off'}
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Btn>
        <Btn size="sm" v="ghost" icon="refresh" onClick={refresh}>Refresh</Btn>
      </Panel>

      {loading ? (
        <Panel padding="spacious" className="text-center text-on-surface/50">Loading teams...</Panel>
      ) : filtered.length === 0 ? (
        <Panel padding="spacious" className="text-center text-on-surface/50">
          {teams.length === 0 ? 'No teams yet.' : 'No teams match this filter.'}
        </Panel>
      ) : (
        <div className="space-y-3">
          {filtered.map(function(t) {
            return (
              <TeamRow
                key={t.id}
                team={t}
                members={membersByTeam[t.id] || []}
                pendingInvites={invitesByTeam[t.id] || 0}
                registrations={regsByTeam[t.id] || []}
                onDisband={handleDisband}
                onKick={handleKick}
                onClearCooldown={handleClearCooldown}
                onAdminWithdraw={handleAdminWithdraw}
                onAdminCheckIn={handleAdminCheckIn}
                onAdminUnCheckIn={handleAdminUnCheckIn}
                onOpenTournament={handleOpenTournament}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
