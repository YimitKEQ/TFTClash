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

  var _liveData = useState(players);
  var liveData = _liveData[0];
  var setLiveData = _liveData[1];
  var _lastUpdate = useState(new Date());
  var lastUpdate = _lastUpdate[0];
  var setLastUpdate = _lastUpdate[1];

  useEffect(function() {
    var interval = setInterval(function() {
      supabase.from("players").select("*").order("season_pts", { ascending: false }).then(function(res) {
        if (res.data) {
          setLiveData(res.data);
          setLastUpdate(new Date());
        }
      });
    }, 10000);

    var channel = supabase.channel("broadcast-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_results" }, function() {
        supabase.from("players").select("*").order("season_pts", { ascending: false }).then(function(res) {
          if (res.data) {
            setLiveData(res.data);
            setLastUpdate(new Date());
          }
        });
      })
      .subscribe();

    return function() {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  var sorted = [].concat(liveData).sort(function(a, b) { return b.pts - a.pts; });
  var bgClass = bg === "transparent" ? "bg-transparent" : "bg-[#08080F]";
  var paddingClass = size === "compact" ? "p-3" : "p-5";

  if (type === "standings") {
    return (
      <div className={bgClass + " " + paddingClass + " font-label min-h-screen"}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest">
            {tournamentState.clashName || "TFT Clash"}
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

        {sorted.slice(0, 24).map(function(p, i) {
          var rowPadding = size === "compact" ? "px-2 py-1" : "px-3 py-2";
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
    return (
      <div className={bgClass + " p-3 font-label"}>
        <div className="text-[11px] font-bold text-amber-400 uppercase mb-2">Lobby Assignments</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
          {(tournamentState.lobbies || []).map(function(lobby, li) {
            return (
              <div key={li} className="bg-white/[.04] rounded-lg px-2.5 py-2 border border-white/[.08]">
                <div className="text-[10px] font-bold text-primary mb-1">
                  {lobby.name || "Lobby " + (li + 1)}
                </div>
                {(lobby.players || []).map(function(pid) {
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
