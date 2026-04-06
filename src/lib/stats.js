import { CLASH_RANKS, XP_REWARDS, DEFAULT_SEASON_CONFIG, getSeasonChampion } from './constants.js';
import { ordinal } from './utils.js';

// ─── PLATFORM RANKING ─────────────────────────────────────────────────────────

export function getClashRank(xp) {
  return CLASH_RANKS.slice().reverse().find(function(r) { return xp >= r.minXp; }) || CLASH_RANKS[0];
}

export function getXpProgress(xp) {
  var rank = getClashRank(xp);
  var next = CLASH_RANKS[CLASH_RANKS.indexOf(rank) + 1];
  if (!next) return {rank: rank, pct: 100, current: xp, needed: 0};
  var pct = Math.min(100, Math.round((xp - rank.minXp) / (next.minXp - rank.minXp) * 100));
  return {rank: rank, next: next, pct: pct, current: xp - rank.minXp, needed: next.minXp - rank.minXp};
}

// Estimate XP from player stats (for demo data)
export function estimateXp(p) {
  return (p.games || 0) * XP_REWARDS.play_game + (p.wins || 0) * XP_REWARDS.win + (p.top4 || 0) * XP_REWARDS.top4 + Math.floor((p.pts || 0) / 100) * XP_REWARDS.season_pts_100;
}

// ─── STATS ENGINE ─────────────────────────────────────────────────────────────

export function computeStats(player) {
  var h = player.clashHistory || [];
  var games = h.length || player.games || 0;
  var wins = h.filter(function(g) { return (g.place || g.placement) === 1; }).length || player.wins || 0;
  var top4 = h.filter(function(g) { return (g.place || g.placement) <= 4; }).length || player.top4 || 0;
  var bot4 = h.filter(function(g) { return (g.place || g.placement) > 4; }).length;

  // AVP = sum of all placements / total games (lower = better)
  var avgPlacement = h.length > 0
    ? (h.reduce(function(s, g) { return s + (g.place || g.placement || 0); }, 0) / h.length)
    : (parseFloat(player.avg) || 0);

  // Per-round avgs (from roundPlacements field in history)
  var roundAvgs = {r1: null, r2: null, r3: null, finals: null};
  var roundKeys = ["r1", "r2", "r3", "finals"];
  roundKeys.forEach(function(rk) {
    var vals = h.map(function(g) { return g.roundPlacements?.[rk]; }).filter(function(v) { return v != null; });
    if (vals.length > 0) roundAvgs[rk] = (vals.reduce(function(s, v) { return s + v; }, 0) / vals.length).toFixed(2);
  });

  // Comeback rate: placed 5-8 in r1 but finished top4 overall
  var comebacks = h.filter(function(g) { return g.roundPlacements?.r1 >= 5 && (g.place || g.placement) <= 4; }).length;
  var comebackOpp = h.filter(function(g) { return g.roundPlacements?.r1 >= 5; }).length;
  var comebackRate = comebackOpp > 0 ? ((comebacks / comebackOpp) * 100).toFixed(0) : 0;

  // Clutch rate: won their lobby
  var clutches = h.filter(function(g) { return g.claimedClutch; }).length;
  var clutchRate = games > 0 ? ((clutches / games) * 100).toFixed(0) : 0;

  // PPG
  var ppg = games > 0 ? (player.pts / games).toFixed(1) : 0;

  // Per-clash AVP: average placement within each individual clash
  var perClashAvp = h.length > 0
    ? h.map(function(g) {
        var rp = g.roundPlacements || {};
        var rounds = Object.values(rp).filter(function(v) { return v != null; });
        return rounds.length > 0 ? (rounds.reduce(function(s, v) { return s + v; }, 0) / rounds.length) : (g.place || g.placement);
      }).reduce(function(s, v, _, a) { return s + v / a.length; }, 0).toFixed(2)
    : null;

  return {
    games, wins, top4, bot4,
    top1Rate: games > 0 ? ((wins / games) * 100).toFixed(1) : "0.0",
    top4Rate: games > 0 ? ((top4 / games) * 100).toFixed(1) : "0.0",
    bot4Rate: games > 0 ? ((bot4 / games) * 100).toFixed(1) : "0.0",
    avgPlacement: avgPlacement > 0 ? avgPlacement.toFixed(2) : "-",
    perClashAvp,
    roundAvgs, comebackRate, clutchRate, ppg,
  };
}

