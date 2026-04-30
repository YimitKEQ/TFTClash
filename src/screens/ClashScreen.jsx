import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import CountdownTimer from '../components/shared/CountdownTimer';
import { getNextSaturday } from '../lib/useCountdown';
import { RANKS, RCOLS, REGIONS, PTS, CLASH_RANKS, XP_REWARDS, HOMIES_IDS, TIER_FEATURES } from '../lib/constants.js';
import { computeStats, getStats, effectivePts, tiebreaker, computeClashAwards, generateRecap, getClashRank, getXpProgress, estimateXp, isHotStreak, isOnTilt, isComebackEligible, getAttendanceStreak, computeSeasonBonuses, checkAchievements, syncAchievements } from '../lib/stats.js';
import { TOURNAMENT_FORMATS, buildLobbies, computeTournamentStandings, applyCutLine } from '../lib/tournament.js';
import { ordinal, rc, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js';
import { writeActivityEvent, createNotification } from '../lib/notifications.js';
import { useApp } from '../context/AppContext';
import { LEADERBOARD_TIERS as TIER_THRESHOLDS } from '../lib/tiers.js';
import { Panel, Btn, Icon, Tag, Inp, Divider, Skeleton, Sel, PillTab, PillTabGroup } from '../components/ui';
import RankBadge from '../components/shared/RankBadge';
import Sparkline from '../components/shared/Sparkline';
import AwardCard from '../components/shared/AwardCard';
import PlacementDistribution from '../components/shared/PlacementDistribution';
import PrizePoolCard from '../components/shared/PrizePoolCard';
import PageLayout from '../components/layout/PageLayout';
import ClashLiveDashboard from './ClashLiveDashboard';

// ---- CANVAS COLORS (for downloadCard ctx operations) ----
var CANVAS_COLORS = { text: '#e4e1ec', muted: '#d5c4af', accent: '#e8a838' };

// ---- hexToRgb helper ----

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return r + "," + g + "," + b;
}

// ---- FormDots (recent form indicator) ----

function FormDots(props) {
  var n = props.max || 5;
  var recent = (props.history || []).slice(-n);
  if (recent.length === 0) return null;
  return (
    <div className="flex gap-[3px] items-center">
      {recent.map(function(h, i) {
        var p = h.placement || h.place || 5;
        var cls = "form-dot " + (p === 1 ? "form-dot-win" : p <= 4 ? "form-dot-top4" : "form-dot-bot4");
        var title = "Game " + (i + 1) + ": #" + p;
        return <span key={"dot-" + i} className={cls} title={title} />;
      })}
    </div>
  );
}

// ---- AvgBadge ----

function AvgBadge(props) {
  var avg = props.avg;
  var n = parseFloat(avg) || 0;
  var c = avgCol(avg);
  if (n === 0) return <span className="mono text-[13px] text-muted">-</span>;
  return (
    <div className="inline-flex items-center gap-[5px]">
      <span className="mono text-[13px] font-bold" style={{ color: c }}>{n.toFixed(2)}</span>
      <div className="w-7 h-[3px] bg-surface-container-lowest rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: Math.max(0, ((8 - n) / 7) * 100) + "%", background: c }} />
      </div>
    </div>
  );
}

// ---- Bar ----

function Bar(props) {
  var val = props.val;
  var max = props.max;
  var color = props.color;
  var h = props.h;
  var pct = Math.min(100, (val / Math.max(max || 1, 1)) * 100);
  return (
    <div className="bg-surface-container-lowest rounded-full overflow-hidden flex-1" style={{ height: h || 3 }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: pct + "%", background: color || "linear-gradient(90deg,#E8A838,#D4922A)" }} />
    </div>
  );
}

// ---- Dot ----

function Dot(props) {
  var c = props.color || "#52C47C";
  var s = props.size || 7;
  return <div className="rounded-full shrink-0 animate-[blink_2s_infinite]" style={{ width: s, height: s, background: c }} />;
}

// ---- ClashRankBadge ----

function ClashRankBadge(props) {
  var xp = props.xp;
  var size = props.size;
  var showProgress = props.showProgress;
  var progress = getXpProgress(xp || 0);
  var rank = progress.rank;
  var next = progress.next;
  var pct = progress.pct;
  var current = progress.current;
  var needed = progress.needed;
  var sm = size === "sm";
  return (
    <div className={"inline-flex " + (showProgress ? "flex-col items-stretch gap-1" : "flex-row items-center gap-[5px]")}>
      <div className={"inline-flex items-center gap-1 " + (sm ? "rounded-md px-[7px] py-0.5" : "rounded-lg px-2.5 py-1")} style={{
        background: rank.color + "18", border: "1px solid " + rank.color + "44"
      }}>
        <Icon name={rank.icon || "military_tech"} style={{ fontSize: sm ? 12 : 15, color: rank.color }} />
        <span className={"font-bold tracking-[.04em] " + (sm ? "text-[10px]" : "text-xs")} style={{ color: rank.color }}>{rank.name}</span>
      </div>
      {showProgress && next && (
        <div>
          <div className="flex justify-between mb-[3px]">
            <span className="text-[10px] text-muted">{current} / {needed} XP</span>
            <span className="text-[10px] font-bold" style={{ color: rank.color }}>{pct}%</span>
          </div>
          <Bar val={current} max={needed} color={rank.color} h={4} />
          <div className="text-[10px] text-on-surface-variant mt-[3px]">Next: <Icon name={next.icon || "military_tech"} style={{ fontSize: 10, color: next.color }} /> {next.name}</div>
        </div>
      )}
    </div>
  );
}

// ---- ClashRecap ----

function ClashRecap(props) {
  var recap = props.recap;
  if (!recap) return null;
  return (
    <div className="relative overflow-hidden rounded-xl mx-4 mb-5 p-5 bg-[rgba(17,24,39,.8)] border border-[rgba(52,211,153,.15)]">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#34D399] to-transparent" />
      <div className="font-label text-[10px] uppercase tracking-[.12em] font-bold mb-[10px] text-[#34D399]">{recap.clashName + " Recap"}</div>
      <div className="text-[14px] text-on-surface leading-[1.8]">
        {recap.lines.map(function(line, i) {
          return <p key={"line-" + i} className="mb-2">{line}</p>;
        })}
      </div>
      <div className="flex gap-2 mt-3">
        <Btn v="ghost" s="sm" onClick={function() {
          var text = recap.clashName + " Recap\n\n" + recap.lines.join("\n");
          navigator.clipboard.writeText(text);
          if (props.toast) props.toast("Copied to clipboard!", "success");
        }}><Icon name="content_paste" className="mr-1" />Copy for Discord</Btn>
        <Btn v="ghost" s="sm" onClick={function() {
          var text = recap.clashName + " Recap\n\n" + recap.lines.join("\n") + "\n\ntftclash.com";
          if (navigator.share) { navigator.share({ title: recap.clashName + " Recap", text: text }).catch(function() {}); }
          else { navigator.clipboard.writeText(text); if (props.toast) props.toast("Recap copied to clipboard!", "success"); }
        }}><Icon name="share" className="mr-1" />Share Card</Btn>
      </div>
    </div>
  );
}

// ---- FileDisputeModal ----

