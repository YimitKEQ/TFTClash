import { useState, useEffect, useRef, useMemo, Component } from "react";
import * as Sentry from '@sentry/react';

import { supabase } from './lib/supabase.js';

// ─── DATA VERSION — bump to bust stale localStorage ─────────────────────────
var DATA_VERSION=2;
(function(){try{var v=localStorage.getItem("tft-data-version");if(v!==String(DATA_VERSION)){var keys=Object.keys(localStorage).filter(function(k){return k.startsWith("tft-");});keys.forEach(function(k){localStorage.removeItem(k);});localStorage.setItem("tft-data-version",String(DATA_VERSION));dbg("[TFT] Cleared stale localStorage (v"+DATA_VERSION+")");}}catch(e){}}());



// ─── DEBUG LOGGING ─────────────────────────────────────────────────────────────
var TFT_DEBUG=typeof window!=="undefined"&&window.location.search.indexOf("debug=1")>-1;
function dbg(){if(TFT_DEBUG)console.log.apply(console,arguments);}

// ─── ERROR BOUNDARY ────────────────────────────────────────────────────────────

class ErrorBoundary extends Component {

  constructor(props){super(props);this.state={hasError:false};}

  static getDerivedStateFromError(){return{hasError:true};}

  componentDidCatch(error,info){console.error("TFT Clash error:",error,info);Sentry.captureException(error,{extra:{componentStack:info&&info.componentStack}});}

  render(){

    if(this.state.hasError){

      return(

        <div style={{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:99999,padding:24}}>

          <div style={{fontSize:48}}>⚠️</div>

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:22,color:"#F2EDE4",textAlign:"center"}}>Something went wrong</div>

          <div style={{fontSize:14,color:"#9AAABF",maxWidth:340,textAlign:"center",lineHeight:1.6}}>The app hit an unexpected error. Your data is safe — refresh to get back in.</div>

          <button onClick={()=>this.setState({hasError:false})} style={{marginTop:8,padding:"10px 24px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:14}}>Try Again</button>

          <button onClick={()=>window.location.reload()} style={{padding:"8px 20px",background:"transparent",border:"1px solid rgba(155,114,207,.4)",borderRadius:8,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:13}}>Reload Page</button>

        </div>

      );

    }

    return this.props.children;

  }

}

// Per-screen error boundary — isolates crashes to individual screens
class ScreenBoundary extends Component {

  constructor(props){super(props);this.state={hasError:false,error:null};}

  static getDerivedStateFromError(error){return{hasError:true,error:error};}

  componentDidCatch(error,info){console.error("[TFT] Screen crash ("+this.props.name+"):",error,info);Sentry.captureException(error,{tags:{screen:this.props.name},extra:{componentStack:info&&info.componentStack}});}