// ─── HEAD-TO-HEAD COMPUTATION ─────────────────────────────────────────────────

export function computeH2H(playerA, playerB, pastClashes) {
  var shared = [];
  (pastClashes || []).forEach(function(clash) {
    (clash.lobbies || []).forEach(function(lobby) {
      var aResult = null, bResult = null;
      (lobby.results || []).forEach(function(r) {
        if (r.username === playerA) aResult = r;
        if (r.username === playerB) bResult = r;
      });
      if (aResult && bResult) {
        shared.push({clash: clash.name || clash.id, aPos: aResult.position, bPos: bResult.position});
      }
    });
  });
  var wins = 0, losses = 0, aAvg = 0, bAvg = 0;
  shared.forEach(function(s) {
    if (s.aPos < s.bPos) wins++;
    else if (s.aPos > s.bPos) losses++;
    aAvg += s.aPos;
    bAvg += s.bPos;
  });
  var count = shared.length;
  return {
    sharedLobbies: count,
    wins: wins, losses: losses,
    ties: count - wins - losses,
    aAvg: count ? +(aAvg / count).toFixed(1) : 0,
    bAvg: count ? +(bAvg / count).toFixed(1) : 0,
    recent: shared.slice(-5),
  };
}

// ─── STATS CACHE ─────────────────────────────────────────────────────────────
var _statsCache = new WeakMap();
export function getStats(player) {
  if (!player) return {games: 0, wins: 0, top4: 0, bot4: 0, top1Rate: "0.0", top4Rate: "0.0", bot4Rate: "0.0", avgPlacement: "-", perClashAvp: null, roundAvgs: {r1: null, r2: null, r3: null, finals: null}, comebackRate: 0, clutchRate: 0, ppg: 0};
  var cached = _statsCache.get(player);
  if (cached) return cached;
  var result = computeStats(player);
  _statsCache.set(player, result);
  return result;
}

// ─── SCORING & TIEBREAKER ─────────────────────────────────────────────────────

export function effectivePts(player, seasonConfig) {
  if (!player.clashHistory || !player.clashHistory.length) return player.pts || 0;
  var cfg = seasonConfig || DEFAULT_SEASON_CONFIG;
  var clashMap = {};
  player.clashHistory.forEach(function(h) {
    var cid = h.clashId || "c0";
    clashMap[cid] = (clashMap[cid] || 0) + (h.pts || 0);
  });
  var clashIds = Object.keys(clashMap);
  var totals = clashIds.map(function(cid) { return clashMap[cid]; });
  totals.sort(function(a, b) { return a - b; });
  var drop = cfg.dropWeeks || 0;
  if (drop > 0) totals = totals.slice(drop);
  var boost = cfg.finalBoost || 1.0;
  var finaleCount = cfg.finaleClashes || 2;
  if (boost > 1.0 && totals.length > 0) {
    var boostStart = Math.max(0, totals.length - finaleCount);
    for (var i = boostStart; i < totals.length; i++) {
      totals[i] = Math.round(totals[i] * boost);
    }
  }
  return totals.reduce(function(acc, v) { return acc + v; }, 0);
}

