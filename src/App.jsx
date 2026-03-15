import { useState, useEffect, useRef } from "react";
import { supabase } from './lib/supabase.js';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const RANKS = ["Iron","Bronze","Silver","Gold","Platinum","Emerald","Diamond","Master","Grandmaster","Challenger"];
const RCOLS = {Iron:"#8C7B6B",Bronze:"#CD7F32",Silver:"#A8B2CC",Gold:"#E8A838",Platinum:"#4ECDC4",Emerald:"#52C47C",Diamond:"#6EA8E0",Master:"#9B72CF",Grandmaster:"#E85B5B",Challenger:"#FFD700"};
const REGIONS = ["EUW","EUNE","NA","KR","OCE","BR","JP","TR","LATAM"];
// Fixed scoring - not configurable
const PTS = {1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1};
const DEFAULT_SEASON_CONFIG = {
  dropWeeks: 0,
  finalBoost: 1.0,
  finaleClashes: 2,
  attendanceBonus: false,
  comebackBonus: false,
};
const TIERS = [{label:"S",min:850,col:"#FFD700"},{label:"A",min:650,col:"#52C47C"},{label:"B",min:450,col:"#4ECDC4"},{label:"C",min:200,col:"#9B72CF"},{label:"D",min:0,col:"#BECBD9"}];

function rc(r){return RCOLS[r]||"#A8B2CC";}
function tier(pts){return TIERS.find(t=>pts>=t.min)||TIERS[TIERS.length-1];}

// Avg placement colour coding
function avgCol(avg){
  const n=parseFloat(avg)||0;
  if(n===0)return"#BECBD9";
  if(n<3.0)return"#4ade80"; // green
  if(n<=5.0)return"#facc15"; // yellow
  return"#f87171"; // red
}

// ─── PLATFORM RANKING SYSTEM ─────────────────────────────────────────────────
const CLASH_RANKS=[
  {id:"iron",       name:"Iron",        icon:"⚙",  color:"#BECBD9", minXp:0,    maxXp:200},
  {id:"bronze",     name:"Bronze",      icon:"🥉",  color:"#CD7F32", minXp:200,  maxXp:500},
  {id:"silver",     name:"Silver",      icon:"🥈",  color:"#C0C0C0", minXp:500,  maxXp:900},
  {id:"gold",       name:"Gold",        icon:"🥇",  color:"#E8A838", minXp:900,  maxXp:1400},
  {id:"platinum",   name:"Platinum",    icon:"💠",  color:"#4ECDC4", minXp:1400, maxXp:2000},
  {id:"diamond",    name:"Diamond",     icon:"💎",  color:"#9B72CF", minXp:2000, maxXp:2800},
  {id:"master",     name:"Master",      icon:"🔮",  color:"#EAB308", minXp:2800, maxXp:3800},
  {id:"grandmaster",name:"Grandmaster", icon:"👁",  color:"#F87171", minXp:3800, maxXp:5000},
  {id:"challenger", name:"Clash Challenger",icon:"👑",color:"#E8A838",minXp:5000,maxXp:99999},
];

// XP rewards per action
const XP_REWARDS={
  play_game:25,       // just playing
  top4:15,            // bonus for top 4
  win:40,             // 1st place
  top2:25,            // 2nd place bonus
  clutch:20,          // clutch win
  streak_3:30,        // 3-win streak
  challenge_daily:50, // daily challenge
  challenge_weekly:120,// weekly challenge
  season_pts_100:60,  // every 100 season pts
};

function getClashRank(xp){
  return CLASH_RANKS.slice().reverse().find(r=>xp>=r.minXp)||CLASH_RANKS[0];
}
function getXpProgress(xp){
  const rank=getClashRank(xp);
  const next=CLASH_RANKS[CLASH_RANKS.indexOf(rank)+1];
  if(!next)return{rank,pct:100,current:xp,needed:0};
  const pct=Math.min(100,Math.round((xp-rank.minXp)/(next.minXp-rank.minXp)*100));
  return{rank,next,pct,current:xp-rank.minXp,needed:next.minXp-rank.minXp};
}
// Estimate XP from player stats (for demo data)
function estimateXp(p){
  return (p.games||0)*XP_REWARDS.play_game+(p.wins||0)*XP_REWARDS.win+(p.top4||0)*XP_REWARDS.top4+Math.floor((p.pts||0)/100)*XP_REWARDS.season_pts_100;
}

// ─── STATS ENGINE ─────────────────────────────────────────────────────────────
function computeStats(player){
  const h=player.clashHistory||[];
  const games=h.length||player.games||0;
  const wins=h.filter(g=>g.placement===1).length||player.wins||0;
  const top4=h.filter(g=>g.placement<=4).length||player.top4||0;
  const bot4=h.filter(g=>g.placement>4).length;
  // AVP = sum of all placements / total games (lower = better)
  const avgPlacement=h.length>0
    ?(h.reduce((s,g)=>s+(g.placement||0),0)/h.length)
    :(parseFloat(player.avg)||0);

  // Per-round avgs (from roundPlacements field in history)
  const roundAvgs={r1:null,r2:null,r3:null,finals:null};
  const roundKeys=["r1","r2","r3","finals"];
  roundKeys.forEach(rk=>{
    const vals=h.map(g=>g.roundPlacements?.[rk]).filter(v=>v!=null);
    if(vals.length>0)roundAvgs[rk]=(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2);
  });

  // Comeback rate: placed 5-8 in r1 but finished top4 overall
  const comebacks=h.filter(g=>g.roundPlacements?.r1>=5&&g.placement<=4).length;
  const comebackOpp=h.filter(g=>g.roundPlacements?.r1>=5).length;
  const comebackRate=comebackOpp>0?((comebacks/comebackOpp)*100).toFixed(0):0;

  // Clutch rate: won their lobby
  const clutches=h.filter(g=>g.claimedClutch).length;
  const clutchRate=games>0?((clutches/games)*100).toFixed(0):0;

  // PPG
  const ppg=games>0?(player.pts/games).toFixed(1):0;

  // Per-clash AVP: average placement within each individual clash (same formula, but per event)
  const perClashAvp=h.length>0
    ?h.map(g=>{
        const rp=g.roundPlacements||{};
        const rounds=Object.values(rp).filter(v=>v!=null);
        return rounds.length>0?(rounds.reduce((s,v)=>s+v,0)/rounds.length):g.placement;
      }).reduce((s,v,_,a)=>s+v/a.length,0).toFixed(2)
    :null;

  return{
    games,wins,top4,bot4,
    top1Rate:games>0?((wins/games)*100).toFixed(1):"0.0",
    top4Rate:games>0?((top4/games)*100).toFixed(1):"0.0",
    bot4Rate:games>0?((bot4/games)*100).toFixed(1):"0.0",
    avgPlacement:avgPlacement>0?avgPlacement.toFixed(2):"-",
    perClashAvp,
    roundAvgs,comebackRate,clutchRate,ppg,
  };
}

function effectivePts(player, seasonConfig) {
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

function tiebreaker(a, b) {
  var aPts = a.pts || 0, bPts = b.pts || 0;
  if (bPts !== aPts) return bPts - aPts;
  var aScore = (a.wins || 0) * 2 + (a.top4 || 0);
  var bScore = (b.wins || 0) * 2 + (b.top4 || 0);
  if (bScore !== aScore) return bScore - aScore;
  var placements = [1, 2, 3, 4, 5, 6, 7, 8];
  for (var i = 0; i < placements.length; i++) {
    var p = placements[i];
    var aC = (a.clashHistory || []).filter(function(h) { return h.place === p; }).length;
    var bC = (b.clashHistory || []).filter(function(h) { return h.place === p; }).length;
    if (bC !== aC) return bC - aC;
  }
  var aLast = a.clashHistory && a.clashHistory.length ? a.clashHistory[a.clashHistory.length - 1].place || 9 : 9;
  var bLast = b.clashHistory && b.clashHistory.length ? b.clashHistory[b.clashHistory.length - 1].place || 9 : 9;
  return aLast - bLast;
}

function isComebackEligible(player, allClashIds) {
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

function getAttendanceStreak(player, allClashIds) {
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

function computeSeasonBonuses(player, currentClashId, allClashIds, seasonConfig) {
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
const ACHIEVEMENTS=[
  // ── PLACEMENT MILESTONES ─────────────────────────────────
  {id:"first_blood",    tier:"bronze",    icon:"🩸",  name:"First Blood",       desc:"Win your first clash game",                            check:p=>p.wins>=1},
  {id:"hat_trick",      tier:"bronze",    icon:"🎩",  name:"Hat Trick",          desc:"3 total wins across any clashes",                      check:p=>p.wins>=3},
  {id:"top4_machine",   tier:"silver",    icon:"⚙️",  name:"Top 4 Machine",      desc:"Land top 4 in 10 different games",                     check:p=>p.top4>=10},
  {id:"podium_hunter",  tier:"silver",    icon:"🏅",  name:"Podium Hunter",      desc:"5 wins total",                                         check:p=>p.wins>=5},
  {id:"clutch_god",     tier:"gold",      icon:"⚡",  name:"Clutch God",         desc:"Win a 1v1 final round",                                check:p=>(p.clashHistory||[]).some(g=>g.clutch)},
  {id:"dynasty",        tier:"gold",      icon:"👑",  name:"Dynasty",            desc:"10 total wins - a true contender",                     check:p=>p.wins>=10},
  {id:"untouchable",    tier:"legendary", icon:"💠",  name:"Untouchable",        desc:"Finish in top 4 every game in a single clash",         check:p=>(p.clashHistory||[]).some(g=>g.placement<=4)&&p.top4>=p.games},
  {id:"the_grind",      tier:"legendary", icon:"🌑",  name:"The Grind",          desc:"Play 30+ games over the season",                       check:p=>p.games>=30},
  // ── STREAK ACHIEVEMENTS ───────────────────────────────────
  {id:"hot_start",      tier:"bronze",    icon:"🔥",  name:"Hot Start",          desc:"Win your first clash of the season",                   check:p=>p.wins>=1&&p.games<=8},
  {id:"on_fire",        tier:"silver",    icon:"🌋",  name:"On Fire",            desc:"3 win streak at any point",                            check:p=>p.bestStreak>=3},
  {id:"cant_stop",      tier:"gold",      icon:"🚀",  name:"Can't Stop",         desc:"5 consecutive wins",                                   check:p=>p.bestStreak>=5},
  {id:"goat_streak",    tier:"legendary", icon:"🐐",  name:"GOAT Streak",        desc:"7 win streak - absolutely unstoppable",                check:p=>p.bestStreak>=7},
  // ── POINTS ACHIEVEMENTS ────────────────────────────────────
  {id:"point_getter",   tier:"bronze",    icon:"💰",  name:"Point Getter",       desc:"Earn your first 100 Clash Points",                     check:p=>p.pts>=100},
  {id:"century",        tier:"silver",    icon:"💎",  name:"Half-K",             desc:"500 Clash Points accumulated",                         check:p=>p.pts>=500},
  {id:"big_dog",        tier:"gold",      icon:"🏆",  name:"Big Dog",            desc:"800 Clash Points - top tier territory",                check:p=>p.pts>=800},
  {id:"thousand_club",  tier:"legendary", icon:"🌟",  name:"Thousand Club",      desc:"1000+ Clash Points in a single season",                check:p=>p.pts>=1000},
  // ── SOCIAL / COMMUNITY ───────────────────────────────────
  {id:"regular",        tier:"bronze",    icon:"📅",  name:"Regular",            desc:"Show up to 5 clashes",                                 check:p=>p.games>=5},
  {id:"veteran",        tier:"silver",    icon:"🪖",  name:"Veteran",            desc:"20 total games across the season",                     check:p=>p.games>=20},
  {id:"season_finisher",tier:"gold",      icon:"🎖️",  name:"Season Finisher",    desc:"Complete every clash in the season",                   check:p=>p.games>=28},
  {id:"champion",       tier:"legendary", icon:"⚜️",  name:"Season Champion",    desc:"Finish #1 on the season leaderboard",                  check:p=>SEASON_CHAMPION&&p.name===SEASON_CHAMPION.name},
  // ── RARE / EASTER EGG ────────────────────────────────────
  {id:"dishsoap",       tier:"legendary", icon:"🧼",  name:"Squeaky Clean",      desc:"Only Dishsoap knows how he earned this.",              check:p=>p.name==="Dishsoap"||p.riotId?.toLowerCase().includes("dishsoap")},
  {id:"perfect_lobby",  tier:"legendary", icon:"🌀",  name:"The Anomaly",        desc:"Win a lobby without ever placing below 3rd in any round", check:p=>(p.clashHistory||[]).some(g=>g.placement===1&&(g.roundPlacements?Object.values(g.roundPlacements).every(v=>v<=3):true))},
  {id:"silent_grinder", tier:"gold",      icon:"👁",  name:"Silent Grinder",     desc:"Top 8 on the leaderboard with no wins - pure consistency", check:p=>p.pts>=400&&p.wins===0},
];

const MILESTONES=[
  {id:"m1",icon:"🥉",name:"Bronze Contender",pts:100,  reward:"Bronze badge on your profile",     check:p=>p.pts>=100},
  {id:"m2",icon:"🥈",name:"Silver Contender",pts:300,  reward:"Silver animated border",            check:p=>p.pts>=300},
  {id:"m3",icon:"🥇",name:"Gold Contender",  pts:600,  reward:"Gold sparkle border + title",       check:p=>p.pts>=600},
  {id:"m4",icon:"💎",name:"Diamond Tier",    pts:800,  reward:"Diamond holographic card effect",   check:p=>p.pts>=800},
  {id:"m5",icon:"👑",name:"Champion Tier",   pts:1000, reward:"Champion crown + Hall of Fame entry",check:p=>p.pts>=1000},
  {id:"m6",icon:"🔥",name:"Hot Streak",      pts:null, reward:"Flame icon next to your name",     check:p=>isHotStreak(p)},
  {id:"m7",icon:"🏆",name:"Event Winner",    pts:null, reward:"Winner trophy on your profile",    check:p=>p.wins>=1},
  {id:"m8",icon:"⚡",name:"Clutch Player",   pts:null, reward:"⚡ Clutch tag on your stats",     check:p=>(p.clashHistory||[]).some(g=>g.clutch)},
];


const MOCK_ACCOUNTS=[
  {id:"u1",email:"dishsoap@gmail.com",username:"Dishsoap",riotId:"Dishsoap#NA1",region:"NA",
   bio:"Challenger TFT player. 3x Clash champion. I don't lose lobbies, I redistribute wins.",
   twitch:"twitch.tv/dishsoap",twitter:"@DishsoapTFT",youtube:"",
   slug:"dishsoap",verified:true,role:"player",createdAt:"Jan 2025",
   linkedPlayerId:1},
  {id:"u2",email:"k3soju@gmail.com",username:"k3soju",riotId:"k3soju#NA1",region:"NA",
   bio:"Just vibing in lobbies. Content creator & Clash veteran.",
   twitch:"twitch.tv/k3soju",twitter:"@k3soju",youtube:"youtube.com/k3soju",
   slug:"k3soju",verified:true,role:"player",createdAt:"Feb 2025",
   linkedPlayerId:2},
];

// ─── CHAMPION SYSTEM ─────────────────────────────────────────────────────────
function getAchievements(p){return ACHIEVEMENTS.filter(a=>{try{return a.check(p);}catch{return false;}});}

function isHotStreak(p){return(p.currentStreak||0)>=3;}

function isOnTilt(p){return(p.tiltStreak||0)>=3;}

// ─── POST-CLASH AWARDS ENGINE ─────────────────────────────────────────────────

function computeClashAwards(players){
  const eligible=players.filter(p=>p.games>0);
  if(eligible.length===0)return[];

  const byPts=[...eligible].sort((a,b)=>b.pts-a.pts);
  const byAvp=[...eligible].filter(p=>p.games>=3).sort((a,b)=>parseFloat(a.avg||9)-parseFloat(b.avg||9));
  const byAvpWorst=[...eligible].filter(p=>p.games>=3).sort((a,b)=>parseFloat(b.avg||0)-parseFloat(a.avg||0));

  // Lobby Bully - most 1st place finishes
  const lobbyBully=byPts.reduce((best,p)=>(!best||p.wins>best.wins)?p:best,null);

  // The Choker - highest AVP but still in top half by pts (ironic)
  const topHalf=byPts.slice(0,Math.ceil(byPts.length/2));
  const choker=[...topHalf].filter(p=>p.games>=3).sort((a,b)=>parseFloat(b.avg||0)-parseFloat(a.avg||0))[0];

  // Highest single-clash score - best haul ever
  const singleMVP=eligible.reduce((best,p)=>(!best||(p.bestHaul||0)>(best.bestHaul||0))?p:best,null);

  // Most Improved - biggest avg drop (we simulate vs "last season" avg using avg-0.5 as prior)
  const mostImproved=byAvp[0]||null;

  // Ice Cold - most consistent, lowest AVP (5+ games)
  const iceCold=byAvp[0]||null;

  // On Fire - best 1st place streak
  const onFire=[...eligible].sort((a,b)=>(b.bestStreak||0)-(a.bestStreak||0))[0];

  return[
    lobbyBully&&{icon:"🗡️",id:"bully",title:"Lobby Bully",desc:"Most 1st place finishes",winner:lobbyBully,stat:lobbyBully.wins+" wins",color:"#E8A838"},
    choker&&choker!==lobbyBully&&{icon:"💀",id:"choker",title:"The Choker",desc:"Highest AVP in the top half - ouch",winner:choker,stat:"AVP "+computeStats(choker).avgPlacement,color:"#F87171"},
    singleMVP&&{icon:"⚡",id:"single",title:"Single Clash MVP",desc:"Highest points in one event",winner:singleMVP,stat:(singleMVP.bestHaul||0)+" pts haul",color:"#EAB308"},
    mostImproved&&{icon:"📈",id:"improved",title:"Most Improved",desc:"Biggest AVP improvement this season",winner:mostImproved,stat:"AVP "+computeStats(mostImproved).avgPlacement,color:"#52C47C"},
    iceCold&&iceCold!==mostImproved&&{icon:"🧊",id:"cold",title:"Ice Cold",desc:"Most consistent - lowest AVP (3+ games)",winner:iceCold,stat:"AVP "+computeStats(iceCold).avgPlacement,color:"#4ECDC4"},
    onFire&&{icon:"🔥",id:"streak",title:"On Fire",desc:"Best 1st place streak this season",winner:onFire,stat:(onFire.bestStreak||0)+" in a row",color:"#F97316"},
    byPts[0]&&{icon:"🏆",id:"mvp",title:"MVP",desc:"Highest season points",winner:byPts[0],stat:byPts[0].pts+" pts",color:"#E8A838"},
    byPts[0]&&{icon:"📊",id:"consistent2",title:"Most Consistent",desc:"Lowest AVP (3+ games)",winner:byAvp[0],stat:"AVP "+(byAvp[0]?computeStats(byAvp[0]).avgPlacement:"-"),color:"#C4B5FD"},
  ].filter(Boolean);
}

// ─── RICH SEED DATA ───────────────────────────────────────────────────────────

function mkHistory(entries){
  const clashes=[
    {id:"c10",name:"Clash #10",date:"Feb 8 2026"},
    {id:"c11",name:"Clash #11",date:"Feb 15 2026"},
    {id:"c12",name:"Clash #12",date:"Feb 22 2026"},
    {id:"c13",name:"Clash #13",date:"Mar 1 2026"},
  ];
  return clashes.map((c,i)=>{
    const e=entries[i]||{pl:Math.ceil(Math.random()*8),r1:Math.ceil(Math.random()*8),r2:Math.ceil(Math.random()*8),r3:Math.ceil(Math.random()*8)};
    return{...c,placement:e.pl,pts:PTS[e.pl]||1,clashPts:PTS[e.pl]||1,
      roundPlacements:{r1:e.r1,r2:e.r2,r3:e.r3,finals:e.pl},
      claimedClutch:e.clutch||false};
  });
}

const HOMIES_IDS=[];
const SEED=[];
const PAST_CLASHES=[];

const HOF_RECORDS=[];
const RETIRED_LEGENDS=[];


// ─── AUTH / ACCOUNT SYSTEM ───────────────────────────────────────────────────
// ─── CHAMPION SYSTEM ─────────────────────────────────────────────────────────
const SEASON_CHAMPION=null;

// ─── MILESTONE REWARDS ────────────────────────────────────────────────────────
// ─── SPONSOR / AD DATA ────────────────────────────────────────────────────────
const SPONSORS=[];
const ACTIVE_SPONSOR=null;

// ─── PREMIUM TIERS ────────────────────────────────────────────────────────────
const PREMIUM_TIERS=[
  {
    id:"free", name:"Player", price:"€0", period:"forever", color:"#BECBD9",
    desc:"Compete in every weekly clash. Always free.",
    features:["Enter every TFT Clash event","Full season stats & leaderboard","Personal profile with career history","Achievements, milestones & XP ranks","Hall of Fame & rival tracking","Discord results sharing"],
    cta:"You're In", ctaV:"dark",
  },
  {
    id:"pro", name:"Pro", price:"€4.99", period:"/ month", color:"#E8A838", popular:true,
    desc:"For players who take the season seriously.",
    features:["Everything in Player","Season Recap card (shareable PNG)","Extended stat history - all seasons","Priority check-in & reserved slot","Pro badge on profile & leaderboard","Exclusive Discord channels (tactics, meta, pro-only)","Early access to new features","Ad-free experience"],
    cta:"Go Pro", ctaV:"primary",
  },
  {
    id:"org", name:"Host", price:"€24.99", period:"/ month", color:"#9B72CF",
    desc:"Run your own TFT Clash circuit on our platform.",
    features:["Everything in Pro","Create & manage your own clash events","Custom branding on tournament pages","Private / invite-only clashes","Advanced admin dashboard","CSV data export","Dedicated support"],
    cta:"Apply to Host", ctaV:"purple",
  },
];


const GCSS=`
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{background:#07070E;}
html{color:#D4CEC9;font-family:'Inter',system-ui,sans-serif;font-size:15px;line-height:1.65;-webkit-text-size-adjust:100%;}
body{overflow-x:hidden;padding-bottom:env(safe-area-inset-bottom);min-height:100vh;}
::-webkit-scrollbar{width:4px;background:#0A0F1A;}
::-webkit-scrollbar-thumb{background:rgba(232,168,56,.3);border-radius:3px;}
input,select,textarea{font-family:'Inter',sans-serif;outline:none;color:#F2EDE4;-webkit-appearance:none;appearance:none;}
button{font-family:'Inter',sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;}
input::placeholder{color:#6B7280!important;opacity:1!important;}
select option{background:#1C2030;color:#F2EDE4;}
h1,h2,h3,h4{font-family:'Cinzel',Georgia,serif;font-weight:700;}
.mono{font-family:'JetBrains Mono',monospace!important;}
.cond{font-family:'Inter',sans-serif!important;}

/* ── animations ─────────────────────────────────────────────── */
@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
@keyframes slidein{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes fadeup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes reveal-up{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse-gold{0%,100%{box-shadow:0 0 0 0 rgba(232,168,56,.4)}70%{box-shadow:0 0 0 14px rgba(232,168,56,0)}}
@keyframes pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}70%{box-shadow:0 0 0 12px rgba(220,38,38,0)}}
@keyframes disp-anim{0%,100%{border-color:rgba(220,38,38,.4)}50%{border-color:rgba(220,38,38,.9);box-shadow:0 0 24px rgba(220,38,38,.25)}}
@keyframes lock-flash{0%{background:rgba(82,196,124,0)}40%{background:rgba(82,196,124,.12)}100%{background:rgba(82,196,124,0)}}
@keyframes confetti-fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes champ-reveal{0%{transform:scale(.75) translateY(30px);opacity:0;filter:blur(12px)}100%{transform:scale(1) translateY(0);opacity:1;filter:blur(0)}}
@keyframes crown-glow{0%,100%{filter:drop-shadow(0 0 8px rgba(232,168,56,.7))}50%{filter:drop-shadow(0 0 22px rgba(232,168,56,1))}}
@keyframes slide-drawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.au{animation:fadeup .4s ease both}
.au1{animation:fadeup .4s .08s ease both}
.au2{animation:fadeup .4s .16s ease both}
.au3{animation:fadeup .4s .26s ease both}

/* ── layout helpers ──────────────────────────────────────────── */
.wrap{max-width:1400px;margin:0 auto;padding:0 16px;}
.page{padding:24px 16px 100px;}

/* ── mobile bottom nav ───────────────────────────────────────── */
.bottom-nav{
  position:fixed;bottom:0;left:0;right:0;z-index:200;
  background:rgba(7,7,14,.98);
  border-top:1px solid rgba(232,168,56,.2);
  box-shadow:0 -4px 24px rgba(0,0,0,.5),0 -1px 0 rgba(232,168,56,.06);
  display:flex;
  padding-bottom:env(safe-area-inset-bottom);
  backdrop-filter:blur(20px);
}
.bottom-nav button{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;padding:9px 4px;background:none;border:none;
  font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  color:#6B7280;transition:color .2s,text-shadow .2s;font-family:'Inter',sans-serif;
  -webkit-tap-highlight-color:transparent;min-height:54px;
}
.bottom-nav button.active{color:#E8A838;}
.bottom-nav button span.icon{font-size:20px;line-height:1;}

/* ── desktop top nav (hidden on mobile) ──────────────────────── */
.top-nav{
  position:sticky;top:0;z-index:100;
  background:rgba(7,7,14,.97);
  border-bottom:1px solid rgba(232,168,56,.15);
  backdrop-filter:blur(20px);
  display:none;
}
@media(min-width:768px){
  .top-nav{display:block;}
  .bottom-nav{display:none;}
  .page{padding:28px 24px 40px;}
}

/* ── placement buttons - mobile big tap targets ───────────────── */
.place-btn{
  border-radius:6px;padding:10px 2px;
  font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;
  border:1px solid rgba(242,237,228,.08);
  transition:all .1s;cursor:pointer;
}
@media(max-width:767px){
  .place-btn{padding:14px 2px;font-size:15px;}
}

/* ── grid helpers ────────────────────────────────────────────── */
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
.grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;}
@media(max-width:767px){
  .grid-2{grid-template-columns:1fr;}
  .grid-3{grid-template-columns:1fr;}
  .grid-4{grid-template-columns:1fr 1fr;}
}
.grid-home{display:grid;grid-template-columns:1.15fr 1fr;gap:48px;align-items:start;}
@media(max-width:900px){.grid-home{grid-template-columns:1fr;gap:24px;}}

/* ── More drawer ─────────────────────────────────────────────── */
.drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:190;animation:fadeup .2s ease;}
.drawer{position:fixed;left:0;top:0;bottom:0;width:260px;background:linear-gradient(180deg,#0E1826,#08101A);border-right:1px solid rgba(232,168,56,.2);z-index:195;animation:slide-drawer .22s ease;display:flex;flex-direction:column;padding:32px 0;box-shadow:4px 0 32px rgba(0,0,0,.6);}

/* ── esports glow enhancements ───────────────────────────────── */
@keyframes gold-shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes neon-flicker{0%,19%,21%,23%,25%,54%,56%,100%{text-shadow:0 0 20px rgba(232,168,56,.7),0 0 40px rgba(232,168,56,.35),0 0 80px rgba(232,168,56,.15)}20%,24%,55%{text-shadow:none;}}
@keyframes border-glow{0%,100%{border-color:rgba(155,114,207,.3)}50%{border-color:rgba(155,114,207,.7);box-shadow:0 0 20px rgba(155,114,207,.2)}}
@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}

/* Scanline overlay */
.scanlines::after{content:"";position:fixed;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.05) 3px,rgba(0,0,0,.05) 4px);}

/* Logo hex glow */
.hex-logo{filter:drop-shadow(0 0 6px rgba(232,168,56,.55));transition:filter .3s;}
.hex-logo:hover{filter:drop-shadow(0 0 14px rgba(232,168,56,.95)) drop-shadow(0 0 30px rgba(232,168,56,.4));}

/* Gold shimmer text */
.gold-shimmer{background:linear-gradient(90deg,#C4882A,#FFD700,#E8A838,#FFD700,#C4882A);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gold-shimmer 4s linear infinite;}

/* Top nav enhancements */
.top-nav{box-shadow:0 1px 0 rgba(232,168,56,.12),0 8px 40px rgba(0,0,0,.7);}
.top-nav button:hover{color:#F2EDE4!important;}
.top-nav button[data-active="true"]{color:#E8A838!important;text-shadow:0 0 12px rgba(232,168,56,.5);}

/* Bottom nav active glow */
.bottom-nav button.active{color:#E8A838;text-shadow:0 0 10px rgba(232,168,56,.6);}
.bottom-nav button.active .icon{filter:drop-shadow(0 0 5px rgba(232,168,56,.7));}
.bottom-nav button{transition:color .2s,text-shadow .2s;}

/* Standings row hover */
.standings-row{transition:background .15s,transform .1s,box-shadow .15s;}
.standings-row:hover{background:rgba(232,168,56,.08)!important;transform:translateX(4px);box-shadow:inset 4px 0 0 rgba(232,168,56,.65),0 2px 20px rgba(232,168,56,.06);}
.standings-row-1{background:rgba(232,168,56,.05)!important;}
.standings-row-1 .rank-num{color:#E8A838!important;text-shadow:0 0 12px rgba(232,168,56,.8);}
.standings-row-2 .rank-num{text-shadow:0 0 8px rgba(192,192,192,.7);}
.standings-row-3 .rank-num{text-shadow:0 0 8px rgba(205,127,50,.7);}

/* Stat boxes glow on hover */
.stat-box{background:linear-gradient(145deg,#131C2A,#0D1421);border:1px solid rgba(242,237,228,.1);border-radius:12px;padding:16px 14px;text-align:center;transition:border-color .2s,box-shadow .2s,transform .15s;cursor:default;}
.stat-box:hover{border-color:rgba(232,168,56,.3);box-shadow:0 0 20px rgba(232,168,56,.08);transform:translateY(-2px);}

/* Countdown neon digits */
.countdown-digit{text-shadow:0 0 20px rgba(232,168,56,.7),0 0 40px rgba(232,168,56,.3)!important;}

/* Input neon focus */
input:focus,select:focus,textarea:focus{box-shadow:0 0 0 1px rgba(155,114,207,.5),0 0 16px rgba(155,114,207,.12)!important;border-color:rgba(155,114,207,.6)!important;}

/* Panel hover shimmer line */
.panel-hover-shimmer{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(232,168,56,.55),transparent);opacity:0;transition:opacity .3s;}

/* Btn primary pulse */
.btn-primary-glow{box-shadow:0 4px 20px rgba(232,168,56,.3),0 0 40px rgba(232,168,56,.1)!important;transition:box-shadow .2s,transform .15s!important;}
.btn-primary-glow:hover{box-shadow:0 6px 30px rgba(232,168,56,.5),0 0 60px rgba(232,168,56,.2)!important;transform:translateY(-1px)!important;}

/* How-it-works step number neon */
.step-num{box-shadow:0 0 12px rgba(155,114,207,.3);transition:box-shadow .2s,background .2s;}
.step-num:hover{box-shadow:0 0 20px rgba(155,114,207,.5);background:rgba(155,114,207,.2)!important;}

/* Points badge glow */
.pts-glow{text-shadow:0 0 12px rgba(232,168,56,.6);}

/* Live dot pulse enhanced */
@keyframes live-ping{0%{transform:scale(1);opacity:1}70%{transform:scale(2.5);opacity:0}100%{transform:scale(1);opacity:0}}
.live-dot-ring{animation:live-ping 1.8s cubic-bezier(0,.2,.8,1) infinite;}

/* ── nav active underline ────────────────────────────────── */
.top-nav button{position:relative;}
.top-nav button[data-active="true"]::after{content:"";position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);width:24px;height:2px;background:#E8A838;border-radius:2px;box-shadow:0 0 8px rgba(232,168,56,.8);}

/* ── section divider ─────────────────────────────────────── */
.section-div{height:1px;background:linear-gradient(90deg,rgba(232,168,56,.3),rgba(155,114,207,.15),transparent);margin:16px 0;}

/* ── input focus bg ──────────────────────────────────────── */
input:focus,select:focus,textarea:focus{background:#192237!important;}

/* ── row champion highlight ──────────────────────────────── */
.row-champion{background:linear-gradient(90deg,rgba(232,168,56,.09),rgba(232,168,56,.03),transparent)!important;}

/* ── deep card variant ───────────────────────────────────── */
.card-deep{background:linear-gradient(160deg,#0A1020,#060D18)!important;border-color:rgba(155,114,207,.18)!important;}
/* ── standings row hover ───────────────────────────────────────────── */
.standings-row{transition:background .15s;}
.standings-row:hover{background:rgba(242,237,228,.05)!important;}
.standings-row-1:hover{background:rgba(232,168,56,.13)!important;}
/* ── me row highlight ─────────────────────────────────────────────── */
.standings-row-me{background:rgba(155,114,207,.1)!important;border-left:2px solid #9B72CF!important;}
/* ── float animation ───────────────────────────────────────────────── */
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes glow-text{0%,100%{text-shadow:0 0 14px rgba(232,168,56,.5)}50%{text-shadow:0 0 32px rgba(232,168,56,.9),0 0 64px rgba(232,168,56,.3)}}

/* ── Phase 5: Arena redesign ──────────────────────────────────────────── */
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)}}
@keyframes camelGlow{0%,100%{opacity:.18;filter:drop-shadow(0 0 0px #E8A838)}50%{opacity:.55;filter:drop-shadow(0 0 6px #E8A838)}}
.glass{background:rgba(255,255,255,.04)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.09)!important;}
.display{font-family:'Cinzel',serif;font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:-.02em;}
.section-title{font-family:'Cinzel',serif;font-size:clamp(18px,2.5vw,28px);font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.accent-bar::before{content:"";display:block;height:3px;background:linear-gradient(90deg,#9B72CF,#4ECDC4);border-radius:2px;margin-bottom:16px;}
.panel-glass{background:rgba(255,255,255,.035)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.09)!important;border-radius:16px!important;}
.panel-gradient{background:linear-gradient(135deg,rgba(155,114,207,.1),rgba(78,205,196,.04))!important;border:1px solid rgba(155,114,207,.18)!important;}
.countdown-tile{background:linear-gradient(160deg,rgba(155,114,207,.15),rgba(78,205,196,.05));border:1px solid rgba(155,114,207,.3);border-radius:12px;padding:14px 12px;text-align:center;min-width:64px;}
.countdown-tile .digit{font-family:'JetBrains Mono',monospace;font-size:38px;font-weight:800;color:#E8A838;line-height:1;text-shadow:0 0 24px rgba(232,168,56,.6),0 0 48px rgba(232,168,56,.2);}
.countdown-tile .unit{font-family:'Inter',sans-serif;font-size:9px;color:#6B7280;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:4px;}
.hero-panel{background:radial-gradient(ellipse at 50% 0%,rgba(155,114,207,.18) 0%,rgba(8,8,15,.0) 70%);border:1px solid rgba(155,114,207,.2);border-radius:20px;padding:40px 32px;position:relative;overflow:hidden;}
.hero-panel::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(155,114,207,.06),rgba(78,205,196,.02));pointer-events:none;}
.top-nav{border-top:2px solid #9B72CF!important;box-shadow:0 2px 0 rgba(155,114,207,.08),0 1px 0 rgba(232,168,56,.1),0 8px 40px rgba(0,0,0,.7)!important;}
`;

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function Hexbg(){
  return(
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
      <div className="scanlines" style={{position:"absolute",inset:0,zIndex:1,pointerEvents:"none"}}/>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.04}} xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="hxp" x="0" y="0" width="60" height="104" patternUnits="userSpaceOnUse">
          <path d="M30 2L58 18L58 50L30 66L2 50L2 18Z" fill="none" stroke="#E8A838" strokeWidth="1"/>
          <path d="M30 38L58 54L58 86L30 102L2 86L2 54Z" fill="none" stroke="#E8A838" strokeWidth="1"/>
        </pattern></defs>
        <rect width="100%" height="100%" fill="url(#hxp)"/>
      </svg>
      <div style={{position:"absolute",top:"-20%",right:"0",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,168,56,.08),transparent 65%)"}}/>
      <div style={{position:"absolute",bottom:"0",left:"-15%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(78,205,196,.06),transparent 65%)"}}/>
      <div style={{position:"absolute",top:"40%",left:"35%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(155,114,207,.04),transparent 65%)"}}/>
    </div>
  );
}

function Panel({children,style,glow,accent,danger,color,hover,onClick}){
  const [hov,setHov]=useState(false);
  const bdr=danger?"rgba(220,38,38,.4)":glow?"rgba(232,168,56,.25)":color?(color+"40"):"rgba(242,237,228,.07)";
  const shd=danger?"0 0 24px rgba(220,38,38,.12)":glow?"0 8px 48px rgba(232,168,56,.14),0 2px 8px rgba(0,0,0,.4)":"0 2px 12px rgba(0,0,0,.35)";
  const topLine=danger?"linear-gradient(90deg,#DC2626,transparent)":glow||accent?"linear-gradient(90deg,#E8A838,transparent)":color?`linear-gradient(90deg,${color},transparent)`:null;
  return(
    <div onClick={onClick}
      onMouseEnter={hover?()=>setHov(true):undefined}
      onMouseLeave={hover?()=>setHov(false):undefined}
      style={Object.assign({background:"rgba(13,19,33,.75)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:"1px solid "+bdr,borderRadius:16,position:"relative",overflow:"hidden",
        boxShadow:hover&&hov?"0 12px 56px rgba(232,168,56,.18),0 4px 16px rgba(0,0,0,.5)":shd,
        transition:"box-shadow .2s,transform .2s",
        transform:hover&&hov?"translateY(-2px)":"none",
        cursor:onClick?"pointer":"default"},style||{})}>
      {topLine&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:topLine,zIndex:1}}/>}
      {children}
    </div>
  );
}

function Btn({children,onClick,v,s,disabled,full,style}){
  const variant=v||"primary";
  const size=s||"md";
  const pad=size==="sm"?"6px 13px":size==="lg"?"14px 32px":size==="xl"?"18px 44px":"11px 20px";
  const fs=size==="sm"?12:size==="lg"?14:size==="xl"?16:13;
  const VS={
    primary:{background:"linear-gradient(135deg,#F0B544,#D4922A)",color:"#07070E",border:"none",boxShadow:"0 4px 24px rgba(232,168,56,.3)"},
    ghost:{background:"transparent",color:"#E8A838",border:"1px solid rgba(232,168,56,.35)"},
    danger:{background:"rgba(220,38,38,.1)",color:"#F87171",border:"1px solid rgba(220,38,38,.35)"},
    success:{background:"rgba(82,196,124,.1)",color:"#6EE7B7",border:"1px solid rgba(82,196,124,.35)"},
    dark:{background:"#1C2030",color:"#C8BFB0",border:"1px solid rgba(242,237,228,.1)"},
    purple:{background:"rgba(155,114,207,.1)",color:"#C4B5FD",border:"1px solid rgba(155,114,207,.35)"},
    teal:{background:"rgba(78,205,196,.1)",color:"#5EEAD4",border:"1px solid rgba(78,205,196,.35)"},
    crimson:{background:"rgba(127,29,29,.95)",color:"#FCA5A5",border:"1px solid rgba(220,38,38,.6)"},
    warning:{background:"rgba(249,115,22,.1)",color:"#FB923C",border:"1px solid rgba(249,115,22,.35)"},
  };
  return(
    <button onClick={disabled?undefined:onClick}
      style={Object.assign({display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,
        borderRadius:8,padding:pad,fontSize:fs,fontWeight:600,transition:"all .15s",
        opacity:disabled?.35:1,cursor:disabled?"not-allowed":"pointer",
        width:full?"100%":undefined,letterSpacing:".02em",minHeight:size==="sm"?32:42},
        VS[variant]||VS.primary,style||{})}>
      {children}
    </button>
  );
}

function Inp({value,onChange,placeholder,type,onKeyDown,style}){
  const [f,setF]=useState(false);
  return(
    <input type={type||"text"} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} onKeyDown={onKeyDown}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={Object.assign({width:"100%",background:"#141E30",
        border:f?"1px solid rgba(232,168,56,.6)":"1px solid rgba(242,237,228,.11)",
        borderRadius:8,padding:"12px 14px",color:"#F2EDE4",fontSize:15,
        transition:"border .15s,background .15s",lineHeight:1.4,minHeight:46},style||{})}/>
  );
}

function Sel({value,onChange,children,style}){
  return(
    <div style={{position:"relative",...(style?.width?{width:style.width}:{})}}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={Object.assign({width:"100%",background:"#141E30",border:"1px solid rgba(242,237,228,.11)",
          borderRadius:8,padding:"12px 36px 12px 14px",color:"#F2EDE4",fontSize:15,minHeight:46,
          appearance:"none",cursor:"pointer"},style||{})}>
        {children}
      </select>
      <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#BECBD9",fontSize:11}}>▼</div>
    </div>
  );
}


function TierBadge({pts}){
  const t=tier(pts);
  return(
    <span className="cond" style={{background:t.col+"22",border:"1px solid "+t.col+"55",
      borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:800,color:t.col,letterSpacing:".08em"}}>
      {t.label}
    </span>
  );
}

function ClashRankBadge({xp,size,showProgress}){
  const {rank,next,pct,current,needed}=getXpProgress(xp||0);
  const sm=size==="sm";
  return(
    <div style={{display:"inline-flex",flexDirection:showProgress?"column":"row",alignItems:showProgress?"stretch":"center",gap:showProgress?4:5}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:4,
        background:rank.color+"18",border:"1px solid "+rank.color+"44",
        borderRadius:sm?6:8,padding:sm?"2px 7px":"4px 10px"}}>
        <span style={{fontSize:sm?12:15}}>{rank.icon}</span>
        <span style={{fontSize:sm?10:12,fontWeight:700,color:rank.color,letterSpacing:".04em"}}>{rank.name}</span>
      </div>
      {showProgress&&next&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:10,color:"#BECBD9"}}>{current} / {needed} XP</span>
            <span style={{fontSize:10,color:rank.color,fontWeight:700}}>{pct}%</span>
          </div>
          <Bar val={current} max={needed} color={rank.color} h={4}/>
          <div style={{fontSize:10,color:"#9AAABF",marginTop:3}}>Next: {next.icon} {next.name}</div>
        </div>
      )}
    </div>
  );
}


function AvgBadge({avg}){
  const n=parseFloat(avg)||0;
  const c=avgCol(avg);
  if(n===0)return<span className="mono" style={{fontSize:13,color:"#BECBD9"}}>-</span>;
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:5}}>
      <span className="mono" style={{fontSize:13,fontWeight:700,color:c}}>{n.toFixed(2)}</span>
      <div style={{width:28,height:3,background:"#1C2030",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:Math.max(0,((8-n)/7)*100)+"%",background:c,borderRadius:99}}/>
      </div>
    </div>
  );
}

function Tag({children,color,size}){
  const c=color||"#E8A838";
  return(
    <span className="cond" style={{background:c+"1A",border:"1px solid "+c+"40",borderRadius:4,
      padding:size==="sm"?"2px 6px":"2px 8px",fontSize:size==="sm"?9:10,fontWeight:700,
      letterSpacing:".06em",color:c,textTransform:"uppercase",whiteSpace:"nowrap"}}>
      {children}
    </span>
  );
}

function Bar({val,max,color,h}){
  const pct=Math.min(100,(val/Math.max(max||1,1))*100);
  return(
    <div style={{height:h||3,background:"#1C2030",borderRadius:99,overflow:"hidden",flex:1}}>
      <div style={{height:"100%",width:pct+"%",background:color||"linear-gradient(90deg,#E8A838,#D4922A)",borderRadius:99,transition:"width .7s ease"}}/>
    </div>
  );
}

function Dot({color,size}){
  const c=color||"#52C47C";const s=size||7;
  return <div style={{width:s,height:s,borderRadius:"50%",background:c,animation:"blink 2s infinite",flexShrink:0}}/>;
}

function Divider({label}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0"}}>
      <div style={{flex:1,height:1,background:"rgba(242,237,228,.07)"}}/>
      {label&&<span className="cond" style={{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".14em",textTransform:"uppercase"}}>{label}</span>}
      <div style={{flex:1,height:1,background:"rgba(242,237,228,.07)"}}/>
    </div>
  );
}

function Toast({msg,type,onClose}){
  useEffect(()=>{const t=setTimeout(onClose,5000);return()=>clearTimeout(t);},[]);
  const c=type==="success"?"#6EE7B7":type==="error"?"#F87171":type==="info"?"#60A5FA":"#E8A838";
  return(
    <div style={{background:"#151D2B",border:"1px solid "+c+"40",borderLeft:"3px solid "+c,
      borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,
      boxShadow:"0 8px 40px rgba(0,0,0,.6)",animation:"slidein .3s ease",
      minWidth:260,maxWidth:360}}>
      <span style={{fontSize:17,color:c}}>{type==="success"?"✓":type==="error"?"✕":"ℹ"}</span>
      <span style={{flex:1,color:"#F2EDE4",fontSize:14,lineHeight:1.4}}>{msg}</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:"#BECBD9",cursor:"pointer",fontSize:20,lineHeight:1,padding:"2px 4px",minWidth:28,minHeight:28}}>×</button>
    </div>
  );
}

function Confetti({active}){
  if(!active)return null;
  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {Array.from({length:80},(_,i)=>(
        <div key={i} style={{position:"absolute",left:(Math.random()*100)+"%",top:"-15px",
          width:Math.random()*10+4+"px",height:Math.random()*14+6+"px",
          background:["#E8A838","#4ECDC4","#9B72CF","#52C47C","#F87171","#F2EDE4","#FFD700"][i%7],
          borderRadius:Math.random()>.5?"50%":"2px",
          animation:`confetti-fall ${Math.random()*3+2}s ${Math.random()*2.5}s ease-in forwards`,
          transform:`rotate(${Math.random()*360}deg)`}}/>
      ))}
    </div>
  );
}

function Sparkline({data,color,w,h}){
  if(!data||data.length<2)return null;
  const W=typeof w==="number"?w:80,H=h||28;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-((v-min)/range)*(H-4)+2}`).join(" ");
  const fill=`${pts} ${W},${H} 0,${H}`;
  const gid="sg"+(color||"gold").replace(/[^a-z0-9]/gi,"");
  return(
    <svg width={W} height={H} style={{overflow:"visible",flexShrink:0,display:"block"}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color||"#E8A838"} stopOpacity=".3"/>
          <stop offset="100%" stopColor={color||"#E8A838"} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={fill} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color||"#E8A838"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={(data.length-1)/(data.length-1)*W} cy={H-((data[data.length-1]-min)/range)*(H-4)+2} r="2.5" fill={color||"#E8A838"}/>
    </svg>
  );
}


// ─── SPONSOR BANNER ───────────────────────────────────────────────────────────
function SponsorBanner({sponsor,onNavigate}){
  const s=sponsor||ACTIVE_SPONSOR;
  if(!s)return null;
  const isInternal=s.url==="#";
  const inner=(
    <div style={{background:s.isPromo?"rgba(155,114,207,.05)":"rgba(255,255,255,.03)",
      border:"1px solid "+(s.isPromo?"rgba(155,114,207,.25)":"rgba(242,237,228,.08)"),
      borderRadius:10,padding:"12px 16px",
      display:"flex",alignItems:"center",gap:12,
      transition:"all .2s",cursor:"pointer"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=s.isPromo?"rgba(155,114,207,.5)":"rgba(242,237,228,.2)";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=s.isPromo?"rgba(155,114,207,.25)":"rgba(242,237,228,.08)";}}>
      <div style={{width:40,height:40,borderRadius:8,background:s.isPromo?"rgba(155,114,207,.12)":"#111827",
        border:"1px solid "+(s.isPromo?"rgba(155,114,207,.3)":"rgba(242,237,228,.1)"),
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
        {s.logo}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:700,fontSize:13,color:s.isPromo?"#C4B5FD":"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
        <div style={{fontSize:11,color:"#BECBD9",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.tagline}</div>
      </div>
      <div style={{background:s.isPromo?"rgba(155,114,207,.15)":"rgba(255,255,255,.05)",
        border:"1px solid "+(s.isPromo?"rgba(155,114,207,.4)":"rgba(242,237,228,.1)"),
        borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,
        color:s.isPromo?"#C4B5FD":"#C8BFB0",flexShrink:0,whiteSpace:"nowrap"}}>
        {s.cta}
      </div>
    </div>
  );
  if(isInternal) return(
    <div onClick={()=>onNavigate&&onNavigate("fantasy")} style={{display:"block",textDecoration:"none",margin:"0 0 14px",cursor:"pointer"}}>{inner}</div>
  );
  return(
    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{display:"block",textDecoration:"none",margin:"0 0 14px"}}>{inner}</a>
  );
}

// ─── CHAMPION HERO CARD (homepage) ────────────────────────────────────────────
function ChampionHeroCard({champion,onClick}){
  const c=champion||SEASON_CHAMPION;
  if(!c)return null;
  return(
    <div onClick={onClick} style={{position:"relative",overflow:"hidden",borderRadius:16,
      background:"linear-gradient(135deg,rgba(232,168,56,.16),rgba(155,114,207,.08),rgba(7,7,14,.98))",
      border:"1px solid rgba(232,168,56,.55)",
      boxShadow:"0 0 50px rgba(232,168,56,.14),0 4px 24px rgba(0,0,0,.4)",
      padding:"20px 22px",cursor:onClick?"pointer":"default",
      animation:"pulse-gold 4s infinite"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>
      {/* Stars */}
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{position:"absolute",width:2,height:2,borderRadius:"50%",background:"#E8A838",
          top:(10+i*15)+"%",right:(3+i*5)+"%",opacity:.4,animation:`blink ${1.5+i*.4}s ${i*.2}s infinite`}}/>
      ))}
      <div style={{position:"relative",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{textAlign:"center",flexShrink:0}}>
          <div style={{fontSize:22,animation:"crown-glow 2.5s infinite",marginBottom:4}}>👑</div>
          <div style={{width:56,height:56,borderRadius:"50%",
            background:"rgba(232,168,56,.15)",border:"2px solid #E8A838",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:22,fontWeight:700,color:"#E8A838",fontFamily:"'Cinzel',serif",
            margin:"0 auto",boxShadow:"0 0 20px rgba(232,168,56,.3)"}}>
            {c.name.charAt(0)}
          </div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div className="cond" style={{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".2em",textTransform:"uppercase",marginBottom:2}}>{c.season} Champion</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(16px,3vw,24px)",fontWeight:900,color:"#E8A838",lineHeight:1,textShadow:"0 0 20px rgba(232,168,56,.4)"}}>{c.name}</div>
          <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
            <Tag color="#E8A838" size="sm">👑 {c.title}</Tag>
            <Tag color="#4ECDC4" size="sm">{c.rank}</Tag>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,flexShrink:0}}>
          {[["Pts",c.pts,"#E8A838"],["AVP",c.avgPlacement,avgCol(c.avgPlacement)],["Wins",c.wins,"#6EE7B7"],["Clutch",c.clutches+"×","#9B72CF"]].map(([l,v,col])=>(
            <div key={l} style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.12)",borderRadius:7,padding:"6px 10px",textAlign:"center"}}>
              <div className="mono" style={{fontSize:15,fontWeight:700,color:col,lineHeight:1}}>{v}</div>
              <div className="cond" style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MILESTONE CARD ────────────────────────────────────────────────────────────
function MilestoneCard({milestone,unlocked}){
  return(
    <div style={{background:unlocked?"rgba(232,168,56,.05)":"rgba(255,255,255,.02)",
      border:"1px solid "+(unlocked?"rgba(232,168,56,.3)":"rgba(242,237,228,.06)"),
      borderRadius:10,padding:"13px 14px",opacity:unlocked?1:.5,
      transition:"all .2s"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:unlocked?8:0}}>
        <span style={{fontSize:22,filter:unlocked?"none":"grayscale(1)"}}>{milestone.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,color:unlocked?"#F2EDE4":"#BECBD9"}}>{milestone.name}</div>
          <div style={{fontSize:11,color:"#BECBD9",marginTop:1}}>{milestone.desc}</div>
        </div>
        {unlocked&&<div style={{fontSize:10,color:"#6EE7B7",fontWeight:700}}>✓</div>}
      </div>
      {unlocked&&(
        <div style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,color:"#E8A838"}}>
          🎁 {milestone.reward}
        </div>
      )}
    </div>
  );
}

// ─── AWARD CARD ───────────────────────────────────────────────────────────────
function AwardCard({award,onClick}){
  return(
    <div onClick={onClick} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.08)",borderRadius:12,padding:"18px",cursor:onClick?"pointer":"default",transition:"all .2s"}}
      onMouseEnter={e=>{if(onClick){e.currentTarget.style.borderColor=award.color+"66";e.currentTarget.style.background="rgba(255,255,255,.04)";}}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(242,237,228,.08)";e.currentTarget.style.background="rgba(255,255,255,.02)";}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:44,height:44,background:award.color+"18",border:"1px solid "+award.color+"44",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{award.icon}</div>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{award.title}</div>
          <div style={{fontSize:11,color:"#BECBD9",marginTop:1}}>{award.desc}</div>
        </div>
      </div>
      {award.winner&&(
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#0F1520",borderRadius:9,border:"1px solid rgba(242,237,228,.06)"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:award.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{award.winner.name}</div>
            <div style={{fontSize:11,color:"#BECBD9"}}>{award.winner.rank} · {award.winner.region}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:award.color}}>{award.stat}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DISPUTE SYSTEM ───────────────────────────────────────────────────────────
function FileDisputeModal({targetPlayer,claimPlacement,onSubmit,onClose}){
  const [reason,setReason]=useState("");
  const [url,setUrl]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <Panel danger style={{width:"100%",maxWidth:460,padding:"24px"}}>
        <div style={{marginTop:6}}>
          <div className="cond" style={{fontSize:16,fontWeight:800,color:"#F87171",marginBottom:4,letterSpacing:".08em",textTransform:"uppercase"}}>⚑ File Dispute</div>
          <div style={{fontSize:13,color:"#C8D4E0",marginBottom:20}}>Flagging <span style={{color:"#F2EDE4",fontWeight:700}}>{targetPlayer}</span> - claimed <span style={{color:"#E8A838",fontWeight:800,fontFamily:"monospace"}}>#{claimPlacement}</span></div>
          <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Reason <span style={{color:"#F87171"}}>*</span></label>
          <Inp value={reason} onChange={setReason} placeholder="Why is this placement wrong?" style={{marginBottom:14}}/>
          <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Screenshot URL (optional)</label>
          <Inp value={url} onChange={setUrl} placeholder="https://imgur.com/..." style={{marginBottom:20}}/>
          <div style={{display:"flex",gap:10}}>
            <Btn v="danger" full onClick={()=>{if(!reason.trim())return;onSubmit({reason:reason.trim(),url:url.trim(),target:targetPlayer,placement:claimPlacement,ts:Date.now()});onClose();}}>Submit</Btn>
            <Btn v="dark" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function DisputeBanner({disputes,onResolve,isAdmin}){
  if(!disputes||disputes.length===0)return null;
  return(
    <div style={{background:"rgba(127,29,29,.95)",border:"1px solid rgba(220,38,38,.6)",borderRadius:10,padding:"14px 16px",marginBottom:14,animation:"disp-anim 2s infinite"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:18}}>🚨</span>
        <div className="cond" style={{fontSize:14,fontWeight:800,color:"#FCA5A5",letterSpacing:".1em",textTransform:"uppercase"}}>LOCKED - {disputes.length} Dispute{disputes.length>1?"s":""}</div>
      </div>
      {disputes.map((d,i)=>(
        <div key={i} style={{fontSize:13,color:"#FCA5A5",marginBottom:8,padding:"10px 12px",background:"rgba(0,0,0,.35)",borderRadius:8}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
            <div>
              <span style={{fontWeight:700,color:"#F2EDE4"}}>{d.target}</span> → <span style={{color:"#E8A838",fontWeight:700}}>#{d.placement}</span>
              <div style={{marginTop:3,color:"#FECACA",fontSize:12}}>"{d.reason}"</div>
            </div>
            {isAdmin&&(
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <Btn s="sm" v="success" onClick={()=>onResolve(i,"accept")}>✓ Accept</Btn>
                <Btn s="sm" v="danger" onClick={()=>onResolve(i,"override")}>Override</Btn>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PLACEMENT BOARD - mobile-optimised ───────────────────────────────────────
function PlacementBoard({roster,results,onPlace,locked,onFlag,isAdmin}){
  const [disputeTarget,setDisputeTarget]=useState(null);
  const used=new Set(Object.values(results));
  const placed=Object.keys(results).length;
  const allSet=placed===roster.length;

  return(
    <div>
      {disputeTarget&&(
        <FileDisputeModal targetPlayer={disputeTarget.name} claimPlacement={results[disputeTarget.id]}
          onSubmit={d=>onFlag&&onFlag(d)} onClose={()=>setDisputeTarget(null)}/>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span className="cond" style={{fontSize:10,fontWeight:700,color:"#BECBD9",letterSpacing:".12em",textTransform:"uppercase"}}>Placements</span>
        <span className="mono" style={{fontSize:12,color:allSet?"#6EE7B7":"#BECBD9"}}>
          <span style={{color:allSet?"#6EE7B7":"#E8A838",fontWeight:700}}>{placed}</span>/{roster.length}
        </span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {roster.map(p=>{
          const got=results[p.id];
          const isWin=got===1,isTop4=got&&got<=4;
          return(
            <div key={p.id} style={{background:got?(isWin?"rgba(232,168,56,.08)":isTop4?"rgba(78,205,196,.05)":"rgba(255,255,255,.02)"):"rgba(255,255,255,.02)",
              border:"1px solid "+(got?(isWin?"rgba(232,168,56,.35)":isTop4?"rgba(78,205,196,.2)":"rgba(242,237,228,.08)"):"rgba(242,237,228,.08)"),
              borderRadius:10,padding:"10px 12px",transition:"all .15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:locked?0:10}}>
                {got&&<div className="mono" style={{fontSize:24,fontWeight:700,color:isWin?"#E8A838":isTop4?"#4ECDC4":"#BECBD9",lineHeight:1,minWidth:22,textAlign:"center"}}>{got}</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{display:"flex",gap:5,marginTop:2}}></div>
                </div>
                {got&&!locked&&(
                  <button onClick={()=>setDisputeTarget(p)} style={{background:"rgba(220,38,38,.12)",border:"1px solid rgba(220,38,38,.35)",borderRadius:6,padding:"5px 10px",fontSize:12,color:"#F87171",cursor:"pointer",fontWeight:700,flexShrink:0,minHeight:34}}>FLAG</button>
                )}
              </div>
              {!locked&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:3}}>
                  {[1,2,3,4,5,6,7,8].map(place=>{
                    const isMe=got===place,taken=!isMe&&used.has(place),isTop=place<=4;
                    return(
                      <button key={place} className="place-btn" onClick={taken?undefined:()=>onPlace(p.id,place)}
                        style={{background:isMe?(place===1?"#E8A838":isTop?"#4ECDC4":"#8896A8"):"#1A1F2E",
                          color:isMe?"#08080F":(taken?"#7A8BA0":isTop?"#C8D4E0":"#BECBD9"),
                          opacity:taken?.18:1,cursor:taken?"not-allowed":"pointer"}}>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:2,marginTop:10,paddingTop:10,borderTop:"1px solid rgba(242,237,228,.06)"}}>
        {[1,2,3,4,5,6,7,8].map(place=>{
          const who=roster.find(p=>results[p.id]===place);
          return(
            <div key={place} style={{background:"#1C2030",borderRadius:5,padding:"4px 3px",textAlign:"center"}}>
              <div className="mono" style={{fontSize:9,fontWeight:700,color:place===1?"#E8A838":place<=4?"#4ECDC4":"#9AAABF"}}>{place}</div>
              <div style={{fontSize:9,color:who?"#C8BFB0":"#7A8BA0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>{who?who.name.substring(0,5):"-"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LOBBY CARD ───────────────────────────────────────────────────────────────
function LobbyCard({roster,round,isFinals,onSubmit,toast,isAdmin,paused,lobbyNum}){
  const [results,setResults]=useState({});
  const [locked,setLocked]=useState(false);
  const [disputes,setDisputes]=useState([]);
  const allPlaced=roster.length>0&&Object.keys(results).length===roster.length;
  const canLock=allPlaced&&disputes.length===0&&!locked&&!paused;
  const host=roster[0];

  function lockResults(){
    if(!allPlaced){toast("Assign all placements first","error");return;}
    if(disputes.length>0){toast("Resolve disputes first","error");return;}
    setLocked(true);
    onSubmit(results,lobbyNum||0);
    toast((isFinals?"Finals":"Round "+round+(lobbyNum!==undefined?" Lobby "+(lobbyNum+1):""))+" locked! ✓","success");
  }

  const lbl=isFinals?"F":lobbyNum!==undefined?"L"+(lobbyNum+1):"R"+round;

  return(
    <Panel glow={!locked} style={{border:locked?"1px solid rgba(82,196,124,.3)":undefined,animation:locked?"lock-flash .9s ease":undefined}}>
      <div style={{padding:"12px 14px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:locked?"rgba(82,196,124,.1)":"rgba(232,168,56,.1)",border:"1px solid "+(locked?"rgba(82,196,124,.3)":"rgba(232,168,56,.28)"),borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:locked?"#6EE7B7":"#E8A838",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
            {lbl}
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{isFinals?"Grand Finals":lobbyNum!==undefined?"Lobby "+(lobbyNum+1)+" · R"+round:"Round "+round}</div>
            <div style={{fontSize:12,color:"#BECBD9"}}>Host: <span style={{color:"#E8A838",fontWeight:600}}>{host?.name||"-"}</span></div>
          </div>
          {locked?<Tag color="#52C47C">✓ Locked</Tag>:paused?<Tag color="#EAB308">⏸ Paused</Tag>:<div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.25)",borderRadius:20}}><Dot/><span className="cond" style={{fontSize:9,fontWeight:700,color:"#6EE7B7",letterSpacing:".1em",textTransform:"uppercase"}}>Live</span></div>}
        </div>
      </div>
      <div style={{padding:"14px"}}>
        <DisputeBanner disputes={disputes} onResolve={(idx,action)=>{setDisputes(d=>d.filter((_,i)=>i!==idx));toast(action==="accept"?"Result stands":"Override applied","success");}} isAdmin={isAdmin}/>
        <PlacementBoard roster={roster} results={results}
          onPlace={(pid,place)=>{if(!locked&&!paused)setResults(r=>({...r,[pid]:place}));}}
          locked={locked} onFlag={d=>setDisputes(ds=>[...ds,d])} isAdmin={isAdmin}/>
        {!locked&&(
          <div style={{marginTop:14}}>
            <Btn v="primary" full disabled={!canLock} onClick={lockResults} s="lg">
              {disputes.length>0?"🔒 Resolve Disputes First":paused?"⏸ Paused":!allPlaced?"Waiting for all placements...":"Lock Results ✓"}
            </Btn>
          </div>
        )}
      </div>
    </Panel>
  );
}


// ─── NAVBAR (desktop top + mobile bottom) ────────────────────────────────────
const NOTIF_SEED=[
  {id:1,icon:"⚔",title:"Clash #14 is LIVE",body:"Round 1 underway. 24 players across 3 lobbies. Check your lobby.",time:"2 min ago",read:false},
  {id:2,icon:"✅",title:"Check-in Opened",body:"Confirm your spot for Clash #14 before 8PM EST.",time:"1h ago",read:false},
  {id:3,icon:"🏆",title:"Results: Clash #13",body:"Levitate takes the crown. Full standings available.",time:"7 days ago",read:true},
  {id:4,icon:"📈",title:"You climbed to #1",body:"Your leaderboard position improved after Clash #13.",time:"7 days ago",read:true},
  {id:5,icon:"📢",title:"Season 16 Active",body:"Clash points are live. Every clash counts toward Grand Finals.",time:"2 weeks ago",read:true},
];
function NotificationBell({notifications,onMarkAllRead}){
  const [open,setOpen]=useState(false);
  const unread=notifications.filter(n=>!n.read).length;
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{position:"relative",background:"none",border:"none",padding:"6px 8px",cursor:"pointer",color:"#C8D4E0",fontSize:16,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,transition:"color .15s"}}
        onMouseEnter={e=>e.currentTarget.style.color="#E8A838"}
        onMouseLeave={e=>e.currentTarget.style.color="#C8D4E0"}>
        <span>🔔</span>
        {unread>0&&(
          <div style={{position:"absolute",top:1,right:1,width:14,height:14,borderRadius:"50%",background:"#E8A838",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:"#07070E",lineHeight:1}}>
            {unread>9?"9+":unread}
          </div>
        )}
      </button>
      {open&&(
        <>
          <div style={{position:"fixed",inset:0,zIndex:149}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:300,background:"linear-gradient(160deg,#0F1828,#0B1220)",border:"1px solid rgba(232,168,56,.2)",borderRadius:14,boxShadow:"0 20px 56px rgba(0,0,0,.7)",zIndex:150,overflow:"hidden"}}>
            <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(232,168,56,.04)"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:13,fontWeight:700,color:"#F2EDE4"}}>Notifications</span>
                {unread>0&&<span style={{background:"#E8A838",color:"#07070E",fontSize:9,fontWeight:800,borderRadius:99,padding:"2px 7px"}}>{unread} new</span>}
              </div>
              {unread>0&&<button onClick={()=>onMarkAllRead()} style={{background:"none",border:"none",cursor:"pointer",color:"#9B72CF",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>Mark all read</button>}
            </div>
            <div style={{maxHeight:360,overflowY:"auto"}}>
              {notifications.length===0
                ?<div style={{padding:"28px 14px",textAlign:"center",color:"#9AAABF",fontSize:13}}>All caught up!</div>
                :notifications.map(n=>(
                  <div key={n.id} style={{padding:"12px 14px",borderBottom:"1px solid rgba(242,237,228,.05)",background:n.read?"transparent":"rgba(232,168,56,.03)",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{fontSize:16,flexShrink:0,marginTop:2}}>{n.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:n.read?400:600,fontSize:12,color:n.read?"#C8D4E0":"#F2EDE4",marginBottom:2,lineHeight:1.4}}>{n.title}</div>
                      <div style={{fontSize:11,color:"#BECBD9",lineHeight:1.5}}>{n.body}</div>
                      <div style={{fontSize:10,color:"#9AAABF",marginTop:4}}>{n.time}</div>
                    </div>
                    {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:"#E8A838",flexShrink:0,marginTop:5}}/>}
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
function Navbar({screen,setScreen,players,isAdmin,setIsAdmin,toast,disputes,currentUser,onAuthClick,notifications,onMarkAllRead}){
  const [pwModal,setPwModal]=useState(false);
  const [pw,setPw]=useState("");
  const [drawer,setDrawer]=useState(false);
  const checkedIn=players.filter(p=>p.checkedIn).length;
  const dispCount=(disputes||[]).length;

  async function tryLogin(){
    const res=await fetch('/api/check-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    const data=await res.json();
    if(data?.isAdmin){setIsAdmin(true);setPwModal(false);setPw("");toast("Admin mode activated","success");}
    else toast("Wrong password","error");
  }

  // Primary mobile tabs (5 max)
  const PRIMARY=[
    {id:"home",icon:"🏠",label:"Home"},
    {id:"roster",icon:"👥",label:"Roster"},
    {id:"bracket",icon:"⚔",label:"Bracket"},
    {id:"leaderboard",icon:"📊",label:"Board"},
    {id:"results",icon:"🏆",label:"Results"},
    {id:"more",icon:"☰",label:"More"},
  ];

  const [desktopMore,setDesktopMore]=useState(false);

  // Desktop nav
  const DESKTOP_PRIMARY=[
    {id:"home",label:"Home"},
    {id:"roster",label:"Roster"},
    {id:"bracket",label:"Bracket"},
    {id:"leaderboard",label:"Leaderboard"},
    {id:"results",label:"Results"},
    {id:"hof",label:"Hall of Fame"},
    ...(isAdmin?[{id:"scrims",label:"Scrims"},{id:"admin",label:"⬡ Admin"}]:[]),
  ];
  const DESKTOP_MORE=[
    {id:"archive",label:"Archive"},
    {id:"aegis-showcase",label:"AEGIS #151"},
    {id:"milestones",label:"Milestones"},
    {id:"challenges",label:"Challenges"},
    {id:"rules",label:"Rules"},
    {id:"faq",label:"FAQ"},
    {id:"pricing",label:"Pricing"},
  ];
  const desktopMoreActive=DESKTOP_MORE.some(l=>l.id===screen);

  const DRAWER_ITEMS=[
    {id:"hof",icon:"🏛",label:"Hall of Fame"},
    {id:"archive",icon:"📁",label:"Archive"},
    {id:"aegis-showcase",icon:"🏆",label:"AEGIS #151 — Client Demo"},
    {id:"rules",icon:"📋",label:"Tournament Rules"},
    {id:"faq",icon:"❓",label:"FAQ"},
    {id:"challenges",icon:"⚡",label:"Challenges & XP"},
    {id:"milestones",icon:"🎁",label:"Milestones & Rewards"},
    {id:"pricing",icon:"💰",label:"Pricing & Plans"},
    {id:"account",icon:"👤",label:currentUser?("My Account · "+currentUser.username):"Sign In / Sign Up"},
    ...(isAdmin?[{id:"scrims",icon:"🎮",label:"Scrims"},{id:"admin",icon:"⬡",label:"Admin Panel"}]:[]),
  ];

  return(
    <>
      {pwModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1002,padding:16}}>
          <Panel glow style={{width:"100%",maxWidth:340,padding:"26px"}}>
            <div style={{marginTop:6}}>
              <h3 style={{color:"#F2EDE4",fontSize:18,marginBottom:4}}>Admin Access</h3>
              <div style={{fontSize:13,color:"#BECBD9",marginBottom:16}}>Hint: <span style={{color:"#E8A838",fontWeight:600}}>admin</span></div>
              <Inp value={pw} onChange={setPw} type="password" placeholder="Enter password..." onKeyDown={e=>e.key==="Enter"&&tryLogin()} style={{marginBottom:14}}/>
              <div style={{display:"flex",gap:10}}>
                <Btn v="primary" full onClick={tryLogin}>Login</Btn>
                <Btn v="dark" onClick={()=>{setPwModal(false);setPw("");}}>Cancel</Btn>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Drawer overlay */}
      {drawer&&(
        <>
          <div className="drawer-overlay" onClick={()=>setDrawer(false)}/>
          <div className="drawer">
            <div style={{padding:"0 20px 20px",borderBottom:"1px solid rgba(242,237,228,.08)",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
              <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:36,height:36,objectFit:"contain"}}/>
              <div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:16,fontWeight:700,color:"#E8A838"}}>TFT Clash</div>
                <div style={{fontSize:12,color:"#BECBD9"}}>Season 16</div>
              </div>
            </div>
            {DRAWER_ITEMS.map(l=>(
              <button key={l.id} onClick={()=>{
                if(l.id==="account"&&!currentUser){onAuthClick("login");setDrawer(false);return;}
                setScreen(l.id);setDrawer(false);
              }}
                style={{display:"flex",alignItems:"center",gap:14,padding:"14px 20px",background:screen===l.id?"rgba(232,168,56,.08)":"none",
                  border:"none",color:l.id==="account"&&currentUser?"#E8A838":screen===l.id?"#E8A838":"#C8BFB0",fontSize:14,fontWeight:600,width:"100%",textAlign:"left",cursor:"pointer",transition:"all .15s"}}>
                <span style={{fontSize:18,minWidth:22}}>{l.icon}</span>{l.label}
              </button>
            ))}
            <div style={{marginTop:"auto",padding:"20px"}}>
              {!isAdmin
                ?<Btn v="ghost" full onClick={()=>{setDrawer(false);setPwModal(true);}}>Admin Login</Btn>
                :<Btn v="crimson" full onClick={()=>{setIsAdmin(false);setDrawer(false);toast("Admin off","success");}}>● Admin On</Btn>
              }
            </div>
          </div>
        </>
      )}

      {/* Desktop top nav — two-row layout */}
      <nav className="top-nav">
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 24px",height:60,display:"flex",alignItems:"center",gap:0}}>
          <div onClick={()=>setScreen("home")} style={{display:"flex",alignItems:"center",gap:8,marginRight:12,flexShrink:0,cursor:"pointer"}}>
            <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:32,height:32,objectFit:"contain"}}/>
            <div>
              <div className="gold-shimmer" style={{fontFamily:"'Cinzel',serif",fontSize:14,fontWeight:700,lineHeight:1}}>TFT Clash</div>
              <div className="cond" style={{fontSize:9,color:"#BECBD9",fontWeight:600,letterSpacing:".06em"}}>Season 16</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:0,flex:1,minWidth:0}}>
            {DESKTOP_PRIMARY.map(l=>(
              <button key={l.id} onClick={()=>setScreen(l.id)}
                style={{background:"none",border:"none",padding:"8px 7px",fontSize:12.5,fontWeight:600,
                  color:screen===l.id?"#E8A838":"#C8D4E0",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                  borderBottom:screen===l.id?"2px solid #E8A838":"2px solid transparent",
                  transition:"all .2s",marginBottom:-1}}>
                {l.label}
              </button>
            ))}
            <div style={{position:"relative",flexShrink:0}}>
              <button onClick={()=>setDesktopMore(o=>!o)}
                style={{background:"none",border:"none",padding:"8px 7px",fontSize:12.5,fontWeight:600,
                  color:desktopMoreActive?"#E8A838":"#C8D4E0",cursor:"pointer",whiteSpace:"nowrap",
                  borderBottom:desktopMoreActive?"2px solid #E8A838":"2px solid transparent",
                  transition:"all .2s",marginBottom:-1}}>
                More ▾
              </button>
              {desktopMore&&(
                <>
                  <div style={{position:"fixed",inset:0,zIndex:98}} onClick={()=>setDesktopMore(false)}/>
                  <div style={{position:"absolute",left:0,top:"calc(100% + 4px)",minWidth:180,background:"linear-gradient(160deg,#0F1828,#0B1220)",
                    border:"1px solid rgba(232,168,56,.2)",borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.7)",zIndex:99,overflow:"hidden"}}>
                    {DESKTOP_MORE.map(l=>(
                      <button key={l.id} onClick={()=>{setScreen(l.id);setDesktopMore(false);}}
                        style={{display:"block",width:"100%",textAlign:"left",background:screen===l.id?"rgba(232,168,56,.08)":"none",
                          border:"none",padding:"11px 16px",fontSize:13,fontWeight:600,
                          color:screen===l.id?"#E8A838":"#C8BFB0",cursor:"pointer",transition:"all .15s",borderBottom:"1px solid rgba(242,237,228,.05)"}}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4,flexShrink:0}}>
            {dispCount>0&&(
              <button onClick={()=>setScreen("admin")} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:"rgba(220,38,38,.12)",border:"1px solid rgba(220,38,38,.4)",borderRadius:20,cursor:"pointer",animation:"pulse-red 2s infinite"}}>
                <Dot color="#EF4444" size={6}/>
                <span style={{fontSize:11,fontWeight:700,color:"#F87171"}}>{dispCount}</span>
              </button>
            )}
            <div style={{fontSize:12,color:"#BECBD9",whiteSpace:"nowrap"}}>
              <span style={{color:"#6EE7B7",fontWeight:700}}>{checkedIn}</span>/{players.length}
            </div>
            <NotificationBell notifications={notifications||[]} onMarkAllRead={onMarkAllRead||function(){}}/>
            {currentUser?(
              <button onClick={()=>setScreen("account")} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.3)",borderRadius:20,padding:"5px 12px",cursor:"pointer",transition:"all .15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(232,168,56,.6)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(232,168,56,.3)"}>
                <span style={{fontSize:12,fontWeight:600,color:"#E8A838"}}>{currentUser.username}</span>
              </button>
            ):(
              <div style={{display:"flex",gap:6}}>
                <Btn v="dark" s="sm" onClick={()=>onAuthClick("login")}>Sign In</Btn>
                <Btn v="primary" s="sm" onClick={()=>onAuthClick("signup")}>Sign Up</Btn>
              </div>
            )}
            {!isAdmin
              ?<Btn v="ghost" s="sm" onClick={()=>setPwModal(true)}>Admin</Btn>
              :<Btn v="crimson" s="sm" onClick={()=>{setIsAdmin(false);toast("Admin off","success");}}>● Admin</Btn>
            }
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {PRIMARY.map(l=>{
          const isMore=l.id==="more";
          const active=isMore?["hof","archive","aegis-showcase","scrims","admin","milestones","pricing","account","challenges","recap","host-apply","host-dashboard","rules","faq"].includes(screen):screen===l.id;
          return(
            <button key={l.id} className={active?"active":""} onClick={()=>{if(isMore){setDrawer(d=>!d);}else setScreen(l.id);}}>
              <span className="icon">{l.icon}</span>
              {l.label}
              {l.id==="bracket"&&dispCount>0&&<div style={{width:7,height:7,borderRadius:"50%",background:"#EF4444",position:"absolute",top:6,right:"calc(50% - 14px)"}}/>}
            </button>
          );
        })}
      </nav>
    </>
  );
}

// ─── STANDINGS TABLE ──────────────────────────────────────────────────────────
function StandingsTable({rows,compact,onRowClick,myName,seasonConfig}){
  const [sortKey,setSortKey]=useState("pts");
  const [asc,setAsc]=useState(false);
  function toggle(k){if(sortKey===k)setAsc(a=>!a);else{setSortKey(k);setAsc(false);}}
  const useEffective=seasonConfig&&(seasonConfig.dropWeeks>0||seasonConfig.finalBoost>1.0);
  const sorted=[...rows].sort((a,b)=>{
    if(sortKey==="pts"&&useEffective){
      var ea=effectivePts(a,seasonConfig),eb=effectivePts(b,seasonConfig);
      if(ea!==eb)return asc?ea-eb:eb-ea;
      return tiebreaker(a,b);
    }
    const va=parseFloat(a[sortKey])||0,vb=parseFloat(b[sortKey])||0;return asc?va-vb:vb-va;
  });
  const maxPts=Math.max(...rows.map(r=>r.pts||0),1);
  const H=({k,label})=>(
    <span onClick={()=>toggle(k)} className="cond" style={{fontSize:10,fontWeight:700,color:sortKey===k?"#E8A838":"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
      {label}{sortKey===k?(asc?" ↑":" ↓"):""}
    </span>
  );
  const cols=compact?"28px 1fr 60px 55px 50px":"28px 1fr 70px 70px 50px 55px";
  return(
    <Panel style={{overflowX:"auto"}}>
      <div style={{minWidth:compact?260:380}}>
      <div style={{display:"grid",gridTemplateColumns:cols,padding:"9px 14px",borderBottom:"1px solid rgba(242,237,228,.07)",background:"#0A0F1A"}}>
        <span className="cond" style={{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".1em"}}>#</span>
        <H k="name" label="Player"/><H k="pts" label="Pts"/><H k="avg" label="Avg"/><H k="games" label="G"/>
        {!compact&&<H k="wins" label="W"/>}
      </div>
      {sorted.map((p,i)=>{
        const avg=parseFloat(p.avg)||0;
        const top3=i<3;
        const top8=i<8&&i>=3;
        const isMe=myName&&p.name===myName;
        const rankCol=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":top8?"#BECBD9":"#8E9BB0";
        const rowBg=isMe?"rgba(155,114,207,.1)":i===0?"rgba(232,168,56,.09)":i===1?"rgba(192,192,192,.06)":i===2?"rgba(205,127,50,.06)":top8?"rgba(255,255,255,.02)":"transparent";
        const rowBorder=isMe?"rgba(155,114,207,.45)":i===0?"rgba(232,168,56,.22)":i===1?"rgba(192,192,192,.15)":i===2?"rgba(205,127,50,.15)":top8?"rgba(242,237,228,.05)":"transparent";
        const nameCol=top3?"#F2EDE4":top8?"#C8BFB0":"#BECBD9";
        const ptsCol=top3?"#E8A838":top8?"#B8A878":"#BECBD9";
        return(
          <div key={p.id} id={isMe?"lb-me-row":undefined} onClick={onRowClick?()=>onRowClick(p):undefined}
            className={"standings-row"+(i===0?" standings-row-1":i===1?" standings-row-2":i===2?" standings-row-3":"")}
            style={{display:"grid",gridTemplateColumns:cols,
              padding:top3?"13px 14px":"9px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",
              background:rowBg,border:"1px solid "+rowBorder,borderRadius:top3?6:0,marginBottom:top3?2:0,
              alignItems:"center",cursor:onRowClick?"pointer":"default",opacity:i>=8?.6:1}}>
            <div className="mono rank-num" style={{fontSize:top3?17:13,fontWeight:900,color:rankCol,minWidth:22,textAlign:"center"}}>{i+1}</div>
            <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:top3?700:500,fontSize:top3?15:13,color:nameCol,display:"flex",alignItems:"center",gap:5,overflow:"hidden"}}>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                  {isHotStreak(p)&&<span style={{flexShrink:0}}>🔥</span>}
                  <OrgSponsorTag playerId={p.id}/>
                </div>
                {!compact&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                  <ClashRankBadge xp={estimateXp(p)} size="sm"/>
                  <span className="mono" style={{fontSize:11,color:"#B8C8D8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.riotId}</span>
                </div>}
              </div>
            </div>
            <div className="mono pts-glow" style={{fontSize:top3?20:15,fontWeight:800,color:ptsCol,lineHeight:1}}>{useEffective?effectivePts(p,seasonConfig):p.pts}</div>
            <AvgBadge avg={avg>0?avg:null}/>
            <div className="mono" style={{fontSize:11,color:top8?"#BECBD9":"#9AAABF"}}>{p.games||0}</div>
            {!compact&&<div className="mono" style={{fontSize:13,color:top3?"#6EE7B7":top8?"#6EE7B7":"#8896A8"}}>{p.wins||0}</div>}
          </div>
        );
      })}
      {rows.length===0&&<div style={{textAlign:"center",padding:40,color:"#8E9BB0",fontSize:14}}>No data yet</div>}
      </div>
    </Panel>
  );
}


// ─── PARTNER EVENT CARD ───────────────────────────────────────────────────────
function PartnerEventCard({currentUser,onAuthClick,setScreen,toast}){
  const [registered,setRegistered]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [customIgn,setCustomIgn]=useState("");

  function doRegister(){
    var ign=customIgn.trim();
    if(!ign){toast("Enter your Riot ID to register","error");return;}
    setRegistered(true);setShowForm(false);
    toast("Registered for Aegis Showdown #151! GL HF ⚡","success");
  }

  return(
    <div style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid rgba(155,114,207,.35)",borderRadius:16,overflow:"hidden",transition:"border-color .2s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(155,114,207,.65)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(155,114,207,.35)"}>
      {/* Announcement strip */}
      <div style={{background:"rgba(232,168,56,.07)",borderBottom:"1px solid rgba(232,168,56,.18)",padding:"9px 16px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14,flexShrink:0}}>📢</span>
        <span style={{color:"#E8A838",fontWeight:600,fontSize:12,lineHeight:1.4}}>
          Showdown #152 sign-ups are <span style={{color:"#6EE7B7"}}>OPEN</span> · Sat 22 Mar 8PM EST · 64 spots · Presented by <span style={{color:"#C4B5FD"}}>ZenMarket</span>
        </span>
      </div>
      {/* Card body */}
      <div style={{padding:"18px 20px",cursor:"pointer"}} onClick={()=>setScreen("aegis-showcase")}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏆</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",lineHeight:1.2}}>Aegis Esports TFT Showdown</div>
            <div style={{fontSize:11,color:"#9B72CF",fontWeight:600,marginTop:2}}>Presented by ZenMarket</div>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",flexShrink:0}}>
            <span style={{background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#6EE7B7",display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
            </span>
            <span style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#E8A838"}}>64p</span>
            <span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#4ECDC4"}}>Swiss</span>
          </div>
        </div>
        <div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.5,marginBottom:14}}>
          Official partner clash for Aegis Esports — open to all ranked players. Prizes, broadcast, and full bracket. Season points separate from TFT Clash standings.
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}} onClick={e=>e.stopPropagation()}>
          {registered?(
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1,background:"rgba(82,196,124,.07)",border:"1px solid rgba(82,196,124,.3)",borderRadius:9,padding:"8px 14px"}}>
              <span style={{fontSize:14}}>✅</span>
              <span style={{fontSize:12,fontWeight:600,color:"#6EE7B7"}}>Registered!</span>
              <Btn v="dark" s="sm" style={{marginLeft:"auto"}} onClick={()=>setScreen("aegis-showcase")}>View Event →</Btn>
            </div>
          ):(
            <>
              {showForm?(
                <div style={{flex:1,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <Inp value={customIgn} onChange={setCustomIgn} placeholder={currentUser?currentUser.riotId||"Your Riot ID#TAG":"Riot ID#TAG"} style={{flex:1,minWidth:140}}/>
                  <Btn v="purple" onClick={doRegister}>Confirm ⚡</Btn>
                  <Btn v="dark" onClick={()=>setShowForm(false)}>Cancel</Btn>
                </div>
              ):(
                <>
                  <Btn v="purple" s="sm" onClick={()=>{if(!currentUser){onAuthClick("login");return;}setCustomIgn(currentUser.riotId||"");setShowForm(true);}}>
                    {currentUser?"Register for #152 →":"Sign In to Register"}
                  </Btn>
                  <Btn v="dark" s="sm" onClick={()=>setScreen("aegis-showcase")}>View Event</Btn>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({players,setPlayers,setScreen,toast,announcement,setProfilePlayer,currentUser,onAuthClick,tournamentState,setTournamentState,quickClashes,onJoinQuickClash}){
  const [name,setName]=useState("");
  const [riot,setRiot]=useState("");
  const [region,setRegion]=useState("EUW");
  const targetMs=useRef(Date.now()+2*86400000+5*3600000);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const diff=Math.max(0,targetMs.current-now);
  const D=Math.floor(diff/86400000),H=Math.floor(diff%86400000/3600000),M=Math.floor(diff%3600000/60000),S=Math.floor(diff%60000/1000);

  function register(){
    if(!name.trim()||!riot.trim()){toast("Name and Riot ID required","error");return;}
    if(players.length>=64){toast("Tournament full","error");return;}
    if(players.find(p=>p.riotId.toLowerCase()===riot.toLowerCase())){toast("Riot ID taken","error");return;}
    const lp=Math.floor(Math.random()*2000)+900;
    const ri=Math.min(Math.floor(lp/300),RANKS.length-1);
    const np={id:Date.now()%100000,name:name.trim(),riotId:riot.trim(),rank:RANKS[ri],lp,region,pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,checkedIn:false,role:"player",banned:false,dnpCount:0,notes:"",clashHistory:[],sparkline:[],attendanceStreak:0,lastClashId:null,sponsor:null};
    setPlayers(p=>[...p,np]);setName("");setRiot("");
    toast(name.trim()+" joined!","success");
  }

  const checkedN=players.filter(p=>p.checkedIn).length;
  const top5=[...players].sort((a,b)=>b.pts-a.pts).slice(0,5);
  const linkedPlayer=currentUser?players.find(p=>p.name===currentUser.username):null;
  const alreadyRegistered=currentUser&&players.find(p=>p.riotId&&p.riotId.toLowerCase()===(currentUser.riotId||"").toLowerCase());
  const profileComplete=currentUser&&currentUser.riotId&&currentUser.riotId.trim().length>0;
  const s2=linkedPlayer?computeStats(linkedPlayer):null;
  const myRankIdx=linkedPlayer?[...players].sort((a,b)=>b.pts-a.pts).findIndex(p=>p.id===linkedPlayer.id)+1:0;
  const tPhase=tournamentState?tournamentState.phase:"registration";
  const tRound=tournamentState?tournamentState.round:1;
  const checkedInCount=players.filter(p=>p.checkedIn).length;
  const registeredCount=players.length;
  const myCheckedIn=linkedPlayer&&linkedPlayer.checkedIn;

  function handleCheckIn(){
    if(!linkedPlayer)return;
    setPlayers(ps=>ps.map(p=>p.id===linkedPlayer.id?{...p,checkedIn:true}:p));
    toast("You're checked in! Good luck, "+linkedPlayer.name+" ✓","success");
  }

  function registerFromAccount(){
    if(!currentUser||!profileComplete){return;}
    if(players.length>=64){toast("Tournament is full","error");return;}
    if(alreadyRegistered){toast("You're already registered!","error");return;}
    const lp=Math.floor(Math.random()*2000)+900;
    const ri=Math.min(Math.floor(lp/300),RANKS.length-1);
    const np={id:Date.now()%100000,name:currentUser.username,riotId:currentUser.riotId,rank:RANKS[ri],lp,
      region:currentUser.region||"EUW",pts:0,wins:0,top4:0,games:0,avg:"0",
      bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,checkedIn:false,
      role:"player",banned:false,dnpCount:0,notes:"",clashHistory:[],sparkline:[],attendanceStreak:0,lastClashId:null,sponsor:null};
    setPlayers(p=>[...p,np]);
    toast(currentUser.username+" registered for Clash #14! ✓","success");
  }

  function phaseStatusText(){
    if(tPhase==="registration")return"Registration Open · "+registeredCount+"/24 registered";
    if(tPhase==="checkin")return"Check-in Open · "+checkedInCount+" checked in · Closes soon";
    if(tPhase==="inprogress")return"Clash is LIVE · Round "+tRound+"/3";
    if(tPhase==="complete")return"Results Posted · View Final Standings";
    return"Registration Open";
  }

  function phaseStatusColor(){
    if(tPhase==="registration")return"#9B72CF";
    if(tPhase==="checkin")return"#E8A838";
    if(tPhase==="inprogress")return"#52C47C";
    if(tPhase==="complete")return"#4ECDC4";
    return"#9B72CF";
  }

  const StatBox=({label,val,c})=>(
    <div style={{background:"linear-gradient(145deg,#131C2A,#0D1421)",border:"1px solid rgba(242,237,228,.1)",borderRadius:12,padding:"16px 12px",textAlign:"center"}}>
      <div className="mono" style={{fontSize:26,fontWeight:800,color:c||"#E8A838",lineHeight:1}}>{val}</div>
      <div className="cond" style={{fontSize:10,fontWeight:700,color:"#C8D4E0",marginTop:5,letterSpacing:".05em",textTransform:"uppercase"}}>{label}</div>
    </div>
  );

  return(
    <div className="page wrap">
      {announcement&&(
        <div style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16,flexShrink:0}}>📢</span>
          <span style={{color:"#E8A838",fontWeight:600,fontSize:14}}>{announcement}</span>
        </div>
      )}

      {/* Champion hero card - shown all season */}
      {SEASON_CHAMPION&&<ChampionHeroCard champion={SEASON_CHAMPION} onClick={()=>{const p=players.find(pl=>pl.name===SEASON_CHAMPION.name);if(p){setProfilePlayer(p);setScreen("profile");}}}/>}

      <div style={{height:28}}/>

      {/* Phase status pill */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{background:"rgba(0,0,0,.3)",border:"1px solid "+phaseStatusColor(),borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:phaseStatusColor(),letterSpacing:".04em",cursor:tPhase==="complete"?"pointer":"default"}}
          onClick={()=>tPhase==="complete"&&setScreen("leaderboard")}>
          {tPhase==="inprogress"&&<span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#52C47C",marginRight:7,verticalAlign:"middle",animation:"pulse 1.5s infinite"}}/>}
          {phaseStatusText()}
        </div>
      </div>

      {/* Check-in card — visible during registration and check-in phases */}
      {tPhase!=="inprogress"&&tPhase!=="complete"&&currentUser&&linkedPlayer&&(
        <div style={{background:myCheckedIn?"rgba(82,196,124,.08)":"rgba(232,168,56,.08)",border:"1px solid "+(myCheckedIn?"rgba(82,196,124,.4)":"rgba(232,168,56,.4)"),borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:22}}>{myCheckedIn?"✅":"⏰"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>{myCheckedIn?"You're checked in!":"Check-in is open"}</div>
            <div style={{fontSize:12,color:"#C8D4E0"}}>{myCheckedIn?"Good luck today, "+linkedPlayer.name+"!":"Confirm you're ready for today's clash"}</div>
          </div>
          {!myCheckedIn&&<Btn v="primary" onClick={handleCheckIn}>Check In Now →</Btn>}
          {myCheckedIn&&<div style={{fontSize:12,fontWeight:700,color:"#6EE7B7",background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:8,padding:"6px 14px"}}>✓ Checked In</div>}
        </div>
      )}

      {/* Guest sign-in nudge */}
      {!currentUser&&(
        <div style={{background:"linear-gradient(90deg,rgba(155,114,207,.08),rgba(78,205,196,.06))",border:"1px solid rgba(155,114,207,.3)",borderRadius:12,padding:"14px 18px",marginBottom:4,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:22}}>👤</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>Create a free account to unlock your profile</div>
            <div style={{fontSize:12,color:"#C8D4E0"}}>Public profile URL · Career stats · Match history · Bio & social links</div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <Btn v="purple" s="sm" onClick={()=>onAuthClick("signup")}>Sign Up Free</Btn>
            <Btn v="dark" s="sm" onClick={()=>onAuthClick("login")}>Sign In</Btn>
          </div>
        </div>
      )}
      {quickClashes&&quickClashes.filter(function(q){return q.status==='open'||q.status==='full'||q.status==='live';}).length>0&&(
        <div style={{marginBottom:16}}>
          <div className="cond" style={{fontSize:10,fontWeight:700,color:"#9B72CF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}>Quick Clashes</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {quickClashes.filter(function(q){return q.status==="open"||q.status==="full"||q.status==="live";}).map(function(qc){
              var linked=currentUser?players.find(function(p){return p.name===currentUser.username;}):null;
              var alreadyJoined=linked&&qc.players&&qc.players.includes(linked.id);
              return(
                <div key={qc.id} style={{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.25)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontSize:18}}>{qc.status==="live"?"⚡":"🎮"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:2}}>{qc.name}</div>
                    <div style={{fontSize:11,color:"#BECBD9"}}>{qc.players?qc.players.length:0}/{qc.cap} players · {qc.rounds}R · {qc.format}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {qc.status==="live"&&<span style={{fontSize:11,fontWeight:700,color:"#F87171",background:"rgba(248,113,113,.12)",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"4px 8px"}}>LIVE</span>}
                    {qc.status==="open"&&!alreadyJoined&&onJoinQuickClash&&linked&&(
                      <Btn v="purple" s="sm" onClick={function(){onJoinQuickClash(qc.id,linked.id);toast("Joined "+qc.name+"!","success");}}>Join</Btn>
                    )}
                    {alreadyJoined&&<span style={{fontSize:11,fontWeight:700,color:"#6EE7B7",background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:6,padding:"4px 8px"}}>Joined</span>}
                    {qc.status==="full"&&!alreadyJoined&&<span style={{fontSize:11,color:"#E8A838"}}>Full</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {currentUser&&(
        <div style={{background:"rgba(82,196,124,.05)",border:"1px solid rgba(82,196,124,.2)",borderRadius:12,padding:"12px 18px",marginBottom:4,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#E8A838,#C8882A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#08080F",flexShrink:0}}>
            {currentUser.username.charAt(0).toUpperCase()}
          </div>
          <div style={{flex:1,fontSize:13,color:"#6EE7B7",fontWeight:600}}>Welcome back, {currentUser.username}! 👋</div>
          <Btn v="dark" s="sm" onClick={()=>setScreen("account")}>My Account →</Btn>
        </div>
      )}

      {currentUser&&linkedPlayer&&s2&&(
        <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.08),rgba(78,205,196,.04))",border:"1px solid rgba(155,114,207,.2)",borderRadius:14,padding:"16px 18px",marginBottom:20,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:8}}>Your Season Standing</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {[["#"+myRankIdx,"Rank","#E8A838"],[linkedPlayer.pts,"Season Pts","#E8A838"],[linkedPlayer.wins,"Wins","#6EE7B7"],[s2.avgPlacement,"Avg","#4ECDC4"]].map(([v,l,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 14px",textAlign:"center",minWidth:60}}>
                  <div className="mono" style={{fontSize:18,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                  <div style={{fontSize:10,color:"#BECBD9",marginTop:4,fontWeight:600,textTransform:"uppercase"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <Btn v="purple" s="sm" onClick={()=>{setProfilePlayer(linkedPlayer);setScreen("profile");}}>My Profile →</Btn>
            <Btn v="dark" s="sm" onClick={()=>setScreen("leaderboard")}>Standings</Btn>
          </div>
        </div>
      )}
      <div className="grid-home">
        {/* Left: Hero */}
        <div style={{position:"relative",padding:"28px 24px",borderRadius:20,background:"radial-gradient(ellipse at 30% 20%,rgba(155,114,207,.12) 0%,rgba(8,8,15,0) 60%)",border:"1px solid rgba(155,114,207,.1)"}}>
          <div className="au" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 14px",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.35)",borderRadius:20,marginBottom:20}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite"}}/>
            <span className="cond" style={{fontSize:11,fontWeight:700,color:"#C4B5FD",letterSpacing:".1em",textTransform:"uppercase"}}>Set 16 · Season Active · Weekly Clash</span>
          </div>
          <h1 className="au1 display" style={{color:"#F2EDE4",lineHeight:.88,letterSpacing:"-.02em",marginBottom:20}}>
            The<br/><span style={{color:"#E8A838",fontStyle:"italic",textShadow:"0 0 60px rgba(232,168,56,.4),0 0 120px rgba(232,168,56,.15)"}}>Convergence</span><br/><span style={{background:"linear-gradient(135deg,#9B72CF,#4ECDC4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Awaits</span>
          </h1>
          <p className="au2" style={{fontSize:15,color:"#C8D4E0",lineHeight:1.65,marginBottom:20,maxWidth:400}}>
            The competitive TFT platform. Weekly Saturday tournaments, seasonal point standings, and a permanent record of every champion crowned.
          </p>
          <div className="grid-4" style={{marginBottom:22}}>
            <StatBox label="Players" val={players.length}/>
            <StatBox label="Checked In" val={checkedN} c="#6EE7B7"/>
            <StatBox label="Season Pts" val={players.reduce((s,p)=>s+p.pts,0)}/>
            <StatBox label="Games" val={players.reduce((s,p)=>s+(p.games||0),0)} c="#4ECDC4"/>
          </div>
          {/* Countdown */}
          <div style={{background:"linear-gradient(145deg,rgba(155,114,207,.08),rgba(8,8,15,.6))",border:"1px solid rgba(155,114,207,.25)",borderRadius:16,padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite"}}/>
              <span className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase"}}>Clash #14 Starts In</span>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              {[[D,"Days"],[H,"Hrs"],[M,"Min"],[S,"Sec"]].map(([v,l])=>(
                <div key={l} className="countdown-tile">
                  <div className="digit">{String(v).padStart(2,"0")}</div>
                  <div className="unit">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Register + Roster */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Panel accent style={{padding:"20px"}}>
            <h3 style={{fontSize:17,color:"#F2EDE4",marginBottom:4}}>Join Clash #14</h3>
            <div style={{fontSize:12,color:"#BECBD9",marginBottom:16}}>Saturday 8PM EST · Season 16 · Set 16</div>

            {/* Not logged in */}
            {!currentUser&&(
              <div>
                <div style={{background:"rgba(155,114,207,.07)",border:"1px solid rgba(155,114,207,.25)",borderRadius:10,padding:"14px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:20,flexShrink:0}}>🔒</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:4}}>Account required to register</div>
                    <div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.6}}>Create a free account with your Riot ID to join the clash. Takes 30 seconds — competing is always free.</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn v="primary" full onClick={()=>onAuthClick("signup")}>Create Account →</Btn>
                  <Btn v="dark" onClick={()=>onAuthClick("login")}>Sign In</Btn>
                </div>
              </div>
            )}

            {/* Logged in but Riot ID missing */}
            {currentUser&&!profileComplete&&(
              <div>
                <div style={{background:"rgba(232,168,56,.07)",border:"1px solid rgba(232,168,56,.3)",borderRadius:10,padding:"14px 16px",marginBottom:14,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:20,flexShrink:0}}>⚠️</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:4}}>Complete your profile first</div>
                    <div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.6}}>Add your Riot ID in your account settings to register for clashes.</div>
                  </div>
                </div>
                <Btn v="primary" full onClick={()=>setScreen("account")}>Complete Profile →</Btn>
              </div>
            )}

            {/* Already registered */}
            {currentUser&&profileComplete&&alreadyRegistered&&(
              <div style={{background:"rgba(82,196,124,.07)",border:"1px solid rgba(82,196,124,.3)",borderRadius:10,padding:"16px",textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:8}}>✅</div>
                <div style={{fontWeight:700,fontSize:14,color:"#6EE7B7",marginBottom:4}}>You're registered!</div>
                <div style={{fontSize:12,color:"#C8D4E0",marginBottom:12}}>Playing as <span style={{color:"#F2EDE4",fontWeight:600}}>{currentUser.username}</span> · {currentUser.riotId}</div>
                <div style={{fontSize:11,color:"#9AAABF"}}>Check-in opens 60 min before start</div>
              </div>
            )}

            {/* Ready to register */}
            {currentUser&&profileComplete&&!alreadyRegistered&&(
              <div>
                <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.1)",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#E8A838,#C8882A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#08080F",flexShrink:0}}>
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.username}</div>
                    <div style={{fontSize:11,color:"#BECBD9",marginTop:1}}>{currentUser.riotId} · {currentUser.region||"EUW"}</div>
                  </div>
                </div>
                <Btn v="primary" full onClick={registerFromAccount}>Register for Clash #14 →</Btn>
              </div>
            )}
          </Panel>

          {/* How it works */}
          <Panel style={{padding:"18px"}}>
            <h3 style={{fontSize:14,fontWeight:700,color:"#F2EDE4",marginBottom:14}}>How It Works</h3>
            {[
              {n:"01",t:"Sign Up",d:"Register your Riot ID and join the season. Free for everyone."},
              {n:"02",t:"Compete Weekly",d:"Show up Saturday. Play your lobby. Earn Clash Points based on placement."},
              {n:"03",t:"Climb the Board",d:"Points accumulate all season. Top 8 at season end make the Grand Finals."},
              {n:"04",t:"Win the Crown",d:"One player is crowned Season Champion. The record lives here forever."},
            ].map(({n,t,d})=>(
              <div key={n} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
                <div style={{width:28,height:28,borderRadius:8,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#9B72CF",flexShrink:0}}>{n}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:2}}>{t}</div>
                  <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5}}>{d}</div>
                </div>
              </div>
            ))}
          </Panel>

          {/* Roster CTA */}
          <div style={{background:"rgba(78,205,196,.04)",border:"1px solid rgba(78,205,196,.2)",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{players.length} players registered</div>
              <div style={{fontSize:12,color:"#BECBD9",marginTop:2}}>{checkedN} checked in for Clash #14</div>
            </div>
            <Btn v="teal" s="sm" onClick={()=>setScreen("roster")}>View Roster →</Btn>
          </div>
        </div>
      </div>


      {/* Featured Events */}
      <div style={{marginTop:24,marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <div className="cond" style={{fontSize:10,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase",marginBottom:3}}>Partner Events</div>
            <h3 style={{fontSize:16,fontWeight:700,color:"#F2EDE4",lineHeight:1}}>Featured Tournaments</h3>
          </div>
          <Btn v="dark" s="sm" onClick={()=>setScreen("aegis-showcase")}>View All →</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
          <PartnerEventCard currentUser={currentUser} onAuthClick={onAuthClick} setScreen={setScreen} toast={toast}/>
        </div>
      </div>
      {/* Bottom row */}
      <div style={{marginTop:20}}>
        <SponsorBanner onNavigate={setScreen}/>
      </div>

      {/* Discord CTA */}
      <div style={{background:"linear-gradient(90deg,rgba(88,101,242,.1),rgba(88,101,242,.05))",border:"1px solid rgba(88,101,242,.3)",borderRadius:12,padding:"14px 18px",marginTop:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <div style={{fontSize:24,flexShrink:0}}>💬</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Join the TFT Clash Discord</div>
          <div style={{fontSize:12,color:"#C8D4E0",marginTop:2}}>Tournament alerts, results, tactics channels, and the community. Pro members get exclusive access.</div>
        </div>
        <Btn v="dark" s="sm" onClick={()=>toast("Discord link coming soon - server in setup!","success")} style={{background:"rgba(88,101,242,.15)",border:"1px solid rgba(88,101,242,.4)",color:"#818CF8",flexShrink:0}}>Join Discord →</Btn>
      </div>

      <Panel accent style={{padding:"18px",marginTop:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <h3 style={{fontSize:17,color:"#F2EDE4",fontWeight:700,letterSpacing:"-.01em"}}>Season Standings</h3>
          <Btn v="dark" s="sm" onClick={()=>setScreen("leaderboard")}>Full Leaderboard →</Btn>
        </div>
        {top5.map((p,i)=>(
          <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<top5.length-1?"1px solid rgba(242,237,228,.06)":"none",cursor:"pointer",transition:"opacity .15s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity=".8"}
            onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
            <div className="mono" style={{fontSize:14,fontWeight:800,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF",minWidth:20,textAlign:"center"}}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
              <div style={{fontSize:11,color:"#BECBD9",marginTop:1}}>{p.rank} · {p.region}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div className="mono" style={{fontSize:16,fontWeight:700,color:"#E8A838"}}>{p.pts}</div>
              <div style={{fontSize:10,color:"#BECBD9"}}>pts</div>
            </div>
          </div>
        ))}
        {top5.length===0&&<div style={{color:"#9AAABF",fontSize:13,textAlign:"center",padding:24}}>No players yet</div>}
      </Panel>
    </div>
  );
}


// ─── ROSTER SCREEN ────────────────────────────────────────────────────────────
function RosterScreen({players,setScreen,setProfilePlayer,currentUser}){
  const [search,setSearch]=useState("");
  const [regionFilter,setRegionFilter]=useState("All");
  const [rankFilter,setRankFilter]=useState("All");
  const [sortBy,setSortBy]=useState("pts");

  const regions=["All",...[...new Set(players.map(p=>p.region))].sort()];
  const rankGroups=["All","Challenger","Grandmaster","Master","Diamond","Emerald"];

  const filtered=players
    .filter(p=>{
      if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!p.riotId.toLowerCase().includes(search.toLowerCase()))return false;
      if(regionFilter!=="All"&&p.region!==regionFilter)return false;
      if(rankFilter!=="All"&&p.rank!==rankFilter)return false;
      return true;
    })
    .sort((a,b)=>sortBy==="pts"?b.pts-a.pts:sortBy==="name"?a.name.localeCompare(b.name):sortBy==="wins"?b.wins-a.wins:b.avg-a.avg);

  const checkedIn=filtered.filter(p=>p.checkedIn);
  const notChecked=filtered.filter(p=>!p.checkedIn);

  const isHomie=(p)=>HOMIES_IDS.includes(p.id);

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1}}>Player Roster</h2>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:13,color:"#BECBD9"}}>{players.length} registered</span>
          <span style={{fontSize:13,color:"#6EE7B7",fontWeight:600}}>{players.filter(p=>p.checkedIn).length} checked in</span>
        </div>
      </div>

      {/* Search + Filters */}
      <Panel style={{padding:"16px",marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:10,alignItems:"center"}}>
          <Inp value={search} onChange={setSearch} placeholder="Search by name or Riot ID…"/>
          <Sel value={regionFilter} onChange={setRegionFilter}>
            {regions.map(r=><option key={r} value={r}>{r==="All"?"All Regions":r}</option>)}
          </Sel>
          <Sel value={rankFilter} onChange={setRankFilter}>
            {rankGroups.map(r=><option key={r} value={r}>{r==="All"?"All Ranks":r}</option>)}
          </Sel>
          <Sel value={sortBy} onChange={setSortBy}>
            <option value="pts">Sort: Points</option>
            <option value="wins">Sort: Wins</option>
            <option value="name">Sort: Name</option>
          </Sel>
        </div>
        {search&&<div style={{marginTop:10,fontSize:12,color:"#BECBD9"}}>{filtered.length} result{filtered.length!==1?"s":""} for "{search}"</div>}
      </Panel>

      {/* Checked In section */}
      {checkedIn.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#6EE7B7"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"#6EE7B7",letterSpacing:".08em",textTransform:"uppercase"}}>Checked In - Clash #14</span>
            <span style={{fontSize:12,color:"#9AAABF"}}>({checkedIn.length})</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
            {checkedIn.map((p,i)=>{
              const rank=players.filter(pl=>pl.checkedIn).sort((a,b)=>b.pts-a.pts).indexOf(p)+1;
              const homie=isHomie(p);
              return(
                <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                  style={{background:homie?"rgba(155,114,207,.06)":"#111827",
                    border:"1px solid "+(homie?"rgba(155,114,207,.25)":"rgba(82,196,124,.2)"),
                    borderRadius:10,padding:"12px 14px",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:12,transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=homie?"rgba(155,114,207,.5)":"rgba(82,196,124,.45)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=homie?"rgba(155,114,207,.25)":"rgba(82,196,124,.2)"}>
                  <div style={{position:"relative",flexShrink:0}}>
                    {homie&&<div style={{position:"absolute",top:-4,right:-4,fontSize:12}}>💜</div>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                      {isHotStreak(p)&&<span style={{fontSize:12}}>🔥</span>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                      <ClashRankBadge rank={p.rank}/>
                      <Tag color="#4ECDC4" size="sm">{p.region}</Tag>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div className="mono" style={{fontSize:16,fontWeight:700,color:"#E8A838"}}>{p.pts}</div>
                    <div style={{fontSize:10,color:"#BECBD9"}}>pts · #{rank}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Not checked in */}
      {notChecked.length>0&&(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#9AAABF"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"#9AAABF",letterSpacing:".08em",textTransform:"uppercase"}}>Not Yet Checked In</span>
            <span style={{fontSize:12,color:"#9AAABF"}}>({notChecked.length})</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
            {notChecked.map(p=>(
              <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.06)",borderRadius:10,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,opacity:.7,transition:"opacity .15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                onMouseLeave={e=>e.currentTarget.style.opacity=".7"}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#C8D4E0",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{display:"flex",gap:6}}>
                    <ClashRankBadge rank={p.rank}/>
                    <Tag color="#4ECDC4" size="sm">{p.region}</Tag>
                  </div>
                </div>
                <div className="mono" style={{fontSize:14,color:"#9AAABF"}}>{p.pts}pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔍</div>
          <div style={{color:"#BECBD9",fontSize:15}}>No players match your search.</div>
          <div style={{color:"#9AAABF",fontSize:13,marginTop:6}}>Try a different name or clear the filters.</div>
        </div>
      )}
    </div>
  );
}




// ─── BRACKET SCREEN ───────────────────────────────────────────────────────────
function BracketScreen({players,setPlayers,toast,isAdmin,currentUser,setProfilePlayer,setScreen,tournamentState,setTournamentState,seasonConfig}){
  const checkedIn=players.filter(p=>p.checkedIn);
  const lobbySize=8;
  const round=tournamentState?tournamentState.round:1;
  const lockedLobbies=tournamentState?tournamentState.lockedLobbies:[];
  const currentClashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:("c"+Date.now());
  const [mySearch,setMySearch]=useState(currentUser?currentUser.username:"");
  const [highlightLobby,setHighlightLobby]=useState(null);
  // Per-lobby placement entry UI state: lobbyIdx -> {open:bool, placements:{playerId->place}}
  const [placementEntry,setPlacementEntry]=useState({});

  function getLobbies(){
    var algo=(tournamentState&&tournamentState.seedAlgo)||"rank-based";
    var pool;
    if(round===1){
      if(algo==="random"){
        pool=[...checkedIn].sort(()=>Math.random()-0.5);
      } else if(algo==="snake"){
        var sorted=[...checkedIn].sort((a,b)=>b.lp-a.lp);
        pool=[];
        sorted.forEach(function(p,i){if(Math.floor(i/lobbySize)%2===0)pool.push(p);else pool.unshift(p);});
      } else {
        pool=[...checkedIn].sort((a,b)=>b.pts-a.pts||b.lp-a.lp);
      }
    } else {
      pool=[...checkedIn].sort((a,b)=>b.pts-a.pts);
    }
    const lobbies=[];
    for(let i=0;i<pool.length;i+=lobbySize)lobbies.push(pool.slice(i,i+lobbySize));
    return lobbies;
  }
  const lobbies=getLobbies();

  function findMyLobby(){
    const q=mySearch.trim().toLowerCase();
    if(!q)return;
    const li=lobbies.findIndex(lobby=>lobby.some(p=>p.name.toLowerCase().includes(q)||p.riotId?.toLowerCase().includes(q)));
    if(li>=0){setHighlightLobby(li);toast("Found in Lobby "+(li+1)+"! ✓","success");}
    else toast("Not found in active lobbies","error");
  }

  function openPlacementEntry(li){
    const lobby=lobbies[li];
    const init={};
    lobby.forEach((p,i)=>{init[p.id]=String(i+1);});
    setPlacementEntry(pe=>({...pe,[li]:{open:true,placements:init}}));
  }

  function setPlace(li,pid,val){
    setPlacementEntry(pe=>({...pe,[li]:{...pe[li],placements:{...pe[li].placements,[pid]:val}}}));
  }

  function placementValid(li){
    const lobby=lobbies[li];
    if(!placementEntry[li])return false;
    const vals=lobby.map(p=>parseInt(placementEntry[li].placements[p.id]||"0"));
    const valid=vals.every(v=>v>=1&&v<=8);
    const unique=new Set(vals).size===vals.length;
    return valid&&unique;
  }

  function applyGameResults(li){
    const lobby=lobbies[li];
    if(!placementEntry[li])return;
    const placements={};
    lobby.forEach(p=>{placements[p.id]=parseInt(placementEntry[li].placements[p.id]||"0");});
    var allClashIds=PAST_CLASHES.map(function(c){return "c"+c.id;});
    setPlayers(prev=>prev.map(p=>{
      const place=placements[p.id];
      if(place===undefined)return p;
      const earned=PTS[place]||0;
      var bonuses=computeSeasonBonuses(p,currentClashId,allClashIds,seasonConfig);
      var totalEarned=earned+(bonuses.bonusPts||0);
      const newGames=(p.games||0)+1;
      const newWins=(p.wins||0)+(place===1?1:0);
      const newTop4=(p.top4||0)+(place<=4?1:0);
      const newPts=(p.pts||0)+totalEarned;
      const newAvg=(((parseFloat(p.avg)||0)*(p.games||0)+place)/newGames).toFixed(2);
      const newHistory=[...(p.clashHistory||[]),{round,place,pts:earned,clashId:currentClashId,bonusPts:bonuses.bonusPts||0,comebackTriggered:bonuses.comebackTriggered,attendanceMilestone:bonuses.attendanceMilestone}];
      const newSparkline=[...(p.sparkline||[p.pts]),newPts];
      const newStreak=place<=4?(p.currentStreak||0)+1:0;
      const bestStreak=Math.max(p.bestStreak||0,newStreak);
      const newAttendanceStreak=getAttendanceStreak(p,allClashIds.concat([currentClashId]));
      return {...p,pts:newPts,wins:newWins,top4:newTop4,games:newGames,avg:newAvg,
        clashHistory:newHistory,sparkline:newSparkline,currentStreak:newStreak,bestStreak,
        lastClashId:currentClashId,attendanceStreak:newAttendanceStreak};
    }));
    setTournamentState(ts=>({...ts,lockedLobbies:[...(ts.lockedLobbies||[]),li]}));
    setPlacementEntry(pe=>({...pe,[li]:{...pe[li],open:false}}));
    toast("Lobby "+(li+1)+" results applied! ✓","success");
  }

  const allLocked=lobbies.length>0&&lobbies.every((_,i)=>lockedLobbies.includes(i));

  // auto-highlight if logged in
  const myLobbyAuto=currentUser?lobbies.findIndex(lb=>lb.some(p=>p.name===currentUser.username)):-1;
  const effectiveHighlight=highlightLobby!==null?highlightLobby:myLobbyAuto>=0?myLobbyAuto:null;

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1}}>
          Bracket - Round {round}
          <span style={{fontSize:13,fontWeight:400,color:"#BECBD9",marginLeft:10}}>{lobbies.length} {lobbies.length===1?"Lobby":"Lobbies"} · {checkedIn.length} players</span>
        </h2>
        {isAdmin&&(
          <div style={{display:"flex",gap:8}}>
            <Btn v="dark" s="sm" disabled={round<=1} onClick={()=>setTournamentState(ts=>({...ts,round:ts.round-1,lockedLobbies:[]}))}>← Round</Btn>
            <Btn v="primary" s="sm" disabled={!allLocked} onClick={()=>{if(round>=3){setTournamentState(ts=>({...ts,phase:"complete",lockedLobbies:[]}));toast("Clash complete! View results →","success");}else{setTournamentState(ts=>({...ts,round:ts.round+1,lockedLobbies:[]}));toast("Advanced to Round "+(round+1),"success");}}}>
              {round>=3?"Finalize Clash ✓":"Next Round →"}
            </Btn>
          </div>
        )}
      </div>

      {checkedIn.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🎮</div>
          <h3 style={{color:"#F2EDE4",marginBottom:8}}>No players checked in</h3>
          <p style={{color:"#BECBD9",fontSize:14,marginBottom:20}}>Players need to check in before the bracket can be generated.</p>
          <Btn v="primary" onClick={()=>setScreen("home")}>← Back to Home</Btn>
        </div>
      )}

      {checkedIn.length>0&&(
        <>
          {/* Find my lobby */}
          <Panel style={{padding:"14px 16px",marginBottom:20,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:"#C8D4E0",flexShrink:0}}>🔍 Find your lobby:</span>
            <Inp value={mySearch} onChange={setMySearch} placeholder="Your name or Riot ID" onKeyDown={e=>e.key==="Enter"&&findMyLobby()}/>
            <Btn v="purple" s="sm" onClick={findMyLobby}>Find Me</Btn>
            {effectiveHighlight!==null&&<span style={{fontSize:12,color:"#6EE7B7",fontWeight:600}}>You are in Lobby {effectiveHighlight+1}</span>}
          </Panel>

          {/* Round progress + complete banner */}
          {tournamentState&&tournamentState.phase==="complete"&&(
            <div style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.4)",borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:22}}>🏆</span>
              <div>
                <div style={{fontWeight:700,color:"#E8A838",fontSize:15}}>Clash Complete!</div>
                <div style={{fontSize:12,color:"#C8D4E0"}}>All rounds locked. View final standings on the Leaderboard.</div>
              </div>
              <Btn v="primary" s="sm" style={{marginLeft:"auto"}} onClick={()=>setScreen("leaderboard")}>View Results →</Btn>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {[1,2,3].map(r=>(
              <div key={r} style={{flex:1,minWidth:80,background:r<round?"rgba(82,196,124,.08)":r===round?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",
                border:"1px solid "+(r<round?"rgba(82,196,124,.3)":r===round?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),
                borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:r<round?"#6EE7B7":r===round?"#E8A838":"#9AAABF",letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>Round {r}</div>
                <div style={{fontSize:11,color:r<round?"#6EE7B7":r===round?"#E8A838":"#9AAABF"}}>{r<round?"Complete ✓":r===round?"In Progress":"Upcoming"}</div>
              </div>
            ))}
          </div>

          {/* Lobby grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16}}>
            {lobbies.map((lobby,li)=>{
              const isMyLobby=effectiveHighlight===li;
              const locked=lockedLobbies.includes(li);
              return(
                <div key={li} style={{
                  background:isMyLobby?"rgba(155,114,207,.06)":"#111827",
                  border:"2px solid "+(isMyLobby?"#9B72CF":locked?"rgba(82,196,124,.35)":"rgba(242,237,228,.1)"),
                  borderRadius:14,overflow:"hidden",
                  boxShadow:isMyLobby?"0 0 24px rgba(155,114,207,.15)":"none",
                  transition:"box-shadow .2s"}}>
                  {/* Lobby header */}
                  <div style={{padding:"14px 16px",background:isMyLobby?"rgba(155,114,207,.1)":"rgba(255,255,255,.02)",
                    borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:8,
                        background:isMyLobby?"rgba(155,114,207,.2)":locked?"rgba(82,196,124,.12)":"rgba(232,168,56,.08)",
                        border:"1px solid "+(isMyLobby?"rgba(155,114,207,.5)":locked?"rgba(82,196,124,.3)":"rgba(232,168,56,.2)"),
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:13,fontWeight:800,color:isMyLobby?"#9B72CF":locked?"#6EE7B7":"#E8A838"}}>
                        {li+1}
                      </div>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Lobby {li+1}</div>
                        <div style={{fontSize:11,color:"#BECBD9"}}>{lobby.length} players{isMyLobby?" · Your Lobby":""}</div>
                      </div>
                    </div>
                    {isMyLobby&&<div style={{fontSize:12,fontWeight:700,color:"#9B72CF",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:6,padding:"3px 10px"}}>YOU</div>}
                    {locked&&!isMyLobby&&<div style={{fontSize:11,color:"#6EE7B7",fontWeight:700}}>✓ Locked</div>}
                  </div>
                  {/* Player list */}
                  <div style={{padding:"10px 12px"}}>
                    {lobby.sort((a,b)=>b.pts-a.pts).map((p,pi)=>{
                      const isMe=currentUser&&p.name===currentUser.username;
                      const homie=HOMIES_IDS.includes(p.id);
                      return(
                        <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 6px",
                            borderBottom:pi<lobby.length-1?"1px solid rgba(242,237,228,.05)":"none",
                            cursor:"pointer",borderRadius:6,
                            background:isMe?"rgba(155,114,207,.08)":"transparent",
                            transition:"background .15s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=isMe?"rgba(155,114,207,.12)":"rgba(242,237,228,.03)"}
                          onMouseLeave={e=>e.currentTarget.style.background=isMe?"rgba(155,114,207,.08)":"transparent"}>
                          <div className="mono" style={{fontSize:12,fontWeight:800,color:pi===0?"#E8A838":pi===1?"#C0C0C0":pi===2?"#CD7F32":"#9AAABF",minWidth:18,textAlign:"center"}}>{pi+1}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{fontWeight:isMe?700:600,fontSize:13,color:isMe?"#C4B5FD":"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                              {homie&&<span style={{fontSize:10}}>💜</span>}
                              {isHotStreak(p)&&<span style={{fontSize:10}}>🔥</span>}
                            </div>
                            <div style={{fontSize:10,color:"#BECBD9"}}>{p.rank} · {p.region}</div>
                          </div>
                          <div className="mono" style={{fontSize:12,fontWeight:700,color:"#E8A838",flexShrink:0}}>{p.pts}pts</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Admin placement entry */}
                  {isAdmin&&!locked&&(
                    <div style={{borderTop:"1px solid rgba(242,237,228,.06)"}}>
                      {(!placementEntry[li]||!placementEntry[li].open)?(
                        <div style={{padding:"10px 12px",background:"rgba(255,255,255,.01)"}}>
                          <Btn v="teal" s="sm" full onClick={()=>openPlacementEntry(li)}>Enter Placements</Btn>
                        </div>
                      ):(
                        <div style={{padding:"12px",background:"rgba(78,205,196,.03)",borderTop:"1px solid rgba(78,205,196,.12)"}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#4ECDC4",marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Enter Placements — Round {round}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                            {lobby.sort((a,b)=>b.pts-a.pts).map(p=>{
                              const dup=lobby.filter(x=>placementEntry[li].placements[x.id]===placementEntry[li].placements[p.id]).length>1;
                              return(
                                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:12,color:"#F2EDE4",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                                  <Sel value={placementEntry[li].placements[p.id]||"1"} onChange={v=>setPlace(li,p.id,v)} style={{width:60,border:dup?"1px solid #F87171":undefined}}>
                                    {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
                                  </Sel>
                                </div>
                              );
                            })}
                          </div>
                          {!placementValid(li)&&<div style={{fontSize:11,color:"#F87171",marginBottom:8}}>Each placement must be unique (1-8)</div>}
                          <div style={{display:"flex",gap:8}}>
                            <Btn v="success" s="sm" full disabled={!placementValid(li)} onClick={()=>applyGameResults(li)}>Confirm & Lock ✓</Btn>
                            <Btn v="dark" s="sm" onClick={()=>setPlacementEntry(pe=>({...pe,[li]:{...pe[li],open:false}}))}>Cancel</Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Finals display */}
          {round>3&&checkedIn.length>0&&(
            <Panel style={{padding:"24px",marginTop:24,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>🏆</div>
              <h3 style={{color:"#E8A838",fontSize:20,marginBottom:8}}>Grand Finals</h3>
              <p style={{color:"#BECBD9",fontSize:14}}>All rounds complete. Finals results locked in.</p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}



const styleHideMobile=`@media(max-width:767px){.hide-mobile{display:none!important;}}`;


// ─── PLAYER PROFILE SCREEN ────────────────────────────────────────────────────
const WEEKLY_CHALLENGES=[
  {id:"w1",icon:"🔥",name:"On A Roll",desc:"Win 2 lobbies this week",xp:120,type:"weekly",progress:1,goal:2},
  {id:"w2",icon:"📊",name:"Consistency Check",desc:"Average top 3 across 3 games",xp:100,type:"weekly",progress:2,goal:3},
  {id:"w3",icon:"🏆",name:"Podium Finish",desc:"Top 3 in a clash event",xp:150,type:"weekly",progress:0,goal:1},
];

const DAILY_CHALLENGES=[
  {id:"d1",icon:"🎯",name:"Sharp Shooter",desc:"Finish in the top 2",xp:50,type:"daily",progress:0,goal:1},
  {id:"d2",icon:"⚡",name:"Speed Run",desc:"Complete a game in under 30 mins",xp:40,type:"daily",progress:0,goal:1},
  {id:"d3",icon:"🛡",name:"Survivor",desc:"Finish top 4 in any lobby",xp:30,type:"daily",progress:0,goal:1},
];

function PlayerProfileScreen({player,onBack,allPlayers,setScreen,currentUser,seasonConfig}){
  const [tab,setTab]=useState("overview");
  const achievements=getAchievements(player);
  const s=computeStats(player);

  const StatCard=({label,val,sub,c,big})=>(
    <div style={{background:"#0F1520",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
      <div className="mono" style={{fontSize:big?26:18,fontWeight:700,color:c||"#E8A838",lineHeight:1}}>{val}</div>
      <div className="cond" style={{fontSize:10,fontWeight:700,color:"#C8D4E0",marginTop:4,letterSpacing:".04em",textTransform:"uppercase"}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>{sub}</div>}
    </div>
  );

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={onBack}>← Back</Btn>
        {setScreen&&<Btn v="ghost" s="sm" onClick={()=>setScreen("recap")}>🗓 Season Recap</Btn>}
        {setScreen&&<Btn v="purple" s="sm" onClick={()=>setScreen("challenges")}>⚡ Challenges</Btn>}

      </div>

      {/* Champion banner - shown if this player is the season champion */}
      {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&(
        <div style={{background:"linear-gradient(90deg,rgba(232,168,56,.15),rgba(232,168,56,.05))",border:"1px solid rgba(232,168,56,.5)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12,animation:"pulse-gold 3s infinite"}}>
          <span style={{fontSize:22,animation:"crown-glow 2s infinite"}}>👑</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,color:"#E8A838"}}>{SEASON_CHAMPION.title}</div>
            <div style={{fontSize:11,color:"#C8D4E0"}}>Reigning champion since {SEASON_CHAMPION.since}</div>
          </div>
          <Tag color="#E8A838">Season {SEASON_CHAMPION.season}</Tag>
        </div>
      )}

      {/* Hero */}
      <div style={{background:`linear-gradient(135deg,${rc(player.rank)}18,#08080F 60%)`,border:"1px solid "+rc(player.rank)+"30",borderRadius:14,padding:"28px 24px",marginBottom:18,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${rc(player.rank)},transparent)`}}/>
        <div style={{position:"absolute",top:"50%",right:"-5%",transform:"translateY(-50%)",width:250,height:250,borderRadius:"50%",background:`radial-gradient(circle,${rc(player.rank)}10,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap",position:"relative"}}>
          <div style={{width:72,height:72,borderRadius:"50%",
            background:`linear-gradient(135deg,${rc(player.rank)}33,${rc(player.rank)}11)`,
            border:`3px solid ${SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name?"#E8A838":rc(player.rank)+"66"}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:700,color:SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name?"#E8A838":rc(player.rank),fontFamily:"'Cinzel',serif",flexShrink:0,
            boxShadow:SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name?"0 0 24px rgba(232,168,56,.4)":"none"}}>
            {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&<span style={{position:"absolute",top:-8,right:-8,fontSize:16}}>👑</span>}
            {player.name.charAt(0)}
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
              <h1 style={{fontSize:"clamp(20px,4vw,34px)",color:"#F2EDE4",lineHeight:1}}>{player.name}</h1>
              {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&<Tag color="#E8A838">👑 {SEASON_CHAMPION.title}</Tag>}
              {isHotStreak(player)&&<span style={{fontSize:18}}>🔥</span>}
              {isOnTilt(player)&&<span style={{fontSize:18}}>💀</span>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <Tag color={rc(player.rank)}>{player.rank}</Tag>
              <Tag color="#4ECDC4">{player.region}</Tag>
              <ClashRankBadge xp={estimateXp(player)} size="sm"/>
              <span className="mono" style={{fontSize:12,color:"#BECBD9"}}>{player.riotId}</span>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {achievements.slice(0,5).map(a=>(
                <div key={a.id} title={a.desc} style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.3)",borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:4,fontSize:12}}>
                  <span>{a.icon}</span><span style={{color:"#E8A838",fontWeight:600,fontSize:11}}>{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Big stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:18}}>
          <StatCard label="Season Pts" val={player.pts} c="#E8A838" big/>
          <StatCard label="Win Rate" val={s.top1Rate+"%"} c="#6EE7B7" big/>
          <StatCard label="Avg Place" val={s.avgPlacement} c={avgCol(s.avgPlacement)} big/>
          <StatCard label="Top4 %" val={s.top4Rate+"%"} c="#C4B5FD" big/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
        {["overview","rounds","history","h2h","achievements"].map(t2=>(
          <Btn key={t2} v={tab===t2?"primary":"dark"} s="sm" onClick={()=>setTab(t2)} style={{textTransform:"capitalize",flexShrink:0}}>{t2==="h2h"?"H2H":t2==="rounds"?"By Round":t2}</Btn>
        ))}
      </div>

      {tab==="overview"&&(
        <div className="grid-2">
          <Panel style={{padding:"18px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Career Stats</h3>
            {/* AVP dual display - prominent */}
            <div style={{background:"rgba(232,168,56,.05)",border:"1px solid rgba(232,168,56,.15)",borderRadius:9,padding:"12px 14px",marginBottom:12}}>
              <div className="cond" style={{fontSize:9,fontWeight:700,color:"#BECBD9",letterSpacing:".14em",textTransform:"uppercase",marginBottom:8}}>Average Placement</div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:"#C8D4E0",marginBottom:3}}>Career AVP</div>
                  <div className="mono" style={{fontSize:24,fontWeight:700,color:avgCol(s.avgPlacement),lineHeight:1}}>{s.avgPlacement}</div>
                  <div style={{fontSize:9,color:"#9AAABF",marginTop:2}}>all games · lower is better</div>
                </div>
                {s.perClashAvp&&(
                  <div style={{flex:1,paddingLeft:12,borderLeft:"1px solid rgba(242,237,228,.07)"}}>
                    <div style={{fontSize:10,color:"#C8D4E0",marginBottom:3}}>Per-Clash AVP</div>
                    <div className="mono" style={{fontSize:24,fontWeight:700,color:avgCol(s.perClashAvp),lineHeight:1}}>{s.perClashAvp}</div>
                    <div style={{fontSize:9,color:"#9AAABF",marginTop:2}}>avg within each event</div>
                  </div>
                )}
              </div>
            </div>
            {(()=>{
              const allSorted=[...allPlayers].sort((a,b)=>b.pts-a.pts);
              const rank=allSorted.findIndex(p=>p.id===player.id)+1||"-";
              const consistency=s.games>0?Math.round((s.top4/s.games)*100)+"%":"-";
              return[["Games",s.games,"#C8D4E0"],["Wins",s.wins,"#E8A838"],["Top 4",s.top4,"#4ECDC4"],["Bot 4",s.bot4,"#F87171"],["Season Rank","#"+rank,"#E8A838"],["Consistency",consistency,"#52C47C"],["PPG",s.ppg,"#EAB308"],["Best Streak",player.bestStreak||0,"#EAB308"],["Best Haul",(player.bestHaul||0)+"pts","#E8A838"]];
            })().map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(242,237,228,.05)"}}>
                <span style={{fontSize:13,color:"#C8D4E0"}}>{l}</span>
                <span className="mono" style={{fontSize:15,fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </Panel>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Panel style={{padding:"18px"}}>
              <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:12}}>Rates</h3>
              {[["Top 1%",s.top1Rate+"%","#E8A838"],["Top 4%",s.top4Rate+"%","#4ECDC4"],["Bot 4%",s.bot4Rate+"%","#F87171"],["Comeback",s.comebackRate+"%","#52C47C"],["Clutch",s.clutchRate+"%","#9B72CF"]].map(([l,v,c])=>(
                <div key={l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:"#C8D4E0"}}>{l}</span>
                    <span className="mono" style={{fontSize:13,fontWeight:700,color:c}}>{v}</span>
                  </div>
                  <Bar val={parseFloat(v)} max={100} color={c} h={3}/>
                </div>
              ))}
            </Panel>
            <Panel style={{padding:"18px"}}>
              <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:10}}>Points Trend</h3>
              <Sparkline data={player.sparkline||[player.pts]} color="#E8A838" w={220} h={60}/>
            </Panel>
            <Panel style={{padding:"18px"}}>
              <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Platform Rank</h3>
              <ClashRankBadge xp={estimateXp(player)} showProgress={true}/>
              <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {CLASH_RANKS.map(r=>{
                  const playerXp=estimateXp(player);
                  const unlocked=playerXp>=r.minXp;
                  return(
                    <div key={r.id} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",background:unlocked?"rgba(232,168,56,.04)":"rgba(255,255,255,.02)",borderRadius:7,border:"1px solid "+(unlocked?r.color+"33":"rgba(242,237,228,.05)"),opacity:unlocked?1:.4}}>
                      <span style={{fontSize:14}}>{r.icon}</span>
                      <span style={{fontSize:11,fontWeight:600,color:unlocked?r.color:"#BECBD9"}}>{r.name}</span>
                      {unlocked&&playerXp>=r.minXp&&getClashRank(playerXp).id===r.id&&<span style={{fontSize:10,color:r.color,marginLeft:"auto"}}>▲</span>}
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {tab==="rounds"&&(
        <Panel style={{padding:"18px"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Average Placement By Round</h3>
          <div className="grid-4" style={{marginBottom:18}}>
            {[["R1",s.roundAvgs.r1,"#4ECDC4"],["R2",s.roundAvgs.r2,"#9B72CF"],["R3",s.roundAvgs.r3,"#EAB308"],["Finals",s.roundAvgs.finals,"#E8A838"]].map(([l,v,c])=>(
              <div key={l} style={{background:"#0F1520",borderRadius:10,padding:"14px",textAlign:"center"}}>
                <div className="cond" style={{fontSize:10,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>{l}</div>
                {v?<><div className="mono" style={{fontSize:22,fontWeight:700,color:avgCol(v),lineHeight:1}}>{v}</div>
                  <div style={{fontSize:10,color:avgCol(v),marginTop:4}}>{parseFloat(v)<3?"Great":parseFloat(v)<5?"OK":"Rough"}</div></>
                :<div className="mono" style={{fontSize:18,color:"#9AAABF"}}>-</div>}
              </div>
            ))}
          </div>
          <div style={{fontSize:13,color:"#C8D4E0",marginBottom:12}}>Per-clash round breakdown:</div>
          {(player.clashHistory||[]).slice(0,6).map((g,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 60px 60px 60px",gap:6,padding:"9px 0",borderBottom:"1px solid rgba(242,237,228,.05)",alignItems:"center"}}>
              <div><div style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{g.name}</div><div style={{fontSize:11,color:"#BECBD9"}}>{g.date}</div></div>
              {["r1","r2","r3","finals"].map(rk=>{
                const v=g.roundPlacements?.[rk];
                return <div key={rk} style={{textAlign:"center"}}>{v?<span className="mono" style={{fontSize:13,fontWeight:700,color:v===1?"#E8A838":v<=4?"#4ECDC4":"#F87171"}}>#{v}</span>:<span style={{color:"#9AAABF"}}>-</span>}</div>;
              })}
              <div className="mono" style={{fontSize:13,fontWeight:700,color:"#E8A838",textAlign:"center"}}>+{g.pts}</div>
            </div>
          ))}
        </Panel>
      )}

      {tab==="history"&&(
        <Panel style={{overflow:"hidden"}}>
          <div style={{padding:"12px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <h3 style={{fontSize:15,color:"#F2EDE4"}}>Clash History</h3>
            {seasonConfig&&seasonConfig.dropWeeks>0&&<span style={{fontSize:11,color:"#9B72CF"}}>Drop Weeks: {seasonConfig.dropWeeks} worst excluded</span>}
          </div>
          {(player.clashHistory||[]).length===0
            ?<div style={{textAlign:"center",padding:40,color:"#9AAABF"}}>No history yet</div>
            :(function(){
              var hist=[...(player.clashHistory||[])];
              var dropped=new Set();
              if(seasonConfig&&seasonConfig.dropWeeks>0){
                var clashMap={};
                hist.forEach(function(g){var cid=g.clashId||"c0";clashMap[cid]=(clashMap[cid]||0)+(g.pts||0);});
                var sorted2=Object.entries(clashMap).sort(function(a,b){return a[1]-b[1];});
                sorted2.slice(0,seasonConfig.dropWeeks).forEach(function(e){dropped.add(e[0]);});
              }
              return hist.map(function(g,i){
                var isDropped=dropped.has(g.clashId||"c0");
                var hasComeback=g.comebackTriggered;
                var hasMilestone=g.attendanceMilestone;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",background:g.placement===1?"rgba(232,168,56,.03)":"transparent",opacity:isDropped?.45:1}}>
                    <div className="mono" style={{fontSize:22,fontWeight:700,color:g.placement===1?"#E8A838":g.placement<=4?"#4ECDC4":"#BECBD9",minWidth:24,textAlign:"center",textDecoration:isDropped?"line-through":"none"}}>{g.placement}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,color:"#F2EDE4"}}>{g.name||"Clash"}</div>
                      <div style={{fontSize:12,color:"#BECBD9"}}>{g.date||""}</div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:2}}>
                        {g.claimedClutch&&<Tag color="#9B72CF" size="sm">🎯 Clutch</Tag>}
                        {isDropped&&<Tag color="#BECBD9" size="sm">Dropped</Tag>}
                        {hasComeback&&<Tag color="#4ECDC4" size="sm">Comeback +2</Tag>}
                        {hasMilestone&&<Tag color="#E8A838" size="sm">{hasMilestone}-Streak Bonus</Tag>}
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="mono" style={{fontSize:16,fontWeight:700,color:isDropped?"#BECBD9":"#E8A838",textDecoration:isDropped?"line-through":"none"}}>+{g.pts}pts</div>
                      {(g.bonusPts||0)>0&&!isDropped&&<div className="mono" style={{fontSize:11,color:"#52C47C"}}>+{g.bonusPts} bonus</div>}
                      <div className="cond" style={{fontSize:9,color:"#BECBD9",textTransform:"uppercase"}}>{g.placement===1?"🏆 Champion":g.placement<=4?"Top 4":"Bot 4"}</div>
                    </div>
                  </div>
                );
              });
            })()
          }
        </Panel>
      )}

      {tab==="h2h"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <div>
              <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:2}}>Rivals & Head-to-Head</h3>
              <p style={{fontSize:12,color:"#BECBD9"}}>Track your record against every player you've shared a lobby with.</p>
            </div>
          </div>
          <Panel style={{overflow:"hidden"}}>
            <div style={{padding:"10px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".08em"}}>All opponents</span>
              <span style={{fontSize:11,color:"#BECBD9"}}>{allPlayers.filter(p=>p.id!==player.id).length} players</span>
            </div>
            {allPlayers.filter(p=>p.id!==player.id).map((op,i)=>{
              // Deterministic H2H based on ids
              const seed=(player.id*7+op.id*3)%11;
              const mW=Math.min(5,seed);
              const tW=Math.min(5,(player.id+op.id)%7);
              const total=mW+tW||1;
              const ahead=mW>tW;
              const tied=mW===tW;
              return(
                <div key={op.id} style={{padding:"13px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",background:i%2===0?"rgba(255,255,255,.01)":"transparent"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{op.name}</div>
                      <div style={{fontSize:11,color:"#BECBD9"}}>{op.rank} · {op.region}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div className="mono" style={{fontSize:14}}>
                        <span style={{color:"#6EE7B7",fontWeight:700}}>{mW}W</span>
                        <span style={{color:"#9AAABF",margin:"0 4px"}}>-</span>
                        <span style={{color:"#F87171",fontWeight:700}}>{tW}L</span>
                      </div>
                      <div style={{fontSize:10,color:ahead?"#6EE7B7":tied?"#E8A838":"#F87171",fontWeight:600,marginTop:2}}>
                        {ahead?"You're ahead":tied?"All tied":"They're ahead"}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:1,height:5,borderRadius:99,overflow:"hidden",background:"rgba(255,255,255,.05)"}}>
                    <div style={{width:(mW/total*100)+"%",background:"#6EE7B7",borderRadius:"99px 0 0 99px",transition:"width .6s"}}/>
                    <div style={{flex:1,background:"rgba(248,113,113,.3)",borderRadius:"0 99px 99px 0"}}/>
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      )}

      {tab==="achievements"&&(
        <div className="grid-3">
          {ACHIEVEMENTS.map(a=>{
            const unlocked=a.check(player);
            return(
              <Panel key={a.id} style={{padding:"16px",opacity:unlocked?1:.4,border:"1px solid "+(unlocked?"rgba(232,168,56,.3)":"rgba(242,237,228,.07)")}}>
                <div style={{fontSize:26,marginBottom:6}}>{a.icon}</div>
                <div style={{fontWeight:700,fontSize:14,color:unlocked?"#F2EDE4":"#BECBD9",marginBottom:4}}>{a.name}</div>
                <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5}}>{a.desc}</div>
                {unlocked&&<div style={{marginTop:8}}><Tag color="#E8A838" size="sm">Unlocked</Tag></div>}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardScreen({players,setScreen,setProfilePlayer,currentUser}){
  const [tab,setTab]=useState("season");
  const [search,setSearch]=useState("");
  const [regionFilter,setRegionFilter]=useState("All");
  const MEDALS=["🥇","🥈","🥉"];
  const MCOLS=["#E8A838","#C0C0C0","#CD7F32"];

  const filtered=players.filter(p=>{
    const mn=p.name.toLowerCase().includes(search.toLowerCase());
    const mr=regionFilter==="All"||p.region===regionFilter;
    return mn&&mr;
  });
  const sorted=[...filtered].sort((a,b)=>b.pts-a.pts);
  const top3=sorted.slice(0,3);
  const myLbIdx=currentUser?sorted.findIndex(p=>p.name===currentUser.username):-1;

  function open(p){setProfilePlayer(p);setScreen("profile");}

  return(
    <div className="page wrap">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
          <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:3}}>Leaderboard</h2>
          <p style={{color:"#BECBD9",fontSize:13}}>Season 16 · tap a player for full profile</p>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["season","cards","stats","streaks"].map(t=>(
            <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</Btn>
          ))}
        </div>
      </div>

      {/* Podium */}
      {top3.length>=3&&(tab==="season"||tab==="cards")&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1.08fr 1fr",gap:10,marginBottom:20}}>
          {[top3[1],top3[0],top3[2]].map((p,idx)=>{
            const ri=idx===0?1:idx===1?0:2;
            const s2=computeStats(p);
            return(
              <Panel key={p.id} hover style={{padding:"18px 14px",textAlign:"center",border:"1px solid "+MCOLS[ri]+"44",marginTop:ri===0?0:14,cursor:"pointer"}} onClick={()=>open(p)}>
                <div style={{fontSize:26,marginBottom:6}}>{MEDALS[ri]}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:16,fontWeight:700,color:"#F2EDE4",marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:5,flexWrap:"wrap"}}>
                  <Tag color="#4ECDC4" size="sm">{p.region}</Tag>
                  <ClashRankBadge xp={estimateXp(p)} size="sm"/>
                </div>
                <div className="mono" style={{fontSize:26,fontWeight:700,color:MCOLS[ri],marginTop:8,lineHeight:1}}>{p.pts}</div>
                <div className="cond" style={{fontSize:9,color:"#BECBD9",letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Season Points</div>
                <div style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap"}}>
                  {[["Avg",s2.avgPlacement,avgCol(s2.avgPlacement)],["W",s2.wins,"#6EE7B7"],["T4%",s2.top4Rate+"%","#C4B5FD"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div className="mono" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                      <div className="cond" style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase"}}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:10}}>
                  <Sparkline data={p.sparkline||[p.pts]} color={MCOLS[ri]} w={80} h={20}/>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:160}}><Inp value={search} onChange={setSearch} placeholder="Search players..."/></div>
        <Sel value={regionFilter} onChange={setRegionFilter} style={{width:140}}><option value="All">All Regions</option>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</Sel>
        {currentUser&&myLbIdx>=0&&<Btn v="purple" s="sm" onClick={()=>document.getElementById("lb-me-row")?.scrollIntoView({behavior:"smooth",block:"center"})}>My Position #{myLbIdx+1}</Btn>}
      </div>

      {tab==="season"&&<StandingsTable rows={sorted} onRowClick={open} myName={currentUser?currentUser.username:null}/>}

      {tab==="cards"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
          {sorted.map((p,i)=>{
            const s2=computeStats(p);
            return(
              <Panel key={p.id} hover style={{padding:"16px",cursor:"pointer",border:"1px solid "+(i<3?MCOLS[i]+"44":"rgba(242,237,228,.08)")}} onClick={()=>open(p)}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="mono" style={{fontSize:12,fontWeight:700,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF",marginBottom:2}}>#{i+1}</div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</span>
                      {isHotStreak(p)&&"🔥"}{isOnTilt(p)&&"💀"}
                    </div>
                    <div style={{display:"flex",gap:5,marginTop:4,flexWrap:"wrap"}}>
                      <Tag color="#4ECDC4" size="sm">{p.region}</Tag>
                    </div>
                  </div>
                </div>
                {/* Season pts - big number */}
                <div style={{background:"rgba(232,168,56,.06)",borderRadius:8,padding:"10px",textAlign:"center",marginBottom:10}}>
                  <div className="mono" style={{fontSize:28,fontWeight:700,color:"#E8A838",lineHeight:1}}>{p.pts}</div>
                  <div className="cond" style={{fontSize:9,color:"#BECBD9",letterSpacing:".1em",textTransform:"uppercase",marginTop:3}}>Season Points</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                  {[["Avg",s2.avgPlacement,avgCol(s2.avgPlacement)],["Wins",s2.wins,"#6EE7B7"],["T4%",s2.top4Rate+"%","#C4B5FD"]].map(([l,v,c])=>(
                    <div key={l} style={{background:"#0F1520",borderRadius:7,padding:"7px",textAlign:"center"}}>
                      <div className="mono" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                      <div className="cond" style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase"}}>{l}</div>
                    </div>
                  ))}
                </div>
                <Sparkline data={p.sparkline||[p.pts]} color={rc(p.rank)} w={180} h={22}/>
              </Panel>
            );
          })}
        </div>
      )}

      {tab==="stats"&&(
        <Panel style={{overflowX:"auto"}}>
          <div style={{minWidth:420}}>
          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 55px 70px 55px 55px 60px",padding:"9px 14px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
            {["#","Player","PPG","Avg","T1%","T4%","B4%"].map(h=>(
              <span key={h} className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase"}}>{h}</span>
            ))}
          </div>
          {sorted.map((p,i)=>{
            const s2=computeStats(p);
            return(
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 55px 70px 55px 55px 60px",padding:"11px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",alignItems:"center",cursor:"pointer"}} onClick={()=>open(p)}>
                <span className="mono" style={{fontSize:12,color:i<3?"#E8A838":"#9AAABF"}}>{i+1}</span>
                <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                  <span style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                </div>
                <span className="mono" style={{fontSize:13,fontWeight:700,color:"#EAB308"}}>{s2.ppg}</span>
                <AvgBadge avg={s2.avgPlacement}/>
                <span className="mono" style={{fontSize:12,color:"#E8A838"}}>{s2.top1Rate}%</span>
                <span className="mono" style={{fontSize:12,color:"#4ECDC4"}}>{s2.top4Rate}%</span>
                <span className="mono" style={{fontSize:12,color:"#F87171"}}>{s2.bot4Rate}%</span>
              </div>
            );
          })}
          </div>
        </Panel>
      )}

      {tab==="streaks"&&(
        <Panel style={{overflowX:"auto"}}>
          <div style={{minWidth:400}}>
          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 80px 70px",padding:"9px 14px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
            {["#","Player","Best","Now","Comeback%","Clutch%"].map(h=>(
              <span key={h} className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase"}}>{h}</span>
            ))}
          </div>
          {[...sorted].sort((a,b)=>(b.bestStreak||0)-(a.bestStreak||0)).map((p,i)=>{
            const s2=computeStats(p);
            return(
              <div key={p.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 80px 70px",padding:"11px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",alignItems:"center",cursor:"pointer"}} onClick={()=>open(p)}>
                <span className="mono" style={{fontSize:12,color:i<3?"#E8A838":"#9AAABF"}}>{i+1}</span>
                <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                  <span style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}{isHotStreak(p)?" 🔥":""}{isOnTilt(p)?" 💀":""}</span>
                </div>
                <span className="mono" style={{fontSize:14,fontWeight:700,color:"#E8A838"}}>{p.bestStreak||0}🔥</span>
                <span className="mono" style={{fontSize:13,color:p.currentStreak>=3?"#6EE7B7":p.tiltStreak>=3?"#F87171":"#C8BFB0"}}>
                  {p.currentStreak>0?"+"+p.currentStreak:p.tiltStreak>0?"-"+p.tiltStreak:"-"}
                </span>
                <span className="mono" style={{fontSize:12,color:"#52C47C"}}>{s2.comebackRate}%</span>
                <span className="mono" style={{fontSize:12,color:"#9B72CF"}}>{s2.clutchRate}%</span>
              </div>
            );
          })}
          </div>
        </Panel>
      )}
    </div>
  );
}


// ─── CLASH REPORT component ───────────────────────────────────────────────────
function ClashReport({clashData,players}){
  const allP=players.length>0?players:SEED;
  const report=clashData.report;

  // Build per-player round data from player clashHistory matching this clash
  const playerData=allP.map(p=>{
    const entry=(p.clashHistory||[]).find(h=>h.name===clashData.name||h.id===clashData.id);
    return{...p,entry};
  }).filter(p=>p.entry);

  const sorted=[...playerData].sort((a,b)=>a.entry.placement-b.entry.placement);
  const mostImproved=report?.mostImproved||null;
  const biggestUpset=report?.biggestUpset||null;

  if(sorted.length===0)return(
    <div style={{padding:"20px",color:"#BECBD9",fontSize:14,textAlign:"center"}}>No detailed data for this clash yet.</div>
  );

  return(
    <div>
      {/* Per-player round breakdown table */}
      <div style={{overflowX:"auto",marginBottom:20}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:420}}>
          <thead>
            <tr style={{background:"#0A0F1A"}}>
              {["#","Player","R1","R2","R3","Finals","Clash Pts"].map(h=>(
                <th key={h} className="cond" style={{padding:"9px 12px",textAlign:h==="Player"?"left":"center",fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p,i)=>{
              const rp=p.entry?.roundPlacements||{};
              const clashPts=p.entry?.clashPts||p.entry?.pts||0;
              return(
                <tr key={p.id} style={{background:i===0?"rgba(232,168,56,.04)":i%2===0?"rgba(255,255,255,.01)":"transparent",borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                  <td className="mono" style={{padding:"11px 12px",textAlign:"center",fontSize:13,fontWeight:800,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF"}}>{i+1}</td>
                  <td style={{padding:"11px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{p.name}</span>
                      {p.name===mostImproved&&<Tag color="#52C47C" size="sm">📈 Improved</Tag>}
                    </div>
                  </td>
                  {["r1","r2","r3","finals"].map(rk=>{
                    const v=rp[rk];
                    return(
                      <td key={rk} style={{padding:"11px 8px",textAlign:"center"}}>
                        {v?<span className="mono" style={{fontSize:13,fontWeight:700,color:v===1?"#E8A838":v<=4?"#4ECDC4":"#F87171"}}>#{v}</span>:<span style={{color:"#9AAABF",fontSize:12}}>-</span>}
                      </td>
                    );
                  })}
                  <td style={{padding:"11px 12px",textAlign:"center"}}>
                    <span className="mono" style={{fontSize:14,fontWeight:700,color:"#E8A838"}}>+{clashPts}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Awards row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {mostImproved&&(
          <Panel style={{padding:"14px",border:"1px solid rgba(82,196,124,.25)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>📈</span>
              <div><div style={{fontWeight:700,fontSize:14,color:"#6EE7B7"}}>Most Improved</div>
              <div style={{fontWeight:700,color:"#F2EDE4",fontSize:13}}>{mostImproved}</div>
              <div style={{fontSize:11,color:"#BECBD9"}}>Above their season average</div></div>
            </div>
          </Panel>
        )}
        {biggestUpset&&(
          <Panel style={{padding:"14px",border:"1px solid rgba(155,114,207,.25)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>🎯</span>
              <div><div style={{fontWeight:700,fontSize:14,color:"#C4B5FD"}}>Biggest Upset</div>
              <div style={{fontWeight:700,color:"#F2EDE4",fontSize:13,lineHeight:1.4}}>{biggestUpset}</div></div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

// ─── RESULTS SCREEN ───────────────────────────────────────────────────────────
function ResultsScreen({players,toast,setScreen,setProfilePlayer}){
  const sorted=[...players].sort((a,b)=>b.pts-a.pts);
  const champ=sorted[0];
  const [tab,setTab]=useState("results");
  const awards=computeClashAwards(players.length>0?players:sorted);
  const CLASH_NAME="Clash #14";
  const CLASH_DATE="Mar 8 2026";
  const MEDALS=["🥇","🥈","🥉"];
  const PODIUM_COLS=["#E8A838","#C0C0C0","#CD7F32"];

  if(!champ)return<div className="page wrap" style={{textAlign:"center",color:"#BECBD9",paddingTop:60}}>Complete a clash first!</div>;

  const top3=[sorted[1],sorted[0],sorted[2]].filter(Boolean);
  const REWARDS=["👑 Clash Crown","🖼 Icon","🎨 Frame","📦 Loot Orb","📦 Loot Orb","","",""];

  function shareDiscord(){
    const lines=[
      "**🏆 TFT Clash S16 — "+CLASH_NAME+" Results**",
      "```",
      ...sorted.slice(0,8).map((p,i)=>"#"+(i+1)+" "+p.name.padEnd(16)+" "+String(p.pts).padStart(4)+"pts  avg "+computeStats(p).avgPlacement),
      "```",
      "👑 Champion: **"+champ.name+"**  🎉  "+champ.pts+"pts",
    ];
    navigator.clipboard?.writeText(lines.join("\n")).then(()=>toast("Copied for Discord ✓","success"));
  }

  function downloadCard(){
    const canvas=document.createElement("canvas");
    canvas.width=900;canvas.height=520;
    const ctx=canvas.getContext("2d");
    const bg=ctx.createLinearGradient(0,0,900,520);
    bg.addColorStop(0,"#0A0F1A");bg.addColorStop(1,"#08080F");
    ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
    const gold=ctx.createLinearGradient(0,0,900,0);
    gold.addColorStop(0,"#E8A838");gold.addColorStop(0.5,"#FFD700");gold.addColorStop(1,"#E8A838");
    ctx.fillStyle=gold;ctx.fillRect(0,0,900,3);
    ctx.font="bold 13px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="4px";
    ctx.fillText("TFT CLASH S16 — FINAL RESULTS",40,44);ctx.letterSpacing="0px";
    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";
    ctx.fillText(CLASH_DATE+"  ·  "+sorted.length+" players",40,64);
    ctx.fillStyle="rgba(232,168,56,0.1)";
    ctx.beginPath();ctx.roundRect(40,85,820,100,8);ctx.fill();
    ctx.strokeStyle="rgba(232,168,56,0.4)";ctx.lineWidth=1;ctx.stroke();
    ctx.font="bold 40px serif";ctx.fillStyle="#E8A838";ctx.fillText("👑",55,152);
    ctx.font="bold 28px serif";ctx.fillStyle="#F2EDE4";ctx.fillText(champ.name,110,150);
    ctx.font="bold 22px monospace";ctx.fillStyle="#E8A838";ctx.fillText(champ.pts+" pts",110,174);
    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";ctx.fillText("Champion · AVP: "+computeStats(champ).avgPlacement,110,194);
    sorted.slice(0,8).forEach((p,i)=>{
      const x=40+(i>3?440:0);const iy=i>3?i-4:i;
      const c2=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#BECBD9";
      ctx.font="bold 14px monospace";ctx.fillStyle=c2;ctx.fillText("#"+(i+1),x,210+iy*36);
      ctx.font="14px sans-serif";ctx.fillStyle=i<3?"#F2EDE4":"#C8D4E0";ctx.fillText(p.name,x+36,210+iy*36);
      ctx.font="bold 14px monospace";ctx.fillStyle="#E8A838";ctx.fillText(p.pts+"pts",x+200,210+iy*36);
      const av=computeStats(p).avgPlacement;
      ctx.font="12px monospace";ctx.fillStyle=parseFloat(av)<3?"#4ade80":parseFloat(av)<5?"#facc15":"#f87171";
      ctx.fillText("avg:"+av,x+280,210+iy*36);
    });
    ctx.fillStyle="rgba(232,168,56,0.15)";ctx.fillRect(0,488,900,32);
    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";
    ctx.fillText("TFT CLASH  ·  tftclash.gg",40,508);ctx.letterSpacing="0px";
    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";ctx.fillText("#TFTClash  #TFT",700,508);
    const a=document.createElement("a");a.download="TFTClash-Results.png";a.href=canvas.toDataURL("image/png");a.click();
    toast("Results card downloaded ✓","success");
  }

  return(
    <div className="page wrap">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <div style={{flex:1,minWidth:0}}>
          <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".18em",textTransform:"uppercase",marginBottom:2}}>Season 16</div>
          <h1 style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(22px,3.5vw,34px)",fontWeight:900,color:"#F2EDE4",lineHeight:1}}>{CLASH_NAME} — Final Results</h1>
          <div style={{fontSize:12,color:"#BECBD9",marginTop:3}}>{CLASH_DATE} · {sorted.length} players · {Math.ceil(sorted.length/8)} lobbies</div>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <Btn v="dark" s="sm" onClick={shareDiscord}>Discord</Btn>
          <Btn v="ghost" s="sm" onClick={downloadCard}>⬇ PNG</Btn>
        </div>
      </div>

      {/* Champion banner */}
      <div style={{background:"linear-gradient(135deg,rgba(232,168,56,.14),rgba(155,114,207,.06))",border:"1px solid rgba(232,168,56,.35)",borderRadius:18,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#E8A838,#FFD700,#E8A838)"}}/>
        <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,rgba(232,168,56,.3),rgba(232,168,56,.08))",border:"2px solid rgba(232,168,56,.6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:"#E8A838",fontFamily:"'Cinzel',serif",flexShrink:0}}>
          {champ.name.charAt(0)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".16em",textTransform:"uppercase",marginBottom:4}}>👑 Clash Champion</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(26px,4vw,44px)",fontWeight:900,color:"#F2EDE4",lineHeight:1,marginBottom:6}}>{champ.name}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Tag color="#E8A838" size="sm">{champ.rank}</Tag>
            <Tag color="#4ECDC4" size="sm">{champ.region}</Tag>
            {isHotStreak(champ)&&<Tag color="#F97316" size="sm">🔥 {champ.currentStreak}-streak</Tag>}
          </div>
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[["Season Pts",champ.pts,"#E8A838"],["Wins",champ.wins,"#6EE7B7"],["Avg",computeStats(champ).avgPlacement,avgCol(computeStats(champ).avgPlacement)],["Top4%",computeStats(champ).top4Rate+"%","#C4B5FD"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center",padding:"10px 16px",background:"rgba(0,0,0,.3)",borderRadius:10,minWidth:64}}>
              <div className="mono" style={{fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{fontSize:10,color:"#BECBD9",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Podium — top 3 */}
      {sorted.length>=3&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1.1fr 1fr",gap:10,marginBottom:24,alignItems:"end"}}>
          {top3.map((p,idx)=>{
            const actualRank=idx===0?1:idx===1?0:2;
            const col=PODIUM_COLS[actualRank];
            const isGold=actualRank===0;
            const height=isGold?1:actualRank===0?0.88:0.76;
            return(
              <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                style={{background:isGold?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",border:"1px solid "+(isGold?"rgba(232,168,56,.3)":"rgba(255,255,255,.07)"),borderRadius:14,padding:"20px 14px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+col,paddingTop:isGold?28:20}}>
                <div style={{fontSize:28,marginBottom:8}}>{MEDALS[actualRank]}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:isGold?17:14,fontWeight:700,color:"#F2EDE4",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:10}}>{p.rank} · {p.region}</div>
                <div className="mono" style={{fontSize:isGold?28:20,fontWeight:800,color:col,lineHeight:1}}>{p.pts}</div>
                <div style={{fontSize:9,color:"#BECBD9",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginTop:3}}>Season Pts</div>
                <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:10}}>
                  {[["W",computeStats(p).wins,"#6EE7B7"],["Avg",computeStats(p).avgPlacement,avgCol(computeStats(p).avgPlacement)]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div className="mono" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                      <div style={{fontSize:9,color:"#9AAABF",textTransform:"uppercase"}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab nav */}
      <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",paddingBottom:2}}>
        {[["results","Full Standings"],["awards","Awards"],["report","Clash Report"]].map(([id,label])=>(
          <Btn key={id} v={tab===id?"primary":"dark"} s="sm" onClick={()=>setTab(id)} style={{flexShrink:0}}>{label}</Btn>
        ))}
      </div>

      {/* Full Standings */}
      {tab==="results"&&(
        <Panel style={{overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"36px 1fr 80px 80px 70px 80px 110px",padding:"10px 16px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(242,237,228,.08)"}}>
            {["#","Player","Pts","Avg","Wins","T4%","Reward"].map(h=>(
              <span key={h} className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase"}}>{h}</span>
            ))}
          </div>
          {sorted.map((p,i)=>{
            const st=computeStats(p);
            const isTop3=i<3;
            const col=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#BECBD9";
            return(
              <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                style={{display:"grid",gridTemplateColumns:"36px 1fr 80px 80px 70px 80px 110px",padding:"12px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",alignItems:"center",background:i===0?"rgba(232,168,56,.05)":i<3?"rgba(255,255,255,.015)":"transparent",cursor:"pointer",transition:"background .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background=i===0?"rgba(232,168,56,.09)":"rgba(255,255,255,.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=i===0?"rgba(232,168,56,.05)":i<3?"rgba(255,255,255,.015)":"transparent"}>
                <div style={{display:"flex",alignItems:"center",gap:3}}>
                  <span className="mono" style={{fontSize:13,fontWeight:800,color:col}}>{i+1}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:isTop3?700:600,fontSize:13,color:isTop3?"#F2EDE4":"#C8BFB0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
                      {p.name}
                      {HOMIES_IDS.includes(p.id)&&<span style={{fontSize:10}}>💜</span>}
                      {isHotStreak(p)&&<span style={{fontSize:10}}>🔥</span>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#BECBD9"}}>{p.rank} · {p.region}</span>
                      {(p.attendanceStreak||0)>=3&&<Tag color="#E8A838" size="sm">{p.attendanceStreak}-streak</Tag>}
                      {isComebackEligible(p,PAST_CLASHES.map(function(c){return "c"+c.id;}))&&<Tag color="#4ECDC4" size="sm">Comeback</Tag>}
                    </div>
                  </div>
                </div>
                <div className="mono" style={{fontSize:15,fontWeight:700,color:isTop3?col:"#C8BFB0"}}>{p.pts}</div>
                <AvgBadge avg={parseFloat(p.avg)||0}/>
                <div className="mono" style={{fontSize:13,color:"#6EE7B7"}}>{st.wins}</div>
                <div className="mono" style={{fontSize:13,color:"#4ECDC4"}}>{st.top4Rate}%</div>
                <div style={{fontSize:12}}>{REWARDS[i]?<Tag color={col} size="sm">{REWARDS[i]}</Tag>:<span style={{color:"#9AAABF"}}>—</span>}</div>
              </div>
            );
          })}
        </Panel>
      )}

      {/* Awards */}
      {tab==="awards"&&(
        <div>
          <div className="grid-2" style={{marginBottom:20}}>
            {awards.filter(a=>a.winner).map(a=>(
              <AwardCard key={a.id} award={a} onClick={()=>{if(setProfilePlayer&&a.winner){setProfilePlayer(a.winner);setScreen("profile");}}}/>
            ))}
          </div>
          <AICommentaryPanel players={players} toast={toast}/>
          <div style={{marginTop:16,padding:"16px 20px",background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:12,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <span style={{fontSize:24}}>🎁</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"#C4B5FD",marginBottom:3}}>Milestone Rewards Unlocked</div>
              <div style={{fontSize:13,color:"#C8D4E0"}}>Some players earned new milestones this clash.</div>
            </div>
            <Btn v="purple" s="sm" onClick={()=>setScreen("milestones")}>View →</Btn>
          </div>
        </div>
      )}

      {/* Clash Report */}
      {tab==="report"&&(
        <Panel style={{padding:"20px"}}>
          <h3 style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#F2EDE4",marginBottom:4}}>{CLASH_NAME} — Round by Round</h3>
          <p style={{fontSize:13,color:"#BECBD9",marginBottom:20}}>{CLASH_DATE} · {sorted.length} players</p>
          <ClashReport clashData={{id:"latest",name:CLASH_NAME,date:CLASH_DATE,season:"S16",champion:champ.name,top3:sorted.slice(0,3).map(p=>p.name),players:sorted.length,lobbies:Math.ceil(sorted.length/8),report:{mostImproved:sorted[3]?.name,biggestUpset:(sorted[4]?.name||"")+" beat "+(sorted[0]?.name||"")}}} players={players}/>
        </Panel>
      )}
    </div>
  );
}


function AutoLogin({setAuthScreen}){
  useEffect(()=>{setAuthScreen("login");},[]);
  return null;
}

// ─── HALL OF FAME ─────────────────────────────────────────────────────────────
function HofScreen({players,setScreen,setProfilePlayer}){
  const [expandRecord,setExpandRecord]=useState(null);
  const allP=players.length>0?players:SEED;
  const sorted=[...allP].sort((a,b)=>b.pts-a.pts);
  const king=sorted[0];
  const kingStats=king?computeStats(king):null;
  const challengers=sorted.slice(1,4);
  const kingGap=challengers[0]?king.pts-challengers[0].pts:0;

  function openProfile(name){
    const p=allP.find(pl=>pl.name===name);
    if(p){setProfilePlayer(p);setScreen("profile");}
  }

  const SEASON_CHAMPS=[
    {season:"S14",champion:"xQc_TFT",pts:1240,rank:"Challenger",wins:18,status:"past"},
    {season:"S15",champion:"Dishsoap",pts:924,rank:"Challenger",wins:14,status:"past"},
    {season:"S16",champion:king?king.name:"TBD",pts:king?king.pts:0,rank:king?king.rank:"",wins:king?king.wins:0,status:"active"},
  ];

  return(
    <div className="page wrap">

      {/* Page header */}
      <div style={{textAlign:"center",position:"relative",overflow:"hidden",paddingBottom:28,marginBottom:28}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center,rgba(232,168,56,.06),transparent 70%)",pointerEvents:"none"}}/>
        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".3em",textTransform:"uppercase",marginBottom:10}}>TFT Clash · Season 16</div>
        <h1 style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(36px,7vw,72px)",fontWeight:900,color:"#F2EDE4",lineHeight:.88,marginBottom:14,letterSpacing:"-.02em"}}>
          Hall of<br/><span style={{color:"#E8A838",textShadow:"0 0 60px rgba(232,168,56,.45),0 0 120px rgba(232,168,56,.15)"}}>Fame</span>
        </h1>
        <p style={{fontSize:14,color:"#C8D4E0",maxWidth:440,margin:"0 auto",lineHeight:1.65}}>These records are permanent. Every name here earned their place.</p>
        <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(232,168,56,.35),transparent)",marginTop:24}}/>
        <div
          title="GOLDENGOD was here"
          style={{position:"absolute",bottom:8,right:14,fontSize:15,opacity:.07,cursor:"default",userSelect:"none",transition:"opacity .35s,filter .35s",filter:"drop-shadow(0 0 0px #E8A838)"}}
          onMouseEnter={function(e){e.currentTarget.style.opacity=".95";e.currentTarget.style.filter="drop-shadow(0 0 10px #E8A838)";}}
          onMouseLeave={function(e){e.currentTarget.style.opacity=".07";e.currentTarget.style.filter="drop-shadow(0 0 0px #E8A838)";}}>🐪</div>
      </div>

      {/* Reigning champion hero */}
      {king&&kingStats&&(
        <div style={{position:"relative",overflow:"hidden",borderRadius:20,marginBottom:32,border:"1px solid rgba(232,168,56,.4)",background:"linear-gradient(135deg,#0E1018,#16100A,#08080F)",boxShadow:"0 0 80px rgba(232,168,56,.07)"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 120% at 15% 50%,rgba(232,168,56,.07),transparent)",pointerEvents:"none"}}/>
          <div style={{position:"relative",padding:"clamp(20px,4vw,36px) clamp(20px,4vw,40px)",display:"flex",alignItems:"flex-start",gap:"clamp(16px,3vw,40px)",flexWrap:"wrap"}}>

            {/* Identity */}
            <div style={{textAlign:"center",flexShrink:0,minWidth:120}}>
              <div style={{fontSize:"clamp(32px,5vw,52px)",marginBottom:10,animation:"crown-glow 2.5s infinite"}}>👑</div>
              <div style={{width:"clamp(64px,9vw,88px)",height:"clamp(64px,9vw,88px)",borderRadius:"50%",background:"linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.04))",border:"2px solid #E8A838",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(24px,4vw,36px)",fontWeight:900,fontFamily:"'Cinzel',serif",color:"#E8A838",margin:"0 auto 12px",boxShadow:"0 0 32px rgba(232,168,56,.25)"}}>
                {king.name.charAt(0)}
              </div>
              <div className="cond" style={{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".2em",textTransform:"uppercase",marginBottom:5}}>Season 16 Leader</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(15px,2.5vw,22px)",fontWeight:900,color:"#F2EDE4",textShadow:"0 0 20px rgba(232,168,56,.25)",lineHeight:1.1,marginBottom:8}}>{king.name}</div>
              <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap",marginBottom:10}}>
                <Tag color={rc(king.rank)}>{king.rank}</Tag>
                <Tag color="#4ECDC4">{king.region}</Tag>
              </div>
              <Btn v="ghost" s="sm" onClick={()=>openProfile(king.name)}>Profile &rarr;</Btn>
            </div>

            {/* Stats */}
            <div style={{flex:1,minWidth:200}}>
              <div style={{marginBottom:14}}>
                <div className="mono" style={{fontSize:"clamp(44px,8vw,80px)",fontWeight:700,color:"#E8A838",lineHeight:1,textShadow:"0 0 48px rgba(232,168,56,.3)"}}>{king.pts}</div>
                <div className="cond" style={{fontSize:11,fontWeight:700,color:"#BECBD9",letterSpacing:".16em",textTransform:"uppercase",marginTop:2}}>Season Points</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                {[["Avg",kingStats.avgPlacement,avgCol(kingStats.avgPlacement)],["Win Rate",kingStats.top1Rate+"%","#6EE7B7"],["Top 4",kingStats.top4Rate+"%","#C4B5FD"],["PPG",kingStats.ppg,"#EAB308"],["Streak",king.bestStreak+" W","#F97316"],["Clutch",kingStats.clutchRate+"%","#9B72CF"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"rgba(0,0,0,.3)",border:"1px solid rgba(232,168,56,.1)",borderRadius:9,padding:"10px 8px",textAlign:"center"}}>
                    <div className="mono" style={{fontSize:"clamp(13px,2vw,17px)",fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                    <div style={{fontSize:9,color:"#9AAABF",marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(0,0,0,.3)",border:"1px solid rgba(242,237,228,.07)",borderRadius:8,padding:"10px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,color:"#C8D4E0"}}>Lead over {challengers[0]?challengers[0].name:"2nd place"}</span>
                  <span className="mono" style={{fontSize:14,fontWeight:700,color:kingGap>50?"#6EE7B7":kingGap>20?"#EAB308":"#F87171"}}>+{kingGap} pts</span>
                </div>
                <Bar val={king.pts} max={king.pts+Math.max(kingGap,1)} color={kingGap>50?"#6EE7B7":kingGap>20?"#EAB308":"#F87171"} h={4}/>
              </div>
            </div>

            {/* Challengers */}
            <div style={{flexShrink:0,minWidth:150}}>
              <div className="cond" style={{fontSize:9,fontWeight:700,color:"#BECBD9",letterSpacing:".16em",textTransform:"uppercase",marginBottom:12,textAlign:"center"}}>Challengers</div>
              {challengers.map((p,i)=>{
                const diff=king.pts-p.pts;
                const medals=["Silver","Bronze","4th"];
                const medalCols=["#C0C0C0","#CD7F32","#9AAABF"];
                return(
                  <div key={p.id} onClick={()=>openProfile(p.name)}
                    style={{padding:"10px 12px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.07)",borderRadius:10,marginBottom:8,cursor:"pointer",transition:"border-color .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(232,168,56,.3)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(242,237,228,.07)"}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                      <span className="mono" style={{fontSize:11,fontWeight:700,color:medalCols[i],flexShrink:0}}>{i+2}</span>
                      <span style={{fontWeight:600,fontSize:13,color:"#F2EDE4",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                      <span className="mono" style={{fontSize:12,fontWeight:700,color:"#E8A838",flexShrink:0}}>{p.pts}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,color:"#F87171",flexShrink:0,minWidth:32}}>-{diff}</span>
                      <Bar val={p.pts} max={king.pts} color="#4ECDC4" h={3}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Season Champions Wall */}
      <div style={{marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:24,height:2,background:"#E8A838",borderRadius:2,flexShrink:0}}/>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(14px,2vw,20px)",color:"#F2EDE4",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Season Champions</h2>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(232,168,56,.3),transparent)"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
          {SEASON_CHAMPS.map((s)=>{
            const isActive=s.status==="active";
            return(
              <div key={s.season} onClick={()=>{if(!isActive)openProfile(s.champion);}}
                style={{position:"relative",overflow:"hidden",borderRadius:14,
                  background:isActive?"linear-gradient(135deg,#16100A,#0E0C06)":"linear-gradient(135deg,#0D1019,#080B12)",
                  border:"1px solid "+(isActive?"rgba(232,168,56,.5)":"rgba(242,237,228,.09)"),
                  padding:"20px 16px",cursor:isActive?"default":"pointer",transition:"transform .2s",
                  boxShadow:isActive?"0 0 40px rgba(232,168,56,.09)":"none"}}
                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.transform="translateY(-3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}}>
                {isActive&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#E8A838,transparent)"}}/>}
                {!isActive&&<div style={{position:"absolute",top:10,right:10,fontSize:9,color:"#9AAABF",background:"rgba(255,255,255,.04)",borderRadius:4,padding:"2px 6px",fontWeight:600,letterSpacing:".05em"}}>RETIRED</div>}
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                  <div style={{background:isActive?"rgba(232,168,56,.15)":"rgba(255,255,255,.05)",border:"1px solid "+(isActive?"rgba(232,168,56,.35)":"rgba(242,237,228,.1)"),borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,color:isActive?"#E8A838":"#BECBD9",fontFamily:"'JetBrains Mono',monospace"}}>{s.season}</div>
                  {isActive&&<div style={{background:"rgba(82,196,124,.1)",border:"1px solid rgba(82,196,124,.25)",borderRadius:10,padding:"2px 7px",fontSize:9,fontWeight:700,color:"#6EE7B7",letterSpacing:".06em"}}>LIVE</div>}
                </div>
                <div style={{fontSize:"clamp(22px,4vw,32px)",marginBottom:8}}>{isActive?"👑":"🏆"}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(14px,2vw,18px)",fontWeight:700,color:isActive?"#E8A838":"#F2EDE4",lineHeight:1.2,marginBottom:5}}>{s.champion}</div>
                <div className="mono" style={{fontSize:"clamp(16px,2.5vw,22px)",fontWeight:700,color:isActive?"#E8A838":"#C8BFB0",marginBottom:3}}>{s.pts}<span style={{fontSize:11,color:"#9AAABF",fontWeight:400}}> pts</span></div>
                <div style={{fontSize:11,color:"#9AAABF"}}>{s.wins} wins</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trophy Cabinet */}
      <div style={{marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:24,height:2,background:"#E8A838",borderRadius:2,flexShrink:0}}/>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(14px,2vw,20px)",color:"#F2EDE4",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Trophy Cabinet</h2>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(232,168,56,.3),transparent)"}}/>
        </div>
        <div className="grid-2">
          {HOF_RECORDS.map(r=>{
            const isOpen=expandRecord===r.id;
            return(
              <div key={r.id} onClick={()=>setExpandRecord(isOpen?null:r.id)}
                style={{background:"linear-gradient(135deg,#0D1321,#080B14)",border:"1px solid "+(isOpen?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),borderRadius:14,overflow:"hidden",cursor:"pointer",transition:"border-color .2s,box-shadow .2s",boxShadow:isOpen?"0 0 32px rgba(232,168,56,.07)":"none"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=isOpen?"rgba(232,168,56,.4)":"rgba(232,168,56,.2)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=isOpen?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"}>
                <div style={{background:"linear-gradient(90deg,rgba(232,168,56,.08),rgba(232,168,56,.02))",padding:"16px 18px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(232,168,56,.1)"}}>
                  <div style={{width:46,height:46,borderRadius:10,background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{r.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#BECBD9",letterSpacing:".12em",textTransform:"uppercase",marginBottom:3}}>{r.title}</div>
                    <div className="mono" style={{fontSize:"clamp(18px,3vw,28px)",fontWeight:700,color:"#E8A838",lineHeight:1}}>{r.value}</div>
                  </div>
                  <div style={{fontSize:11,color:"#9AAABF",flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none"}}>&#9660;</div>
                </div>
                <div style={{padding:"12px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#E8A838",flexShrink:0}}>{r.holder.charAt(0)}</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{r.holder}</div>
                        <Tag color={rc(r.rank)} size="sm">{r.rank}</Tag>
                      </div>
                    </div>
                    <button onClick={e=>{e.stopPropagation();openProfile(r.holder);}}
                      style={{background:"none",border:"1px solid rgba(242,237,228,.1)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#C8BFB0",cursor:"pointer",fontFamily:"inherit",fontWeight:600,flexShrink:0}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(232,168,56,.3)"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(242,237,228,.1)"}>Profile</button>
                  </div>
                  {(r.runner||[]).map((ru,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#BECBD9",marginTop:4}}>
                      <span style={{color:i===0?"#C0C0C0":"#CD7F32",fontWeight:700,minWidth:28}}>{i===0?"2nd":"3rd"}</span>
                      <span>{ru}</span>
                    </div>
                  ))}
                </div>
                {isOpen&&r.history.length>0&&(
                  <div style={{padding:"0 18px 14px",borderTop:"1px solid rgba(232,168,56,.12)"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:8,marginTop:12}}>Previous Holders</div>
                    {r.history.map((h,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"rgba(0,0,0,.3)",borderRadius:7,marginBottom:4}}>
                        <span className="mono" style={{fontSize:10,color:"#9B72CF",minWidth:28}}>{h.season}</span>
                        <span style={{fontWeight:600,fontSize:13,color:"#C8BFB0",flex:1}}>{h.holder}</span>
                        <span className="mono" style={{fontSize:12,color:"#E8A838"}}>{h.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Rivalries */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:18,height:2,background:"#9B72CF",borderRadius:2,flexShrink:0}}/>
          <h3 style={{fontFamily:"'Cinzel',serif",fontSize:15,color:"#F2EDE4",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase"}}>Top Rivalries</h3>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
          {[["Dishsoap","k3soju",14,12],["Robinsongz","Setsuko",11,10],["Wrainbash","Frodan",9,9],["Mortdog","BunnyMuffins",7,8]].map(function(arr,i){
            var a=arr[0],b=arr[1],wa=arr[2],wb=arr[3];
            var total=wa+wb;
            return(
              <div key={i} style={{background:"linear-gradient(135deg,#0D1321,#080B14)",border:"1px solid rgba(155,114,207,.15)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{flex:1,textAlign:"right"}}>
                    <div style={{fontWeight:700,fontSize:14,color:wa>=wb?"#F2EDE4":"#BECBD9"}}>{a}</div>
                    <div className="mono" style={{fontSize:13,color:"#E8A838",fontWeight:700}}>{wa}W</div>
                  </div>
                  <div style={{padding:"5px 10px",background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.2)",borderRadius:6,fontSize:11,fontWeight:700,color:"#9B72CF",flexShrink:0}}>VS</div>
                  <div style={{flex:1,textAlign:"left"}}>
                    <div style={{fontWeight:700,fontSize:14,color:wb>wa?"#F2EDE4":"#BECBD9"}}>{b}</div>
                    <div className="mono" style={{fontSize:13,color:"#4ECDC4",fontWeight:700}}>{wb}W</div>
                  </div>
                </div>
                <div style={{display:"flex",height:5,borderRadius:99,overflow:"hidden"}}>
                  <div style={{width:(wa/total*100)+"%",background:"#E8A838",transition:"width .3s"}}/>
                  <div style={{flex:1,background:"#4ECDC4"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:10,color:"#9AAABF"}}>
                  <span>{Math.round(wa/total*100)}%</span>
                  <span>{total} games</span>
                  <span>{Math.round(wb/total*100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
// ─── ARCHIVE ──────────────────────────────────────────────────────────────────
function ArchiveScreen({players,currentUser,setScreen}){
  const [open,setOpen]=useState(null);
  const all=[...PAST_CLASHES,
    {id:9,name:"Clash #9",date:"Feb 1 2026",season:"S16",champion:"Wrainbash",top3:["Wrainbash","Setsuko","Levitate"],players:24,lobbies:3,report:null},
    {id:8,name:"Clash #8",date:"Jan 25 2026",season:"S16",champion:"BunnyMuffins",top3:["BunnyMuffins","Mortdog","Frodan"],players:24,lobbies:3,report:null},
    {id:7,name:"Season 15 Grand Finals",date:"Jan 15 2026",season:"S15",champion:"k3soju",top3:["k3soju","Dishsoap","Robinsongz"],players:24,lobbies:3,report:null},
  ];

  // Simulated positions for currentUser across events
  const myPositions={13:6,12:4,11:8,10:3,9:12,8:18,7:2};

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <div style={{flex:1}}>
          <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:4}}>Archive</h2>
          <p style={{color:"#BECBD9",fontSize:13}}>{all.length} events · 2 seasons</p>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {all.map(c=>{
          const myPos=currentUser?myPositions[c.id]:null;
          return(
            <Panel key={c.id} style={{overflow:"hidden"}}>
              <div style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",background:"#0A0F1A"}} onClick={()=>setOpen(open===c.id?null:c.id)}>
                <div style={{width:34,height:34,background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#E8A838",flexShrink:0}}>#{c.id}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{c.name}</div>
                  <div className="cond" style={{fontSize:11,color:"#BECBD9",marginTop:2}}>{c.date} · {c.season} · {c.players}p · {c.lobbies} {c.lobbies===1?"lobby":"lobbies"}</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <span style={{fontSize:14}}>🏆</span><span style={{fontWeight:700,color:"#E8A838",fontSize:13}}>{c.champion}</span>
                  <span style={{color:"#BECBD9",fontSize:14,marginLeft:6}}>{open===c.id?"▲":"▼"}</span>
                </div>
              </div>
              {open===c.id&&(
                <div style={{padding:"14px 16px",background:"#0D121E",borderTop:"1px solid rgba(242,237,228,.07)"}}>
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#C8D4E0",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Top 8 Finishers</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6}}>
                      {c.top3.map((name,i)=>(
                        <div key={i} style={{background:"rgba(232,168,56,.05)",border:"1px solid rgba(232,168,56,.15)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                          <div style={{fontSize:16,marginBottom:4}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"🏅"}</div>
                          <div style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>{name}</div>
                          <div style={{fontSize:10,color:"#BECBD9",marginTop:2}}>#{i+1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {c.report&&(
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
                      {c.report.mostImproved&&<div style={{background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.2)",borderRadius:8,padding:"8px 12px",fontSize:12}}><span style={{color:"#4ECDC4",fontWeight:700}}>📈 Most Improved:</span> <span style={{color:"#F2EDE4"}}>{c.report.mostImproved}</span></div>}
                      {c.report.biggestUpset&&<div style={{background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.2)",borderRadius:8,padding:"8px 12px",fontSize:12}}><span style={{color:"#F87171",fontWeight:700}}>⚡ Upset:</span> <span style={{color:"#F2EDE4"}}>{c.report.biggestUpset}</span></div>}
                    </div>
                  )}
                  {/* My position */}
                  {myPos&&(
                    <div style={{background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.25)",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(155,114,207,.15)",border:"1px solid rgba(155,114,207,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#9B72CF"}}>#{myPos}</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"#C4B5FD"}}>Your Position</div>
                        <div style={{fontSize:12,color:"#C8D4E0"}}>{currentUser.username} finished #{myPos} in this event</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}



function AdminPanel({players,setPlayers,toast,setAnnouncement,setScreen,tournamentState,setTournamentState,seasonConfig,setSeasonConfig,quickClashes,setQuickClashes,orgSponsors,setOrgSponsors}){
  const [tab,setTab]=useState("dashboard");
  const [editP,setEditP]=useState(null);
  const [noteTarget,setNoteTarget]=useState(null);
  const [noteText,setNoteText]=useState("");
  const [auditLog,setAuditLog]=useState([
    {ts:Date.now()-3600000,type:"INFO",msg:"Admin session started"},
    {ts:Date.now()-7200000,type:"ACTION",msg:"Check In All - 8 players"},
    {ts:Date.now()-86400000,type:"RESULT",msg:"Clash #13 complete - Champion: Dishsoap"},
  ]);
  const [broadMsg,setBroadMsg]=useState("");
  const [broadType,setBroadType]=useState("NOTICE");
  const [announcements,setAnnouncements]=useState([{id:1,type:"NOTICE",msg:"Clash #14 this Saturday 8PM EST!",ts:Date.now()}]);
  const [scheduledEvents,setScheduledEvents]=useState([
    {id:1,name:"Clash #14",type:"SCHEDULED",date:"2026-03-08",time:"20:00",cap:8,format:"Swiss",status:"upcoming"},
    {id:2,name:"Flash Clash",type:"FLASH",date:"2026-03-06",time:"18:00",cap:8,format:"Single",status:"upcoming"},
  ]);
  const [newEvent,setNewEvent]=useState({name:"",type:"SCHEDULED",date:"",time:"",cap:"8",format:"Swiss",notes:""});
  const [seedAlgo,setSeedAlgo]=useState("rank-based");
  const [paused,setPaused]=useState(false);
  const [scoreEdit,setScoreEdit]=useState({});
  const [seasonName,setSeasonName]=useState("Season 16");

  function addAudit(type,msg){setAuditLog(l=>[{ts:Date.now(),type,msg},...l.slice(0,199)]);}
  function ban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:true,checkedIn:false}:p));addAudit("WARN","Banned: "+name);toast(name+" banned","success");}
  function unban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:false,dnpCount:0}:p));addAudit("ACTION","Unbanned: "+name);toast(name+" unbanned","success");}
  function markDNP(id,name){
    setPlayers(ps=>ps.map(p=>{
      if(p.id!==id)return p;
      var newCount=(p.dnpCount||0)+1;
      var isDQ=newCount>=2;
      addAudit("WARN","DNP #"+newCount+": "+name+(isDQ?" → AUTO-DQ":""));
      if(isDQ)toast(name+" has 2 DNPs — DISQUALIFIED","error");
      else toast(name+" marked DNP ("+newCount+"/2 before DQ)","success");
      return{...p,dnpCount:newCount,banned:isDQ?true:p.banned,checkedIn:isDQ?false:p.checkedIn};
    }));
  }
  function clearDNP(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,dnpCount:0}:p));addAudit("ACTION","DNP cleared: "+name);toast("DNP cleared for "+name,"success");}
  function remove(id,name){setPlayers(ps=>ps.filter(p=>p.id!==id));addAudit("ACTION","Removed: "+name);toast(name+" removed","success");}
  function saveNote(){setPlayers(ps=>ps.map(p=>p.id===noteTarget.id?{...p,notes:noteText}:p));addAudit("ACTION","Note updated: "+noteTarget.name);setNoteTarget(null);}

  const AUDIT_COLS={INFO:"#4ECDC4",ACTION:"#52C47C",WARN:"#E8A838",RESULT:"#9B72CF",BROADCAST:"#E8A838",DANGER:"#F87171"};
  const EVENT_COLS={SCHEDULED:"#E8A838",FLASH:"#F87171",INVITATIONAL:"#9B72CF",WEEKLY:"#4ECDC4"};

  const [hostApps,setHostApps]=useState([
    {id:1,name:"ProGuides_TFT",org:"ProGuides",email:"host@proguides.com",reason:"We run weekly TFT content and want to host official clashes for our community of 50k+ subscribers.",freq:"weekly",status:"pending",submittedAt:"Mar 5 2026"},
    {id:2,name:"TFT_Academy",org:"TFT Academy",email:"admin@tftacademy.gg",reason:"Coaching platform, we'd like to run monthly invitational clashes for our students.",freq:"monthly",status:"pending",submittedAt:"Mar 3 2026"},
    {id:3,name:"Mortdog_Fan",org:"",email:"fan@gmail.com",reason:"I want to host for my friend group.",freq:"biweekly",status:"approved",submittedAt:"Feb 20 2026"},
  ]);

  const [flashForm,setFlashForm]=useState({name:"Flash Clash",cap:"8",rounds:"2",format:"Single Lobby"});
  const [qcPlacements,setQcPlacements]=useState({});
  const [roundConfig,setRoundConfig]=useState({maxPlayers:"24",roundCount:"3",checkinWindowMins:"30"});
  const [flashEvents,setFlashEvents]=useState([]);

  const TABS=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"players",icon:"👥",label:"Players"},
    {id:"scores",icon:"✏️",label:"Scores"},
    {id:"round",icon:"⚡",label:"Round"},
    {id:"quickclash",icon:"⚡",label:"Quick Clash"},
    {id:"schedule",icon:"📅",label:"Schedule"},
    {id:"season",icon:"🏆",label:"Season"},
    {id:"broadcast",icon:"📢",label:"Broadcast"},
    {id:"hosts",icon:"🎮",label:"Hosts"+(hostApps.filter(a=>a.status==="pending").length>0?" ●":"")},
    {id:"sponsorships",icon:"🏢",label:"Sponsorships"},
    {id:"audit",icon:"📋",label:"Audit"},
    {id:"settings",icon:"⚙️",label:"Settings"},
  ];

  return(
    <div className="page wrap">
      {noteTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>
          <Panel style={{width:"100%",maxWidth:380,padding:"22px"}}>
            <div style={{marginTop:6}}>
              <h3 style={{color:"#F2EDE4",fontSize:16,marginBottom:14}}>Note - {noteTarget.name}</h3>
              <Inp value={noteText} onChange={setNoteText} placeholder="e.g. known griefer, dispute history..." style={{marginBottom:14}}/>
              <div style={{display:"flex",gap:10}}>
                <Btn v="primary" full onClick={saveNote}>Save</Btn>
                <Btn v="dark" onClick={()=>setNoteTarget(null)}>Cancel</Btn>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        <div style={{width:38,height:38,background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⬡</div>
        <div><h2 style={{color:"#F2EDE4",fontSize:18}}>Admin Panel</h2><div style={{fontSize:11,color:"#BECBD9"}}>{seasonName}</div></div>
      </div>

      {/* Tab pills - scrollable on mobile */}
      <div style={{display:"flex",gap:4,flexWrap:"nowrap",overflowX:"auto",paddingBottom:4,marginBottom:18,scrollbarWidth:"none"}}>
        {TABS.map(t=>(
          <Btn key={t.id} v={tab===t.id?"primary":"dark"} s="sm" onClick={()=>setTab(t.id)} style={{flexShrink:0,gap:4}}>
            <span>{t.icon}</span><span className="hide-mobile-text">{t.label}</span>
          </Btn>
        ))}
      </div>

      {tab==="dashboard"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12,marginBottom:18}}>
            {[["Players",players.length,"#E8A838"],["In",players.filter(p=>p.checkedIn).length,"#6EE7B7"],["Banned",players.filter(p=>p.banned).length,"#F87171"],["Events",scheduledEvents.length,"#C4B5FD"]].map(([l,v,c])=>(
              <Panel key={l} style={{padding:"16px",textAlign:"center"}}>
                <div className="mono" style={{fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                <div className="cond" style={{fontSize:10,fontWeight:700,color:"#C8D4E0",marginTop:4,letterSpacing:".04em",textTransform:"uppercase"}}>{l}</div>
              </Panel>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            <Btn v="success" s="sm" onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,checkedIn:true})));addAudit("ACTION","Check In All");toast("All in","success");}}>✓ Check All</Btn>
            <Btn v="dark" s="sm" onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));addAudit("ACTION","Check Out All");toast("All out","success");}}>✗ Check Out</Btn>
            <Btn v={paused?"success":"danger"} s="sm" onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Round resumed":"Round paused");}}>{paused?"▶ Resume":"⏸ Pause"}</Btn>
          </div>
          <Panel style={{overflow:"hidden"}}>
            <div style={{padding:"11px 14px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",fontSize:13,fontWeight:700,color:"#F2EDE4"}}>Recent Activity</div>
            {auditLog.slice(0,8).map((l,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 14px",borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                <Tag color={AUDIT_COLS[l.type]||"#E8A838"} size="sm">{l.type}</Tag>
                <span style={{fontSize:13,color:"#C8BFB0",flex:1}}>{l.msg}</span>
                <span className="mono" style={{fontSize:10,color:"#9AAABF",whiteSpace:"nowrap",flexShrink:0}}>{new Date(l.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {tab==="players"&&(
        <div>
          {editP?(
            <Panel accent style={{padding:"20px",marginBottom:16}}>
              <div style={{marginTop:6}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                  <h3 style={{color:"#F2EDE4",fontSize:15}}>Edit: {editP.name}</h3>
                  <Btn v="dark" s="sm" onClick={()=>setEditP(null)}>← Back</Btn>
                </div>
                <div className="grid-2" style={{marginBottom:14}}>
                  {[["Display Name","name"],["Riot ID","riotId"],["Region","region"]].map(([l,k])=>(
                    <div key={k}><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</label>
                    <Inp value={editP[k]||""} onChange={v=>setEditP(e=>({...e,[k]:v}))} placeholder={l}/></div>
                  ))}
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Role</label>
                  <Sel value={editP.role||"player"} onChange={v=>setEditP(e=>({...e,role:v}))}>{["player","host","mod","admin"].map(r=><option key={r} value={r}>{r}</option>)}</Sel></div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <Btn v="primary" onClick={()=>{setPlayers(ps=>ps.map(p=>p.id===editP.id?editP:p));addAudit("ACTION","Edited: "+editP.name);setEditP(null);toast("Saved","success");}}>Save</Btn>
                  <Btn v="dark" onClick={()=>setEditP(null)}>Cancel</Btn>
                </div>
              </div>
            </Panel>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {players.map(p=>(
                <Panel key={p.id} style={{padding:"14px",background:p.banned?"rgba(127,29,29,.15)":"#111827"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:p.banned?"#F87171":"#F2EDE4",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                        {p.name}
                        {p.role!=="player"&&<Tag color="#9B72CF" size="sm">{p.role}</Tag>}
                        {p.banned&&<Tag color="#F87171" size="sm">{(p.dnpCount||0)>=2?"⛔ DQ":"BANNED"}</Tag>}
                        {!p.banned&&(p.dnpCount||0)>0&&<Tag color="#F97316" size="sm">DNP {p.dnpCount}/2</Tag>}
                        {p.checkedIn&&<Tag color="#52C47C" size="sm">✓ In</Tag>}
                        {isComebackEligible(p,PAST_CLASHES.map(function(c){return "c"+c.id;}))&&<Tag color="#4ECDC4" size="sm">Comeback Ready</Tag>}
                        {(p.attendanceStreak||0)>=3&&<Tag color="#E8A838" size="sm">{p.attendanceStreak}-streak</Tag>}
                      </div>
                      <div style={{fontSize:12,color:"#BECBD9",marginTop:2}}>{p.riotId} · <span className="mono" style={{color:"#E8A838"}}>{p.pts}pts</span></div>
                      {p.notes&&<div style={{fontSize:11,color:"#EAB308",marginTop:3}}>📌 {p.notes}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",flexShrink:0}}>
                      <Btn s="sm" v="dark" onClick={()=>setEditP(p)}>Edit</Btn>
                      <Btn s="sm" v="ghost" onClick={()=>{setNoteTarget(p);setNoteText(p.notes||"");}}>📌</Btn>
                      {!p.banned&&<Btn s="sm" v="warning" onClick={()=>markDNP(p.id,p.name)} title="Mark no-show — 2 DNPs = DQ">DNP</Btn>}
                      {(p.dnpCount||0)>0&&!p.banned&&<Btn s="sm" v="dark" onClick={()=>clearDNP(p.id,p.name)}>↩</Btn>}
                      {p.banned?<Btn s="sm" v="success" onClick={()=>unban(p.id,p.name)}>Unban</Btn>:<Btn s="sm" v="danger" onClick={()=>ban(p.id,p.name)}>Ban</Btn>}
                      <Btn s="sm" v="danger" onClick={()=>remove(p.id,p.name)}>✕</Btn>
                    </div>
                  </div>
                </Panel>
              ))}
              {players.length===0&&<div style={{textAlign:"center",padding:40,color:"#9AAABF",fontSize:14}}>No players</div>}
            </div>
          )}
        </div>
      )}

      {tab==="scores"&&(
        <div>
          <p style={{fontSize:13,color:"#C8D4E0",marginBottom:14}}>Override season points. All changes are logged.</p>
          <Panel style={{overflow:"hidden",marginBottom:14}}>
            {players.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                <span style={{fontWeight:600,fontSize:14,color:"#F2EDE4",flex:1}}>{p.name}</span>
                <span className="mono" style={{fontSize:13,color:"#BECBD9",minWidth:50}}>Now: <span style={{color:"#E8A838"}}>{p.pts}</span></span>
                <div style={{width:110,flexShrink:0}}>
                  <Inp value={scoreEdit[p.id]!==undefined?scoreEdit[p.id]:""} onChange={v=>setScoreEdit(e=>({...e,[p.id]:v}))} placeholder={String(p.pts)} type="number"/>
                </div>
              </div>
            ))}
          </Panel>
          <div style={{display:"flex",gap:10}}>
            <Btn v="primary" onClick={()=>{setPlayers(ps=>ps.map(p=>{const nv=scoreEdit[p.id];if(nv===undefined)return p;addAudit("DANGER","Score override: "+p.name+" → "+nv);return{...p,pts:parseInt(nv)||p.pts};}));setScoreEdit({});toast("Applied","success");}}>Apply Changes</Btn>
            <Btn v="dark" onClick={()=>setScoreEdit({})}>Clear</Btn>
          </div>
        </div>
      )}

      {tab==="round"&&(
        <div className="grid-2">
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Tournament Phase</h3>
            <div style={{marginBottom:12,padding:"10px 12px",background:"#0F1520",borderRadius:8,border:"1px solid rgba(242,237,228,.07)"}}>
              <div style={{fontSize:11,color:"#BECBD9",marginBottom:3,textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}}>Current Phase</div>
              <div style={{fontWeight:700,fontSize:14,color:{registration:"#9B72CF",checkin:"#E8A838",inprogress:"#52C47C",complete:"#4ECDC4"}[tournamentState?tournamentState.phase:"registration"]||"#9B72CF"}}>
                {{registration:"Registration Open",checkin:"Check-in Open",inprogress:"In Progress — Round "+(tournamentState?tournamentState.round:1),complete:"Complete"}[tournamentState?tournamentState.phase:"registration"]||"Registration"}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn v="primary" full disabled={tournamentState&&tournamentState.phase!=="registration"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"checkin"}));addAudit("ACTION","Check-in opened");toast("Check-in is now open!","success");}}>Open Check-in</Btn>
              <Btn v="success" full disabled={tournamentState&&tournamentState.phase!=="checkin"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"inprogress",round:1,lockedLobbies:[],clashId:"c"+Date.now(),seedAlgo:seedAlgo||"rank-based"}));addAudit("ACTION","Tournament started");toast("Tournament started! Bracket ready.","success");}}>Start Tournament</Btn>
              <Btn v="danger" full onClick={()=>{if(window.confirm("Reset tournament to registration?")){setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[]});addAudit("DANGER","Tournament reset");toast("Tournament reset","success");}}}>Reset Tournament</Btn>
            </div>
          </Panel>
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Round Controls</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn v={paused?"success":"danger"} full onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Resumed":"Paused");}}>
                {paused?"▶ Resume Round":"⏸ Pause Round"}
              </Btn>
              <Btn v="dark" full onClick={()=>{
                setTournamentState(function(ts){
                  if(!ts||ts.phase!=="inprogress") return ts;
                  var next=ts.round+1;
                  if(next>3) return Object.assign({},ts,{phase:"complete"});
                  return Object.assign({},ts,{round:next,lockedLobbies:[]});
                });
                addAudit("ACTION","Force advance");toast("Force advancing","success");
              }}>Force Advance →</Btn>
              <Btn v="purple" full onClick={()=>{setTournamentState(function(ts){return Object.assign({},ts,{lockedLobbies:[],seedAlgo:seedAlgo});});addAudit("ACTION","Reseeded - "+seedAlgo);toast("Lobbies reseeded","success");}}>Reseed Lobbies</Btn>
            </div>
          </Panel>
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Seeding Algorithm</h3>
            {[["random","🎲 Random"],["rank-based","📊 Rank-Based"],["anti-stack","🚫 Anti-Stack"],["snake","🐍 Snake Draft"]].map(([v,l])=>(
              <button key={v} onClick={()=>setSeedAlgo(v)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:seedAlgo===v?"rgba(232,168,56,.1)":"rgba(255,255,255,.02)",border:"1px solid "+(seedAlgo===v?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),borderRadius:8,padding:"11px 14px",color:seedAlgo===v?"#E8A838":"#C8BFB0",cursor:"pointer",fontSize:13,fontWeight:seedAlgo===v?700:400,marginBottom:6}}>
                {l}
              </button>
            ))}
          </Panel>
          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Round Settings</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Max Players</label>
                <Inp type="number" value={roundConfig.maxPlayers} onChange={v=>setRoundConfig(c=>Object.assign({},c,{maxPlayers:v}))} placeholder="24"/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Round Count</label>
                <Sel value={roundConfig.roundCount} onChange={v=>setRoundConfig(c=>Object.assign({},c,{roundCount:v}))}>
                  <option value="2">2 Rounds</option>
                  <option value="3">3 Rounds</option>
                </Sel>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Check-in Window</label>
                <Sel value={roundConfig.checkinWindowMins} onChange={v=>setRoundConfig(c=>Object.assign({},c,{checkinWindowMins:v}))}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </Sel>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab==="quickclash"&&(
        <div className="grid-2" style={{alignItems:"start"}}>
          <Panel accent style={{padding:"20px"}}>
            <div style={{marginTop:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <div style={{width:36,height:36,background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>⚡</div>
                <div>
                  <h3 style={{fontSize:15,color:"#F2EDE4",lineHeight:1}}>Quick Clash</h3>
                  <div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>Instant · Open · No registration phase</div>
                </div>
              </div>
              <div style={{background:"rgba(155,114,207,.05)",border:"1px solid rgba(155,114,207,.15)",borderRadius:9,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#C8D4E0",lineHeight:1.6}}>
                Quick Clashes open immediately for any player to join. Set a cap and kick off once full — visible to all players on the home screen.
              </div>
              <div style={{display:"grid",gap:12,marginBottom:14}}>
                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Event Name</label><Inp value={flashForm.name} onChange={v=>setFlashForm(f=>Object.assign({},f,{name:v}))} placeholder="Quick Clash"/></div>
                <div className="grid-2">
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Player Cap</label><Sel value={flashForm.cap} onChange={v=>setFlashForm(f=>Object.assign({},f,{cap:v}))}>{[4,8,16].map(n=><option key={n} value={n}>{n}</option>)}</Sel></div>
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Rounds</label><Sel value={flashForm.rounds} onChange={v=>setFlashForm(f=>Object.assign({},f,{rounds:v}))}>{[1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</Sel></div>
                </div>
                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Format</label><Sel value={flashForm.format} onChange={v=>setFlashForm(f=>Object.assign({},f,{format:v}))}>{["Single Lobby","Two Lobbies","Finals Only"].map(fm=><option key={fm}>{fm}</option>)}</Sel></div>
              </div>
              <Btn v="primary" full onClick={()=>{
                if(!flashForm.name.trim())return;
                var ev={id:Date.now(),name:flashForm.name.trim(),cap:parseInt(flashForm.cap),rounds:parseInt(flashForm.rounds),format:flashForm.format,status:"open",players:[],startedAt:null,createdAt:new Date().toLocaleTimeString()};
                setQuickClashes&&setQuickClashes(function(qs){return [ev,...qs];});
                addAudit("ACTION","Quick Clash created: "+flashForm.name);
                toast(flashForm.name+" is open for signups — "+flashForm.cap+" spots","success");
                setFlashForm({name:"Flash Clash",cap:"8",rounds:"2",format:"Single Lobby"});
              }}>Open Quick Clash ⚡</Btn>
            </div>
          </Panel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="cond" style={{fontSize:10,fontWeight:700,color:"#BECBD9",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>Active Quick Clashes</div>
            {(!quickClashes||quickClashes.length===0)&&(
              <Panel style={{padding:"28px",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>⚡</div>
                <div style={{color:"#9AAABF",fontSize:13}}>No quick clashes yet</div>
                <div style={{color:"#7A8BA0",fontSize:11,marginTop:4}}>Create one on the left</div>
              </Panel>
            )}
            {(quickClashes||[]).map(function(ev){return(
              <Panel key={ev.id} style={{padding:"14px",border:"1px solid rgba(155,114,207,.25)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                      <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{ev.name}</span>
                      <Tag color="#9B72CF" size="sm">QUICK</Tag>
                      {ev.status==="open"&&<Tag color="#6EE7B7" size="sm">● OPEN</Tag>}
                      {ev.status==="full"&&<Tag color="#E8A838" size="sm">FULL</Tag>}
                      {ev.status==="live"&&<Tag color="#F87171" size="sm">● LIVE</Tag>}
                      {ev.status==="complete"&&<Tag color="#BECBD9" size="sm">DONE</Tag>}
                    </div>
                    <div style={{fontSize:12,color:"#C8D4E0"}}>{ev.players?ev.players.length:0}/{ev.cap}p · {ev.rounds}R · {ev.format}</div>
                    <div className="cond" style={{fontSize:11,color:"#BECBD9",marginTop:2}}>Created {ev.createdAt}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(ev.status==="open"||ev.status==="full")&&(
                      <Btn s="sm" v="success" onClick={()=>{setQuickClashes&&setQuickClashes(function(qs){return qs.map(function(q){return q.id===ev.id?Object.assign({},q,{status:"live",startedAt:new Date().toLocaleTimeString()}):q;});});addAudit("ACTION","Quick Clash started: "+ev.name);toast(ev.name+" is LIVE!","success");}}>Start</Btn>
                    )}
                    {ev.status==="live"&&(
                      <Btn s="sm" v="dark" onClick={()=>{setQuickClashes&&setQuickClashes(function(qs){return qs.map(function(q){return q.id===ev.id?Object.assign({},q,{status:"complete"}):q;});});addAudit("RESULT","Quick Clash complete: "+ev.name);toast(ev.name+" complete","success");}}>End</Btn>
                    )}
                    {ev.status==="complete"&&(
                      <Btn s="sm" v="danger" onClick={()=>{setQuickClashes&&setQuickClashes(function(qs){return qs.filter(function(q){return q.id!==ev.id;});});addAudit("ACTION","Quick Clash removed: "+ev.name);}}>Remove</Btn>
                    )}
                  </div>
                </div>
              </Panel>
            );})}
          </div>
        </div>
      )}
            {tab==="schedule"&&(
        <div className="grid-2" style={{alignItems:"start"}}>
          <Panel accent style={{padding:"20px"}}>
            <div style={{marginTop:6}}>
              <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Schedule Event</h3>
              <div style={{display:"grid",gap:12,marginBottom:14}}>
                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Name</label><Inp value={newEvent.name} onChange={v=>setNewEvent(e=>({...e,name:v}))} placeholder="Clash #15"/></div>
                <div className="grid-2">
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Type</label><Sel value={newEvent.type} onChange={v=>setNewEvent(e=>({...e,type:v}))}>{["SCHEDULED","FLASH","INVITATIONAL","WEEKLY"].map(t=><option key={t}>{t}</option>)}</Sel></div>
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Format</label><Sel value={newEvent.format} onChange={v=>setNewEvent(e=>({...e,format:v}))}>{["Swiss","Single Lobby","Round Robin","Finals Only"].map(f=><option key={f}>{f}</option>)}</Sel></div>
                </div>
                <div className="grid-2">
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label><Inp type="date" value={newEvent.date} onChange={v=>setNewEvent(e=>({...e,date:v}))}/></div>
                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Time</label><Inp type="time" value={newEvent.time} onChange={v=>setNewEvent(e=>({...e,time:v}))}/></div>
                </div>
                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Cap</label><Sel value={newEvent.cap} onChange={v=>setNewEvent(e=>({...e,cap:v}))}>{[8,16,24,32,48,64].map(n=><option key={n} value={n}>{n}</option>)}</Sel></div>
              </div>
              <Btn v="primary" full onClick={()=>{if(!newEvent.name||!newEvent.date)return;setScheduledEvents(es=>[...es,{...newEvent,id:Date.now(),status:"upcoming",cap:parseInt(newEvent.cap)||8}]);addAudit("ACTION","Scheduled: "+newEvent.name);setNewEvent({name:"",type:"SCHEDULED",date:"",time:"",cap:"8",format:"Swiss",notes:""});toast("Scheduled","success");}}>Schedule</Btn>
            </div>
          </Panel>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {scheduledEvents.map(ev=>(
              <Panel key={ev.id} style={{padding:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                      <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{ev.name}</span>
                      <Tag color={EVENT_COLS[ev.type]||"#E8A838"} size="sm">{ev.type}</Tag>
                    </div>
                    <div style={{fontSize:12,color:"#C8D4E0"}}>{ev.date} · {ev.time}</div>
                    <div className="cond" style={{fontSize:11,color:"#BECBD9",marginTop:2}}>{ev.format} · {ev.cap}p</div>
                  </div>
                  <Btn s="sm" v="danger" onClick={()=>{setScheduledEvents(es=>es.filter(e=>e.id!==ev.id));addAudit("ACTION","Cancelled: "+ev.name);}}>✕</Btn>
                </div>
              </Panel>
            ))}
            {scheduledEvents.length===0&&<div style={{textAlign:"center",padding:32,color:"#9AAABF",fontSize:14}}>No events scheduled</div>}
          </div>
        </div>
      )}

      {tab==="season"&&(
        <div className="grid-2">
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Season Config</h3>
            <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Season Name</label>
            <Inp value={seasonName} onChange={setSeasonName} placeholder="Season name" style={{marginBottom:14}}/>
            <Btn v="primary" s="sm" onClick={()=>{addAudit("ACTION","Renamed: "+seasonName);toast("Saved","success");}}>Save</Btn>
            <Divider label="Stats"/>
            <div className="grid-2" style={{marginTop:8}}>
              {[["Players",players.length],["Total Pts",players.reduce((s,p)=>s+p.pts,0)],["Games",players.reduce((s,p)=>s+(p.games||0),0)],["Clashes",PAST_CLASHES.length+1]].map(([l,v])=>(
                <div key={l} style={{background:"#0F1520",borderRadius:9,padding:"11px",textAlign:"center"}}>
                  <div className="mono" style={{fontSize:20,fontWeight:700,color:"#E8A838"}}>{v}</div>
                  <div className="cond" style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:3}}>{l}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Season Health Rules</h3>
            <div style={{display:"grid",gap:14}}>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Drop Weeks (worst weeks ignored)</label>
                <Sel value={String(seasonConfig?seasonConfig.dropWeeks||0:0)} onChange={v=>setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{dropWeeks:parseInt(v)});})}>
                  <option value="0">Off (0)</option>
                  <option value="1">Drop 1</option>
                  <option value="2">Drop 2</option>
                </Sel>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="checkbox" id="cb-comeback" checked={seasonConfig?!!seasonConfig.comebackBonus:false} onChange={function(e){setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{comebackBonus:e.target.checked});});}} style={{width:16,height:16,accentColor:"#9B72CF"}}/>
                <label htmlFor="cb-comeback" style={{fontSize:13,color:"#C8D4E0",cursor:"pointer"}}>Comeback Bonus (+2 pts after missing 2+ clashes)</label>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <input type="checkbox" id="cb-attendance" checked={seasonConfig?!!seasonConfig.attendanceBonus:false} onChange={function(e){setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{attendanceBonus:e.target.checked});});}} style={{width:16,height:16,accentColor:"#E8A838"}}/>
                <label htmlFor="cb-attendance" style={{fontSize:13,color:"#C8D4E0",cursor:"pointer"}}>Attendance Streak Bonus (+3 at 3, +5 at 5 consecutive)</label>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Finale Boost</label>
                <Sel value={String(seasonConfig?seasonConfig.finalBoost||1.0:1.0)} onChange={v=>setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{finalBoost:parseFloat(v)});})}>
                  <option value="1">Off (1x)</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                </Sel>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Finale Clashes (last N events boosted)</label>
                <Sel value={String(seasonConfig?seasonConfig.finaleClashes||2:2)} onChange={v=>setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{finaleClashes:parseInt(v)});})}>
                  <option value="1">Last 1</option>
                  <option value="2">Last 2</option>
                  <option value="3">Last 3</option>
                </Sel>
              </div>
              <Btn v="primary" s="sm" onClick={()=>{addAudit("ACTION","Season health rules updated");toast("Season rules saved","success");}}>Save Rules</Btn>
            </div>
          </Panel>
          <Panel danger style={{padding:"20px"}}>
            <div style={{marginTop:6}}>
              <h3 style={{fontSize:15,color:"#F87171",marginBottom:8}}>⚠ Danger Zone</h3>
              <p style={{fontSize:13,color:"#C8D4E0",marginBottom:16}}>These actions are irreversible and logged.</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <Btn v="danger" full onClick={()=>{if(window.confirm("Reset ALL stats?")){setPlayers(ps=>ps.map(p=>({...p,pts:0,wins:0,top4:0,games:0})));addAudit("DANGER","Stats reset");toast("Reset","success");}}}>Reset Season Stats</Btn>
                <Btn v="danger" full onClick={()=>{if(window.confirm("Clear ALL players?")){setPlayers([]);addAudit("DANGER","Players cleared");}}}>Clear All Players</Btn>
                <Btn v="danger" full onClick={()=>{if(window.confirm("Reset season data? This will clear all points and tournament state.")){setPlayers(ps=>ps.map(p=>({...p,pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,clashHistory:[],sparkline:[]})));setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[]});localStorage.removeItem("tft-players");localStorage.removeItem("tft-tournament");addAudit("DANGER","Season data reset");toast("Season data reset","success");}}}>Reset Season Data</Btn>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab==="broadcast"&&(
        <div className="grid-2">
          <Panel accent style={{padding:"20px"}}>
            <div style={{marginTop:6}}>
              <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Send Broadcast</h3>
              <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Type</label><Sel value={broadType} onChange={setBroadType}>{["NOTICE","ALERT","UPDATE","RESULT","INFO"].map(t=><option key={t}>{t}</option>)}</Sel></div>
              <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Message</label><Inp value={broadMsg} onChange={setBroadMsg} placeholder="Your announcement..."/></div>
              <Btn v="primary" full onClick={()=>{if(!broadMsg.trim())return;const a={id:Date.now(),type:broadType,msg:broadMsg.trim(),ts:Date.now()};setAnnouncements(as=>[a,...as]);setAnnouncement(broadMsg.trim());addAudit("BROADCAST","["+broadType+"] "+broadMsg);setBroadMsg("");toast("Sent","success");}}>Send</Btn>
            </div>
          </Panel>
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Active Announcements</h3>
            {announcements.map(a=>(
              <div key={a.id} style={{padding:"11px",background:"#0F1520",border:"1px solid rgba(242,237,228,.07)",borderRadius:9,marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div><Tag color="#E8A838" size="sm">{a.type}</Tag><div style={{fontSize:13,color:"#C8BFB0",marginTop:6}}>{a.msg}</div></div>
                <button onClick={()=>{setAnnouncements(as=>as.filter(x=>x.id!==a.id));setAnnouncement("");}} style={{background:"none",border:"none",color:"#BECBD9",cursor:"pointer",fontSize:20,lineHeight:1,flexShrink:0,minWidth:28,minHeight:28}}>×</button>
              </div>
            ))}
          </Panel>
        </div>
      )}

      {tab==="audit"&&(
        <Panel style={{overflow:"hidden"}}>
          <div style={{padding:"12px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4"}}>Audit Log</h3>
            <span className="mono" style={{fontSize:11,color:"#BECBD9"}}>{auditLog.length} entries</span>
          </div>
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {auditLog.map((l,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                <Tag color={AUDIT_COLS[l.type]||"#E8A838"} size="sm">{l.type}</Tag>
                <span style={{flex:1,fontSize:13,color:"#C8BFB0"}}>{l.msg}</span>
                <span className="mono" style={{fontSize:10,color:"#9AAABF",whiteSpace:"nowrap",flexShrink:0}}>{new Date(l.ts).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab==="hosts"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <h3 style={{fontSize:16,color:"#F2EDE4"}}>Host Applications</h3>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:12,color:"#BECBD9"}}>{hostApps.filter(a=>a.status==="pending").length} pending review</div>
              <button onClick={()=>setScreen("aegis-showcase")} style={{background:"rgba(155,114,207,.18)",border:"1px solid rgba(155,114,207,.4)",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}>
                <span>🏆</span> Aegis Client Demo
              </button>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {hostApps.map(app=>(
              <Panel key={app.id} style={{padding:"18px",border:"1px solid "+(app.status==="pending"?"rgba(232,168,56,.25)":app.status==="approved"?"rgba(82,196,124,.2)":"rgba(248,113,113,.2)")}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{app.name}</span>
                      {app.org&&<Tag color="#9B72CF" size="sm">{app.org}</Tag>}
                      <Tag color={app.status==="pending"?"#E8A838":app.status==="approved"?"#6EE7B7":"#F87171"} size="sm">
                        {app.status==="pending"?"⏳ Pending":app.status==="approved"?"✓ Approved":"✗ Rejected"}
                      </Tag>
                    </div>
                    <div style={{fontSize:12,color:"#BECBD9",marginBottom:8}}>{app.email} · {app.freq} · Applied {app.submittedAt}</div>
                    <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6,padding:"10px 12px",background:"rgba(255,255,255,.02)",borderRadius:7,border:"1px solid rgba(242,237,228,.06)"}}>"{app.reason}"</div>
                  </div>
                  {app.status==="pending"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
                      <Btn v="success" s="sm" onClick={()=>{setHostApps(apps=>apps.map(a=>a.id===app.id?{...a,status:"approved"}:a));addAudit("ACTION","Host approved: "+app.name);toast(app.name+" approved as host ✓","success");}}>✓ Approve</Btn>
                      <Btn v="danger" s="sm" onClick={()=>{setHostApps(apps=>apps.map(a=>a.id===app.id?{...a,status:"rejected"}:a));addAudit("WARN","Host rejected: "+app.name);toast(app.name+" rejected","success");}}>✗ Reject</Btn>
                    </div>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      {tab==="sponsorships"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <h3 style={{fontSize:16,color:"#F2EDE4"}}>Org Sponsorship Slots</h3>
            <Btn v="primary" s="sm" onClick={()=>{document.getElementById("sp-org-name")&&document.getElementById("sp-org-name").focus();}}>+ Add Slot</Btn>
          </div>
          <div style={{marginBottom:20,padding:"14px 16px",background:"rgba(232,168,56,.05)",border:"1px solid rgba(232,168,56,.15)",borderRadius:10,fontSize:13,color:"#C8D4E0",lineHeight:1.6}}>
            Org sponsorships let a brand pay to have their tag shown next to a specific player's name on the leaderboard and their profile - like a jersey sponsor. You assign them manually here.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {Object.entries(orgSponsors&&Object.keys(orgSponsors).length?orgSponsors:ORG_SPONSORSHIPS).map(([pid,s])=>{
              const p=players.find(pl=>pl.id===parseInt(pid));
              return(
                <Panel key={pid} style={{padding:"16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <div style={{width:40,height:40,background:s.color+"18",border:"1px solid "+s.color+"44",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:s.color,flexShrink:0}}>{s.logo}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:4}}>{s.org}</div>
                    <div style={{fontSize:12,color:"#BECBD9"}}>Sponsoring: <span style={{color:s.color}}>{p?.name||"Player #"+pid}</span></div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <OrgSponsorTag playerId={parseInt(pid)}/>
                    <Btn v="danger" s="sm" onClick={()=>{setOrgSponsors&&setOrgSponsors(function(s){var n=Object.assign({},s);delete n[pid];return n;});addAudit("ACTION","Sponsor removed: "+s.org);toast(s.org+" removed","success");}}>Remove</Btn>
                  </div>
                </Panel>
              );
            })}
          </div>
          <Panel style={{padding:"18px",marginTop:16,border:"1px solid rgba(155,114,207,.2)"}}>
            <h4 style={{fontSize:14,color:"#C4B5FD",marginBottom:12}}>Add New Sponsorship</h4>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#C8D4E0",marginBottom:5}}>Org Name</div>
                <Inp id="sp-org-name" value="" onChange={()=>{}} placeholder="e.g. ProGuides"/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#C8D4E0",marginBottom:5}}>Logo Text</div>
                <Inp id="sp-org-logo" value="" onChange={()=>{}} placeholder="e.g. PG"/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#C8D4E0",marginBottom:5}}>Accent Colour</div>
                <Inp id="sp-org-color" value="" onChange={()=>{}} placeholder="#4ECDC4"/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"#C8D4E0",marginBottom:5}}>Assign to Player</div>
                <Sel id="sp-org-player" value="" onChange={()=>{}}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Sel>
              </div>
            </div>
            <Btn v="primary" onClick={()=>{
              var orgName=document.getElementById("sp-org-name")&&document.getElementById("sp-org-name").value;
              var orgLogo=document.getElementById("sp-org-logo")&&document.getElementById("sp-org-logo").value;
              var orgColor=document.getElementById("sp-org-color")&&document.getElementById("sp-org-color").value;
              var orgPlayer=document.getElementById("sp-org-player")&&document.getElementById("sp-org-player").value;
              if(!orgName||!orgPlayer){toast("Org name and player required","error");return;}
              setOrgSponsors&&setOrgSponsors(function(s){var n=Object.assign({},s);n[orgPlayer]={org:orgName,logo:orgLogo||orgName.slice(0,2).toUpperCase(),color:orgColor||"#9B72CF"};return n;});
              toast(orgName+" sponsorship added","success");
            }}>Add Sponsorship</Btn>
          </Panel>
        </div>
      )}

      {tab==="settings"&&(
        <Panel style={{padding:"20px",maxWidth:480}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Role Hierarchy</h3>
          {[["Admin","Full access, all tabs","#E8A838"],["Mod","Disputes, check-in, scores","#9B72CF"],["Host","Lobby management","#4ECDC4"],["Player","Self-placement only","#BECBD9"]].map(([r,d,c])=>(
            <div key={r} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:"1px solid rgba(242,237,228,.06)"}}>
              <Tag color={c}>{r}</Tag>
              <span style={{fontSize:13,color:"#C8D4E0"}}>{d}</span>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}


// ─── SCRIMS SCREEN ────────────────────────────────────────────────────────────
function ScrimsScreen({players,toast,setScreen}){
  const [tab,setTab]=useState("log");
  const [sessions,setSessions]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [newName,setNewName]=useState("");
  const [newNotes,setNewNotes]=useState("");
  const [newTarget,setNewTarget]=useState("5");
  const [scrimRoster,setScrimRoster]=useState([]);
  const [customName,setCustomName]=useState("");
  const [scrimResults,setScrimResults]=useState({});
  const [gameNote,setGameNote]=useState("");
  const [gameTag,setGameTag]=useState("standard");
  const [timer,setTimer]=useState(0);
  const [timerActive,setTimerActive]=useState(false);
  const [expandedGame,setExpandedGame]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const timerRef=useRef(null);

  useEffect(()=>{
    if(timerActive){timerRef.current=setInterval(()=>setTimer(t=>t+1),1000);}
    else clearInterval(timerRef.current);
    return()=>clearInterval(timerRef.current);
  },[timerActive]);

  const fmt=s=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  const session=sessions.find(s=>s.id===activeId);
  const allGames=sessions.flatMap(s=>s.games);

  // ── Per-player stats across ALL sessions ──────────────────────────────────
  const allPlayers=[...players,...scrimRoster.filter(r=>!players.find(p=>p.id===r.id))];
  const scrimStats=allPlayers.map(p=>{
    const pGames=allGames.filter(g=>g.results[p.id]!=null);
    if(pGames.length===0)return null;
    const placements=pGames.map(g=>g.results[p.id]);
    const wins=placements.filter(x=>x===1).length;
    const top4=placements.filter(x=>x<=4).length;
    const avgPlacement=(placements.reduce((s,v)=>s+v,0)/placements.length).toFixed(2);
    const pts=placements.reduce((s,v)=>s+(PTS[v]||0),0);
    const best=Math.min(...placements);
    const worst=Math.max(...placements);
    // Streak: count current finishing streak
    const recent=[...pGames].sort((a,b)=>b.ts-a.ts).map(g=>g.results[p.id]);
    let streak=0;
    for(let i=0;i<recent.length;i++){if(recent[i]<=4)streak++;else break;}
    return{...p,pts,wins,top4,games:pGames.length,avg:avgPlacement,best,worst,streak,placements,
      top4Rate:((top4/pGames.length)*100).toFixed(0),
      winRate:((wins/pGames.length)*100).toFixed(0)};
  }).filter(Boolean).sort((a,b)=>parseFloat(a.avg)-parseFloat(b.avg));

  function createSession(){
    if(!newName.trim()){toast("Name required","error");return;}
    const s={id:Date.now(),name:newName.trim(),notes:newNotes.trim(),
      targetGames:parseInt(newTarget)||5,games:[],createdAt:new Date().toLocaleDateString(),active:true};
    setSessions(ss=>[...ss,s]);setActiveId(s.id);
    setNewName("");setNewNotes("");setNewTarget("5");
    toast("Session created - go to Log tab to record games","success");
    setTab("log");
  }

  function addPlayer(){
    if(!customName.trim())return;
    const fromRoster=players.find(p=>p.name.toLowerCase()===customName.toLowerCase());
    if(scrimRoster.find(p=>p.name.toLowerCase()===customName.toLowerCase())){toast("Already added","error");return;}
    const np=fromRoster||{id:"c"+Date.now(),name:customName.trim(),rank:"Gold",pts:0,games:0,wins:0,top4:0,avg:"0"};
    setScrimRoster(r=>[...r,np]);setCustomName("");
  }

  function lockGame(){
    if(!activeId){toast("Select or create a session first","error");return;}
    if(Object.keys(scrimResults).length<scrimRoster.length){toast("All placements required","error");return;}
    const game={id:Date.now(),results:{...scrimResults},note:gameNote,tag:gameTag,duration:timer,ts:Date.now()};
    setSessions(ss=>ss.map(s=>s.id===activeId?{...s,games:[...s.games,game]}:s));
    setScrimResults({});setGameNote("");setTimer(0);setTimerActive(false);
    toast("Game locked ✓","success");
  }

  function stopSession(id){
    setSessions(ss=>ss.map(s=>s.id===id?{...s,active:false}:s));
    toast("Session ended - results saved","success");
  }
  function deleteGame(sessionId,gameId){
    setSessions(ss=>ss.map(s=>s.id===sessionId?{...s,games:s.games.filter(g=>g.id!==gameId)}:s));
    setConfirmDelete(null);
    toast("Game deleted","success");
  }
  function deleteSession(sessionId){
    setSessions(ss=>ss.filter(s=>s.id!==sessionId));
    if(activeId===sessionId)setActiveId(null);
    setConfirmDelete(null);
    toast("Session deleted","success");
  }

  const PlacementPip=({place})=>{
    const c=place===1?"#E8A838":place===2?"#C0C0C0":place===3?"#CD7F32":place<=4?"#4ECDC4":"#F87171";
    return(
      <div style={{width:28,height:28,borderRadius:6,background:c+"22",border:"1px solid "+c+"55",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span className="mono" style={{fontSize:11,fontWeight:700,color:c}}>{place}</span>
      </div>
    );
  };

  // ── TABS ──────────────────────────────────────────────────────────────────
  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
      </div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:4}}>Scrims Lab</h2>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <Tag color="#9B72CF">Admin Only</Tag>
            <span style={{fontSize:12,color:"#BECBD9"}}>{allGames.length} games logged · {sessions.length} sessions</span>
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[["log","📋 Log"],["stats","📊 Stats"],["history","🕐 History"],["sessions","⚙ Sessions"]].map(([t,l])=>(
            <Btn key={t} v={tab===t?"purple":"dark"} s="sm" onClick={()=>setTab(t)}>{l}</Btn>
          ))}
        </div>
      </div>

      {/* ── LOG TAB: record a game ── */}
      {tab==="log"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Session selector */}
            <Panel style={{padding:"14px 16px",background:"#0A0F1A",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Active Session</div>
                <Sel value={activeId||""} onChange={v=>setActiveId(parseInt(v)||null)} style={{width:"100%"}}>
                  <option value="">- Select session -</option>
                  {sessions.map(s=><option key={s.id} value={s.id}>{s.name} ({s.games.length}/{s.targetGames}){s.active?"":" · Ended"}</option>)}
                </Sel>
              </div>
              {session&&<Tag color={session.active?"#52C47C":"#BECBD9"} size="sm">{session.active?"Active":"Ended"}</Tag>}
              {session&&session.active&&<Btn v="danger" s="sm" onClick={()=>stopSession(session.id)}>End Session</Btn>}
            </Panel>

            {/* Roster */}
            <Panel style={{padding:"16px"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:10}}>Lobby Roster</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <Inp value={customName} onChange={setCustomName} placeholder="Add player by name" onKeyDown={e=>e.key==="Enter"&&addPlayer()} style={{flex:1}}/>
                <Btn v="purple" onClick={addPlayer}>Add</Btn>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {players.map(p=>(
                  <Btn key={p.id} v={scrimRoster.find(r=>r.id===p.id)?"purple":"dark"} s="sm"
                    onClick={()=>{if(!scrimRoster.find(r=>r.id===p.id))setScrimRoster(r=>[...r,p]);}}>
                    {p.name}
                  </Btn>
                ))}
              </div>
              {scrimRoster.length>0&&(
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {scrimRoster.map(p=>(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",
                      background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.3)",borderRadius:7}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#C4B5FD"}}>{p.name}</span>
                      <button onClick={()=>setScrimRoster(r=>r.filter(x=>x.id!==p.id))}
                        style={{background:"none",border:"none",color:"#BECBD9",cursor:"pointer",fontSize:15,lineHeight:1,padding:0}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Placement entry */}
            {scrimRoster.length>=2&&(
              <Panel style={{padding:"18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#F2EDE4"}}>
                    Game {session?session.games.length+1:1}{session?" / "+session.targetGames:""}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div className="mono" style={{fontSize:18,fontWeight:700,color:timerActive?"#E8A838":"#9AAABF",minWidth:54}}>{fmt(timer)}</div>
                    <Btn v="dark" s="sm" onClick={()=>setTimerActive(t=>!t)}>{timerActive?"⏸":"▶"}</Btn>
                    <Btn v="dark" s="sm" onClick={()=>{setTimer(0);setTimerActive(false);}}>↺</Btn>
                  </div>
                </div>
                <div className="grid-2" style={{marginBottom:14,gap:10}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Tag</div>
                    <Sel value={gameTag} onChange={setGameTag}>
                      {["standard","draft comp","test run","ranked sim","meta test"].map(t=><option key={t} value={t}>{t}</option>)}
                    </Sel>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Note</div>
                    <Inp value={gameNote} onChange={setGameNote} placeholder="comp, pivot, notes..."/>
                  </div>
                </div>
                <PlacementBoard roster={scrimRoster} results={scrimResults} onPlace={(pid,place)=>setScrimResults(r=>({...r,[pid]:place}))} locked={false}/>
                <div style={{marginTop:14}}>
                  <Btn v="purple" full disabled={Object.keys(scrimResults).length<scrimRoster.length} onClick={lockGame} s="lg">
                    Lock Game {Object.keys(scrimResults).length}/{scrimRoster.length} placed
                  </Btn>
                </div>
              </Panel>
            )}
          </div>

          {/* Recent games sidebar */}
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Recent Games</div>
            {allGames.length===0&&(
              <Panel style={{padding:"24px",textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:8}}>🎮</div>
                <div style={{fontSize:13,color:"#9AAABF"}}>No games logged yet. Record a game to see it here.</div>
              </Panel>
            )}
            {[...allGames].reverse().slice(0,8).map((g,gi)=>{
              const sessionName=sessions.find(s=>s.games.find(sg=>sg.id===g.id))?.name||"";
              const sorted=Object.entries(g.results).sort((a,b)=>a[1]-b[1]);
              return(
                <Panel key={g.id} style={{padding:"10px 12px",marginBottom:6}}>
                  {/* Game header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span className="cond mono" style={{fontSize:11,fontWeight:800,color:"#9B72CF"}}>G{allGames.length-gi}</span>
                      {g.tag!=="standard"&&<Tag color="#4ECDC4" size="sm">{g.tag}</Tag>}
                      {g.duration>0&&<span className="mono" style={{fontSize:9,color:"#9AAABF"}}>{fmt(g.duration)}</span>}
                    </div>
                    <span style={{fontSize:10,color:"#9AAABF"}}>{sessionName}</span>
                  </div>
                  {g.note&&<div style={{fontSize:10,color:"#BECBD9",marginBottom:6,fontStyle:"italic"}}>"{g.note}"</div>}
                  {/* Name + placement rows */}
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {sorted.map(([pid,place])=>{
                      const p=allPlayers.find(pl=>String(pl.id)===String(pid));
                      if(!p)return null;
                      const c=place===1?"#E8A838":place===2?"#C0C0C0":place===3?"#CD7F32":place<=4?"#4ECDC4":"#F87171";
                      return(
                        <div key={pid} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:12,color:place<=4?"#D1C9BC":"#BECBD9",fontWeight:place<=4?600:400,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                          <div style={{width:22,height:22,borderRadius:5,background:c+"22",border:"1px solid "+c+"55",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:6}}>
                            <span className="mono" style={{fontSize:11,fontWeight:700,color:c}}>{place}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STATS TAB: per-player deep stats ── */}
      {tab==="stats"&&(
        <div>
          {scrimStats.length===0?(
            <div style={{textAlign:"center",padding:60,color:"#9AAABF",fontSize:14}}>Log some games first to see stats.</div>
          ):(
            <>
              {/* Summary stat strip */}
              <div className="grid-4" style={{marginBottom:20}}>
                {[
                  {label:"Games Logged",val:allGames.length,c:"#C4B5FD"},
                  {label:"Sessions",val:sessions.length,c:"#E8A838"},
                  {label:"Players Tracked",val:scrimStats.length,c:"#4ECDC4"},
                  {label:"Avg Game Time",val:allGames.length>0?fmt(Math.round(allGames.reduce((s,g)=>s+g.duration,0)/allGames.length)):"-",c:"#6EE7B7"},
                ].map(({label,val,c})=>(
                  <div key={label} style={{background:"#111827",border:"1px solid rgba(242,237,228,.08)",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
                    <div className="mono" style={{fontSize:22,fontWeight:700,color:c,lineHeight:1}}>{val}</div>
                    <div className="cond" style={{fontSize:9,fontWeight:700,color:"#C8D4E0",marginTop:4,letterSpacing:".04em",textTransform:"uppercase"}}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Per-player stat rows */}
              <div style={{background:"#0A0F1A",borderRadius:12,overflow:"hidden",border:"1px solid rgba(242,237,228,.07)"}}>
                {/* Header row */}
                <div style={{display:"grid",gridTemplateColumns:"28px 1fr 52px 48px 48px 48px 48px 48px",gap:"0 8px",alignItems:"center",padding:"8px 14px",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
                  <div/>
                  <div style={{fontSize:10,fontWeight:700,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".08em"}}>Player</div>
                  {["AVG","WIN%","TOP4","BEST","WRST","PTS"].map(h=>(
                    <div key={h} style={{fontSize:9,fontWeight:700,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".06em",textAlign:"center"}}>{h}</div>
                  ))}
                </div>
                {scrimStats.map((p,i)=>{
                  const avgC=parseFloat(p.avg)<3?"#4ade80":parseFloat(p.avg)<=5?"#facc15":"#f87171";
                  const isFirst=i===0;
                  return(
                    <div key={p.id} style={{borderBottom:i<scrimStats.length-1?"1px solid rgba(242,237,228,.04)":"none",
                      background:isFirst?"rgba(232,168,56,.04)":"transparent"}}>
                      {/* Main stat row */}
                      <div style={{display:"grid",gridTemplateColumns:"28px 1fr 52px 48px 48px 48px 48px 48px",gap:"0 8px",alignItems:"center",padding:"9px 14px"}}>
                        <div className="mono" style={{fontSize:13,fontWeight:800,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF",textAlign:"center"}}>{i+1}</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                            <div style={{fontSize:10,color:"#9AAABF"}}>{p.games}g{p.streak>=3?" · 🔥"+p.streak:""}</div>
                          </div>
                        </div>
                        <div className="mono" style={{fontSize:13,fontWeight:700,color:avgC,textAlign:"center"}}>{p.avg}</div>
                        <div className="mono" style={{fontSize:12,fontWeight:600,color:"#6EE7B7",textAlign:"center"}}>{p.winRate}%</div>
                        <div className="mono" style={{fontSize:12,fontWeight:600,color:"#4ECDC4",textAlign:"center"}}>{p.top4Rate}%</div>
                        <div className="mono" style={{fontSize:12,fontWeight:600,color:"#E8A838",textAlign:"center"}}>#{p.best}</div>
                        <div className="mono" style={{fontSize:12,fontWeight:600,color:"#F87171",textAlign:"center"}}>#{p.worst}</div>
                        <div className="mono" style={{fontSize:12,fontWeight:700,color:"#C4B5FD",textAlign:"center"}}>{p.pts}</div>
                      </div>
                      {/* Placements inline strip */}
                      <div style={{display:"flex",gap:3,alignItems:"center",padding:"0 14px 8px",flexWrap:"wrap"}}>
                        {p.placements.map((pl,pi)=>{
                          const c=pl===1?"#E8A838":pl===2?"#C0C0C0":pl===3?"#CD7F32":pl<=4?"#4ECDC4":"#F87171";
                          return <div key={pi} style={{width:18,height:18,borderRadius:4,background:c+"22",border:"1px solid "+c+"55",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                            <span className="mono" style={{fontSize:9,fontWeight:700,color:c}}>{pl}</span>
                          </div>;
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB: full game log with placements ── */}
      {tab==="history"&&(
        <div>
          {allGames.length===0?(
            <div style={{textAlign:"center",padding:60,color:"#9AAABF",fontSize:14}}>No games logged yet.</div>
          ):(
            <>
              {sessions.map(sess=>{
                if(sess.games.length===0)return null;
                return(
                  <div key={sess.id} style={{marginBottom:32}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <h3 style={{fontSize:16,color:"#F2EDE4"}}>{sess.name}</h3>
                      <Tag color={sess.active?"#52C47C":"#BECBD9"} size="sm">{sess.active?"Active":"Ended"}</Tag>
                      <span style={{fontSize:12,color:"#BECBD9"}}>{sess.games.length} games · {sess.createdAt}</span>
                      {sess.notes&&<span style={{fontSize:12,color:"#9AAABF"}}>- {sess.notes}</span>}
                    </div>

                    {/* Placement matrix table */}
                    <Panel style={{overflow:"hidden",marginBottom:12}}>
                      <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",minWidth:420}}>
                          <thead>
                            <tr style={{background:"#0A0F1A"}}>
                              <th style={{padding:"9px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)",whiteSpace:"nowrap"}}>Player</th>
                              {sess.games.map((g,gi)=>(
                                <th key={g.id} style={{padding:"9px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)",whiteSpace:"nowrap"}}>
                                  G{gi+1}
                                  {g.tag!=="standard"&&<div style={{fontSize:8,color:"#4ECDC4",fontWeight:400,textTransform:"none",letterSpacing:0}}>{g.tag}</div>}
                                </th>
                              ))}
                              <th style={{padding:"9px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:"#E8A838",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)"}}>Avg</th>
                              <th style={{padding:"9px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:"#6EE7B7",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)"}}>Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sess.games.flatMap(g=>Object.keys(g.results)).filter((p,i,a)=>a.indexOf(p)===i).map(pid=>{
                              // Build per-player rows for this session
                              const p=allPlayers.find(pl=>String(pl.id)===String(pid));
                              if(!p)return null;
                              const placements=sess.games.map(g=>g.results[pid]);
                              const validPl=placements.filter(v=>v!=null);
                              const avg=validPl.length>0?(validPl.reduce((s,v)=>s+v,0)/validPl.length).toFixed(2):"-";
                              const pts=validPl.reduce((s,v)=>s+(PTS[v]||0),0);
                              return(
                                <tr key={p.id} style={{background:i%2===0?"rgba(255,255,255,.01)":"transparent",borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                                  <td style={{padding:"10px 14px"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>{p.name}</span>
                                    </div>
                                  </td>
                                  {placements.map((place,pi)=>{
                                    const c=place==null?"#7A8BA0":place===1?"#E8A838":place===2?"#C0C0C0":place===3?"#CD7F32":place<=4?"#4ECDC4":"#F87171";
                                    return(
                                      <td key={pi} style={{padding:"10px 6px",textAlign:"center"}}>
                                        {place!=null?(
                                          <div style={{width:28,height:28,borderRadius:6,background:c+"22",border:"1px solid "+c+"55",
                                            display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                                            <span className="mono" style={{fontSize:12,fontWeight:700,color:c}}>{place}</span>
                                          </div>
                                        ):<span style={{color:"#7A8BA0",fontSize:12}}>-</span>}
                                      </td>
                                    );
                                  })}
                                  <td style={{padding:"10px 10px",textAlign:"center"}}>
                                    <span className="mono" style={{fontSize:13,fontWeight:700,
                                      color:parseFloat(avg)<3?"#4ade80":parseFloat(avg)<=5?"#facc15":"#f87171"}}>{avg}</span>
                                  </td>
                                  <td style={{padding:"10px 10px",textAlign:"center"}}>
                                    <span className="mono" style={{fontSize:13,fontWeight:700,color:"#C4B5FD"}}>{pts}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Notes row */}
                          <tfoot>
                            <tr style={{background:"#0A0F1A",borderTop:"1px solid rgba(242,237,228,.06)"}}>
                              <td style={{padding:"7px 14px",fontSize:10,color:"#9AAABF",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Notes</td>
                              {sess.games.map(g=>(
                                <td key={g.id} style={{padding:"7px 6px",textAlign:"center",fontSize:10,color:"#4ECDC4",maxWidth:60}}>
                                  {g.note||"-"}
                                </td>
                              ))}
                              <td/><td/>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </Panel>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── SESSIONS TAB: manage sessions ── */}
      {tab==="sessions"&&(
        <div className="grid-2" style={{alignItems:"start"}}>
          <Panel accent style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>New Session</h3>
            <div style={{display:"grid",gap:12,marginBottom:14}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Session Name</div>
                <Inp value={newName} onChange={setNewName} placeholder="Friday Grind"/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Notes / Goals</div>
                <Inp value={newNotes} onChange={setNewNotes} placeholder="Focus area, comps to test..."/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Target Games</div>
                <Sel value={newTarget} onChange={setNewTarget}>
                  {[1,2,3,4,5,6,7,8,10,12].map(n=><option key={n} value={n}>{n} games</option>)}
                </Sel>
              </div>
            </div>
            <Btn v="purple" full onClick={createSession}>Create Session →</Btn>
          </Panel>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {sessions.map(s=>(
              <Panel key={s.id} style={{padding:"16px",border:"1px solid "+(s.active?"rgba(155,114,207,.35)":"rgba(242,237,228,.07)")}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                      {s.name}{s.active&&<Dot size={5} color="#9B72CF"/>}
                    </div>
                    {s.notes&&<div style={{fontSize:12,color:"#BECBD9",marginBottom:6}}>{s.notes}</div>}
                    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                      <Tag color="#9B72CF" size="sm">{s.games.length}/{s.targetGames} games</Tag>
                      <span className="cond" style={{fontSize:10,color:"#9AAABF"}}>{s.createdAt}</span>
                      {!s.active&&<Tag color="#BECBD9" size="sm">Ended</Tag>}
                      {s.games.length>=s.targetGames&&s.active&&<Tag color="#E8A838" size="sm">Target reached!</Tag>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <Btn v="purple" s="sm" onClick={()=>{setActiveId(s.id);setTab("log");}}>Open</Btn>
                    {s.active&&<Btn v="danger" s="sm" onClick={()=>stopSession(s.id)}>End</Btn>}
                  </div>
                </div>
                <Bar val={s.games.length} max={s.targetGames} color="#9B72CF" h={3}/>
              </Panel>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRICING SCREEN ───────────────────────────────────────────────────────────
function PricingScreen({currentPlan,toast}){
  const [billing,setBilling]=useState("monthly");
  const [hovered,setHovered]=useState(null);

  const FAQS=[
    {q:"How often do clashes run?",a:"Weekly, every season. Each TFT set is a season - new meta, fresh standings, clean leaderboard. The schedule is pinned on the home screen and announced in Discord."},
    {q:"Is entry really always free?",a:"Yes, always. You never pay to compete in a TFT Clash event. Pro is optional and gives you deeper stats tools and a guaranteed slot - it's for players who want more, not a paywall."},
    {q:"What does Pro's reserved slot mean?",a:"Weekly clashes can fill up. Pro members get a guaranteed check-in spot so you're never bumped if a clash is oversubscribed. Regular players check in first-come, first-served."},
    {q:"How do results get recorded?",a:"Players enter their own placements via a 4-digit PIN tied to their lobby. No manual entry by admins. Results lock when all lobbies are submitted and then go through our reveal sequence."},
    {q:"What happens at the end of a season?",a:"Season standings freeze, the champion gets crowned in the Hall of Fame, and all XP ranks carry over. A new season starts fresh with the next TFT set."},
    {q:"Can I run my own clash on the platform?",a:"Not by default, but Host tier exists for exactly that. It's not the main product - we run the official weekly clashes - but approved hosts can run their own circuits under the TFT Clash umbrella."},
  ];

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
      </div>
      {/* Hero */}
      <div style={{textAlign:"center",marginBottom:40,padding:"20px 0"}}>
        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".22em",textTransform:"uppercase",marginBottom:12}}>Season 16 · Set 16</div>
        <h1 style={{fontSize:"clamp(28px,5vw,48px)",fontWeight:900,color:"#F2EDE4",lineHeight:1.1,marginBottom:12}}>
          Competing is free.<br/><span style={{color:"#E8A838"}}>Going further costs less than a coffee.</span>
        </h1>
        <p style={{fontSize:16,color:"#C8D4E0",maxWidth:520,margin:"0 auto 24px"}}>
          TFT Clash runs weekly tournaments every season. Entry is always free. Pro gives serious players deeper tools and a reserved spot.
        </p>
        {/* Billing toggle */}
        <div style={{display:"inline-flex",background:"#111827",border:"1px solid rgba(242,237,228,.1)",borderRadius:99,padding:4,gap:4}}>
          {["monthly","annual"].map(b=>(
            <button key={b} onClick={()=>setBilling(b)}
              style={{background:billing===b?"rgba(232,168,56,.15)":"none",
                border:"1px solid "+(billing===b?"rgba(232,168,56,.4)":"transparent"),
                borderRadius:99,padding:"7px 20px",fontSize:13,fontWeight:700,
                color:billing===b?"#E8A838":"#BECBD9",cursor:"pointer",transition:"all .2s",textTransform:"capitalize"}}>
              {b}{b==="annual"&&<span style={{marginLeft:6,fontSize:10,background:"rgba(82,196,124,.15)",color:"#6EE7B7",padding:"1px 6px",borderRadius:99,border:"1px solid rgba(82,196,124,.3)"}}>-20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginBottom:48,alignItems:"start"}}>
        {PREMIUM_TIERS.map(tier=>{
          const isPopular=tier.popular;
          const monthlyPrice=parseFloat(tier.price.replace("€",""))||0;
          const displayPrice=billing==="annual"&&monthlyPrice>0?"€"+(monthlyPrice*.8).toFixed(2):tier.price;
          return(
            <div key={tier.id} onMouseEnter={()=>setHovered(tier.id)} onMouseLeave={()=>setHovered(null)}
              style={{position:"relative",background:isPopular?"linear-gradient(135deg,rgba(232,168,56,.07),rgba(8,8,15,.98))":"#111827",
                border:"1px solid "+(isPopular?"rgba(232,168,56,.45)":hovered===tier.id?"rgba(242,237,228,.2)":"rgba(242,237,228,.08)"),
                borderRadius:16,padding:"28px 24px",
                boxShadow:isPopular?"0 0 40px rgba(232,168,56,.08)":"none",
                transition:"border-color .2s",marginTop:isPopular?-8:0}}>
              {isPopular&&(
                <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",
                  background:"linear-gradient(90deg,#E8A838,#FFD700)",borderRadius:99,
                  padding:"4px 16px",fontSize:11,fontWeight:800,color:"#08080F",
                  letterSpacing:".06em",whiteSpace:"nowrap"}}>
                  ⭐ MOST POPULAR
                </div>
              )}
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:36,height:36,background:tier.color+"18",border:"1px solid "+tier.color+"44",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                    {tier.id==="free"?"🆓":tier.id==="pro"?"⚡":"🏛"}
                  </div>
                  <div>
                    <div style={{fontWeight:800,fontSize:18,color:tier.color}}>{tier.name}</div>
                  </div>
                </div>
                <div style={{marginBottom:6}}>
                  <span className="mono" style={{fontSize:36,fontWeight:700,color:"#F2EDE4"}}>{displayPrice}</span>
                  <span style={{fontSize:13,color:"#BECBD9",marginLeft:4}}>{tier.period}</span>
                </div>
                {billing==="annual"&&monthlyPrice>0&&(
                  <div style={{fontSize:11,color:"#6EE7B7"}}>Billed €{(monthlyPrice*.8*12).toFixed(0)}/year - save €{(monthlyPrice*.2*12).toFixed(0)}</div>
                )}
                <div style={{fontSize:13,color:"#C8D4E0",marginTop:6,lineHeight:1.5}}>{tier.desc}</div>
              </div>
              <button onClick={()=>toast(tier.id==="free"?"You're already on Free!":tier.id==="org"?"Opening contact form...":"Starting free trial... (mock)","success")}
                style={{width:"100%",padding:"12px 20px",background:isPopular?"linear-gradient(90deg,#E8A838,#C8882A)":tier.id==="org"?"rgba(155,114,207,.15)":"rgba(255,255,255,.05)",
                  border:"1px solid "+(isPopular?"transparent":tier.id==="org"?"rgba(155,114,207,.4)":"rgba(242,237,228,.15)"),
                  borderRadius:10,fontSize:15,fontWeight:700,color:isPopular?"#08080F":tier.color,
                  cursor:"pointer",marginBottom:24,transition:"all .2s"}}>
                {tier.cta}
              </button>
              <div style={{borderTop:"1px solid rgba(242,237,228,.06)",paddingTop:20}}>
                {tier.features.map((f,fi)=>(
                  <div key={fi} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{color:tier.color,fontSize:13,flexShrink:0}}>✓</span>
                    <span style={{fontSize:13,color:"#C8BFB0",lineHeight:1.5}}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <Panel style={{overflow:"auto",marginBottom:40}}>
        <div style={{padding:"16px 20px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
          <h3 style={{fontSize:16,color:"#F2EDE4"}}>Feature Comparison</h3>
        </div>
        {[
          ["Weekly clash entry","✓","✓","✓"],
          ["Full season stats & leaderboard","✓","✓","✓"],
          ["Player profile & career history","✓","✓","✓"],
          ["Achievements, milestones & XP ranks","✓","✓","✓"],
          ["Hall of Fame & rival tracking","✓","✓","✓"],
          ["Guaranteed check-in slot","-","✓","✓"],
          ["Season Recap shareable card","-","✓","✓"],
          ["Full cross-season stat history","-","✓","✓"],
          ["Pro badge on profile","-","✓","✓"],
          ["Ad-free experience","-","✓","✓"],
          ["Create & manage own clash events","-","-","✓"],
          ["Custom event branding","-","-","✓"],
          ["Private / invite-only clashes","-","-","✓"],
          ["Admin dashboard & CSV export","-","-","✓"],
        ].map(([feat,...vals],i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 100px 100px 100px",padding:"11px 20px",borderBottom:"1px solid rgba(242,237,228,.04)",background:i%2===0?"rgba(255,255,255,.01)":"transparent",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#C8BFB0"}}>{feat}</span>
            {vals.map((v,vi)=>(
              <div key={vi} style={{textAlign:"center"}}>
                <span style={{fontSize:13,fontWeight:600,color:v==="✓"?["#BECBD9","#E8A838","#9B72CF"][vi]:v==="-"?"#7A8BA0":"#F2EDE4"}}>{v}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{display:"grid",gridTemplateColumns:"1fr 100px 100px 100px",padding:"8px 20px",background:"#0A0F1A",borderTop:"1px solid rgba(242,237,228,.07)"}}>
          <span/>
          {PREMIUM_TIERS.map(t=>(
            <div key={t.id} style={{textAlign:"center"}}>
              <span className="cond" style={{fontSize:10,fontWeight:700,color:t.color,letterSpacing:".08em"}}>{t.name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Sponsor CTA */}
      <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.08),rgba(8,8,15,.98))",border:"1px solid rgba(155,114,207,.3)",borderRadius:14,padding:"28px 24px",textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:28,marginBottom:10}}>📢</div>
        <h3 style={{fontSize:20,color:"#F2EDE4",marginBottom:8}}>Want to sponsor a tournament?</h3>
        <p style={{fontSize:14,color:"#C8D4E0",maxWidth:480,margin:"0 auto 20px",lineHeight:1.6}}>
          Reach thousands of active TFT players directly. Sponsor a clash, get your logo on the results card, and be featured in every share.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn v="purple" s="lg" onClick={()=>toast("Opening sponsor inquiry (mock)...","success")}>Become a Sponsor</Btn>
          <Btn v="ghost" onClick={()=>toast("Sponsor pack coming soon","success")}>Download Media Kit</Btn>
        </div>
      </div>

      {/* FAQ */}
      <div style={{maxWidth:680,margin:"0 auto"}}>
        <h3 style={{fontSize:18,color:"#F2EDE4",marginBottom:20,textAlign:"center"}}>FAQ</h3>
        {FAQS.map((faq,i)=>(
          <Panel key={i} style={{padding:"16px 20px",marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:14,color:"#E8A838",marginBottom:6}}>{faq.q}</div>
            <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6}}>{faq.a}</div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ─── MILESTONES SCREEN ────────────────────────────────────────────────────────
function MilestonesScreen({players,setScreen,setProfilePlayer,currentUser}){
  const [filterTier,setFilterTier]=useState("all");
  const [tab,setTab]=useState("achievements");

  const myPlayer=currentUser?players.find(p=>p.name===currentUser.username):null;

  const tierOrder=["bronze","silver","gold","legendary"];
  const tierCols={bronze:"#CD7F32",silver:"#C0C0C0",gold:"#E8A838",legendary:"#9B72CF"};
  const tierLabels={bronze:"Bronze",silver:"Silver",gold:"Gold",legendary:"Legendary"};

  const filteredAch=ACHIEVEMENTS.filter(a=>filterTier==="all"||a.tier===filterTier);

  const sorted=[...players].sort((a,b)=>b.pts-a.pts);

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <div style={{flex:1}}>
          <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>Achievements & Milestones</h2>
          <p style={{color:"#BECBD9",fontSize:13,marginTop:4}}>Earn badges. Collect titles. Leave a mark.</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{display:"flex",gap:6,marginBottom:20,background:"#111827",borderRadius:10,padding:4}}>
        {[["achievements","🏅 Achievements"],["milestones","📈 Season Milestones"],["leaderboard","🏆 Achievement Leaders"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{flex:1,padding:"8px 12px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
              background:tab===v?"#1E2A3A":"transparent",
              color:tab===v?"#F2EDE4":"#BECBD9",transition:"all .15s"}}>
            {l}
          </button>
        ))}
      </div>

      {tab==="achievements"&&(
        <>
          {/* My progress (if logged in) */}
          {myPlayer&&(
            <Panel style={{padding:"16px",marginBottom:20,background:"rgba(155,114,207,.04)",border:"1px solid rgba(155,114,207,.2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:4}}>Your Progress</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {tierOrder.map(tier=>{
                      const earned=ACHIEVEMENTS.filter(a=>a.tier===tier&&a.check(myPlayer)).length;
                      const total=ACHIEVEMENTS.filter(a=>a.tier===tier).length;
                      return(
                        <div key={tier} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"6px 12px",textAlign:"center"}}>
                          <div style={{fontSize:11,fontWeight:700,color:tierCols[tier]}}>{tierLabels[tier]}</div>
                          <div style={{fontSize:16,fontWeight:800,color:"#F2EDE4",marginTop:2}}>{earned}<span style={{fontSize:12,color:"#BECBD9"}}>/{total}</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div className="mono" style={{fontSize:28,fontWeight:800,color:"#9B72CF"}}>{ACHIEVEMENTS.filter(a=>a.check(myPlayer)).length}</div>
                  <div style={{fontSize:11,color:"#BECBD9"}}>of {ACHIEVEMENTS.length} unlocked</div>
                </div>
              </div>
            </Panel>
          )}

          {/* Tier filter */}
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {[["all","All"],["bronze","Bronze"],["silver","Silver"],["gold","Gold"],["legendary","Legendary"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFilterTier(v)}
                style={{padding:"6px 14px",borderRadius:20,border:"1px solid "+(filterTier===v?(v==="all"?"rgba(242,237,228,.4)":tierCols[v]+"88"):"rgba(242,237,228,.1)"),
                  background:filterTier===v?(v==="all"?"rgba(242,237,228,.06)":tierCols[v]+"22"):"transparent",
                  color:filterTier===v?(v==="all"?"#F2EDE4":tierCols[v]):"#BECBD9",
                  fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                {l}
              </button>
            ))}
          </div>

          {/* Achievement grid */}
          <div className="grid-2" style={{gap:10}}>
            {filteredAch.map(a=>{
              const unlocked=myPlayer?a.check(myPlayer):false;
              const earnedBy=players.filter(p=>{try{return a.check(p);}catch{return false;}}).length;
              const col=tierCols[a.tier];
              return(
                <div key={a.id} style={{
                  background:unlocked?"rgba("+
                    (a.tier==="legendary"?"155,114,207":a.tier==="gold"?"232,168,56":a.tier==="silver"?"192,192,192":"205,127,50")
                    +",.06)":"rgba(255,255,255,.02)",
                  border:"1px solid "+(unlocked?col+"44":"rgba(242,237,228,.07)"),
                  borderRadius:12,padding:"16px",
                  opacity:myPlayer&&!unlocked?.55:1,
                  transition:"all .2s"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{width:44,height:44,borderRadius:10,
                      background:unlocked?col+"22":"rgba(255,255,255,.04)",
                      border:"1px solid "+(unlocked?col+"55":"rgba(242,237,228,.08)"),
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:22,flexShrink:0,
                      boxShadow:unlocked?"0 0 12px "+col+"33":"none"}}>
                      {a.icon}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <span style={{fontWeight:700,fontSize:14,color:unlocked?col:"#C8D4E0"}}>{a.name}</span>
                        <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,
                          background:col+"22",color:col,border:"1px solid "+col+"44"}}>
                          {tierLabels[a.tier]}
                        </span>
                        {unlocked&&<span style={{fontSize:12,color:"#6EE7B7"}}>✓</span>}
                      </div>
                      <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5,marginBottom:6}}>{a.desc}</div>
                      <div style={{fontSize:11,color:"#9AAABF"}}>{earnedBy} player{earnedBy!==1?"s":""} earned this</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab==="milestones"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {MILESTONES.map(m=>{
            const myUnlocked=myPlayer?m.check(myPlayer):false;
            const earnedBy=players.filter(p=>{try{return m.check(p);}catch{return false;}}).length;
            const pctProgress=m.pts&&myPlayer?Math.min(100,Math.round(myPlayer.pts/m.pts*100)):myUnlocked?100:0;
            return(
              <Panel key={m.id} style={{padding:"18px",border:"1px solid "+(myUnlocked?"rgba(232,168,56,.3)":"rgba(242,237,228,.08)")}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:52,height:52,borderRadius:12,
                    background:myUnlocked?"rgba(232,168,56,.12)":"rgba(255,255,255,.03)",
                    border:"1px solid "+(myUnlocked?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:26,flexShrink:0}}>
                    {m.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{m.name}</span>
                      {myUnlocked&&<span style={{fontSize:12,color:"#6EE7B7",fontWeight:700}}>✓ Unlocked</span>}
                    </div>
                    {m.pts&&(
                      <div style={{marginBottom:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:"#BECBD9"}}>{myPlayer?myPlayer.pts:0} / {m.pts} pts</span>
                          <span style={{fontSize:12,color:"#E8A838",fontWeight:700}}>{pctProgress}%</span>
                        </div>
                        <div style={{height:4,background:"rgba(242,237,228,.08)",borderRadius:4}}>
                          <div style={{width:pctProgress+"%",height:"100%",background:"linear-gradient(90deg,#E8A838,#C8882A)",borderRadius:4,transition:"width .3s"}}/>
                        </div>
                      </div>
                    )}
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:6,padding:"4px 10px"}}>
                      <span style={{fontSize:11}}>🎁</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>{m.reward}</span>
                    </div>
                    <div style={{fontSize:11,color:"#9AAABF",marginTop:6}}>{earnedBy} player{earnedBy!==1?"s":""} unlocked this</div>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {tab==="leaderboard"&&(
        <Panel style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",margin:0}}>Achievement Leaderboard</h3>
            <p style={{fontSize:12,color:"#BECBD9",margin:"4px 0 0"}}>Most achievements earned this season</p>
          </div>
          {sorted.map((p,i)=>{
            const earned=ACHIEVEMENTS.filter(a=>{try{return a.check(p);}catch{return false;}});
            const legendary=earned.filter(a=>a.tier==="legendary").length;
            const gold=earned.filter(a=>a.tier==="gold").length;
            return(
              <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                  borderBottom:"1px solid rgba(242,237,228,.05)",cursor:"pointer",
                  background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(232,168,56,.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,.01)"}>
                <div className="mono" style={{minWidth:24,fontSize:13,fontWeight:800,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF"}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>{p.name}</div>
                  <div style={{display:"flex",gap:4}}>
                    {legendary>0&&<span style={{fontSize:10,fontWeight:700,background:"rgba(155,114,207,.15)",color:"#9B72CF",padding:"2px 7px",borderRadius:8}}>{legendary}⚜️</span>}
                    {gold>0&&<span style={{fontSize:10,fontWeight:700,background:"rgba(232,168,56,.12)",color:"#E8A838",padding:"2px 7px",borderRadius:8}}>{gold}🥇</span>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="mono" style={{fontSize:18,fontWeight:800,color:"#9B72CF"}}>{earned.length}</div>
                  <div style={{fontSize:10,color:"#BECBD9"}}>achievements</div>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}



function ChallengesScreen({currentUser,players,toast}){
  const [tab,setTab]=useState("active");
  // Simulate time
  const dailyReset="23h 14m";
  const weeklyReset="4d 7h";

  // Find user's player if linked
  const linked=players.find(p=>p.name===currentUser?.username);
  const xp=linked?estimateXp(linked):0;
  const rankInfo=getXpProgress(xp);

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
      </div>
      <div style={{marginBottom:20}}>
        <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:4}}>Challenges</h2>
        <p style={{fontSize:13,color:"#BECBD9"}}>Complete challenges to earn XP and climb the platform ranks.</p>
      </div>

      {/* XP / Rank overview */}
      <Panel style={{padding:"20px",marginBottom:20,background:"linear-gradient(135deg,rgba(232,168,56,.06),rgba(8,8,15,.98))"}}>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:36,animation:"crown-glow 3s infinite"}}>{rankInfo.rank.icon}</div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:16,fontWeight:700,color:rankInfo.rank.color}}>{rankInfo.rank.name}</span>
              {rankInfo.next&&<span style={{fontSize:12,color:"#BECBD9"}}>→ {rankInfo.next.icon} {rankInfo.next.name}</span>}
            </div>
            <Bar val={rankInfo.current} max={rankInfo.needed||1} color={rankInfo.rank.color} h={6}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span className="mono" style={{fontSize:11,color:"#BECBD9"}}>{xp} total XP</span>
              <span className="mono" style={{fontSize:11,color:rankInfo.rank.color}}>{rankInfo.pct}% to next rank</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18}}>
        {["active","completed","xp-log"].map(t=>(
          <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t==="xp-log"?"XP Log":t}</Btn>
        ))}
      </div>

      {tab==="active"&&(
        <div>
          {/* Daily */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".14em",textTransform:"uppercase"}}>Daily Challenges</div>
            <div style={{fontSize:11,color:"#BECBD9"}}>Resets in <span style={{color:"#F87171",fontWeight:700}}>{dailyReset}</span></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
            {DAILY_CHALLENGES.map(c=>(
              <div key={c.id} style={{background:"#111827",border:"1px solid rgba(242,237,228,.08)",borderRadius:12,padding:"16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>{c.name}</div>
                    <div style={{fontSize:12,color:"#C8D4E0"}}>{c.desc}</div>
                    <div style={{marginTop:8}}>
                      <Bar val={c.progress} max={c.goal} color="#E8A838" h={4}/>
                      <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{c.progress}/{c.goal} completed</div>
                    </div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div className="mono" style={{fontSize:16,fontWeight:700,color:"#E8A838"}}>+{c.xp}</div>
                    <div style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase"}}>XP</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Weekly */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase"}}>Weekly Challenges</div>
            <div style={{fontSize:11,color:"#BECBD9"}}>Resets in <span style={{color:"#9B72CF",fontWeight:700}}>{weeklyReset}</span></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {WEEKLY_CHALLENGES.map(c=>{
              const done=c.progress>=c.goal;
              return(
                <div key={c.id} style={{background:done?"rgba(82,196,124,.05)":"#111827",border:"1px solid "+(done?"rgba(82,196,124,.3)":"rgba(155,114,207,.15)"),borderRadius:12,padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:44,height:44,background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.25)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{done?"✅":c.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:14,color:done?"#6EE7B7":"#F2EDE4",marginBottom:2}}>{c.name}</div>
                      <div style={{fontSize:12,color:"#C8D4E0"}}>{c.desc}</div>
                      <div style={{marginTop:8}}>
                        <Bar val={c.progress} max={c.goal} color={done?"#6EE7B7":"#9B72CF"} h={4}/>
                        <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{c.progress}/{c.goal} {done?"- Completed! 🎉":""}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"center",flexShrink:0}}>
                      <div className="mono" style={{fontSize:16,fontWeight:700,color:done?"#6EE7B7":"#9B72CF"}}>+{c.xp}</div>
                      <div style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase"}}>XP</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="completed"&&(
        <div style={{textAlign:"center",padding:"48px 20px",color:"#BECBD9"}}>
          <div style={{fontSize:36,marginBottom:12}}>🎖️</div>
          <div style={{fontSize:15,fontWeight:600,color:"#F2EDE4",marginBottom:6}}>1 weekly challenge completed</div>
          <div style={{fontSize:13}}>Keep playing to unlock more</div>
        </div>
      )}

      {tab==="xp-log"&&(
        <Panel style={{padding:"18px"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>XP History</h3>
          {[
            {icon:"🏆",action:"Won Clash #13",xp:"+40 XP",time:"Mar 1 2026",c:"#E8A838"},
            {icon:"🎯",action:"Weekly challenge: On A Roll",xp:"+120 XP",time:"Mar 1 2026",c:"#9B72CF"},
            {icon:"🥇",action:"1st place - Top 2 finish",xp:"+50 XP",time:"Feb 28 2026",c:"#E8A838"},
            {icon:"🛡",action:"Survived top 4",xp:"+15 XP",time:"Feb 28 2026",c:"#4ECDC4"},
            {icon:"⬆",action:"Ranked up: Silver → Gold",xp:"RANK UP",time:"Feb 22 2026",c:"#EAB308"},
            {icon:"🎮",action:"Completed a game",xp:"+25 XP",time:"Feb 22 2026",c:"#BECBD9"},
          ].map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<5?"1px solid rgba(242,237,228,.05)":"none"}}>
              <div style={{width:32,height:32,background:"rgba(255,255,255,.04)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{e.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:"#F2EDE4"}}>{e.action}</div>
                <div style={{fontSize:11,color:"#BECBD9"}}>{e.time}</div>
              </div>
              <div className="mono" style={{fontSize:13,fontWeight:700,color:e.c,flexShrink:0}}>{e.xp}</div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

// ─── AUTH SCREENS ─────────────────────────────────────────────────────────────
function SignUpScreen({onSignUp,onGoLogin,onBack,toast}){
  const [step,setStep]=useState(1); // 1=credentials, 2=profile
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [pw2,setPw2]=useState("");
  const [username,setUsername]=useState("");
  const [riotId,setRiotId]=useState("");
  const [region,setRegion]=useState("EUW");
  const [secondRiotId,setSecondRiotId]=useState("");
  const [secondRegion,setSecondRegion]=useState("NA");
  const [bio,setBio]=useState("");
  const [twitch,setTwitch]=useState("");
  const [twitter,setTwitter]=useState("");
  const [youtube,setYoutube]=useState("");
  const [loading,setLoading]=useState(false);

  function nextStep(){
    if(!email.trim()||!pw.trim()){toast("Email and password required","error");return;}
    if(pw!==pw2){toast("Passwords don't match","error");return;}
    if(pw.length<6){toast("Password must be 6+ characters","error");return;}
    if(!username.trim()){toast("Username required","error");return;}
    setStep(2);
  }

  async function submit(){
    if(!riotId.trim()){toast("Riot ID required","error");return;}
    setLoading(true);
    const {data,error}=await supabase.auth.signUp({
      email:email.trim(),password:pw,
      options:{data:{username:username.trim(),riot_id:riotId.trim(),region,bio:bio.trim(),twitch:twitch.trim(),twitter:twitter.trim(),youtube:youtube.trim()}}
    });
    if(!error)await supabase.from('players').insert({username:username.trim(),riot_id:riotId.trim(),region});
    setLoading(false);
    if(error){toast(error.message,"error");return;}
    onSignUp({...data.user,username:username.trim()});
    toast("Welcome to TFT Clash, "+username.trim()+"! 🎉","success");
  }

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:480}}>
        {/* Back button */}
        <div style={{marginBottom:16}}>
          <button onClick={step===2?()=>setStep(1):onBack}
            style={{background:"none",border:"none",cursor:"pointer",color:"#9AAABF",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,padding:"4px 0",transition:"color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="#F2EDE4"}
            onMouseLeave={e=>e.currentTarget.style.color="#9AAABF"}>
            ← {step===2?"Back":"Back to home"}
          </button>
        </div>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:72,height:72,objectFit:"contain",marginBottom:12}}/>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:28,fontWeight:900,color:"#E8A838",letterSpacing:"-.01em"}}>TFT Clash</div>
          <div style={{fontSize:13,color:"#BECBD9",marginTop:4}}>Create your account</div>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:28,justifyContent:"center"}}>
          {["Credentials","Your Profile"].map((label,i)=>{
            const active=step===i+1,done=step>i+1;
            return(
              <div key={i} style={{display:"contents"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:"50%",
                    background:active?"#E8A838":done?"rgba(82,196,124,.2)":"rgba(255,255,255,.05)",
                    border:"1px solid "+(active?"#E8A838":done?"rgba(82,196,124,.5)":"rgba(242,237,228,.12)"),
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,color:active?"#08080F":done?"#6EE7B7":"#9AAABF"}}>
                    {done?"✓":i+1}
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:active?"#E8A838":done?"#6EE7B7":"#9AAABF"}}>{label}</span>
                </div>
                {i===0&&<div style={{width:40,height:1,background:"rgba(242,237,228,.12)",margin:"0 10px"}}/>}
              </div>
            );
          })}
        </div>

        <Panel style={{padding:"28px 24px"}}>
          {step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <button onClick={async()=>{await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:window.location.origin}});}}
                style={{width:"100%",padding:"10px 14px",background:"#5865F2",border:"none",borderRadius:8,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:13,fontWeight:700,color:"#fff",transition:"opacity .15s"}}
                onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                <svg width="16" height="12" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z"/></svg>
                Sign up with Discord
              </button>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:1,background:"rgba(242,237,228,.1)"}}/>
                <span style={{fontSize:11,color:"#9AAABF",whiteSpace:"nowrap"}}>or with email</span>
                <div style={{flex:1,height:1,background:"rgba(242,237,228,.1)"}}/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Email</div>
                <Inp value={email} onChange={setEmail} placeholder="you@email.com" type="email"/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Username</div>
                <Inp value={username} onChange={setUsername} placeholder="Your display name"/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Password</div>
                <Inp value={pw} onChange={setPw} placeholder="6+ characters" type="password"/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Confirm Password</div>
                <Inp value={pw2} onChange={setPw2} placeholder="Repeat password" type="password" onKeyDown={e=>e.key==="Enter"&&nextStep()}/>
              </div>
              <Btn v="primary" full onClick={nextStep} style={{marginTop:4}}>Continue →</Btn>
            </div>
          )}

          {step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Riot ID <span style={{color:"#F87171"}}>*</span></div>
                <Inp value={riotId} onChange={setRiotId} placeholder="Name#TAG"/>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Main Region</div>
                <Sel value={region} onChange={setRegion}>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</Sel>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Bio <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
                <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell the lobby who you are..."
                  style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,
                    padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:72,
                    outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <div style={{background:"rgba(232,168,56,.04)",border:"1px solid rgba(232,168,56,.15)",borderRadius:10,padding:"14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#E8A838",marginBottom:10}}>Social Links <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[["🟣 Twitch",twitch,setTwitch,"twitch.tv/yourname"],["🐦 Twitter",twitter,setTwitter,"@yourhandle"],["🔴 YouTube",youtube,setYoutube,"youtube.com/yourchannel"]].map(([label,val,setter,ph])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,minWidth:90,color:"#C8D4E0"}}>{label}</span>
                      <Inp value={val} onChange={setter} placeholder={ph}/>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <Btn v="dark" onClick={()=>setStep(1)}>← Back</Btn>
                <Btn v="primary" full onClick={submit} disabled={loading}>{loading?"Creating account...":"Create Account 🎉"}</Btn>
              </div>
            </div>
          )}
        </Panel>

        <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#BECBD9"}}>
          Already have an account?{" "}
          <span onClick={onGoLogin} style={{color:"#E8A838",fontWeight:600,cursor:"pointer"}}>Sign in</span>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({onLogin,onGoSignUp,onBack,toast}){
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [loading,setLoading]=useState(false);

  async function submit(){
    if(!email.trim()||!pw.trim()){toast("Email and password required","error");return;}
    setLoading(true);
    const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});
    setLoading(false);
    if(error){toast(error.message,"error");return;}
    onLogin({...data.user,username:data.user.user_metadata?.username||data.user.email});
    toast("Welcome back, "+(data.user.user_metadata?.username||"player")+"! 👋","success");
  }

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:420}}>
        {/* Back button */}
        <div style={{marginBottom:16}}>
          <button onClick={onBack}
            style={{background:"none",border:"none",cursor:"pointer",color:"#9AAABF",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,padding:"4px 0",transition:"color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color="#F2EDE4"}
            onMouseLeave={e=>e.currentTarget.style.color="#9AAABF"}>
            ← Back to home
          </button>
        </div>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:72,height:72,objectFit:"contain",marginBottom:12}}/>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:28,fontWeight:900,color:"#E8A838"}}>TFT Clash</div>
          <div style={{fontSize:13,color:"#BECBD9",marginTop:4}}>Sign in to your account</div>
        </div>

        <Panel style={{padding:"28px 24px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Email</div>
              <Inp value={email} onChange={setEmail} placeholder="you@email.com" type="email"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Password</div>
              <Inp value={pw} onChange={setPw} placeholder="Your password" type="password" onKeyDown={e=>e.key==="Enter"&&submit()}/>
            </div>
            <div style={{textAlign:"right",marginTop:-6}}>
              <span style={{fontSize:12,color:"#E8A838",cursor:"pointer"}}>Forgot password?</span>
            </div>
            <Btn v="primary" full onClick={submit} disabled={loading}>{loading?"Signing in...":"Sign In"}</Btn>
            <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}>
              <div style={{flex:1,height:1,background:"rgba(242,237,228,.1)"}}/>
              <span style={{fontSize:11,color:"#9AAABF",whiteSpace:"nowrap"}}>or</span>
              <div style={{flex:1,height:1,background:"rgba(242,237,228,.1)"}}/>
            </div>
            <button onClick={async()=>{await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:window.location.origin}});}}
              style={{width:"100%",padding:"10px 14px",background:"#5865F2",border:"none",borderRadius:8,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:13,fontWeight:700,color:"#fff",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <svg width="16" height="12" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z"/></svg>
              Continue with Discord
            </button>
          </div>
        </Panel>

        <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#BECBD9"}}>
          No account?{" "}
          <span onClick={onGoSignUp} style={{color:"#E8A838",fontWeight:600,cursor:"pointer"}}>Create one free</span>
        </div>
        <div style={{textAlign:"center",marginTop:8,fontSize:12,color:"#9AAABF"}}>
          Playing without an account?{" "}
          <span onClick={()=>onLogin(null)} style={{color:"#BECBD9",cursor:"pointer",textDecoration:"underline"}}>Continue as guest</span>
        </div>
      </div>
    </div>
  );
}

function AccountScreen({user,onUpdate,onLogout,toast,setScreen,players,setProfilePlayer}){
  const [tab,setTab]=useState("profile");
  const [edit,setEdit]=useState(false);
  const [bio,setBio]=useState(user.bio||"");
  const [twitch,setTwitch]=useState(user.twitch||"");
  const [twitter,setTwitter]=useState(user.twitter||"");
  const [youtube,setYoutube]=useState(user.youtube||"");
  const [usernameEdit,setUsernameEdit]=useState(user.username||"");
  const [riotId,setRiotId]=useState(user.user_metadata?.riotId||"");
  const [riotRegion,setRiotRegion]=useState(user.user_metadata?.riotRegion||"EUW");
  const [secondRiotId,setSecondRiotId]=useState(user.user_metadata?.secondRiotId||user.secondRiotId||"");
  const [secondRegion,setSecondRegion]=useState(user.user_metadata?.secondRegion||user.secondRegion||"EUW");

  const usernameChanged=!!(user.user_metadata?.username_changed);
  const riotIdSet=!!(user.user_metadata?.riotId);
  const EU_NA=["EUW","EUNE","NA"];

  const linkedPlayer=players.find(p=>p.id===user.linkedPlayerId||p.name===user.username);
  const s=linkedPlayer?computeStats(linkedPlayer):null;
  const myAchievements=linkedPlayer?ACHIEVEMENTS.filter(a=>{try{return a.check(linkedPlayer);}catch{return false;}}):[];
  const tierCols={bronze:"#CD7F32",silver:"#C0C0C0",gold:"#E8A838",legendary:"#9B72CF"};

  async function save(){
    const meta={
      ...(user.user_metadata||{}),
      bio,twitch,twitter,youtube,
      secondRiotId,secondRegion,
    };
    // Username: only set username_changed on first deliberate change
    if(!usernameChanged&&usernameEdit.trim()&&usernameEdit.trim()!==user.username){
      meta.username=usernameEdit.trim();
      meta.username_changed=true;
    }
    // Riot ID: only set once
    if(!riotIdSet&&riotId.trim()){
      meta.riotId=riotId.trim();
      meta.riotRegion=riotRegion;
      meta.riotIdSet=true;
    }
    try{
      await supabase.auth.updateUser({data:meta});
    }catch(e){console.warn("Supabase update failed",e);}
    onUpdate({...user,...meta,username:meta.username||user.username,user_metadata:meta,region:riotRegion,mainRegion:riotRegion,secondRiotId,secondRegion});
    setEdit(false);
    toast("Profile updated ✓","success");
  }

  async function requestChange(field){
    const pending=(user.user_metadata?.pending_changes||[]).concat([{field,requestedAt:new Date().toISOString()}]);
    try{await supabase.auth.updateUser({data:{...(user.user_metadata||{}),pending_changes:pending}});}catch{}
    toast("Change request submitted — an admin will review it","success");
  }

  const rankColor=linkedPlayer?rc(linkedPlayer.rank):"#9B72CF";
  const myMilestones=linkedPlayer?MILESTONES.filter(m=>{try{return m.check(linkedPlayer);}catch{return false;}}):[];

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1}}>My Account</h2>
        <Btn v="dark" s="sm" onClick={onLogout}>Sign Out</Btn>
      </div>

      {/* Hero card */}
      <div style={{position:"relative",background:"linear-gradient(135deg,rgba("+
        (linkedPlayer?rc(linkedPlayer.rank).replace("#","").match(/../g).map(h=>parseInt(h,16)).join(","):"155,114,207")
        +",.12) 0%,rgba(8,8,15,1) 100%)",
        border:"1px solid rgba(242,237,228,.12)",borderRadius:16,padding:"28px 24px",marginBottom:20,overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,"+rankColor+",transparent)"}}/>
        <div style={{display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap"}}>
          {/* Avatar */}
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:80,height:80,borderRadius:"50%",
              background:"linear-gradient(135deg,"+rankColor+"44,"+rankColor+"11)",
              border:"3px solid "+rankColor+"66",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:32,fontWeight:800,color:rankColor}}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            {myMilestones.length>0&&(
              <div style={{position:"absolute",bottom:-2,right:-2,width:22,height:22,borderRadius:"50%",background:"#E8A838",border:"2px solid #08080F",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
                {myMilestones[myMilestones.length-1].icon}
              </div>
            )}
          </div>
          {/* Name + info */}
          <div style={{flex:1,minWidth:200}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
              <h2 style={{fontSize:24,fontWeight:900,color:"#F2EDE4",margin:0}}>{user.username}</h2>
              {linkedPlayer&&<ClashRankBadge rank={linkedPlayer.rank}/>}
              {linkedPlayer&&isHotStreak(linkedPlayer)&&<span style={{fontSize:14}}>🔥</span>}
            </div>
            {linkedPlayer&&(
              <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>{linkedPlayer.riotId} · {linkedPlayer.region}</div>
            )}
            {user.bio?(
              <p style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6,margin:0,maxWidth:480}}>{user.bio}</p>
            ):(
              <p style={{fontSize:13,color:"#9AAABF",fontStyle:"italic",margin:0}}>No bio yet - tell people who you are.</p>
            )}
            {/* Socials */}
            {(user.twitch||user.twitter||user.youtube)&&(
              <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                {user.twitch&&<a href={"https://twitch.tv/"+user.twitch} target="_blank" style={{fontSize:11,color:"#9147FF",background:"rgba(145,71,255,.1)",border:"1px solid rgba(145,71,255,.3)",borderRadius:6,padding:"3px 10px",textDecoration:"none",fontWeight:700}}>📺 {user.twitch}</a>}
                {user.twitter&&<a href={"https://twitter.com/"+user.twitter} target="_blank" style={{fontSize:11,color:"#1DA1F2",background:"rgba(29,161,242,.1)",border:"1px solid rgba(29,161,242,.3)",borderRadius:6,padding:"3px 10px",textDecoration:"none",fontWeight:700}}>🐦 {user.twitter}</a>}
              </div>
            )}
          </div>
          {/* Quick pts */}
          {linkedPlayer&&(
            <div style={{textAlign:"center",flexShrink:0}}>
              <div className="mono" style={{fontSize:40,fontWeight:900,color:"#E8A838",lineHeight:1}}>{linkedPlayer.pts}</div>
              <div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>Clash Points</div>
              <div style={{fontSize:12,color:"#C8D4E0",marginTop:4}}>Season Rank #{[...players].sort((a,b)=>b.pts-a.pts).findIndex(p=>p.id===linkedPlayer.id)+1}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"#111827",borderRadius:10,padding:4}}>
        {[["profile","👤 Profile"],["stats","📊 Stats"],["achievements","🏅 Achievements"],["history","📋 History"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:"8px 10px",borderRadius:7,border:"none",cursor:"pointer",
            fontWeight:700,fontSize:12,background:tab===v?"#1E2A3A":"transparent",
            color:tab===v?"#F2EDE4":"#BECBD9",transition:"all .15s"}}>
            {l}
          </button>
        ))}
      </div>

      {tab==="profile"&&(
        <Panel style={{padding:"20px"}}>
          {!edit?(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{color:"#F2EDE4",fontSize:15,margin:0}}>Profile Details</h3>
                <Btn v="dark" s="sm" onClick={()=>setEdit(true)}>✏️ Edit</Btn>
              </div>
              <div style={{display:"grid",gap:12}}>
                {[
                  ["Username",user.username,usernameChanged?"#9B72CF":"#F2EDE4"],
                  ["Riot ID",user.user_metadata?.riotId?(user.user_metadata.riotId+" · "+user.user_metadata.riotRegion):null,"#E8A838"],
                  ["Secondary Riot ID",user.user_metadata?.secondRiotId?(user.user_metadata.secondRiotId+" · "+user.user_metadata.secondRegion):null,"#C4B5FD"],
                  ["Bio",user.user_metadata?.bio||user.bio||null,"#C8D4E0"],
                  ["Twitch",user.user_metadata?.twitch||user.twitch?("twitch.tv/"+(user.user_metadata?.twitch||user.twitch)):null,"#9147FF"],
                  ["Twitter",user.user_metadata?.twitter||user.twitter?("@"+(user.user_metadata?.twitter||user.twitter)):null,"#1DA1F2"],
                ].map(([label,val,col])=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
                    <span style={{color:"#BECBD9",fontSize:13}}>{label}</span>
                    <span style={{color:val?col:"#9AAABF",fontSize:13,fontWeight:val?600:400,maxWidth:280,textAlign:"right"}}>{val||"—"}</span>
                  </div>
                ))}
              </div>
              {/* Discord connection */}
              {(()=>{
                const discordId=user.identities?.find(i=>i.provider==='discord')?.identity_data?.sub;
                const discordName=user.identities?.find(i=>i.provider==='discord')?.identity_data?.global_name||user.identities?.find(i=>i.provider==='discord')?.identity_data?.full_name;
                return(
                  <div style={{marginTop:20,padding:"14px 16px",background:"rgba(88,101,242,.06)",border:"1px solid rgba(88,101,242,.25)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <svg width="20" height="15" viewBox="0 0 71 55" fill="#5865F2" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z"/></svg>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:discordId?"#6EE7B7":"#C8D4E0"}}>Discord {discordId?"Connected":"Not Connected"}</div>
                        {discordId?<div style={{fontSize:11,color:"#9AAABF"}}>{discordName||"ID: "+discordId}</div>:<div style={{fontSize:11,color:"#9AAABF"}}>Link to auto-sync with our Discord bot</div>}
                      </div>
                    </div>
                    {!discordId?(
                      <button onClick={async()=>{await supabase.auth.linkIdentity({provider:'discord',options:{redirectTo:window.location.origin+"#account"}});}}
                        style={{padding:"7px 14px",background:"#5865F2",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0,transition:"opacity .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                        Connect Discord
                      </button>
                    ):(
                      <button onClick={async()=>{
                        if(!window.confirm("Disconnect Discord? You'll need a password to log in."))return;
                        try{await supabase.auth.unlinkIdentity(user.identities.find(i=>i.provider==='discord'));toast("Discord disconnected","success");onLogout();}
                        catch(e){toast("Could not disconnect: "+e.message,"error");}
                      }} style={{padding:"7px 14px",background:"rgba(220,38,38,.12)",border:"1px solid rgba(220,38,38,.4)",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,color:"#F87171",flexShrink:0}}>
                        Disconnect
                      </button>
                    )}
                  </div>
                );
              })()}
              {/* Danger zone */}
              <div style={{marginTop:20,padding:"14px 16px",background:"rgba(220,38,38,.04)",border:"1px solid rgba(220,38,38,.2)",borderRadius:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#F87171",marginBottom:6}}>Danger Zone</div>
                <div style={{fontSize:12,color:"#9AAABF",marginBottom:10}}>Permanently delete your account and all data. This cannot be undone.</div>
                <button onClick={async()=>{
                  if(!window.confirm("Delete your account permanently? This cannot be undone."))return;
                  try{await supabase.auth.admin?.deleteUser?.(user.id).catch(()=>{});await supabase.auth.signOut();onLogout();toast("Account deleted","success");}
                  catch(e){await supabase.auth.signOut();onLogout();}
                }} style={{padding:"7px 14px",background:"rgba(220,38,38,.15)",border:"1px solid rgba(220,38,38,.5)",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,color:"#F87171"}}>
                  Delete Account
                </button>
              </div>
            </>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{color:"#F2EDE4",fontSize:15,margin:0}}>Edit Profile</h3>
                <div style={{display:"flex",gap:8}}>
                  <Btn v="dark" s="sm" onClick={()=>setEdit(false)}>Cancel</Btn>
                  <Btn v="primary" s="sm" onClick={save}>Save Changes</Btn>
                </div>
              </div>
              <div style={{display:"grid",gap:16}}>
                {/* Username — change once */}
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{fontSize:12,color:"#BECBD9"}}>Username {usernameChanged&&<span style={{color:"#9B72CF",fontSize:11}}>(locked — changed once)</span>}</div>
                  </div>
                  {usernameChanged?(
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{flex:1,background:"#0F1520",border:"1px solid rgba(242,237,228,.08)",borderRadius:8,padding:"9px 12px",color:"#9AAABF",fontSize:13}}>{user.username}</div>
                      <Btn v="dark" s="sm" onClick={()=>requestChange("username")}>Request Change</Btn>
                    </div>
                  ):(
                    <>
                      <Inp value={usernameEdit} onChange={setUsernameEdit} placeholder="Your display name"/>
                      <div style={{fontSize:11,color:"#9AAABF",marginTop:4}}>You can only change this once. After that, contact admin.</div>
                    </>
                  )}
                </div>
                {/* Main Riot ID — locked after set */}
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>Main Riot ID {riotIdSet&&<span style={{color:"#E8A838",fontSize:11}}>(locked)</span>}</div>
                  {riotIdSet?(
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{flex:1,background:"#0F1520",border:"1px solid rgba(232,168,56,.15)",borderRadius:8,padding:"9px 12px",color:"#E8A838",fontSize:13,fontWeight:600}}>{user.user_metadata?.riotId} · {user.user_metadata?.riotRegion}</div>
                      <Btn v="dark" s="sm" onClick={()=>requestChange("riotId")}>Request Change</Btn>
                    </div>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 100px",gap:8}}>
                      <Inp value={riotId} onChange={setRiotId} placeholder="GameName#TAG"/>
                      <Sel value={riotRegion} onChange={setRiotRegion}>
                        {EU_NA.map(r=><option key={r} value={r}>{r}</option>)}
                      </Sel>
                    </div>
                  )}
                  <div style={{fontSize:11,color:"#9AAABF",marginTop:4}}>EU and NA accounts only. Cannot be changed without admin approval.</div>
                </div>
                {/* Secondary Riot ID */}
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>Secondary Riot ID <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 100px",gap:8}}>
                    <Inp value={secondRiotId} onChange={setSecondRiotId} placeholder="SecondName#TAG"/>
                    <Sel value={secondRegion} onChange={setSecondRegion}>
                      {EU_NA.map(r=><option key={r} value={r}>{r}</option>)}
                    </Sel>
                  </div>
                  <div style={{fontSize:11,color:"#9AAABF",marginTop:4}}>For players on both EU and NA. EU and NA only.</div>
                </div>
                {/* Bio */}
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>Bio</div>
                  <textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={160}
                    placeholder="Tell people who you are..."
                    style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.15)",borderRadius:8,
                      padding:"10px 12px",color:"#F2EDE4",fontSize:13,resize:"none",height:72,fontFamily:"inherit",boxSizing:"border-box"}}/>
                  <div style={{fontSize:11,color:"#9AAABF",marginTop:2,textAlign:"right"}}>{bio.length}/160</div>
                </div>
                {/* Socials */}
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>Twitch username</div>
                  <Inp value={twitch} onChange={setTwitch} placeholder="your_twitch_name"/>
                </div>
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>Twitter / X handle</div>
                  <Inp value={twitter} onChange={setTwitter} placeholder="@yourhandle"/>
                </div>
              </div>
            </>
          )}
        </Panel>
      )}

      {tab==="stats"&&(
        <>
          {linkedPlayer&&s?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                {[
                  {l:"Clash Points",v:linkedPlayer.pts,c:"#E8A838"},
                  {l:"Total Wins",v:linkedPlayer.wins,c:"#6EE7B7"},
                  {l:"Top 4 Rate",v:s.top4Rate+"%",c:"#C4B5FD"},
                  {l:"Avg Placement",v:s.avgPlacement,c:avgCol(s.avgPlacement)},
                  {l:"Games Played",v:linkedPlayer.games,c:"#4ECDC4"},
                  {l:"Best Streak",v:linkedPlayer.bestStreak+"🔥",c:"#F87171"},
                  {l:"PPG",v:s.ppg,c:"#EAB308"},
                  {l:"Clutch Rate",v:s.clutchRate+"%",c:"#9B72CF"},
                ].map(({l,v,c})=>(
                  <div key={l} style={{background:"#111827",border:"1px solid rgba(242,237,228,.08)",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
                    <div className="mono" style={{fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                    <div style={{fontSize:10,color:"#BECBD9",marginTop:5,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
                  </div>
                ))}
              </div>
              {/* Sparkline */}
              {linkedPlayer.sparkline&&linkedPlayer.sparkline.length>0&&(
                <Panel style={{padding:"16px"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:10}}>Points Trend</div>
                  <Sparkline data={linkedPlayer.sparkline} color="#E8A838" height={60}/>
                </Panel>
              )}
            </>
          ):(
            <div style={{textAlign:"center",padding:"48px 20px"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{color:"#BECBD9",fontSize:14}}>No stats linked to your account yet.</div>
              <div style={{color:"#9AAABF",fontSize:12,marginTop:6}}>Your account name must match a registered player.</div>
            </div>
          )}
        </>
      )}

      {tab==="achievements"&&(
        <div>
          {linkedPlayer?(
            <>
              <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:700,color:"#F2EDE4"}}>{myAchievements.length} of {ACHIEVEMENTS.length} unlocked</span>
                {["legendary","gold","silver","bronze"].map(tier=>{
                  const n=myAchievements.filter(a=>a.tier===tier).length;
                  return n>0?<span key={tier} style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:10,
                    background:tierCols[tier]+"22",color:tierCols[tier],border:"1px solid "+tierCols[tier]+"44"}}>
                    {n} {tier}
                  </span>:null;
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}}>
                {ACHIEVEMENTS.map(a=>{
                  const unlocked=a.check(linkedPlayer);
                  const col=tierCols[a.tier];
                  return(
                    <div key={a.id} style={{background:unlocked?col+"11":"rgba(255,255,255,.02)",
                      border:"1px solid "+(unlocked?col+"44":"rgba(242,237,228,.06)"),
                      borderRadius:10,padding:"12px",opacity:unlocked?1:.5,
                      display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{fontSize:22,flexShrink:0}}>{a.icon}</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:unlocked?col:"#BECBD9"}}>{a.name}</div>
                        <div style={{fontSize:11,color:"#9AAABF",marginTop:2}}>{a.desc}</div>
                      </div>
                      {unlocked&&<div style={{marginLeft:"auto",color:"#6EE7B7",fontSize:14,flexShrink:0}}>✓</div>}
                    </div>
                  );
                })}
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"48px 20px",color:"#BECBD9"}}>No player data linked yet.</div>
          )}
        </div>
      )}

      {tab==="history"&&(
        <Panel style={{overflow:"hidden"}}>
          <div style={{padding:"13px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",margin:0}}>Clash History</h3>
          </div>
          {linkedPlayer&&(linkedPlayer.clashHistory||[]).length>0?(
            (linkedPlayer.clashHistory||[]).map((g,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderBottom:"1px solid rgba(242,237,228,.05)"}}>
                <div style={{width:36,height:36,borderRadius:8,
                  background:g.placement===1?"rgba(232,168,56,.12)":g.placement<=4?"rgba(82,196,124,.08)":"rgba(255,255,255,.03)",
                  border:"1px solid "+(g.placement===1?"rgba(232,168,56,.4)":g.placement<=4?"rgba(82,196,124,.25)":"rgba(242,237,228,.08)"),
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,fontWeight:800,
                  color:g.placement===1?"#E8A838":g.placement<=4?"#6EE7B7":"#BECBD9",
                  flexShrink:0}}>#{g.placement}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>
                    {g.placement===1?"🏆 Victory":g.placement<=4?"Top 4 Finish":"Outside Top 4"}
                    {g.clutch&&<span style={{marginLeft:6,fontSize:11,color:"#9B72CF",fontWeight:700}}>⚡ Clutch</span>}
                  </div>
                  <div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>
                    R1: #{g.r1} · R2: #{g.r2} · R3: #{g.r3}
                  </div>
                </div>
                <div className="mono" style={{fontSize:14,fontWeight:700,color:"#E8A838"}}>{g.pts||"-"}pts</div>
              </div>
            ))
          ):(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#9AAABF"}}>No clash history yet.</div>
          )}
        </Panel>
      )}
    </div>
  );
}



function SeasonRecapScreen({player,players,toast,setScreen}){
  const s=computeStats(player);
  const awards=computeClashAwards(players).filter(a=>a.winner?.id===player.id);
  const rank=getClashRank(estimateXp(player));
  const sorted=[...players].sort((a,b)=>b.pts-a.pts);
  const position=sorted.findIndex(p=>p.id===player.id)+1;

  function downloadRecap(){
    const canvas=document.createElement("canvas");
    canvas.width=800;canvas.height=1000;
    const ctx=canvas.getContext("2d");

    // Background
    const bg=ctx.createLinearGradient(0,0,800,1000);
    bg.addColorStop(0,"#0A0F1A");bg.addColorStop(0.5,"#0D1225");bg.addColorStop(1,"#08080F");
    ctx.fillStyle=bg;ctx.fillRect(0,0,800,1000);

    // Top gold bar
    const gold=ctx.createLinearGradient(0,0,800,0);
    gold.addColorStop(0,"transparent");gold.addColorStop(0.3,"#E8A838");gold.addColorStop(0.7,"#FFD700");gold.addColorStop(1,"transparent");
    ctx.fillStyle=gold;ctx.fillRect(0,0,800,3);

    // Header
    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="4px";
    ctx.fillText("TFT CLASH - SEASON 16 RECAP",40,50);ctx.letterSpacing="0px";

    // Big name
    ctx.font="bold 52px serif";ctx.fillStyle="#F2EDE4";
    ctx.fillText(player.name,40,120);

    // Rank badge
    ctx.font="bold 14px monospace";ctx.fillStyle=rank.color;
    ctx.fillText(rank.icon+" "+rank.name.toUpperCase(),40,150);

    // Season position
    ctx.font="bold 11px monospace";ctx.fillStyle="#BECBD9";ctx.letterSpacing="2px";
    ctx.fillText("SEASON RANKING",40,210);ctx.letterSpacing="0px";
    ctx.font="bold 80px monospace";ctx.fillStyle="#E8A838";
    ctx.fillText("#"+position,40,290);
    ctx.font="bold 14px sans-serif";ctx.fillStyle="#C8D4E0";
    ctx.fillText("of "+players.length+" players",40,315);

    // Stats grid
    const stats=[["PTS",player.pts,"#E8A838"],["WINS",s.wins,"#6EE7B7"],["AVP",s.avgPlacement,s.avgPlacement<3?"#6EE7B7":s.avgPlacement<5?"#EAB308":"#F87171"],["TOP4",s.top4,"#C4B5FD"],["GAMES",s.games,"#C8D4E0"],["STREAK",player.bestStreak||0,"#F97316"]];
    stats.forEach(([l,v,c],i)=>{
      const x=40+(i%3)*250,y=380+Math.floor(i/3)*100;
      ctx.fillStyle="rgba(255,255,255,0.03)";
      ctx.beginPath();ctx.roundRect(x,y,220,80,8);ctx.fill();
      ctx.font="bold 28px monospace";ctx.fillStyle=c;ctx.fillText(String(v),x+16,y+46);
      ctx.font="bold 10px monospace";ctx.fillStyle="#BECBD9";ctx.letterSpacing="2px";
      ctx.fillText(l,x+16,y+66);ctx.letterSpacing="0px";
    });

    // Awards
    if(awards.length>0){
      ctx.font="bold 11px monospace";ctx.fillStyle="#9B72CF";ctx.letterSpacing="2px";
      ctx.fillText("AWARDS WON",40,610);ctx.letterSpacing="0px";
      awards.slice(0,3).forEach((a,i)=>{
        ctx.font="16px sans-serif";ctx.fillStyle="#F2EDE4";
        ctx.fillText(a.icon+" "+a.title,40,640+i*30);
      });
    }

    // Season statement
    const stmts=[`${player.name} dominated Season 16 with ${s.top1Rate}% win rate.`,`Consistent performer - AVP of ${s.avgPlacement} across ${s.games} games.`,`${player.name} showed up every week. ${s.wins} victories speak for themselves.`];
    const stmt=stmts[player.id%stmts.length];
    ctx.font="italic 15px serif";ctx.fillStyle="#C8D4E0";
    ctx.fillText(stmt.length>60?stmt.slice(0,60)+"...":stmt,40,800);

    // Footer
    ctx.fillStyle="rgba(232,168,56,0.1)";ctx.fillRect(0,940,800,60);
    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";
    ctx.fillText("TFTCLASH.GG",40,975);ctx.letterSpacing="0px";
    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";
    ctx.fillText("Season 16 · "+new Date().toLocaleDateString(),200,975);
    ctx.fillText("#TFTClash  #TFT  #Season16",500,975);

    const a=document.createElement("a");a.download=player.name+"-S16-Recap.png";a.href=canvas.toDataURL("image/png");a.click();
    toast("Season recap downloaded! 🎉","success");
  }

  function shareTwitter(){
    const text=`🏆 My TFT Clash Season 16 Recap\n\n📊 #${position} overall (${player.pts}pts)\n⚡ ${s.wins} wins · AVP ${s.avgPlacement}\n🔥 Best streak: ${player.bestStreak||0}\n${awards.length>0?"🎖 Awards: "+awards.map(a=>a.title).join(", ")+"\n":""}\n#TFTClash #TFT #Season16`;
    navigator.clipboard?.writeText(text).then(()=>toast("Copied for Twitter! 🐦","success"));
  }

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("profile")}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,flex:1}}>Season 16 Recap</h2>
      </div>

      {/* Preview card */}
      <div style={{background:"linear-gradient(135deg,rgba(10,15,26,1),rgba(13,18,37,1),rgba(8,8,15,1))",border:"1px solid rgba(232,168,56,.3)",borderRadius:16,padding:"clamp(20px,4vw,40px)",marginBottom:24,maxWidth:700,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>

        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
          <div>
            <div className="cond" style={{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".22em",textTransform:"uppercase",marginBottom:6}}>TFT Clash · Season 16 Recap</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(24px,5vw,44px)",fontWeight:900,color:"#F2EDE4",lineHeight:1}}>{player.name}</div>
            <div style={{marginTop:8}}><ClashRankBadge xp={estimateXp(player)} size="sm"/></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="mono" style={{fontSize:"clamp(32px,6vw,60px)",fontWeight:700,color:"#E8A838",lineHeight:1}}>#{position}</div>
            <div style={{fontSize:12,color:"#BECBD9"}}>of {players.length} players</div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
          {[["Season Pts",player.pts,"#E8A838"],["Wins",s.wins,"#6EE7B7"],["AVP",s.avgPlacement,avgCol(s.avgPlacement)],["Top 4",s.top4,"#C4B5FD"],["Games",s.games,"#C8D4E0"],["Best Streak",(player.bestStreak||0)+"🔥","#F97316"]].map(([l,v,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.06)",borderRadius:10,padding:"12px 14px"}}>
              <div className="mono" style={{fontSize:"clamp(18px,3vw,26px)",fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div className="cond" style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:4,letterSpacing:".08em"}}>{l}</div>
            </div>
          ))}
        </div>

        {awards.length>0&&(
          <div style={{marginBottom:16}}>
            <div className="cond" style={{fontSize:9,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase",marginBottom:8}}>Awards This Season</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {awards.map(a=><Tag key={a.id} color={a.color} size="sm">{a.icon} {a.title}</Tag>)}
            </div>
          </div>
        )}

        <div style={{borderTop:"1px solid rgba(242,237,228,.06)",paddingTop:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,color:"#9AAABF",fontFamily:"monospace"}}>tftclash.gg/p/{player.name.toLowerCase()}</span>
          <span style={{fontSize:10,color:"#9AAABF"}}>#TFTClash</span>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn v="primary" s="lg" onClick={downloadRecap}>⬇ Download PNG</Btn>
        <Btn v="dark" onClick={shareTwitter}>𝕏 Copy for Twitter</Btn>
        <Btn v="purple" onClick={()=>toast("Discord format copied!","success")}>Discord Share</Btn>
      </div>
    </div>
  );
}

// ─── AI COMMENTARY (uses Claude API) ──────────────────────────────────────────
function AICommentaryPanel({players,toast}){
  const [commentary,setCommentary]=useState("");
  const [loading,setLoading]=useState(false);
  const [generated,setGenerated]=useState(false);
  const sorted=[...players].sort((a,b)=>b.pts-a.pts);

  async function generate(){
    if(players.length<2){toast("Need at least 2 players for commentary","error");return;}
    setLoading(true);
    try{
      const top3=sorted.slice(0,3).map((p,i)=>`${["1st","2nd","3rd"][i]}: ${p.name} (${p.pts}pts, AVP ${computeStats(p).avgPlacement})`).join(", ");
      const bottom=sorted[sorted.length-1];
      const prompt=`You are a witty esports commentator for TFT Clash, a Teamfight Tactics tournament platform. Write a short, punchy post-clash write-up (3-4 sentences max) covering these results:

Top 3: ${top3}
Last place: ${bottom?.name||"unknown"} (${bottom?.pts||0}pts)
Total players: ${players.length}
Champion wins this season: ${sorted[0]?.wins||0}

Be entertaining, use TFT terminology, call out the champion, maybe roast the last place. Keep it under 80 words. No markdown.`;

      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:200,
          messages:[{role:"user",content:prompt}]
        })
      });
      const data=await res.json();
      const text=data.content?.map(c=>c.text||"").join("")||"Commentary unavailable.";
      setCommentary(text);
      setGenerated(true);
    }catch(e){
      setCommentary("The commentator stepped away from the desk. Check back after the next lobby.");
      setGenerated(true);
    }
    setLoading(false);
  }

  return(
    <Panel style={{padding:"20px",background:"rgba(155,114,207,.04)",border:"1px solid rgba(155,114,207,.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{fontSize:22}}>🎙️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15,color:"#C4B5FD"}}>Press Box</div>
          <div style={{fontSize:12,color:"#BECBD9"}}>AI-generated post-game commentary</div>
        </div>
        {!generated&&<Btn v="purple" s="sm" onClick={generate} disabled={loading}>{loading?"Writing...":"Generate"}</Btn>}
        {generated&&<Btn v="dark" s="sm" onClick={()=>{setGenerated(false);setCommentary("");}}>Regenerate</Btn>}
      </div>
      {loading&&(
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 0",color:"#9B72CF"}}>
          {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#9B72CF",animation:`blink 1s ${i*.2}s infinite`}}/>)}
          <span style={{fontSize:13}}>Commentator is reviewing the footage...</span>
        </div>
      )}
      {generated&&commentary&&(
        <div style={{padding:"14px 16px",background:"rgba(155,114,207,.06)",borderRadius:10,border:"1px solid rgba(155,114,207,.15)"}}>
          <p style={{fontSize:14,color:"#F2EDE4",lineHeight:1.7,margin:0,fontStyle:"italic"}}>"{commentary}"</p>
          <div style={{marginTop:10,display:"flex",gap:8}}>
            <Btn v="purple" s="sm" onClick={()=>navigator.clipboard?.writeText(commentary).then(()=>toast("Commentary copied!","success"))}>📋 Copy</Btn>
          </div>
        </div>
      )}
      {!generated&&!loading&&(
        <div style={{textAlign:"center",padding:"20px",color:"#BECBD9",fontSize:13}}>
          Hit Generate after your clash to get an AI write-up of the results
        </div>
      )}
    </Panel>
  );
}

// ─── HOST APPLICATION SCREEN ──────────────────────────────────────────────────
function HostApplyScreen({currentUser,toast,setScreen}){
  const [name,setName]=useState(currentUser?.username||"");
  const [org,setOrg]=useState("");
  const [reason,setReason]=useState("");
  const [freq,setFreq]=useState("weekly");
  const [submitted,setSubmitted]=useState(false);

  function submit(){
    if(!name.trim()||!reason.trim()){toast("Name and reason required","error");return;}
    setSubmitted(true);
    toast("Application submitted! We'll review it within 48h","success");
  }

  if(submitted) return(
    <div className="page wrap" style={{maxWidth:560,margin:"0 auto",textAlign:"center",paddingTop:60}}>
      <div style={{fontSize:48,marginBottom:16}}>🎮</div>
      <h2 style={{color:"#F2EDE4",marginBottom:10}}>Application Submitted!</h2>
      <p style={{fontSize:14,color:"#C8D4E0",marginBottom:8,lineHeight:1.7}}>We review all host applications within 48 hours. You'll be notified at <span style={{color:"#E8A838"}}>{currentUser?.email||"your email"}</span> once approved.</p>
      <p style={{fontSize:13,color:"#BECBD9",marginBottom:24}}>Approved hosts unlock a dedicated tournament dashboard to create and manage their own clashes.</p>
      <Btn v="primary" onClick={()=>setScreen("home")}>Back to Home</Btn>
    </div>
  );

  return(
    <div className="page wrap" style={{maxWidth:600,margin:"0 auto"}}>
      <Btn v="dark" s="sm" onClick={()=>setScreen("account")} style={{marginBottom:20}}>← Back</Btn>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:32,marginBottom:10}}>🎮</div>
        <h2 style={{color:"#F2EDE4",fontSize:22,marginBottom:8}}>Apply to Host</h2>
        <p style={{fontSize:14,color:"#C8D4E0",lineHeight:1.6}}>Host status gives you your own tournament dashboard to create and run TFT Clash events. All hosts are manually reviewed and approved by our admin team.</p>
      </div>

      <Panel style={{padding:"24px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Your Name / Handle</div>
            <Inp value={name} onChange={setName} placeholder="Display name"/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Org / Community Name <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
            <Inp value={org} onChange={setOrg} placeholder="e.g. TFT Academy, PG Clashes..."/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Planned Event Frequency</div>
            <Sel value={freq} onChange={setFreq}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="adhoc">Ad-hoc / Special events only</option>
            </Sel>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Why do you want to host? <span style={{color:"#F87171"}}>*</span></div>
            <textarea value={reason} onChange={e=>setReason(e.target.value)}
              placeholder="Tell us about your community, experience, and what kind of clashes you want to run..."
              style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,
                padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:100,
                outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{background:"rgba(232,168,56,.04)",border:"1px solid rgba(232,168,56,.15)",borderRadius:10,padding:"14px",fontSize:12,color:"#C8D4E0",lineHeight:1.7}}>
            <strong style={{color:"#E8A838"}}>What you get when approved:</strong> Your own Host Dashboard, ability to create public or private clashes, custom tournament rules, entry fee events (admin approved), and a Host badge on your profile.
          </div>
          <Btn v="primary" full onClick={submit}>Submit Application →</Btn>
        </div>
      </Panel>
    </div>
  );
}

// ─── HOST DASHBOARD ───────────────────────────────────────────────────────────
function HostDashboardScreen({currentUser,players,toast,setScreen}){
  const [tab,setTab]=useState("tournaments");
  const [showCreate,setShowCreate]=useState(false);
  const [tName,setTName]=useState("");
  const [tDate,setTDate]=useState("");
  const [tSize,setTSize]=useState("16");
  const [tInvite,setTInvite]=useState(false);
  const [tEntryFee,setTEntryFee]=useState("");
  const [tRules,setTRules]=useState("");
  const [tournaments,setTournaments]=useState([
    {id:1,name:"Weekly Clash #15",date:"Mar 13 2026",size:16,invite:false,entryFee:"",status:"upcoming",registered:12,approved:true},
    {id:2,name:"Pro Invitational",date:"Mar 20 2026",size:8,invite:true,entryFee:"$5",status:"draft",registered:0,approved:false},
  ]);

  function createTournament(){
    if(!tName.trim()||!tDate.trim()){toast("Name and date required","error");return;}
    const newT={
      id:Date.now(),name:tName,date:tDate,size:parseInt(tSize),
      invite:tInvite,entryFee:tEntryFee,rules:tRules,
      status:tEntryFee?"pending_approval":"upcoming",
      registered:0,approved:!tEntryFee,
    };
    setTournaments(ts=>[...ts,newT]);
    setShowCreate(false);setTName("");setTDate("");setTEntryFee("");setTRules("");
    toast(tEntryFee?"Tournament created - pending admin approval for entry fee":"Tournament created!","success");
  }

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <h2 style={{color:"#F2EDE4",fontSize:20}}>Host Dashboard</h2>
            <Tag color="#9B72CF">🎮 Host</Tag>
          </div>
          <p style={{fontSize:13,color:"#BECBD9"}}>Manage your tournaments and registrations.</p>
        </div>
        <Btn v="primary" onClick={()=>setShowCreate(s=>!s)}>{showCreate?"Cancel":"+ New Tournament"}</Btn>
      </div>

      {/* Create form */}
      {showCreate&&(
        <Panel style={{padding:"20px",marginBottom:20,border:"1px solid rgba(232,168,56,.25)"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Create Tournament</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Tournament Name</div>
              <Inp value={tName} onChange={setTName} placeholder="e.g. Weekly Clash #15"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Date</div>
              <Inp value={tDate} onChange={setTDate} placeholder="Mar 13 2026"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Max Players</div>
              <Sel value={tSize} onChange={setTSize}>{[8,16,24,32,48,64].map(n=><option key={n} value={n}>{n} players</option>)}</Sel>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Entry Fee <span style={{color:"#9AAABF",fontWeight:400}}>(requires admin approval)</span></div>
              <Inp value={tEntryFee} onChange={setTEntryFee} placeholder="Leave blank = free"/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Custom Rules <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
            <textarea value={tRules} onChange={e=>setTRules(e.target.value)} placeholder="Any special rules, format notes, or tiebreaker info..."
              style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:72,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div onClick={()=>setTInvite(v=>!v)} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <div style={{width:36,height:20,borderRadius:99,background:tInvite?"rgba(155,114,207,.3)":"rgba(255,255,255,.08)",border:"1px solid "+(tInvite?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),position:"relative",transition:"all .2s"}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:tInvite?"#C4B5FD":"#9AAABF",position:"absolute",top:2,left:tInvite?18:2,transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:13,color:"#C8D4E0"}}>Invite-only registration</span>
            </div>
          </div>
          {tEntryFee&&(
            <div style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#E8A838"}}>
              ⚠ Entry fee tournaments require admin approval before going live.
            </div>
          )}
          <Btn v="primary" onClick={createTournament}>Create Tournament</Btn>
        </Panel>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18}}>
        {["tournaments","registrations","stats"].map(t=>(
          <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</Btn>
        ))}
      </div>

      {tab==="tournaments"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {tournaments.map(t=>(
            <Panel key={t.id} style={{padding:"18px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:16,color:"#F2EDE4"}}>{t.name}</span>
                    <Tag color={t.status==="upcoming"?"#6EE7B7":t.status==="pending_approval"?"#E8A838":"#BECBD9"} size="sm">
                      {t.status==="upcoming"?"✓ Live":t.status==="pending_approval"?"⏳ Pending Approval":"Draft"}
                    </Tag>
                    {t.invite&&<Tag color="#9B72CF" size="sm">🔒 Invite Only</Tag>}
                    {t.entryFee&&<Tag color="#EAB308" size="sm">💰 {t.entryFee}</Tag>}
                  </div>
                  <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>📅 {t.date} · 👥 {t.registered}/{t.size} registered</div>
                  <div style={{marginTop:8}}>
                    <Bar val={t.registered} max={t.size} color="#E8A838" h={4}/>
                    <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{t.size-t.registered} spots remaining</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <Btn v="ghost" s="sm" onClick={()=>toast("Tournament settings (mock)","success")}>Edit</Btn>
                  <Btn v="primary" s="sm" onClick={()=>setScreen("bracket")}>Manage →</Btn>
                </div>
              </div>
            </Panel>
          ))}
          {tournaments.length===0&&(
            <div style={{textAlign:"center",padding:"48px",color:"#BECBD9"}}>
              <div style={{fontSize:32,marginBottom:12}}>🎮</div>
              <div style={{fontSize:14}}>No tournaments yet. Create your first one above.</div>
            </div>
          )}
        </div>
      )}

      {tab==="registrations"&&(
        <Panel style={{padding:"18px"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Registered Players - Weekly Clash #15</h3>
          {players.slice(0,12).map((p,i)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<11?"1px solid rgba(242,237,228,.05)":"none"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{p.name}</div>
                <div style={{fontSize:11,color:"#BECBD9"}}>{p.rank} · {p.region}</div>
              </div>
              <Tag color="#6EE7B7" size="sm">✓ Registered</Tag>
            </div>
          ))}
        </Panel>
      )}

      {tab==="stats"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          {[["Tournaments Run","2","#E8A838"],["Total Players Hosted","24","#6EE7B7"],["Avg Registration","12","#C8D4E0"],["Completion Rate","100%","#4ECDC4"]].map(([l,v,c])=>(
            <Panel key={l} style={{padding:"18px",textAlign:"center"}}>
              <div className="mono" style={{fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div className="cond" style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:6,letterSpacing:".06em"}}>{l}</div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ORG SPONSORSHIP DATA ─────────────────────────────────────────────────────
// Orgs pay admin to be associated with a player - shown as jersey-style tag
const ORG_SPONSORSHIPS={
  1:{org:"ProGuides",color:"#4ECDC4",logo:"PG"},   // player id 1 = Dishsoap
  2:{org:"TFT Academy",color:"#9B72CF",logo:"TA"},  // player id 2 = k3soju
};

function OrgSponsorTag({playerId}){
  const s=ORG_SPONSORSHIPS[playerId];
  if(!s)return null;
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:4,
      background:s.color+"18",border:"1px solid "+s.color+"44",
      borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700,color:s.color,
      letterSpacing:".04em"}}>
      {s.logo}
    </div>
  );
}

// ─── FANTASY TFT TEASER ───────────────────────────────────────────────────────
function FantasyTeaserScreen({toast,setScreen,currentUser}){
  const [email,setEmail]=useState(currentUser?.email||"");
  const [joined,setJoined]=useState(false);

  function joinWaitlist(){
    if(!email.trim()){toast("Enter your email to join","error");return;}
    setJoined(true);
    toast("You're on the waitlist! 🎯","success");
  }

  const HOW=[
    {icon:"📋",title:"Draft your squad",desc:"Before each clash, pick 5 players you think will place highest. Roster locks when the event starts."},
    {icon:"📊",title:"Earn points",desc:"Points based on your picks' placements. 1st = 10pts, 2nd = 7pts, 3rd = 5pts, 4th = 3pts. Bonus for calling the winner exactly."},
    {icon:"🏆",title:"Win the Fantasy League",desc:"Top fantasy scorer each season wins prizes and a permanent badge on their profile."},
    {icon:"💰",title:"Entry fees optional",desc:"Free leagues always available. Premium leagues with prize pools will be admin-run events."},
  ];

  return(
    <div className="page wrap">
      {/* Hero */}
      <div style={{textAlign:"center",padding:"clamp(30px,6vw,60px) 20px",marginBottom:40,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center,rgba(155,114,207,.1),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{fontSize:"clamp(40px,8vw,72px)",marginBottom:16,animation:"crown-glow 3s infinite"}}>🎯</div>
        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".22em",textTransform:"uppercase",marginBottom:12}}>Coming Season 17</div>
        <h1 style={{fontSize:"clamp(28px,5vw,52px)",fontWeight:900,color:"#F2EDE4",lineHeight:1.1,marginBottom:16}}>
          Fantasy TFT<br/><span style={{color:"#9B72CF"}}>is coming.</span>
        </h1>
        <p style={{fontSize:"clamp(14px,2vw,17px)",color:"#C8D4E0",maxWidth:520,margin:"0 auto 32px",lineHeight:1.7}}>
          Draft your dream lineup before each clash. Score points based on how your picks actually place. The ultimate way to have skin in every lobby - without playing a single game.
        </p>
        {!joined?(
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",maxWidth:440,margin:"0 auto"}}>
            <div style={{flex:1,minWidth:200}}>
              <Inp value={email} onChange={setEmail} placeholder="your@email.com" type="email"/>
            </div>
            <Btn v="purple" s="lg" onClick={joinWaitlist}>Join Waitlist →</Btn>
          </div>
        ):(
          <div style={{background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.3)",borderRadius:12,padding:"16px 24px",display:"inline-block"}}>
            <div style={{fontSize:20,marginBottom:6}}>✅</div>
            <div style={{fontWeight:700,fontSize:16,color:"#6EE7B7",marginBottom:4}}>You're on the waitlist!</div>
            <div style={{fontSize:13,color:"#C8D4E0"}}>We'll email {email} when Fantasy TFT launches in Season 17.</div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{marginBottom:40}}>
        <h2 style={{fontSize:20,color:"#F2EDE4",textAlign:"center",marginBottom:24}}>How it works</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
          {HOW.map((h,i)=>(
            <Panel key={i} style={{padding:"20px"}}>
              <div style={{fontSize:28,marginBottom:12}}>{h.icon}</div>
              <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:6}}>{h.title}</div>
              <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6}}>{h.desc}</div>
            </Panel>
          ))}
        </div>
      </div>

      {/* Scoring preview */}
      <Panel style={{padding:"24px",marginBottom:40,background:"rgba(155,114,207,.04)",border:"1px solid rgba(155,114,207,.2)"}}>
        <h3 style={{fontSize:17,color:"#C4B5FD",marginBottom:16}}>Scoring System Preview</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
          {[["1st place","10 pts","#E8A838"],["2nd place","7 pts","#C0C0C0"],["3rd place","5 pts","#CD7F32"],["4th place","3 pts","#4ECDC4"],["5th-8th","0 pts","#BECBD9"],["Exact call","+3 bonus","#9B72CF"],["Clutch win","+2 bonus","#F97316"],["Win streak","+1/game","#EAB308"]].map(([l,v,c])=>(
            <div key={l} style={{background:"#111827",borderRadius:9,padding:"12px",textAlign:"center",border:"1px solid rgba(242,237,228,.06)"}}>
              <div className="mono" style={{fontSize:16,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{fontSize:11,color:"#BECBD9",marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Platform CTA */}
      <div style={{background:"linear-gradient(90deg,rgba(232,168,56,.06),rgba(155,114,207,.06))",border:"1px solid rgba(232,168,56,.2)",borderRadius:14,padding:"24px",textAlign:"center"}}>
        <div style={{fontSize:24,marginBottom:10}}>⚔️</div>
        <h3 style={{fontSize:18,color:"#F2EDE4",marginBottom:8}}>Already competing in TFT Clash?</h3>
        <p style={{fontSize:13,color:"#C8D4E0",maxWidth:480,margin:"0 auto 16px",lineHeight:1.6}}>
          Fantasy TFT is built on top of our weekly clash results. The better you know the players, the better your draft. Jump into the current season while you wait.
        </p>
        <Btn v="ghost" onClick={()=>setScreen("leaderboard")}>View Season Standings →</Btn>
      </div>
    </div>
  );
}

// ─── RULES SCREEN ─────────────────────────────────────────────────────────────
function RulesScreen({setScreen}){
  const [tab,setTab]=useState("format");
  const TABS=[
    {id:"format",label:"Format"},
    {id:"points",label:"Points & Ties"},
    {id:"checkin",label:"Check-in"},
    {id:"edgecases",label:"Edge Cases"},
    {id:"conduct",label:"Conduct"},
  ];
  return(
    <div className="page wrap">
      <div style={{marginBottom:32}}>
        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".2em",textTransform:"uppercase",marginBottom:8}}>Official</div>
        <h1 style={{fontSize:"clamp(26px,4vw,42px)",fontWeight:900,color:"#F2EDE4",lineHeight:1.1,marginBottom:10}}>Tournament Rules</h1>
        <p style={{fontSize:14,color:"#C8D4E0",maxWidth:600,lineHeight:1.7}}>TFT Clash follows rules based on our community rulebook, adapted for competitive play. All participants are expected to read and understand these rules before competing.</p>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:24}}>
        {TABS.map(t=>(
          <Btn key={t.id} v={tab===t.id?"primary":"dark"} s="sm" onClick={()=>setTab(t.id)}>{t.label}</Btn>
        ))}
      </div>

      {tab==="format"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:16,fontFamily:"'Cinzel',serif"}}>Clash Format</h2>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:8}}>Standard Format (24 players)</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>24 players → 3 lobbies of 8 → 3–5 games per lobby → cumulative points determine final standings. No elimination stage at this size - everyone plays all rounds.</div>
              </div>
              <div style={{height:1,background:"rgba(242,237,228,.06)"}}/>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:8}}>Lobby Seeding</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>Players are seeded by rank using <span style={{color:"#4ECDC4",fontWeight:600}}>snake-draft</span> so each lobby has a balanced mix of skill levels. Random draw is used when players have equal LP.</div>
                <div style={{marginTop:12,background:"#0A0F1A",borderRadius:8,padding:"14px"}}>
                  <div className="cond" style={{fontSize:11,color:"#BECBD9",marginBottom:8,letterSpacing:".06em",textTransform:"uppercase"}}>Snake seeding example - 3 lobbies</div>
                  <div className="mono" style={{fontSize:12,color:"#4ECDC4",marginBottom:4}}>Lobby A: seeds 1, 6, 7, 12, 13, 18, 19, 24</div>
                  <div className="mono" style={{fontSize:12,color:"#9B72CF",marginBottom:4}}>Lobby B: seeds 2, 5, 8, 11, 14, 17, 20, 23</div>
                  <div className="mono" style={{fontSize:12,color:"#E8A838"}}>Lobby C: seeds 3, 4, 9, 10, 15, 16, 21, 22</div>
                </div>
              </div>
              <div style={{height:1,background:"rgba(242,237,228,.06)"}}/>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:8}}>Multi-Stage Format (32+ players)</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8,marginBottom:12}}>For larger events, a two-stage Swiss format is used. Lobbies are reseeded every 2 games based on standings.</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
                  {[["Stage 1","Multiple lobbies · top 4 per lobby advance","#9B72CF"],["Stage 2","Survivors · reseeded lobbies · top 4 advance","#4ECDC4"],["Finals","Top 8 overall · single lobby · 1 winner","#E8A838"]].map(([s,d,c])=>(
                    <div key={s} style={{background:"#0A0F1A",borderRadius:8,padding:"12px",border:"1px solid rgba(242,237,228,.06)"}}>
                      <div style={{fontWeight:700,fontSize:13,color:c,marginBottom:4}}>{s}</div>
                      <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.6}}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{height:1,background:"rgba(242,237,228,.06)"}}/>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:8}}>Swiss Reseeding</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>After every 2 games, lobbies reseed based on current standings - top performers face each other, making each round harder as you advance. Points reset between days but <span style={{color:"#4ECDC4"}}>not</span> between stages on Finals Day.</div>
              </div>
            </div>
          </Panel>
          <Panel style={{padding:"24px",background:"rgba(232,168,56,.03)",border:"1px solid rgba(232,168,56,.15)"}}>
            <h3 style={{fontSize:15,color:"#E8A838",marginBottom:10}}>Result Submission</h3>
            <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>Results are entered <span style={{color:"#F2EDE4",fontWeight:600}}>directly on the platform</span> — players enter their placement on the Bracket page after each round. No screenshots required.</div>
          </Panel>
        </div>
      )}

      {tab==="points"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:4,fontFamily:"'Cinzel',serif"}}>Tournament Point System</h2>
            <div style={{fontSize:13,color:"#BECBD9",marginBottom:20}}>Per-game placement points — Clash Scoring used in all TFT Clash events.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:8,marginBottom:24}}>
              {[[1,"8","#E8A838"],[2,"7","#C0C0C0"],[3,"6","#CD7F32"],[4,"5","#4ECDC4"],[5,"4","#C8D4E0"],[6,"3","#C8D4E0"],[7,"2","#C8D4E0"],[8,"1","#C8D4E0"]].map(([place,pts,color])=>(
                <div key={place} style={{background:"#0A0F1A",borderRadius:8,padding:"14px 8px",textAlign:"center",border:"1px solid rgba(242,237,228,.06)"}}>
                  <div className="cond" style={{fontSize:10,color:"#BECBD9",marginBottom:4,textTransform:"uppercase",letterSpacing:".04em"}}>{place===1?"1st":place===2?"2nd":place===3?"3rd":place+"th"}</div>
                  <div className="mono" style={{fontSize:20,fontWeight:700,color:color,lineHeight:1}}>{pts}</div>
                  <div style={{fontSize:9,color:"#9AAABF",marginTop:2}}>pts</div>
                </div>
              ))}
            </div>
            <div style={{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:10,padding:"16px",fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>
              <strong style={{color:"#C4B5FD"}}>DNP (Did Not Play):</strong> 0 points - worse than last place. Players who miss a game without notifying admins receive DNP. Two DNPs triggers a disqualification review.
            </div>
          </Panel>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:16,fontFamily:"'Cinzel',serif"}}>Tiebreakers</h2>
            <div style={{fontSize:13,color:"#C8D4E0",marginBottom:16,lineHeight:1.7}}>When players are tied on cumulative points (for reseeding, cut-offs, or final placement), ties are broken in this exact order:</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["1","Total Tournament Points","The raw cumulative score. Applied first in all contexts.","#E8A838"],["2","Wins + Top 4s","Count of 1st place finishes × 2, plus top-4 finishes. Higher score wins.","#4ECDC4"],["3","Best Placement Counts","Who has more 1sts? Then more 2nds? Counts position-by-position.","#9B72CF"],["4","Most Recent Game","Better finish in the most recent game, then the game before that.","#C4B5FD"],["5","Random","Last resort only - random sort between tied positions.","#BECBD9"]].map(([n,title,desc,color])=>(
                <div key={n} style={{display:"flex",gap:14,alignItems:"flex-start",background:"#0A0F1A",borderRadius:8,padding:"14px"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:"rgba(155,114,207,.15)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#C4B5FD",flexShrink:0}}>{n}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:color,marginBottom:3}}>{title}</div>
                    <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.6}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab==="checkin"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:16,fontFamily:"'Cinzel',serif"}}>Registration & Check-in</h2>
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div>
                <div className="cond" style={{fontSize:12,fontWeight:700,color:"#4ECDC4",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Registration</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>Registration opens at least 24 hours before each clash and closes 30 minutes before start. You must have an account with a valid Riot ID linked. Registering indicates your commitment to play - only sign up if you intend to show up.</div>
              </div>
              <div style={{height:1,background:"rgba(242,237,228,.06)"}}/>
              <div>
                <div className="cond" style={{fontSize:12,fontWeight:700,color:"#4ECDC4",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Check-in Window</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8,marginBottom:14}}>Check-in opens <span style={{color:"#F2EDE4"}}>60 minutes before start</span> and closes <span style={{color:"#F2EDE4"}}>15 minutes before start</span>. You must actively click "Check In" - being registered is not enough.</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
                  {[["T-60min","Check-in opens","#4ECDC4"],["T-30min","Registration closes","#C8D4E0"],["T-15min","Check-in closes · roster locked","#E8A838"],["T-10min","Lobbies generated & seeded","#9B72CF"],["T-5min","Lobby assignments posted","#C4B5FD"],["T-0","Games begin","#52C47C"]].map(([time,event,color])=>(
                    <div key={time} style={{background:"#0A0F1A",borderRadius:8,padding:"12px",border:"1px solid rgba(242,237,228,.06)"}}>
                      <div className="mono" style={{fontSize:12,fontWeight:700,color:color,marginBottom:3}}>{time}</div>
                      <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5}}>{event}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{height:1,background:"rgba(242,237,228,.06)"}}/>
              <div>
                <div className="cond" style={{fontSize:12,fontWeight:700,color:"#4ECDC4",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Auto-Drop & Waitlist</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>Players who registered but did not check in by the deadline are <span style={{color:"#F87171"}}>automatically removed</span>. Their spots are offered to waitlisted players in order. Waitlisted players must also check in to confirm availability.</div>
              </div>
              <div style={{height:1,background:"rgba(242,237,228,.06)"}}/>
              <div>
                <div className="cond" style={{fontSize:12,fontWeight:700,color:"#4ECDC4",marginBottom:8,textTransform:"uppercase",letterSpacing:".08em"}}>Grace Period</div>
                <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>Once lobbies are assigned, there is a <span style={{color:"#F2EDE4"}}>5-minute grace period</span> before the game begins. If you haven't joined and haven't contacted an admin by then, the lobby starts without you (DNP for that game).</div>
              </div>
            </div>
          </Panel>
          <div style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:12,padding:"16px 20px",fontSize:13,color:"#C8D4E0",lineHeight:1.7}}>
            <strong style={{color:"#E8A838"}}>Important:</strong> Dropping from a tournament without a legitimate reason (emergency, illness) may result in a ban from the next clash cycle. If you need to withdraw, tell an admin before the event starts.
          </div>
        </div>
      )}

      {tab==="edgecases"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:16,fontFamily:"'Cinzel',serif"}}>Uneven Numbers & Byes</h2>
            <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8,marginBottom:16}}>Lobbies hold up to 8 players. When total player count is not a multiple of 8, these rules apply:</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {[["Lobby of 7","Fully valid - game runs normally. 8th place simply doesn't exist that game. Scoring is identical for the 7 players present."],["Lobby of 6","Allowed but not preferred. Admin will attempt to merge lobbies or promote from waitlist before running a 6-player lobby."],["BYE (advancement stages)","When a Stage 2 lobby can't be filled to 8, top-seeded players receive a BYE - they advance automatically. BYE = 0 points added (neutral, not rewarded, not penalized)."]].map(([title,desc])=>(
                <div key={title} style={{background:"#0A0F1A",borderRadius:8,padding:"14px",border:"1px solid rgba(242,237,228,.06)"}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#4ECDC4",marginBottom:4}}>{title}</div>
                  <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.6}}>{desc}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:16,fontFamily:"'Cinzel',serif"}}>No-Shows & Disconnections</h2>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[["Doesn't join lobby","Game starts after 5-min grace. Player receives DNP (0 pts) for that game.","#F87171"],["Disconnects mid-game","Riot-assigned final placement counts - no exceptions. Remakes only considered for server-wide outages or first-carousel DC, at admin discretion.","#EAB308"],["Drops out between rounds","Removed from roster. No mid-tournament replacement in competitive format.","#C8D4E0"],["Two DNPs","Admin prompted to review for disqualification from remainder of the clash.","#F87171"]].map(([title,desc,color])=>(
                <div key={title} style={{display:"flex",gap:12,alignItems:"flex-start",background:"#0A0F1A",borderRadius:8,padding:"14px"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,marginTop:5}}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:3}}>{title}</div>
                    <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.6}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:12,fontFamily:"'Cinzel',serif"}}>Pauses</h2>
            <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.8,marginBottom:14}}>Type <span className="mono" style={{color:"#4ECDC4",background:"rgba(78,205,196,.08)",padding:"2px 6px",borderRadius:4}}>/pause</span> in game chat to pause and contact an admin. Abuse of the pause feature results in disciplinary action.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
              {[["Max per game (player)","10 min"],["Max total per tournament","25 min"],["Max per game (all players)","30 min"]].map(([l,v])=>(
                <div key={l} style={{background:"#0A0F1A",borderRadius:8,padding:"12px",border:"1px solid rgba(242,237,228,.06)"}}>
                  <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,lineHeight:1.5}}>{l}</div>
                  <div className="mono" style={{fontSize:15,fontWeight:700,color:"#C4B5FD"}}>{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab==="conduct"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Panel style={{padding:"24px"}}>
            <h2 style={{fontSize:18,color:"#E8A838",marginBottom:6,fontFamily:"'Cinzel',serif"}}>Code of Conduct</h2>
            <div style={{fontSize:13,color:"#BECBD9",marginBottom:20,lineHeight:1.7}}>All participants are bound by these rules. Violations result in warnings, point deductions, suspension, or permanent ban depending on severity.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["🎯","Play to win","Always play to the best of your ability. Intentionally underperforming or tanking games is a bannable offense."],["🚫","No collusion","Any agreement to soft-play allies, split prizes, or manipulate results is prohibited. This includes ghosting and external signaling."],["📵","No coaching during games","Receiving tips or build orders from anyone outside the lobby during an active game is strictly prohibited."],["🐛","No bugs or exploits","Do not knowingly use in-game bugs for advantage. Pause and report to an admin immediately if you encounter one."],["🔐","No account sharing","Playing under another person's account (ringing) is a permanent ban offense. Compete only on your registered account."],["🤝","Respect everyone","Harassment, hate speech, discrimination, and abusive behavior are not tolerated - in-game, Discord, or on the platform."],["📸","Result submission","All players enter their placement directly on the Bracket page. Discrepancies should be raised to an admin immediately."]].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:14,background:"#0A0F1A",borderRadius:8,padding:"14px",border:"1px solid rgba(242,237,228,.06)"}}>
                  <div style={{fontSize:20,flexShrink:0,width:28,textAlign:"center"}}>{icon}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:3}}>{title}</div>
                    <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.6}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel style={{padding:"24px",background:"rgba(248,113,113,.03)",border:"1px solid rgba(248,113,113,.15)"}}>
            <h3 style={{fontSize:15,color:"#F87171",marginBottom:12}}>Disciplinary Actions</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[["Official Warning","Minor first offenses. Noted on your record."],["Point Deduction","Applied at end of day/stage - never mid-game."],["Round/Match Forfeiture","Result nullified or replaced with 0 points."],["Tournament Suspension","Banned from one or more upcoming clashes."],["Permanent Ban","Ringing, extreme misconduct, or repeated major violations."]].map(([action,desc])=>(
                <div key={action} style={{display:"flex",gap:10,alignItems:"flex-start",fontSize:13,paddingBottom:8,borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                  <span style={{color:"#F87171",fontWeight:700,minWidth:168,flexShrink:0}}>{action}</span>
                  <span style={{color:"#C8D4E0",lineHeight:1.5}}>{desc}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

// ─── FAQ SCREEN ───────────────────────────────────────────────────────────────
function FAQScreen({setScreen}){
  const [open,setOpen]=useState(new Set());
  const FAQS=[
    {cat:"Getting Started",items:[
      {q:"How do I join a TFT Clash?",a:"Create a free account, link your Riot ID in your profile, then register for the next upcoming clash on the Home screen. Competing is always free - no subscription required."},
      {q:"Do I need Pro or Host to play?",a:"No. The free Player tier lets you compete in all clashes. Pro ($4.99/mo) unlocks extended stats, career graphs, and profile customization. Host ($19.99/mo) lets you run your own events."},
      {q:"How do I link my Riot ID?",a:"Go to My Account → Edit Profile and enter your Riot ID (e.g. Username#TAG). This is used to verify your in-game account and for lobby invites."},
    ]},
    {cat:"Registration & Check-in",items:[
      {q:"What's the difference between registering and checking in?",a:"Registration means you want to play. Check-in confirms you're present on the day. A check-in window opens 60 minutes before start - you must click Check In during that window. If you registered but don't check in, you're auto-removed and your spot goes to the waitlist."},
      {q:"What happens if I'm on the waitlist?",a:"Waitlisted players are offered spots in order as registered players fail to check in. Stay available and keep the site open - you'll be notified if a slot opens for you."},
      {q:"Can I register last minute?",a:"Registration closes 30 minutes before start. After that, the only way in is through the waitlist during the check-in window."},
      {q:"I checked in but missed the lobby - what happens?",a:"If you haven't joined within the 5-minute grace period after lobby assignments drop, the game starts without you and you receive DNP (0 points) for that game. Contact an admin immediately if you're having technical issues."},
    ]},
    {cat:"Format & Scoring",items:[
      {q:"How many games do I play per clash?",a:"In our standard 24-player format, each player plays 3–5 games in the same lobby. Final standings are determined by cumulative placement points across all games."},
      {q:"How are lobbies decided?",a:"Lobbies are seeded by ladder rank using snake-draft - each lobby gets a balanced spread of skill levels. Unranked or equal-LP players are placed randomly."},
      {q:"What's the points system?",a:"Clash Scoring per game: 1st=8, 2nd=7, 3rd=6, 4th=5, 5th=4, 6th=3, 7th=2, 8th=1."},
      {q:"What if there aren't enough players for full 8-player lobbies?",a:"Lobbies of 7 are completely valid - scoring is identical for the 7 present. For advancement stages, top seeds may receive a BYE (0 points, neutral)."},
      {q:"How do I submit my result after a game?",a:"You don't need to screenshot or message anyone. After each game, go to the Bracket page and enter your placement directly — the site records it instantly. If you're unsure, your admin can enter it for you."},
      {q:"Do clash points carry over between events?",a:"In-game tournament points (1st=8pts etc.) are used only within a single clash. Season points - shown on the leaderboard - are separate and accumulate across all clashes in the season."},
    ]},
    {cat:"Disconnections & Edge Cases",items:[
      {q:"What if I disconnect mid-game?",a:"Your Riot-assigned final placement counts - no exceptions. The result stands regardless of disconnect reason. Remakes are only considered for server-wide outages affecting multiple players, or a disconnect before your first augment selection - and only at admin discretion."},
      {q:"What if someone no-shows their lobby?",a:"After the 5-minute grace period the game starts. The absent player receives DNP (0 points). In larger events, a waitlist player may be called in to fill the spot."},
      {q:"Can I pause a game?",a:"Yes. Type /pause in game chat to pause and contact an admin. Maximum 10 minutes per pause, 25 minutes total across the entire tournament. Abusing pauses results in disciplinary action."},
      {q:"What if I have to drop out mid-tournament?",a:"Tell an admin immediately. Dropping without a legitimate reason may result in a ban from the next clash cycle. Legitimate reasons (emergency, illness) are handled at admin discretion with no penalty."},
    ]},
    {cat:"Conduct & Fairness",items:[
      {q:"Is soft-playing a friend allowed?",a:"Absolutely not. Soft play and collusion are among the most serious offenses. Always play to win. Penalties range from point forfeiture to permanent ban."},
      {q:"Can I stream my games?",a:"Yes, you're free to stream your own POV. We recommend a delay to prevent opponents watching your stream for info. Using stream information to coach yourself or others during a game is prohibited."},
      {q:"What if I see someone cheating?",a:"Report it to an admin privately with any screenshot evidence. All reports are investigated - you won't be penalized for reporting in good faith."},
      {q:"Can I get banned?",a:"Yes. Account sharing (ringing), extreme harassment, collusion, or repeated violations result in suspension or permanent ban. All decisions are at admin discretion."},
    ]},
    {cat:"Leaderboard & Season",items:[
      {q:"How are season points awarded?",a:"Your final placement in each clash earns season points. The better you finish, the more season points you earn. These accumulate across all clashes throughout the season."},
      {q:"How are leaderboard ties broken?",a:"In order: total points → wins+top4s (wins count twice) → most favorable placement counts (most 1sts, then 2nds…) → most recent game result → random."},
      {q:"Is there a reward for winning the season?",a:"Yes - the season champion is inducted into the Hall of Fame with a permanent record. Future seasons may include real prizes as the platform grows."},
    ]},
  ];
  let qi=0;
  return(
    <div className="page wrap">
      <div style={{marginBottom:32}}>
        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".2em",textTransform:"uppercase",marginBottom:8}}>Help</div>
        <h1 style={{fontSize:"clamp(26px,4vw,42px)",fontWeight:900,color:"#F2EDE4",lineHeight:1.1,marginBottom:10}}>Frequently Asked Questions</h1>
        <p style={{fontSize:14,color:"#C8D4E0",maxWidth:560,lineHeight:1.7}}>Everything you need to know about competing in TFT Clash. Can't find your answer? Ask in Discord.</p>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:32}}>
        <Btn v="primary" s="sm" onClick={()=>setScreen("rules")}>View Full Rules →</Btn>
        <Btn v="dark" s="sm" onClick={()=>setScreen("pricing")}>Pricing & Plans</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:28}}>
        {FAQS.map(section=>(
          <div key={section.cat}>
            <div className="cond" style={{fontSize:12,fontWeight:700,color:"#4ECDC4",letterSpacing:".14em",textTransform:"uppercase",marginBottom:10,paddingBottom:8,borderBottom:"1px solid rgba(78,205,196,.2)"}}>{section.cat}</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {section.items.map(item=>{
                const idx=qi++;
                const isOpen=open.has(idx);
                return(
                  <div key={idx} style={{background:"#111827",borderRadius:10,border:"1px solid "+(isOpen?"rgba(155,114,207,.3)":"rgba(242,237,228,.06)"),overflow:"hidden",transition:"border-color .15s"}}>
                    <button onClick={()=>setOpen(prev=>{const s=new Set(prev);isOpen?s.delete(idx):s.add(idx);return s;})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"16px 20px",background:"none",border:"none",cursor:"pointer",textAlign:"left",gap:16}}>
                      <span style={{fontSize:14,fontWeight:600,color:isOpen?"#F2EDE4":"#C8BFB0",lineHeight:1.5,flex:1}}>{item.q}</span>
                      <span style={{fontSize:18,color:"#9B72CF",flexShrink:0,transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(45deg)":"none"}}>+</span>
                    </button>
                    {isOpen&&(
                      <div style={{padding:"0 20px 18px",fontSize:13,color:"#C8D4E0",lineHeight:1.8,borderTop:"1px solid rgba(242,237,228,.05)"}}>{item.a}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:40,background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:14,padding:"24px",textAlign:"center"}}>
        <div style={{fontSize:24,marginBottom:10}}>💬</div>
        <h3 style={{fontSize:17,color:"#F2EDE4",marginBottom:8}}>Still have questions?</h3>
        <p style={{fontSize:13,color:"#C8D4E0",maxWidth:380,margin:"0 auto 16px",lineHeight:1.6}}>Ask in the TFT Clash Discord server or reach out to an admin before your first clash.</p>
        <Btn v="ghost" onClick={()=>setScreen("rules")}>Read the Full Rules →</Btn>
      </div>
    </div>
  );
}

// ─── AEGIS SHOWCASE ─────────────────────────────────────────────────────────────────────────────
function AegisShowcaseScreen({setScreen}){
  var [tab,setTab]=useState("format");
  var [lobbyRound,setLobbyRound]=useState("G1");
  var [showAll,setShowAll]=useState(false);
  var [editMode,setEditMode]=useState(false);
  var [scores,setScores]=useState({});
  var [draftMsg,setDraftMsg]=useState("");
  var [sentMsg,setSentMsg]=useState("");
  var [setupName,setSetupName]=useState("Aegis Esports TFT Showdown #152");
  var [setupDate,setSetupDate]=useState("");
  var [setupFormat,setSetupFormat]=useState("qualifier+points");
  var [setupMaxPlayers,setSetupMaxPlayers]=useState("64");
  var [signupOpen,setSignupOpen]=useState(false);
  var [signupIgn,setSignupIgn]=useState("");
  var [registeredPlayers,setRegisteredPlayers]=useState(["Levitate","Zounderkite","Uri","BingBing","Wiwi","Ole","Sybor","Ivdim","Vlad"]);
  var [hostSetupTab,setHostSetupTab]=useState("setup");

  var STANDINGS=[
    {place:1, ign:"D0PA#111",              g1:5,g2:6,g3:7,g4:7,g5:8,g6:7,total:29,prize:60},
    {place:2, ign:"LC Abyss#CAPO",         g1:5,g2:5,g3:8,g4:7,g5:7,g6:6,total:28,prize:40},
    {place:3, ign:"vnck#NA1",              g1:5,g2:5,g3:5,g4:6,g5:6,g6:8,total:25,prize:30},
    {place:4, ign:"Ken Kitade",            g1:5,g2:8,g3:6,g4:5,g5:7,g6:5,total:23,prize:20},
    {place:5, ign:"Hydro#1000",            g1:5,g2:6,g3:5,g4:8,g5:6,g6:3,total:22,prize:17},
    {place:6, ign:"arzootft #na1",         g1:5,g2:8,g3:8,g4:6,g5:3,g6:4,total:21,prize:13},
    {place:7, ign:"ryt hardpuzzle#na2",    g1:5,g2:8,g3:7,g4:8,g5:2,g6:2,total:19,prize:10},
    {place:8, ign:"Talelelelelelel#NA1",   g1:5,g2:6,g3:6,g4:7,g5:4,g6:1,total:18,prize:10},
    {place:9, ign:"koke na gringa#na1",    g1:5,g2:8,g3:4,g4:4,g5:8,g6:null,total:16,prize:0},
    {place:10,ign:"LUNA Arcanine#NA3",     g1:5,g2:8,g3:8,g4:4,g5:4,g6:null,total:16,prize:0},
    {place:11,ign:"Mujjiwaraa#na1",        g1:5,g2:7,g3:7,g4:6,g5:3,g6:null,total:16,prize:0},
    {place:12,ign:"Gerinha #777",          g1:5,g2:7,g3:5,g4:5,g5:5,g6:null,total:15,prize:0},
    {place:13,ign:"Haykaroo#PHI",          g1:5,g2:7,g3:8,g4:2,g5:5,g6:null,total:15,prize:0},
    {place:14,ign:"Pun#TFT",              g1:5,g2:6,g3:3,g4:8,g5:2,g6:null,total:13,prize:0},
    {place:15,ign:"Xenor#NA1",             g1:5,g2:8,g3:7,g4:5,g5:1,g6:null,total:13,prize:0},
    {place:16,ign:"Politicess#na1",        g1:5,g2:8,g3:6,g4:4,g5:1,g6:null,total:11,prize:0},
    {place:17,ign:"PoGamoRNA#NA1",         g1:5,g2:5,g3:5,g4:3,g5:null,g6:null,total:8,prize:0},
    {place:18,ign:"MGC Fizz#mgc",          g1:5,g2:7,g3:6,g4:2,g5:null,g6:null,total:8,prize:0},
    {place:19,ign:"Lukwer#Kata",           g1:5,g2:7,g3:4,g4:3,g5:null,g6:null,total:7,prize:0},
    {place:20,ign:"kininaru#oreo",         g1:5,g2:5,g3:4,g4:3,g5:null,g6:null,total:7,prize:0},
    {place:21,ign:"XcorpionTFT",           g1:5,g2:5,g3:3,g4:2,g5:null,g6:null,total:5,prize:0},
    {place:22,ign:"Hoshimi Miyabi#3110",   g1:5,g2:5,g3:4,g4:1,g5:null,g6:null,total:5,prize:0},
    {place:23,ign:"ChunChunMaru#KSuba",    g1:5,g2:6,g3:3,g4:1,g5:null,g6:null,total:4,prize:0},
    {place:24,ign:"LC Dominus#CAPO",       g1:5,g2:8,g3:3,g4:0,g5:null,g6:null,total:3,prize:0},
    {place:25,ign:"YoonEna#joshu",         g1:5,g2:7,g3:2,g4:null,g5:null,g6:null,total:2,prize:0},
    {place:26,ign:"i love cat memes#xaste",g1:5,g2:7,g3:2,g4:null,g5:null,g6:null,total:2,prize:0},
    {place:27,ign:"bourbon#GGG",           g1:5,g2:6,g3:2,g4:null,g5:null,g6:null,total:2,prize:0},
    {place:28,ign:"MarksM #3004",          g1:5,g2:5,g3:2,g4:null,g5:null,g6:null,total:2,prize:0},
    {place:29,ign:"Theonelukeyg#NA1",      g1:5,g2:7,g3:1,g4:null,g5:null,g6:null,total:1,prize:0},
    {place:30,ign:"BESTIAROCK22#9708",     g1:5,g2:6,g3:1,g4:null,g5:null,g6:null,total:1,prize:0},
    {place:31,ign:"PowerPuff Tundie#na1",  g1:5,g2:6,g3:1,g4:null,g5:null,g6:null,total:1,prize:0},
    {place:32,ign:"Only Lowroll#NA1",      g1:5,g2:5,g3:1,g4:null,g5:null,g6:null,total:1,prize:0},
    {place:33,ign:"TheDeadlyinx",          g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:34,ign:"BrazilianKlein#NA1",    g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:35,ign:"Hastyles4#Na",          g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:36,ign:"52HzGrimlocking#NA13",  g1:5,g2:1,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:37,ign:"MassiveBBC",            g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:38,ign:"AshSvr#Na1",            g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:39,ign:"reddell#010",           g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:40,ign:"Minimalrage19",         g1:5,g2:1,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:41,ign:"alandioss#NA2",         g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:42,ign:"ASaltedSam#1330",       g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:43,ign:"DUSK Hallo#weens",      g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:44,ign:"Grepizza#4389",         g1:5,g2:1,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:45,ign:"Braven#8888",           g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:46,ign:"Zuko#louee",            g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:47,ign:"YukiAruu",              g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:48,ign:"Nabitona#na1",          g1:5,g2:0,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:49,ign:"LC AnkallE#CAPO",       g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:50,ign:"Ego#8421",              g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:51,ign:"xrebel#rebel",          g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:52,ign:"Danzel#NA0",            g1:5,g2:1,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:53,ign:"Emrys#pog",             g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:54,ign:"patobsg #NA1",          g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:55,ign:"moeen#moeen",           g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:56,ign:"SamerNAs#NAs",          g1:5,g2:1,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:57,ign:"LC DYAMZ #L33T",        g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:58,ign:"Yonah#0724",            g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:59,ign:"cancelmyfuneral#na1",   g1:5,g2:2,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:60,ign:"NoSoyAntonio21#NA2",    g1:5,g2:1,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:61,ign:"LevitateNA#Buff",       g1:5,g2:4,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
    {place:62,ign:"Candyland player#NA1",  g1:5,g2:3,g3:null,g4:null,g5:null,g6:null,total:0,prize:0,elim:"G2"},
  ];

  var LOBBIES={
    G1:[
      {name:"Lobby 1", note:"Qualifier",players:[{ign:"Talelelelelelel#NA1",pts:5},{ign:"YoonEna#joshu",pts:5},{ign:"BrazilianKlein#NA1",pts:5},{ign:"52HzGrimlocking#NA13",pts:5}]},
      {name:"Lobby 2", note:"Qualifier",players:[{ign:"koke na gringa#na1",pts:5},{ign:"Hastyles4#Na",pts:5},{ign:"MarksM #3004",pts:5},{ign:"TheDeadlyinx",pts:5}]},
      {name:"Lobby 3", note:"Qualifier",players:[{ign:"Ken Kitade",pts:5},{ign:"reddell#010",pts:5},{ign:"Minimalrage19",pts:5},{ign:"MassiveBBC",pts:5}]},
      {name:"Lobby 4", note:"Qualifier",players:[{ign:"vnck#NA1",pts:5},{ign:"Theonelukeyg#NA1",pts:5},{ign:"BESTIAROCK22#9708",pts:5},{ign:"AshSvr#Na1",pts:5}]},
      {name:"Lobby 5", note:"Qualifier",players:[{ign:"Xenor#NA1",pts:5},{ign:"bourbon#GGG",pts:5},{ign:"alandioss#NA2",pts:5},{ign:"DUSK Hallo#weens",pts:5}]},
      {name:"Lobby 6", note:"Qualifier",players:[{ign:"Lukwer#Kata",pts:5},{ign:"Hoshimi Miyabi#3110",pts:5},{ign:"ASaltedSam#1330",pts:5},{ign:"Grepizza#4389",pts:5}]},
      {name:"Lobby 7", note:"Qualifier",players:[{ign:"LC Abyss#CAPO",pts:5},{ign:"MGC Fizz#mgc",pts:5},{ign:"Braven#8888",pts:5},{ign:"Zuko#louee",pts:5}]},
      {name:"Lobby 8", note:"Qualifier",players:[{ign:"Hydro#1000",pts:5},{ign:"LC Dominus#CAPO",pts:5},{ign:"Nabitona#na1",pts:5},{ign:"YukiAruu",pts:5}]},
      {name:"Lobby 9", note:"Qualifier",players:[{ign:"LUNA Arcanine#NA3",pts:5},{ign:"i love cat memes#xaste",pts:5},{ign:"D0PA#111",pts:5},{ign:"XcorpionTFT",pts:5}]},
      {name:"Lobby 10",note:"Qualifier",players:[{ign:"LC AnkallE#CAPO",pts:5},{ign:"Ego#8421",pts:5},{ign:"xrebel#rebel",pts:5},{ign:"Danzel#NA0",pts:5}]},
      {name:"Lobby 11",note:"Qualifier",players:[{ign:"ryt hardpuzzle#na2",pts:5},{ign:"Gerinha #777",pts:5},{ign:"PowerPuff Tundie#na1",pts:5},{ign:"PoGamoRNA#NA1",pts:5}]},
      {name:"Lobby 12",note:"Qualifier",players:[{ign:"Emrys#pog",pts:5},{ign:"patobsg #NA1",pts:5},{ign:"moeen#moeen",pts:5},{ign:"SamerNAs#NAs",pts:5}]},
      {name:"Lobby 13",note:"Qualifier",players:[{ign:"arzootft #na1",pts:5},{ign:"Haykaroo#PHI",pts:5},{ign:"Pun#TFT",pts:5},{ign:"kininaru#oreo",pts:5}]},
      {name:"Lobby 14",note:"Qualifier",players:[{ign:"LC DYAMZ #L33T",pts:5},{ign:"Yonah#0724",pts:5},{ign:"cancelmyfuneral#na1",pts:5},{ign:"NoSoyAntonio21#NA2",pts:5}]},
      {name:"Lobby 15",note:"Qualifier",players:[{ign:"Politicess#na1",pts:5},{ign:"Mujjiwaraa#na1",pts:5},{ign:"ChunChunMaru#KSuba",pts:5},{ign:"Only Lowroll#NA1",pts:5}]},
      {name:"Lobby 16",note:"Qualifier",players:[{ign:"LevitateNA#Buff",pts:5},{ign:"Candyland player#NA1",pts:5}]},
    ],
    G2:[
      {name:"Lobby 9",  note:"Qualifier 2",players:[{ign:"koke na gringa#na1",pts:8},{ign:"YoonEna#joshu",pts:7},{ign:"Talelelelelelel#NA1",pts:6},{ign:"MarksM #3004",pts:5},{ign:"TheDeadlyinx",pts:4},{ign:"BrazilianKlein#NA1",pts:3},{ign:"Hastyles4#Na",pts:2},{ign:"52HzGrimlocking#NA13",pts:1}]},
      {name:"Lobby 10", note:"Qualifier 2",players:[{ign:"Ken Kitade",pts:8},{ign:"Theonelukeyg#NA1",pts:7},{ign:"BESTIAROCK22#9708",pts:6},{ign:"vnck#NA1",pts:5},{ign:"MassiveBBC",pts:4},{ign:"AshSvr#Na1",pts:3},{ign:"reddell#010",pts:2},{ign:"Minimalrage19",pts:1}]},
      {name:"Lobby 11", note:"Qualifier 2",players:[{ign:"Xenor#NA1",pts:8},{ign:"Lukwer#Kata",pts:7},{ign:"bourbon#GGG",pts:6},{ign:"Hoshimi Miyabi#3110",pts:5},{ign:"alandioss#NA2",pts:4},{ign:"ASaltedSam#1330",pts:3},{ign:"DUSK Hallo#weens",pts:2},{ign:"Grepizza#4389",pts:1}]},
      {name:"Lobby 12", note:"Qualifier 2",players:[{ign:"LC Dominus#CAPO",pts:8},{ign:"MGC Fizz#mgc",pts:7},{ign:"Hydro#1000",pts:6},{ign:"LC Abyss#CAPO",pts:5},{ign:"Braven#8888",pts:4},{ign:"Zuko#louee",pts:3},{ign:"YukiAruu",pts:2},{ign:"Nabitona#na1",pts:0}]},
      {name:"Lobby 13", note:"Qualifier 2",players:[{ign:"LUNA Arcanine#NA3",pts:8},{ign:"i love cat memes#xaste",pts:7},{ign:"D0PA#111",pts:6},{ign:"XcorpionTFT",pts:5},{ign:"LC AnkallE#CAPO",pts:4},{ign:"Ego#8421",pts:3},{ign:"xrebel#rebel",pts:2},{ign:"Danzel#NA0",pts:1}]},
      {name:"Lobby 14", note:"Qualifier 2",players:[{ign:"ryt hardpuzzle#na2",pts:8},{ign:"Gerinha #777",pts:7},{ign:"PowerPuff Tundie#na1",pts:6},{ign:"PoGamoRNA#NA1",pts:5},{ign:"Emrys#pog",pts:4},{ign:"patobsg #NA1",pts:3},{ign:"moeen#moeen",pts:2},{ign:"SamerNAs#NAs",pts:1}]},
      {name:"Lobby 15", note:"Qualifier 2",players:[{ign:"arzootft #na1",pts:8},{ign:"Haykaroo#PHI",pts:7},{ign:"Pun#TFT",pts:6},{ign:"kininaru#oreo",pts:5},{ign:"LC DYAMZ #L33T",pts:4},{ign:"Yonah#0724",pts:3},{ign:"cancelmyfuneral#na1",pts:2},{ign:"NoSoyAntonio21#NA2",pts:1}]},
      {name:"Lobby 16", note:"Qualifier 2",players:[{ign:"Politicess#na1",pts:8},{ign:"Mujjiwaraa#na1",pts:7},{ign:"ChunChunMaru#KSuba",pts:6},{ign:"Only Lowroll#NA1",pts:5},{ign:"LevitateNA#Buff",pts:4},{ign:"Candyland player#NA1",pts:3}]},
    ],
    G3:[
      {name:"Lobby 17",note:"Point Stage · Game 1",players:[{ign:"arzootft #na1",pts:8},{ign:"Xenor#NA1",pts:7},{ign:"Talelelelelelel#NA1",pts:6},{ign:"Gerinha #777",pts:5},{ign:"Hoshimi Miyabi#3110",pts:4},{ign:"XcorpionTFT",pts:3},{ign:"YoonEna#joshu",pts:2},{ign:"BESTIAROCK22#9708",pts:1}]},
      {name:"Lobby 18",note:"Point Stage · Game 1",players:[{ign:"Haykaroo#PHI",pts:8},{ign:"ryt hardpuzzle#na2",pts:7},{ign:"Politicess#na1",pts:6},{ign:"vnck#NA1",pts:5},{ign:"PoGamoRNA#NA1",pts:5},{ign:"kininaru#oreo",pts:4},{ign:"ChunChunMaru#KSuba",pts:3},{ign:"Ken Kitade",pts:6}]},
      {name:"Lobby 19",note:"Point Stage · Game 1",players:[{ign:"LC Abyss#CAPO",pts:8},{ign:"Mujjiwaraa#na1",pts:7},{ign:"MGC Fizz#mgc",pts:6},{ign:"koke na gringa#na1",pts:4},{ign:"Pun#TFT",pts:3},{ign:"i love cat memes#xaste",pts:2},{ign:"PowerPuff Tundie#na1",pts:1},{ign:"Theonelukeyg#NA1",pts:1}]},
      {name:"Lobby 20",note:"Point Stage · Game 1",players:[{ign:"LUNA Arcanine#NA3",pts:8},{ign:"D0PA#111",pts:7},{ign:"Hydro#1000",pts:5},{ign:"Lukwer#Kata",pts:4},{ign:"LC Dominus#CAPO",pts:3},{ign:"MarksM #3004",pts:2},{ign:"bourbon#GGG",pts:2},{ign:"Only Lowroll#NA1",pts:1}]},
    ],
    G4:[
      {name:"Lobby 21",note:"Point Stage · Game 2",players:[{ign:"ryt hardpuzzle#na2",pts:8},{ign:"Talelelelelelel#NA1",pts:7},{ign:"D0PA#111",pts:7},{ign:"Mujjiwaraa#na1",pts:6},{ign:"arzootft #na1",pts:6},{ign:"Gerinha #777",pts:5},{ign:"Xenor#NA1",pts:5},{ign:"koke na gringa#na1",pts:4}]},
      {name:"Lobby 22",note:"Point Stage · Game 2",players:[{ign:"Pun#TFT",pts:8},{ign:"Hydro#1000",pts:8},{ign:"LC Abyss#CAPO",pts:7},{ign:"vnck#NA1",pts:6},{ign:"Politicess#na1",pts:4},{ign:"kininaru#oreo",pts:3},{ign:"Haykaroo#PHI",pts:2},{ign:"XcorpionTFT",pts:2}]},
      {name:"Lobby 23",note:"Point Stage · Game 2",players:[{ign:"Ken Kitade",pts:5},{ign:"LUNA Arcanine#NA3",pts:4},{ign:"Lukwer#Kata",pts:3},{ign:"PoGamoRNA#NA1",pts:3},{ign:"MGC Fizz#mgc",pts:2},{ign:"Hoshimi Miyabi#3110",pts:1},{ign:"ChunChunMaru#KSuba",pts:1},{ign:"LC Dominus#CAPO",pts:0}]},
    ],
    G5:[
      {name:"Lobby 24",note:"Point Stage · Game 3",players:[{ign:"koke na gringa#na1",pts:8},{ign:"Ken Kitade",pts:7},{ign:"Hydro#1000",pts:6},{ign:"LUNA Arcanine#NA3",pts:4},{ign:"Talelelelelelel#NA1",pts:4},{ign:"arzootft #na1",pts:3},{ign:"ryt hardpuzzle#na2",pts:2},{ign:"Xenor#NA1",pts:1}]},
      {name:"Lobby 25",note:"Point Stage · Game 3",players:[{ign:"D0PA#111",pts:8},{ign:"LC Abyss#CAPO",pts:7},{ign:"vnck#NA1",pts:6},{ign:"Gerinha #777",pts:5},{ign:"Haykaroo#PHI",pts:5},{ign:"Mujjiwaraa#na1",pts:3},{ign:"Pun#TFT",pts:2},{ign:"Politicess#na1",pts:1}]},
    ],
    G6:[
      {name:"Finals",note:"Final Lobby",players:[{ign:"vnck#NA1",pts:8},{ign:"D0PA#111",pts:7},{ign:"LC Abyss#CAPO",pts:6},{ign:"Ken Kitade",pts:5},{ign:"arzootft #na1",pts:4},{ign:"Hydro#1000",pts:3},{ign:"ryt hardpuzzle#na2",pts:2},{ign:"Talelelelelelel#NA1",pts:1}]},
    ],
  };

  var ROUND_META={
    G1:{label:"Game 1",tag:"Top 4 Qualifier - Round 1",color:"#9B72CF",desc:"All 62+ participants compete across 16 lobbies. Top 4 per lobby advance to Game 2. Scores are NOT counted toward cumulative points but used as tiebreaker if needed.",count:"62+ players · 16 lobbies"},
    G2:{label:"Game 2",tag:"Top 4 Qualifier - Round 2",color:"#9B72CF",desc:"Survivors from Game 1 compete again. Top 4 per lobby advance to the Point Stage. G1 and G2 placements form the tiebreaker chain - most recent first.",count:"62 players · 8 lobbies"},
    G3:{label:"Game 3",tag:"Point Stage - Game 1",color:"#4ECDC4",desc:"32 players. Clash Scoring begins: 1st=8pts, 2nd=7pts … 8th=1pt. Cumulative totals tracked. Bottom 8 eliminated after results.",count:"32 players · 4 lobbies"},
    G4:{label:"Game 4",tag:"Point Stage - Game 2",color:"#4ECDC4",desc:"24 players. Points accumulate. Lobbies reshuffle based on current standings. Bottom 8 eliminated after results.",count:"24 players · 3 lobbies"},
    G5:{label:"Game 5",tag:"Point Stage - Game 3",color:"#4ECDC4",desc:"16 players. Top 8 by cumulative total after this game advance to the Finals.",count:"16 players · 2 lobbies"},
    G6:{label:"Game 6",tag:"Finals",color:"#E8A838",desc:"The top 8 players compete in one final lobby. Highest cumulative total wins. Tiebreaker: most recent game placement.",count:"8 players · 1 lobby"},
  };

  var SAMPLE_ANNOUNCEMENTS=[
    {label:"Format Reminder",text:"@Weeklies reminder: Games 1-2 are qualifier rounds - top 4 per lobby advance. Games 3-6 use Clash Scoring (1st=8pts). Points accumulate from Game 3 onwards only."},
    {label:"Lobby Assignments Live",text:"Game 3 lobby assignments are now live! Check the Lobbies tab for your group. Point stage starts NOW - good luck everyone!"},
    {label:"Scores Updated",text:"Game 4 results are in! Standings have been updated. 8 players eliminated. Check the Standings tab to see where you are heading into Game 5."},
    {label:"Finals Announced",text:"Your Game 6 finalists: D0PA, LC Abyss, vnck, Ken Kitade, arzootft, Hydro, ryt hardpuzzle, Talelelelelelel. Finals lobby assignments are live - check the Lobbies tab!"},
    {label:"Prize Distribution",text:"GGs to everyone! Full results and prize distribution are now on the Standings tab. Winners will be contacted for payment. Thanks to ZenMarket for sponsoring this week!"},
  ];

  var placeCol=function(p){
    if(p===1)return"#FFD700";
    if(p===2)return"#C0C0C0";
    if(p===3)return"#CD7F32";
    if(p<=4)return"#52C47C";
    if(p<=8)return"#9B72CF";
    return"#8896A8";
  };

  var ptCol=function(g){
    if(g===null||g===undefined)return"#7A8BA0";
    if(g>=7)return"#E8A838";
    if(g>=5)return"#9B72CF";
    if(g>=3)return"#4ECDC4";
    if(g>=1)return"#BECBD9";
    return"#F87171";
  };

  var toggleScore=function(lobbyName,ign,place){
    var key=lobbyName+"::"+ign;
    setScores(function(prev){
      var next=Object.assign({},prev);
      var existingKey=null;
      Object.keys(next).forEach(function(k){
        if(k.startsWith(lobbyName+"::")&&next[k]===place) existingKey=k;
      });
      if(existingKey) delete next[existingKey];
      if(next[key]===place) delete next[key];
      else next[key]=place;
      return next;
    });
  };

  var displayed=showAll?STANDINGS:STANDINGS.slice(0,16);
  var roundMeta=ROUND_META[lobbyRound];

  return(
    <div className="page" style={{maxWidth:820,margin:"0 auto"}}>

      <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.13) 0%,rgba(232,168,56,.07) 100%)",border:"1px solid rgba(155,114,207,.28)",borderRadius:16,padding:"28px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,168,56,.14) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          <div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div className="cond" style={{background:"rgba(232,168,56,.12)",border:"1px solid rgba(232,168,56,.35)",borderRadius:5,padding:"3px 10px",fontSize:12,color:"#E8A838",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>Client Demo</div>
              <div className="cond" style={{background:"rgba(78,205,196,.1)",border:"1px solid rgba(78,205,196,.3)",borderRadius:5,padding:"3px 10px",fontSize:12,color:"#4ECDC4",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>Live Data</div>
            </div>
            <h1 style={{fontFamily:"'Cinzel',serif",fontSize:28,fontWeight:700,color:"#F2EDE4",marginBottom:6,lineHeight:1.2}}>
              Aegis Esports TFT Showdown <span style={{color:"#E8A838"}}>#151</span>
            </h1>
            <div style={{fontSize:15,color:"#C8D4E0",marginBottom:4}}>Presented by <span style={{color:"#F2EDE4",fontWeight:600}}>ZenMarket</span></div>
            <div style={{fontSize:13,color:"#BECBD9"}}>North America · 62+ participants · 6 games · $200 prize pool</div>
          </div>
          <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10}}>
            <img src="/Aegis_Esports.png" alt="Aegis Esports" style={{height:48,width:"auto",objectFit:"contain"}}/>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:28,height:28,objectFit:"contain",opacity:.85}}/>
              <div>
                <div className="cond" style={{fontSize:11,color:"#8896A8",marginBottom:3,textTransform:"uppercase",letterSpacing:".1em"}}>Powered by</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:20,fontWeight:700,color:"#9B72CF"}}>TFT Clash</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:32,marginTop:20,flexWrap:"wrap"}}>
          {[["62+","Participants"],["16","G1 Lobbies"],["6","Games"],["$200","Prize Pool"]].map(function(arr){return(
            <div key={arr[1]}>
              <div style={{fontSize:26,fontWeight:700,color:"#F2EDE4",fontFamily:"'Cinzel',serif",lineHeight:1}}>{arr[0]}</div>
              <div className="cond" style={{fontSize:12,color:"#BECBD9",marginTop:3,textTransform:"uppercase",letterSpacing:".07em"}}>{arr[1]}</div>
            </div>
          );})}
        </div>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:20,background:"rgba(255,255,255,.025)",borderRadius:10,padding:4,border:"1px solid rgba(242,237,228,.06)"}}>
        {[["format","Format"],["standings","Standings"],["lobbies","Lobbies"],["host","Host Tools"],["platform","Platform"]].map(function(arr){return(
          <button key={arr[0]} onClick={function(){setTab(arr[0]);}} style={{flex:1,padding:"10px 6px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:".06em",transition:"all .15s",background:tab===arr[0]?"rgba(155,114,207,.22)":"transparent",color:tab===arr[0]?"#C4B5FD":"#BECBD9",outline:"none",textTransform:"uppercase"}}>{arr[1]}</button>
        );})}
      </div>

      {tab==="format"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.25)",borderRadius:12,padding:"22px 24px"}}>
            <div className="cond" style={{fontSize:12,color:"#9B72CF",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Official Format - Showdown #151</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16,paddingLeft:16,borderLeft:"3px solid rgba(155,114,207,.5)"}}>
              <div>
                <div className="cond" style={{background:"rgba(155,114,207,.2)",border:"1px solid rgba(155,114,207,.4)",borderRadius:5,padding:"3px 10px",fontSize:13,color:"#C4B5FD",fontWeight:700,display:"inline-block",marginBottom:4}}>Games 1 – 2 · Qualifier Format</div>
                <div style={{fontSize:14,color:"#C8D4E0",lineHeight:1.8}}>Players are split into groups of 8 (evenly distributed based on check-ins). Each group plays one game. <span style={{color:"#F2EDE4",fontWeight:600}}>Top 4 from each lobby advance</span> to the next round. Scores are NOT counted toward points but are saved as tiebreakers.</div>
              </div>
              <div>
                <div className="cond" style={{background:"rgba(232,168,56,.15)",border:"1px solid rgba(232,168,56,.4)",borderRadius:5,padding:"3px 10px",fontSize:13,color:"#E8A838",fontWeight:700,display:"inline-block",marginBottom:4}}>Games 3 – 6 · Point Stage Format</div>
                <div style={{fontSize:14,color:"#C8D4E0",lineHeight:1.8}}>Qualified players split into lobbies of 8 based on qualifier performance. Clash Scoring in effect. <span style={{color:"#F2EDE4",fontWeight:600}}>8 players eliminated after every game</span>, lobbies reshuffled after each game.</div>
              </div>
            </div>
            <div style={{background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.2)",borderRadius:8,padding:"12px 16px",fontSize:14,color:"#C8D4E0",lineHeight:1.8}}>
              <span style={{color:"#F87171",fontWeight:700}}>Tiebreaker (point stage):</span> Equal cumulative totals broken by <span style={{color:"#F2EDE4",fontWeight:600}}>most recent game placement</span> until the tie is broken.
            </div>
          </div>

          <Panel style={{padding:"24px"}}>
            <h2 style={{fontFamily:"'Cinzel',serif",fontSize:18,color:"#E8A838",marginBottom:20}}>Stage Breakdown</h2>
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {[
                {label:"Game 1",sub:"Qualifier Round 1",color:"#9B72CF",icon:"1",count:"62+ players · 16 lobbies",
                  bullets:["All check-ins split into lobbies of 8 (evenly distributed)","Top 4 per lobby advance - bottom 4 eliminated","Scores NOT counted toward cumulative total","G1 placement saved as final tiebreaker if needed"]},
                {label:"Game 2",sub:"Qualifier Round 2",color:"#9B72CF",icon:"2",count:"62 players · 8 lobbies",
                  bullets:["Survivors from G1 compete again in reshuffled lobbies","Top 4 per lobby advance to the Point Stage","G2 placement is the first tiebreaker (most recent)","G1 is the second tiebreaker"]},
                {label:"Game 3",sub:"Point Stage - 32 Players",color:"#4ECDC4",icon:"3",count:"32 players · 4 lobbies",
                  bullets:["Clash Scoring begins: 1st=8 · 2nd=7 · 3rd=6 · 4th=5 · 5th=4 · 6th=3 · 7th=2 · 8th=1","Lobbies seeded by qualifier performance","8 lowest scorers eliminated after results"]},
                {label:"Game 4",sub:"Point Stage - 24 Players",color:"#4ECDC4",icon:"4",count:"24 players · 3 lobbies",
                  bullets:["Points accumulate from G3+G4","Lobbies reshuffled based on current standings","8 lowest scorers eliminated after results"]},
                {label:"Game 5",sub:"Point Stage - 16 Players",color:"#4ECDC4",icon:"5",count:"16 players · 2 lobbies",
                  bullets:["Points accumulate from G3+G4+G5","Top 8 by cumulative total advance to Finals","8 lowest scorers eliminated"]},
                {label:"Game 6",sub:"Finals - 8 Players",color:"#E8A838",icon:"F",count:"8 players · 1 lobby",
                  bullets:["Single final lobby - highest cumulative total wins","Points still count in Finals","Champion $60 · Runner-up $40 · Top 8 all paid","Tiebreaker: G6 → G5 → G4 → G3 → G2 → G1"]},
              ].map(function(s,i,arr){return(
                <div key={s.label} style={{display:"flex",gap:14}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:42,height:42,borderRadius:10,background:"rgba(0,0,0,.5)",border:"2px solid "+s.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:s.color,flexShrink:0,fontFamily:"'Inter',sans-serif"}}>{s.icon}</div>
                    {i<arr.length-1&&<div style={{width:2,flex:1,minHeight:24,background:"rgba(255,255,255,.05)",margin:"4px 0"}}/>}
                  </div>
                  <div style={{flex:1,paddingBottom:i<arr.length-1?22:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <div style={{fontFamily:"'Cinzel',serif",fontSize:16,fontWeight:700,color:"#F2EDE4"}}>{s.label}</div>
                      <div className="cond" style={{background:"rgba(0,0,0,.4)",border:"1px solid "+s.color+"45",borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:700,color:s.color}}>{s.sub}</div>
                      <div className="cond" style={{fontSize:11,color:"#8896A8"}}>{s.count}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {s.bullets.map(function(b,bi){return(
                        <div key={bi} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:s.color,flexShrink:0,marginTop:7}}/>
                          <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6}}>{b}</div>
                        </div>
                      );})}
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </Panel>

          <Panel style={{padding:"22px 24px"}}>
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#F2EDE4",marginBottom:14}}>Points Table - Games 3 to 6</h3>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              {[[1,8,"#FFD700","1st"],[2,7,"#C0C0C0","2nd"],[3,6,"#CD7F32","3rd"],[4,5,"#52C47C","4th"],[5,4,"#9B72CF","5th"],[6,3,"#4ECDC4","6th"],[7,2,"#BECBD9","7th"],[8,1,"#8896A8","8th"]].map(function(row){return(
                <div key={row[0]} style={{display:"flex",flexDirection:"column",alignItems:"center",background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.05)",borderRadius:8,padding:"12px 14px",minWidth:58}}>
                  <div className="cond" style={{fontSize:22,fontWeight:700,color:row[2]}}>{row[1]}</div>
                  <div style={{fontSize:11,color:"#8896A8",marginTop:1}}>pts</div>
                  <div style={{fontSize:12,color:"#BECBD9",marginTop:3}}>{row[3]}</div>
                </div>
              );})}
            </div>
            <div style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.15)",borderRadius:8,padding:"12px 16px",fontSize:13,color:"#C8D4E0",lineHeight:1.8}}>
              <span style={{color:"#E8A838",fontWeight:600}}>Tiebreaker chain:</span> Equal cumulative totals broken by most recent game placement - G6 first, then G5, G4, G3, then G2 and G1 (the qualifier rounds).
            </div>
          </Panel>
        </div>
      )}

      {tab==="standings"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Panel style={{padding:"20px 22px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <h2 style={{fontFamily:"'Cinzel',serif",fontSize:18,color:"#E8A838",margin:0}}>All Participants</h2>
                <div style={{fontSize:13,color:"#BECBD9",marginTop:3}}>{STANDINGS.length} players · {STANDINGS.filter(function(p){return p.place<=32;}).length} reached point stage</div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {[["G1","#9B72CF"],["G2","#9B72CF"],["G3","#4ECDC4"],["G4","#4ECDC4"],["G5","#4ECDC4"],["G6","#E8A838"],["PTS","#F2EDE4"]].map(function(arr){return(
                  <div key={arr[0]} className="cond" style={{width:arr[0]==="PTS"?38:28,textAlign:"center",fontSize:12,color:arr[1],fontWeight:700,letterSpacing:".04em"}}>{arr[0]}</div>
                );})}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              {[["G1–G2","Qualifier","#9B72CF"],["G3–G5","Point Stage","#4ECDC4"],["G6","Finals","#E8A838"],["-","Elim in G2","#F87171"]].map(function(arr){return(
                <div key={arr[0]} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:10,height:10,borderRadius:2,background:arr[2]+"30",border:"1px solid "+arr[2]+"50"}}/>
                  <div style={{fontSize:12,color:"#BECBD9"}}><span style={{color:arr[2],fontWeight:600}}>{arr[0]}</span> {arr[1]}</div>
                </div>
              );})}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {displayed.map(function(p){
                var isElim=p.elim==="G2";
                var rowBg=p.place===1?"rgba(255,215,0,.06)":p.place<=3?"rgba(155,114,207,.05)":p.place<=8?"rgba(255,255,255,.025)":isElim?"rgba(248,113,113,.03)":"rgba(255,255,255,.015)";
                var rowBorder=p.place===1?"rgba(255,215,0,.18)":p.place<=3?"rgba(155,114,207,.12)":p.place<=8?"rgba(155,114,207,.05)":isElim?"rgba(248,113,113,.08)":"rgba(242,237,228,.03)";
                return(
                  <div key={p.ign} style={{display:"flex",alignItems:"center",gap:8,background:rowBg,borderRadius:7,padding:"8px 10px",border:"1px solid "+rowBorder}}>
                    <div style={{width:24,fontWeight:700,fontSize:12,color:isElim?"#8896A8":placeCol(p.place),textAlign:"right",flexShrink:0,fontFamily:"'Inter',sans-serif"}}>{p.place}</div>
                    <div style={{flex:1,fontSize:14,color:p.place<=8&&!isElim?"#F2EDE4":isElim?"#BECBD9":"#C8D4E0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{p.ign}</div>
                    {isElim&&<div className="cond" style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.18)",borderRadius:4,padding:"1px 6px",fontSize:11,color:"#F87171",flexShrink:0}}>OUT G2</div>}
                    {p.prize>0&&<div style={{background:"rgba(78,205,196,.1)",border:"1px solid rgba(78,205,196,.2)",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:700,color:"#4ECDC4",fontFamily:"'Inter',sans-serif",flexShrink:0}}>${p.prize}</div>}
                    <div style={{display:"flex",gap:2,flexShrink:0}}>
                      {[p.g1,p.g2,p.g3,p.g4,p.g5,p.g6].map(function(g,i){
                        var isQ=i<2;
                        var isFin=i===5;
                        var hasVal=g!==null&&g!==undefined;
                        return(
                          <div key={i} style={{width:28,height:24,borderRadius:4,background:hasVal?"rgba(0,0,0,.4)":"rgba(255,255,255,.015)",border:"1px solid "+(hasVal?(isQ?"rgba(155,114,207,.22)":isFin?"rgba(232,168,56,.28)":"rgba(78,205,196,.22)"):"rgba(255,255,255,.03)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:hasVal?ptCol(g):"#1F2937"}}>
                            {hasVal?g:"-"}
                          </div>
                        );
                      })}
                    </div>
                    <div className="cond" style={{fontSize:16,fontWeight:700,color:isElim?"#8896A8":"#C4B5FD",minWidth:36,textAlign:"right",flexShrink:0}}>{isElim?"-":p.total}</div>
                  </div>
                );
              })}
            </div>
            {!showAll&&(
              <button onClick={function(){setShowAll(true);}} style={{width:"100%",marginTop:10,padding:"10px",background:"rgba(155,114,207,.07)",border:"1px solid rgba(155,114,207,.18)",borderRadius:8,color:"#9B72CF",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>
                Show all {STANDINGS.length} participants (includes G2 eliminated)
              </button>
            )}
            {showAll&&(
              <button onClick={function(){setShowAll(false);}} style={{width:"100%",marginTop:10,padding:"10px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.07)",borderRadius:8,color:"#8896A8",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>
                Collapse
              </button>
            )}
          </Panel>
        </div>
      )}

      {tab==="lobbies"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.02)",borderRadius:10,padding:4,border:"1px solid rgba(242,237,228,.05)"}}>
            {["G1","G2","G3","G4","G5","G6"].map(function(r){
              var colors={"G1":"#9B72CF","G2":"#9B72CF","G3":"#4ECDC4","G4":"#4ECDC4","G5":"#4ECDC4","G6":"#E8A838"};
              var labels={"G1":"Game 1","G2":"Game 2","G3":"Game 3","G4":"Game 4","G5":"Game 5","G6":"Finals"};
              var active=lobbyRound===r;
              return(
                <button key={r} onClick={function(){setLobbyRound(r);setEditMode(false);}} style={{flex:1,padding:"9px 4px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".05em",transition:"all .15s",background:active?"rgba(255,255,255,.08)":"transparent",color:active?colors[r]:"#8896A8",outline:"none",textTransform:"uppercase",fontWeight:700,fontSize:12}}>
                  <div>{r}</div>
                  <div style={{fontSize:10,fontWeight:400,marginTop:1,color:active?colors[r]+"AA":"#8896A8"}}>{labels[r]}</div>
                </button>
              );
            })}
          </div>

          <div style={{background:"rgba(0,0,0,.35)",border:"1px solid "+roundMeta.color+"30",borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div>
              <div className="cond" style={{fontSize:12,color:roundMeta.color,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{roundMeta.tag}</div>
              <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.7,maxWidth:600}}>{roundMeta.desc}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div className="cond" style={{fontSize:12,color:"#BECBD9",padding:"4px 10px",background:"rgba(255,255,255,.03)",borderRadius:6,border:"1px solid rgba(255,255,255,.06)"}}>{roundMeta.count}</div>
              <button onClick={function(){setEditMode(function(p){return !p;});setScores({});}} style={{padding:"7px 14px",borderRadius:7,border:"1px solid "+(editMode?"rgba(78,205,196,.4)":"rgba(155,114,207,.3)"),background:editMode?"rgba(78,205,196,.1)":"rgba(155,114,207,.08)",color:editMode?"#4ECDC4":"#C4B5FD",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>
                {editMode?"Save Results":"Enter Results"}
              </button>
            </div>
          </div>

          {editMode&&(
            <div style={{background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.2)",borderRadius:10,padding:"14px 18px",fontSize:13,color:"#C8D4E0",lineHeight:1.7}}>
              <span style={{color:"#4ECDC4",fontWeight:700}}>Score entry mode active.</span> Click a placement number next to each player name to record their finish. Placements auto-de-conflict - assigning a spot removes it from any other player. Click "Save Results" when done.
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
            {(LOBBIES[lobbyRound]||[]).map(function(lobby){
              var sorted=[].concat(lobby.players).sort(function(a,b){return b.pts-a.pts;});
              var isQual=lobbyRound==="G1"||lobbyRound==="G2";
              var maxPlaces=lobby.players.length;
              return(
                <Panel key={lobby.name} style={{padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontFamily:"'Cinzel',serif",fontSize:15,fontWeight:700,color:"#F2EDE4"}}>{lobby.name}</div>
                    <div className="cond" style={{fontSize:11,color:roundMeta.color,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",background:"rgba(0,0,0,.3)",border:"1px solid "+roundMeta.color+"30",borderRadius:4,padding:"2px 7px"}}>{lobby.note}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {(editMode?lobby.players:[].concat(lobby.players).sort(function(a,b){return b.pts-a.pts;})).map(function(pl,idx){
                      var key=lobby.name+"::"+pl.ign;
                      var assignedPlace=scores[key];
                      var displayIdx=editMode?idx:sorted.indexOf(pl);
                      var top4=displayIdx<4&&isQual&&!editMode;
                      var winner=!isQual&&displayIdx===0&&!editMode;
                      var usedPlaces={};
                      Object.keys(scores).forEach(function(k){
                        if(k.startsWith(lobby.name+"::")) usedPlaces[scores[k]]=true;
                      });
                      return(
                        <div key={pl.ign} style={{display:"flex",alignItems:"center",gap:8,background:winner?"rgba(255,215,0,.07)":top4?"rgba(82,196,124,.05)":"rgba(255,255,255,.02)",borderRadius:6,padding:"7px 8px",border:"1px solid "+(winner?"rgba(255,215,0,.18)":top4?"rgba(82,196,124,.1)":"rgba(242,237,228,.03)")}}>
                          {!editMode&&<div style={{width:22,height:22,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"1px solid "+placeCol(displayIdx+1),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:placeCol(displayIdx+1),flexShrink:0}}>{displayIdx+1}</div>}
                          <div style={{flex:1,fontSize:13,color:top4||winner?"#F2EDE4":"#C8D4E0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pl.ign}</div>
                          {editMode&&(
                            <div style={{display:"flex",gap:2,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end",maxWidth:180}}>
                              {Array.from({length:maxPlaces},function(_,pi){return pi+1;}).map(function(place){
                                var taken=usedPlaces[place]&&assignedPlace!==place;
                                var selected=assignedPlace===place;
                                return(
                                  <button key={place} onClick={function(){toggleScore(lobby.name,pl.ign,place);}} disabled={taken} style={{width:26,height:26,borderRadius:5,border:"1px solid "+(selected?"#4ECDC4":taken?"rgba(255,255,255,.04)":"rgba(255,255,255,.1)"),background:selected?"rgba(78,205,196,.2)":taken?"rgba(255,255,255,.02)":"rgba(255,255,255,.03)",color:selected?"#4ECDC4":taken?"#7A8BA0":"#BECBD9",fontSize:11,fontWeight:700,cursor:taken?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>{place}</button>
                                );
                              })}
                            </div>
                          )}
                          {!editMode&&(
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              {top4&&<div className="cond" style={{fontSize:10,color:"#52C47C",fontWeight:700,background:"rgba(82,196,124,.1)",border:"1px solid rgba(82,196,124,.2)",borderRadius:3,padding:"1px 5px"}}>ADV</div>}
                              <div className="cond" style={{fontSize:14,fontWeight:700,color:isQual?"#C8D4E0":ptCol(pl.pts),minWidth:22,textAlign:"right"}}>{pl.pts===0?"DNF":pl.pts}</div>
                              {!isQual&&<div style={{fontSize:11,color:"#8896A8"}}>pts</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {editMode&&(
                    <div style={{marginTop:10,padding:"8px 10px",background:"rgba(0,0,0,.25)",borderRadius:6,fontSize:12,color:"#8896A8",textAlign:"center"}}>
                      {Object.keys(scores).filter(function(k){return k.startsWith(lobby.name+"::");}).length}/{lobby.players.length} placements entered
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>

          {lobbyRound==="G1"&&!editMode&&(
            <div style={{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.14)",borderRadius:8,padding:"12px 16px",fontSize:13,color:"#BECBD9",lineHeight:1.7}}>
              <span style={{color:"#C4B5FD",fontWeight:600}}>Game 1 shows qualifying advancers only.</span> Each lobby had additional participants who were eliminated in round 1 and did not advance to Game 2. Top 4 per lobby (shown here) moved on.
            </div>
          )}
        </div>
      )}

      {tab==="host"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.02)",borderRadius:10,padding:4,border:"1px solid rgba(242,237,228,.06)"}}>
            {[["setup","Tournament Setup"],["signup","Sign-Up Page"],["run","Run Tournament"],["announce","Announcements"]].map(function(arr){return(
              <button key={arr[0]} onClick={function(){setHostSetupTab(arr[0]);}} style={{flex:1,padding:"9px 6px",borderRadius:7,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Inter',sans-serif",letterSpacing:".05em",transition:"all .15s",background:hostSetupTab===arr[0]?"rgba(155,114,207,.22)":"transparent",color:hostSetupTab===arr[0]?"#C4B5FD":"#BECBD9",outline:"none",textTransform:"uppercase"}}>{arr[1]}</button>
            );})}
          </div>

          {hostSetupTab==="setup"&&(
            <Panel style={{padding:"22px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
                <h3 style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"#F2EDE4",margin:0}}>New Tournament</h3>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <img src="/Aegis_Esports.png" alt="Aegis Esports" style={{height:28,width:"auto",opacity:.85}}/>
                </div>
              </div>
              <div style={{display:"grid",gap:14}}>
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5,fontWeight:600}}>Tournament Name</div>
                  <input value={setupName} onChange={function(e){setSetupName(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",color:"#F2EDE4",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <div style={{fontSize:12,color:"#BECBD9",marginBottom:5,fontWeight:600}}>Date</div>
                    <input type="date" value={setupDate} onChange={function(e){setSetupDate(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",color:"#F2EDE4",fontSize:14,outline:"none",boxSizing:"border-box",colorScheme:"dark"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#BECBD9",marginBottom:5,fontWeight:600}}>Max Players</div>
                    <input value={setupMaxPlayers} onChange={function(e){setSetupMaxPlayers(e.target.value);}} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",color:"#F2EDE4",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:8,fontWeight:600}}>Format</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[["qualifier+points","Qualifier + Point Stage"],["swiss","Swiss"],["single-elim","Single Elimination"],["double-elim","Double Elimination"]].map(function(arr){return(
                      <button key={arr[0]} onClick={function(){setSetupFormat(arr[0]);}} style={{padding:"7px 14px",borderRadius:7,border:"1px solid "+(setupFormat===arr[0]?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),background:setupFormat===arr[0]?"rgba(155,114,207,.15)":"rgba(255,255,255,.02)",color:setupFormat===arr[0]?"#C4B5FD":"#BECBD9",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".05em",textTransform:"uppercase"}}>{arr[1]}</button>
                    );})}
                  </div>
                </div>
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <button onClick={function(){setSignupOpen(true);setHostSetupTab("signup");}} style={{padding:"10px 22px",borderRadius:8,border:"none",background:"#9B72CF",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>Open Sign-Up</button>
                  <button onClick={function(){setHostSetupTab("run");}} style={{padding:"10px 22px",borderRadius:8,border:"1px solid rgba(232,168,56,.3)",background:"rgba(232,168,56,.06)",color:"#E8A838",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>Run Tournament</button>
                </div>
              </div>
            </Panel>
          )}

          {hostSetupTab==="signup"&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Panel style={{padding:"22px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
                  <div>
                    <h3 style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"#F2EDE4",margin:0,marginBottom:4}}>{setupName}</h3>
                    <div style={{fontSize:12,color:"#BECBD9"}}>Sign-up page {signupOpen?<span style={{color:"#52C47C",fontWeight:700}}>OPEN</span>:<span style={{color:"#F87171",fontWeight:700}}>CLOSED</span>} &nbsp;·&nbsp; {registeredPlayers.length}/{setupMaxPlayers||64} players</div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={function(){setSignupOpen(function(v){return !v;});}} style={{padding:"7px 16px",borderRadius:7,border:"1px solid "+(signupOpen?"rgba(248,113,113,.4)":"rgba(82,196,124,.4)"),background:signupOpen?"rgba(248,113,113,.08)":"rgba(82,196,124,.08)",color:signupOpen?"#F87171":"#52C47C",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".05em",textTransform:"uppercase"}}>{signupOpen?"Close Sign-Up":"Reopen Sign-Up"}</button>
                  </div>
                </div>
                <div style={{background:"rgba(155,114,207,.07)",border:"1px solid rgba(155,114,207,.18)",borderRadius:8,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,fontSize:13,color:"#C8D4E0",fontFamily:"monospace"}}>tftclash.gg/join/{setupName.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")}</div>
                  <button onClick={function(){}} style={{padding:"5px 12px",borderRadius:6,border:"1px solid rgba(155,114,207,.3)",background:"rgba(155,114,207,.1)",color:"#C4B5FD",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".05em",textTransform:"uppercase",flexShrink:0}}>Copy Link</button>
                </div>
                {signupOpen&&(
                  <div style={{display:"flex",gap:8,marginBottom:14}}>
                    <input value={signupIgn} onChange={function(e){setSignupIgn(e.target.value);}} placeholder="Enter Riot IGN to register..." style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",color:"#F2EDE4",fontSize:14,outline:"none"}}/>
                    <button onClick={function(){
                      if(!signupIgn.trim())return;
                      if(registeredPlayers.includes(signupIgn.trim()))return;
                      setRegisteredPlayers(function(prev){return [...prev, signupIgn.trim()];});
                      setSignupIgn("");
                    }} style={{padding:"10px 18px",borderRadius:8,border:"none",background:"#9B72CF",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase",flexShrink:0}}>Register</button>
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {registeredPlayers.map(function(ign,idx){return(
                    <div key={ign} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.025)",borderRadius:6,padding:"8px 12px",border:"1px solid rgba(242,237,228,.05)"}}>
                      <div className="cond" style={{fontSize:12,color:"#8896A8",fontWeight:700,minWidth:24}}>{idx+1}</div>
                      <div style={{flex:1,fontSize:13,color:"#F2EDE4"}}>{ign}</div>
                      <div style={{fontSize:11,color:"#52C47C",fontWeight:700}}>Registered</div>
                      <button onClick={function(){setRegisteredPlayers(function(prev){return prev.filter(function(p){return p!==ign;});});}} style={{background:"none",border:"none",color:"#9AAABF",fontSize:14,cursor:"pointer",padding:"0 4px",lineHeight:1}}>x</button>
                    </div>
                  );})}
                  {registeredPlayers.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:"#8896A8",fontSize:13}}>No players registered yet. Share the link above.</div>}
                </div>
              </Panel>
            </div>
          )}

          {hostSetupTab==="run"&&(
          <Panel style={{padding:"22px"}}>
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"#F2EDE4",marginBottom:16}}>Tournament Controls</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {[
                {label:"Open Check-In",desc:"Allow players to check in for the next round",color:"#52C47C",icon:"✓"},
                {label:"Lock Lobbies",desc:"Finalize lobby assignments, no more changes",color:"#E8A838",icon:"🔒"},
                {label:"Open Score Entry",desc:"Enable score input for completed games",color:"#4ECDC4",icon:"✏"},
                {label:"Publish Results",desc:"Make game results visible to all participants",color:"#E8A838",icon:"📢"},
                {label:"Advance Round",desc:"Move tournament to next stage",color:"#9B72CF",icon:"→"},
              ].map(function(ctrl){return(
                <div key={ctrl.label} style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(242,237,228,.06)",borderRadius:10,padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{fontSize:18}}>{ctrl.icon}</div>
                    <div style={{fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700,color:"#F2EDE4",letterSpacing:".04em"}}>{ctrl.label}</div>
                  </div>
                  <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5}}>{ctrl.desc}</div>
                  <button style={{padding:"7px 12px",borderRadius:7,border:"1px solid "+ctrl.color+"40",background:ctrl.color+"12",color:ctrl.color,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>Activate</button>
                </div>
              );})}
            </div>
          </Panel>
          )}

          {hostSetupTab==="announce"&&(
          <Panel style={{padding:"22px"}}>
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"#F2EDE4",marginBottom:16}}>Compose Announcement</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <textarea
                value={draftMsg}
                onChange={function(e){setDraftMsg(e.target.value);}}
                placeholder="Type your announcement here..."
                style={{width:"100%",minHeight:90,background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:8,padding:"12px 14px",color:"#F2EDE4",fontSize:14,fontFamily:"'Inter',sans-serif",resize:"vertical",outline:"none",lineHeight:1.6}}
              />
              <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
                <div style={{fontSize:12,color:"#8896A8"}}>{draftMsg.length} characters</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={function(){setDraftMsg("");}} style={{padding:"7px 16px",borderRadius:7,border:"1px solid rgba(255,255,255,.08)",background:"transparent",color:"#BECBD9",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>Clear</button>
                  <button onClick={function(){if(draftMsg.trim()){setSentMsg(draftMsg);setDraftMsg("");}}} style={{padding:"7px 20px",borderRadius:7,border:"none",background:"#9B72CF",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>Post Announcement</button>
                </div>
              </div>
              {sentMsg&&(
                <div style={{background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.25)",borderRadius:8,padding:"12px 14px"}}>
                  <div className="cond" style={{fontSize:11,color:"#52C47C",fontWeight:700,letterSpacing:".1em",marginBottom:6}}>POSTED</div>
                  <div style={{fontSize:14,color:"#F2EDE4",lineHeight:1.6}}>{sentMsg}</div>
                </div>
              )}
            </div>
            <div style={{marginTop:18}}>
              <div className="cond" style={{fontSize:12,color:"#BECBD9",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:10}}>Quick Templates</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {SAMPLE_ANNOUNCEMENTS.map(function(sa){return(
                  <div key={sa.label} style={{display:"flex",alignItems:"flex-start",gap:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.05)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{flex:1}}>
                      <div className="cond" style={{fontSize:12,color:"#E8A838",fontWeight:700,marginBottom:3}}>{sa.label}</div>
                      <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.6}}>{sa.text}</div>
                    </div>
                    <button onClick={function(){setDraftMsg(sa.text);}} style={{padding:"5px 12px",borderRadius:6,border:"1px solid rgba(155,114,207,.3)",background:"rgba(155,114,207,.08)",color:"#C4B5FD",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".05em",textTransform:"uppercase",flexShrink:0}}>Use</button>
                  </div>
                );})}
              </div>
            </div>
          </Panel>
          )}

        </div>
      )}

      {tab==="platform"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
            {[
              {icon:"⚙",title:"Custom Formats",desc:"Top 4 qualifier, point stage, double elim, Swiss - any bracket structure you've run in Excel, we replicate it live."},
              {icon:"📡",title:"Live Score Input",desc:"Admins enter placements per game. Standings refresh instantly. Every player sees the update in real time."},
              {icon:"🎯",title:"Automated Seeding",desc:"Platform auto-generates lobby assignments per stage based on your format rules. No manual reshuffling."},
              {icon:"👤",title:"Player Profiles",desc:"Full history across every tournament - per-game placements, career stats, trends, and achievements."},
              {icon:"💰",title:"Prize Display",desc:"Prize pool, tier breakdown, and per-place payouts shown publicly on the tournament page throughout the event."},
              {icon:"🏷",title:"Org Branding",desc:"Your name, your sponsors, your logo front and center. Aegis Esports x ZenMarket - this page is already an example."},
              {icon:"📈",title:"Season Series",desc:"Run #151, #152, #153 as a season - cumulative leaderboard, Hall of Fame, and season recap auto-generated."},
              {icon:"📋",title:"Full Archives",desc:"Every past tournament preserved with lobby logs, standings, and stats. Shareable link for each event."},
            ].map(function(f){return(
              <Panel key={f.title} style={{padding:"18px"}}>
                <div style={{fontSize:24,marginBottom:10}}>{f.icon}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:15,fontWeight:700,color:"#F2EDE4",marginBottom:6}}>{f.title}</div>
                <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.7}}>{f.desc}</div>
              </Panel>
            );})}
          </div>
          <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.12) 0%,rgba(78,205,196,.07) 100%)",border:"1px solid rgba(155,114,207,.28)",borderRadius:16,padding:"26px"}}>
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:20,color:"#F2EDE4",marginBottom:8}}>Ready to run Showdown #152 on TFT Clash?</h3>
            <div style={{fontSize:14,color:"#C8D4E0",lineHeight:1.8,marginBottom:18}}>This entire page was generated from your Showdown #151 spreadsheet - your exact format, every lobby, every placement, all 62+ players. No Excel. No manual updates. This is what your community sees live, every week.</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={function(){setScreen("host-apply");}} style={{background:"#9B72CF",border:"none",borderRadius:8,padding:"11px 22px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>Apply as Host Partner</button>
              <button onClick={function(){setScreen("pricing");}} style={{background:"transparent",border:"1px solid rgba(155,114,207,.4)",borderRadius:8,padding:"11px 22px",fontSize:13,fontWeight:700,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".06em",textTransform:"uppercase"}}>View Hosting Plans</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function TFTClash(){
  const [screen,setScreen]=useState("home");
  const [players,setPlayers]=useState(()=>{try{const s=localStorage.getItem("tft-players");return s?JSON.parse(s):SEED;}catch{return SEED;}});
  const [isAdmin,setIsAdmin]=useState(false);
  const [notifications,setNotifications]=useState(()=>{try{const s=localStorage.getItem("tft-notifications");return s?JSON.parse(s):NOTIF_SEED;}catch{return NOTIF_SEED;}});
  const [toasts,setToasts]=useState([]);
  const [disputes]=useState([]);
  const [announcement,setAnnouncement]=useState("⚡ Clash #14 is LIVE NOW - Round 1 underway! 24 players across 3 lobbies. Good luck!");
  const [profilePlayer,setProfilePlayer]=useState(null);
  const [tournamentState,setTournamentState]=useState(()=>{try{const s=localStorage.getItem("tft-tournament");return s?JSON.parse(s):{phase:"registration",round:1,lobbies:[],lockedLobbies:[]};}catch{return {phase:"registration",round:1,lobbies:[],lockedLobbies:[]};}});
  const [seasonConfig,setSeasonConfig]=useState(()=>{try{var s=localStorage.getItem("tft-season-config");return s?JSON.parse(s):DEFAULT_SEASON_CONFIG;}catch(e){return DEFAULT_SEASON_CONFIG;}});
  const [quickClashes,setQuickClashes]=useState(()=>{try{var s=localStorage.getItem("tft-events");return s?JSON.parse(s):[];}catch(e){return [];}});
  const [orgSponsors,setOrgSponsors]=useState(()=>{try{var s=localStorage.getItem("tft-sponsors");return s?JSON.parse(s):{};}catch(e){return {};}});
  // Auth state
  const [currentUser,setCurrentUser]=useState(null); // null = guest; hydrated by Supabase auth
  const [authScreen,setAuthScreen]=useState(null); // "login" | "signup" | null

  function markAllRead(){setNotifications(ns=>ns.map(n=>({...n,read:true})));}
  function toast(msg,type){const id=Date.now()+Math.random();setToasts(ts=>[...ts,{id,msg,type}]);}
  function removeToast(id){setToasts(ts=>ts.filter(t=>t.id!==id));}
  // Supabase auth listener — hydrates currentUser on load and keeps it in sync
  useEffect(()=>{
    function mapUser(u){
      if(!u)return null;
      const discordName=u.identities?.find(i=>i.provider==='discord')?.identity_data?.global_name
        ||u.user_metadata?.full_name;
      const username=u.user_metadata?.username||discordName||u.email?.split('@')[0]||"Player";
      return{...u,username};
    }
    supabase.auth.getSession().then(({data:{session}})=>setCurrentUser(mapUser(session?.user??null)));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>setCurrentUser(mapUser(session?.user??null)));
    return ()=>subscription.unsubscribe();
  },[]);
  // localStorage sync
  useEffect(()=>{try{localStorage.setItem("tft-players",JSON.stringify(players));}catch{}},[players]);
  useEffect(()=>{try{localStorage.setItem("tft-notifications",JSON.stringify(notifications));}catch{}},[notifications]);
  useEffect(()=>{try{localStorage.setItem("tft-tournament",JSON.stringify(tournamentState));}catch{}},[tournamentState]);
  useEffect(function(){try{localStorage.setItem("tft-season-config",JSON.stringify(seasonConfig));}catch(e){}},[seasonConfig]);
  useEffect(function(){try{localStorage.setItem("tft-events",JSON.stringify(quickClashes));}catch(e){}},[quickClashes]);
  useEffect(function(){try{localStorage.setItem("tft-sponsors",JSON.stringify(orgSponsors));}catch(e){}},[orgSponsors]);
  function navTo(s){
    if((s==="scrims"||s==="admin")&&!isAdmin){toast("Admin access required","error");return;}
    window.history.pushState({screen:s},'','#'+s);
    setScreen(s);
  }
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("error")){
      const desc=params.get("error_description")||"Sign-in failed. Please try again.";
      toast(decodeURIComponent(desc.replace(/\+/g," ")),"error");
    }
    const h=window.location.hash.slice(1);
    // If this is a Supabase auth callback, leave the URL alone — Supabase's async
    // initialize() needs to read #access_token=... before we strip it
    const isAuthCallback=h.startsWith("access_token")||h.startsWith("error_description")||params.get("code");
    if(isAuthCallback){
      window.addEventListener("popstate",function onPop(e){setScreen(e.state?.screen||"home");});
      return;
    }
    const safeScreens=["home","standings","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","aegis-showcase","host-apply","host-dashboard","scrims","admin","roster"];
    const dest=safeScreens.includes(h)?h:"home";
    if(dest!=="home"){setScreen(dest);}
    window.history.replaceState({screen:dest},'','#'+dest);
    function onPop(e){setScreen(e.state?.screen||"home");}
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);
  function handleLogin(user){
    setCurrentUser(user); // null = guest continue
    setAuthScreen(null);
  }
  function handleSignUp(user){
    setCurrentUser(user);
    setAuthScreen(null);
  }
  async function handleLogout(){
    await supabase.auth.signOut();
    setCurrentUser(null);
    setScreen("home");
  }
  function updateUser(updated){setCurrentUser(updated);}
  function joinQuickClash(qcId,playerId){
    setQuickClashes(function(qs){return qs.map(function(q){
      if(q.id!==qcId||q.players.includes(playerId)) return q;
      var np=q.players.concat([playerId]);
      return Object.assign({},q,{players:np,status:np.length>=q.cap?"full":q.status});
    });});
  }

  // Show auth screens fullscreen
  if(authScreen==="login") return(
    <>
      <style>{GCSS+styleHideMobile}</style>
      <Hexbg/>
      <div style={{position:"relative",zIndex:1}}>
        <LoginScreen onLogin={handleLogin} onGoSignUp={()=>setAuthScreen("signup")} onBack={()=>setAuthScreen(null)} toast={toast}/>
        <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>
          {toasts.map(t=><div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>)}
        </div>
      </div>
    </>
  );
  if(authScreen==="signup") return(
    <>
      <style>{GCSS+styleHideMobile}</style>
      <Hexbg/>
      <div style={{position:"relative",zIndex:1}}>
        <SignUpScreen onSignUp={handleSignUp} onGoLogin={()=>setAuthScreen("login")} onBack={()=>setAuthScreen(null)} toast={toast}/>
        <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>
          {toasts.map(t=><div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>)}
        </div>
      </div>
    </>
  );

  return(
    <>
      <style>{GCSS+styleHideMobile+`
        .hide-mobile-text{display:inline;}
        @media(max-width:600px){.hide-mobile-text{display:none;}}
        @media(max-width:767px){
          .hide-mobile{display:none!important;}
          body,#root{overflow-x:hidden;max-width:100vw;}
          .wrap{overflow-x:hidden;padding:0 12px;}
          .page{padding:16px 12px 96px;}
        }
      `}</style>
      <Hexbg/>
      <div style={{position:"relative",zIndex:1,minHeight:"100vh"}}>
        <Navbar screen={screen} setScreen={navTo} players={players} isAdmin={isAdmin} setIsAdmin={setIsAdmin} toast={toast} disputes={disputes}
          currentUser={currentUser} onAuthClick={(mode)=>setAuthScreen(mode)} notifications={notifications} onMarkAllRead={markAllRead}/>

        {screen==="home"       &&<HomeScreen players={players} setPlayers={setPlayers} setScreen={navTo} toast={toast} announcement={announcement} setProfilePlayer={setProfilePlayer} currentUser={currentUser} onAuthClick={(m)=>setAuthScreen(m)} tournamentState={tournamentState} setTournamentState={setTournamentState} quickClashes={quickClashes} onJoinQuickClash={joinQuickClash}/>}
        {screen==="roster"     &&<RosterScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser}/>}
        {screen==="bracket"    &&<BracketScreen players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig}/>}
        {screen==="leaderboard"&&<LeaderboardScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser}/>}
        {screen==="profile"    &&profilePlayer&&<PlayerProfileScreen player={profilePlayer} onBack={()=>setScreen("leaderboard")} allPlayers={players} setScreen={navTo} currentUser={currentUser} seasonConfig={seasonConfig}/>}
        {screen==="results"    &&<ResultsScreen players={players} toast={toast} setScreen={navTo} setProfilePlayer={setProfilePlayer}/>}
        {screen==="hof"        &&<HofScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer}/>}
        {screen==="archive"    &&<ArchiveScreen players={players} currentUser={currentUser} setScreen={navTo}/>}
        {screen==="milestones" &&<MilestonesScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser}/>}
        {screen==="challenges" &&<ChallengesScreen currentUser={currentUser} players={players} toast={toast}/>}
        {screen==="rules"      &&<RulesScreen setScreen={navTo}/>}
        {screen==="faq"        &&<FAQScreen setScreen={navTo}/>}
        {screen==="pricing"    &&<PricingScreen currentPlan="free" toast={toast}/>}
        {screen==="recap"      &&profilePlayer&&<SeasonRecapScreen player={profilePlayer} players={players} toast={toast} setScreen={navTo}/>}
        {screen==="recap"      &&!profilePlayer&&<SeasonRecapScreen player={players[0]||SEED[0]} players={players} toast={toast} setScreen={navTo}/>}
        {screen==="account"    &&currentUser&&<AccountScreen user={currentUser} onUpdate={updateUser} onLogout={handleLogout} toast={toast} setScreen={navTo} players={players} setProfilePlayer={setProfilePlayer}/>}
        {screen==="account"    &&!currentUser&&<AutoLogin setAuthScreen={setAuthScreen}/>}
        {screen==="aegis-showcase"&&<AegisShowcaseScreen setScreen={navTo}/>}
        {screen==="host-apply" &&<HostApplyScreen currentUser={currentUser} toast={toast} setScreen={navTo}/>}
        {screen==="host-dashboard"&&<HostDashboardScreen currentUser={currentUser} players={players} toast={toast} setScreen={navTo}/>}
        {screen==="fantasy"    &&<HomeScreen players={players} setPlayers={setPlayers} setScreen={navTo} toast={toast} announcement={announcement} setProfilePlayer={setProfilePlayer} currentUser={currentUser} onAuthClick={(m)=>setAuthScreen(m)}/>}
        {screen==="scrims"     &&isAdmin&&<ScrimsScreen players={players} toast={toast} setScreen={navTo}/>}
        {screen==="admin"      &&isAdmin&&<AdminPanel players={players} setPlayers={setPlayers} toast={toast} setAnnouncement={setAnnouncement} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig} setSeasonConfig={setSeasonConfig} quickClashes={quickClashes} setQuickClashes={setQuickClashes} orgSponsors={orgSponsors} setOrgSponsors={setOrgSponsors}/>}
        {screen==="admin"      &&!isAdmin&&(
          <div className="page" style={{textAlign:"center",maxWidth:440,margin:"0 auto"}}>
            <div style={{fontSize:38,marginBottom:14}}>🔒</div>
            <h2 style={{color:"#F2EDE4",marginBottom:8}}>Admin Required</h2>
            <div style={{fontSize:13,color:"#9AAABF"}}>Contact an admin to get access.</div>
          </div>
        )}
      </div>

      {/* Toasts */}
      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>
        {toasts.map(t=>(
          <div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>
        ))}
      </div>
    </>
  );
}