  render(){
    if(this.state.hasError){
      var self=this;
      return(
        <div className="page wrap" style={{textAlign:"center",paddingTop:80,maxWidth:440,margin:"0 auto"}}>
          <div style={{fontSize:42,marginBottom:16}}>⚠️</div>
          <h2 style={{color:"#F2EDE4",marginBottom:8,fontFamily:"'Russo One',sans-serif"}}>{"Something went wrong"}</h2>
          <div style={{fontSize:14,color:"#9AAABF",marginBottom:20,lineHeight:1.6}}>{"This screen ran into an error. Your data is safe."}</div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={function(){self.setState({hasError:false,error:null});}} style={{padding:"10px 24px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:14}}>Try Again</button>
            <button onClick={function(){self.setState({hasError:false,error:null});if(self.props.onHome)self.props.onHome();}} style={{padding:"8px 20px",background:"transparent",border:"1px solid rgba(155,114,207,.4)",borderRadius:8,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:13}}>Go Home</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }

}



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

  seasonName: "Season 1",

  seasonTag: "S1",

  defaultClashSize: 126,

};

const TIERS = [{label:"S",min:850,col:"#FFD700"},{label:"A",min:650,col:"#52C47C"},{label:"B",min:450,col:"#4ECDC4"},{label:"C",min:200,col:"#9B72CF"},{label:"D",min:0,col:"#BECBD9"}];



// ─── INPUT SANITIZATION ──────────────────────────────────────────────────────
var SANITIZE_MAP={"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#x27;"};
function sanitize(str){if(typeof str!=='string')return '';return str.replace(/[&<>"']/g,function(c){return SANITIZE_MAP[c]||c;}).replace(/<[^>]*>/g,'');}

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

  const wins=h.filter(g=>(g.place||g.placement)===1).length||player.wins||0;

  const top4=h.filter(g=>(g.place||g.placement)<=4).length||player.top4||0;

  const bot4=h.filter(g=>(g.place||g.placement)>4).length;

  // AVP = sum of all placements / total games (lower = better)

  const avgPlacement=h.length>0

    ?(h.reduce((s,g)=>s+(g.place||g.placement||0),0)/h.length)

    :(parseFloat(player.avg)||0);



  // Per-round avgs (from roundPlacements field in history)

  const roundAvgs={r1:null,r2:null,r3:null,finals:null};

  const roundKeys=["r1","r2","r3","finals"];

  roundKeys.forEach(rk=>{

    const vals=h.map(g=>g.roundPlacements?.[rk]).filter(v=>v!=null);

    if(vals.length>0)roundAvgs[rk]=(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2);

  });



  // Comeback rate: placed 5-8 in r1 but finished top4 overall

  const comebacks=h.filter(g=>g.roundPlacements?.r1>=5&&(g.place||g.placement)<=4).length;

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

        return rounds.length>0?(rounds.reduce((s,v)=>s+v,0)/rounds.length):(g.place||g.placement);

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

    var aC = (a.clashHistory || []).filter(function(h) { return (h.place||h.placement) === p; }).length;

    var bC = (b.clashHistory || []).filter(function(h) { return (h.place||h.placement) === p; }).length;

    if (bC !== aC) return bC - aC;

  }

  var aLast = a.clashHistory && a.clashHistory.length ? (a.clashHistory[a.clashHistory.length - 1].place||a.clashHistory[a.clashHistory.length - 1].placement) || 9 : 9;

  var bLast = b.clashHistory && b.clashHistory.length ? (b.clashHistory[b.clashHistory.length - 1].place||b.clashHistory[b.clashHistory.length - 1].placement) || 9 : 9;

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

  {id:"untouchable",    tier:"legendary", icon:"💠",  name:"Untouchable",        desc:"Finish in top 4 every game in a single clash",         check:p=>(p.clashHistory||[]).some(g=>(g.place||g.placement)<=4)&&p.top4>=p.games},

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

  {id:"perfect_lobby",  tier:"legendary", icon:"🌀",  name:"The Anomaly",        desc:"Win a lobby without ever placing below 3rd in any round", check:p=>(p.clashHistory||[]).some(g=>(g.place||g.placement)===1&&(g.roundPlacements?Object.values(g.roundPlacements).every(v=>v<=3):true))},

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







// ─── SEED DATA ────────────────────────────────────────────────────────────────



const HOMIES_IDS=[];

const SEED=[];

const PAST_CLASHES=[];








// ─── AUTH / ACCOUNT SYSTEM ───────────────────────────────────────────────────

// ─── CHAMPION SYSTEM ─────────────────────────────────────────────────────────

let SEASON_CHAMPION=null; // computed from live standings — no hardcoded champion



// ─── MILESTONE REWARDS ────────────────────────────────────────────────────────

// ─── SPONSOR / AD DATA ────────────────────────────────────────────────────────

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

    features:["Everything in Player","Auto check-in (never miss a clash)","Custom profile: avatar, banner & bio styling","Pro badge on profile & leaderboard","Season Recap card (shareable PNG)","Extended stat history - all seasons","Exclusive Discord channels (tactics, meta, pro-only)","Early access to new features"],

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

@import url('https://fonts.googleapis.com/css2?family=Russo+One&family=Chakra+Petch:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

html,body,#root{background:#07070E;}

html{color:#D4CEC9;font-family:'Chakra Petch',system-ui,sans-serif;font-size:15px;line-height:1.65;-webkit-text-size-adjust:100%;}

body{overflow-x:hidden;padding-bottom:env(safe-area-inset-bottom);min-height:100vh;}

::-webkit-scrollbar{width:4px;background:#0A0F1A;}

::-webkit-scrollbar-thumb{background:rgba(232,168,56,.3);border-radius:3px;}

input,select,textarea{font-family:'Chakra Petch',sans-serif;outline:none;color:#F2EDE4;-webkit-appearance:none;appearance:none;}

button{font-family:'Chakra Petch',sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;}

input::placeholder{color:#6B7280!important;opacity:1!important;}

select option{background:#1C2030;color:#F2EDE4;}

h1,h2,h3,h4{font-family:'Russo One',Georgia,sans-serif;font-weight:700;letter-spacing:.02em;}

.mono{font-family:'JetBrains Mono',monospace!important;}

.cond{font-family:'Chakra Petch',sans-serif!important;}



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

  color:#6B7280;transition:color .2s,text-shadow .2s;font-family:'Chakra Petch',sans-serif;

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

.display{font-family:'Russo One',sans-serif;font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:.03em;text-transform:uppercase;}

.section-title{font-family:'Russo One',sans-serif;font-size:clamp(18px,2.5vw,28px);font-weight:700;letter-spacing:.08em;text-transform:uppercase;}

.accent-bar::before{content:"";display:block;height:3px;background:linear-gradient(90deg,#9B72CF,#4ECDC4);border-radius:2px;margin-bottom:16px;}

.panel-glass{background:rgba(255,255,255,.035)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.09)!important;border-radius:16px!important;}

.panel-gradient{background:linear-gradient(135deg,rgba(155,114,207,.1),rgba(78,205,196,.04))!important;border:1px solid rgba(155,114,207,.18)!important;}

.countdown-tile{background:linear-gradient(160deg,rgba(155,114,207,.15),rgba(78,205,196,.05));border:1px solid rgba(155,114,207,.3);border-radius:12px;padding:14px 12px;text-align:center;min-width:64px;}

.countdown-tile .digit{font-family:'JetBrains Mono',monospace;font-size:38px;font-weight:800;color:#E8A838;line-height:1;text-shadow:0 0 24px rgba(232,168,56,.6),0 0 48px rgba(232,168,56,.2);}

.countdown-tile .unit{font-family:'Chakra Petch',sans-serif;font-size:9px;color:#6B7280;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:4px;}

.hero-panel{background:radial-gradient(ellipse at 50% 0%,rgba(155,114,207,.18) 0%,rgba(8,8,15,.0) 70%);border:1px solid rgba(155,114,207,.2);border-radius:20px;padding:40px 32px;position:relative;overflow:hidden;}

.hero-panel::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(155,114,207,.06),rgba(78,205,196,.02));pointer-events:none;}

.top-nav{border-top:2px solid #9B72CF!important;box-shadow:0 2px 0 rgba(155,114,207,.08),0 1px 0 rgba(232,168,56,.1),0 8px 40px rgba(0,0,0,.7)!important;}



/* ═══════════════════════════════════════════════════════════

   ESPORTS OVERHAUL — Retro-Futurism Premium Layer

   ═══════════════════════════════════════════════════════════ */



/* ── Rank number dramatic treatment ─────────────────────── */

.rank-1 .rank-num{color:#FFD700!important;text-shadow:0 0 20px rgba(255,215,0,.9),0 0 40px rgba(255,215,0,.4)!important;font-size:20px!important;}

.rank-2 .rank-num{color:#C0C0C0!important;text-shadow:0 0 14px rgba(192,192,192,.7)!important;}

.rank-3 .rank-num{color:#CD7F32!important;text-shadow:0 0 14px rgba(205,127,50,.7)!important;}



/* ── New keyframes ───────────────────────────────────────── */

@keyframes glitch{0%,100%{transform:translate(0);clip-path:none}20%{transform:translate(-2px,1px);clip-path:inset(20% 0 60% 0)}40%{transform:translate(2px,-1px);clip-path:inset(60% 0 20% 0)}60%{transform:translate(0)}}

@keyframes shimmer-scan{0%{left:-100%}100%{left:200%}}

@keyframes holo-shift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

@keyframes trophy-pulse{0%,100%{filter:drop-shadow(0 0 6px rgba(232,168,56,.5))}50%{filter:drop-shadow(0 0 18px rgba(232,168,56,1)) drop-shadow(0 0 36px rgba(232,168,56,.4))}}

@keyframes scan-move{0%{top:-3%}100%{top:103%}}

@keyframes border-race{0%{background-position:0% 0%}100%{background-position:200% 0%}}

@keyframes neon-border-pulse{0%,100%{box-shadow:0 0 0 0 rgba(155,114,207,0)}50%{box-shadow:0 0 0 2px rgba(155,114,207,.35),0 0 20px rgba(155,114,207,.15)}}



/* ── Shimmer card effect ─────────────────────────────────── */

.shimmer-card{position:relative;overflow:hidden;}

.shimmer-card::after{content:"";position:absolute;top:0;left:-100%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.03),transparent);animation:shimmer-scan 4s ease infinite;pointer-events:none;}



/* ── Elite panel variant ─────────────────────────────────── */

.panel-elite{background:linear-gradient(145deg,rgba(18,28,48,.9) 0%,rgba(10,15,28,.95) 100%)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;border:1px solid rgba(255,255,255,.09)!important;box-shadow:0 8px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.3)!important;}



/* ── Gradient border on hero/featured elements ───────────── */

.border-neon-grad{position:relative;}

.border-neon-grad::before{content:"";position:absolute;inset:-1px;border-radius:inherit;background:linear-gradient(135deg,rgba(232,168,56,.5),rgba(155,114,207,.4),rgba(78,205,196,.3));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:0;}



/* ── Holographic champion row ────────────────────────────── */

.row-champion{background:linear-gradient(270deg,rgba(232,168,56,.07),rgba(155,114,207,.06),rgba(78,205,196,.05))!important;background-size:300% 300%!important;animation:holo-shift 6s ease infinite!important;}



/* ── Trophy glow ─────────────────────────────────────────── */

.trophy-glow{animation:trophy-pulse 2.5s ease infinite;}



/* ── Moving retro scan line ──────────────────────────────── */

.retro-scan-line{position:fixed;left:0;right:0;height:120px;background:linear-gradient(180deg,transparent,rgba(155,114,207,.025),transparent);pointer-events:none;z-index:2;animation:scan-move 10s linear infinite;}



/* ── Neon underline heading style ────────────────────────── */

.neon-underline{position:relative;padding-bottom:12px;}

.neon-underline::after{content:"";position:absolute;bottom:0;left:0;width:44px;height:2px;background:linear-gradient(90deg,#9B72CF,#4ECDC4);border-radius:2px;box-shadow:0 0 10px rgba(155,114,207,.7),0 0 20px rgba(155,114,207,.3);}



/* ── Number/pts counter style ────────────────────────────── */

.pts-counter{font-family:'JetBrains Mono',monospace!important;color:#E8A838!important;text-shadow:0 0 14px rgba(232,168,56,.6)!important;font-weight:800!important;}



/* ── Player name hover ───────────────────────────────────── */

.player-name-hover{transition:color .2s,text-shadow .2s;cursor:pointer;}

.player-name-hover:hover{color:#F2EDE4!important;text-shadow:0 0 12px rgba(155,114,207,.5)!important;}



/* ── Tube-light top nav active ───────────────────────────── */

.top-nav button[data-active="true"]::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:60%;height:2px;background:#9B72CF;border-radius:0 0 4px 4px;box-shadow:0 0 12px rgba(155,114,207,.9),0 0 24px rgba(155,114,207,.5),0 4px 16px rgba(155,114,207,.3);}



/* ── Bottom nav active glyph ─────────────────────────────── */

.bottom-nav button.active::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:28px;height:2px;background:linear-gradient(90deg,#9B72CF,#E8A838);border-radius:0 0 3px 3px;box-shadow:0 0 10px rgba(155,114,207,.7);}

.bottom-nav button{position:relative;}



/* ── Section separator ───────────────────────────────────── */

.sep-gradient{height:1px;background:linear-gradient(90deg,transparent,rgba(155,114,207,.4),rgba(78,205,196,.2),transparent);margin:20px 0;}



/* ── Stat value glow ─────────────────────────────────────── */

.stat-val-glow{color:#E8A838;text-shadow:0 0 16px rgba(232,168,56,.5);font-weight:800;font-family:'JetBrains Mono',monospace;}



/* ── Countdown tile pulse border ─────────────────────────── */

.countdown-tile{animation:neon-border-pulse 3s ease infinite!important;}



/* ── Enhanced glass ──────────────────────────────────────── */

.glass{background:rgba(255,255,255,.035)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;border:1px solid rgba(255,255,255,.08)!important;box-shadow:0 4px 24px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06)!important;}



/* ── Hex pattern enhanced ────────────────────────────────── */

.hex-pattern{opacity:.06!important;}



/* ── Tag pill neon glow ───────────────────────────────────── */

.tag-neon{box-shadow:0 0 10px currentColor;opacity:.9;}



/* ── Input glow ring ─────────────────────────────────────── */

input:focus,select:focus,textarea:focus{background:#0F1A2E!important;box-shadow:0 0 0 1px rgba(155,114,207,.6),0 0 20px rgba(155,114,207,.15)!important;border-color:rgba(155,114,207,.7)!important;}



/* ── Winner placement badge ──────────────────────────────── */

.place-1{background:linear-gradient(135deg,#E8A838,#D4922A)!important;color:#07070E!important;box-shadow:0 0 14px rgba(232,168,56,.5)!important;}

.place-top4{border-color:rgba(78,205,196,.4)!important;color:#4ECDC4!important;}



/* ── CTA button premium ──────────────────────────────────── */

.btn-cta{position:relative;overflow:hidden;}

.btn-cta::after{content:"";position:absolute;top:-50%;left:-60%;width:30%;height:200%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);transform:skewX(-20deg);animation:shimmer-scan 3s ease infinite;}



/* ── Inner mini-box (stat/info nested boxes) ─────────────── */

.inner-box{background:linear-gradient(160deg,rgba(10,16,34,.92),rgba(6,10,20,.96));border:1px solid rgba(242,237,228,.08);border-radius:9px;transition:border-color .2s;}

.inner-box:hover{border-color:rgba(232,168,56,.14);}



/* ── Task/challenge card ──────────────────────────────────── */

.task-card{background:linear-gradient(160deg,rgba(14,22,40,.9),rgba(8,12,24,.95));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(242,237,228,.09);border-radius:12px;padding:16px;transition:border-color .25s,box-shadow .25s;}

.task-card:hover{border-color:rgba(232,168,56,.22);box-shadow:0 6px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);}



/* ── Announcement item row ───────────────────────────────── */

.ann-item{background:linear-gradient(160deg,rgba(12,18,36,.9),rgba(7,11,22,.95));border:1px solid rgba(242,237,228,.08);border-radius:9px;padding:12px;}



/* ── Weekly challenge card ───────────────────────────────── */

.weekly-card{background:linear-gradient(135deg,rgba(155,114,207,.06),rgba(78,205,196,.02));border:1px solid rgba(155,114,207,.18);border-radius:12px;padding:16px;transition:border-color .2s;}

.weekly-card:hover{border-color:rgba(155,114,207,.35);}



/* ── Mobile responsiveness fixes ────────────────────────────── */

@media(max-width:767px){

  /* Mobile table fixes */
  .clash-table{font-size:12px;}
  .clash-table td,.clash-table th{padding:6px 8px;}

  /* Mobile bracket fixes */
  .lobby-card{margin-bottom:12px;}

  /* Mobile nav spacing */
  .mobile-bottom-nav{padding-bottom:env(safe-area-inset-bottom,8px);}

  /* Mobile profile tabs - horizontal scroll */
  .profile-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;}

  /* Mobile touch targets */
  button{min-height:40px;}

}

@media(max-width:480px){

  /* Mobile panel padding reduction */
  .panel-sm-pad{padding:14px!important;}

  /* Reduce grid gaps on small screens */
  .grid-home{gap:16px!important;}

  /* Challenges grid — stack on small screens */
  .challenges-grid{grid-template-columns:1fr 50px 50px 50px 50px 50px!important;}

  /* Standings table allow shrink */
  .standings-table-wrap{min-width:0!important;}

}

@media(max-width:375px){

  /* Small phone (iPhone SE etc) tweaks */
  .page.wrap{padding-left:10px!important;padding-right:10px!important;}
  .panel-sm-pad{padding:10px!important;}
  h2{font-size:18px!important;}
  .cond{letter-spacing:.02em!important;}
  .lab-tabs button{padding:6px 8px!important;font-size:11px!important;}
  .challenges-grid{grid-template-columns:1fr 44px 44px 44px 44px 44px!important;}

}
/* -- Lab (Scrims) mobile grid fixes -- */
@media(max-width:767px){
  .lab-play-grid{grid-template-columns:1fr!important;}
  .lab-dash-grid{grid-template-columns:1fr!important;}
  .lab-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;display:flex!important;}
  .lab-tabs button{flex-shrink:0;}
}

`;





// ─── ATOMS ────────────────────────────────────────────────────────────────────

function Hexbg(){

  return(

    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>

      <div className="scanlines" style={{position:"absolute",inset:0,zIndex:1,pointerEvents:"none"}}/>

      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.055}} xmlns="http://www.w3.org/2000/svg">

        <defs><pattern id="hxp" x="0" y="0" width="60" height="104" patternUnits="userSpaceOnUse">

          <path d="M30 2L58 18L58 50L30 66L2 50L2 18Z" fill="none" stroke="#9B72CF" strokeWidth=".8"/>

          <path d="M30 38L58 54L58 86L30 102L2 86L2 54Z" fill="none" stroke="#E8A838" strokeWidth=".8"/>

        </pattern></defs>

        <rect width="100%" height="100%" fill="url(#hxp)"/>

      </svg>

      <div style={{position:"absolute",top:"-15%",right:"-5%",width:900,height:900,borderRadius:"50%",background:"radial-gradient(circle,rgba(155,114,207,.11),transparent 60%)"}}/>

      <div style={{position:"absolute",bottom:"-10%",left:"-10%",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(78,205,196,.09),transparent 60%)"}}/>

      <div style={{position:"absolute",top:"35%",left:"30%",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,168,56,.06),transparent 60%)"}}/>

      <div style={{position:"absolute",top:"20%",left:"60%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(155,114,207,.05),transparent 65%)"}}/>

      <div className="retro-scan-line"/>

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

      style={Object.assign({background:"linear-gradient(145deg,rgba(14,22,40,.88) 0%,rgba(8,12,24,.92) 100%)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid "+bdr,borderRadius:16,position:"relative",overflow:"hidden",

        boxShadow:hover&&hov?"0 16px 64px rgba(155,114,207,.14),0 6px 24px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07)":shd+",inset 0 1px 0 rgba(255,255,255,.04)",

        transition:"box-shadow .25s,transform .2s,border-color .2s",

        transform:hover&&hov?"translateY(-3px)":"none",

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

    primary:{background:"linear-gradient(135deg,#FFD060 0%,#E8A838 50%,#C4782A 100%)",color:"#07070E",border:"none",boxShadow:"0 4px 28px rgba(232,168,56,.45),0 0 40px rgba(232,168,56,.12)",fontWeight:700,letterSpacing:".04em"},

    ghost:{background:"transparent",color:"#E8A838",border:"1px solid rgba(232,168,56,.35)"},

    danger:{background:"rgba(220,38,38,.1)",color:"#F87171",border:"1px solid rgba(220,38,38,.35)"},

    success:{background:"rgba(82,196,124,.1)",color:"#6EE7B7",border:"1px solid rgba(82,196,124,.35)"},

    dark:{background:"#1C2030",color:"#C8BFB0",border:"1px solid rgba(242,237,228,.1)"},

    purple:{background:"linear-gradient(135deg,rgba(155,114,207,.18),rgba(155,114,207,.08))",color:"#C4B5FD",border:"1px solid rgba(155,114,207,.45)",boxShadow:"0 0 20px rgba(155,114,207,.1)"},

    teal:{background:"rgba(78,205,196,.1)",color:"#5EEAD4",border:"1px solid rgba(78,205,196,.35)"},

    crimson:{background:"rgba(127,29,29,.95)",color:"#FCA5A5",border:"1px solid rgba(220,38,38,.6)"},

    warning:{background:"rgba(249,115,22,.1)",color:"#FB923C",border:"1px solid rgba(249,115,22,.35)"},

  };

  return(

    <button onClick={disabled?undefined:onClick}

      style={Object.assign({display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,

        borderRadius:10,padding:pad,fontSize:fs,fontWeight:600,transition:"all .18s",

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

      style={Object.assign({width:"100%",background:f?"#0F1A2E":"#0D1525",

        border:f?"1px solid rgba(155,114,207,.65)":"1px solid rgba(242,237,228,.1)",

        borderRadius:10,padding:"12px 14px",color:"#F2EDE4",fontSize:15,

        transition:"border .18s,background .18s,box-shadow .18s",lineHeight:1.4,minHeight:46,

        boxShadow:f?"0 0 0 1px rgba(155,114,207,.3),0 0 20px rgba(155,114,207,.1)":"none"},style||{})}/>

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

  const s=sponsor;

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

            fontSize:22,fontWeight:700,color:"#E8A838",fontFamily:"'Russo One',sans-serif",

            margin:"0 auto",boxShadow:"0 0 20px rgba(232,168,56,.3)"}}>

            {c.name.charAt(0)}

          </div>

        </div>

        <div style={{flex:1,minWidth:0}}>

          <div className="cond" style={{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".2em",textTransform:"uppercase",marginBottom:2}}>{c.season} Champion</div>

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(16px,3vw,24px)",fontWeight:900,color:"#E8A838",lineHeight:1,textShadow:"0 0 20px rgba(232,168,56,.4)"}}>{c.name}</div>

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

          <div style={{width:34,height:34,background:locked?"rgba(82,196,124,.1)":"rgba(232,168,56,.1)",border:"1px solid "+(locked?"rgba(82,196,124,.3)":"rgba(232,168,56,.28)"),borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:locked?"#6EE7B7":"#E8A838",fontFamily:"'Chakra Petch',sans-serif",flexShrink:0}}>

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

const NOTIF_SEED=[];

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

function Navbar({screen,setScreen,players,isAdmin,setIsAdmin,toast,disputes,currentUser,onAuthClick,notifications,onMarkAllRead,scrimAccess}){

  const [pwModal,setPwModal]=useState(false);

  const [pw,setPw]=useState("");

  const [drawer,setDrawer]=useState(false);

  const checkedIn=players.filter(p=>p.checkedIn).length;

  const dispCount=(disputes||[]).length;

  const canScrims=isAdmin||(currentUser&&(scrimAccess||[]).includes(currentUser.username));




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

    {id:"featured",label:"Featured"},

    {id:"hof",label:"Hall of Fame"},

    ...(canScrims?[{id:"scrims",label:"Scrims"}]:[]),

    ...(isAdmin?[{id:"admin",label:"⬡ Admin"}]:[]),

  ];

  const DESKTOP_MORE=[

    {id:"featured",label:"Featured Events"},

    {id:"archive",label:"Archive"},

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

    {id:"featured",icon:"⭐",label:"Featured Events"},

    {id:"rules",icon:"📋",label:"Tournament Rules"},

    {id:"faq",icon:"❓",label:"FAQ"},

    {id:"challenges",icon:"⚡",label:"Challenges & XP"},

    {id:"milestones",icon:"🎁",label:"Milestones & Rewards"},

    {id:"pricing",icon:"💰",label:"Pricing & Plans"},

    {id:"account",icon:"👤",label:currentUser?("My Account · "+currentUser.username):"Sign In / Sign Up"},

    ...(canScrims?[{id:"scrims",icon:"🎮",label:"Scrims"}]:[]),

    ...(isAdmin?[{id:"admin",icon:"⬡",label:"Admin Panel"}]:[]),

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

                <div style={{fontFamily:"'Russo One',sans-serif",fontSize:16,fontWeight:700,color:"#E8A838"}}>TFT Clash</div>

                <div style={{fontSize:12,color:"#BECBD9"}}>Season 1</div>

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

      <nav className="top-nav" style={{borderBottom:"2px solid transparent",borderImage:"linear-gradient(90deg,transparent,rgba(155,114,207,.3),rgba(232,168,56,.2),transparent) 1"}}>

        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 24px",height:54,display:"flex",alignItems:"center",gap:0}}>

          <div onClick={()=>setScreen("home")} style={{display:"flex",alignItems:"center",gap:8,marginRight:14,flexShrink:0,cursor:"pointer",transition:"filter .2s"}}
            onMouseEnter={function(e){e.currentTarget.style.filter="drop-shadow(0 0 12px rgba(232,168,56,.4))";}}
            onMouseLeave={function(e){e.currentTarget.style.filter="none";}}>

            <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:32,height:32,objectFit:"contain"}}/>

            <div>

              <div className="gold-shimmer" style={{fontFamily:"'Russo One',sans-serif",fontSize:14,fontWeight:700,lineHeight:1,letterSpacing:".06em"}}>TFT Clash</div>

              <div className="cond" style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:"#BECBD9",fontWeight:600,letterSpacing:".06em"}}>
                <span style={{border:"1px solid rgba(232,168,56,.4)",borderRadius:4,padding:"1px 4px",fontSize:8,color:"#E8A838",fontWeight:700}}>S1</span>
                Season 1
              </div>

            </div>

          </div>

          <div style={{display:"flex",alignItems:"center",gap:0,flex:1,minWidth:0}}>

            {DESKTOP_PRIMARY.map(l=>(

              <button key={l.id} onClick={()=>setScreen(l.id)}

                data-active={screen===l.id?"true":"false"}

                style={{background:screen===l.id?"rgba(232,168,56,.1)":"none",border:"none",padding:"6px 12px",fontSize:12.5,fontWeight:600,

                  color:screen===l.id?"#E8A838":"#9AAABF",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,

                  borderRadius:8,

                  transition:"all .2s",letterSpacing:".02em",fontFamily:"'Chakra Petch',sans-serif"}}>

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

          const active=isMore?["hof","archive","scrims","admin","milestones","pricing","account","challenges","recap","host-apply","host-dashboard","rules","faq","featured"].includes(screen)||screen.indexOf("tournament-")===0:screen===l.id;

          return(

            <button key={l.id} className={active?"active":""} onClick={()=>{if(isMore){setDrawer(d=>!d);}else setScreen(l.id);}}
              style={{transition:"transform .1s"}}
              onMouseDown={function(e){e.currentTarget.style.transform="scale(0.95)";}}
              onMouseUp={function(e){e.currentTarget.style.transform="scale(1)";}}
              onMouseLeave={function(e){e.currentTarget.style.transform="scale(1)";}}>

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

      <div className="standings-table-wrap" style={{minWidth:compact?260:380}}>

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

        const rowBg=isMe?"rgba(155,114,207,.12)":i===0?"rgba(232,168,56,.11)":i===1?"rgba(192,192,192,.07)":i===2?"rgba(205,127,50,.07)":top8?"rgba(255,255,255,.025)":"transparent";

        const rowBorder=isMe?"rgba(155,114,207,.5)":i===0?"rgba(232,168,56,.35)":i===1?"rgba(192,192,192,.2)":i===2?"rgba(205,127,50,.2)":top8?"rgba(242,237,228,.06)":"transparent";

        const nameCol=top3?"#F2EDE4":top8?"#C8BFB0":"#BECBD9";

        const ptsCol=top3?"#E8A838":top8?"#B8A878":"#BECBD9";

        return(

          <div key={p.id} id={isMe?"lb-me-row":undefined} onClick={onRowClick?()=>onRowClick(p):undefined}

            className={"standings-row"+(i===0?" standings-row-1 shimmer-card row-champion":i===1?" standings-row-2":i===2?" standings-row-3":"")+(isMe?" standings-row-me":"")}

            style={{display:"grid",gridTemplateColumns:cols,

              padding:top3?"14px 14px":"10px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",

              background:rowBg,border:"1px solid "+rowBorder,borderRadius:top3?8:0,marginBottom:top3?3:0,

              alignItems:"center",cursor:onRowClick?"pointer":"default",opacity:i>=8?.55:1,

              boxShadow:i===0?"0 4px 20px rgba(232,168,56,.1),inset 0 1px 0 rgba(232,168,56,.08)":isMe?"0 2px 12px rgba(155,114,207,.08)":"none"}}>

            <div className="mono rank-num" style={{fontSize:top3?18:13,fontWeight:900,color:rankCol,minWidth:24,textAlign:"center",textShadow:i===0?"0 0 18px rgba(232,168,56,.8)":i===1?"0 0 12px rgba(192,192,192,.6)":i===2?"0 0 12px rgba(205,127,50,.6)":"none"}}>

              {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}

            </div>

            <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>

              <div style={{minWidth:0}}>

                <div style={{fontWeight:top3?700:500,fontSize:top3?15:13,color:nameCol,display:"flex",alignItems:"center",gap:5,overflow:"hidden"}}>

                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>

                  {isHotStreak(p)&&<span title={"Win streak: "+(p.currentStreak||0)} style={{flexShrink:0,fontSize:14,cursor:"default"}}>🔥</span>}

                  {isOnTilt(p)&&<span title={"Cold streak: "+(p.tiltStreak||0)} style={{flexShrink:0,fontSize:14,cursor:"default"}}>🥶</span>}


                </div>

                {!compact&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>

                  <ClashRankBadge xp={estimateXp(p)} size="sm"/>

                  <span className="mono" style={{fontSize:11,color:"#B8C8D8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.riotId}</span>

                </div>}

              </div>

            </div>

            <div className="mono pts-glow" style={{fontSize:top3?22:15,fontWeight:800,color:ptsCol,lineHeight:1,textShadow:top3?"0 0 14px currentColor":"none"}}>{useEffective?effectivePts(p,seasonConfig):p.pts}</div>

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






// ─── HOME SCREEN ──────────────────────────────────────────────────────────────

function HomeScreen({players,setPlayers,setScreen,toast,announcement,setProfilePlayer,currentUser,onAuthClick,tournamentState,setTournamentState,quickClashes,onJoinQuickClash,onRegister,tickerOverrides,hostAnnouncements,featuredEvents}){

  const [name,setName]=useState("");

  const [riot,setRiot]=useState("");

  const [region,setRegion]=useState("EUW");

  const clashName=tournamentState?.clashName||"Next Clash";

  const clashDate=tournamentState?.clashDate||"";

  const clashTime=tournamentState?.clashTime||"";

  const targetMs=useRef(tournamentState?.clashTimestamp?new Date(tournamentState.clashTimestamp).getTime():Date.now()+7*86400000);

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
    setTournamentState(function(ts){var ids=ts.checkedInIds||[];var sid=String(linkedPlayer.id);return ids.includes(sid)?ts:{...ts,checkedInIds:[...ids,sid]};});


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

    // Also register in tournamentState.registeredIds
    setTournamentState(function(ts){var ids=ts.registeredIds||[];var sid=String(np.id);return ids.includes(sid)?ts:{...ts,registeredIds:[...ids,sid]};});

    toast(currentUser.username+" registered for "+clashName+"! ✓","success");

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

    <div className="stat-box shimmer-card" style={{background:"linear-gradient(145deg,rgba(18,28,48,.9),rgba(10,15,28,.95))",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"16px 10px",textAlign:"center",boxShadow:"0 4px 16px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06)"}}>

      <div className="mono" style={{fontSize:28,fontWeight:800,color:c||"#E8A838",lineHeight:1,textShadow:"0 0 16px currentColor"}}>{val}</div>

      <div className="cond" style={{fontSize:9,fontWeight:700,color:"#8EA0B8",marginTop:6,letterSpacing:".1em",textTransform:"uppercase"}}>{label}</div>

    </div>

  );



  // Community pulse ticker

  const sortedPts=[...players].sort((a,b)=>b.pts-a.pts);

  const sortedWins=[...players].sort((a,b)=>b.wins-a.wins);

  const sortedStreak=[...players].sort((a,b)=>(b.currentStreak||0)-(a.currentStreak||0));

  const totalGames=players.reduce((s,p)=>s+(p.games||0),0);

  var autoTickerItems=players.length>0?[
    sortedPts[0]&&("🏆 "+sortedPts[0].name+" leads Season 1 with "+sortedPts[0].pts+" pts"),
    totalGames>0&&("🎮 "+totalGames+" games played this season"),
    sortedWins[0]&&sortedWins[0].wins>0&&("🥇 "+sortedWins[0].name+" · "+sortedWins[0].wins+" tournament wins"),
    sortedStreak[0]&&(sortedStreak[0].currentStreak||0)>1&&("🔥 "+sortedStreak[0].name+" on a "+(sortedStreak[0].currentStreak||0)+"-win streak"),
    "⚡ "+players.filter(p=>p.checkedIn).length+" / "+players.length+" players checked in",
    "📊 Season 1 active — "+players.length+" registered",
  ].filter(Boolean):[];
  const tickerItems=(tickerOverrides&&tickerOverrides.length>0?tickerOverrides:[]).concat(autoTickerItems);



  return(

    <div className="page wrap">

      {announcement&&(

        <div style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>

          <span style={{fontSize:16,flexShrink:0}}>📢</span>

          <span style={{color:"#E8A838",fontWeight:600,fontSize:14}}>{announcement}</span>

        </div>

      )}

      {hostAnnouncements&&hostAnnouncements.length>0&&(
        <div style={{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:14,flexShrink:0}}>{"📣"}</span>
          <span style={{color:"#C4B5FD",fontWeight:600,fontSize:13}}>{hostAnnouncements[0].msg}</span>
          <span style={{fontSize:10,color:"#9AAABF",marginLeft:"auto",flexShrink:0}}>{hostAnnouncements[0].sentAt}</span>
        </div>
      )}

      {/* Champion hero card - shown all season */}

      {SEASON_CHAMPION&&players.some(function(p){return p.wins>0;})&&<ChampionHeroCard champion={SEASON_CHAMPION} onClick={()=>{const p=players.find(pl=>pl.name===SEASON_CHAMPION.name);if(p){setProfilePlayer(p);setScreen("profile");}}}/>}



      <div style={{height:28}}/>



      {/* Phase status pill */}

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>

        <div style={{background:"rgba(0,0,0,.3)",border:"1px solid "+phaseStatusColor(),borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:phaseStatusColor(),letterSpacing:".04em",cursor:tPhase==="complete"?"pointer":"default"}}

          onClick={()=>tPhase==="complete"&&setScreen("leaderboard")}>

          {tPhase==="inprogress"&&<span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#52C47C",marginRight:7,verticalAlign:"middle",animation:"pulse 1.5s infinite"}}/>}

          {phaseStatusText()}

        </div>

      </div>



      {/* Registration card — visible during registration phase */}

      {tPhase==="registration"&&(

        currentUser&&linkedPlayer?(

          tournamentState.registeredIds&&tournamentState.registeredIds.includes(String(linkedPlayer.id))?(

            <div style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.4)",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>

              <div style={{fontSize:22}}>✅</div>

              <div style={{flex:1,minWidth:0}}>

                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>Registered for next clash!</div>

                <div style={{fontSize:12,color:"#C8D4E0"}}>Your spot is reserved, {linkedPlayer.name}. Check-in opens soon.</div>

              </div>

              <div style={{display:"flex",gap:8,flexShrink:0}}>

                <div style={{fontSize:12,fontWeight:700,color:"#4ECDC4",background:"rgba(78,205,196,.12)",border:"1px solid rgba(78,205,196,.3)",borderRadius:8,padding:"6px 14px"}}>✓ Registered</div>

                <Btn v="dark" s="sm" onClick={()=>onRegister&&onRegister(linkedPlayer.id)}>Unregister</Btn>

              </div>

            </div>

          ):(

            <div style={{background:"rgba(82,196,124,.06)",border:"1px solid rgba(82,196,124,.3)",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>

              <div style={{fontSize:22}}>📋</div>

              <div style={{flex:1,minWidth:0}}>

                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>Registration is open</div>

                <div style={{fontSize:12,color:"#C8D4E0"}}>Sign up for the next clash — free to compete!</div>

              </div>

              <Btn v="success" onClick={()=>onRegister&&onRegister(linkedPlayer.id)}>Register for Clash</Btn>

            </div>

          )

        ):(

          !currentUser&&(

            <div style={{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.25)",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>

              <div style={{fontSize:22}}>🎮</div>

              <div style={{flex:1,minWidth:0}}>

                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>Registration is open</div>

                <div style={{fontSize:12,color:"#C8D4E0"}}>Log in to register for the next clash</div>

              </div>

              <Btn v="purple" s="sm" onClick={()=>onAuthClick("login")}>Log in to register</Btn>

            </div>

          )

        )

      )}

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

        <div style={{background:"linear-gradient(90deg,rgba(155,114,207,.08),rgba(78,205,196,.06))",border:"1px solid rgba(155,114,207,.3)",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>

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

        <div style={{background:"rgba(82,196,124,.05)",border:"1px solid rgba(82,196,124,.2)",borderRadius:12,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>

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

        <div className="hero-panel border-neon-grad" style={{position:"relative",padding:"32px 28px",borderRadius:20,background:"radial-gradient(ellipse at 30% 15%,rgba(155,114,207,.15) 0%,rgba(78,205,196,.03) 50%,rgba(8,8,15,0) 70%)",border:"1px solid rgba(155,114,207,.18)"}}>

          <div className="au" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 14px",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.35)",borderRadius:20,marginBottom:20}}>

            <div style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite"}}/>

            <span className="cond" style={{fontSize:11,fontWeight:700,color:"#C4B5FD",letterSpacing:".1em",textTransform:"uppercase"}}>Set 16 · Season Active · Weekly Clash</span>

          </div>

          <h1 className="au1 display" style={{color:"#F2EDE4",lineHeight:.9,letterSpacing:".01em",marginBottom:20}}>

            The<br/><span style={{color:"#E8A838",textShadow:"0 0 60px rgba(232,168,56,.5),0 0 120px rgba(232,168,56,.2),0 0 200px rgba(232,168,56,.1)"}}>CONVERGENCE</span><br/><span style={{background:"linear-gradient(135deg,#9B72CF,#4ECDC4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>AWAITS</span>

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

          <div style={{background:"linear-gradient(145deg,rgba(155,114,207,.1),rgba(8,8,15,.7))",border:"1px solid rgba(155,114,207,.3)",borderRadius:16,padding:"20px 24px",boxShadow:"0 0 30px rgba(155,114,207,.06),inset 0 1px 0 rgba(255,255,255,.05)"}}>

            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>

              <div className="live-indicator" style={{width:7,height:7,borderRadius:"50%",background:"#52C47C"}}/>

              <span className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase"}}>{clashName} Starts In</span>

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

            <h3 style={{fontSize:17,color:"#F2EDE4",marginBottom:4}}>Join {clashName}</h3>

            <div style={{fontSize:12,color:"#BECBD9",marginBottom:16}}>Saturday 8PM EST · Season 1</div>



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

                <Btn v="primary" full onClick={registerFromAccount}>Register for {clashName} →</Btn>

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

                <div className="step-num" style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.08))",border:"1px solid rgba(155,114,207,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#C4B5FD",flexShrink:0,fontFamily:"'Russo One',sans-serif",letterSpacing:".04em"}}>{n}</div>

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

              <div style={{fontSize:12,color:"#BECBD9",marginTop:2}}>{checkedN} checked in for {clashName}</div>

            </div>

            <Btn v="teal" s="sm" onClick={()=>setScreen("roster")}>View Roster →</Btn>

          </div>

        </div>

      </div>





      {/* Community Pulse Ticker */}

      {tickerItems.length>0&&(

        <div style={{overflow:"hidden",marginTop:20,borderRadius:10,background:"rgba(155,114,207,.04)",border:"1px solid rgba(155,114,207,.12)"}}>

          <div className="ticker-scroll">

            {[...tickerItems,...tickerItems].map((item,i)=>(

              <span key={i} style={{display:"inline-flex",alignItems:"center",padding:"8px 22px",fontSize:12,color:"#C8D4E0",fontWeight:600,whiteSpace:"nowrap",borderRight:"1px solid rgba(155,114,207,.1)"}}>

                {item}

              </span>

            ))}

          </div>

        </div>

      )}



      {/* Featured Events */}

      {(function(){
        var evts=featuredEvents||[];
        var activeEvts=evts.filter(function(e){return e.status==="live"||e.status==="upcoming";});
        if(activeEvts.length===0)return null;
        return(
          <div style={{marginTop:20,marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div>
                <div className="cond" style={{fontSize:10,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase",marginBottom:3}}>Partner Events</div>
                <h3 style={{fontSize:16,fontWeight:700,color:"#F2EDE4",lineHeight:1}}>Featured Tournaments</h3>
              </div>
              <Btn v="dark" s="sm" onClick={function(){setScreen("featured");}}>View All →</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
              {activeEvts.slice(0,3).map(function(ev){
                var isLive=ev.status==="live";
                return(
                  <div key={ev.id} onClick={function(){setScreen("tournament-"+ev.id);}}
                    style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid "+(isLive?"rgba(82,196,124,.35)":"rgba(155,114,207,.35)"),borderRadius:16,overflow:"hidden",cursor:"pointer",transition:"border-color .2s"}}
                    onMouseEnter={function(e){e.currentTarget.style.borderColor=isLive?"rgba(82,196,124,.65)":"rgba(155,114,207,.65)";}}
                    onMouseLeave={function(e){e.currentTarget.style.borderColor=isLive?"rgba(82,196,124,.35)":"rgba(155,114,207,.35)";}}>
                    {isLive&&(
                      <div style={{background:"rgba(82,196,124,.07)",borderBottom:"1px solid rgba(82,196,124,.18)",padding:"7px 16px",display:"flex",alignItems:"center",gap:6}}>
                        <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>
                        <span style={{fontSize:10,fontWeight:700,color:"#6EE7B7"}}>LIVE NOW</span>
                      </div>
                    )}
                    <div style={{padding:"16px 18px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{width:38,height:38,borderRadius:10,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ev.logo||"🏆"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",lineHeight:1.2}}>{ev.name}</div>
                          <div style={{fontSize:11,color:"#9B72CF",fontWeight:600,marginTop:2}}>{ev.host||"Community Event"}{ev.sponsor?" · "+ev.sponsor:""}</div>
                        </div>
                      </div>
                      {ev.description&&<div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.5,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{ev.description}</div>}
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {(ev.tags||[]).map(function(t){return <span key={t} style={{background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.25)",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:"#C4B5FD"}}>{t}</span>;})}
                        <span style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:"#E8A838"}}>{ev.registered||0}/{ev.size||"?"} players</span>
                        {ev.date&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:"#4ECDC4"}}>{ev.date}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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

            <span style={{fontSize:12,fontWeight:700,color:"#6EE7B7",letterSpacing:".08em",textTransform:"uppercase"}}>Checked In</span>

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









function LiveStandingsPanel({checkedIn,tournamentState,lobbies,round}) {

  var clashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:"";

  var liveRows=checkedIn.map(function(p){

    var earned=0;

    (p.clashHistory||[]).forEach(function(h){if(h.clashId===clashId){earned+=(PTS[h.place||h.placement]||0);}});

    return {name:p.name,id:p.id,earned:earned};

  }).sort(function(a,b){return b.earned-a.earned;});

  var lockedCount=tournamentState&&tournamentState.lockedLobbies?tournamentState.lockedLobbies.length:0;

  return(

    <Panel style={{padding:"20px",marginTop:24}}>

      <div style={{fontWeight:700,fontSize:14,color:"#E8A838",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>

        <span style={{fontSize:16}}>📊</span> Live Standings — Round {round}

        <span style={{fontSize:11,color:"#BECBD9",fontWeight:400,marginLeft:4}}>({lockedCount} of {lobbies.length} {lobbies.length===1?"lobby":"lobbies"} locked)</span>

      </div>

      <div style={{display:"flex",flexDirection:"column",gap:4}}>

        {liveRows.map(function(row,ri){

          var isLeader=ri===0&&row.earned>0;

          return(

            <div key={row.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",

              background:isLeader?"rgba(232,168,56,.07)":ri%2===0?"rgba(255,255,255,.01)":"transparent",

              borderRadius:6,border:isLeader?"1px solid rgba(232,168,56,.18)":"1px solid transparent"}}>

              <span className="mono" style={{fontSize:12,fontWeight:700,color:ri===0?"#E8A838":ri===1?"#C0C0C0":ri===2?"#CD7F32":"#9AAABF",minWidth:22,textAlign:"center"}}>{ri+1}</span>

              <span style={{flex:1,fontSize:13,fontWeight:isLeader?700:500,color:isLeader?"#E8A838":"#F2EDE4"}}>{row.name}</span>

              <span className="mono" style={{fontSize:13,fontWeight:700,color:row.earned>0?"#6EE7B7":"#9AAABF"}}>{row.earned>0?"+"+row.earned:"—"} pts</span>

            </div>

          );

        })}

      </div>

    </Panel>

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



  function computeLobbies(){

    var algo=(tournamentState&&tournamentState.seedAlgo)||"rank-based";

    var pool;

    if(round===1){

      if(algo==="random"){

        pool=[...checkedIn].sort(()=>Math.random()-0.5);

      } else if(algo==="snake"){

        var sorted=[...checkedIn].sort((a,b)=>b.lp-a.lp);

        pool=[];

        sorted.forEach(function(p,i){if(Math.floor(i/lobbySize)%2===0)pool.push(p);else pool.unshift(p);});

      } else if(algo==="anti-stack"){

        var ranked=[...checkedIn].sort((a,b)=>b.pts-a.pts||b.lp-a.lp);

        var lobbyCount=Math.ceil(ranked.length/lobbySize);

        var buckets=Array.from({length:lobbyCount},function(){return[];});

        ranked.forEach(function(p,i){

          var row=Math.floor(i/lobbyCount);

          var col=row%2===0?i%lobbyCount:(lobbyCount-1-(i%lobbyCount));

          buckets[col].push(p);

        });

        pool=[].concat.apply([],buckets);

      } else {

        pool=[...checkedIn].sort((a,b)=>b.pts-a.pts||b.lp-a.lp);

      }

    } else {

      pool=[...checkedIn].sort((a,b)=>b.pts-a.pts);

    }

    var result=[];

    for(var i=0;i<pool.length;i+=lobbySize)result.push(pool.slice(i,i+lobbySize));

    return result;

  }

  // Use persisted lobby IDs if available, otherwise compute fresh
  var lobbies=useMemo(function(){
    var saved=tournamentState&&tournamentState.savedLobbies;
    if(saved&&saved.length>0&&saved[0]&&saved[0].length>0){
      return saved.map(function(lobbyIds){
        return lobbyIds.map(function(id){return checkedIn.find(function(p){return p.id===id;})||null;}).filter(Boolean);
      }).filter(function(l){return l.length>0;});
    }
    return computeLobbies();
  },[tournamentState&&tournamentState.savedLobbies,checkedIn,round]);

  // Auto-persist lobby assignments so page refresh keeps them
  useEffect(function(){
    if(lobbies.length===0)return;
    var saved=tournamentState&&tournamentState.savedLobbies;
    var lobbyIds=lobbies.map(function(l){return l.map(function(p){return p.id;});});
    // Only save if different from what's stored
    if(saved&&JSON.stringify(saved)===JSON.stringify(lobbyIds))return;
    setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:lobbyIds});});
  },[lobbies]);

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

    // Persist per-game results to game_results table
    if(supabase.from){
      var gameRows=[];
      lobby.forEach(function(p){
        var place=parseInt(placementEntry[li].placements[p.id]||"0");
        if(place>0)gameRows.push({tournament_id:currentClashId,round_number:round,player_id:p.id,placement:place,points:PTS[place]||0,is_dnp:false});
      });
      if(gameRows.length>0){
        supabase.from('game_results').insert(gameRows).then(function(res){
          if(res.error){console.error("[TFT] Failed to save game results:",res.error);toast("Failed to save game results","error");}
        });
      }
    }

    toast("Lobby "+(li+1)+" results applied! ✓","success");

  }



  const allLocked=lobbies.length>0&&lobbies.every((_,i)=>lockedLobbies.includes(i));

  function saveResultsToSupabase(allPlayers,clashId){
    if(!supabase.from)return;
    var clashName=(tournamentState&&tournamentState.clashName)?tournamentState.clashName:("Clash "+new Date().toLocaleDateString());
    supabase.from('tournaments').insert({name:clashName,date:new Date().toISOString().split('T')[0],phase:'complete'}).select('id').single().then(function(res){
      if(res.error){console.error("Failed to save tournament:",res.error);toast("Failed to save results to database","error");return;}
      if(!res.data)return;
      var tId=res.data.id;
      var rows=[];
      allPlayers.forEach(function(p){
        var entries=(p.clashHistory||[]).filter(function(h){return h.clashId===clashId;});
        entries.forEach(function(h){
          rows.push({tournament_id:tId,player_id:p.id,final_placement:(h.place||h.placement),total_points:(h.pts||0)+(h.bonusPts||0),wins:(h.place||h.placement)===1?1:0,top4_count:(h.place||h.placement)<=4?1:0});
        });
      });
      if(rows.length>0){
        supabase.from('tournament_results').insert(rows).then(function(r){
          if(r.error){console.error("Failed to save results:",r.error);toast("Failed to save player results","error");}
        });
      }
    });
  }



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

            <Btn v="dark" s="sm" disabled={round<=1} onClick={()=>setTournamentState(ts=>({...ts,round:ts.round-1,lockedLobbies:[],savedLobbies:[]}))}>← Round</Btn>

            <Btn v="primary" s="sm" disabled={!allLocked} onClick={()=>{if(round>=3){saveResultsToSupabase(players,currentClashId);setTournamentState(ts=>({...ts,phase:"complete",lockedLobbies:[],savedLobbies:[]}));toast("Clash complete! View results →","success");}else{setTournamentState(ts=>({...ts,round:ts.round+1,lockedLobbies:[],savedLobbies:[]}));toast("Advanced to Round "+(round+1),"success");}}}>

              {round>=3?"Finalize Clash ✓":"Next Round →"}

            </Btn>

          </div>

        )}

      </div>



      {checkedIn.length===0&&(

        <div style={{textAlign:"center",padding:"60px 20px"}}>

          <div style={{fontSize:48,marginBottom:16}}>{tournamentState&&tournamentState.phase==="complete"?"🏆":tournamentState&&tournamentState.phase==="inprogress"?"⚡":"🎮"}</div>

          <h3 style={{color:"#F2EDE4",marginBottom:8}}>{tournamentState&&tournamentState.phase==="complete"?"Tournament Complete":tournamentState&&tournamentState.phase==="inprogress"?"Waiting for Players":"No Active Tournament"}</h3>

          <p style={{color:"#BECBD9",fontSize:14,marginBottom:20}}>{tournamentState&&tournamentState.phase==="complete"?"The last tournament has been finalized. Check Results for the full breakdown.":tournamentState&&tournamentState.phase==="inprogress"?"Players need to check in to join the bracket.":"No tournament is running right now. Check back when the next clash is announced!"}</p>

          <div style={{display:"flex",gap:10,justifyContent:"center"}}>

            <Btn v="primary" onClick={()=>setScreen("home")}>← Back to Home</Btn>

            {tournamentState&&tournamentState.phase==="complete"&&<Btn v="dark" onClick={()=>setScreen("results")}>View Results</Btn>}

          </div>

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



          {/* Live standings during inprogress */}

          {tournamentState&&tournamentState.phase==="inprogress"&&lockedLobbies.length>0&&<LiveStandingsPanel checkedIn={checkedIn} tournamentState={tournamentState} lobbies={lobbies} round={round}/>}



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



function PlayerProfileScreen({player,onBack,allPlayers,setScreen,currentUser,seasonConfig,allUsers}){

  const [tab,setTab]=useState("overview");

  // Resolve user metadata for this player (bio, socials, banner, pfp)
  var userMeta=player.userMeta||null;
  if(!userMeta&&allUsers){var mu=allUsers.find(function(u){return u.username===player.name||u.id===player.auth_user_id;});if(mu)userMeta=mu.user_metadata||null;}
  var pBio=userMeta&&userMeta.bio||player.bio||"";
  var pTwitch=userMeta&&userMeta.twitch||player.twitch||"";
  var pTwitter=userMeta&&userMeta.twitter||player.twitter||"";
  var pYoutube=userMeta&&userMeta.youtube||player.youtube||"";
  var pPic=userMeta&&userMeta.profilePic||player.profilePic||"";
  var pBanner=userMeta&&userMeta.bannerUrl||player.bannerUrl||"";
  var pAccent=userMeta&&userMeta.profileAccent||player.profileAccent||"";
  var isOwnProfile=currentUser&&(currentUser.username===player.name||currentUser.id===player.auth_user_id);

  const achievements=getAchievements(player);

  const s=computeStats(player);



  const StatCard=({label,val,sub,c,big})=>(

    <div className="inner-box" style={{padding:"14px 12px",textAlign:"center"}}>

      <div className="mono" style={{fontSize:big?26:18,fontWeight:700,color:c||"#E8A838",lineHeight:1}}>{val}</div>

      <div className="cond" style={{fontSize:10,fontWeight:700,color:"#C8D4E0",marginTop:4,letterSpacing:".04em",textTransform:"uppercase"}}>{label}</div>

      {sub&&<div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>{sub}</div>}

    </div>

  );



  function downloadStatsCard(){

    var canvas=document.createElement("canvas");

    canvas.width=600;canvas.height=340;

    var ctx=canvas.getContext("2d");

    var bg=ctx.createLinearGradient(0,0,600,340);

    bg.addColorStop(0,"#0A0F1A");bg.addColorStop(1,"#0D1225");

    ctx.fillStyle=bg;ctx.fillRect(0,0,600,340);

    var accent=ctx.createLinearGradient(0,0,600,0);

    accent.addColorStop(0,"transparent");accent.addColorStop(0.4,"#9B72CF");accent.addColorStop(0.6,"#E8A838");accent.addColorStop(1,"transparent");

    ctx.fillStyle=accent;ctx.fillRect(0,0,600,3);

    ctx.fillStyle="rgba(155,114,207,0.06)";ctx.fillRect(0,3,600,337);

    ctx.font="bold 10px monospace";ctx.fillStyle="#9B72CF";ctx.letterSpacing="4px";

    ctx.fillText("TFT CLASH · PLAYER CARD",24,30);ctx.letterSpacing="0px";

    ctx.font="bold 36px serif";ctx.fillStyle="#F2EDE4";

    ctx.fillText(player.name,24,76);

    ctx.font="bold 12px monospace";ctx.fillStyle=rc(player.rank);

    ctx.fillText(player.rank.toUpperCase()+" · "+player.region,24,100);

    var stats=[["PTS",player.pts,"#E8A838"],["WINS",s.wins,"#6EE7B7"],["AVP",s.avgPlacement,"#C4B5FD"],["TOP4",s.top4,"#4ECDC4"],["GAMES",s.games,"#F2EDE4"],["STREAK",player.bestStreak||0,"#F97316"]];

    var cols=3;

    stats.forEach(function(item,i){

      var x=24+(i%cols)*186,y=140+Math.floor(i/cols)*90;

      ctx.fillStyle="rgba(255,255,255,0.04)";

      ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,170,70,8);else ctx.rect(x,y,170,70);ctx.fill();

      ctx.font="bold 26px monospace";ctx.fillStyle=item[2];ctx.fillText(String(item[1]),x+14,y+42);

      ctx.font="bold 9px monospace";ctx.fillStyle="#9AAABF";ctx.letterSpacing="2px";

      ctx.fillText(item[0],x+14,y+60);ctx.letterSpacing="0px";

    });

    ctx.fillStyle="rgba(232,168,56,0.08)";ctx.fillRect(0,308,600,32);

    ctx.font="bold 9px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";

    ctx.fillText("TFTCLASH.GG",24,328);ctx.letterSpacing="0px";

    ctx.font="9px monospace";ctx.fillStyle="#BECBD9";

    ctx.fillText("#TFTClash  #Season1",480,328);

    var a=document.createElement("a");a.download=player.name+"-stats.png";a.href=canvas.toDataURL("image/png");a.click();

    toast&&toast("Stats card saved!","success");

  }

  function copyStatsToClipboard(){
    var canvas=document.createElement("canvas");
    canvas.width=600;canvas.height=340;
    var ctx=canvas.getContext("2d");
    ctx.fillStyle="#08080F";ctx.fillRect(0,0,600,340);
    ctx.fillStyle="#9B72CF";ctx.fillRect(0,0,600,4);
    ctx.fillStyle="#F2EDE4";ctx.font="bold 22px 'Playfair Display',serif";ctx.fillText(player.name,24,40);
    ctx.fillStyle="#9B72CF";ctx.font="14px 'Barlow Condensed',sans-serif";ctx.fillText((player.rank||"Unranked")+" \u00b7 "+(player.region||"EUW"),24,62);
    ctx.fillStyle="#E8A838";ctx.font="bold 36px 'Russo One',sans-serif";ctx.fillText(String(st.avgPlacement||"0"),24,120);
    ctx.fillStyle="#8896A8";ctx.font="12px sans-serif";ctx.fillText("AVG",24,138);
    canvas.toBlob(function(blob){
      if(blob&&navigator.clipboard&&navigator.clipboard.write){
        navigator.clipboard.write([new ClipboardItem({"image/png":blob})]).then(function(){toast&&toast("Stats card copied to clipboard!","success");}).catch(function(){toast&&toast("Copy failed \u2014 try downloading instead","error");});
      }else{toast&&toast("Clipboard not supported \u2014 try downloading","error");}
    },"image/png");
  }


  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={onBack}>← Back</Btn>

        {setScreen&&<Btn v="ghost" s="sm" onClick={()=>setScreen("recap")}>🗓 Season Recap</Btn>}

        {setScreen&&<Btn v="purple" s="sm" onClick={()=>setScreen("challenges")}>⚡ Challenges</Btn>}

        <Btn v="teal" s="sm" onClick={downloadStatsCard}>📤 Download Card</Btn>
        <Btn v="dark" s="sm" onClick={copyStatsToClipboard}>📋 Copy</Btn>



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



      {/* Hero - Twitter-style with banner + pfp */}

      <div style={{borderRadius:14,marginBottom:18,overflow:"hidden",border:"1px solid "+rc(player.rank)+"30",position:"relative"}}>

        {/* Banner */}
        <div style={{height:pBanner?120:70,background:pBanner?"url("+pBanner+") center/cover no-repeat":"linear-gradient(135deg,"+(pAccent||rc(player.rank))+"28,#08080F 60%)",position:"relative"}}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 30%,#08080F)"}}/>
        </div>

        <div style={{padding:"0 24px 24px",marginTop:-36}}>

        <div style={{display:"flex",alignItems:"flex-end",gap:18,flexWrap:"wrap",position:"relative"}}>

          <div style={{width:72,height:72,borderRadius:"50%",

            background:pPic?"url("+pPic+") center/cover no-repeat":"linear-gradient(135deg,"+rc(player.rank)+"33,"+rc(player.rank)+"11)",

            border:"4px solid #08080F",boxShadow:"0 0 0 2px "+(SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name?"#E8A838":rc(player.rank)+"66"),

            display:"flex",alignItems:"center",justifyContent:"center",fontSize:pPic?0:30,fontWeight:700,color:SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name?"#E8A838":rc(player.rank),fontFamily:"'Russo One',sans-serif",flexShrink:0}}>

            {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&<span style={{position:"absolute",top:-8,right:-8,fontSize:16}}>👑</span>}

            {!pPic&&player.name.charAt(0)}

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

        {/* Bio + Socials */}
        {(pBio||pTwitch||pTwitter||pYoutube)&&(
          <div style={{marginTop:14}}>
            {pBio&&<div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6,marginBottom:8}}>{pBio}</div>}
            {(pTwitch||pTwitter||pYoutube)&&(
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {pTwitch&&<a href={"https://twitch.tv/"+pTwitch} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#9B72CF",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>twitch.tv/{pTwitch}</a>}
                {pTwitter&&<a href={"https://x.com/"+pTwitter} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#4ECDC4",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>@{pTwitter}</a>}
                {pYoutube&&<a href={"https://youtube.com/@"+pYoutube} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#F87171",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>youtube.com/@{pYoutube}</a>}
              </div>
            )}
          </div>
        )}

        {/* Edit Profile link for own profile */}
        {isOwnProfile&&setScreen&&(
          <div style={{marginTop:10}}>
            <Btn v="ghost" s="sm" onClick={function(){setScreen("account");}}>Edit Profile</Btn>
          </div>
        )}

        {/* Big stats */}

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:18}}>

          <StatCard label="Season Pts" val={player.pts} c="#E8A838" big/>

          <StatCard label="Win Rate" val={s.top1Rate+"%"} c="#6EE7B7" big/>

          <StatCard label="Avg Place" val={s.avgPlacement} c={avgCol(s.avgPlacement)} big/>

          <StatCard label="Top4 %" val={s.top4Rate+"%"} c="#C4B5FD" big/>

        </div>

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

            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:10}}>Career Stats</h3>

            {((player.currentStreak||0)>=3||(player.tiltStreak||0)>=3)&&(

              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>

                {(player.currentStreak||0)>=3&&<div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:"rgba(232,168,56,.15)",border:"1px solid rgba(232,168,56,.4)",fontSize:12,fontWeight:700,color:"#E8A838"}}>🔥 Hot Streak — {player.currentStreak} wins in a row</div>}

                {(player.tiltStreak||0)>=3&&<div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.35)",fontSize:12,fontWeight:700,color:"#93C5FD"}}>🥶 Cold Streak — {player.tiltStreak} losses</div>}

              </div>

            )}

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

            {(player.bestStreak||0)>=5&&(

              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:"rgba(234,179,8,.08)",border:"1px solid rgba(234,179,8,.3)"}}>

                <span style={{fontSize:16}}>👑</span>

                <span style={{fontSize:13,color:"#EAB308",fontWeight:700}}>Best Streak: {player.bestStreak}</span>

              </div>

            )}

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

              <div key={l} className="inner-box" style={{padding:"14px",textAlign:"center"}}>

                <div className="cond" style={{fontSize:10,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>{l}</div>

                {v?<><div className="mono" style={{fontSize:22,fontWeight:700,color:avgCol(v),lineHeight:1}}>{v}</div>

                  <div style={{fontSize:10,color:avgCol(v),marginTop:4}}>{parseFloat(v)<3?"Great":parseFloat(v)<5?"OK":"Rough"}</div></>

                :<div className="mono" style={{fontSize:18,color:"#9AAABF"}}>-</div>}

              </div>

            ))}

          </div>

          <div style={{fontSize:13,color:"#C8D4E0",marginBottom:12}}>Per-clash round breakdown:</div>

          {(player.clashHistory||[]).slice(0,6).map((g,i)=>(

            <div key={i} className="challenges-grid" style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 60px 60px 60px",gap:6,padding:"9px 0",borderBottom:"1px solid rgba(242,237,228,.05)",alignItems:"center"}}>

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

                  <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",background:(g.place||g.placement)===1?"rgba(232,168,56,.03)":"transparent",opacity:isDropped?.45:1}}>

                    <div className="mono" style={{fontSize:22,fontWeight:700,color:(g.place||g.placement)===1?"#E8A838":(g.place||g.placement)<=4?"#4ECDC4":"#BECBD9",minWidth:24,textAlign:"center",textDecoration:isDropped?"line-through":"none"}}>{g.place||g.placement}</div>

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

                      <div className="cond" style={{fontSize:9,color:"#BECBD9",textTransform:"uppercase"}}>{(g.place||g.placement)===1?"🏆 Champion":(g.place||g.placement)<=4?"Top 4":"Bot 4"}</div>

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

          {(player.clashHistory||[]).length===0?(

            <div style={{textAlign:"center",padding:"40px 20px",background:"linear-gradient(160deg,rgba(14,22,40,.9),rgba(8,12,24,.95))",borderRadius:12,border:"1px solid rgba(242,237,228,.09)",color:"#9AAABF"}}>

              <div style={{fontSize:32,marginBottom:10}}>⚔️</div>

              <div style={{fontSize:14,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>No H2H data yet</div>

              <div style={{fontSize:13}}>Compete in a clash to build your rivalry record.</div>

            </div>

          ):(

            <Panel style={{overflow:"hidden"}}>

              <div style={{padding:"10px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>

                <span style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".08em"}}>Shared lobbies</span>

              </div>

              {allPlayers.filter(op=>op.id!==player.id&&(op.clashHistory||[]).some(h=>(player.clashHistory||[]).some(ph=>ph.clashId&&ph.clashId===h.clashId))).map((op,i)=>{

                const sharedClashes=(player.clashHistory||[]).filter(h=>(op.clashHistory||[]).some(oh=>oh.clashId&&oh.clashId===h.clashId));

                const mW=sharedClashes.filter(h=>{const oh=(op.clashHistory||[]).find(x=>x.clashId===h.clashId);return oh&&(h.place||h.placement)<(oh.place||oh.placement);}).length;

                const tW=sharedClashes.length-mW;

                const total=sharedClashes.length||1;

                const ahead=mW>tW;

                const tied=mW===tW;

                return(

                  <div key={op.id} style={{padding:"13px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",background:i%2===0?"rgba(255,255,255,.01)":"transparent"}}>

                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>

                      <div style={{flex:1,minWidth:0}}>

                        <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{op.name}</div>

                        <div style={{fontSize:11,color:"#BECBD9"}}>{op.rank} · {op.region} · {sharedClashes.length} shared {sharedClashes.length===1?"clash":"clashes"}</div>

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

          )}

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

  const [compareIds,setCompareIds]=useState([]);

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

  function toggleCompare(id){
    setCompareIds(prev=>{
      if(prev.includes(id))return prev.filter(x=>x!==id);
      if(prev.length>=3)return prev;
      return [...prev,id];
    });
  }

  const comparePlayers=sorted.filter(p=>compareIds.includes(p.id));

  return(

    <div className="page wrap">

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:10}}>

        <div style={{display:"flex",alignItems:"center",gap:10}}>

          <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

          <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:3}}>Leaderboard</h2>

          <p style={{color:"#BECBD9",fontSize:13}}>Season 1 · tap a player for full profile</p>

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

                <div style={{fontFamily:"'Russo One',sans-serif",fontSize:16,fontWeight:700,color:"#F2EDE4",marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>

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



      {tab==="season"&&sorted.length>0&&<StandingsTable rows={sorted} onRowClick={open} myName={currentUser?currentUser.username:null}/>}

      {tab==="season"&&sorted.length===0&&<Panel style={{padding:"48px 20px",textAlign:"center"}}><div style={{fontSize:28,marginBottom:12}}>🏆</div><div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:6}}>No standings yet</div><div style={{fontSize:13,color:"#9AAABF",lineHeight:1.5}}>Standings will appear once a clash has been played and results submitted.</div></Panel>}



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

                    <div key={l} className="inner-box" style={{padding:"7px",textAlign:"center"}}>

                      <div className="mono" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>

                      <div className="cond" style={{fontSize:9,color:"#BECBD9",fontWeight:700,textTransform:"uppercase"}}>{l}</div>

                    </div>

                  ))}

                </div>

                <Sparkline data={p.sparkline||[p.pts]} color={rc(p.rank)} w={180} h={22}/>

                <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}} onClick={e=>e.stopPropagation()}><span onClick={()=>toggleCompare(p.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid "+(compareIds.includes(p.id)?"#4ECDC4":"rgba(78,205,196,.4)"),background:compareIds.includes(p.id)?"rgba(78,205,196,.18)":"transparent",color:compareIds.includes(p.id)?"#4ECDC4":"#9AAABF",cursor:"pointer",userSelect:"none"}}>{compareIds.includes(p.id)?"Comparing":"Compare"}</span></div>

              </Panel>

            );

          })}

        </div>

      )}



      {tab==="stats"&&(

        <Panel style={{overflowX:"auto"}}>

          <div style={{minWidth:420}}>

          <div style={{display:"grid",gridTemplateColumns:"28px 1fr 55px 70px 55px 55px 60px",padding:"9px 14px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)"}}>

            {["#","Player","PPG","Avg","T1%","T4%","B4%",""].map(h=>(

              <span key={h} className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase"}}>{h}</span>

            ))}

          </div>

          {sorted.map((p,i)=>{

            const s2=computeStats(p);

            const inCmp=compareIds.includes(p.id);

            return(

              <div key={p.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 55px 70px 55px 55px 60px 52px",padding:"11px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",alignItems:"center",cursor:"pointer"}} onClick={()=>open(p)}>

                <span className="mono" style={{fontSize:12,color:i<3?"#E8A838":"#9AAABF"}}>{i+1}</span>

                <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>

                  <span style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>

                </div>

                <span className="mono" style={{fontSize:13,fontWeight:700,color:"#EAB308"}}>{s2.ppg}</span>

                <AvgBadge avg={s2.avgPlacement}/>

                <span className="mono" style={{fontSize:12,color:"#E8A838"}}>{s2.top1Rate}%</span>

                <span className="mono" style={{fontSize:12,color:"#4ECDC4"}}>{s2.top4Rate}%</span>

                <span className="mono" style={{fontSize:12,color:"#F87171"}}>{s2.bot4Rate}%</span>

                <span onClick={e=>{e.stopPropagation();toggleCompare(p.id);}} style={{fontSize:11,padding:"2px 7px",borderRadius:6,border:"1px solid "+(inCmp?"#4ECDC4":"rgba(78,205,196,.4)"),background:inCmp?"rgba(78,205,196,.18)":"transparent",color:inCmp?"#4ECDC4":"#9AAABF",cursor:"pointer",userSelect:"none",textAlign:"center"}}>{inCmp?"✓":"+"}</span>

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

      {comparePlayers.length>=2&&<div style={{marginTop:20,background:"#111827",border:"1px solid rgba(155,114,207,.3)",borderRadius:12,padding:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{comparePlayers.map(p=>p.name).join(" vs ")}</div><Btn v="dark" s="sm" onClick={()=>setCompareIds([])}>Clear</Btn></div>{[["Season Points",comparePlayers.map(p=>p.pts),false],["Avg Placement",comparePlayers.map(p=>parseFloat(computeStats(p).avgPlacement)||99),true],["Wins",comparePlayers.map(p=>computeStats(p).wins),false],["Top 4 Rate",comparePlayers.map(p=>parseFloat(computeStats(p).top4Rate)||0),false],["Win Rate",comparePlayers.map(p=>parseFloat(computeStats(p).top1Rate)||0),false],["Games",comparePlayers.map(p=>computeStats(p).games),false]].map(([label,vals,lowerBetter])=>{const best=lowerBetter?Math.min(...vals):Math.max(...vals);return(<div key={label} style={{display:"grid",gridTemplateColumns:["2fr"].concat(comparePlayers.map(()=>"1fr")).join(" "),gap:8,padding:"8px 0",borderBottom:"1px solid rgba(242,237,228,.05)",alignItems:"center"}}><span style={{fontSize:12,color:"#C8D4E0"}}>{label}</span>{vals.map((v,i)=>(<span key={i} className="mono" style={{fontSize:14,fontWeight:700,color:v===best?"#E8A838":"#BECBD9",textAlign:"center"}}>{label==="Avg Placement"?v===99?"-":v:label==="Top 4 Rate"||label==="Win Rate"?v+"%":v}</span>))}</div>);})}</div>}

    </div>

  );

}





// ─── CLASH REPORT component ───────────────────────────────────────────────────

function ClashReport({clashData,players}){

  const allP=players.length>0?players:[];

  const report=clashData.report;



  // Build per-player round data from player clashHistory matching this clash

  const playerData=allP.map(p=>{

    const entry=(p.clashHistory||[]).find(h=>h.clashId===clashData.id||h.name===clashData.name);

    return{...p,entry};

  }).filter(p=>p.entry);



  const sorted=[...playerData].sort((a,b)=>(a.entry.place||a.entry.placement)-(b.entry.place||b.entry.placement));

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

function ResultsScreen({players,toast,setScreen,setProfilePlayer,tournamentState}){

  const sorted=[...players].sort((a,b)=>b.pts-a.pts);

  const champ=sorted[0];

  const [tab,setTab]=useState("results");

  const awards=computeClashAwards(players.length>0?players:sorted);

  const CLASH_NAME=tournamentState?.clashName||"Recent Clash";

  const CLASH_DATE=tournamentState?.clashDate||"";

  const MEDALS=["🥇","🥈","🥉"];

  const PODIUM_COLS=["#E8A838","#C0C0C0","#CD7F32"];



  if(!champ)return<div className="page wrap" style={{textAlign:"center",color:"#BECBD9",paddingTop:60}}>Complete a clash first!</div>;



  const top3=[sorted[1],sorted[0],sorted[2]].filter(Boolean);

  const REWARDS=["👑 Clash Crown","🖼 Icon","🎨 Frame","📦 Loot Orb","📦 Loot Orb","","",""];



  function shareDiscord(){

    const lines=[

      "**🏆 TFT Clash S1 — "+CLASH_NAME+" Results**",

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

    ctx.fillText("TFT CLASH S1 — FINAL RESULTS",40,44);ctx.letterSpacing="0px";

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

          <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".18em",textTransform:"uppercase",marginBottom:2}}>Season 1</div>

          <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(22px,3.5vw,34px)",fontWeight:900,color:"#F2EDE4",lineHeight:1}}>{CLASH_NAME} — Final Results</h1>

          <div style={{fontSize:12,color:"#BECBD9",marginTop:3}}>{CLASH_DATE} · {sorted.length} players · {Math.ceil(sorted.length/8)} lobbies</div>

        </div>

        <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap"}}>

          <Btn v="dark" s="sm" onClick={shareDiscord}>Discord</Btn>

          <Btn v="ghost" s="sm" onClick={downloadCard}>⬇ PNG</Btn>

          <Btn v="dark" s="sm" onClick={function(){
            var text="TFT Clash Results\n"+CLASH_NAME+" \u2014 "+CLASH_DATE+"\n\n";
            sorted.slice(0,8).forEach(function(p,i){text+=(i+1)+". "+p.name+" \u2014 "+p.pts+"pts (avg: "+computeStats(p).avgPlacement+")\n";});
            text+="\n#TFTClash tftclash.gg";
            navigator.clipboard.writeText(text).then(function(){toast("Results copied!","success");}).catch(function(){toast("Copy failed","error");});
          }}>📋 Copy</Btn>

        </div>

      </div>



      {/* Champion banner */}

      <div style={{background:"linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))",border:"1px solid rgba(232,168,56,.55)",borderRadius:18,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",position:"relative",overflow:"hidden",boxShadow:"0 0 60px rgba(232,168,56,.18),inset 0 0 80px rgba(232,168,56,.04)"}}>

        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>

        <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(232,168,56,.3),transparent)"}}/>

        <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))",border:"2px solid rgba(232,168,56,.7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,flexShrink:0,boxShadow:"0 0 24px rgba(232,168,56,.35)"}}>

          👑

        </div>

        <div style={{flex:1,minWidth:0}}>

          <div style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".16em",textTransform:"uppercase",marginBottom:4}}>👑 Clash Champion</div>

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(26px,4vw,44px)",fontWeight:900,color:"#F2EDE4",lineHeight:1,marginBottom:6}}>{champ.name}</div>

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

                <div style={{fontFamily:"'Russo One',sans-serif",fontSize:isGold?17:14,fontWeight:700,color:"#F2EDE4",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>

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

          <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:16,color:"#F2EDE4",marginBottom:4}}>{CLASH_NAME} — Round by Round</h3>

          <p style={{fontSize:13,color:"#BECBD9",marginBottom:20}}>{CLASH_DATE} · {sorted.length} players</p>

          <ClashReport clashData={{id:"latest",name:CLASH_NAME,date:CLASH_DATE,season:"S1",champion:champ.name,top3:sorted.slice(0,3).map(p=>p.name),players:sorted.length,lobbies:Math.ceil(sorted.length/8),report:{mostImproved:sorted[3]?.name,biggestUpset:(sorted[4]?.name||"")+" beat "+(sorted[0]?.name||"")}}} players={players}/>

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

function HofScreen({players,setScreen,setProfilePlayer,pastClashes}){

  const [expandRecord,setExpandRecord]=useState(null);

  const allP=players.length>0?players:[];

  const sorted=[...allP].sort((a,b)=>b.pts-a.pts);

  const king=sorted[0];

  const kingStats=king?computeStats(king):null;

  const challengers=sorted.slice(1,4);

  const kingGap=challengers[0]?king.pts-challengers[0].pts:0;



  function openProfile(name){

    const p=allP.find(pl=>pl.name===name);

    if(p){setProfilePlayer(p);setScreen("profile");}

  }



  // Season champs built from PAST_CLASHES + current leader

  var pastChamps=(pastClashes||[]).map(function(c){return {season:c.season||("S"+(c.id||"?")),champion:c.champion||"Unknown",pts:c.pts||0,rank:c.rank||"",wins:c.wins||0,status:"past"};});
  const SEASON_CHAMPS=king?pastChamps.concat([{season:"S1",champion:king.name,pts:king.pts,rank:king.rank,wins:king.wins,status:"active"}]):pastChamps;



  // Computed HOF records from live player data

  var wp=allP.filter(function(p){return (p.games||0)>0;});

  var hofRecs=[];

  if(wp.length>0){

    var byPts=[...wp].sort(function(a,b){return b.pts-a.pts;});

    var byWins=[...wp].sort(function(a,b){return (b.wins||0)-(a.wins||0);});

    var byAvg=[...wp].filter(function(p){return p.avg;}).sort(function(a,b){return parseFloat(a.avg)-parseFloat(b.avg);});

    var byStreak=[...wp].sort(function(a,b){return (b.bestStreak||0)-(a.bestStreak||0);});

    var byGames=[...wp].sort(function(a,b){return (b.games||0)-(a.games||0);});

    var byTop4=[...wp].sort(function(a,b){return ((b.top4||0)/b.games)-((a.top4||0)/a.games);});

    hofRecs=[

      byPts[0]?{id:"pts",icon:"🏆",title:"Season Points Leader",value:byPts[0].pts+" pts",holder:byPts[0].name,rank:byPts[0].rank,runner:[byPts[1]&&byPts[1].name,byPts[2]&&byPts[2].name].filter(Boolean),history:[]}:null,

      byWins[0]&&(byWins[0].wins||0)>0?{id:"wins",icon:"⚡",title:"Win Machine",value:(byWins[0].wins||0)+" wins",holder:byWins[0].name,rank:byWins[0].rank,runner:[byWins[1]&&byWins[1].name,byWins[2]&&byWins[2].name].filter(Boolean),history:[]}:null,

      byAvg[0]?{id:"avg",icon:"🎯",title:"Consistency King",value:"AVP "+byAvg[0].avg,holder:byAvg[0].name,rank:byAvg[0].rank,runner:[byAvg[1]&&byAvg[1].name,byAvg[2]&&byAvg[2].name].filter(Boolean),history:[]}:null,

      byStreak[0]&&(byStreak[0].bestStreak||0)>1?{id:"streak",icon:"🔥",title:"Hot Streak",value:(byStreak[0].bestStreak||0)+" consecutive top4s",holder:byStreak[0].name,rank:byStreak[0].rank,runner:[byStreak[1]&&byStreak[1].name,byStreak[2]&&byStreak[2].name].filter(Boolean),history:[]}:null,

      byGames[0]?{id:"games",icon:"🎮",title:"Iron Presence",value:(byGames[0].games||0)+" games",holder:byGames[0].name,rank:byGames[0].rank,runner:[byGames[1]&&byGames[1].name,byGames[2]&&byGames[2].name].filter(Boolean),history:[]}:null,

      byTop4[0]&&(byTop4[0].games||0)>0?{id:"top4r",icon:"🌟",title:"Top4 Machine",value:Math.round((byTop4[0].top4||0)/byTop4[0].games*100)+"%",holder:byTop4[0].name,rank:byTop4[0].rank,runner:[byTop4[1]&&byTop4[1].name,byTop4[2]&&byTop4[2].name].filter(Boolean),history:[]}:null,

    ].filter(Boolean);

  }



  return(

    <div className="page wrap">



      {/* Page header */}

      <div style={{textAlign:"center",position:"relative",overflow:"hidden",paddingBottom:28,marginBottom:28}}>

        <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at center,rgba(232,168,56,.06),transparent 70%)",pointerEvents:"none"}}/>

        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".3em",textTransform:"uppercase",marginBottom:10}}>TFT Clash · Season 1</div>

        <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(36px,7vw,72px)",fontWeight:900,color:"#F2EDE4",lineHeight:.88,marginBottom:14,letterSpacing:"-.02em"}}>

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

              <div style={{width:"clamp(64px,9vw,88px)",height:"clamp(64px,9vw,88px)",borderRadius:"50%",background:"linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.04))",border:"2px solid #E8A838",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(24px,4vw,36px)",fontWeight:900,fontFamily:"'Russo One',sans-serif",color:"#E8A838",margin:"0 auto 12px",boxShadow:"0 0 32px rgba(232,168,56,.25)"}}>

                {king.name.charAt(0)}

              </div>

              <div className="cond" style={{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".2em",textTransform:"uppercase",marginBottom:5}}>Season 1 Leader</div>

              <div style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(15px,2.5vw,22px)",fontWeight:900,color:"#F2EDE4",textShadow:"0 0 20px rgba(232,168,56,.25)",lineHeight:1.1,marginBottom:8}}>{king.name}</div>

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

          <h2 style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(14px,2vw,20px)",color:"#F2EDE4",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Season Champions</h2>

          <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(232,168,56,.3),transparent)"}}/>

        </div>

        {SEASON_CHAMPS.length===0&&(

          <div style={{background:"linear-gradient(135deg,rgba(232,168,56,.06),rgba(155,114,207,.04))",border:"1px solid rgba(232,168,56,.2)",borderRadius:14,padding:"28px 24px",textAlign:"center"}}>

            <div style={{fontSize:36,marginBottom:10}}>👑</div>

            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:17,fontWeight:700,color:"#E8A838",marginBottom:6}}>A champion yet to be crowned</div>

            <div style={{fontSize:13,color:"#9AAABF",maxWidth:340,margin:"0 auto",lineHeight:1.6}}>The throne is empty. Compete in the first clash and write your name into history.</div>

          </div>

        )}

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

                <div style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(14px,2vw,18px)",fontWeight:700,color:isActive?"#E8A838":"#F2EDE4",lineHeight:1.2,marginBottom:5}}>{s.champion}</div>

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

          <h2 style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(14px,2vw,20px)",color:"#F2EDE4",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Trophy Cabinet</h2>

          <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(232,168,56,.3),transparent)"}}/>

        </div>

        {hofRecs.length===0&&(
          <div style={{textAlign:"center",padding:"64px 24px",color:"#6B7280"}}>
            <div style={{fontSize:48,marginBottom:16}}>🏆</div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:18,color:"#9AAABF",marginBottom:8}}>Hall of Fame loading...</div>
            <div style={{fontSize:14,lineHeight:1.6}}>Season champions will be enshrined here.</div>
          </div>
        )}

        <div className="grid-2">

          {hofRecs.map(r=>{

            const isOpen=expandRecord===r.id;

            return(

              <div key={r.id} onClick={()=>setExpandRecord(isOpen?null:r.id)}

                style={{background:"linear-gradient(135deg,#0D1321,#080B14)",border:"1px solid "+(isOpen?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),borderRadius:14,overflow:"hidden",cursor:"pointer",transition:"border-color .2s,box-shadow .2s,transform .2s",boxShadow:isOpen?"0 0 40px rgba(232,168,56,.12)":"none",transform:"translateY(0)"}}

                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(232,168,56,.4)";e.currentTarget.style.boxShadow="0 0 32px rgba(232,168,56,.14),0 4px 24px rgba(0,0,0,.4)";e.currentTarget.style.transform="translateY(-2px)";}}

                onMouseLeave={e=>{e.currentTarget.style.borderColor=isOpen?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)";e.currentTarget.style.boxShadow=isOpen?"0 0 40px rgba(232,168,56,.12)":"none";e.currentTarget.style.transform="translateY(0)";}}>

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

      {allP.length>=4&&(

        <div>

          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>

            <div style={{width:18,height:2,background:"#9B72CF",borderRadius:2,flexShrink:0}}/>

            <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:15,color:"#F2EDE4",fontWeight:700,letterSpacing:".04em",textTransform:"uppercase"}}>Top Rivalries</h3>

          </div>

          <div style={{background:"rgba(155,114,207,.05)",border:"1px solid rgba(155,114,207,.15)",borderRadius:12,padding:"20px",textAlign:"center",color:"#9AAABF",fontSize:13}}>

            Rivalries will emerge once players have competed in multiple clashes together. Check back after a few events.

          </div>

        </div>

      )}



    </div>

  );

}

// ─── ARCHIVE ──────────────────────────────────────────────────────────────────

function ArchiveScreen({players,currentUser,setScreen,pastClashes}){

  const [open,setOpen]=useState(null);

  const all=[...(pastClashes||PAST_CLASHES)];



  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

        <div style={{flex:1}}>

          <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:4}}>Archive</h2>

          <p style={{color:"#BECBD9",fontSize:13}}>{all.length} event{all.length!==1?"s":""} recorded</p>

        </div>

      </div>

      {all.length===0&&(

        <div style={{textAlign:"center",padding:"60px 20px",color:"#9AAABF"}}>

          <div style={{fontSize:40,marginBottom:12}}>📭</div>

          <div style={{fontSize:16,fontWeight:700,color:"#C8D4E0",marginBottom:6}}>No clashes archived yet</div>

          <div style={{fontSize:13}}>Completed clashes will appear here after the admin finalizes them.</div>

        </div>

      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>

        {all.map(c=>{

          const myFinish=currentUser?(c.top3||[]).indexOf(currentUser.username):null;

          const myPos=myFinish>=0?myFinish+1:null;

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







function ScrimAccessPanel({scrimAccess,setScrimAccess,toast,addAudit}){
  var [newUser,setNewUser]=useState("");
  function addUser(){
    var u=newUser.trim();
    if(!u){toast("Enter a username","error");return;}
    if((scrimAccess||[]).includes(u)){toast("Already in list","error");return;}
    setScrimAccess(function(a){return [...(a||[]),u];});
    addAudit("ACTION","Scrims access granted to "+u);
    setNewUser("");
    toast(u+" added to Scrims access","success");
  }
  function removeUser(u){
    setScrimAccess(function(a){return (a||[]).filter(function(x){return x!==u;});});
    addAudit("ACTION","Scrims access removed from "+u);
    toast(u+" removed from Scrims access","success");
  }
  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
      <Panel accent style={{padding:"20px"}}>
        <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:6}}>Scrims Access</h3>
        <div style={{fontSize:12,color:"#9AAABF",marginBottom:16}}>Players in this list can access The Lab (Scrims). Admin always has access. Use exact usernames.</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <Inp value={newUser} onChange={setNewUser} placeholder="Username" onKeyDown={function(e){if(e.key==="Enter")addUser();}} style={{flex:1}}/>
          <Btn v="purple" onClick={addUser}>Add</Btn>
        </div>
        {(!scrimAccess||scrimAccess.length===0)?(
          <div style={{fontSize:13,color:"#9AAABF",textAlign:"center",padding:"16px 0"}}>No users added yet.</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {(scrimAccess||[]).map(function(u){
              return(
                <div key={u} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.2)",borderRadius:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#C4B5FD"}}>{u}</span>
                  <button onClick={function(){removeUser(u);}} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 4px"}}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <Panel style={{padding:"20px"}}>
        <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:10}}>About Scrims Access</h3>
        <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.6}}>
          <p style={{marginBottom:10}}>The Lab is the private scrims section where your friend group logs practice games, tracks stats, and sees head-to-head records.</p>
          <p style={{marginBottom:10}}>Only users on this allowlist (plus admin) can see and access the Scrims tab in the nav.</p>
          <p>Usernames must match exactly — they are case-sensitive and must match the account username on this platform.</p>
        </div>
      </Panel>
    </div>
  );
}

function TickerAdminPanel({tickerOverrides,setTickerOverrides,toast,addAudit}){
  var [newItem,setNewItem]=useState("");
  var items=tickerOverrides||[];
  function add(){
    var t=newItem.trim();
    if(!t){toast("Enter ticker text","error");return;}
    if(items.includes(t)){toast("Already exists","error");return;}
    setTickerOverrides(items.concat([t]));
    addAudit("BROADCAST","Admin added ticker item: "+t);
    setNewItem("");
    toast("Ticker item added");
  }
  function remove(item){
    setTickerOverrides(items.filter(function(x){return x!==item;}));
    addAudit("ACTION","Admin removed ticker item: "+item);
    toast("Removed");
  }
  return(
    <Panel style={{padding:20}}>
      <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:4}}>Ticker Management</div>
      <div style={{fontSize:12,color:"#9AAABF",marginBottom:16}}>Custom items appear first in the community pulse ticker on the home screen. Auto-stats are appended after.</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <Inp value={newItem} onChange={setNewItem} placeholder="e.g. Next clash: Saturday 8PM EST" style={{flex:1}}/>
        <Btn v="purple" s="sm" onClick={add}>Add</Btn>
      </div>
      {items.length===0?(
        <div style={{textAlign:"center",padding:24,color:"#9AAABF",fontSize:13}}>No custom ticker items. Auto-stats will still show.</div>
      ):(
        <div>
          {items.map(function(item,i){return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.07)",borderRadius:8,marginBottom:6}}>
              <span style={{flex:1,fontSize:13,color:"#C8BFB0"}}>{item}</span>
              <Btn v="danger" s="xs" onClick={function(){remove(item);}}>Remove</Btn>
            </div>
          );})}
        </div>
      )}
    </Panel>
  );
}

function AdminPanel({players,setPlayers,toast,setAnnouncement,setScreen,tournamentState,setTournamentState,seasonConfig,setSeasonConfig,quickClashes,setQuickClashes,orgSponsors,setOrgSponsors,scheduledEvents,setScheduledEvents,auditLog,setAuditLog,hostApps,setHostApps,scrimAccess,setScrimAccess,tickerOverrides,setTickerOverrides,setNotifications,featuredEvents,setFeaturedEvents}){

  const [tab,setTab]=useState("dashboard");

  const [editP,setEditP]=useState(null);

  const [noteTarget,setNoteTarget]=useState(null);

  const [noteText,setNoteText]=useState("");

  const [broadMsg,setBroadMsg]=useState("");

  const [broadType,setBroadType]=useState("NOTICE");

  const [announcements,setAnnouncements]=useState([]);

  const [newEvent,setNewEvent]=useState({name:"",type:"SCHEDULED",date:"",time:"",cap:"8",format:"Swiss",notes:""});

  const [seedAlgo,setSeedAlgo]=useState("rank-based");

  const [paused,setPaused]=useState(false);

  const [scoreEdit,setScoreEdit]=useState({});

  const [seasonName,setSeasonName]=useState(seasonConfig&&seasonConfig.seasonName||"Season 1");

  const [addPlayerForm,setAddPlayerForm]=useState({name:"",riotId:"",region:"EUW",rank:"Gold"});

  const [showAddPlayer,setShowAddPlayer]=useState(false);

  const [flashForm,setFlashForm]=useState({name:"Flash Clash",cap:"8",rounds:"2",format:"Single Lobby"});

  const [qcPlacements,setQcPlacements]=useState({});

  const [roundConfig,setRoundConfig]=useState({maxPlayers:"24",roundCount:"3",checkinWindowMins:"30"});

  const [flashEvents,setFlashEvents]=useState([]);

  const [spForm,setSpForm]=useState({name:"",logo:"",color:"",playerId:""});

  const [auditFilter,setAuditFilter]=useState("All");



  function addAudit(type,msg){
    var entry={ts:Date.now(),type:type,msg:msg};
    setAuditLog(function(l){return [entry].concat(l.slice(0,199));});
    // Also write to audit_log table if Supabase available
    if(supabase.from&&currentUser){
      supabase.from('audit_log').insert({
        action:type,
        actor_id:currentUser.id||null,
        actor_name:currentUser.username||currentUser.email||'Admin',
        target_type:'admin_action',
        details:{message:msg,timestamp:entry.ts}
      }).then(function(res){if(res.error)console.error("[TFT] Audit log write failed:",res.error);});
    }
  }

  function ban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:true,checkedIn:false}:p));setTournamentState(function(ts){return{...ts,checkedInIds:(ts.checkedInIds||[]).filter(function(cid){return String(cid)!==String(id);})};});addAudit("WARN","Banned: "+name);toast(name+" banned","success");}

  function unban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:false,dnpCount:0}:p));addAudit("ACTION","Unbanned: "+name);toast(name+" unbanned","success");}

  function markDNP(id,name){

    setPlayers(ps=>ps.map(p=>{

      if(p.id!==id)return p;

      var newCount=(p.dnpCount||0)+1;

      var isDQ=newCount>=2;

      addAudit("WARN","DNP #"+newCount+": "+name+(isDQ?" → AUTO-DQ":""));

      if(isDQ)toast(name+" has 2 DNPs — DISQUALIFIED","error");

      else toast(name+" marked DNP ("+newCount+"/2 before DQ)","success");

      if(isDQ){setTournamentState(function(ts){return{...ts,checkedInIds:(ts.checkedInIds||[]).filter(function(cid){return String(cid)!==String(id);})};});} return{...p,dnpCount:newCount,banned:isDQ?true:p.banned,checkedIn:isDQ?false:p.checkedIn};

    }));

  }

  function clearDNP(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,dnpCount:0}:p));addAudit("ACTION","DNP cleared: "+name);toast("DNP cleared for "+name,"success");}

  function remove(id,name){setPlayers(ps=>ps.filter(p=>p.id!==id));addAudit("ACTION","Removed: "+name);toast(name+" removed","success");}

  function saveNote(){setPlayers(ps=>ps.map(p=>p.id===noteTarget.id?{...p,notes:noteText}:p));addAudit("ACTION","Note updated: "+noteTarget.name);setNoteTarget(null);}

  function addPlayer(){

    const n=sanitize(addPlayerForm.name.trim()),r=sanitize(addPlayerForm.riotId.trim());

    if(!n||!r){toast("Name and Riot ID required","error");return;}

    if(players.find(p=>p.name.toLowerCase()===n.toLowerCase())){toast("Name already taken","error");return;}

    const np={id:Date.now()%100000,name:n,riotId:r,rank:addPlayerForm.rank||"Gold",lp:1000,region:addPlayerForm.region||"EUW",pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,checkedIn:false,role:"player",banned:false,dnpCount:0,notes:"",clashHistory:[],sparkline:[],attendanceStreak:0,lastClashId:null,sponsor:null};

    setPlayers(ps=>[...ps,np]);

    // Write to players table too
    if(supabase.from){
      supabase.from('players').insert({username:n,riot_id:r,rank:addPlayerForm.rank||"Gold",region:addPlayerForm.region||"EUW",auth_user_id:null})
        .then(function(res){if(res.error)console.error("[TFT] Failed to insert player to DB:",res.error);else if(res.data&&res.data[0]){setPlayers(function(ps){return ps.map(function(p){return p.name===n?Object.assign({},p,{id:res.data[0].id}):p;});});}});
    }

    addAudit("ACTION","Player added: "+n);

    toast(n+" added!","success");

    setAddPlayerForm({name:"",riotId:"",region:"EUW",rank:"Gold"});

    setShowAddPlayer(false);

  }



  const AUDIT_COLS={INFO:"#4ECDC4",ACTION:"#52C47C",WARN:"#E8A838",RESULT:"#9B72CF",BROADCAST:"#E8A838",DANGER:"#F87171"};

  const EVENT_COLS={SCHEDULED:"#E8A838",FLASH:"#F87171",INVITATIONAL:"#9B72CF",WEEKLY:"#4ECDC4"};

  const currentPhase=tournamentState?tournamentState.phase:"registration";

  const phaseColor={registration:"#9B72CF",checkin:"#E8A838",inprogress:"#52C47C",complete:"#4ECDC4"};

  const phaseLabel={registration:"Registration Open",checkin:"Check-in Open",inprogress:"Round "+(tournamentState?tournamentState.round:1)+" in Progress",complete:"Complete"};

  const pendingHosts=hostApps.filter(a=>a.status==="pending").length;



  const TABS=[

    {id:"dashboard",icon:"📊",label:"Dashboard"},

    {id:"round",icon:"⚡",label:"Round"},

    {id:"quickclash",icon:"🎲",label:"Quick Clash"},

    {id:"schedule",icon:"📅",label:"Schedule"},

    {id:"players",icon:"👥",label:"Players"},

    {id:"scores",icon:"✏️",label:"Scores"},

    {id:"broadcast",icon:"📢",label:"Broadcast"},

    {id:"hosts",icon:"🎮",label:"Hosts"+(pendingHosts>0?" ("+pendingHosts+")":"")},

    {id:"season",icon:"🏆",label:"Season"},

    {id:"sponsorships",icon:"🏢",label:"Sponsors"},

    {id:"audit",icon:"📋",label:"Audit"},

    {id:"friends",icon:"🎮",label:"Scrims Access"},
    {id:"ticker",icon:"📡",label:"Ticker"},

    {id:"settings",icon:"⚙️",label:"Settings"},

    {id:"featured",icon:"🌟",label:"Featured"},

  ];



  const TAB_INFO={

    dashboard:"At-a-glance clash status. Use quick actions to check in all players, pause the round, or jump to broadcast.",

    round:"Full tournament lifecycle: open check-in → start → advance rounds → complete. Configure seeding and round settings here.",

    quickclash:"Spin up an instant open clash (4–16 players, no registration). Appears live on the home screen. Players join immediately.",

    schedule:"Add upcoming clashes to the public calendar. Players see scheduled events on the home screen.",

    players:"Full roster. Edit info, assign roles, mark DNP (no-show), ban/unban, and add internal notes (admin-only).",

    scores:"Override a player’s season point total. All changes are flagged as DANGER in Audit. Use sparingly.",

    broadcast:"Send a sitewide announcement banner visible to all logged-in players. Clear it here when done.",

    hosts:"Review host applications submitted via the Pricing page. Approved hosts get lobby management access.",

    season:"Season name, health rules (drop weeks, comeback/attendance bonuses, finale multiplier), and Danger Zone.",

    sponsorships:"Assign org sponsors to players. Their tag shows next to the player name on the leaderboard and profile.",

    audit:"Full chronological log of every admin action. Use for dispute resolution or accountability reviews.",

    settings:"Role permission reference and admin quickstart guide.",

    featured:"Manage featured events shown on the Featured Events page. Add, edit, or remove community tournaments and partner events.",

  };



  return(

    <div className="page wrap">



      {/* NOTE MODAL */}

      {noteTarget&&(

        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>

          <Panel style={{width:"100%",maxWidth:400,padding:"24px"}}>

            <h3 style={{color:"#F2EDE4",fontSize:16,fontWeight:700,marginBottom:4}}>Internal Note</h3>

            <div style={{fontSize:12,color:"#9AAABF",marginBottom:12}}>Only admins can see this. Use for dispute history, warnings, etc.</div>

            <div style={{fontSize:13,fontWeight:700,color:"#9B72CF",marginBottom:10}}>{noteTarget.name}</div>

            <Inp value={noteText} onChange={setNoteText} placeholder="e.g. known griefer, dispute 2026-03-10..." style={{marginBottom:14}}/>

            <div style={{display:"flex",gap:10}}>

              <Btn v="primary" full onClick={saveNote}>Save Note</Btn>

              <Btn v="dark" onClick={()=>setNoteTarget(null)}>Cancel</Btn>

            </div>

          </Panel>

        </div>

      )}



      {/* PAGE HEADER */}

      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>

        <div style={{width:46,height:46,background:"linear-gradient(135deg,rgba(232,168,56,.14),rgba(232,168,56,.04))",border:"1px solid rgba(232,168,56,.35)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>⬡</div>

        <div style={{flex:1,minWidth:0}}>

          <h2 style={{color:"#F2EDE4",fontSize:20,fontWeight:800,lineHeight:1,margin:0}}>Admin Panel</h2>

          <div style={{fontSize:12,color:"#BECBD9",marginTop:3}}>TFT Clash · {seasonName}</div>

        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap"}}>

          <div style={{padding:"5px 13px",background:phaseColor[currentPhase]+"1A",border:"1px solid "+phaseColor[currentPhase]+"44",borderRadius:20,fontSize:12,fontWeight:700,color:phaseColor[currentPhase]}}>

            {phaseLabel[currentPhase]}

          </div>

          {pendingHosts>0&&(

            <div style={{padding:"5px 13px",background:"rgba(248,113,113,.12)",border:"1px solid rgba(248,113,113,.3)",borderRadius:20,fontSize:12,fontWeight:700,color:"#F87171",cursor:"pointer"}} onClick={()=>setTab("hosts")}>

              {pendingHosts} host app{pendingHosts>1?"s":""}

            </div>

          )}

        </div>

      </div>



      {/* TAB NAVIGATION */}

      <div style={{display:"flex",gap:4,flexWrap:"nowrap",overflowX:"auto",paddingBottom:4,marginBottom:4,scrollbarWidth:"none"}}>

        {TABS.map(t=>(

          <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 13px",background:tab===t.id?"rgba(155,114,207,.18)":"rgba(255,255,255,.03)",border:"1px solid "+(tab===t.id?"rgba(155,114,207,.5)":"rgba(242,237,228,.07)"),borderRadius:8,color:tab===t.id?"#C4B5FD":"#9AAABF",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?700:400,whiteSpace:"nowrap",flexShrink:0,transition:"all .12s",fontFamily:"inherit"}}>

            <span>{t.icon}</span><span>{t.label}</span>

          </button>

        ))}

      </div>



      {/* TAB INFO BANNER */}

      <div style={{padding:"9px 14px",background:"rgba(155,114,207,.04)",border:"1px solid rgba(155,114,207,.12)",borderRadius:8,marginBottom:18,fontSize:12,color:"#9AAABF",lineHeight:1.5}}>

        <span style={{color:"#C4B5FD",fontWeight:700,marginRight:6}}>ℹ</span>{TAB_INFO[tab]||""}

      </div>



      {/* ── DASHBOARD ── */}

      {tab==="dashboard"&&(

        <div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>

            {[

              {label:"Players",value:players.length,color:"#E8A838",icon:"👥"},

              {label:"Checked In",value:players.filter(p=>p.checkedIn).length,color:"#52C47C",icon:"✓"},

              {label:"Banned",value:players.filter(p=>p.banned).length,color:"#F87171",icon:"⛔"},

              {label:"Scheduled",value:scheduledEvents.length,color:"#C4B5FD",icon:"📅"},

            ].map(c=>(

              <Panel key={c.label} style={{padding:"18px 12px",textAlign:"center"}}>

                <div style={{fontSize:20,marginBottom:6}}>{c.icon}</div>

                <div className="mono" style={{fontSize:26,fontWeight:800,color:c.color,lineHeight:1}}>{c.value}</div>

                <div className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",marginTop:5,letterSpacing:".06em",textTransform:"uppercase"}}>{c.label}</div>

              </Panel>

            ))}

          </div>

          <Panel style={{padding:"16px",marginBottom:16}}>

            <div style={{fontSize:11,fontWeight:700,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>Quick Actions</div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>

              <Btn v="success" s="sm" onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,checkedIn:true})));setTournamentState(function(ts){return{...ts,checkedInIds:players.map(function(p){return String(p.id);})};});addAudit("ACTION","Check In All");toast("All players checked in","success");}}>Check In All</Btn>

              <Btn v="dark" s="sm" onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));setTournamentState(function(ts){return{...ts,checkedInIds:[]};});addAudit("ACTION","Check Out All");toast("All players checked out","success");}}>Clear Check-In</Btn>

              <Btn v={paused?"success":"warning"} s="sm" onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Round resumed":"Round paused");}}>{paused?"▶ Resume":"⏸ Pause"}</Btn>

              <Btn v="dark" s="sm" onClick={()=>setTab("broadcast")}>📢 Broadcast</Btn>

              <Btn v="dark" s="sm" onClick={()=>setTab("round")}>⚡ Round Controls</Btn>

            </div>

          </Panel>

          <Panel style={{overflow:"hidden"}}>

            <div style={{padding:"12px 16px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>

              <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Recent Activity</div>

              <Btn v="dark" s="sm" onClick={()=>setTab("audit")}>Full Log →</Btn>

            </div>

            {auditLog.length===0&&<div style={{padding:"28px",textAlign:"center",color:"#9AAABF",fontSize:13}}>No activity yet.</div>}

            {auditLog.slice(0,10).map((l,i)=>(

              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid rgba(242,237,228,.04)"}}>

                <Tag color={AUDIT_COLS[l.type]||"#E8A838"} size="sm">{l.type}</Tag>

                <span style={{fontSize:13,color:"#C8BFB0",flex:1}}>{l.msg}</span>

                <span className="mono" style={{fontSize:10,color:"#9AAABF",whiteSpace:"nowrap",flexShrink:0}}>{new Date(l.ts).toLocaleTimeString()}</span>

              </div>

            ))}

          </Panel>

        </div>

      )}



      {/* ── PLAYERS ── */}

      {tab==="players"&&(

        <div>

          {editP?(

            <Panel accent style={{padding:"22px",marginBottom:16}}>

              <div style={{marginTop:6}}>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>

                  <div>

                    <h3 style={{color:"#F2EDE4",fontSize:16,fontWeight:700,margin:0}}>Edit Player</h3>

                    <div style={{fontSize:12,color:"#9B72CF",marginTop:3}}>{editP.name}</div>

                  </div>

                  <Btn v="dark" s="sm" onClick={()=>setEditP(null)}>← Back</Btn>

                </div>

                <div className="grid-2" style={{marginBottom:14}}>

                  {[["Display Name","name"],["Riot ID","riotId"],["Region","region"]].map(([l,k])=>(

                    <div key={k}>

                      <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</label>

                      <Inp value={editP[k]||""} onChange={v=>setEditP(e=>({...e,[k]:v}))} placeholder={l}/>

                    </div>

                  ))}

                  <div>

                    <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Role</label>

                    <Sel value={editP.role||"player"} onChange={v=>setEditP(e=>({...e,role:v}))}>{["player","host","mod","admin"].map(r=><option key={r} value={r}>{r}</option>)}</Sel>

                  </div>

                </div>

                <div style={{display:"flex",gap:10}}>

                  <Btn v="primary" onClick={()=>{setPlayers(ps=>ps.map(p=>p.id===editP.id?editP:p));addAudit("ACTION","Edited: "+editP.name);setEditP(null);toast("Saved","success");}}>Save Changes</Btn>

                  <Btn v="dark" onClick={()=>setEditP(null)}>Cancel</Btn>

                </div>

              </div>

            </Panel>

          ):(

            <div style={{display:"flex",flexDirection:"column",gap:8}}>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>

                <div style={{fontSize:13,color:"#C8D4E0"}}>{players.length} players · {players.filter(p=>p.checkedIn).length} in · {players.filter(p=>p.banned).length} banned</div>

                <Btn v="primary" s="sm" onClick={()=>setShowAddPlayer(v=>!v)}>{showAddPlayer?"Cancel":"+ Add Player"}</Btn>

              </div>

              {showAddPlayer&&(

                <Panel style={{padding:"18px",marginBottom:4,border:"1px solid rgba(155,114,207,.25)"}}>

                  <h4 style={{color:"#C4B5FD",fontSize:14,marginBottom:14,fontWeight:700,margin:"0 0 14px"}}>Add New Player</h4>

                  <div className="grid-2" style={{marginBottom:14}}>

                    <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Display Name</label><Inp value={addPlayerForm.name} onChange={v=>setAddPlayerForm(f=>({...f,name:v}))} placeholder="Username"/></div>

                    <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Riot ID</label><Inp value={addPlayerForm.riotId} onChange={v=>setAddPlayerForm(f=>({...f,riotId:v}))} placeholder="Name#TAG"/></div>

                    <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Region</label><Sel value={addPlayerForm.region} onChange={v=>setAddPlayerForm(f=>({...f,region:v}))}>{REGIONS.map(r=><option key={r} value={r}>{r}</option>)}</Sel></div>

                    <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Rank</label><Sel value={addPlayerForm.rank} onChange={v=>setAddPlayerForm(f=>({...f,rank:v}))}>{RANKS.map(r=><option key={r} value={r}>{r}</option>)}</Sel></div>

                  </div>

                  <Btn v="success" onClick={addPlayer}>Add Player</Btn>

                </Panel>

              )}

              {players.length===0&&<Panel style={{padding:"40px",textAlign:"center"}}><div style={{color:"#9AAABF",fontSize:14}}>No players yet — add one above.</div></Panel>}

              {players.map(p=>(

                <Panel key={p.id} style={{padding:"14px 16px",background:p.banned?"rgba(127,29,29,.12)":undefined,border:p.banned?"1px solid rgba(248,113,113,.2)":"1px solid rgba(242,237,228,.09)"}}>

                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>

                    <div style={{flex:1,minWidth:0}}>

                      <div style={{fontWeight:700,fontSize:14,color:p.banned?"#F87171":"#F2EDE4",display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:3}}>

                        {p.name}

                        {p.role!=="player"&&<Tag color="#9B72CF" size="sm">{p.role}</Tag>}

                        {p.banned&&<Tag color="#F87171" size="sm">{(p.dnpCount||0)>=2?"⛔ DQ":"BANNED"}</Tag>}

                        {!p.banned&&(p.dnpCount||0)>0&&<Tag color="#F97316" size="sm">DNP {p.dnpCount}/2</Tag>}

                        {p.checkedIn&&<Tag color="#52C47C" size="sm">✓ In</Tag>}

                        {isComebackEligible(p,PAST_CLASHES.map(function(c){return "c"+c.id;}))&&<Tag color="#4ECDC4" size="sm">Comeback</Tag>}

                        {(p.attendanceStreak||0)>=3&&<Tag color="#E8A838" size="sm">{p.attendanceStreak}-streak</Tag>}

                      </div>

                      <div style={{fontSize:12,color:"#BECBD9"}}>{p.riotId} · {p.rank} · <span className="mono" style={{color:"#E8A838"}}>{p.pts}pts</span> · {p.games||0}G</div>

                      {p.notes&&<div style={{fontSize:11,color:"#EAB308",marginTop:4}}>📌 {p.notes}</div>}

                    </div>

                    <div style={{display:"flex",gap:5,flexWrap:"wrap",flexShrink:0}}>

                      <Btn s="sm" v="dark" onClick={()=>setEditP(p)}>Edit</Btn>

                      <Btn s="sm" v="ghost" onClick={()=>{setNoteTarget(p);setNoteText(p.notes||"");}} title="Add internal note">📌</Btn>

                      {!p.banned&&<Btn s="sm" v="warning" onClick={()=>markDNP(p.id,p.name)} title="Mark no-show (2 DNPs = DQ)">DNP</Btn>}

                      {(p.dnpCount||0)>0&&!p.banned&&<Btn s="sm" v="dark" onClick={()=>clearDNP(p.id,p.name)} title="Clear DNP count">↩ DNP</Btn>}

                      {p.banned?<Btn s="sm" v="success" onClick={()=>unban(p.id,p.name)}>Unban</Btn>:<Btn s="sm" v="danger" onClick={()=>ban(p.id,p.name)}>Ban</Btn>}

                      <Btn s="sm" v="danger" onClick={()=>remove(p.id,p.name)} title="Remove permanently">✕</Btn>

                    </div>

                  </div>

                </Panel>

              ))}

            </div>

          )}

        </div>

      )}



      {/* ── SCORES ── */}

      {tab==="scores"&&(

        <div>

          <Panel style={{overflow:"hidden",marginBottom:14}}>

            <div style={{padding:"12px 16px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>

              <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Season Points Override</div>

              <div style={{fontSize:11,color:"#BECBD9"}}>Leave blank to keep current</div>

            </div>

            {players.map(p=>(

              <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:"1px solid rgba(242,237,228,.04)"}}>

                <span style={{fontWeight:600,fontSize:14,color:"#F2EDE4",flex:1}}>{p.name}</span>

                <span className="mono" style={{fontSize:13,color:"#BECBD9",minWidth:64}}>Now: <span style={{color:"#E8A838",fontWeight:700}}>{p.pts}</span></span>

                <div style={{width:110,flexShrink:0}}>

                  <Inp value={scoreEdit[p.id]!==undefined?scoreEdit[p.id]:""} onChange={v=>setScoreEdit(e=>({...e,[p.id]:v}))} placeholder={String(p.pts)} type="number"/>

                </div>

              </div>

            ))}

          </Panel>

          <div style={{display:"flex",gap:10}}>

            <Btn v="primary" onClick={()=>{setPlayers(ps=>ps.map(p=>{const nv=scoreEdit[p.id];if(nv===undefined)return p;addAudit("DANGER","Score override: "+p.name+" → "+nv);return{...p,pts:parseInt(nv)||p.pts};}));setScoreEdit({});toast("Score changes applied","success");}}>Apply Changes</Btn>

            <Btn v="dark" onClick={()=>setScoreEdit({})}>Clear</Btn>

          </div>

        </div>

      )}



      {/* ── ROUND ── */}

      {tab==="round"&&(

        <div className="grid-2">

          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Clash Details</div>

            <div className="grid-2">

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Clash Name</label><Inp value={tournamentState?.clashName||""} onChange={v=>setTournamentState(ts=>({...ts,clashName:v}))} placeholder="e.g. Clash #1"/></div>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label><Inp value={tournamentState?.clashDate||""} onChange={v=>setTournamentState(ts=>({...ts,clashDate:v}))} placeholder="e.g. Apr 5 2026"/></div>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Time</label><Inp value={tournamentState?.clashTime||""} onChange={v=>setTournamentState(ts=>({...ts,clashTime:v}))} placeholder="e.g. 8PM EST"/></div>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Countdown (ISO)</label><Inp value={tournamentState?.clashTimestamp||""} onChange={v=>setTournamentState(ts=>({...ts,clashTimestamp:v}))} placeholder="2026-04-05T20:00:00"/></div>

            </div>

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Tournament Phase</div>

            <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap"}}>

              {["registration","checkin","inprogress","complete"].map(ph=>(

                <div key={ph} style={{padding:"5px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:currentPhase===ph?phaseColor[ph]+"22":"rgba(255,255,255,.03)",border:"1px solid "+(currentPhase===ph?phaseColor[ph]+"55":"rgba(242,237,228,.07)"),color:currentPhase===ph?phaseColor[ph]:"#7A8BA0"}}>

                  {ph==="registration"?"1 Register":ph==="checkin"?"2 Check-in":ph==="inprogress"?"3 Live":"4 Done"}

                </div>

              ))}

            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>

              <Btn v="primary" full disabled={currentPhase!=="registration"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"checkin",checkedInIds:ts.registeredIds&&ts.registeredIds.length>0?[...ts.registeredIds]:ts.checkedInIds||[]}));addAudit("ACTION","Check-in opened — "+((tournamentState.registeredIds||[]).length)+" pre-registered players carried over");toast("Check-in is now open!","success");}}>Open Check-in</Btn>

              <Btn v="success" full disabled={currentPhase!=="checkin"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"inprogress",round:1,lockedLobbies:[],savedLobbies:[],clashId:"c"+Date.now(),seedAlgo:seedAlgo||"rank-based"}));if(supabase.from){supabase.from('tournaments').insert({name:(tournamentState&&tournamentState.clashName)||'Clash',date:new Date().toISOString().split('T')[0],phase:'upcoming',format:'single_stage',size:24,seeding_method:'snake'}).select().then(function(res){if(!res.error&&res.data&&res.data[0]){setTournamentState(function(ts){return Object.assign({},ts,{dbTournamentId:res.data[0].id});});}else if(res.error){console.error("[TFT] Failed to create tournament in DB:",res.error);}});}addAudit("ACTION","Tournament started");toast("Tournament started! Bracket ready.","success");}}>Start Tournament</Btn>

              <Btn v="danger" full onClick={()=>{if(window.confirm("Reset tournament to registration?")){setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],savedLobbies:[],checkedInIds:[],registeredIds:[]});setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));addAudit("DANGER","Tournament reset");toast("Tournament reset","success");}}}>Reset to Registration</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Round Controls</div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>

              <Btn v={paused?"success":"warning"} full onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Resumed":"Paused");}}>{paused?"▶ Resume Round":"⏸ Pause Round"}</Btn>

              <Btn v="dark" full onClick={()=>{setTournamentState(function(ts){if(!ts||ts.phase!=="inprogress")return ts;var next=ts.round+1;if(next>3)return Object.assign({},ts,{phase:"complete"});return Object.assign({},ts,{round:next,lockedLobbies:[],savedLobbies:[]});});addAudit("ACTION","Force advance");toast("Force advancing","success");}}>Force Advance Round →</Btn>

              <Btn v="purple" full onClick={()=>{setTournamentState(function(ts){return Object.assign({},ts,{lockedLobbies:[],savedLobbies:[],seedAlgo:seedAlgo});});addAudit("ACTION","Reseeded - "+seedAlgo);toast("Lobbies reseeded","success");}}>Reseed Lobbies</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:6}}>Seeding Mode</div>

            <div style={{fontSize:12,color:"#9AAABF",marginBottom:16}}>Choose how players are distributed across lobbies. Applies when tournament starts or lobbies are reseeded.</div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>

              {[["random","🎲 Random","Fully shuffled, no weighting — great for casual events"],["rank-based","🏆 By Rank","Top players spread evenly across lobbies for fair games"],["snake","🐍 Snake Draft","Alternating pick order — balances skill across lobbies"]].map(function(item){

                var v=item[0];var l=item[1];var d=item[2];

                var active=seedAlgo===v;

                return(

                  <button key={v} onClick={function(){setSeedAlgo(v);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"16px 14px",cursor:"pointer",textAlign:"center",fontFamily:"inherit",

                    background:active?"rgba(155,114,207,.12)":"rgba(255,255,255,.02)",

                    border:"2px solid "+(active?"#9B72CF":"rgba(242,237,228,.08)"),

                    borderRadius:10,

                    boxShadow:active?"0 0 16px rgba(155,114,207,.2)":"none",

                    transition:"all .15s"}}>

                    <span style={{fontSize:22}}>{l.split(" ")[0]}</span>

                    <span style={{fontSize:13,fontWeight:700,color:active?"#C4B5FD":"#C8BFB0"}}>{l.split(" ").slice(1).join(" ")}</span>

                    <span style={{fontSize:11,color:active?"#A78BFA":"#7A8BA0",lineHeight:1.4}}>{d}</span>

                    {active&&<span style={{fontSize:10,fontWeight:700,color:"#9B72CF",background:"rgba(155,114,207,.15)",border:"1px solid rgba(155,114,207,.3)",borderRadius:4,padding:"2px 8px",marginTop:2}}>SELECTED</span>}

                  </button>

                );

              })}

            </div>

            <button onClick={function(){setSeedAlgo("anti-stack");}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 14px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",

              background:seedAlgo==="anti-stack"?"rgba(248,113,113,.08)":"rgba(255,255,255,.02)",

              border:"1px solid "+(seedAlgo==="anti-stack"?"rgba(248,113,113,.4)":"rgba(242,237,228,.08)"),

              borderRadius:8}}>

              <span style={{fontSize:16}}>🚫</span>

              <span style={{fontSize:13,fontWeight:seedAlgo==="anti-stack"?700:500,color:seedAlgo==="anti-stack"?"#F87171":"#C8BFB0",flex:1}}>Anti-Stack</span>

              <span style={{fontSize:11,color:"#7A8BA0"}}>Prevents friend groups from stacking same lobby</span>

              {seedAlgo==="anti-stack"&&<span style={{fontSize:10,fontWeight:700,color:"#F87171",background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.25)",borderRadius:4,padding:"2px 8px"}}>SELECTED</span>}

            </button>

          </Panel>

          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:8}}>Quick Clash Setup</div>

            <div style={{fontSize:12,color:"#9AAABF",marginBottom:12}}>One-click presets — fills Max Players and Round Count below.</div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:0}}>

              {[["3 Games \xb7 24 Players","24","3"],["3 Games \xb7 16 Players","16","3"],["5 Games \xb7 24 Players","24","5"]].map(function(preset){return(

                <button key={preset[0]} onClick={function(){setRoundConfig(function(c){return Object.assign({},c,{maxPlayers:preset[1],roundCount:preset[2]});});toast("Preset loaded: "+preset[0],"success");}} style={{padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.3)",color:"#C4B5FD",transition:"all .15s"}} onMouseEnter={function(e){e.currentTarget.style.background="rgba(155,114,207,.2)";}} onMouseLeave={function(e){e.currentTarget.style.background="rgba(155,114,207,.1)";}}>

                  {preset[0]}

                </button>

              );

              })}

            </div>

          </Panel>

          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Round Settings</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Max Players</label><Inp type="number" value={roundConfig.maxPlayers} onChange={v=>setRoundConfig(c=>Object.assign({},c,{maxPlayers:v}))} placeholder="24"/></div>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Round Count</label><Sel value={roundConfig.roundCount} onChange={v=>setRoundConfig(c=>Object.assign({},c,{roundCount:v}))}><option value="2">2 Rounds</option><option value="3">3 Rounds</option></Sel></div>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Check-in Window</label><Sel value={roundConfig.checkinWindowMins} onChange={v=>setRoundConfig(c=>Object.assign({},c,{checkinWindowMins:v}))}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></Sel></div>

            </div>

          </Panel>

        </div>

      )}



      {/* ── QUICK CLASH ── */}

      {tab==="quickclash"&&(

        <div className="grid-2" style={{alignItems:"start"}}>

          <Panel accent style={{padding:"20px"}}>

            <div style={{marginTop:6}}>

              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>

                <div style={{width:38,height:38,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎲</div>

                <div>

                  <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>New Quick Clash</div>

                  <div style={{fontSize:11,color:"#BECBD9",marginTop:1}}>Opens immediately, no registration phase</div>

                </div>

              </div>

              <div style={{display:"grid",gap:12,marginBottom:14}}>

                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Event Name</label><Inp value={flashForm.name} onChange={v=>setFlashForm(f=>Object.assign({},f,{name:v}))} placeholder="Flash Clash"/></div>

                <div className="grid-2">

                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Player Cap</label><Sel value={flashForm.cap} onChange={v=>setFlashForm(f=>Object.assign({},f,{cap:v}))}>{[4,8,16].map(n=><option key={n} value={n}>{n} players</option>)}</Sel></div>

                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Rounds</label><Sel value={flashForm.rounds} onChange={v=>setFlashForm(f=>Object.assign({},f,{rounds:v}))}>{[1,2,3].map(n=><option key={n} value={n}>{n} round{n>1?"s":""}</option>)}</Sel></div>

                </div>

                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Format</label><Sel value={flashForm.format} onChange={v=>setFlashForm(f=>Object.assign({},f,{format:v}))}>{["Single Lobby","Two Lobbies","Finals Only"].map(fm=><option key={fm}>{fm}</option>)}</Sel></div>

              </div>

              <Btn v="primary" full onClick={()=>{if(!flashForm.name.trim())return;var ev={id:Date.now(),name:flashForm.name.trim(),cap:parseInt(flashForm.cap),rounds:parseInt(flashForm.rounds),format:flashForm.format,status:"open",players:[],startedAt:null,createdAt:new Date().toLocaleTimeString()};setQuickClashes&&setQuickClashes(function(qs){return [ev,...qs];});addAudit("ACTION","Quick Clash created: "+flashForm.name);toast(flashForm.name+" is open — "+flashForm.cap+" spots","success");setFlashForm({name:"Flash Clash",cap:"8",rounds:"2",format:"Single Lobby"});}}>Open Quick Clash ⚡</Btn>

            </div>

          </Panel>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            <div style={{fontSize:11,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:2}}>Active Quick Clashes</div>

            {(!quickClashes||quickClashes.length===0)&&(

              <Panel style={{padding:"36px",textAlign:"center"}}>

                <div style={{fontSize:32,marginBottom:10}}>⚡</div>

                <div style={{color:"#9AAABF",fontSize:13}}>No quick clashes active</div>

                <div style={{color:"#7A8BA0",fontSize:11,marginTop:4}}>Create one on the left</div>

              </Panel>

            )}

            {(quickClashes||[]).map(function(ev){return(

              <Panel key={ev.id} style={{padding:"16px",border:"1px solid rgba(155,114,207,.2)"}}>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>

                  <div style={{flex:1,minWidth:0}}>

                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>

                      <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{ev.name}</span>

                      <Tag color="#9B72CF" size="sm">QUICK</Tag>

                      {ev.status==="open"&&<Tag color="#6EE7B7" size="sm">● OPEN</Tag>}

                      {ev.status==="full"&&<Tag color="#E8A838" size="sm">FULL</Tag>}

                      {ev.status==="live"&&<Tag color="#F87171" size="sm">● LIVE</Tag>}

                      {ev.status==="complete"&&<Tag color="#BECBD9" size="sm">DONE</Tag>}

                    </div>

                    <div style={{fontSize:12,color:"#C8D4E0"}}>{ev.players?ev.players.length:0}/{ev.cap}p · {ev.rounds}R · {ev.format}</div>

                    <div style={{fontSize:11,color:"#9AAABF",marginTop:2}}>Created {ev.createdAt}</div>

                  </div>

                  <div style={{display:"flex",flexDirection:"column",gap:6}}>

                    {(ev.status==="open"||ev.status==="full")&&<Btn s="sm" v="success" onClick={()=>{setQuickClashes&&setQuickClashes(function(qs){return qs.map(function(q){return q.id===ev.id?Object.assign({},q,{status:"live",startedAt:new Date().toLocaleTimeString()}):q;});});addAudit("ACTION","Quick Clash started: "+ev.name);toast(ev.name+" is LIVE!","success");}}>Start</Btn>}

                    {ev.status==="live"&&<Btn s="sm" v="dark" onClick={()=>{setQuickClashes&&setQuickClashes(function(qs){return qs.map(function(q){return q.id===ev.id?Object.assign({},q,{status:"complete"}):q;});});addAudit("RESULT","Quick Clash complete: "+ev.name);toast(ev.name+" complete","success");}}>End</Btn>}

                    {ev.status==="complete"&&<Btn s="sm" v="danger" onClick={()=>{setQuickClashes&&setQuickClashes(function(qs){return qs.filter(function(q){return q.id!==ev.id;});});addAudit("ACTION","Quick Clash removed: "+ev.name);}}>Remove</Btn>}

                  </div>

                </div>

              </Panel>

            );})}

          </div>

        </div>

      )}



      {/* ── SCHEDULE ── */}

      {tab==="schedule"&&(

        <div className="grid-2" style={{alignItems:"start"}}>

          <Panel accent style={{padding:"20px"}}>

            <div style={{marginTop:6}}>

              <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:16}}>Schedule New Event</div>

              <div style={{display:"grid",gap:12,marginBottom:14}}>

                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Event Name</label><Inp value={newEvent.name} onChange={v=>setNewEvent(e=>({...e,name:v}))} placeholder="Clash #15"/></div>

                <div className="grid-2">

                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Type</label><Sel value={newEvent.type} onChange={v=>setNewEvent(e=>({...e,type:v}))}>{["SCHEDULED","FLASH","INVITATIONAL","WEEKLY"].map(t=><option key={t}>{t}</option>)}</Sel></div>

                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Format</label><Sel value={newEvent.format} onChange={v=>setNewEvent(e=>({...e,format:v}))}>{["Swiss","Single Lobby","Round Robin","Finals Only"].map(f=><option key={f}>{f}</option>)}</Sel></div>

                </div>

                <div className="grid-2">

                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label><Inp type="date" value={newEvent.date} onChange={v=>setNewEvent(e=>({...e,date:v}))}/></div>

                  <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Time</label><Inp type="time" value={newEvent.time} onChange={v=>setNewEvent(e=>({...e,time:v}))}/></div>

                </div>

                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Player Cap</label><Sel value={newEvent.cap} onChange={v=>setNewEvent(e=>({...e,cap:v}))}>{[8,16,24,32,48,64].map(n=><option key={n} value={n}>{n} players</option>)}</Sel></div>

              </div>

              <Btn v="primary" full onClick={()=>{if(!newEvent.name||!newEvent.date){toast("Name and date required","error");return;}setScheduledEvents(es=>[...es,{...newEvent,id:Date.now(),status:"upcoming",cap:parseInt(newEvent.cap)||8}]);addAudit("ACTION","Scheduled: "+newEvent.name);setNewEvent({name:"",type:"SCHEDULED",date:"",time:"",cap:"8",format:"Swiss",notes:""});toast("Event scheduled","success");}}>Schedule Event</Btn>

            </div>

          </Panel>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            <div style={{fontSize:11,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:2}}>{scheduledEvents.length} Upcoming</div>

            {scheduledEvents.length===0&&<Panel style={{padding:"36px",textAlign:"center"}}><div style={{color:"#9AAABF",fontSize:14}}>No events scheduled yet</div></Panel>}

            {scheduledEvents.map(ev=>(

              <Panel key={ev.id} style={{padding:"16px"}}>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>

                  <div>

                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>

                      <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{ev.name}</span>

                      <Tag color={EVENT_COLS[ev.type]||"#E8A838"} size="sm">{ev.type}</Tag>

                    </div>

                    <div style={{fontSize:12,color:"#C8D4E0"}}>{ev.date}{ev.time?" · "+ev.time:""}</div>

                    <div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>{ev.format} · {ev.cap} players</div>

                  </div>

                  <Btn s="sm" v="danger" onClick={()=>{setScheduledEvents(es=>es.filter(e=>e.id!==ev.id));addAudit("ACTION","Cancelled: "+ev.name);}}>Cancel</Btn>

                </div>

              </Panel>

            ))}

          </div>

        </div>

      )}



      {/* ── SEASON ── */}

      {tab==="season"&&(

        <div className="grid-2">

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Season Config</div>

            <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Season Name</label>

            <Inp value={seasonName} onChange={setSeasonName} placeholder="e.g. Season 1" style={{marginBottom:14}}/>

            <Btn v="primary" s="sm" onClick={()=>{addAudit("ACTION","Season renamed: "+seasonName);toast("Season name saved","success");}}>Save Name</Btn>

            <Divider label="Stats"/>

            <div className="grid-2" style={{marginTop:8}}>

              {[["Players",players.length],["Total Pts",players.reduce((s,p)=>s+p.pts,0)],["Games",players.reduce((s,p)=>s+(p.games||0),0)],["Clashes",PAST_CLASHES.length+1]].map(([l,v])=>(

                <div key={l} className="inner-box" style={{padding:"12px",textAlign:"center"}}>

                  <div className="mono" style={{fontSize:20,fontWeight:700,color:"#E8A838"}}>{v}</div>

                  <div style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:3,letterSpacing:".04em"}}>{l}</div>

                </div>

              ))}

            </div>

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Health Rules</div>

            <div style={{display:"grid",gap:16}}>

              <div>

                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:4,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Drop Weeks</label>

                <div style={{fontSize:11,color:"#9AAABF",marginBottom:6}}>Player's worst N weeks excluded from season score.</div>

                <Sel value={String(seasonConfig?seasonConfig.dropWeeks||0:0)} onChange={v=>setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{dropWeeks:parseInt(v)});})}>

                  <option value="0">Off (0)</option>

                  <option value="1">Drop 1 week</option>

                  <option value="2">Drop 2 weeks</option>

                </Sel>

              </div>

              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>

                <input type="checkbox" id="cb-comeback" checked={seasonConfig?!!seasonConfig.comebackBonus:false} onChange={function(e){setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{comebackBonus:e.target.checked});});}} style={{width:16,height:16,accentColor:"#9B72CF",marginTop:2,flexShrink:0}}/>

                <label htmlFor="cb-comeback" style={{fontSize:12,color:"#C8D4E0",cursor:"pointer",lineHeight:1.5}}>

                  <div style={{fontWeight:700,marginBottom:1}}>Comeback Bonus</div>

                  <div style={{color:"#9AAABF",fontSize:11}}>+2 pts for players returning after 2+ missed clashes</div>

                </label>

              </div>

              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>

                <input type="checkbox" id="cb-attendance" checked={seasonConfig?!!seasonConfig.attendanceBonus:false} onChange={function(e){setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{attendanceBonus:e.target.checked});});}} style={{width:16,height:16,accentColor:"#E8A838",marginTop:2,flexShrink:0}}/>

                <label htmlFor="cb-attendance" style={{fontSize:12,color:"#C8D4E0",cursor:"pointer",lineHeight:1.5}}>

                  <div style={{fontWeight:700,marginBottom:1}}>Attendance Streak Bonus</div>

                  <div style={{color:"#9AAABF",fontSize:11}}>+3 at 3 consecutive, +5 at 5 consecutive clashes</div>

                </label>

              </div>

              <div>

                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Finale Multiplier</label>

                <Sel value={String(seasonConfig?seasonConfig.finalBoost||1.0:1.0)} onChange={v=>setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{finalBoost:parseFloat(v)});})}>

                  <option value="1">Off (1x)</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option>

                </Sel>

              </div>

              <div>

                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Finale Clashes (last N boosted)</label>

                <Sel value={String(seasonConfig?seasonConfig.finaleClashes||2:2)} onChange={v=>setSeasonConfig&&setSeasonConfig(function(c){return Object.assign({},c,{finaleClashes:parseInt(v)});})}>

                  <option value="1">Last 1</option><option value="2">Last 2</option><option value="3">Last 3</option>

                </Sel>

              </div>

              <Btn v="primary" s="sm" onClick={()=>{addAudit("ACTION","Season health rules updated");toast("Health rules saved","success");}}>Save Rules</Btn>

            </div>

          </Panel>

          <Panel danger style={{padding:"20px",border:"1px solid rgba(248,113,113,.25)",gridColumn:"1/-1"}}>

            <div style={{marginTop:6}}>

              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>

                <span style={{fontSize:18}}>⚠</span>

                <div style={{fontWeight:700,fontSize:14,color:"#F87171"}}>Danger Zone</div>

              </div>

              <div style={{fontSize:12,color:"#C8D4E0",marginBottom:16,lineHeight:1.5}}>These actions are permanent and cannot be undone. All are logged to Audit.</div>

              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>

                <Btn v="danger" onClick={()=>{if(window.confirm("Reset ALL player stats? Points, wins, and games will be zeroed. This syncs to the database.")){setPlayers(ps=>ps.map(p=>({...p,pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,clashHistory:[],sparkline:[],attendanceStreak:0,lastClashId:null})));if(supabase.from){supabase.from('game_results').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear game_results:",r.error);});}addAudit("DANGER","Stats reset");toast("All stats reset and synced","success");}}}>Reset Season Stats</Btn>

                <Btn v="danger" onClick={()=>{if(window.confirm("Remove ALL players from the roster? This syncs to the database.")){setPlayers([]);if(supabase.from){supabase.from('players').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear players table:",r.error);});}addAudit("DANGER","Players cleared");toast("All players removed","success");}}}>Clear All Players</Btn>

                <Btn v="danger" onClick={()=>{if(window.confirm("Full season reset? Clears ALL players, stats, history, events, featured events, and tournament state. This is a complete wipe. Syncs to database.")){setPlayers([]);setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[]});setScheduledEvents([]);setFeaturedEvents([]);if(supabase.from){supabase.from('players').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear players table:",r.error);});supabase.from('game_results').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear game_results:",r.error);});}setAuditLog([{ts:Date.now(),type:"DANGER",msg:"Full season reset — all players, stats, events, and featured events cleared"}]);toast("Full season reset complete","success");}}}>Full Season Reset</Btn>

              </div>

            </div>

          </Panel>

        </div>

      )}



      {/* ── BROADCAST ── */}

      {tab==="broadcast"&&(

        <div className="grid-2">

          <Panel accent style={{padding:"20px"}}>

            <div style={{marginTop:6}}>

              <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:16}}>Send Broadcast</div>

              <div style={{marginBottom:12}}>

                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Type</label>

                <Sel value={broadType} onChange={setBroadType}>{["NOTICE","ALERT","UPDATE","RESULT","INFO"].map(t=><option key={t}>{t}</option>)}</Sel>

              </div>

              <div style={{marginBottom:16}}>

                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Message</label>

                <Inp value={broadMsg} onChange={setBroadMsg} placeholder="e.g. Clash starts in 10 min — check in now!"/>

              </div>

              <Btn v="primary" full onClick={()=>{if(!broadMsg.trim())return;var cleanMsg=sanitize(broadMsg.trim());const a={id:Date.now(),type:broadType,msg:cleanMsg,ts:Date.now()};setAnnouncements(as=>[a,...as]);setAnnouncement(cleanMsg);if(supabase.from)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(cleanMsg),updated_at:new Date().toISOString()}).then(function(res){if(res.error)console.error("[TFT] Broadcast save failed:",res.error);});addAudit("BROADCAST","["+broadType+"] "+cleanMsg);setBroadMsg("");toast("Broadcast sent","success");}}>Send Broadcast</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Active Announcements</div>

            {announcements.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:"#9AAABF",fontSize:13}}>No active announcements</div>}

            {announcements.map(a=>(

              <div key={a.id} className="ann-item" style={{marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>

                <div style={{flex:1,minWidth:0}}>

                  <Tag color="#E8A838" size="sm">{a.type}</Tag>

                  <div style={{fontSize:13,color:"#C8BFB0",marginTop:7,lineHeight:1.4}}>{a.msg}</div>

                </div>

                <button onClick={()=>{setAnnouncements(as=>as.filter(x=>x.id!==a.id));setAnnouncement("");if(supabase.from)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(''),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});}} style={{background:"none",border:"none",color:"#9AAABF",cursor:"pointer",fontSize:22,lineHeight:1,flexShrink:0,padding:"0 4px"}}>×</button>

              </div>

            ))}

          </Panel>

        </div>

      )}



      {/* ── HOSTS ── */}

      {tab==="hosts"&&(

        <div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:8}}>

            <div>

              <div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:2}}>Host Applications</div>

              <div style={{fontSize:12,color:"#BECBD9"}}>{hostApps.filter(a=>a.status==="pending").length} pending · {hostApps.filter(a=>a.status==="approved").length} approved</div>

            </div>

            <button onClick={()=>setScreen("featured")} style={{background:"rgba(155,114,207,.14)",border:"1px solid rgba(155,114,207,.35)",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,color:"#C4B5FD",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>🏆 Featured Events</button>

          </div>

          {hostApps.length===0&&<Panel style={{padding:"40px",textAlign:"center"}}><div style={{color:"#9AAABF",fontSize:14}}>No host applications yet.</div></Panel>}

          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {hostApps.map(app=>(

              <Panel key={app.id} style={{padding:"18px",border:"1px solid "+(app.status==="pending"?"rgba(232,168,56,.2)":app.status==="approved"?"rgba(82,196,124,.18)":"rgba(248,113,113,.15)")}}>

                <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>

                  <div style={{flex:1,minWidth:0}}>

                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>

                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{app.name}</span>

                      {app.org&&<Tag color="#9B72CF" size="sm">{app.org}</Tag>}

                      <Tag color={app.status==="pending"?"#E8A838":app.status==="approved"?"#6EE7B7":"#F87171"} size="sm">{app.status==="pending"?"⏳ Pending":app.status==="approved"?"✓ Approved":"✗ Rejected"}</Tag>

                    </div>

                    <div style={{fontSize:12,color:"#BECBD9",marginBottom:10}}>{app.email} · {app.freq} · Applied {app.submittedAt}</div>

                    <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.65,padding:"10px 14px",background:"rgba(255,255,255,.02)",borderRadius:8,border:"1px solid rgba(242,237,228,.06)"}}>{app.reason}</div>

                  </div>

                  {app.status==="pending"&&(

                    <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>

                      <Btn v="success" s="sm" onClick={()=>{setHostApps(apps=>apps.map(a=>a.id===app.id?{...a,status:"approved",approvedAt:new Date().toLocaleDateString()}:a));setNotifications(ns=>[{id:Date.now(),icon:"🎮",title:"Host Application Approved",body:app.name+" has been approved as a Host. They can now access the Host Dashboard.",time:new Date().toLocaleTimeString(),read:false},...ns]);addAudit("ACTION","Host approved: "+app.name);toast(app.name+" approved as host","success");}}>Approve</Btn>

                      <Btn v="danger" s="sm" onClick={()=>{setHostApps(apps=>apps.map(a=>a.id===app.id?{...a,status:"rejected"}:a));addAudit("WARN","Host rejected: "+app.name);toast(app.name+" rejected","success");}}>Reject</Btn>

                    </div>

                  )}

                </div>

              </Panel>

            ))}

          </div>

        </div>

      )}



      {/* ── SPONSORSHIPS ── */}

      {tab==="sponsorships"&&(

        <div>

          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>

            {Object.entries(orgSponsors||{}).map(([pid,s])=>{

              const p=players.find(pl=>pl.id===parseInt(pid));

              return(

                <Panel key={pid} style={{padding:"16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>

                  <div style={{width:44,height:44,background:s.color+"18",border:"1px solid "+s.color+"44",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15,color:s.color,flexShrink:0}}>{s.logo}</div>

                  <div style={{flex:1,minWidth:0}}>

                    <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:3}}>{s.org}</div>

                    <div style={{fontSize:12,color:"#BECBD9"}}>Sponsoring <span style={{color:s.color,fontWeight:700}}>{p?.name||"Player #"+pid}</span></div>

                  </div>

                  <div style={{display:"flex",gap:8,alignItems:"center"}}>


                    <Btn v="danger" s="sm" onClick={()=>{setOrgSponsors&&setOrgSponsors(function(s){var n=Object.assign({},s);delete n[pid];return n;});addAudit("ACTION","Sponsor removed: "+s.org);toast(s.org+" removed","success");}}>Remove</Btn>

                  </div>

                </Panel>

              );

            })}

          </div>

          <Panel style={{padding:"20px",border:"1px solid rgba(155,114,207,.2)"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#C4B5FD",marginBottom:14}}>Add New Sponsorship</div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Org Name</div><Inp value={spForm.name} onChange={v=>setSpForm(f=>Object.assign({},f,{name:v}))} placeholder="e.g. ProGuides"/></div>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Logo Text</div><Inp value={spForm.logo} onChange={v=>setSpForm(f=>Object.assign({},f,{logo:v}))} placeholder="e.g. PG"/></div>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Accent Colour</div><Inp value={spForm.color} onChange={v=>setSpForm(f=>Object.assign({},f,{color:v}))} placeholder="#4ECDC4"/></div>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Assign to Player</div><Sel value={spForm.playerId} onChange={v=>setSpForm(f=>Object.assign({},f,{playerId:v}))}><option value="">— Select Player —</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Sel></div>

            </div>

            <Btn v="primary" onClick={()=>{if(!spForm.name.trim()||!spForm.playerId){toast("Org name and player required","error");return;}setOrgSponsors&&setOrgSponsors(function(s){var n=Object.assign({},s);n[spForm.playerId]={org:spForm.name.trim(),logo:spForm.logo.trim()||spForm.name.trim().slice(0,2).toUpperCase(),color:spForm.color.trim()||"#9B72CF"};return n;});addAudit("ACTION","Sponsor added: "+spForm.name.trim());toast(spForm.name.trim()+" sponsorship added","success");setSpForm({name:"",logo:"",color:"",playerId:""});}}>Add Sponsorship</Btn>

          </Panel>

        </div>

      )}



      {/* ── AUDIT ── */}

      {tab==="audit"&&(

        <Panel style={{overflow:"hidden"}}>

          <div style={{padding:"12px 16px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Audit Log</div>

            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>

              {["All","ACTION","DANGER","BROADCAST","WARN","INFO","RESULT"].map(function(ft){return(

                <button key={ft} onClick={function(){setAuditFilter(ft);}} style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:auditFilter===ft?"rgba(155,114,207,.2)":"rgba(255,255,255,.04)",border:"1px solid "+(auditFilter===ft?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),color:auditFilter===ft?"#C4B5FD":"#9AAABF",transition:"all .12s"}}>{ft}</button>

              );

              })}

              <span className="mono" style={{fontSize:11,color:"#BECBD9",marginLeft:4}}>{(auditFilter==="All"?auditLog:auditLog.filter(function(l){return l.type===auditFilter;})).length} entries</span>

            </div>

          </div>

          {auditLog.length===0&&<div style={{padding:"36px",textAlign:"center",color:"#9AAABF",fontSize:13}}>No audit entries yet.</div>}

          <div style={{maxHeight:540,overflowY:"auto"}}>

            {(auditFilter==="All"?auditLog:auditLog.filter(function(l){return l.type===auditFilter;})).map(function(l,i){

              var bc=l.type==="DANGER"?"#F87171":l.type==="BROADCAST"?"#9B72CF":l.type==="WARN"?"#E8A838":l.type==="INFO"?"#4ECDC4":"rgba(242,237,228,.08)";

              return(

                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",borderLeft:"3px solid "+bc}}>

                  <Tag color={AUDIT_COLS[l.type]||"#E8A838"} size="sm">{l.type}</Tag>

                  <span style={{flex:1,fontSize:13,color:"#C8BFB0"}}>{l.msg}</span>

                  <span className="mono" style={{fontSize:10,color:"#9AAABF",whiteSpace:"nowrap",flexShrink:0}}>{new Date(l.ts).toLocaleString()}</span>

                </div>

              );

            })}

          </div>

        </Panel>

      )}

      {tab==="friends"&&(

        <ScrimAccessPanel scrimAccess={scrimAccess} setScrimAccess={setScrimAccess} toast={toast} addAudit={addAudit}/>

      )}

      {tab==="ticker"&&(

        <TickerAdminPanel tickerOverrides={tickerOverrides} setTickerOverrides={setTickerOverrides} toast={toast} addAudit={addAudit}/>

      )}



      {/* ── SETTINGS ── */}

      {tab==="settings"&&(

        <div className="grid-2">

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:16}}>Role Permissions</div>

            {[

              {r:"Admin",d:"Full access to all tabs and actions",c:"#E8A838",perms:"All tabs"},

              {r:"Mod",d:"Disputes, check-in, score corrections",c:"#9B72CF",perms:"Dashboard, Players, Scores, Broadcast"},

              {r:"Host",d:"Runs lobbies during a clash",c:"#4ECDC4",perms:"Scrims Lab, bracket view"},

              {r:"Player",d:"Self-service account only",c:"#BECBD9",perms:"Profile, Standings, Results"},

            ].map(function(item){return(

              <div key={item.r} style={{padding:"14px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.06)",borderRadius:9,marginBottom:10}}>

                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>

                  <Tag color={item.c}>{item.r}</Tag>

                  <span style={{fontSize:13,color:"#F2EDE4",fontWeight:600}}>{item.d}</span>

                </div>

                <div style={{fontSize:11,color:"#7A8BA0"}}>{item.perms}</div>

              </div>

            );})}

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:16}}>Admin Quickstart</div>

            {[

              ["Before a clash","Set Clash Name + Date in Round → Clash Details. Open Check-in when ready. Seeding mode defaults to Rank-Based."],

              ["Starting the clash","Round → Open Check-in → Start Tournament. The bracket screen updates live for all players."],

              ["During a clash","Use Force Advance between rounds. Pause if there’s a technical issue. Reseed if lobbies need reshuffling."],

              ["After a clash","Post a Broadcast with results. Check Audit for any disputes. Season stats update automatically."],

              ["Player issues","Players tab: DNP = no-show (2 auto-DQ). Ban blocks re-registration. Add Notes for dispute history."],

              ["Score disputes","Scores tab: override individual point totals. Changes are tagged DANGER in the Audit log."],

            ].map(function(item){return(

              <div key={item[0]} style={{padding:"12px 0",borderBottom:"1px solid rgba(242,237,228,.06)"}}>

                <div style={{fontSize:13,fontWeight:700,color:"#C4B5FD",marginBottom:3}}>{item[0]}</div>

                <div style={{fontSize:12,color:"#9AAABF",lineHeight:1.55}}>{item[1]}</div>

              </div>

            );})}

          </Panel>

        </div>

      )}



      {tab==="featured"&&(function(){
        var evts=featuredEvents||[];
        var feAddName=null;var feAddHost=null;var feAddDate=null;var feAddStatus=null;var feAddFormat=null;var feAddSize=null;
        return(
        <div>
          <Panel style={{padding:"20px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Featured Events ({evts.length})</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {evts.map(function(ev,idx){return(
                <div key={ev.id||idx} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(242,237,228,.06)",borderRadius:8}}>
                  <div style={{fontSize:18,flexShrink:0}}>{ev.logo||"🏆"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#BECBD9"}}>{ev.host} · {ev.date} · <span style={{color:ev.status==="live"?"#52C47C":ev.status==="upcoming"?"#E8A838":"#9AAABF",fontWeight:700,textTransform:"uppercase"}}>{ev.status}</span></div>
                  </div>
                  <button onClick={function(){if(setFeaturedEvents)setFeaturedEvents(evts.filter(function(e){return e.id!==ev.id;}));toast("Event removed","success");}} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.25)",borderRadius:6,padding:"5px 10px",fontSize:11,fontWeight:700,color:"#F87171",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Remove</button>
                </div>
              );})}
              {evts.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:"#8896A8",fontSize:13}}>No featured events. Add one below.</div>}
            </div>
          </Panel>

          <Panel style={{padding:"20px"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Add Featured Event</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,fontWeight:600}}>Event Name</div>
                <input ref={function(el){feAddName=el;}} placeholder="Tournament name..." style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 10px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,fontWeight:600}}>Host</div>
                <input ref={function(el){feAddHost=el;}} placeholder="Host org..." style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 10px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,fontWeight:600}}>Date</div>
                <input ref={function(el){feAddDate=el;}} placeholder="Mar 22 2026" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 10px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,fontWeight:600}}>Status</div>
                <select ref={function(el){feAddStatus=el;}} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 10px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box"}}>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,fontWeight:600}}>Format</div>
                <input ref={function(el){feAddFormat=el;}} defaultValue="Swiss" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 10px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#BECBD9",marginBottom:4,fontWeight:600}}>Size</div>
                <input ref={function(el){feAddSize=el;}} type="number" defaultValue="16" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 10px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
            <Btn v="primary" s="sm" onClick={function(){
              var nm=feAddName&&feAddName.value;var ho=feAddHost&&feAddHost.value;var dt=feAddDate&&feAddDate.value;
              if(!nm||!ho){toast("Name and host required","error");return;}
              var newEv={id:"fe-"+Date.now(),name:nm,host:ho,date:dt||"TBD",status:(feAddStatus&&feAddStatus.value)||"upcoming",format:(feAddFormat&&feAddFormat.value)||"Swiss",size:parseInt((feAddSize&&feAddSize.value)||"16")||16,registered:0,logo:"🏆",tags:[],description:""};
              if(setFeaturedEvents)setFeaturedEvents(evts.concat([newEv]));
              if(feAddName)feAddName.value="";if(feAddHost)feAddHost.value="";if(feAddDate)feAddDate.value="";
              toast("Event added","success");
            }}>Add Event</Btn>
          </Panel>
        </div>
        );
      })()}

    </div>

  );

}





// ─── SCRIMS SCREEN ────────────────────────────────────────────────────────────

function ScrimSparkline({placements,w,h}){
  if(!placements||placements.length<2)return null;
  var last=placements.slice(-12);
  var pts=last.map(function(v,i){
    var x=(i/(last.length-1))*(w||60);
    var y=((v-1)/7)*(h||18)+1;
    return x+","+y;
  }).join(" ");
  var topPt=last.map(function(v,i){return {x:(i/(last.length-1))*(w||60),y:((v-1)/7)*(h||18)+1,v:v};}).reduce(function(a,b){return a.y<b.y?a:b;});
  return(
    <svg width={w||60} height={(h||20)+2} style={{display:"block",overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke="#9B72CF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7"/>
      <circle cx={topPt.x} cy={topPt.y} r="2" fill="#E8A838"/>
    </svg>
  );
}

function ScrimsScreen({players,toast,setScreen,sessions,setSessions,isAdmin,scrimAccess,setScrimAccess,tickerOverrides,setTickerOverrides,setNotifications}){

  var [tab,setTab]=useState("dashboard");

  var [activeId,setActiveId]=useState(null);

  var [newName,setNewName]=useState("");

  var [newNotes,setNewNotes]=useState("");

  var [newTarget,setNewTarget]=useState("5");

  var [scrimRoster,setScrimRoster]=useState([]);

  var [customName,setCustomName]=useState("");

  var [scrimResults,setScrimResults]=useState({});

  var [gameNote,setGameNote]=useState("");

  var [gameTag,setGameTag]=useState("standard");

  var [timer,setTimer]=useState(0);

  var [timerActive,setTimerActive]=useState(false);

  var [confirmDelete,setConfirmDelete]=useState(null);

  var timerRef=useRef(null);



  useEffect(function(){

    if(timerActive){timerRef.current=setInterval(function(){setTimer(function(t){return t+1;});},1000);}

    else clearInterval(timerRef.current);

    return function(){clearInterval(timerRef.current);};

  },[timerActive]);



  var fmt=function(s){return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");};

  var safeSessions=sessions||[];

  var session=safeSessions.find(function(s){return s.id===activeId;});

  var allGames=safeSessions.flatMap(function(s){return s.games;});

  var allPlayers=[...players,...scrimRoster.filter(function(r){return !players.find(function(p){return p.id===r.id;});})];



  // ── Per-player stats ──────────────────────────────────────────────────────────

  var scrimStats=allPlayers.map(function(p){

    var pGames=allGames.filter(function(g){return g.results[p.id]!=null;});

    if(pGames.length===0)return null;

    var placements=pGames.map(function(g){return g.results[p.id];});

    var wins=placements.filter(function(x){return x===1;}).length;

    var top4=placements.filter(function(x){return x<=4;}).length;

    var avgPlacement=(placements.reduce(function(s,v){return s+v;},0)/placements.length).toFixed(2);

    var pts=placements.reduce(function(s,v){return s+(PTS[v]||0);},0);

    var best=Math.min.apply(null,placements);

    var worst=Math.max.apply(null,placements);

    var recent=[...pGames].sort(function(a,b){return b.ts-a.ts;}).map(function(g){return g.results[p.id];});

    var streak=0;

    for(var si=0;si<recent.length;si++){if(recent[si]<=4)streak++;else break;}

    var mean=placements.reduce(function(s,v){return s+v;},0)/placements.length;

    var variance=placements.reduce(function(s,v){return s+Math.pow(v-mean,2);},0)/placements.length;

    var eighths=placements.filter(function(x){return x===8;}).length;

    return Object.assign({},p,{pts:pts,wins:wins,top4:top4,games:pGames.length,avg:avgPlacement,best:best,worst:worst,streak:streak,placements:placements,variance:variance,eighths:eighths,
      top4Rate:((top4/pGames.length)*100).toFixed(0),
      winRate:((wins/pGames.length)*100).toFixed(0)});

  }).filter(Boolean).sort(function(a,b){return parseFloat(a.avg)-parseFloat(b.avg);});



  // ── H2H matrix ──────────────────────────────────────────────────────────────────

  var h2hData={};

  if(scrimStats.length>=2){

    allGames.forEach(function(g){

      var ids=Object.keys(g.results);

      for(var ii=0;ii<ids.length;ii++){

        for(var jj=ii+1;jj<ids.length;jj++){

          var a=ids[ii],b=ids[jj];

          var pa=g.results[a],pb=g.results[b];

          if(!h2hData[a])h2hData[a]={};

          if(!h2hData[b])h2hData[b]={};

          if(!h2hData[a][b])h2hData[a][b]={wins:0,total:0};

          if(!h2hData[b][a])h2hData[b][a]={wins:0,total:0};

          h2hData[a][b].total++;

          h2hData[b][a].total++;

          if(pa<pb)h2hData[a][b].wins++;

          else if(pb<pa)h2hData[b][a].wins++;

        }

      }

    });

  }



  // ── Awards ───────────────────────────────────────────────────────────────────────

  var awards=[];

  if(scrimStats.length>0){

    var ironButt=scrimStats.slice().sort(function(a,b){return b.eighths-a.eighths;})[0];

    if(ironButt&&ironButt.eighths>0)awards.push({icon:"🪑",title:"Iron Butt",desc:"Most 8th places",player:ironButt.name,val:ironButt.eighths+"x 8th"});

    var consistent=scrimStats.filter(function(p){return p.games>=3;}).slice().sort(function(a,b){return a.variance-b.variance;})[0];

    if(consistent)awards.push({icon:"🎯",title:"Consistent King",desc:"Lowest placement variance",player:consistent.name,val:"σ²="+consistent.variance.toFixed(1)});

    var streakKing=scrimStats.slice().sort(function(a,b){return b.streak-a.streak;})[0];

    if(streakKing&&streakKing.streak>=2)awards.push({icon:"🔥",title:"Streak Lord",desc:"Current top-4 streak",player:streakKing.name,val:streakKing.streak+" games"});

    var winKing=scrimStats.slice().sort(function(a,b){return b.wins-a.wins;})[0];

    if(winKing&&winKing.wins>0)awards.push({icon:"👑",title:"Clutch Player",desc:"Most first place finishes",player:winKing.name,val:winKing.wins+"x 1st"});

    var glassCannon=scrimStats.filter(function(p){return p.games>=3&&p.wins>0&&p.eighths>0;}).slice().sort(function(a,b){return b.variance-a.variance;})[0];

    if(glassCannon)awards.push({icon:"💥",title:"Glass Cannon",desc:"Highest highs and lowest lows",player:glassCannon.name,val:"±"+glassCannon.variance.toFixed(1)});

  }



  function createSession(){

    if(!newName.trim()){toast("Name required","error");return;}

    var s={id:Date.now(),name:newName.trim(),notes:newNotes.trim(),

      targetGames:parseInt(newTarget)||5,games:[],createdAt:new Date().toLocaleDateString(),active:true};

    setSessions(function(ss){return [...(ss||[]),s];});

    setActiveId(s.id);

    setNewName("");setNewNotes("");setNewTarget("5");

    toast("Session created - go to Play tab to record games","success");

    setTab("play");

  }



  function addPlayer(){

    if(!customName.trim())return;

    var fromRoster=players.find(function(p){return p.name.toLowerCase()===customName.toLowerCase();});

    if(scrimRoster.find(function(p){return p.name.toLowerCase()===customName.toLowerCase();})){toast("Already added","error");return;}

    var np=fromRoster||{id:"c"+Date.now(),name:customName.trim(),rank:"Gold",pts:0,games:0,wins:0,top4:0,avg:"0"};

    setScrimRoster(function(r){return [...r,np];});

    setCustomName("");

  }



  function lockGame(){

    if(!activeId){toast("Select or create a session first","error");return;}

    if(Object.keys(scrimResults).length<scrimRoster.length){toast("All placements required","error");return;}

    var game={id:Date.now(),results:Object.assign({},scrimResults),note:gameNote,tag:gameTag,duration:timer,ts:Date.now()};

    setSessions(function(ss){return (ss||[]).map(function(s){return s.id===activeId?Object.assign({},s,{games:[...s.games,game]}):s;});});

    setScrimResults({});setGameNote("");setTimer(0);setTimerActive(false);

    toast("Game locked ✓","success");

  }



  function stopSession(id){

    setSessions(function(ss){return (ss||[]).map(function(s){return s.id===id?Object.assign({},s,{active:false}):s;});});

    toast("Session ended - results saved","success");

  }

  function deleteGame(sessionId,gameId){

    setSessions(function(ss){return (ss||[]).map(function(s){return s.id===sessionId?Object.assign({},s,{games:s.games.filter(function(g){return g.id!==gameId;})}):s;});});

    setConfirmDelete(null);

    toast("Game deleted","success");

  }

  function deleteSession(sessionId){

    setSessions(function(ss){return (ss||[]).filter(function(s){return s.id!==sessionId;});});

    if(activeId===sessionId)setActiveId(null);

    setConfirmDelete(null);

    toast("Session deleted","success");

  }



  var TABS=[["dashboard","🏆 Dashboard"],["play","📋 Play"],["stats","📊 Stats"],["history","🕐 History"],["sessions","⚙ Sessions"]];



  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>&#8592; Back</Btn>

      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>

        <div>

          <h2 style={{color:"#F2EDE4",fontSize:20,marginBottom:4}}>The Lab</h2>

          <div style={{display:"flex",gap:6,alignItems:"center"}}>

            <Tag color="#9B72CF">Friends Only</Tag>

            <span style={{fontSize:12,color:"#BECBD9"}}>{allGames.length} games &middot; {safeSessions.length} sessions</span>

          </div>

        </div>

        <div className="lab-tabs" style={{display:"flex",gap:6,flexWrap:"wrap"}}>

          {TABS.map(function(pair){

            return <Btn key={pair[0]} v={tab===pair[0]?"purple":"dark"} s="sm" onClick={function(){setTab(pair[0]);}}>{pair[1]}</Btn>;

          })}

        </div>

      </div>



      {/* ── DASHBOARD TAB ── */}

      {tab==="dashboard"&&(

        <div>

          {allGames.length===0?(

            <div style={{textAlign:"center",padding:60,color:"#9AAABF"}}>

              <div style={{fontSize:36,marginBottom:12}}>&#127918;</div>

              <div style={{fontSize:15,fontWeight:700,color:"#F2EDE4",marginBottom:8}}>The Lab is empty</div>

              <div style={{fontSize:13,marginBottom:20}}>Create a session and start logging games to see your crew's stats.</div>

              <Btn v="purple" onClick={function(){setTab("sessions");}}>Create First Session &#8594;</Btn>

            </div>

          ):(

            <div>

              <div className="grid-4" style={{marginBottom:20}}>

                {[

                  {label:"Games Logged",val:allGames.length,c:"#C4B5FD"},

                  {label:"Sessions",val:safeSessions.length,c:"#E8A838"},

                  {label:"Players",val:scrimStats.length,c:"#4ECDC4"},

                  {label:"Top Player",val:scrimStats.length>0?scrimStats[0].name:"-",c:"#6EE7B7"},

                ].map(function(item){

                  return(

                    <div key={item.label} className="inner-box" style={{padding:"14px 12px",textAlign:"center"}}>

                      <div className="mono" style={{fontSize:item.label==="Top Player"?14:22,fontWeight:700,color:item.c,lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.val}</div>

                      <div className="cond" style={{fontSize:9,fontWeight:700,color:"#C8D4E0",marginTop:4,letterSpacing:".04em",textTransform:"uppercase"}}>{item.label}</div>

                    </div>

                  );

                })}

              </div>

              <div className="lab-dash-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20,alignItems:"start"}}>

                <div>

                  <div style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Standings</div>

                  <div style={{background:"#0A0F1A",borderRadius:12,overflow:"hidden",border:"1px solid rgba(242,237,228,.07)"}}>

                    {scrimStats.map(function(p,i){

                      var avgC=parseFloat(p.avg)<3?"#4ade80":parseFloat(p.avg)<=5?"#facc15":"#f87171";

                      return(

                        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<scrimStats.length-1?"1px solid rgba(242,237,228,.04)":"none"}}>

                          <div className="mono" style={{fontSize:12,fontWeight:800,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF",width:18,textAlign:"center",flexShrink:0}}>{i+1}</div>

                          <div style={{flex:1,minWidth:0}}>

                            <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>

                            <div style={{fontSize:10,color:"#9AAABF"}}>{p.games}g &middot; avg {p.avg}{p.streak>=3?" 🔥"+p.streak:""}</div>

                          </div>

                          <ScrimSparkline placements={p.placements} w={60} h={20}/>

                          <div className="mono" style={{fontSize:14,fontWeight:700,color:avgC,width:32,textAlign:"right",flexShrink:0}}>{p.avg}</div>

                        </div>

                      );

                    })}

                  </div>

                </div>

                <div>

                  <div style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Awards</div>

                  {awards.length===0?(

                    <Panel style={{padding:"20px",textAlign:"center",color:"#9AAABF",fontSize:13}}>Log 3+ games per player to unlock awards.</Panel>

                  ):(

                    <div style={{display:"flex",flexDirection:"column",gap:8}}>

                      {awards.map(function(a){

                        return(

                          <Panel key={a.title} style={{padding:"12px 14px"}}>

                            <div style={{display:"flex",alignItems:"center",gap:10}}>

                              <div style={{fontSize:22,flexShrink:0}}>{a.icon}</div>

                              <div style={{flex:1,minWidth:0}}>

                                <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4"}}>{a.title}</div>

                                <div style={{fontSize:11,color:"#9AAABF"}}>{a.desc}</div>

                              </div>

                              <div style={{textAlign:"right",flexShrink:0}}>

                                <div style={{fontSize:13,fontWeight:700,color:"#C4B5FD"}}>{a.player}</div>

                                <div className="mono" style={{fontSize:10,color:"#BECBD9"}}>{a.val}</div>

                              </div>

                            </div>

                          </Panel>

                        );

                      })}

                    </div>

                  )}

                </div>

              </div>

              {scrimStats.length>=3&&(

                <div style={{marginBottom:20}}>

                  <div style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Head to Head</div>

                  <Panel style={{padding:"4px"}}>

                    <div style={{overflowX:"auto"}}>

                      <table style={{borderCollapse:"collapse",width:"100%",minWidth:300}}>

                        <thead>

                          <tr>

                            <th style={{padding:"8px 12px",fontSize:10,color:"#9AAABF",textAlign:"left",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",borderBottom:"1px solid rgba(242,237,228,.07)",whiteSpace:"nowrap"}}>&darr; vs &rarr;</th>

                            {scrimStats.map(function(p){

                              return <th key={p.id} style={{padding:"8px 10px",fontSize:11,color:"#C8BFB0",fontWeight:700,borderBottom:"1px solid rgba(242,237,228,.07)",whiteSpace:"nowrap",textAlign:"center"}}>{p.name}</th>;

                            })}

                          </tr>

                        </thead>

                        <tbody>

                          {scrimStats.map(function(rowP){

                            return(

                              <tr key={rowP.id}>

                                <td style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#C8BFB0",borderBottom:"1px solid rgba(242,237,228,.04)",whiteSpace:"nowrap"}}>{rowP.name}</td>

                                {scrimStats.map(function(colP){

                                  if(String(rowP.id)===String(colP.id))return <td key={colP.id} style={{background:"rgba(255,255,255,.03)",padding:"8px 10px",textAlign:"center",borderBottom:"1px solid rgba(242,237,228,.04)",color:"#7A8BA0",fontSize:12}}>&#8212;</td>;

                                  var rowKey=String(rowP.id),colKey=String(colP.id);

                                  var rec=h2hData[rowKey]&&h2hData[rowKey][colKey];

                                  if(!rec||rec.total===0)return <td key={colP.id} style={{padding:"8px 10px",textAlign:"center",color:"#9AAABF",fontSize:11,borderBottom:"1px solid rgba(242,237,228,.04)"}}>-</td>;

                                  var wr=rec.wins/rec.total;

                                  var bg=wr>=0.6?"rgba(155,114,207,.18)":wr<=0.4?"rgba(248,113,113,.1)":"rgba(255,255,255,.03)";

                                  var col=wr>=0.6?"#C4B5FD":wr<=0.4?"#F87171":"#9AAABF";

                                  return(

                                    <td key={colP.id} style={{padding:"8px 10px",textAlign:"center",background:bg,borderBottom:"1px solid rgba(242,237,228,.04)"}}>

                                      <span className="mono" style={{fontSize:12,fontWeight:700,color:col}}>{rec.wins}-{rec.total-rec.wins}</span>

                                    </td>

                                  );

                                })}

                              </tr>

                            );

                          })}

                        </tbody>

                      </table>

                    </div>

                  </Panel>

                </div>

              )}

            </div>

          )}

        </div>

      )}



      {/* ── PLAY TAB ── */}

      {tab==="play"&&(

        <div className="lab-play-grid" style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,alignItems:"start"}}>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            <Panel style={{padding:"14px 16px",background:"#0A0F1A",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>

              <div style={{flex:1}}>

                <div style={{fontSize:11,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Active Session</div>

                <Sel value={activeId||""} onChange={function(v){setActiveId(parseInt(v)||null);}} style={{width:"100%"}}>

                  <option value="">- Select session -</option>

                  {safeSessions.map(function(s){return <option key={s.id} value={s.id}>{s.name} ({s.games.length}/{s.targetGames}){s.active?"":" · Ended"}</option>;})}

                </Sel>

              </div>

              {session&&<Tag color={session.active?"#52C47C":"#BECBD9"} size="sm">{session.active?"Active":"Ended"}</Tag>}

              {session&&session.active&&<Btn v="danger" s="sm" onClick={function(){stopSession(session.id);}}>End Session</Btn>}

            </Panel>

            <Panel style={{padding:"16px"}}>

              <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:10}}>Lobby Roster</div>

              <div style={{display:"flex",gap:8,marginBottom:10}}>

                <Inp value={customName} onChange={setCustomName} placeholder="Add player by name" onKeyDown={function(e){if(e.key==="Enter")addPlayer();}} style={{flex:1}}/>

                <Btn v="purple" onClick={addPlayer}>Add</Btn>

              </div>

              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>

                {players.map(function(p){

                  return(

                    <Btn key={p.id} v={scrimRoster.find(function(r){return r.id===p.id;})?"purple":"dark"} s="sm"

                      onClick={function(){if(!scrimRoster.find(function(r){return r.id===p.id;}))setScrimRoster(function(r){return [...r,p];});}}>

                      {p.name}

                    </Btn>

                  );

                })}

              </div>

              {scrimRoster.length>0&&(

                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>

                  {scrimRoster.map(function(p){

                    return(

                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",

                        background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.3)",borderRadius:7}}>

                        <span style={{fontSize:12,fontWeight:600,color:"#C4B5FD"}}>{p.name}</span>

                        <button onClick={function(){setScrimRoster(function(r){return r.filter(function(x){return x.id!==p.id;});});}}

                          style={{background:"none",border:"none",color:"#BECBD9",cursor:"pointer",fontSize:15,lineHeight:1,padding:0}}>&#215;</button>

                      </div>

                    );

                  })}

                </div>

              )}

            </Panel>

            {scrimRoster.length>=2&&(

              <Panel style={{padding:"18px"}}>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>

                  <div style={{fontSize:14,fontWeight:700,color:"#F2EDE4"}}>

                    Game {session?session.games.length+1:1}{session?" / "+session.targetGames:""}

                  </div>

                  <div style={{display:"flex",alignItems:"center",gap:8}}>

                    <div className="mono" style={{fontSize:18,fontWeight:700,color:timerActive?"#E8A838":"#9AAABF",minWidth:54}}>{fmt(timer)}</div>

                    <Btn v="dark" s="sm" onClick={function(){setTimerActive(function(t){return !t;});}}>{timerActive?"&#9646;":"&#9654;"}</Btn>

                    <Btn v="dark" s="sm" onClick={function(){setTimer(0);setTimerActive(false);}}>&#8635;</Btn>

                  </div>

                </div>

                <div className="grid-2" style={{marginBottom:14,gap:10}}>

                  <div>

                    <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Tag</div>

                    <Sel value={gameTag} onChange={setGameTag}>

                      {["standard","draft comp","test run","ranked sim","meta test"].map(function(t){return <option key={t} value={t}>{t}</option>;})}

                    </Sel>

                  </div>

                  <div>

                    <div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Note</div>

                    <Inp value={gameNote} onChange={setGameNote} placeholder="comp, pivot, notes..."/>

                  </div>

                </div>

                <PlacementBoard roster={scrimRoster} results={scrimResults} onPlace={function(pid,place){setScrimResults(function(r){return Object.assign({},r,{[pid]:place});});}} locked={false}/>

                <div style={{marginTop:14}}>

                  <Btn v="purple" full disabled={Object.keys(scrimResults).length<scrimRoster.length} onClick={lockGame} s="lg">

                    Lock Game {Object.keys(scrimResults).length}/{scrimRoster.length} placed

                  </Btn>

                </div>

              </Panel>

            )}

          </div>

          <div>

            <div style={{fontSize:12,fontWeight:700,color:"#BECBD9",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Recent Games</div>

            {allGames.length===0&&(

              <Panel style={{padding:"24px",textAlign:"center"}}>

                <div style={{fontSize:24,marginBottom:8}}>&#127918;</div>

                <div style={{fontSize:13,color:"#9AAABF"}}>No games logged yet. Record a game to see it here.</div>

              </Panel>

            )}

            {[...allGames].reverse().slice(0,8).map(function(g,gi){

              var sessionName=(safeSessions.find(function(s){return s.games.find(function(sg){return sg.id===g.id;});})||{}).name||"";

              var sorted=Object.entries(g.results).sort(function(a,b){return a[1]-b[1];});

              return(

                <Panel key={g.id} style={{padding:"10px 12px",marginBottom:6}}>

                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>

                    <div style={{display:"flex",gap:6,alignItems:"center"}}>

                      <span className="cond mono" style={{fontSize:11,fontWeight:800,color:"#9B72CF"}}>G{allGames.length-gi}</span>

                      {g.tag!=="standard"&&<Tag color="#4ECDC4" size="sm">{g.tag}</Tag>}

                      {g.duration>0&&<span className="mono" style={{fontSize:9,color:"#9AAABF"}}>{fmt(g.duration)}</span>}

                    </div>

                    <span style={{fontSize:10,color:"#9AAABF"}}>{sessionName}</span>

                  </div>

                  {g.note&&<div style={{fontSize:10,color:"#BECBD9",marginBottom:6,fontStyle:"italic"}}>"{g.note}"</div>}

                  <div style={{display:"flex",flexDirection:"column",gap:3}}>

                    {sorted.map(function(entry){

                      var pid=entry[0],place=entry[1];

                      var p=allPlayers.find(function(pl){return String(pl.id)===String(pid);});

                      if(!p)return null;

                      var c=place===1?"#E8A838":place===2?"#C0C0C0":place===3?"#CD7F32":place<=4?"#4ECDC4":"#F87171";

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



      {/* ── STATS TAB ── */}

      {tab==="stats"&&(

        <div>

          {scrimStats.length===0?(

            <div style={{textAlign:"center",padding:60,color:"#9AAABF",fontSize:14}}>Log some games first to see stats.</div>

          ):(

            <div>

              <div className="grid-4" style={{marginBottom:20}}>

                {[

                  {label:"Games Logged",val:allGames.length,c:"#C4B5FD"},

                  {label:"Sessions",val:safeSessions.length,c:"#E8A838"},

                  {label:"Players Tracked",val:scrimStats.length,c:"#4ECDC4"},

                  {label:"Avg Game Time",val:allGames.length>0?fmt(Math.round(allGames.reduce(function(s,g){return s+g.duration;},0)/allGames.length)):"-",c:"#6EE7B7"},

                ].map(function(item){

                  return(

                    <div key={item.label} className="inner-box" style={{padding:"14px 12px",textAlign:"center"}}>

                      <div className="mono" style={{fontSize:22,fontWeight:700,color:item.c,lineHeight:1}}>{item.val}</div>

                      <div className="cond" style={{fontSize:9,fontWeight:700,color:"#C8D4E0",marginTop:4,letterSpacing:".04em",textTransform:"uppercase"}}>{item.label}</div>

                    </div>

                  );

                })}

              </div>

              <div style={{background:"#0A0F1A",borderRadius:12,overflow:"hidden",border:"1px solid rgba(242,237,228,.07)"}}>

                <div style={{display:"grid",gridTemplateColumns:"28px 1fr 52px 48px 48px 48px 48px 48px",gap:"0 8px",alignItems:"center",padding:"8px 14px",borderBottom:"1px solid rgba(242,237,228,.07)"}}>

                  <div/>

                  <div style={{fontSize:10,fontWeight:700,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".08em"}}>Player</div>

                  {["AVG","WIN%","TOP4","BEST","WRST","PTS"].map(function(h){

                    return <div key={h} style={{fontSize:9,fontWeight:700,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".06em",textAlign:"center"}}>{h}</div>;

                  })}

                </div>

                {scrimStats.map(function(p,i){

                  var avgC=parseFloat(p.avg)<3?"#4ade80":parseFloat(p.avg)<=5?"#facc15":"#f87171";

                  var isFirst=i===0;

                  return(

                    <div key={p.id} style={{borderBottom:i<scrimStats.length-1?"1px solid rgba(242,237,228,.04)":"none",

                      background:isFirst?"rgba(232,168,56,.04)":"transparent"}}>

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

                      <div style={{display:"flex",gap:3,alignItems:"center",padding:"0 14px 8px",flexWrap:"wrap"}}>

                        {p.placements.map(function(pl,pi){

                          var c=pl===1?"#E8A838":pl===2?"#C0C0C0":pl===3?"#CD7F32":pl<=4?"#4ECDC4":"#F87171";

                          return <div key={pi} style={{width:18,height:18,borderRadius:4,background:c+"22",border:"1px solid "+c+"55",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>

                            <span className="mono" style={{fontSize:9,fontWeight:700,color:c}}>{pl}</span>

                          </div>;

                        })}

                      </div>

                    </div>

                  );

                })}

              </div>

            </div>

          )}

        </div>

      )}



      {/* ── HISTORY TAB ── */}

      {tab==="history"&&(

        <div>

          {allGames.length===0?(

            <div style={{textAlign:"center",padding:60,color:"#9AAABF",fontSize:14}}>No games logged yet.</div>

          ):(

            <div>

              {safeSessions.map(function(sess){

                if(sess.games.length===0)return null;

                return(

                  <div key={sess.id} style={{marginBottom:32}}>

                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>

                      <h3 style={{fontSize:16,color:"#F2EDE4"}}>{sess.name}</h3>

                      <Tag color={sess.active?"#52C47C":"#BECBD9"} size="sm">{sess.active?"Active":"Ended"}</Tag>

                      <span style={{fontSize:12,color:"#BECBD9"}}>{sess.games.length} games &middot; {sess.createdAt}</span>

                      {sess.notes&&<span style={{fontSize:12,color:"#9AAABF"}}>- {sess.notes}</span>}

                    </div>

                    <Panel style={{overflow:"hidden",marginBottom:12}}>

                      <div style={{overflowX:"auto"}}>

                        <table style={{width:"100%",borderCollapse:"collapse",minWidth:420}}>

                          <thead>

                            <tr style={{background:"#0A0F1A"}}>

                              <th style={{padding:"9px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)",whiteSpace:"nowrap"}}>Player</th>

                              {sess.games.map(function(g,gi){

                                return(

                                  <th key={g.id} style={{padding:"9px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)",whiteSpace:"nowrap"}}>

                                    G{gi+1}

                                    {g.tag!=="standard"&&<div style={{fontSize:8,color:"#4ECDC4",fontWeight:400,textTransform:"none",letterSpacing:0}}>{g.tag}</div>}

                                  </th>

                                );

                              })}

                              <th style={{padding:"9px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:"#E8A838",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)"}}>Avg</th>

                              <th style={{padding:"9px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:"#6EE7B7",letterSpacing:".1em",textTransform:"uppercase",borderBottom:"1px solid rgba(242,237,228,.07)"}}>Pts</th>

                            </tr>

                          </thead>

                          <tbody>

                            {sess.games.flatMap(function(g){return Object.keys(g.results);}).filter(function(pid,idx,arr){return arr.indexOf(pid)===idx;}).map(function(pid,pidIdx){

                              var p=allPlayers.find(function(pl){return String(pl.id)===String(pid);});

                              if(!p)return null;

                              var placements=sess.games.map(function(g){return g.results[pid];});

                              var validPl=placements.filter(function(v){return v!=null;});

                              var avg=validPl.length>0?(validPl.reduce(function(s,v){return s+v;},0)/validPl.length).toFixed(2):"-";

                              var pts=validPl.reduce(function(s,v){return s+(PTS[v]||0);},0);

                              return(

                                <tr key={p.id} style={{background:pidIdx%2===0?"rgba(255,255,255,.01)":"transparent",borderBottom:"1px solid rgba(242,237,228,.04)"}}>

                                  <td style={{padding:"10px 14px"}}>

                                    <div style={{display:"flex",alignItems:"center",gap:8}}>

                                      <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>{p.name}</span>

                                    </div>

                                  </td>

                                  {placements.map(function(place,pi){

                                    var c=place==null?"#7A8BA0":place===1?"#E8A838":place===2?"#C0C0C0":place===3?"#CD7F32":place<=4?"#4ECDC4":"#F87171";

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

                          <tfoot>

                            <tr style={{background:"#0A0F1A",borderTop:"1px solid rgba(242,237,228,.06)"}}>

                              <td style={{padding:"7px 14px",fontSize:10,color:"#9AAABF",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Notes</td>

                              {sess.games.map(function(g){

                                return(

                                  <td key={g.id} style={{padding:"7px 6px",textAlign:"center",fontSize:10,color:"#4ECDC4",maxWidth:60}}>

                                    {g.note||"-"}

                                  </td>

                                );

                              })}

                              <td/><td/>

                            </tr>

                          </tfoot>

                        </table>

                      </div>

                    </Panel>

                  </div>

                );

              })}

            </div>

          )}

        </div>

      )}



      {/* ── SESSIONS TAB ── */}

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

                  {[1,2,3,4,5,6,7,8,10,12].map(function(n){return <option key={n} value={n}>{n} games</option>;})}

                </Sel>

              </div>

            </div>

            <Btn v="purple" full onClick={createSession}>Create Session &#8594;</Btn>

          </Panel>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {safeSessions.map(function(s){

              return(

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

                      <Btn v="purple" s="sm" onClick={function(){setActiveId(s.id);setTab("play");}}>Open</Btn>

                      {s.active&&<Btn v="danger" s="sm" onClick={function(){stopSession(s.id);}}>End</Btn>}

                    </div>

                  </div>

                  <Bar val={s.games.length} max={s.targetGames} color="#9B72CF" h={3}/>

                </Panel>

              );

            })}

          </div>

        </div>

      )}

    </div>

  );

}



// ─── PRICING SCREEN ───────────────────────────────────────────────────────────

function PricingScreen({currentPlan,toast,currentUser,setScreen}){

  /* Pricing is under construction — Stripe integration being reworked */

  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

      </div>

      <div style={{textAlign:"center",padding:"80px 20px",maxWidth:560,margin:"0 auto"}}>

        <div style={{width:80,height:80,margin:"0 auto 24px",background:"rgba(232,168,56,.08)",border:"2px solid rgba(232,168,56,.25)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>
          🔧
        </div>

        <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".22em",textTransform:"uppercase",marginBottom:16}}>Under Construction</div>

        <h1 style={{fontSize:"clamp(24px,4vw,40px)",fontWeight:900,color:"#F2EDE4",lineHeight:1.15,marginBottom:16}}>

          Pricing is being rebuilt

        </h1>

        <p style={{fontSize:15,color:"#C8D4E0",lineHeight:1.7,marginBottom:12}}>

          We're reworking our payment system to give you a better experience. The tiers you know and love — Player, Pro, and Host — are staying, but the checkout flow is getting an upgrade.

        </p>

        <p style={{fontSize:14,color:"#BECBD9",lineHeight:1.7,marginBottom:32}}>

          Competing in TFT Clash will always be free. Pro and Host subscriptions will be back soon.

        </p>

        <div style={{display:"inline-flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>

          <Btn v="primary" onClick={()=>setScreen("home")}>Back to Home</Btn>

          <Btn v="ghost" onClick={()=>setScreen("faq")}>Read the FAQ</Btn>

        </div>

        <div style={{marginTop:48,padding:"20px 24px",background:"rgba(155,114,207,.05)",border:"1px solid rgba(155,114,207,.2)",borderRadius:12}}>

          <div style={{fontSize:13,color:"#9B72CF",fontWeight:700,marginBottom:6}}>Quick reminder</div>

          <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.6}}>
            Free tier: Compete in every weekly clash, full leaderboard, profile, achievements, H2H rivalries.
            <br/>Pro: Guaranteed check-in, deeper stats, season recap cards, pro badge.
            <br/>Host: Run your own branded clash events on the platform.
          </div>

        </div>

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







function getDailyReset(){
  var now=new Date();
  var utcMidnight=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1,0,0,0));
  var diff=utcMidnight-now;
  var h=Math.floor(diff/3600000);
  var m=Math.floor((diff%3600000)/60000);
  return h+"h "+m+"m";
}

function getWeeklyReset(){
  var now=new Date();
  var dayOfWeek=now.getUTCDay();
  var daysUntilMonday=dayOfWeek===0?1:(8-dayOfWeek);
  var nextMonday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+daysUntilMonday,0,0,0));
  var diff=nextMonday-now;
  var d=Math.floor(diff/86400000);
  var h=Math.floor((diff%86400000)/3600000);
  return d+"d "+h+"h";
}

function ChallengesScreen({currentUser,players,toast,setScreen,challengeCompletions}){

  const [tab,setTab]=useState("active");

  var dailyReset=getDailyReset();

  var weeklyReset=getWeeklyReset();



  // Find user's player if linked

  const linked=players.find(function(p){return p.name===(currentUser&&currentUser.username);});

  // Compute real challenge progress from player stats
  var playerWins=linked?(linked.wins||0):0;
  var playerTop4=linked?(linked.top4||0):0;
  var playerGames=linked?(linked.games||0):0;
  var completions=challengeCompletions||{};

  var dailyChallenges=DAILY_CHALLENGES.map(function(c){
    var prog=c.progress;
    if(linked){
      if(c.id==="d1")prog=Math.min(c.goal,playerWins>0?1:0);
      if(c.id==="d2")prog=Math.min(c.goal,playerGames>0?1:0);
      if(c.id==="d3")prog=Math.min(c.goal,playerTop4>0?1:0);
    }
    if(completions[c.id])prog=c.goal;
    return Object.assign({},c,{progress:prog});
  });

  var weeklyChallenges=WEEKLY_CHALLENGES.map(function(c){
    var prog=c.progress;
    if(linked){
      if(c.id==="w1")prog=Math.min(c.goal,playerWins);
      if(c.id==="w2")prog=Math.min(c.goal,playerTop4);
      if(c.id==="w3")prog=Math.min(c.goal,playerTop4>0?1:0);
    }
    if(completions[c.id])prog=c.goal;
    return Object.assign({},c,{progress:prog});
  });

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

            {dailyChallenges.map(function(c){return(

              <div key={c.id} className="task-card">

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

            );})}

          </div>



          {/* Weekly */}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>

            <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase"}}>Weekly Challenges</div>

            <div style={{fontSize:11,color:"#BECBD9"}}>Resets in <span style={{color:"#9B72CF",fontWeight:700}}>{weeklyReset}</span></div>

          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {weeklyChallenges.map(function(c){

              const done=c.progress>=c.goal;

              return(

                <div key={c.id} className={done?"weekly-card":"weekly-card"} style={{background:done?"rgba(82,196,124,.05)":undefined,border:done?"1px solid rgba(82,196,124,.3)":undefined}}>

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



      {tab==="completed"&&(function(){
        var done=dailyChallenges.concat(weeklyChallenges).filter(function(c){return c.progress>=c.goal;});
        return(
        <div style={{textAlign:"center",padding:"48px 20px",color:"#BECBD9"}}>
          <div style={{fontSize:36,marginBottom:12}}>🎖️</div>
          <div style={{fontSize:15,fontWeight:600,color:"#F2EDE4",marginBottom:6}}>{done.length} challenge{done.length!==1?"s":""} completed</div>
          {done.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:16,textAlign:"left",maxWidth:360,margin:"16px auto 0"}}>
            {done.map(function(c){return(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(82,196,124,.06)",border:"1px solid rgba(82,196,124,.2)",borderRadius:8}}>
                <span style={{fontSize:16}}>{c.icon}</span>
                <span style={{flex:1,fontSize:13,color:"#6EE7B7",fontWeight:600}}>{c.name}</span>
                <span className="mono" style={{fontSize:12,color:"#52C47C"}}>+{c.xp} XP</span>
              </div>
            );})}
          </div>}
          {done.length===0&&<div style={{fontSize:13}}>Keep playing to unlock more</div>}
        </div>
        );
      })()}



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

function isValidRiotId(id) {
  // Format: Name#TAG where Name is 3-16 chars, TAG is 3-5 alphanumeric chars
  return /^.{3,16}#[A-Za-z0-9]{3,5}$/.test((id||'').trim());
}

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

  const [riotIdErr,setRiotIdErr]=useState("");

  const [emailErr,setEmailErr]=useState("");

  const [usernameErr,setUsernameErr]=useState("");

  const [pwErr,setPwErr]=useState("");

  const [pw2Err,setPw2Err]=useState("");



  function nextStep(){

    var ok=true;

    setEmailErr("");setUsernameErr("");setPwErr("");setPw2Err("");

    if(!email.trim()){setEmailErr("Email required");ok=false;}

    if(!username.trim()){setUsernameErr("Username required");ok=false;}

    if(!pw.trim()||pw.length<6){setPwErr(!pw.trim()?"Password required":"Must be 6+ characters");ok=false;}

    if(pw!==pw2){setPw2Err("Passwords don't match");ok=false;}

    if(!ok)return;

    setStep(2);

  }



  async function submit(){

    if(!riotId.trim()){toast("Riot ID required","error");return;}

    if(!isValidRiotId(riotId)){setRiotIdErr("Format: Name#TAG (e.g. Levitate#EUW)");return;}

    setRiotIdErr("");

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

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:28,fontWeight:900,color:"#E8A838",letterSpacing:"-.01em"}}>TFT Clash</div>

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

                <div style={{fontSize:12,fontWeight:600,color:emailErr?"#F87171":"#C8D4E0",marginBottom:6}}>Email</div>

                <Inp value={email} onChange={v=>{setEmail(v);if(emailErr)setEmailErr("");}} placeholder="you@email.com" type="email" style={emailErr?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

                {emailErr&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{emailErr}</div>}

              </div>

              <div>

                <div style={{fontSize:12,fontWeight:600,color:usernameErr?"#F87171":"#C8D4E0",marginBottom:6}}>Username</div>

                <Inp value={username} onChange={v=>{setUsername(v);if(usernameErr)setUsernameErr("");}} placeholder="Your display name" style={usernameErr?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

                {usernameErr&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{usernameErr}</div>}

              </div>

              <div>

                <div style={{fontSize:12,fontWeight:600,color:pwErr?"#F87171":"#C8D4E0",marginBottom:6}}>Password</div>

                <Inp value={pw} onChange={v=>{setPw(v);if(pwErr)setPwErr("");}} placeholder="6+ characters" type="password" style={pwErr?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

                {pwErr&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{pwErr}</div>}

              </div>

              <div>

                <div style={{fontSize:12,fontWeight:600,color:pw2Err?"#F87171":"#C8D4E0",marginBottom:6}}>Confirm Password</div>

                <Inp value={pw2} onChange={v=>{setPw2(v);if(pw2Err)setPw2Err("");}} placeholder="Repeat password" type="password" onKeyDown={e=>e.key==="Enter"&&nextStep()} style={pw2Err?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

                {pw2Err&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{pw2Err}</div>}

              </div>

              <Btn v="primary" full onClick={nextStep} style={{marginTop:4}}>Continue →</Btn>

            </div>

          )}



          {step===2&&(

            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              <div>

                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Riot ID <span style={{color:"#F87171"}}>*</span></div>

                <Inp value={riotId} onChange={v=>{setRiotId(v);if(riotIdErr)setRiotIdErr("");}} placeholder="Name#TAG"/>

                {riotIdErr&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{riotIdErr}</div>}

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

  const [loginEmailErr,setLoginEmailErr]=useState("");

  const [loginPwErr,setLoginPwErr]=useState("");



  async function submit(){

    var ok=true;

    setLoginEmailErr("");setLoginPwErr("");

    if(!email.trim()){setLoginEmailErr("Email required");ok=false;}

    if(!pw.trim()){setLoginPwErr("Password required");ok=false;}

    if(!ok)return;

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

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:28,fontWeight:900,color:"#E8A838"}}>TFT Clash</div>

          <div style={{fontSize:13,color:"#BECBD9",marginTop:4}}>Sign in to your account</div>

        </div>



        <Panel style={{padding:"28px 24px"}}>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            <div>

              <div style={{fontSize:12,fontWeight:600,color:loginEmailErr?"#F87171":"#C8D4E0",marginBottom:6}}>Email</div>

              <Inp value={email} onChange={v=>{setEmail(v);if(loginEmailErr)setLoginEmailErr("");}} placeholder="you@email.com" type="email" style={loginEmailErr?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

              {loginEmailErr&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{loginEmailErr}</div>}

            </div>

            <div>

              <div style={{fontSize:12,fontWeight:600,color:loginPwErr?"#F87171":"#C8D4E0",marginBottom:6}}>Password</div>

              <Inp value={pw} onChange={v=>{setPw(v);if(loginPwErr)setLoginPwErr("");}} placeholder="Your password" type="password" onKeyDown={e=>e.key==="Enter"&&submit()} style={loginPwErr?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

              {loginPwErr&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{loginPwErr}</div>}

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



function AccountScreen({user,onUpdate,onLogout,toast,setScreen,players,setProfilePlayer,isAdmin,hostApps}){

  const [tab,setTab]=useState("profile");

  const [edit,setEdit]=useState(false);

  const [bio,setBio]=useState(user.bio||"");

  const [twitch,setTwitch]=useState(user.twitch||"");

  const [twitter,setTwitter]=useState(user.twitter||"");

  const [youtube,setYoutube]=useState(user.youtube||"");

  const [usernameEdit,setUsernameEdit]=useState(user.username||"");

  const [profilePic,setProfilePic]=useState(user.user_metadata?.profilePic||user.profilePic||"");
  const [bannerUrl,setBannerUrl]=useState(user.user_metadata?.bannerUrl||user.bannerUrl||"");
  const [profileAccent,setProfileAccent]=useState(user.user_metadata?.profileAccent||user.profileAccent||"");

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

      profilePic,bannerUrl,profileAccent,

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

    }catch(e){console.warn("Supabase update failed",e);toast("Failed to save profile — please try again","error");return;}

    onUpdate({...user,...meta,username:meta.username||user.username,user_metadata:meta,region:riotRegion,mainRegion:riotRegion,secondRiotId,secondRegion,profilePic,bannerUrl,profileAccent});

    setEdit(false);

    toast("Profile updated","success");

  }



  async function requestChange(field){

    const pending=(user.user_metadata?.pending_changes||[]).concat([{field,requestedAt:new Date().toISOString()}]);

    try{await supabase.auth.updateUser({data:{...(user.user_metadata||{}),pending_changes:pending}});}catch{}

    toast("Change request submitted — an admin will review it","success");

  }



  const [subscription,setSubscription]=useState(null);

  useEffect(function(){
    if(!user?.id)return;
    supabase.from('subscriptions').select('plan,status').eq('user_id',user.id).single()
      .then(function(res){if(res.data?.status==='active')setSubscription(res.data);});
  },[user]);

  const isPro=!!(subscription&&(subscription.plan==="pro"||subscription.plan==="host"));
  const rankColor=linkedPlayer?rc(linkedPlayer.rank):"#9B72CF";

  const myMilestones=linkedPlayer?MILESTONES.filter(m=>{try{return m.check(linkedPlayer);}catch{return false;}}):[];



  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1}}>My Account</h2>

        <Btn v="dark" s="sm" onClick={onLogout}>Sign Out</Btn>

      </div>



      {/* Hero card - Twitter-style profile */}

      <div style={{position:"relative",borderRadius:16,marginBottom:20,overflow:"hidden",border:"1px solid rgba(242,237,228,.12)"}}>

        {/* Banner */}
        <div style={{height:bannerUrl?140:90,background:bannerUrl?"url("+bannerUrl+") center/cover no-repeat":"linear-gradient(135deg,"+(profileAccent||rankColor)+"33,#08080F 80%)",position:"relative"}}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%,#08080F)"}}/>
        </div>

        <div style={{padding:"0 24px 24px",marginTop:-44}}>

        <div style={{display:"flex",gap:20,alignItems:"flex-end",flexWrap:"wrap"}}>

          {/* Avatar */}

          <div style={{position:"relative",flexShrink:0}}>

            <div style={{width:88,height:88,borderRadius:"50%",

              background:profilePic?"url("+profilePic+") center/cover no-repeat":"linear-gradient(135deg,"+rankColor+"44,"+rankColor+"11)",

              border:"4px solid #08080F",boxShadow:"0 0 0 2px "+(profileAccent||rankColor)+"66",

              display:"flex",alignItems:"center",justifyContent:"center",

              fontSize:profilePic?0:34,fontWeight:800,color:rankColor}}>

              {!profilePic&&user.username.charAt(0).toUpperCase()}

            </div>

            {isPro&&(
              <div style={{position:"absolute",top:-2,right:-2,width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,#E8A838,#C8882A)",border:"2px solid #08080F",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:900}}>{"\u2605"}</div>
            )}

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

              {isPro&&<span style={{background:"linear-gradient(90deg,#E8A838,#C8882A)",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:800,color:"#08080F",letterSpacing:".04em"}}>{"PRO"}</span>}

              {linkedPlayer&&<ClashRankBadge rank={linkedPlayer.rank}/>}

              {linkedPlayer&&isHotStreak(linkedPlayer)&&<span style={{fontSize:14}}>🔥</span>}

            </div>

            {linkedPlayer&&(

              <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>{linkedPlayer.riotId} · {linkedPlayer.region}</div>

            )}

            <div style={{marginBottom:10,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              {subscription?(
                <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",borderRadius:20,background:subscription.plan==="host"?"rgba(232,168,56,.15)":"rgba(155,114,207,.15)",border:"1px solid "+(subscription.plan==="host"?"rgba(232,168,56,.4)":"rgba(155,114,207,.4)"),fontSize:12,fontWeight:700,color:subscription.plan==="host"?"#E8A838":"#C4B5FD"}}>
                  {subscription.plan==="host"?"🏠 Host Plan":"⚡ Pro Plan"} · Active
                </div>
              ):(
                <button onClick={()=>setScreen("pricing")} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:"transparent",border:"1px solid rgba(155,114,207,.35)",fontSize:12,color:"#9B72CF",cursor:"pointer",fontFamily:"inherit"}}>
                  Upgrade to Pro →
                </button>
              )}
              {(isAdmin||(hostApps||[]).some(function(a){return a.status==="approved"&&(a.name===user.username||a.email===user.email);}))&&(
                <button onClick={()=>setScreen("host-dashboard")} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:"rgba(232,168,56,.12)",border:"1px solid rgba(232,168,56,.4)",fontSize:12,fontWeight:700,color:"#E8A838",cursor:"pointer",fontFamily:"inherit"}}>
                  🎮 Host Dashboard →
                </button>
              )}
            </div>

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

                  ["Profile Picture",profilePic?"Custom avatar set":"Not set (default initial)",profilePic?"#6EE7B7":"#9AAABF"],

                  ["Banner",bannerUrl?"Custom banner set":"Not set (rank gradient)",bannerUrl?"#6EE7B7":"#9AAABF"],

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

                {/* Appearance - Pro only */}

                <div style={{borderTop:"1px solid rgba(242,237,228,.08)",paddingTop:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#F2EDE4"}}>{"Appearance"}</div>
                    {isPro?<span style={{background:"linear-gradient(90deg,#E8A838,#C8882A)",borderRadius:20,padding:"2px 8px",fontSize:9,fontWeight:800,color:"#08080F"}}>{"PRO"}</span>:<span style={{fontSize:11,color:"#9AAABF"}}>{"(Pro feature)"}</span>}
                  </div>

                  {isPro?(
                    <div style={{display:"grid",gap:14}}>
                      <div>
                        <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>{"Profile Picture URL"}</div>
                        <Inp value={profilePic} onChange={setProfilePic} placeholder="https://i.imgur.com/your-pic.png"/>
                        <div style={{fontSize:10,color:"#9AAABF",marginTop:3}}>{"Paste a direct image link (imgur, Discord CDN, etc). Square images work best."}</div>
                        {profilePic&&<div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}><div style={{width:48,height:48,borderRadius:"50%",background:"url("+profilePic+") center/cover",border:"2px solid "+rankColor+"44"}}/>{"Preview"&&<span style={{fontSize:11,color:"#6EE7B7"}}>{"Preview"}</span>}</div>}
                      </div>
                      <div>
                        <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>{"Banner Image URL"}</div>
                        <Inp value={bannerUrl} onChange={setBannerUrl} placeholder="https://i.imgur.com/your-banner.png"/>
                        <div style={{fontSize:10,color:"#9AAABF",marginTop:3}}>{"Recommended: 1500x500 or similar wide aspect ratio."}</div>
                        {bannerUrl&&<div style={{marginTop:8,height:60,borderRadius:8,background:"url("+bannerUrl+") center/cover",border:"1px solid rgba(242,237,228,.1)"}}/>}
                      </div>
                      <div>
                        <div style={{fontSize:12,color:"#BECBD9",marginBottom:8}}>{"Profile Accent Color"}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {["","#9B72CF","#E8A838","#4ECDC4","#F87171","#6EE7B7","#60A5FA","#FB923C","#EC4899","#8B5CF6"].map(function(clr){
                            var isActive=profileAccent===clr;
                            return(
                              <div key={clr||"default"} onClick={function(){setProfileAccent(clr);}}
                                style={{width:28,height:28,borderRadius:"50%",background:clr||"linear-gradient(135deg,"+rankColor+"44,"+rankColor+"11)",cursor:"pointer",border:isActive?"3px solid #fff":"3px solid transparent",transition:"border .15s",position:"relative"}}>
                                {!clr&&<span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#BECBD9"}}>{"Auto"}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ):(
                    <div style={{background:"rgba(232,168,56,.04)",border:"1px dashed rgba(232,168,56,.25)",borderRadius:10,padding:"16px",textAlign:"center"}}>
                      <div style={{fontSize:13,color:"#E8A838",fontWeight:600,marginBottom:6}}>{"Unlock Profile Customization"}</div>
                      <div style={{fontSize:12,color:"#BECBD9",marginBottom:12}}>{"Set a custom avatar, banner image, and accent color. Make your profile stand out."}</div>
                      <button onClick={function(){setScreen("pricing");setEdit(false);}} style={{background:"linear-gradient(90deg,#E8A838,#C8882A)",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,color:"#08080F",cursor:"pointer",fontFamily:"inherit"}}>{"Go Pro - \u20ac4.99/mo"}</button>
                    </div>
                  )}
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

                  <div key={l} className="inner-box" style={{padding:"14px 12px",textAlign:"center"}}>

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

                  background:(g.place||g.placement)===1?"rgba(232,168,56,.12)":(g.place||g.placement)<=4?"rgba(82,196,124,.08)":"rgba(255,255,255,.03)",

                  border:"1px solid "+((g.place||g.placement)===1?"rgba(232,168,56,.4)":(g.place||g.placement)<=4?"rgba(82,196,124,.25)":"rgba(242,237,228,.08)"),

                  display:"flex",alignItems:"center",justifyContent:"center",

                  fontSize:13,fontWeight:800,

                  color:(g.place||g.placement)===1?"#E8A838":(g.place||g.placement)<=4?"#6EE7B7":"#BECBD9",

                  flexShrink:0}}>#{g.place||g.placement}</div>

                <div style={{flex:1}}>

                  <div style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>

                    {(g.place||g.placement)===1?"🏆 Victory":(g.place||g.placement)<=4?"Top 4 Finish":"Outside Top 4"}

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

    const stmts=[`${player.name} dominated Season 1 with ${s.top1Rate}% win rate.`,`Consistent performer - AVP of ${s.avgPlacement} across ${s.games} games.`,`${player.name} showed up every week. ${s.wins} victories speak for themselves.`];

    const stmt=stmts[player.id%stmts.length];

    ctx.font="italic 15px serif";ctx.fillStyle="#C8D4E0";

    ctx.fillText(stmt.length>60?stmt.slice(0,60)+"...":stmt,40,800);



    // Footer

    ctx.fillStyle="rgba(232,168,56,0.1)";ctx.fillRect(0,940,800,60);

    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";

    ctx.fillText("TFTCLASH.GG",40,975);ctx.letterSpacing="0px";

    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";

    ctx.fillText("Season 1 · "+new Date().toLocaleDateString(),200,975);

    ctx.fillText("#TFTClash  #TFT  #Season1",500,975);



    const a=document.createElement("a");a.download=player.name+"-S1-Recap.png";a.href=canvas.toDataURL("image/png");a.click();

    toast("Season recap downloaded! 🎉","success");

  }



  function shareTwitter(){

    const text=`🏆 My TFT Clash Season 1 Recap\n\n📊 #${position} overall (${player.pts}pts)\n⚡ ${s.wins} wins · AVP ${s.avgPlacement}\n🔥 Best streak: ${player.bestStreak||0}\n${awards.length>0?"🎖 Awards: "+awards.map(a=>a.title).join(", ")+"\n":""}\n#TFTClash #TFT #Season1`;

    navigator.clipboard?.writeText(text).then(()=>toast("Copied for Twitter! 🐦","success"));

  }



  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("profile")}>← Back</Btn>

        <h2 style={{color:"#F2EDE4",fontSize:20,flex:1}}>Season 1 Recap</h2>

      </div>



      {/* Preview card */}

      <div style={{background:"linear-gradient(135deg,rgba(10,15,26,1),rgba(13,18,37,1),rgba(8,8,15,1))",border:"1px solid rgba(232,168,56,.3)",borderRadius:16,padding:"clamp(20px,4vw,40px)",marginBottom:24,maxWidth:700,position:"relative",overflow:"hidden"}}>

        <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>



        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>

          <div>

            <div className="cond" style={{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".22em",textTransform:"uppercase",marginBottom:6}}>TFT Clash · Season 1 Recap</div>

            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(24px,5vw,44px)",fontWeight:900,color:"#F2EDE4",lineHeight:1}}>{player.name}</div>

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

function HostApplyScreen({currentUser,toast,setScreen,setHostApps}){

  const [name,setName]=useState(currentUser?.username||"");

  const [org,setOrg]=useState("");

  const [reason,setReason]=useState("");

  const [freq,setFreq]=useState("weekly");

  const [submitted,setSubmitted]=useState(false);



  function submit(){

    if(!name.trim()||!reason.trim()){toast("Name and reason required","error");return;}

    var app={id:Date.now(),name:name.trim(),org:org.trim(),reason:reason.trim(),freq,email:currentUser?.email||"",status:"pending",submittedAt:new Date().toLocaleDateString()};
    setHostApps&&setHostApps(function(apps){return [app,...apps];});
    // Write to host_profiles DB table
    if(supabase.from&&currentUser){
      var slug=(org.trim()||name.trim()).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      supabase.from("host_profiles").insert({
        user_id:currentUser.id,
        org_name:org.trim()||name.trim(),
        slug:slug,
        bio:reason.trim(),
        status:"pending",
        social_links:{freq:freq}
      }).then(function(res){
        if(res.error)console.error("[TFT] host_profiles insert failed:",res.error);
        else dbg("[TFT] host_profiles application saved to DB");
      });
    }
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

function HostDashboardScreen({currentUser,players,toast,setScreen,hostApps,hostTournaments,setHostTournaments,hostBranding,setHostBranding,hostAnnouncements,setHostAnnouncements,featuredEvents,setFeaturedEvents}){
  var [tab,setTab]=useState("overview");
  var [showCreate,setShowCreate]=useState(false);
  var [tName,setTName]=useState("");
  var [tDate,setTDate]=useState("");
  var [tSize,setTSize]=useState("126");
  var [tInvite,setTInvite]=useState(false);
  var [tEntryFee,setTEntryFee]=useState("");
  var [tRules,setTRules]=useState("");
  var tournaments=hostTournaments||[];var setTournaments=setHostTournaments||function(){};
  var [brandName,setBrandName]=useState((hostBranding&&hostBranding.name)||(currentUser&&currentUser.username)||"My Org");
  var [brandLogo,setBrandLogo]=useState((hostBranding&&hostBranding.logo)||"🎮");
  var [brandColor,setBrandColor]=useState((hostBranding&&hostBranding.color)||"#9B72CF");

  var [brandBio,setBrandBio]=useState((hostBranding&&hostBranding.bio)||"");
  var [brandLogoUrl,setBrandLogoUrl]=useState((hostBranding&&hostBranding.logoUrl)||"");
  var [brandBannerUrl,setBrandBannerUrl]=useState((hostBranding&&hostBranding.bannerUrl)||"");
  var [uploadingLogo,setUploadingLogo]=useState(false);
  var [uploadingBanner,setUploadingBanner]=useState(false);

  // Load host profile from DB on mount
  var [dbProfileLoaded,setDbProfileLoaded]=useState(false);
  useEffect(function(){
    if(!currentUser||!supabase.from||dbProfileLoaded)return;
    supabase.from("host_profiles").select("*").eq("user_id",currentUser.id).single().then(function(res){
      if(res.data){
        var hp=res.data;
        setBrandName(hp.org_name||brandName);
        setBrandColor(hp.brand_color||brandColor);
        setBrandBio(hp.bio||"");
        if(hp.logo_url)setBrandLogoUrl(hp.logo_url);
        if(hp.banner_url)setBrandBannerUrl(hp.banner_url);
        setDbProfileLoaded(true);
      }
    });
  },[currentUser]);

  function uploadImage(file,type){
    if(!file||!supabase.storage)return;
    var setUploading=type==="logo"?setUploadingLogo:setUploadingBanner;
    var setUrl=type==="logo"?setBrandLogoUrl:setBrandBannerUrl;
    setUploading(true);
    var path="host-images/"+(currentUser?currentUser.id:"anon")+"/"+type+"-"+Date.now()+"-"+file.name;
    supabase.storage.from("host-assets").upload(path,file,{cacheControl:"3600",upsert:true}).then(function(res){
      setUploading(false);
      if(res.error){toast("Upload failed: "+res.error.message,"error");return;}
      var url=supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
      setUrl(url);
      toast((type==="logo"?"Logo":"Banner")+" uploaded!","success");
    });
  }
  var [brandSaved,setBrandSaved]=useState(false);
  var [announceMsg,setAnnounceMsg]=useState("");
  var [announceTo,setAnnounceTo]=useState("all");
  var [announcements,setAnnouncements]=useState(hostAnnouncements||[]);
  var [selectedT,setSelectedT]=useState(null);

  function createTournament(){
    if(!tName.trim()||!tDate.trim()){toast("Name and date required","error");return;}
    var newT={id:Date.now(),name:tName,date:tDate,size:parseInt(tSize),invite:tInvite,entryFee:tEntryFee,rules:tRules,status:tEntryFee?"pending_approval":"upcoming",registered:0,approved:!tEntryFee};
    setTournaments(function(ts){return ts.concat([newT]);});
    if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.concat([{id:"host-"+newT.id,name:tName,host:brandName,sponsor:null,status:"upcoming",date:tDate,time:"TBD",format:"Swiss",size:parseInt(tSize),registered:0,registeredIds:[],prizePool:null,region:"",description:tRules||"Host tournament by "+brandName,tags:tInvite?["Invite Only"]:["Open"],logo:brandLogo,screen:"tournament-host-"+newT.id,hostTournamentId:newT.id}]);});}
    if(supabase.from){
      // Fetch host_profile_id for the current user, then insert tournament with FK
      supabase.from("host_profiles").select("id").eq("user_id",currentUser?currentUser.id:"").single()
        .then(function(hpRes){
          var hpId=hpRes.data?hpRes.data.id:null;
          return supabase.from("tournaments").insert({name:tName,date:tDate,format:"swiss",max_players:parseInt(tSize),invite_only:tInvite,entry_fee:tEntryFee||null,rules_text:tRules||null,host_profile_id:hpId,description:tRules||"Host tournament by "+brandName,region:""});
        }).then(function(res){if(res&&res.error)console.error("[TFT] Failed to create tournament:",res.error);});
    }
    setShowCreate(false);setTName("");setTDate("");setTEntryFee("");setTRules("");setTInvite(false);
    toast(tEntryFee?"Tournament created — pending admin approval for entry fee":"Tournament created!","success");
  }

  function saveBranding(){
    if(setHostBranding)setHostBranding({name:brandName,logo:brandLogo,color:brandColor,bio:brandBio,logoUrl:brandLogoUrl,bannerUrl:brandBannerUrl});
    // Sync branding to host_profiles DB table
    if(supabase.from&&currentUser){
      supabase.from("host_profiles").update({
        org_name:brandName,
        brand_color:brandColor,
        bio:brandBio,
        logo_url:brandLogoUrl||brandLogo,
        banner_url:brandBannerUrl||""
      }).eq("user_id",currentUser.id).then(function(res){
        if(res.error)console.error("[TFT] host_profiles branding update failed:",res.error);
      });
    }
    setBrandSaved(true);
    toast("Branding saved!","success");
    setTimeout(function(){setBrandSaved(false);},3000);
  }

  function sendAnnouncement(){
    if(!announceMsg.trim()){toast("Write a message first","error");return;}
    var a={id:Date.now(),to:announceTo,msg:announceMsg.trim(),sentAt:new Date().toLocaleString()};
    var newArr=[a].concat(announcements);
    setAnnouncements(function(){return newArr;});
    if(setHostAnnouncements)setHostAnnouncements(newArr);
    setAnnounceMsg("");
    toast("Announcement sent to "+(announceTo==="all"?"all players":announceTo+" players"),"success");
  }

  var liveTournaments=tournaments.filter(function(t){return t.status==="live";});
  var upcomingTournaments=tournaments.filter(function(t){return t.status==="upcoming";});
  var completedTournaments=tournaments.filter(function(t){return t.status==="completed";});
  var totalHosted=tournaments.length;
  var totalPlayers=tournaments.reduce(function(s,t){return s+t.registered;},0);

  function updateTournamentAndFeatured(tournamentId, updates){
    setTournaments(function(ts){return ts.map(function(t){return t.id===tournamentId?Object.assign({},t,updates):t;});});
    if(setFeaturedEvents){
      setFeaturedEvents(function(evts){return evts.map(function(ev){
        if(ev.hostTournamentId===tournamentId){
          var feUpdates={};
          if(updates.status==="upcoming")feUpdates.status="upcoming";
          if(updates.status==="checkin"||updates.status==="live")feUpdates.status="live";
          if(updates.status==="closed")feUpdates.status="upcoming";
          if(updates.status==="completed"){feUpdates.status="completed";if(updates.champion)feUpdates.champion=updates.champion;if(updates.top4)feUpdates.top4=updates.top4;}
          return Object.assign({},ev,feUpdates);
        }
        return ev;
      });});
    }
  }

  var TABS=[["overview","Overview"],["tournaments","Tournaments"],["game-flow","Game Flow"],["registrations","Players"],["announce","Announce"],["branding","Branding"]];

  return(
    <div className="page wrap">

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <span style={{fontSize:24}}>{brandLogo}</span>
            <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>{brandName}</h2>
            <Tag color="#9B72CF">{"🎮"} Host</Tag>
            {liveTournaments.length>0&&(
              <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#6EE7B7"}}>
                <span style={{width:4,height:4,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
              </span>
            )}
          </div>
          <p style={{fontSize:13,color:"#BECBD9",margin:0}}>Host Dashboard — manage tournaments, players, and branding.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="dark" s="sm" onClick={function(){setScreen("featured");}}>{"← "} Featured</Btn>
          <Btn v="primary" onClick={function(){setShowCreate(function(s){return !s;})}}>{showCreate?"Cancel":"+ New Tournament"}</Btn>
        </div>
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
              <Inp value={tDate} onChange={setTDate} placeholder="Mar 24 2026"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Max Players</div>
              <Sel value={tSize} onChange={setTSize}>{[8,16,24,32,48,64,96,126,128].map(function(n){return <option key={n} value={n}>{n} players</option>;})}</Sel>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Entry Fee <span style={{color:"#9AAABF",fontWeight:400}}>(requires admin approval)</span></div>
              <Inp value={tEntryFee} onChange={setTEntryFee} placeholder="Leave blank = free"/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Custom Rules <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
            <textarea value={tRules} onChange={function(e){setTRules(e.target.value);}} placeholder="Any special rules, format notes, or tiebreaker info..."
              style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:72,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div onClick={function(){setTInvite(function(v){return !v;});}} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <div style={{width:36,height:20,borderRadius:99,background:tInvite?"rgba(155,114,207,.3)":"rgba(255,255,255,.08)",border:"1px solid "+(tInvite?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),position:"relative",transition:"all .2s"}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:tInvite?"#C4B5FD":"#9AAABF",position:"absolute",top:2,left:tInvite?18:2,transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:13,color:"#C8D4E0"}}>Invite-only registration</span>
            </div>
          </div>
          {tEntryFee&&(
            <div style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#E8A838"}}>
              {"⚠"} Entry fee tournaments require admin approval before going live.
            </div>
          )}
          <Btn v="primary" onClick={createTournament}>Create Tournament</Btn>
        </Panel>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {TABS.map(function(arr){
          var t=arr[0],label=arr[1];
          return <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={function(){setTab(t);}}>{label}</Btn>;
        })}
      </div>

      {/* Overview tab */}
      {tab==="overview"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
            {[["Tournaments",""+totalHosted,"#E8A838"],["Players Hosted",""+totalPlayers,"#6EE7B7"],["Live Now",""+liveTournaments.length,"#52C47C"],["Upcoming",""+upcomingTournaments.length,"#4ECDC4"]].map(function(arr){
              var l=arr[0],v=arr[1],c=arr[2];
              return(
                <Panel key={l} style={{padding:"18px",textAlign:"center"}}>
                  <div className="mono" style={{fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                  <div className="cond" style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:6,letterSpacing:".06em"}}>{l}</div>
                </Panel>
              );
            })}
          </div>
          {liveTournaments.length>0&&(
            <Panel style={{padding:"18px",marginBottom:16,border:"1px solid rgba(82,196,124,.2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
                </span>
                <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>Active Tournament</span>
              </div>
              {liveTournaments.map(function(t){
                return(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:4}}>{t.name}</div>
                      <div style={{fontSize:12,color:"#BECBD9",marginBottom:8}}>{"📅"} {t.date} {"·"} {"👥"} {t.registered}/{t.size} players</div>
                      <Bar val={t.registered} max={t.size} color="#6EE7B7" h={4}/>
                    </div>
                    <Btn v="primary" s="sm" onClick={function(){setScreen("bracket");}}>Live Bracket {"→"}</Btn>
                  </div>
                );
              })}
            </Panel>
          )}
          <Panel style={{padding:"18px"}}>
            <div style={{fontWeight:600,fontSize:14,color:"#F2EDE4",marginBottom:12}}>Quick Actions</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="ghost" s="sm" onClick={function(){setShowCreate(true);setTab("tournaments");}}>{"+"} New Tournament</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setTab("announce");}}>{"📢"} Announce</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setTab("branding");}}>{"🎨"} Edit Branding</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setScreen("bracket");}}>{"⚔"} View Bracket</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setScreen("featured");}}>{"⭐"} Featured Page</Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* Tournaments tab */}
      {tab==="tournaments"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {tournaments.map(function(t){
            var statusColor=t.status==="live"?"#6EE7B7":t.status==="upcoming"?"#4ECDC4":t.status==="pending_approval"?"#E8A838":"#BECBD9";
            var statusLabel=t.status==="live"?"🔴 Live":t.status==="upcoming"?"✓ Upcoming":t.status==="pending_approval"?"⏳ Pending":"Completed";
            return(
              <Panel key={t.id} style={{padding:"18px",border:t.status==="live"?"1px solid rgba(82,196,124,.25)":"1px solid rgba(242,237,228,.07)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{t.name}</span>
                      <Tag color={statusColor} size="sm">{statusLabel}</Tag>
                      {t.invite&&<Tag color="#9B72CF" size="sm">{"🔒"} Invite Only</Tag>}
                      {t.entryFee&&<Tag color="#EAB308" size="sm">{"💰"} {t.entryFee}</Tag>}
                    </div>
                    <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>{"📅"} {t.date} {"·"} {"👥"} {t.registered}/{t.size} registered</div>
                    <Bar val={t.registered} max={t.size} color="#E8A838" h={4}/>
                    <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{t.size-t.registered} spots remaining</div>
                    {t.rules&&<div style={{fontSize:11,color:"#9AAABF",marginTop:6,fontStyle:"italic"}}>{"📋"} {t.rules}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                    {t.status==="upcoming"&&<Btn v="ghost" s="sm" onClick={function(){updateTournamentAndFeatured(t.id,{status:"live"});toast("Check-in opened! Tournament is now LIVE","success");}}>{"Open Check-In"}</Btn>}
                    {t.status==="live"&&<Btn v="ghost" s="sm" onClick={function(){updateTournamentAndFeatured(t.id,{status:"closed"});toast("Registration closed","info");}}>{"Close Registration"}</Btn>}
                    {(t.status==="live"||t.status==="closed")&&<Btn v="primary" s="sm" onClick={function(){var champ=prompt("Enter champion name:");if(champ&&champ.trim()){updateTournamentAndFeatured(t.id,{status:"completed",champion:champ.trim(),top4:[champ.trim()]});toast("Tournament completed! Champion: "+champ.trim(),"success");}else{toast("Cancelled","info");}}}>{"Complete"}</Btn>}
                    {t.status==="pending_approval"&&<span style={{fontSize:11,color:"#E8A838",fontWeight:600,padding:"5px 0"}}>{"Awaiting Approval"}</span>}
                    {t.status==="completed"&&<Btn v="ghost" s="sm" onClick={function(){setScreen("tournament-host-"+t.id);}}>{"View Details"}</Btn>}
                    <Btn v="ghost" s="sm" onClick={function(){if(confirm("Delete this tournament?")){setTournaments(function(ts){return ts.filter(function(x){return x.id!==t.id;});});if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.filter(function(ev){return ev.hostTournamentId!==t.id;});});}toast("Tournament deleted","info");}}} style={{color:"#F87171"}}>{"Delete"}</Btn>
                  </div>
                </div>
              </Panel>
            );
          })}
          {tournaments.length===0&&(
            <div style={{textAlign:"center",padding:"48px",color:"#BECBD9"}}>
              <div style={{fontSize:32,marginBottom:12}}>{"🎮"}</div>
              <div style={{fontSize:14}}>No tournaments yet. Create your first one above.</div>
            </div>
          )}
        </div>
      )}

      {/* Game Flow tab — enter results per round */}
      {tab==="game-flow"&&(
        <div>
          {tournaments.filter(function(t){return t.status==="live"||t.status==="closed";}).length===0&&(
            <Panel style={{padding:"40px 24px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:12}}>{"\u2694\ufe0f"}</div>
              <h3 style={{color:"#F2EDE4",marginBottom:8}}>No Live Tournaments</h3>
              <p style={{color:"#BECBD9",fontSize:13}}>Open check-in on a tournament to start the game flow. You can then enter placements round by round.</p>
            </Panel>
          )}
          {tournaments.filter(function(t){return t.status==="live"||t.status==="closed";}).map(function(t){
            var matchingEvent=(featuredEvents||[]).find(function(ev){return ev.hostTournamentId===t.id;});
            var regIds=matchingEvent?(matchingEvent.registeredIds||[]):[];
            var roundCount=t.roundCount||3;
            var currentRound=t.currentRound||1;
            return(
              <Panel key={t.id} style={{padding:"20px",marginBottom:16,border:"1px solid rgba(82,196,124,.2)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                  <h3 style={{fontSize:16,fontWeight:700,color:"#F2EDE4",margin:0,flex:1}}>{t.name}</h3>
                  <Tag color="#6EE7B7" size="sm">Round {currentRound}/{roundCount}</Tag>
                  <Tag color="#E8A838" size="sm">{regIds.length} players</Tag>
                </div>

                {regIds.length===0&&(
                  <div style={{fontSize:13,color:"#BECBD9",padding:"16px 0",textAlign:"center"}}>No players registered yet. Players need to register before you can enter results.</div>
                )}

                {regIds.length>0&&(
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:10}}>Enter placements for Round {currentRound}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
                      {regIds.map(function(username,i){
                        return(
                          <div key={username} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,.02)",borderRadius:8,border:"1px solid rgba(242,237,228,.04)"}}>
                            <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4",flex:1}}>{username}</span>
                            <Sel value="" onChange={function(val){
                              if(!val)return;
                              var placement=parseInt(val);
                              var pts={1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1}[placement]||0;
                              if(supabase.from&&t.dbId){
                                var matchedPlayer=(players||[]).find(function(p){return p.username===username||p.name===username;});
                                var playerId=matchedPlayer?matchedPlayer.dbId||matchedPlayer.id:null;
                                if(!playerId){toast("Player "+username+" not found in roster","error");return;}
                                supabase.from("game_results").insert({
                                  tournament_id:t.dbId,
                                  round_number:currentRound,
                                  player_id:playerId,
                                  placement:placement,
                                  points:pts
                                }).then(function(res){
                                  if(res.error)toast("Failed to save: "+res.error.message,"error");
                                  else toast(username+" placed "+placement+(placement===1?"st":placement===2?"nd":placement===3?"rd":"th")+" ("+pts+"pts)","success");
                                });
                              }else{
                                toast(username+" placed "+placement+(placement===1?"st":placement===2?"nd":placement===3?"rd":"th")+" ("+pts+"pts)","success");
                              }
                            }} style={{width:90}}>
                              <option value="">Place</option>
                              {[1,2,3,4,5,6,7,8].map(function(p){return <option key={p} value={p}>{p}{p===1?"st":p===2?"nd":p===3?"rd":"th"} ({({1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1})[p]}pts)</option>;})}
                            </Sel>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <Btn v="primary" s="sm" onClick={function(){
                        if(currentRound<roundCount){
                          updateTournamentAndFeatured(t.id,{currentRound:currentRound+1});
                          toast("Advanced to Round "+(currentRound+1),"success");
                        }else{
                          var champ=prompt("Enter champion name:");
                          if(champ&&champ.trim()){
                            updateTournamentAndFeatured(t.id,{status:"completed",champion:champ.trim(),top4:[champ.trim()]});
                            toast("Tournament completed! Champion: "+champ.trim(),"success");
                          }
                        }
                      }}>{currentRound<roundCount?"Advance to Round "+(currentRound+1):"Finalize Tournament"}</Btn>
                      <Btn v="ghost" s="sm" onClick={function(){setScreen("tournament-host-"+t.id);}}>View Public Page</Btn>
                    </div>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      {/* Registrations / Players tab */}
      {tab==="registrations"&&(
        <div>
          {tournaments.filter(function(t){return t.status!=="completed";}).map(function(t){
            var matchingEvent=(featuredEvents||[]).find(function(ev){return ev.hostTournamentId===t.id;});
            var regIds=matchingEvent?(matchingEvent.registeredIds||[]):[];
            return(
              <Panel key={t.id} style={{padding:"18px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <h3 style={{fontSize:14,color:"#F2EDE4",margin:0,flex:1}}>{t.name}</h3>
                  <Tag color={t.status==="live"?"#6EE7B7":"#4ECDC4"} size="sm">{regIds.length+"/"+t.size}</Tag>
                </div>
                {regIds.length===0&&<div style={{fontSize:13,color:"#BECBD9",padding:"16px 0",textAlign:"center"}}>{"No players registered yet."}</div>}
                {regIds.map(function(username,i){
                  return(
                    <div key={username} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<regIds.length-1?"1px solid rgba(242,237,228,.05)":"none"}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{username}</div>
                      </div>
                      <Tag color="#6EE7B7" size="sm">{"✓ Registered"}</Tag>
                      <button onClick={function(){if(confirm("Remove "+username+"?")){if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.map(function(ev){if(ev.hostTournamentId!==t.id)return ev;return Object.assign({},ev,{registeredIds:(ev.registeredIds||[]).filter(function(u){return u!==username;}),registered:Math.max(0,(ev.registered||0)-1)});});});}toast(username+" removed","info");}}} style={{background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.3)",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,color:"#F87171",cursor:"pointer",fontFamily:"inherit"}}>{"Remove"}</button>
                    </div>
                  );
                })}
              </Panel>
            );
          })}
        </div>
      )}

      {/* Announce tab */}
      {tab==="announce"&&(
        <div>
          <Panel style={{padding:"20px",marginBottom:16}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Send Announcement</h3>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Send to</div>
              <Sel value={announceTo} onChange={setAnnounceTo}>
                <option value="all">All registered players</option>
                {tournaments.map(function(t){return <option key={t.id} value={t.name}>{t.name}</option>;})}
              </Sel>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Message</div>
              <textarea value={announceMsg} onChange={function(e){setAnnounceMsg(e.target.value);}}
                placeholder="e.g. Check-in is now open! Join the Discord for lobby codes..."
                style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:90,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <Btn v="primary" onClick={sendAnnouncement}>{"📢"} Send Announcement</Btn>
          </Panel>
          <Panel style={{padding:"18px"}}>
            <h3 style={{fontSize:14,color:"#F2EDE4",marginBottom:14}}>Sent Announcements</h3>
            {announcements.length===0&&<div style={{fontSize:13,color:"#BECBD9",padding:"16px 0",textAlign:"center"}}>No announcements sent yet.</div>}
            {announcements.map(function(a){
              return(
                <div key={a.id} style={{borderBottom:"1px solid rgba(242,237,228,.05)",padding:"12px 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:11,background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.2)",borderRadius:20,padding:"2px 8px",color:"#C4B5FD",fontWeight:600}}>To: {a.to}</span>
                    <span style={{fontSize:10,color:"#9AAABF",marginLeft:"auto"}}>{a.sentAt}</span>
                  </div>
                  <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.5}}>{a.msg}</div>
                </div>
              );
            })}
          </Panel>
        </div>
      )}

      {/* Branding tab */}
      {tab==="branding"&&(
        <Panel style={{padding:"24px"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:18}}>{"🎨"} Host Branding</h3>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap",marginBottom:24}}>
            {/* Preview card */}
            <div style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid "+brandColor+"55",borderRadius:14,padding:"16px 20px",minWidth:220,flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:10,background:brandColor+"22",border:"1px solid "+brandColor+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{brandLogo}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{brandName}</div>
                  <div style={{fontSize:11,color:brandColor,fontWeight:600}}>Host Partner</div>
                </div>
              </div>
              {brandBio&&<div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.5}}>{brandBio}</div>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Org / Display Name</div>
              <Inp value={brandName} onChange={setBrandName} placeholder="Your org or community name"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Logo Emoji</div>
              <Inp value={brandLogo} onChange={setBrandLogo} placeholder="e.g. 🎮 🏆 👑"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:8}}>Brand Color</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["#9B72CF","#4ECDC4","#E8A838","#F87171","#6EE7B7","#60A5FA","#FB923C"].map(function(c){
                  return(
                    <div key={c} onClick={function(){setBrandColor(c);}}
                      style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:brandColor===c?"3px solid #fff":"3px solid transparent",transition:"border .15s"}}/>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Bio / Description <span style={{color:"#9AAABF",fontWeight:400}}>(shown on Featured page)</span></div>
              <textarea value={brandBio} onChange={function(e){setBrandBio(e.target.value);}}
                placeholder="Tell players about your org, community, and what kind of clashes you run..."
                style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:80,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Logo Image <span style={{color:"#9AAABF",fontWeight:400}}>(URL or upload)</span></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Inp value={brandLogoUrl} onChange={setBrandLogoUrl} placeholder="https://example.com/logo.png"/>
                <label style={{background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,color:"#C4B5FD",cursor:"pointer",whiteSpace:"nowrap"}}>
                  {uploadingLogo?"Uploading...":"Upload"}
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){if(e.target.files[0])uploadImage(e.target.files[0],"logo");}}/>
                </label>
              </div>
              {brandLogoUrl&&<img src={brandLogoUrl} alt="Logo preview" style={{width:48,height:48,borderRadius:10,objectFit:"cover",marginTop:8,border:"1px solid rgba(242,237,228,.1)"}}/>}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Banner Image <span style={{color:"#9AAABF",fontWeight:400}}>(URL or upload)</span></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Inp value={brandBannerUrl} onChange={setBrandBannerUrl} placeholder="https://example.com/banner.png"/>
                <label style={{background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,color:"#C4B5FD",cursor:"pointer",whiteSpace:"nowrap"}}>
                  {uploadingBanner?"Uploading...":"Upload"}
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){if(e.target.files[0])uploadImage(e.target.files[0],"banner");}}/>
                </label>
              </div>
              {brandBannerUrl&&<img src={brandBannerUrl} alt="Banner preview" style={{width:"100%",maxHeight:120,borderRadius:10,objectFit:"cover",marginTop:8,border:"1px solid rgba(242,237,228,.1)"}}/>}
            </div>
            <Btn v="primary" onClick={saveBranding}>{brandSaved?"✓ Saved!":"Save Branding"}</Btn>
          </div>
        </Panel>
      )}

    </div>
  );
}


// ─── TOURNAMENT DETAIL SCREEN ────────────────────────────────────────────

function TournamentDetailScreen(props){
  var event=props.event;
  var featuredEvents=props.featuredEvents;
  var setFeaturedEvents=props.setFeaturedEvents;
  var currentUser=props.currentUser;
  var onAuthClick=props.onAuthClick;
  var toast=props.toast;
  var setScreen=props.setScreen;
  var players=props.players;
  var [detailTab,setDetailTab]=useState("overview");

  var isRegistered=currentUser&&event.registeredIds&&event.registeredIds.indexOf(currentUser.username)!==-1;
  var isFull=event.registered>=event.size;
  var isUpcoming=event.status==="upcoming";
  var isLive=event.status==="live";
  var isCompleted=event.status==="completed";
  var canRegister=!isCompleted&&!isFull&&!isRegistered;

  function handleRegister(){
    if(!currentUser){onAuthClick("login");return;}
    if(isRegistered){
      setFeaturedEvents(function(evts){return evts.map(function(ev){
        if(ev.id!==event.id)return ev;
        var newIds=(ev.registeredIds||[]).filter(function(u){return u!==currentUser.username;});
        return Object.assign({},ev,{registeredIds:newIds,registered:Math.max(0,(ev.registered||0)-1)});
      });});
      // Also unregister from DB registrations table
      if(supabase.from&&currentUser&&event.dbTournamentId){
        supabase.from("players").select("id").eq("auth_user_id",currentUser.id).single().then(function(pRes){
          if(pRes.data)supabase.from("registrations").delete().eq("tournament_id",event.dbTournamentId).eq("player_id",pRes.data.id).then(function(r){if(r.error){console.error("[TFT] unregister failed:",r.error);toast("Unregister failed","error");}});
        });
      }
      toast("Unregistered from "+event.name,"info");
    }else{
      if(isFull){toast("Tournament is full","error");return;}
      setFeaturedEvents(function(evts){return evts.map(function(ev){
        if(ev.id!==event.id)return ev;
        var newIds=(ev.registeredIds||[]).concat([currentUser.username]);
        return Object.assign({},ev,{registeredIds:newIds,registered:(ev.registered||0)+1});
      });});
      // Also register in DB registrations table
      if(supabase.from&&currentUser&&event.dbTournamentId){
        supabase.from("players").select("id").eq("auth_user_id",currentUser.id).single().then(function(pRes){
          if(pRes.data)supabase.from("registrations").insert({tournament_id:event.dbTournamentId,player_id:pRes.data.id,status:"registered"})
            .then(function(r){if(r.error)console.error("[TFT] registration insert failed:",r.error);});
        });
      }
      toast("Registered for "+event.name+"!","success");
    }
  }

  var regPercent=event.size>0?Math.round((event.registered/event.size)*100):0;

  // Load tournament results from DB for bracket/standings tabs
  var [tournamentResults,setTournamentResults]=useState([]);
  var [loadingResults,setLoadingResults]=useState(false);
  useEffect(function(){
    if(!event.dbTournamentId||!supabase.from)return;
    setLoadingResults(true);
    supabase.from("game_results").select("*").eq("tournament_id",event.dbTournamentId).order("round_number",{ascending:true}).order("placement",{ascending:true})
      .then(function(res){
        setLoadingResults(false);
        if(res.error){console.error("[TFT] Failed to load game results:",res.error);toast("Failed to load results","error");return;}
        if(res.data)setTournamentResults(res.data);
      });
  },[event.dbTournamentId]);

  // Derive standings from game_results
  var standings=[];
  if(tournamentResults.length>0){
    var playerMap={};
    tournamentResults.forEach(function(r){
      if(!playerMap[r.player_id])playerMap[r.player_id]={player_id:r.player_id,total:0,games:[]};
      playerMap[r.player_id].total+=r.points||0;
      playerMap[r.player_id].games.push({round:r.round_number,placement:r.placement,points:r.points});
    });
    standings=Object.values(playerMap).sort(function(a,b){return b.total-a.total;});
  }

  var DETAIL_TABS=[["overview","Overview"],["bracket","Bracket"],["standings","Standings"],["rules","Rules"]];

  return(
    <div className="page wrap">
      <div style={{marginBottom:20}}>
        <button onClick={function(){setScreen("featured");}} style={{background:"none",border:"none",color:"#9B72CF",fontSize:13,fontWeight:600,cursor:"pointer",padding:0,marginBottom:12,fontFamily:"inherit"}}>{"\u2190 Back to Featured Events"}</button>
      </div>

      {/* Hero */}
      <Panel glow style={{padding:"28px 24px",marginBottom:20}}>
        <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap",marginBottom:20}}>
          <div style={{width:56,height:56,borderRadius:14,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{event.logo}</div>
          <div style={{flex:1,minWidth:200}}>
            <h1 style={{fontSize:22,fontWeight:700,color:"#F2EDE4",margin:"0 0 6px 0"}}>{event.name}</h1>
            <div style={{fontSize:13,color:"#9B72CF",fontWeight:600,marginBottom:4}}>{"Hosted by "+event.host+(event.sponsor?" \u00b7 Presented by "+event.sponsor:"")}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
              {event.date&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#BECBD9"}}>{event.date}</span>}
              {event.time&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#BECBD9"}}>{event.time}</span>}
              {event.format&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#BECBD9"}}>{event.format}</span>}
              {event.region&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#BECBD9"}}>{event.region}</span>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {isLive&&<span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}><span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>{"LIVE"}</span>}
            {isUpcoming&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#4ECDC4"}}>{"UPCOMING"}</span>}
            {isCompleted&&<span style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#E8A838"}}>{"COMPLETED"}</span>}
          </div>
        </div>
        {event.description&&<div style={{fontSize:14,color:"#C8D4E0",lineHeight:1.6,marginBottom:20}}>{event.description}</div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {(event.tags||[]).map(function(t){return <span key={t} style={{background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.25)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#C4B5FD"}}>{t}</span>;})}
          {event.prizePool&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#4ECDC4"}}>{event.prizePool+" Prize Pool"}</span>}
        </div>
      </Panel>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"rgba(255,255,255,.025)",borderRadius:10,padding:4,border:"1px solid rgba(242,237,228,.06)"}}>
        {DETAIL_TABS.map(function(arr){return(
          <button key={arr[0]} onClick={function(){setDetailTab(arr[0]);}} style={{flex:1,padding:"10px 6px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",letterSpacing:".04em",transition:"all .15s",background:detailTab===arr[0]?"rgba(155,114,207,.22)":"transparent",color:detailTab===arr[0]?"#C4B5FD":"#BECBD9",outline:"none",textTransform:"uppercase"}}>{arr[1]}</button>
        );})}
      </div>

      {/* Overview Tab */}
      {detailTab==="overview"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
            <Panel style={{padding:"20px",textAlign:"center"}}>
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:"#BECBD9"}}>{"Registration"}</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#E8A838"}}>{event.registered+"/"+event.size+" ("+regPercent+"%)"}</span>
                </div>
                <Bar val={event.registered} max={event.size} color="#E8A838" h={6}/>
              </div>
              {!isCompleted&&(
                currentUser?(
                  isRegistered?
                    <button onClick={handleRegister} style={{width:"100%",padding:"10px 16px",background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:8,fontSize:13,fontWeight:700,color:"#6EE7B7",cursor:"pointer",fontFamily:"inherit"}}>{"Registered \u2713 (Click to Unregister)"}</button>
                  :canRegister?
                    <button onClick={handleRegister} style={{width:"100%",padding:"10px 16px",background:"linear-gradient(90deg,#9B72CF,#7C5BB0)",border:"none",borderRadius:8,fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>{"Register Now"}</button>
                  :
                    <button disabled style={{width:"100%",padding:"10px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:8,fontSize:13,fontWeight:700,color:"#9AAABF",cursor:"not-allowed",fontFamily:"inherit"}}>{"Full"}</button>
                ):(
                  <button onClick={function(){onAuthClick("login");}} style={{width:"100%",padding:"10px 16px",background:"rgba(232,168,56,.12)",border:"1px solid rgba(232,168,56,.3)",borderRadius:8,fontSize:13,fontWeight:700,color:"#E8A838",cursor:"pointer",fontFamily:"inherit"}}>{"Sign In to Register"}</button>
                )
              )}
            </Panel>
            <Panel style={{padding:"20px",textAlign:"center"}}>
              <div className="mono" style={{fontSize:28,fontWeight:700,color:"#E8A838",lineHeight:1}}>{event.size}</div>
              <div className="cond" style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:6,letterSpacing:".06em"}}>{"Max Players"}</div>
              {event.format&&<div style={{fontSize:12,color:"#C8D4E0",marginTop:8}}>{event.format}</div>}
            </Panel>
          </div>

          {isCompleted&&event.champion&&(
            <Panel glow style={{padding:"24px",marginBottom:20,border:"1px solid rgba(232,168,56,.3)"}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#E8A838",marginBottom:14}}>{"\ud83c\udfc6 Champion"}</h3>
              <div style={{fontSize:20,fontWeight:700,color:"#F2EDE4",marginBottom:12}}>{event.champion}</div>
              {event.top4&&event.top4.length>0&&(
                <div>
                  <div style={{fontSize:11,color:"#BECBD9",marginBottom:8,fontWeight:600}}>{"Top 4"}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {event.top4.map(function(p,i){return <span key={i} style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.15)",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,color:i===0?"#E8A838":"#C8D4E0"}}>{(i+1)+". "+p}</span>;})}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {(event.registeredIds||[]).length>0&&(
            <Panel style={{padding:"20px",marginBottom:20}}>
              <h3 style={{fontSize:14,fontWeight:700,color:"#F2EDE4",marginBottom:14}}>{"Registered Players ("+(event.registeredIds||[]).length+")"}</h3>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {(event.registeredIds||[]).map(function(username,i){
                  return(
                    <div key={username} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,.02)",borderRadius:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#E8A838",minWidth:20}}>{i+1}</span>
                      <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>{username}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Bracket Tab */}
      {detailTab==="bracket"&&(
        <div>
          {tournamentResults.length===0&&!loadingResults&&(
            <Panel style={{padding:"40px 24px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:12}}>{"\u2694\ufe0f"}</div>
              <h3 style={{color:"#F2EDE4",marginBottom:8}}>No Bracket Data Yet</h3>
              <p style={{color:"#BECBD9",fontSize:13}}>Bracket and lobby assignments will appear here once the tournament begins and results are entered.</p>
            </Panel>
          )}
          {loadingResults&&(
            <Panel style={{padding:"40px 24px",textAlign:"center"}}>
              <div style={{fontSize:14,color:"#BECBD9"}}>Loading bracket data...</div>
            </Panel>
          )}
          {tournamentResults.length>0&&(function(){
            // Group results by round
            var rounds={};
            tournamentResults.forEach(function(r){
              var rk="Round "+r.round_number;
              if(!rounds[rk])rounds[rk]=[];
              rounds[rk].push(r);
            });
            var roundKeys=Object.keys(rounds).sort();
            return(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {roundKeys.map(function(rk){
                  var results=rounds[rk].sort(function(a,b){return a.placement-b.placement;});
                  return(
                    <Panel key={rk} style={{padding:"18px"}}>
                      <h3 style={{fontSize:15,fontWeight:700,color:"#E8A838",marginBottom:12}}>{rk}</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {results.map(function(r,i){
                          var placeColors=["#FFD700","#C0C0C0","#CD7F32","#52C47C","#9B72CF","#4ECDC4","#BECBD9","#8896A8"];
                          var pc=placeColors[Math.min(r.placement-1,7)]||"#8896A8";
                          return(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:r.placement<=3?"rgba(232,168,56,.05)":"rgba(255,255,255,.02)",borderRadius:6,border:"1px solid "+(r.placement<=3?"rgba(232,168,56,.12)":"rgba(242,237,228,.04)")}}>
                              <div style={{width:24,fontWeight:700,fontSize:13,color:pc,textAlign:"center",flexShrink:0}}>{r.placement}</div>
                              <div style={{flex:1,fontSize:13,color:"#F2EDE4"}}>{((players||[]).find(function(p){return p.id===r.player_id||p.dbId===r.player_id;})||{}).name||r.player_id}</div>
                              <div className="mono" style={{fontSize:14,fontWeight:700,color:"#E8A838"}}>{r.points}pts</div>
                            </div>
                          );
                        })}
                      </div>
                    </Panel>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Standings Tab */}
      {detailTab==="standings"&&(
        <div>
          {standings.length===0&&!loadingResults&&(
            <Panel style={{padding:"40px 24px",textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:12}}>{"\ud83d\udcca"}</div>
              <h3 style={{color:"#F2EDE4",marginBottom:8}}>No Standings Yet</h3>
              <p style={{color:"#BECBD9",fontSize:13}}>Standings will update as games are played and results are entered.</p>
            </Panel>
          )}
          {standings.length>0&&(
            <Panel style={{padding:"20px"}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#E8A838",marginBottom:16}}>Tournament Standings</h3>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {standings.map(function(s,i){
                  var placeColors=["#FFD700","#C0C0C0","#CD7F32","#52C47C"];
                  var pc=placeColors[Math.min(i,3)]||"#BECBD9";
                  return(
                    <div key={s.player_id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:i<3?"rgba(232,168,56,.05)":"rgba(255,255,255,.02)",borderRadius:8,border:"1px solid "+(i<3?"rgba(232,168,56,.12)":"rgba(242,237,228,.04)")}}>
                      <div style={{width:28,fontWeight:700,fontSize:15,color:pc,textAlign:"center",flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1,fontSize:14,fontWeight:600,color:"#F2EDE4"}}>{s.player_id}</div>
                      <div style={{fontSize:11,color:"#BECBD9"}}>{s.games.length} games</div>
                      <div className="mono" style={{fontSize:16,fontWeight:700,color:"#E8A838",minWidth:40,textAlign:"right"}}>{s.total}</div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {detailTab==="rules"&&(
        <div>
          <Panel style={{padding:"24px",marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700,color:"#E8A838",marginBottom:14}}>Points System</h3>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr>
                    {["Place","1st","2nd","3rd","4th","5th","6th","7th","8th"].map(function(h){return(
                      <th key={h} style={{padding:"8px 12px",borderBottom:"1px solid rgba(242,237,228,.12)",color:"#E8A838",fontWeight:700,textAlign:"center"}}>{h}</th>
                    );})}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{padding:"8px 12px",borderBottom:"1px solid rgba(242,237,228,.06)",color:"#BECBD9",fontWeight:600,textAlign:"center"}}>Points</td>
                    {[8,7,6,5,4,3,2,1].map(function(p){return(
                      <td key={p} style={{padding:"8px 12px",borderBottom:"1px solid rgba(242,237,228,.06)",color:"#F2EDE4",fontWeight:700,textAlign:"center",fontFamily:"monospace"}}>{p}</td>
                    );})}
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel style={{padding:"24px",marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700,color:"#9B72CF",marginBottom:14}}>Tiebreaker Rules</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {n:"1",t:"Total Tournament Points",d:"Sum of all placement points across games."},
                {n:"2",t:"Wins + Top 4s",d:"Wins count twice."},
                {n:"3",t:"Most of Each Placement",d:"Compare 1st counts, then 2nd, then 3rd..."},
                {n:"4",t:"Most Recent Game Finish",d:"Higher placement in the most recent game wins."}
              ].map(function(tb){return(
                <div key={tb.n} style={{display:"flex",gap:10,alignItems:"flex-start",background:"rgba(155,114,207,.05)",border:"1px solid rgba(155,114,207,.15)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"rgba(155,114,207,.15)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#C4B5FD",flexShrink:0}}>{tb.n}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",marginBottom:2}}>{tb.t}</div>
                    <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.4}}>{tb.d}</div>
                  </div>
                </div>
              );})}
            </div>
          </Panel>
          {event.rules&&(
            <Panel style={{padding:"24px"}}>
              <h3 style={{fontSize:16,fontWeight:700,color:"#4ECDC4",marginBottom:14}}>Tournament-Specific Rules</h3>
              <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{event.rules}</div>
            </Panel>
          )}
        </div>
      )}

      {currentUser&&event.hostTournamentId&&event.host===(currentUser.username)&&(
        <div style={{textAlign:"center",marginTop:16}}>
          <button onClick={function(){setScreen("host-dashboard");}} style={{background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,color:"#C4B5FD",cursor:"pointer",fontFamily:"inherit"}}>{"Manage Tournament \u2192"}</button>
        </div>
      )}
    </div>
  );
}



// ─── FEATURED EVENTS SCREEN ────────────────────────────────────────────


function FeaturedScreen({setScreen,currentUser,onAuthClick,toast,featuredEvents,setFeaturedEvents}){
  var [filter,setFilter]=useState("all");
  var allEvents=featuredEvents||[];
  var live=allEvents.filter(function(e){return e.status==="live";});
  var upcoming=allEvents.filter(function(e){return e.status==="upcoming";});
  var past=allEvents.filter(function(e){return e.status==="completed";});
  var active=live.concat(upcoming);
  var shown=filter==="all"?active:filter==="live"?live:upcoming;

  return(
    <div className="page wrap">

      <div style={{marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,flexWrap:"wrap"}}>
          <h1 style={{color:"#F2EDE4",fontSize:24,fontWeight:700,margin:0}}>Featured Events</h1>
          {live.length>0&&(
            <span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>
              {live.length} LIVE NOW
            </span>
          )}
        </div>
        <p style={{color:"#BECBD9",fontSize:13,margin:0}}>Partner tournaments, community clashes and special events. Free to watch, free to enter.</p>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[["all","All Active"],["live","Live Now"],["upcoming","Upcoming"]].map(function(arr){
          var f=arr[0],label=arr[1];
          return(
            <button key={f} onClick={function(){setFilter(f)}}
              style={{background:filter===f?"rgba(155,114,207,.2)":"rgba(255,255,255,.04)",border:"1px solid "+(filter===f?"rgba(155,114,207,.5)":"rgba(242,237,228,.08)"),borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,color:filter===f?"#C4B5FD":"#BECBD9",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {label}
            </button>
          );
        })}
      </div>

      {allEvents.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🏟️</div>
          <h3 style={{color:"#F2EDE4",marginBottom:8}}>No Featured Events Yet</h3>
          <p style={{color:"#BECBD9",fontSize:14,maxWidth:400,margin:"0 auto"}}>Featured tournaments and community events will appear here once they are created by event organizers.</p>
        </div>
      )}

      {live.length>0&&(function(){
        var hero=live[0];
        return(
          <div style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid rgba(232,168,56,.3)",borderRadius:16,overflow:"hidden",marginBottom:20,cursor:"pointer"}}
            onClick={function(){setScreen("tournament-"+hero.id);}}>
            <div style={{background:"rgba(232,168,56,.07)",borderBottom:"1px solid rgba(232,168,56,.18)",padding:"9px 18px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(82,196,124,.15)",border:"1px solid rgba(82,196,124,.35)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE NOW
              </span>
              <span style={{color:"#E8A838",fontWeight:600,fontSize:12,marginLeft:4}}>Round in progress</span>
            </div>
            <div style={{padding:"20px 22px"}}>
              <div style={{display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{hero.logo}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:18,color:"#F2EDE4",marginBottom:4}}>{hero.name}</div>
                  <div style={{fontSize:12,color:"#9B72CF",fontWeight:600,marginBottom:10}}>Hosted by {hero.host}{hero.sponsor?" · Presented by "+hero.sponsor:""}</div>
                  <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.5,marginBottom:14}}>{hero.description}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {(hero.tags||[]).map(function(t){return(
                      <span key={t} style={{background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.25)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#C4B5FD"}}>{t}</span>
                    );})
                    }
                    <span style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#E8A838"}}>{hero.registered}/{hero.size} players</span>
                    {hero.prizePool&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#4ECDC4"}}>{hero.prizePool}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {shown.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14,marginBottom:32}}>
          {shown.map(function(ev){
            var isLive=ev.status==="live";
            return(
              <div key={ev.id}
                style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid rgba(155,114,207,.2)",borderRadius:14,overflow:"hidden",cursor:"pointer",transition:"border-color .2s"}}
                onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(155,114,207,.5)";}}
                onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(155,114,207,.2)";}}
                onClick={function(){setScreen("tournament-"+ev.id);}}>
                <div style={{padding:"16px 18px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                    <div style={{width:38,height:38,borderRadius:10,background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ev.logo}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",lineHeight:1.3,marginBottom:2}}>{ev.name}</div>
                      <div style={{fontSize:11,color:"#9B72CF",fontWeight:600}}>{ev.host}</div>
                    </div>
                    <div style={{flexShrink:0}}>
                      {isLive?(
                        <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 8px",fontSize:9,fontWeight:700,color:"#6EE7B7"}}>
                          <span style={{width:4,height:4,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
                        </span>
                      ):(
                        <span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 8px",fontSize:9,fontWeight:700,color:"#4ECDC4"}}>UPCOMING</span>
                      )}
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.5,marginBottom:12}}>{ev.description}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#BECBD9"}}>{ev.date}</span>
                    {ev.time&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#BECBD9"}}>{ev.time}</span>}
                    {ev.region&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#BECBD9"}}>{ev.region}</span>}
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:10,color:"#BECBD9"}}>Registration</span>
                      <span style={{fontSize:10,fontWeight:700,color:"#E8A838"}}>{ev.registered}/{ev.size}</span>
                    </div>
                    <Bar val={ev.registered} max={ev.size} color="#E8A838" h={4}/>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {ev.prizePool&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 8px",fontSize:10,fontWeight:700,color:"#4ECDC4"}}>{ev.prizePool}</span>}
                    {ev.sponsor&&<span style={{background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.2)",borderRadius:20,padding:"3px 8px",fontSize:10,fontWeight:600,color:"#C4B5FD"}}>by {ev.sponsor}</span>}
                    {(function(){
                      var evRegIds=ev.registeredIds||[];
                      var amRegistered=currentUser&&evRegIds.indexOf(currentUser.username)!==-1;
                      var evFull=ev.registered>=ev.size;
                      if(amRegistered)return <span style={{marginLeft:"auto",background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>Registered {"\u2713"}</span>;
                      if(evFull)return <span style={{marginLeft:"auto",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#9AAABF"}}>Full</span>;
                      if(!currentUser)return <button style={{marginLeft:"auto",background:"rgba(232,168,56,.12)",border:"1px solid rgba(232,168,56,.3)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#E8A838",cursor:"pointer",fontFamily:"inherit"}} onClick={function(e){e.stopPropagation();onAuthClick("login");}}>Sign In</button>;
                      return <button style={{marginLeft:"auto",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#C4B5FD",cursor:"pointer",fontFamily:"inherit"}} onClick={function(e){e.stopPropagation();if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.map(function(evt){if(evt.id!==ev.id)return evt;return Object.assign({},evt,{registeredIds:(evt.registeredIds||[]).concat([currentUser.username]),registered:(evt.registered||0)+1});});});toast("Registered for "+ev.name+"!","success");}}}>Register</button>;
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shown.length===0&&(
        <div style={{textAlign:"center",padding:"48px 24px",color:"#BECBD9",marginBottom:24}}>
          <div style={{fontSize:32,marginBottom:12}}>📅</div>
          <div style={{fontSize:14}}>No events matching this filter right now.</div>
        </div>
      )}

      {past.length>0&&(
        <div style={{marginBottom:32}}>
          <h3 style={{color:"#F2EDE4",fontSize:15,fontWeight:700,marginBottom:14}}>Past Events</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {past.map(function(ev){
              return(
                <div key={ev.id}
                  style={{background:"#111827",border:"1px solid rgba(242,237,228,.06)",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"border-color .2s"}}
                  onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(155,114,207,.3)";}}
                  onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(242,237,228,.06)";}}
                  onClick={function(){setScreen("tournament-"+ev.id);}}>
                  <div style={{fontSize:20,flexShrink:0}}>{ev.logo}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4",marginBottom:2}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#BECBD9"}}>{ev.date} · {ev.registered} players · {ev.format}</div>
                  </div>
                  {ev.champion&&(
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:10,color:"#BECBD9",marginBottom:2}}>Champion</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>🏆 {ev.champion}</div>
                    </div>
                  )}
                  <span style={{fontSize:12,color:"#9B72CF",flexShrink:0}}>{"→"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.08),rgba(78,205,196,.05))",border:"1px solid rgba(155,114,207,.2)",borderRadius:16,padding:"28px 24px",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:10}}>🎮</div>
        <h3 style={{color:"#F2EDE4",fontSize:18,fontWeight:700,marginBottom:8}}>Run Your Own Tournament</h3>
        <p style={{fontSize:13,color:"#BECBD9",lineHeight:1.7,marginBottom:20,maxWidth:420,margin:"0 auto 20px"}}>
          Get featured here. Create and manage TFT tournaments with our full host suite.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn v="primary" onClick={function(){currentUser?setScreen("host-apply"):onAuthClick("signup");}}>Apply to Host</Btn>
          <Btn v="dark" onClick={function(){setScreen("pricing");}}>View Host Plans</Btn>
        </div>
      </div>

    </div>
  );
}

// ─── RULES SCREEN ─────────────────────────────────────────────────────────────

function RulesScreen({setScreen}){
  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>Official Rules</h2>
      </div>

      <Panel style={{padding:"24px",marginBottom:16}}>
        <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:17,color:"#E8A838",marginBottom:14}}>Points System (EMEA Rulebook)</h3>
        <p style={{fontSize:13,color:"#BECBD9",marginBottom:14,lineHeight:1.6}}>Points are awarded based on final placement in each game. The official EMEA scoring table:</p>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr>
                {["Place","1st","2nd","3rd","4th","5th","6th","7th","8th"].map(function(h){return(
                  <th key={h} style={{padding:"8px 12px",borderBottom:"1px solid rgba(242,237,228,.12)",color:"#E8A838",fontWeight:700,textAlign:"center",whiteSpace:"nowrap"}}>{h}</th>
                );})}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{padding:"8px 12px",borderBottom:"1px solid rgba(242,237,228,.06)",color:"#BECBD9",fontWeight:600,textAlign:"center"}}>Points</td>
                {[8,7,6,5,4,3,2,1].map(function(p){return(
                  <td key={p} style={{padding:"8px 12px",borderBottom:"1px solid rgba(242,237,228,.06)",color:"#F2EDE4",fontWeight:700,textAlign:"center",fontFamily:"monospace"}}>{p}</td>
                );})}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel style={{padding:"24px",marginBottom:16}}>
        <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:17,color:"#9B72CF",marginBottom:14}}>Tiebreaker Rules</h3>
        <p style={{fontSize:13,color:"#BECBD9",marginBottom:12,lineHeight:1.6}}>When players are tied on total points, tiebreakers are resolved in order:</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {n:"1",title:"Total Tournament Points",desc:"Sum of all placement points across games."},
            {n:"2",title:"Wins + Top 4s",desc:"Wins count twice. A player with 3 wins and 5 top-4s scores 3*2+5 = 11."},
            {n:"3",title:"Most of Each Placement",desc:"Compare 1st place counts, then 2nd, then 3rd, and so on until the tie breaks."},
            {n:"4",title:"Most Recent Game Finish",desc:"The player who placed higher in the most recent game wins the tiebreaker."}
          ].map(function(tb){return(
            <div key={tb.n} style={{display:"flex",gap:12,alignItems:"flex-start",background:"rgba(155,114,207,.05)",border:"1px solid rgba(155,114,207,.15)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(155,114,207,.15)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#C4B5FD",flexShrink:0}}>{tb.n}</div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>{tb.title}</div>
                <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5}}>{tb.desc}</div>
              </div>
            </div>
          );})}
        </div>
      </Panel>

      <Panel style={{padding:"24px",marginBottom:16}}>
        <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:17,color:"#4ECDC4",marginBottom:14}}>Tournament Format</h3>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {icon:"1",title:"Qualifier Stage",desc:"All players are randomly assigned to lobbies of 4-8 players. Top performers from each lobby advance to the Point Stage."},
            {icon:"2",title:"Point Stage",desc:"Qualified players compete across multiple rounds. Points accumulate across all games. Final standings are based on total points."},
            {icon:"3",title:"Swiss Format (Alternative)",desc:"Players are matched against opponents with similar records each round. No elimination — everyone plays all rounds. Final standings by total points."}
          ].map(function(s){return(
            <div key={s.icon} style={{display:"flex",gap:12,alignItems:"flex-start",background:"rgba(78,205,196,.04)",border:"1px solid rgba(78,205,196,.12)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(78,205,196,.12)",border:"1px solid rgba(78,205,196,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#4ECDC4",flexShrink:0}}>{s.icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>{s.title}</div>
                <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.5}}>{s.desc}</div>
              </div>
            </div>
          );})}
        </div>
      </Panel>

      <Panel style={{padding:"24px"}}>
        <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:17,color:"#E8A838",marginBottom:14}}>General Rules</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            "All players must check in before the tournament start time.",
            "Players who fail to check in will forfeit their spot.",
            "Disconnects during a game count as a loss (8th place) unless the lobby agrees to a remake.",
            "Intentional griefing, win-trading, or collusion will result in disqualification.",
            "Tournament hosts have final say on all disputes.",
            "Results are final once published by the tournament admin.",
            "Free to compete — no entry fee required for standard clashes."
          ].map(function(rule,i){return(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:i<6?"1px solid rgba(242,237,228,.05)":"none"}}>
              <span style={{color:"#E8A838",fontWeight:700,fontSize:13,flexShrink:0}}>•</span>
              <span style={{fontSize:13,color:"#BECBD9",lineHeight:1.5}}>{rule}</span>
            </div>
          );})}
        </div>
      </Panel>
    </div>
  );
}



// ─── FAQ SCREEN ───────────────────────────────────────────────────────────────

function FAQScreen({setScreen}){
  var [open,setOpen]=useState(null);

  var faqs=[
    {q:"How does the points system work?",a:"Points are awarded based on your final placement in each game: 1st = 8 pts, 2nd = 7, 3rd = 6, 4th = 5, 5th = 4, 6th = 3, 7th = 2, 8th = 1. These follow the official EMEA rulebook scoring."},
    {q:"How do I join a clash?",a:"Navigate to the Home screen and click 'Register' on an upcoming clash. You'll need to create a free account first. Check in before the start time to confirm your spot."},
    {q:"Is it free to play?",a:"Yes! TFT Clash is always free to compete. There is no paywall on tournament entry. Pro and Host tiers offer additional features but are never required to play."},
    {q:"What does Pro ($4.99/mo) include?",a:"Pro members get advanced stats and analytics, priority tournament registration, custom profile badges, detailed match history exports, and access to exclusive Pro-only clashes."},
    {q:"What does the Host tier ($19.99/mo) include?",a:"Host tier includes everything in Pro, plus the ability to create and manage your own tournaments, custom branding/logos, announcement tools, player management, and a dedicated tournament dashboard."},
    {q:"How do tiebreakers work?",a:"Ties are broken in order: (1) total tournament points, (2) wins + top-4s (wins count twice), (3) most of each placement from 1st down, (4) most recent game finish."},
    {q:"What are scrims?",a:"Scrims are practice lobbies for players with scrim access. They don't count toward official standings but help you prepare. Contact an admin to request scrim access."},
    {q:"How does the season work?",a:"Each season runs for a set number of weeks with weekly clashes. Points accumulate across all clashes. The player with the most points at the end is crowned Season Champion and enters the Hall of Fame."},
    {q:"Can I host my own tournament?",a:"Yes! Apply as a host through the Host Application page. Once approved, you get access to the Host Dashboard where you can create events, manage registrations, and run brackets."},
    {q:"What happens if I disconnect?",a:"Disconnects count as 8th place unless the lobby unanimously agrees to a remake. Make sure your connection is stable before joining."}
  ];

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>Frequently Asked Questions</h2>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {faqs.map(function(faq,i){
          var isOpen=open===i;
          return(
            <div key={i} style={{background:isOpen?"rgba(155,114,207,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(isOpen?"rgba(155,114,207,.25)":"rgba(242,237,228,.08)"),borderRadius:12,overflow:"hidden",transition:"all .2s"}}>
              <button onClick={function(){setOpen(isOpen?null:i);}} style={{width:"100%",padding:"16px 18px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,textAlign:"left"}}>
                <span style={{fontSize:14,fontWeight:600,color:isOpen?"#C4B5FD":"#F2EDE4",lineHeight:1.4}}>{faq.q}</span>
                <span style={{fontSize:18,color:isOpen?"#9B72CF":"#8896A8",flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(45deg)":"rotate(0deg)"}}>+</span>
              </button>
              {isOpen&&(
                <div style={{padding:"0 18px 16px 18px"}}>
                  <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.7}}>{faq.a}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── PRIVACY POLICY ──────────────────────────────────────────────────────────

function PrivacyScreen(props){
  var setScreen=props.setScreen;
  return(
    <div className="page wrap" style={{maxWidth:720,margin:"0 auto"}}>
      <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>{"← Back"}</Btn>
      <h1 style={{color:"#F2EDE4",fontSize:26,marginTop:16,marginBottom:24,fontFamily:"'Playfair Display',serif"}}>Privacy Policy</h1>
      <div style={{color:"#BECBD9",fontSize:14,lineHeight:1.8}}>
        <p style={{marginBottom:16}}><strong style={{color:"#F2EDE4"}}>Effective Date:</strong> March 2026</p>
        <p style={{marginBottom:16}}>TFT Clash ("we", "us") respects your privacy. This policy explains what data we collect, how we use it, and your rights.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>1. Data We Collect</h3>
        <p style={{marginBottom:16}}>When you create an account, we collect your email address, username, and optionally your Riot ID and Discord username. During tournaments, we record your game placements and points. We also store session cookies to keep you logged in.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>2. How We Use Your Data</h3>
        <p style={{marginBottom:16}}>Your data is used to operate the platform: displaying leaderboards, tracking tournament results, managing subscriptions, and sending you relevant notifications. We never sell your data to third parties.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>3. Data Storage</h3>
        <p style={{marginBottom:16}}>Data is stored in Supabase (EU West region) with row-level security. Passwords are handled by Supabase Auth and never stored in plaintext. Payment data is processed by Stripe and never touches our servers.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>4. Your Rights</h3>
        <p style={{marginBottom:16}}>You can request deletion of your account and data at any time by contacting us. You can export your stats from your profile page. Under GDPR, you have the right to access, correct, and delete your personal data.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>5. Cookies</h3>
        <p style={{marginBottom:16}}>We use essential cookies for authentication and session management. We do not use tracking cookies. Analytics (if enabled) use privacy-respecting, cookieless solutions.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>6. Contact</h3>
        <p style={{marginBottom:16}}>For privacy questions or data requests, reach out via Discord or email at the address listed on our GitHub repository.</p>
      </div>
    </div>
  );
}

// ─── TERMS OF SERVICE ────────────────────────────────────────────────────────

function TermsScreen(props){
  var setScreen=props.setScreen;
  return(
    <div className="page wrap" style={{maxWidth:720,margin:"0 auto"}}>
      <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>{"← Back"}</Btn>
      <h1 style={{color:"#F2EDE4",fontSize:26,marginTop:16,marginBottom:24,fontFamily:"'Playfair Display',serif"}}>Terms of Service</h1>
      <div style={{color:"#BECBD9",fontSize:14,lineHeight:1.8}}>
        <p style={{marginBottom:16}}><strong style={{color:"#F2EDE4"}}>Effective Date:</strong> March 2026</p>
        <p style={{marginBottom:16}}>By using TFT Clash, you agree to these terms. If you disagree, please do not use the platform.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>1. Eligibility</h3>
        <p style={{marginBottom:16}}>You must be at least 16 years old to create an account. By signing up, you confirm you meet this requirement.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>2. Fair Play</h3>
        <p style={{marginBottom:16}}>All participants must compete fairly. Cheating, match-fixing, account sharing, or exploiting bugs results in immediate disqualification and potential permanent ban. Decisions by tournament admins are final.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>3. Accounts</h3>
        <p style={{marginBottom:16}}>You are responsible for your account security. Do not share credentials. One account per person. We reserve the right to suspend or terminate accounts that violate these terms.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>4. Subscriptions</h3>
        <p style={{marginBottom:16}}>Pro and Host subscriptions are billed monthly via Stripe. You can cancel anytime from your account page. Refunds are handled on a case-by-case basis. Free-to-compete access is never restricted by subscription status.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>5. Content</h3>
        <p style={{marginBottom:16}}>Tournament results, leaderboards, and player stats are public. By participating, you agree to your username and results being displayed publicly. Offensive usernames or behavior will be moderated.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>6. Limitation of Liability</h3>
        <p style={{marginBottom:16}}>TFT Clash is provided "as is". We are not liable for service interruptions, data loss, or tournament disputes. We make best efforts to maintain uptime and data integrity.</p>
        <h3 style={{color:"#C4B5FD",fontSize:16,marginBottom:8,marginTop:24}}>7. Changes</h3>
        <p style={{marginBottom:16}}>We may update these terms. Continued use after changes constitutes acceptance. Material changes will be announced on the platform.</p>
      </div>
    </div>
  );
}


// ─── ROOT ─────────────────────────────────────────────────────────────────────


// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer(props){
  var setScreen=props.setScreen;
  var platformLinks=[["home","Home"],["roster","Roster"],["leaderboard","Leaderboard"],["hof","Hall of Fame"],["archive","Archive"]];
  var communityLinks=[["featured","Featured Events"],["rules","Rules"],["faq","FAQ"]];
  var hostingLinks=[["pricing","Pricing"],["host-apply","Apply to Host"],["host-dashboard","Host Dashboard"]];
  return(
    <footer style={{background:"#06060C",borderTop:"1px solid rgba(155,114,207,.15)",padding:"40px 24px 24px",marginTop:40}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:32,marginBottom:32}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Platform</div>
            {platformLinks.map(function(arr){return(
              <button key={arr[0]} onClick={function(){setScreen(arr[0]);}} style={{display:"block",background:"none",border:"none",color:"#8896A8",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit",transition:"color .15s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="#F2EDE4";}}
                onMouseLeave={function(e){e.currentTarget.style.color="#8896A8";}}>{arr[1]}</button>
            );})}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Community</div>
            {communityLinks.map(function(arr){return(
              <button key={arr[0]} onClick={function(){setScreen(arr[0]);}} style={{display:"block",background:"none",border:"none",color:"#8896A8",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit",transition:"color .15s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="#F2EDE4";}}
                onMouseLeave={function(e){e.currentTarget.style.color="#8896A8";}}>{arr[1]}</button>
            );})}
            <button onClick={function(){}} style={{display:"block",background:"none",border:"none",color:"#8896A8",fontSize:13,padding:"4px 0",cursor:"not-allowed",fontFamily:"inherit",opacity:0.5}}>Discord (Coming Soon)</button>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Hosting</div>
            {hostingLinks.map(function(arr){return(
              <button key={arr[0]} onClick={function(){setScreen(arr[0]);}} style={{display:"block",background:"none",border:"none",color:"#8896A8",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit",transition:"color .15s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="#F2EDE4";}}
                onMouseLeave={function(e){e.currentTarget.style.color="#8896A8";}}>{arr[1]}</button>
            );})}
          </div>
        </div>
        <div style={{borderTop:"1px solid rgba(155,114,207,.08)",paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"#8896A8"}}>{"\u00a9"} 2026 TFT Clash {"\u00b7"} Season 1 {"\u00b7"} Free to compete, always.</span>
            <button onClick={function(){setScreen("privacy");}} style={{background:"none",border:"none",color:"#5A6573",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",padding:0}}>Privacy</button>
            <button onClick={function(){setScreen("terms");}} style={{background:"none",border:"none",color:"#5A6573",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",padding:0}}>Terms</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <img src="/icon-border.png" alt="" style={{width:16,height:16,opacity:0.4}}/>
            <span style={{fontSize:10,color:"#5A6573"}}>Built for the community</span>
          </div>
        </div>
      </div>
    </footer>
  );
}


function TFTClash(){

  const [screen,setScreen]=useState(function(){var h=window.location.hash.replace("#","");return h||"home";});

  const [players,setPlayers]=useState(()=>{try{const s=localStorage.getItem("tft-players");return s?JSON.parse(s):[];}catch{return [];}});

  const [isLoadingData,setIsLoadingData]=useState(true);

  const [isAdmin,setIsAdmin]=useState(()=>{try{return localStorage.getItem("tft-admin")==="1";}catch{return false;}});

  const [scrimAccess,setScrimAccess]=useState([]);
  const [tickerOverrides,setTickerOverrides]=useState([]);

  const [scrimSessions,setScrimSessions]=useState([]);


  const [notifications,setNotifications]=useState(()=>{try{const s=localStorage.getItem("tft-notifications");return s?JSON.parse(s):NOTIF_SEED;}catch{return NOTIF_SEED;}});

  const [toasts,setToasts]=useState([]);

  const [disputes]=useState([]);

  const [announcement,setAnnouncement]=useState(()=>{try{return localStorage.getItem("tft-announcement")||"";}catch{return "";}});

  const [profilePlayer,setProfilePlayer]=useState(null);

  const [tournamentState,setTournamentState]=useState(()=>{try{const s=localStorage.getItem("tft-tournament");return s?JSON.parse(s):{phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[]};}catch{return {phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[]};}});

  const [seasonConfig,setSeasonConfig]=useState(()=>{try{var s=localStorage.getItem("tft-season-config");return s?JSON.parse(s):DEFAULT_SEASON_CONFIG;}catch(e){return DEFAULT_SEASON_CONFIG;}});

  const [quickClashes,setQuickClashes]=useState(()=>{try{var s=localStorage.getItem("tft-events");return s?JSON.parse(s):[];}catch(e){return [];}});

  const [orgSponsors,setOrgSponsors]=useState(()=>{try{var s=localStorage.getItem("tft-sponsors");return s?JSON.parse(s):{};}catch(e){return {};}});

  const [scheduledEvents,setScheduledEvents]=useState(()=>{try{var s=localStorage.getItem('tft-scheduled-events');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [auditLog,setAuditLog]=useState(()=>{try{var s=localStorage.getItem('tft-audit-log');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [hostApps,setHostApps]=useState(()=>{try{var s=localStorage.getItem('tft-host-apps');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [hostTournaments,setHostTournaments]=useState(function(){try{var s=localStorage.getItem('tft-host-tournaments');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [hostBranding,setHostBranding]=useState(function(){try{var s=localStorage.getItem('tft-host-branding');return s?JSON.parse(s):{};}catch(e){return {};}});

  const [hostAnnouncements,setHostAnnouncements]=useState(function(){try{var s=localStorage.getItem('tft-host-announcements');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [pastClashes,setPastClashes]=useState([]);

  const [featuredEvents,setFeaturedEvents]=useState(function(){try{var s=localStorage.getItem('tft-featured-events');return s?JSON.parse(s):[];}catch(e){return [];}});



  const [challengeCompletions,setChallengeCompletions]=useState(function(){try{var s=localStorage.getItem('tft-challenge-completions');return s?JSON.parse(s):{};}catch(e){return {};}});

  // Auth state

  const [currentUser,setCurrentUser]=useState(null); // null = guest; hydrated by Supabase auth
  const [isAuthLoading,setIsAuthLoading]=useState(true);

  const [authScreen,setAuthScreen]=useState(null); // "login" | "signup" | null
  const [cookieConsent,setCookieConsent]=useState(function(){try{return localStorage.getItem("tft-cookie-consent")==="1";}catch(e){return false;}});



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

      const riotId=u.user_metadata?.riotId||"";

      const region=u.user_metadata?.riotRegion||u.user_metadata?.region||"EUW";

      return{...u,username,riotId,region};

    }

    supabase.auth.getSession().then(({data:{session}})=>{setCurrentUser(mapUser(session?.user??null));setIsAuthLoading(false);}).catch(function(){setIsAuthLoading(false);});

    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>setCurrentUser(mapUser(session?.user??null)));

    return ()=>subscription.unsubscribe();

  },[]);

  // Load host branding from host_profiles DB on auth
  useEffect(function(){
    if(!currentUser||!supabase.from)return;
    supabase.from("host_profiles").select("*").eq("user_id",currentUser.id).single()
      .then(function(res){
        if(res.data&&res.data.status==="approved"){
          setHostBranding({name:res.data.org_name||"",logo:res.data.logo_url||"\ud83c\udfae",color:res.data.brand_color||"#9B72CF",bio:res.data.bio||"",logoUrl:res.data.logo_url||"",bannerUrl:res.data.banner_url||""});
        }
      });
  },[currentUser]);

  // ── Hash routing — single popstate handler for back/forward ────────────
  var navSourceRef=useRef("user");
  useEffect(function(){function onPop(){navSourceRef.current="popstate";var h=window.location.hash.replace("#","");if(h==="standings")h="leaderboard";setScreen(h||"home");}window.addEventListener("popstate",onPop);return function(){window.removeEventListener("popstate",onPop);};},[]);

  // ── Screen→hash sync: auto-updates URL, title, meta, scroll on any screen change ──
  useEffect(function(){
    if(navSourceRef.current==="popstate"){navSourceRef.current="user";}
    else{try{window.history.pushState({screen:screen},"","#"+screen);}catch(e){}}
    var titles={home:"Home",standings:"Standings",bracket:"Bracket",leaderboard:"Leaderboard",hof:"Hall of Fame",archive:"Archive",milestones:"Milestones",challenges:"Challenges",results:"Results",pricing:"Pricing",admin:"Admin",scrims:"Scrims",rules:"Rules",faq:"FAQ",featured:"Events",account:"Account",recap:"Season Recap",roster:"Roster","host-apply":"Host Application","host-dashboard":"Host Dashboard",profile:"Player Profile",privacy:"Privacy Policy",terms:"Terms of Service"};
    var t=titles[screen]||(screen.indexOf("tournament-")===0?"Tournament":"");
    document.title="TFT Clash"+(t?" \u2014 "+t:"");
    var descs={home:"Weekly TFT tournaments for competitive players. Free to compete, real rankings, community-driven.",standings:"Live season standings and rankings for TFT Clash tournaments.",bracket:"Tournament bracket, lobby assignments, and live results.",leaderboard:"Full leaderboard with stats, comparisons, and streak tracking.",hof:"Hall of Fame \u2014 records, champions, and legends of TFT Clash.",archive:"Past tournament results and clash history.",pricing:"TFT Clash subscription plans \u2014 Player (free), Pro, and Host tiers.",rules:"Official TFT Clash tournament rules, scoring, and tiebreaker system.",faq:"Frequently asked questions about TFT Clash tournaments.",featured:"Browse upcoming and featured TFT tournaments.",privacy:"TFT Clash privacy policy \u2014 how we handle your data.",terms:"TFT Clash terms of service \u2014 rules for using the platform."};
    var desc=descs[screen]||"TFT Clash \u2014 weekly competitive TFT tournaments.";
    var metaDesc=document.querySelector('meta[name="description"]');
    if(metaDesc)metaDesc.setAttribute("content",desc);
    var ogTitle=document.querySelector('meta[property="og:title"]');
    if(ogTitle)ogTitle.setAttribute("content","TFT Clash"+(t?" \u2014 "+t:""));
    var ogDesc=document.querySelector('meta[property="og:description"]');
    if(ogDesc)ogDesc.setAttribute("content",desc);
    window.scrollTo(0,0);
  },[screen]);

  // ── Stamp checkedIn from tournamentState.checkedInIds onto players ────────────

  useEffect(function(){

    var ids=new Set((tournamentState.checkedInIds||[]).map(String));

    setPlayers(function(ps){return ps.map(function(p){return{...p,checkedIn:ids.has(String(p.id))};});});

  },[tournamentState.checkedInIds]);

  // localStorage sync (fast cache)

  useEffect(()=>{try{localStorage.setItem("tft-players",JSON.stringify(players));}catch{}},[players]);

  useEffect(()=>{try{localStorage.setItem("tft-notifications",JSON.stringify(notifications));}catch{}},[notifications]);

  useEffect(()=>{try{localStorage.setItem("tft-admin",isAdmin?"1":"0");}catch{}},[isAdmin]);

  useEffect(()=>{try{localStorage.setItem("tft-tournament",JSON.stringify(tournamentState));}catch{}},[tournamentState]);

  useEffect(function(){try{localStorage.setItem("tft-season-config",JSON.stringify(seasonConfig));}catch(e){}},[seasonConfig]);

  useEffect(function(){try{localStorage.setItem("tft-events",JSON.stringify(quickClashes));}catch(e){}},[quickClashes]);

  useEffect(function(){try{localStorage.setItem("tft-sponsors",JSON.stringify(orgSponsors));}catch(e){}},[orgSponsors]);

  useEffect(function(){try{localStorage.setItem("tft-announcement",announcement);}catch(e){}},[announcement]);
  useEffect(function(){try{localStorage.setItem("tft-scheduled-events",JSON.stringify(scheduledEvents));}catch(e){}},[scheduledEvents]);
  useEffect(function(){try{localStorage.setItem("tft-audit-log",JSON.stringify(auditLog));}catch(e){}},[auditLog]);
  useEffect(function(){try{localStorage.setItem("tft-host-apps",JSON.stringify(hostApps));}catch(e){}},[hostApps]);



  // ── Bootstrap players from players table (fallback when site_settings has none) ──
  function bootstrapPlayersFromTable(){
    if(!supabase.from)return;
    supabase.from('players').select('*').order('username',{ascending:true})
      .then(function(res){
        if(res.error){console.error("[TFT] Failed to bootstrap players:",res.error);return;}
        if(!res.data||!res.data.length)return;
        var mapped=res.data.map(function(r){
          return{
            id:r.id,name:r.username,username:r.username,
            riotId:r.riot_id||'',rank:r.rank||'Iron',region:r.region||'EUW',
            bio:r.bio||'',discord_user_id:r.discord_user_id||null,
            pts:0,wins:0,top4:0,games:0,avg:"0",
            banned:false,dnpCount:0,notes:'',checkedIn:false,
            clashHistory:[],sparkline:[],bestStreak:0,currentStreak:0,
            tiltStreak:0,bestHaul:0,attendanceStreak:0,lastClashId:null,
            role:"player",sponsor:null
          };
        });
        // Aggregate stats from game_results table if available
        supabase.from('game_results').select('player_id,placement,points')
          .then(function(gr){
            if(!gr.error&&gr.data&&gr.data.length>0){
              var statsMap={};
              gr.data.forEach(function(g){
                var pid=g.player_id;
                if(!statsMap[pid])statsMap[pid]={pts:0,wins:0,top4:0,games:0,totalPlace:0};
                statsMap[pid].games+=1;
                statsMap[pid].pts+=g.points||0;
                statsMap[pid].totalPlace+=g.placement||0;
                if(g.placement===1)statsMap[pid].wins+=1;
                if(g.placement<=4)statsMap[pid].top4+=1;
              });
              mapped=mapped.map(function(p){
                var s=statsMap[p.id];
                if(!s)return p;
                return Object.assign({},p,{pts:s.pts,wins:s.wins,top4:s.top4,games:s.games,avg:s.games>0?(s.totalPlace/s.games).toFixed(1):"0"});
              });
            }
            setPlayers(mapped);
            supabase.from('site_settings').upsert({key:'players',value:JSON.stringify(mapped),updated_at:new Date().toISOString()})
              .then(function(res){if(res.error)console.error("[TFT] Failed to cache players:",res.error);});
          });
      });
  }

  // ── Supabase shared state — single channel for all keys ──────────────────

  const rtRef=useRef({players:false,tournament_state:false,quick_clashes:false,announcement:false,season_config:false,org_sponsors:false,scheduled_events:false,audit_log:false,host_apps:false,host_tournaments:false,host_branding:false,host_announcements:false,featured_events:false,challenge_completions:false,scrim_access:false,scrim_data:false,ticker_overrides:false});

  const announcementInitRef=useRef(false);

  useEffect(function(){

    if(!supabase.from){setIsLoadingData(false);return;}

    // fetch all shared keys on mount

    supabase.from('site_settings').select('key,value')

      .in('key',['players','tournament_state','quick_clashes','announcement','season_config','org_sponsors','scheduled_events','audit_log','host_apps','scrim_access','scrim_data','ticker_overrides','host_tournaments','host_branding','host_announcements','featured_events','challenge_completions'])

      .then(function(res){

        if(!res.data){bootstrapPlayersFromTable();return;}

        var hadPlayers=false;

        res.data.forEach(function(row){

          try{

            if(row.key==='announcement'){rtRef.current.announcement=true;setAnnouncement(typeof row.value==='string'?row.value:JSON.stringify(row.value)||'');}

            else{

              var val=typeof row.value==='string'?JSON.parse(row.value):row.value;

              if(row.key==='players'){rtRef.current.players=true;if(Array.isArray(val)){setPlayers(val);}hadPlayers=true;}
              if(row.key==='tournament_state'&&val){rtRef.current.tournament_state=true;setTournamentState(val);}

              if(row.key==='quick_clashes'&&Array.isArray(val)){rtRef.current.quick_clashes=true;setQuickClashes(val);}

              if(row.key==='season_config'&&val){rtRef.current.season_config=true;setSeasonConfig(val);}

              if(row.key==='org_sponsors'&&val){rtRef.current.org_sponsors=true;setOrgSponsors(val);}

              if(row.key==='scheduled_events'&&Array.isArray(val)){rtRef.current.scheduled_events=true;setScheduledEvents(val);}

              if(row.key==='audit_log'&&Array.isArray(val)){rtRef.current.audit_log=true;setAuditLog(val);}

              if(row.key==='host_apps'&&Array.isArray(val)){rtRef.current.host_apps=true;setHostApps(val);}

              if(row.key==='scrim_access'&&Array.isArray(val)){rtRef.current.scrim_access=true;setScrimAccess(val);}

              if(row.key==='ticker_overrides'&&Array.isArray(val)){rtRef.current.ticker_overrides=true;setTickerOverrides(val);}

              if(row.key==='scrim_data'&&Array.isArray(val)){rtRef.current.scrim_data=true;setScrimSessions(val);}

              if(row.key==='host_tournaments'&&Array.isArray(val)){rtRef.current.host_tournaments=true;setHostTournaments(val);}

              if(row.key==='host_branding'&&val){rtRef.current.host_branding=true;setHostBranding(val);}

              if(row.key==='host_announcements'&&Array.isArray(val)){rtRef.current.host_announcements=true;setHostAnnouncements(val);}

              if(row.key==='featured_events'&&Array.isArray(val)){rtRef.current.featured_events=true;setFeaturedEvents(val);}

              if(row.key==='challenge_completions'&&val){rtRef.current.challenge_completions=true;setChallengeCompletions(val);}


            }

          }catch(e){console.warn("Failed to parse site_settings row:",row.key,e);}

        });

        announcementInitRef.current=true;

        if(!hadPlayers)bootstrapPlayersFromTable();
        setIsLoadingData(false);

      });

    // realtime — push changes to all browsers instantly

    var ch=supabase.channel('shared_state')

      .on('postgres_changes',{event:'*',schema:'public',table:'site_settings'},function(payload){

        try{

          var key=payload.new&&payload.new.key;

          var raw=payload.new&&payload.new.value;

          if(!key)return;

          if(key==='announcement'){rtRef.current.announcement=true;setAnnouncement(typeof raw==='string'?raw:JSON.stringify(raw)||'');return;}

          var val=typeof raw==='string'?JSON.parse(raw||'null'):raw;

          if(!val)return;

          if(key==='players'&&Array.isArray(val)&&val.length>0){rtRef.current.players=true;setPlayers(val);}
          if(key==='tournament_state'){rtRef.current.tournament_state=true;setTournamentState(val);}

          if(key==='quick_clashes'&&Array.isArray(val)){rtRef.current.quick_clashes=true;setQuickClashes(val);}

          if(key==='season_config'&&val){rtRef.current.season_config=true;setSeasonConfig(val);}

          if(key==='org_sponsors'&&val){rtRef.current.org_sponsors=true;setOrgSponsors(val);}

          if(key==='scheduled_events'&&Array.isArray(val)){rtRef.current.scheduled_events=true;setScheduledEvents(val);}

          if(key==='audit_log'&&Array.isArray(val)){rtRef.current.audit_log=true;setAuditLog(val);}

          if(key==='host_apps'&&Array.isArray(val)){rtRef.current.host_apps=true;setHostApps(val);}

          if(key==='scrim_access'&&Array.isArray(val)){rtRef.current.scrim_access=true;setScrimAccess(val);}

          if(key==='ticker_overrides'&&Array.isArray(val)){rtRef.current.ticker_overrides=true;setTickerOverrides(val);}

          if(key==='scrim_data'&&Array.isArray(val)){rtRef.current.scrim_data=true;setScrimSessions(val);}

          if(key==='host_tournaments'&&Array.isArray(val)){rtRef.current.host_tournaments=true;setHostTournaments(val);}

          if(key==='host_branding'&&val){rtRef.current.host_branding=true;setHostBranding(val);}

          if(key==='host_announcements'&&Array.isArray(val)){rtRef.current.host_announcements=true;setHostAnnouncements(val);}

          if(key==='featured_events'&&Array.isArray(val)){rtRef.current.featured_events=true;setFeaturedEvents(val);}

          if(key==='challenge_completions'&&val){rtRef.current.challenge_completions=true;setChallengeCompletions(val);}


        }catch(e){console.warn("Failed to parse realtime update:",e);}

      })

      .subscribe();

    return function(){supabase.removeChannel(ch);};

  },[]);



  // save shared state to Supabase on every change (skip if change came from Supabase)

  useEffect(function(){

    if(rtRef.current.tournament_state){rtRef.current.tournament_state=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'tournament_state',value:JSON.stringify(tournamentState),updated_at:new Date().toISOString()})
      .then(function(res){if(res.error)console.error("[TFT] Failed to sync tournament_state:",res.error);});

  },[tournamentState]);

  useEffect(function(){

    if(rtRef.current.quick_clashes){rtRef.current.quick_clashes=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'quick_clashes',value:JSON.stringify(quickClashes),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});

  },[quickClashes]);

  useEffect(function(){

    if(!announcementInitRef.current)return;

    if(rtRef.current.announcement){rtRef.current.announcement=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(announcement),updated_at:new Date().toISOString()}).then(function(res){if(res.error)console.error("[TFT] Failed to sync announcement:",res.error);});

  },[announcement]);

  useEffect(function(){

    if(rtRef.current.season_config){rtRef.current.season_config=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'season_config',value:JSON.stringify(seasonConfig),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});

  },[seasonConfig]);

  useEffect(function(){

    if(rtRef.current.org_sponsors){rtRef.current.org_sponsors=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'org_sponsors',value:JSON.stringify(orgSponsors),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});

  },[orgSponsors]);

  useEffect(function(){

    if(rtRef.current.scheduled_events){rtRef.current.scheduled_events=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'scheduled_events',value:JSON.stringify(scheduledEvents),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});

  },[scheduledEvents]);

  useEffect(function(){

    if(rtRef.current.audit_log){rtRef.current.audit_log=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'audit_log',value:JSON.stringify(auditLog),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});

  },[auditLog]);

  useEffect(function(){

    if(rtRef.current.host_apps){rtRef.current.host_apps=false;return;}

    if(supabase.from)supabase.from('site_settings').upsert({key:'host_apps',value:JSON.stringify(hostApps),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});

  },[hostApps]);

  useEffect(function(){
    if(rtRef.current.players){rtRef.current.players=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'players',value:JSON.stringify(players),updated_at:new Date().toISOString()})
      .then(function(res){if(res.error)console.error("[TFT] Failed to sync players:",res.error);});
  },[players]);

  useEffect(function(){
    if(rtRef.current.scrim_access){rtRef.current.scrim_access=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'scrim_access',value:JSON.stringify(scrimAccess),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[scrimAccess]);

  useEffect(function(){
    if(rtRef.current.scrim_data){rtRef.current.scrim_data=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'scrim_data',value:JSON.stringify(scrimSessions),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[scrimSessions]);

  useEffect(function(){
    if(rtRef.current.ticker_overrides){rtRef.current.ticker_overrides=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'ticker_overrides',value:JSON.stringify(tickerOverrides),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[tickerOverrides]);

  useEffect(function(){
    if(rtRef.current.host_tournaments){rtRef.current.host_tournaments=false;return;}
    localStorage.setItem('tft-host-tournaments',JSON.stringify(hostTournaments));
    if(supabase.from)supabase.from('site_settings').upsert({key:'host_tournaments',value:JSON.stringify(hostTournaments),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[hostTournaments]);

  useEffect(function(){
    if(rtRef.current.host_branding){rtRef.current.host_branding=false;return;}
    localStorage.setItem('tft-host-branding',JSON.stringify(hostBranding));
    if(supabase.from)supabase.from('site_settings').upsert({key:'host_branding',value:JSON.stringify(hostBranding),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[hostBranding]);

  useEffect(function(){
    if(rtRef.current.host_announcements){rtRef.current.host_announcements=false;return;}
    localStorage.setItem('tft-host-announcements',JSON.stringify(hostAnnouncements));
    if(supabase.from)supabase.from('site_settings').upsert({key:'host_announcements',value:JSON.stringify(hostAnnouncements),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[hostAnnouncements]);

  useEffect(function(){
    if(rtRef.current.featured_events){rtRef.current.featured_events=false;return;}
    localStorage.setItem('tft-featured-events',JSON.stringify(featuredEvents));
    if(supabase.from)supabase.from('site_settings').upsert({key:'featured_events',value:JSON.stringify(featuredEvents),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[featuredEvents]);



  useEffect(function(){
    if(rtRef.current.challenge_completions){rtRef.current.challenge_completions=false;return;}
    localStorage.setItem('tft-challenge-completions',JSON.stringify(challengeCompletions));
    if(supabase.from)supabase.from('site_settings').upsert({key:'challenge_completions',value:JSON.stringify(challengeCompletions),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[challengeCompletions]);


  // Load past clashes from tournament_results + tournaments tables
  useEffect(function(){
    if(!supabase.from||!players.length)return;
    supabase.from('tournaments').select('id,name,date').eq('phase','complete').order('date',{ascending:false})
      .then(function(res){
        if(res.error){console.error("Failed to load tournaments:",res.error);return;}
        if(!res.data||!res.data.length)return;
        var tIds=res.data.map(function(t){return t.id;});
        supabase.from('tournament_results').select('tournament_id,player_id,final_placement,total_points')
          .in('tournament_id',tIds).order('final_placement',{ascending:true})
          .then(function(rRes){
            if(rRes.error){console.error("Failed to load results:",rRes.error);return;}
            if(!rRes.data)return;
            var clashes=res.data.map(function(t){
              var results=rRes.data.filter(function(r){return r.tournament_id===t.id;});
              var top8=results.slice(0,8).map(function(r){
                var p=players.find(function(pl){return String(pl.id)===String(r.player_id);});
                return p?p.name:('Player '+r.player_id);
              });
              return{id:t.id,name:t.name,date:t.date,season:'S1',players:results.length,lobbies:Math.ceil(results.length/8),champion:top8[0]||'Unknown',top3:top8};
            });
            setPastClashes(clashes);
          });
      });
  },[players]);

  function navTo(s){
    if(s==="standings")s="leaderboard";
    if(s==="admin"&&!isAdmin){toast("Admin access required","error");return;}
    var canScrims=isAdmin||(currentUser&&scrimAccess.includes(currentUser.username));
    if(s==="scrims"&&!canScrims){toast("Access restricted","error");return;}
    setScreen(s);
  }

  useEffect(function(){
    var params=new URLSearchParams(window.location.search);
    if(params.get("error")){
      var desc=params.get("error_description")||"Sign-in failed. Please try again.";
      toast(decodeURIComponent(desc.replace(/\+/g," ")),"error");
    }
    if(params.get("checkout")==="success"){
      toast("Subscription activated! Welcome to Pro. ✨","success");
      window.history.replaceState({},"",window.location.pathname+"#account");
    }
    var h=window.location.hash.slice(1);
    var isAuthCallback=h.startsWith("access_token")||h.startsWith("error_description")||params.get("code");
    if(isAuthCallback)return;
    var safeScreens=["home","standings","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms"];
    var isSafe=safeScreens.includes(h)||h.indexOf("tournament-")===0;
    var dest=isSafe?h:"home";
    if(dest!=="home")setScreen(dest);
    window.history.replaceState({screen:dest},"","#"+dest);
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

  function handleRegister(playerId){
    var sid=String(playerId);
    var isRegistered=(tournamentState.registeredIds||[]).includes(sid);
    setTournamentState(function(ts){
      var ids=ts.registeredIds||[];
      return {...ts,registeredIds:isRegistered?ids.filter(function(id){return id!==sid;}):[...ids,sid]};
    });
    toast(isRegistered?"Unregistered from next clash":"Registered for next clash!",isRegistered?"info":"success");
  }

  function joinQuickClash(qcId,playerId){

    setQuickClashes(function(qs){return qs.map(function(q){

      if(q.id!==qcId||q.players.includes(playerId)) return q;

      var np=q.players.concat([playerId]);

      return Object.assign({},q,{players:np,status:np.length>=q.cap?"full":q.status});

    });});

  }



  // -- Compute SEASON_CHAMPION from live standings --
  if(players&&players.length>0){
    var scSorted=players.slice().sort(function(a,b){return(b.pts||0)-(a.pts||0);});
    var scTop=scSorted[0];
    if(scTop&&scTop.pts>0){
      SEASON_CHAMPION={name:scTop.name,title:"Season Leader",season:seasonConfig.name||"Season 1",since:"",pts:scTop.pts,wins:scTop.wins||0,rank:scTop.rank||"Challenger"};
    }else{
      SEASON_CHAMPION=null;
    }
  }else{
    SEASON_CHAMPION=null;
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

        @keyframes ticker-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

        .ticker-scroll{display:flex;width:max-content;animation:ticker-scroll 32s linear infinite;will-change:transform;}

        .ticker-scroll:hover{animation-play-state:paused;}

      `}</style>

      <Hexbg/>

      {(isLoadingData||isAuthLoading)&&(
        <div style={{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:9999}}>
          <div style={{width:48,height:48,border:"3px solid rgba(155,114,207,.2)",borderTopColor:"#9B72CF",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          <div style={{fontFamily:"'Chakra Petch',sans-serif",fontSize:14,color:"#6B7280",letterSpacing:"0.1em"}}>Loading...</div>
        </div>
      )}

      <div style={{position:"relative",zIndex:1,minHeight:"100vh"}}>

        <Navbar screen={screen} setScreen={navTo} players={players} isAdmin={isAdmin} setIsAdmin={setIsAdmin} toast={toast} disputes={disputes}

          currentUser={currentUser} onAuthClick={(mode)=>setAuthScreen(mode)} notifications={notifications} onMarkAllRead={markAllRead} scrimAccess={scrimAccess}/>



        <ScreenBoundary key={screen} name={screen} onHome={function(){navTo("home");}}>

        {screen==="home"       &&<HomeScreen players={players} setPlayers={setPlayers} setScreen={navTo} toast={toast} announcement={announcement} setProfilePlayer={setProfilePlayer} currentUser={currentUser} onAuthClick={(m)=>setAuthScreen(m)} tournamentState={tournamentState} setTournamentState={setTournamentState} quickClashes={quickClashes} onJoinQuickClash={joinQuickClash} onRegister={handleRegister} tickerOverrides={tickerOverrides} hostAnnouncements={hostAnnouncements} featuredEvents={featuredEvents}/>}

        {screen==="roster"     &&<RosterScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser}/>}

        {screen==="bracket"    &&<BracketScreen players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig}/>}

        {screen==="leaderboard"&&<LeaderboardScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser}/>}

        {screen==="profile"    &&profilePlayer&&<PlayerProfileScreen player={profilePlayer} onBack={()=>setScreen("leaderboard")} allPlayers={players} setScreen={navTo} currentUser={currentUser} seasonConfig={seasonConfig}/>}

        {screen==="results"    &&<ResultsScreen players={players} toast={toast} setScreen={navTo} setProfilePlayer={setProfilePlayer} tournamentState={tournamentState}/>}

        {screen==="hof"        &&<HofScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} pastClashes={pastClashes}/>}

        {screen==="archive"    &&<ArchiveScreen players={players} currentUser={currentUser} setScreen={navTo} pastClashes={pastClashes}/>}

        {screen==="milestones" &&<MilestonesScreen players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser}/>}

        {screen==="challenges" &&<ChallengesScreen currentUser={currentUser} players={players} toast={toast} setScreen={navTo} challengeCompletions={challengeCompletions}/>}

        {screen==="rules"      &&<RulesScreen setScreen={navTo}/>}

        {screen==="faq"        &&<FAQScreen setScreen={navTo}/>}

        {screen==="privacy"    &&<PrivacyScreen setScreen={navTo}/>}

        {screen==="terms"      &&<TermsScreen setScreen={navTo}/>}

        {screen==="pricing"    &&<PricingScreen currentPlan={currentUser&&currentUser.plan||"free"} toast={toast} currentUser={currentUser} setScreen={navTo}/>}

        {screen==="recap"      &&profilePlayer&&<SeasonRecapScreen player={profilePlayer} players={players} toast={toast} setScreen={navTo}/>}

        {screen==="recap"      &&!profilePlayer&&<SeasonRecapScreen player={players[0]||null} players={players} toast={toast} setScreen={navTo}/>}

        {screen==="account"    &&currentUser&&<AccountScreen user={currentUser} onUpdate={updateUser} onLogout={handleLogout} toast={toast} setScreen={navTo} players={players} setProfilePlayer={setProfilePlayer} isAdmin={isAdmin} hostApps={hostApps}/>}

        {screen==="account"    &&!currentUser&&<AutoLogin setAuthScreen={setAuthScreen}/>}

        {screen==="featured"&&<FeaturedScreen setScreen={navTo} currentUser={currentUser} onAuthClick={function(m){setAuthScreen(m);}} toast={toast} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents}/>}

        {screen.indexOf("tournament-")===0&&(function(){var evId=screen.replace("tournament-","");var ev=featuredEvents.find(function(e){return e.id===evId;});if(!ev)return <div className="page wrap" style={{textAlign:"center",paddingTop:80}}><div style={{fontSize:36,marginBottom:16}}>{"\U0001f50d"}</div><h2 style={{color:"#F2EDE4",marginBottom:10}}>Event Not Found</h2><p style={{color:"#BECBD9"}}>This event may have been removed.</p><Btn v="primary" onClick={function(){navTo("featured");}}>Back to Featured</Btn></div>;return <TournamentDetailScreen event={ev} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents} currentUser={currentUser} onAuthClick={function(m){setAuthScreen(m);}} toast={toast} setScreen={navTo} players={players}/>;})()}

        {screen==="host-apply" &&<HostApplyScreen currentUser={currentUser} toast={toast} setScreen={navTo} setHostApps={setHostApps}/>}

        {screen==="host-dashboard"&&(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&(a.name===currentUser.username||a.email===currentUser.email);})))&&<HostDashboardScreen currentUser={currentUser} players={players} toast={toast} setScreen={navTo} hostApps={hostApps} hostTournaments={hostTournaments} setHostTournaments={setHostTournaments} hostBranding={hostBranding} setHostBranding={setHostBranding} hostAnnouncements={hostAnnouncements} setHostAnnouncements={setHostAnnouncements} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents}/>}

        {screen==="host-dashboard"&&!(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&(a.name===currentUser.username||a.email===currentUser.email);})))&&<div className="page wrap" style={{textAlign:"center",paddingTop:80}}><div style={{fontSize:36,marginBottom:16}}>🔒</div><h2 style={{color:"#F2EDE4",marginBottom:10}}>Host Access Required</h2><p style={{color:"#BECBD9",fontSize:14,marginBottom:20}}>Your host application is pending review. You'll be notified once approved.</p><Btn v="primary" onClick={function(){navTo("home");}}>Back to Home</Btn></div>}


        {screen==="scrims"     &&(isAdmin||(currentUser&&scrimAccess.includes(currentUser.username)))&&<ScrimsScreen players={players} toast={toast} setScreen={navTo} sessions={scrimSessions} setSessions={setScrimSessions} isAdmin={isAdmin} scrimAccess={scrimAccess} setScrimAccess={setScrimAccess} tickerOverrides={tickerOverrides} setTickerOverrides={setTickerOverrides} setNotifications={setNotifications}/>}

        {screen==="admin"      &&isAdmin&&<AdminPanel players={players} setPlayers={setPlayers} toast={toast} setAnnouncement={setAnnouncement} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig} setSeasonConfig={setSeasonConfig} quickClashes={quickClashes} setQuickClashes={setQuickClashes} orgSponsors={orgSponsors} setOrgSponsors={setOrgSponsors} scheduledEvents={scheduledEvents} setScheduledEvents={setScheduledEvents} auditLog={auditLog} setAuditLog={setAuditLog} hostApps={hostApps} setHostApps={setHostApps} scrimAccess={scrimAccess} setScrimAccess={setScrimAccess} tickerOverrides={tickerOverrides} setTickerOverrides={setTickerOverrides} setNotifications={setNotifications} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents}/>}

        {screen==="admin"      &&!isAdmin&&(

          <div className="page" style={{textAlign:"center",maxWidth:440,margin:"0 auto"}}>

            <div style={{fontSize:38,marginBottom:14}}>🔒</div>

            <h2 style={{color:"#F2EDE4",marginBottom:8}}>Admin Required</h2>

            <div style={{fontSize:13,color:"#9AAABF"}}>Contact an admin to get access.</div>

          </div>

        )}

        </ScreenBoundary>

        <Footer setScreen={navTo}/>

      </div>



      {/* Cookie Consent */}
      {!cookieConsent&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(17,24,39,.97)",borderTop:"1px solid rgba(155,114,207,.2)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:16,zIndex:9997,flexWrap:"wrap",backdropFilter:"blur(8px)"}}>
          <span style={{fontSize:13,color:"#BECBD9",maxWidth:480}}>We use essential cookies for authentication. No tracking cookies. <button onClick={function(){navTo("privacy");}} style={{background:"none",border:"none",color:"#9B72CF",cursor:"pointer",fontFamily:"inherit",fontSize:13,textDecoration:"underline",padding:0}}>Privacy Policy</button></span>
          <button onClick={function(){setCookieConsent(true);try{localStorage.setItem("tft-cookie-consent","1");}catch(e){}}} style={{padding:"8px 20px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:13,flexShrink:0}}>Got it</button>
        </div>
      )}

      {/* Toasts */}

      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

        {toasts.map(t=>(

          <div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>

        ))}

      </div>

    </>

  );

}

export default function App(){return(<ErrorBoundary><TFTClash/></ErrorBoundary>);}