export function tiebreaker(a, b) {
  var aPts = a.pts || 0, bPts = b.pts || 0;
  if (bPts !== aPts) return bPts - aPts;
  var aScore = (a.wins || 0) * 2 + (a.top4 || 0);
  var bScore = (b.wins || 0) * 2 + (b.top4 || 0);
  if (bScore !== aScore) return bScore - aScore;
  var placements = [1, 2, 3, 4, 5, 6, 7, 8];
  for (var i = 0; i < placements.length; i++) {
    var p = placements[i];
    var aC = (a.clashHistory || []).filter(function(h) { return (h.place || h.placement) === p; }).length;
    var bC = (b.clashHistory || []).filter(function(h) { return (h.place || h.placement) === p; }).length;
    if (bC !== aC) return bC - aC;
  }
  var aLastId = a.clashHistory && a.clashHistory.length ? (a.clashHistory[a.clashHistory.length - 1].clashId || a.clashHistory[a.clashHistory.length - 1].date || a.clashHistory.length) : 0;
  var bLastId = b.clashHistory && b.clashHistory.length ? (b.clashHistory[b.clashHistory.length - 1].clashId || b.clashHistory[b.clashHistory.length - 1].date || b.clashHistory.length) : 0;
  return bLastId - aLastId;
}

// ─── COMEBACK / ATTENDANCE ────────────────────────────────────────────────────

export function isComebackEligible(player, allClashIds) {
  if (!allClashIds || !allClashIds.length) return false;
  var attended = {};
  (player.clashHistory || []).forEach(function(h) { if (h.clashId) attended[h.clashId] = true; });
  var lastIdx = -1;
  for (var i = allClashIds.length - 1; i >= 0; i--) {
    if (attended[allClashIds[i]]) { lastIdx = i; break; }
  }
  if (lastIdx === -1) return false;
  var missed = 0;
  for (var j = lastIdx + 1; j < allClashIds.length; j++) {
    if (!attended[allClashIds[j]]) missed++;
    else missed = 0;
  }
  return missed >= 2;
}

export function getAttendanceStreak(player, allClashIds) {
  if (!allClashIds || !allClashIds.length) return 0;
  var attended = {};
  (player.clashHistory || []).forEach(function(h) { if (h.clashId) attended[h.clashId] = true; });
  var streak = 0;
  for (var i = allClashIds.length - 1; i >= 0; i--) {
    if (attended[allClashIds[i]]) streak++;
    else break;
  }
  return streak;
}

