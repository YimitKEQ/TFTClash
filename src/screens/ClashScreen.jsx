import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import CountdownTimer from '../components/shared/CountdownTimer';
import { getNextSaturday } from '../lib/useCountdown';
import { RANKS, RCOLS, REGIONS, PTS, PAST_CLASHES, SEED, CLASH_RANKS, XP_REWARDS, HOMIES_IDS, TIER_FEATURES } from '../lib/constants.js';
import { computeStats, getStats, effectivePts, tiebreaker, computeClashAwards, generateRecap, getClashRank, getXpProgress, estimateXp, isHotStreak, isOnTilt, isComebackEligible, getAttendanceStreak, computeSeasonBonuses, checkAchievements, syncAchievements } from '../lib/stats.js';
import { TOURNAMENT_FORMATS, buildLobbies, computeTournamentStandings, applyCutLine } from '../lib/tournament.js';
import { ordinal, rc, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js';
import { writeActivityEvent, createNotification } from '../lib/notifications.js';
import { useApp } from '../context/AppContext';
import { Panel, Btn, Icon, Tag, Inp, Divider, Skeleton } from '../components/ui';
import RankBadge from '../components/shared/RankBadge';

// ---- TIER THRESHOLDS (local, used by StandingsTable) ----

var TIER_THRESHOLDS = [
  { name: 'Champion', minRank: 1, maxRank: 1, color: '#E8A838', icon: 'crown' },
  { name: 'Challenger', minRank: 2, maxRank: 3, color: '#9B72CF', icon: 'diamond' },
  { name: 'Contender', minRank: 4, maxRank: 8, color: '#4ECDC4', icon: 'shield' }
];

// ---- Sel (local select wrapper) ----

function Sel(props) {
  var value = props.value;
  var onChange = props.onChange;
  var children = props.children;
  var style = props.style;
  return (
    <div style={Object.assign({ position: "relative" }, style && style.width ? { width: style.width } : {})}>
      <select value={value} onChange={function(e) { onChange(e.target.value); }}
        style={Object.assign({
          width: "100%", background: "#141E30",
          border: "1px solid rgba(242,237,228,.11)",
          borderRadius: 8, padding: "12px 36px 12px 14px",
          color: "#F2EDE4", fontSize: 15, minHeight: 46,
          appearance: "none", cursor: "pointer"
        }, style || {})}>
        {children}
      </select>
      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#BECBD9", fontSize: 11 }}>&#9660;</div>
    </div>
  );
}

// ---- hexToRgb helper ----

function hexToRgb(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return r + "," + g + "," + b;
}

// ---- Sparkline (mini chart) ----

function Sparkline(props) {
  var data = props.data;
  var color = props.color;
  var w = props.w;
  var h = props.h;
  if (!data || data.length < 2) return null;
  var W = typeof w === "number" ? w : 80;
  var H = h || 28;
  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min || 1;
  var pts = data.map(function(v, i) {
    return (i / (data.length - 1)) * W + "," + (H - ((v - min) / range) * (H - 4) + 2);
  }).join(" ");
  var fill = pts + " " + W + "," + H + " 0," + H;
  var gid = "sg" + (color || "gold").replace(/[^a-z0-9]/gi, "");
  return (
    <svg width={W} height={H} style={{ overflow: "visible", flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color || "#E8A838"} stopOpacity=".3" />
          <stop offset="100%" stopColor={color || "#E8A838"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill={"url(#" + gid + ")"} />
      <polyline points={pts} fill="none" stroke={color || "#E8A838"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * W} cy={H - ((data[data.length - 1] - min) / range) * (H - 4) + 2} r="2.5" fill={color || "#E8A838"} />
    </svg>
  );
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
  if (n === 0) return <span className="mono" style={{ fontSize: 13, color: "#BECBD9" }}>-</span>;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: c }}>{n.toFixed(2)}</span>
      <div style={{ width: 28, height: 3, background: "#1C2030", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: Math.max(0, ((8 - n) / 7) * 100) + "%", background: c, borderRadius: 99 }} />
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
    <div style={{ height: h || 3, background: "#1C2030", borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: pct + "%", background: color || "linear-gradient(90deg,#E8A838,#D4922A)", borderRadius: 99, transition: "width .7s ease" }} />
    </div>
  );
}

// ---- Dot ----

function Dot(props) {
  var c = props.color || "#52C47C";
  var s = props.size || 7;
  return <div style={{ width: s, height: s, borderRadius: "50%", background: c, animation: "blink 2s infinite", flexShrink: 0 }} />;
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
    <div style={{ display: "inline-flex", flexDirection: showProgress ? "column" : "row", alignItems: showProgress ? "stretch" : "center", gap: showProgress ? 4 : 5 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: rank.color + "18", border: "1px solid " + rank.color + "44",
        borderRadius: sm ? 6 : 8, padding: sm ? "2px 7px" : "4px 10px"
      }}>
        <Icon name={rank.icon || "military_tech"} style={{ fontSize: sm ? 12 : 15, color: rank.color }} />
        <span style={{ fontSize: sm ? 10 : 12, fontWeight: 700, color: rank.color, letterSpacing: ".04em" }}>{rank.name}</span>
      </div>
      {showProgress && next && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "#BECBD9" }}>{current} / {needed} XP</span>
            <span style={{ fontSize: 10, color: rank.color, fontWeight: 700 }}>{pct}%</span>
          </div>
          <Bar val={current} max={needed} color={rank.color} h={4} />
          <div style={{ fontSize: 10, color: "#9AAABF", marginTop: 3 }}>Next: <Icon name={next.icon || "military_tech"} style={{ fontSize: 10, color: next.color }} /> {next.name}</div>
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
    <div className="relative overflow-hidden rounded-[14px] mx-4 mb-5 p-5" style={{ background: "rgba(17,24,39,.8)", border: "1px solid rgba(52,211,153,.15)" }}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,transparent,#34D399,transparent)" }} />
      <div className="font-condensed text-[10px] uppercase tracking-[.12em] font-bold mb-[10px]" style={{ color: "#34D399" }}>{recap.clashName + " Recap"}</div>
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
        }}><Icon name="content_paste" style={{ marginRight: 4 }} />Copy for Discord</Btn>
        <Btn v="ghost" s="sm" onClick={function() {
          var text = recap.clashName + " Recap\n\n" + recap.lines.join("\n") + "\n\ntftclash.com";
          if (navigator.share) { navigator.share({ title: recap.clashName + " Recap", text: text }).catch(function() {}); }
          else { navigator.clipboard.writeText(text); if (props.toast) props.toast("Recap copied to clipboard!", "success"); }
        }}><Icon name="share" style={{ marginRight: 4 }} />Share Card</Btn>
      </div>
    </div>
  );
}

// ---- AwardCard ----

