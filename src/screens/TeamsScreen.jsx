/**
 * TeamsScreen - real DB-backed 4v4 team management.
 *
 * Routes: /teams
 *
 * States:
 *   1. Logged-out -> prompt sign-in.
 *   2. No team + no invites -> create team CTA + browse rosters.
 *   3. Has invites -> render invite cards with accept / decline.
 *   4. Has team (captain) -> roster + invite teammates + transfer / disband.
 *   5. Has team (member) -> roster + leave-team button.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import PageLayout from '../components/layout/PageLayout';
import { Panel, Btn, Inp, Icon, Tag } from '../components/ui';
import {
  listTeams, getMyTeam, listMyInvites, listTeamSentInvites, getTeamTournamentHistory,
  createTeam, disbandTeam, sendInvite, respondInvite,
  setMemberRole, transferCaptaincy, leaveTeam, kickMember
} from '../lib/teams.js';

var REGIONS = ['EUW', 'NA', 'KR', 'EUNE', 'OCE', 'BR', 'JP', 'LAN', 'LAS', 'TR', 'RU'];

function PlayerCell(props) {
  var p = props.player || {};
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden flex-shrink-0">
        {p.profile_pic_url ? (
          <img src={p.profile_pic_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Icon name="person" className="text-on-surface/40" />
        )}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-on-surface truncate">{p.username || 'Unknown'}</div>
        {p.riot_id ? <div className="text-xs font-mono text-on-surface/50 truncate">{p.riot_id}</div> : null}
      </div>
    </div>
  );
}

function RoleBadge(props) {
  var role = props.role;
  var label = role === 'captain' ? 'CAPTAIN' : role === 'sub' ? 'SUB' : 'MAIN';
  var variant = role === 'captain' ? 'gold' : role === 'sub' ? 'tertiary' : 'secondary';
  return <Tag variant={variant}>{label}</Tag>;
}

function CreateTeamForm(props) {
  var captainPlayerId = props.captainPlayerId;
  var onCreated = props.onCreated;
  var toast = props.toast;
  var [name, setName] = useState('');
  var [tag, setTag] = useState('');
  var [region, setRegion] = useState('EUW');
  var [bio, setBio] = useState('');
  var [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) { if (toast) toast('Team name is required.'); return; }
    setBusy(true);
    createTeam({
      name: name, tag: tag, region: region, bio: bio,
      captainPlayerId: captainPlayerId
    }).then(function(team) {
      setBusy(false);
      if (toast) toast('Team created.');
      if (onCreated) onCreated(team);
    }).catch(function(err) {
      setBusy(false);
      if (toast) toast('Could not create team: ' + (err.message || 'unknown error'));
    });
  }

  return (
    <Panel padding="default" className="space-y-4">
      <div>
        <h3 className="font-display text-2xl text-on-surface">Start a team</h3>
        <p className="text-sm text-on-surface/60 mt-1">
          You become captain. Invite up to 5 more players (4 main + 2 sub).
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Inp label="Team name" maxLength={40} value={name} onChange={function(e){ setName(e.target.value); }} placeholder="Homies United" />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Tag" maxLength={6} value={tag} onChange={function(e){ setTag(e.target.value.toUpperCase()); }} placeholder="HOM" />
          <div className="space-y-2">
            <label className="font-label text-xs uppercase tracking-widest text-on-surface/70 block ml-1">Region</label>
            <select
              value={region}
              onChange={function(e){ setRegion(e.target.value); }}
              className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/60 py-4 px-4 rounded-none text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus-visible:outline-none"
            >
              {REGIONS.map(function(r){ return <option key={r} value={r}>{r}</option>; })}
            </select>
          </div>
        </div>
        <Inp label="Bio (optional)" maxLength={200} value={bio} onChange={function(e){ setBio(e.target.value); }} placeholder="Who you are, what you play for." />
        <div className="flex items-center justify-end gap-2 pt-2">
          <Btn type="submit" loading={busy} icon="add">Create team</Btn>
        </div>
      </form>
    </Panel>
  );
}

function TeamStatsPanel(props) {
  var team = props.team;
  var history = props.history || [];
  if (!team) return null;
  var totalPts = history.reduce(function(s, r){ return s + (r.totalPts || 0); }, 0);
  var registeredCount = history.filter(function(r){ return r.status === 'registered' || r.status === 'checked_in'; }).length;
  var completedCount = history.filter(function(r){ var p = (r.tournament && r.tournament.phase) || ''; return String(p).toLowerCase().indexOf('complete') !== -1; }).length;
  var memberCount = (team.members || []).length;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Panel padding="tight" className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Members</div>
        <div className="font-display text-2xl text-on-surface">{memberCount}</div>
      </Panel>
      <Panel padding="tight" className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Active</div>
        <div className="font-display text-2xl text-on-surface">{registeredCount}</div>
        <div className="text-[10px] text-on-surface/50">tournaments</div>
      </Panel>
      <Panel padding="tight" className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Completed</div>
        <div className="font-display text-2xl text-on-surface">{completedCount}</div>
        <div className="text-[10px] text-on-surface/50">events</div>
      </Panel>
      <Panel padding="tight" className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-on-surface/50">Total Points</div>
        <div className="font-display text-2xl text-primary">{totalPts}</div>
      </Panel>
    </div>
  );
}

function SentInvitesPanel(props) {
  var sent = props.sent || [];
  var onCancel = props.onCancel;
  if (!sent.length) return null;
  return (
    <Panel padding="default" className="space-y-3">
      <div>
        <h3 className="font-display text-xl text-on-surface">Pending sent invites</h3>
        <p className="text-sm text-on-surface/60 mt-1">Players you have invited who haven't responded yet.</p>
      </div>
      <div className="space-y-2">
        {sent.map(function(inv){
          var p = inv.invitee || {};
          return (
            <div key={inv.id} className="flex items-center justify-between gap-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg p-3">
              <div className="min-w-0">
                <div className="font-bold text-on-surface truncate">{p.username || ('Player #' + (inv.invitee_player_id || '').slice(0, 6))}</div>
                {p.riot_id ? <div className="text-xs font-mono text-on-surface/50 truncate">{p.riot_id}</div> : null}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Tag variant="ghost">Pending</Tag>
                <Btn size="sm" v="ghost" icon="close" onClick={function(){ onCancel(inv.id); }}>Cancel</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TeamHistoryPanel(props) {
  var history = props.history || [];
  var onOpen = props.onOpen;
  if (!history.length) return null;
  function statusVariant(s) {
    if (s === 'checked_in') return 'success';
    if (s === 'registered') return 'secondary';
    if (s === 'waitlisted') return 'tertiary';
    if (s === 'dropped') return 'ghost';
    return 'ghost';
  }
  function fmtDate(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }
  return (
    <Panel padding="default" className="space-y-3">
      <div>
        <h3 className="font-display text-xl text-on-surface">Tournament history</h3>
        <p className="text-sm text-on-surface/60 mt-1">Your team's registrations and finishes.</p>
      </div>
      <div className="space-y-2">
        {history.map(function(row){
          var t = row.tournament || {};
          return (
            <button
              key={row.id}
              type="button"
              onClick={function(){ if (onOpen && t.id) onOpen(t.id); }}
              className="w-full text-left flex items-center gap-3 p-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg hover:bg-surface-container-low/70 hover:border-primary/30 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="font-bold text-on-surface truncate">{t.name || 'Tournament'}</div>
                  <Tag variant={statusVariant(row.status)}>{row.status || 'unknown'}</Tag>
                </div>
                <div className="text-xs text-on-surface/50 mt-1">{fmtDate(t.date)}</div>
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
        })}
      </div>
    </Panel>
  );
}

function InviteList(props) {
  var invites = props.invites || [];
  var onRespond = props.onRespond;
  if (!invites.length) return null;
  return (
    <Panel padding="default" className="space-y-3" accent="purple">
      <div>
        <h3 className="font-display text-xl text-on-surface">Pending invites</h3>
        <p className="text-sm text-on-surface/60 mt-1">
          Accepting an invite cancels your other pending invites and joins you to that team.
        </p>
      </div>
      <div className="space-y-2">
        {invites.map(function(inv) {
          return (
            <div key={inv.id} className="bg-surface-container-low/60 border border-outline-variant/10 rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-on-surface truncate">{inv.team && inv.team.name ? inv.team.name : 'Team #' + inv.team_id.slice(0, 6)}</div>
                {inv.message ? <div className="text-xs text-on-surface/60 truncate">{inv.message}</div> : null}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Btn size="sm" v="ghost" onClick={function(){ onRespond(inv.id, 'decline'); }}>Decline</Btn>
                <Btn size="sm" icon="check" onClick={function(){ onRespond(inv.id, 'accept'); }}>Accept</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MyTeamPanel(props) {
  var team = props.team;
  var amCaptain = props.amCaptain;
  var myMemberId = props.myMemberId;
  var onInvite = props.onInvite;
  var onRoleChange = props.onRoleChange;
  var onTransferCaptain = props.onTransferCaptain;
  var onLeave = props.onLeave;
  var onKick = props.onKick;
  var onDisband = props.onDisband;

  var members = (team && team.members) || [];
  var actives = members.filter(function(m){ return m.role === 'captain' || m.role === 'main'; });
  var subs = members.filter(function(m){ return m.role === 'sub'; });
  var openSlots = Math.max(0, 4 - actives.length);

  return (
    <Panel padding="default" className="space-y-5" accent="gold">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-3xl text-on-surface truncate">{team.name}</h2>
            {team.tag ? <Tag variant="secondary">{team.tag}</Tag> : null}
            <Tag variant="ghost">{team.region}</Tag>
          </div>
          {team.bio ? <p className="text-sm text-on-surface/70">{team.bio}</p> : null}
          <div className="text-xs font-label uppercase tracking-widest text-on-surface/40 mt-2">
            {actives.length}/4 main · {subs.length}/2 subs · {openSlots > 0 ? openSlots + ' open' : 'roster full'}
          </div>
        </div>
        {amCaptain ? (
          <Btn size="sm" v="destructive" icon="delete" onClick={onDisband}>Disband</Btn>
        ) : (
          <Btn size="sm" v="ghost" icon="logout" onClick={onLeave}>Leave</Btn>
        )}
      </div>

      <div>
        <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-2">Active roster</div>
        <div className="space-y-2">
          {actives.map(function(m) {
            var canEdit = amCaptain && m.id !== myMemberId;
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg p-3">
                <PlayerCell player={m.player} />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RoleBadge role={m.role} />
                  {canEdit && m.role !== 'captain' ? (
                    <>
                      <Btn size="sm" v="ghost" onClick={function(){ onRoleChange(m.id, 'sub'); }}>Move to sub</Btn>
                      <Btn size="sm" v="ghost" onClick={function(){ onTransferCaptain(m.id); }}>Make captain</Btn>
                      <Btn size="sm" v="destructive" icon="person_remove" onClick={function(){ onKick(m.id); }}>Kick</Btn>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          {actives.length === 0 ? <div className="text-sm text-on-surface/50">Roster is empty.</div> : null}
        </div>
      </div>

      <div>
        <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-2">Subs ({subs.length}/2)</div>
        <div className="space-y-2">
          {subs.map(function(m) {
            var canEdit = amCaptain && m.id !== myMemberId;
            return (
              <div key={m.id} className="flex items-center justify-between gap-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg p-3">
                <PlayerCell player={m.player} />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RoleBadge role={m.role} />
                  {canEdit ? (
                    <>
                      <Btn size="sm" v="ghost" onClick={function(){ onRoleChange(m.id, 'main'); }}>Promote</Btn>
                      <Btn size="sm" v="destructive" icon="person_remove" onClick={function(){ onKick(m.id); }}>Kick</Btn>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          {subs.length === 0 ? <div className="text-sm text-on-surface/40">No subs yet.</div> : null}
        </div>
      </div>

      {amCaptain ? (
        <InvitePicker
          teamId={team.id}
          existingMemberIds={members.map(function(m){ return m.player_id; })}
          onInvited={onInvite}
        />
      ) : null}
    </Panel>
  );
}

function InvitePicker(props) {
  var teamId = props.teamId;
  var existingIds = props.existingMemberIds || [];
  var onInvited = props.onInvited;
  var ctx = useApp();
  var allPlayers = ctx.players || [];
  var toast = ctx.toast;
  var currentUser = ctx.currentUser;
  var [query, setQuery] = useState('');
  var [busyId, setBusyId] = useState(null);

  var candidates = allPlayers.filter(function(p) {
    if (!p.id) return false;
    if (existingIds.indexOf(p.id) !== -1) return false;
    if (currentUser && p.id === currentUser.id) return false;
    if (!query) return true;
    var q = query.toLowerCase();
    return (p.username || '').toLowerCase().indexOf(q) !== -1
        || (p.riot_id || '').toLowerCase().indexOf(q) !== -1;
  }).slice(0, 8);

  function invite(p) {
    if (!currentUser) return;
    setBusyId(p.id);
    sendInvite({
      teamId: teamId,
      inviteePlayerId: p.id,
      inviterPlayerId: currentUser.id,
      message: ''
    }).then(function() {
      setBusyId(null);
      if (toast) toast('Invite sent to ' + (p.username || 'player') + '.');
      if (onInvited) onInvited();
    }).catch(function(err) {
      setBusyId(null);
      if (toast) toast('Invite failed: ' + (err.message || 'unknown error'));
    });
  }

  return (
    <div className="border-t border-outline-variant/10 pt-4 space-y-3">
      <div>
        <div className="font-label text-xs uppercase tracking-widest text-on-surface/50 mb-2">Invite players</div>
        <Inp placeholder="Search by username or Riot ID" value={query} onChange={function(e){ setQuery(e.target.value); }} />
      </div>
      <div className="space-y-2">
        {candidates.map(function(p) {
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-surface-container-low/40 border border-outline-variant/10 rounded-lg p-3">
              <PlayerCell player={{ username: p.username, riot_id: p.riot_id || p.riotId, profile_pic_url: p.profile_pic_url }} />
              <Btn size="sm" loading={busyId === p.id} onClick={function(){ invite(p); }} icon="send">Invite</Btn>
            </div>
          );
        })}
        {candidates.length === 0 ? <div className="text-sm text-on-surface/40">No matches.</div> : null}
      </div>
    </div>
  );
}

function TeamDirectory(props) {
  var teams = props.teams || [];
  var navigate = useNavigate();
  if (!teams.length) return null;
  return (
    <Panel padding="default" className="space-y-3">
      <div>
        <h3 className="font-display text-xl text-on-surface">Teams</h3>
        <p className="text-sm text-on-surface/60 mt-1">Browse the active rosters competing in 4v4 events.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {teams.map(function(t) {
          return (
            <button
              key={t.id}
              type="button"
              onClick={function(){ navigate('/team/' + t.id); }}
              className="text-left bg-surface-container-low/40 border border-outline-variant/10 rounded-lg p-4 hover:bg-surface-container-low/70 hover:border-primary/30 transition focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="font-bold text-on-surface">{t.name}</div>
                {t.tag ? <Tag variant="secondary">{t.tag}</Tag> : null}
                <Tag variant="ghost">{t.region}</Tag>
              </div>
              {t.bio ? <div className="text-xs text-on-surface/60">{t.bio}</div> : null}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export default function TeamsScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var toast = ctx.toast;

  var [loading, setLoading] = useState(true);
  var [myTeam, setMyTeam] = useState(null);
  var [invites, setInvites] = useState([]);
  var [allTeams, setAllTeams] = useState([]);
  var [sentInvites, setSentInvites] = useState([]);
  var [history, setHistory] = useState([]);
  var [reload, setReload] = useState(0);

  useEffect(function() {
    var cancelled = false;
    setLoading(true);
    var playerId = currentUser ? currentUser.id : null;
    Promise.all([
      playerId ? getMyTeam(playerId) : Promise.resolve(null),
      playerId ? listMyInvites(playerId) : Promise.resolve([]),
      listTeams({ includeArchived: false })
    ]).then(function(out) {
      if (cancelled) return;
      var team = out[0];
      var invs = out[1];
      var all = out[2];
      if (invs && invs.length) {
        var byId = {};
        all.forEach(function(t) { byId[t.id] = t; });
        invs = invs.map(function(i) { return Object.assign({}, i, { team: byId[i.team_id] || null }); });
      }
      setMyTeam(team);
      setInvites(invs);
      setAllTeams(all);
      if (team && team.id) {
        var amCap = team.captain_player_id === playerId;
        Promise.all([
          getTeamTournamentHistory(team.id).catch(function(){ return []; }),
          amCap ? listTeamSentInvites(team.id).catch(function(){ return []; }) : Promise.resolve([])
        ]).then(function(extras) {
          if (cancelled) return;
          setHistory(extras[0] || []);
          setSentInvites(extras[1] || []);
          setLoading(false);
        }).catch(function() {
          if (cancelled) return;
          setHistory([]); setSentInvites([]); setLoading(false);
        });
      } else {
        setHistory([]); setSentInvites([]); setLoading(false);
      }
    }).catch(function(err) {
      if (cancelled) return;
      setLoading(false);
      if (toast) toast('Could not load teams: ' + (err.message || 'unknown error'));
    });
    return function() { cancelled = true; };
  }, [currentUser ? currentUser.id : null, reload]);

  function handleCancelSent(inviteId) {
    if (!window.confirm('Cancel this invite?')) return;
    respondInvite(inviteId, 'cancel', currentUser ? currentUser.id : null)
      .then(function() { if (toast) toast('Invite cancelled.'); refresh(); })
      .catch(function(err) { if (toast) toast('Cancel failed: ' + (err.message || 'unknown error')); });
  }

  function refresh() { setReload(function(n){ return n + 1; }); }

  function handleRespond(inviteId, action) {
    var playerId = currentUser ? currentUser.id : null;
    respondInvite(inviteId, action, playerId)
      .then(function() {
        if (toast) toast(action === 'accept' ? 'Joined team.' : 'Invite ' + action + 'd.');
        refresh();
      })
      .catch(function(err) { if (toast) toast(action + ' failed: ' + (err.message || 'unknown error')); });
  }

  function handleRoleChange(memberId, role) {
    setMemberRole(memberId, role)
      .then(function() { if (toast) toast('Role updated.'); refresh(); })
      .catch(function(err) { if (toast) toast('Update failed: ' + (err.message || 'unknown error')); });
  }

  function handleTransfer(toMemberId) {
    if (!myTeam) return;
    var captainMember = myTeam.members.find(function(m){ return m.role === 'captain'; });
    if (!captainMember) { if (toast) toast('No captain to transfer from.'); return; }
    if (!window.confirm('Transfer captaincy? You become a regular main.')) return;
    transferCaptaincy(myTeam.id, captainMember.id, toMemberId)
      .then(function() { if (toast) toast('Captaincy transferred.'); refresh(); })
      .catch(function(err) { if (toast) toast('Transfer failed: ' + (err.message || 'unknown error')); });
  }

  function handleLeave() {
    if (!myTeam || !currentUser) return;
    var me = myTeam.members.find(function(m){ return m.player_id === currentUser.id; });
    if (!me) return;
    if (me.role === 'captain') {
      if (toast) toast('Transfer captaincy before leaving.');
      return;
    }
    if (!window.confirm('Leave team? 60-minute cooldown before you can join another.')) return;
    leaveTeam(me.id, 'left_voluntarily')
      .then(function() { if (toast) toast('Left team.'); refresh(); })
      .catch(function(err) { if (toast) toast('Leave failed: ' + (err.message || 'unknown error')); });
  }

  function handleKick(memberId) {
    if (!window.confirm('Kick this player? They get a 60-minute cooldown before joining another team.')) return;
    kickMember(memberId, 'kicked')
      .then(function() { if (toast) toast('Player kicked.'); refresh(); })
      .catch(function(err) { if (toast) toast('Kick failed: ' + (err.message || 'unknown error')); });
  }

  function handleDisband() {
    if (!myTeam) return;
    if (!window.confirm('Disband team? This archives the team and removes all members. You keep tournament history.')) return;
    disbandTeam(myTeam.id, 'captain_disbanded')
      .then(function() { if (toast) toast('Team disbanded.'); refresh(); })
      .catch(function(err) { if (toast) toast('Disband failed: ' + (err.message || 'unknown error')); });
  }

  if (!currentUser) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Panel padding="spacious" className="text-center space-y-3">
            <Icon name="group" className="text-5xl text-on-surface/30" />
            <h1 className="font-display text-3xl text-on-surface">4v4 Teams</h1>
            <p className="text-on-surface/60">Sign in to create a team or accept an invite.</p>
            <Btn href="/login" icon="login">Sign in</Btn>
          </Panel>
        </div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto p-6">
          <Panel padding="spacious" className="text-center text-on-surface/60">Loading teams...</Panel>
        </div>
      </PageLayout>
    );
  }

  var amCaptain = !!(myTeam && myTeam.captain_player_id === currentUser.id);
  var myMember = myTeam ? myTeam.members.find(function(m){ return m.player_id === currentUser.id; }) : null;

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-4xl text-on-surface">4v4 Teams</h1>
          <p className="text-on-surface/60">
            Build a persistent 4-player squad. Invite up to 6 active members (4 main + 2 subs).
            One active team per player. Leave-cooldown is 60 minutes.
          </p>
        </div>

        <InviteList invites={invites} onRespond={handleRespond} />

        {myTeam ? (
          <>
            <TeamStatsPanel team={myTeam} history={history} />
            <MyTeamPanel
              team={myTeam}
              amCaptain={amCaptain}
              myMemberId={myMember ? myMember.id : null}
              onInvite={refresh}
              onRoleChange={handleRoleChange}
              onTransferCaptain={handleTransfer}
              onLeave={handleLeave}
              onKick={handleKick}
              onDisband={handleDisband}
            />
            {amCaptain ? (
              <SentInvitesPanel sent={sentInvites} onCancel={handleCancelSent} />
            ) : null}
            <TeamHistoryPanel history={history} onOpen={function(tid){ navigate('/tournament/' + tid); }} />
          </>
        ) : (
          <CreateTeamForm
            captainPlayerId={currentUser.id}
            toast={toast}
            onCreated={refresh}
          />
        )}

        <TeamDirectory teams={allTeams} />
      </div>
    </PageLayout>
  );
}
