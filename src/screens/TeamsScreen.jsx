/**
 * TeamsScreen - real DB-backed team management.
 *
 * Teams are persistent rosters used across both 4v4 Squads and 2v2 Double Up
 * events. Captain picks the lineup at check-in based on the tournament format.
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
  setMemberRole, transferCaptaincy, leaveTeam, kickMember,
  acceptInviteByCode, saveLineupPreset, listMyPendingRsvps, respondTeamEventRsvp,
  listLftPosts, getMyLftPost, upsertLftPost, archiveMyLftPost,
  listMyRingerInvites, respondTeamRingerInvite
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
          You become captain. Invite up to 5 more players. Your team can enter
          both 4v4 Squads and 2v2 Double Up events; pick the right lineup at
          check-in.
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

function InviteLinkPanel(props) {
  var team = props.team;
  var amCaptain = props.amCaptain;
  var toast = props.toast;
  var [copied, setCopied] = useState(false);
  if (!team || !team.invite_code) return null;
  var origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
  var url = origin + '/teams/join/' + team.invite_code;
  function copy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      if (toast) toast('Copy not supported in this browser.');
      return;
    }
    navigator.clipboard.writeText(url).then(function() {
      setCopied(true);
      if (toast) toast('Invite link copied.');
      setTimeout(function(){ setCopied(false); }, 2000);
    }).catch(function() {
      if (toast) toast('Copy failed.');
    });
  }
  return (
    <Panel padding="default" className="space-y-3" accent="primary">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-on-surface">Shareable invite link</h3>
          <p className="text-sm text-on-surface/60 mt-1">
            {amCaptain
              ? 'Send this to anyone you want on the team. They click, sign in, and they are on the roster.'
              : 'Anyone on the team can share this with prospects.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-sm bg-surface-container-low/60 border border-outline-variant/20 rounded px-3 py-2 truncate">{url}</code>
        <Btn size="sm" icon={copied ? 'check' : 'content_copy'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Btn>
      </div>
      <div className="text-xs text-on-surface/50">
        Code: <span className="font-mono text-on-surface/80">{team.invite_code}</span>
      </div>
    </Panel>
  );
}

function JoinByCodeCard(props) {
  var toast = props.toast;
  var onJoined = props.onJoined;
  var [code, setCode] = useState('');
  var [busy, setBusy] = useState(false);
  function submit(e) {
    e.preventDefault();
    var trimmed = String(code || '').trim();
    if (!trimmed) { if (toast) toast('Enter an invite code.'); return; }
    setBusy(true);
    acceptInviteByCode(trimmed)
      .then(function(r) {
        setBusy(false);
        if (r && r.already_member) {
          if (toast) toast('You were already on that team.');
        } else {
          if (toast) toast('Joined ' + (r && r.team && r.team.name ? r.team.name : 'team') + '.');
        }
        setCode('');
        if (onJoined) onJoined();
      })
      .catch(function(err) {
        setBusy(false);
        if (toast) toast('Could not join: ' + (err.message || 'unknown error'));
      });
  }
  return (
    <Panel padding="default" className="space-y-3">
      <div>
        <h3 className="font-display text-xl text-on-surface">Have an invite code?</h3>
        <p className="text-sm text-on-surface/60 mt-1">Paste the 8-character code a captain shared with you.</p>
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <div className="flex-1">
          <Inp
            label="Invite code"
            maxLength={32}
            value={code}
            onChange={function(e){ setCode(e.target.value.toUpperCase()); }}
            placeholder="A1B2C3D4"
          />
        </div>
        <Btn type="submit" loading={busy} icon="login">Join</Btn>
      </form>
    </Panel>
  );
}

function LineupPresetPanel(props) {
  var team = props.team;
  var amCaptain = props.amCaptain;
  var toast = props.toast;
  var onSaved = props.onSaved;
  var members = ((team && team.members) || []).filter(function(m){ return m.role !== 'sub'; });
  var subs = ((team && team.members) || []).filter(function(m){ return m.role === 'sub'; });
  var roster = members.concat(subs);
  var rosterIds = roster.map(function(m){ return m.player_id; });
  var memberById = {};
  roster.forEach(function(m){ memberById[m.player_id] = m; });

  function sanitize(arr) {
    return (arr || []).filter(function(pid){ return rosterIds.indexOf(pid) !== -1; });
  }
  var [duo, setDuo] = useState(sanitize(team && team.lineup_2v2));
  var [squad, setSquad] = useState(sanitize(team && team.lineup_4v4));
  var [busy, setBusy] = useState(null);

  function toggle(setter, current, max, pid) {
    var idx = current.indexOf(pid);
    if (idx !== -1) {
      setter(current.filter(function(x){ return x !== pid; }));
    } else {
      if (current.length >= max) {
        if (toast) toast('Preset is full (' + max + '). Deselect to swap.');
        return;
      }
      setter(current.concat([pid]));
    }
  }

  function save(size) {
    var arr = size === 2 ? duo : squad;
    if (arr.length !== 0 && arr.length !== size) {
      if (toast) toast('Pick exactly ' + size + ' players or clear the preset.');
      return;
    }
    setBusy(size);
    saveLineupPreset(team.id, size, arr)
      .then(function(){
        setBusy(null);
        if (toast) toast(size === 2 ? '2v2 preset saved.' : '4v4 preset saved.');
        if (onSaved) onSaved();
      })
      .catch(function(err){
        setBusy(null);
        if (toast) toast('Save failed: ' + (err.message || 'unknown error'));
      });
  }

  if (!team) return null;
  if (!amCaptain) {
    var hasAny = (team.lineup_2v2 && team.lineup_2v2.length) || (team.lineup_4v4 && team.lineup_4v4.length);
    if (!hasAny) return null;
    function nameFor(pid) { var m = memberById[pid]; return (m && m.player && m.player.username) || ('#' + String(pid).slice(0,6)); }
    return (
      <Panel padding="default" className="space-y-3">
        <div>
          <h3 className="font-display text-xl text-on-surface">Default lineups</h3>
          <p className="text-sm text-on-surface/60 mt-1">Captain's saved starters for each format.</p>
        </div>
        {team.lineup_2v2 && team.lineup_2v2.length ? (
          <div className="text-sm"><span className="font-label uppercase tracking-wider text-on-surface/50 mr-2">2v2</span>{team.lineup_2v2.map(nameFor).join(', ')}</div>
        ) : null}
        {team.lineup_4v4 && team.lineup_4v4.length ? (
          <div className="text-sm"><span className="font-label uppercase tracking-wider text-on-surface/50 mr-2">4v4</span>{team.lineup_4v4.map(nameFor).join(', ')}</div>
        ) : null}
      </Panel>
    );
  }

  function PresetRow(args) {
    var size = args.size;
    var sel = args.sel;
    var setter = args.setter;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-lg text-on-surface">{size === 2 ? '2v2 Double Up' : '4v4 Squads'}</div>
            <div className="text-xs text-on-surface/50">Pick {size} starter{size > 1 ? 's' : ''}. Used as the default at check-in.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-on-surface/60">{sel.length}/{size}</span>
            <Btn size="sm" v="ghost" onClick={function(){ setter([]); }}>Clear</Btn>
            <Btn size="sm" loading={busy === size} icon="save" onClick={function(){ save(size); }}>Save</Btn>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {roster.map(function(m){
            var active = sel.indexOf(m.player_id) !== -1;
            var p = m.player || {};
            return (
              <button
                key={m.player_id}
                type="button"
                onClick={function(){ toggle(setter, sel, size, m.player_id); }}
                className={'text-left p-2 rounded-lg border transition ' + (active ? 'bg-primary/15 border-primary/50 text-on-surface' : 'bg-surface-container-low/40 border-outline-variant/20 text-on-surface/70 hover:bg-surface-container-low/70')}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={active ? 'check_circle' : 'radio_button_unchecked'} size={18} className={active ? 'text-primary' : 'text-on-surface/30'} />
                  <div className="min-w-0">
                    <div className="font-bold truncate text-sm">{p.username || ('#' + String(m.player_id).slice(0,6))}</div>
                    <div className="text-[10px] uppercase tracking-wider text-on-surface/40">{m.role}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Panel padding="default" className="space-y-5">
      <div>
        <h3 className="font-display text-xl text-on-surface">Lineup presets</h3>
        <p className="text-sm text-on-surface/60 mt-1">
          Save default starters for each format. The check-in lineup picker prefills from these so you don't re-pick at every event.
        </p>
      </div>
      <PresetRow size={2} sel={duo} setter={setDuo} />
      <div className="border-t border-outline-variant/15"></div>
      <PresetRow size={4} sel={squad} setter={setSquad} />
    </Panel>
  );
}

function MyRingerInvitesPanel(props) {
  var ringers = props.ringers || [];
  var onRespond = props.onRespond;
  var navigate = props.navigate;
  if (!ringers.length) return null;
  return (
    <Panel padding="default" className="space-y-3" accent="primary">
      <div>
        <h3 className="font-display text-xl text-on-surface">Ringer invites</h3>
        <p className="text-sm text-on-surface/60 mt-1">A captain wants you to play one tournament for their team.</p>
      </div>
      <div className="space-y-2">
        {ringers.map(function(r){
          var t = r.tournaments || {};
          var team = r.teams || {};
          var fmt = t.team_size === 2 ? '2v2' : t.team_size === 4 ? '4v4' : '';
          return (
            <div key={r.id} className="bg-surface-container-low/60 border border-outline-variant/10 rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <button type="button" onClick={function(){ if (navigate && t.id) navigate('/tournament/' + t.id); }} className="font-bold text-on-surface truncate hover:text-primary text-left">{team.name || 'A team'}</button>
                  {fmt ? <Tag variant="secondary">{fmt}</Tag> : null}
                </div>
                <div className="text-xs text-on-surface/50 mt-1">{t.name || 'a tournament'}{r.message ? ' - ' + r.message : ''}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Btn size="sm" v="ghost" onClick={function(){ onRespond(r.id, 'declined'); }}>Decline</Btn>
                <Btn size="sm" icon="check" onClick={function(){ onRespond(r.id, 'accepted'); }}>Accept</Btn>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MyLftPostPanel(props) {
  var post = props.post;
  var toast = props.toast;
  var onSaved = props.onSaved;
  var [region, setRegion] = useState((post && post.region) || 'EUW');
  var [doFour, setDoFour] = useState(post ? (post.formats || []).indexOf('4v4') !== -1 : true);
  var [doDuo, setDoDuo] = useState(post ? (post.formats || []).indexOf('2v2') !== -1 : true);
  var [message, setMessage] = useState((post && post.message) || '');
  var [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    var formats = [];
    if (doFour) formats.push('4v4');
    if (doDuo) formats.push('2v2');
    if (!formats.length) { if (toast) toast('Pick at least one format.'); return; }
    setBusy(true);
    upsertLftPost({ region: region, formats: formats, message: message })
      .then(function(){ setBusy(false); if (toast) toast(post ? 'LFT post updated.' : 'Posted to the LFT board.'); if (onSaved) onSaved(); })
      .catch(function(err){ setBusy(false); if (toast) toast('Save failed: ' + (err.message || 'unknown error')); });
  }

  function archive() {
    if (!post) return;
    if (!window.confirm('Take down your LFT post?')) return;
    setBusy(true);
    archiveMyLftPost(post.id)
      .then(function(){ setBusy(false); if (toast) toast('LFT post taken down.'); if (onSaved) onSaved(); })
      .catch(function(err){ setBusy(false); if (toast) toast('Archive failed: ' + (err.message || 'unknown error')); });
  }

  return (
    <Panel padding="default" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl text-on-surface">{post ? 'Your LFT listing' : 'Looking for a team?'}</h3>
          <p className="text-sm text-on-surface/60 mt-1">{post ? 'Captains can browse and recruit you.' : 'Post here so captains can find you.'}</p>
        </div>
        {post ? <Tag variant="success">Live</Tag> : null}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs uppercase tracking-wider font-label text-on-surface/60 mb-1">Region</div>
            <select value={region} onChange={function(e){ setRegion(e.target.value); }} className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface">
              {REGIONS.map(function(r){ return <option key={r} value={r}>{r}</option>; })}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <div className="text-xs uppercase tracking-wider font-label text-on-surface/60 mb-1">Formats</div>
            <div className="flex gap-2">
              <button type="button" onClick={function(){ setDoFour(!doFour); }} className={'px-3 py-2 rounded border text-sm ' + (doFour ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/20 text-on-surface/60')}>4v4 Squads</button>
              <button type="button" onClick={function(){ setDoDuo(!doDuo); }} className={'px-3 py-2 rounded border text-sm ' + (doDuo ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/20 text-on-surface/60')}>2v2 Double Up</button>
            </div>
          </div>
        </div>
        <label className="block">
          <div className="text-xs uppercase tracking-wider font-label text-on-surface/60 mb-1">Pitch (optional)</div>
          <textarea value={message} onChange={function(e){ setMessage(e.target.value); }} maxLength={240} rows={2} placeholder="Diamond IV, EU evenings, voice on Discord..." className="w-full bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface" />
        </label>
        <div className="flex gap-2">
          <Btn type="submit" disabled={busy} icon={post ? 'save' : 'campaign'}>{busy ? 'Saving...' : (post ? 'Update post' : 'Post LFT')}</Btn>
          {post ? <Btn type="button" v="ghost" onClick={archive} disabled={busy} icon="visibility_off">Take down</Btn> : null}
        </div>
      </form>
    </Panel>
  );
}

function LftBrowsePanel(props) {
  var posts = props.posts || [];
  var amCaptain = props.amCaptain;
  var teamId = props.teamId;
  var captainPlayerId = props.captainPlayerId;
  var toast = props.toast;
  var onInvite = props.onInvite;
  if (!posts.length) {
    return (
      <Panel padding="default" className="space-y-2">
        <h3 className="font-display text-xl text-on-surface">LFT board</h3>
        <p className="text-sm text-on-surface/60">No players are looking right now. Check back later.</p>
      </Panel>
    );
  }
  function fmtDate(s){ try { var d = new Date(s); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch(e){ return ''; } }
  function inviteFromPost(post) {
    if (!amCaptain || !teamId || !captainPlayerId) { if (toast) toast('Captains only.'); return; }
    var pid = post.player_id;
    sendInvite({ teamId: teamId, inviteePlayerId: pid, inviterPlayerId: captainPlayerId, message: 'Saw your LFT post.' })
      .then(function(){ if (toast) toast('Invite sent.'); if (onInvite) onInvite(); })
      .catch(function(err){ if (toast) toast('Invite failed: ' + (err.message || 'unknown error')); });
  }
  return (
    <Panel padding="default" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-on-surface">LFT board</h3>
        <Tag variant="secondary">{posts.length}</Tag>
      </div>
      <div className="space-y-2">
        {posts.map(function(p){
          var pl = p.players || {};
          return (
            <div key={p.id} className="bg-surface-container-low/60 border border-outline-variant/10 rounded-lg p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden flex-shrink-0">
                {pl.profile_pic_url ? <img src={pl.profile_pic_url} alt="" className="w-full h-full object-cover"/> : <Icon name="person" className="text-on-surface/40" size={16}/>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-on-surface truncate">{pl.username || 'Player'}</span>
                  <Tag variant="secondary">{p.region || pl.region || 'EUW'}</Tag>
                  {(p.formats || []).map(function(f){ return <Tag key={f} variant="tertiary">{f}</Tag>; })}
                </div>
                {p.message ? <div className="text-xs text-on-surface/60 mt-0.5 truncate">{p.message}</div> : null}
                <div className="text-[10px] text-on-surface/40 mt-0.5 font-mono">{'posted ' + fmtDate(p.created_at)}</div>
              </div>
              {amCaptain ? <Btn size="sm" icon="person_add" onClick={function(){ inviteFromPost(p); }}>Invite</Btn> : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MyRsvpsPanel(props) {
  var rsvps = props.rsvps || [];
  var onRespond = props.onRespond;
  var navigate = props.navigate;
  if (!rsvps.length) return null;
  function fmtDate(s) {
    if (!s) return '';
    try { var d = new Date(s); if (isNaN(d.getTime())) return ''; return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  return (
    <Panel padding="default" className="space-y-3" accent="tertiary">
      <div>
        <h3 className="font-display text-xl text-on-surface">Confirm tournament availability</h3>
        <p className="text-sm text-on-surface/60 mt-1">Your captain registered the team. Tell them whether you can play.</p>
      </div>
      <div className="space-y-2">
        {rsvps.map(function(r){
          var t = r.tournaments || {};
          var team = r.teams || {};
          var fmt = t.team_size === 2 ? '2v2' : t.team_size === 4 ? '4v4' : '';
          return (
            <div key={r.id} className="bg-surface-container-low/60 border border-outline-variant/10 rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <button type="button" onClick={function(){ if (navigate && t.id) navigate('/tournament/' + t.id); }} className="font-bold text-on-surface truncate hover:text-primary text-left">{t.name || 'Tournament'}</button>
                  {fmt ? <Tag variant="secondary">{fmt}</Tag> : null}
                </div>
                <div className="text-xs text-on-surface/50 mt-1">{team.name || 'your team'} {fmtDate(t.date) ? '\u00b7 ' + fmtDate(t.date) : ''}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Btn size="sm" v="ghost" onClick={function(){ onRespond(r.id, 'declined'); }}>Can't play</Btn>
                <Btn size="sm" icon="check" onClick={function(){ onRespond(r.id, 'accepted'); }}>I'm in</Btn>
              </div>
            </div>
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
  var subRoute = ctx.subRoute;
  var setSubRoute = ctx.setSubRoute;

  var [loading, setLoading] = useState(true);
  var [myTeam, setMyTeam] = useState(null);
  var [invites, setInvites] = useState([]);
  var [allTeams, setAllTeams] = useState([]);
  var [sentInvites, setSentInvites] = useState([]);
  var [history, setHistory] = useState([]);
  var [pendingRsvps, setPendingRsvps] = useState([]);
  var [pendingRingers, setPendingRingers] = useState([]);
  var [myLftPost, setMyLftPost] = useState(null);
  var [lftPosts, setLftPosts] = useState([]);
  var [reload, setReload] = useState(0);
  var [joiningCode, setJoiningCode] = useState(false);
  var navigate = useNavigate();

  useEffect(function() {
    if (!subRoute || subRoute.indexOf('join-') !== 0) return;
    if (!currentUser || !currentUser.id) return;
    if (joiningCode) return;
    var code = subRoute.slice(5).trim().toUpperCase();
    if (!code) { if (setSubRoute) setSubRoute(''); return; }
    setJoiningCode(true);
    acceptInviteByCode(code).then(function(res) {
      if (res && res.already_member) {
        if (toast) toast('You\'re already on this team.');
      } else {
        if (toast) toast('Joined team!');
      }
      if (setSubRoute) setSubRoute('');
      navigate('/teams', { replace: true });
      setReload(function(n){ return n + 1; });
    }).catch(function(err) {
      if (toast) toast('Could not join: ' + (err.message || 'invalid code'));
      if (setSubRoute) setSubRoute('');
      navigate('/teams', { replace: true });
    }).finally(function(){ setJoiningCode(false); });
  }, [subRoute, currentUser ? currentUser.id : null]);

  useEffect(function() {
    var cancelled = false;
    setLoading(true);
    var playerId = currentUser ? currentUser.id : null;
    Promise.all([
      playerId ? getMyTeam(playerId) : Promise.resolve(null),
      playerId ? listMyInvites(playerId) : Promise.resolve([]),
      listTeams({ includeArchived: false }),
      playerId ? listMyPendingRsvps(playerId).catch(function(){ return []; }) : Promise.resolve([]),
      playerId ? listMyRingerInvites(playerId).catch(function(){ return []; }) : Promise.resolve([]),
      playerId ? getMyLftPost(playerId).catch(function(){ return null; }) : Promise.resolve(null),
      listLftPosts().catch(function(){ return []; })
    ]).then(function(out) {
      if (cancelled) return;
      var team = out[0];
      var invs = out[1];
      var all = out[2];
      setPendingRsvps(out[3] || []);
      setPendingRingers(out[4] || []);
      setMyLftPost(out[5] || null);
      setLftPosts(out[6] || []);
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

  function handleRsvp(rsvpId, status) {
    respondTeamEventRsvp(rsvpId, status)
      .then(function(){
        if (toast) toast(status === 'accepted' ? 'You\'re in.' : 'Marked as unavailable.');
        refresh();
      })
      .catch(function(err){ if (toast) toast('RSVP failed: ' + (err.message || 'unknown error')); });
  }

  function handleRingerRespond(ringerId, status) {
    respondTeamRingerInvite(ringerId, status)
      .then(function(){
        if (toast) toast(status === 'accepted' ? 'Accepted ringer slot.' : 'Declined ringer invite.');
        refresh();
      })
      .catch(function(err){ if (toast) toast('Could not respond: ' + (err.message || 'unknown error')); });
  }

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
          <h1 className="font-display text-4xl text-on-surface">Teams</h1>
          <p className="text-on-surface/60">
            Build a persistent roster for both 4v4 Squads and 2v2 Double Up
            events. Invite up to 6 active members. One active team per player.
            Leave-cooldown is 60 minutes. Captains pick the lineup at check-in
            (4 starters for Squads, 2 for Double Up).
          </p>
        </div>

        <MyRsvpsPanel rsvps={pendingRsvps} onRespond={handleRsvp} navigate={navigate} />
        <MyRingerInvitesPanel ringers={pendingRingers} onRespond={handleRingerRespond} navigate={navigate} />
        <InviteList invites={invites} onRespond={handleRespond} />

        {myTeam ? (
          <>
            <TeamStatsPanel team={myTeam} history={history} />
            <InviteLinkPanel team={myTeam} amCaptain={amCaptain} toast={toast} />
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
            <LineupPresetPanel team={myTeam} amCaptain={amCaptain} toast={toast} onSaved={refresh} />
            {amCaptain ? (
              <SentInvitesPanel sent={sentInvites} onCancel={handleCancelSent} />
            ) : null}
            {amCaptain ? (
              <LftBrowsePanel
                posts={lftPosts}
                amCaptain={amCaptain}
                teamId={myTeam.id}
                captainPlayerId={currentUser.id}
                toast={toast}
                onInvite={refresh}
              />
            ) : null}
            <TeamHistoryPanel history={history} onOpen={function(tid){ navigate('/tournament/' + tid); }} />
          </>
        ) : (
          <>
            <JoinByCodeCard toast={toast} onJoined={refresh} />
            <MyLftPostPanel post={myLftPost} toast={toast} onSaved={refresh} />
            <CreateTeamForm
              captainPlayerId={currentUser.id}
              toast={toast}
              onCreated={refresh}
            />
          </>
        )}

        <TeamDirectory teams={allTeams} />
      </div>
    </PageLayout>
  );
}