function AwardCard(props) {
  var award = props.award;
  var onClick = props.onClick;
  // Map old tabler icon names to Material Symbols
  var iconMap = {
    "trophy-fill": "emoji_events",
    "award-fill": "military_tech",
    "flame": "local_fire_department",
    "trending-up": "trending_up",
    "target": "target",
    "bolt": "bolt",
    "star-fill": "star",
    "diamond": "diamond",
    "crown": "crown",
    "shield": "shield",
    "heart": "favorite",
    "swords": "sports_esports"
  };
  var iconName = iconMap[award.icon] || award.icon || "military_tech";
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,.02)", border: "1px solid rgba(242,237,228,.08)",
      borderRadius: 12, padding: "18px", cursor: onClick ? "pointer" : "default", transition: "all .2s"
    }}
      onMouseEnter={function(e) { if (onClick) { e.currentTarget.style.borderColor = award.color + "66"; e.currentTarget.style.background = "rgba(255,255,255,.04)"; } }}
      onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(242,237,228,.08)"; e.currentTarget.style.background = "rgba(255,255,255,.02)"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, background: award.color + "18",
          border: "1px solid " + award.color + "44", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
        }}>
          <Icon name={iconName} style={{ color: award.color }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4" }}>{award.title}</div>
          <div style={{ fontSize: 11, color: "#BECBD9", marginTop: 1 }}>{award.desc}</div>
        </div>
      </div>
      {award.winner && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0F1520", borderRadius: 9, border: "1px solid rgba(242,237,228,.06)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: award.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{award.winner.name}</div>
            <div style={{ fontSize: 11, color: "#BECBD9" }}>{award.winner.rank} - {award.winner.region}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: award.color }}>{award.stat}</div>
          </div>
        </div>
      )}
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 }}>
      <Panel danger style={{ width: "100%", maxWidth: 460, padding: "24px" }}>
        <div style={{ marginTop: 6 }}>
          <div className="cond" style={{ fontSize: 16, fontWeight: 800, color: "#F87171", marginBottom: 4, letterSpacing: ".08em", textTransform: "uppercase" }}>
            <Icon name="flag" style={{ fontSize: 14, marginRight: 4 }} />File Dispute
          </div>
          <div style={{ fontSize: 13, color: "#C8D4E0", marginBottom: 20 }}>
            Flagging <span style={{ color: "#F2EDE4", fontWeight: 700 }}>{targetPlayer}</span> - claimed <span style={{ color: "#E8A838", fontWeight: 800, fontFamily: "'Inter',sans-serif" }}>#{claimPlacement}</span>
          </div>
          <label style={{ display: "block", fontSize: 11, color: "#C8D4E0", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Reason <span style={{ color: "#F87171" }}>*</span></label>
          <Inp value={reason} onChange={setReason} placeholder="Why is this placement wrong?" style={{ marginBottom: 14 }} />
          <label style={{ display: "block", fontSize: 11, color: "#C8D4E0", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Screenshot URL (optional)</label>
          <Inp value={url} onChange={setUrl} placeholder="https://imgur.com/..." style={{ marginBottom: 20 }} />
          <div style={{ display: "flex", gap: 10 }}>
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
    <div style={{ background: "rgba(127,29,29,.95)", border: "1px solid rgba(220,38,38,.6)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, animation: "disp-anim 2s infinite" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}><Icon name="error" style={{ color: "#F87171" }} /></span>
        <div className="cond" style={{ fontSize: 14, fontWeight: 800, color: "#FCA5A5", letterSpacing: ".1em", textTransform: "uppercase" }}>LOCKED - {disputes.length} Dispute{disputes.length > 1 ? "s" : ""}</div>
      </div>
      {disputes.map(function(d, i) {
        return (
          <div key={d.target + '-' + d.placement} style={{ fontSize: 13, color: "#FCA5A5", marginBottom: 8, padding: "10px 12px", background: "rgba(0,0,0,.35)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontWeight: 700, color: "#F2EDE4" }}>{d.target}</span> {"->"} <span style={{ color: "#E8A838", fontWeight: 700 }}>#{d.placement}</span>
                <div style={{ marginTop: 3, color: "#FECACA", fontSize: 12 }}>"{d.reason}"</div>
              </div>
              {isAdmin && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Btn s="sm" v="success" onClick={function() { onResolve(i, "accept"); }}>
                    <Icon name="check" style={{ fontSize: 14 }} /> Accept
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="cond" style={{ fontSize: 10, fontWeight: 700, color: "#BECBD9", letterSpacing: ".12em", textTransform: "uppercase" }}>Placements</span>
        <span className="mono" style={{ fontSize: 12, color: allSet ? "#6EE7B7" : "#BECBD9" }}>
          <span style={{ color: allSet ? "#6EE7B7" : "#E8A838", fontWeight: 700 }}>{placed}</span>/{roster.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {roster.map(function(p) {
          var got = results[p.id];
          var isWin = got === 1;
          var isTop4 = got && got <= 4;
          return (
            <div key={p.id} style={{
              background: got ? (isWin ? "rgba(232,168,56,.08)" : isTop4 ? "rgba(78,205,196,.05)" : "rgba(255,255,255,.02)") : "rgba(255,255,255,.02)",
              border: "1px solid " + (got ? (isWin ? "rgba(232,168,56,.35)" : isTop4 ? "rgba(78,205,196,.2)" : "rgba(242,237,228,.08)") : "rgba(242,237,228,.08)"),
              borderRadius: 10, padding: "10px 12px", transition: "all .15s"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: locked ? 0 : 10 }}>
                {got && <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: isWin ? "#E8A838" : isTop4 ? "#4ECDC4" : "#BECBD9", lineHeight: 1, minWidth: 22, textAlign: "center" }}>{got}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ display: "flex", gap: 5, marginTop: 2 }}></div>
                </div>
                {got && !locked && (
                  <button onClick={function() { setDisputeTarget(p); }} style={{
                    background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.35)",
                    borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#F87171",
                    cursor: "pointer", fontWeight: 700, flexShrink: 0, minHeight: 34
                  }}>FLAG</button>
                )}
              </div>
              {!locked && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 3 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 2, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(242,237,228,.06)" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(function(place) {
          var who = roster.find(function(p) { return results[p.id] === place; });
          return (
            <div key={place} style={{ background: "#1C2030", borderRadius: 5, padding: "4px 3px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 9, fontWeight: 700, color: place === 1 ? "#E8A838" : place <= 4 ? "#4ECDC4" : "#9AAABF" }}>{place}</div>
              <div style={{ fontSize: 9, color: who ? "#C8BFB0" : "#7A8BA0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{who ? who.name.substring(0, 5) : "-"}</div>
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

  return (
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center"
      style={{ background: "rgba(8,8,15,.85)", backdropFilter: "blur(8px)" }}
      onClick={props.onClose}
    >
      <div
        className="rounded-2xl p-6 overflow-y-auto"
        style={{ background: "#111827", border: "1px solid rgba(155,114,207,.2)", maxWidth: 420, width: "90%", maxHeight: "80vh" }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <h3 className="font-editorial mb-4" style={{ color: "#F2EDE4" }}>Submit Results</h3>
        {rankings.map(function(r, i) {
          return (
            <div key={r.player.username || r.player.name || r.player} className="flex items-center gap-[10px] mb-2">
              <span className="flex-1 text-[13px]" style={{ color: "#F2EDE4" }}>{r.player.username || r.player.name || r.player}</span>
              <select
                value={r.position}
                onChange={function(e) { handlePositionChange(i, e.target.value); }}
                style={{ padding: "6px 10px", borderRadius: 6, background: "#08080F", border: "1px solid rgba(242,237,228,.1)", color: "#F2EDE4", fontSize: 13 }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map(function(pos) {
                  return <option key={pos} value={pos}>{ordinal(pos)}</option>;
                })}
              </select>
            </div>
          );
        })}
        <div className="flex gap-[10px] mt-4">
          <Btn v="primary" onClick={function() { props.onSubmit(rankings); }}>Submit</Btn>
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
        className="rounded-2xl p-6"
        style={{ background: "#111827", border: "1px solid rgba(78,205,196,.2)", maxWidth: 420, width: "90%" }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <h3 className="font-editorial mb-1" style={{ color: "#F2EDE4" }}>Confirm Results?</h3>
        <p className="text-[12px] mb-4" style={{ color: "#9AAABF" }}>{"Submitted by " + (submission.submittedBy || "unknown")}</p>
        {(submission.rankings || []).map(function(r, i) {
          return (
            <div key={r.player.username || r.player.name || r.player} className="flex items-center gap-[10px] py-[6px]" style={{ borderBottom: "1px solid rgba(242,237,228,.04)" }}>
              <span className="text-[12px] font-bold w-7" style={{ color: i < 3 ? ["#E8A838", "#C0C0C0", "#CD7F32"][i] : "#BECBD9" }}>{ordinal(r.position)}</span>
              <span className="text-[13px]" style={{ color: "#F2EDE4" }}>{r.player.username || r.player.name || r.player}</span>
            </div>
          );
        })}
        <div className="flex gap-[10px] mt-4">
          <Btn v="primary" onClick={props.onConfirm}><Icon name="check" style={{ marginRight: 4 }} />Confirm</Btn>
          <Btn v="ghost" style={{ borderColor: "rgba(248,113,113,.3)", color: "#F87171" }} onClick={props.onDispute}><Icon name="flag" style={{ marginRight: 4 }} />Dispute</Btn>
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
      <div style={{ padding: "12px 14px", background: "#0A0F1A", borderBottom: "1px solid rgba(242,237,228,.07)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: locked ? "rgba(82,196,124,.1)" : "rgba(232,168,56,.1)",
            border: "1px solid " + (locked ? "rgba(82,196,124,.3)" : "rgba(232,168,56,.28)"),
            borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: locked ? "#6EE7B7" : "#E8A838",
            fontFamily: "'Inter',sans-serif", flexShrink: 0
          }}>
            {lbl}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4" }}>{isFinals ? "Grand Finals" : lobbyNum !== undefined ? "Lobby " + (lobbyNum + 1) + " - R" + round : "Round " + round}</div>
            <div style={{ fontSize: 12, color: "#BECBD9" }}>Host: <span style={{ color: "#E8A838", fontWeight: 600 }}>{host && host.name ? host.name : "-"}</span></div>
          </div>
          {locked ? <Tag color="#52C47C"><Icon name="check_circle" style={{ fontSize: 11, marginRight: 3 }} />Locked</Tag>
            : paused ? <Tag color="#EAB308"><Icon name="pause" style={{ fontSize: 11, marginRight: 3 }} />Paused</Tag>
            : <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", background: "rgba(82,196,124,.08)", border: "1px solid rgba(82,196,124,.25)", borderRadius: 20 }}><Dot /><span className="cond" style={{ fontSize: 9, fontWeight: 700, color: "#6EE7B7", letterSpacing: ".1em", textTransform: "uppercase" }}>Live</span></div>
          }
        </div>
      </div>
      <div style={{ padding: "14px" }}>
        <DisputeBanner disputes={disputes} onResolve={function(idx, action) { setDisputes(function(d) { return d.filter(function(_, i) { return i !== idx; }); }); toast(action === "accept" ? "Result stands" : "Override applied", "success"); }} isAdmin={isAdmin} />
        <PlacementBoard roster={roster} results={results}
          onPlace={function(pid, place) { if (!locked && !paused) setResults(function(r) { return Object.assign({}, r, { [pid]: place }); }); }}
          locked={locked} onFlag={function(d) { setDisputes(function(ds) { return [].concat(ds, [d]); }); }} isAdmin={isAdmin} />
        {!locked && (
          <div style={{ marginTop: 14 }}>
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
      <span onClick={function() { toggle(k); }} className="cond" style={{
        fontSize: 10, fontWeight: 700, color: sortKey === k ? "#E8A838" : "#9AAABF",
        letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap"
      }}>
        {label}{sortKey === k ? (asc ? " \u2191" : " \u2193") : ""}
      </span>
    );
  }

  return (
    <Panel style={{ overflowX: "auto" }}>
      <div className="standings-table-wrap" style={{ minWidth: compact ? 260 : 380 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, padding: "9px 14px", borderBottom: "1px solid rgba(242,237,228,.07)", background: "#0A0F1A" }}>
          <span className="cond" style={{ fontSize: 10, fontWeight: 700, color: "#9AAABF", letterSpacing: ".1em" }}>#</span>
          <HeaderCell k="name" label="Player" /><HeaderCell k="pts" label="Pts" /><HeaderCell k="avg" label="Avg" /><HeaderCell k="games" label="G" />
          {!compact && <HeaderCell k="wins" label="W" />}
          <span className="cond" style={{ fontSize: 10, fontWeight: 700, color: "#9AAABF", letterSpacing: ".1em" }}>Trend</span>
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
              <Icon name={p.last_clash_rank > (i + 1) ? "arrow_upward" : "arrow_downward"} style={{ fontSize: 9 }} />
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
              <div className="mono rank-num" style={{
                fontSize: top3 ? 18 : 13, fontWeight: 900, color: rankCol, minWidth: 24, textAlign: "center",
                textShadow: i === 0 ? "0 0 18px rgba(232,168,56,.8)" : i === 1 ? "0 0 12px rgba(192,192,192,.6)" : i === 2 ? "0 0 12px rgba(205,127,50,.6)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {i < 3 ? <Icon name="military_tech" style={{ color: rankCol }} /> : i + 1}
                {deltaNode}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: top3 ? 700 : 500, fontSize: top3 ? 15 : 13, color: nameCol, display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    {p.plan === "pro" && <span style={{ fontSize: 9, fontWeight: 800, color: "#E8A838", background: "rgba(232,168,56,.15)", padding: "1px 5px", borderRadius: 4, flexShrink: 0, letterSpacing: ".04em" }}>PRO</span>}
                    {p.plan === "host" && <span style={{ fontSize: 9, fontWeight: 800, color: "#9B72CF", background: "rgba(155,114,207,.15)", padding: "1px 5px", borderRadius: 4, flexShrink: 0, letterSpacing: ".04em" }}>HOST</span>}
                    {isHotStreak(p) && <span title={"Win streak: " + (p.currentStreak || 0)} style={{ flexShrink: 0, fontSize: 14, cursor: "default" }}><Icon name="local_fire_department" style={{ color: "#F97316" }} /></span>}
                    {isOnTilt(p) && <span title={"Cold streak: " + (p.tiltStreak || 0)} style={{ flexShrink: 0, fontSize: 14, cursor: "default" }}><Icon name="ac_unit" style={{ color: "#38BDF8" }} /></span>}
                  </div>
                  {!compact && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <ClashRankBadge xp={estimateXp(p)} size="sm" />
                    <span className="mono" style={{ fontSize: 11, color: "#B8C8D8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.riotId}</span>
                  </div>}
                </div>
              </div>
              <div className="mono pts-glow count-up" style={{ fontSize: top3 ? 22 : 15, fontWeight: 800, color: ptsCol, lineHeight: 1, textShadow: top3 ? "0 0 14px currentColor" : "none", animationDelay: (i * 0.03 + 0.1) + "s" }}>
                {useEffective ? effectivePts(p, seasonConfig) : p.pts}
              </div>
              <AvgBadge avg={avg > 0 ? avg : null} />
              <div className="mono" style={{ fontSize: 11, color: top8 ? "#BECBD9" : "#9AAABF" }}>{p.games || 0}</div>
              {!compact && <div className="mono" style={{ fontSize: 13, color: top3 ? "#6EE7B7" : top8 ? "#6EE7B7" : "#8896A8" }}>{p.wins || 0}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {sparkData.length >= 2 ? <Sparkline data={sparkData} w={50} h={16} color="#9B72CF" /> : null}
                <FormDots history={(p.clashHistory || []).slice(-5)} />
              </div>
            </div>
          );

          return <React.Fragment key={"frag-" + i}>{tierLine}{rowEl}</React.Fragment>;
        })}
        {rows.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#8E9BB0", fontSize: 14 }}>No data yet</div>}
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
    <div className="rounded-xl overflow-hidden mx-4 mb-5" style={{ background: "rgba(8,8,15,.6)", border: "1px solid rgba(242,237,228,.06)" }}>
      <div className="grid px-[14px] py-2 font-condensed text-[10px] uppercase tracking-[.06em]" style={{ gridTemplateColumns: "36px 1fr 60px 50px", color: "#9AAABF", borderBottom: "1px solid rgba(242,237,228,.04)" }}>
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
            <span style={{ color: isFirst ? "#E8A838" : "#BECBD9", fontWeight: isFirst ? 700 : 400 }}>
              {isFirst ? "\ud83d\udc51" : String(i + 1)}
            </span>
            <span className="flex items-center gap-[6px]" style={{ color: "#F2EDE4", fontWeight: isFirst ? 700 : 500 }}>
              {p.username || p.name}
              {posChange !== 0 ? (
                <span className="text-[10px]" style={{ color: posChange > 0 ? "#6EE7B7" : "#F87171" }}>
                  {posChange > 0 ? "\u25b2" + posChange : "\u25bc" + Math.abs(posChange)}
                </span>
              ) : null}
            </span>
            <span className="text-right font-bold" style={{ color: isFirst ? "#E8A838" : "#F2EDE4" }}>{p.points || 0}</span>
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
        <div className="font-condensed text-[10px] uppercase tracking-[.1em] mb-1" style={{ color: "#9AAABF" }}>Your Finish</div>
        <div className="font-editorial text-[24px] font-black" style={{ color: "#9B72CF" }}>
          {found.position <= 3 ? (medals[found.position - 1] + " ") : ""}
          {"#" + found.position}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[22px] font-bold" style={{ color: "#E8A838" }}>{(found.points || found.pts || 0) + " pts"}</div>
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
    <Panel style={{ padding: "20px", marginTop: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#E8A838", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}><Icon name="bar_chart" /></span> Live Standings - Game {round}/{totalGames}
        <span style={{ fontSize: 11, color: "#BECBD9", fontWeight: 400, marginLeft: 4 }}>({lockedCount} of {lobbies.length} {lobbies.length === 1 ? "lobby" : "lobbies"} locked)</span>
      </div>
      {showCutLine && (
        <div style={{ fontSize: 11, color: "#E8A838", marginBottom: 10, padding: "4px 10px", background: "rgba(232,168,56,.06)", borderRadius: 4, border: "1px solid rgba(232,168,56,.12)" }}>Cut line: {cutLine} pts - players at or below are eliminated after Game {cutAfterGame}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {liveRows.map(function(row, ri) {
          var isLeader = ri === 0 && row.earned > 0;
          var belowCut = showCutLine && row.earned <= cutLine;
          var nearCut = showCutLine && !belowCut && row.earned <= cutLine + 3;
          return (
            <div key={row.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
              background: belowCut ? "rgba(248,113,113,.06)" : isLeader ? "rgba(232,168,56,.07)" : ri % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent",
              borderRadius: 6, border: belowCut ? "1px solid rgba(248,113,113,.2)" : isLeader ? "1px solid rgba(232,168,56,.18)" : "1px solid transparent", opacity: belowCut ? 0.6 : 1
            }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: belowCut ? "#F87171" : ri === 0 ? "#E8A838" : ri === 1 ? "#C0C0C0" : ri === 2 ? "#CD7F32" : "#9AAABF", minWidth: 22, textAlign: "center" }}>{ri + 1}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isLeader ? 700 : 500, color: belowCut ? "#F87171" : isLeader ? "#E8A838" : "#F2EDE4" }}>{row.name}</span>
              {belowCut && <span style={{ fontSize: 9, fontWeight: 700, color: "#F87171", background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.25)", borderRadius: 3, padding: "1px 6px", textTransform: "uppercase" }}>Cut</span>}
              {nearCut && <span style={{ fontSize: 10, fontWeight: 700, color: "#E8A838", background: "rgba(232,168,56,.1)", border: "1px solid rgba(232,168,56,.2)", borderRadius: 3, padding: "1px 6px" }}>Bubble</span>}
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: belowCut ? "#F87171" : row.earned > 0 ? "#6EE7B7" : "#9AAABF" }}>{row.earned > 0 ? "+" + row.earned : " - "} pts</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---- PlacementDistribution ----

function PlacementDistribution(props) {
  var history = props.history || [];
  if (history.length === 0) return null;
  var counts = [0, 0, 0, 0, 0, 0, 0, 0];
  history.forEach(function(h) {
    var games = h.games || [];
    games.forEach(function(g) {
      if (g.placement >= 1 && g.placement <= 8) counts[g.placement - 1]++;
    });
  });
  var total = counts.reduce(function(s, c) { return s + c; }, 0);
  if (total === 0) return null;
  var colors = ["#E8A838", "#C0C0C0", "#CD7F32", "#9B72CF", "#4ECDC4", "#6B7B8F", "#4A5568", "#2D3748"];
  return (
    <div className="mb-4">
      <div className="cond text-[10px] font-bold uppercase tracking-[.12em] mb-[6px]" style={{ color: "#9AAABF" }}>Placement Distribution</div>
      <div className="flex h-5 rounded-[6px] overflow-hidden" style={{ background: "rgba(255,255,255,.04)" }}>
        {counts.map(function(c, i) {
          var pct = total > 0 ? (c / total * 100) : 0;
          if (pct === 0) return null;
          return (
            <div
              key={"pbar-" + (i + 1)}
              title={ordinal(i + 1) + ": " + c + " (" + Math.round(pct) + "%)"}
              style={{ width: pct + "%", background: colors[i], transition: "width .5s ease" }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {counts.map(function(c, i) {
          return (
            <div key={"plabel-" + (i + 1)} className="text-center flex-1 text-[10px] font-semibold" style={{ color: c > 0 ? colors[i] : "#4A5568" }}>
              {ordinal(i + 1)}
            </div>
          );
        })}
      </div>
    </div>
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
    <div style={{ padding: "20px", color: "#BECBD9", fontSize: 14, textAlign: "center" }}>No detailed data for this clash yet.</div>
  );

  return (
    <div>
      <div style={{ overflowX: "auto", marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
          <thead>
            <tr style={{ background: "#0A0F1A" }}>
              {["#", "Player", "R1", "R2", "R3", "Finals", "Clash Pts"].map(function(h) {
                return (
                  <th key={h} className="cond" style={{ padding: "9px 12px", textAlign: h === "Player" ? "left" : "center", fontSize: 10, fontWeight: 700, color: "#9AAABF", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(242,237,228,.07)" }}>{h}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map(function(p, i) {
              var rp = p.entry && p.entry.roundPlacements ? p.entry.roundPlacements : {};
              var clashPts = (p.entry && p.entry.clashPts) || (p.entry && p.entry.pts) || 0;
              return (
                <tr key={p.id} style={{ background: i === 0 ? "rgba(232,168,56,.04)" : i % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent", borderBottom: "1px solid rgba(242,237,228,.04)" }}>
                  <td className="mono" style={{ padding: "11px 12px", textAlign: "center", fontSize: 13, fontWeight: 800, color: i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#9AAABF" }}>{i + 1}</td>
                  <td style={{ padding: "11px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#F2EDE4" }}>{p.name}</span>
                      {p.name === mostImproved && <Tag color="#52C47C" size="sm"><Icon name="trending_up" style={{ marginRight: 3 }} />Improved</Tag>}
                    </div>
                  </td>
                  {["r1", "r2", "r3", "finals"].map(function(rk) {
                    var v = rp[rk];
                    return (
                      <td key={rk} style={{ padding: "11px 8px", textAlign: "center" }}>
                        {v ? <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: v === 1 ? "#E8A838" : v <= 4 ? "#4ECDC4" : "#F87171" }}>#{v}</span> : <span style={{ color: "#9AAABF", fontSize: 12 }}>-</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: "11px 12px", textAlign: "center" }}>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "#E8A838" }}>+{clashPts}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {mostImproved && (
          <Panel style={{ padding: "14px", border: "1px solid rgba(82,196,124,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}><Icon name="trending_up" /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#6EE7B7" }}>Most Improved</div>
                <div style={{ fontWeight: 700, color: "#F2EDE4", fontSize: 13 }}>{mostImproved}</div>
                <div style={{ fontSize: 11, color: "#BECBD9" }}>Above their season average</div>
              </div>
            </div>
          </Panel>
        )}
        {biggestUpset && (
          <Panel style={{ padding: "14px", border: "1px solid rgba(155,114,207,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}><Icon name="target" /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#C4B5FD" }}>Biggest Upset</div>
                <div style={{ fontWeight: 700, color: "#F2EDE4", fontSize: 13, lineHeight: 1.4 }}>{biggestUpset}</div>
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <Btn v="dark" s="sm" onClick={function() { setScreen("home"); }}>{"<-"} Back</Btn>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cond" style={{ fontSize: 11, fontWeight: 700, color: "#9B72CF", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 2 }}>Season 1</div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(22px,3.5vw,34px)", fontWeight: 800, color: "#F2EDE4", lineHeight: 1.1 }}>{CLASH_NAME} - Final Results</h1>
          <div style={{ fontSize: 12, color: "#BECBD9", marginTop: 3 }}>{CLASH_DATE} - {sorted.length} players - {Math.ceil(sorted.length / 8)} lobbies</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <Btn v="dark" s="sm" onClick={shareDiscord}>Discord</Btn>
          <Btn v="dark" s="sm" onClick={function() {
            shareToTwitter(buildShareText("recap", { winner: champ.name, clashName: CLASH_NAME }));
          }}><Icon name="share" style={{ marginRight: 4 }} />Share</Btn>
          <Btn v="ghost" s="sm" onClick={downloadCard}><Icon name="download" style={{ fontSize: 12, marginRight: 3 }} />PNG</Btn>
          <Btn v="dark" s="sm" onClick={function() {
            var text = "TFT Clash Results\n" + CLASH_NAME + " - " + CLASH_DATE + "\n\n";
            sorted.slice(0, 8).forEach(function(p, i) { text += (i + 1) + ". " + p.name + " - " + p.pts + "pts (avg: " + getStats(p).avgPlacement + ")\n"; });
            text += "\n#TFTClash tftclash.com";
            navigator.clipboard.writeText(text).then(function() { toast("Results copied!", "success"); }).catch(function() { toast("Copy failed", "error"); });
          }}><Icon name="content_paste" style={{ marginRight: 4 }} />Copy</Btn>
        </div>
      </div>

      {/* Champion banner */}
      <div style={{
        background: "linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))",
        border: "1px solid rgba(232,168,56,.55)", borderRadius: 18, padding: "28px 32px", marginBottom: 24,
        display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", position: "relative", overflow: "hidden",
        boxShadow: "0 0 60px rgba(232,168,56,.18),inset 0 0 80px rgba(232,168,56,.04)"
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,168,56,.3),transparent)" }} />
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))",
          border: "2px solid rgba(232,168,56,.7)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, flexShrink: 0, boxShadow: "0 0 24px rgba(232,168,56,.35)"
        }}>
          <Icon name="emoji_events" style={{ fontSize: 40, color: "#E8A838" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#E8A838", letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 4 }}>
            <Icon name="emoji_events" style={{ fontSize: 11, color: "#E8A838", marginRight: 3 }} />Clash Champion
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, color: "#F2EDE4", lineHeight: 1.1, marginBottom: 6 }}>{champ.name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag color="#E8A838" size="sm">{champ.rank}</Tag>
            <Tag color="#4ECDC4" size="sm">{champ.region}</Tag>
            {isHotStreak(champ) && <Tag color="#F97316" size="sm"><Icon name="local_fire_department" style={{ fontSize: 11, color: "#F97316", marginRight: 3 }} />{champ.currentStreak}-streak</Tag>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[["Season Pts", champ.pts, "#E8A838"], ["Wins", champ.wins, "#6EE7B7"], ["Avg", getStats(champ).avgPlacement, avgCol(getStats(champ).avgPlacement)], ["Top4%", getStats(champ).top4Rate + "%", "#C4B5FD"]].map(function(item) {
            var l = item[0]; var v = item[1]; var c = item[2];
            return (
              <div key={l} style={{ textAlign: "center", padding: "10px 16px", background: "rgba(0,0,0,.3)", borderRadius: 10, minWidth: 64 }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 10, color: "#BECBD9", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginTop: 4 }}>{l}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Podium - top 3 */}
      {sorted.length >= 3 && (
        <div className="podium-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", gap: 10, marginBottom: 24, alignItems: "end" }}>
          {top3.map(function(p, idx) {
            var actualRank = idx === 0 ? 1 : idx === 1 ? 0 : 2;
            var col = PODIUM_COLS[actualRank];
            var isGold = actualRank === 0;
            return (
              <div key={p.id} onClick={function() { setProfilePlayer(p); setScreen("profile"); }}
                style={{
                  background: isGold ? "rgba(232,168,56,.08)" : "rgba(255,255,255,.02)",
                  border: "1px solid " + (isGold ? "rgba(232,168,56,.3)" : "rgba(255,255,255,.07)"),
                  borderRadius: 14, padding: "20px 14px", textAlign: "center", cursor: "pointer",
                  borderTop: "3px solid " + col, paddingTop: isGold ? 28 : 20
                }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}><Icon name={MEDALS[actualRank]} style={{ color: PODIUM_COLS[actualRank] }} /></div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isGold ? 17 : 14, fontWeight: 700, color: "#F2EDE4", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#BECBD9", marginBottom: 10 }}>{p.rank} - {p.region}</div>
                <div className="mono" style={{ fontSize: isGold ? 28 : 20, fontWeight: 800, color: col, lineHeight: 1 }}>{p.pts}</div>
                <div style={{ fontSize: 10, color: "#BECBD9", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 3 }}>Season Pts</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
                  {[["W", getStats(p).wins, "#6EE7B7"], ["Avg", getStats(p).avgPlacement, avgCol(getStats(p).avgPlacement)]].map(function(item) {
                    var l = item[0]; var v = item[1]; var c = item[2];
                    return (
                      <div key={l} style={{ textAlign: "center" }}>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                        <div style={{ fontSize: 10, color: "#9AAABF", textTransform: "uppercase" }}>{l}</div>
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
      <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 2 }}>
        {[["results", "Full Standings"], ["awards", "Awards"], ["report", "Clash Report"]].map(function(item) {
          var id = item[0]; var label = item[1];
          return <Btn key={id} v={tab === id ? "primary" : "dark"} s="sm" onClick={function() { setTab(id); }} style={{ flexShrink: 0 }}>{label}</Btn>;
        })}
      </div>

      {/* Full Standings */}
      {tab === "results" && (
        <Panel style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px 80px 70px 80px 110px", padding: "10px 16px", background: "rgba(0,0,0,.3)", borderBottom: "1px solid rgba(242,237,228,.08)" }}>
            {["#", "Player", "Pts", "Avg", "Wins", "T4%", "Reward"].map(function(h) {
              return <span key={h} className="cond" style={{ fontSize: 10, fontWeight: 700, color: "#9AAABF", letterSpacing: ".1em", textTransform: "uppercase" }}>{h}</span>;
            })}
          </div>
          {sorted.map(function(p, i) {
            var st = getStats(p);
            var isTop3 = i < 3;
            var col = i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#BECBD9";
            return (
              <div key={p.id} onClick={function() { setProfilePlayer(p); setScreen("profile"); }}
                style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 80px 80px 70px 80px 110px",
                  padding: "12px 16px", borderBottom: "1px solid rgba(242,237,228,.04)", alignItems: "center",
                  background: i === 0 ? "rgba(232,168,56,.05)" : i < 3 ? "rgba(255,255,255,.015)" : "transparent",
                  cursor: "pointer", transition: "background .12s"
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = i === 0 ? "rgba(232,168,56,.09)" : "rgba(255,255,255,.04)"; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = i === 0 ? "rgba(232,168,56,.05)" : i < 3 ? "rgba(255,255,255,.015)" : "transparent"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: col }}>{i + 1}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: isTop3 ? 700 : 600, fontSize: 13, color: isTop3 ? "#F2EDE4" : "#C8BFB0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                      {p.name}
                      {HOMIES_IDS.includes(p.id) && <span style={{ fontSize: 10 }}><Icon name="favorite" style={{ color: "#9B72CF" }} /></span>}
                      {isHotStreak(p) && <span style={{ fontSize: 10 }}><Icon name="local_fire_department" style={{ color: "#F97316" }} /></span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#BECBD9" }}>{p.rank} - {p.region}</span>
                      {(p.attendanceStreak || 0) >= 3 && <Tag color="#E8A838" size="sm">{p.attendanceStreak}-streak</Tag>}
                      {isComebackEligible(p, PAST_CLASHES.map(function(c) { return "c" + c.id; })) && <Tag color="#4ECDC4" size="sm">Comeback</Tag>}
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: isTop3 ? col : "#C8BFB0" }}>{p.pts}</div>
                <AvgBadge avg={parseFloat(p.avg) || 0} />
                <div className="mono" style={{ fontSize: 13, color: "#6EE7B7" }}>{st.wins}</div>
                <div className="mono" style={{ fontSize: 13, color: "#4ECDC4" }}>{st.top4Rate}%</div>
                <div style={{ fontSize: 12 }}>{REWARDS[i] ? <Tag color={col} size="sm">{REWARDS[i]}</Tag> : <span style={{ color: "#9AAABF" }}> - </span>}</div>
              </div>
            );
          })}
        </Panel>
      )}

      {/* Awards */}
      {tab === "awards" && (
        <div>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {awards.filter(function(a) { return a.winner; }).map(function(a) {
              return <AwardCard key={a.id} award={a} onClick={function() { if (setProfilePlayer && a.winner) { setProfilePlayer(a.winner); setScreen("profile"); } }} />;
            })}
          </div>
          <div style={{ marginTop: 16, padding: "16px 20px", background: "rgba(155,114,207,.06)", border: "1px solid rgba(155,114,207,.2)", borderRadius: 12, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 24 }}><Icon name="redeem" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#C4B5FD", marginBottom: 3 }}>Milestone Rewards Unlocked</div>
              <div style={{ fontSize: 13, color: "#C8D4E0" }}>Some players earned new milestones this clash.</div>
            </div>
            <Btn v="purple" s="sm" onClick={function() { setScreen("milestones"); }}>View {"->"}</Btn>
          </div>
        </div>
      )}

      {/* Clash Report */}
      {tab === "report" && (
        <Panel style={{ padding: "20px" }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "#F2EDE4", marginBottom: 4 }}>{CLASH_NAME} - Round by Round</h3>
          <p style={{ fontSize: 13, color: "#BECBD9", marginBottom: 20 }}>{CLASH_DATE} - {sorted.length} players</p>
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
    var allClashIds = PAST_CLASHES.map(function(c) { return "c" + c.id; });
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
            gameRows.forEach(function(row) {
              var ptsGained = row.points || 0;
              var winsGained = row.placement === 1 ? 1 : 0;
              if (ptsGained === 0 && winsGained === 0) return;
              supabase.rpc('increment_player_stats', {
                p_player_id: row.player_id,
                p_pts: ptsGained,
                p_wins: winsGained
              }).then(function(rpcRes) {
                if (rpcRes.error) {
                }
              }).catch(function() {});
            });
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

      gameRows.forEach(function(row) {
        supabase.rpc('increment_player_stats', {
          p_player_id: row.player_id,
          p_pts: row.points,
          p_wins: row.placement === 1 ? 1 : 0
        }).then(function(r) {
        }).catch(function() {});
      });

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
      var playerTotals = {};
      allPlayers.forEach(function(p) {
        var entries = (p.clashHistory || []).filter(function(h) { return h.clashId === clashId; });
        if (entries.length === 0) return;
        var totalPts = entries.reduce(function(s, h) { return s + ((h.pts || 0) + (h.bonusPts || 0)); }, 0);
        var wins = entries.filter(function(h) { return (h.place || h.placement) === 1; }).length;
        var top4 = entries.filter(function(h) { return (h.place || h.placement) <= 4; }).length;
        var bestPlace = Math.min.apply(null, entries.map(function(h) { return h.place || h.placement; }));
        playerTotals[p.id] = { tournament_id: tId, player_id: p.id, final_placement: bestPlace, total_points: totalPts, wins: wins, top4_count: top4 };
      });
      var rows = Object.values(playerTotals);
      if (rows.length > 0) {
        supabase.from('tournament_results').insert(rows).then(function(r) {
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
      supabase.from('tournaments').insert({ name: clashName, date: new Date().toISOString().split('T')[0], phase: 'complete' }).select('id').single().then(function(res) {
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
        <div className="fixed inset-0 flex items-center justify-center z-[1003] p-4" style={{ background: "rgba(0,0,0,.85)" }}>
          <Panel glow style={{ width: "100%", maxWidth: 420, padding: "28px" }}>
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
          <span className="font-condensed text-[10px] font-bold px-2.5 py-0.5 rounded-xl tracking-widest uppercase" style={{
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
        <div className="flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 mb-4" style={{ background: "rgba(82,196,124,.08)", border: "1px solid rgba(82,196,124,.3)", animation: "pulse 2s infinite" }}>
          <Icon name="check_circle" style={{ fontSize: 16, color: "#52C47C" }} />
          <span className="text-[13px] font-semibold text-[#6EE7B7] flex-1">All {lobbies.length} lobbies locked - {round >= (tournamentState.totalGames || 4) ? "ready to finalize!" : "ready for next game!"}{isAdmin && autoAdvanceCountdown !== null && autoAdvanceCountdown > 0 && round < (tournamentState.totalGames || 4) ? " Auto-advancing in " + autoAdvanceCountdown + "s" : ""}</span>
          {isAdmin && autoAdvanceCountdown !== null && autoAdvanceCountdown > 0 && round < (tournamentState.totalGames || 4) && (
            <button onClick={cancelAutoAdvance} className="text-[11px] font-bold cursor-pointer rounded-md px-3 py-1 whitespace-nowrap" style={{ color: "#F87171", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", fontFamily: "inherit" }}>Cancel</button>
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
          <Panel style={{ padding: "14px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="text-[13px] text-[#C8D4E0] shrink-0"><Icon name="search" style={{ fontSize: 13, marginRight: 4 }} />Find your lobby:</span>
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
            <div className="flex items-center gap-3 rounded-[10px] px-[18px] py-3.5 mb-4" style={{ background: "rgba(232,168,56,.1)", border: "1px solid rgba(232,168,56,.4)" }}>
              <Icon name="emoji_events" style={{ fontSize: 22 }} />
              <div>
                <div className="font-bold text-primary text-[15px]">Clash Complete!</div>
                <div className="text-xs text-[#C8D4E0]">All rounds locked. View final standings on the Leaderboard.</div>
              </div>
              <Btn v="primary" s="sm" style={{ marginLeft: "auto" }} onClick={function() { setScreen("leaderboard"); }}>View Results {"->"}</Btn>
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
                  <div className="font-condensed text-[11px] font-bold tracking-widest uppercase mb-0.5" style={{ color: r < round ? "#6EE7B7" : r === round ? "#E8A838" : "#9AAABF" }}>Round {r}</div>
                  <div className="text-[11px]" style={{ color: r < round ? "#6EE7B7" : r === round ? "#E8A838" : "#9AAABF" }}>{r < round ? "Complete" : r === round ? "In Progress" : "Upcoming"}</div>
                </div>
              );
            })}
          </div>

          {/* Lobby grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(320px,100%),1fr))", gap: 16 }}>
            {lobbies.map(function(lobby, li) {
              var isMyLobby = effectiveHighlight === li;
              var lobbyLocked = lockedLobbies.includes(li);
              return (
                <div key={li} className="rounded-[14px] overflow-hidden transition-shadow" style={{
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
                    {isMyLobby && <div className="text-xs font-bold rounded-md px-2.5 py-0.5" style={{ color: "#9B72CF", background: "rgba(155,114,207,.12)", border: "1px solid rgba(155,114,207,.3)" }}>YOU</div>}
                    {lobbyLocked && !isMyLobby && <div className="text-[11px] text-[#6EE7B7] font-bold">Locked</div>}
                    {lobbyLocked && isAdmin && <button onClick={function(e) { e.stopPropagation(); unlockLobby(li); }} className="text-[11px] font-bold cursor-pointer rounded-md px-2.5 py-0.5 ml-1.5" style={{ color: "#F87171", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", fontFamily: "inherit" }}>Unlock</button>}
                  </div>

                  {/* Player list */}
                  <div className="px-3 py-2.5">
                    {[].concat(lobby).sort(function(a, b) { return b.pts - a.pts; }).map(function(p, pi) {
                      var isMe = currentUser && p.name === currentUser.username;
                      var homie = HOMIES_IDS.includes(p.id);
                      return (
                        <div key={p.id} onClick={function() { setProfilePlayer(p); setScreen("profile"); }}
                          className="flex items-center gap-2.5 px-1.5 py-2 rounded-md cursor-pointer transition-colors"
                          style={{
                            borderBottom: pi < lobby.length - 1 ? "1px solid rgba(242,237,228,.05)" : "none",
                            background: isMe ? "rgba(155,114,207,.08)" : "transparent"
                          }}
                          onMouseEnter={function(e) { e.currentTarget.style.background = isMe ? "rgba(155,114,207,.12)" : "rgba(242,237,228,.03)"; }}
                          onMouseLeave={function(e) { e.currentTarget.style.background = isMe ? "rgba(155,114,207,.08)" : "transparent"; }}>
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
                              <Sel value="" onChange={function(v) { if (v) submitMyPlacement(li, p.id, p.name, v); }} style={{ width: 52, fontSize: 11, flexShrink: 0 }}>
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
                    <div style={{ borderTop: "1px solid rgba(242,237,228,.06)" }}>
                      {(!placementEntry[li] || !placementEntry[li].open) ? (
                        <div className="px-3 py-2.5" style={{ background: "rgba(255,255,255,.01)" }}>
                          <Btn v="teal" s="sm" full onClick={function() { openPlacementEntry(li); }}>
                            Enter Placements{playerSubmissions[li] ? " (" + Object.keys(playerSubmissions[li]).length + " submitted)" : ""}
                          </Btn>
                        </div>
                      ) : (
                        <div className="p-3" style={{ background: "rgba(78,205,196,.03)", borderTop: "1px solid rgba(78,205,196,.12)" }}>
                          <div className="font-condensed text-[11px] font-bold text-[#4ECDC4] mb-2.5 uppercase tracking-widest">Enter Placements - Round {round}</div>
                          <div className="flex flex-col gap-1.5 mb-2.5">
                            {[].concat(lobby).sort(function(a, b) { return b.pts - a.pts; }).map(function(p) {
                              var dup = lobby.filter(function(x) { return placementEntry[li].placements[x.id] === placementEntry[li].placements[p.id]; }).length > 1;
                              var wasSelfSubmitted = ((playerSubmissions || {})[li] || {})[p.id];
                              return (
                                <div key={p.id} className="flex items-center gap-2">
                                  <span className="text-xs text-on-surface flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{p.name}{wasSelfSubmitted && <span className="text-[9px] text-[#4ECDC4] font-bold ml-1">SELF</span>}</span>
                                  <Sel value={placementEntry[li].placements[p.id] || "1"} onChange={function(v) { setPlace(li, p.id, v); }} style={{ width: 60, border: dup ? "1px solid #F87171" : undefined }}>
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
            <Panel style={{ padding: "24px", marginTop: 24, textAlign: "center" }}>
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

  var lastClash = PAST_CLASHES[0]

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
          <div className="text-xs text-on-surface/40 mt-1">Registration opens Saturday at 18:00 CET</div>
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

// ---- ClashScreen (main, phase-adaptive) ----

function ClashScreen(props) {
  var navigate = useNavigate()
  var linkedPlayer = (props.players || []).find(function(p) {
    return props.currentUser && p.name === (props.currentUser.username || props.currentUser.name)
  }) || null
  var phase = props.tournamentState && props.tournamentState.phase;
  if (!phase || phase === 'idle') {
    return <ClashIdleView players={props.players} currentUser={props.currentUser} linkedPlayer={linkedPlayer} navigate={navigate} />
  }

  // For live/registration phases, redirect to the polished Bracket page
  if (phase === 'live' || phase === 'inprogress' || phase === 'registration') {
    navigate('/bracket', { replace: true })
    return null
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
        <div className="font-condensed text-[10px] uppercase tracking-[.12em] text-[#9AAABF] font-bold mb-2.5">Awards</div>
        <div className="flex gap-2 flex-wrap">
          {awardsList.map(function(a, i) {
            return (
              <div key={a.label} className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] min-w-0" style={{
                background: "rgba(17,24,39,.8)",
                border: "1px solid rgba(" + hexToRgb(a.color) + ",.2)",
                flex: "1 1 140px"
              }}>
                <Icon name={a.icon} style={{ fontSize: 18, color: a.color, flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="font-condensed text-[10px] font-bold uppercase tracking-widest" style={{ color: a.color }}>{a.label}</div>
                  <div className="text-[13px] font-bold text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">{a.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Registered players for scouting cards
  var registeredPlayers = phase === "registration" ? (props.players || []).filter(function(p) { return p.registered || p.checkedIn; }) : [];

  return (
    <div className="fade-up">
      {/* Phase header bar */}
      <div className="relative overflow-hidden px-5 py-4 mx-4 mb-5 rounded-[14px]" style={{
        background: "rgba(17,24,39,.8)",
        border: "1px solid rgba(" + hexToRgb(accentColor) + ",.2)"
      }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg,transparent," + accentColor + ",transparent)" }} />
        {phase === "live" && (
          <div className="absolute pointer-events-none" style={{ top: "-50%", left: "30%", width: "40%", height: "200%", background: "radial-gradient(ellipse,rgba(232,168,56,.06) 0%,transparent 70%)" }} />
        )}
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: accentColor,
            boxShadow: phase === "live" ? "0 0 12px " + accentColor + ", 0 0 24px " + accentColor : "none",
            animation: phase === "live" ? "live-dot 1.5s ease infinite" : "none"
          }} />
          <span className="font-condensed text-[11px] uppercase tracking-[.1em] font-bold" style={{ color: accentColor }}>{phaseLabels[phase] || "Clash"}</span>
          {phase === "live" && (
            <span className="font-condensed text-[10px] tracking-[.06em] ml-auto" style={{ color: "#E8A838", opacity: .7 }}>LIVE</span>
          )}
        </div>
      </div>

      {/* Registration - scouting list */}
      {phase === "registration" && registeredPlayers.length > 0 && (
        <div className="mx-4 mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="font-condensed text-[10px] uppercase tracking-[.12em] text-[#9AAABF] font-bold">{"Registered - " + registeredPlayers.length + " players"}</div>
            <div className="font-condensed text-[10px] text-[#9AAABF]">Scout the field</div>
          </div>
          <div className="flex flex-col gap-1.5">
            {registeredPlayers.map(function(p, idx) {
              var sparkData = (p.clashHistory || []).slice(-5).map(function(c) { return c.placement || c.place || 4; });
              return (
                <div key={p.id || p.username}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] cursor-pointer"
                  style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}
                  onClick={function() { if (props.setProfilePlayer && props.setScreen) { props.setProfilePlayer(p); props.setScreen("profile"); } }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[11px] font-extrabold text-[#C4B5FD] shrink-0" style={{ background: "linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.08))" }}>
                    {"#" + (idx + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-on-surface overflow-hidden text-ellipsis whitespace-nowrap">{p.username || p.name || "Player"}</div>
                    <div className="text-[10px] text-[#9AAABF]">{(p.wins || 0) + " wins, " + (p.games || 0) + " games"}</div>
                  </div>
                  {sparkData.length >= 2
                    ? <Sparkline data={sparkData} w={40} h={14} color="#9B72CF" />
                    : <div className="flex items-center text-[10px] text-[#9AAABF] opacity-20" style={{ width: 40, height: 14 }}>{"--"}</div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bracket / lobby view for registration and live phases */}
      {(phase === "registration" || phase === "live") && (
        <MemoBracketScreen
          players={props.players} setPlayers={props.setPlayers} toast={props.toast}
          isAdmin={props.isAdmin} currentUser={props.currentUser} setProfilePlayer={props.setProfilePlayer}
          setScreen={props.setScreen} tournamentState={props.tournamentState}
          setTournamentState={props.setTournamentState} seasonConfig={props.seasonConfig}
          allPendingResults={props.allPendingResults}
        />
      )}

      {/* Game progress dots for live phase */}
      {phase === "live" && (
        <div className="flex gap-1 mb-4 justify-center px-4">
          {Array.from({ length: props.tournamentState.totalGames || 4 }, function(_, i) {
            var isComplete = i + 1 < (props.tournamentState.round || 1);
            var isCurrent = i + 1 === (props.tournamentState.round || 1);
            return (
              <div key={"game-" + (i + 1)} className="h-2 rounded" style={{
                width: isCurrent ? 24 : 8,
                background: isComplete ? "#6EE7B7" : isCurrent ? "#E8A838" : "rgba(255,255,255,.1)",
                transition: "all .3s ease"
              }} />
            );
          })}
        </div>
      )}

      {/* Swiss reseed banner */}
      {phase === "live" && props.tournamentState.seedAlgo === "swiss" && props.tournamentState.round > 1 && props.tournamentState.round % 2 === 0 && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 mx-4 mb-3 rounded-lg font-condensed text-[11px] tracking-[.04em]" style={{
          background: "rgba(232,168,56,.04)", border: "1px solid rgba(232,168,56,.12)",
          maxHeight: 48, color: "#E8A838"
        }}>
          <Icon name="shuffle" style={{ fontSize: 16 }} />
          Swiss Reseed - Lobbies reorganized by standings
        </div>
      )}

      {/* Live standings table */}
      {phase === "live" && props.tournamentState.liveStandings && (
        <LiveStandingsTable standings={props.tournamentState.liveStandings} />
      )}

      {/* Complete phase: your finish, awards, recap, results */}
      {phase === "complete" && (
        <>
          <YourFinishCard currentUser={props.currentUser} finalStandings={props.tournamentState.finalStandings || []} />
          {awardsEl}
          {recapEl}
          <MemoResultsScreen players={props.players} toast={props.toast} setScreen={props.setScreen} setProfilePlayer={props.setProfilePlayer} tournamentState={props.tournamentState} />
        </>
      )}
    </div>
  );
}

export default ClashScreen;