function FileDisputeModal(props) {
  var targetPlayer = props.targetPlayer;
  var claimPlacement = props.claimPlacement;
  var onSubmit = props.onSubmit;
  var onClose = props.onClose;
  var _r = useState("");
  var reason = _r[0];
  var setReason = _r[1];
  var _u = useState("");
  var url = _u[0];
  var setUrl = _u[1];
  return (
    <div className="fixed inset-0 bg-black/[.88] flex items-center justify-center z-[500] p-4">
      <Panel danger className="w-full max-w-[460px] p-6">
        <div className="mt-1.5">
          <div className="cond text-base font-extrabold text-error mb-1 tracking-[.08em] uppercase">
            <Icon name="flag" className="text-sm mr-1" />File Dispute
          </div>
          <div className="text-[13px] text-[#C8D4E0] mb-5">
            Flagging <span className="text-on-surface font-bold">{targetPlayer}</span> - claimed <span className="text-primary font-extrabold font-mono">#{claimPlacement}</span>
          </div>
          <label className="block text-[11px] text-[#C8D4E0] mb-1.5 font-bold uppercase tracking-[.06em]">Reason <span className="text-error">*</span></label>
          <Inp value={reason} onChange={setReason} placeholder="Why is this placement wrong?" className="mb-3.5" />
          <label className="block text-[11px] text-[#C8D4E0] mb-1.5 font-bold uppercase tracking-[.06em]">Screenshot URL (optional)</label>
          <Inp value={url} onChange={setUrl} placeholder="https://imgur.com/..." className="mb-5" />
          <div className="flex gap-2.5">
            <Btn v="danger" full onClick={function() {
              if (!reason.trim()) return;
              onSubmit({ reason: reason.trim(), url: url.trim(), target: targetPlayer, placement: claimPlacement, ts: Date.now() });
              onClose();
            }}>Submit</Btn>
            <Btn v="dark" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ---- DisputeBanner ----

function DisputeBanner(props) {
  var disputes = props.disputes;
  var onResolve = props.onResolve;
  var isAdmin = props.isAdmin;
  if (!disputes || disputes.length === 0) return null;
  return (
    <div className="rounded-lg px-4 py-3.5 mb-3.5 animate-[disp-anim_2s_infinite] bg-[rgba(127,29,29,.95)] border border-[rgba(220,38,38,.6)]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-lg"><Icon name="error" className="text-error" /></span>
        <div className="cond text-sm font-extrabold text-[#FCA5A5] tracking-[.1em] uppercase">LOCKED - {disputes.length} Dispute{disputes.length > 1 ? "s" : ""}</div>
      </div>
      {disputes.map(function(d, i) {
        return (
          <div key={d.target + '-' + d.placement} className="text-[13px] text-[#FCA5A5] mb-2 px-3 py-2.5 bg-black/[.35] rounded-lg">
            <div className="flex justify-between gap-2 flex-wrap">
              <div>
                <span className="font-bold text-on-surface">{d.target}</span> {"->"} <span className="text-primary font-bold">#{d.placement}</span>
                <div className="mt-[3px] text-[#FECACA] text-xs">"{d.reason}"</div>
              </div>
              {isAdmin && (
                <div className="flex gap-1.5 shrink-0">
                  <Btn s="sm" v="success" onClick={function() { onResolve(i, "accept"); }}>
                    <Icon name="check" className="text-sm" /> Accept
                  </Btn>
                  <Btn s="sm" v="danger" onClick={function() { onResolve(i, "override"); }}>Override</Btn>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- PlacementBoard ----

function PlacementBoard(props) {
  var roster = props.roster;
  var results = props.results;
  var onPlace = props.onPlace;
  var locked = props.locked;
  var onFlag = props.onFlag;
  var isAdmin = props.isAdmin;
  var _d = useState(null);
  var disputeTarget = _d[0];
  var setDisputeTarget = _d[1];
  var used = new Set(Object.values(results));
  var placed = Object.keys(results).length;
  var allSet = placed === roster.length;

  return (
    <div>
      {disputeTarget && (
        <FileDisputeModal targetPlayer={disputeTarget.name} claimPlacement={results[disputeTarget.id]}
          onSubmit={function(d) { if (onFlag) onFlag(d); }} onClose={function() { setDisputeTarget(null); }} />
      )}
      <div className="flex justify-between items-center mb-2.5">
        <span className="cond text-[10px] font-bold text-muted tracking-[.12em] uppercase">Placements</span>
        <span className="mono text-xs" style={{ color: allSet ? "#6EE7B7" : "#BECBD9" }}>
          <span className="font-bold" style={{ color: allSet ? "#6EE7B7" : "#E8A838" }}>{placed}</span>/{roster.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {roster.map(function(p) {
          var got = results[p.id];
          var isWin = got === 1;
          var isTop4 = got && got <= 4;
          return (
            <div key={p.id} className="rounded-lg px-3 py-2.5 transition-all duration-150" style={{
              background: got ? (isWin ? "rgba(232,168,56,.08)" : isTop4 ? "rgba(78,205,196,.05)" : "rgba(255,255,255,.02)") : "rgba(255,255,255,.02)",
              border: "1px solid " + (got ? (isWin ? "rgba(232,168,56,.35)" : isTop4 ? "rgba(78,205,196,.2)" : "rgba(242,237,228,.08)") : "rgba(242,237,228,.08)")
            }}>
              <div className={"flex items-center gap-2 " + (locked ? "" : "mb-2.5")}>
                {got && <div className="mono text-2xl font-bold leading-none min-w-[22px] text-center" style={{ color: isWin ? "#E8A838" : isTop4 ? "#4ECDC4" : "#BECBD9" }}>{got}</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</div>
                  <div className="flex gap-[5px] mt-0.5"></div>
                </div>
                {got && !locked && (
                  <button onClick={function() { setDisputeTarget(p); }} className="bg-error/[0.12] border border-error/35 rounded-lg px-2.5 py-[5px] text-xs text-error cursor-pointer font-bold shrink-0 min-h-[34px]">FLAG</button>
                )}
              </div>
              {!locked && (
                <div className="grid grid-cols-8 gap-[3px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(function(place) {
                    var isMe = got === place;
                    var taken = !isMe && used.has(place);
                    var isTop = place <= 4;
                    return (
                      <button key={place} className="place-btn" onClick={taken ? undefined : function() { onPlace(p.id, place); }}
                        style={{
                          background: isMe ? (place === 1 ? "#E8A838" : isTop ? "#4ECDC4" : "#8896A8") : "#1A1F2E",
                          color: isMe ? "#08080F" : (taken ? "#7A8BA0" : isTop ? "#C8D4E0" : "#BECBD9"),
                          opacity: taken ? .18 : 1, cursor: taken ? "not-allowed" : "pointer"
                        }}>
                        {place}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Summary strip */}
      <div className="grid grid-cols-8 gap-0.5 mt-2.5 pt-2.5 border-t border-on-surface/[.06]">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(function(place) {
          var who = roster.find(function(p) { return results[p.id] === place; });
          return (
            <div key={place} className="bg-surface-container-lowest rounded px-[3px] py-1 text-center">
              <div className="mono text-[9px] font-bold" style={{ color: place === 1 ? "#E8A838" : place <= 4 ? "#4ECDC4" : "#9AAABF" }}>{place}</div>
              <div className="text-[9px] overflow-hidden text-ellipsis whitespace-nowrap mt-px" style={{ color: who ? "#C8BFB0" : "#7A8BA0" }}>{who ? who.name.substring(0, 5) : "-"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- ResultSubmitModal ----

function ResultSubmitModal(props) {
  var lobby = props.lobby;
  var playerList = lobby.players || lobby.roster || [];
  var initRankings = playerList.map(function(p, i) { return { player: p, position: i + 1 }; });
  var _s = useState(initRankings);
  var rankings = _s[0];
  var setRankings = _s[1];

  function handlePositionChange(playerIndex, newPosition) {
    setRankings(function(prev) {
      return prev.map(function(r, i) {
        if (i === playerIndex) return Object.assign({}, r, { position: parseInt(newPosition) });
        return r;
      });
    });
  }

  var positions = rankings.map(function(r) { return r.position; });
  var seen = {};
  var hasDuplicates = false;
  positions.forEach(function(p) {
    if (seen[p]) hasDuplicates = true;
    seen[p] = true;
  });

  return (
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center"
      style={{ background: "rgba(8,8,15,.85)", backdropFilter: "blur(8px)" }}
      onClick={props.onClose}
    >
      <div
        className="rounded-xl p-6 overflow-y-auto bg-[#111827] border border-secondary/20 w-[90%] max-w-[420px] max-h-[80vh]"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <h3 className="font-editorial mb-4 text-on-surface">Submit Results</h3>
        {rankings.map(function(r, i) {
          var isDup = positions.filter(function(p) { return p === r.position; }).length > 1;
          return (
            <div key={r.player.username || r.player.name || r.player} className="flex items-center gap-2.5 mb-2">
              <span className="flex-1 text-[13px] text-on-surface">{r.player.username || r.player.name || r.player}</span>
              <select
                value={r.position}
                onChange={function(e) { handlePositionChange(i, e.target.value); }}
                className={"px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border text-[13px] " + (isDup ? "border-error text-error" : "border-on-surface/10 text-on-surface")}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(function(pos) {
                  return <option key={pos} value={pos}>{ordinal(pos)}</option>;
                })}
              </select>
            </div>
          );
        })}
        {hasDuplicates && (
          <div className="text-error text-xs mt-2 flex items-center gap-1">
            <span>Each player must have a unique placement</span>
          </div>
        )}
        <div className="flex gap-[10px] mt-4">
          <Btn v="primary" disabled={hasDuplicates} onClick={function() { if (!hasDuplicates) props.onSubmit(rankings); }}>Submit</Btn>
          <Btn v="ghost" onClick={props.onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// ---- ConfirmResultsModal ----

function ConfirmResultsModal(props) {
  var submission = props.submission;
  return (
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center"
      style={{ background: "rgba(8,8,15,.85)", backdropFilter: "blur(8px)" }}
      onClick={props.onClose}
    >
      <div
        className="rounded-xl p-6 bg-[#111827] border border-tertiary/20 w-[90%] max-w-[420px]"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <h3 className="font-editorial mb-1 text-on-surface">Confirm Results?</h3>
        <p className="text-xs mb-4 text-on-surface-variant">{"Submitted by " + (submission.submittedBy || "unknown")}</p>
        {(submission.rankings || []).map(function(r, i) {
          return (
            <div key={r.player.username || r.player.name || r.player} className="flex items-center gap-2.5 py-1.5 border-b border-on-surface/[.04]">
              <span className="text-xs font-bold w-7" style={{ color: i < 3 ? ["#E8A838", "#C0C0C0", "#CD7F32"][i] : "#BECBD9" }}>{ordinal(r.position)}</span>
              <span className="text-[13px] text-on-surface">{r.player.username || r.player.name || r.player}</span>
            </div>
          );
        })}
        <div className="flex gap-2.5 mt-4">
          <Btn v="primary" onClick={props.onConfirm}><Icon name="check" className="mr-1" />Confirm</Btn>
          <Btn v="ghost" className="border-error/30 text-error" onClick={props.onDispute}><Icon name="flag" className="mr-1" />Dispute</Btn>
        </div>
      </div>
    </div>
  );
}

// ---- LobbyCard ----

function LobbyCard(props) {
  var roster = props.roster;
  var round = props.round;
  var isFinals = props.isFinals;
  var onSubmit = props.onSubmit;
  var toast = props.toast;
  var isAdmin = props.isAdmin;
  var paused = props.paused;
  var lobbyNum = props.lobbyNum;
  var _r = useState({});
  var results = _r[0];
  var setResults = _r[1];
  var _l = useState(false);
  var locked = _l[0];
  var setLocked = _l[1];
  var _dp = useState([]);
  var disputes = _dp[0];
  var setDisputes = _dp[1];
  var allPlaced = roster.length > 0 && Object.keys(results).length === roster.length;
  var canLock = allPlaced && disputes.length === 0 && !locked && !paused;
  var host = roster[0];

  function lockResults() {
    if (!allPlaced) { toast("Assign all placements first", "error"); return; }
    if (disputes.length > 0) { toast("Resolve disputes first", "error"); return; }
    setLocked(true);
    onSubmit(results, lobbyNum || 0);
    toast((isFinals ? "Finals" : "Round " + round + (lobbyNum !== undefined ? " Lobby " + (lobbyNum + 1) : "")) + " locked!", "success");
  }

  var lbl = isFinals ? "F" : lobbyNum !== undefined ? "L" + (lobbyNum + 1) : "R" + round;

  return (
    <Panel glow={!locked} style={{ border: locked ? "1px solid rgba(82,196,124,.3)" : undefined, animation: locked ? "lock-flash .9s ease" : undefined }}>
      <div className="px-3.5 py-3 bg-[#0A0F1A] border-b border-on-surface/[.07] flex justify-between items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-xs font-extrabold font-mono shrink-0" style={{
            background: locked ? "rgba(82,196,124,.1)" : "rgba(232,168,56,.1)",
            border: "1px solid " + (locked ? "rgba(82,196,124,.3)" : "rgba(232,168,56,.28)"),
            color: locked ? "#6EE7B7" : "#E8A838"
          }}>
            {lbl}
          </div>
          <div>
            <div className="font-bold text-sm text-on-surface">{isFinals ? "Grand Finals" : lobbyNum !== undefined ? "Lobby " + (lobbyNum + 1) + " - R" + round : "Round " + round}</div>
            <div className="text-xs text-muted">Host: <span className="text-primary font-semibold">{host && host.name ? host.name : "-"}</span></div>
          </div>
          {locked ? <Tag color="#52C47C"><Icon name="check_circle" className="text-[11px] mr-[3px]" />Locked</Tag>
            : paused ? <Tag color="#EAB308"><Icon name="pause" className="text-[11px] mr-[3px]" />Paused</Tag>
            : <div className="inline-flex items-center gap-[5px] px-2 py-[3px] bg-[rgba(82,196,124,.08)] border border-[rgba(82,196,124,.25)] rounded-full"><Dot /><span className="cond text-[9px] font-bold text-success tracking-[.1em] uppercase">Live</span></div>
          }
        </div>
      </div>
      <div className="p-3.5">
        <DisputeBanner disputes={disputes} onResolve={function(idx, action) { setDisputes(function(d) { return d.filter(function(_, i) { return i !== idx; }); }); toast(action === "accept" ? "Result stands" : "Override applied", "success"); }} isAdmin={isAdmin} />
        <PlacementBoard roster={roster} results={results}
          onPlace={function(pid, place) { if (!locked && !paused) setResults(function(r) { return Object.assign({}, r, { [pid]: place }); }); }}
          locked={locked} onFlag={function(d) { setDisputes(function(ds) { return [].concat(ds, [d]); }); }} isAdmin={isAdmin} />
        {!locked && (
          <div className="mt-3.5">
            <Btn v="primary" full disabled={!canLock} onClick={lockResults} s="lg">
              {disputes.length > 0 ? "Resolve Disputes First" : paused ? "Paused" : !allPlaced ? "Waiting for all placements..." : "Lock Results"}
            </Btn>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ---- StandingsTable ----

function StandingsTable(props) {
  var rows = props.rows;
  var compact = props.compact;
  var onRowClick = props.onRowClick;
  var myName = props.myName;
  var seasonConfig = props.seasonConfig;
  var _sk = useState("pts");
  var sortKey = _sk[0];
  var setSortKey = _sk[1];
  var _a = useState(false);
  var asc = _a[0];
  var setAsc = _a[1];

  function toggle(k) {
    if (sortKey === k) setAsc(function(a) { return !a; });
    else { setSortKey(k); setAsc(false); }
  }

  var useEffective = seasonConfig && (seasonConfig.dropWeeks > 0 || seasonConfig.finalBoost > 1.0);
  var sorted = [].concat(rows).sort(function(a, b) {
    if (sortKey === "pts" && useEffective) {
      var ea = effectivePts(a, seasonConfig);
      var eb = effectivePts(b, seasonConfig);
      if (ea !== eb) return asc ? ea - eb : eb - ea;
      return tiebreaker(a, b);
    }
    var va = parseFloat(a[sortKey]) || 0;
    var vb = parseFloat(b[sortKey]) || 0;
    return asc ? va - vb : vb - va;
  });

  var maxPts = Math.max.apply(null, rows.map(function(r) { return r.pts || 0; }).concat([1]));

  var cols = compact ? "28px 1fr 60px 55px 50px 50px" : "28px 1fr 70px 70px 50px 55px 110px";

  function HeaderCell(hProps) {
    var k = hProps.k;
    var label = hProps.label;
    return (
      <span onClick={function() { toggle(k); }} className={"cond text-[10px] font-bold tracking-[.1em] uppercase cursor-pointer select-none whitespace-nowrap " + (sortKey === k ? "text-primary" : "text-on-surface-variant")}>
        {label}{sortKey === k ? (asc ? " \u2191" : " \u2193") : ""}
      </span>
    );
  }

  return (
    <Panel className="overflow-x-auto">
      <div className="standings-table-wrap" style={{ minWidth: compact ? 260 : 380 }}>
        <div className="px-3.5 py-[9px] border-b border-on-surface/[.07] bg-[#0A0F1A]" style={{ display: "grid", gridTemplateColumns: cols }}>
          <span className="cond text-[10px] font-bold text-on-surface-variant tracking-[.1em]">#</span>
          <HeaderCell k="name" label="Player" /><HeaderCell k="pts" label="Pts" /><HeaderCell k="avg" label="Avg" /><HeaderCell k="games" label="G" />
          {!compact && <HeaderCell k="wins" label="W" />}
          <span className="cond text-[10px] font-bold text-on-surface-variant tracking-[.1em]">Trend</span>
        </div>
        {sorted.map(function(p, i) {
          var avg = parseFloat(p.avg) || 0;
          var top3 = i < 3;
          var top8 = i < 8 && i >= 3;
          var isMe = myName && p.name === myName;
          var rankCol = i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : top8 ? "#BECBD9" : "#8E9BB0";
          var rowBg = isMe ? "rgba(155,114,207,.12)" : i === 0 ? "rgba(232,168,56,.11)" : i === 1 ? "rgba(192,192,192,.07)" : i === 2 ? "rgba(205,127,50,.07)" : top8 ? "rgba(255,255,255,.025)" : "transparent";
          var rowBorder = isMe ? "rgba(155,114,207,.5)" : i === 0 ? "rgba(232,168,56,.35)" : i === 1 ? "rgba(192,192,192,.2)" : i === 2 ? "rgba(205,127,50,.2)" : top8 ? "rgba(242,237,228,.06)" : "transparent";
          var nameCol = top3 ? "#F2EDE4" : top8 ? "#C8BFB0" : "#BECBD9";
          var ptsCol = top3 ? "#E8A838" : top8 ? "#B8A878" : "#BECBD9";

          var tierLine = null;
          for (var ti = 0; ti < TIER_THRESHOLDS.length; ti++) {
            if (i === TIER_THRESHOLDS[ti].maxRank && i > 0) {
              var tColor = TIER_THRESHOLDS[ti].color;
              var tName = TIER_THRESHOLDS[ti].name;
              tierLine = (
                <div key={"tier-" + i} className="flex items-center gap-2 px-[14px] my-1">
                  <div className="flex-1 h-px opacity-40" style={{ background: tColor }} />
                  <span className="cond text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: tColor }}>{tName}</span>
                  <div className="flex-1 h-px opacity-40" style={{ background: tColor }} />
                </div>
              );
              break;
            }
          }

          var sparkData = (p.clashHistory || []).slice(-5).map(function(c) { return c.placement || 4; });
          var deltaNode = p.last_clash_rank ? (
            <span className="ml-1 text-[10px] font-bold" style={{ color: p.last_clash_rank > (i + 1) ? "#6EE7B7" : p.last_clash_rank < (i + 1) ? "#F87171" : "#9AAABF" }}>
              <Icon name={p.last_clash_rank > (i + 1) ? "arrow_upward" : "arrow_downward"} className="text-[9px]" />
              {" " + Math.abs(p.last_clash_rank - (i + 1))}
            </span>
          ) : null;

          var rowEl = (
            <div key={p.id} id={isMe ? "lb-me-row" : undefined} onClick={onRowClick ? function() { onRowClick(p); } : undefined}
              className={"standings-row stagger-row" + (i === 0 ? " standings-row-1 shimmer-card row-champion" : i === 1 ? " standings-row-2" : i === 2 ? " standings-row-3" : "") + (isMe ? " standings-row-me" : "")}
              style={{
                display: "grid", gridTemplateColumns: cols,
                padding: top3 ? "14px 14px" : "10px 14px", borderBottom: "1px solid rgba(242,237,228,.04)",
                background: rowBg, border: "1px solid " + rowBorder, borderRadius: top3 ? 8 : 0, marginBottom: top3 ? 3 : 0,
                alignItems: "center", cursor: onRowClick ? "pointer" : "default", opacity: i >= 8 ? .55 : 1,
                borderLeft: isMe ? "3px solid #9B72CF" : "3px solid transparent",
                animationDelay: (i * 0.03) + "s",
                boxShadow: i === 0 ? "0 4px 20px rgba(232,168,56,.1),inset 0 1px 0 rgba(232,168,56,.08)" : isMe ? "0 2px 12px rgba(155,114,207,.08)" : "none"
              }}>
              <div className="mono rank-num flex items-center justify-center min-w-[24px] text-center" style={{
                fontSize: top3 ? 18 : 13, fontWeight: 900, color: rankCol,
                textShadow: i === 0 ? "0 0 18px rgba(232,168,56,.8)" : i === 1 ? "0 0 12px rgba(192,192,192,.6)" : i === 2 ? "0 0 12px rgba(205,127,50,.6)" : "none"
              }}>
                {i < 3 ? <Icon name="military_tech" style={{ color: rankCol }} /> : i + 1}
                {deltaNode}
              </div>
              <div className="flex items-center gap-[9px] min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-[5px] overflow-hidden" style={{ fontWeight: top3 ? 700 : 500, fontSize: top3 ? 15 : 13, color: nameCol }}>
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
                    {p.plan === "pro" && <span className="text-[9px] font-extrabold text-primary bg-primary/[.15] px-[5px] py-px rounded shrink-0 tracking-[.04em]">PRO</span>}
                    {p.plan === "host" && <span className="text-[9px] font-extrabold text-secondary bg-secondary/[.15] px-[5px] py-px rounded shrink-0 tracking-[.04em]">HOST</span>}
                    {isHotStreak(p) && <span title={"Win streak: " + (p.currentStreak || 0)} className="shrink-0 text-sm cursor-default"><Icon name="local_fire_department" style={{ color: "#F97316" }} /></span>}
                    {isOnTilt(p) && <span title={"Cold streak: " + (p.tiltStreak || 0)} className="shrink-0 text-sm cursor-default"><Icon name="ac_unit" style={{ color: "#38BDF8" }} /></span>}
                  </div>
                  {!compact && <div className="flex items-center gap-1 mt-0.5">
                    <ClashRankBadge xp={estimateXp(p)} size="sm" />
                    <span className="mono text-[11px] text-[#B8C8D8] overflow-hidden text-ellipsis whitespace-nowrap">{p.riotId}</span>
                  </div>}
                </div>
              </div>
              <div className="mono pts-glow count-up font-extrabold leading-none" style={{ fontSize: top3 ? 22 : 15, color: ptsCol, textShadow: top3 ? "0 0 14px currentColor" : "none", animationDelay: (i * 0.03 + 0.1) + "s" }}>
                {useEffective ? effectivePts(p, seasonConfig) : p.pts}
              </div>
              <AvgBadge avg={avg > 0 ? avg : null} />
              <div className="mono text-[11px]" style={{ color: top8 ? "#BECBD9" : "#9AAABF" }}>{p.games || 0}</div>
              {!compact && <div className="mono text-[13px]" style={{ color: top3 ? "#6EE7B7" : top8 ? "#6EE7B7" : "#8896A8" }}>{p.wins || 0}</div>}
              <div className="flex items-center gap-1.5">
                {sparkData.length >= 2 ? <Sparkline data={sparkData} w={50} h={16} color="#9B72CF" /> : null}
                <FormDots history={(p.clashHistory || []).slice(-5)} />
              </div>
            </div>
          );

          return <React.Fragment key={"frag-" + i}>{tierLine}{rowEl}</React.Fragment>;
        })}
        {rows.length === 0 && <div className="text-center p-10 text-[#8E9BB0] text-sm">No data yet</div>}
      </div>
    </Panel>
  );
}

var MemoStandingsTable = memo(StandingsTable);

// ---- LiveStandingsTable ----

function LiveStandingsTable(props) {
  var standings = props.standings || [];
  if (standings.length === 0) return null;
  return (
    <div className="rounded-xl overflow-hidden mx-4 mb-5 bg-[rgba(8,8,15,.6)] border border-on-surface/[.06]">
      <div className="grid px-3.5 py-2 font-label text-[10px] uppercase tracking-[.06em] text-on-surface-variant border-b border-on-surface/[.04]" style={{ gridTemplateColumns: "36px 1fr 60px 50px" }}>
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Pts</span>
        <span className="text-right">Delta</span>
      </div>
      {standings.map(function(p, i) {
        var isFirst = i === 0;
        var delta = p.delta || 0;
        var posChange = p.posChange || 0;
        return (
          <div
            key={p.id || p.username || p.name}
            className="fade-up grid px-[14px] py-[10px] text-[13px]"
            style={{
              gridTemplateColumns: "36px 1fr 60px 50px",
              background: isFirst ? "rgba(232,168,56,.04)" : "transparent",
              borderLeft: isFirst ? "3px solid #E8A838" : "3px solid transparent",
              animationDelay: (i * 0.05) + "s",
            }}
          >
            <span className={isFirst ? "text-primary font-bold" : "text-muted"}>
              {isFirst ? "\ud83d\udc51" : String(i + 1)}
            </span>
            <span className={"flex items-center gap-1.5 text-on-surface " + (isFirst ? "font-bold" : "font-medium")}>
              {p.username || p.name}
              {posChange !== 0 ? (
                <span className="text-[10px]" style={{ color: posChange > 0 ? "#6EE7B7" : "#F87171" }}>
                  {posChange > 0 ? "\u25b2" + posChange : "\u25bc" + Math.abs(posChange)}
                </span>
              ) : null}
            </span>
            <span className={"text-right font-bold " + (isFirst ? "text-primary" : "text-on-surface")}>{p.points || 0}</span>
            <span className="text-right text-[12px]" style={{ color: delta > 0 ? "#6EE7B7" : delta < 0 ? "#F87171" : "#9AAABF" }}>
              {delta > 0 ? "+" + delta : delta === 0 ? "-" : String(delta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---- YourFinishCard ----

function YourFinishCard(props) {
  var currentUser = props.currentUser;
  var finalStandings = props.finalStandings;
  if (!currentUser || !finalStandings || finalStandings.length === 0) return null;
  var found = null;
  for (var i = 0; i < finalStandings.length; i++) {
    if (finalStandings[i].username === currentUser.username || finalStandings[i].name === currentUser.username) {
      found = finalStandings[i];
      found.position = i + 1;
      break;
    }
  }
  if (!found) return null;
  var medals = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"];
  var posChange = found.posChange || 0;
  return (
    <div
      className="fade-up rounded-xl px-5 py-4 mx-4 mb-5 flex items-center justify-between"
      style={{
        background: "rgba(155,114,207,.06)",
        border: "1px solid rgba(155,114,207,.25)",
        borderLeft: "4px solid #9B72CF",
      }}
    >
      <div>
        <div className="font-label text-[10px] uppercase tracking-[.1em] mb-1 text-on-surface-variant">Your Finish</div>
        <div className="font-editorial text-[24px] font-black text-secondary">
          {found.position <= 3 ? (medals[found.position - 1] + " ") : ""}
          {"#" + found.position}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[22px] font-bold text-primary">{(found.points || found.pts || 0) + " pts"}</div>
        {posChange !== 0 ? (
          <div className="text-[11px]" style={{ color: posChange > 0 ? "#6EE7B7" : "#F87171" }}>
            {posChange > 0 ? "\u25b2 " + posChange + " from last clash" : "\u25bc " + Math.abs(posChange) + " from last clash"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---- LiveStandingsPanel ----

function LiveStandingsPanel(props) {
  var checkedIn = props.checkedIn;
  var tournamentState = props.tournamentState;
  var lobbies = props.lobbies;
  var round = props.round;
  var clashId = tournamentState && tournamentState.clashId ? tournamentState.clashId : "";
  var cutLine = tournamentState && tournamentState.cutLine ? tournamentState.cutLine : 0;
  var cutAfterGame = tournamentState && tournamentState.cutAfterGame ? tournamentState.cutAfterGame : 0;
  var showCutLine = cutLine > 0 && cutAfterGame > 0 && round >= cutAfterGame;
  var totalGames = tournamentState && tournamentState.totalGames ? tournamentState.totalGames : 4;

  var liveRows = checkedIn.map(function(p) {
    var earned = 0;
    var gamesPlayed = 0;
    (p.clashHistory || []).forEach(function(h) { if (h.clashId === clashId) { earned += (PTS[h.place || h.placement] || 0); gamesPlayed += 1; } });
    return { name: p.name, id: p.id, earned: earned, gamesPlayed: gamesPlayed };
  }).sort(function(a, b) { return b.earned - a.earned; });

  var lockedCount = tournamentState && tournamentState.lockedLobbies ? tournamentState.lockedLobbies.length : 0;

  return (
    <Panel className="p-5 mt-6">
      <div className="font-bold text-sm text-primary mb-1 flex items-center gap-2">
        <span className="text-base"><Icon name="bar_chart" /></span> Live Standings - Game {round}/{totalGames}
        <span className="text-[11px] text-muted font-normal ml-1">({lockedCount} of {lobbies.length} {lobbies.length === 1 ? "lobby" : "lobbies"} locked)</span>
      </div>
      {showCutLine && (
        <div className="text-[11px] text-primary mb-2.5 px-2.5 py-1 bg-primary/[.06] rounded border border-primary/[.12]">Cut line: {cutLine} pts - players at or below are eliminated after Game {cutAfterGame}</div>
      )}
      <div className="flex flex-col gap-1">
        {liveRows.map(function(row, ri) {
          var isLeader = ri === 0 && row.earned > 0;
          var belowCut = showCutLine && row.earned <= cutLine;
          var nearCut = showCutLine && !belowCut && row.earned <= cutLine + 3;
          return (
            <div key={row.id} className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md" style={{
              background: belowCut ? "rgba(248,113,113,.06)" : isLeader ? "rgba(232,168,56,.07)" : ri % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent",
              border: belowCut ? "1px solid rgba(248,113,113,.2)" : isLeader ? "1px solid rgba(232,168,56,.18)" : "1px solid transparent", opacity: belowCut ? 0.6 : 1
            }}>
              <span className="mono text-xs font-bold min-w-[22px] text-center" style={{ color: belowCut ? "#F87171" : ri === 0 ? "#E8A838" : ri === 1 ? "#C0C0C0" : ri === 2 ? "#CD7F32" : "#9AAABF" }}>{ri + 1}</span>
              <span className="flex-1 text-[13px]" style={{ fontWeight: isLeader ? 700 : 500, color: belowCut ? "#F87171" : isLeader ? "#E8A838" : "#F2EDE4" }}>{row.name}</span>
              {belowCut && <span className="text-[9px] font-bold text-error bg-error/[.12] border border-error/25 rounded px-1.5 py-px uppercase">Cut</span>}
              {nearCut && <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-px">Bubble</span>}
              <span className="mono text-[13px] font-bold" style={{ color: belowCut ? "#F87171" : row.earned > 0 ? "#6EE7B7" : "#9AAABF" }}>{row.earned > 0 ? "+" + row.earned : " - "} pts</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---- ClashReport ----

function ClashReport(props) {
  var clashData = props.clashData;
  var players = props.players;
  var allP = players.length > 0 ? players : [];
  var report = clashData.report;

  var playerData = allP.map(function(p) {
    var entry = (p.clashHistory || []).find(function(h) { return h.clashId === clashData.id || h.name === clashData.name; });
    return Object.assign({}, p, { entry: entry });
  }).filter(function(p) { return p.entry; });

  var sorted = [].concat(playerData).sort(function(a, b) { return (a.entry.place || a.entry.placement) - (b.entry.place || b.entry.placement); });
  var mostImproved = report && report.mostImproved ? report.mostImproved : null;
  var biggestUpset = report && report.biggestUpset ? report.biggestUpset : null;

  if (sorted.length === 0) return (
    <div className="p-5 text-muted text-sm text-center">No detailed data for this clash yet.</div>
  );

  return (
    <div>
      <div className="overflow-x-auto mb-5">
        <table className="w-full border-collapse min-w-[420px]">
          <thead>
            <tr className="bg-[#0A0F1A]">
              {["#", "Player", "R1", "R2", "R3", "Finals", "Clash Pts"].map(function(h) {
                return (
                  <th key={h} className={"cond px-3 py-[9px] text-[10px] font-bold text-on-surface-variant tracking-[.1em] uppercase border-b border-on-surface/[.07] " + (h === "Player" ? "text-left" : "text-center")}>{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(function(p, i) {
              var rp = p.entry && p.entry.roundPlacements ? p.entry.roundPlacements : {};
              var clashPts = (p.entry && p.entry.clashPts) || (p.entry && p.entry.pts) || 0;
              return (
                <tr key={p.id} className="border-b border-on-surface/[.04]" style={{ background: i === 0 ? "rgba(232,168,56,.04)" : i % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent" }}>
                  <td className="mono px-3 py-[11px] text-center text-[13px] font-extrabold" style={{ color: i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#9AAABF" }}>{i + 1}</td>
                  <td className="px-3 py-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[13px] text-on-surface">{p.name}</span>
                      {p.name === mostImproved && <Tag color="#52C47C" size="sm"><Icon name="trending_up" className="mr-[3px]" />Improved</Tag>}
                    </div>
                  </td>
                  {["r1", "r2", "r3", "finals"].map(function(rk) {
                    var v = rp[rk];
                    return (
                      <td key={rk} className="px-2 py-[11px] text-center">
                        {v ? <span className="mono text-[13px] font-bold" style={{ color: v === 1 ? "#E8A838" : v <= 4 ? "#4ECDC4" : "#F87171" }}>#{v}</span> : <span className="text-on-surface-variant text-xs">-</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-[11px] text-center">
                    <span className="mono text-sm font-bold text-primary">+{clashPts}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mostImproved && (
          <Panel className="p-3.5 border border-[rgba(82,196,124,.25)]">
            <div className="flex items-center gap-2.5">
              <span className="text-[22px]"><Icon name="trending_up" /></span>
              <div>
                <div className="font-bold text-sm text-success">Most Improved</div>
                <div className="font-bold text-on-surface text-[13px]">{mostImproved}</div>
                <div className="text-[11px] text-muted">Above their season average</div>
              </div>
            </div>
          </Panel>
        )}
        {biggestUpset && (
          <Panel className="p-3.5 border border-secondary/25">
            <div className="flex items-center gap-2.5">
              <span className="text-[22px]"><Icon name="target" /></span>
              <div>
                <div className="font-bold text-sm text-[#C4B5FD]">Biggest Upset</div>
                <div className="font-bold text-on-surface text-[13px] leading-snug">{biggestUpset}</div>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ---- ResultsScreen (internal, used by ClashScreen) ----

function ResultsScreen(props) {
  var players = props.players;
  var toast = props.toast;
  var setScreen = props.setScreen;
  var setProfilePlayer = props.setProfilePlayer;
  var tournamentState = props.tournamentState;
  var pastClashes = props.pastClashes || [];
  var sorted = [].concat(players).sort(function(a, b) { return b.pts - a.pts; });
  var champ = sorted[0];
  var _t = useState("results");
  var tab = _t[0];
  var setTab = _t[1];
  var awards = computeClashAwards(players.length > 0 ? players : sorted);
  var CLASH_NAME = (tournamentState && tournamentState.clashName) || "Recent Clash";
  var CLASH_DATE = (tournamentState && tournamentState.clashDate) || "";
  var MEDALS = ["military_tech", "military_tech", "military_tech"];
  var PODIUM_COLS = ["#E8A838", "#C0C0C0", "#CD7F32"];

  if (!champ) return <div className="text-center text-on-surface-variant pt-16">Complete a clash first!</div>;

  var top3 = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  var REWARDS = ["Clash Crown", "Icon", "Frame", "Loot Orb", "Loot Orb", "", "", ""];

  function shareDiscord() {
    var lines = [
      "**TFT Clash S1 - " + CLASH_NAME + " Results**",
      "```",
    ];
    sorted.slice(0, 8).forEach(function(p, i) {
      lines.push("#" + (i + 1) + " " + p.name.padEnd(16) + " " + String(p.pts).padStart(4) + "pts  avg " + getStats(p).avgPlacement);
    });
    lines.push("```");
    lines.push("Champion: **" + champ.name + "**    " + champ.pts + "pts");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(lines.join("\n")).then(function() { toast("Copied for Discord", "success"); }).catch(function() { toast("Copy failed", "error"); });
    }
  }

  function downloadCard() {
    var canvas = document.createElement("canvas");
    canvas.width = 900; canvas.height = 520;
    var ctx = canvas.getContext("2d");
    var bg = ctx.createLinearGradient(0, 0, 900, 520);
    bg.addColorStop(0, "#0A0F1A"); bg.addColorStop(1, "#08080F");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 900, 520);
    var gold = ctx.createLinearGradient(0, 0, 900, 0);
    gold.addColorStop(0, "#E8A838"); gold.addColorStop(0.5, "#FFD700"); gold.addColorStop(1, "#E8A838");
    ctx.fillStyle = gold; ctx.fillRect(0, 0, 900, 3);
    ctx.font = "bold 13px monospace"; ctx.fillStyle = "#E8A838"; ctx.letterSpacing = "4px";
    ctx.fillText("TFT CLASH S1 - FINAL RESULTS", 40, 44); ctx.letterSpacing = "0px";
    ctx.font = "11px monospace"; ctx.fillStyle = "#BECBD9";
    ctx.fillText(CLASH_DATE + "  -  " + sorted.length + " players", 40, 64);
    ctx.fillStyle = "rgba(232,168,56,0.1)";
    ctx.beginPath(); ctx.roundRect(40, 85, 820, 100, 8); ctx.fill();
    ctx.strokeStyle = "rgba(232,168,56,0.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = "bold 40px serif"; ctx.fillStyle = "#E8A838"; ctx.fillText("W", 55, 152);
    ctx.font = "bold 28px serif"; ctx.fillStyle = "#F2EDE4"; ctx.fillText(champ.name, 110, 150);
    ctx.font = "bold 22px monospace"; ctx.fillStyle = "#E8A838"; ctx.fillText(champ.pts + " pts", 110, 174);
    ctx.font = "11px monospace"; ctx.fillStyle = "#BECBD9"; ctx.fillText("Champion - AVP: " + getStats(champ).avgPlacement, 110, 194);
    sorted.slice(0, 8).forEach(function(p, i) {
      var x = 40 + (i > 3 ? 440 : 0);
      var iy = i > 3 ? i - 4 : i;
      var c2 = i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#BECBD9";
      ctx.font = "bold 14px monospace"; ctx.fillStyle = c2; ctx.fillText("#" + (i + 1), x, 210 + iy * 36);
      ctx.font = "14px sans-serif"; ctx.fillStyle = i < 3 ? "#F2EDE4" : "#C8D4E0"; ctx.fillText(p.name, x + 36, 210 + iy * 36);
      ctx.font = "bold 14px monospace"; ctx.fillStyle = "#E8A838"; ctx.fillText(p.pts + "pts", x + 200, 210 + iy * 36);
      var av = getStats(p).avgPlacement;
      ctx.font = "12px monospace"; ctx.fillStyle = parseFloat(av) < 3 ? "#4ade80" : parseFloat(av) < 5 ? "#facc15" : "#f87171";
      ctx.fillText("avg:" + av, x + 280, 210 + iy * 36);
    });
    ctx.fillStyle = "rgba(232,168,56,0.15)"; ctx.fillRect(0, 488, 900, 32);
    ctx.font = "bold 11px monospace"; ctx.fillStyle = "#E8A838"; ctx.letterSpacing = "2px";
    ctx.fillText("TFT CLASH  -  tftclash.com", 40, 508); ctx.letterSpacing = "0px";
    ctx.font = "11px monospace"; ctx.fillStyle = "#BECBD9"; ctx.fillText("#TFTClash  #TFT", 700, 508);
    var a = document.createElement("a"); a.download = "TFTClash-Results.png"; a.href = canvas.toDataURL("image/png"); a.click();
    toast("Results card downloaded", "success");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <Btn v="dark" s="sm" onClick={function() { setScreen("home"); }}>{"<-"} Back</Btn>
        <div className="flex-1 min-w-0">
          <div className="cond text-[11px] font-bold text-secondary tracking-[.18em] uppercase mb-0.5">Season 1</div>
          <h1 className="font-editorial text-on-surface font-extrabold leading-none" style={{ fontSize: "clamp(22px,3.5vw,34px)" }}>{CLASH_NAME} - Final Results</h1>
          <div className="text-xs text-muted mt-[3px]">{CLASH_DATE} - {sorted.length} players - {Math.ceil(sorted.length / 8)} lobbies</div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Btn v="dark" s="sm" onClick={shareDiscord}>Discord</Btn>
          <Btn v="dark" s="sm" onClick={function() {
            shareToTwitter(buildShareText("recap", { winner: champ.name, clashName: CLASH_NAME }));
          }}><Icon name="share" className="mr-1" />Share</Btn>
          <Btn v="ghost" s="sm" onClick={downloadCard}><Icon name="download" className="text-xs mr-[3px]" />PNG</Btn>
          <Btn v="dark" s="sm" onClick={function() {
            var text = "TFT Clash Results\n" + CLASH_NAME + " - " + CLASH_DATE + "\n\n";
            sorted.slice(0, 8).forEach(function(p, i) { text += (i + 1) + ". " + p.name + " - " + p.pts + "pts (avg: " + getStats(p).avgPlacement + ")\n"; });
            text += "\n#TFTClash tftclash.com";
            navigator.clipboard.writeText(text).then(function() { toast("Results copied!", "success"); }).catch(function() { toast("Copy failed", "error"); });
          }}><Icon name="content_paste" className="mr-1" />Copy</Btn>
        </div>
      </div>

      {/* Champion banner */}
      <div className="relative overflow-hidden rounded-xl px-8 py-7 mb-6 flex items-center gap-6 flex-wrap" style={{
        background: "linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))",
        border: "1px solid rgba(232,168,56,.55)",
        boxShadow: "0 0 60px rgba(232,168,56,.18),inset 0 0 80px rgba(232,168,56,.04)"
      }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(232,168,56,.3),transparent)" }} />
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-[40px] shrink-0" style={{
          background: "linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))",
          border: "2px solid rgba(232,168,56,.7)", boxShadow: "0 0 24px rgba(232,168,56,.35)"
        }}>
          <Icon name="emoji_events" className="text-[40px] text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-primary tracking-[.16em] uppercase mb-1">
            <Icon name="emoji_events" className="text-[11px] text-primary mr-[3px]" />Clash Champion
          </div>
          <div className="font-editorial text-on-surface font-extrabold leading-none mb-1.5" style={{ fontSize: "clamp(26px,4vw,44px)" }}>{champ.name}</div>
          <div className="flex gap-2 flex-wrap">
            <Tag color="#E8A838" size="sm">{champ.rank}</Tag>
            <Tag color="#4ECDC4" size="sm">{champ.region}</Tag>
            {isHotStreak(champ) && <Tag color="#F97316" size="sm"><Icon name="local_fire_department" className="text-[11px] text-[#F97316] mr-[3px]" />{champ.currentStreak}-streak</Tag>}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[["Season Pts", champ.pts, "#E8A838"], ["Wins", champ.wins, "#6EE7B7"], ["Avg", getStats(champ).avgPlacement, avgCol(getStats(champ).avgPlacement)], ["Top4%", getStats(champ).top4Rate + "%", "#C4B5FD"]].map(function(item) {
            var l = item[0]; var v = item[1]; var c = item[2];
            return (
              <div key={l} className="text-center px-4 py-2.5 bg-black/30 rounded-lg min-w-[64px]">
                <div className="mono text-xl font-bold leading-none" style={{ color: c }}>{v}</div>
                <div className="text-[10px] text-muted font-semibold uppercase tracking-[.06em] mt-1">{l}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Podium - top 3 */}
      {sorted.length >= 3 && (
        <div className="podium-grid grid gap-2.5 mb-6 items-end" style={{ gridTemplateColumns: "1fr 1.1fr 1fr" }}>
          {top3.map(function(p, idx) {
            var actualRank = idx === 0 ? 1 : idx === 1 ? 0 : 2;
            var col = PODIUM_COLS[actualRank];
            var isGold = actualRank === 0;
            return (
              <div key={p.id} onClick={function() { setProfilePlayer(p); setScreen("profile"); }}
                className="rounded-xl px-3.5 text-center cursor-pointer" style={{
                  background: isGold ? "rgba(232,168,56,.08)" : "rgba(255,255,255,.02)",
                  border: "1px solid " + (isGold ? "rgba(232,168,56,.3)" : "rgba(255,255,255,.07)"),
                  borderTop: "3px solid " + col, paddingTop: isGold ? 28 : 20, paddingBottom: 20
                }}>
                <div className="text-[28px] mb-2"><Icon name={MEDALS[actualRank]} style={{ color: PODIUM_COLS[actualRank] }} /></div>
                <div className="font-editorial font-bold text-on-surface mb-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: isGold ? 17 : 14 }}>{p.name}</div>
                <div className="text-[11px] text-muted mb-2.5">{p.rank} - {p.region}</div>
                <div className="mono font-extrabold leading-none" style={{ fontSize: isGold ? 28 : 20, color: col }}>{p.pts}</div>
                <div className="text-[10px] text-muted font-bold tracking-[.08em] uppercase mt-[3px]">Season Pts</div>
                <div className="flex justify-center gap-2.5 mt-2.5">
                  {[["W", getStats(p).wins, "#6EE7B7"], ["Avg", getStats(p).avgPlacement, avgCol(getStats(p).avgPlacement)]].map(function(item) {
                    var l = item[0]; var v = item[1]; var c = item[2];
                    return (
                      <div key={l} className="text-center">
                        <div className="mono text-[13px] font-bold" style={{ color: c }}>{v}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase">{l}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab nav */}
      <PillTabGroup align="start" className="mb-[18px]">
        {[
          ["results", "Full Standings", "leaderboard"],
          ["awards", "Awards", "workspace_premium"],
          ["report", "Clash Report", "description"]
        ].map(function(item) {
          return (
            <PillTab
              key={item[0]}
              icon={item[2]}
              active={tab === item[0]}
              onClick={function() { setTab(item[0]); }}
            >
              {item[1]}
            </PillTab>
          );
        })}
      </PillTabGroup>

      {/* Full Standings */}
      {tab === "results" && (
        <Panel className="overflow-hidden">
          <div className="px-4 py-2.5 bg-black/30 border-b border-on-surface/[.08]" style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px 80px 70px 80px 110px" }}>
            {["#", "Player", "Pts", "Avg", "Wins", "T4%", "Reward"].map(function(h) {
              return <span key={h} className="cond text-[10px] font-bold text-on-surface-variant tracking-[.1em] uppercase">{h}</span>;
            })}
          </div>
          {sorted.map(function(p, i) {
            var st = getStats(p);
            var isTop3 = i < 3;
            var col = i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#BECBD9";
            return (
              <div key={p.id} onClick={function() { setProfilePlayer(p); setScreen("profile"); }}
                className="items-center cursor-pointer transition-colors duration-100 px-4 py-3 border-b border-on-surface/[.04]"
                style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 80px 80px 70px 80px 110px",
                  background: i === 0 ? "rgba(232,168,56,.05)" : i < 3 ? "rgba(255,255,255,.015)" : "transparent"
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = i === 0 ? "rgba(232,168,56,.09)" : "rgba(255,255,255,.04)"; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = i === 0 ? "rgba(232,168,56,.05)" : i < 3 ? "rgba(255,255,255,.015)" : "transparent"; }}>
                <div className="flex items-center gap-[3px]">
                  <span className="mono text-[13px] font-extrabold" style={{ color: col }}>{i + 1}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-[5px]" style={{ fontWeight: isTop3 ? 700 : 600, color: isTop3 ? "#F2EDE4" : "#C8BFB0" }}>
                      {p.name}
                      {HOMIES_IDS.includes(p.id) && <span className="text-[10px]"><Icon name="favorite" className="text-secondary" /></span>}
                      {isHotStreak(p) && <span className="text-[10px]"><Icon name="local_fire_department" style={{ color: "#F97316" }} /></span>}
                    </div>
                    <div className="flex items-center gap-[5px] flex-wrap">
                      <span className="text-[11px] text-muted">{p.rank} - {p.region}</span>
                      {(p.attendanceStreak || 0) >= 3 && <Tag color="#E8A838" size="sm">{p.attendanceStreak}-streak</Tag>}
                      {isComebackEligible(p, pastClashes.map(function(c) { return "c" + c.id; })) && <Tag color="#4ECDC4" size="sm">Comeback</Tag>}
                    </div>
                  </div>
                </div>
                <div className="mono text-[15px] font-bold" style={{ color: isTop3 ? col : "#C8BFB0" }}>{p.pts}</div>
                <AvgBadge avg={parseFloat(p.avg) || 0} />
                <div className="mono text-[13px] text-success">{st.wins}</div>
                <div className="mono text-[13px] text-tertiary">{st.top4Rate}%</div>
                <div className="text-xs">{REWARDS[i] ? <Tag color={col} size="sm">{REWARDS[i]}</Tag> : <span className="text-on-surface-variant"> - </span>}</div>
              </div>
            );
          })}
        </Panel>
      )}

      {/* Awards */}
      {tab === "awards" && (
        <div>
          <div className="grid-2 mb-5">
            {awards.filter(function(a) { return a.winner; }).map(function(a) {
              return <AwardCard key={a.id} award={a} onClick={function() { if (setProfilePlayer && a.winner) { setProfilePlayer(a.winner); setScreen("profile"); } }} />;
            })}
          </div>
          <div className="mt-4 px-5 py-4 bg-secondary/[.06] border border-secondary/20 rounded-xl flex items-center gap-3.5 flex-wrap">
            <span className="text-2xl"><Icon name="redeem" /></span>
            <div className="flex-1">
              <div className="font-bold text-sm text-[#C4B5FD] mb-[3px]">Milestone Rewards Unlocked</div>
              <div className="text-[13px] text-[#C8D4E0]">Some players earned new milestones this clash.</div>
            </div>
            <Btn v="purple" s="sm" onClick={function() { setScreen("milestones"); }}>View {"->"}</Btn>
          </div>
        </div>
      )}

      {/* Clash Report */}
      {tab === "report" && (
        <Panel className="p-5">
          <h3 className="font-editorial text-base text-on-surface mb-1">{CLASH_NAME} - Round by Round</h3>
          <p className="text-[13px] text-muted mb-5">{CLASH_DATE} - {sorted.length} players</p>
          <ClashReport clashData={{
            id: "latest", name: CLASH_NAME, date: CLASH_DATE, season: "S1",
            champion: champ.name, top3: sorted.slice(0, 3).map(function(p) { return p.name; }),
            players: sorted.length, lobbies: Math.ceil(sorted.length / 8),
            report: {
              mostImproved: sorted[3] ? sorted[3].name : null,
              biggestUpset: (sorted[4] ? sorted[4].name : "") + " beat " + (sorted[0] ? sorted[0].name : "")
            }
          }} players={players} />
        </Panel>
      )}
    </div>
  );
}

var MemoResultsScreen = memo(ResultsScreen);

// ---- LobbySubmissionPanel ----

function LobbySubmissionPanel(props) {
  var lobby = props.lobby;
  var round = props.round;
  var lobbyNum = props.lobbyNum;
  var tournamentId = props.tournamentId;
  var allPendingResults = props.allPendingResults;
  var players = props.players;
  var onConfirmAll = props.onConfirmAll;
  var _disputePlayer = useState(null);
  var disputePlayer = _disputePlayer[0];
  var setDisputePlayer = _disputePlayer[1];
  var _disputeVal = useState('');
  var disputeVal = _disputeVal[0];
  var setDisputeVal = _disputeVal[1];

  var submissions = allPendingResults.filter(function(r) {
    return r.round === round && r.lobby_number === lobbyNum;
  });

  var placementCounts = {};
  submissions.forEach(function(r) {
    if (!placementCounts[r.placement]) placementCounts[r.placement] = [];
    placementCounts[r.placement].push(r.player_id);
  });
  var hasConflict = Object.keys(placementCounts).some(function(p) {
    return placementCounts[p].length > 1;
  });

  var allSubmitted = lobby.length > 0 && submissions.length >= lobby.length;
  var canConfirm = allSubmitted && !hasConflict;

  return (
    <div className="mt-3 border-t border-white/[0.05] pt-3">
      <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">
        {submissions.length + ' / ' + lobby.length + ' submitted'}
      </div>
      {lobby.map(function(p) {
        var sub = submissions.find(function(r) { return r.player_id === p.id; });
        var isConflict = sub && placementCounts[sub.placement] && placementCounts[sub.placement].length > 1;
        var isDisputing = disputePlayer === p.id;
        return (
          <div key={p.id} className="flex items-center gap-2 py-2 border-b border-white/[0.03] last:border-0 text-sm">
            <div className={'w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 ' +
              (sub ? 'bg-white/10 text-on-surface' : 'bg-white/[0.04] text-on-surface-variant border border-dashed border-white/20')
            }>{sub ? String(sub.placement) : '?'}</div>
            <span className="flex-1 font-display font-semibold text-sm">{p.name || p.username}</span>
            {isDisputing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" min="1" max="8"
                  value={disputeVal}
                  onChange={function(e) { setDisputeVal(e.target.value); }}
                  className="w-12 bg-surface-container border border-outline-variant/20 rounded px-2 py-1 text-sm text-center font-mono"
                />
                <Btn v="primary" s="sm" onClick={function() {
                  var val = parseInt(disputeVal);
                  if (val < 1 || val > 8) return;
                  supabase.from('pending_results').upsert({
                    tournament_id: tournamentId,
                    round: round,
                    lobby_number: lobbyNum,
                    player_id: p.id,
                    placement: val,
                    status: 'pending'
                  }, { onConflict: 'tournament_id,round,player_id' }).then(function(r) {
                    if (!r.error) { setDisputePlayer(null); setDisputeVal(''); }
                  }).catch(function() {});
                }}>Save</Btn>
                <Btn v="ghost" s="sm" onClick={function() { setDisputePlayer(null); }}>Cancel</Btn>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={'text-[10px] px-2 py-0.5 rounded font-label font-bold uppercase tracking-wide ' +
                  (isConflict ? 'bg-error/10 text-error' : sub ? 'bg-tertiary/10 text-tertiary' : 'bg-white/[0.05] text-on-surface-variant')
                }>{isConflict ? 'Conflict' : sub ? 'Submitted' : 'Pending'}</span>
                <button
                  className="text-[10px] text-on-surface-variant underline cursor-pointer"
                  onClick={function() { setDisputePlayer(p.id); setDisputeVal(sub ? String(sub.placement) : ''); }}
                >Override</button>
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-3">
        <Btn
          v="primary"
          s="sm"
          full
          disabled={!canConfirm}
          onClick={function() { onConfirmAll(lobbyNum, submissions); }}
        >Confirm All</Btn>
      </div>
    </div>
  );
}

// ---- BracketScreen ----

function BracketScreen(props) {
  var players = props.players;
  var setPlayers = props.setPlayers;
  var toast = props.toast;
  var isAdmin = props.isAdmin;
  var currentUser = props.currentUser;
  var setProfilePlayer = props.setProfilePlayer;
  var setScreen = props.setScreen;
  var tournamentState = props.tournamentState;
  var setTournamentState = props.setTournamentState;
  var seasonConfig = props.seasonConfig;
  var allPendingResults = props.allPendingResults || [];
  var pastClashes = props.pastClashes || [];

  var checkedIn = useMemo(function() { return players.filter(function(p) { return p.checkedIn; }); }, [players]);
  var lobbySize = 8;
  var round = tournamentState ? tournamentState.round : 1;
  var lockedLobbies = tournamentState ? tournamentState.lockedLobbies : [];
  var currentClashId = tournamentState && tournamentState.clashId ? tournamentState.clashId : ("c" + Date.now());
  var server = (tournamentState && tournamentState.server) || 'EU';
  var riotIdField = server === 'NA' ? 'riot_id_na' : 'riot_id_eu';
  var _ms = useState(currentUser ? currentUser.username : "");
  var mySearch = _ms[0];
  var setMySearch = _ms[1];
  var _hl = useState(null);
  var highlightLobby = _hl[0];
  var setHighlightLobby = _hl[1];
  var _pe = useState({});
  var placementEntry = _pe[0];
  var setPlacementEntry = _pe[1];
  var _ps = useState({});
  var playerSubmissions = _ps[0];
  var setPlayerSubmissions = _ps[1];
  var _fc = useState(false);
  var showFinalizeConfirm = _fc[0];
  var setShowFinalizeConfirm = _fc[1];
  var _ac = useState(null);
  var autoAdvanceCountdown = _ac[0];
  var setAutoAdvanceCountdown = _ac[1];
  var autoAdvanceRef = useRef(null);

  function computeLobbies() {
    var algo = (tournamentState && tournamentState.seedAlgo) || "rank-based";
    var pool;
    if (round === 1) {
      if (algo === "random") {
        pool = [].concat(checkedIn).sort(function() { return Math.random() - 0.5; });
      } else if (algo === "snake") {
        var sorted = [].concat(checkedIn).sort(function(a, b) { return b.lp - a.lp; });
        pool = [];
        sorted.forEach(function(p, i) { if (Math.floor(i / lobbySize) % 2 === 0) pool.push(p); else pool.unshift(p); });
      } else if (algo === "anti-stack") {
        var ranked = [].concat(checkedIn).sort(function(a, b) { return b.pts - a.pts || b.lp - a.lp; });
        var lobbyCount = Math.ceil(ranked.length / lobbySize);
        var buckets = Array.from({ length: lobbyCount }, function() { return []; });
        ranked.forEach(function(p, i) {
          var row = Math.floor(i / lobbyCount);
          var col = row % 2 === 0 ? i % lobbyCount : (lobbyCount - 1 - (i % lobbyCount));
          buckets[col].push(p);
        });
        pool = [].concat.apply([], buckets);
      } else {
        pool = [].concat(checkedIn).sort(function(a, b) { return b.pts - a.pts || b.lp - a.lp; });
      }
    } else {
      var byPts = [].concat(checkedIn).sort(function(a, b) { return b.pts - a.pts || b.lp - a.lp; });
      var lCount = Math.ceil(byPts.length / lobbySize);
      if (lCount <= 1) {
        pool = byPts;
      } else {
        var swissBuckets = Array.from({ length: lCount }, function() { return []; });
        byPts.forEach(function(p, i) {
          var row = Math.floor(i / lCount);
          var col = row % 2 === 0 ? i % lCount : (lCount - 1 - (i % lCount));
          swissBuckets[col].push(p);
        });
        pool = [].concat.apply([], swissBuckets);
      }
    }
    var result = [];
    for (var i = 0; i < pool.length; i += lobbySize) result.push(pool.slice(i, i + lobbySize));
    return result;
  }

  var lobbies = useMemo(function() {
    var saved = tournamentState && tournamentState.savedLobbies;
    if (saved && saved.length > 0 && saved[0] && saved[0].length > 0) {
      return saved.map(function(lobbyIds) {
        return lobbyIds.map(function(id) { return checkedIn.find(function(p) { return p.id === id; }) || null; }).filter(Boolean);
      }).filter(function(l) { return l.length > 0; });
    }
    return computeLobbies();
  }, [tournamentState && tournamentState.savedLobbies, checkedIn, round]);

  // Load existing player_reports from DB on mount
  useEffect(function() {
    if (!supabase.from || !tournamentState.dbTournamentId) return;
    supabase.from('player_reports').select('player_id,reported_placement,game_number')
      .eq('tournament_id', tournamentState.dbTournamentId).eq('game_number', round)
      .then(function(res) {
        if (res.error || !res.data || !res.data.length) return;
        var restored = {};
        res.data.forEach(function(r) {
          lobbies.forEach(function(lobby, li) {
            var found = lobby.find(function(p) { return String(p.id) === String(r.player_id); });
            if (found) {
              if (!restored[li]) restored[li] = {};
              restored[li][r.player_id] = { placement: r.reported_placement, name: found.name || found.username || '', confirmed: false };
            }
          });
        });
        if (Object.keys(restored).length > 0) setPlayerSubmissions(restored);
      }).catch(function() {});
  }, [tournamentState.dbTournamentId, round, lobbies.length]);

  // Auto-persist lobby assignments
  useEffect(function() {
    if (lobbies.length === 0) return;
    var saved = tournamentState && tournamentState.savedLobbies;
    var lobbyIds = lobbies.map(function(l) { return l.map(function(p) { return p.id; }); });
    if (saved && JSON.stringify(saved) === JSON.stringify(lobbyIds)) return;
    setTournamentState(function(ts) { return Object.assign({}, ts, { savedLobbies: lobbyIds }); });
    if (supabase.from && tournamentState.dbTournamentId) {
      lobbyIds.forEach(function(playerIds, idx) {
        supabase.from('lobbies').upsert({
          tournament_id: tournamentState.dbTournamentId,
          lobby_number: idx + 1,
          round_number: round,
          player_ids: playerIds,
          status: 'pending'
        }, { onConflict: 'tournament_id,lobby_number,round_number' })
        .then(function(res) { }).catch(function() {});
      });
    }
  }, [lobbies]);

  function findMyLobby() {
    var q = mySearch.trim().toLowerCase();
    if (!q) return;
    var li = lobbies.findIndex(function(lobby) {
      return lobby.some(function(p) {
        return (p.name||'').toLowerCase().includes(q) || (p.riotId && p.riotId.toLowerCase().includes(q));
      });
    });
    if (li >= 0) { setHighlightLobby(li); toast("Found in Lobby " + (li + 1) + "!", "success"); }
    else toast("Not found in active lobbies", "error");
  }

  function openPlacementEntry(li) {
    var lobby = lobbies[li];
    var init = {};
    var subs = (playerSubmissions || {})[li] || {};
    lobby.forEach(function(p, i) {
      if (subs[p.id] && subs[p.id].placement) {
        init[p.id] = String(subs[p.id].placement);
      } else {
        init[p.id] = String(i + 1);
      }
    });
    setPlacementEntry(function(pe) { return Object.assign({}, pe, { [li]: { open: true, placements: init } }); });
  }

  function setPlace(li, pid, val) {
    setPlacementEntry(function(pe) {
      var updated = Object.assign({}, pe[li], { placements: Object.assign({}, pe[li].placements, { [pid]: val }) });
      return Object.assign({}, pe, { [li]: updated });
    });
  }

  function placementValid(li) {
    var lobby = lobbies[li];
    if (!placementEntry[li]) return false;
    var vals = lobby.map(function(p) { return parseInt(placementEntry[li].placements[p.id] || "0"); });
    var valid = vals.every(function(v) { return v >= 1 && v <= 8; });
    var unique = new Set(vals).size === vals.length;
    return valid && unique;
  }

  function applyGameResults(li) {
    var lobby = lobbies[li];
    if (!placementEntry[li]) return;
    var placements = {};
    lobby.forEach(function(p) { placements[p.id] = parseInt(placementEntry[li].placements[p.id] || "0"); });
    var allClashIds = pastClashes.map(function(c) { return "c" + c.id; });
    setPlayers(function(prev) {
      return prev.map(function(p) {
        var place = placements[p.id];
        if (place === undefined) return p;
        var earned = PTS[place] || 0;
        var bonuses = computeSeasonBonuses(p, currentClashId, allClashIds, seasonConfig);
        var totalEarned = earned + (bonuses.bonusPts || 0);
        var newGames = (p.games || 0) + 1;
        var newWins = (p.wins || 0) + (place === 1 ? 1 : 0);
        var newTop4 = (p.top4 || 0) + (place <= 4 ? 1 : 0);
        var newPts = (p.pts || 0) + totalEarned;
        var newAvg = (((parseFloat(p.avg) || 0) * (p.games || 0) + place) / newGames).toFixed(2);
        var newHistory = [].concat(p.clashHistory || [], [{ round: round, place: place, pts: earned, clashId: currentClashId, bonusPts: bonuses.bonusPts || 0, comebackTriggered: bonuses.comebackTriggered, attendanceMilestone: bonuses.attendanceMilestone }]);
        var newSparkline = [].concat(p.sparkline || [p.pts], [newPts]);
        var newStreak = place <= 4 ? (p.currentStreak || 0) + 1 : 0;
        var bestStreak = Math.max(p.bestStreak || 0, newStreak);
        var newAttendanceStreak = getAttendanceStreak(p, allClashIds.concat([currentClashId]));
        return Object.assign({}, p, {
          pts: newPts, wins: newWins, top4: newTop4, games: newGames, avg: newAvg,
          clashHistory: newHistory, sparkline: newSparkline, currentStreak: newStreak, bestStreak: bestStreak,
          lastClashId: currentClashId, attendanceStreak: newAttendanceStreak
        });
      });
    });
    setTournamentState(function(ts) {
      return Object.assign({}, ts, {
        lockedLobbies: [].concat(ts.lockedLobbies || [], [li]),
        lockedPlacements: Object.assign({}, ts.lockedPlacements || {}, { [li]: placements })
      });
    });
    setPlacementEntry(function(pe) {
      return Object.assign({}, pe, { [li]: Object.assign({}, pe[li], { open: false }) });
    });
    // Update lobby status to locked in DB
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('lobbies').update({ status: 'locked' })
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('lobby_number', li + 1)
        .eq('round_number', round)
        .then(function(res) { }).catch(function() {});
    }
    // Persist per-game results
    if (supabase.from && tournamentState.dbTournamentId) {
      var dbTid = tournamentState.dbTournamentId;
      var gameRows = [];
      lobby.forEach(function(p) {
        var place = parseInt(placementEntry[li].placements[p.id] || "0");
        if (place > 0) gameRows.push({ tournament_id: dbTid, round_number: round, player_id: p.id, placement: place, points: PTS[place] || 0, is_dnp: false, game_number: round });
      });
      if (gameRows.length > 0) {
        supabase.from('game_results').insert(gameRows).then(function(res) {
          if (res.error) { toast("Failed to save game results", "error"); }
          else {
            // DB trigger refresh_player_stats handles authoritative stat update
            setPlayers(function(ps) {
              return ps.map(function(p) {
                var row = gameRows.find(function(r) { return r.player_id === p.id; });
                if (!row) return p;
                return Object.assign({}, p, {
                  pts: (p.pts || 0) + (row.points || 0),
                  wins: (p.wins || 0) + (row.placement === 1 ? 1 : 0)
                });
              });
            });
          }
        }).catch(function() { toast("Failed to save game results", "error"); });
      }
    }
    toast("Lobby " + (li + 1) + " results applied!", "success");
  }

  function handleConfirmAll(lobbyNum, submissions) {
    if (!tournamentState.id || !submissions.length) return;
    var round = tournamentState.round;

    submissions.forEach(function(sub) {
      supabase.from('pending_results')
        .update({ status: 'confirmed' })
        .eq('id', sub.id)
        .then(function(r) {
        }).catch(function() {});
    });

    var gameRows = submissions.map(function(sub) {
      return {
        tournament_id: tournamentState.id,
        round_number: round,
        player_id: sub.player_id,
        placement: sub.placement,
        points: PTS[sub.placement] || 0,
        is_dnp: false,
        game_number: round
      };
    });
    supabase.from('game_results').insert(gameRows).then(function(res) {
      if (res.error) { toast('Failed to save results: ' + res.error.message, 'error'); return; }

      // DB trigger refresh_player_stats handles authoritative stat update
      setPlayers(function(ps) {
        return ps.map(function(p) {
          var row = gameRows.find(function(r) { return r.player_id === p.id; });
          if (!row) return p;
          return Object.assign({}, p, {
            pts: (p.pts || 0) + row.points,
            wins: (p.wins || 0) + (row.placement === 1 ? 1 : 0)
          });
        });
      });

      supabase.from('pending_results')
        .select('id', { count: 'exact' })
        .eq('tournament_id', tournamentState.id)
        .eq('round', round)
        .neq('status', 'confirmed')
        .then(function(checkRes) {
          if (checkRes.count === 0) {
            if (round >= (tournamentState.totalGames || 3)) {
              setTournamentState(function(ts) { return Object.assign({}, ts, { phase: 'complete' }); });
            } else {
              var nextRound = round + 1;
              setTournamentState(function(ts) { return Object.assign({}, ts, { round: nextRound }); });
            }
          }
          toast('Lobby ' + lobbyNum + ' results confirmed!', 'success');
        }).catch(function() {});
    }).catch(function() { toast('Failed to save results', 'error'); });
  }

  function submitMyPlacement(li, playerId, playerName, placement) {
    var p = parseInt(placement);
    if (p < 1 || p > 8) { toast("Invalid placement", "error"); return; }
    setPlayerSubmissions(function(ps) {
      var lobbySubmissions = Object.assign({}, ps[li] || {});
      lobbySubmissions[playerId] = { placement: p, name: playerName, confirmed: false };
      return Object.assign({}, ps, { [li]: lobbySubmissions });
    });
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('player_reports').upsert({
        tournament_id: tournamentState.dbTournamentId,
        lobby_id: null,
        game_number: round,
        player_id: playerId,
        reported_placement: p,
        reported_at: new Date().toISOString()
      }, { onConflict: 'tournament_id,game_number,player_id' }).then(function(r) {
      }).catch(function() {});
    }
    toast("Placement submitted - waiting for admin confirmation", "success");
  }

  function unlockLobby(li) {
    if (!window.confirm("Unlock Lobby " + (li + 1) + "? This will revert all results for this lobby in the current round.")) return;
    var savedPlacements = (tournamentState.lockedPlacements || {})[li];
    if (savedPlacements) {
      setPlayers(function(prev) {
        return prev.map(function(p) {
          var place = savedPlacements[p.id];
          if (place === undefined) return p;
          var earned = PTS[place] || 0;
          var newGames = Math.max((p.games || 1) - 1, 0);
          var newWins = Math.max((p.wins || 0) - (place === 1 ? 1 : 0), 0);
          var newTop4 = Math.max((p.top4 || 0) - (place <= 4 ? 1 : 0), 0);
          var newPts = Math.max((p.pts || 0) - earned, 0);
          var newAvg = newGames > 0 ? (((parseFloat(p.avg) || 0) * (p.games || 1) - place) / newGames).toFixed(2) : "0.00";
          var newHistory = (p.clashHistory || []).filter(function(h) { return !(h.round === round && h.clashId === currentClashId); });
          var newSparkline = (p.sparkline || []).slice(0, -1);
          var newStreak = place <= 4 ? Math.max((p.currentStreak || 0) - 1, 0) : p.currentStreak;
          return Object.assign({}, p, { pts: newPts, wins: newWins, top4: newTop4, games: newGames, avg: newAvg, clashHistory: newHistory, sparkline: newSparkline, currentStreak: newStreak });
        });
      });
    }
    setTournamentState(function(ts) {
      var newLocked = (ts.lockedLobbies || []).filter(function(i) { return i !== li; });
      var newSavedPlacements = Object.assign({}, ts.lockedPlacements || {});
      delete newSavedPlacements[li];
      return Object.assign({}, ts, { lockedLobbies: newLocked, lockedPlacements: newSavedPlacements });
    });
    if (supabase.from && tournamentState.dbTournamentId) {
      var lobbyPlayerIds = lobbies[li] ? lobbies[li].map(function(p) { return p.id; }) : [];
      if (lobbyPlayerIds.length > 0) {
        supabase.from('game_results').delete()
          .eq('tournament_id', tournamentState.dbTournamentId)
          .eq('round_number', round)
          .in('player_id', lobbyPlayerIds)
          .then(function(res) { }).catch(function() {});
      }
      supabase.from('lobbies').update({ status: 'active' })
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('lobby_number', li + 1)
        .eq('round_number', round)
        .then(function(res) { }).catch(function() {});
      if (savedPlacements) {
        lobbyPlayerIds.forEach(function(pid) {
          var place = savedPlacements[pid];
          if (place === undefined) return;
          var pp = players.find(function(q) { return q.id === pid; });
          if (!pp) return;
          var earned = PTS[place] || 0;
          var newGames = Math.max((pp.games || 1) - 1, 0);
          var newWins = Math.max((pp.wins || 0) - (place === 1 ? 1 : 0), 0);
          var newTop4 = Math.max((pp.top4 || 0) - (place <= 4 ? 1 : 0), 0);
          var newPts = Math.max((pp.pts || 0) - earned, 0);
          var newAvg = newGames > 0 ? (((parseFloat(pp.avg) || 0) * (pp.games || 1) - place) / newGames) : 0;
          supabase.from('players').update({
            season_pts: newPts, wins: newWins, top4: newTop4, games: newGames,
            avg_placement: parseFloat(newAvg.toFixed(2))
          }).eq('id', pid).then(function(pr) {
          }).catch(function() {});
        });
      }
    }
    toast("Lobby " + (li + 1) + " unlocked - results reverted", "success");
  }

  var allLocked = lobbies.length > 0 && lobbies.every(function(_, i) { return lockedLobbies.includes(i); });

  // Auto-advance countdown
  useEffect(function() {
    if (!isAdmin || !allLocked || round >= (tournamentState.totalGames || 4)) {
      if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; }
      setAutoAdvanceCountdown(null);
      return;
    }
    setAutoAdvanceCountdown(15);
    autoAdvanceRef.current = setInterval(function() {
      setAutoAdvanceCountdown(function(c) {
        if (c === null) return null;
        if (c <= 1) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; return 0; }
        return c - 1;
      });
    }, 1000);
    return function() { if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; } };
  }, [allLocked, isAdmin, round, tournamentState.totalGames]);

  useEffect(function() {
    if (autoAdvanceCountdown !== 0 || !isAdmin || !allLocked) return;
    var maxRounds = tournamentState.totalGames || 4;
    if (round < maxRounds) {
      var nextRound = round + 1;
      setTournamentState(function(ts) { return Object.assign({}, ts, { round: nextRound, lockedLobbies: [], savedLobbies: [] }); });
      toast("Auto-advanced to Game " + nextRound, "success");
    }
    setAutoAdvanceCountdown(null);
  }, [autoAdvanceCountdown]);

  function cancelAutoAdvance() {
    if (autoAdvanceRef.current) { clearInterval(autoAdvanceRef.current); autoAdvanceRef.current = null; }
    setAutoAdvanceCountdown(null);
    toast("Auto-advance cancelled", "info");
  }

  function saveResultsToSupabase(allPlayers, clashId) {
    if (!supabase.from) return;
    var clashName = (tournamentState && tournamentState.clashName) ? tournamentState.clashName : ("Clash " + new Date().toLocaleDateString());
    var doSave = function(tId) {
      supabase.from('tournaments').update({ phase: 'complete', completed_at: new Date().toISOString() }).eq('id', tId)
        .then(function(r) { }).catch(function() {});
      var playerAgg = [];
      allPlayers.forEach(function(p) {
        var entries = (p.clashHistory || []).filter(function(h) { return h.clashId === clashId; });
        if (entries.length === 0) return;
        var totalPts = entries.reduce(function(s, h) { return s + ((h.pts || 0) + (h.bonusPts || 0)); }, 0);
        var wins = entries.filter(function(h) { var pl = h.place || h.placement; return pl === 1; }).length;
        var top4 = entries.filter(function(h) { var pl = h.place || h.placement; return pl >= 1 && pl <= 4; }).length;
        var placeSum = entries.reduce(function(s, h) { return s + ((h.place || h.placement) || 0); }, 0);
        playerAgg.push({ pid: p.id, pts: totalPts, wins: wins, top4: top4, placeSum: placeSum });
      });
      var ranked = playerAgg.slice().sort(function(a, b) {
        if (b.pts !== a.pts) return b.pts - a.pts;
        var aTie = a.wins * 2 + a.top4;
        var bTie = b.wins * 2 + b.top4;
        if (bTie !== aTie) return bTie - aTie;
        return a.placeSum - b.placeSum;
      });
      var playerTotals = {};
      var rows = ranked.map(function(r, idx) {
        var row = { tournament_id: tId, player_id: r.pid, final_placement: idx + 1, total_points: r.pts, wins: r.wins, top4_count: r.top4 };
        playerTotals[r.pid] = row;
        return row;
      });
      if (rows.length > 0) {
        supabase.from('tournament_results').upsert(rows, { onConflict: 'tournament_id,player_id' }).then(function(r) {
          if (r.error) { toast("Failed to save player results", "error"); return; }
          allPlayers.forEach(function(p) {
            if (p.authUserId) { createNotification(p.authUserId, "Results Finalized", clashName + " results are in! Check the Results screen to see your placement and points.", "trophy"); }
          });
          var winnerRow = rows.reduce(function(best, row) { return row.final_placement < best.final_placement ? row : best; }, rows[0]);
          if (winnerRow) {
            var winnerPlayer = allPlayers.find(function(p) { return p.id === winnerRow.player_id; });
            if (winnerPlayer) writeActivityEvent("result", winnerPlayer.id, winnerPlayer.name + " won " + clashName);
          }
          var sortedByPts = allPlayers.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0); });
          allPlayers.forEach(function(p) {
            if (p.id) {
              var newRank = sortedByPts.findIndex(function(q) { return q.id === p.id; }) + 1;
              if (p.lastClashRank && p.lastClashRank !== newRank) {
                writeActivityEvent("rank_change", p.id, p.name + " moved to #" + newRank);
              }
            }
          });
          allPlayers.forEach(function(p) {
            if (p.id) {
              var ppRankA = allPlayers.filter(function(q) { return q.pts > p.pts; }).length + 1;
              var earnedA = checkAchievements(p, ppRankA);
              if (earnedA.length > 0) syncAchievements(p.id, earnedA);
            }
          });
          allPlayers.forEach(function(p) {
            if (p.id && playerTotals[p.id]) {
              supabase.from('players').update({
                season_pts: p.pts || 0, wins: p.wins || 0, top4: p.top4 || 0, games: p.games || 0,
                avg_placement: parseFloat(parseFloat(p.avg || 0).toFixed(2)),
                last_clash_rank: sortedByPts.findIndex(function(q) { return q.id === p.id; }) + 1
              }).eq('id', p.id).then(function(pr) {
              }).catch(function() {});
            }
          });
        }).catch(function() { toast("Failed to save player results", "error"); });
      }
    };
    var existingId = tournamentState.dbTournamentId;
    if (existingId) {
      doSave(existingId);
    } else {
      supabase.from('tournaments').insert({ name: clashName, date: new Date().toISOString().split('T')[0], phase: 'complete', type: 'season_clash' }).select('id').single().then(function(res) {
        if (res.error) { toast("Failed to save results to database", "error"); return; }
        if (res.data) doSave(res.data.id);
      }).catch(function() { toast("Failed to save results to database", "error"); });
    }
  }

  var myLobbyAuto = currentUser ? lobbies.findIndex(function(lb) { return lb.some(function(p) { return p.name === currentUser.username; }); }) : -1;
  var effectiveHighlight = highlightLobby !== null ? highlightLobby : myLobbyAuto >= 0 ? myLobbyAuto : null;

  return (
    <div>
      {showFinalizeConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[1003] p-4 bg-black/[.85]">
          <Panel glow className="w-full max-w-[420px] p-7">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3"><Icon name="emoji_events" /></div>
              <h3 className="text-on-surface text-xl mb-2">Finalize This Clash?</h3>
              <p className="text-[#BECBD9] text-sm leading-relaxed mb-1">This will end the tournament and post final results. All {checkedIn.length} players will receive their season points.</p>
              <p className="text-primary text-xs font-semibold">This action cannot be undone.</p>
            </div>
            <div className="flex gap-2.5 justify-center">
              <Btn v="dark" onClick={function() { setShowFinalizeConfirm(false); }}>Cancel</Btn>
              <Btn v="primary" onClick={function() {
                setShowFinalizeConfirm(false);
                saveResultsToSupabase(players, currentClashId);
                setTournamentState(function(ts) { return Object.assign({}, ts, { phase: "complete", lockedLobbies: [], savedLobbies: [] }); });
                toast("Clash complete! View results ->", "success");
              }}>Finalize Clash</Btn>
            </div>
          </Panel>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-5 flex-wrap">
        <Btn v="dark" s="sm" onClick={function() { setScreen("home"); }}>{"<-"} Back</Btn>
        <h2 className="text-on-surface text-xl m-0 flex-1 flex items-center gap-2.5 flex-wrap">
          <span>Game {round}/{tournamentState.totalGames || 4}</span>
          <span className="font-label text-[10px] font-bold px-2.5 py-0.5 rounded-xl tracking-widest uppercase" style={{
            background: tournamentState.phase === "inprogress" ? "rgba(82,196,124,.12)" : tournamentState.phase === "complete" ? "rgba(78,205,196,.12)" : "rgba(155,114,207,.12)",
            color: tournamentState.phase === "inprogress" ? "#6EE7B7" : tournamentState.phase === "complete" ? "#4ECDC4" : "#C4B5FD",
            border: "1px solid " + (tournamentState.phase === "inprogress" ? "rgba(82,196,124,.3)" : tournamentState.phase === "complete" ? "rgba(78,205,196,.3)" : "rgba(155,114,207,.3)")
          }}>
            {tournamentState.phase === "inprogress" ? "Live" : tournamentState.phase === "complete" ? "Complete" : tournamentState.phase === "checkin" ? "Check-in" : "Setup"}
          </span>
          <span className="text-[13px] font-normal text-[#BECBD9]">{lobbies.length} {lobbies.length === 1 ? "Lobby" : "Lobbies"} - {checkedIn.length} players</span>
        </h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Btn v="dark" s="sm" disabled={round <= 1} onClick={function() { setTournamentState(function(ts) { return Object.assign({}, ts, { round: ts.round - 1, lockedLobbies: [], savedLobbies: [] }); }); }}>{"<-"} Round</Btn>
            <Btn v="primary" s="sm" disabled={!allLocked} onClick={function() {
              var maxRounds = tournamentState.totalGames || 4;
              var cutL = tournamentState.cutLine || 0;
              var cutG = tournamentState.cutAfterGame || 0;
              if (round >= maxRounds) {
                setShowFinalizeConfirm(true);
              } else {
                var nextRound = round + 1;
                var cutMsg = "";
                if (cutL > 0 && round === cutG) {
                  var standings = computeTournamentStandings(checkedIn, [], null);
                  var cutResult = applyCutLine(standings, cutL, cutG);
                  var elimCount = cutResult.eliminated.length;
                  if (elimCount > 0) {
                    cutMsg = " - " + elimCount + " players eliminated (below " + cutL + "pts)";
                    cutResult.eliminated.forEach(function(ep) {
                      setPlayers(function(ps) { return ps.map(function(p) { return p.id === ep.id ? Object.assign({}, p, { checkedIn: false }) : p; }); });
                    });
                    setTournamentState(function(ts) {
                      var kept = (ts.checkedInIds || []).filter(function(cid) { return !cutResult.eliminated.some(function(e) { return String(e.id) === String(cid); }); });
                      return Object.assign({}, ts, { checkedInIds: kept });
                    });
                  }
                }
                setTournamentState(function(ts) { return Object.assign({}, ts, { round: nextRound, lockedLobbies: [], savedLobbies: [] }); });
                toast("Advanced to Game " + nextRound + cutMsg, "success");
              }
            }}>
              {round >= (tournamentState.totalGames || 4) ? "Finalize Clash" : "Next Game ->"}
            </Btn>
          </div>
        )}
      </div>

      {allLocked && checkedIn.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 mb-4" style={{ background: "rgba(82,196,124,.08)", border: "1px solid rgba(82,196,124,.3)", animation: "pulse 2s infinite" }}>
          <Icon name="check_circle" className="text-base text-[#52C47C]" />
          <span className="text-[13px] font-semibold text-success flex-1">All {lobbies.length} lobbies locked - {round >= (tournamentState.totalGames || 4) ? "ready to finalize!" : "ready for next game!"}{isAdmin && autoAdvanceCountdown !== null && autoAdvanceCountdown > 0 && round < (tournamentState.totalGames || 4) ? " Auto-advancing in " + autoAdvanceCountdown + "s" : ""}</span>
          {isAdmin && autoAdvanceCountdown !== null && autoAdvanceCountdown > 0 && round < (tournamentState.totalGames || 4) && (
            <button onClick={cancelAutoAdvance} className="text-[11px] font-bold cursor-pointer rounded-lg px-3 py-1 whitespace-nowrap text-error bg-error/[0.08] border border-error/30">Cancel</button>
          )}
        </div>
      )}

      {checkedIn.length === 0 && (
        <div className="text-center py-16 px-5">
          <div className="text-5xl mb-4">
            {tournamentState && tournamentState.phase === "complete" ? <Icon name="emoji_events" /> : tournamentState && tournamentState.phase === "inprogress" ? <Icon name="bolt" /> : <Icon name="sports_esports" />}
          </div>
          <h3 className="text-on-surface mb-2">{tournamentState && tournamentState.phase === "complete" ? "Tournament Complete" : tournamentState && tournamentState.phase === "inprogress" ? "Waiting for Players" : "No Active Tournament"}</h3>
          <p className="text-[#BECBD9] text-sm mb-5">{tournamentState && tournamentState.phase === "complete" ? "The last tournament has been finalized. Check Results for the full breakdown." : tournamentState && tournamentState.phase === "inprogress" ? "Players need to check in to join the bracket." : "No tournament is running right now. Check back when the next clash is announced!"}</p>
          <div className="flex gap-2.5 justify-center">
            <Btn v="primary" onClick={function() { setScreen("home"); }}>{"<-"} Back to Home</Btn>
            {tournamentState && tournamentState.phase === "complete" && <Btn v="dark" onClick={function() { setScreen("results"); }}>View Results</Btn>}
          </div>
        </div>
      )}

      {checkedIn.length > 0 && (
        <>
          {/* Find my lobby */}
          <Panel className="px-4 py-3.5 mb-5 flex gap-2.5 items-center flex-wrap">
            <span className="text-[13px] text-[#C8D4E0] shrink-0"><Icon name="search" className="text-[13px] mr-1" />Find your lobby:</span>
            <Inp value={mySearch} onChange={setMySearch} placeholder="Your name or Riot ID" onKeyDown={function(e) { if (e.key === "Enter") findMyLobby(); }} />
            <Btn v="purple" s="sm" onClick={findMyLobby}>Find Me</Btn>
            {effectiveHighlight !== null && <span className="text-xs text-[#6EE7B7] font-semibold">You are in Lobby {effectiveHighlight + 1}</span>}
          </Panel>

          {/* Lobby lock progress */}
          {lobbies.length > 0 && tournamentState.phase === "inprogress" && (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1 rounded-lg h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,.04)" }}>
                <div className="h-full rounded-lg" style={{ background: allLocked ? "linear-gradient(90deg,#52C47C,#6EE7B7)" : "linear-gradient(90deg,#E8A838,#9B72CF)", width: Math.round(lockedLobbies.length / lobbies.length * 100) + "%", transition: "width .5s ease" }} />
              </div>
              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: allLocked ? "#6EE7B7" : "#E8A838" }}>{lockedLobbies.length}/{lobbies.length} locked</span>
            </div>
          )}

          {/* Complete banner */}
          {tournamentState && tournamentState.phase === "complete" && (
            <div className="flex items-center gap-3 rounded-lg px-[18px] py-3.5 mb-4" style={{ background: "rgba(232,168,56,.1)", border: "1px solid rgba(232,168,56,.4)" }}>
              <Icon name="emoji_events" className="text-[22px]" />
              <div>
                <div className="font-bold text-primary text-[15px]">Clash Complete!</div>
                <div className="text-xs text-[#C8D4E0]">All rounds locked. View final standings on the Leaderboard.</div>
              </div>
              <Btn v="primary" s="sm" className="ml-auto" onClick={function() { setScreen("leaderboard"); }}>View Results {"->"}</Btn>
            </div>
          )}

          <div className="flex gap-2 mb-5 flex-wrap">
            {[1, 2, 3].map(function(r) {
              return (
                <div key={r} className="flex-1 rounded-lg px-3.5 py-2.5 text-center" style={{
                  minWidth: 80,
                  background: r < round ? "rgba(82,196,124,.08)" : r === round ? "rgba(232,168,56,.08)" : "rgba(255,255,255,.02)",
                  border: "1px solid " + (r < round ? "rgba(82,196,124,.3)" : r === round ? "rgba(232,168,56,.4)" : "rgba(242,237,228,.08)")
                }}>
                  <div className="font-label text-[11px] font-bold tracking-widest uppercase mb-0.5" style={{ color: r < round ? "#6EE7B7" : r === round ? "#E8A838" : "#9AAABF" }}>Round {r}</div>
                  <div className="text-[11px]" style={{ color: r < round ? "#6EE7B7" : r === round ? "#E8A838" : "#9AAABF" }}>{r < round ? "Complete" : r === round ? "In Progress" : "Upcoming"}</div>
                </div>
              );
            })}
          </div>

          {/* Lobby grid */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(320px,100%),1fr))" }}>
            {lobbies.map(function(lobby, li) {
              var isMyLobby = effectiveHighlight === li;
              var lobbyLocked = lockedLobbies.includes(li);
              return (
                <div key={li} className="rounded-xl overflow-hidden transition-shadow" style={{
                  background: isMyLobby ? "rgba(155,114,207,.06)" : "#111827",
                  border: "2px solid " + (isMyLobby ? "#9B72CF" : lobbyLocked ? "rgba(82,196,124,.35)" : "rgba(242,237,228,.1)"),
                  boxShadow: isMyLobby ? "0 0 24px rgba(155,114,207,.15)" : "none"
                }}>
                  {/* Lobby header */}
                  <div className="px-4 py-3.5 flex items-center justify-between" style={{
                    background: isMyLobby ? "rgba(155,114,207,.1)" : "rgba(255,255,255,.02)",
                    borderBottom: "1px solid rgba(242,237,228,.07)"
                  }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[13px] font-extrabold shrink-0" style={{
                        background: isMyLobby ? "rgba(155,114,207,.2)" : lobbyLocked ? "rgba(82,196,124,.12)" : "rgba(232,168,56,.08)",
                        border: "1px solid " + (isMyLobby ? "rgba(155,114,207,.5)" : lobbyLocked ? "rgba(82,196,124,.3)" : "rgba(232,168,56,.2)"),
                        color: isMyLobby ? "#9B72CF" : lobbyLocked ? "#6EE7B7" : "#E8A838"
                      }}>
                        {li + 1}
                      </div>
                      <div>
                        <div className="font-bold text-[14px] text-on-surface">Lobby {li + 1}</div>
                        <div className="text-[11px] text-[#BECBD9]">{lobby.length} players{isMyLobby ? " - Your Lobby" : ""}</div>
                      </div>
                    </div>
                    {isMyLobby && <div className="text-xs font-bold rounded-lg px-2.5 py-0.5 text-primary bg-primary/[0.12] border border-primary/30">YOU</div>}
                    {lobbyLocked && !isMyLobby && <div className="text-[11px] text-success font-bold">Locked</div>}
                    {lobbyLocked && isAdmin && <button onClick={function(e) { e.stopPropagation(); unlockLobby(li); }} className="text-[11px] font-bold cursor-pointer rounded-lg px-2.5 py-0.5 ml-1.5 text-error bg-error/[0.08] border border-error/30">Unlock</button>}
                  </div>

                  {/* Player list */}
                  <div className="px-3 py-2.5">
                    {[].concat(lobby).sort(function(a, b) { return b.pts - a.pts; }).map(function(p, pi) {
                      var isMe = currentUser && p.name === currentUser.username;
                      var homie = HOMIES_IDS.includes(p.id);
                      return (
                        <div key={p.id} onClick={function() { setProfilePlayer(p); setScreen("profile"); }}
                          className={"flex items-center gap-2.5 px-1.5 py-2 rounded-lg cursor-pointer transition-colors " + (pi < lobby.length - 1 ? "border-b border-outline-variant/10" : "") + " " + (isMe ? "bg-primary/[0.08] hover:bg-primary/[0.12]" : "hover:bg-on-surface/[0.03]")}>
                          <div className="mono text-xs font-extrabold min-w-[18px] text-center" style={{ color: pi === 0 ? "#E8A838" : pi === 1 ? "#C0C0C0" : pi === 2 ? "#CD7F32" : "#9AAABF" }}>{pi + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontWeight: isMe ? 700 : 600, color: isMe ? "#C4B5FD" : "#F2EDE4" }}>{p.name}</span>
                              {homie && <span className="text-[10px]"><Icon name="favorite" style={{ color: "#9B72CF" }} /></span>}
                              {isHotStreak(p) && <span className="text-[10px]"><Icon name="local_fire_department" style={{ color: "#F97316" }} /></span>}
                            </div>
                            <div className="text-[10px] text-[#BECBD9]">{p.rank} - {p.region}</div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <div className="mono text-xs font-bold text-primary">{p.pts}pts</div>
                            {p[riotIdField]
                              ? <span className="font-mono text-[11px] text-on-surface-variant">{p[riotIdField]}</span>
                              : <span className="flex items-center gap-1 text-[11px] text-primary/60"><Icon name="warning" size={12} />No ID</span>
                            }
                          </div>
                          {isMe && !lobbyLocked && tournamentState.phase === "inprogress" && (
                            playerSubmissions[li] && playerSubmissions[li][p.id] ? (
                              <div className="text-[10px] text-[#6EE7B7] font-bold shrink-0">#{playerSubmissions[li][p.id].placement} Submitted</div>
                            ) : (
                              <Sel value="" onChange={function(v) { if (v) submitMyPlacement(li, p.id, p.name, v); }} className="w-[52px] text-[11px] shrink-0 py-1">
                                <option value=""> - </option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(function(n) { return <option key={n} value={n}>{n}</option>; })}
                              </Sel>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Admin placement entry */}
                  {isAdmin && !lobbyLocked && (
                    <div className="border-t border-on-surface/[.06]">
                      {(!placementEntry[li] || !placementEntry[li].open) ? (
                        <div className="px-3 py-2.5 bg-white/[.01]">
                          <Btn v="teal" s="sm" full onClick={function() { openPlacementEntry(li); }}>
                            Enter Placements{playerSubmissions[li] ? " (" + Object.keys(playerSubmissions[li]).length + " submitted)" : ""}
                          </Btn>
                        </div>
                      ) : (
                        <div className="p-3 bg-tertiary/[.03] border-t border-tertiary/[.12]">
                          <div className="font-label text-[11px] font-bold text-[#4ECDC4] mb-2.5 uppercase tracking-widest">Enter Placements - Round {round}</div>
                          <div className="flex flex-col gap-1.5 mb-2.5">
                            {[].concat(lobby).sort(function(a, b) { return b.pts - a.pts; }).map(function(p) {
                              var dup = lobby.filter(function(x) { return placementEntry[li].placements[x.id] === placementEntry[li].placements[p.id]; }).length > 1;
                              var wasSelfSubmitted = ((playerSubmissions || {})[li] || {})[p.id];
                              return (
                                <div key={p.id} className="flex items-center gap-2">
                                  <span className="text-xs text-on-surface flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{p.name}{wasSelfSubmitted && <span className="text-[9px] text-[#4ECDC4] font-bold ml-1">SELF</span>}</span>
                                  <Sel value={placementEntry[li].placements[p.id] || "1"} onChange={function(v) { setPlace(li, p.id, v); }} className={"w-[60px] py-1" + (dup ? " ring-1 ring-error" : "")}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(function(n) { return <option key={n} value={n}>{n}</option>; })}
                                    <option value="0">DNP</option>
                                  </Sel>
                                </div>
                              );
                            })}
                          </div>
                          {!placementValid(li) && <div className="text-[11px] text-error mb-2">Each placement must be unique (1-8)</div>}
                          <div className="flex gap-2">
                            <Btn v="success" s="sm" full disabled={!placementValid(li)} onClick={function() { applyGameResults(li); }}>Confirm and Lock</Btn>
                            <Btn v="dark" s="sm" onClick={function() { setPlacementEntry(function(pe) { return Object.assign({}, pe, { [li]: Object.assign({}, pe[li], { open: false }) }); }); }}>Cancel</Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isAdmin && (
                    <div className="px-3 pb-3">
                      <LobbySubmissionPanel
                        lobby={lobby}
                        round={tournamentState.round}
                        lobbyNum={li + 1}
                        tournamentId={tournamentState.id}
                        allPendingResults={allPendingResults}
                        players={players}
                        onConfirmAll={handleConfirmAll}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Live standings during inprogress */}
          {tournamentState && tournamentState.phase === "inprogress" && lockedLobbies.length > 0 && <LiveStandingsPanel checkedIn={checkedIn} tournamentState={tournamentState} lobbies={lobbies} round={round} />}

          {/* Finals display */}
          {round > 3 && checkedIn.length > 0 && (
            <Panel className="p-6 mt-6 text-center">
              <div className="text-[32px] mb-3"><Icon name="emoji_events" /></div>
              <h3 className="text-primary text-xl mb-2">Grand Finals</h3>
              <p className="text-[#BECBD9] text-sm">All rounds complete. Finals results locked in.</p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

var MemoBracketScreen = memo(BracketScreen);

// ---- ClashIdleView (waiting room - no active clash) ----

function ClashIdleView(props) {
  var players = props.players || []
  var currentUser = props.currentUser
  var linkedPlayer = props.linkedPlayer
  var navigate = props.navigate

  var lastClash = (props.pastClashes || [])[0] || null

  var nextSaturday = getNextSaturday()

  var top3 = lastClash && lastClash.top8 ? lastClash.top8.slice(0, 3) : []
  var top3Colors = ['text-primary', 'text-on-surface', 'text-tertiary']
  var top3Labels = ['1st', '2nd', '3rd']

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 flex flex-col gap-6">

      {/* Panel 1 - Countdown Hero */}
      <Panel>
        <div className="text-center py-4">
          <div className="cond text-[9px] font-bold uppercase tracking-[0.15em] text-primary mb-4">Next Clash</div>
          <CountdownTimer targetDate={nextSaturday} />
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-on-surface/20 text-on-surface/40 text-[10px] cond font-bold uppercase tracking-widest mt-4 mb-2">
            No Active Clash
          </div>
          <div className="text-xs text-on-surface/40 mt-1">Registration opens when the next clash is scheduled.</div>
        </div>
      </Panel>

      {/* Panel 2 - Last Clash Recap */}
      {lastClash && (
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-sm font-bold text-on-surface">{lastClash.name} - Results</div>
            <button className="text-[11px] text-primary underline bg-transparent border-0 cursor-pointer p-0" onClick={function() { navigate('/results') }}>View All Results</button>
          </div>
          <div className="flex gap-3">
            {top3.map(function(entry, i) {
              return (
                <div key={entry.name} className="flex-1 text-center bg-white/[0.03] rounded-lg p-3 border border-on-surface/10">
                  <div className={'cond text-xs font-bold uppercase tracking-wider mb-1 ' + top3Colors[i]}>{top3Labels[i]}</div>
                  <div className={'font-bold text-sm ' + top3Colors[i]}>{entry.name}</div>
                  <div className="text-xs text-on-surface/60 mt-0.5">{entry.pts} pts</div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Panel 3 - Season Standing */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-sm font-bold text-on-surface">Your Season</div>
          <button className="text-[11px] text-primary underline bg-transparent border-0 cursor-pointer p-0" onClick={function() { navigate('/standings') }}>Full Standings</button>
        </div>
        {currentUser && linkedPlayer ? (
          <div className="flex items-center gap-3 bg-primary/[0.04] rounded-lg p-3 border border-primary/10">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex-shrink-0"></div>
            <div className="flex-1">
              <div className="font-bold text-sm text-on-surface">{linkedPlayer.name}</div>
              <div className="text-[10px] text-on-surface/40">{linkedPlayer.rank || 'Unranked'}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-base font-bold text-primary">{linkedPlayer.pts || 0}</div>
              <div className="text-[9px] text-on-surface/30 uppercase tracking-wider">pts</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-bold text-on-surface">{linkedPlayer.wins || 0}</div>
              <div className="text-[9px] text-on-surface/30 uppercase tracking-wider">wins</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm font-bold text-on-surface">{linkedPlayer.games || 0}</div>
              <div className="text-[9px] text-on-surface/30 uppercase tracking-wider">clashes</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-sm text-on-surface/40 mb-3">Sign up to track your stats</div>
            <Btn variant="primary" size="sm" onClick={function() { navigate('/signup') }}>Sign Up Free</Btn>
          </div>
        )}
      </Panel>
    </div>
  )
}

// ---- ClashLobbyView (registration & check-in) ----

function ClashLobbyView(props) {
  var ctx = useApp() || {}
  var phase = props.phase
  var tournamentState = props.tournamentState || {}
  var players = props.players || []
  var currentUser = props.currentUser
  var linkedPlayer = props.linkedPlayer
  var setPlayers = props.setPlayers
  var setTournamentState = props.setTournamentState
  var toast = props.toast || function() {}
  var setProfilePlayer = props.setProfilePlayer
  var setScreen = props.setScreen
  var navigate = props.navigate

  var registeredIds = tournamentState.registeredIds || []
  var checkedInIds = tournamentState.checkedInIds || []
  var waitlistIds = tournamentState.waitlistIds || []

  var sid = linkedPlayer ? String(linkedPlayer.id) : null
  var isRegistered = sid && registeredIds.indexOf(sid) > -1
  var isCheckedIn = sid && checkedInIds.indexOf(sid) > -1
  var isWaitlisted = sid && waitlistIds.indexOf(sid) > -1
  var waitlistPos = isWaitlisted ? (waitlistIds.indexOf(sid) + 1) : 0

  var server = tournamentState.server || 'EU'
  var riotField = server === 'NA' ? 'riot_id_na' : 'riot_id_eu'
  var linkedRiotId = currentUser ? (currentUser[riotField] || '') : ''

  var clashName = tournamentState.clashName || (tournamentState.clashNumber ? ('Clash Week ' + tournamentState.clashNumber) : 'Clash')
  var maxPlayers = parseInt(tournamentState.maxPlayers || 24, 10)
  var registeredCount = registeredIds.length
  var checkedInCount = checkedInIds.length
  var capacityPct = Math.min(100, Math.round((registeredCount / maxPlayers) * 100))

  var clashTimestamp = tournamentState.clashTimestamp
  var hasCountdown = clashTimestamp && new Date(clashTimestamp) > new Date()

  var registeredRoster = registeredIds.map(function(id) {
    return players.find(function(p) { return String(p.id) === String(id) })
  }).filter(Boolean)

  function handleRegister() {
    if (!currentUser) { navigate('/login'); return }
    if (!linkedPlayer) { toast('Account not linked to a player profile', 'error'); return }
    if (!linkedRiotId) { toast('Set your Riot ID on the Account page first', 'error'); navigate('/account'); return }
    if (!tournamentState.dbTournamentId) { toast('Registration is not open yet', 'error'); return }
    if (linkedPlayer.banned) { toast('Your account is banned from registration', 'error'); return }
    if ((linkedPlayer.dnpCount || 0) >= 3) { toast('You have 3 no-shows. Ask an admin to clear your strikes', 'error'); return }
    if (isRegistered) { toast("You're already registered", 'info'); return }
    if (isWaitlisted) { toast("You're already on the waitlist", 'info'); return }

    var psid = String(linkedPlayer.id)
    if (registeredCount >= maxPlayers) {
      if (setTournamentState) {
        setTournamentState(function(ts) {
          var wl = ts.waitlistIds || []
          if (wl.indexOf(psid) > -1) return ts
          return Object.assign({}, ts, { waitlistIds: wl.concat([psid]) })
        })
      }
      toast(currentUser.username + ' added to waitlist', 'info')
      return
    }

    if (setTournamentState) {
      setTournamentState(function(ts) {
        var ids = ts.registeredIds || []
        return ids.indexOf(psid) > -1 ? ts : Object.assign({}, ts, { registeredIds: ids.concat([psid]) })
      })
    }
    if (supabase.from) {
      supabase.from('registrations').upsert({
        tournament_id: tournamentState.dbTournamentId,
        player_id: linkedPlayer.id,
        status: 'registered'
      }, { onConflict: 'tournament_id,player_id' }).then(function(r) {
        if (r.error) {
          var code = r.error.code || ''
          if (code === '23503' && setTournamentState) {
            // dbTournamentId points to a deleted tournament. Self-heal
            // locally AND server-side via RPC so the staleness doesn't
            // outlive the current session.
            setTournamentState(function(ts) {
              return Object.assign({}, ts, {
                dbTournamentId: null,
                activeTournamentId: null,
                phase: 'idle',
                registeredIds: (ts.registeredIds || []).filter(function(id) { return id !== psid })
              })
            })
            var region = (tournamentState && tournamentState.server === 'NA') ? 'NA' : 'EU'
            if (supabase && supabase.rpc) supabase.rpc('clear_stale_tournament_state', { p_region: region }).then(function() {}).catch(function() {})
            toast('Registration is not open. The clash was reset, please refresh.', 'error')
            return
          }
          toast('Registration failed: ' + (r.error.message || 'unknown'), 'error')
          if (setTournamentState) {
            setTournamentState(function(ts) {
              return Object.assign({}, ts, { registeredIds: (ts.registeredIds || []).filter(function(id) { return id !== psid }) })
            })
          }
        }
      }).catch(function() {
        toast('Registration failed - check your connection', 'error')
      })
    }
    toast(currentUser.username + ' registered for ' + clashName + '!', 'success')
    writeActivityEvent('registration', linkedPlayer.id, currentUser.username + ' registered for ' + clashName)
  }

  function handleUnregister() {
    if (!linkedPlayer) return
    var psid = String(linkedPlayer.id)
    if (setTournamentState) {
      setTournamentState(function(ts) {
        return Object.assign({}, ts, { registeredIds: (ts.registeredIds || []).filter(function(id) { return id !== psid }) })
      })
    }
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('registrations').delete()
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function(r) { if (r.error) toast('Unregister may not have saved', 'error') })
        .catch(function() { toast('Unregister may not have saved', 'error') })
    }
    toast('Unregistered from ' + clashName, 'info')
  }

  function handleCheckIn() {
    if (!linkedPlayer) return
    var psid = String(linkedPlayer.id)
    if (setPlayers) {
      setPlayers(function(ps) {
        return ps.map(function(p) {
          return p.id === linkedPlayer.id ? Object.assign({}, p, { checkedIn: true }) : p
        })
      })
    }
    if (setTournamentState) {
      setTournamentState(function(ts) {
        var ids = ts.checkedInIds || []
        return ids.indexOf(psid) > -1 ? ts : Object.assign({}, ts, { checkedInIds: ids.concat([psid]) })
      })
    }
    if (supabase.from && tournamentState.dbTournamentId) {
      supabase.from('registrations').update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('tournament_id', tournamentState.dbTournamentId)
        .eq('player_id', linkedPlayer.id)
        .then(function(r) { if (r.error) toast('Check-in may not have saved', 'error') })
        .catch(function() { toast('Check-in may not have saved', 'error') })
    }
    toast("You're checked in! Good luck", 'success')
  }

  var phaseLabel = phase === 'registration' ? 'Registration Open' : 'Check-In Open'
  var phaseAccent = phase === 'registration' ? 'text-secondary' : 'text-tertiary'
  var phaseDot = phase === 'registration' ? 'bg-secondary' : 'bg-tertiary'

  var statusCard = null
  if (!currentUser) {
    statusCard = (
      <div className="bg-primary/[0.06] border border-primary/20 rounded-lg p-4 flex items-center gap-4">
        <Icon name="login" size={28} className="text-primary" />
        <div className="flex-1">
          <div className="font-display text-base font-bold text-on-surface">Sign in to compete</div>
          <div className="text-xs text-on-surface-variant mt-1">Free to play, ranked weekly</div>
        </div>
        <Btn variant="primary" size="sm" onClick={function() { navigate('/login') }}>Log In</Btn>
      </div>
    )
  } else if (!linkedPlayer) {
    statusCard = (
      <div className="bg-error/[0.08] border border-error/25 rounded-lg p-4 flex items-center gap-4">
        <Icon name="error" size={28} className="text-error" />
        <div className="flex-1">
          <div className="font-display text-base font-bold text-on-surface">Account not linked</div>
          <div className="text-xs text-on-surface-variant mt-1">Visit Account to link your player profile</div>
        </div>
        <Btn variant="secondary" size="sm" onClick={function() { navigate('/account') }}>Go to Account</Btn>
      </div>
    )
  } else if (!linkedRiotId) {
    statusCard = (
      <div className="bg-primary/[0.06] border border-primary/20 rounded-lg p-4 flex items-center gap-4">
        <Icon name="warning" size={28} className="text-primary" />
        <div className="flex-1">
          <div className="font-display text-base font-bold text-on-surface">Add your {server} Riot ID</div>
          <div className="text-xs text-on-surface-variant mt-1">Required before you can register</div>
        </div>
        <Btn variant="primary" size="sm" onClick={function() { navigate('/account') }}>Open Account</Btn>
      </div>
    )
  } else if (phase === 'registration') {
    if (isRegistered) {
      statusCard = (
        <div className="bg-tertiary/[0.08] border border-tertiary/30 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-tertiary/15 border border-tertiary/30 flex items-center justify-center flex-shrink-0">
              <Icon name="check_circle" size={28} className="text-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-bold text-tertiary leading-tight">You're registered</div>
              <div className="text-sm text-on-surface-variant mt-1">{linkedRiotId} &middot; {server}</div>
              <div className="text-xs text-on-surface-variant/70 mt-2">Check-in opens 30 minutes before clash time. We'll send you a reminder.</div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { if (window.confirm('Unregister from this clash?')) handleUnregister() }}>Unregister</Btn>
            <Btn variant="primary" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>View Standings</Btn>
          </div>
        </div>
      )
    } else if (isWaitlisted) {
      statusCard = (
        <div className="bg-secondary/[0.08] border border-secondary/30 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary/15 border border-secondary/30 flex items-center justify-center flex-shrink-0">
              <Icon name="hourglass_top" size={28} className="text-secondary" />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg font-bold text-secondary leading-tight">Waitlisted - position {waitlistPos}</div>
              <div className="text-xs text-on-surface-variant/70 mt-2">You'll be auto-promoted if a registered player drops.</div>
            </div>
          </div>
        </div>
      )
    } else {
      statusCard = (
        <div className="bg-primary/[0.06] border border-primary/30 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-4">
            <Icon name="how_to_reg" size={32} className="text-primary" />
            <div className="flex-1">
              <div className="font-display text-lg font-bold text-on-surface leading-tight">Ready when you are</div>
              <div className="text-xs text-on-surface-variant mt-1">{linkedRiotId} &middot; {server}</div>
            </div>
          </div>
          <Btn variant="primary" size="lg" className="w-full" onClick={handleRegister}>Register for {clashName}</Btn>
        </div>
      )
    }
  } else if (phase === 'checkin') {
    if (!isRegistered) {
      statusCard = (
        <div className="bg-on-surface/[0.04] border border-outline-variant/15 rounded-lg p-5 text-center">
          <Icon name="block" size={32} className="text-on-surface-variant mb-2" />
          <div className="font-display text-base font-bold text-on-surface">Not registered for this clash</div>
          <div className="text-xs text-on-surface-variant mt-1">Registration closed. Catch the next one.</div>
        </div>
      )
    } else if (isCheckedIn) {
      statusCard = (
        <div className="bg-tertiary/[0.08] border border-tertiary/30 rounded-lg p-5 flex items-center gap-4">
          <Icon name="task_alt" size={32} className="text-tertiary" />
          <div className="flex-1">
            <div className="font-display text-lg font-bold text-tertiary leading-tight">You're checked in</div>
            <div className="text-xs text-on-surface-variant mt-1">Lobbies will be assigned shortly. Stay close.</div>
          </div>
        </div>
      )
    } else {
      statusCard = (
        <div className="bg-tertiary/[0.06] border border-tertiary/30 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-4">
            <Icon name="fact_check" size={32} className="text-tertiary" />
            <div className="flex-1">
              <div className="font-display text-lg font-bold text-on-surface leading-tight">Check in to lock your seat</div>
              <div className="text-xs text-on-surface-variant mt-1">Anyone not checked in by start time forfeits their slot</div>
            </div>
          </div>
          <Btn variant="primary" size="lg" className="w-full" onClick={handleCheckIn}>Check In Now</Btn>
        </div>
      )
    }
  }

  function openProfile(player) {
    if (setProfilePlayer && setScreen) {
      setProfilePlayer(player)
      setScreen('profile')
    } else if (player && (player.username || player.name)) {
      navigate('/player/' + (player.username || player.name))
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col gap-6">

      {/* Hero panel: clash title + countdown */}
      <Panel padding="spacious">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={'w-2 h-2 rounded-full ' + phaseDot} />
          <span className={'font-label text-[10px] uppercase tracking-[0.18em] font-bold ' + phaseAccent}>{phaseLabel}</span>
          {tournamentState.isFinale && (
            <span className="font-label text-[10px] uppercase tracking-[0.18em] font-bold text-medal-gold bg-medal-gold/[0.1] border border-medal-gold/30 rounded px-2 py-0.5 inline-flex items-center gap-1">
              <Icon name="emoji_events" size={10} /> Season Finale
            </span>
          )}
        </div>
        <div className="font-display text-3xl sm:text-4xl tracking-tight text-on-surface mb-1">{clashName}</div>
        <div className="text-sm text-on-surface-variant mb-5">{server} server &middot; {tournamentState.totalGames || 4} games &middot; {maxPlayers} player cap</div>
        {hasCountdown && (
          <div className="bg-on-surface/[0.04] border border-outline-variant/10 rounded-lg p-4 mb-1">
            <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">{phase === 'registration' ? 'Registration closes in' : 'Clash starts in'}</div>
            <CountdownTimer targetDate={clashTimestamp} />
          </div>
        )}
        {Array.isArray(tournamentState.prizePool) && tournamentState.prizePool.length > 0 && (
          <div className="mt-4">
            <PrizePoolCard prizes={tournamentState.prizePool} sponsors={ctx.orgSponsors} />
          </div>
        )}
        {tournamentState.rulesOverride && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-tertiary/[0.06] border border-tertiary/25 text-xs text-on-surface">
            <span className="font-label text-[10px] uppercase tracking-widest font-bold text-tertiary mr-2">Note</span>
            {tournamentState.rulesOverride}
          </div>
        )}
      </Panel>

      {/* Status card - user-specific */}
      {statusCard}

      {/* Capacity panel */}
      <Panel>
        <div className="flex items-baseline justify-between mb-3">
          <div className="font-display text-base font-bold text-on-surface">Registered field</div>
          <div className="font-mono text-sm text-on-surface-variant">{registeredCount} / {maxPlayers}</div>
        </div>
        <div className="w-full bg-on-surface/[0.06] rounded-full h-2 overflow-hidden mb-1">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
            style={{ width: capacityPct + '%' }}
          />
        </div>
        <div className="text-[10px] text-on-surface-variant uppercase font-label tracking-widest">
          {capacityPct >= 100 ? 'Full - waitlist active' : capacityPct >= 75 ? 'Filling fast' : 'Plenty of seats left'}
          {phase === 'checkin' && ' \u00b7 ' + checkedInCount + ' checked in'}
        </div>
      </Panel>

      {/* Roster panel */}
      <Panel>
        <div className="flex items-baseline justify-between mb-4">
          <div className="font-display text-base font-bold text-on-surface">Who's in</div>
          {waitlistIds.length > 0 && (
            <div className="text-[10px] uppercase tracking-widest font-label text-on-surface-variant">{waitlistIds.length} on waitlist</div>
          )}
        </div>
        {registeredRoster.length === 0 ? (
          <div className="text-center py-6">
            <Icon name="group_off" size={32} className="text-on-surface-variant/40 mb-2" />
            <div className="text-sm text-on-surface-variant">Be the first to register</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {registeredRoster.map(function(p, idx) {
              var isMe = linkedPlayer && p.id === linkedPlayer.id
              var rosterCheckedIn = checkedInIds.indexOf(String(p.id)) > -1
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={function() { openProfile(p) }}
                  className={'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left border transition-colors cursor-pointer ' + (isMe ? 'bg-primary/[0.08] border-primary/30' : 'bg-on-surface/[0.03] border-outline-variant/10 hover:bg-on-surface/[0.06]')}
                >
                  <div className={'w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 ' + (isMe ? 'bg-primary/20 text-primary' : 'bg-on-surface/[0.06] text-on-surface-variant')}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={'text-sm font-bold truncate ' + (isMe ? 'text-primary' : 'text-on-surface')}>
                      {p.name || p.username}{isMe ? ' (you)' : ''}
                    </div>
                    <div className="text-[10px] text-on-surface-variant truncate">
                      {(p.rank || 'Unranked')} &middot; {(p.pts || 0)} pts &middot; {(p.wins || 0)} wins
                    </div>
                  </div>
                  {rosterCheckedIn && (
                    <Icon name="check_circle" size={16} className="text-tertiary flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Panel>

    </div>
  )
}

// ---- ClashScreen (main, phase-adaptive) ----

function ClashScreen(props) {
  var navigate = useNavigate()
  var linkedPlayer = (props.players || []).find(function(p) {
    return props.currentUser && p.name === (props.currentUser.username || props.currentUser.name)
  }) || null
  var tournamentState = props.tournamentState || {}
  var phase = tournamentState.phase;
  if (!phase || phase === 'idle') {
    return <PageLayout><ClashIdleView players={props.players} currentUser={props.currentUser} linkedPlayer={linkedPlayer} navigate={navigate} pastClashes={props.pastClashes} /></PageLayout>
  }

  // Registration / check-in get a clean modern view; fall through to live/complete legacy below
  if (phase === 'registration' || phase === 'checkin') {
    return <PageLayout><ClashLobbyView
      phase={phase}
      tournamentState={tournamentState}
      players={props.players || []}
      currentUser={props.currentUser}
      linkedPlayer={linkedPlayer}
      setPlayers={props.setPlayers}
      setTournamentState={props.setTournamentState}
      toast={props.toast}
      setProfilePlayer={props.setProfilePlayer}
      setScreen={props.setScreen}
      navigate={navigate}
    /></PageLayout>
  }

  // Live phases: render the live dashboard. Bracket details live at /bracket.
  if (phase === 'live' || phase === 'inprogress') {
    return <ClashLiveDashboard />
  }

  var recapData = phase === "complete" ? generateRecap(props.tournamentState) : null;
  var recapEl = recapData ? <ClashRecap recap={recapData} toast={props.toast} /> : null;

  // Awards computation for complete phase
  var awardsEl = null;
  if (phase === "complete" && props.tournamentState && props.tournamentState.finalStandings && props.tournamentState.finalStandings.length > 0) {
    var fs = props.tournamentState.finalStandings;
    var mvpPlayer = fs.reduce(function(best, p) { return ((p.points || p.pts || 0) > (best.points || best.pts || 0)) ? p : best; }, fs[0]);
    var comebackPlayer = null;
    var bestClimb = -Infinity;
    fs.forEach(function(p, idx) {
      if (p.game1Pos) { var climb = p.game1Pos - (idx + 1); if (climb > bestClimb) { bestClimb = climb; comebackPlayer = p; } }
    });
    var clutchPlayer = null;
    var bestLastGame = Infinity;
    fs.forEach(function(p) {
      var lp = p.lastGamePlace || p.lastPlace || null;
      if (lp !== null && lp < bestLastGame) { bestLastGame = lp; clutchPlayer = p; }
    });
    var awardsList = [
      { icon: "emoji_events", label: "MVP", name: mvpPlayer ? mvpPlayer.username || mvpPlayer.name : "", color: "#E8A838" },
      comebackPlayer && bestClimb >= 2 ? { icon: "trending_up", label: "Comeback King", name: comebackPlayer.username || comebackPlayer.name, color: "#6EE7B7" } : null,
      clutchPlayer ? { icon: "bolt", label: "Clutch Player", name: clutchPlayer.username || clutchPlayer.name, color: "#C4B5FD" } : null,
    ].filter(Boolean);
    awardsEl = (
      <div className="mx-4 mb-5">
        <div className="font-label text-[10px] uppercase tracking-[.12em] text-[#9AAABF] font-bold mb-2.5">Awards</div>
        <div className="flex gap-2 flex-wrap">
          {awardsList.map(function(a, i) {
            return (
              <div key={a.label} className="flex items-center gap-2 px-3.5 py-2 rounded-lg min-w-0" style={{
                background: "rgba(17,24,39,.8)",
                border: "1px solid rgba(" + hexToRgb(a.color) + ",.2)",
                flex: "1 1 140px"
              }}>
                <Icon name={a.icon} style={{ fontSize: 18, color: a.color, flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="font-label text-[10px] font-bold uppercase tracking-widest" style={{ color: a.color }}>{a.label}</div>
                  <div className="text-[13px] font-bold text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">{a.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <div className="fade-up">
        {/* Complete phase: your finish, awards, recap, results */}
        {phase === "complete" && (
          <>
            <YourFinishCard currentUser={props.currentUser} finalStandings={props.tournamentState.finalStandings || []} />
            {awardsEl}
            {recapEl}
            <MemoResultsScreen players={props.players} toast={props.toast} setScreen={props.setScreen} setProfilePlayer={props.setProfilePlayer} tournamentState={props.tournamentState} pastClashes={props.pastClashes} />
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default ClashScreen;
