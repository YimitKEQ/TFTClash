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
import { supabase } from '../../lib/supabase.js';
import { Panel, Btn, Inp, Icon, Tag } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { disbandTeam, kickMember } from '../../lib/teams.js';

function TeamRow(props) {
  var team = props.team;
  var members = props.members || [];
  var pendingInvites = props.pendingInvites || 0;
  var onDisband = props.onDisband;
  var onKick = props.onKick;
  var onClearCooldown = props.onClearCooldown;

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
    </Panel>
  );
}

export default function TeamsTab() {
  var ctx = useApp();
  var toast = ctx.toast;
  var [teams, setTeams] = useState([]);
  var [membersByTeam, setMembersByTeam] = useState({});
  var [invitesByTeam, setInvitesByTeam] = useState({});
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [showArchived, setShowArchived] = useState(false);
  var [reload, setReload] = useState(0);

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
        setMembersByTeam({}); setInvitesByTeam({}); setLoading(false); return;
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
      ]).then(function(out) {
        if (cancelled) return;
        var memRes = out[0];
        var invRes = out[1];
        if (memRes.error) { if (toast) toast('Members load failed: ' + memRes.error.message); }
        if (invRes.error) { if (toast) toast('Invites load failed: ' + invRes.error.message); }
        var members = memRes.data || [];
        var invites = invRes.data || [];

        var playerIds = Array.from(new Set(members.map(function(m){ return m.player_id; })));
        if (playerIds.length === 0) {
          var byTeamEmpty = {};
          allTeams.forEach(function(t){ byTeamEmpty[t.id] = []; });
          var invByTeam = {};
          invites.forEach(function(i){ invByTeam[i.team_id] = (invByTeam[i.team_id] || 0) + 1; });
          setMembersByTeam(byTeamEmpty);
          setInvitesByTeam(invByTeam);
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
                onDisband={handleDisband}
                onKick={handleKick}
                onClearCooldown={handleClearCooldown}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
