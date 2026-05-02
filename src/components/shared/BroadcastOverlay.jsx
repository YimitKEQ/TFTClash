import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function BroadcastOverlay(props) {
  var tournamentState = props.tournamentState;
  var players = props.players;
  var params = props.params || {};
  var ALLOWED_TYPES = ['standings', 'bracket', 'results', 'players', 'lobbies'];
  var rawType = params.type || "standings";
  var type = ALLOWED_TYPES.indexOf(rawType) !== -1 ? rawType : "standings";
  var KNOWN_BG_KEYWORDS = ['dark', 'transparent'];
  var rawBg = params.bg || "dark";
  var bg = /^#[0-9a-fA-F]{3,6}$/.test(rawBg) || KNOWN_BG_KEYWORDS.indexOf(rawBg) !== -1 ? rawBg : "dark";
  var size = params.size || "compact";
  var ALLOWED_SHAPES = ['solo', 'double_up', 'squads_4v4'];
  var rawShape = params.shape || 'solo';
  var shape = ALLOWED_SHAPES.indexOf(rawShape) !== -1 ? rawShape : 'solo';
  var isTeamShape = shape === 'double_up' || shape === 'squads_4v4';
  // Optional ?tid=<uuid> scopes team standings to a specific custom tournament.
  // When absent we fall back to the active season clash from tournamentState.
  var rawTid = params.tid || params.tournament_id || '';
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var tournamentId = UUID_RE.test(rawTid)
    ? rawTid
    : ((tournamentState && (tournamentState.activeTournamentId || tournamentState.dbTournamentId)) || '');

  var _liveData = useState(players);
  var liveData = _liveData[0];
  var setLiveData = _liveData[1];
  var _lastUpdate = useState(new Date());
  var lastUpdate = _lastUpdate[0];
  var setLastUpdate = _lastUpdate[1];

  // Per-tournament team standings, populated only when shape is team and we
  // have a tournament_id. Each row: { team_id, name, tag, total, top2, top4,
  // fourths, firsts, bestPlacement, lastPlacement }.
  var _teamRows = useState([]);
  var teamRows = _teamRows[0];
  var setTeamRows = _teamRows[1];

  useEffect(function() {
    function refreshFromDb() {
      supabase.from("players").select("*").order("season_pts", { ascending: false }).then(function(res) {
        if (res.data) {
          setLiveData(res.data);
          setLastUpdate(new Date());
        }
      });
    }
    // Initial load so the overlay shows fresh data on mount.
    refreshFromDb();
    // Realtime is the source of truth; only fall back to polling if the
    // channel fails to subscribe.
    var fallbackTimer = null;
    var channel = supabase.channel("broadcast-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_results" }, refreshFromDb)
      .subscribe(function(status) {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!fallbackTimer) fallbackTimer = setInterval(refreshFromDb, 30000);
        } else if (fallbackTimer) {
          clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
      });

    return function() {
      if (fallbackTimer) clearInterval(fallbackTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  // Team standings loader: aggregates game_results for the active tournament
  // by team_id with the same tiebreaker chain as TournamentDetailScreen
  // (total → top2 → fewest 4ths → most 1sts → best last placement).
  useEffect(function() {
    if (type !== 'standings' || !isTeamShape || !tournamentId) {
      setTeamRows([]);
      return;
    }
    var alive = true;
    function refreshTeams() {
      supabase.from('game_results').select('team_id,placement,points,round_number').eq('tournament_id', tournamentId).then(function(res) {
        if (!alive) return;
        if (res.error || !Array.isArray(res.data) || res.data.length === 0) { setTeamRows([]); return; }
        var byTeam = {};
        res.data.forEach(function(r) {
          if (!r.team_id) return;
          if (!byTeam[r.team_id]) {
            byTeam[r.team_id] = { team_id: r.team_id, total: 0, top2: 0, top4: 0, fourths: 0, firsts: 0, bestPlacement: 99, lastRound: -1, lastPlacement: 9 };
          }
          var t = byTeam[r.team_id];
          var place = r.placement || 0;
          t.total += r.points || 0;
          if (place === 1) { t.firsts += 1; t.top2 += 1; t.top4 += 1 }
          else if (place === 2) { t.top2 += 1; t.top4 += 1 }
          else if (place === 3) { t.top4 += 1 }
          else if (place === 4) { t.fourths += 1; t.top4 += 1 }
          if (place > 0 && place < t.bestPlacement) t.bestPlacement = place;
          var rnd = r.round_number || 0;
          if (rnd > t.lastRound) { t.lastRound = rnd; t.lastPlacement = place || 9 }
        });
        var teamIds = Object.keys(byTeam);
        if (teamIds.length === 0) { setTeamRows([]); return; }
        supabase.from('teams').select('id,name,tag').in('id', teamIds).then(function(tRes) {
          if (!alive) return;
          var meta = {};
          (tRes.data || []).forEach(function(t) { meta[t.id] = t });
          var rows = teamIds.map(function(id) {
            var s = byTeam[id];
            var m = meta[id] || {};
            return Object.assign({}, s, { name: m.name || 'Team', tag: m.tag || null });
          }).sort(function(a, b) {
            if (b.total !== a.total) return b.total - a.total;
            if (a.bestPlacement !== b.bestPlacement) return a.bestPlacement - b.bestPlacement;
            if (b.top2 !== a.top2) return b.top2 - a.top2;
            if (a.fourths !== b.fourths) return a.fourths - b.fourths;
            if (b.firsts !== a.firsts) return b.firsts - a.firsts;
            return (a.lastPlacement || 9) - (b.lastPlacement || 9);
          });
          setTeamRows(rows);
          setLastUpdate(new Date());
        }).catch(function() { setTeamRows([]) });
      }).catch(function() { setTeamRows([]) });
    }
    refreshTeams();
    var teamFallback = null;
    var teamChannel = supabase.channel('broadcast-teams-' + tournamentId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_results', filter: 'tournament_id=eq.' + tournamentId }, refreshTeams)
      .subscribe(function(status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!teamFallback) teamFallback = setInterval(refreshTeams, 30000);
        } else if (teamFallback) {
          clearInterval(teamFallback);
          teamFallback = null;
        }
      });
    return function() {
      alive = false;
      if (teamFallback) clearInterval(teamFallback);
      supabase.removeChannel(teamChannel);
    };
  }, [type, isTeamShape, tournamentId]);

  var sorted = [].concat(liveData).sort(function(a, b) { return b.pts - a.pts; });
  var bgClass = bg === "transparent" ? "bg-transparent" : "bg-[#08080F]";
  var paddingClass = size === "compact" ? "p-3" : "p-5";

  if (type === "standings") {
    var rowPadding = size === "compact" ? "px-2 py-1" : "px-3 py-2";
    var teamUnitLabel = shape === 'squads_4v4' ? 'SQUADS' : 'TEAMS';
    var showTeamView = isTeamShape && tournamentId;
    return (
      <div className={bgClass + " " + paddingClass + " font-label min-h-screen"}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest">
            {tournamentState.clashName || "TFT Clash"}
            {showTeamView ? <span className="ml-2 text-secondary/80">{teamUnitLabel}</span> : null}
          </div>
          {tournamentState.phase === "inprogress" ? (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] font-bold text-success">
                {"LIVE - Game " + (tournamentState.round || 1) + "/" + (tournamentState.totalGames || 4)}
              </span>
            </div>
          ) : null}
        </div>

        {showTeamView && teamRows.length === 0 && (
          <div className="text-[11px] text-on-surface-variant px-2 py-3">
            {"Waiting for first " + (shape === 'squads_4v4' ? 'squad' : 'team') + " result..."}
          </div>
        )}

        {showTeamView && teamRows.slice(0, 24).map(function(t, i) {
          return (
            <div
              key={t.team_id}
              className={
                "flex items-center gap-2 border-b border-white/[.06] " +
                rowPadding +
                (i < 3 ? " bg-amber-400/[.04]" : "")
              }
            >
              <span
                className={
                  "w-6 text-right text-[13px] font-bold " +
                  (i === 0 ? "text-amber-400" : i < 3 ? "text-gray-400" : "text-on-surface-variant")
                }
              >
                {i + 1}
              </span>
              <span className="flex-1 text-[13px] font-semibold text-on-surface truncate">
                {t.tag ? <span className="text-secondary/70 mr-1.5">{"[" + t.tag + "]"}</span> : null}
                {t.name}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono mr-2">
                {t.firsts + "W " + t.top4 + "T4"}
              </span>
              <span className="text-[13px] font-bold text-amber-400 font-mono">{t.total}</span>
            </div>
          );
        })}

        {!showTeamView && sorted.slice(0, 24).map(function(p, i) {
          return (
            <div
              key={p.id}
              className={
                "flex items-center gap-2 border-b border-white/[.06] " +
                rowPadding +
                (i < 3 ? " bg-amber-400/[.04]" : "")
              }
            >
              <span
                className={
                  "w-6 text-right text-[13px] font-bold " +
                  (i === 0 ? "text-amber-400" : i < 3 ? "text-gray-400" : "text-on-surface-variant")
                }
              >
                {i + 1}
              </span>
              <span className="flex-1 text-[13px] font-semibold text-on-surface">{p.name}</span>
              <span className="text-[13px] font-bold text-amber-400 font-mono">{p.pts}</span>
            </div>
          );
        })}

        <div className="text-right mt-2 text-[8px] text-primary/40 tracking-widest">TFT CLASH</div>
        <div className="text-[8px] text-white/30 mt-1">
          {"Updated: " + lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    );
  }

  if (type === "lobbies" && tournamentState.lobbies) {
    var pairSize = shape === 'double_up' ? 2 : (shape === 'squads_4v4' ? 4 : 0);
    var pairLabel = shape === 'double_up' ? 'Team' : (shape === 'squads_4v4' ? 'Squad' : '');
    return (
      <div className={bgClass + " p-3 font-label"}>
        <div className="text-[11px] font-bold text-amber-400 uppercase mb-2">Lobby Assignments</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          {(tournamentState.lobbies || []).map(function(lobby, li) {
            var pids = (lobby.players || []);
            var pairs = [];
            if (pairSize > 0) {
              for (var pi = 0; pi < pids.length; pi += pairSize) {
                pairs.push(pids.slice(pi, pi + pairSize));
              }
            }
            return (
              <div key={li} className="bg-white/[.04] rounded-lg px-2.5 py-2 border border-white/[.08]">
                <div className="text-[10px] font-bold text-primary mb-1">
                  {lobby.name || "Lobby " + (li + 1)}
                </div>
                {pairSize > 0 ? pairs.map(function(pair, gi) {
                  return (
                    <div key={gi} className="mb-1.5 last:mb-0">
                      <div className="text-[8px] tracking-widest uppercase text-amber-400/70 mb-0.5">{pairLabel + ' ' + (gi + 1)}</div>
                      {pair.map(function(pid) {
                        var p = liveData.find(function(pl) { return String(pl.id) === String(pid); });
                        return (
                          <div key={pid} className="text-[11px] text-on-surface-variant py-0.5 pl-1.5">
                            {p ? p.name : "Player " + pid}
                          </div>
                        );
                      })}
                    </div>
                  );
                }) : pids.map(function(pid) {
                  var p = liveData.find(function(pl) { return String(pl.id) === String(pid); });
                  return (
                    <div key={pid} className="text-[11px] text-on-surface-variant py-0.5">
                      {p ? p.name : "Player " + pid}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={bgClass + " p-5 text-on-surface-variant text-[13px]"}>
      No data available
    </div>
  );
}

export default BroadcastOverlay;