export function computeSeasonBonuses(player, currentClashId, allClashIds, seasonConfig) {
  var cfg = seasonConfig || DEFAULT_SEASON_CONFIG;
  var bonusPts = 0;
  var comebackTriggered = false;
  var attendanceMilestone = null;
  var idsWithCurrent = allClashIds.indexOf(currentClashId) >= 0 ? allClashIds : allClashIds.concat([currentClashId]);
  if (cfg.comebackBonus && isComebackEligible(player, allClashIds)) {
    bonusPts += 2;
    comebackTriggered = true;
  }
  if (cfg.attendanceBonus) {
    var attended = {};
    (player.clashHistory || []).forEach(function(h) { if (h.clashId) attended[h.clashId] = true; });
    var streak = 0;
    for (var i = idsWithCurrent.length - 1; i >= 0; i--) {
      var cid = idsWithCurrent[i];
      if (cid === currentClashId || attended[cid]) streak++;
      else break;
    }
    if (streak === 5) { bonusPts += 5; attendanceMilestone = 5; }
    else if (streak === 3) { bonusPts += 3; attendanceMilestone = 3; }
  }
  return { bonusPts: bonusPts, comebackTriggered: comebackTriggered, attendanceMilestone: attendanceMilestone };
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

export var ACHIEVEMENTS = [
  // PLACEMENT MILESTONES
  {id:"first_blood",    tier:"bronze",    icon:"droplet-fill",  name:"First Blood",       desc:"Win your first clash game",                            check:function(p){ return p.wins>=1; }},
  {id:"hat_trick",      tier:"bronze",    icon:"mortarboard-fill",  name:"Hat Trick",          desc:"3 total wins across any clashes",                      check:function(p){ return p.wins>=3; }},
  {id:"top4_machine",   tier:"silver",    icon:"gear-fill",  name:"Top 4 Machine",      desc:"Land top 4 in 10 different games",                     check:function(p){ return p.top4>=10; }},
  {id:"podium_hunter",  tier:"silver",    icon:"award-fill",  name:"Podium Hunter",      desc:"5 wins total",                                         check:function(p){ return p.wins>=5; }},
  {id:"clutch_god",     tier:"gold",      icon:"lightning-charge-fill",  name:"Clutch God",         desc:"Win a 1v1 final round",                                check:function(p){ return (p.clashHistory||[]).some(function(g){ return g.clutch; }); }},
  {id:"dynasty",        tier:"gold",      icon:"trophy-fill",  name:"Dynasty",            desc:"10 total wins - a true contender",                     check:function(p){ return p.wins>=10; }},
  {id:"untouchable",    tier:"legendary", icon:"diamond-half",  name:"Untouchable",        desc:"100% top 4 rate across all games played",              check:function(p){ return p.games>=3&&p.top4>=p.games; }},
  {id:"the_grind",      tier:"legendary", icon:"moon-fill",  name:"The Grind",          desc:"Play 30+ games over the season",                       check:function(p){ return p.games>=30; }},
  // STREAK ACHIEVEMENTS
  {id:"hot_start",      tier:"bronze",    icon:"fire",  name:"Hot Start",          desc:"Win your first clash of the season",                   check:function(p){ return p.wins>=1&&p.games<=8; }},
  {id:"on_fire",        tier:"silver",    icon:"graph-up-arrow",  name:"On Fire",            desc:"3 win streak at any point",                            check:function(p){ return p.bestStreak>=3; }},
  {id:"cant_stop",      tier:"gold",      icon:"rocket-takeoff-fill",  name:"Can't Stop",         desc:"5 consecutive wins",                                   check:function(p){ return p.bestStreak>=5; }},
  {id:"goat_streak",    tier:"legendary", icon:"star-fill",  name:"GOAT Streak",        desc:"7 win streak - absolutely unstoppable",                check:function(p){ return p.bestStreak>=7; }},
  // POINTS ACHIEVEMENTS
  {id:"point_getter",   tier:"bronze",    icon:"coin",  name:"Point Getter",       desc:"Earn your first 100 Clash Points",                     check:function(p){ return p.pts>=100; }},
  {id:"century",        tier:"silver",    icon:"gem",  name:"Half-K",             desc:"500 Clash Points accumulated",                         check:function(p){ return p.pts>=500; }},
  {id:"big_dog",        tier:"gold",      icon:"trophy-fill",  name:"Big Dog",            desc:"800 Clash Points - top tier territory",                check:function(p){ return p.pts>=800; }},
  {id:"thousand_club",  tier:"legendary", icon:"sun-fill",  name:"Thousand Club",      desc:"1000+ Clash Points in a single season",                check:function(p){ return p.pts>=1000; }},
  // SOCIAL / COMMUNITY
  {id:"regular",        tier:"bronze",    icon:"calendar-check-fill",  name:"Regular",            desc:"Show up to 5 clashes",                                 check:function(p){ return p.games>=5; }},
  {id:"veteran",        tier:"silver",    icon:"shield-check",  name:"Veteran",            desc:"20 total games across the season",                     check:function(p){ return p.games>=20; }},
  {id:"season_finisher",tier:"gold",      icon:"patch-check-fill",  name:"Season Finisher",    desc:"Complete every clash in the season",                   check:function(p){ return p.games>=28; }},
  {id:"champion",       tier:"legendary", icon:"award-fill",  name:"Season Champion",    desc:"Finish #1 on the season leaderboard",                  check:function(p){var sc=getSeasonChampion();return sc&&p.name===sc.name;}},
  // RARE / EASTER EGG
  {id:"dishsoap",       tier:"legendary", icon:"droplet",  name:"Squeaky Clean",      desc:"Only Dishsoap knows how he earned this.",              check:function(p){ return p.name==="Dishsoap"||(p.riotId?.toLowerCase().indexOf("dishsoap")>=0); }},
  {id:"perfect_lobby",  tier:"legendary", icon:"bullseye",  name:"The Anomaly",        desc:"Win a lobby without ever placing below 3rd in any round", check:function(p){ return (p.clashHistory||[]).some(function(g){ return (g.place||g.placement)===1&&(g.roundPlacements?Object.values(g.roundPlacements).every(function(v){ return v<=3; }):true); }); }},
  {id:"silent_grinder", tier:"gold",      icon:"eye-fill",  name:"Silent Grinder",     desc:"Top 8 on the leaderboard with no wins - pure consistency", check:function(p){ return p.pts>=400&&p.wins===0; }},
];

export var MILESTONES = [
  {id:"m1",icon:"shield-fill",name:"Bronze Contender",pts:100,  reward:"Bronze badge on your profile",     check:function(p){ return p.pts>=100; }},
  {id:"m2",icon:"shield-fill",name:"Silver Contender",pts:300,  reward:"Silver animated border",            check:function(p){ return p.pts>=300; }},
  {id:"m3",icon:"shield-fill",name:"Gold Contender",  pts:600,  reward:"Gold sparkle border + title",       check:function(p){ return p.pts>=600; }},
  {id:"m4",icon:"gem",name:"Diamond Tier",    pts:800,  reward:"Diamond holographic card effect",   check:function(p){ return p.pts>=800; }},
  {id:"m5",icon:"trophy-fill",name:"Champion Tier",   pts:1000, reward:"Champion crown + Hall of Fame entry",check:function(p){ return p.pts>=1000; }},
  {id:"m6",icon:"fire",name:"Hot Streak",      pts:null, reward:"Flame icon next to your name",     check:function(p){ return isHotStreak(p); }},
  {id:"m7",icon:"trophy-fill",name:"Event Winner",    pts:null, reward:"Winner trophy on your profile",    check:function(p){ return p.wins>=1; }},
  {id:"m8",icon:"lightning-charge-fill",name:"Clutch Player",   pts:null, reward:"Clutch tag on your stats",     check:function(p){ return (p.clashHistory||[]).some(function(g){ return g.clutch; }); }},
];

export function getAchievements(p) { return ACHIEVEMENTS.filter(function(a) { try { return a.check(p); } catch(e) { return false; } }); }

// ─── CHALLENGES ───────────────────────────────────────────────────────────────

export var WEEKLY_CHALLENGES = [
  {id:"w1",icon:"fire",name:"On A Roll",desc:"Win 2 lobbies this week",xp:120,type:"weekly",progress:1,goal:2},
  {id:"w2",icon:"bar-chart-line-fill",name:"Consistency Check",desc:"Average top 3 across 3 games",xp:100,type:"weekly",progress:2,goal:3},
  {id:"w3",icon:"trophy-fill",name:"Podium Finish",desc:"Top 3 in a clash event",xp:150,type:"weekly",progress:0,goal:1},
];

export var DAILY_CHALLENGES = [
  {id:"d1",icon:"bullseye",name:"Sharp Shooter",desc:"Finish in the top 2",xp:50,type:"daily",progress:0,goal:1},
  {id:"d2",icon:"lightning-charge-fill",name:"Speed Run",desc:"Complete a game in under 30 mins",xp:40,type:"daily",progress:0,goal:1},
  {id:"d3",icon:"shield-fill",name:"Survivor",desc:"Finish top 4 in any lobby",xp:30,type:"daily",progress:0,goal:1},
];

export function checkAchievements(player, rank) {
  if (!player) return [];
  var stats = getStats(player);
  var earned = [];
  ACHIEVEMENTS.forEach(function(a) {
    var c = a.criteria;
    if (c) {
      if (c.type === "wins" && (player.wins || 0) >= c.value) earned.push(a.id);
      else if (c.type === "games" && (player.games || 0) >= c.value) earned.push(a.id);
      else if (c.type === "rank" && rank === c.value) earned.push(a.id);
      else if (c.type === "avgPlacement" && stats.avgPlacement && parseFloat(stats.avgPlacement) <= c.value && (player.games || 0) >= (c.minGames || 0)) earned.push(a.id);
      else if (c.type === "streak") {
        var history = player.clashHistory || [];
        var streak = 0;
        for (var si = history.length - 1; si >= 0; si--) {
          if (history[si].placement <= 4) streak++;
          else break;
        }
        if (streak >= c.value) earned.push(a.id);
      }
    } else {
      try { if (a.check(player)) earned.push(a.id); } catch(e) {}
    }
  });
  return earned;
}

export function syncAchievements(playerId, earnedIds) {
  // Lazy import to avoid circular dependency
  var rows = earnedIds.map(function(aid) {
    return {player_id: playerId, achievement_id: aid};
  });
  if (rows.length > 0) {
    import('./supabase.js').then(function(mod) {
      mod.supabase.from("player_achievements").upsert(rows, {onConflict: "player_id,achievement_id"})
        .then(function(r) { });
    });
  }
}

export function isHotStreak(p) { return (p.currentStreak || 0) >= 3; }

export function isOnTilt(p) { return (p.tiltStreak || 0) >= 3; }

// ─── POST-CLASH AWARDS ENGINE ─────────────────────────────────────────────────

export function computeClashAwards(players) {
  var eligible = players.filter(function(p) { return p.games > 0; });
  if (eligible.length === 0) return [];

  var byPts = eligible.slice().sort(function(a, b) { return b.pts - a.pts; });
  var byAvp = eligible.slice().filter(function(p) { return p.games >= 3; }).sort(function(a, b) { return parseFloat(a.avg || 9) - parseFloat(b.avg || 9); });
  var byAvpWorst = eligible.slice().filter(function(p) { return p.games >= 3; }).sort(function(a, b) { return parseFloat(b.avg || 0) - parseFloat(a.avg || 0); });

  // Lobby Bully - most 1st place finishes
  var lobbyBully = byPts.reduce(function(best, p) { return (!best || p.wins > best.wins) ? p : best; }, null);

  // The Choker - highest AVP but still in top half by pts (ironic)
  var topHalf = byPts.slice(0, Math.ceil(byPts.length / 2));
  var choker = topHalf.slice().filter(function(p) { return p.games >= 3; }).sort(function(a, b) { return parseFloat(b.avg || 0) - parseFloat(a.avg || 0); })[0];

  // Highest single-clash score - best haul ever
  var singleMVP = eligible.reduce(function(best, p) { return (!best || (p.bestHaul || 0) > (best.bestHaul || 0)) ? p : best; }, null);

  // Most Improved - biggest improvement from first half to second half of games
  var mostImproved = (function() {
    var candidates = eligible.filter(function(p) { return (p.clashHistory || []).length >= 4; });
    if (!candidates.length) return byAvp[0] || null;
    var best = null; var bestDelta = 0;
    candidates.forEach(function(p) {
      var h = p.clashHistory || []; var mid = Math.floor(h.length / 2);
      var firstHalf = h.slice(0, mid); var secondHalf = h.slice(mid);
      var avgFirst = firstHalf.reduce(function(s, g) { return s + (g.place || g.placement || 5); }, 0) / firstHalf.length;
      var avgSecond = secondHalf.reduce(function(s, g) { return s + (g.place || g.placement || 5); }, 0) / secondHalf.length;
      var delta = avgFirst - avgSecond;
      if (delta > bestDelta) { bestDelta = delta; best = p; }
    });
    return best || byAvp[0] || null;
  })();

  // Ice Cold - longest streak without a top-4 finish (3+ games)
  var iceCold = (function() {
    var candidates = eligible.filter(function(p) { return (p.clashHistory || []).length >= 3; });
    if (!candidates.length) return null;
    var worst = null; var worstStreak = 0;
    candidates.forEach(function(p) {
      var streak = 0; var maxStreak = 0;
      (p.clashHistory || []).forEach(function(g) {
        var pl = g.place || g.placement || 5;
        if (pl > 4) { streak++; } else { if (streak > maxStreak) maxStreak = streak; streak = 0; }
      });
      if (streak > maxStreak) maxStreak = streak;
      if (maxStreak > worstStreak) { worstStreak = maxStreak; worst = p; }
    });
    return worst;
  })();

  // On Fire - best 1st place streak
  var onFire = eligible.slice().sort(function(a, b) { return (b.bestStreak || 0) - (a.bestStreak || 0); })[0];

  return [
    lobbyBully && {icon: "crosshair", id: "bully", title: "Lobby Bully", desc: "Most 1st place finishes", winner: lobbyBully, stat: lobbyBully.wins + " wins", color: "#E8A838"},
    choker && choker !== lobbyBully && {icon: "emoji-dizzy", id: "choker", title: "The Choker", desc: "Highest AVP in the top half - ouch", winner: choker, stat: "AVP " + getStats(choker).avgPlacement, color: "#F87171"},
    singleMVP && {icon: "lightning-charge-fill", id: "single", title: "Single Clash MVP", desc: "Highest points in one event", winner: singleMVP, stat: (singleMVP.bestHaul || 0) + " pts haul", color: "#EAB308"},
    mostImproved && {icon: "graph-up-arrow", id: "improved", title: "Most Improved", desc: "Biggest AVP improvement this season", winner: mostImproved, stat: "AVP " + getStats(mostImproved).avgPlacement, color: "#52C47C"},
    iceCold && iceCold !== mostImproved && {icon: "snow", id: "cold", title: "Ice Cold", desc: "Longest streak outside top 4", winner: iceCold, stat: "AVP " + getStats(iceCold).avgPlacement, color: "#4ECDC4"},
    onFire && {icon: "fire", id: "streak", title: "On Fire", desc: "Best 1st place streak this season", winner: onFire, stat: (onFire.bestStreak || 0) + " in a row", color: "#F97316"},
    byPts[0] && {icon: "trophy-fill", id: "mvp", title: "MVP", desc: "Highest season points", winner: byPts[0], stat: byPts[0].pts + " pts", color: "#E8A838"},
    byPts[0] && {icon: "clipboard-data-fill", id: "consistent2", title: "Most Consistent", desc: "Lowest AVP (3+ games)", winner: byAvp[0], stat: "AVP " + (byAvp[0] ? getStats(byAvp[0]).avgPlacement : "-"), color: "#C4B5FD"},
  ].filter(Boolean);
}

// ─── AUTO-GENERATED CLASH RECAP ──────────────────────────────────────────────

export function generateRecap(clashData) {
  if (!clashData || !clashData.finalStandings || clashData.finalStandings.length === 0) return null;
  var lines = [];
  var standings = clashData.finalStandings;
  var winner = standings[0];
  lines.push((winner.username || winner.name) + " claimed the crown with " + (winner.points || winner.pts || 0) + " points.");

  var biggestClimb = null;
  standings.forEach(function(p, idx) {
    if (p.game1Pos) {
      var climb = p.game1Pos - (idx + 1);
      if (!biggestClimb || climb > biggestClimb.climb) biggestClimb = {player: p.username || p.name, from: p.game1Pos, to: idx + 1, climb: climb};
    }
  });
  if (biggestClimb && biggestClimb.climb >= 3) {
    lines.push(biggestClimb.player + " pulled off an incredible comeback, climbing from " + ordinal(biggestClimb.from) + " after Game 1 to finish " + ordinal(biggestClimb.to) + ".");
  }

  var consistent = standings.find(function(p) {
    return p.allPlacements && p.allPlacements.every(function(pos) { return pos <= 4; });
  });
  if (consistent && (consistent.username || consistent.name) !== (winner.username || winner.name)) {
    lines.push((consistent.username || consistent.name) + " earned the Consistency King award with all placements inside the top 4.");
  }

  if (standings.length >= 2) {
    var diff = (standings[0].points || standings[0].pts || 0) - (standings[1].points || standings[1].pts || 0);
    if (diff <= 2) {
      lines.push("It came down to the wire, only " + diff + " point" + (diff === 1 ? "" : "s") + " separated " + (standings[0].username || standings[0].name) + " and " + (standings[1].username || standings[1].name) + ".");
    }
  }

  return {lines: lines, winner: winner.username || winner.name, clashName: clashData.name || clashData.clashName || "Clash"};
}
