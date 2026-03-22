import React, { useState, useEffect, useRef, useMemo, useCallback, memo, Component } from "react";
import * as Sentry from '@sentry/react';

import { supabase, CANONICAL_ORIGIN } from './lib/supabase.js';

// ─── DATA VERSION  -  bump to bust stale localStorage ─────────────────────────
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

          <div style={{fontSize:48}}>{React.createElement("i",{className:"ti ti-alert-triangle",style:{color:"#E8A838"}})}</div>

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:22,color:"#F2EDE4",textAlign:"center"}}>Something went wrong</div>

          <div style={{fontSize:14,color:"#9AAABF",maxWidth:340,textAlign:"center",lineHeight:1.6}}>The app hit an unexpected error. Your data is safe  -  refresh to get back in.</div>

          <button onClick={()=>this.setState({hasError:false})} style={{marginTop:8,padding:"10px 24px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:14}}>Try Again</button>

          <button onClick={()=>window.location.reload()} style={{padding:"8px 20px",background:"transparent",border:"1px solid rgba(155,114,207,.4)",borderRadius:8,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:13}}>Reload Page</button>

        </div>

      );

    }

    return this.props.children;

  }

}

// Per-screen error boundary  -  isolates crashes to individual screens
class ScreenBoundary extends Component {

  constructor(props){super(props);this.state={hasError:false,error:null};}

  static getDerivedStateFromError(error){return{hasError:true,error:error};}

  componentDidCatch(error,info){console.error("[TFT] Screen crash ("+this.props.name+"):",error,info);Sentry.captureException(error,{tags:{screen:this.props.name},extra:{componentStack:info&&info.componentStack}});}

  render(){
    if(this.state.hasError){
      var self=this;
      return(
        <div className="page wrap" style={{textAlign:"center",paddingTop:80,maxWidth:440,margin:"0 auto"}}>
          <div style={{fontSize:42,marginBottom:16}}>{React.createElement("i",{className:"ti ti-alert-triangle",style:{color:"#E8A838"}})}</div>
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
function sanitize(str){if(typeof str!=='string')return '';return str.replace(/<[^>]*>/g,'');}

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

  {id:"iron",       name:"Iron",        icon:"gear-fill",  color:"#BECBD9", minXp:0,    maxXp:200},

  {id:"bronze",     name:"Bronze",      icon:"shield-fill",  color:"#CD7F32", minXp:200,  maxXp:500},

  {id:"silver",     name:"Silver",      icon:"shield-fill",  color:"#C0C0C0", minXp:500,  maxXp:900},

  {id:"gold",       name:"Gold",        icon:"shield-fill",  color:"#E8A838", minXp:900,  maxXp:1400},

  {id:"platinum",   name:"Platinum",    icon:"diamond-half",  color:"#4ECDC4", minXp:1400, maxXp:2000},

  {id:"diamond",    name:"Diamond",     icon:"gem",  color:"#9B72CF", minXp:2000, maxXp:2800},

  {id:"master",     name:"Master",      icon:"stars",  color:"#EAB308", minXp:2800, maxXp:3800},

  {id:"grandmaster",name:"Grandmaster", icon:"eye-fill",  color:"#F87171", minXp:3800, maxXp:5000},

  {id:"challenger", name:"Clash Challenger",icon:"trophy-fill",color:"#E8A838",minXp:5000,maxXp:99999},

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

// ─── HEAD-TO-HEAD COMPUTATION ─────────────────────────────────────────────────

function computeH2H(playerA,playerB,pastClashes){
  var shared=[];
  (pastClashes||[]).forEach(function(clash){
    (clash.lobbies||[]).forEach(function(lobby){
      var aResult=null,bResult=null;
      (lobby.results||[]).forEach(function(r){
        if(r.username===playerA)aResult=r;
        if(r.username===playerB)bResult=r;
      });
      if(aResult&&bResult){
        shared.push({clash:clash.name||clash.id,aPos:aResult.position,bPos:bResult.position});
      }
    });
  });
  var wins=0,losses=0,aAvg=0,bAvg=0;
  shared.forEach(function(s){
    if(s.aPos<s.bPos)wins++;
    else if(s.aPos>s.bPos)losses++;
    aAvg+=s.aPos;
    bAvg+=s.bPos;
  });
  var count=shared.length;
  return {
    sharedLobbies:count,
    wins:wins,losses:losses,
    ties:count-wins-losses,
    aAvg:count?+(aAvg/count).toFixed(1):0,
    bAvg:count?+(bAvg/count).toFixed(1):0,
    recent:shared.slice(-5),
  };
}

// ─── STATS CACHE ─────────────────────────────────────────────────────────────
// WeakMap keyed by player object  -  cache invalidates automatically when player
// object identity changes (which happens on every immutable state update).
var _statsCache=new WeakMap();
function getStats(player){
  if(!player)return{games:0,wins:0,top4:0,bot4:0,top1Rate:"0.0",top4Rate:"0.0",bot4Rate:"0.0",avgPlacement:"-",perClashAvp:null,roundAvgs:{r1:null,r2:null,r3:null,finals:null},comebackRate:0,clutchRate:0,ppg:0};
  var cached=_statsCache.get(player);
  if(cached)return cached;
  var result=computeStats(player);
  _statsCache.set(player,result);
  return result;
}

var TIER_FEATURES = {
  free: {
    compete: true,
    basicStats: true,
    basicProfile: true,
    viewResults: true,
    currentSeasonHistory: true,
    enhancedStats: false,
    proBadge: false,
    priorityRegistration: false,
    extendedHistory: false,
    customBanner: false,
    comparisonTool: false,
    emailDigest: false,
    createTournaments: false,
    brandedPages: false,
    hostDashboard: false,
    customRules: false,
    apiAccess: false
  },
  pro: {
    compete: true,
    basicStats: true,
    basicProfile: true,
    viewResults: true,
    currentSeasonHistory: true,
    enhancedStats: true,
    proBadge: true,
    priorityRegistration: true,
    extendedHistory: true,
    customBanner: true,
    comparisonTool: true,
    emailDigest: true,
    createTournaments: false,
    brandedPages: false,
    hostDashboard: false,
    customRules: false,
    apiAccess: false
  },
  host: {
    compete: true,
    basicStats: true,
    basicProfile: true,
    viewResults: true,
    currentSeasonHistory: true,
    enhancedStats: true,
    proBadge: true,
    priorityRegistration: true,
    extendedHistory: true,
    customBanner: true,
    comparisonTool: true,
    emailDigest: true,
    createTournaments: true,
    brandedPages: true,
    hostDashboard: true,
    customRules: true,
    apiAccess: true
  }
};

function getUserTier(subscriptions, userId) {
  if (!subscriptions || !userId) return "free";
  var sub = subscriptions[userId];
  if (!sub) return "free";
  if (sub.status !== "active") return "free";
  if (sub.current_period_end) {
    var grace = 3 * 24 * 60 * 60 * 1000;
    if (new Date(sub.current_period_end).getTime() + grace < Date.now()) return "free";
  }
  return sub.tier || "free";
}

function hasFeature(tier, feature) {
  var features = TIER_FEATURES[tier] || TIER_FEATURES.free;
  return !!features[feature];
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

  // Step 4: Most recent game finish  -  player who competed more recently wins
  var aLastId = a.clashHistory && a.clashHistory.length ? (a.clashHistory[a.clashHistory.length - 1].clashId || a.clashHistory[a.clashHistory.length - 1].date || a.clashHistory.length) : 0;

  var bLastId = b.clashHistory && b.clashHistory.length ? (b.clashHistory[b.clashHistory.length - 1].clashId || b.clashHistory[b.clashHistory.length - 1].date || b.clashHistory.length) : 0;

  return bLastId - aLastId;

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

  {id:"first_blood",    tier:"bronze",    icon:"droplet-fill",  name:"First Blood",       desc:"Win your first clash game",                            check:p=>p.wins>=1},

  {id:"hat_trick",      tier:"bronze",    icon:"mortarboard-fill",  name:"Hat Trick",          desc:"3 total wins across any clashes",                      check:p=>p.wins>=3},

  {id:"top4_machine",   tier:"silver",    icon:"gear-fill",  name:"Top 4 Machine",      desc:"Land top 4 in 10 different games",                     check:p=>p.top4>=10},

  {id:"podium_hunter",  tier:"silver",    icon:"award-fill",  name:"Podium Hunter",      desc:"5 wins total",                                         check:p=>p.wins>=5},

  {id:"clutch_god",     tier:"gold",      icon:"lightning-charge-fill",  name:"Clutch God",         desc:"Win a 1v1 final round",                                check:p=>(p.clashHistory||[]).some(g=>g.clutch)},

  {id:"dynasty",        tier:"gold",      icon:"trophy-fill",  name:"Dynasty",            desc:"10 total wins - a true contender",                     check:p=>p.wins>=10},

  {id:"untouchable",    tier:"legendary", icon:"diamond-half",  name:"Untouchable",        desc:"Finish in top 4 every game in a single clash",         check:p=>(p.clashHistory||[]).some(g=>(g.place||g.placement)<=4)&&p.top4>=p.games},

  {id:"the_grind",      tier:"legendary", icon:"moon-fill",  name:"The Grind",          desc:"Play 30+ games over the season",                       check:p=>p.games>=30},

  // ── STREAK ACHIEVEMENTS ───────────────────────────────────

  {id:"hot_start",      tier:"bronze",    icon:"fire",  name:"Hot Start",          desc:"Win your first clash of the season",                   check:p=>p.wins>=1&&p.games<=8},

  {id:"on_fire",        tier:"silver",    icon:"graph-up-arrow",  name:"On Fire",            desc:"3 win streak at any point",                            check:p=>p.bestStreak>=3},

  {id:"cant_stop",      tier:"gold",      icon:"rocket-takeoff-fill",  name:"Can't Stop",         desc:"5 consecutive wins",                                   check:p=>p.bestStreak>=5},

  {id:"goat_streak",    tier:"legendary", icon:"star-fill",  name:"GOAT Streak",        desc:"7 win streak - absolutely unstoppable",                check:p=>p.bestStreak>=7},

  // ── POINTS ACHIEVEMENTS ────────────────────────────────────

  {id:"point_getter",   tier:"bronze",    icon:"coin",  name:"Point Getter",       desc:"Earn your first 100 Clash Points",                     check:p=>p.pts>=100},

  {id:"century",        tier:"silver",    icon:"gem",  name:"Half-K",             desc:"500 Clash Points accumulated",                         check:p=>p.pts>=500},

  {id:"big_dog",        tier:"gold",      icon:"trophy-fill",  name:"Big Dog",            desc:"800 Clash Points - top tier territory",                check:p=>p.pts>=800},

  {id:"thousand_club",  tier:"legendary", icon:"sun-fill",  name:"Thousand Club",      desc:"1000+ Clash Points in a single season",                check:p=>p.pts>=1000},

  // ── SOCIAL / COMMUNITY ───────────────────────────────────

  {id:"regular",        tier:"bronze",    icon:"calendar-check-fill",  name:"Regular",            desc:"Show up to 5 clashes",                                 check:p=>p.games>=5},

  {id:"veteran",        tier:"silver",    icon:"shield-check",  name:"Veteran",            desc:"20 total games across the season",                     check:p=>p.games>=20},

  {id:"season_finisher",tier:"gold",      icon:"patch-check-fill",  name:"Season Finisher",    desc:"Complete every clash in the season",                   check:p=>p.games>=28},

  {id:"champion",       tier:"legendary", icon:"award-fill",  name:"Season Champion",    desc:"Finish #1 on the season leaderboard",                  check:p=>SEASON_CHAMPION&&p.name===SEASON_CHAMPION.name},

  // ── RARE / EASTER EGG ────────────────────────────────────

  {id:"dishsoap",       tier:"legendary", icon:"droplet",  name:"Squeaky Clean",      desc:"Only Dishsoap knows how he earned this.",              check:p=>p.name==="Dishsoap"||p.riotId?.toLowerCase().includes("dishsoap")},

  {id:"perfect_lobby",  tier:"legendary", icon:"bullseye",  name:"The Anomaly",        desc:"Win a lobby without ever placing below 3rd in any round", check:p=>(p.clashHistory||[]).some(g=>(g.place||g.placement)===1&&(g.roundPlacements?Object.values(g.roundPlacements).every(v=>v<=3):true))},

  {id:"silent_grinder", tier:"gold",      icon:"eye-fill",  name:"Silent Grinder",     desc:"Top 8 on the leaderboard with no wins - pure consistency", check:p=>p.pts>=400&&p.wins===0},

];



const MILESTONES=[

  {id:"m1",icon:"shield-fill",name:"Bronze Contender",pts:100,  reward:"Bronze badge on your profile",     check:p=>p.pts>=100},

  {id:"m2",icon:"shield-fill",name:"Silver Contender",pts:300,  reward:"Silver animated border",            check:p=>p.pts>=300},

  {id:"m3",icon:"shield-fill",name:"Gold Contender",  pts:600,  reward:"Gold sparkle border + title",       check:p=>p.pts>=600},

  {id:"m4",icon:"gem",name:"Diamond Tier",    pts:800,  reward:"Diamond holographic card effect",   check:p=>p.pts>=800},

  {id:"m5",icon:"trophy-fill",name:"Champion Tier",   pts:1000, reward:"Champion crown + Hall of Fame entry",check:p=>p.pts>=1000},

  {id:"m6",icon:"fire",name:"Hot Streak",      pts:null, reward:"Flame icon next to your name",     check:p=>isHotStreak(p)},

  {id:"m7",icon:"trophy-fill",name:"Event Winner",    pts:null, reward:"Winner trophy on your profile",    check:p=>p.wins>=1},

  {id:"m8",icon:"lightning-charge-fill",name:"Clutch Player",   pts:null, reward:"Clutch tag on your stats",     check:p=>(p.clashHistory||[]).some(g=>g.clutch)},

];








// ─── CHAMPION SYSTEM ─────────────────────────────────────────────────────────

function getAchievements(p){return ACHIEVEMENTS.filter(a=>{try{return a.check(p);}catch{return false;}});}

function checkAchievements(player, rank) {
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

function syncAchievements(playerId, earnedIds) {
  var rows = earnedIds.map(function(aid) {
    return {player_id: playerId, achievement_id: aid};
  });
  if (rows.length > 0) {
    supabase.from("player_achievements").upsert(rows, {onConflict: "player_id,achievement_id"})
      .then(function(r) { if (r.error) console.error("[TFT] achievement sync:", r.error); });
  }
}

function writeActivityEvent(type, playerId, text) {
  supabase.from("activity_feed").insert({
    type: type,
    player_id: playerId,
    detail_json: {text: text}
  }).then(function(r) {
    if (r.error) console.error("[TFT] activity_feed insert failed:", r.error);
  });
}

// Module-level helper - usable in any component without prop-drilling
function createNotification(userId,title,body,icon){
  if(!userId)return Promise.resolve();
  return supabase.from('notifications').insert({
    user_id:userId,title:title,body:body,message:body,icon:icon||"bell",type:"info",
    read:false,created_at:new Date().toISOString()
  });
}

function isHotStreak(p){return(p.currentStreak||0)>=3;}



function isOnTilt(p){return(p.tiltStreak||0)>=3;}



// ─── TOURNAMENT ENGINE ───────────────────────────────────────────────────────

// Tournament phases  -  strict state machine
var T_PHASE={
  DRAFT:"draft",
  REGISTRATION:"registration",
  CHECK_IN:"checkin",
  LOBBY_SETUP:"lobby_setup",
  IN_PROGRESS:"inprogress",
  BETWEEN_ROUNDS:"between_rounds",
  COMPLETE:"complete"
};

// Valid state transitions
var T_TRANSITIONS={};
T_TRANSITIONS[T_PHASE.DRAFT]=[T_PHASE.REGISTRATION];
T_TRANSITIONS[T_PHASE.REGISTRATION]=[T_PHASE.CHECK_IN,T_PHASE.DRAFT];
T_TRANSITIONS[T_PHASE.CHECK_IN]=[T_PHASE.LOBBY_SETUP,T_PHASE.REGISTRATION];
T_TRANSITIONS[T_PHASE.LOBBY_SETUP]=[T_PHASE.IN_PROGRESS,T_PHASE.CHECK_IN];
T_TRANSITIONS[T_PHASE.IN_PROGRESS]=[T_PHASE.BETWEEN_ROUNDS,T_PHASE.COMPLETE];
T_TRANSITIONS[T_PHASE.BETWEEN_ROUNDS]=[T_PHASE.IN_PROGRESS,T_PHASE.COMPLETE];
T_TRANSITIONS[T_PHASE.COMPLETE]=[];

function canTransition(from,to){
  return(T_TRANSITIONS[from]||[]).indexOf(to)!==-1;
}

// Format presets
var TOURNAMENT_FORMATS={
  casual:{name:"Casual Clash",description:"Single stage, 3 games, all players",games:3,stages:1,maxPlayers:24,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"random"},
  standard:{name:"Standard Clash",description:"Single stage, 5 games, seeded lobbies",games:5,stages:1,maxPlayers:32,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"snake"},
  competitive:{name:"Competitive (128p)",description:"6 games, cut after 4, snake seeded",games:6,stages:2,maxPlayers:128,cutEnabled:true,cutLine:13,cutAfterGame:4,seeding:"snake"},
  weekly:{name:"Weekly Clash",description:"3 games, friend group format",games:3,stages:1,maxPlayers:24,cutEnabled:false,cutLine:0,cutAfterGame:0,seeding:"rank-based"}
};

// Snake seeding: distributes players across lobbies so each has a mix of skill levels
// Input: sorted players array (best first), lobbyCount
// Output: array of arrays (lobbies)
function snakeSeed(sortedPlayers,lobbySize){
  var lobbyCount=Math.ceil(sortedPlayers.length/lobbySize);
  if(lobbyCount<=0)return[];
  var lobbies=Array.from({length:lobbyCount},function(){return[];});
  sortedPlayers.forEach(function(p,i){
    var row=Math.floor(i/lobbyCount);
    var col=row%2===0?(i%lobbyCount):(lobbyCount-1-(i%lobbyCount));
    lobbies[col].push(p);
  });
  return lobbies;
}

// Calculate lobby assignments based on seeding method
function buildLobbies(players,method,lobbySize){
  lobbySize=lobbySize||8;
  if(!players||players.length===0)return[];
  var pool;
  if(method==="random"){
    pool=[].concat(players);
    for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;}
    var result=[];
    for(var k=0;k<pool.length;k+=lobbySize)result.push(pool.slice(k,k+lobbySize));
    return result;
  }
  if(method==="snake"){
    var sorted=[].concat(players).sort(function(a,b){return(b.pts||0)-(a.pts||0)||(b.wins||0)-(a.wins||0);});
    return snakeSeed(sorted,lobbySize);
  }
  // Default: rank-based (top seeds together)
  var ranked=[].concat(players).sort(function(a,b){return(b.pts||0)-(a.pts||0);});
  var res=[];
  for(var m=0;m<ranked.length;m+=lobbySize)res.push(ranked.slice(m,m+lobbySize));
  return res;
}

// Build lobbies for a flash tournament from checked-in players
function buildFlashLobbies(checkedInPlayers,seedingMethod){
  var N=checkedInPlayers.length;
  if(N<2)return{lobbies:[],byes:checkedInPlayers};
  var pool=[].concat(checkedInPlayers);
  if(seedingMethod==="random"){
    for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;}
  } else {
    // snake or rank-based: sort by rank then pts
    pool.sort(function(a,b){return(RANKS.indexOf(b.rank||"Iron")-RANKS.indexOf(a.rank||"Iron"))||((b.pts||0)-(a.pts||0));});
  }
  var k=Math.floor(N/8);
  var remainder=N-(k*8);
  if(remainder===0){
    // perfect
  } else if(remainder>=6){
    k=k+1;
  } else {
    if(k>=1){k=k+1;}
    else{k=1;}
  }
  if(k<1)k=1;
  var lobbies=[];
  for(var li=0;li<k;li++)lobbies.push([]);
  pool.forEach(function(p,idx){
    var row=Math.floor(idx/k);
    var col=row%2===0?(idx%k):(k-1-(idx%k));
    lobbies[col].push(p);
  });
  return{lobbies:lobbies,byes:[]};
}

// Cut line: determine which players advance after N games
// Returns { advancing: [], eliminated: [] }
function applyCutLine(playerStandings,cutLine,cutAfterGame){
  if(!cutLine||cutLine<=0)return{advancing:playerStandings,eliminated:[]};
  var advancing=[];
  var eliminated=[];
  playerStandings.forEach(function(p){
    var gamesPlayed=p.gamesInTournament||0;
    if(gamesPlayed<cutAfterGame){advancing.push(p);return;}
    var pts=p.tournamentPts||0;
    if(pts>cutLine){advancing.push(p);}
    else{eliminated.push(p);}
  });
  return{advancing:advancing,eliminated:eliminated};
}

// Calculate suggested cut line for a given player count
function suggestedCutLine(playerCount){
  if(playerCount>=96)return{cutLine:13,cutAfterGame:4,reason:"128p format: avg 18pts after 4 games, cut at 13"};
  if(playerCount>=48)return{cutLine:15,cutAfterGame:3,reason:"64p format: tighter field, cut after 3 games"};
  if(playerCount>=24)return{cutLine:12,cutAfterGame:3,reason:"32p format: smaller field, lower cut"};
  return{cutLine:0,cutAfterGame:0,reason:"Small event: no cut recommended"};
}

// Compute tournament standings from game_results
function computeTournamentStandings(players,gameResults,tournamentId){
  var standingsMap={};
  gameResults.forEach(function(g){
    if(tournamentId&&g.tournamentId!==tournamentId)return;
    var pid=g.player_id||g.playerId;
    if(!standingsMap[pid])standingsMap[pid]={playerId:pid,tournamentPts:0,gamesInTournament:0,placements:[],wins:0,top4:0};
    var s=standingsMap[pid];
    s.tournamentPts+=(g.points||PTS[g.placement]||0);
    s.gamesInTournament+=1;
    s.placements.push(g.placement);
    if(g.placement===1)s.wins+=1;
    if(g.placement<=4)s.top4+=1;
  });
  // Merge with player info
  return players.map(function(p){
    var s=standingsMap[p.id]||{tournamentPts:0,gamesInTournament:0,placements:[],wins:0,top4:0};
    return Object.assign({},p,s);
  }).filter(function(p){return p.gamesInTournament>0;})
    .sort(function(a,b){
      if(b.tournamentPts!==a.tournamentPts)return b.tournamentPts-a.tournamentPts;
      var aScore=a.wins*2+a.top4;var bScore=b.wins*2+b.top4;
      if(bScore!==aScore)return bScore-aScore;
      return 0;
    });
}


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



  // Most Improved - biggest improvement from first half to second half of games
  const mostImproved=(function(){
    var candidates=eligible.filter(function(p){return(p.clashHistory||[]).length>=4;});
    if(!candidates.length)return byAvp[0]||null;
    var best=null;var bestDelta=0;
    candidates.forEach(function(p){
      var h=p.clashHistory||[];var mid=Math.floor(h.length/2);
      var firstHalf=h.slice(0,mid);var secondHalf=h.slice(mid);
      var avgFirst=firstHalf.reduce(function(s,g){return s+(g.place||g.placement||5);},0)/firstHalf.length;
      var avgSecond=secondHalf.reduce(function(s,g){return s+(g.place||g.placement||5);},0)/secondHalf.length;
      var delta=avgFirst-avgSecond; // positive = improved (lower placement is better)
      if(delta>bestDelta){bestDelta=delta;best=p;}
    });
    return best||byAvp[0]||null;
  })();

  // Ice Cold - longest streak without a top-4 finish (3+ games)
  const iceCold=(function(){
    var candidates=eligible.filter(function(p){return(p.clashHistory||[]).length>=3;});
    if(!candidates.length)return null;
    var worst=null;var worstStreak=0;
    candidates.forEach(function(p){
      var streak=0;var maxStreak=0;
      (p.clashHistory||[]).forEach(function(g){
        var pl=g.place||g.placement||5;
        if(pl>4){streak++;}else{if(streak>maxStreak)maxStreak=streak;streak=0;}
      });
      if(streak>maxStreak)maxStreak=streak;
      if(maxStreak>worstStreak){worstStreak=maxStreak;worst=p;}
    });
    return worst;
  })();



  // On Fire - best 1st place streak

  const onFire=[...eligible].sort((a,b)=>(b.bestStreak||0)-(a.bestStreak||0))[0];



  return[

    lobbyBully&&{icon:"crosshair",id:"bully",title:"Lobby Bully",desc:"Most 1st place finishes",winner:lobbyBully,stat:lobbyBully.wins+" wins",color:"#E8A838"},

    choker&&choker!==lobbyBully&&{icon:"emoji-dizzy",id:"choker",title:"The Choker",desc:"Highest AVP in the top half - ouch",winner:choker,stat:"AVP "+getStats(choker).avgPlacement,color:"#F87171"},

    singleMVP&&{icon:"lightning-charge-fill",id:"single",title:"Single Clash MVP",desc:"Highest points in one event",winner:singleMVP,stat:(singleMVP.bestHaul||0)+" pts haul",color:"#EAB308"},

    mostImproved&&{icon:"graph-up-arrow",id:"improved",title:"Most Improved",desc:"Biggest AVP improvement this season",winner:mostImproved,stat:"AVP "+getStats(mostImproved).avgPlacement,color:"#52C47C"},

    iceCold&&iceCold!==mostImproved&&{icon:"snow",id:"cold",title:"Ice Cold",desc:"Longest streak outside top 4",winner:iceCold,stat:"AVP "+getStats(iceCold).avgPlacement,color:"#4ECDC4"},

    onFire&&{icon:"fire",id:"streak",title:"On Fire",desc:"Best 1st place streak this season",winner:onFire,stat:(onFire.bestStreak||0)+" in a row",color:"#F97316"},

    byPts[0]&&{icon:"trophy-fill",id:"mvp",title:"MVP",desc:"Highest season points",winner:byPts[0],stat:byPts[0].pts+" pts",color:"#E8A838"},

    byPts[0]&&{icon:"clipboard-data-fill",id:"consistent2",title:"Most Consistent",desc:"Lowest AVP (3+ games)",winner:byAvp[0],stat:"AVP "+(byAvp[0]?getStats(byAvp[0]).avgPlacement:"-"),color:"#C4B5FD"},

  ].filter(Boolean);

}

// ─── AUTO-GENERATED CLASH RECAP ──────────────────────────────────────────────

function generateRecap(clashData){
  if(!clashData||!clashData.finalStandings||clashData.finalStandings.length===0)return null;
  var lines=[];
  var standings=clashData.finalStandings;
  var winner=standings[0];
  lines.push((winner.username||winner.name)+" claimed the crown with "+(winner.points||winner.pts||0)+" points.");

  var biggestClimb=null;
  standings.forEach(function(p,idx){
    if(p.game1Pos){
      var climb=p.game1Pos-(idx+1);
      if(!biggestClimb||climb>biggestClimb.climb)biggestClimb={player:p.username||p.name,from:p.game1Pos,to:idx+1,climb:climb};
    }
  });
  if(biggestClimb&&biggestClimb.climb>=3){
    lines.push(biggestClimb.player+" pulled off an incredible comeback, climbing from "+ordinal(biggestClimb.from)+" after Game 1 to finish "+ordinal(biggestClimb.to)+".");
  }

  var consistent=standings.find(function(p){
    return p.allPlacements&&p.allPlacements.every(function(pos){return pos<=4;});
  });
  if(consistent&&(consistent.username||consistent.name)!==(winner.username||winner.name)){
    lines.push((consistent.username||consistent.name)+" earned the Consistency King award with all placements inside the top 4.");
  }

  if(standings.length>=2){
    var diff=(standings[0].points||standings[0].pts||0)-(standings[1].points||standings[1].pts||0);
    if(diff<=2){
      lines.push("It came down to the wire \u2014 only "+diff+" point"+(diff===1?"":"s")+" separated "+(standings[0].username||standings[0].name)+" and "+(standings[1].username||standings[1].name)+".");
    }
  }

  return {lines:lines,winner:winner.username||winner.name,clashName:clashData.name||clashData.clashName||"Clash"};
}

function ClashRecap(props){
  var recap=props.recap;
  if(!recap)return null;
  return React.createElement("div",{style:{
    background:"rgba(17,24,39,.8)",border:"1px solid rgba(52,211,153,.15)",
    borderRadius:14,padding:20,margin:"0 16px 20px",position:"relative",overflow:"hidden",
  }},
    React.createElement("div",{style:{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#34D399,transparent)"}}),
    React.createElement("div",{style:{fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:"#34D399",fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}},recap.clashName+" Recap"),
    React.createElement("div",{style:{fontSize:14,color:"#F2EDE4",lineHeight:1.8}},
      recap.lines.map(function(line,i){
        return React.createElement("p",{key:i,style:{marginBottom:8}},line);
      })
    ),
    React.createElement("div",{style:{display:"flex",gap:8,marginTop:12}},
      React.createElement(Btn,{v:"ghost",s:"sm",onClick:function(){
        var text=recap.clashName+" Recap\n\n"+recap.lines.join("\n");
        navigator.clipboard.writeText(text);
        if(props.toast)props.toast("Copied to clipboard!","success");
      }},React.createElement("i",{className:"ti ti-brand-discord",style:{marginRight:4}}),"Copy for Discord"),
      React.createElement(Btn,{v:"ghost",s:"sm",onClick:function(){
        if(props.toast)props.toast("Share card coming soon!","info");
      }},React.createElement("i",{className:"ti ti-share",style:{marginRight:4}}),"Share Card")
    )
  );
}







// ─── SEED DATA ────────────────────────────────────────────────────────────────



const HOMIES_IDS=[];

const SEED=[];

const PAST_CLASHES=[];








// ─── AUTH / ACCOUNT SYSTEM ───────────────────────────────────────────────────

// ─── CHAMPION SYSTEM ─────────────────────────────────────────────────────────

let SEASON_CHAMPION=null; // computed from live standings  -  no hardcoded champion



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

input:focus,select:focus,textarea:focus{box-shadow:0 0 0 1px rgba(155,114,207,.4),0 0 16px rgba(155,114,207,.08)!important;}

button:active:not(:disabled){transform:scale(0.97);}

.inner-box{background:rgba(14,22,40,.6);border:1px solid rgba(242,237,228,.06);border-radius:10px;transition:border-color .2s,box-shadow .2s;}

.inner-box:hover{border-color:rgba(155,114,207,.2);box-shadow:0 0 12px rgba(155,114,207,.06);}

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

@keyframes pulse-red{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.35)}70%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}

@keyframes disp-anim{0%,100%{border-color:rgba(220,38,38,.4)}50%{border-color:rgba(220,38,38,.9);box-shadow:0 0 24px rgba(220,38,38,.25)}}

@keyframes lock-flash{0%{background:rgba(82,196,124,0)}40%{background:rgba(82,196,124,.12)}100%{background:rgba(82,196,124,0)}}

@keyframes screen-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

@keyframes skeleton-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}

@keyframes achievement-glow{0%{box-shadow:0 0 0 0 rgba(155,114,207,.4)}50%{box-shadow:0 0 16px 4px rgba(155,114,207,.15)}100%{box-shadow:0 0 0 0 rgba(155,114,207,0)}}

@keyframes achievement-pop{0%{transform:scale(.95);opacity:.7}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}

@keyframes confetti-fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}

@keyframes champ-reveal{0%{transform:scale(.75) translateY(30px);opacity:0;filter:blur(12px)}100%{transform:scale(1) translateY(0);opacity:1;filter:blur(0)}}

@keyframes crown-glow{0%,100%{filter:drop-shadow(0 0 4px rgba(232,168,56,.35))}50%{filter:drop-shadow(0 0 11px rgba(232,168,56,.5))}}

@keyframes slide-drawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}

@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

.au{animation:fadeup .4s ease both}

.au1{animation:fadeup .4s .05s ease both}

.au2{animation:fadeup .4s .1s ease both}

.au3{animation:fadeup .4s .13s ease both}



/* ── layout helpers ──────────────────────────────────────────── */

.wrap{max-width:1400px;margin:0 auto;padding:0 16px;}

.page{padding:24px 16px 40px;animation:screen-enter .3s ease-out both;}



/* ── mobile bottom nav ───────────────────────────────────────── */

/* bottom-nav removed - hamburger menu replaces it */



/* ── desktop top nav (hidden on mobile) ──────────────────────── */

.top-nav{

  position:sticky;top:0;z-index:100;

  background:rgba(7,7,14,.97);

  border-bottom:1px solid rgba(232,168,56,.15);

  backdrop-filter:blur(20px);

  display:block;

}

.top-nav .desktop-links{display:none;}

.top-nav .mobile-hamburger{display:flex;}

.mobile-bottom-bar{display:flex;}

@media(min-width:768px){

  .top-nav .desktop-links{display:flex;}

  .top-nav .mobile-hamburger{display:none;}

  .mobile-bottom-bar{display:none!important;}

}

@media(min-width:768px){

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

.drawer{position:fixed;left:0;top:0;bottom:0;width:280px;max-width:85vw;background:linear-gradient(180deg,#0E1826,#08101A);border-right:1px solid rgba(232,168,56,.2);z-index:195;animation:slide-drawer .22s ease;display:flex;flex-direction:column;padding:16px 0;box-shadow:4px 0 32px rgba(0,0,0,.6);overflow-y:auto;}



/* ── esports glow enhancements ───────────────────────────────── */


@keyframes border-glow{0%,100%{border-color:rgba(155,114,207,.3)}50%{border-color:rgba(155,114,207,.7);box-shadow:0 0 20px rgba(155,114,207,.2)}}



/* Scanline overlay */

.scanlines::after{content:"";position:fixed;inset:0;z-index:1;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.05) 3px,rgba(0,0,0,.05) 4px);}



/* Logo hex glow */

.hex-logo{filter:drop-shadow(0 0 6px rgba(232,168,56,.55));transition:filter .3s;}

.hex-logo:hover{filter:drop-shadow(0 0 14px rgba(232,168,56,.95)) drop-shadow(0 0 30px rgba(232,168,56,.4));}



/* Gold shimmer text */

.gold-shimmer{background:linear-gradient(135deg,#E8A838,#C8882A,#E8A838);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}



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




/* ── Phase 5: Arena redesign ──────────────────────────────────────────── */

@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)}}

.glass{background:rgba(255,255,255,.04)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.09)!important;}

.display{font-family:'Russo One',sans-serif;font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:.03em;text-transform:uppercase;}

.section-title{font-family:'Russo One',sans-serif;font-size:clamp(18px,2.5vw,28px);font-weight:700;letter-spacing:.08em;text-transform:uppercase;}

.accent-bar::before{content:"";display:block;height:3px;background:linear-gradient(90deg,#9B72CF,#4ECDC4);border-radius:2px;margin-bottom:16px;}

.panel-glass{background:rgba(255,255,255,.035)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.09)!important;border-radius:16px!important;}

.panel-gradient{background:linear-gradient(135deg,rgba(155,114,207,.1),rgba(78,205,196,.04))!important;border:1px solid rgba(155,114,207,.18)!important;}

.countdown-tile{background:linear-gradient(145deg,rgba(155,114,207,.08),rgba(8,8,15,.5));border:1px solid rgba(155,114,207,.15);border-radius:12px;padding:14px 18px;text-align:center;min-width:64px;}

.countdown-tile .digit{font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:800;color:#E8A838;line-height:1;text-shadow:0 0 20px currentColor,0 0 24px rgba(232,168,56,.6),0 0 48px rgba(232,168,56,.2);}

.countdown-tile .unit{font-family:'Chakra Petch',sans-serif;font-size:9px;color:#6B7280;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:4px;}

.hero-panel{background:radial-gradient(ellipse at 50% 0%,rgba(155,114,207,.18) 0%,rgba(8,8,15,.0) 70%);border:1px solid rgba(155,114,207,.2);border-radius:20px;padding:40px 32px;position:relative;overflow:hidden;}

.hero-panel::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(155,114,207,.06),rgba(78,205,196,.02));pointer-events:none;}

.top-nav{border-top:2px solid #9B72CF!important;box-shadow:0 2px 0 rgba(155,114,207,.08),0 1px 0 rgba(232,168,56,.1),0 8px 40px rgba(0,0,0,.7)!important;}



/* ═══════════════════════════════════════════════════════════

   ESPORTS OVERHAUL - Retro-Futurism Premium Layer

   ═══════════════════════════════════════════════════════════ */



/* ── Rank number dramatic treatment ─────────────────────── */

.rank-1 .rank-num{color:#FFD700!important;text-shadow:0 0 20px rgba(255,215,0,.9),0 0 40px rgba(255,215,0,.4)!important;font-size:20px!important;}

.rank-2 .rank-num{color:#C0C0C0!important;text-shadow:0 0 14px rgba(192,192,192,.7)!important;}

.rank-3 .rank-num{color:#CD7F32!important;text-shadow:0 0 14px rgba(205,127,50,.7)!important;}



/* ── New keyframes ───────────────────────────────────────── */


@keyframes border-race{0%{background-position:0% 0%}100%{background-position:200% 0%}}




/* ── Shimmer card effect ─────────────────────────────────── */

.shimmer-card{position:relative;overflow:hidden;}




/* ── Elite panel variant ─────────────────────────────────── */

.panel-elite{background:linear-gradient(145deg,rgba(18,28,48,.9) 0%,rgba(10,15,28,.95) 100%)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;border:1px solid rgba(255,255,255,.09)!important;box-shadow:0 8px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.3)!important;}



/* ── Gradient border on hero/featured elements ───────────── */

.border-neon-grad{position:relative;}

.border-neon-grad::before{content:"";position:absolute;inset:-1px;border-radius:inherit;background:linear-gradient(135deg,rgba(232,168,56,.5),rgba(155,114,207,.4),rgba(78,205,196,.3));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:0;}



/* ── Holographic champion row ────────────────────────────── */

.row-champion{background:linear-gradient(270deg,rgba(232,168,56,.07),rgba(155,114,207,.06),rgba(78,205,196,.05))!important;background-size:300% 300%!important;animation:holo-shift 6s ease infinite!important;}



/* ── Trophy glow ─────────────────────────────────────────── */

.trophy-glow{filter:drop-shadow(0 0 8px rgba(232,168,56,.6));}



/* ── Moving retro scan line ──────────────────────────────── */




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

  /* Prevent footer overlap with fixed mobile bottom nav */
  

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

  /* Challenges grid - stack on small screens */
  .challenges-grid{grid-template-columns:1fr 50px 50px 50px 50px 50px!important;}

  /* Standings table allow shrink */
  .standings-table-wrap{min-width:0!important;}

  /* Podium stack on mobile */
  .podium-grid{grid-template-columns:1fr!important;gap:8px!important;}

  /* Leaderboard podium - stack vertically */
  .lb-podium{flex-direction:column!important;align-items:center!important;}

  /* Standings rows - smaller font on mobile */
  .standings-row{font-size:12px!important;}
  .standings-row .mono{font-size:12px!important;}
  .standings-row .rank-num{font-size:14px!important;}
  .pts-glow{font-size:14px!important;}

  /* Tournament / flash screen card padding reduction */
  .flash-panel{padding:14px!important;}

  /* Lobby player list containment */
  .lobby-players-list{overflow:hidden!important;max-width:100%!important;}

}

@media(max-width:375px){

  /* Small phone (iPhone SE etc) tweaks */
  .page.wrap{padding-left:10px!important;padding-right:10px!important;}
  .panel-sm-pad{padding:10px!important;}
  h2{font-size:18px!important;}
  .cond{letter-spacing:.02em!important;}
  .lab-tabs button{padding:6px 8px!important;font-size:11px!important;}
  .challenges-grid{grid-template-columns:1fr 44px 44px 44px 44px 44px!important;}

  /* Force horizontal scroll on data tables that exceed 375px */
  .leaderboard-table-wrap,.stats-table-wrap,.admin-grid-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch;}

  /* AdminPanel 4-col dashboard → 2-col on small phones */
  .admin-dash-grid{grid-template-columns:1fr 1fr!important;gap:8px!important;}

}

/* === TABLER-INSPIRED ADMIN STYLES === */
.tbl-card{background:#111827;border:1px solid rgba(128,150,172,.12);border-radius:8px;box-shadow:0 1px 2px 0 rgba(18,18,23,.15);overflow:hidden;transition:box-shadow .15s;}
.tbl-card:hover{box-shadow:0 4px 6px -2px rgba(18,18,23,.15),0 10px 15px -3px rgba(18,18,23,.12);}
.tbl-card-header{padding:16px 20px;border-bottom:1px solid rgba(128,150,172,.1);display:flex;align-items:center;justify-content:space-between;gap:12px;}
.tbl-card-header h3{font-size:15px;font-weight:600;color:#F2EDE4;margin:0;display:flex;align-items:center;gap:8px;}
.tbl-card-body{padding:20px;}
.tbl-card-footer{padding:12px 20px;border-top:1px solid rgba(128,150,172,.1);background:rgba(0,0,0,.15);}

/* Stat card with colored top bar */
.tbl-stat{position:relative;padding:20px 16px 16px;text-align:center;overflow:hidden;}
.tbl-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--stat-color,#9B72CF);}
.tbl-stat .stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:18px;}
.tbl-stat .stat-value{font-size:28px;font-weight:800;line-height:1;margin-bottom:4px;}
.tbl-stat .stat-label{font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;}

/* Data table */
.tbl-table{width:100%;border-collapse:collapse;font-size:13px;}
.tbl-table th{padding:8px 16px;font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.08em;text-transform:uppercase;text-align:left;border-bottom:1px solid rgba(128,150,172,.15);background:rgba(0,0,0,.15);}
.tbl-table td{padding:10px 16px;border-bottom:1px solid rgba(128,150,172,.06);color:#e5e7eb;vertical-align:middle;}
.tbl-table tr:hover td{background:rgba(155,114,207,.03);}
.tbl-table .td-actions{white-space:nowrap;text-align:right;}

/* Timeline / activity feed */
.tbl-timeline-item{display:flex;gap:12px;padding:10px 20px;border-bottom:1px solid rgba(128,150,172,.06);position:relative;}
.tbl-timeline-item::before{content:'';position:absolute;left:30px;top:28px;bottom:-2px;width:1px;background:rgba(128,150,172,.1);}
.tbl-timeline-item:last-child::before{display:none;}
.tbl-timeline-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;}

/* Phase stepper */
.tbl-stepper{display:flex;gap:0;margin-bottom:16px;}
.tbl-step{flex:1;text-align:center;padding:10px 8px;font-size:11px;font-weight:700;position:relative;color:#6b7280;transition:all .15s;}
.tbl-step::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(128,150,172,.1);transition:all .15s;}
.tbl-step.active{color:var(--step-color,#9B72CF);}
.tbl-step.active::after{background:var(--step-color,#9B72CF);}
.tbl-step.done{color:#52C47C;}
.tbl-step.done::after{background:#52C47C;}

/* Form group */
.tbl-form-group{margin-bottom:14px;}
.tbl-form-label{display:block;font-size:11px;color:#9ca3af;margin-bottom:6px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;}

/* Admin mobile */
@media(max-width:767px){
  .tbl-card-body{padding:14px;}
  .tbl-card-header{padding:12px 14px;}
  .tbl-table th,.tbl-table td{padding:8px 10px;font-size:12px;}
  .admin-dash-grid{grid-template-columns:1fr 1fr!important;gap:8px!important;}
}
@media(max-width:480px){
  .admin-dash-grid{grid-template-columns:1fr!important;}
}

/* -- Lab (Scrims) mobile grid fixes -- */
@media(max-width:767px){
  .lab-play-grid{grid-template-columns:1fr!important;}
  .lab-dash-grid{grid-template-columns:1fr!important;}
  .lab-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;display:flex!important;}
  .lab-tabs button{flex-shrink:0;}
  /* Admin sidebar → hidden on mobile, toggle shows it as overlay */
  .admin-sidebar{position:fixed!important;left:0;top:0;bottom:0;z-index:200!important;box-shadow:8px 0 32px rgba(0,0,0,.5);}
  .admin-sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:199;}
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



var ICON_REMAP={"exclamation-triangle-fill":"alert-triangle","exclamation-octagon-fill":"alert-octagon","info-circle-fill":"info-circle","check-circle-fill":"circle-check","x-circle-fill":"circle-x","slash-circle-fill":"ban","patch-check-fill":"rosette-discount-check","house-fill":"home","search":"search","three-dots":"dots","x-lg":"x","gear-fill":"settings","speedometer2":"gauge","download":"download","inbox":"inbox","clipboard":"clipboard","clipboard-check-fill":"clipboard-check","clipboard-data-fill":"clipboard-data","person-fill":"user","people-fill":"users","person-arms-up":"mood-happy","trophy-fill":"trophy","award-fill":"award","controller":"device-gamepad-2","dice-5-fill":"dice-5","bullseye":"target","crosshair":"crosshair","flag-fill":"flag","fire":"flame","snow":"snowflake","lightning-charge-fill":"bolt","sun-fill":"sun","moon-fill":"moon","water":"droplet-half-2","droplet":"droplet","droplet-fill":"droplet","hexagon-fill":"hexagon","diamond-half":"diamond","gem":"diamond","star-fill":"star","stars":"stars","heart-fill":"heart","shield-fill":"shield","shield-check":"shield-check","coin":"coin","bell-fill":"bell","bell-slash-fill":"bell-off","chat-fill":"message","megaphone-fill":"speakerphone","mic-fill":"microphone","broadcast-pin":"broadcast","calendar-event-fill":"calendar-event","calendar3":"calendar","calendar-check-fill":"calendar-check","bar-chart-line-fill":"chart-bar","graph-up-arrow":"trending-up","diagram-3-fill":"tournament","gift-fill":"gift","lock-fill":"lock","pin-fill":"pin","pencil-fill":"pencil","tag-fill":"tag","building":"building","tv-fill":"device-tv","pc-display":"device-desktop","mouse-fill":"mouse","headphones":"headphones","mortarboard-fill":"school","rocket-takeoff-fill":"rocket","journal-text":"notebook","question-circle-fill":"help-circle","eye-fill":"eye","emoji-dizzy":"mood-sad","pause-fill":"player-pause","archive-fill":"archive","arrow-up-circle-fill":"arrow-up-circle","twitter-x":"brand-x",};

function BI({n,size,color,style}){
  return React.createElement("i",{className:"ti ti-"+(ICON_REMAP[n]||n),style:Object.assign({fontSize:size||"inherit",color:color||"currentColor",lineHeight:1,verticalAlign:"middle"},style||{})});
}

function Panel({children,style,glow,accent,danger,color,hover,onClick,className}){

  const [hov,setHov]=useState(false);

  const bdr=danger?"rgba(220,38,38,.4)":glow?"rgba(232,168,56,.25)":color?(color+"40"):"rgba(242,237,228,.07)";

  const shd=danger?"0 0 24px rgba(220,38,38,.12)":glow?"0 8px 48px rgba(232,168,56,.14),0 2px 8px rgba(0,0,0,.4)":"0 2px 12px rgba(0,0,0,.35)";

  const topLine=danger?"linear-gradient(90deg,#DC2626,transparent)":glow||accent?"linear-gradient(90deg,#E8A838,transparent)":color?`linear-gradient(90deg,${color},transparent)`:null;

  return(

    <div onClick={onClick}

      onMouseEnter={hover?()=>setHov(true):undefined}

      onMouseLeave={hover?()=>setHov(false):undefined}

      className={className||undefined}

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



function Skeleton({width,height,radius,style}){
  return(
    <div style={Object.assign({
      width:width||"100%",height:height||16,borderRadius:radius||8,
      background:"linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%)",
      backgroundSize:"200% 100%",animation:"skeleton-pulse 1.8s ease-in-out infinite"
    },style||{})}/>
  );
}

function ShareBar({text,url,toast}){
  var shareUrl=url||window.location.href;
  function copyLink(){navigator.clipboard.writeText(shareUrl).then(function(){toast&&toast("Link copied!","success");}).catch(function(){toast&&toast("Copy failed","error");});}
  function shareX(){window.open("https://x.com/intent/tweet?text="+encodeURIComponent(text||"")+"&url="+encodeURIComponent(shareUrl),"_blank");}
  function shareNative(){
    if(navigator.share){navigator.share({title:"TFT Clash",text:text||"Check this out on TFT Clash!",url:shareUrl}).catch(function(){});}
    else{copyLink();}
  }
  return(
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <button onClick={copyLink} title="Copy link" style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(242,237,228,.1)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,color:"#BECBD9",display:"flex",alignItems:"center",gap:5,fontWeight:600,transition:"all .15s"}}>{React.createElement("i",{className:"ti ti-clipboard",style:{marginRight:3}})}Copy</button>
      <button onClick={shareX} title="Share on X" style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(242,237,228,.1)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,color:"#BECBD9",display:"flex",alignItems:"center",gap:5,fontWeight:600,transition:"all .15s"}}>𝕏 Post</button>
      <button onClick={shareNative} title="Share" style={{background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,color:"#9B72CF",display:"flex",alignItems:"center",gap:5,fontWeight:600,transition:"all .15s"}}>↗ Share</button>
    </div>
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

        {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[rank.icon]||rank.icon),style:{fontSize:sm?12:15,color:rank.color}})}

        <span style={{fontSize:sm?10:12,fontWeight:700,color:rank.color,letterSpacing:".04em"}}>{rank.name}</span>

      </div>

      {showProgress&&next&&(

        <div>

          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>

            <span style={{fontSize:10,color:"#BECBD9"}}>{current} / {needed} XP</span>

            <span style={{fontSize:10,color:rank.color,fontWeight:700}}>{pct}%</span>

          </div>

          <Bar val={current} max={needed} color={rank.color} h={4}/>

          <div style={{fontSize:10,color:"#9AAABF",marginTop:3}}>Next: {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[next.icon]||next.icon),style:{fontSize:10,color:next.color}})} {next.name}</div>

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

      {type==="success"?React.createElement("i",{className:"ti ti-circle-check",style:{fontSize:17,color:c}}):type==="error"?React.createElement("i",{className:"ti ti-circle-x",style:{fontSize:17,color:c}}):React.createElement("i",{className:"ti ti-info-circle",style:{fontSize:17,color:c}})}

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

          <div style={{fontSize:22,animation:"crown-glow 3s ease 1",marginBottom:4}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</div>

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

            <Tag color="#E8A838" size="sm">{React.createElement("i",{className:"ti ti-trophy",style:{fontSize:11,color:"#E8A838",marginRight:3}})}{c.title}</Tag>

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

        {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[milestone.icon]||milestone.icon),style:{fontSize:22,filter:unlocked?"none":"grayscale(1)"}})}

        <div style={{flex:1,minWidth:0}}>

          <div style={{fontWeight:700,fontSize:13,color:unlocked?"#F2EDE4":"#BECBD9"}}>{milestone.name}</div>

          <div style={{fontSize:11,color:"#BECBD9",marginTop:1}}>{milestone.desc}</div>

        </div>

        {unlocked&&<div style={{fontSize:10,color:"#6EE7B7",fontWeight:700}}>✓</div>}

      </div>

      {unlocked&&(

        <div style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,color:"#E8A838"}}>

          {React.createElement("i",{className:"ti ti-gift",style:{fontSize:12,marginRight:4}})}{milestone.reward}

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

        <div style={{width:44,height:44,background:award.color+"18",border:"1px solid "+award.color+"44",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[award.icon]||award.icon),style:{color:award.color}})}</div>

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

          <div className="cond" style={{fontSize:16,fontWeight:800,color:"#F87171",marginBottom:4,letterSpacing:".08em",textTransform:"uppercase"}}>{React.createElement("i",{className:"ti ti-flag",style:{fontSize:14,marginRight:4}})}File Dispute</div>

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

        <span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-alert-octagon",style:{color:"#F87171"}})}</span>

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



// ─── TWO-CLICK RESULT CONFIRMATION MODALS ────────────────────────────────────

function ordinal(n){return n===1?"1st":n===2?"2nd":n===3?"3rd":n+"th";}

function shareToTwitter(text) {
  var encoded = encodeURIComponent(text);
  window.open("https://twitter.com/intent/tweet?text=" + encoded, "_blank", "width=550,height=420");
}

function buildShareText(type, data) {
  if (type === "result") {
    return "Finished " + ordinal(data.placement) + " in " + data.clashName + " - " + data.points + " season pts on TFT Clash";
  }
  if (type === "profile") {
    return data.name + " - Rank #" + data.rank + " with " + data.pts + " pts on TFT Clash";
  }
  if (type === "recap") {
    return data.winner + " won " + data.clashName + "! Full recap on TFT Clash";
  }
  return "Competing on TFT Clash - the competitive TFT platform";
}

function ResultSubmitModal(props){
  var lobby=props.lobby;
  var playerList=lobby.players||lobby.roster||[];
  var initRankings=playerList.map(function(p,i){return {player:p,position:i+1};});
  var _s=useState(initRankings);var rankings=_s[0];var setRankings=_s[1];

  function handlePositionChange(playerIndex,newPosition){
    setRankings(function(prev){return prev.map(function(r,i){
      if(i===playerIndex)return Object.assign({},r,{position:parseInt(newPosition)});
      return r;
    });});
  }

  return React.createElement("div",{style:{
    position:"fixed",inset:0,background:"rgba(8,8,15,.85)",zIndex:9995,
    display:"flex",alignItems:"center",justifyContent:"center",
    backdropFilter:"blur(8px)",
  },onClick:props.onClose},
    React.createElement("div",{style:{
      background:"#111827",border:"1px solid rgba(155,114,207,.2)",
      borderRadius:16,padding:24,maxWidth:420,width:"90%",
      maxHeight:"80vh",overflowY:"auto",
    },onClick:function(e){e.stopPropagation();}},
      React.createElement("h3",{style:{color:"#F2EDE4",marginBottom:16,fontFamily:"'Playfair Display',serif"}},"Submit Results"),
      rankings.map(function(r,i){
        return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:10,marginBottom:8}},
          React.createElement("span",{style:{fontSize:13,color:"#F2EDE4",flex:1}},r.player.username||r.player.name||r.player),
          React.createElement("select",{
            value:r.position,
            onChange:function(e){handlePositionChange(i,e.target.value);},
            style:{padding:"6px 10px",borderRadius:6,background:"#08080F",border:"1px solid rgba(242,237,228,.1)",color:"#F2EDE4",fontSize:13},
          },
            [1,2,3,4,5,6,7,8].map(function(pos){
              return React.createElement("option",{key:pos,value:pos},ordinal(pos));
            })
          )
        );
      }),
      React.createElement("div",{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement(Btn,{v:"primary",onClick:function(){props.onSubmit(rankings);}},"Submit"),
        React.createElement(Btn,{v:"ghost",onClick:props.onClose},"Cancel")
      )
    )
  );
}

function ConfirmResultsModal(props){
  var submission=props.submission;
  return React.createElement("div",{style:{
    position:"fixed",inset:0,background:"rgba(8,8,15,.85)",zIndex:9995,
    display:"flex",alignItems:"center",justifyContent:"center",
    backdropFilter:"blur(8px)",
  },onClick:props.onClose},
    React.createElement("div",{style:{
      background:"#111827",border:"1px solid rgba(78,205,196,.2)",
      borderRadius:16,padding:24,maxWidth:420,width:"90%",
    },onClick:function(e){e.stopPropagation();}},
      React.createElement("h3",{style:{color:"#F2EDE4",marginBottom:4,fontFamily:"'Playfair Display',serif"}},"Confirm Results?"),
      React.createElement("p",{style:{fontSize:12,color:"#9AAABF",marginBottom:16}},"Submitted by "+(submission.submittedBy||"unknown")),
      (submission.rankings||[]).map(function(r,i){
        return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(242,237,228,.04)"}},
          React.createElement("span",{style:{width:28,fontSize:12,fontWeight:700,color:i<3?["#E8A838","#C0C0C0","#CD7F32"][i]:"#BECBD9"}},ordinal(r.position)),
          React.createElement("span",{style:{fontSize:13,color:"#F2EDE4"}},r.player.username||r.player.name||r.player)
        );
      }),
      React.createElement("div",{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement(Btn,{v:"primary",onClick:props.onConfirm},
          React.createElement("i",{className:"ti ti-check",style:{marginRight:4}}),"Confirm"
        ),
        React.createElement(Btn,{v:"ghost",style:{borderColor:"rgba(248,113,113,.3)",color:"#F87171"},onClick:props.onDispute},
          React.createElement("i",{className:"ti ti-flag",style:{marginRight:4}}),"Dispute"
        )
      )
    )
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

    toast((isFinals?"Finals":"Round "+round+(lobbyNum!==undefined?" Lobby "+(lobbyNum+1):""))+" locked!","success");

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

          {locked?<Tag color="#52C47C">✓ Locked</Tag>:paused?<Tag color="#EAB308">{React.createElement("i",{className:"ti ti-player-pause",style:{fontSize:11,marginRight:3}})}Paused</Tag>:<div style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 8px",background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.25)",borderRadius:20}}><Dot/><span className="cond" style={{fontSize:9,fontWeight:700,color:"#6EE7B7",letterSpacing:".1em",textTransform:"uppercase"}}>Live</span></div>}

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

              {disputes.length>0?"Resolve Disputes First":paused?"Paused":!allPlaced?"Waiting for all placements...":"Lock Results"}

            </Btn>

          </div>

        )}

      </div>

    </Panel>

  );

}





// ─── NAVBAR (desktop top + mobile bottom) ────────────────────────────────────

function NotificationBell({notifications,onMarkAllRead}){

  const [open,setOpen]=useState(false);

  const unread=notifications.filter(n=>!n.read).length;

  return(

    <div style={{position:"relative"}}>

      <button onClick={()=>setOpen(o=>!o)}

        style={{position:"relative",background:"none",border:"none",padding:"6px 8px",cursor:"pointer",color:"#C8D4E0",fontSize:16,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,transition:"color .15s"}}

        onMouseEnter={e=>e.currentTarget.style.color="#E8A838"}

        onMouseLeave={e=>e.currentTarget.style.color="#C8D4E0"}>

        {React.createElement("i",{className:"ti ti-bell",style:{fontSize:18,color:"#C8D4E0"}})}

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

                    <div style={{flexShrink:0,marginTop:2}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[(n.icon||"bell")]||(n.icon||"bell")),style:{fontSize:16}})}</div>

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

function Navbar({screen,setScreen,players,isAdmin,setIsAdmin,toast,disputes,currentUser,onAuthClick,notifications,onMarkAllRead,scrimAccess,tournamentState}){

  const [pwModal,setPwModal]=useState(false);

  const [pw,setPw]=useState("");

  const [drawer,setDrawer]=useState(false);

  const dispCount=(disputes||[]).length;

  const canScrims=isAdmin||(currentUser&&(scrimAccess||[]).includes(currentUser.username));




  async function tryLogin(){

    const res=await fetch('/api/check-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});

    const data=await res.json();

    if(data?.isAdmin){setIsAdmin(true);setPwModal(false);setPw("");toast("Admin mode activated","success");}

    else toast("Wrong password","error");

  }



  // Primary mobile tabs (5 max)

  var phase=tournamentState&&tournamentState.phase;
  var clashItem=null;
  if(phase==="registration") clashItem={id:"clash",icon:"ti-swords",label:"Clash",badge:"Register",badgeColor:"#E8A838"};
  else if(phase==="live") clashItem={id:"clash",icon:"ti-swords",label:"LIVE",glow:true};
  else if(phase==="complete") clashItem={id:"clash",icon:"ti-swords",label:"Clash",badge:"Results",badgeColor:"#4ECDC4"};

  var PRIMARY=[
    {id:"home",icon:"ti-home",label:"Home"},
    clashItem,
    {id:"standings",icon:"ti-chart-bar",label:"Standings"},
    {id:"profile",icon:"ti-user",label:"Profile"},
    {id:"more",icon:"ti-dots",label:"More"},
  ].filter(Boolean);



  const [desktopMore,setDesktopMore]=useState(false);



  // Desktop nav

  var DESKTOP_PRIMARY=[
    {id:"home",label:"Home"},
    clashItem?{id:"clash",label:phase==="live"?"\u25cf LIVE CLASH":phase==="registration"?"Clash \xb7 Register":phase==="complete"?"Clash \xb7 Results":"Clash"}:null,
    {id:"standings",label:"Standings"},
    phase!=="live"?{id:"events",label:"Events"}:null,
    {id:"profile",label:"Profile"},
  ].filter(Boolean);

  var DESKTOP_MORE=[
    phase==="live"?{id:"events",label:"Events"}:null,
    canScrims?{id:"scrims",label:"Scrims"}:null,
    {id:"pricing",label:"Pricing"},
    {id:"rules",label:"Rules"},
    {id:"faq",label:"FAQ"},
    {id:"host-apply",label:"Host"},
    {id:"gear",label:"Gear"},
    isAdmin?{id:"admin",label:"Admin"}:null,
  ].filter(Boolean);

  const desktopMoreActive=DESKTOP_MORE.some(l=>l.id===screen);

  var navProfileFields=currentUser?[currentUser.user_metadata&&currentUser.user_metadata.riot_id,currentUser.user_metadata&&currentUser.user_metadata.bio,currentUser.user_metadata&&currentUser.user_metadata.region]:[];
  var navProfileComplete=navProfileFields.filter(Boolean).length;
  var navProfileTotal=currentUser?3:3;



  const DRAWER_ITEMS=[
    {id:"home",icon:"house-fill",label:"Home",section:"main"},
    {id:"roster",icon:"people-fill",label:"Roster",section:"main"},
    {id:"bracket",icon:"diagram-3-fill",label:"Bracket",section:"main"},
    {id:"leaderboard",icon:"bar-chart-line-fill",label:"Leaderboard",section:"main"},
    {id:"results",icon:"clipboard-check-fill",label:"Results",section:"main"},
    {id:"hof",icon:"award-fill",label:"Hall of Fame",section:"explore"},
    ...(canScrims?[{id:"scrims",icon:"controller",label:"Scrims",section:"main"}]:[]),
    ...(isAdmin?[{id:"admin",icon:"hexagon-fill",label:"Admin Panel",section:"main"}]:[]),
    {id:"archive",icon:"archive-fill",label:"Archive",section:"explore"},
    {id:"tournaments",icon:"lightning-charge-fill",label:"Tournaments",section:"explore"},
    {id:"featured",icon:"star-fill",label:"Featured Events",section:"explore"},
    {id:"challenges",icon:"star-fill",label:"Challenges & XP",section:"community"},
    {id:"milestones",icon:"gift-fill",label:"Milestones & Rewards",section:"community"},
    {id:"rules",icon:"journal-text",label:"Tournament Rules",section:"info"},
    {id:"faq",icon:"question-circle-fill",label:"FAQ",section:"info"},
    {id:"pricing",icon:"tag-fill",label:"Pricing & Plans",section:"info"},
    {id:"account",icon:"person-fill",label:currentUser?("My Account · "+currentUser.username):"Sign In / Sign Up",section:"account"},

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

            {(function(){var lastSection="";return DRAWER_ITEMS.map(function(l){
              var divider=l.section!==lastSection&&lastSection!==""?React.createElement("div",{key:"div-"+l.section,style:{height:1,background:"rgba(242,237,228,.06)",margin:"8px 16px"}}):null;
              lastSection=l.section;
              return React.createElement(React.Fragment,{key:l.id},divider,
                React.createElement("button",{onClick:function(){if(l.id==="account"&&!currentUser){onAuthClick("login");setDrawer(false);return;}setScreen(l.id);setDrawer(false);},
                  style:{display:"flex",alignItems:"center",gap:14,padding:"12px 20px",background:screen===l.id?"rgba(232,168,56,.08)":"none",
                    border:"none",color:screen===l.id?"#E8A838":"#C8BFB0",fontSize:13,fontWeight:600,width:"100%",textAlign:"left",cursor:"pointer",transition:"all .15s",borderRadius:0}},
                  React.createElement("span",{style:{minWidth:22,display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement("i",{className:"ti ti-"+(ICON_REMAP[l.icon]||l.icon),style:{fontSize:17,opacity:screen===l.id?1:.7}})),l.label)
              );});})()}

            <div style={{marginTop:"auto",padding:"20px"}}>

              {!isAdmin

                ?<Btn v="ghost" full onClick={()=>{setDrawer(false);setPwModal(true);}}>Admin Login</Btn>

                :<Btn v="crimson" full onClick={()=>{setIsAdmin(false);setDrawer(false);toast("Admin off","success");}}>● Admin On</Btn>

              }

            </div>

          </div>

        </>

      )}



      {/* Desktop top nav  -  two-row layout */}

      <nav className="top-nav" style={{borderBottom:"2px solid transparent",borderImage:"linear-gradient(90deg,transparent,rgba(155,114,207,.3),rgba(232,168,56,.2),transparent) 1"}}>

        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 16px",height:54,display:"flex",alignItems:"center",gap:0}}>

          {/* Hamburger button - mobile only */}
          <button className="mobile-hamburger" onClick={()=>setDrawer(d=>!d)}
            style={{background:"none",border:"none",padding:"8px",marginRight:8,cursor:"pointer",color:"#C8D4E0",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>
            {React.createElement("i",{className:"ti ti-menu-2"})}
          </button>

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

          <div className="desktop-links" style={{alignItems:"center",gap:0,flex:1,minWidth:0}}>

            {DESKTOP_PRIMARY.map(function(l){
              var isLiveClash=l.id==="clash"&&phase==="live";
              var liveStyle=isLiveClash?{
                background:"linear-gradient(135deg,rgba(232,168,56,.25),rgba(248,113,113,.15))",
                color:"#E8A838",
                fontWeight:700,
                border:"1px solid rgba(232,168,56,.4)",
                boxShadow:"0 0 12px rgba(232,168,56,.3),0 0 24px rgba(232,168,56,.1)",
              }:{};
              return React.createElement("button",{key:l.id,onClick:function(){setScreen(l.id);},
                "data-active":screen===l.id?"true":"false",
                style:Object.assign({},{background:screen===l.id&&!isLiveClash?"rgba(232,168,56,.1)":"none",border:"none",padding:"6px 12px",fontSize:12.5,fontWeight:600,
                  color:screen===l.id&&!isLiveClash?"#E8A838":"#9AAABF",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,
                  borderRadius:8,
                  transition:"all .2s",letterSpacing:".02em",fontFamily:"'Chakra Petch',sans-serif"},liveStyle)},
                l.label,
                l.badge?React.createElement("span",{style:{
                  marginLeft:6,fontSize:10,fontWeight:700,
                  padding:"2px 6px",borderRadius:4,
                  background:l.badgeColor==="#E8A838"?"rgba(232,168,56,.15)":"rgba(78,205,196,.15)",
                  color:l.badgeColor||"#9AAABF",
                  border:"1px solid "+(l.badgeColor==="#E8A838"?"rgba(232,168,56,.3)":"rgba(78,205,196,.3)"),
                }},l.badge):null
              );
            })}

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

          </div>{/* end desktop-links */}

          <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto",flexShrink:0}}>

            {dispCount>0&&(

              <button onClick={()=>setScreen("admin")} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:"rgba(220,38,38,.12)",border:"1px solid rgba(220,38,38,.4)",borderRadius:20,cursor:"pointer",animation:"pulse-red 2s infinite"}}>

                <Dot color="#EF4444" size={6}/>

                <span style={{fontSize:11,fontWeight:700,color:"#F87171"}}>{dispCount}</span>

              </button>

            )}

            <NotificationBell notifications={notifications||[]} onMarkAllRead={onMarkAllRead||function(){}}/>

            {currentUser?(

              <button onClick={()=>setScreen("account")} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.3)",borderRadius:20,padding:"5px 12px",cursor:"pointer",transition:"all .15s"}}

                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(232,168,56,.6)"}

                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(232,168,56,.3)"}>

                {(function(){var navPlayer=players&&players.find(function(p){return p.auth_user_id===currentUser.id||p.authUserId===currentUser.id||p.name===currentUser.username;});var navPic=navPlayer&&navPlayer.profile_pic_url||currentUser.user_metadata&&currentUser.user_metadata.profilePic||"";if(navPic){return React.createElement("div",{style:{width:20,height:20,borderRadius:"50%",background:"url("+navPic+") center/cover",flexShrink:0}});}return null;})()}

                <span style={{fontSize:12,fontWeight:600,color:"#E8A838"}}>{currentUser.username}</span>

                <span style={{width:6,height:6,borderRadius:"50%",background:navProfileComplete===navProfileTotal?"#52C47C":"#E8A838",display:"inline-block",flexShrink:0}}/>

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

      {React.createElement("nav",{className:"mobile-bottom-bar",style:{
        position:"fixed",
        bottom:0,
        left:0,
        right:0,
        background:"rgba(8,8,15,.97)",
        borderTop:"1px solid rgba(242,237,228,.08)",
        display:"flex",
        justifyContent:"space-around",
        alignItems:"center",
        padding:"8px 0 calc(8px + env(safe-area-inset-bottom))",
        zIndex:9990,
        backdropFilter:"blur(12px)",
      }},
        PRIMARY.map(function(item){
          var isActive=screen===item.id||(item.id==="clash"&&(screen==="bracket"||screen==="clash-register"||screen==="clash-live"||screen==="clash-results"));
          return React.createElement("button",{key:item.id,onClick:function(){setScreen(item.id);},
            style:{
              display:"flex",
              flexDirection:"column",
              alignItems:"center",
              gap:2,
              padding:"4px 12px",
              cursor:"pointer",
              color:isActive?"#F2EDE4":"#9AAABF",
              position:"relative",
              background:"none",
              border:"none",
              fontFamily:"'Barlow Condensed',sans-serif",
            }},
            item.glow?React.createElement("div",{style:{
              position:"absolute",top:2,right:8,
              width:6,height:6,borderRadius:"50%",
              background:"#E8A838",
              boxShadow:"0 0 8px #E8A838",
            }}):null,
            item.badge?React.createElement("span",{style:{
              position:"absolute",top:0,right:2,
              fontSize:7,fontWeight:700,
              padding:"1px 4px",borderRadius:3,
              background:item.badgeColor==="#E8A838"?"rgba(232,168,56,.2)":"rgba(78,205,196,.2)",
              color:item.badgeColor||"#9AAABF",
            }},item.badge):null,
            React.createElement("i",{className:"ti "+(item.icon||"ti-circle"),style:{fontSize:20}}),
            React.createElement("span",{style:{fontSize:9,letterSpacing:".04em"}},item.label)
          );
        })
      )}



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

  const cols=compact?"28px 1fr 60px 55px 50px 50px":"28px 1fr 70px 70px 50px 55px 50px";

  return(

    <Panel style={{overflowX:"auto"}}>

      <div className="standings-table-wrap" style={{minWidth:compact?260:380}}>

      <div style={{display:"grid",gridTemplateColumns:cols,padding:"9px 14px",borderBottom:"1px solid rgba(242,237,228,.07)",background:"#0A0F1A"}}>

        <span className="cond" style={{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".1em"}}>#</span>

        <H k="name" label="Player"/><H k="pts" label="Pts"/><H k="avg" label="Avg"/><H k="games" label="G"/>

        {!compact&&<H k="wins" label="W"/>}

        <span className="cond" style={{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".1em"}}>Trend</span>

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

        var tierLine=null;
        for(var ti=0;ti<TIER_THRESHOLDS.length;ti++){
          if(i===TIER_THRESHOLDS[ti].maxRank&&i>0){
            var tColor=TIER_THRESHOLDS[ti].color;
            var tName=TIER_THRESHOLDS[ti].name;
            tierLine=React.createElement("div",{key:"tier-"+i,style:{display:"flex",alignItems:"center",gap:8,padding:"4px 14px",margin:"4px 0"}},
              React.createElement("div",{style:{flex:1,height:1,background:tColor,opacity:0.4}}),
              React.createElement("span",{className:"cond",style:{fontSize:8,fontWeight:700,color:tColor,letterSpacing:".1em",textTransform:"uppercase"}},tName),
              React.createElement("div",{style:{flex:1,height:1,background:tColor,opacity:0.4}})
            );
            break;
          }
        }

        var sparkData=(p.clashHistory||[]).slice(-5).map(function(c){return c.placement||4;});

        var deltaNode=p.last_clash_rank?React.createElement("span",{style:{fontSize:10,fontWeight:700,color:p.last_clash_rank>(i+1)?"#6EE7B7":p.last_clash_rank<(i+1)?"#F87171":"#9AAABF",marginLeft:4}},
          React.createElement("i",{className:"ti ti-"+(p.last_clash_rank>(i+1)?"arrow-up":"arrow-down"),style:{fontSize:9}}),
          " "+Math.abs(p.last_clash_rank-(i+1))
        ):null;

        const rowEl=(

          <div key={p.id} id={isMe?"lb-me-row":undefined} onClick={onRowClick?()=>onRowClick(p):undefined}

            className={"standings-row stagger-row"+(i===0?" standings-row-1 shimmer-card row-champion":i===1?" standings-row-2":i===2?" standings-row-3":"")+(isMe?" standings-row-me":"")}

            style={{display:"grid",gridTemplateColumns:cols,

              padding:top3?"14px 14px":"10px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",

              background:rowBg,border:"1px solid "+rowBorder,borderRadius:top3?8:0,marginBottom:top3?3:0,

              alignItems:"center",cursor:onRowClick?"pointer":"default",opacity:i>=8?.55:1,

              borderLeft:isMe?"3px solid #9B72CF":"3px solid transparent",

              animationDelay:(i*0.03)+"s",

              boxShadow:i===0?"0 4px 20px rgba(232,168,56,.1),inset 0 1px 0 rgba(232,168,56,.08)":isMe?"0 2px 12px rgba(155,114,207,.08)":"none"}}>

            <div className="mono rank-num" style={{fontSize:top3?18:13,fontWeight:900,color:rankCol,minWidth:24,textAlign:"center",textShadow:i===0?"0 0 18px rgba(232,168,56,.8)":i===1?"0 0 12px rgba(192,192,192,.6)":i===2?"0 0 12px rgba(205,127,50,.6)":"none",display:"flex",alignItems:"center",justifyContent:"center"}}>

              {i<3?React.createElement("i",{className:"ti ti-"+(ICON_REMAP["award-fill"]||"award-fill")}):i+1}

              {deltaNode}

            </div>

            <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>

              <div style={{minWidth:0}}>

                <div style={{fontWeight:top3?700:500,fontSize:top3?15:13,color:nameCol,display:"flex",alignItems:"center",gap:5,overflow:"hidden"}}>

                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>

                  {p.plan==="pro"&&<span style={{fontSize:9,fontWeight:800,color:"#E8A838",background:"rgba(232,168,56,.15)",padding:"1px 5px",borderRadius:4,flexShrink:0,letterSpacing:".04em"}}>PRO</span>}

                  {p.plan==="host"&&<span style={{fontSize:9,fontWeight:800,color:"#9B72CF",background:"rgba(155,114,207,.15)",padding:"1px 5px",borderRadius:4,flexShrink:0,letterSpacing:".04em"}}>HOST</span>}

                  {isHotStreak(p)&&<span title={"Win streak: "+(p.currentStreak||0)} style={{flexShrink:0,fontSize:14,cursor:"default"}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}</span>}

                  {isOnTilt(p)&&<span title={"Cold streak: "+(p.tiltStreak||0)} style={{flexShrink:0,fontSize:14,cursor:"default"}}>{React.createElement("i",{className:"ti ti-snowflake",style:{color:"#38BDF8"}})}</span>}


                </div>

                {!compact&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>

                  <ClashRankBadge xp={estimateXp(p)} size="sm"/>

                  <span className="mono" style={{fontSize:11,color:"#B8C8D8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.riotId}</span>

                </div>}

              </div>

            </div>

            <div className="mono pts-glow count-up" style={{fontSize:top3?22:15,fontWeight:800,color:ptsCol,lineHeight:1,textShadow:top3?"0 0 14px currentColor":"none",animationDelay:(i*0.03+0.1)+"s"}}>{useEffective?effectivePts(p,seasonConfig):p.pts}</div>

            <AvgBadge avg={avg>0?avg:null}/>

            <div className="mono" style={{fontSize:11,color:top8?"#BECBD9":"#9AAABF"}}>{p.games||0}</div>

            {!compact&&<div className="mono" style={{fontSize:13,color:top3?"#6EE7B7":top8?"#6EE7B7":"#8896A8"}}>{p.wins||0}</div>}

            <div style={{display:"flex",alignItems:"center"}}>
              {sparkData.length>=2?React.createElement(Sparkline,{data:sparkData,w:50,h:16,color:"#9B72CF"}):null}
            </div>

          </div>

        );

        return React.createElement(React.Fragment,{key:"frag-"+i},tierLine,rowEl);

      })}

      {rows.length===0&&<div style={{textAlign:"center",padding:40,color:"#8E9BB0",fontSize:14}}>No data yet</div>}

      </div>

    </Panel>

  );

}






// Wrap heavy component in memo to prevent unnecessary re-renders
var MemoStandingsTable = memo(StandingsTable);

// ─── STANDINGS SCREEN (wrapper: Leaderboard + HoF + Roster tabs) ──────────────

function StandingsScreen(props){
  var tab=props.subRoute||"";
  var tabs=[
    {id:"",label:"Leaderboard",icon:"ti-trophy"},
    {id:"hof",label:"Hall of Fame",icon:"ti-crown"},
    {id:"roster",label:"Player Directory",icon:"ti-users"},
  ];
  return React.createElement("div",{className:"page fade-up"},
    React.createElement("div",{style:{textAlign:"center",padding:"24px 16px 0",marginBottom:20}},
      React.createElement("h1",{style:{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:900,color:"#F2EDE4",marginBottom:4,letterSpacing:".01em"}},"Standings"),
      React.createElement("p",{style:{fontSize:13,color:"#9AAABF",maxWidth:400,margin:"0 auto"}},"Season rankings, legends, and the full player roster")
    ),
    React.createElement("div",{className:"tab-bar-wrap",style:{display:"flex",justifyContent:"center",gap:6,padding:"0 16px",marginBottom:24,overflowX:"auto"}},
      tabs.map(function(t){
        var active=tab===t.id;
        return React.createElement("button",{
          key:t.id,
          className:"tab-btn",
          onClick:function(){props.setScreen("standings"+(t.id?"/"+t.id:""));},
          style:{
            display:"flex",alignItems:"center",gap:6,
            padding:"10px 20px",
            background:active?"rgba(155,114,207,.12)":"rgba(242,237,228,.03)",
            border:active?"1px solid rgba(155,114,207,.3)":"1px solid rgba(242,237,228,.06)",
            borderRadius:10,
            color:"#F2EDE4",
            fontFamily:"Inter,system-ui,sans-serif",
            fontSize:13,
            fontWeight:active?600:400,
            cursor:"pointer",
            letterSpacing:".03em",
            transition:"all .25s ease",
            boxShadow:active?"0 0 12px rgba(155,114,207,.1)":"none",
          }
        },
          React.createElement("i",{className:t.icon,style:{fontSize:16,color:active?"#9B72CF":"#BECBD9"}}),
          t.label
        );
      })
    ),
    tab===""?React.createElement(MemoLeaderboardScreen,{players:props.players,setScreen:props.setScreen,setProfilePlayer:props.setProfilePlayer,currentUser:props.currentUser,toast:props.toast}):null,
    tab==="hof"?React.createElement(MemoHofScreen,{players:props.players,setScreen:props.setScreen,setProfilePlayer:props.setProfilePlayer,pastClashes:props.pastClashes,toast:props.toast}):null,
    tab==="roster"?React.createElement(RosterScreen,{players:props.players,setScreen:props.setScreen,setProfilePlayer:props.setProfilePlayer,currentUser:props.currentUser}):null
  );
}

// ─── PROFILE SCREEN (wrapper: Account + Milestones + Challenges tabs) ─────────

function ProfileScreen(props){
  var tab=props.subRoute||"";
  var tabs=[
    {id:"",label:"Account",icon:"ti-user-circle"},
    {id:"milestones",label:"Milestones",icon:"ti-award"},
    {id:"challenges",label:"Challenges",icon:"ti-flame"},
  ];
  if(!props.currentUser){
    return React.createElement("div",{className:"page",style:{textAlign:"center",paddingTop:80}},
      React.createElement("i",{className:"ti ti-lock",style:{fontSize:48,color:"#9B72CF",opacity:.4,display:"block",marginBottom:16}}),
      React.createElement("h2",{style:{color:"#F2EDE4",fontFamily:"'Playfair Display',serif",marginBottom:8}},"Sign in to view your profile"),
      React.createElement("p",{style:{fontSize:13,color:"#9AAABF",marginBottom:20}},"Your account, milestones, and challenges live here."),
      React.createElement("div",{style:{display:"flex",gap:10,justifyContent:"center"}},
        React.createElement(Btn,{v:"primary",onClick:function(){props.setAuthScreen("login");}},"Sign In"),
        React.createElement(Btn,{v:"ghost",onClick:function(){props.setScreen("home");}},"Back to Home")
      )
    );
  }
  return React.createElement("div",{className:"page fade-up",style:{paddingTop:20}},
    React.createElement("div",{className:"tab-bar-wrap",style:{display:"flex",justifyContent:"center",gap:6,padding:"0 16px",marginBottom:24,overflowX:"auto"}},
      tabs.map(function(t){
        var active=tab===t.id;
        return React.createElement("button",{
          key:t.id,
          className:"tab-btn",
          onClick:function(){props.setScreen("profile"+(t.id?"/"+t.id:""));},
          style:{
            display:"flex",alignItems:"center",gap:6,
            padding:"10px 20px",
            background:active?"rgba(155,114,207,.12)":"rgba(242,237,228,.03)",
            border:active?"1px solid rgba(155,114,207,.3)":"1px solid rgba(242,237,228,.06)",
            borderRadius:10,
            color:"#F2EDE4",
            fontFamily:"Inter,system-ui,sans-serif",
            fontSize:13,
            fontWeight:active?600:400,
            cursor:"pointer",
            letterSpacing:".03em",
            transition:"all .25s ease",
            boxShadow:active?"0 0 12px rgba(155,114,207,.1)":"none",
          }
        },
          React.createElement("i",{className:t.icon,style:{fontSize:16,color:active?"#9B72CF":"#BECBD9"}}),
          t.label
        );
      })
    ),
    tab===""?React.createElement(React.Fragment,null,
      React.createElement(AccountScreen,{user:props.currentUser,onUpdate:props.onUpdate,onLogout:props.onLogout,toast:props.toast,setScreen:props.setScreen,players:props.players,setPlayers:props.setPlayers,setProfilePlayer:props.setProfilePlayer,isAdmin:props.isAdmin,hostApps:props.hostApps}),
      React.createElement("div",{className:"wrap",style:{maxWidth:600,margin:"0 auto",padding:"0 16px"}},
        React.createElement(ReferralPanel,{currentUser:props.currentUser,toast:props.toast})
      )
    ):null,
    tab==="milestones"?React.createElement(MilestonesScreen,{players:props.players,setScreen:props.setScreen,setProfilePlayer:props.setProfilePlayer,currentUser:props.currentUser}):null,
    tab==="challenges"?React.createElement(ChallengesScreen,{currentUser:props.currentUser,players:props.players,toast:props.toast,setScreen:props.setScreen,challengeCompletions:props.challengeCompletions}):null
  );
}

// ─── LIVE STANDINGS TABLE (animated, for live clash phase) ────────────────────

function LiveStandingsTable(props){
  var standings=props.standings||[];
  if(standings.length===0) return null;
  return React.createElement("div",{style:{
    background:"rgba(8,8,15,.6)",border:"1px solid rgba(242,237,228,.06)",
    borderRadius:12,overflow:"hidden",margin:"0 16px 20px",
  }},
    React.createElement("div",{style:{
      display:"grid",gridTemplateColumns:"36px 1fr 60px 50px",
      padding:"8px 14px",fontSize:10,color:"#9AAABF",
      borderBottom:"1px solid rgba(242,237,228,.04)",
      fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
    }},
      React.createElement("span",null,"#"),
      React.createElement("span",null,"Player"),
      React.createElement("span",{style:{textAlign:"right"}},"Pts"),
      React.createElement("span",{style:{textAlign:"right"}},"Delta")
    ),
    standings.map(function(p,i){
      var isFirst=i===0;
      var delta=p.delta||0;
      var posChange=p.posChange||0;
      return React.createElement("div",{
        key:p.id||p.username||p.name||i,
        className:"fade-up",
        style:{
          display:"grid",gridTemplateColumns:"36px 1fr 60px 50px",
          padding:"10px 14px",fontSize:13,
          background:isFirst?"rgba(232,168,56,.04)":"transparent",
          borderLeft:isFirst?"3px solid #E8A838":"3px solid transparent",
          animationDelay:(i*0.05)+"s",
        }
      },
        React.createElement("span",{style:{
          color:isFirst?"#E8A838":"#BECBD9",fontWeight:isFirst?700:400,
        }},isFirst?"\ud83d\udc51":String(i+1)),
        React.createElement("span",{style:{color:"#F2EDE4",fontWeight:isFirst?700:500,display:"flex",alignItems:"center",gap:6}},
          p.username||p.name,
          posChange!==0?React.createElement("span",{style:{
            fontSize:10,
            color:posChange>0?"#6EE7B7":"#F87171",
          }},posChange>0?"\u25b2"+posChange:"\u25bc"+Math.abs(posChange)):null
        ),
        React.createElement("span",{style:{textAlign:"right",color:isFirst?"#E8A838":"#F2EDE4",fontWeight:700}},p.points||0),
        React.createElement("span",{style:{
          textAlign:"right",fontSize:12,
          color:delta>0?"#6EE7B7":delta<0?"#F87171":"#9AAABF",
        }},delta>0?"+"+delta:delta===0?"\u2014":String(delta))
      );
    })
  );
}

// ─── YOUR FINISH CARD (results phase highlight for current user) ─────────────

function YourFinishCard(props){
  var currentUser=props.currentUser;
  var finalStandings=props.finalStandings;
  if(!currentUser||!finalStandings||finalStandings.length===0) return null;
  var found=null;
  for(var i=0;i<finalStandings.length;i++){
    if(finalStandings[i].username===currentUser.username||finalStandings[i].name===currentUser.username){
      found=finalStandings[i];
      found.position=i+1;
      break;
    }
  }
  if(!found) return null;
  var medals=["\ud83e\udd47","\ud83e\udd48","\ud83e\udd49"];
  var posChange=found.posChange||0;
  return React.createElement("div",{className:"fade-up",style:{
    background:"rgba(155,114,207,.06)",
    border:"1px solid rgba(155,114,207,.25)",
    borderLeft:"4px solid #9B72CF",
    borderRadius:12,padding:"16px 20px",margin:"0 16px 20px",
    display:"flex",alignItems:"center",justifyContent:"space-between",
  }},
    React.createElement("div",null,
      React.createElement("div",{style:{fontSize:10,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4,fontFamily:"'Barlow Condensed',sans-serif"}},"Your Finish"),
      React.createElement("div",{style:{fontSize:24,fontWeight:900,color:"#9B72CF",fontFamily:"'Playfair Display',serif"}},
        found.position<=3?(medals[found.position-1]+" "):"",
        "#"+found.position
      )
    ),
    React.createElement("div",{style:{textAlign:"right"}},
      React.createElement("div",{style:{fontSize:22,fontWeight:700,color:"#E8A838"}},(found.points||found.pts||0)+" pts"),
      posChange!==0?React.createElement("div",{style:{fontSize:11,color:posChange>0?"#6EE7B7":"#F87171"}},
        posChange>0?"\u25b2 "+posChange+" from last clash":"\u25bc "+Math.abs(posChange)+" from last clash"
      ):null
    )
  );
}

// ─── CLASH SCREEN (phase-adaptive: registration / live / results) ─────────────

function hexToRgb(hex){
  var r=parseInt(hex.slice(1,3),16);
  var g=parseInt(hex.slice(3,5),16);
  var b=parseInt(hex.slice(5,7),16);
  return r+","+g+","+b;
}

function ClashScreen(props){
  var phase=props.tournamentState&&props.tournamentState.phase;
  var phaseColors={registration:"#9B72CF",live:"#E8A838",complete:"#4ECDC4"};
  var phaseLabels={registration:"Registration Open",live:"Live \u2014 Game "+(props.tournamentState&&props.tournamentState.round||1)+" of "+(props.tournamentState&&props.tournamentState.totalGames||4),complete:"Results"};
  var accentColor=phaseColors[phase]||"#9B72CF";

  if(!phase){
    return React.createElement("div",{className:"page",style:{textAlign:"center",padding:"80px 20px",color:"#9AAABF"}},
      React.createElement("i",{className:"ti ti-swords",style:{fontSize:52,opacity:.25,display:"block",marginBottom:16}}),
      React.createElement("h2",{style:{color:"#F2EDE4",marginBottom:8,fontFamily:"'Playfair Display',serif",fontSize:24}},"No Active Clash"),
      React.createElement("p",{style:{fontSize:14,maxWidth:360,margin:"0 auto",lineHeight:1.5}},"Check back when registration opens for the next clash."),
      React.createElement("div",{style:{marginTop:24}},
        React.createElement(Btn,{v:"ghost",onClick:function(){props.setScreen("events");}},"Browse Past Events")
      )
    );
  }

  var recapData=phase==="complete"?generateRecap(props.tournamentState):null;
  var recapEl=recapData?React.createElement(ClashRecap,{recap:recapData,toast:props.toast}):null;

  // Awards computation for complete phase
  var awardsEl=null;
  if(phase==="complete"&&props.tournamentState&&props.tournamentState.finalStandings&&props.tournamentState.finalStandings.length>0){
    var fs=props.tournamentState.finalStandings;
    var mvpPlayer=fs.reduce(function(best,p){return((p.points||p.pts||0)>(best.points||best.pts||0))?p:best;},fs[0]);
    var comebackPlayer=null;
    var bestClimb=-Infinity;
    fs.forEach(function(p,idx){
      if(p.game1Pos){var climb=p.game1Pos-(idx+1);if(climb>bestClimb){bestClimb=climb;comebackPlayer=p;}}
    });
    var clutchPlayer=null;
    var bestLastGame=Infinity;
    fs.forEach(function(p){
      var lp=p.lastGamePlace||p.lastPlace||null;
      if(lp!==null&&lp<bestLastGame){bestLastGame=lp;clutchPlayer=p;}
    });
    var awardsList=[
      {icon:"ti-trophy",label:"MVP",name:mvpPlayer?mvpPlayer.username||mvpPlayer.name:"",color:"#E8A838"},
      comebackPlayer&&bestClimb>=2?{icon:"ti-trending-up",label:"Comeback King",name:comebackPlayer.username||comebackPlayer.name,color:"#6EE7B7"}:null,
      clutchPlayer?{icon:"ti-bolt",label:"Clutch Player",name:clutchPlayer.username||clutchPlayer.name,color:"#C4B5FD"}:null,
    ].filter(Boolean);
    awardsEl=React.createElement("div",{style:{margin:"0 16px 20px"}},
      React.createElement("div",{style:{fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:"#9AAABF",fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}},"Awards"),
      React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
        awardsList.map(function(a,i){
          return React.createElement("div",{key:i,style:{
            display:"flex",alignItems:"center",gap:8,
            padding:"8px 14px",borderRadius:10,
            background:"rgba(17,24,39,.8)",
            border:"1px solid rgba("+hexToRgb(a.color)+",.2)",
            flex:"1 1 140px",minWidth:0,
          }},
            React.createElement("i",{className:"ti "+a.icon,style:{fontSize:18,color:a.color,flexShrink:0}}),
            React.createElement("div",{style:{minWidth:0}},
              React.createElement("div",{style:{fontSize:10,color:a.color,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'Barlow Condensed',sans-serif"}},a.label),
              React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},a.name)
            )
          );
        })
      )
    );
  }

  // Registered players for scouting cards (registration phase)
  var registeredPlayers=phase==="registration"?(props.players||[]).filter(function(p){return p.registered||p.checkedIn;}):[];

  return React.createElement("div",{className:"page fade-up"},
    React.createElement("div",{style:{
      position:"relative",overflow:"hidden",
      padding:"16px 20px",margin:"0 16px 20px",
      borderRadius:14,
      background:"rgba(17,24,39,.8)",
      border:"1px solid rgba("+hexToRgb(accentColor)+",.2)",
    }},
      React.createElement("div",{style:{
        position:"absolute",top:0,left:0,right:0,height:3,
        background:"linear-gradient(90deg,transparent,"+accentColor+",transparent)",
      }}),
      phase==="live"?React.createElement("div",{style:{
        position:"absolute",top:"-50%",left:"30%",width:"40%",height:"200%",
        background:"radial-gradient(ellipse,rgba(232,168,56,.06) 0%,transparent 70%)",
        pointerEvents:"none",
      }}):null,
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
        React.createElement("div",{style:{
          width:8,height:8,borderRadius:"50%",background:accentColor,
          boxShadow:phase==="live"?"0 0 12px "+accentColor+", 0 0 24px "+accentColor:"none",
          animation:phase==="live"?"live-dot 1.5s ease infinite":"none",
        }}),
        React.createElement("span",{style:{
          fontSize:11,textTransform:"uppercase",letterSpacing:".1em",
          color:accentColor,fontWeight:700,
          fontFamily:"'Barlow Condensed',sans-serif",
        }},phaseLabels[phase]||"Clash"),
        phase==="live"?React.createElement("span",{style:{
          marginLeft:"auto",fontSize:10,color:"#E8A838",
          fontFamily:"'Barlow Condensed',sans-serif",
          letterSpacing:".06em",opacity:.7,
        }},"LIVE"):null
      )
    ),
    phase==="registration"&&registeredPlayers.length>0?React.createElement("div",{style:{margin:"0 16px 20px"}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}},
        React.createElement("div",{style:{fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:"#9AAABF",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif"}},"Registered - "+registeredPlayers.length+" players"),
        React.createElement("div",{style:{fontSize:10,color:"#9AAABF",fontFamily:"'Barlow Condensed',sans-serif"}},"\ud83d\udc41 Scout the field")
      ),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6}},
        registeredPlayers.map(function(p,idx){
          var sparkData=(p.clashHistory||[]).slice(-5).map(function(c){return c.placement||c.place||4;});
          return React.createElement("div",{
            key:p.id||p.username||idx,
            style:{
              display:"flex",alignItems:"center",gap:10,
              padding:"10px 12px",
              background:"rgba(255,255,255,.03)",
              borderRadius:10,
              border:"1px solid rgba(255,255,255,.06)",
              cursor:"pointer",
            },
            onClick:function(){if(props.setProfilePlayer&&props.setScreen){props.setProfilePlayer(p);props.setScreen("profile");}}
          },
            React.createElement("div",{style:{
              width:28,height:28,borderRadius:8,
              background:"linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.08))",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,fontWeight:800,color:"#C4B5FD",flexShrink:0,
            }},"#"+(idx+1)),
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},p.username||p.name||"Player"),
              React.createElement("div",{style:{fontSize:10,color:"#9AAABF"}},(p.wins||0)+" wins, "+(p.games||0)+" games")
            ),
            sparkData.length>=2?React.createElement(Sparkline,{data:sparkData,w:40,h:14,color:"#9B72CF"}):React.createElement("div",{style:{width:40,height:14,opacity:.2,fontSize:9,color:"#9AAABF",display:"flex",alignItems:"center"}},"--")
          );
        })
      )
    ):null,
    phase==="registration"||phase==="live"?React.createElement(MemoBracketScreen,{players:props.players,setPlayers:props.setPlayers,toast:props.toast,isAdmin:props.isAdmin,currentUser:props.currentUser,setProfilePlayer:props.setProfilePlayer,setScreen:props.setScreen,tournamentState:props.tournamentState,setTournamentState:props.setTournamentState,seasonConfig:props.seasonConfig}):null,
    phase==="live"?React.createElement("div",{style:{display:"flex",gap:4,marginBottom:16,justifyContent:"center",padding:"0 16px"}},
      Array.from({length:props.tournamentState.totalGames||3},function(_,i){
        var isComplete=i+1<(props.tournamentState.round||1);
        var isCurrent=i+1===(props.tournamentState.round||1);
        return React.createElement("div",{key:i,style:{
          width:isCurrent?24:8,height:8,borderRadius:4,
          background:isComplete?"#6EE7B7":isCurrent?"#E8A838":"rgba(255,255,255,.1)",
          transition:"all .3s ease",
        }});
      })
    ):null,
    phase==="live"&&(props.tournamentState.seedAlgo==="swiss")&&props.tournamentState.round>1&&props.tournamentState.round%2===0?React.createElement("div",{style:{
      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      padding:"8px 16px",margin:"0 16px 12px",
      background:"rgba(232,168,56,.04)",
      border:"1px solid rgba(232,168,56,.12)",
      borderRadius:8,maxHeight:48,
      fontSize:11,color:"#E8A838",
      fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".04em",
    }},
      React.createElement("i",{className:"ti ti-arrows-shuffle",style:{fontSize:16}}),
      "Swiss Reseed \u2014 Lobbies reorganized by standings"
    ):null,
    phase==="live"&&props.tournamentState.liveStandings?React.createElement(LiveStandingsTable,{standings:props.tournamentState.liveStandings}):null,
    phase==="complete"?React.createElement(React.Fragment,null,
      React.createElement(YourFinishCard,{currentUser:props.currentUser,finalStandings:props.tournamentState.finalStandings||[]}),
      awardsEl,
      recapEl,
      React.createElement(MemoResultsScreen,{players:props.players,toast:props.toast,setScreen:props.setScreen,setProfilePlayer:props.setProfilePlayer,tournamentState:props.tournamentState})
    ):null
  );
}

// ─── EVENTS SCREEN (wrapper: Archive + Tournaments + Featured tabs) ───────────

function EventsScreen(props){
  var tab=props.subRoute||"featured";
  var tabs=[
    {id:"featured",label:"Featured",icon:"ti-star"},
    {id:"archive",label:"Archive",icon:"ti-archive"},
    {id:"tournaments",label:"Tournaments",icon:"ti-tournament"},
  ];
  return React.createElement("div",{className:"page fade-up",style:{paddingTop:20}},
    React.createElement("div",{className:"tab-bar-wrap",style:{display:"flex",justifyContent:"center",gap:6,padding:"0 16px",marginBottom:24,overflowX:"auto"}},
      tabs.map(function(t){
        var active=tab===t.id;
        return React.createElement("button",{
          key:t.id,
          className:"tab-btn",
          onClick:function(){props.setScreen("events/"+t.id);},
          style:{
            display:"flex",alignItems:"center",gap:6,
            padding:"10px 20px",
            background:active?"rgba(155,114,207,.12)":"rgba(242,237,228,.03)",
            border:active?"1px solid rgba(155,114,207,.3)":"1px solid rgba(242,237,228,.06)",
            borderRadius:10,
            color:"#F2EDE4",
            fontFamily:"Inter,system-ui,sans-serif",
            fontSize:13,
            fontWeight:active?600:400,
            cursor:"pointer",
            letterSpacing:".03em",
            transition:"all .25s ease",
            boxShadow:active?"0 0 12px rgba(155,114,207,.1)":"none",
          }
        },
          React.createElement("i",{className:t.icon,style:{fontSize:16,color:active?"#9B72CF":"#BECBD9"}}),
          t.label
        );
      })
    ),
    tab==="archive"?React.createElement(ArchiveScreen,{players:props.players,currentUser:props.currentUser,setScreen:props.setScreen,pastClashes:props.pastClashes}):null,
    tab==="tournaments"?React.createElement(TournamentsListScreen,{setScreen:props.setScreen,currentUser:props.currentUser,toast:props.toast}):null,
    tab==="featured"?React.createElement(FeaturedScreen,{setScreen:props.setScreen,currentUser:props.currentUser,onAuthClick:props.onAuthClick,toast:props.toast,featuredEvents:props.featuredEvents,setFeaturedEvents:props.setFeaturedEvents}):null
  );
}


// ── Tier system helpers ──────────────────────────────────────────────────────

var TIER_THRESHOLDS = [
  {name: "Champion", minRank: 1, maxRank: 1, color: "#E8A838", icon: "crown"},
  {name: "Challenger", minRank: 2, maxRank: 3, color: "#9B72CF", icon: "diamond"},
  {name: "Contender", minRank: 4, maxRank: 8, color: "#4ECDC4", icon: "shield"}
];

function getPlayerTierInfo(rank, totalPlayers) {
  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (rank >= TIER_THRESHOLDS[i].minRank && rank <= TIER_THRESHOLDS[i].maxRank) {
      return TIER_THRESHOLDS[i];
    }
  }
  return {name: "Competitor", minRank: 9, maxRank: totalPlayers, color: "#9AAABF", icon: "user"};
}

function getNextTierInfo(rank) {
  for (var i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rank > TIER_THRESHOLDS[i].maxRank) {
      return TIER_THRESHOLDS[i];
    }
  }
  return null;
}

function generateSeasonNarrative(players, sortedPts) {
  if (!sortedPts || sortedPts.length < 2) return null;
  var leader = sortedPts[0];
  var second = sortedPts[1];
  var gap = leader.pts - second.pts;
  if (gap <= 5) return "The race for #1 is tight. Only " + gap + " pts separate " + leader.name + " and " + second.name + ".";
  if (gap > 50) return leader.name + " leads the season with a commanding " + gap + "-point advantage.";
  if (sortedPts.length >= 5) {
    var thirdPts = sortedPts[2].pts;
    var fifthPts = sortedPts[4].pts;
    if (thirdPts - fifthPts <= 10) return "Positions 3 through 5 are separated by just " + (thirdPts - fifthPts) + " pts. Every clash matters.";
  }
  return leader.name + " leads the season with " + leader.pts + " pts.";
}


// ─── HOME SCREEN ──────────────────────────────────────────────────────────────

function HomeScreen({players,setPlayers,setScreen,toast,announcement,setProfilePlayer,currentUser,onAuthClick,tournamentState,setTournamentState,quickClashes,onJoinQuickClash,onRegister,tickerOverrides,hostAnnouncements,featuredEvents,seasonConfig}){

  // Dead state variables removed (name, riot, region)  -  registration now uses registerFromAccount()

  const clashName=tournamentState?.clashName||"Next Clash";

  const clashDate=tournamentState?.clashDate||"";

  const clashTime=tournamentState?.clashTime||"";

  const targetMs=useRef(tournamentState?.clashTimestamp?new Date(tournamentState.clashTimestamp).getTime():Date.now()+7*86400000);

  const [now,setNow]=useState(Date.now());

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);

  const diff=Math.max(0,targetMs.current-now);

  const D=Math.floor(diff/86400000),H=Math.floor(diff%86400000/3600000),M=Math.floor(diff%3600000/60000),S=Math.floor(diff%60000/1000);



  // Guest self-registration removed  -  all registration goes through registerFromAccount()

  const [upcomingTournament,setUpcomingTournament]=useState(null);
  useEffect(function(){
    supabase.from('tournaments').select('*')
      .eq('type','flash_tournament')
      .in('phase',['registration','check_in','upcoming'])
      .order('date',{ascending:true})
      .limit(1)
      .then(function(res){
        if(res.data&&res.data.length>0)setUpcomingTournament(res.data[0]);
      });
  },[]);

  const [tick,setTick]=useState(0);
  useEffect(function(){
    var t=setInterval(function(){setTick(function(n){return n+1;});},60000);
    return function(){clearInterval(t);};
  },[]);

  const checkedN=useMemo(function(){return players.filter(p=>p.checkedIn).length;},[players]);

  const top5=useMemo(function(){return[...players].sort((a,b)=>b.pts-a.pts).slice(0,5);},[players]);

  const linkedPlayer=useMemo(function(){
    if(!currentUser)return null;
    return players.find(function(p){
      if(p.authUserId&&currentUser.id&&p.authUserId===currentUser.id)return true;
      if(p.name&&currentUser.username&&p.name.toLowerCase()===currentUser.username.toLowerCase())return true;
      if(p.riotId&&currentUser.riotId&&p.riotId.toLowerCase()===currentUser.riotId.toLowerCase())return true;
      return false;
    })||null;
  },[players,currentUser]);

  const alreadyRegistered=!!linkedPlayer;

  const profileComplete=currentUser&&currentUser.riotId&&currentUser.riotId.trim().length>0;

  const s2=linkedPlayer?getStats(linkedPlayer):null;

  const myRankIdx=linkedPlayer?[...players].sort((a,b)=>b.pts-a.pts).findIndex(p=>p.id===linkedPlayer.id)+1:0;

  const tPhase=tournamentState?tournamentState.phase:"registration";

  const tRound=tournamentState?tournamentState.round:1;

  const checkedInCount=players.filter(p=>p.checkedIn).length;

  const registeredCount=(tournamentState.registeredIds||[]).length;

  const myCheckedIn=linkedPlayer&&linkedPlayer.checkedIn;

  const isMyRegistered=linkedPlayer&&(tournamentState.registeredIds||[]).includes(String(linkedPlayer.id));
  const isMyWaitlisted=linkedPlayer&&(tournamentState.waitlistIds||[]).includes(String(linkedPlayer.id));
  const myWaitlistPos=isMyWaitlisted?(tournamentState.waitlistIds||[]).indexOf(String(linkedPlayer.id))+1:0;



  function handleCheckIn(){

    if(!linkedPlayer)return;

    setPlayers(ps=>ps.map(p=>p.id===linkedPlayer.id?{...p,checkedIn:true}:p));
    setTournamentState(function(ts){var ids=ts.checkedInIds||[];var sid=String(linkedPlayer.id);return ids.includes(sid)?ts:{...ts,checkedInIds:[...ids,sid]};});

    // Sync check-in to DB registrations table
    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('registrations').update({status:'checked_in',checked_in_at:new Date().toISOString()})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('player_id',linkedPlayer.id)
        .then(function(r){if(r.error)console.error("[TFT] check-in update failed:",r.error);});
    }

    toast("You're checked in! Good luck, "+linkedPlayer.name+"","success");

  }



  function registerFromAccount(){
    if(!currentUser||!profileComplete)return;
    if(!linkedPlayer){toast("Account not linked to a player profile","error");return;}
    var sid=String(linkedPlayer.id);
    var isReg=(tournamentState.registeredIds||[]).includes(sid);
    if(isReg){toast("You're already registered!","error");return;}
    var isWl=(tournamentState.waitlistIds||[]).includes(sid);
    if(isWl){toast("You're already on the waitlist!","error");return;}
    // Check capacity  -  if full, add to waitlist
    var maxCap=parseInt((tournamentState&&tournamentState.maxPlayers)||24);
    var regCount=(tournamentState.registeredIds||[]).length;
    if(regCount>=maxCap){
      setTournamentState(function(ts){
        var wl=ts.waitlistIds||[];
        if(wl.includes(sid))return ts;
        return Object.assign({},ts,{waitlistIds:[].concat(wl,[sid])});
      });
      toast(currentUser.username+" added to waitlist (position "+((tournamentState.waitlistIds||[]).length+1)+")","info");
      return;
    }
    // Add to registeredIds
    setTournamentState(function(ts){
      var ids=ts.registeredIds||[];
      return ids.includes(sid)?ts:{...ts,registeredIds:[...ids,sid]};
    });
    // Sync to DB registrations table  -  auto-create tournament if needed
    if(supabase.from){
      var doInsert=function(tid){
        supabase.from('registrations').upsert({
          tournament_id:tid,
          player_id:linkedPlayer.id,
          status:'registered'
        },{onConflict:'tournament_id,player_id'}).then(function(r){if(r.error)console.error("[TFT] registration insert failed:",r.error);});
      };
      if(tournamentState.dbTournamentId){
        doInsert(tournamentState.dbTournamentId);
      }else{
        // Auto-create tournament in DB so registrations are tracked
        supabase.from('tournaments').insert({name:clashName||'Next Clash',date:new Date().toISOString().split('T')[0],phase:'registration',max_players:parseInt(tournamentState.maxPlayers)||24}).select().single().then(function(res){
          if(!res.error&&res.data){
            var newId=res.data.id;
            setTournamentState(function(ts){return Object.assign({},ts,{dbTournamentId:newId});});
            doInsert(newId);
          }else if(res.error){console.error("[TFT] Failed to auto-create tournament:",res.error);}
        });
      }
    }
    toast(currentUser.username+" registered for "+clashName+"!","success");
    if (linkedPlayer) writeActivityEvent("registration", linkedPlayer.id, currentUser.username+" registered for "+clashName);
  }

  function unregisterFromClash(){
    if(!linkedPlayer)return;
    var sid=String(linkedPlayer.id);
    setTournamentState(function(ts){
      var ids=ts.registeredIds||[];
      return{...ts,registeredIds:ids.filter(function(id){return id!==sid;})};
    });
    // Sync to DB
    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('registrations').delete()
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('player_id',linkedPlayer.id)
        .then(function(r){if(r.error)console.error("[TFT] unregister failed:",r.error);});
    }
    toast("Unregistered from "+clashName,"info");
    // Promote first waitlisted player
    setTournamentState(function(ts2){
      var wl=ts2.waitlistIds||[];
      if(wl.length===0)return ts2;
      var promoted=wl[0];
      var remainingWl=wl.slice(1);
      var newRegIds=[].concat(ts2.registeredIds||[],[promoted]);
      return Object.assign({},ts2,{registeredIds:newRegIds,waitlistIds:remainingWl});
    });
  }

  function removeFromWaitlist(){
    if(!linkedPlayer)return;
    var sid=String(linkedPlayer.id);
    setTournamentState(function(ts){
      var wl=ts.waitlistIds||[];
      return Object.assign({},ts,{waitlistIds:wl.filter(function(id){return id!==sid;})});
    });
    toast("Removed from waitlist","info");
  }



  function phaseStatusText(){

    if(tPhase==="registration")return"Registration Open · "+registeredCount+"/"+(tournamentState.maxPlayers||24)+" registered"+((tournamentState.waitlistIds||[]).length>0?" · "+(tournamentState.waitlistIds||[]).length+" waitlisted":"");

    if(tPhase==="checkin")return"Check-in Open · "+checkedInCount+" checked in · Closes soon";

    if(tPhase==="inprogress")return"Clash is LIVE · Game "+tRound+"/"+(tournamentState.totalGames||3);

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

  // Activity feed state
  var _af = useState([]);
  var activityFeed = _af[0];
  var setActivityFeed = _af[1];

  useEffect(function() {
    supabase.from("activity_feed").select("*")
      .order("created_at", {ascending: false})
      .limit(8)
      .then(function(res) {
        if (res.data) setActivityFeed(res.data);
      });
  }, [tick]);

  // Zone 1 data
  var rankDelta = linkedPlayer && linkedPlayer.lastClashRank ? myRankIdx - linkedPlayer.lastClashRank : 0;
  var currentTierInfo = getPlayerTierInfo(myRankIdx, players.length);
  var nextTier = getNextTierInfo(myRankIdx);
  var ptsToNextTier = null;
  if (nextTier && myRankIdx > nextTier.maxRank) {
    var tierBorderPlayer = sortedPts[nextTier.maxRank - 1];
    if (tierBorderPlayer && linkedPlayer) ptsToNextTier = tierBorderPlayer.pts - linkedPlayer.pts;
  }

  // Zone 2 data
  var clashHistory = (linkedPlayer && linkedPlayer.clashHistory) || [];
  var lastClash = clashHistory.length > 0 ? clashHistory[clashHistory.length - 1] : null;
  var placementTrend = clashHistory.map(function(c) { return c.placement || 4; });
  var pointsTrend = [];
  var cumPts = 0;
  clashHistory.forEach(function(c) {
    cumPts = cumPts + (c.points || 0);
    pointsTrend.push(cumPts);
  });

  // Streak calculation
  var currentStreak = 0;
  var streakType = "";
  for (var si = clashHistory.length - 1; si >= 0; si--) {
    if (clashHistory[si].placement <= 4) {
      currentStreak++;
      streakType = "top-4";
    } else break;
  }
  if (currentStreak === 0) {
    for (var sj = clashHistory.length - 1; sj >= 0; sj--) {
      if (clashHistory[sj].placement === 1) {
        currentStreak++;
        streakType = "win";
      } else break;
    }
  }

  // Season narrative
  var seasonNarrative = generateSeasonNarrative(players, sortedPts);

  // ── Guest HomeScreen ──────────────────────────────────────────────────────

  if (!currentUser) {
    return React.createElement("div", {className: "page fade-up"},
      announcement ? React.createElement("div", {style: {background: "rgba(232,168,56,.08)", border: "1px solid rgba(232,168,56,.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10}},
        React.createElement("i", {className: "ti ti-speakerphone", style: {fontSize: 16, flexShrink: 0}}),
        React.createElement("span", {style: {color: "#E8A838", fontWeight: 600, fontSize: 14}}, announcement)
      ) : null,

      // Hero section
      React.createElement("div", {style: {position: "relative", padding: "48px 32px", borderRadius: 20, background: "radial-gradient(ellipse at 30% 15%,rgba(155,114,207,.18) 0%,rgba(78,205,196,.05) 50%,rgba(8,8,15,0) 70%)", border: "1px solid rgba(155,114,207,.18)", marginBottom: 24, textAlign: "center"}},
        React.createElement("div", {style: {display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", background: "rgba(155,114,207,.12)", border: "1px solid rgba(155,114,207,.35)", borderRadius: 20, marginBottom: 24}},
          React.createElement("div", {style: {width: 6, height: 6, borderRadius: "50%", background: "#52C47C", animation: "pulse 2s infinite"}}),
          React.createElement("span", {className: "cond", style: {fontSize: 11, fontWeight: 700, color: "#C4B5FD", letterSpacing: ".1em", textTransform: "uppercase"}}, "Free to compete - No paywall, ever")
        ),
        React.createElement("h1", {className: "display", style: {color: "#F2EDE4", lineHeight: 0.9, letterSpacing: ".01em", marginBottom: 20, maxWidth: 700, marginLeft: "auto", marginRight: "auto"}},
          "The", React.createElement("br"),
          React.createElement("span", {style: {color: "#E8A838", textShadow: "0 0 60px rgba(232,168,56,.5),0 0 120px rgba(232,168,56,.2)"}}, "COMPETITIVE TFT"),
          React.createElement("br"),
          React.createElement("span", {style: {background: "linear-gradient(135deg,#9B72CF,#4ECDC4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"}}, "PLATFORM")
        ),
        React.createElement("p", {style: {fontSize: 16, color: "#C8D4E0", lineHeight: 1.65, marginBottom: 28, maxWidth: 520, marginLeft: "auto", marginRight: "auto"}},
          "Weekly Saturday tournaments, seasonal standings, and a permanent record of every champion crowned. Join " + players.length + " players competing this season."
        ),
        React.createElement("div", {style: {display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28}},
          React.createElement(Btn, {v: "primary", s: "lg", onClick: function() { onAuthClick("signup"); }}, "Create Free Account"),
          React.createElement(Btn, {v: "ghost", s: "lg", onClick: function() { onAuthClick("login"); }}, "Sign In")
        ),
        // Social proof stats
        React.createElement("div", {style: {display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap"}},
          [
            [players.length, "Players", "#E8A838"],
            [players.reduce(function(s, p) { return s + (p.games || 0); }, 0), "Games Played", "#4ECDC4"],
            [players.reduce(function(s, p) { return s + p.pts; }, 0), "Season Points", "#9B72CF"]
          ].map(function(item) {
            return React.createElement("div", {key: item[1], style: {textAlign: "center", minWidth: 80}},
              React.createElement("div", {className: "mono", style: {fontSize: 24, fontWeight: 800, color: item[2], lineHeight: 1}}, item[0]),
              React.createElement("div", {style: {fontSize: 10, color: "#9AAABF", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em"}}, item[1])
            );
          })
        )
      ),

      // How It Works
      React.createElement(Panel, {style: {padding: "24px", marginBottom: 24}},
        React.createElement("h3", {style: {fontSize: 16, fontWeight: 700, color: "#F2EDE4", marginBottom: 18, textAlign: "center"}}, "How It Works"),
        React.createElement("div", {style: {display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16}},
          [
            {n: "01", t: "Sign Up", d: "Create a free account and link your Riot ID."},
            {n: "02", t: "Register", d: "Register for the next clash. Check in to confirm your spot."},
            {n: "03", t: "Compete", d: "Play your lobby games and submit your placement."},
            {n: "04", t: "Win the Crown", d: "Season leader is crowned Champion and enters the Hall of Fame."}
          ].map(function(step) {
            return React.createElement("div", {key: step.n, style: {textAlign: "center", padding: "16px 12px"}},
              React.createElement("div", {style: {width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.08))", border: "1px solid rgba(155,114,207,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#C4B5FD", margin: "0 auto 10px"}}, step.n),
              React.createElement("div", {style: {fontWeight: 700, fontSize: 14, color: "#F2EDE4", marginBottom: 4}}, step.t),
              React.createElement("div", {style: {fontSize: 12, color: "#BECBD9", lineHeight: 1.5}}, step.d)
            );
          })
        )
      ),

      // Bottom CTAs
      React.createElement("div", {style: {display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24}},
        React.createElement(Btn, {v: "primary", s: "lg", onClick: function() { onAuthClick("signup"); }}, "Create Free Account"),
        React.createElement(Btn, {v: "ghost", s: "lg", onClick: function() { onAuthClick("login"); }}, "Sign In")
      ),

      // Sponsor
      React.createElement(SponsorBanner, {onNavigate: setScreen})
    );
  }

  // ── Logged-in Dashboard ───────────────────────────────────────────────────

  var phaseActionBtn = null;
  if (tPhase === "registration") {
    if (isMyRegistered) {
      phaseActionBtn = React.createElement(Btn, {v: "dark", s: "sm", onClick: unregisterFromClash}, "Unregister");
    } else if (isMyWaitlisted) {
      phaseActionBtn = React.createElement(Btn, {v: "dark", s: "sm", onClick: removeFromWaitlist}, "Leave Waitlist");
    } else if (linkedPlayer && profileComplete) {
      phaseActionBtn = React.createElement(Btn, {v: "primary", s: "sm", onClick: registerFromAccount}, "Register");
    } else if (!profileComplete) {
      phaseActionBtn = React.createElement(Btn, {v: "primary", s: "sm", onClick: function() { setScreen("account"); }}, "Complete Profile");
    }
  } else if (tPhase === "checkin") {
    if (!myCheckedIn && isMyRegistered) {
      phaseActionBtn = React.createElement(Btn, {v: "primary", s: "sm", onClick: handleCheckIn}, "Check In Now");
    } else if (myCheckedIn) {
      phaseActionBtn = React.createElement("span", {style: {fontSize: 12, fontWeight: 700, color: "#6EE7B7"}}, "Checked In");
    }
  } else if (tPhase === "inprogress") {
    phaseActionBtn = React.createElement(Btn, {v: "success", s: "sm", onClick: function() { setScreen("bracket"); }}, "Watch Live");
  } else if (tPhase === "complete") {
    phaseActionBtn = React.createElement(Btn, {v: "purple", s: "sm", onClick: function() { setScreen("results"); }}, "View Results");
  }

  return React.createElement("div", {className: "page fade-up"},

    // Announcement banner
    announcement ? React.createElement("div", {style: {background: "rgba(232,168,56,.08)", border: "1px solid rgba(232,168,56,.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10}},
      React.createElement("i", {className: "ti ti-speakerphone", style: {fontSize: 16, flexShrink: 0}}),
      React.createElement("span", {style: {color: "#E8A838", fontWeight: 600, fontSize: 14}}, announcement)
    ) : null,

    // Host announcements
    hostAnnouncements && hostAnnouncements.length > 0 ? React.createElement("div", {style: {background: "rgba(155,114,207,.06)", border: "1px solid rgba(155,114,207,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10}},
      React.createElement("i", {className: "ti ti-speakerphone", style: {fontSize: 14, flexShrink: 0}}),
      React.createElement("span", {style: {color: "#C4B5FD", fontWeight: 600, fontSize: 13}}, hostAnnouncements[0].msg),
      React.createElement("span", {style: {fontSize: 10, color: "#9AAABF", marginLeft: "auto", flexShrink: 0}}, hostAnnouncements[0].sentAt)
    ) : null,

    // Flash tournament banner
    upcomingTournament ? React.createElement("div", {style: {background: "linear-gradient(135deg,rgba(155,114,207,.15),rgba(78,205,196,.1))", border: "1px solid rgba(155,114,207,.25)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, cursor: "pointer"}, onClick: function() { setScreen("flash-" + upcomingTournament.id); }},
      React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 8, marginBottom: 6}},
        React.createElement("span", {style: {fontSize: 11, fontWeight: 700, color: "#9B72CF", textTransform: "uppercase", letterSpacing: ".5px", background: "rgba(155,114,207,.15)", borderRadius: 6, padding: "2px 8px"}}, "Flash Tournament"),
        React.createElement("span", {style: {fontSize: 11, color: "#E8A838"}}, new Date(upcomingTournament.date).toLocaleDateString("en-GB", {weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}))
      ),
      React.createElement("div", {style: {fontSize: 16, fontWeight: 700, color: "#F2EDE4", marginBottom: 4}}, upcomingTournament.name),
      countdownText ? React.createElement("div", {style: {fontSize: 12, fontWeight: 700, color: countdownColor}}, countdownText) : null,
      React.createElement(Btn, {v: "primary", s: "sm"}, "Register Now")
    ) : null,

    // ── ZONE 1: THE PULSE ─────────────────────────────────────────────────

    React.createElement("div", {style: {background: "linear-gradient(145deg,rgba(18,28,48,.95),rgba(10,15,28,.98))", border: "1px solid rgba(155,114,207,.2)", borderRadius: 16, padding: "18px 22px", marginBottom: 20, boxShadow: "0 4px 24px rgba(0,0,0,.4)"}},
      React.createElement("div", {style: {display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12}},
        // Left: Status + countdown
        React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap"}},
          // Phase dot + label
          React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 8}},
            React.createElement("div", {style: {width: 8, height: 8, borderRadius: "50%", background: phaseStatusColor(), boxShadow: "0 0 8px " + phaseStatusColor(), animation: tPhase === "inprogress" ? "pulse 2s infinite" : "none"}}),
            React.createElement("span", {style: {fontSize: 13, fontWeight: 700, color: phaseStatusColor(), textTransform: "uppercase", letterSpacing: ".06em"}},
              tPhase === "registration" ? "Registration Open" :
              tPhase === "checkin" ? "Check-in Open" :
              tPhase === "inprogress" ? "LIVE - Game " + tRound + "/" + (tournamentState.totalGames || 3) :
              tPhase === "complete" ? "Results Posted" : "Next Clash"
            )
          ),
          // Countdown
          diff > 0 && tPhase === "registration" ? React.createElement("div", {className: "mono", style: {fontSize: 13, color: "#E8A838", fontWeight: 700}},
            (D > 0 ? D + "d " : "") + H + "h " + M + "m " + S + "s"
          ) : null,
          // Registration count
          tPhase === "registration" ? React.createElement("span", {style: {fontSize: 12, color: "#9AAABF"}}, registeredCount + "/" + (tournamentState.maxPlayers || 24) + " registered") : null,
          tPhase === "checkin" ? React.createElement("span", {style: {fontSize: 12, color: "#9AAABF"}}, checkedInCount + " checked in") : null
        ),
        // Right: Rank + tier + action
        React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 14}},
          linkedPlayer ? React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 8}},
            React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 4}},
              React.createElement("span", {className: "mono", style: {fontSize: 20, fontWeight: 800, color: currentTierInfo.color}}, "#" + myRankIdx),
              rankDelta !== 0 ? React.createElement("span", {style: {fontSize: 11, fontWeight: 700, color: rankDelta < 0 ? "#6EE7B7" : "#F87171"}},
                rankDelta < 0 ? "+" + Math.abs(rankDelta) : "-" + Math.abs(rankDelta)
              ) : null
            ),
            React.createElement("div", {style: {fontSize: 11, color: currentTierInfo.color, fontWeight: 600}}, currentTierInfo.name),
            ptsToNextTier && ptsToNextTier > 0 ? React.createElement("span", {style: {fontSize: 10, color: "#9AAABF", background: "rgba(255,255,255,.04)", borderRadius: 6, padding: "2px 8px"}}, ptsToNextTier + " pts to " + nextTier.name) : null
          ) : null,
          phaseActionBtn
        )
      ),
      // Progress bar
      tPhase === "registration" ? React.createElement("div", {style: {marginTop: 12, background: "rgba(255,255,255,.04)", borderRadius: 8, height: 4, overflow: "hidden"}},
        React.createElement("div", {style: {height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#9B72CF,#4ECDC4)", width: Math.min(100, Math.round(registeredCount / (tournamentState.maxPlayers || 24) * 100)) + "%", transition: "width .5s ease"}})
      ) : null,
      tPhase === "checkin" ? React.createElement("div", {style: {marginTop: 12, background: "rgba(255,255,255,.04)", borderRadius: 8, height: 4, overflow: "hidden"}},
        React.createElement("div", {style: {height: "100%", borderRadius: 8, background: "linear-gradient(90deg,#E8A838,#52C47C)", width: Math.min(100, registeredCount > 0 ? Math.round(checkedInCount / registeredCount * 100) : 0) + "%", transition: "width .5s ease"}})
      ) : null
    ),

    // ── ZONE 2: YOUR STORY ────────────────────────────────────────────────

    linkedPlayer && s2 ? React.createElement("div", {style: {background: "linear-gradient(145deg,rgba(18,28,48,.9),rgba(10,15,28,.95))", border: "1px solid rgba(155,114,207,.15)", borderRadius: 16, padding: "20px 22px", marginBottom: 20}},
      // Header row
      React.createElement("div", {style: {display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8}},
        React.createElement("div", {style: {display: "flex", alignItems: "center", gap: 10}},
          React.createElement("div", {style: {width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg," + currentTierInfo.color + ",rgba(155,114,207,.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#08080F", flexShrink: 0}}, linkedPlayer.name.charAt(0).toUpperCase()),
          React.createElement("div", null,
            React.createElement("div", {style: {fontWeight: 700, fontSize: 15, color: "#F2EDE4"}}, "Welcome back, " + linkedPlayer.name),
            React.createElement("div", {style: {fontSize: 11, color: "#9AAABF", marginTop: 1}}, linkedPlayer.rank + " - " + (linkedPlayer.region || "EUW"))
          )
        ),
        React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { setProfilePlayer(linkedPlayer); setScreen("profile"); }}, "My Profile")
      ),
      // Season trajectory sparkline
      pointsTrend.length >= 2 ? React.createElement("div", {style: {marginBottom: 16, padding: "12px 16px", background: "rgba(155,114,207,.05)", borderRadius: 10, border: "1px solid rgba(155,114,207,.1)"}},
        React.createElement("div", {style: {display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8}},
          React.createElement("span", {style: {fontSize: 10, fontWeight: 700, color: "#9AAABF", textTransform: "uppercase", letterSpacing: ".1em"}}, "Season Trajectory"),
          React.createElement("span", {className: "mono", style: {fontSize: 12, fontWeight: 700, color: "#E8A838"}}, linkedPlayer.pts + " pts")
        ),
        React.createElement(Sparkline, {data: pointsTrend, color: "#9B72CF", w: 240, h: 32})
      ) : null,
      // Last clash result + streak row
      React.createElement("div", {style: {display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap"}},
        lastClash ? React.createElement("div", {style: {flex: 1, minWidth: 140, background: "rgba(232,168,56,.06)", border: "1px solid rgba(232,168,56,.15)", borderRadius: 10, padding: "12px 14px"}},
          React.createElement("div", {style: {fontSize: 10, fontWeight: 700, color: "#9AAABF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6}}, "Last Clash"),
          React.createElement("div", {style: {display: "flex", alignItems: "baseline", gap: 6}},
            React.createElement("span", {className: "mono", style: {fontSize: 24, fontWeight: 800, color: lastClash.placement <= 4 ? "#E8A838" : "#9AAABF"}}, ordinal(lastClash.placement)),
            React.createElement("span", {style: {fontSize: 12, color: "#BECBD9"}}, "+" + (lastClash.points || 0) + " pts")
          )
        ) : React.createElement("div", {style: {flex: 1, minWidth: 140, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "12px 14px"}},
          React.createElement("div", {style: {fontSize: 10, fontWeight: 700, color: "#9AAABF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6}}, "Last Clash"),
          React.createElement("div", {style: {fontSize: 13, color: "#9AAABF"}}, "No results yet")
        ),
        currentStreak > 1 ? React.createElement("div", {style: {flex: 1, minWidth: 140, background: "rgba(82,196,124,.06)", border: "1px solid rgba(82,196,124,.15)", borderRadius: 10, padding: "12px 14px"}},
          React.createElement("div", {style: {fontSize: 10, fontWeight: 700, color: "#9AAABF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6}}, "Active Streak"),
          React.createElement("div", {style: {display: "flex", alignItems: "baseline", gap: 6}},
            React.createElement("span", {className: "mono", style: {fontSize: 24, fontWeight: 800, color: "#6EE7B7"}}, currentStreak),
            React.createElement("span", {style: {fontSize: 12, color: "#BECBD9"}}, streakType === "win" ? "wins" : "top 4s")
          )
        ) : null
      ),
      // Quick stats row
      React.createElement("div", {style: {display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10}},
        [[linkedPlayer.pts, "Season Pts", "#E8A838"], [linkedPlayer.wins, "Wins", "#6EE7B7"], [s2.avgPlacement, "Avg Place", "#4ECDC4"], [s2.top4Rate ? s2.top4Rate + "%" : "0%", "Top 4 Rate", "#9B72CF"]].map(function(item) {
          return React.createElement("div", {key: item[1], style: {background: "rgba(255,255,255,.03)", borderRadius: 10, padding: "10px 8px", textAlign: "center"}},
            React.createElement("div", {className: "mono", style: {fontSize: 18, fontWeight: 700, color: item[2], lineHeight: 1}}, item[0]),
            React.createElement("div", {style: {fontSize: 9, color: "#9AAABF", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em"}}, item[1])
          );
        })
      )
    ) : null,

    // ── ZONE 3: THE SCENE ─────────────────────────────────────────────────

    React.createElement("div", {style: {marginBottom: 20}},
      // Season narrative one-liner
      seasonNarrative ? React.createElement("div", {style: {background: "rgba(155,114,207,.05)", border: "1px solid rgba(155,114,207,.12)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8}},
        React.createElement("i", {className: "ti ti-chart-line", style: {fontSize: 14, color: "#9B72CF"}}),
        React.createElement("span", {style: {fontSize: 13, color: "#C8D4E0", fontWeight: 500}}, seasonNarrative)
      ) : null,
      // Activity feed
      activityFeed.length > 0 ? React.createElement("div", {style: {marginBottom: 16}},
        React.createElement("div", {className: "cond", style: {fontSize: 10, fontWeight: 700, color: "#9B72CF", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 10}}, "Recent Activity"),
        activityFeed.slice(0, 5).map(function(item, idx) {
          return React.createElement("div", {key: item.id || idx, style: {display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: idx < Math.min(activityFeed.length, 5) - 1 ? "1px solid rgba(242,237,228,.06)" : "none"}},
            React.createElement("i", {className: "ti ti-" + (item.icon || "activity"), style: {fontSize: 14, color: item.color || "#9AAABF", flexShrink: 0}}),
            React.createElement("span", {style: {fontSize: 13, color: "#C8D4E0", flex: 1}}, item.message || item.text || ""),
            item.created_at ? React.createElement("span", {style: {fontSize: 10, color: "#6B7A8D", flexShrink: 0}}, new Date(item.created_at).toLocaleDateString("en-GB", {day: "numeric", month: "short"})) : null
          );
        })
      ) : null,
      // Quick action buttons
      React.createElement("div", {style: {display: "flex", gap: 10, flexWrap: "wrap"}},
        React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { setScreen("leaderboard"); }},
          React.createElement("i", {className: "ti ti-list-numbers", style: {fontSize: 14, marginRight: 4}}),
          "Standings"
        ),
        linkedPlayer ? React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { setProfilePlayer(linkedPlayer); setScreen("profile"); }},
          React.createElement("i", {className: "ti ti-user", style: {fontSize: 14, marginRight: 4}}),
          "My Profile"
        ) : null,
        upcomingTournament ? React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { setScreen("flash-" + upcomingTournament.id); }},
          React.createElement("i", {className: "ti ti-bolt", style: {fontSize: 14, marginRight: 4}}),
          "Flash Tournament"
        ) : null,
        React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { setScreen("events"); }},
          React.createElement("i", {className: "ti ti-calendar-event", style: {fontSize: 14, marginRight: 4}}),
          "Events"
        )
      )
    ),

    // Divider
    React.createElement("div", {style: {height: 1, background: "linear-gradient(90deg,transparent,rgba(155,114,207,.2),rgba(78,205,196,.2),transparent)", margin: "12px 0 20px"}}),

    // Season standings preview
    React.createElement(Panel, {accent: true, style: {padding: "18px", marginBottom: 16}},
      React.createElement("div", {style: {display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8}},
        React.createElement("h3", {style: {fontSize: 17, color: "#F2EDE4", fontWeight: 700, letterSpacing: "-.01em"}}, "Season Standings"),
        React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { setScreen("leaderboard"); }}, "Full Leaderboard")
      ),
      top5.map(function(p, i) {
        return React.createElement("div", {key: p.id, onClick: function() { setProfilePlayer(p); setScreen("profile"); }, style: {display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: i < top5.length - 1 ? "1px solid rgba(242,237,228,.06)" : "none", cursor: "pointer", transition: "all .2s ease", borderRadius: 8}, onMouseEnter: function(e) { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.background = "rgba(155,114,207,.06)"; }, onMouseLeave: function(e) { e.currentTarget.style.transform = "translateX(0)"; e.currentTarget.style.background = "transparent"; }},
          React.createElement("div", {className: "mono", style: {fontSize: 14, fontWeight: 800, color: i === 0 ? "#E8A838" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#9AAABF", minWidth: 20, textAlign: "center"}}, i + 1),
          React.createElement("div", {style: {flex: 1, minWidth: 0}},
            React.createElement("div", {style: {fontWeight: 600, fontSize: 14, color: "#F2EDE4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}, p.name),
            React.createElement("div", {style: {fontSize: 11, color: "#BECBD9", marginTop: 1}}, p.rank + " - " + p.region)
          ),
          React.createElement("div", {style: {textAlign: "right"}},
            React.createElement("div", {className: "mono", style: {fontSize: 16, fontWeight: 700, color: "#E8A838"}}, p.pts),
            React.createElement("div", {style: {fontSize: 10, color: "#BECBD9"}}, "pts")
          )
        );
      }),
      top5.length === 0 ? React.createElement("div", {style: {color: "#9AAABF", fontSize: 13, textAlign: "center", padding: 24}}, "No players yet") : null
    ),

    // Community ticker
    tickerItems.length > 0 ? React.createElement("div", {style: {overflow: "hidden", borderRadius: 10, background: "rgba(155,114,207,.04)", border: "1px solid rgba(155,114,207,.12)", marginBottom: 16}},
      React.createElement("div", {className: "ticker-scroll"},
        [].concat(tickerItems, tickerItems).map(function(item, i) {
          return React.createElement("span", {key: i, style: {display: "inline-flex", alignItems: "center", padding: "8px 22px", fontSize: 12, color: "#C8D4E0", fontWeight: 600, whiteSpace: "nowrap", borderRight: "1px solid rgba(155,114,207,.1)"}},
            typeof item === "object" ? React.createElement(React.Fragment, null, React.createElement("i", {className: "ti ti-" + (ICON_REMAP[item.icon] || item.icon), style: {fontSize: 12, marginRight: 6}}), item.text) : item
          );
        })
      )
    ) : null,

    // Sponsor
    React.createElement(SponsorBanner, {onNavigate: setScreen}),

    // Discord CTA
    React.createElement("div", {style: {background: "linear-gradient(90deg,rgba(88,101,242,.1),rgba(88,101,242,.05))", border: "1px solid rgba(88,101,242,.3)", borderRadius: 12, padding: "14px 18px", marginTop: 14, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap"}},
      React.createElement("i", {className: "ti ti-message", style: {fontSize: 24, flexShrink: 0}}),
      React.createElement("div", {style: {flex: 1, minWidth: 0}},
        React.createElement("div", {style: {fontWeight: 700, fontSize: 14, color: "#F2EDE4"}}, "Join the TFT Clash Discord"),
        React.createElement("div", {style: {fontSize: 12, color: "#C8D4E0", marginTop: 2}}, "Tournament alerts, results, tactics channels, and the community.")
      ),
      React.createElement(Btn, {v: "dark", s: "sm", onClick: function() { toast("Discord link coming soon - server in setup!", "success"); }, style: {background: "rgba(88,101,242,.15)", border: "1px solid rgba(88,101,242,.4)", color: "#818CF8", flexShrink: 0}}, "Join Discord")
    )
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



  const filtered=players.filter(function(p){return(p.games||0)>0||p.checkedIn;})

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

                    {homie&&<div style={{position:"absolute",top:-4,right:-4,fontSize:12}}>{React.createElement("i",{className:"ti ti-heart",style:{color:"#9B72CF"}})}</div>}

                  </div>

                  <div style={{flex:1,minWidth:0}}>

                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>

                      <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>

                      {isHotStreak(p)&&<span style={{fontSize:12}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}</span>}

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

          <div style={{fontSize:40,marginBottom:12}}>{React.createElement("i",{className:"ti ti-search"})}</div>

          <div style={{color:"#BECBD9",fontSize:15}}>No players match your search.</div>

          <div style={{color:"#9AAABF",fontSize:13,marginTop:6}}>Try a different name or clear the filters.</div>

        </div>

      )}

    </div>

  );

}









function LiveStandingsPanel({checkedIn,tournamentState,lobbies,round}) {

  var clashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:"";
  var cutLine=tournamentState&&tournamentState.cutLine?tournamentState.cutLine:0;
  var cutAfterGame=tournamentState&&tournamentState.cutAfterGame?tournamentState.cutAfterGame:0;
  var showCutLine=cutLine>0&&cutAfterGame>0&&round>=cutAfterGame;
  var totalGames=tournamentState&&tournamentState.totalGames?tournamentState.totalGames:3;

  var liveRows=checkedIn.map(function(p){

    var earned=0;var gamesPlayed=0;

    (p.clashHistory||[]).forEach(function(h){if(h.clashId===clashId){earned+=(PTS[h.place||h.placement]||0);gamesPlayed+=1;}});

    return {name:p.name,id:p.id,earned:earned,gamesPlayed:gamesPlayed};

  }).sort(function(a,b){return b.earned-a.earned;});

  var lockedCount=tournamentState&&tournamentState.lockedLobbies?tournamentState.lockedLobbies.length:0;

  return(

    <Panel style={{padding:"20px",marginTop:24}}>

      <div style={{fontWeight:700,fontSize:14,color:"#E8A838",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>

        <span style={{fontSize:16}}>{React.createElement("i",{className:"ti ti-chart-bar"})}</span> Live Standings  -  Game {round}/{totalGames}

        <span style={{fontSize:11,color:"#BECBD9",fontWeight:400,marginLeft:4}}>({lockedCount} of {lobbies.length} {lobbies.length===1?"lobby":"lobbies"} locked)</span>

      </div>

      {showCutLine&&(
        <div style={{fontSize:11,color:"#E8A838",marginBottom:10,padding:"4px 10px",background:"rgba(232,168,56,.06)",borderRadius:4,border:"1px solid rgba(232,168,56,.12)"}}>Cut line: {cutLine} pts  -  players at or below are eliminated after Game {cutAfterGame}</div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:4}}>

        {liveRows.map(function(row,ri){

          var isLeader=ri===0&&row.earned>0;
          var belowCut=showCutLine&&row.earned<=cutLine;
          var nearCut=showCutLine&&!belowCut&&row.earned<=cutLine+3;

          return(

            <div key={row.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",

              background:belowCut?"rgba(248,113,113,.06)":isLeader?"rgba(232,168,56,.07)":ri%2===0?"rgba(255,255,255,.01)":"transparent",

              borderRadius:6,border:belowCut?"1px solid rgba(248,113,113,.2)":isLeader?"1px solid rgba(232,168,56,.18)":"1px solid transparent",opacity:belowCut?0.6:1}}>

              <span className="mono" style={{fontSize:12,fontWeight:700,color:belowCut?"#F87171":ri===0?"#E8A838":ri===1?"#C0C0C0":ri===2?"#CD7F32":"#9AAABF",minWidth:22,textAlign:"center"}}>{ri+1}</span>

              <span style={{flex:1,fontSize:13,fontWeight:isLeader?700:500,color:belowCut?"#F87171":isLeader?"#E8A838":"#F2EDE4"}}>{row.name}</span>

              {belowCut&&<span style={{fontSize:9,fontWeight:700,color:"#F87171",background:"rgba(248,113,113,.12)",border:"1px solid rgba(248,113,113,.25)",borderRadius:3,padding:"1px 6px",textTransform:"uppercase"}}>Cut</span>}

              {nearCut&&<span style={{fontSize:9,fontWeight:700,color:"#E8A838",background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.2)",borderRadius:3,padding:"1px 6px"}}>Bubble</span>}

              <span className="mono" style={{fontSize:13,fontWeight:700,color:belowCut?"#F87171":row.earned>0?"#6EE7B7":"#9AAABF"}}>{row.earned>0?"+"+row.earned:" - "} pts</span>

            </div>

          );

        })}

      </div>

    </Panel>

  );

}



// ─── BRACKET SCREEN ───────────────────────────────────────────────────────────

function BracketScreen({players,setPlayers,toast,isAdmin,currentUser,setProfilePlayer,setScreen,tournamentState,setTournamentState,seasonConfig}){

  const checkedIn=useMemo(function(){return players.filter(p=>p.checkedIn);},[players]);

  const lobbySize=8;

  const round=tournamentState?tournamentState.round:1;

  const lockedLobbies=tournamentState?tournamentState.lockedLobbies:[];

  const currentClashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:("c"+Date.now());

  const [mySearch,setMySearch]=useState(currentUser?currentUser.username:"");

  const [highlightLobby,setHighlightLobby]=useState(null);

  // Per-lobby placement entry UI state: lobbyIdx -> {open:bool, placements:{playerId->place}}

  const [placementEntry,setPlacementEntry]=useState({});

  const [playerSubmissions,setPlayerSubmissions]=useState({});
  // Shape: { lobbyIndex: { playerId: { placement: number, name: string, confirmed: boolean } } }

  const [showFinalizeConfirm,setShowFinalizeConfirm]=useState(false);

  const [autoAdvanceCountdown,setAutoAdvanceCountdown]=useState(null);
  const autoAdvanceRef=useRef(null);



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

      // Swiss reseeding for round 2+: snake by current tournament pts for balanced lobbies
      var byPts=[...checkedIn].sort((a,b)=>b.pts-a.pts||b.lp-a.lp);
      var lCount=Math.ceil(byPts.length/lobbySize);
      if(lCount<=1){
        pool=byPts;
      } else {
        var swissBuckets=Array.from({length:lCount},function(){return[];});
        byPts.forEach(function(p,i){
          var row=Math.floor(i/lCount);
          var col=row%2===0?i%lCount:(lCount-1-(i%lCount));
          swissBuckets[col].push(p);
        });
        pool=[].concat.apply([],swissBuckets);
      }

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

  // Auto-persist lobby assignments so page refresh keeps them + sync to DB
  useEffect(function(){
    if(lobbies.length===0)return;
    var saved=tournamentState&&tournamentState.savedLobbies;
    var lobbyIds=lobbies.map(function(l){return l.map(function(p){return p.id;});});
    // Only save if different from what's stored
    if(saved&&JSON.stringify(saved)===JSON.stringify(lobbyIds))return;
    setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:lobbyIds});});
    // Persist lobbies to DB
    if(supabase.from&&tournamentState.dbTournamentId){
      lobbyIds.forEach(function(playerIds,idx){
        supabase.from('lobbies').upsert({
          tournament_id:tournamentState.dbTournamentId,
          lobby_number:idx+1,
          round_number:round,
          player_ids:playerIds,
          status:'pending'
        },{onConflict:'tournament_id,lobby_number,round_number'})
        .then(function(res){if(res.error)console.error("[TFT] Failed to persist lobby "+(idx+1)+":",res.error);});
      });
    }
  },[lobbies]);

  function findMyLobby(){

    const q=mySearch.trim().toLowerCase();

    if(!q)return;

    const li=lobbies.findIndex(lobby=>lobby.some(p=>p.name.toLowerCase().includes(q)||p.riotId?.toLowerCase().includes(q)));

    if(li>=0){setHighlightLobby(li);toast("Found in Lobby "+(li+1)+"!","success");}

    else toast("Not found in active lobbies","error");

  }



  function openPlacementEntry(li){

    var lobby=lobbies[li];

    var init={};

    var subs=(playerSubmissions||{})[li]||{};

    lobby.forEach(function(p,i){
      if(subs[p.id]&&subs[p.id].placement){
        init[p.id]=String(subs[p.id].placement);
      } else {
        init[p.id]=String(i+1);
      }
    });

    setPlacementEntry(function(pe){return Object.assign({},pe,{[li]:{open:true,placements:init}});});

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

    setTournamentState(ts=>({...ts,lockedLobbies:[...(ts.lockedLobbies||[]),li],lockedPlacements:{...(ts.lockedPlacements||{}),[li]:placements}}));

    setPlacementEntry(pe=>({...pe,[li]:{...pe[li],open:false}}));

    // Update lobby status to locked in DB
    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('lobbies').update({status:'locked'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){if(res.error)console.error("[TFT] Failed to lock lobby in DB:",res.error);});
    }

    // Persist per-game results to game_results table
    if(supabase.from&&tournamentState.dbTournamentId){
      var dbTid=tournamentState.dbTournamentId;
      var gameRows=[];
      lobby.forEach(function(p){
        var place=parseInt(placementEntry[li].placements[p.id]||"0");
        if(place>0)gameRows.push({tournament_id:dbTid,round_number:round,player_id:p.id,placement:place,points:PTS[place]||0,is_dnp:false,game_number:round});
      });
      if(gameRows.length>0){
        supabase.from('game_results').insert(gameRows).then(function(res){
          if(res.error){console.error("[TFT] Failed to save game results:",res.error);toast("Failed to save game results","error");}
        });
      }
    }

    toast("Lobby "+(li+1)+" results applied!","success");

  }

  function submitMyPlacement(li,playerId,playerName,placement){
    var p=parseInt(placement);
    if(p<1||p>8){toast("Invalid placement","error");return;}
    setPlayerSubmissions(function(ps){
      var lobbySubmissions=Object.assign({},ps[li]||{});
      lobbySubmissions[playerId]={placement:p,name:playerName,confirmed:false};
      return Object.assign({},ps,{[li]:lobbySubmissions});
    });
    toast("Placement submitted  -  waiting for admin confirmation","success");
  }



  function unlockLobby(li){
    if(!window.confirm("Unlock Lobby "+(li+1)+"? This will revert all results for this lobby in the current round."))return;
    var savedPlacements=(tournamentState.lockedPlacements||{})[li];
    if(savedPlacements){
      setPlayers(function(prev){return prev.map(function(p){
        var place=savedPlacements[p.id];
        if(place===undefined)return p;
        var earned=PTS[place]||0;
        var newGames=Math.max((p.games||1)-1,0);
        var newWins=Math.max((p.wins||0)-(place===1?1:0),0);
        var newTop4=Math.max((p.top4||0)-(place<=4?1:0),0);
        var newPts=Math.max((p.pts||0)-earned,0);
        var newAvg=newGames>0?(((parseFloat(p.avg)||0)*(p.games||1)-place)/newGames).toFixed(2):"0.00";
        var newHistory=(p.clashHistory||[]).filter(function(h){return !(h.round===round&&h.clashId===currentClashId);});
        var newSparkline=(p.sparkline||[]).slice(0,-1);
        var newStreak=place<=4?Math.max((p.currentStreak||0)-1,0):p.currentStreak;
        return Object.assign({},p,{pts:newPts,wins:newWins,top4:newTop4,games:newGames,avg:newAvg,
          clashHistory:newHistory,sparkline:newSparkline,currentStreak:newStreak});
      });});
    }
    setTournamentState(function(ts){
      var newLocked=(ts.lockedLobbies||[]).filter(function(i){return i!==li;});
      var newSavedPlacements=Object.assign({},ts.lockedPlacements||{});
      delete newSavedPlacements[li];
      return Object.assign({},ts,{lockedLobbies:newLocked,lockedPlacements:newSavedPlacements});
    });
    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('game_results').delete()
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('round_number',round)
        .then(function(res){if(res.error)console.error("[TFT] Failed to delete game results:",res.error);});
      supabase.from('lobbies').update({status:'active'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){if(res.error)console.error("[TFT] Failed to unlock lobby in DB:",res.error);});
    }
    toast("Lobby "+(li+1)+" unlocked  -  results reverted","success");
  }

  const allLocked=lobbies.length>0&&lobbies.every((_,i)=>lockedLobbies.includes(i));

  // Auto-advance countdown when all lobbies locked (admin only, not on final round)
  useEffect(function(){
    if(!isAdmin||!allLocked||round>=(tournamentState.totalGames||3)){
      if(autoAdvanceRef.current){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;}
      setAutoAdvanceCountdown(null);
      return;
    }
    setAutoAdvanceCountdown(15);
    autoAdvanceRef.current=setInterval(function(){
      setAutoAdvanceCountdown(function(c){
        if(c===null)return null;
        if(c<=1){
          clearInterval(autoAdvanceRef.current);
          autoAdvanceRef.current=null;
          return 0;
        }
        return c-1;
      });
    },1000);
    return function(){if(autoAdvanceRef.current){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;}};
  },[allLocked,isAdmin,round,tournamentState.totalGames]);

  // Trigger advance when countdown hits 0
  useEffect(function(){
    if(autoAdvanceCountdown!==0||!isAdmin||!allLocked)return;
    var maxRounds=tournamentState.totalGames||3;
    if(round<maxRounds){
      var nextRound=round+1;
      setTournamentState(function(ts){return Object.assign({},ts,{round:nextRound,lockedLobbies:[],savedLobbies:[]});});
      toast("Auto-advanced to Game "+nextRound,"success");
    }
    setAutoAdvanceCountdown(null);
  },[autoAdvanceCountdown]);

  function cancelAutoAdvance(){
    if(autoAdvanceRef.current){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;}
    setAutoAdvanceCountdown(null);
    toast("Auto-advance cancelled","info");
  }

  function saveResultsToSupabase(allPlayers,clashId){
    if(!supabase.from)return;
    var clashName=(tournamentState&&tournamentState.clashName)?tournamentState.clashName:("Clash "+new Date().toLocaleDateString());
    var doSave=function(tId){
      // Mark tournament as complete
      supabase.from('tournaments').update({phase:'complete',completed_at:new Date().toISOString()}).eq('id',tId)
        .then(function(r){if(r.error)console.error("Failed to update tournament phase:",r.error);});
      // Aggregate results per player across all rounds
      var playerTotals={};
      allPlayers.forEach(function(p){
        var entries=(p.clashHistory||[]).filter(function(h){return h.clashId===clashId;});
        if(entries.length===0)return;
        var totalPts=entries.reduce(function(s,h){return s+((h.pts||0)+(h.bonusPts||0));},0);
        var wins=entries.filter(function(h){return(h.place||h.placement)===1;}).length;
        var top4=entries.filter(function(h){return(h.place||h.placement)<=4;}).length;
        var bestPlace=Math.min.apply(null,entries.map(function(h){return h.place||h.placement;}));
        playerTotals[p.id]={tournament_id:tId,player_id:p.id,final_placement:bestPlace,total_points:totalPts,wins:wins,top4_count:top4};
      });
      var rows=Object.values(playerTotals);
      if(rows.length>0){
        supabase.from('tournament_results').insert(rows).then(function(r){
          if(r.error){console.error("Failed to save results:",r.error);toast("Failed to save player results","error");return;}
          // Notify each player that results are finalized
          allPlayers.forEach(function(p){
            if(p.authUserId){createNotification(p.authUserId,"Results Finalized",clashName+" results are in! Check the Results screen to see your placement and points.","trophy");}
          });
          // Write activity feed events for winner and all participants
          var winnerRow = rows.reduce(function(best, row) { return row.final_placement < best.final_placement ? row : best; }, rows[0]);
          if (winnerRow) {
            var winnerPlayer = allPlayers.find(function(p) { return p.id === winnerRow.player_id; });
            if (winnerPlayer) writeActivityEvent("result", winnerPlayer.id, winnerPlayer.name+" won "+clashName);
          }
          // Write rank change events - compute new standings rank for each player
          var sortedByPts = allPlayers.slice().sort(function(a,b) { return (b.pts||0) - (a.pts||0); });
          allPlayers.forEach(function(p) {
            if (p.id) {
              var newRank = sortedByPts.findIndex(function(q) { return q.id === p.id; }) + 1;
              if (p.lastClashRank && p.lastClashRank !== newRank) {
                writeActivityEvent("rank_change", p.id, p.name+" moved to #"+newRank);
              }
            }
          });
          // Sync achievements for all players after results are saved
          allPlayers.forEach(function(p) {
            if (p.id) {
              var ppRankA = allPlayers.filter(function(q) { return q.pts > p.pts; }).length + 1;
              var earnedA = checkAchievements(p, ppRankA);
              if (earnedA.length > 0) syncAchievements(p.id, earnedA);
            }
          });
        });
      }
    };
    // Reuse existing dbTournamentId if available
    var existingId=tournamentState.dbTournamentId;
    if(existingId){
      doSave(existingId);
    }else{
      supabase.from('tournaments').insert({name:clashName,date:new Date().toISOString().split('T')[0],phase:'complete'}).select('id').single().then(function(res){
        if(res.error){console.error("Failed to save tournament:",res.error);toast("Failed to save results to database","error");return;}
        if(res.data)doSave(res.data.id);
      });
    }
  }



  // auto-highlight if logged in

  const myLobbyAuto=currentUser?lobbies.findIndex(lb=>lb.some(p=>p.name===currentUser.username)):-1;

  const effectiveHighlight=highlightLobby!==null?highlightLobby:myLobbyAuto>=0?myLobbyAuto:null;



  return(

    <div className="page wrap">

      {showFinalizeConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1003,padding:16}}>
          <Panel glow style={{width:"100%",maxWidth:420,padding:"28px"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:12}}>{React.createElement("i",{className:"ti ti-trophy"})}</div>
              <h3 style={{color:"#F2EDE4",fontSize:20,marginBottom:8}}>Finalize This Clash?</h3>
              <p style={{color:"#BECBD9",fontSize:14,lineHeight:1.5,marginBottom:4}}>This will end the tournament and post final results. All {checkedIn.length} players will receive their season points.</p>
              <p style={{color:"#E8A838",fontSize:12,fontWeight:600}}>This action cannot be undone.</p>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn v="dark" onClick={()=>setShowFinalizeConfirm(false)}>Cancel</Btn>
              <Btn v="primary" onClick={()=>{setShowFinalizeConfirm(false);saveResultsToSupabase(players,currentClashId);setTournamentState(ts=>({...ts,phase:"complete",lockedLobbies:[],savedLobbies:[]}));toast("Clash complete! View results →","success");}}>Finalize Clash</Btn>
            </div>
          </Panel>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>

          <span>Game {round}/{tournamentState.totalGames||3}</span>

          <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,letterSpacing:".08em",textTransform:"uppercase",
            background:tournamentState.phase==="inprogress"?"rgba(82,196,124,.12)":tournamentState.phase==="complete"?"rgba(78,205,196,.12)":"rgba(155,114,207,.12)",
            color:tournamentState.phase==="inprogress"?"#6EE7B7":tournamentState.phase==="complete"?"#4ECDC4":"#C4B5FD",
            border:"1px solid "+(tournamentState.phase==="inprogress"?"rgba(82,196,124,.3)":tournamentState.phase==="complete"?"rgba(78,205,196,.3)":"rgba(155,114,207,.3)")}}>
            {tournamentState.phase==="inprogress"?"Live":tournamentState.phase==="complete"?"Complete":tournamentState.phase==="checkin"?"Check-in":"Setup"}
          </span>

          <span style={{fontSize:13,fontWeight:400,color:"#BECBD9"}}>{lobbies.length} {lobbies.length===1?"Lobby":"Lobbies"} · {checkedIn.length} players</span>

        </h2>

        {isAdmin&&(

          <div style={{display:"flex",gap:8}}>

            <Btn v="dark" s="sm" disabled={round<=1} onClick={()=>setTournamentState(ts=>({...ts,round:ts.round-1,lockedLobbies:[],savedLobbies:[]}))}>← Round</Btn>

            <Btn v="primary" s="sm" disabled={!allLocked} onClick={()=>{var maxRounds=tournamentState.totalGames||3;var cutL=tournamentState.cutLine||0;var cutG=tournamentState.cutAfterGame||0;if(round>=maxRounds){setShowFinalizeConfirm(true);}else{var nextRound=round+1;var cutMsg="";if(cutL>0&&round===cutG){var standings=computeTournamentStandings(checkedIn,[],null);var cutResult=applyCutLine(standings,cutL,cutG);var elimCount=cutResult.eliminated.length;if(elimCount>0){cutMsg="  -  "+elimCount+" players eliminated (below "+cutL+"pts)";cutResult.eliminated.forEach(function(ep){setPlayers(function(ps){return ps.map(function(p){return p.id===ep.id?Object.assign({},p,{checkedIn:false}):p;});});});setTournamentState(function(ts){var kept=(ts.checkedInIds||[]).filter(function(cid){return!cutResult.eliminated.some(function(e){return String(e.id)===String(cid);});});return Object.assign({},ts,{checkedInIds:kept});});}}setTournamentState(ts=>({...ts,round:nextRound,lockedLobbies:[],savedLobbies:[]}));toast("Advanced to Game "+nextRound+cutMsg,"success");}}}>

              {round>=(tournamentState.totalGames||3)?"Finalize Clash":"Next Game →"}

            </Btn>

          </div>

        )}

      </div>

      {allLocked&&checkedIn.length>0&&(
        <div style={{background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.3)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,animation:"pulse 2s infinite"}}>
          <span style={{fontSize:16}}>{React.createElement("i",{className:"ti ti-circle-check",style:{color:"#52C47C"}})}</span>
          <span style={{fontSize:13,fontWeight:600,color:"#6EE7B7",flex:1}}>All {lobbies.length} lobbies locked  -  {round>=(tournamentState.totalGames||3)?"ready to finalize!":"ready for next game!"}{isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<(tournamentState.totalGames||3)?" Auto-advancing in "+autoAdvanceCountdown+"s":""}</span>
          {isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<(tournamentState.totalGames||3)&&(
            <button onClick={cancelAutoAdvance} style={{fontSize:11,color:"#F87171",fontWeight:700,cursor:"pointer",background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"4px 12px",fontFamily:"inherit",whiteSpace:"nowrap"}}>Cancel</button>
          )}
        </div>
      )}

      {checkedIn.length===0&&(

        <div style={{textAlign:"center",padding:"60px 20px"}}>

          <div style={{fontSize:48,marginBottom:16}}>{tournamentState&&tournamentState.phase==="complete"?React.createElement("i",{className:"ti ti-"+(ICON_REMAP["trophy-fill"]||"trophy-fill")}):tournamentState&&tournamentState.phase==="inprogress"?React.createElement("i",{className:"ti ti-"+(ICON_REMAP["lightning-charge-fill"]||"lightning-charge-fill")}):React.createElement("i",{className:"ti ti-"+(ICON_REMAP["controller"]||"controller")})}</div>

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

            <span style={{fontSize:13,color:"#C8D4E0",flexShrink:0}}>{React.createElement("i",{className:"ti ti-search",style:{fontSize:13,marginRight:4}})}Find your lobby:</span>

            <Inp value={mySearch} onChange={setMySearch} placeholder="Your name or Riot ID" onKeyDown={e=>e.key==="Enter"&&findMyLobby()}/>

            <Btn v="purple" s="sm" onClick={findMyLobby}>Find Me</Btn>

            {effectiveHighlight!==null&&<span style={{fontSize:12,color:"#6EE7B7",fontWeight:600}}>You are in Lobby {effectiveHighlight+1}</span>}

          </Panel>

          {/* Lobby lock progress */}
          {lobbies.length>0&&tournamentState.phase==="inprogress"&&(
            <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1,background:"rgba(255,255,255,.04)",borderRadius:8,height:6,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:8,background:allLocked?"linear-gradient(90deg,#52C47C,#6EE7B7)":"linear-gradient(90deg,#E8A838,#9B72CF)",width:Math.round(lockedLobbies.length/lobbies.length*100)+"%",transition:"width .5s ease"}}/>
              </div>
              <span style={{fontSize:11,fontWeight:700,color:allLocked?"#6EE7B7":"#E8A838",whiteSpace:"nowrap"}}>{lockedLobbies.length}/{lobbies.length} locked</span>
            </div>
          )}

          {/* Round progress + complete banner */}

          {tournamentState&&tournamentState.phase==="complete"&&(

            <div style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.4)",borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>

              <span style={{fontSize:22}}>{React.createElement("i",{className:"ti ti-trophy"})}</span>

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

                <div style={{fontSize:11,color:r<round?"#6EE7B7":r===round?"#E8A838":"#9AAABF"}}>{r<round?"Complete":r===round?"In Progress":"Upcoming"}</div>

              </div>

            ))}

          </div>



          {/* Lobby grid */}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(320px,100%),1fr))",gap:16}}>

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

                    {locked&&isAdmin&&<button onClick={function(e){e.stopPropagation();unlockLobby(li);}} style={{fontSize:11,color:"#F87171",fontWeight:700,cursor:"pointer",background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"3px 10px",marginLeft:6}}>Unlock</button>}

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

                              {homie&&<span style={{fontSize:10}}>{React.createElement("i",{className:"ti ti-heart",style:{color:"#9B72CF"}})}</span>}

                              {isHotStreak(p)&&<span style={{fontSize:10}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}</span>}

                            </div>

                            <div style={{fontSize:10,color:"#BECBD9"}}>{p.rank} · {p.region}</div>

                          </div>

                          <div className="mono" style={{fontSize:12,fontWeight:700,color:"#E8A838",flexShrink:0}}>{p.pts}pts</div>

                          {isMe&&!locked&&tournamentState.phase==="inprogress"&&(
                            playerSubmissions[li]&&playerSubmissions[li][p.id]?(
                              <div style={{fontSize:10,color:"#6EE7B7",fontWeight:700,flexShrink:0}}>#{playerSubmissions[li][p.id].placement} ✓</div>
                            ):(
                              <Sel value="" onChange={function(v){if(v)submitMyPlacement(li,p.id,p.name,v);}} style={{width:52,fontSize:11,flexShrink:0}}>
                                <option value=""> - </option>
                                {[1,2,3,4,5,6,7,8].map(function(n){return <option key={n} value={n}>{n}</option>;})}
                              </Sel>
                            )
                          )}

                        </div>

                      );

                    })}

                  </div>

                  {/* Admin placement entry */}

                  {isAdmin&&!locked&&(

                    <div style={{borderTop:"1px solid rgba(242,237,228,.06)"}}>

                      {(!placementEntry[li]||!placementEntry[li].open)?(

                        <div style={{padding:"10px 12px",background:"rgba(255,255,255,.01)"}}>

                          <Btn v="teal" s="sm" full onClick={function(){openPlacementEntry(li);}}>
                            Enter Placements{playerSubmissions[li]?" ("+Object.keys(playerSubmissions[li]).length+" submitted)":""}
                          </Btn>

                        </div>

                      ):(

                        <div style={{padding:"12px",background:"rgba(78,205,196,.03)",borderTop:"1px solid rgba(78,205,196,.12)"}}>

                          <div style={{fontSize:11,fontWeight:700,color:"#4ECDC4",marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>Enter Placements  -  Round {round}</div>

                          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>

                            {lobby.sort((a,b)=>b.pts-a.pts).map(p=>{

                              const dup=lobby.filter(x=>placementEntry[li].placements[x.id]===placementEntry[li].placements[p.id]).length>1;

                              const wasSelfSubmitted=((playerSubmissions||{})[li]||{})[p.id];

                              return(

                                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8}}>

                                  <span style={{fontSize:12,color:"#F2EDE4",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}{wasSelfSubmitted&&<span style={{fontSize:9,color:"#4ECDC4",fontWeight:700,marginLeft:4}}>SELF</span>}</span>

                                  <Sel value={placementEntry[li].placements[p.id]||"1"} onChange={v=>setPlace(li,p.id,v)} style={{width:60,border:dup?"1px solid #F87171":undefined}}>

                                    {[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
                                    <option value="0">DNP</option>

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

              <div style={{fontSize:32,marginBottom:12}}>{React.createElement("i",{className:"ti ti-trophy"})}</div>

              <h3 style={{color:"#E8A838",fontSize:20,marginBottom:8}}>Grand Finals</h3>

              <p style={{color:"#BECBD9",fontSize:14}}>All rounds complete. Finals results locked in.</p>

            </Panel>

          )}

        </>

      )}

    </div>

  );

}







var MemoBracketScreen = memo(BracketScreen);

const styleHideMobile=`@media(max-width:767px){.hide-mobile{display:none!important;}}`;





// ─── PLAYER PROFILE SCREEN ────────────────────────────────────────────────────

const WEEKLY_CHALLENGES=[

  {id:"w1",icon:"fire",name:"On A Roll",desc:"Win 2 lobbies this week",xp:120,type:"weekly",progress:1,goal:2},

  {id:"w2",icon:"bar-chart-line-fill",name:"Consistency Check",desc:"Average top 3 across 3 games",xp:100,type:"weekly",progress:2,goal:3},

  {id:"w3",icon:"trophy-fill",name:"Podium Finish",desc:"Top 3 in a clash event",xp:150,type:"weekly",progress:0,goal:1},

];



const DAILY_CHALLENGES=[

  {id:"d1",icon:"bullseye",name:"Sharp Shooter",desc:"Finish in the top 2",xp:50,type:"daily",progress:0,goal:1},

  {id:"d2",icon:"lightning-charge-fill",name:"Speed Run",desc:"Complete a game in under 30 mins",xp:40,type:"daily",progress:0,goal:1},

  {id:"d3",icon:"shield-fill",name:"Survivor",desc:"Finish top 4 in any lobby",xp:30,type:"daily",progress:0,goal:1},

];



function PlacementDistribution(props){
  var history=props.history||[];
  if(history.length===0)return null;
  var counts=[0,0,0,0,0,0,0,0];
  history.forEach(function(h){
    var games=h.games||[];
    games.forEach(function(g){
      if(g.placement>=1&&g.placement<=8)counts[g.placement-1]++;
    });
  });
  var total=counts.reduce(function(s,c){return s+c;},0);
  if(total===0)return null;
  var colors=["#E8A838","#C0C0C0","#CD7F32","#9B72CF","#4ECDC4","#6B7B8F","#4A5568","#2D3748"];
  return React.createElement("div",{style:{marginBottom:16}},
    React.createElement("div",{className:"cond",style:{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}},"Placement Distribution"),
    React.createElement("div",{style:{display:"flex",height:20,borderRadius:6,overflow:"hidden",background:"rgba(255,255,255,.04)"}},
      counts.map(function(c,i){
        var pct=total>0?(c/total*100):0;
        if(pct===0)return null;
        return React.createElement("div",{
          key:i,
          title:ordinal(i+1)+": "+c+" ("+Math.round(pct)+"%)",
          style:{width:pct+"%",background:colors[i],transition:"width .5s ease"}
        });
      })
    ),
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginTop:4}},
      counts.map(function(c,i){
        return React.createElement("div",{key:i,style:{textAlign:"center",flex:1,fontSize:9,color:c>0?colors[i]:"#4A5568",fontWeight:600}},
          ordinal(i+1)
        );
      })
    )
  );
}

function PlayerProfileScreen({player,onBack,allPlayers,setScreen,currentUser,seasonConfig,allUsers,setComparePlayer}){

  const [tab,setTab]=useState("overview");

  // Resolve user metadata for this player (bio, socials, banner, pfp)
  var userMeta=player.userMeta||null;
  if(!userMeta&&allUsers){var mu=allUsers.find(function(u){return u.username===player.name||u.id===player.auth_user_id;});if(mu)userMeta=mu.user_metadata||null;}
  var pBio=player.bio||userMeta&&userMeta.bio||"";
  var pTwitch=player.twitch||userMeta&&userMeta.twitch||"";
  var pTwitter=player.twitter||userMeta&&userMeta.twitter||"";
  var pYoutube=player.youtube||userMeta&&userMeta.youtube||"";
  var pPic=player.profile_pic_url||userMeta&&userMeta.profilePic||player.profilePic||"";
  var pBanner=userMeta&&userMeta.bannerUrl||player.bannerUrl||"";
  var pAccent=userMeta&&userMeta.profileAccent||player.profileAccent||"";
  var isOwnProfile=currentUser&&(currentUser.username===player.name||currentUser.id===player.auth_user_id);

  const achievements=getAchievements(player);

  const s=getStats(player);

  useEffect(function() {
    if (player && player.id && isOwnProfile) {
      var allPlayers2 = allPlayers || [];
      var ppRank2 = allPlayers2.filter(function(p) { return p.pts > player.pts; }).length + 1;
      var earnedIds = checkAchievements(player, ppRank2);
      if (earnedIds.length > 0) syncAchievements(player.id, earnedIds);
    }
  }, [player && player.id]);



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

        {setScreen&&<Btn v="ghost" s="sm" onClick={()=>setScreen("recap")}>{React.createElement("i",{className:"ti ti-calendar",style:{fontSize:12,marginRight:4}})}Season Recap</Btn>}

        {setScreen&&<Btn v="purple" s="sm" onClick={()=>setScreen("challenges")}>{React.createElement("i",{className:"ti ti-bolt",style:{marginRight:3}})}Challenges</Btn>}

        <Btn v="teal" s="sm" onClick={downloadStatsCard}>{React.createElement("i",{className:"ti ti-download",style:{fontSize:12,marginRight:4}})}Download Card</Btn>
        <Btn v="dark" s="sm" onClick={copyStatsToClipboard}>{React.createElement("i",{className:"ti ti-clipboard",style:{marginRight:4}})}Copy</Btn>

        <Btn v="dark" s="sm" onClick={function(){
          var ppRank=(allPlayers||[]).filter(function(p){return p.pts>player.pts;}).length+1;
          shareToTwitter(buildShareText("profile",{name:player.name,rank:ppRank,pts:player.pts}));
        }}>{React.createElement("i",{className:"ti ti-brand-x",style:{marginRight:4}})}Share</Btn>

        {setComparePlayer&&!isOwnProfile&&<Btn v="purple" s="sm" onClick={function(){setComparePlayer(player);}}>{React.createElement("i",{className:"ti ti-arrows-diff",style:{marginRight:4}})}Compare</Btn>}



      </div>



      {/* Champion banner - shown if this player is the season champion */}

      {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&(

        <div style={{background:"linear-gradient(90deg,rgba(232,168,56,.15),rgba(232,168,56,.05))",border:"1px solid rgba(232,168,56,.5)",borderRadius:10,padding:"10px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12,boxShadow:"0 0 0 0 rgba(232,168,56,.2)"}}>

          <span style={{fontSize:22,animation:"crown-glow 3s ease 1"}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</span>

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

            {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&<span style={{position:"absolute",top:-8,right:-8,fontSize:16}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</span>}

            {!pPic&&player.name.charAt(0)}

          </div>

          <div style={{flex:1}}>

            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>

              <h1 style={{fontSize:"clamp(20px,4vw,34px)",color:"#F2EDE4",lineHeight:1}}>{player.name}</h1>

              {SEASON_CHAMPION&&player.name===SEASON_CHAMPION.name&&<Tag color="#E8A838">{React.createElement("i",{className:"ti ti-trophy",style:{fontSize:11,color:"#E8A838",marginRight:3}})}{SEASON_CHAMPION.title}</Tag>}

              {isHotStreak(player)&&<span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}</span>}

              {isOnTilt(player)&&<span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-mood-sad",style:{color:"#F87171"}})}</span>}

            </div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>

              <Tag color={rc(player.rank)}>{player.rank}</Tag>

              <Tag color="#4ECDC4">{player.region}</Tag>

              <ClashRankBadge xp={estimateXp(player)} size="sm"/>

              <span className="mono" style={{fontSize:12,color:"#BECBD9"}}>{player.riotId}</span>

              {(function(){var refCode=player.name?player.name.toLowerCase().replace(/[^a-z0-9]/g,""):"";var refCount=0;try{var rc2=localStorage.getItem("tft-referral-count-"+refCode);if(rc2)refCount=parseInt(rc2)||0;}catch(e){}return refCount>0?<Tag color={refCount>=10?"#E8A838":refCount>=5?"#C0C0C0":"#CD7F32"}>{refCount>=10?"Gold":refCount>=5?"Silver":"Bronze"} Recruiter ({refCount})</Tag>:null;})()}

            </div>

            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>

              {achievements.slice(0,5).map(a=>(

                <div key={a.id} title={a.desc} style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.3)",borderRadius:6,padding:"3px 8px",display:"flex",alignItems:"center",gap:4,fontSize:12}}>

                  {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[a.icon]||a.icon),style:{fontSize:12}})}<span style={{color:"#E8A838",fontWeight:600,fontSize:11}}>{a.name}</span>

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

        <div>

        {(function(){
          var ppTrend=[];
          var ppCum=0;
          (player.clashHistory||[]).forEach(function(c){ppCum=ppCum+(c.points||0);ppTrend.push(ppCum);});
          return React.createElement("div",{style:{marginBottom:16}},
            React.createElement(PlacementDistribution,{history:player.clashHistory||[]}),
            ppTrend.length>1?React.createElement("div",{style:{marginBottom:16}},
              React.createElement("div",{className:"cond",style:{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}},"Season Trajectory"),
              React.createElement(Sparkline,{data:ppTrend,w:280,h:40,color:"#9B72CF"})
            ):null,
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}},
              [
                [player.pts,"Season Pts","#E8A838"],
                [player.wins,"Wins","#6EE7B7"],
                [s?s.avgPlacement:"-","Avg Place","#4ECDC4"],
                [s?Math.round(s.top4Rate||0)+"%":"-","Top 4 Rate","#9B72CF"],
                [player.games||0,"Games","#BECBD9"],
                [s?s.ppg.toFixed(1):"-","Pts/Game","#E8A838"]
              ].map(function(item){
                return React.createElement("div",{key:item[1],style:{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"12px 10px",textAlign:"center"}},
                  React.createElement("div",{className:"mono",style:{fontSize:20,fontWeight:700,color:item[2],lineHeight:1}},item[0]),
                  React.createElement("div",{style:{fontSize:9,color:"#BECBD9",marginTop:4,fontWeight:600,textTransform:"uppercase"}},item[1])
                );
              })
            )
          );
        })()}

        <div className="grid-2">

          <Panel style={{padding:"18px"}}>

            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:10}}>Career Stats</h3>

            {((player.currentStreak||0)>=3||(player.tiltStreak||0)>=3)&&(

              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>

                {(player.currentStreak||0)>=3&&<div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:"rgba(232,168,56,.15)",border:"1px solid rgba(232,168,56,.4)",fontSize:12,fontWeight:700,color:"#E8A838"}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})} Hot Streak  -  {player.currentStreak} wins in a row</div>}

                {(player.tiltStreak||0)>=3&&<div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.35)",fontSize:12,fontWeight:700,color:"#93C5FD"}}>{React.createElement("i",{className:"ti ti-snowflake",style:{color:"#38BDF8"}})} Cold Streak  -  {player.tiltStreak} losses</div>}

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

                <span style={{fontSize:16}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</span>

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

                      {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[r.icon]||r.icon),style:{fontSize:14,color:r.color}})}

                      <span style={{fontSize:11,fontWeight:600,color:unlocked?r.color:"#BECBD9"}}>{r.name}</span>

                      {unlocked&&playerXp>=r.minXp&&getClashRank(playerXp).id===r.id&&<span style={{fontSize:10,color:r.color,marginLeft:"auto"}}>▲</span>}

                    </div>

                  );

                })}

              </div>
            </Panel>

          </div>

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

                        {g.claimedClutch&&<Tag color="#9B72CF" size="sm">{React.createElement("i",{className:"ti ti-target",style:{fontSize:10,marginRight:3}})}Clutch</Tag>}

                        {isDropped&&<Tag color="#BECBD9" size="sm">Dropped</Tag>}

                        {hasComeback&&<Tag color="#4ECDC4" size="sm">Comeback +2</Tag>}

                        {hasMilestone&&<Tag color="#E8A838" size="sm">{hasMilestone}-Streak Bonus</Tag>}

                      </div>

                    </div>

                    <div style={{textAlign:"right"}}>

                      <div className="mono" style={{fontSize:16,fontWeight:700,color:isDropped?"#BECBD9":"#E8A838",textDecoration:isDropped?"line-through":"none"}}>+{g.pts}pts</div>

                      {(g.bonusPts||0)>0&&!isDropped&&<div className="mono" style={{fontSize:11,color:"#52C47C"}}>+{g.bonusPts} bonus</div>}

                      <div className="cond" style={{fontSize:9,color:"#BECBD9",textTransform:"uppercase"}}>{(g.place||g.placement)===1?"Champion":(g.place||g.placement)<=4?"Top 4":"Bot 4"}</div>

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

              <div style={{marginBottom:10}}>{React.createElement("i",{className:"ti ti-tournament",style:{fontSize:32}})}</div>

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

                <div style={{fontSize:26,marginBottom:6}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[a.icon]||a.icon)})}</div>

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





var MemoPlayerProfileScreen=memo(PlayerProfileScreen);

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

function LeaderboardScreen({players,setScreen,setProfilePlayer,currentUser,toast}){

  const [tab,setTab]=useState("season");

  const [search,setSearch]=useState("");

  const [regionFilter,setRegionFilter]=useState("All");

  const [compareIds,setCompareIds]=useState([]);

  const MEDALS=["award-fill","award-fill","award-fill"];

  const MCOLS=["#E8A838","#C0C0C0","#CD7F32"];



  const sorted=useMemo(function(){
    var f=players.filter(function(p){
      var mn=p.name.toLowerCase().includes(search.toLowerCase());
      var mr=regionFilter==="All"||p.region===regionFilter;
      return mn&&mr;
    });
    return[...f].sort(function(a,b){return b.pts-a.pts;});
  },[players,search,regionFilter]);

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

        <ShareBar text={"Check out the TFT Clash leaderboard!"} toast={toast}/>

        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>

          {["season","cards","stats","streaks"].map(t=>(

            <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={()=>setTab(t)} style={{textTransform:"capitalize"}}>{t}</Btn>

          ))}

        </div>

      </div>



      {/* Podium */}

      {top3.length>=3&&(tab==="season"||tab==="cards")&&(

        <div className="podium-grid" style={{display:"grid",gridTemplateColumns:"1fr 1.08fr 1fr",gap:10,marginBottom:20}}>

          {[top3[1],top3[0],top3[2]].map((p,idx)=>{

            const ri=idx===0?1:idx===1?0:2;

            const s2=getStats(p);

            return(

              <Panel key={p.id} hover style={{padding:"18px 14px",textAlign:"center",border:"1px solid "+MCOLS[ri]+"44",marginTop:ri===0?0:14,cursor:"pointer"}} onClick={()=>open(p)}>

                <div style={{fontSize:26,marginBottom:6}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[MEDALS[ri]]||MEDALS[ri]),style:{color:MCOLS[ri]}})}</div>

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



      {tab==="season"&&sorted.length>0&&<MemoStandingsTable rows={sorted} onRowClick={open} myName={currentUser?currentUser.username:null}/>}

      {tab==="season"&&sorted.length===0&&<Panel style={{padding:"48px 20px",textAlign:"center"}}><div style={{fontSize:28,marginBottom:12}}>{React.createElement("i",{className:"ti ti-trophy"})}</div><div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:6}}>No standings yet</div><div style={{fontSize:13,color:"#9AAABF",lineHeight:1.5}}>Standings will appear once a clash has been played and results submitted.</div></Panel>}



      {tab==="cards"&&(

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>

          {sorted.map((p,i)=>{

            const s2=getStats(p);

            return(

              <Panel key={p.id} hover style={{padding:"16px",cursor:"pointer",border:"1px solid "+(i<3?MCOLS[i]+"44":"rgba(242,237,228,.08)")}} onClick={()=>open(p)}>

                <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>

                  <div style={{flex:1,minWidth:0}}>

                    <div className="mono" style={{fontSize:12,fontWeight:700,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#9AAABF",marginBottom:2}}>#{i+1}</div>

                    <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}>

                      <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</span>

                      {p.plan==="pro"&&<span style={{fontSize:9,fontWeight:800,color:"#E8A838",background:"rgba(232,168,56,.15)",padding:"1px 4px",borderRadius:4,marginLeft:2}}>PRO</span>}

                      {isHotStreak(p)&&React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}{isOnTilt(p)&&React.createElement("i",{className:"ti ti-mood-sad",style:{color:"#F87171"}})}

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

            const s2=getStats(p);

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

            const s2=getStats(p);

            return(

              <div key={p.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 80px 70px",padding:"11px 14px",borderBottom:"1px solid rgba(242,237,228,.04)",alignItems:"center",cursor:"pointer"}} onClick={()=>open(p)}>

                <span className="mono" style={{fontSize:12,color:i<3?"#E8A838":"#9AAABF"}}>{i+1}</span>

                <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>

                  <span style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}{isHotStreak(p)?" ":""}{isOnTilt(p)?" ":""}</span>

                </div>

                <span className="mono" style={{fontSize:14,fontWeight:700,color:"#E8A838"}}>{p.bestStreak||0}{React.createElement("i",{className:"ti ti-flame",style:{fontSize:12,color:"#F97316",marginLeft:2}})}</span>

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

      {comparePlayers.length>=2&&<div style={{marginTop:20,background:"linear-gradient(145deg,rgba(14,22,40,.92),rgba(8,12,24,.96))",border:"1px solid rgba(155,114,207,.35)",borderRadius:14,padding:24,boxShadow:"0 8px 32px rgba(0,0,0,.4)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["diagram-3-fill"]||"diagram-3-fill")})}</span><div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",fontFamily:"'Russo One',sans-serif"}}>{comparePlayers.map(p=>p.name).join(" vs ")}</div></div><Btn v="dark" s="sm" onClick={()=>setCompareIds([])}>Clear</Btn></div><div style={{display:"grid",gridTemplateColumns:"repeat("+comparePlayers.length+",1fr)",gap:12,marginBottom:16}}>{comparePlayers.map(function(p){var cs=getStats(p);return <Panel key={p.id} style={{padding:14,textAlign:"center"}}><div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:4}}>{p.name}</div><div className="mono" style={{fontSize:22,fontWeight:700,color:"#E8A838"}}>{p.pts}</div><div style={{fontSize:10,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".08em"}}>Season Pts</div></Panel>;})}</div>{[["Avg Placement",comparePlayers.map(p=>parseFloat(getStats(p).avgPlacement)||99),true],["Win Rate",comparePlayers.map(p=>parseFloat(getStats(p).top1Rate)||0),false],["Top 4 Rate",comparePlayers.map(p=>parseFloat(getStats(p).top4Rate)||0),false],["Wins",comparePlayers.map(p=>getStats(p).wins),false],["Games",comparePlayers.map(p=>getStats(p).games),false],["PPG",comparePlayers.map(p=>parseFloat(getStats(p).ppg)||0),false],["Bottom 4 Rate",comparePlayers.map(p=>parseFloat(getStats(p).bot4Rate)||0),true],["Best Streak",comparePlayers.map(p=>p.bestStreak||0),false],["Comeback Rate",comparePlayers.map(p=>parseFloat(getStats(p).comebackRate)||0),false]].map(([label,vals,lowerBetter])=>{const best=lowerBetter?Math.min(...vals):Math.max(...vals);return(<div key={label} style={{display:"grid",gridTemplateColumns:["2fr"].concat(comparePlayers.map(()=>"1fr")).join(" "),gap:8,padding:"10px 0",borderBottom:"1px solid rgba(242,237,228,.06)",alignItems:"center"}}><span style={{fontSize:12,color:"#C8D4E0",fontWeight:600}}>{label}</span>{vals.map((v,i)=>(<span key={i} className="mono" style={{fontSize:14,fontWeight:700,color:v===best?"#E8A838":"#BECBD9",textAlign:"center",position:"relative"}}>{label==="Avg Placement"?v===99?"-":v:label.includes("Rate")?v+"%":v}{v===best&&<span style={{display:"inline-block",marginLeft:4,fontSize:9,color:"#E8A838"}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["star-fill"]||"star-fill")})}</span>}</span>))}</div>);})}</div>}

    </div>

  );

}





var MemoLeaderboardScreen = memo(LeaderboardScreen);

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

                      {p.name===mostImproved&&<Tag color="#52C47C" size="sm">{React.createElement("i",{className:"ti ti-trending-up",style:{marginRight:3}})}Improved</Tag>}

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

              <span style={{fontSize:22}}>{React.createElement("i",{className:"ti ti-trending-up"})}</span>

              <div><div style={{fontWeight:700,fontSize:14,color:"#6EE7B7"}}>Most Improved</div>

              <div style={{fontWeight:700,color:"#F2EDE4",fontSize:13}}>{mostImproved}</div>

              <div style={{fontSize:11,color:"#BECBD9"}}>Above their season average</div></div>

            </div>

          </Panel>

        )}

        {biggestUpset&&(

          <Panel style={{padding:"14px",border:"1px solid rgba(155,114,207,.25)"}}>

            <div style={{display:"flex",alignItems:"center",gap:10}}>

              <span style={{fontSize:22}}>{React.createElement("i",{className:"ti ti-target"})}</span>

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

  const MEDALS=["award-fill","award-fill","award-fill"];

  const PODIUM_COLS=["#E8A838","#C0C0C0","#CD7F32"];



  if(!champ)return<div className="page wrap" style={{textAlign:"center",color:"#BECBD9",paddingTop:60}}>Complete a clash first!</div>;



  const top3=[sorted[1],sorted[0],sorted[2]].filter(Boolean);

  const REWARDS=["Clash Crown","Icon","Frame","Loot Orb","Loot Orb","","",""];



  function shareDiscord(){

    const lines=[

      "**TFT Clash S1  -  "+CLASH_NAME+" Results**",

      "```",

      ...sorted.slice(0,8).map((p,i)=>"#"+(i+1)+" "+p.name.padEnd(16)+" "+String(p.pts).padStart(4)+"pts  avg "+getStats(p).avgPlacement),

      "```",

      "Champion: **"+champ.name+"**    "+champ.pts+"pts",

    ];

    navigator.clipboard?.writeText(lines.join("\n")).then(()=>toast("Copied for Discord","success"));

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

    ctx.fillText("TFT CLASH S1  -  FINAL RESULTS",40,44);ctx.letterSpacing="0px";

    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";

    ctx.fillText(CLASH_DATE+"  ·  "+sorted.length+" players",40,64);

    ctx.fillStyle="rgba(232,168,56,0.1)";

    ctx.beginPath();ctx.roundRect(40,85,820,100,8);ctx.fill();

    ctx.strokeStyle="rgba(232,168,56,0.4)";ctx.lineWidth=1;ctx.stroke();

    ctx.font="bold 40px serif";ctx.fillStyle="#E8A838";ctx.fillText("W",55,152);

    ctx.font="bold 28px serif";ctx.fillStyle="#F2EDE4";ctx.fillText(champ.name,110,150);

    ctx.font="bold 22px monospace";ctx.fillStyle="#E8A838";ctx.fillText(champ.pts+" pts",110,174);

    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";ctx.fillText("Champion · AVP: "+getStats(champ).avgPlacement,110,194);

    sorted.slice(0,8).forEach((p,i)=>{

      const x=40+(i>3?440:0);const iy=i>3?i-4:i;

      const c2=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#BECBD9";

      ctx.font="bold 14px monospace";ctx.fillStyle=c2;ctx.fillText("#"+(i+1),x,210+iy*36);

      ctx.font="14px sans-serif";ctx.fillStyle=i<3?"#F2EDE4":"#C8D4E0";ctx.fillText(p.name,x+36,210+iy*36);

      ctx.font="bold 14px monospace";ctx.fillStyle="#E8A838";ctx.fillText(p.pts+"pts",x+200,210+iy*36);

      const av=getStats(p).avgPlacement;

      ctx.font="12px monospace";ctx.fillStyle=parseFloat(av)<3?"#4ade80":parseFloat(av)<5?"#facc15":"#f87171";

      ctx.fillText("avg:"+av,x+280,210+iy*36);

    });

    ctx.fillStyle="rgba(232,168,56,0.15)";ctx.fillRect(0,488,900,32);

    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";

    ctx.fillText("TFT CLASH  ·  tftclash.gg",40,508);ctx.letterSpacing="0px";

    ctx.font="11px monospace";ctx.fillStyle="#BECBD9";ctx.fillText("#TFTClash  #TFT",700,508);

    const a=document.createElement("a");a.download="TFTClash-Results.png";a.href=canvas.toDataURL("image/png");a.click();

    toast("Results card downloaded","success");

  }



  return(

    <div className="page wrap">

      {/* Header */}

      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,flexWrap:"wrap"}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

        <div style={{flex:1,minWidth:0}}>

          <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".18em",textTransform:"uppercase",marginBottom:2}}>Season 1</div>

          <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(22px,3.5vw,34px)",fontWeight:900,color:"#F2EDE4",lineHeight:1}}>{CLASH_NAME}  -  Final Results</h1>

          <div style={{fontSize:12,color:"#BECBD9",marginTop:3}}>{CLASH_DATE} · {sorted.length} players · {Math.ceil(sorted.length/8)} lobbies</div>

        </div>

        <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap"}}>

          <Btn v="dark" s="sm" onClick={shareDiscord}>Discord</Btn>

          <Btn v="dark" s="sm" onClick={function(){
            shareToTwitter(buildShareText("recap",{winner:champ.name,clashName:CLASH_NAME}));
          }}>{React.createElement("i",{className:"ti ti-brand-x",style:{marginRight:4}})}Share</Btn>

          <Btn v="ghost" s="sm" onClick={downloadCard}>{React.createElement("i",{className:"ti ti-download",style:{fontSize:12,marginRight:3}})}PNG</Btn>

          <Btn v="dark" s="sm" onClick={function(){
            var text="TFT Clash Results\n"+CLASH_NAME+" \u2014 "+CLASH_DATE+"\n\n";
            sorted.slice(0,8).forEach(function(p,i){text+=(i+1)+". "+p.name+" \u2014 "+p.pts+"pts (avg: "+getStats(p).avgPlacement+")\n";});
            text+="\n#TFTClash tftclash.gg";
            navigator.clipboard.writeText(text).then(function(){toast("Results copied!","success");}).catch(function(){toast("Copy failed","error");});
          }}>{React.createElement("i",{className:"ti ti-clipboard",style:{marginRight:4}})}Copy</Btn>

        </div>

      </div>



      {/* Champion banner */}

      <div style={{background:"linear-gradient(135deg,rgba(232,168,56,.22),rgba(155,114,207,.08),rgba(8,8,15,1))",border:"1px solid rgba(232,168,56,.55)",borderRadius:18,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",position:"relative",overflow:"hidden",boxShadow:"0 0 60px rgba(232,168,56,.18),inset 0 0 80px rgba(232,168,56,.04)"}}>

        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>

        <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(232,168,56,.3),transparent)"}}/>

        <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,rgba(232,168,56,.25),rgba(232,168,56,.06))",border:"2px solid rgba(232,168,56,.7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,flexShrink:0,boxShadow:"0 0 24px rgba(232,168,56,.35)"}}>

          {React.createElement("i",{className:"ti ti-trophy",style:{fontSize:40,color:"#E8A838"}})}

        </div>

        <div style={{flex:1,minWidth:0}}>

          <div style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".16em",textTransform:"uppercase",marginBottom:4}}>{React.createElement("i",{className:"ti ti-trophy",style:{fontSize:11,color:"#E8A838",marginRight:3}})}Clash Champion</div>

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:"clamp(26px,4vw,44px)",fontWeight:900,color:"#F2EDE4",lineHeight:1,marginBottom:6}}>{champ.name}</div>

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>

            <Tag color="#E8A838" size="sm">{champ.rank}</Tag>

            <Tag color="#4ECDC4" size="sm">{champ.region}</Tag>

            {isHotStreak(champ)&&<Tag color="#F97316" size="sm">{React.createElement("i",{className:"ti ti-flame",style:{fontSize:11,color:"#F97316",marginRight:3}})}{champ.currentStreak}-streak</Tag>}

          </div>

        </div>

        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>

          {[["Season Pts",champ.pts,"#E8A838"],["Wins",champ.wins,"#6EE7B7"],["Avg",getStats(champ).avgPlacement,avgCol(getStats(champ).avgPlacement)],["Top4%",getStats(champ).top4Rate+"%","#C4B5FD"]].map(([l,v,c])=>(

            <div key={l} style={{textAlign:"center",padding:"10px 16px",background:"rgba(0,0,0,.3)",borderRadius:10,minWidth:64}}>

              <div className="mono" style={{fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>

              <div style={{fontSize:10,color:"#BECBD9",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>{l}</div>

            </div>

          ))}

        </div>

      </div>



      {/* Podium  -  top 3 */}

      {sorted.length>=3&&(

        <div className="podium-grid" style={{display:"grid",gridTemplateColumns:"1fr 1.1fr 1fr",gap:10,marginBottom:24,alignItems:"end"}}>

          {top3.map((p,idx)=>{

            const actualRank=idx===0?1:idx===1?0:2;

            const col=PODIUM_COLS[actualRank];

            const isGold=actualRank===0;

            const height=isGold?1:actualRank===0?0.88:0.76;

            return(

              <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}

                style={{background:isGold?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",border:"1px solid "+(isGold?"rgba(232,168,56,.3)":"rgba(255,255,255,.07)"),borderRadius:14,padding:"20px 14px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+col,paddingTop:isGold?28:20}}>

                <div style={{fontSize:28,marginBottom:8}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[MEDALS[actualRank]]||MEDALS[actualRank]),style:{color:PODIUM_COLS[actualRank]}})}</div>

                <div style={{fontFamily:"'Russo One',sans-serif",fontSize:isGold?17:14,fontWeight:700,color:"#F2EDE4",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>

                <div style={{fontSize:11,color:"#BECBD9",marginBottom:10}}>{p.rank} · {p.region}</div>

                <div className="mono" style={{fontSize:isGold?28:20,fontWeight:800,color:col,lineHeight:1}}>{p.pts}</div>

                <div style={{fontSize:9,color:"#BECBD9",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginTop:3}}>Season Pts</div>

                <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:10}}>

                  {[["W",getStats(p).wins,"#6EE7B7"],["Avg",getStats(p).avgPlacement,avgCol(getStats(p).avgPlacement)]].map(([l,v,c])=>(

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

            const st=getStats(p);

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

                      {HOMIES_IDS.includes(p.id)&&<span style={{fontSize:10}}>{React.createElement("i",{className:"ti ti-heart",style:{color:"#9B72CF"}})}</span>}

                      {isHotStreak(p)&&<span style={{fontSize:10}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}</span>}

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

                <div style={{fontSize:12}}>{REWARDS[i]?<Tag color={col} size="sm">{REWARDS[i]}</Tag>:<span style={{color:"#9AAABF"}}> - </span>}</div>

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

            <span style={{fontSize:24}}>{React.createElement("i",{className:"ti ti-gift"})}</span>

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

          <h3 style={{fontFamily:"'Russo One',sans-serif",fontSize:16,color:"#F2EDE4",marginBottom:4}}>{CLASH_NAME}  -  Round by Round</h3>

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



var MemoResultsScreen=memo(ResultsScreen);

// ─── HALL OF FAME ─────────────────────────────────────────────────────────────

function HofScreen({players,setScreen,setProfilePlayer,pastClashes,toast}){

  const [expandRecord,setExpandRecord]=useState(null);

  const allP=players.length>0?players:[];

  const sorted=[...allP].sort((a,b)=>b.pts-a.pts);

  const king=sorted[0];

  const kingStats=king?getStats(king):null;

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

      byPts[0]?{id:"pts",icon:"trophy-fill",title:"Season Points Leader",value:byPts[0].pts+" pts",holder:byPts[0].name,rank:byPts[0].rank,runner:[byPts[1]&&byPts[1].name,byPts[2]&&byPts[2].name].filter(Boolean),history:[]}:null,

      byWins[0]&&(byWins[0].wins||0)>0?{id:"wins",icon:"lightning-charge-fill",title:"Win Machine",value:(byWins[0].wins||0)+" wins",holder:byWins[0].name,rank:byWins[0].rank,runner:[byWins[1]&&byWins[1].name,byWins[2]&&byWins[2].name].filter(Boolean),history:[]}:null,

      byAvg[0]?{id:"avg",icon:"bullseye",title:"Consistency King",value:"AVP "+byAvg[0].avg,holder:byAvg[0].name,rank:byAvg[0].rank,runner:[byAvg[1]&&byAvg[1].name,byAvg[2]&&byAvg[2].name].filter(Boolean),history:[]}:null,

      byStreak[0]&&(byStreak[0].bestStreak||0)>1?{id:"streak",icon:"fire",title:"Hot Streak",value:(byStreak[0].bestStreak||0)+" consecutive top4s",holder:byStreak[0].name,rank:byStreak[0].rank,runner:[byStreak[1]&&byStreak[1].name,byStreak[2]&&byStreak[2].name].filter(Boolean),history:[]}:null,

      byGames[0]?{id:"games",icon:"controller",title:"Iron Presence",value:(byGames[0].games||0)+" games",holder:byGames[0].name,rank:byGames[0].rank,runner:[byGames[1]&&byGames[1].name,byGames[2]&&byGames[2].name].filter(Boolean),history:[]}:null,

      byTop4[0]&&(byTop4[0].games||0)>0?{id:"top4r",icon:"stars",title:"Top4 Machine",value:Math.round((byTop4[0].top4||0)/byTop4[0].games*100)+"%",holder:byTop4[0].name,rank:byTop4[0].rank,runner:[byTop4[1]&&byTop4[1].name,byTop4[2]&&byTop4[2].name].filter(Boolean),history:[]}:null,

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

        <p style={{fontSize:14,color:"#C8D4E0",maxWidth:440,margin:"0 auto",lineHeight:1.65,marginBottom:16}}>These records are permanent. Every name here earned their place.</p>

        <div style={{display:"flex",justifyContent:"center"}}><ShareBar text={"Check out the TFT Clash Hall of Fame!"} toast={toast}/></div>

        <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(232,168,56,.35),transparent)",marginTop:24}}/>

        <div

          title="GOLDENGOD was here"

          style={{position:"absolute",bottom:8,right:14,fontSize:15,opacity:.07,cursor:"default",userSelect:"none",transition:"opacity .35s,filter .35s",filter:"drop-shadow(0 0 0px #E8A838)"}}

          onMouseEnter={function(e){e.currentTarget.style.opacity=".95";e.currentTarget.style.filter="drop-shadow(0 0 10px #E8A838)";}}

          onMouseLeave={function(e){e.currentTarget.style.opacity=".07";e.currentTarget.style.filter="drop-shadow(0 0 0px #E8A838)";}}>C</div>

      </div>



      {/* Reigning champion hero */}

      {king&&kingStats&&(

        <div style={{position:"relative",overflow:"hidden",borderRadius:20,marginBottom:32,border:"1px solid rgba(232,168,56,.4)",background:"linear-gradient(135deg,#0E1018,#16100A,#08080F)",boxShadow:"0 0 80px rgba(232,168,56,.07)"}}>

          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#E8A838,#FFD700,#E8A838,transparent)"}}/>

          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 120% at 15% 50%,rgba(232,168,56,.07),transparent)",pointerEvents:"none"}}/>

          <div style={{position:"relative",padding:"clamp(20px,4vw,36px) clamp(20px,4vw,40px)",display:"flex",alignItems:"flex-start",gap:"clamp(16px,3vw,40px)",flexWrap:"wrap"}}>



            {/* Identity */}

            <div style={{textAlign:"center",flexShrink:0,minWidth:120}}>

              <div style={{fontSize:"clamp(32px,5vw,52px)",marginBottom:10,animation:"crown-glow 3s ease 1"}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</div>

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

            <div style={{fontSize:36,marginBottom:10}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</div>

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

                <div style={{fontSize:"clamp(22px,4vw,32px)",marginBottom:8}}>{isActive?React.createElement("i",{className:"ti ti-trophy",style:{fontSize:"inherit",color:"#E8A838"}}):React.createElement("i",{className:"ti ti-trophy",style:{fontSize:"inherit"}})}</div>

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
            <div style={{fontSize:48,marginBottom:16}}>{React.createElement("i",{className:"ti ti-trophy"})}</div>
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

                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(232,168,56,.4)";e.currentTarget.style.transform="translateY(-2px)";}}

                onMouseLeave={e=>{e.currentTarget.style.borderColor=isOpen?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)";e.currentTarget.style.transform="translateY(0)";}}>

                <div style={{background:"linear-gradient(90deg,rgba(232,168,56,.08),rgba(232,168,56,.02))",padding:"16px 18px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(232,168,56,.1)"}}>

                  <div style={{width:46,height:46,borderRadius:10,background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[r.icon]||r.icon),style:{color:r.color||"#E8A838"}})}</div>

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

var MemoHofScreen=memo(HofScreen);

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

          <div style={{fontSize:40,marginBottom:12}}>{React.createElement("i",{className:"ti ti-inbox"})}</div>

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

                  <span style={{fontSize:14}}>{React.createElement("i",{className:"ti ti-trophy"})}</span><span style={{fontWeight:700,color:"#E8A838",fontSize:13}}>{c.champion}</span>

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

                          <div style={{fontSize:16,marginBottom:4}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["award-fill"]||"award-fill")})}</div>

                          <div style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>{name}</div>

                          <div style={{fontSize:10,color:"#BECBD9",marginTop:2}}>#{i+1}</div>

                        </div>

                      ))}

                    </div>

                  </div>

                  {c.report&&(

                    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>

                      {c.report.mostImproved&&<div style={{background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.2)",borderRadius:8,padding:"8px 12px",fontSize:12}}><span style={{color:"#4ECDC4",fontWeight:700}}>{React.createElement("i",{className:"ti ti-trending-up",style:{marginRight:3}})}Most Improved:</span> <span style={{color:"#F2EDE4"}}>{c.report.mostImproved}</span></div>}

                      {c.report.biggestUpset&&<div style={{background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.2)",borderRadius:8,padding:"8px 12px",fontSize:12}}><span style={{color:"#F87171",fontWeight:700}}>{React.createElement("i",{className:"ti ti-bolt",style:{marginRight:3}})}Upset:</span> <span style={{color:"#F2EDE4"}}>{c.report.biggestUpset}</span></div>}

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
          <p>Usernames must match exactly  -  they are case-sensitive and must match the account username on this platform.</p>
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

function setPlayerTier(userId, tier) {
  return supabase.from("user_subscriptions").upsert({
    user_id: userId,
    tier: tier,
    provider: "manual",
    status: "active"
  }, {onConflict: "user_id"});
}

function AdminPanel({players,setPlayers,toast,setAnnouncement,setScreen,tournamentState,setTournamentState,seasonConfig,setSeasonConfig,quickClashes,setQuickClashes,orgSponsors,setOrgSponsors,scheduledEvents,setScheduledEvents,auditLog,setAuditLog,hostApps,setHostApps,scrimAccess,setScrimAccess,tickerOverrides,setTickerOverrides,setNotifications,featuredEvents,setFeaturedEvents,currentUser}){

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

  const [flashForm,setFlashForm]=useState({name:"Flash Tournament",date:"",maxPlayers:"128",gameCount:"3",formatPreset:"standard",seedingMethod:"snake",prizeRows:[{placement:"1",prize:""}]});

  const [qcPlacements,setQcPlacements]=useState({});

  const [roundConfig,setRoundConfig]=useState({maxPlayers:"24",roundCount:"3",checkinWindowMins:"30",cutLine:"0",cutAfterGame:"0"});

  const [flashEvents,setFlashEvents]=useState([]);

  const [spForm,setSpForm]=useState({name:"",logo:"",color:"",playerId:""});

  const [auditFilter,setAuditFilter]=useState("All");
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [dbAuditEntries,setDbAuditEntries]=useState([]);
  const [auditSource,setAuditSource]=useState("session");

  // Load flash tournaments from DB on mount
  useEffect(function(){
    supabase.from('tournaments').select('*').eq('type','flash_tournament').order('date',{ascending:false}).then(function(res){
      if(res.data)setFlashEvents(res.data);
    });
  },[]);

  // Load scheduled events from DB on mount
  useEffect(function(){
    supabase.from('scheduled_events').select('*').order('created_at',{ascending:false}).then(function(res){
      if(res.data&&res.data.length>0){setScheduledEvents(res.data);}
    });
  },[]);

  // Load host applications from DB on mount
  useEffect(function(){
    supabase.from('host_applications').select('*').order('created_at',{ascending:false}).then(function(res){
      if(res.data&&res.data.length>0){setHostApps(res.data.map(function(a){return{id:a.id,userId:a.user_id,name:a.name,email:a.email,org:a.org||'',reason:a.reason||'',freq:a.freq||'',status:a.status||'pending',submittedAt:a.submitted_at?new Date(a.submitted_at).toLocaleDateString():'',approvedAt:a.approved_at?new Date(a.approved_at).toLocaleDateString():''};}));}
    });
  },[]);

  // Load sponsorships from site_settings on mount
  useEffect(function(){
    supabase.from('site_settings').select('value').eq('key','org_sponsors').single().then(function(res){
      if(res.data&&res.data.value){try{var parsed=JSON.parse(res.data.value);if(parsed&&typeof parsed==='object'){setOrgSponsors(parsed);}}catch(e){}}
    });
  },[]);

  // Load DB audit log when switching to audit source "database"
  function loadDbAudit(){
    supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100).then(function(res){
      if(res.data){setDbAuditEntries(res.data);}
    });
  }

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

  function ban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:true,checkedIn:false}:p));setTournamentState(function(ts){return{...ts,checkedInIds:(ts.checkedInIds||[]).filter(function(cid){return String(cid)!==String(id);})};});if(supabase.from&&id){supabase.from('players').update({banned:true,checked_in:false}).eq('id',id).then(function(r){if(r.error)console.error("[TFT] Ban sync failed:",r.error);});}addAudit("WARN","Banned: "+name);toast(name+" banned","success");}

  function unban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:false,dnpCount:0}:p));if(supabase.from&&id){supabase.from('players').update({banned:false,dnp_count:0}).eq('id',id).then(function(r){if(r.error)console.error("[TFT] Unban sync failed:",r.error);});}addAudit("ACTION","Unbanned: "+name);toast(name+" unbanned","success");}

  function markDNP(id,name){

    setPlayers(ps=>ps.map(p=>{

      if(p.id!==id)return p;

      var newCount=(p.dnpCount||0)+1;

      var isDQ=newCount>=2;

      addAudit("WARN","DNP #"+newCount+": "+name+(isDQ?" → AUTO-DQ":""));

      if(isDQ)toast(name+" has 2 DNPs  -  DISQUALIFIED","error");

      else toast(name+" marked DNP ("+newCount+"/2 before DQ)","success");

      if(isDQ){setTournamentState(function(ts){return{...ts,checkedInIds:(ts.checkedInIds||[]).filter(function(cid){return String(cid)!==String(id);})};});}if(supabase.from&&id){supabase.from('players').update({dnp_count:newCount,banned:isDQ?true:p.banned,checked_in:isDQ?false:p.checkedIn}).eq('id',id).then(function(r){if(r.error)console.error("[TFT] DNP sync failed:",r.error);});} return{...p,dnpCount:newCount,banned:isDQ?true:p.banned,checkedIn:isDQ?false:p.checkedIn};

    }));

  }

  function clearDNP(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,dnpCount:0}:p));if(supabase.from&&id){supabase.from('players').update({dnp_count:0}).eq('id',id).then(function(r){if(r.error)console.error("[TFT] Clear DNP sync failed:",r.error);});}addAudit("ACTION","DNP cleared: "+name);toast("DNP cleared for "+name,"success");}

  function remove(id,name){setPlayers(ps=>ps.filter(p=>p.id!==id));
// Sync removal to DB
if(supabase.from&&id){supabase.from('players').delete().eq('id',id).then(function(r){if(r.error)console.error("[TFT] Player delete failed:",r.error);});}
addAudit("ACTION","Removed: "+name);toast(name+" removed","success");}

  function saveNote(){setPlayers(ps=>ps.map(p=>p.id===noteTarget.id?{...p,notes:noteText}:p));if(supabase.from&&noteTarget.id){supabase.from('players').update({notes:noteText}).eq('id',noteTarget.id).then(function(r){if(r.error)console.error("[TFT] Note sync failed:",r.error);});}addAudit("ACTION","Note updated: "+noteTarget.name);setNoteTarget(null);}

  function addPlayer(){

    const n=sanitize(addPlayerForm.name.trim()),r=sanitize(addPlayerForm.riotId.trim());

    if(!n||!r){toast("Name and Riot ID required","error");return;}

    if(players.find(p=>p.name.toLowerCase()===n.toLowerCase())){toast("Name already taken","error");return;}

    const np={id:Date.now()%100000,name:n,riotId:r,rank:addPlayerForm.rank||"Gold",lp:1000,region:addPlayerForm.region||"EUW",pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,checkedIn:false,role:"player",banned:false,dnpCount:0,notes:"",clashHistory:[],sparkline:[],attendanceStreak:0,lastClashId:null,sponsor:null};

    setPlayers(ps=>[...ps,np]);

    // Write to players table and patch local state with real UUID
    if(supabase.from){
      supabase.from('players').insert({username:n,riot_id:r,rank:addPlayerForm.rank||"Gold",region:addPlayerForm.region||"EUW",auth_user_id:null}).select().single()
        .then(function(res){if(res.error)console.error("[TFT] Failed to insert player to DB:",res.error);else if(res.data){setPlayers(function(ps){return ps.map(function(p){return p.name===n?Object.assign({},p,{id:res.data.id}):p;});});}});
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



  const ADMIN_GROUPS=[
    {label:"TOURNAMENT",items:[
      {id:"dashboard",icon:"gauge",label:"Dashboard"},
      {id:"round",icon:"bolt",label:"Round Control"},
      {id:"quickclash",icon:"dice-5",label:"Quick Clash"},
      {id:"flash",icon:"tournament",label:"Flash Tournaments"},
    ]},
    {label:"MANAGEMENT",items:[
      {id:"players",icon:"users",label:"Players"},
      {id:"scores",icon:"pencil",label:"Scores"},
      {id:"broadcast",icon:"speakerphone",label:"Broadcast"},
      {id:"schedule",icon:"calendar-event",label:"Schedule"},
      {id:"featured",icon:"star",label:"Featured"},
    ]},
    {label:"CONFIGURE",items:[
      {id:"season",icon:"trophy",label:"Season"},
      {id:"sponsorships",icon:"building",label:"Sponsors"},
      {id:"hosts",icon:"device-gamepad-2",label:"Hosts"+(pendingHosts>0?" ("+pendingHosts+")":"")},
      {id:"friends",icon:"sword",label:"Scrims Access"},
      {id:"ticker",icon:"broadcast",label:"Ticker"},
    ]},
    {label:"SYSTEM",items:[
      {id:"audit",icon:"clipboard-data",label:"Audit Log"},
      {id:"settings",icon:"settings",label:"Settings"},
    ]},
  ]



  const TAB_INFO={

    dashboard:"At-a-glance clash status. Use quick actions to check in all players, pause the round, or jump to broadcast.",

    round:"Full tournament lifecycle: open check-in → start → advance rounds → complete. Configure seeding and round settings here.",

    quickclash:"Spin up an instant open clash (4-16 players, no registration). Appears live on the home screen. Players join immediately.",

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

    flash:"Create and manage flash tournaments. Set up quick competitive events with registration, check-in, and automated lobby generation.",

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



      {/* ADMIN LAYOUT - SIDEBAR + CONTENT */}
      <div style={{display:"flex",gap:0,minHeight:"calc(100vh - 80px)",margin:"0 -16px -16px"}}>

        {/* SIDEBAR */}
        <div style={{width:sidebarOpen?230:0,overflow:sidebarOpen?"visible":"hidden",background:"#0C0E18",borderRight:"1px solid rgba(242,237,228,.06)",flexShrink:0,display:"flex",flexDirection:"column",transition:"width .2s",position:"relative",zIndex:10}}>

          {/* Sidebar Header */}
          <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(242,237,228,.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,background:"linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.05))",border:"1px solid rgba(155,114,207,.3)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{React.createElement("i",{className:"ti ti-shield-cog",style:{fontSize:17,color:"#C4B5FD"}})}</div>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14,color:"#F2EDE4",lineHeight:1}}>Admin</div>
                <div style={{fontSize:10,color:"#7A8BA0",marginTop:3}}>{seasonName}</div>
              </div>
            </div>
            <div style={{marginTop:10,padding:"4px 10px",background:phaseColor[currentPhase]+"12",border:"1px solid "+phaseColor[currentPhase]+"33",borderRadius:6,fontSize:10,fontWeight:700,color:phaseColor[currentPhase],textAlign:"center"}}>{phaseLabel[currentPhase]}</div>
            {pendingHosts>0&&<div style={{marginTop:6,padding:"4px 10px",background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,fontSize:10,fontWeight:700,color:"#F87171",textAlign:"center",cursor:"pointer"}} onClick={function(){setTab("hosts");}}>{pendingHosts} pending host app{pendingHosts>1?"s":""}</div>}
          </div>

          {/* Nav Groups */}
          <div style={{flex:1,overflowY:"auto",padding:"8px 0",scrollbarWidth:"none"}}>
            {ADMIN_GROUPS.map(function(group){return(
              React.createElement("div",{key:group.label,style:{marginBottom:4}},
                React.createElement("div",{style:{padding:"8px 16px 4px",fontSize:10,fontWeight:700,color:"#5A6577",letterSpacing:".1em",textTransform:"uppercase"}},group.label),
                group.items.map(function(item){
                  var active=tab===item.id;
                  return React.createElement("button",{key:item.id,onClick:function(){setTab(item.id);},style:{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 16px",background:active?"rgba(155,114,207,.1)":"transparent",borderLeft:active?"3px solid #9B72CF":"3px solid transparent",border:"none",borderBottom:"none",borderTop:"none",borderRight:"none",color:active?"#C4B5FD":"#9AAABF",cursor:"pointer",fontSize:13,fontWeight:active?600:400,fontFamily:"inherit",transition:"all .12s",textAlign:"left"}},
                    React.createElement("i",{className:"ti ti-"+item.icon,style:{fontSize:16,width:20,textAlign:"center",flexShrink:0,opacity:active?1:.6}}),
                    React.createElement("span",{style:{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},item.label)
                  );
                })
              )
            );})}
          </div>

          {/* Sidebar Footer */}
          <div style={{padding:"12px 16px",borderTop:"1px solid rgba(242,237,228,.06)",fontSize:11,color:"#5A6577"}}>
            {React.createElement("i",{className:"ti ti-info-circle",style:{marginRight:5,fontSize:12}})}
            <span style={{lineHeight:1.4}}>{TAB_INFO[tab]||""}</span>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div style={{flex:1,minWidth:0,padding:"20px 24px",overflowY:"auto"}}>

          {/* Top bar with toggle + breadcrumb */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <button onClick={function(){setSidebarOpen(function(v){return !v;});}} style={{width:32,height:32,background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.08)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#9AAABF",flexShrink:0,fontFamily:"inherit",fontSize:16}}>{React.createElement("i",{className:"ti ti-"+(sidebarOpen?"layout-sidebar-left-collapse":"layout-sidebar-left-expand")})}</button>
            <div style={{flex:1,minWidth:0}}>
              <h2 style={{color:"#F2EDE4",fontSize:18,fontWeight:800,lineHeight:1,margin:0}}>{(ADMIN_GROUPS.reduce(function(found,g){return found||g.items.find(function(i){return i.id===tab;});},null)||{label:"Admin"}).label}</h2>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <div style={{padding:"5px 13px",background:phaseColor[currentPhase]+"1A",border:"1px solid "+phaseColor[currentPhase]+"44",borderRadius:20,fontSize:12,fontWeight:700,color:phaseColor[currentPhase]}}>{phaseLabel[currentPhase]}</div>
            </div>
          </div>



      {/* ── DASHBOARD ── */}

      {tab==="dashboard"&&(

        <div>

          {/* Stat cards with colored top bar */}
          <div className="admin-dash-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
            {[
              {label:"Players",value:players.length,color:"#E8A838",icon:"users",sub:players.filter(function(p){return p.role==="admin";}).length+" admin"},
              {label:"Checked In",value:players.filter(function(p){return p.checkedIn;}).length,color:"#52C47C",icon:"circle-check",sub:"of "+players.length+" total"},
              {label:"Banned",value:players.filter(function(p){return p.banned;}).length,color:"#F87171",icon:"ban",sub:players.filter(function(p){return(p.dnpCount||0)>0&&!p.banned;}).length+" with DNP"},
              {label:"Events",value:scheduledEvents.length,color:"#C4B5FD",icon:"calendar-event",sub:(quickClashes||[]).length+" quick clash"+(((quickClashes||[]).length!==1)?"es":"")},
            ].map(function(c){return(
              <div key={c.label} className="tbl-card tbl-stat" style={{"--stat-color":c.color}}>
                <div className="stat-icon" style={{background:c.color+"14",border:"1px solid "+c.color+"25"}}>{React.createElement("i",{className:"ti ti-"+c.icon,style:{color:c.color}})}</div>
                <div className="mono stat-value" style={{color:c.color}}>{c.value}</div>
                <div className="stat-label">{c.label}</div>
                <div style={{fontSize:11,color:"#5A6577",marginTop:6}}>{c.sub}</div>
              </div>
            );})}
          </div>

          {/* Quick actions */}
          <div className="tbl-card" style={{marginBottom:16}}>
            <div className="tbl-card-header">
              <h3>{React.createElement("i",{className:"ti ti-bolt",style:{color:"#9B72CF"}})}Quick Actions</h3>
              <Tag color={phaseColor[currentPhase]} size="sm">{phaseLabel[currentPhase]}</Tag>
            </div>
            <div className="tbl-card-body" style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="success" s="sm" onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,checkedIn:true})));setTournamentState(function(ts){return{...ts,checkedInIds:players.map(function(p){return String(p.id);})};});if(supabase.from){supabase.from('players').update({checked_in:true}).neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Check-in all sync failed:",r.error);});}addAudit("ACTION","Check In All");toast("All players checked in","success");}}>{React.createElement("i",{className:"ti ti-circle-check",style:{marginRight:4}})}Check In All</Btn>
              <Btn v="dark" s="sm" onClick={()=>{setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));setTournamentState(function(ts){return{...ts,checkedInIds:[]};});if(supabase.from){supabase.from('players').update({checked_in:false}).neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Check-out all sync failed:",r.error);});}addAudit("ACTION","Check Out All");toast("All players checked out","success");}}>{React.createElement("i",{className:"ti ti-circle-x",style:{marginRight:4}})}Clear Check-In</Btn>
              <Btn v={paused?"success":"warning"} s="sm" onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Round resumed":"Round paused");}}>{paused?<>{React.createElement("i",{className:"ti ti-player-play",style:{marginRight:4}})}Resume</>:<>{React.createElement("i",{className:"ti ti-player-pause",style:{marginRight:4}})}Pause</>}</Btn>
              <Btn v="dark" s="sm" onClick={()=>setTab("broadcast")}>{React.createElement("i",{className:"ti ti-speakerphone",style:{marginRight:4}})}Broadcast</Btn>
              <Btn v="dark" s="sm" onClick={()=>setTab("round")}>{React.createElement("i",{className:"ti ti-bolt",style:{marginRight:4}})}Round Controls</Btn>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="tbl-card">
            <div className="tbl-card-header">
              <h3>{React.createElement("i",{className:"ti ti-activity",style:{color:"#4ECDC4"}})}Recent Activity</h3>
              <Btn v="dark" s="sm" onClick={()=>setTab("audit")}>{React.createElement("i",{className:"ti ti-clipboard-data",style:{marginRight:4}})}Full Log</Btn>
            </div>
            {auditLog.length===0&&<div style={{padding:"40px 20px",textAlign:"center"}}>{React.createElement("i",{className:"ti ti-activity",style:{fontSize:36,color:"#374151",display:"block",marginBottom:10}})}<div style={{color:"#6b7280",fontSize:13}}>No activity yet</div></div>}
            <div style={{maxHeight:400,overflowY:"auto"}}>
            {auditLog.slice(0,15).map(function(l,i){
              var dotColor=l.type==="DANGER"?"#F87171":l.type==="WARN"?"#E8A838":l.type==="ACTION"?"#52C47C":l.type==="BROADCAST"?"#9B72CF":"#4ECDC4";
              return(
              <div key={i} className="tbl-timeline-item">
                <div className="tbl-timeline-dot" style={{background:dotColor}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <Tag color={AUDIT_COLS[l.type]||"#E8A838"} size="sm">{l.type}</Tag>
                    <span className="mono" style={{fontSize:10,color:"#6b7280"}}>{new Date(l.ts).toLocaleTimeString()}</span>
                  </div>
                  <div style={{fontSize:13,color:"#d1d5db",lineHeight:1.4}}>{l.msg}</div>
                </div>
              </div>
            );})}
            </div>
          </div>

        </div>

      )}



      {/* ── PLAYERS ── */}

      {tab==="players"&&(

        <div>

          {editP?(

            <div className="tbl-card" style={{marginBottom:16,borderLeft:"3px solid #9B72CF"}}>

              <div className="tbl-card-header">
                <h3>{React.createElement("i",{className:"ti ti-user-edit",style:{color:"#9B72CF"}})}Edit Player <span style={{fontWeight:400,color:"#9B72CF",marginLeft:4}}>{editP.name}</span></h3>
                <Btn v="dark" s="sm" onClick={()=>setEditP(null)}>{React.createElement("i",{className:"ti ti-arrow-left",style:{marginRight:4}})}← Back</Btn>
              </div>
              <div className="tbl-card-body">

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

                  <Btn v="primary" onClick={()=>{setPlayers(ps=>ps.map(p=>p.id===editP.id?editP:p));
// Sync edit to DB
if(supabase.from&&editP.id){supabase.from('players').update({username:editP.name,riot_id:editP.riotId,region:editP.region,rank:editP.rank,role:editP.role||'player'}).eq('id',editP.id).then(function(r){if(r.error)console.error("[TFT] Player edit sync failed:",r.error);});if(editP.auth_user_id&&editP.role){supabase.from('user_roles').upsert({user_id:editP.auth_user_id,role:editP.role}).then(function(r){if(r.error)console.error("[TFT] Role sync failed:",r.error);});}}
addAudit("ACTION","Edited: "+editP.name);setEditP(null);toast("Saved","success");}}>Save Changes</Btn>

                  <Btn v="dark" onClick={()=>setEditP(null)}>Cancel</Btn>

                </div>

              </div>

            </div>

          ):(

            <div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:13,color:"#d1d5db",fontWeight:500}}>{players.length} players</div>
                  <Tag color="#52C47C" size="sm">{players.filter(function(p){return p.checkedIn;}).length} checked in</Tag>
                  {players.filter(function(p){return p.banned;}).length>0&&<Tag color="#F87171" size="sm">{players.filter(function(p){return p.banned;}).length} banned</Tag>}
                </div>
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

              {players.length===0&&<div className="tbl-card" style={{padding:"48px 20px",textAlign:"center"}}>{React.createElement("i",{className:"ti ti-users",style:{fontSize:40,color:"#374151",display:"block",marginBottom:12}})}<div style={{color:"#6b7280",fontSize:14,fontWeight:500}}>No players yet</div><div style={{color:"#4b5563",fontSize:12,marginTop:4}}>Add your first player above</div></div>}

              {players.length>0&&(
              <div className="tbl-card" style={{overflow:"hidden"}}>
                <table className="tbl-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Rank</th>
                      <th>Points</th>
                      <th>Status</th>
                      <th style={{textAlign:"right"}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                  {players.map(function(p){return(
                    <tr key={p.id} style={{background:p.banned?"rgba(127,29,29,.08)":"transparent"}}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:32,height:32,borderRadius:8,background:p.banned?"rgba(248,113,113,.12)":p.checkedIn?"rgba(82,196,124,.1)":"rgba(155,114,207,.08)",border:"1px solid "+(p.banned?"rgba(248,113,113,.2)":p.checkedIn?"rgba(82,196,124,.2)":"rgba(155,114,207,.15)"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,fontWeight:700,color:p.banned?"#F87171":p.checkedIn?"#52C47C":"#9B72CF"}}>{p.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div style={{fontWeight:600,fontSize:13,color:p.banned?"#F87171":"#F2EDE4",display:"flex",alignItems:"center",gap:6}}>
                              {p.name}
                              {p.role!=="player"&&React.createElement(Tag,{color:"#9B72CF",size:"sm"},p.role)}
                            </div>
                            <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{p.riotId||"No Riot ID"}{p.notes?(" · "+p.notes.slice(0,30)+(p.notes.length>30?"...":"")):"" }</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize:12,color:"#d1d5db"}}>{p.rank}</span><br/><span style={{fontSize:10,color:"#6b7280"}}>{p.region||"EUW"}</span></td>
                      <td><span className="mono" style={{fontSize:14,fontWeight:700,color:"#E8A838"}}>{p.pts}</span><br/><span style={{fontSize:10,color:"#6b7280"}}>{p.games||0}G · {p.wins||0}W</span></td>
                      <td style={{whiteSpace:"nowrap"}}>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {p.banned&&React.createElement(Tag,{color:"#F87171",size:"sm"},(p.dnpCount||0)>=2?"DQ":"BANNED")}
                          {!p.banned&&(p.dnpCount||0)>0&&React.createElement(Tag,{color:"#F97316",size:"sm"},"DNP "+p.dnpCount+"/2")}
                          {p.checkedIn&&React.createElement(Tag,{color:"#52C47C",size:"sm"},"✓ In")}
                          {isComebackEligible(p,PAST_CLASHES.map(function(c){return "c"+c.id;}))&&React.createElement(Tag,{color:"#4ECDC4",size:"sm"},"Comeback")}
                          {(p.attendanceStreak||0)>=3&&React.createElement(Tag,{color:"#E8A838",size:"sm"},p.attendanceStreak+"-streak")}
                          {!p.banned&&!p.checkedIn&&(p.dnpCount||0)===0&&React.createElement("span",{style:{color:"#4b5563",fontSize:11}},"-")}
                        </div>
                      </td>
                      <td className="td-actions">
                        <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                          <Btn s="sm" v="dark" onClick={function(){setEditP(p);}}>Edit</Btn>
                          <Btn s="sm" v="ghost" onClick={function(){setNoteTarget(p);setNoteText(p.notes||"");}} title="Add internal note">{React.createElement("i",{className:"ti ti-pin",style:{fontSize:12}})}</Btn>
                          {!p.banned&&React.createElement(Btn,{s:"sm",v:"warning",onClick:function(){markDNP(p.id,p.name);},title:"Mark no-show (2 DNPs = DQ)"},"DNP")}
                          {(p.dnpCount||0)>0&&!p.banned&&React.createElement(Btn,{s:"sm",v:"dark",onClick:function(){clearDNP(p.id,p.name);},title:"Clear DNP count"},"↩")}
                          {p.banned?React.createElement(Btn,{s:"sm",v:"success",onClick:function(){unban(p.id,p.name);}},"Unban"):React.createElement(Btn,{s:"sm",v:"danger",onClick:function(){ban(p.id,p.name);}},"Ban")}
                          <Btn s="sm" v="danger" onClick={function(){remove(p.id,p.name);}} title="Remove permanently">{React.createElement("i",{className:"ti ti-trash",style:{fontSize:12}})}</Btn>
                        </div>
                      </td>
                    </tr>
                  );})}
                  </tbody>
                </table>
              </div>
              )}

            </div>

          )}

        </div>

      )}



      {/* ── SCORES ── */}

      {tab==="scores"&&(

        <div>

          {/* Warning banner */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"rgba(248,113,113,.06)",border:"1px solid rgba(248,113,113,.18)",borderRadius:10,marginBottom:16}}>
            {React.createElement("i",{className:"ti ti-alert-triangle",style:{fontSize:18,color:"#F87171",flexShrink:0}})}
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#F87171"}}>Danger Zone</div>
              <div style={{fontSize:12,color:"#BECBD9",marginTop:2}}>Score overrides are logged as DANGER in the audit trail. Leave blank to keep current value. Enter 0 to reset.</div>
            </div>
          </div>

          <Panel style={{overflow:"hidden",marginBottom:14,border:"1px solid rgba(248,113,113,.12)"}}>

            <div style={{padding:"12px 16px",background:"rgba(248,113,113,.04)",borderBottom:"1px solid rgba(248,113,113,.1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {React.createElement("i",{className:"ti ti-pencil",style:{fontSize:15,color:"#F87171"}})}
                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Season Points Override</div>
              </div>
              <div className="mono" style={{fontSize:11,color:"#BECBD9"}}>{Object.keys(scoreEdit).filter(function(k){return scoreEdit[k]!==undefined&&scoreEdit[k]!=="";}).length} pending changes</div>
            </div>

            {/* Column headers */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"8px 16px",borderBottom:"1px solid rgba(242,237,228,.06)",background:"rgba(0,0,0,.15)"}}>
              <span style={{flex:1,fontSize:10,fontWeight:700,color:"#5A6577",textTransform:"uppercase",letterSpacing:".08em"}}>Player</span>
              <span style={{width:70,fontSize:10,fontWeight:700,color:"#5A6577",textTransform:"uppercase",letterSpacing:".08em",textAlign:"right"}}>Current</span>
              <span style={{width:110,fontSize:10,fontWeight:700,color:"#5A6577",textTransform:"uppercase",letterSpacing:".08em",textAlign:"center"}}>New Value</span>
            </div>

            {players.map(function(p,idx){
              var hasChange=scoreEdit[p.id]!==undefined&&scoreEdit[p.id]!=="";
              return(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",background:hasChange?"rgba(248,113,113,.04)":"transparent",transition:"background .15s"}}>
                <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontWeight:600,fontSize:14,color:hasChange?"#F2EDE4":"#C8BFB0"}}>{p.name}</span>
                  {p.banned&&React.createElement(Tag,{color:"#F87171",size:"sm"},"BANNED")}
                </div>
                <span className="mono" style={{width:70,fontSize:14,color:"#E8A838",fontWeight:700,textAlign:"right"}}>{p.pts}</span>
                <div style={{width:110,flexShrink:0}}>
                  <Inp value={scoreEdit[p.id]!==undefined?scoreEdit[p.id]:""} onChange={function(v){setScoreEdit(function(e){return Object.assign({},e,{[p.id]:v});});}} placeholder={String(p.pts)} type="number"/>
                </div>
              </div>
            );})}

          </Panel>

          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <Btn v="danger" onClick={function(){var changeCount=Object.keys(scoreEdit).filter(function(k){return scoreEdit[k]!==undefined&&scoreEdit[k]!=="";}).length;if(changeCount===0){toast("No changes to apply","error");return;}if(!window.confirm("Apply "+changeCount+" score override"+(changeCount>1?"s":"")+"? This is logged as DANGER."))return;setPlayers(function(ps){return ps.map(function(p){var nv=scoreEdit[p.id];if(nv===undefined||nv==="")return p;addAudit("DANGER","Score override: "+p.name+" "+p.pts+" → "+nv);var parsed=parseInt(nv);return Object.assign({},p,{pts:isNaN(parsed)?p.pts:parsed});});});if(supabase.from){players.forEach(function(p){var nv=scoreEdit[p.id];if(nv===undefined||nv==="")return;var parsed=parseInt(nv);if(isNaN(parsed))return;supabase.from('players').update({season_pts:parsed}).eq('id',p.id).then(function(r){if(r.error)console.error("[TFT] Score sync failed for",p.name,r.error);});});}setScoreEdit({});toast("Score changes applied & synced to DB","success");}}>{React.createElement("i",{className:"ti ti-check",style:{marginRight:4}})}Apply Changes</Btn>
            <Btn v="dark" onClick={function(){setScoreEdit({});}}>Clear All</Btn>
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

            <div className="tbl-stepper" style={{borderRadius:8,overflow:"hidden",border:"1px solid rgba(128,150,172,.1)"}}>
              {["registration","checkin","inprogress","complete"].map(function(ph){
                var phases=["registration","checkin","inprogress","complete"];
                var ci=phases.indexOf(currentPhase);
                var pi=phases.indexOf(ph);
                var isDone=pi<ci;
                var isActive=ph===currentPhase;
                return React.createElement("div",{key:ph,className:"tbl-step"+(isActive?" active":"")+(isDone?" done":""),style:{"--step-color":phaseColor[ph],background:isActive?phaseColor[ph]+"0D":isDone?"rgba(82,196,124,.04)":"transparent"}},
                  React.createElement("div",{style:{fontSize:16,marginBottom:2}},isDone?React.createElement("i",{className:"ti ti-circle-check",style:{color:"#52C47C"}}):React.createElement("i",{className:"ti ti-"+(ph==="registration"?"user-plus":ph==="checkin"?"clipboard-check":ph==="inprogress"?"flame":"flag"),style:{color:isActive?phaseColor[ph]:"#4b5563"}})),
                  ph==="registration"?"Register":ph==="checkin"?"Check-in":ph==="inprogress"?"Live":"Complete"
                );
              })}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>

              <Btn v="primary" full disabled={currentPhase!=="registration"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"checkin",checkedInIds:ts.registeredIds&&ts.registeredIds.length>0?[...ts.registeredIds]:ts.checkedInIds||[]}));if(supabase.from&&tournamentState&&tournamentState.dbTournamentId){supabase.from('tournaments').update({phase:'check_in'}).eq('id',tournamentState.dbTournamentId).then(function(r){if(r.error)console.error("[TFT] Check-in phase sync failed:",r.error);});}addAudit("ACTION","Check-in opened  -  "+((tournamentState.registeredIds||[]).length)+" pre-registered players carried over");toast("Check-in is now open!","success");}}>Open Check-in</Btn>

              <Btn v="success" full disabled={currentPhase!=="checkin"} onClick={()=>{var games=parseInt(roundConfig.roundCount)||3;var cutL=parseInt(roundConfig.cutLine)||0;var cutG=parseInt(roundConfig.cutAfterGame)||0;setTournamentState(ts=>({...ts,phase:"inprogress",round:1,totalGames:games,lockedLobbies:[],savedLobbies:[],clashId:"c"+Date.now(),seedAlgo:seedAlgo||"rank-based",cutLine:cutL,cutAfterGame:cutG,maxPlayers:parseInt(roundConfig.maxPlayers)||24}));if(supabase.from){var existingId=tournamentState.dbTournamentId;if(existingId){supabase.from('tournaments').update({phase:'upcoming',format:cutL>0?'two_stage':'single_stage',round_count:games,seeding_method:seedAlgo||'snake'}).eq('id',existingId).then(function(r){if(r.error)console.error("[TFT] Failed to update tournament:",r.error);});}else{supabase.from('tournaments').insert({name:(tournamentState&&tournamentState.clashName)||'Clash',date:new Date().toISOString().split('T')[0],phase:'upcoming',format:cutL>0?'two_stage':'single_stage',max_players:parseInt(roundConfig.maxPlayers)||24,seeding_method:seedAlgo||'snake',round_count:games}).select().single().then(function(res){if(!res.error&&res.data){setTournamentState(function(ts){return Object.assign({},ts,{dbTournamentId:res.data.id});});}else if(res.error){console.error("[TFT] Failed to create tournament in DB:",res.error);}});}}addAudit("ACTION","Tournament started  -  "+games+" games"+(cutL>0?", cut at "+cutL+"pts after game "+cutG:""));toast("Tournament started! Bracket ready.","success");}}>Start Tournament</Btn>

              <Btn v="danger" full onClick={()=>{if(window.confirm("Reset tournament to registration?")){var oldId=tournamentState.dbTournamentId;setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],savedLobbies:[],checkedInIds:[],registeredIds:[],waitlistIds:[],maxPlayers:24});setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));if(supabase.from&&oldId){supabase.from('registrations').delete().eq('tournament_id',oldId).then(function(){});supabase.from('tournaments').update({phase:'cancelled'}).eq('id',oldId).then(function(){});}addAudit("DANGER","Tournament reset");toast("Tournament reset","success");}}}>Reset to Registration</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Round Controls</div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>

              <Btn v={paused?"success":"warning"} full onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Resumed":"Paused");}}>{paused?<>{React.createElement("i",{className:"ti ti-player-play",style:{marginRight:4}})}Resume Round</>:<>{React.createElement("i",{className:"ti ti-player-pause",style:{marginRight:4}})}Pause Round</>}</Btn>

              <Btn v="dark" full onClick={()=>{var nextRound=(tournamentState&&tournamentState.round||1)+1;var maxG=(tournamentState&&tournamentState.totalGames)||3;var willComplete=nextRound>maxG;setTournamentState(function(ts){if(!ts||ts.phase!=="inprogress")return ts;if(willComplete)return Object.assign({},ts,{phase:"complete"});return Object.assign({},ts,{round:nextRound,lockedLobbies:[],savedLobbies:[]});});if(supabase.from&&tournamentState&&tournamentState.dbTournamentId){supabase.from('tournaments').update({phase:willComplete?'complete':'in_progress'}).eq('id',tournamentState.dbTournamentId).then(function(r){if(r.error)console.error("[TFT] Force advance sync failed:",r.error);});}addAudit("ACTION","Force advance game"+(willComplete?" - tournament complete":""));toast("Force advancing","success");}}>Force Advance Game →</Btn>

              <Btn v="purple" full onClick={()=>{setTournamentState(function(ts){return Object.assign({},ts,{lockedLobbies:[],savedLobbies:[],seedAlgo:seedAlgo});});addAudit("ACTION","Reseeded - "+seedAlgo);toast("Lobbies reseeded","success");}}>Reseed Lobbies</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:6}}>Seeding Mode</div>

            <div style={{fontSize:12,color:"#9AAABF",marginBottom:16}}>Choose how players are distributed across lobbies. Applies when tournament starts or lobbies are reseeded.</div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>

              {[["random","Random","Fully shuffled, no weighting  -  great for casual events","arrows-shuffle"],["rank-based","By Rank","Top players spread evenly across lobbies for fair games","sort-descending"],["snake","Snake Draft","Alternating pick order  -  balances skill across lobbies","route"],["swiss","Swiss","Players matched by similar score each round  -  competitive fairness","tournament"]].map(function(item){

                var v=item[0];var l=item[1];var d=item[2];var icon=item[3];

                var active=seedAlgo===v;

                return(

                  <button key={v} onClick={function(){setSeedAlgo(v);}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"16px 14px",cursor:"pointer",textAlign:"center",fontFamily:"inherit",

                    background:active?"rgba(155,114,207,.12)":"rgba(255,255,255,.02)",

                    border:"2px solid "+(active?"#9B72CF":"rgba(242,237,228,.08)"),

                    borderRadius:10,

                    boxShadow:active?"0 0 16px rgba(155,114,207,.2)":"none",

                    transition:"all .15s"}}>

                    <span style={{fontSize:22}}>{React.createElement("i",{className:"ti ti-"+icon,style:{color:active?"#C4B5FD":"#7A8BA0"}})}</span>

                    <span style={{fontSize:13,fontWeight:700,color:active?"#C4B5FD":"#C8BFB0"}}>{l}</span>

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

              <span style={{fontSize:16}}>{React.createElement("i",{className:"ti ti-circle-x",style:{color:"#F87171"}})}</span>

              <span style={{fontSize:13,fontWeight:seedAlgo==="anti-stack"?700:500,color:seedAlgo==="anti-stack"?"#F87171":"#C8BFB0",flex:1}}>Anti-Stack</span>

              <span style={{fontSize:11,color:"#7A8BA0"}}>Prevents friend groups from stacking same lobby</span>

              {seedAlgo==="anti-stack"&&<span style={{fontSize:10,fontWeight:700,color:"#F87171",background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.25)",borderRadius:4,padding:"2px 8px"}}>SELECTED</span>}

            </button>

          </Panel>

          <Panel style={{padding:"20px",gridColumn:"1/-1"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:8}}>Quick Clash Setup</div>

            <div style={{fontSize:12,color:"#9AAABF",marginBottom:12}}>One-click presets  -  fills Max Players and Round Count below.</div>

            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:0}}>

              {[["3 Games \xb7 24p","24","3","0","0"],["3 Games \xb7 16p","16","3","0","0"],["5 Games \xb7 24p","24","5","0","0"],["6 Games \xb7 128p (Cut at 4)","128","6","13","4"]].map(function(preset){return(

                <button key={preset[0]} onClick={function(){setRoundConfig(function(c){return Object.assign({},c,{maxPlayers:preset[1],roundCount:preset[2],cutLine:preset[3],cutAfterGame:preset[4]});});if(preset[3]!=="0"){toast("Preset loaded: "+preset[0]+"  -  cut line: "+preset[3]+"pts after game "+preset[4],"success");}else{toast("Preset loaded: "+preset[0],"success");}}} style={{padding:"7px 14px",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.3)",color:"#C4B5FD",transition:"all .15s"}} onMouseEnter={function(e){e.currentTarget.style.background="rgba(155,114,207,.2)";}} onMouseLeave={function(e){e.currentTarget.style.background="rgba(155,114,207,.1)";}}>

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

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Games</label><Sel value={roundConfig.roundCount} onChange={v=>setRoundConfig(c=>Object.assign({},c,{roundCount:v}))}><option value="2">2 Games</option><option value="3">3 Games</option><option value="4">4 Games</option><option value="5">5 Games</option><option value="6">6 Games</option></Sel></div>

              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Check-in Window</label><Sel value={roundConfig.checkinWindowMins} onChange={v=>setRoundConfig(c=>Object.assign({},c,{checkinWindowMins:v}))}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></Sel></div>

            </div>

            <div style={{marginTop:14,padding:"14px",background:"rgba(232,168,56,.04)",border:"1px solid rgba(232,168,56,.15)",borderRadius:8}}>

              <div style={{fontWeight:700,fontSize:13,color:"#E8A838",marginBottom:10}}>Cut Line (Elimination)</div>

              <div style={{fontSize:12,color:"#BECBD9",marginBottom:12,lineHeight:1.5}}>Players at or below this point threshold after the specified game are eliminated. Set to 0 to disable.</div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Cut After Game #</label><Sel value={roundConfig.cutAfterGame||"0"} onChange={v=>setRoundConfig(c=>Object.assign({},c,{cutAfterGame:v}))}><option value="0">No Cut</option><option value="2">After Game 2</option><option value="3">After Game 3</option><option value="4">After Game 4</option><option value="5">After Game 5</option></Sel></div>

                <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Min Points to Advance</label><Inp type="number" value={roundConfig.cutLine||""} onChange={v=>setRoundConfig(c=>Object.assign({},c,{cutLine:v}))} placeholder="14"/></div>

              </div>

              {roundConfig.cutAfterGame&&parseInt(roundConfig.cutAfterGame)>0&&parseInt(roundConfig.cutLine)>0&&(
                <div style={{marginTop:10,padding:"8px 12px",background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.15)",borderRadius:6,fontSize:12,color:"#4ECDC4",lineHeight:1.5}}>
                  Players with {roundConfig.cutLine} pts or fewer after Game {roundConfig.cutAfterGame} will be eliminated. You need at least {parseInt(roundConfig.cutLine)+1} pts to advance.
                </div>
              )}

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

                <div style={{width:38,height:38,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{React.createElement("i",{className:"ti ti-dice-5"})}</div>

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

              <Btn v="primary" full onClick={()=>{if(!flashForm.name.trim())return;var ev={id:Date.now(),name:flashForm.name.trim(),cap:parseInt(flashForm.cap),rounds:parseInt(flashForm.rounds),format:flashForm.format,status:"open",players:[],startedAt:null,createdAt:new Date().toLocaleTimeString()};setQuickClashes&&setQuickClashes(function(qs){return [ev,...qs];});addAudit("ACTION","Quick Clash created: "+flashForm.name);toast(flashForm.name+" is open  -  "+flashForm.cap+" spots","success");setFlashForm({name:"Flash Clash",cap:"8",rounds:"2",format:"Single Lobby"});}}>Open Quick Clash</Btn>

            </div>

          </Panel>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            <div style={{fontSize:11,fontWeight:700,color:"#9AAABF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:2}}>Active Quick Clashes</div>

            {(!quickClashes||quickClashes.length===0)&&(

              <Panel style={{padding:"44px",textAlign:"center"}}>

                <div style={{width:52,height:52,background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.15)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>{React.createElement("i",{className:"ti ti-bolt",style:{fontSize:24,color:"#9B72CF"}})}</div>

                <div style={{color:"#9AAABF",fontSize:13,fontWeight:600}}>No quick clashes active</div>

                <div style={{color:"#5A6577",fontSize:11,marginTop:4}}>Create one using the form</div>

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

              <Btn v="primary" full onClick={()=>{if(!newEvent.name||!newEvent.date){toast("Name and date required","error");return;}var evObj={...newEvent,id:Date.now(),status:"upcoming",cap:parseInt(newEvent.cap)||8};setScheduledEvents(es=>[...es,evObj]);if(supabase.from){supabase.from('scheduled_events').insert({name:newEvent.name,type:newEvent.type||'SCHEDULED',format:newEvent.format||'Swiss',date:newEvent.date,time:newEvent.time||'',cap:parseInt(newEvent.cap)||8,status:'upcoming',created_by:currentUser?currentUser.id:null}).select().single().then(function(r){if(r.error){console.error("[TFT] Schedule event insert failed:",r.error);}else if(r.data){setScheduledEvents(function(es){return es.map(function(e){return e.id===evObj.id?Object.assign({},e,{id:r.data.id}):e;});});}});}addAudit("ACTION","Scheduled: "+newEvent.name);setNewEvent({name:"",type:"SCHEDULED",date:"",time:"",cap:"8",format:"Swiss",notes:""});toast("Event scheduled","success");}}>Schedule Event</Btn>

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

                  <Btn s="sm" v="danger" onClick={()=>{setScheduledEvents(es=>es.filter(e=>e.id!==ev.id));if(supabase.from&&ev.id){supabase.from('scheduled_events').delete().eq('id',ev.id).then(function(r){if(r.error)console.error("[TFT] Event cancel sync failed:",r.error);});}addAudit("ACTION","Cancelled: "+ev.name);}}>Cancel</Btn>

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

            <Btn v="primary" s="sm" onClick={()=>{if(supabase.from&&seasonConfig&&seasonConfig.seasonId){supabase.from('seasons').update({name:seasonName}).eq('id',seasonConfig.seasonId).then(function(r){if(r.error)console.error("[TFT] Season rename sync failed:",r.error);});}else if(supabase.from){supabase.from('site_settings').upsert({key:'season_name',value:JSON.stringify(seasonName),updated_at:new Date().toISOString()}).then(function(r){if(r.error)console.error("[TFT] Season name setting sync failed:",r.error);});}addAudit("ACTION","Season renamed: "+seasonName);toast("Season name saved","success");}}>Save Name</Btn>

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

              <Btn v="primary" s="sm" onClick={()=>{if(supabase.from){supabase.from('site_settings').upsert({key:'season_health_rules',value:JSON.stringify(seasonConfig||{}),updated_at:new Date().toISOString()}).then(function(r){if(r.error)console.error("[TFT] Health rules sync failed:",r.error);});}addAudit("ACTION","Season health rules updated");toast("Health rules saved","success");}}>Save Rules</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px",border:"1px solid rgba(155,114,207,.2)",gridColumn:"1/-1"}}>

            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>

              <span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-calendar-event"})}</span>

              <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Season Lifecycle</div>

            </div>

            <div style={{fontSize:12,color:"#C8D4E0",marginBottom:16,lineHeight:1.5}}>Create a new season in the database or end the current one. Ending a season snapshots all player stats and creates a new season record.</div>

            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>

              <Btn v="primary" onClick={function(){
                var name=window.prompt("New season name:","Season "+(parseInt((seasonName||"Season 1").replace(/\D/g,""))||1));
                if(!name)return;
                if(supabase.from){
                  supabase.from('seasons').insert({name:name,number:Date.now()%10000,status:'active',start_date:new Date().toISOString().split('T')[0]}).select().single()
                    .then(function(res){
                      if(res.error){toast("Failed to create season: "+res.error.message,"error");return;}
                      setSeasonConfig(function(c){return Object.assign({},c,{seasonId:res.data.id});});
                      setSeasonName(name);
                      addAudit("ACTION","New season created: "+name+" (id: "+res.data.id+")");
                      toast("Season '"+name+"' created!","success");
                    });
                }else{
                  setSeasonName(name);
                  toast("Season renamed to "+name,"success");
                }
              }}>Create New Season</Btn>

              <Btn v="dark" onClick={function(){
                if(!window.confirm("End the current season? This will snapshot all stats and mark the season as completed."))return;
                if(supabase.from&&seasonConfig&&seasonConfig.seasonId){
                  // Snapshot player stats into standings JSONB column
                  var sorted=[...players].sort(function(a,b){return b.pts-a.pts;});
                  var standingsData=sorted.map(function(p,idx){return{player_id:p.id,username:p.name||p.username,pts:p.pts||0,wins:p.wins||0,top4:p.top4||0,games:p.games||0,avg_placement:parseFloat(p.avg)||0,final_rank:idx+1};});
                  supabase.from('season_snapshots').insert({season_id:seasonConfig.seasonId,week_number:0,standings:standingsData,snapshot_date:new Date().toISOString().split('T')[0]}).then(function(r){if(r.error)console.error("[TFT] snapshot insert failed:",r.error);});
                  // Mark season complete
                  supabase.from('seasons').update({status:'completed',end_date:new Date().toISOString().split('T')[0]}).eq('id',seasonConfig.seasonId)
                    .then(function(r){if(r.error)console.error("[TFT] season end failed:",r.error);});
                  addAudit("ACTION","Season ended: "+(seasonName||"Season")+"  -  "+players.length+" players snapshotted");
                  toast("Season ended. Stats snapshotted.","success");
                }else{
                  toast("No active season found in database","error");
                }
              }}>End Current Season</Btn>

            </div>

          </Panel>

          <Panel danger style={{padding:"20px",border:"1px solid rgba(248,113,113,.25)",gridColumn:"1/-1"}}>

            <div style={{marginTop:6}}>

              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>

                <span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-alert-triangle",style:{color:"#E8A838"}})}</span>

                <div style={{fontWeight:700,fontSize:14,color:"#F87171"}}>Danger Zone</div>

              </div>

              <div style={{fontSize:12,color:"#C8D4E0",marginBottom:16,lineHeight:1.5}}>These actions are permanent and cannot be undone. All are logged to Audit.</div>

              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>

                <Btn v="danger" onClick={()=>{if(window.confirm("Reset ALL player stats? Points, wins, and games will be zeroed. This syncs to the database.")){setPlayers(ps=>ps.map(p=>({...p,pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,clashHistory:[],sparkline:[],attendanceStreak:0,lastClashId:null})));if(supabase.from){supabase.from('game_results').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear game_results:",r.error);});}addAudit("DANGER","Stats reset");toast("All stats reset and synced","success");}}}>Reset Season Stats</Btn>

                <Btn v="danger" onClick={()=>{if(window.confirm("Remove ALL players from the roster? This syncs to the database.")){setPlayers([]);if(supabase.from){supabase.from('players').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear players table:",r.error);});}addAudit("DANGER","Players cleared");toast("All players removed","success");}}}>Clear All Players</Btn>

                <Btn v="danger" onClick={()=>{if(window.confirm("Full season reset? Clears ALL players, stats, history, events, featured events, and tournament state. This is a complete wipe. Syncs to database.")){setPlayers([]);setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[]});setScheduledEvents([]);setFeaturedEvents([]);if(supabase.from){supabase.from('players').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear players table:",r.error);});supabase.from('game_results').delete().neq('id','00000000-0000-0000-0000-000000000000').then(function(r){if(r.error)console.error("[TFT] Failed to clear game_results:",r.error);});}setAuditLog([{ts:Date.now(),type:"DANGER",msg:"Full season reset  -  all players, stats, events, and featured events cleared"}]);toast("Full season reset complete","success");}}}>Full Season Reset</Btn>

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

                <Inp value={broadMsg} onChange={setBroadMsg} placeholder="e.g. Clash starts in 10 min  -  check in now!"/>

              </div>

              <Btn v="primary" full onClick={()=>{if(!broadMsg.trim())return;var cleanMsg=sanitize(broadMsg.trim());const a={id:Date.now(),type:broadType,msg:cleanMsg,ts:Date.now()};setAnnouncements(as=>[a,...as]);setAnnouncement(cleanMsg);if(supabase.from)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(cleanMsg),updated_at:new Date().toISOString()}).then(function(res){if(res.error)console.error("[TFT] Broadcast save failed:",res.error);});addAudit("BROADCAST","["+broadType+"] "+cleanMsg);setBroadMsg("");toast("Broadcast sent","success");}}>Send Broadcast</Btn>

            </div>

          </Panel>

          <Panel style={{padding:"20px"}}>

            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Active Announcements</div>

            {announcements.length===0&&<div style={{textAlign:"center",padding:"36px 0"}}>{React.createElement("i",{className:"ti ti-speakerphone",style:{fontSize:32,color:"#5A6577",display:"block",marginBottom:10}})}<div style={{color:"#9AAABF",fontSize:13}}>No active announcements</div><div style={{color:"#5A6577",fontSize:11,marginTop:4}}>Send one using the form</div></div>}

            {announcements.map(a=>(

              <div key={a.id} className="ann-item" style={{marginBottom:8,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>

                <div style={{flex:1,minWidth:0}}>

                  <Tag color="#E8A838" size="sm">{a.type}</Tag>

                  <div style={{fontSize:13,color:"#C8BFB0",marginTop:7,lineHeight:1.4}}>{a.msg}</div>

                </div>

                <Btn v="danger" s="sm" onClick={function(){setAnnouncements(function(as){return as.filter(function(x){return x.id!==a.id;});});setAnnouncement("");if(supabase.from)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(''),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});}}>{React.createElement("i",{className:"ti ti-x",style:{fontSize:12}})}</Btn>

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

            <Btn v="primary" s="sm" onClick={function(){setScreen("featured");}}>{React.createElement("i",{className:"ti ti-trophy",style:{fontSize:12,marginRight:4}})}Featured Events</Btn>

          </div>

          {hostApps.length===0&&<Panel style={{padding:"40px",textAlign:"center"}}>{React.createElement("i",{className:"ti ti-device-gamepad-2",style:{fontSize:36,color:"#5A6577",display:"block",marginBottom:10}})}<div style={{color:"#9AAABF",fontSize:14}}>No host applications yet</div><div style={{color:"#5A6577",fontSize:12,marginTop:4}}>Applications from the Pricing page will appear here</div></Panel>}

          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {hostApps.map(app=>(

              <Panel key={app.id} style={{padding:"18px",border:"1px solid "+(app.status==="pending"?"rgba(232,168,56,.2)":app.status==="approved"?"rgba(82,196,124,.18)":"rgba(248,113,113,.15)")}}>

                <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>

                  <div style={{flex:1,minWidth:0}}>

                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>

                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{app.name}</span>

                      {app.org&&<Tag color="#9B72CF" size="sm">{app.org}</Tag>}

                      <Tag color={app.status==="pending"?"#E8A838":app.status==="approved"?"#6EE7B7":"#F87171"} size="sm">{app.status==="pending"?"Pending":app.status==="approved"?"Approved":"Rejected"}</Tag>

                    </div>

                    <div style={{fontSize:12,color:"#BECBD9",marginBottom:10}}>{app.email} · {app.freq} · Applied {app.submittedAt}</div>

                    <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.65,padding:"10px 14px",background:"rgba(255,255,255,.02)",borderRadius:8,border:"1px solid rgba(242,237,228,.06)"}}>{app.reason}</div>

                  </div>

                  {app.status==="pending"&&(

                    <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>

                      <Btn v="success" s="sm" onClick={()=>{setHostApps(apps=>apps.map(a=>a.id===app.id?{...a,status:"approved",approvedAt:new Date().toLocaleDateString()}:a));if(supabase.from&&app.id){supabase.from('host_applications').update({status:'approved',approved_at:new Date().toISOString()}).eq('id',app.id).then(function(r){if(r.error)console.error("[TFT] Host approve sync failed:",r.error);});if(app.userId){supabase.from('user_roles').upsert({user_id:app.userId,role:'host'}).then(function(r){if(r.error)console.error("[TFT] Host role assign failed:",r.error);});}}setNotifications(ns=>[{id:Date.now(),icon:"controller",title:"Host Application Approved",body:app.name+" has been approved as a Host. They can now access the Host Dashboard.",time:new Date().toLocaleTimeString(),read:false},...ns]);addAudit("ACTION","Host approved: "+app.name);toast(app.name+" approved as host","success");}}>Approve</Btn>

                      <Btn v="danger" s="sm" onClick={()=>{setHostApps(apps=>apps.map(a=>a.id===app.id?{...a,status:"rejected"}:a));if(supabase.from&&app.id){supabase.from('host_applications').update({status:'rejected'}).eq('id',app.id).then(function(r){if(r.error)console.error("[TFT] Host reject sync failed:",r.error);});}addAudit("WARN","Host rejected: "+app.name);toast(app.name+" rejected","success");}}>Reject</Btn>

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


                    <Btn v="danger" s="sm" onClick={()=>{var updated=Object.assign({},orgSponsors);delete updated[pid];setOrgSponsors&&setOrgSponsors(function(){return updated;});if(supabase.from){supabase.from('site_settings').upsert({key:'org_sponsors',value:JSON.stringify(updated),updated_at:new Date().toISOString()}).then(function(r){if(r.error)console.error("[TFT] Sponsor remove sync failed:",r.error);});}addAudit("ACTION","Sponsor removed: "+s.org);toast(s.org+" removed","success");}}>Remove</Btn>

                  </div>

                </Panel>

              );

            })}

          </div>

          <Panel style={{padding:"20px",border:"1px solid rgba(155,114,207,.2)"}}>

            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>{React.createElement("i",{className:"ti ti-plus",style:{fontSize:15,color:"#C4B5FD"}})}<div style={{fontWeight:700,fontSize:14,color:"#C4B5FD"}}>Add New Sponsorship</div></div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Org Name</div><Inp value={spForm.name} onChange={v=>setSpForm(f=>Object.assign({},f,{name:v}))} placeholder="e.g. ProGuides"/></div>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Logo Text</div><Inp value={spForm.logo} onChange={v=>setSpForm(f=>Object.assign({},f,{logo:v}))} placeholder="e.g. PG"/></div>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Accent Colour</div><Inp value={spForm.color} onChange={v=>setSpForm(f=>Object.assign({},f,{color:v}))} placeholder="#4ECDC4"/></div>

              <div><div style={{fontSize:11,fontWeight:700,color:"#C8D4E0",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>Assign to Player</div><Sel value={spForm.playerId} onChange={v=>setSpForm(f=>Object.assign({},f,{playerId:v}))}><option value=""> -  Select Player  - </option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Sel></div>

            </div>

            <Btn v="primary" onClick={()=>{if(!spForm.name.trim()||!spForm.playerId){toast("Org name and player required","error");return;}var updated=Object.assign({},orgSponsors||{});updated[spForm.playerId]={org:spForm.name.trim(),logo:spForm.logo.trim()||spForm.name.trim().slice(0,2).toUpperCase(),color:spForm.color.trim()||"#9B72CF"};setOrgSponsors&&setOrgSponsors(function(){return updated;});if(supabase.from){supabase.from('site_settings').upsert({key:'org_sponsors',value:JSON.stringify(updated),updated_at:new Date().toISOString()}).then(function(r){if(r.error)console.error("[TFT] Sponsor add sync failed:",r.error);});}addAudit("ACTION","Sponsor added: "+spForm.name.trim());toast(spForm.name.trim()+" sponsorship added","success");setSpForm({name:"",logo:"",color:"",playerId:""});}}>Add Sponsorship</Btn>

          </Panel>

        </div>

      )}



      {/* ── AUDIT ── */}

      {tab==="audit"&&(

        <div className="tbl-card">

          <div className="tbl-card-header">

            <h3>{React.createElement("i",{className:"ti ti-clipboard-data",style:{color:"#9B72CF"}})}Audit Log</h3>

            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>

              <div style={{display:"flex",gap:0,marginRight:8,borderRadius:6,overflow:"hidden",border:"1px solid rgba(242,237,228,.1)"}}>
                {["session","database"].map(function(src){return(
                  React.createElement("button",{key:src,onClick:function(){setAuditSource(src);if(src==="database")loadDbAudit();},style:{padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:auditSource===src?"rgba(155,114,207,.25)":"rgba(255,255,255,.03)",border:"none",color:auditSource===src?"#C4B5FD":"#7A8BA0",textTransform:"uppercase",letterSpacing:".04em"}},src==="session"?"Session":"Database")
                );})}
              </div>

              {["All","ACTION","DANGER","BROADCAST","WARN","INFO","RESULT"].map(function(ft){return(

                <button key={ft} onClick={function(){setAuditFilter(ft);}} style={{padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:auditFilter===ft?"rgba(155,114,207,.2)":"rgba(255,255,255,.04)",border:"1px solid "+(auditFilter===ft?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),color:auditFilter===ft?"#C4B5FD":"#9AAABF",transition:"all .12s"}}>{ft}</button>

              );

              })}

              <span className="mono" style={{fontSize:11,color:"#BECBD9",marginLeft:4}}>{auditSource==="session"?(auditFilter==="All"?auditLog:auditLog.filter(function(l){return l.type===auditFilter;})).length+" entries":dbAuditEntries.length+" DB entries"}</span>

            </div>

          </div>

          {auditSource==="session"&&auditLog.length===0&&<div style={{padding:"36px",textAlign:"center",color:"#9AAABF",fontSize:13}}>No audit entries yet.</div>}

          {auditSource==="database"&&dbAuditEntries.length===0&&<div style={{padding:"36px",textAlign:"center",color:"#9AAABF",fontSize:13}}>No database audit entries. Click "Database" to refresh.</div>}

          <div style={{maxHeight:540,overflowY:"auto"}}>

            {auditSource==="session"&&(auditFilter==="All"?auditLog:auditLog.filter(function(l){return l.type===auditFilter;})).map(function(l,i){

              var bc=l.type==="DANGER"?"#F87171":l.type==="BROADCAST"?"#9B72CF":l.type==="WARN"?"#E8A838":l.type==="INFO"?"#4ECDC4":"rgba(242,237,228,.08)";

              return(

                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",borderLeft:"3px solid "+bc}}>

                  <Tag color={AUDIT_COLS[l.type]||"#E8A838"} size="sm">{l.type}</Tag>

                  <span style={{flex:1,fontSize:13,color:"#C8BFB0"}}>{l.msg}</span>

                  <span className="mono" style={{fontSize:10,color:"#9AAABF",whiteSpace:"nowrap",flexShrink:0}}>{new Date(l.ts).toLocaleString()}</span>

                </div>

              );

            })}

            {auditSource==="database"&&dbAuditEntries.map(function(entry,i){

              var actionType=entry.action||"ACTION";
              var bc=actionType==="DANGER"?"#F87171":actionType==="BROADCAST"?"#9B72CF":actionType==="WARN"?"#E8A838":actionType==="INFO"?"#4ECDC4":"rgba(242,237,228,.08)";
              var msg=(entry.details&&entry.details.message)?entry.details.message:(entry.action+(entry.target_id?" on "+entry.target_id:""));

              return(

                <div key={entry.id||i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",borderLeft:"3px solid "+bc}}>

                  <Tag color={AUDIT_COLS[actionType]||"#E8A838"} size="sm">{actionType}</Tag>

                  <span style={{fontSize:11,color:"#9B72CF",fontWeight:600,flexShrink:0}}>{entry.actor_name||"System"}</span>

                  <span style={{flex:1,fontSize:13,color:"#C8BFB0"}}>{msg}</span>

                  <span className="mono" style={{fontSize:10,color:"#9AAABF",whiteSpace:"nowrap",flexShrink:0}}>{entry.created_at?new Date(entry.created_at).toLocaleString():""}</span>

                </div>

              );

            })}

          </div>

        </div>

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

          <div className="tbl-card">
            <div className="tbl-card-header"><h3>{React.createElement("i",{className:"ti ti-shield-lock",style:{color:"#E8A838"}})}Role Permissions</h3></div>
            <div className="tbl-card-body">

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

          </div></div>

          <div className="tbl-card">
            <div className="tbl-card-header"><h3>{React.createElement("i",{className:"ti ti-rocket",style:{color:"#9B72CF"}})}Admin Quickstart</h3></div>
            <div className="tbl-card-body">

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

          </div></div>

        </div>

      )}



      {tab==="featured"&&(function(){
        var evts=featuredEvents||[];
        var feAddName=null;var feAddHost=null;var feAddDate=null;var feAddStatus=null;var feAddFormat=null;var feAddSize=null;
        return(
        <div>
          <Panel style={{overflow:"hidden",marginBottom:16}}>
            <div style={{padding:"12px 16px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {React.createElement("i",{className:"ti ti-star",style:{fontSize:15,color:"#E8A838"}})}
                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Featured Events</div>
              </div>
              <Tag color="#E8A838" size="sm">{evts.length} event{evts.length!==1?"s":""}</Tag>
            </div>
            <div style={{display:"flex",flexDirection:"column"}}>
              {evts.map(function(ev,idx){return(
                <div key={ev.id||idx} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid rgba(242,237,228,.04)"}}>
                  <div style={{width:36,height:36,background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{React.createElement("i",{className:"ti ti-trophy",style:{fontSize:16,color:"#E8A838"}})}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#BECBD9",marginTop:2}}>{ev.host} · {ev.date} · <Tag color={ev.status==="live"?"#52C47C":ev.status==="upcoming"?"#E8A838":"#9AAABF"} size="sm">{ev.status}</Tag></div>
                  </div>
                  <Btn v="danger" s="sm" onClick={function(){if(setFeaturedEvents)setFeaturedEvents(evts.filter(function(e){return e.id!==ev.id;}));toast("Event removed","success");}}>Remove</Btn>
                </div>
              );})}
              {evts.length===0&&<div style={{textAlign:"center",padding:"40px 0"}}>{React.createElement("i",{className:"ti ti-star",style:{fontSize:36,color:"#5A6577",display:"block",marginBottom:10}})}<div style={{color:"#9AAABF",fontSize:13}}>No featured events yet</div><div style={{color:"#5A6577",fontSize:12,marginTop:4}}>Add community tournaments and partner events below</div></div>}
            </div>
          </Panel>

          <Panel style={{padding:"20px",border:"1px solid rgba(232,168,56,.12)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              {React.createElement("i",{className:"ti ti-plus",style:{fontSize:15,color:"#E8A838"}})}
              <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>Add Featured Event</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Event Name</label><input ref={function(el){feAddName=el;}} placeholder="Tournament name..." style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 12px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Host</label><input ref={function(el){feAddHost=el;}} placeholder="Host org..." style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 12px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Date</label><input ref={function(el){feAddDate=el;}} placeholder="Mar 22 2026" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 12px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Status</label><select ref={function(el){feAddStatus=el;}} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 12px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></div>
              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Format</label><input ref={function(el){feAddFormat=el;}} defaultValue="Swiss" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 12px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
              <div><label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Size</label><input ref={function(el){feAddSize=el;}} type="number" defaultValue="16" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(242,237,228,.1)",borderRadius:7,padding:"8px 12px",color:"#F2EDE4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/></div>
            </div>
            <Btn v="primary" onClick={function(){
              var nm=feAddName&&feAddName.value;var ho=feAddHost&&feAddHost.value;var dt=feAddDate&&feAddDate.value;
              if(!nm||!ho){toast("Name and host required","error");return;}
              var newEv={id:"fe-"+Date.now(),name:nm,host:ho,date:dt||"TBD",status:(feAddStatus&&feAddStatus.value)||"upcoming",format:(feAddFormat&&feAddFormat.value)||"Swiss",size:parseInt((feAddSize&&feAddSize.value)||"16")||16,registered:0,logo:"trophy-fill",tags:[],description:""};
              if(setFeaturedEvents)setFeaturedEvents(evts.concat([newEv]));
              if(feAddName)feAddName.value="";if(feAddHost)feAddHost.value="";if(feAddDate)feAddDate.value="";
              toast("Event added","success");
            }}>{React.createElement("i",{className:"ti ti-plus",style:{marginRight:4}})}Add Event</Btn>
          </Panel>
        </div>
        );
      })()}

      {tab==="flash"&&(
        <div>
          <Panel style={{padding:"20px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              {React.createElement("i",{className:"ti ti-tournament",style:{fontSize:18,color:"#9B72CF"}})}
              <div style={{fontWeight:700,fontSize:16,color:"#F2EDE4"}}>Create Flash Tournament</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Tournament Name</label>
                <Inp value={flashForm.name} onChange={function(v){setFlashForm(Object.assign({},flashForm,{name:v}));}} placeholder="Flash Tournament #1"/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Date & Time</label>
                <Inp value={flashForm.date} onChange={function(v){setFlashForm(Object.assign({},flashForm,{date:v}));}} placeholder="2026-04-01T20:00" type="datetime-local"/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Max Players</label>
                <Inp type="number" value={flashForm.maxPlayers} onChange={function(v){setFlashForm(Object.assign({},flashForm,{maxPlayers:v}));}} placeholder="128"/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Game Count</label>
                <Inp type="number" value={flashForm.gameCount} onChange={function(v){setFlashForm(Object.assign({},flashForm,{gameCount:v}));}} placeholder="3"/>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Format Preset</label>
                <Sel value={flashForm.formatPreset} onChange={function(v){setFlashForm(Object.assign({},flashForm,{formatPreset:v}));}}><option value="casual">Casual</option><option value="standard">Standard</option><option value="competitive">Competitive (128p)</option></Sel>
              </div>
              <div>
                <label style={{display:"block",fontSize:11,color:"#C8D4E0",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Seeding Method</label>
                <Sel value={flashForm.seedingMethod} onChange={function(v){setFlashForm(Object.assign({},flashForm,{seedingMethod:v}));}}><option value="snake">Snake Seeding</option><option value="random">Random</option><option value="rank-based">Rank-Based</option></Sel>
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <label style={{fontSize:11,color:"#C8D4E0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Prize Pool</label>
                <Btn v="dark" s="sm" onClick={function(){setFlashForm(Object.assign({},flashForm,{prizeRows:flashForm.prizeRows.concat([{placement:String(flashForm.prizeRows.length+1),prize:""}])}));}}>+ Add Prize</Btn>
              </div>
              {flashForm.prizeRows.map(function(row,idx){
                return(
                  <div key={idx} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
                    <div style={{fontSize:12,color:"#E8A838",fontWeight:700,width:30,textAlign:"center"}}>#{row.placement}</div>
                    <div style={{flex:1}}><Inp value={row.prize} onChange={function(v){var updated=flashForm.prizeRows.map(function(r,i){return i===idx?Object.assign({},r,{prize:v}):r;});setFlashForm(Object.assign({},flashForm,{prizeRows:updated}));}} placeholder="e.g. $50, RP, Skin code..."/></div>
                    {flashForm.prizeRows.length>1&&(
                      <Btn v="danger" s="sm" onClick={function(){setFlashForm(Object.assign({},flashForm,{prizeRows:flashForm.prizeRows.filter(function(_,i){return i!==idx;})}));}}>X</Btn>
                    )}
                  </div>
                );
              })}
            </div>

            <Btn v="primary" onClick={function(){
              if(!flashForm.name.trim()){toast("Tournament name required","error");return;}
              if(!flashForm.date){toast("Date/time required","error");return;}
              var preset=TOURNAMENT_FORMATS[flashForm.formatPreset]||TOURNAMENT_FORMATS.standard;
              var prizePool=flashForm.prizeRows.filter(function(r){return r.prize.trim();}).map(function(r){return{placement:parseInt(r.placement),prize:r.prize.trim()};});
              supabase.from('tournaments').insert({
                name:flashForm.name.trim(),
                date:flashForm.date,
                phase:'draft',
                type:'flash_tournament',
                max_players:parseInt(flashForm.maxPlayers)||128,
                round_count:parseInt(flashForm.gameCount)||3,
                seeding_method:flashForm.seedingMethod||'snake',
                prize_pool_json:prizePool.length>0?prizePool:null,
                lobby_host_method:'random'
              }).select().single().then(function(res){
                if(res.error){toast("Failed to create: "+res.error.message,"error");return;}
                toast("Flash tournament created!","success");
                addAudit("ACTION","Flash tournament created: "+flashForm.name.trim());
                setFlashEvents(flashEvents.concat([res.data]));
                setFlashForm({name:"Flash Tournament",date:"",maxPlayers:"128",gameCount:"3",formatPreset:"standard",seedingMethod:"snake",prizeRows:[{placement:"1",prize:""}]});
              });
            }}>Create Tournament</Btn>
          </Panel>

          <Panel style={{padding:"20px"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:14}}>Existing Flash Tournaments ({flashEvents.length})</div>
            {flashEvents.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:"#8896A8",fontSize:13}}>No flash tournaments yet. Create one above.</div>}
            {flashEvents.map(function(ev){
              var phaseColors={draft:"#9AAABF",registration:"#9B72CF",check_in:"#E8A838",in_progress:"#52C47C",complete:"#4ECDC4"};
              return(
                <div key={ev.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(242,237,228,.06)",borderRadius:8,marginBottom:6}}>
                  <div style={{fontSize:16,flexShrink:0}}>{React.createElement("i",{className:"ti ti-bolt"})}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#BECBD9"}}>{ev.date?new Date(ev.date).toLocaleDateString():"TBD"} · <span style={{color:phaseColors[ev.phase]||"#9AAABF",fontWeight:700,textTransform:"uppercase"}}>{(ev.phase||"draft").replace("_"," ")}</span></div>
                  </div>
                  <Btn v="ghost" s="sm" onClick={function(){
                    if(ev.phase==="draft"){
                      supabase.from('tournaments').update({phase:'registration',registration_open_at:new Date().toISOString()}).eq('id',ev.id).then(function(res){
                        if(res.error){toast("Failed: "+res.error.message,"error");return;}
                        setFlashEvents(flashEvents.map(function(e){return e.id===ev.id?Object.assign({},e,{phase:'registration'}):e;}));
                        toast("Registration opened!","success");
                        addAudit("ACTION","Flash tournament registration opened: "+ev.name);
                      });
                    } else {
                      setScreen("flash-"+ev.id);
                    }
                  }}>{ev.phase==="draft"?"Open Registration":"View"}</Btn>
                  <Btn v="danger" s="sm" onClick={function(){
                    if(!confirm("Delete tournament '"+ev.name+"'?"))return;
                    supabase.from('tournaments').delete().eq('id',ev.id).then(function(res){
                      if(res.error){toast("Failed: "+res.error.message,"error");return;}
                      setFlashEvents(flashEvents.filter(function(e){return e.id!==ev.id;}));
                      toast("Tournament deleted","success");
                      addAudit("DANGER","Flash tournament deleted: "+ev.name);
                    });
                  }}>Delete</Btn>
                </div>
              );
            })}
          </Panel>
        </div>
      )}

        </div>{/* main content */}
      </div>{/* flex layout */}
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

function createScrim(name, createdBy, tag, notes, targetGames) {
  return supabase.from("scrims").insert({
    name: name, created_by: createdBy, tag: tag || null, notes: notes || null,
    target_games: targetGames || 5, status: "active"
  }).select().single();
}

function addScrimPlayers(scrimId, playerIds) {
  var rows = playerIds.map(function(pid) {
    return {scrim_id: scrimId, player_id: pid};
  });
  return supabase.from("scrim_players").insert(rows);
}

function submitScrimResult(scrimId, gameNumber, results, tag, note, duration) {
  return supabase.from("scrim_games").insert({
    scrim_id: scrimId, game_number: gameNumber, status: "completed",
    tag: tag || "standard", note: note || null, duration: duration || 0
  }).select().single().then(function(res) {
    if (res.error) return res;
    var gameId = res.data.id;
    var rows = results.map(function(r) {
      return {scrim_game_id: gameId, player_id: r.playerId, placement: r.placement, points: PTS[r.placement] || 0};
    });
    return supabase.from("scrim_results").insert(rows).then(function(insRes) {
      if (insRes.error) return insRes;
      return {data: Object.assign({}, res.data, {scrim_results: rows}), error: null};
    });
  });
}

function loadScrims() {
  return supabase.from("scrims")
    .select("*, scrim_players(player_id), scrim_games(*, scrim_results(*))")
    .order("created_at", {ascending: false})
    .limit(50);
}

function endScrimDb(scrimId) {
  return supabase.from("scrims").update({status: "ended"}).eq("id", scrimId);
}

function deleteScrimGameDb(gameId) {
  return supabase.from("scrim_games").delete().eq("id", gameId);
}

function deleteScrimDb(scrimId) {
  return supabase.from("scrims").delete().eq("id", scrimId);
}

function ScrimsScreen({players,toast,setScreen,sessions,setSessions,isAdmin,scrimAccess,setScrimAccess,tickerOverrides,setTickerOverrides,setNotifications,currentUser,linkedPlayer}){

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

  var [dbScrims,setDbScrims]=useState([]);
  var [dbLoading,setDbLoading]=useState(true);

  // Load scrims from DB on mount
  useEffect(function(){
    var cancelled=false;
    setDbLoading(true);
    loadScrims().then(function(res){
      if(cancelled)return;
      if(res.error){toast("Failed to load scrims: "+res.error.message,"error");setDbLoading(false);return;}
      setDbScrims(res.data||[]);
      setDbLoading(false);
    });
    return function(){cancelled=true;};
  },[]);

  function reloadScrims(){
    loadScrims().then(function(res){
      if(!res.error)setDbScrims(res.data||[]);
    });
  }

  useEffect(function(){

    if(timerActive){timerRef.current=setInterval(function(){setTimer(function(t){return t+1;});},1000);}

    else clearInterval(timerRef.current);

    return function(){clearInterval(timerRef.current);};

  },[timerActive]);

  var fmt=function(s){return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");};

  // Convert DB scrims to the shape the UI expects (sessions with .games array)
  var safeSessions=dbScrims.map(function(sc){
    var games=(sc.scrim_games||[]).map(function(g){
      var results={};
      (g.scrim_results||[]).forEach(function(r){results[r.player_id]=r.placement;});
      return {id:g.id,results:results,note:g.note||"",tag:g.tag||"standard",duration:g.duration||0,ts:new Date(g.created_at).getTime(),gameNumber:g.game_number};
    }).sort(function(a,b){return a.gameNumber-b.gameNumber;});
    return {
      id:sc.id,name:sc.name,notes:sc.notes||"",targetGames:sc.target_games||5,
      games:games,createdAt:new Date(sc.created_at).toLocaleDateString(),
      active:sc.status==="active",tag:sc.tag,createdBy:sc.created_by,
      playerIds:(sc.scrim_players||[]).map(function(sp){return sp.player_id;})
    };
  });

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

    if(ironButt&&ironButt.eighths>0)awards.push({icon:"person-arms-up",title:"Iron Butt",desc:"Most 8th places",player:ironButt.name,val:ironButt.eighths+"x 8th"});

    var consistent=scrimStats.filter(function(p){return p.games>=3;}).slice().sort(function(a,b){return a.variance-b.variance;})[0];

    if(consistent)awards.push({icon:"bullseye",title:"Consistent King",desc:"Lowest placement variance",player:consistent.name,val:"σ²="+consistent.variance.toFixed(1)});

    var streakKing=scrimStats.slice().sort(function(a,b){return b.streak-a.streak;})[0];

    if(streakKing&&streakKing.streak>=2)awards.push({icon:"fire",title:"Streak Lord",desc:"Current top-4 streak",player:streakKing.name,val:streakKing.streak+" games"});

    var winKing=scrimStats.slice().sort(function(a,b){return b.wins-a.wins;})[0];

    if(winKing&&winKing.wins>0)awards.push({icon:"trophy-fill",title:"Clutch Player",desc:"Most first place finishes",player:winKing.name,val:winKing.wins+"x 1st"});

    var glassCannon=scrimStats.filter(function(p){return p.games>=3&&p.wins>0&&p.eighths>0;}).slice().sort(function(a,b){return b.variance-a.variance;})[0];

    if(glassCannon)awards.push({icon:"fire",title:"Glass Cannon",desc:"Highest highs and lowest lows",player:glassCannon.name,val:"±"+glassCannon.variance.toFixed(1)});

  }



  function createSession(){
    if(!newName.trim()){toast("Name required","error");return;}
    if(!currentUser){toast("Login required","error");return;}
    var tgt=parseInt(newTarget)||5;
    createScrim(newName.trim(),currentUser.id,null,newNotes.trim(),tgt).then(function(res){
      if(res.error){toast("Failed to create: "+res.error.message,"error");return;}
      var scrimId=res.data.id;
      var pids=scrimRoster.map(function(p){return typeof p.id==="number"?p.id:parseInt(p.id);}).filter(function(v){return !isNaN(v);});
      if(pids.length>0){
        addScrimPlayers(scrimId,pids).then(function(){reloadScrims();});
      }else{
        reloadScrims();
      }
      setActiveId(scrimId);
      setNewName("");setNewNotes("");setNewTarget("5");
      toast("Session created, go to Play tab to record games","success");
      setTab("play");
    });
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
    var gameNum=session?session.games.length+1:1;
    var resultRows=Object.keys(scrimResults).map(function(pid){
      return {playerId:parseInt(pid),placement:scrimResults[pid]};
    });
    submitScrimResult(activeId,gameNum,resultRows,gameTag,gameNote,timer).then(function(res){
      if(res.error){toast("Failed to save game: "+res.error.message,"error");return;}
      reloadScrims();
      setScrimResults({});setGameNote("");setTimer(0);setTimerActive(false);
      toast("Game locked","success");
    });
  }



  function stopSession(id){
    endScrimDb(id).then(function(res){
      if(res.error){toast("Failed to end session: "+res.error.message,"error");return;}
      reloadScrims();
      toast("Session ended, results saved","success");
    });
  }

  function deleteGame(sessionId,gameId){
    deleteScrimGameDb(gameId).then(function(res){
      if(res.error){toast("Failed to delete game: "+res.error.message,"error");return;}
      reloadScrims();
      setConfirmDelete(null);
      toast("Game deleted","success");
    });
  }

  function deleteSession(sessionId){
    deleteScrimDb(sessionId).then(function(res){
      if(res.error){toast("Failed to delete session: "+res.error.message,"error");return;}
      reloadScrims();
      if(activeId===sessionId)setActiveId(null);
      setConfirmDelete(null);
      toast("Session deleted","success");
    });
  }



  var TABS=[["dashboard","Dashboard"],["play","Play"],["stats","Stats"],["history","History"],["sessions","Sessions"]];



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

        <div className="lab-tabs" style={{display:"flex",gap:6,overflowX:"auto",whiteSpace:"nowrap",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none",flexWrap:"nowrap"}}>

          {TABS.map(function(pair){

            return <Btn key={pair[0]} v={tab===pair[0]?"purple":"dark"} s="sm" onClick={function(){setTab(pair[0]);}} style={{flexShrink:0,whiteSpace:"nowrap"}}>{pair[1]}</Btn>;

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

                            <div style={{fontSize:10,color:"#9AAABF"}}>{p.games}g &middot; avg {p.avg}{p.streak>=3?" "+p.streak:""}</div>

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

                              <div style={{fontSize:22,flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[a.icon]||a.icon),style:{color:a.color}})}</div>

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

                                  if(String(rowP.id)===String(colP.id))return <td key={colP.id} style={{background:"rgba(255,255,255,.03)",padding:"8px 10px",textAlign:"center",borderBottom:"1px solid rgba(242,237,228,.04)",color:"#7A8BA0",fontSize:12}}>-</td>;

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

                <Sel value={activeId||""} onChange={function(v){setActiveId(v||null);}} style={{width:"100%"}}>

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

                            <div style={{fontSize:10,color:"#9AAABF"}}>{p.games}g{p.streak>=3?" - "+p.streak:""}</div>

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

function PricingScreen(props) {
  var currentUser = props.currentUser;
  var userTier = props.userTier || "free";
  var toast = props.toast;

  var tiers = [
    {
      id: "free", name: "Player", price: "Free", period: "forever",
      color: "#F2EDE4", borderColor: "rgba(255,255,255,.1)",
      features: [
        "Compete in every clash",
        "Full standings and leaderboard",
        "Basic profile with stats",
        "View all results and recaps",
        "Current season history"
      ]
    },
    {
      id: "pro", name: "Pro", price: "$4.99", period: "/month",
      color: "#9B72CF", borderColor: "rgba(155,114,207,.5)",
      badge: "Recommended",
      features: [
        "Everything in Player, plus:",
        "Enhanced stats and consistency grade",
        "Pro badge on profile",
        "Priority registration",
        "Full career history (all seasons)",
        "Custom profile banner",
        "Player comparison tool",
        "Weekly email digest"
      ]
    },
    {
      id: "host", name: "Host", price: "$19.99", period: "/month",
      color: "#E8A838", borderColor: "rgba(232,168,56,.5)",
      features: [
        "Everything in Pro, plus:",
        "Create custom tournaments",
        "Branded tournament pages",
        "Host analytics dashboard",
        "Custom rules and formats",
        "Player management tools",
        "Priority support"
      ]
    }
  ];

  return React.createElement("div", {className:"page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{textAlign:"center",marginBottom:8,color:"#F2EDE4"}}, "Choose Your Path"),
    React.createElement("p", {style:{textAlign:"center",fontSize:14,color:"#BECBD9",marginBottom:32}}, "Competing is always free. Upgrade for enhanced features."),
    React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:32}},
      tiers.map(function(tier) {
        var isActive = userTier === tier.id;
        return React.createElement("div", {key:tier.id,style:{
          background: tier.id === "pro" ? "linear-gradient(145deg,rgba(155,114,207,.1),rgba(8,8,15,.8))" : "rgba(17,24,39,.8)",
          border: "1px solid " + tier.borderColor,
          borderRadius: 16,
          padding: "24px 20px",
          position: "relative",
          boxShadow: tier.id === "pro" ? "0 0 30px rgba(155,114,207,.1)" : "none"
        }},
          tier.badge ? React.createElement("div", {style:{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:"#9B72CF",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 12px",borderRadius:10,letterSpacing:".05em"}}, tier.badge) : null,
          React.createElement("div", {style:{textAlign:"center",marginBottom:16}},
            React.createElement("div", {style:{fontSize:18,fontWeight:700,color:tier.color,marginBottom:4}}, tier.name),
            React.createElement("div", {style:{display:"flex",alignItems:"baseline",justifyContent:"center",gap:2}},
              React.createElement("span", {className:"mono",style:{fontSize:32,fontWeight:800,color:"#F2EDE4"}}, tier.price),
              tier.period !== "forever" ? React.createElement("span", {style:{fontSize:12,color:"#9AAABF"}}, tier.period) : null
            )
          ),
          React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:8,marginBottom:20}},
            tier.features.map(function(f, fi) {
              return React.createElement("div", {key:fi,style:{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#BECBD9"}},
                React.createElement("i", {className:"ti ti-check",style:{color:tier.color,fontSize:14}}),
                React.createElement("span", null, f)
              );
            })
          ),
          isActive
            ? React.createElement("div", {style:{textAlign:"center",padding:"8px 0",fontSize:13,fontWeight:700,color:"#6EE7B7"}}, "Current Plan")
            : tier.id === "free"
              ? null
              : React.createElement("div", {style:{textAlign:"center",fontSize:12,color:"#9AAABF"}}, "Coming soon")
        );
      })
    ),
    React.createElement("div", {style:{textAlign:"center",padding:"16px",background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.2)",borderRadius:12}},
      React.createElement("div", {style:{fontSize:14,fontWeight:700,color:"#4ECDC4"}}, "Free to compete, always."),
      React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginTop:4}}, "Every player can enter every clash. Upgrades enhance your experience, never gate competition.")
    )
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

        {[["achievements","Achievements"],["milestones","Season Milestones"],["leaderboard","Achievement Leaders"]].map(([v,l])=>(

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

            {filteredAch.length===0&&(
              <div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px 20px"}}>
                <div style={{marginBottom:12}}>{React.createElement("i",{className:"ti ti-award",style:{fontSize:32}})}</div>
                <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:4}}>No achievements match this filter</div>
                <div style={{fontSize:12,color:"#9AAABF"}}>Try selecting a different tier or category.</div>
              </div>
            )}

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

                  transition:"all .2s",

                  animation:unlocked?"achievement-pop .4s ease-out both":"none"}}>

                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>

                    <div style={{width:44,height:44,borderRadius:10,

                      background:unlocked?col+"22":"rgba(255,255,255,.04)",

                      border:"1px solid "+(unlocked?col+"55":"rgba(242,237,228,.08)"),

                      display:"flex",alignItems:"center",justifyContent:"center",

                      fontSize:22,flexShrink:0,

                      boxShadow:unlocked?"0 0 12px "+col+"33":"none",

                      animation:unlocked?"achievement-glow 2s ease-in-out infinite":"none"}}>

                      {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[a.icon]||a.icon)})}

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

                    {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[m.icon]||m.icon)})}

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

                      <span style={{fontSize:11}}>{React.createElement("i",{className:"ti ti-gift"})}</span>

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

                    {legendary>0&&<span style={{fontSize:10,fontWeight:700,background:"rgba(155,114,207,.15)",color:"#9B72CF",padding:"2px 7px",borderRadius:8}}>{legendary}</span>}

                    {gold>0&&<span style={{fontSize:10,fontWeight:700,background:"rgba(232,168,56,.12)",color:"#E8A838",padding:"2px 7px",borderRadius:8}}>{gold}</span>}

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

          <div style={{fontSize:36,animation:"crown-glow 3s ease 1"}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[rankInfo.rank.icon]||rankInfo.rank.icon),style:{color:rankInfo.rank.color}})}</div>

          <div style={{flex:1,minWidth:200}}>

            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>

              <span style={{fontSize:16,fontWeight:700,color:rankInfo.rank.color}}>{rankInfo.rank.name}</span>

              {rankInfo.next&&<span style={{fontSize:12,color:"#BECBD9"}}>→ {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[rankInfo.next.icon]||rankInfo.next.icon),style:{fontSize:12,color:rankInfo.next.color}})} {rankInfo.next.name}</span>}

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

                  <div style={{width:44,height:44,background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[c.icon]||c.icon)})}</div>

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

                    <div style={{width:44,height:44,background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.25)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[(done?"check-circle-fill":c.icon)]||(done?"check-circle-fill":c.icon)),style:{color:done?"#52C47C":undefined}})}</div>

                    <div style={{flex:1,minWidth:0}}>

                      <div style={{fontWeight:700,fontSize:14,color:done?"#6EE7B7":"#F2EDE4",marginBottom:2}}>{c.name}</div>

                      <div style={{fontSize:12,color:"#C8D4E0"}}>{c.desc}</div>

                      <div style={{marginTop:8}}>

                        <Bar val={c.progress} max={c.goal} color={done?"#6EE7B7":"#9B72CF"} h={4}/>

                        <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{c.progress}/{c.goal} {done?"- Completed!":""}</div>

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
          <div style={{marginBottom:12}}>{React.createElement("i",{className:"ti ti-rosette-discount-check",style:{fontSize:36}})}</div>
          <div style={{fontSize:15,fontWeight:600,color:"#F2EDE4",marginBottom:6}}>{done.length} challenge{done.length!==1?"s":""} completed</div>
          {done.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:16,textAlign:"left",maxWidth:360,margin:"16px auto 0"}}>
            {done.map(function(c){return(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(82,196,124,.06)",border:"1px solid rgba(82,196,124,.2)",borderRadius:8}}>
                <span>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[c.icon]||c.icon),style:{fontSize:16}})}</span>
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

            {icon:"trophy-fill",action:"Won Clash #13",xp:"+40 XP",time:"Mar 1 2026",c:"#E8A838"},

            {icon:"bullseye",action:"Weekly challenge: On A Roll",xp:"+120 XP",time:"Mar 1 2026",c:"#9B72CF"},

            {icon:"award-fill",action:"1st place - Top 2 finish",xp:"+50 XP",time:"Feb 28 2026",c:"#E8A838"},

            {icon:"shield-fill",action:"Survived top 4",xp:"+15 XP",time:"Feb 28 2026",c:"#4ECDC4"},

            {icon:"arrow-up-circle-fill",action:"Ranked up: Silver → Gold",xp:"RANK UP",time:"Feb 22 2026",c:"#EAB308"},

            {icon:"controller",action:"Completed a game",xp:"+25 XP",time:"Feb 22 2026",c:"#BECBD9"},

          ].map((e,i)=>(

            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<5?"1px solid rgba(242,237,228,.05)":"none"}}>

              <div style={{width:32,height:32,background:"rgba(255,255,255,.04)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[e.icon]||e.icon),style:{fontSize:15,color:e.c}})}</div>

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

function SignUpScreen({onSignUp,onGoLogin,onBack,toast,setPlayers}){

  const [email,setEmail]=useState("");

  const [pw,setPw]=useState("");

  const [pw2,setPw2]=useState("");

  const [username,setUsername]=useState("");

  const [loading,setLoading]=useState(false);

  const [emailErr,setEmailErr]=useState("");

  const [usernameErr,setUsernameErr]=useState("");

  const [pwErr,setPwErr]=useState("");

  const [pw2Err,setPw2Err]=useState("");

  async function submit(){

    var ok=true;

    setEmailErr("");setUsernameErr("");setPwErr("");setPw2Err("");

    if(!email.trim()){setEmailErr("Email required");ok=false;}

    if(!username.trim()){setUsernameErr("Username required");ok=false;}

    if(!pw.trim()||pw.length<6){setPwErr(!pw.trim()?"Password required":"Must be 6+ characters");ok=false;}

    if(pw!==pw2){setPw2Err("Passwords don't match");ok=false;}

    if(!ok)return;

    setLoading(true);

    const {data,error}=await supabase.auth.signUp({

      email:email.trim(),password:pw,

      options:{data:{username:username.trim()}}

    });

    setLoading(false);

    if(error){toast(error.message,"error");return;}

    // Insert into DB players table with auth_user_id link
    var authUserId=data.user?data.user.id:null;
    var dbInsert=await supabase.from('players').insert({username:username.trim(),rank:'Iron',auth_user_id:authUserId}).select().single();
    if(dbInsert.error&&dbInsert.error.code!=='23505'){
      console.error("[TFT] Failed to create player row:",dbInsert.error);
    }

    // Add to local players[] state immediately so linkedPlayer works
    var newPlayer={
      id:dbInsert.data?dbInsert.data.id:(Date.now()%100000),
      name:username.trim(),username:username.trim(),
      riotId:'',rank:'Iron',region:'EUW',
      bio:'',authUserId:authUserId,
      pts:0,wins:0,top4:0,games:0,avg:"0",
      banned:false,dnpCount:0,notes:'',checkedIn:false,
      clashHistory:[],sparkline:[],bestStreak:0,currentStreak:0,
      tiltStreak:0,bestHaul:0,attendanceStreak:0,lastClashId:null,
      role:"player",sponsor:null
    };
    if(setPlayers)setPlayers(function(ps){return ps.concat([newPlayer]);});

    onSignUp({...data.user,username:username.trim()});

    toast("Welcome to TFT Clash, "+username.trim()+"!","success");

  }



  return(

    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>

      <div style={{width:"100%",maxWidth:480}}>

        {/* Back button */}

        <div style={{marginBottom:16}}>

          <button onClick={onBack}

            style={{background:"none",border:"none",cursor:"pointer",color:"#9AAABF",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:6,padding:"4px 0",transition:"color .15s"}}

            onMouseEnter={e=>e.currentTarget.style.color="#F2EDE4"}

            onMouseLeave={e=>e.currentTarget.style.color="#9AAABF"}>

            Back to home

          </button>

        </div>

        {/* Logo */}

        <div style={{textAlign:"center",marginBottom:32}}>

          <img src="/icon-border.png" alt="TFT Clash" style={{filter:"drop-shadow(0 0 10px rgba(155,114,207,.55))",width:72,height:72,objectFit:"contain",marginBottom:12}}/>

          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:28,fontWeight:900,color:"#E8A838",letterSpacing:"-.01em"}}>TFT Clash</div>

          <div style={{fontSize:13,color:"#BECBD9",marginTop:4}}>Create your account</div>

        </div>





        <Panel style={{padding:"28px 24px"}}>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              <button onClick={async()=>{await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:CANONICAL_ORIGIN}});}}

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

                <Inp value={pw2} onChange={v=>{setPw2(v);if(pw2Err)setPw2Err("");}} placeholder="Repeat password" type="password" onKeyDown={e=>e.key==="Enter"&&submit()} style={pw2Err?{borderColor:"rgba(248,113,113,.5)"}:{}}/>

                {pw2Err&&<div style={{color:"#F87171",fontSize:12,marginTop:4}}>{pw2Err}</div>}

              </div>

              <Btn v="primary" full onClick={submit} disabled={loading} style={{marginTop:4}}>{loading?"Creating account...":"Create Account"}</Btn>

            </div>

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

    toast("Welcome back, "+(data.user.user_metadata?.username||"player")+"!","success");

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

              <span style={{fontSize:12,color:"#E8A838",cursor:"pointer"}} onClick={async function(){if(!email){toast("Please enter your email first","error");return;}try{await supabase.auth.resetPasswordForEmail(email);toast("Password reset email sent! Check your inbox","info");}catch(e){console.error("[TFT] password reset failed:",e);toast("Failed to send reset email","error");}}}>Forgot password?</span>

            </div>

            <Btn v="primary" full onClick={submit} disabled={loading}>{loading?"Signing in...":"Sign In"}</Btn>

            <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}>

              <div style={{flex:1,height:1,background:"rgba(242,237,228,.1)"}}/>

              <span style={{fontSize:11,color:"#9AAABF",whiteSpace:"nowrap"}}>or</span>

              <div style={{flex:1,height:1,background:"rgba(242,237,228,.1)"}}/>

            </div>

            <button onClick={async()=>{await supabase.auth.signInWithOAuth({provider:'discord',options:{redirectTo:CANONICAL_ORIGIN}});}}

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



function AccountScreen({user,onUpdate,onLogout,toast,setScreen,players,setPlayers,setProfilePlayer,isAdmin,hostApps}){

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

  const [riotId,setRiotId]=useState(user.user_metadata?.riotId||user.user_metadata?.riot_id||"");

  const [riotRegion,setRiotRegion]=useState(user.user_metadata?.riotRegion||user.user_metadata?.riot_region||user.user_metadata?.region||"EUW");

  const [secondRiotId,setSecondRiotId]=useState(user.user_metadata?.secondRiotId||user.secondRiotId||"");

  const [secondRegion,setSecondRegion]=useState(user.user_metadata?.secondRegion||user.secondRegion||"EUW");



  const usernameChanged=!!(user.user_metadata?.username_changed);

  const riotIdSet=!!(user.user_metadata?.riotId||user.user_metadata?.riot_id);

  const EU_NA=["EUW","EUNE","NA"];



  const linkedPlayer=players.find(p=>(p.authUserId&&p.authUserId===user.id)||(p.id===user.linkedPlayerId)||(p.name===user.username));

  const s=linkedPlayer?getStats(linkedPlayer):null;

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

    }catch(e){console.warn("Supabase update failed",e);toast("Failed to save profile  -  please try again","error");return;}

    // Also update players table row linked to this auth user
    var socialLinks={twitch:meta.twitch||"",twitter:meta.twitter||"",youtube:meta.youtube||""};
    var playerUpdate={bio:meta.bio||"",region:riotRegion,social_links:socialLinks};
    if(!riotIdSet&&meta.riotId){
      playerUpdate.riot_id=meta.riotId;
      playerUpdate.region=riotRegion;
    }
    supabase.from('players').update(playerUpdate).eq('auth_user_id',user.id).then(function(pRes){
      if(pRes.error)console.error("[TFT] Players table update failed:",pRes.error);
    });

    onUpdate({...user,...meta,username:meta.username||user.username,user_metadata:meta,region:riotRegion,mainRegion:riotRegion,secondRiotId,secondRegion,profilePic,bannerUrl,profileAccent});

    setEdit(false);

    toast("Profile updated","success");

  }



  async function requestChange(field){

    const pending=(user.user_metadata?.pending_changes||[]).concat([{field,requestedAt:new Date().toISOString()}]);

    try{await supabase.auth.updateUser({data:{...(user.user_metadata||{}),pending_changes:pending}});}catch{}

    toast("Change request submitted  -  an admin will review it","success");

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

  var acctProfileFields=[user.user_metadata&&user.user_metadata.riot_id,user.user_metadata&&user.user_metadata.bio,user.user_metadata&&user.user_metadata.region];
  var acctProfileComplete=acctProfileFields.filter(Boolean).length;
  var acctProfileTotal=acctProfileFields.length;
  var acctMissingField=!(user.user_metadata&&user.user_metadata.riot_id)?"Riot ID":!(user.user_metadata&&user.user_metadata.bio)?"bio":"region";
  var acctProgressMsg="Profile "+acctProfileComplete+"/"+acctProfileTotal+" complete"+(acctProfileComplete<acctProfileTotal?" - Add a "+acctMissingField+" to finish":"");



  return(

    <div className="page wrap">

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>

        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>

        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1}}>My Account</h2>

        {linkedPlayer&&<Btn v="dark" s="sm" onClick={function(){
          var myRank=([...players].sort(function(a,b){return b.pts-a.pts;}).findIndex(function(p){return p.id===linkedPlayer.id;})+1);
          shareToTwitter(buildShareText("profile",{name:user.username,rank:myRank,pts:linkedPlayer.pts}));
        }}>{React.createElement("i",{className:"ti ti-brand-x",style:{marginRight:4}})}Share</Btn>}

        <Btn v="dark" s="sm" onClick={onLogout}>Sign Out</Btn>

      </div>

      {!riotIdSet&&(
        <div style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-alert-triangle",style:{color:"#E8A838"}})}</span>
          <div>
            <div style={{color:"#E8A838",fontWeight:600,fontSize:13}}>Set your Riot ID to join tournaments</div>
            <div style={{color:"#BECBD9",fontSize:12}}>You need a Riot ID to register for flash tournaments.</div>
          </div>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:acctProfileComplete===acctProfileTotal?"#52C47C":"#E8A838",display:"inline-block",flexShrink:0}}/>
        <span style={{fontSize:12,color:acctProfileComplete===acctProfileTotal?"#52C47C":"#BECBD9",fontWeight:500}}>{acctProgressMsg}</span>
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

                {React.createElement("i",{className:"ti ti-"+(ICON_REMAP[myMilestones[myMilestones.length-1].icon]||myMilestones[myMilestones.length-1].icon),style:{fontSize:11}})}

              </div>

            )}

          </div>

          {/* Name + info */}

          <div style={{flex:1,minWidth:200}}>

            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>

              <h2 style={{fontSize:24,fontWeight:900,color:"#F2EDE4",margin:0}}>{user.username}</h2>

              {isPro&&<span style={{background:"linear-gradient(90deg,#E8A838,#C8882A)",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:800,color:"#08080F",letterSpacing:".04em"}}>{"PRO"}</span>}

              {linkedPlayer&&<ClashRankBadge rank={linkedPlayer.rank}/>}

              {linkedPlayer&&isHotStreak(linkedPlayer)&&<span style={{fontSize:14}}>{React.createElement("i",{className:"ti ti-flame",style:{color:"#F97316"}})}</span>}

            </div>

            {linkedPlayer&&(

              <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>{linkedPlayer.riotId} · {linkedPlayer.region}</div>

            )}

            <div style={{marginBottom:10,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              {subscription?(
                <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",borderRadius:20,background:subscription.plan==="host"?"rgba(232,168,56,.15)":"rgba(155,114,207,.15)",border:"1px solid "+(subscription.plan==="host"?"rgba(232,168,56,.4)":"rgba(155,114,207,.4)"),fontSize:12,fontWeight:700,color:subscription.plan==="host"?"#E8A838":"#C4B5FD"}}>
                  {subscription.plan==="host"?"Host Plan":"Pro Plan"} · Active
                </div>
              ):(
                <button onClick={()=>setScreen("pricing")} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:"transparent",border:"1px solid rgba(155,114,207,.35)",fontSize:12,color:"#9B72CF",cursor:"pointer",fontFamily:"inherit"}}>
                  Upgrade to Pro →
                </button>
              )}
              {(isAdmin||(hostApps||[]).some(function(a){return a.status==="approved"&&(a.name===user.username||a.email===user.email);}))&&(
                <button onClick={()=>setScreen("host-dashboard")} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:20,background:"rgba(232,168,56,.12)",border:"1px solid rgba(232,168,56,.4)",fontSize:12,fontWeight:700,color:"#E8A838",cursor:"pointer",fontFamily:"inherit"}}>
                  {React.createElement("i",{className:"ti ti-device-gamepad-2",style:{marginRight:4}})}Host Dashboard →
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

                {user.twitch&&<a href={"https://twitch.tv/"+user.twitch} target="_blank" style={{fontSize:11,color:"#9147FF",background:"rgba(145,71,255,.1)",border:"1px solid rgba(145,71,255,.3)",borderRadius:6,padding:"3px 10px",textDecoration:"none",fontWeight:700}}>{React.createElement("i",{className:"ti ti-device-tv",style:{fontSize:10,marginRight:3}})}{user.twitch}</a>}

                {user.twitter&&<a href={"https://twitter.com/"+user.twitter} target="_blank" style={{fontSize:11,color:"#1DA1F2",background:"rgba(29,161,242,.1)",border:"1px solid rgba(29,161,242,.3)",borderRadius:6,padding:"3px 10px",textDecoration:"none",fontWeight:700}}>{React.createElement("i",{className:"ti ti-brand-x",style:{fontSize:10,marginRight:3}})}{user.twitter}</a>}

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

        {[["profile","Profile"],["stats","Stats"],["achievements","Achievements"],["history","History"]].map(([v,l])=>(

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

                <Btn v="dark" s="sm" onClick={()=>setEdit(true)}>{React.createElement("i",{className:"ti ti-pencil",style:{fontSize:11,marginRight:3}})}Edit</Btn>

              </div>

              <div style={{display:"grid",gap:12}}>

                {[

                  ["Username",user.username,usernameChanged?"#9B72CF":"#F2EDE4"],

                  ["Riot ID",(user.user_metadata?.riotId||user.user_metadata?.riot_id)?((user.user_metadata?.riotId||user.user_metadata?.riot_id)+" · "+(user.user_metadata?.riotRegion||user.user_metadata?.riot_region||user.user_metadata?.region||"EUW")):null,"#E8A838"],

                  ["Secondary Riot ID",user.user_metadata?.secondRiotId?(user.user_metadata.secondRiotId+" · "+user.user_metadata.secondRegion):null,"#C4B5FD"],

                  ["Bio",user.user_metadata?.bio||user.bio||null,"#C8D4E0"],

                  ["Twitch",user.user_metadata?.twitch||user.twitch?("twitch.tv/"+(user.user_metadata?.twitch||user.twitch)):null,"#9147FF"],

                  ["Twitter",user.user_metadata?.twitter||user.twitter?("@"+(user.user_metadata?.twitter||user.twitter)):null,"#1DA1F2"],

                  ["Profile Picture",profilePic?"Custom avatar set":"Not set (default initial)",profilePic?"#6EE7B7":"#9AAABF"],

                  ["Banner",bannerUrl?"Custom banner set":"Not set (rank gradient)",bannerUrl?"#6EE7B7":"#9AAABF"],

                ].map(([label,val,col])=>(

                  <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(242,237,228,.07)"}}>

                    <span style={{color:"#BECBD9",fontSize:13}}>{label}</span>

                    <span style={{color:val?col:"#9AAABF",fontSize:13,fontWeight:val?600:400,maxWidth:280,textAlign:"right"}}>{val||" - "}</span>

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

                      <button onClick={async()=>{await supabase.auth.linkIdentity({provider:'discord',options:{redirectTo:CANONICAL_ORIGIN+"#account"}});}}

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

                  try{
                    // Remove player from DB and local state
                    if(supabase.from){await supabase.from('players').delete().eq('auth_user_id',user.id).catch(function(){});}
                    if(setPlayers){setPlayers(function(ps){return ps.filter(function(p){return p.authUserId!==user.id&&(p.name||"").toLowerCase()!==(user.username||"").toLowerCase();});});}
                    await supabase.auth.admin?.deleteUser?.(user.id).catch(()=>{});await supabase.auth.signOut();onLogout();toast("Account deleted","success");
                  }
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

                {/* Username  -  change once */}

                <div>

                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>

                    <div style={{fontSize:12,color:"#BECBD9"}}>Username {usernameChanged&&<span style={{color:"#9B72CF",fontSize:11}}>(locked  -  changed once)</span>}</div>

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

                {/* Main Riot ID  -  locked after set */}

                <div>

                  <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>Main Riot ID {riotIdSet&&<span style={{color:"#E8A838",fontSize:11}}>(locked)</span>}</div>

                  {riotIdSet?(

                    <div style={{display:"flex",gap:8,alignItems:"center"}}>

                      <div style={{flex:1,background:"#0F1520",border:"1px solid rgba(232,168,56,.15)",borderRadius:8,padding:"9px 12px",color:"#E8A838",fontSize:13,fontWeight:600}}>{user.user_metadata?.riotId||user.user_metadata?.riot_id} · {user.user_metadata?.riotRegion||user.user_metadata?.riot_region||user.user_metadata?.region||"EUW"}</div>

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
                        <div style={{fontSize:12,color:"#BECBD9",marginBottom:5}}>{"Profile Picture"}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.35)",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#C4B5FD",flexShrink:0}}>
                            {"Upload Photo"}
                            {React.createElement("input",{
                              type:"file",accept:"image/*",style:{display:"none"},
                              onChange:function(e){
                                var file=e.target.files[0];
                                if(!file){return;}
                                if(file.size>2*1024*1024){toast("Max 2MB","error");return;}
                                supabase.storage.from("avatars").upload(user.id+"/avatar.png",file,{upsert:true})
                                  .then(function(res){
                                    if(res.error){toast("Upload failed","error");return;}
                                    var url=supabase.storage.from("avatars").getPublicUrl(user.id+"/avatar.png").data.publicUrl;
                                    setProfilePic(url);
                                    supabase.from("players").update({profile_pic_url:url}).eq("auth_user_id",user.id);
                                    toast("Avatar updated!","success");
                                  });
                              }
                            })}
                          </label>
                          <span style={{fontSize:11,color:"#9AAABF"}}>{"or paste URL below"}</span>
                        </div>
                        <Inp value={profilePic} onChange={setProfilePic} placeholder="https://i.imgur.com/your-pic.png"/>
                        <div style={{fontSize:10,color:"#9AAABF",marginTop:3}}>{"Max 2MB. Square images work best."}</div>
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

                  {l:"Best Streak",v:linkedPlayer.bestStreak,c:"#F87171"},

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

              {/* Placement Distribution + Season Trajectory */}
              {(function(){
                var acctHistory=linkedPlayer.clashHistory||[];
                var ppTrend2=[];
                var ppCum2=0;
                acctHistory.forEach(function(c){ppCum2=ppCum2+(c.points||0);ppTrend2.push(ppCum2);});
                return React.createElement("div",{style:{marginTop:12}},
                  React.createElement(PlacementDistribution,{history:acctHistory}),
                  ppTrend2.length>1?React.createElement(Panel,{style:{padding:"16px",marginTop:10}},
                    React.createElement("div",{style:{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:10}},"Season Trajectory"),
                    React.createElement(Sparkline,{data:ppTrend2,w:280,h:40,color:"#9B72CF"})
                  ):null
                );
              })()}

            </>

          ):(

            <div style={{textAlign:"center",padding:"48px 20px"}}>

              <div style={{fontSize:40,marginBottom:12}}>{React.createElement("i",{className:"ti ti-chart-bar"})}</div>

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

                      <div style={{fontSize:22,flexShrink:0}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[a.icon]||a.icon)})}</div>

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

                    {(g.place||g.placement)===1?"Victory":(g.place||g.placement)<=4?"Top 4 Finish":"Outside Top 4"}

                    {g.clutch&&<span style={{marginLeft:6,fontSize:11,color:"#9B72CF",fontWeight:700}}>{React.createElement("i",{className:"ti ti-bolt",style:{marginRight:3}})}Clutch</span>}

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

  const s=getStats(player);

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

    toast("Season recap downloaded!","success");

  }



  function shareTwitter(){

    const text=`My TFT Clash Season 1 Recap\n\n#${position} overall (${player.pts}pts)\n${s.wins} wins · AVP ${s.avgPlacement}\n Best streak: ${player.bestStreak||0}\n${awards.length>0?"Awards: "+awards.map(a=>a.title).join(", ")+"\n":""}\n#TFTClash #TFT #Season1`;

    navigator.clipboard?.writeText(text).then(()=>toast("Copied for Twitter!","success"));

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

          {[["Season Pts",player.pts,"#E8A838"],["Wins",s.wins,"#6EE7B7"],["AVP",s.avgPlacement,avgCol(s.avgPlacement)],["Top 4",s.top4,"#C4B5FD"],["Games",s.games,"#C8D4E0"],["Best Streak",(player.bestStreak||0),"#F97316"]].map(([l,v,c])=>(

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

              {awards.map(a=><Tag key={a.id} color={a.color} size="sm">{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[a.icon]||a.icon),style:{fontSize:11,color:a.color}})} {a.title}</Tag>)}

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

        <Btn v="primary" s="lg" onClick={downloadRecap}>{React.createElement("i",{className:"ti ti-download",style:{fontSize:14,marginRight:4}})}Download PNG</Btn>

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

      const top3=sorted.slice(0,3).map((p,i)=>`${["1st","2nd","3rd"][i]}: ${p.name} (${p.pts}pts, AVP ${getStats(p).avgPlacement})`).join(", ");

      const bottom=sorted[sorted.length-1];

      const prompt=`You are a witty esports commentator for TFT Clash, a Teamfight Tactics tournament platform. Write a short, punchy post-clash write-up (3-4 sentences max) covering these results:



Top 3: ${top3}

Last place: ${bottom?.name||"unknown"} (${bottom?.pts||0}pts)

Total players: ${players.length}

Champion wins this season: ${sorted[0]?.wins||0}



Be entertaining, use TFT terminology, call out the champion, maybe roast the last place. Keep it under 80 words. No markdown.`;



      const res=await fetch("/api/ai-commentary",{

        method:"POST",

        headers:{"Content-Type":"application/json"},

        body:JSON.stringify({prompt:prompt})

      });

      const data=await res.json();

      const text=data.text||"Commentary unavailable.";

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

        <div>{React.createElement("i",{className:"ti ti-microphone",style:{fontSize:22}})}</div>

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

            <Btn v="purple" s="sm" onClick={()=>navigator.clipboard?.writeText(commentary).then(()=>toast("Commentary copied!","success"))}>{React.createElement("i",{className:"ti ti-clipboard",style:{marginRight:4}})}Copy</Btn>

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
      supabase.from("host_profiles").upsert({
        user_id:currentUser.id,
        org_name:org.trim()||name.trim(),
        slug:slug,
        bio:reason.trim(),
        status:"pending",
        social_links:{freq:freq}
      },{onConflict:'user_id'}).then(function(res){
        if(res.error)console.error("[TFT] host_profiles insert failed:",res.error);
        else dbg("[TFT] host_profiles application saved to DB");
      });
    }
    setSubmitted(true);
    toast("Application submitted! We'll review it within 48h","success");

  }



  if(submitted) return(

    <div className="page wrap" style={{maxWidth:560,margin:"0 auto",textAlign:"center",paddingTop:60}}>

      <div style={{fontSize:48,marginBottom:16}}>{React.createElement("i",{className:"ti ti-device-gamepad-2"})}</div>

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

        <div style={{fontSize:32,marginBottom:10}}>{React.createElement("i",{className:"ti ti-device-gamepad-2"})}</div>

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
  var [brandLogo,setBrandLogo]=useState((hostBranding&&hostBranding.logo)||"controller");
  var [brandColor,setBrandColor]=useState((hostBranding&&hostBranding.color)||"#9B72CF");

  // Wizard state
  var [wizStep,setWizStep]=useState(0);
  var [wizData,setWizData]=useState({name:"",date:"",type:"swiss",totalGames:3,maxPlayers:32,accentColor:"#9B72CF",entryFee:"",inviteOnly:false,rules:""});
  var [wizCreating,setWizCreating]=useState(false);

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

  // Load host tournaments from DB for analytics
  useEffect(function(){
    if(!currentUser||!supabase.from)return;
    supabase.from("tournaments").select("id, name, date, max_players, host_id")
      .eq("host_id",currentUser.id)
      .order("date",{ascending:false})
      .then(function(res){
        if(res.data&&setHostTournaments){
          var merged=res.data.map(function(dbT){
            var existing=(hostTournaments||[]).find(function(t){return t.dbId===dbT.id||t.name===dbT.name;});
            return existing?Object.assign({},existing,{dbId:dbT.id,max_players:dbT.max_players}):Object.assign({},dbT,{dbId:dbT.id,status:"upcoming",registered:0,size:dbT.max_players||32});
          });
          setHostTournaments(function(prev){
            var prevIds=(prev||[]).map(function(t){return t.dbId||t.id;});
            var newFromDb=merged.filter(function(t){return prevIds.indexOf(t.dbId||t.id)===-1;});
            return (prev||[]).concat(newFromDb);
          });
        }
      });
  },[currentUser&&currentUser.id]);

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
  function handleLogoUpload(file){
    if(!file||!supabase.storage)return;
    var path="host-logos/"+(currentUser?currentUser.id:"anon")+"/"+file.name;
    return supabase.storage.from("host-assets").upload(path,file,{upsert:true}).then(function(res){
      if(!res.error){
        var url=supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
        setBrandLogoUrl(url);
        return supabase.from("host_profiles").update({logo_url:url}).eq("user_id",currentUser?currentUser.id:"");
      }else{
        toast("Logo upload failed: "+res.error.message,"error");
      }
    });
  }

  var [brandSaved,setBrandSaved]=useState(false);
  var [announceMsg,setAnnounceMsg]=useState("");
  var [announceTo,setAnnounceTo]=useState("all");
  var [announcements,setAnnouncements]=useState(hostAnnouncements||[]);
  var [selectedT,setSelectedT]=useState(null);

  function submitWizard(){
    if(!wizData.name.trim()||!wizData.date.trim()){toast("Name and date required","error");return;}
    setWizCreating(true);
    var newT={id:Date.now(),name:wizData.name,date:wizData.date,size:wizData.maxPlayers,invite:wizData.inviteOnly,entryFee:wizData.entryFee,rules:wizData.rules,status:wizData.entryFee?"pending_approval":"upcoming",registered:0,approved:!wizData.entryFee};
    setTournaments(function(ts){return ts.concat([newT]);});
    if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.concat([{id:"host-"+newT.id,name:wizData.name,host:brandName,sponsor:null,status:"upcoming",date:wizData.date,time:"TBD",format:wizData.type==="swiss"?"Swiss":"Standard",size:wizData.maxPlayers,registered:0,registeredIds:[],prizePool:null,region:"",description:wizData.rules||"Tournament hosted by "+brandName,tags:wizData.inviteOnly?["Invite Only"]:["Open"],logo:brandLogo,screen:"tournament-host-"+newT.id,hostTournamentId:newT.id}]);});}
    if(supabase.from){
      supabase.from("tournaments").insert({
        name:wizData.name,
        date:wizData.date,
        type:wizData.type,
        total_games:wizData.totalGames,
        max_players:wizData.maxPlayers,
        host_id:currentUser?currentUser.id:null,
        branding_json:{accent_color:wizData.accentColor}
      }).select().single().then(function(res){
        setWizCreating(false);
        if(res&&res.error){console.error("[TFT] wizard tournament create failed:",res.error);}
        else if(res&&res.data){
          var dbId=res.data.id;
          setTournaments(function(ts){return ts.map(function(t){return t.name===wizData.name&&!t.dbId?Object.assign({},t,{dbId:dbId}):t;});});
          if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.map(function(ev){return ev.name===wizData.name&&!ev.dbTournamentId?Object.assign({},ev,{dbTournamentId:dbId}):ev;});});}
        }
      });
    }else{
      setWizCreating(false);
    }
    setShowCreate(false);
    setWizStep(0);
    setWizData({name:"",date:"",type:"swiss",totalGames:3,maxPlayers:32,accentColor:"#9B72CF",entryFee:"",inviteOnly:false,rules:""});
    toast(wizData.entryFee?"Tournament created - pending admin approval":"Tournament created!","success");
  }

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
          return supabase.from("tournaments").insert({name:tName,date:tDate,format:"swiss",max_players:parseInt(tSize),invite_only:tInvite,entry_fee:tEntryFee||null,rules_text:tRules||null,host_profile_id:hpId,description:tRules||"Host tournament by "+brandName,region:""}).select().single();
        }).then(function(res){
          if(res&&res.error)console.error("[TFT] Failed to create tournament:",res.error);
          else if(res&&res.data){
            var dbId=res.data.id;
            setTournaments(function(ts){return ts.map(function(t){return t.name===tName&&!t.dbId?Object.assign({},t,{dbId:dbId}):t;});});
            if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.map(function(ev){return ev.name===tName&&!ev.dbTournamentId?Object.assign({},ev,{dbTournamentId:dbId}):ev;});});}
          }
        });
    }
    setShowCreate(false);setTName("");setTDate("");setTEntryFee("");setTRules("");setTInvite(false);
    toast(tEntryFee?"Tournament created  -  pending admin approval for entry fee":"Tournament created!","success");
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
  var completedTournaments=tournaments.filter(function(t){return t.status==="complete";});
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
          if(updates.status==="complete"){feUpdates.status="complete";if(updates.champion)feUpdates.champion=updates.champion;if(updates.top4)feUpdates.top4=updates.top4;}
          return Object.assign({},ev,feUpdates);
        }
        return ev;
      });});
    }
  }

  var TABS=[["overview","Overview"],["tournaments","Tournaments"],["analytics","Analytics"],["game-flow","Game Flow"],["registrations","Players"],["announce","Announce"],["branding","Branding"]];

  return(
    <div className="page wrap">

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <span style={{fontSize:24}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[brandLogo]||brandLogo)})}</span>
            <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>{brandName}</h2>
            <Tag color="#9B72CF">{React.createElement("i",{className:"ti ti-device-gamepad-2"})} Host</Tag>
            {liveTournaments.length>0&&(
              <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#6EE7B7"}}>
                <span style={{width:4,height:4,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite",display:"inline-block"}}/>LIVE
              </span>
            )}
          </div>
          <p style={{fontSize:13,color:"#BECBD9",margin:0}}>Host Dashboard  -  manage tournaments, players, and branding.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="dark" s="sm" onClick={function(){setScreen("featured");}}>{"← "} Featured</Btn>
          <Btn v="primary" onClick={function(){setShowCreate(function(s){return !s;})}}>{showCreate?"Cancel":"+ New Tournament"}</Btn>
        </div>
      </div>

      {/* Tournament creation wizard */}
      {showCreate&&(
        <Panel style={{padding:"20px",marginBottom:20,border:"1px solid rgba(232,168,56,.25)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",margin:0}}>New Tournament</h3>
            <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
              {["Basics","Format","Branding","Review"].map(function(label,i){
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:wizStep===i?"#9B72CF":wizStep>i?"#4ECDC4":"rgba(255,255,255,.08)",border:"1px solid "+(wizStep===i?"rgba(155,114,207,.6)":wizStep>i?"rgba(78,205,196,.4)":"rgba(242,237,228,.1)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:wizStep>=i?"#fff":"#9AAABF",transition:"all .2s"}}>{wizStep>i?"✓":(i+1)}</div>
                    <span style={{fontSize:10,color:wizStep===i?"#C4B5FD":"#9AAABF",fontWeight:wizStep===i?700:400,display:wizStep===i?"inline":"none"}}>{label}</span>
                    {i<3&&<div style={{width:16,height:1,background:wizStep>i?"rgba(78,205,196,.4)":"rgba(242,237,228,.08)"}}/>}
                  </div>
                );
              })}
            </div>
          </div>

          {wizStep===0&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Tournament Name</div>
                  <Inp value={wizData.name} onChange={function(v){setWizData(function(d){return Object.assign({},d,{name:v});});}} placeholder="e.g. Weekly Clash #15"/>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Date</div>
                  <Inp value={wizData.date} onChange={function(v){setWizData(function(d){return Object.assign({},d,{date:v});});}} placeholder="Mar 24 2026"/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn v="dark" s="sm" onClick={function(){setShowCreate(false);setWizStep(0);}}>Cancel</Btn>
                <Btn v="primary" s="sm" onClick={function(){if(!wizData.name.trim()||!wizData.date.trim()){toast("Name and date required","error");return;}setWizStep(1);}}>Next - Format</Btn>
              </div>
            </div>
          )}

          {wizStep===1&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Format</div>
                  <Sel value={wizData.type} onChange={function(v){setWizData(function(d){return Object.assign({},d,{type:v});});}}>
                    <option value="swiss">Swiss</option>
                    <option value="standard">Standard</option>
                  </Sel>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Games per Player</div>
                  <Sel value={String(wizData.totalGames)} onChange={function(v){setWizData(function(d){return Object.assign({},d,{totalGames:parseInt(v)});});}}>
                    {[2,3,4,5,6,7,8].map(function(n){return <option key={n} value={n}>{n+" games"}</option>;})}
                  </Sel>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Max Players</div>
                  <Sel value={String(wizData.maxPlayers)} onChange={function(v){setWizData(function(d){return Object.assign({},d,{maxPlayers:parseInt(v)});});}}>
                    {[8,16,24,32,48,64,96,126,128].map(function(n){return <option key={n} value={n}>{n+" players"}</option>;})}
                  </Sel>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Entry Fee <span style={{color:"#9AAABF",fontWeight:400}}>(admin approval)</span></div>
                  <Inp value={wizData.entryFee} onChange={function(v){setWizData(function(d){return Object.assign({},d,{entryFee:v});});}} placeholder="Leave blank = free"/>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Custom Rules <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
                <textarea value={wizData.rules} onChange={function(e){var v=e.target.value;setWizData(function(d){return Object.assign({},d,{rules:v});});}} placeholder="Any special rules or format notes..."
                  style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:60,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div onClick={function(){setWizData(function(d){return Object.assign({},d,{inviteOnly:!d.inviteOnly});});}} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <div style={{width:36,height:20,borderRadius:99,background:wizData.inviteOnly?"rgba(155,114,207,.3)":"rgba(255,255,255,.08)",border:"1px solid "+(wizData.inviteOnly?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),position:"relative",transition:"all .2s"}}>
                    <div style={{width:14,height:14,borderRadius:"50%",background:wizData.inviteOnly?"#C4B5FD":"#9AAABF",position:"absolute",top:2,left:wizData.inviteOnly?18:2,transition:"left .2s"}}/>
                  </div>
                  <span style={{fontSize:13,color:"#C8D4E0"}}>Invite-only registration</span>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn v="dark" s="sm" onClick={function(){setWizStep(0);}}>Back</Btn>
                <Btn v="primary" s="sm" onClick={function(){setWizStep(2);}}>Next - Branding</Btn>
              </div>
            </div>
          )}

          {wizStep===2&&(
            <div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:8}}>Tournament Accent Color</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                  {["#9B72CF","#4ECDC4","#E8A838","#F87171","#6EE7B7","#60A5FA","#FB923C"].map(function(c){
                    return(
                      <div key={c} onClick={function(){setWizData(function(d){return Object.assign({},d,{accentColor:c});});}}
                        style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:wizData.accentColor===c?"3px solid #fff":"3px solid transparent",transition:"border .15s"}}/>
                    );
                  })}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="color" value={wizData.accentColor} onChange={function(e){var v=e.target.value;setWizData(function(d){return Object.assign({},d,{accentColor:v});});}} style={{width:36,height:32,borderRadius:6,border:"1px solid rgba(242,237,228,.12)",background:"transparent",cursor:"pointer",padding:2}}/>
                  <span style={{fontSize:12,color:"#9AAABF",fontFamily:"monospace"}}>{wizData.accentColor}</span>
                </div>
              </div>
              <div style={{background:"rgba(255,255,255,.02)",border:"1px solid "+wizData.accentColor+"44",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
                <div style={{fontSize:11,color:"#9AAABF",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em"}}>Preview</div>
                <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{wizData.name||"Tournament Name"}</div>
                <div style={{fontSize:12,color:wizData.accentColor,fontWeight:600,marginTop:2}}>{wizData.type==="swiss"?"Swiss":"Standard"} - {wizData.maxPlayers} players</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn v="dark" s="sm" onClick={function(){setWizStep(1);}}>Back</Btn>
                <Btn v="primary" s="sm" onClick={function(){setWizStep(3);}}>Review</Btn>
              </div>
            </div>
          )}

          {wizStep===3&&(
            <div>
              <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.08)",borderRadius:10,padding:"16px",marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:12}}>{wizData.name}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[["Date",wizData.date],["Format",wizData.type==="swiss"?"Swiss":"Standard"],["Games",String(wizData.totalGames)+" per player"],["Max Players",String(wizData.maxPlayers)],["Entry Fee",wizData.entryFee||"Free"],["Invite Only",wizData.inviteOnly?"Yes":"No"]].map(function(arr){
                    return(
                      <div key={arr[0]} style={{background:"rgba(255,255,255,.02)",borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:"#9AAABF",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{arr[0]}</div>
                        <div style={{fontSize:13,color:"#F2EDE4",fontWeight:600}}>{arr[1]}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}>
                  <div style={{width:16,height:16,borderRadius:"50%",background:wizData.accentColor}}/>
                  <span style={{fontSize:12,color:"#9AAABF",fontFamily:"monospace"}}>{wizData.accentColor}</span>
                </div>
              </div>
              {wizData.entryFee&&(
                <div style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#E8A838"}}>
                  {React.createElement("i",{className:"ti ti-alert-triangle",style:{color:"#E8A838"}})} Entry fee tournaments require admin approval before going live.
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <Btn v="dark" s="sm" onClick={function(){setWizStep(2);}}>Back</Btn>
                <Btn v="primary" onClick={submitWizard} disabled={wizCreating}>{wizCreating?"Creating...":"Create Tournament"}</Btn>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",whiteSpace:"nowrap",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none",flexWrap:"nowrap"}}>
        {TABS.map(function(arr){
          var t=arr[0],label=arr[1];
          return <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={function(){setTab(t);}} style={{flexShrink:0,whiteSpace:"nowrap"}}>{label}</Btn>;
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
                  <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite",display:"inline-block"}}/>LIVE
                </span>
                <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>Active Tournament</span>
              </div>
              {liveTournaments.map(function(t){
                return(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:4}}>{t.name}</div>
                      <div style={{fontSize:12,color:"#BECBD9",marginBottom:8}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["calendar-event-fill"]||"calendar-event-fill")})} {t.date} · {React.createElement("i",{className:"ti ti-"+(ICON_REMAP["people-fill"]||"people-fill")})} {t.registered}/{t.size} players</div>
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
              <Btn v="ghost" s="sm" onClick={function(){setTab("announce");}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["megaphone-fill"]||"megaphone-fill")})} Announce</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setTab("branding");}}>{React.createElement("i",{className:"ti ti-palette"})} Edit Branding</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setScreen("bracket");}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["diagram-3-fill"]||"diagram-3-fill")})} View Bracket</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setScreen("featured");}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["star-fill"]||"star-fill")})} Featured Page</Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* Tournaments tab */}
      {tab==="tournaments"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {tournaments.map(function(t){
            var statusColor=t.status==="live"?"#6EE7B7":t.status==="upcoming"?"#4ECDC4":t.status==="pending_approval"?"#E8A838":"#BECBD9";
            var statusLabel=t.status==="live"?"Live":t.status==="upcoming"?"Upcoming":t.status==="pending_approval"?"Pending":"Completed";
            return(
              <Panel key={t.id} style={{padding:"18px",border:t.status==="live"?"1px solid rgba(82,196,124,.25)":"1px solid rgba(242,237,228,.07)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{t.name}</span>
                      <Tag color={statusColor} size="sm">{statusLabel}</Tag>
                      {t.invite&&<Tag color="#9B72CF" size="sm">{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["lock-fill"]||"lock-fill")})} Invite Only</Tag>}
                      {t.entryFee&&<Tag color="#EAB308" size="sm">{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["tag-fill"]||"tag-fill")})} {t.entryFee}</Tag>}
                    </div>
                    <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["calendar-event-fill"]||"calendar-event-fill")})} {t.date} · {React.createElement("i",{className:"ti ti-"+(ICON_REMAP["people-fill"]||"people-fill")})} {t.registered}/{t.size} registered</div>
                    <Bar val={t.registered} max={t.size} color="#E8A838" h={4}/>
                    <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{t.size-t.registered} spots remaining</div>
                    {t.rules&&<div style={{fontSize:11,color:"#9AAABF",marginTop:6,fontStyle:"italic"}}>{React.createElement("i",{className:"ti ti-clipboard"})} {t.rules}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
                    {t.status==="upcoming"&&<Btn v="ghost" s="sm" onClick={function(){updateTournamentAndFeatured(t.id,{status:"live"});toast("Check-in opened! Tournament is now LIVE","success");}}>{"Open Check-In"}</Btn>}
                    {t.status==="live"&&<Btn v="ghost" s="sm" onClick={function(){updateTournamentAndFeatured(t.id,{status:"closed"});toast("Registration closed","info");}}>{"Close Registration"}</Btn>}
                    {(t.status==="live"||t.status==="closed")&&<Btn v="primary" s="sm" onClick={function(){var champ=prompt("Enter champion name:");if(champ&&champ.trim()){updateTournamentAndFeatured(t.id,{status:"complete",champion:champ.trim(),top4:[champ.trim()]});toast("Tournament completed! Champion: "+champ.trim(),"success");}else{toast("Cancelled","info");}}}>{"Complete"}</Btn>}
                    {t.status==="pending_approval"&&<span style={{fontSize:11,color:"#E8A838",fontWeight:600,padding:"5px 0"}}>{"Awaiting Approval"}</span>}
                    {t.status==="complete"&&<Btn v="ghost" s="sm" onClick={function(){setScreen("tournament-host-"+t.id);}}>{"View Details"}</Btn>}
                    <Btn v="ghost" s="sm" onClick={function(){if(confirm("Delete this tournament?")){setTournaments(function(ts){return ts.filter(function(x){return x.id!==t.id;});});if(setFeaturedEvents){setFeaturedEvents(function(evts){return evts.filter(function(ev){return ev.hostTournamentId!==t.id;});});}toast("Tournament deleted","info");}}} style={{color:"#F87171"}}>{"Delete"}</Btn>
                  </div>
                </div>
              </Panel>
            );
          })}
          {tournaments.length===0&&(
            <div style={{textAlign:"center",padding:"48px",color:"#BECBD9"}}>
              <div style={{fontSize:32,marginBottom:12}}>{React.createElement("i",{className:"ti ti-device-gamepad-2"})}</div>
              <div style={{fontSize:14}}>No tournaments yet. Create your first one above.</div>
            </div>
          )}
        </div>
      )}

      {/* Analytics tab */}
      {tab==="analytics"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
            {[["Total Hosted",""+totalHosted,"#E8A838"],["Players Hosted",""+totalPlayers,"#6EE7B7"],["Completed",""+completedTournaments.length,"#4ECDC4"],["Upcoming",""+upcomingTournaments.length,"#9B72CF"]].map(function(arr){
              var l=arr[0],v=arr[1],c=arr[2];
              return(
                <Panel key={l} style={{padding:"18px",textAlign:"center"}}>
                  <div className="mono" style={{fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                  <div className="cond" style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:6,letterSpacing:".06em"}}>{l}</div>
                </Panel>
              );
            })}
          </div>
          <Panel style={{padding:"18px",marginBottom:16}}>
            <h3 style={{fontSize:14,fontWeight:700,color:"#F2EDE4",marginBottom:14}}>{React.createElement("i",{className:"ti ti-chart-bar"})} Tournament History</h3>
            {tournaments.length===0&&(
              <div style={{textAlign:"center",padding:"32px",color:"#BECBD9"}}>
                <div style={{fontSize:32,marginBottom:10}}>{React.createElement("i",{className:"ti ti-device-gamepad-2"})}</div>
                <div style={{fontSize:13}}>No tournament data yet. Create your first tournament to see analytics here.</div>
              </div>
            )}
            {tournaments.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {tournaments.map(function(t){
                  var fillPct=t.size>0?Math.round((t.registered/t.size)*100):0;
                  var statusColor=t.status==="live"?"#6EE7B7":t.status==="complete"?"#E8A838":t.status==="pending_approval"?"#FB923C":"#4ECDC4";
                  var statusLabel=t.status==="live"?"Live":t.status==="complete"?"Completed":t.status==="pending_approval"?"Pending":"Upcoming";
                  return(
                    <div key={t.id} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(242,237,228,.06)",borderRadius:10,padding:"14px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,fontSize:14,color:"#F2EDE4",flex:1}}>{t.name}</span>
                        <Tag color={statusColor} size="sm">{statusLabel}</Tag>
                        <span style={{fontSize:11,color:"#9AAABF"}}>{t.date}</span>
                      </div>
                      <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:100}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                            <span style={{fontSize:10,color:"#BECBD9"}}>Fill rate</span>
                            <span style={{fontSize:10,fontWeight:700,color:"#E8A838"}}>{t.registered+"/"+t.size+" ("+fillPct+"%)"}</span>
                          </div>
                          <Bar val={t.registered} max={t.size} color="#E8A838" h={4}/>
                        </div>
                        {t.status==="complete"&&t.champion&&(
                          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.15)",borderRadius:8,padding:"4px 10px"}}>
                            {React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838",fontSize:13}})}
                            <span style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>{t.champion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel style={{padding:"18px"}}>
            <h3 style={{fontSize:14,fontWeight:700,color:"#F2EDE4",marginBottom:12}}>{React.createElement("i",{className:"ti ti-trending-up"})} Performance Summary</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:"rgba(255,255,255,.02)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:"#9AAABF",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>Avg Fill Rate</div>
                <div className="mono" style={{fontSize:22,fontWeight:700,color:"#6EE7B7"}}>
                  {tournaments.length===0?"--":Math.round(tournaments.reduce(function(s,t){return s+(t.size>0?(t.registered/t.size):0);},0)/tournaments.length*100)+"%"}
                </div>
              </div>
              <div style={{background:"rgba(255,255,255,.02)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:"#9AAABF",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>Completed Events</div>
                <div className="mono" style={{fontSize:22,fontWeight:700,color:"#4ECDC4"}}>{completedTournaments.length}</div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Game Flow tab  -  enter results per round */}
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
                            updateTournamentAndFeatured(t.id,{status:"complete",champion:champ.trim(),top4:[champ.trim()]});
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
          {tournaments.filter(function(t){return t.status!=="complete";}).map(function(t){
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
            <Btn v="primary" onClick={sendAnnouncement}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["megaphone-fill"]||"megaphone-fill")})} Send Announcement</Btn>
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
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:18}}>{React.createElement("i",{className:"ti ti-palette"})} Host Branding</h3>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap",marginBottom:24}}>
            {/* Preview card */}
            <div style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid "+brandColor+"55",borderRadius:14,padding:"16px 20px",minWidth:220,flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:10,background:brandColor+"22",border:"1px solid "+brandColor+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP[brandLogo]||brandLogo)})}</div>
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
              <Inp value={brandLogo} onChange={setBrandLogo} placeholder="e.g. icon names: controller, trophy-fill"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:8}}>Brand Color</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                {["#9B72CF","#4ECDC4","#E8A838","#F87171","#6EE7B7","#60A5FA","#FB923C"].map(function(c){
                  return(
                    <div key={c} onClick={function(){setBrandColor(c);}}
                      style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:brandColor===c?"3px solid #fff":"3px solid transparent",transition:"border .15s"}}/>
                  );
                })}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="color" value={brandColor} onChange={function(e){setBrandColor(e.target.value);}} style={{width:36,height:32,borderRadius:6,border:"1px solid rgba(242,237,228,.12)",background:"transparent",cursor:"pointer",padding:2}}/>
                <Inp value={brandColor} onChange={setBrandColor} placeholder="#9B72CF" style={{maxWidth:120,fontFamily:"monospace"}}/>
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
  var isCompleted=event.status==="complete";
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
            {isLive&&<span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}><span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite",display:"inline-block"}}/>{"LIVE"}</span>}
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



// ─── TOURNAMENTS LIST SCREEN ──────────────────────────────────────────

function TournamentsListScreen({setScreen,currentUser,toast}){
  var [tournaments,setTournaments]=useState([]);
  var [loading,setLoading]=useState(true);

  useEffect(function(){
    supabase.from('tournaments').select('*').eq('type','flash_tournament').order('date',{ascending:false}).then(function(res){
      if(res.data)setTournaments(res.data);
      setLoading(false);
    });
  },[]);

  // Count registrations per tournament
  var [regCounts,setRegCounts]=useState({});
  useEffect(function(){
    if(tournaments.length===0)return;
    var ids=tournaments.map(function(t){return t.id;});
    supabase.from('registrations').select('tournament_id').in('tournament_id',ids).then(function(res){
      if(!res.data)return;
      var counts={};
      res.data.forEach(function(r){counts[r.tournament_id]=(counts[r.tournament_id]||0)+1;});
      setRegCounts(counts);
    });
  },[tournaments]);

  var phaseColors={draft:"#9AAABF",registration:"#9B72CF",check_in:"#E8A838",in_progress:"#52C47C",complete:"#4ECDC4"};
  var phaseLabels={draft:"Draft",registration:"Registration Open",check_in:"Check-In Open",in_progress:"In Progress",complete:"Completed"};

  return(
    <div className="page wrap">
      <div style={{marginBottom:28}}>
        <h1 style={{color:"#F2EDE4",fontSize:24,fontWeight:700,margin:0,marginBottom:6}}>Tournaments</h1>
        <p style={{color:"#BECBD9",fontSize:13,margin:0}}>Flash tournaments, competitive events, and community clashes. Free to enter, play to win.</p>
      </div>

      {loading&&<div style={{textAlign:"center",padding:"60px 0",color:"#8896A8"}}>Loading tournaments...</div>}

      {!loading&&tournaments.length===0&&(
        <Panel style={{padding:"48px 20px",textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:12}}>{React.createElement("i",{className:"ti ti-bolt"})}</div>
          <div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:6}}>No Tournaments Yet</div>
          <div style={{fontSize:13,color:"#9AAABF",lineHeight:1.5}}>Flash tournaments will appear here when admins create them.</div>
        </Panel>
      )}

      {!loading&&tournaments.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
          {tournaments.map(function(t){
            var regCount=regCounts[t.id]||0;
            var maxP=t.max_players||128;
            var pct=Math.min(100,Math.round((regCount/maxP)*100));
            var dateStr=t.date?new Date(t.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"TBD";
            var prizes=Array.isArray(t.prize_pool_json)?t.prize_pool_json:[];
            // Status badge styles
            var phaseBadgeBg={draft:"rgba(154,170,191,.1)",registration:"rgba(155,114,207,.15)",check_in:"rgba(232,168,56,.15)",in_progress:"rgba(82,196,124,.15)",complete:"rgba(78,205,196,.15)"};
            var phaseBadgeColor={draft:"#9AAABF",registration:"#9B72CF",check_in:"#E8A838",in_progress:"#52C47C",complete:"#4ECDC4"};
            var badgeBg=phaseBadgeBg[t.phase]||"rgba(154,170,191,.1)";
            var badgeColor=phaseBadgeColor[t.phase]||"#9AAABF";
            // Countdown timer
            var now=new Date();
            var tDate=t.date?new Date(t.date):null;
            var diff=tDate?(tDate-now):0;
            var countdownStr="";
            if(diff>0){
              var days=Math.floor(diff/86400000);
              var hours=Math.floor((diff%86400000)/3600000);
              var mins=Math.floor((diff%3600000)/60000);
              countdownStr=days>0?(days+"d "+hours+"h"):(hours>0?(hours+"h "+mins+"m"):(mins+"m"));
            }
            return(
              <div key={t.id} onClick={function(){setScreen("flash-"+t.id);}} style={{background:"rgba(17,24,39,.85)",border:"1px solid rgba(242,237,228,.06)",borderRadius:12,padding:"20px",cursor:"pointer",transition:"border-color .2s, transform .15s"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,fontWeight:700,color:badgeColor,background:badgeBg,borderRadius:20,padding:"3px 10px",letterSpacing:".4px",textTransform:"uppercase"}}>{phaseLabels[t.phase]||t.phase}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {countdownStr&&(
                      <span style={{fontSize:11,fontWeight:700,color:"#E8A838",background:"rgba(232,168,56,.1)",borderRadius:12,padding:"2px 8px",border:"1px solid rgba(232,168,56,.2)"}}>{"\u23F0 "+countdownStr}</span>
                    )}
                    <span style={{fontSize:11,color:"#8896A8"}}>{dateStr}</span>
                  </div>
                </div>
                <div style={{fontWeight:700,fontSize:17,color:"#F2EDE4",marginBottom:8}}>{t.name}</div>
                {prizes.length>0&&(
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                    {prizes.slice(0,3).map(function(p,i){
                      return <span key={i} style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.2)",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#E8A838",fontWeight:600}}>{"#"+p.placement+" "+p.prize}</span>;
                    })}
                  </div>
                )}
                <div style={{marginBottom:6}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#BECBD9",marginBottom:4}}>
                    <span>{regCount+" / "+maxP+" players"}</span>
                    <span>{pct+"%"}</span>
                  </div>
                  <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,.06)"}}>
                    <div style={{height:4,borderRadius:2,background:pct>=90?"#F87171":pct>=60?"#E8A838":"#9B72CF",width:pct+"%",transition:"width .3s"}}/>
                  </div>
                </div>
                <div style={{fontSize:12,color:"#8896A8"}}>{(t.round_count||3)+" games \u00B7 "+(t.seeding_method||"snake")+" seeding"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── FLASH TOURNAMENT SCREEN ──────────────────────────────────────────

function FlashTournamentScreen({tournamentId,currentUser,onAuthClick,toast,setScreen,players,isAdmin}){
  var [tournament,setTournament]=useState(null);
  var [registrations,setRegistrations]=useState([]);
  var [lobbies,setLobbies]=useState([]);
  var [lobbyCodeInputs,setLobbyCodeInputs]=useState({});
  var [loading,setLoading]=useState(true);
  var [activeTab,setActiveTab]=useState("info");
  var [actionLoading,setActionLoading]=useState(false);
  var [reports,setReports]=useState([]);
  var [myPlacement,setMyPlacement]=useState(0);
  var [disputeForm,setDisputeForm]=useState({open:false,lobbyId:null,claimed:0,reason:"",screenshotUrl:""});
  var [disputes,setDisputes]=useState([]);
  var [gameResults,setGameResults]=useState([]);
  var channelRef=useRef(null);

  function loadTournament(){
    return supabase.from('tournaments').select('*').eq('id',tournamentId).single().then(function(res){
      if(res.data)setTournament(res.data);
      return res;
    });
  }

  function loadRegistrations(){
    return supabase.from('registrations').select('*, players(username, riot_id, rank, region)').eq('tournament_id',tournamentId).then(function(res){
      if(res.data)setRegistrations(res.data);
      return res;
    });
  }

  function loadLobbies(){
    return supabase.from('lobbies').select('*').eq('tournament_id',tournamentId).order('lobby_number',{ascending:true}).then(function(res){
      if(res.data)setLobbies(res.data);
      return res;
    });
  }

  function loadReports(){
    var gameNum=tournament?(tournament.current_round||1):1;
    return supabase.from('player_reports').select('*').eq('tournament_id',tournamentId).eq('game_number',gameNum)
      .then(function(res){
        if(res.data)setReports(res.data);
        return res;
      });
  }

  function loadDisputes(){
    return supabase.from('disputes').select('*, players(username)').eq('tournament_id',tournamentId)
      .then(function(res){
        if(res.data)setDisputes(res.data);
        return res;
      });
  }

  function loadResults(){
    return supabase.from('game_results')
      .select('player_id, placement, points, game_number, players(username, rank, riot_id)')
      .eq('tournament_id',tournamentId)
      .order('game_number')
      .then(function(res){
        if(res.data)setGameResults(res.data);
        return res;
      });
  }

  useEffect(function(){
    Promise.all([loadTournament(),loadRegistrations(),loadLobbies(),loadDisputes(),loadResults()]).then(function(){setLoading(false);}).catch(function(e){console.error("[Flash] Initial load failed:",e);setLoading(false);});
  },[tournamentId]);

  useEffect(function(){
    if(tournament)loadReports();
  },[tournament&&tournament.current_round,tournament&&tournament.id]);

  useEffect(function(){
    if(!tournamentId)return;
    var channel=supabase.channel("tournament-"+tournamentId);
    channelRef.current=channel;
    channel.on("broadcast",{event:"update"},function(payload){
      var type=payload.payload?payload.payload.type:"";
      if(type==="phase_change")loadTournament();
      if(type==="registration")loadRegistrations();
      if(type==="lobbies_generated")loadLobbies();
      if(type==="report_submitted")loadReports();
      if(type==="lobby_locked"){loadLobbies();loadResults();}
      if(type==="next_game"){loadTournament();loadLobbies();loadReports();}
      if(type==="finalized"){loadTournament();loadResults();}
    });
    channel.subscribe();
    return function(){supabase.removeChannel(channel);channelRef.current=null;};
  },[tournamentId]);

  function broadcastUpdate(type){
    if(channelRef.current){
      channelRef.current.send({type:"broadcast",event:"update",payload:{type:type}});
    }
  }

  // Rank color map
  var rankColors={Iron:"#5A6573",Bronze:"#CD7F32",Silver:"#C0C0C0",Gold:"#E8A838",Platinum:"#4ECDC4",Emerald:"#52C47C",Diamond:"#93B5F7",Master:"#9B72CF",Grandmaster:"#DC2626",Challenger:"#F59E0B"};

  // Look up a player by id from the players prop
  function getPlayerById(pid){
    return players.find(function(p){return p.id===pid;})||{username:"Unknown",rank:"Iron"};
  }

  // Submit lobby code
  function submitLobbyCode(lobbyId,code){
    supabase.from('lobbies').update({lobby_code:code}).eq('id',lobbyId).then(function(res){
      if(res.error){toast("Failed to save code","error");return;}
      toast("Lobby code saved!","success");
      loadLobbies();
    });
  }

  // Admin: Generate lobbies
  function generateLobbies(){
    setActionLoading(true);
    supabase.from('registrations').select('player_id, players(id, username, rank, riot_id, region)')
      .eq('tournament_id',tournamentId)
      .eq('status','checked_in')
      .then(function(res){
        if(res.error||!res.data){toast("Failed to load players","error");setActionLoading(false);return;}
        var checkedIn=res.data.map(function(r){return r.players;}).filter(Boolean);
        var result=buildFlashLobbies(checkedIn,tournament.seeding_method||"snake");
        var lobbyRows=result.lobbies.map(function(lobbyPlayers,idx){
          var host=lobbyPlayers.reduce(function(best,p){
            return RANKS.indexOf(p.rank||"Iron")>RANKS.indexOf(best.rank||"Iron")?p:best;
          },lobbyPlayers[0]);
          return{
            tournament_id:tournamentId,
            round_number:1,
            lobby_number:idx+1,
            player_ids:lobbyPlayers.map(function(p){return p.id;}),
            host_player_id:host?host.id:null,
            status:'pending',
            game_number:1
          };
        });
        supabase.from('lobbies').insert(lobbyRows).select().then(function(lRes){
          setActionLoading(false);
          if(lRes.error){toast("Failed: "+lRes.error.message,"error");return;}
          supabase.from('tournaments').update({phase:'in_progress',started_at:new Date().toISOString(),current_round:1})
            .eq('id',tournamentId).then(function(){
              setTournament(Object.assign({},tournament,{phase:'in_progress',current_round:1}));
            });
          toast(result.lobbies.length+" lobbies generated!","success");
          broadcastUpdate("lobbies_generated");
          loadLobbies();
          // Notify each checked-in player of their lobby assignment
          supabase.from('registrations').select('players(auth_user_id)').eq('tournament_id',tournamentId).eq('status','checked_in').then(function(rRes){
            if(rRes.data){rRes.data.forEach(function(r){var uid=r.players&&r.players.auth_user_id;if(uid){createNotification(uid,"Lobby Assigned","Your lobby has been assigned for "+(tournament?tournament.name:"the tournament")+". Check your lobby now!","trophy");}});}
          });
        });
      });
  }

  // Derived state
  var myPlayer=currentUser?players.find(function(p){return p.authUserId===currentUser.id;}):null;
  var myReg=myPlayer?registrations.find(function(r){return r.player_id===myPlayer.id;}):null;
  var regCount=registrations.filter(function(r){return r.status==='registered'||r.status==='checked_in';}).length;
  var currentGameNumber=tournament?(tournament.current_round||1):1;
  var myLobby=lobbies.find(function(l){return l.player_ids&&l.player_ids.indexOf(myPlayer?myPlayer.id:null)!==-1;});
  var myReport=myPlayer?reports.find(function(r){return r.player_id===myPlayer.id;}):null;
  var openDisputeCount=disputes.filter(function(d){return d.status==='open';}).length;
  var myDisputes=myPlayer?disputes.filter(function(d){return d.player_id===myPlayer.id;}):[];
  var checkedInCount=registrations.filter(function(r){return r.status==='checked_in';}).length;
  var maxP=tournament?tournament.max_players||128:128;
  var phase=tournament?tournament.phase:"draft";
  var prizes=tournament&&Array.isArray(tournament.prize_pool_json)?tournament.prize_pool_json:[];

  // Registration handler
  function handleRegister(){
    if(!currentUser){onAuthClick("login");return;}
    if(!myPlayer||!myPlayer.riotId){
      toast("Set your Riot ID in your profile before registering","error");
      return;
    }
    setActionLoading(true);
    if(regCount>=maxP){
      var waitPos=registrations.filter(function(r){return r.status==='waitlisted';}).length+1;
      supabase.from('registrations').insert({
        tournament_id:tournamentId,
        player_id:myPlayer.id,
        status:'waitlisted',
        waitlist_position:waitPos
      }).then(function(res){
        setActionLoading(false);
        if(res.error){toast("Registration failed: "+res.error.message,"error");return;}
        toast("Added to waitlist (position #"+waitPos+")!","info");
        broadcastUpdate("registration");
        loadRegistrations();
      });
      return;
    }
    supabase.from('registrations').insert({
      tournament_id:tournamentId,
      player_id:myPlayer.id,
      status:'registered'
    }).then(function(res){
      setActionLoading(false);
      if(res.error){toast("Registration failed: "+res.error.message,"error");return;}
      if(currentUser){createNotification(currentUser.id,"Registration Confirmed","You are registered for "+(tournament?tournament.name:"the tournament")+". Check in when the check-in window opens.","controller");}
      toast("Registered!","success");
      broadcastUpdate("registration");
      loadRegistrations();
    });
  }

  // Unregister handler
  function handleUnregister(){
    if(!myReg)return;
    if(!confirm("Are you sure you want to unregister?"))return;
    setActionLoading(true);
    supabase.from('registrations').delete().eq('id',myReg.id).then(function(res){
      setActionLoading(false);
      if(res.error){toast("Failed to unregister: "+res.error.message,"error");return;}
      toast("Unregistered","success");
      broadcastUpdate("registration");
      loadRegistrations();
    });
  }

  // Check-in handler
  function handleCheckIn(){
    if(!myReg)return;
    setActionLoading(true);
    supabase.from('registrations').update({status:'checked_in',checked_in_at:new Date().toISOString()}).eq('id',myReg.id).then(function(res){
      setActionLoading(false);
      if(res.error){toast("Check-in failed: "+res.error.message,"error");return;}
      toast("Checked in!","success");
      broadcastUpdate("registration");
      loadRegistrations();
    });
  }

  // Admin: Open check-in
  function adminOpenCheckIn(){
    supabase.from('tournaments').update({phase:'check_in',checkin_open_at:new Date().toISOString()}).eq('id',tournamentId).then(function(res){
      if(res.error){toast("Failed: "+res.error.message,"error");return;}
      setTournament(Object.assign({},tournament,{phase:'check_in'}));
      toast("Check-in opened!","success");
      broadcastUpdate("phase_change");
      // Notify all registered players
      supabase.from('registrations').select('players(auth_user_id)').eq('tournament_id',tournamentId).eq('status','registered').then(function(rRes){
        if(rRes.data){rRes.data.forEach(function(r){var uid=r.players&&r.players.auth_user_id;if(uid){createNotification(uid,"Check-in is Open","Check in now to secure your spot in "+(tournament?tournament.name:"the tournament")+"!","checkmark");}});}
      });
    });
  }

  // Admin: Close check-in
  function adminCloseCheckIn(){
    var unchecked = registrations.filter(function(r) { return r.status === "registered"; }).length;
    if (unchecked > 0) {
      if (!window.confirm("This will drop " + unchecked + " player" + (unchecked !== 1 ? "s" : "") + " who haven't checked in. Continue?")) return;
    }
    // 1. Set close time
    supabase.from('tournaments').update({checkin_close_at:new Date().toISOString()}).eq('id',tournamentId).then(function(res){
      if(res.error){toast("Failed: "+res.error.message,"error");return;}
      // 2. Drop players who didn't check in
      var notCheckedIn=registrations.filter(function(r){return r.status==='registered';});
      var dropIds=notCheckedIn.map(function(r){return r.id;});
      if(dropIds.length>0){
        supabase.from('registrations').update({status:'dropped'}).in('id',dropIds).then(function(dropRes){
          if(dropRes.error)console.error("Drop failed:",dropRes.error);
          // 3. Promote waitlisted players if spots opened
          var openSpots=maxP-checkedInCount;
          var waitlisted=registrations.filter(function(r){return r.status==='waitlisted';}).sort(function(a,b){return(a.waitlist_position||999)-(b.waitlist_position||999);});
          var toPromote=waitlisted.slice(0,Math.max(0,openSpots));
          if(toPromote.length>0){
            var promoteIds=toPromote.map(function(r){return r.id;});
            supabase.from('registrations').update({status:'checked_in',checked_in_at:new Date().toISOString()}).in('id',promoteIds).then(function(){loadRegistrations();});
          } else {
            loadRegistrations();
          }
        });
      } else {
        loadRegistrations();
      }
      toast("Check-in closed. "+notCheckedIn.length+" player(s) dropped.","success");
      broadcastUpdate("phase_change");
    });
  }

  // Admin: Open registration
  function adminOpenRegistration(){
    supabase.from('tournaments').update({phase:'registration',registration_open_at:new Date().toISOString()}).eq('id',tournamentId).then(function(res){
      if(res.error){toast("Failed: "+res.error.message,"error");return;}
      setTournament(Object.assign({},tournament,{phase:'registration'}));
      toast("Registration opened!","success");
      broadcastUpdate("phase_change");
    });
  }

  // Admin: Start tournament
  function adminStartTournament(){
    supabase.from('tournaments').update({phase:'in_progress',started_at:new Date().toISOString(),current_round:1}).eq('id',tournamentId).then(function(res){
      if(res.error){toast("Failed: "+res.error.message,"error");return;}
      setTournament(Object.assign({},tournament,{phase:'in_progress',current_round:1}));
      toast("Tournament started!","success");
      broadcastUpdate("phase_change");
    });
  }

  // Submit placement report
  function submitReport(placement){
    if(!myPlayer||!myLobby)return;
    supabase.from('player_reports').upsert({
      tournament_id:tournamentId,
      lobby_id:myLobby.id,
      game_number:currentGameNumber,
      player_id:myPlayer.id,
      reported_placement:placement,
      reported_at:new Date().toISOString()
    },{onConflict:'lobby_id,game_number,player_id'})
      .then(function(res){
        if(res.error){toast("Failed to submit: "+res.error.message,"error");return;}
        toast("Placement reported!","success");
        broadcastUpdate("report_submitted");
        setMyPlacement(0);
        loadReports();
      });
  }

  // Submit dispute
  function submitDispute(){
    if(!myPlayer)return;
    supabase.from('disputes').insert({
      tournament_id:tournamentId,
      lobby_id:disputeForm.lobbyId,
      game_number:currentGameNumber,
      player_id:myPlayer.id,
      claimed_placement:disputeForm.claimed,
      reported_placement:myReport?myReport.reported_placement:null,
      reason:disputeForm.reason,
      screenshot_url:disputeForm.screenshotUrl||null,
      status:'open'
    }).then(function(res){
      if(res.error){toast("Dispute failed: "+res.error.message,"error");return;}
      toast("Dispute submitted","success");
      setDisputeForm({open:false,lobbyId:null,claimed:0,reason:"",screenshotUrl:""});
      loadDisputes();
    });
  }

  // Admin: Lock lobby
  function lockLobby(lobbyId){
    var lobbyReports=reports.filter(function(r){return r.lobby_id===lobbyId;});
    var gameRows=lobbyReports.map(function(r){
      return{
        tournament_id:tournamentId,
        lobby_id:lobbyId,
        player_id:r.player_id,
        placement:r.reported_placement,
        points:PTS[r.reported_placement]||0,
        round_number:currentGameNumber,
        game_number:currentGameNumber
      };
    });
    supabase.from('game_results').insert(gameRows).then(function(res){
      if(res.error){toast("Failed to lock: "+res.error.message,"error");return;}
      supabase.from('lobbies').update({status:'locked',reports_complete:true}).eq('id',lobbyId).then(function(){
        toast("Lobby locked!","success");
        broadcastUpdate("lobby_locked");
        loadLobbies();
        loadReports();
        loadResults();
      });
    });
  }

  // Admin: Override a player's placement
  function adminOverridePlacement(lobbyId,playerId,placement){
    supabase.from('player_reports').upsert({
      tournament_id:tournamentId,
      lobby_id:lobbyId,
      game_number:currentGameNumber,
      player_id:playerId,
      reported_placement:placement,
      reported_at:new Date().toISOString()
    },{onConflict:'lobby_id,game_number,player_id'})
      .then(function(res){
        if(res.error){toast("Override failed: "+res.error.message,"error");return;}
        toast("Placement overridden","success");
        loadReports();
      });
  }

  // URL safety check for screenshot links
  function isSafeUrl(url){return url&&(url.indexOf("https://")===0||url.indexOf("http://")===0);}

  // Admin: Resolve dispute
  function resolveDispute(disputeId,accept){
    var d=disputes.find(function(x){return x.id===disputeId;});
    if(!d)return;
    var updates={
      status:accept?'resolved_accepted':'resolved_rejected',
      resolved_by:currentUser?currentUser.id:null,
      resolved_at:new Date().toISOString()
    };
    supabase.from('disputes').update(updates).eq('id',disputeId).then(function(res){
      if(res.error){toast("Failed: "+res.error.message,"error");return;}
      if(accept&&d.claimed_placement){
        supabase.from('player_reports').upsert({
          tournament_id:tournamentId,
          lobby_id:d.lobby_id,
          game_number:d.game_number||currentGameNumber,
          player_id:d.player_id,
          reported_placement:d.claimed_placement,
          reported_at:new Date().toISOString()
        },{onConflict:'lobby_id,game_number,player_id'}).then(function(){
          loadReports();
        });
      }
      toast("Dispute "+(accept?"accepted":"rejected"),"success");
      loadDisputes();
      // Notify the disputing player
      var disputingPlayer=players.find(function(p){return p.id===d.player_id;});
      if(disputingPlayer&&disputingPlayer.authUserId){
        createNotification(disputingPlayer.authUserId,"Dispute "+(accept?"Accepted":"Rejected"),"Your placement dispute has been "+(accept?"accepted. Your placement has been updated.":"rejected. The original result stands."),"bell");
      }
    });
  }

  // Start next game
  function startNextGame(){
    var nextGame=currentGameNumber+1;
    supabase.from('tournaments').update({current_round:nextGame}).eq('id',tournamentId)
      .then(function(res){
        if(res.error){toast("Failed: "+res.error.message,"error");return;}
        var seedMethod=tournament.seeding_method||"snake";
        if(seedMethod==="snake"){
          var checkedIn=registrations.filter(function(r){return r.status==='checked_in';});
          var checkedInPlayers=checkedIn.map(function(r){return r.players||getPlayerById(r.player_id);}).filter(Boolean);
          checkedInPlayers.sort(function(a,b){
            var aStand=standings.find(function(s){return s.id===a.id;});
            var bStand=standings.find(function(s){return s.id===b.id;});
            return((bStand?bStand.totalPts:0)-(aStand?aStand.totalPts:0));
          });
          var result=buildFlashLobbies(checkedInPlayers,"snake");
          var lobbyRows=result.lobbies.map(function(lobbyPlayers,idx){
            var host=lobbyPlayers.reduce(function(best,p){
              return RANKS.indexOf(p.rank||"Iron")>RANKS.indexOf(best.rank||"Iron")?p:best;
            },lobbyPlayers[0]);
            return{
              tournament_id:tournamentId,
              round_number:nextGame,
              lobby_number:idx+1,
              player_ids:lobbyPlayers.map(function(p){return p.id;}),
              host_player_id:host?host.id:null,
              status:'pending',
              game_number:nextGame
            };
          });
          supabase.from('lobbies').insert(lobbyRows).select().then(function(){
            setTournament(Object.assign({},tournament,{current_round:nextGame}));
            loadLobbies();
            loadReports();
            toast("Game "+nextGame+" started! New lobbies generated.","success");
            broadcastUpdate("next_game");
          });
        } else {
          var currentLobbies=lobbies.filter(function(l){return l.game_number===currentGameNumber;});
          var newLobbies=currentLobbies.map(function(l){
            return{
              tournament_id:tournamentId,
              round_number:nextGame,
              lobby_number:l.lobby_number,
              player_ids:l.player_ids,
              host_player_id:l.host_player_id,
              status:'pending',
              game_number:nextGame
            };
          });
          supabase.from('lobbies').insert(newLobbies).select().then(function(){
            setTournament(Object.assign({},tournament,{current_round:nextGame}));
            loadLobbies();
            loadReports();
            toast("Game "+nextGame+" started!","success");
            broadcastUpdate("next_game");
          });
        }
      });
  }

  // Finalize tournament
  function finalizeTournament(){
    if(!confirm("Finalize this tournament? This cannot be undone."))return;
    supabase.from('tournaments').update({phase:'complete',completed_at:new Date().toISOString()})
      .eq('id',tournamentId).then(function(res){
        if(res.error){toast("Failed: "+res.error.message,"error");return;}
        setTournament(Object.assign({},tournament,{phase:'complete'}));
        toast("Tournament finalized!","success");
        broadcastUpdate("finalized");
        // Notify all participants that results are final
        supabase.from('registrations').select('players(auth_user_id)').eq('tournament_id',tournamentId).in('status',['checked_in','registered']).then(function(rRes){
          if(rRes.data){rRes.data.forEach(function(r){var uid=r.players&&r.players.auth_user_id;if(uid){createNotification(uid,"Results Finalized",(tournament?tournament.name:"The tournament")+" has been finalized. Check the results screen for your placement and points.","trophy");}});}
        });
      });
  }

  if(loading){
    return(
      <div className="page wrap" style={{textAlign:"center",paddingTop:80}}>
        <div style={{color:"#8896A8",fontSize:14}}>Loading tournament...</div>
      </div>
    );
  }

  if(!tournament){
    return(
      <div className="page wrap" style={{textAlign:"center",paddingTop:80}}>
        <div style={{fontSize:36,marginBottom:16}}>{React.createElement("i",{className:"ti ti-bolt"})}</div>
        <h2 style={{color:"#F2EDE4",marginBottom:10}}>Tournament Not Found</h2>
        <p style={{color:"#BECBD9"}}>This tournament may have been removed.</p>
        <Btn v="primary" onClick={function(){setScreen("tournaments");}}>Back to Tournaments</Btn>
      </div>
    );
  }

  var phaseColors={draft:"#9AAABF",registration:"#9B72CF",check_in:"#E8A838",in_progress:"#52C47C",complete:"#4ECDC4"};
  var phaseLabels={draft:"Draft",registration:"Registration Open",check_in:"Check-In Open",in_progress:"In Progress",completed:"Completed",complete:"Complete"};
  var dateStr=tournament.date?new Date(tournament.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"TBD";

  // Registration button logic
  var regBtnLabel="Register";
  var regBtnVariant="primary";
  var regBtnAction=handleRegister;
  var regBtnDisabled=false;
  if(myReg&&myReg.status==="registered"&&phase==="check_in"){
    regBtnLabel="Check In";regBtnVariant="success";regBtnAction=handleCheckIn;
  } else if(myReg&&myReg.status==="checked_in"){
    regBtnLabel="Checked In";regBtnVariant="success";regBtnDisabled=true;
  } else if(myReg&&myReg.status==="waitlisted"){
    regBtnLabel="Waitlisted (#"+(myReg.waitlist_position||"?")+")";regBtnVariant="dark";regBtnDisabled=true;
  } else if(myReg&&myReg.status==="registered"){
    regBtnLabel="Registered";regBtnVariant="success";regBtnDisabled=true;
  } else if(phase!=="registration"&&phase!=="check_in"){
    regBtnLabel=phase==="draft"?"Registration Not Open":"Registration Closed";regBtnDisabled=true;regBtnVariant="dark";
  }

  var canUnregister=myReg&&(phase==="registration"||phase==="check_in")&&myReg.status!=="dropped";

  // Compute standings from gameResults
  var standings=[];
  if(gameResults.length>0){
    var _playerMap={};
    gameResults.forEach(function(g){
      if(!_playerMap[g.player_id]){
        var pi=g.players||getPlayerById(g.player_id);
        _playerMap[g.player_id]={
          id:g.player_id,
          name:(pi&&(pi.username||pi.name))||"Unknown",
          rank:(pi&&pi.rank)||"Iron",
          riotId:(pi&&(pi.riot_id||pi.riotId))||"",
          totalPts:0,wins:0,top4:0,games:0,avgPlace:0,placements:[],gameDetails:[]
        };
      }
      var _p=_playerMap[g.player_id];
      _p.totalPts+=(g.points||0);
      _p.games+=1;
      if(g.placement===1)_p.wins+=1;
      if(g.placement<=4)_p.top4+=1;
      _p.placements.push(g.placement);
      _p.gameDetails.push({game:g.game_number,placement:g.placement,points:g.points});
    });
    standings=Object.keys(_playerMap).map(function(k){
      var _p=_playerMap[k];
      _p.avgPlace=_p.games>0?(_p.placements.reduce(function(s,v){return s+v;},0)/_p.games):0;
      return _p;
    });
    standings.sort(function(a,b){
      if(b.totalPts!==a.totalPts)return b.totalPts-a.totalPts;
      var aScore=a.wins*2+a.top4;
      var bScore=b.wins*2+b.top4;
      if(bScore!==aScore)return bScore-aScore;
      for(var _pl=1;_pl<=8;_pl++){
        var aC=a.placements.filter(function(p){return p===_pl;}).length;
        var bC=b.placements.filter(function(p){return p===_pl;}).length;
        if(bC!==aC)return bC-aC;
      }
      return 0;
    });
  }

  // Multi-game admin state
  var currentGameLobbies=lobbies.filter(function(l){return l.game_number===currentGameNumber;});
  var allLobbiesLocked=currentGameLobbies.length>0&&currentGameLobbies.every(function(l){return l.status==='locked';});
  var isLastGame=currentGameNumber>=(tournament&&tournament.round_count?tournament.round_count:3);

  // All unique game numbers played
  var allGameNums=[];
  gameResults.forEach(function(g){if(allGameNums.indexOf(g.game_number)===-1)allGameNums.push(g.game_number);});
  allGameNums.sort(function(a,b){return a-b;});

  // Tabs based on phase
  var tabs=[{id:"info",label:"Info"},{id:"players",label:"Players ("+regCount+")"}];
  if(phase==="in_progress"||phase==="complete"||(phase==="check_in"&&isAdmin)){
    tabs.push({id:"bracket",label:"Lobbies"+(lobbies.length>0?" ("+lobbies.length+")":"")});
  }
  if(phase==="in_progress"||phase==="complete"){
    tabs.push({id:"standings",label:phase==="complete"?"Final Results":"Standings"});
  }

  // Sorted registered players
  var sortedRegs=[].concat(registrations).sort(function(a,b){
    var statusOrder={checked_in:0,registered:1,waitlisted:2,dropped:3};
    return(statusOrder[a.status]||4)-(statusOrder[b.status]||4);
  });

  return(
    <div className="page wrap">
      {/* Back button */}
      <button onClick={function(){setScreen("tournaments");}} style={{background:"none",border:"none",color:"#9B72CF",fontSize:13,fontWeight:600,cursor:"pointer",padding:"0 0 16px 0",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
        {"\u2190 Back to Tournaments"}
      </button>

      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.12),rgba(78,205,196,.08))",border:"1px solid rgba(155,114,207,.2)",borderRadius:16,padding:"28px 24px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:700,color:phaseColors[phase],textTransform:"uppercase",letterSpacing:".5px",background:"rgba(255,255,255,.06)",borderRadius:6,padding:"3px 10px"}}>{phaseLabels[phase]||phase}</span>
          <span style={{fontSize:11,color:"#8896A8"}}>{dateStr}</span>
        </div>
        <h1 style={{color:"#F2EDE4",fontSize:28,fontWeight:700,margin:"0 0 8px 0"}}>{tournament.name}</h1>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:13,color:"#BECBD9"}}>
          <span>{(tournament.round_count||3)+" games"}</span>
          <span>{(tournament.seeding_method||"snake")+" seeding"}</span>
          <span>{maxP+" max players"}</span>
        </div>
      </div>

      {/* Prize pool */}
      {prizes.length>0&&(
        <Panel className="flash-panel" style={{padding:"18px",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,color:"#E8A838",marginBottom:12}}>{"Prize Pool"}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {prizes.map(function(p,i){
              var colors=["#E8A838","#C0C0C0","#CD7F32"];
              var c=colors[i]||"#9B72CF";
              return(
                <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid "+c+"33",borderRadius:10,padding:"12px 18px",minWidth:80,textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:700,color:c,marginBottom:4}}>{"#"+p.placement}</div>
                  <div style={{fontSize:13,color:"#F2EDE4",fontWeight:600}}>{p.prize}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Registration bar */}
      <Panel className="flash-panel" style={{padding:"16px 20px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:"#F2EDE4"}}>{regCount+" / "+maxP}</div>
            <div style={{fontSize:11,color:"#BECBD9"}}>{"players registered"+(phase==="check_in"?" · "+checkedInCount+" checked in":"")}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Btn v={regBtnVariant} onClick={regBtnAction} disabled={regBtnDisabled||actionLoading}>{actionLoading?"...":regBtnLabel}</Btn>
            {canUnregister&&<Btn v="dark" s="sm" onClick={handleUnregister} disabled={actionLoading}>Unregister</Btn>}
          </div>
        </div>
        <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,.06)",marginTop:10}}>
          <div style={{height:4,borderRadius:2,background:"#9B72CF",width:Math.min(100,Math.round((regCount/maxP)*100))+"%",transition:"width .3s"}}/>
        </div>
      </Panel>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid rgba(242,237,228,.06)",paddingBottom:2,overflowX:"auto",whiteSpace:"nowrap",WebkitOverflowScrolling:"touch",msOverflowStyle:"none",scrollbarWidth:"none"}}>
        {tabs.map(function(t){
          var active=activeTab===t.id;
          return(
            <button key={t.id} onClick={function(){setActiveTab(t.id);}} style={{background:active?"rgba(155,114,207,.15)":"transparent",border:"none",borderBottom:active?"2px solid #9B72CF":"2px solid transparent",padding:"8px 16px",fontSize:13,fontWeight:active?700:500,color:active?"#F2EDE4":"#8896A8",cursor:"pointer",fontFamily:"inherit",transition:"all .15s",flexShrink:0,whiteSpace:"nowrap"}}>{t.label}</button>
          );
        })}
      </div>

      {/* Info tab */}
      {activeTab==="info"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Panel style={{padding:"18px"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:10}}>Tournament Details</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
              <div><span style={{color:"#8896A8"}}>Format: </span><span style={{color:"#F2EDE4",fontWeight:600}}>{tournament.seeding_method||"snake"}</span></div>
              <div><span style={{color:"#8896A8"}}>Games: </span><span style={{color:"#F2EDE4",fontWeight:600}}>{tournament.round_count||3}</span></div>
              <div><span style={{color:"#8896A8"}}>Max Players: </span><span style={{color:"#F2EDE4",fontWeight:600}}>{maxP}</span></div>
              <div><span style={{color:"#8896A8"}}>Lobby Host: </span><span style={{color:"#F2EDE4",fontWeight:600}}>{tournament.lobby_host_method||"random"}</span></div>
            </div>
          </Panel>
          {tournament.announcement&&(
            <Panel style={{padding:"16px",background:"rgba(232,168,56,.06)",borderColor:"rgba(232,168,56,.2)"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#E8A838",marginBottom:6}}>Announcement</div>
              <div style={{fontSize:13,color:"#F2EDE4",lineHeight:1.6}}>{tournament.announcement}</div>
            </Panel>
          )}
        </div>
      )}

      {/* Players tab */}
      {activeTab==="players"&&(
        <Panel style={{padding:"16px"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:12}}>{"Registered Players ("+registrations.length+")"}</div>
          {sortedRegs.length===0&&<div style={{textAlign:"center",padding:"32px 20px",color:"#8896A8",fontSize:14}}>No players registered yet. Share the tournament link!</div>}
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {sortedRegs.map(function(r,idx){
              var pData=r.players||{};
              var statusColors={checked_in:"#52C47C",registered:"#9B72CF",waitlisted:"#E8A838",dropped:"#F87171"};
              var statusIcons={checked_in:"\u2713",registered:"\u25CF",waitlisted:"\u25CB",dropped:"\u2717"};
              return(
                <div key={r.id||idx} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"rgba(255,255,255,.02)",borderRadius:6,border:"1px solid rgba(242,237,228,.04)"}}>
                  <span style={{color:statusColors[r.status]||"#8896A8",fontSize:14,width:18,textAlign:"center"}}>{statusIcons[r.status]||"?"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{pData.username||"Player"}</div>
                    <div style={{fontSize:11,color:"#8896A8"}}>{(pData.rank||"Unranked")+" · "+(pData.region||"")}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:statusColors[r.status]||"#8896A8",textTransform:"uppercase"}}>{r.status==="checked_in"?"Checked In":r.status}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Lobbies tab */}
      {activeTab==="bracket"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* My Lobby  -  score self-report section */}
          {phase==="in_progress"&&myPlayer&&myLobby&&(
            <Panel style={{padding:"18px",borderColor:"rgba(155,114,207,.35)",background:"rgba(155,114,207,.05)"}}>
              <div style={{fontWeight:700,fontSize:14,color:"#C4B5FD",marginBottom:12}}>{"Game "+currentGameNumber+" \u2014 Report Your Placement"}</div>
              {myReport?(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,color:"#52C47C",fontWeight:600}}>{"\u2713 You reported: "+myReport.reported_placement+(myReport.reported_placement===1?"st":myReport.reported_placement===2?"nd":myReport.reported_placement===3?"rd":"th")+" place"}</span>
                    <button onClick={function(){setMyPlacement(myReport.reported_placement);}}
                      style={{background:"none",border:"1px solid rgba(155,114,207,.3)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#9B72CF",cursor:"pointer",fontFamily:"inherit"}}>Update</button>
                  </div>
                  {myPlacement>0&&(
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
                      <select value={myPlacement}
                        onChange={function(e){setMyPlacement(parseInt(e.target.value)||0);}}
                        style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(155,114,207,.3)",borderRadius:6,padding:"7px 10px",fontSize:13,color:"#F2EDE4",fontFamily:"inherit",outline:"none"}}>
                        {(myLobby.player_ids||[]).map(function(_,i){
                          return(<option key={i+1} value={i+1}>{i+1+(i===0?"st":i===1?"nd":i===2?"rd":"th")+" place"}</option>);
                        })}
                      </select>
                      <Btn v="primary" s="sm" onClick={function(){submitReport(myPlacement);}}>Submit</Btn>
                      <Btn v="dark" s="sm" onClick={function(){setMyPlacement(0);}}>Cancel</Btn>
                    </div>
                  )}
                </div>
              ):(
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                  <select value={myPlacement}
                    onChange={function(e){setMyPlacement(parseInt(e.target.value)||0);}}
                    style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(155,114,207,.3)",borderRadius:6,padding:"7px 10px",fontSize:13,color:"#F2EDE4",fontFamily:"inherit",outline:"none"}}>
                    <option value={0}>Select placement...</option>
                    {(myLobby.player_ids||[]).map(function(_,i){
                      return(<option key={i+1} value={i+1}>{i+1+(i===0?"st":i===1?"nd":i===2?"rd":"th")+" place"}</option>);
                    })}
                  </select>
                  <Btn v="primary" s="sm" onClick={function(){if(myPlacement>0)submitReport(myPlacement);else toast("Select a placement first","error");}} disabled={myPlacement===0}>Submit</Btn>
                </div>
              )}
              {/* Dispute section */}
              {myReport&&!disputeForm.open&&(
                <button onClick={function(){setDisputeForm({open:true,lobbyId:myLobby.id,claimed:myReport.reported_placement,reason:"",screenshotUrl:""}); }}
                  style={{background:"none",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"5px 12px",fontSize:11,color:"#F87171",cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
                  {"Dispute this result"}
                </button>
              )}
              {disputeForm.open&&disputeForm.lobbyId===myLobby.id&&(
                <div style={{marginTop:12,padding:"14px",background:"rgba(248,113,113,.05)",border:"1px solid rgba(248,113,113,.2)",borderRadius:10}}>
                  <div style={{fontWeight:700,fontSize:12,color:"#F87171",marginBottom:10}}>Submit Dispute</div>
                  <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
                    <label style={{fontSize:12,color:"#BECBD9",minWidth:80}}>My actual placement:</label>
                    <select value={disputeForm.claimed}
                      onChange={function(e){setDisputeForm(Object.assign({},disputeForm,{claimed:parseInt(e.target.value)||0}));}}
                      style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#F2EDE4",fontFamily:"inherit",outline:"none"}}>
                      <option value={0}>Select...</option>
                      {(myLobby.player_ids||[]).map(function(_,i){
                        return(<option key={i+1} value={i+1}>{i+1+(i===0?"st":i===1?"nd":i===2?"rd":"th")}</option>);
                      })}
                    </select>
                  </div>
                  <textarea placeholder="Reason for dispute..."
                    value={disputeForm.reason}
                    onChange={function(e){setDisputeForm(Object.assign({},disputeForm,{reason:e.target.value}));}}
                    rows={2}
                    style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"8px 10px",fontSize:12,color:"#F2EDE4",fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box",marginBottom:8}}
                  />
                  <input placeholder="Screenshot URL (optional)"
                    value={disputeForm.screenshotUrl}
                    onChange={function(e){setDisputeForm(Object.assign({},disputeForm,{screenshotUrl:e.target.value}));}}
                    style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(248,113,113,.2)",borderRadius:6,padding:"7px 10px",fontSize:12,color:"#F2EDE4",fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:10}}
                  />
                  <div style={{display:"flex",gap:8}}>
                    <Btn v="danger" s="sm" onClick={submitDispute} disabled={!disputeForm.claimed||!disputeForm.reason}>Submit Dispute</Btn>
                    <Btn v="dark" s="sm" onClick={function(){setDisputeForm({open:false,lobbyId:null,claimed:0,reason:"",screenshotUrl:""});}}>Cancel</Btn>
                  </div>
                </div>
              )}
            </Panel>
          )}
          {phase==="in_progress"&&myPlayer&&myLobby&&myLobby.status==="locked"&&myReport&&(
            <div style={{marginTop:10,padding:"10px 14px",background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:10,fontSize:13,color:myReport.reported_placement===1?"#E8A838":myReport.reported_placement===2?"#C0C0C0":myReport.reported_placement===3?"#CD7F32":"#4ECDC4",fontWeight:600}}>
              {"Your result: "+myReport.reported_placement+(myReport.reported_placement===1?"st":myReport.reported_placement===2?"nd":myReport.reported_placement===3?"rd":"th")+" place \u2014 "+(PTS[myReport.reported_placement]||0)+" points"}
            </div>
          )}
          {phase==="in_progress"&&myPlayer&&myDisputes.length>0&&(
            <div style={{padding:"14px 18px",background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:10,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontWeight:700,fontSize:12,color:"#E8A838",letterSpacing:".05em",textTransform:"uppercase"}}>Your Disputes</div>
              {myDisputes.map(function(d){
                var isPending=d.status==="open";
                var isAccepted=d.status==="resolved_accepted";
                var statusColor=isPending?"#E8A838":isAccepted?"#52C47C":"#F87171";
                var statusLabel=isPending?"Pending review":isAccepted?"Accepted - placement updated":"Rejected";
                return(
                  <div key={d.id} style={{background:"rgba(0,0,0,.25)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:d.resolution_note?6:0}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:statusColor,flexShrink:0}}/>
                      <div style={{fontSize:12,color:statusColor,fontWeight:600}}>{statusLabel}</div>
                      {d.claimed_placement&&(<div style={{fontSize:11,color:"#9AAABF",marginLeft:"auto"}}>{"Claimed: "+d.claimed_placement+(d.claimed_placement===1?"st":d.claimed_placement===2?"nd":d.claimed_placement===3?"rd":"th")}</div>)}
                    </div>
                    {d.resolution_note&&(<div style={{fontSize:11,color:"#BECBD9",paddingLeft:16}}>{d.resolution_note}</div>)}
                  </div>
                );
              })}
            </div>
          )}
          {lobbies.length===0&&(
            <Panel style={{padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:12}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["diagram-3-fill"]||"diagram-3-fill")})}</div>
              <div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:6}}>Lobbies</div>
              <div style={{fontSize:13,color:"#9AAABF"}}>Lobbies will appear once the admin generates them.</div>
            </Panel>
          )}
          {lobbies.map(function(lobby,idx){
            var lobbyPlayers=(lobby.player_ids||[]).map(function(pid){return getPlayerById(pid);});
            var hostId=lobby.host_player_id;
            var isMyLobby=myPlayer&&(lobby.player_ids||[]).indexOf(myPlayer.id)!==-1;
            var iAmHost=myPlayer&&hostId===myPlayer.id;
            var lobbyLetter=String.fromCharCode(65+idx);
            var isLocked=lobby.status==="locked"||lobby.status==="completed";
            var codeKey=lobby.id;
            var codeInput=lobbyCodeInputs[codeKey]||"";
            // Admin monitor vars
            var lobbyReports=reports.filter(function(r){return r.lobby_id===lobby.id;});
            var reportedCount=lobbyReports.length;
            var totalCount=(lobby.player_ids||[]).length;
            var allReported=reportedCount===totalCount&&totalCount>0;
            var placementCounts={};
            lobbyReports.forEach(function(r){placementCounts[r.reported_placement]=(placementCounts[r.reported_placement]||0)+1;});
            var hasDuplicate=Object.keys(placementCounts).some(function(k){return placementCounts[k]>1;});
            var lobbyDisputes=disputes.filter(function(d){return d.lobby_id===lobby.id&&d.status==='open';});
            var canLock=allReported&&!hasDuplicate&&!isLocked;
            var letterColor=isLocked?"#52C47C":"#9B72CF";
            var cardBorderColor=hasDuplicate?"rgba(248,113,113,.5)":isLocked?"rgba(82,196,124,.3)":isMyLobby?"rgba(155,114,207,.4)":"rgba(242,237,228,.08)";
            var cardBorderLeft=isLocked?"4px solid #52C47C":hasDuplicate?"4px solid #F87171":"4px solid transparent";
            return(
              <Panel key={lobby.id} style={{padding:0,borderColor:cardBorderColor,boxShadow:isMyLobby&&!hasDuplicate?"0 0 0 1px rgba(155,114,207,.2)":"none",borderLeft:cardBorderLeft,background:isLocked?"rgba(82,196,124,.08)":undefined,borderRadius:"10px",overflow:"hidden"}}>
                {isLocked&&React.createElement("div",{style:{background:"linear-gradient(90deg,#52C47C,#3DA867)",padding:"4px 12px",borderRadius:"10px 10px 0 0",fontSize:11,fontWeight:700,color:"#fff",textAlign:"center",letterSpacing:".04em"}},"\u2713 LOCKED")}
                <div style={{padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:10,background:isLocked?"rgba(82,196,124,.15)":"rgba(155,114,207,.15)",border:"1px solid "+(isLocked?"rgba(82,196,124,.4)":"rgba(155,114,207,.3)"),display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:18,color:letterColor,flexShrink:0}}>
                      {lobbyLetter}
                    </div>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{"Lobby "+lobbyLetter}</div>
                      <div style={{fontSize:11,color:"#8896A8"}}>{lobbyPlayers.length+" players"+(isLocked?" · Locked":"")}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {isAdmin&&phase==="in_progress"&&(
                      <span style={{fontSize:11,fontWeight:700,color:allReported?"#52C47C":"#E8A838",background:allReported?"rgba(82,196,124,.1)":"rgba(232,168,56,.1)",border:"1px solid "+(allReported?"rgba(82,196,124,.3)":"rgba(232,168,56,.3)"),borderRadius:6,padding:"3px 8px"}}>{reportedCount+"/"+totalCount+" reported"}</span>
                    )}
                    {isAdmin&&lobbyDisputes.length>0&&(
                      <span style={{fontSize:11,fontWeight:700,color:"#F97316",background:"rgba(249,115,22,.1)",border:"1px solid rgba(249,115,22,.3)",borderRadius:6,padding:"3px 8px"}}>{lobbyDisputes.length+" dispute"+(lobbyDisputes.length===1?"":"s")}</span>
                    )}
                    {lobby.lobby_code&&(
                      <div style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.3)",borderRadius:8,padding:"6px 14px",fontFamily:"monospace",fontSize:15,fontWeight:700,color:"#E8A838",letterSpacing:2}}>
                        {lobby.lobby_code}
                      </div>
                    )}
                  </div>
                </div>
                {/* Admin: per-player report rows */}
                {isAdmin&&phase==="in_progress"?(
                  <div className="lobby-players-list" style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
                    {lobbyPlayers.map(function(p,pi){
                      var isHost=p.id===hostId;
                      var rc=rankColors[p.rank||"Iron"]||"#8896A8";
                      var playerReport=lobbyReports.find(function(r){return r.player_id===p.id;});
                      var isDupe=playerReport&&placementCounts[playerReport.reported_placement]>1;
                      return(
                        <div key={p.id||pi} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"rgba(255,255,255,.02)",borderRadius:6,border:"1px solid "+(isDupe?"rgba(248,113,113,.3)":isHost?"rgba(232,168,56,.15)":"rgba(242,237,228,.04)")}}>
                          <span style={{fontSize:11,fontWeight:700,color:rc,background:rc+"18",borderRadius:4,padding:"2px 6px",minWidth:60,textAlign:"center"}}>{p.rank||"Iron"}</span>
                          <span style={{flex:1,fontSize:13,color:"#F2EDE4",fontWeight:600}}>{p.username||"Unknown"}</span>
                          {playerReport?(
                            <span style={{fontSize:12,fontWeight:700,color:isDupe?"#F87171":"#52C47C",background:isDupe?"rgba(248,113,113,.1)":"rgba(82,196,124,.1)",borderRadius:4,padding:"2px 8px"}}>{playerReport.reported_placement+(playerReport.reported_placement===1?"st":playerReport.reported_placement===2?"nd":playerReport.reported_placement===3?"rd":"th")}</span>
                          ):(
                            <span style={{fontSize:11,color:"#E8A838",fontWeight:600}}>Not reported</span>
                          )}
                          <select defaultValue=""
                            onChange={function(e){var v=parseInt(e.target.value)||0;if(v>0)adminOverridePlacement(lobby.id,p.id,v);e.target.value="";}}
                            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:4,padding:"3px 6px",fontSize:11,color:"#C4B5FD",fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
                            <option value="">Override</option>
                            {(lobby.player_ids||[]).map(function(_,i){return(<option key={i+1} value={i+1}>{i+1}</option>);})}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div className="lobby-players-list" style={{display:"flex",flexDirection:"column",gap:4,marginBottom:iAmHost&&!lobby.lobby_code?12:0}}>
                    {lobbyPlayers.map(function(p,pi){
                      var isHost=p.id===hostId;
                      var rc=rankColors[p.rank||"Iron"]||"#8896A8";
                      var playerReport=reports.find(function(r){return r.player_id===p.id&&r.lobby_id===lobby.id;});
                      var hasReported=!!playerReport;
                      return(
                        <div key={p.id||pi} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"rgba(255,255,255,.02)",borderRadius:6,border:"1px solid "+(isHost?"rgba(232,168,56,.15)":"rgba(242,237,228,.04)")}}>
                          <span style={{fontSize:11,fontWeight:700,color:rc,background:rc+"18",borderRadius:4,padding:"2px 6px",minWidth:60,textAlign:"center"}}>{p.rank||"Iron"}</span>
                          <span style={{flex:1,fontSize:13,color:"#F2EDE4",fontWeight:600}}>{isHost&&<span style={{color:"#E8A838",marginRight:4}} title="Lobby Host">{"\u265B"}</span>}{p.username||"Unknown"}</span>
                          {phase==="in_progress"&&(
                            <span style={{fontSize:13,color:hasReported?"#52C47C":"rgba(136,150,168,.4)",fontWeight:700}} title={hasReported?"Reported":"Not yet reported"}>{hasReported?"\u2713":"\u25CB"}</span>
                          )}
                          {playerReport&&<span style={{fontSize:12,fontWeight:700,color:"#52C47C"}}>{playerReport.reported_placement+(playerReport.reported_placement===1?"st":playerReport.reported_placement===2?"nd":playerReport.reported_placement===3?"rd":"th")}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Admin: Lock lobby button */}
                {isAdmin&&phase==="in_progress"&&!isLocked&&(
                  <div style={{display:"flex",gap:8,alignItems:"center",paddingTop:10,borderTop:"1px solid rgba(242,237,228,.06)",flexWrap:"wrap",opacity:isLocked?0.7:1,pointerEvents:isLocked?"none":"auto"}}>
                    {hasDuplicate&&<span style={{fontSize:11,color:"#F87171"}}>{"Duplicate placements  -  resolve before locking"}</span>}
                    <Btn v="success" s="sm" onClick={function(){lockLobby(lobby.id);}} disabled={!canLock}>{isLocked?"Locked":canLock?"Lock Lobby":"Cannot Lock Yet"}</Btn>
                  </div>
                )}
                {iAmHost&&!lobby.lobby_code&&(
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,paddingTop:10,borderTop:"1px solid rgba(242,237,228,.06)",opacity:isLocked?0.7:1,pointerEvents:isLocked?"none":"auto"}}>
                    <input
                      placeholder="Enter lobby code..."
                      value={codeInput}
                      onChange={function(e){var v=e.target.value;setLobbyCodeInputs(function(prev){var next=Object.assign({},prev);next[codeKey]=v;return next;});}}
                      style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(155,114,207,.3)",borderRadius:6,padding:"7px 12px",fontSize:13,color:"#F2EDE4",fontFamily:"monospace",outline:"none"}}
                    />
                    <Btn v="primary" s="sm" onClick={function(){submitLobbyCode(lobby.id,codeInput);}}>Save</Btn>
                  </div>
                )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Standings tab */}
      {activeTab==="standings"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Podium  -  only when complete */}
          {phase==="complete"&&standings.length>=3&&(
            <Panel style={{padding:"28px 20px 16px 20px",background:"linear-gradient(160deg,rgba(232,168,56,.09),rgba(155,114,207,.09),rgba(17,24,39,0))",border:"1px solid rgba(232,168,56,.18)"}}>
              <div style={{textAlign:"center",fontWeight:800,fontSize:13,color:"#E8A838",marginBottom:24,letterSpacing:"2px",textTransform:"uppercase"}}>{"Final Results"}</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"flex-end",flexWrap:"wrap"}}>
                {[1,0,2].map(function(rankIdx){
                  var entry=standings[rankIdx];
                  if(!entry)return null;
                  var pos=rankIdx+1;
                  var colors=["#E8A838","#C0C0C0","#CD7F32"];
                  var cardBgs=["linear-gradient(160deg,rgba(232,168,56,.18),rgba(232,168,56,.04))","linear-gradient(160deg,rgba(192,192,192,.12),rgba(192,192,192,.03))","linear-gradient(160deg,rgba(205,127,50,.12),rgba(205,127,50,.03))"];
                  var cardBorders=["rgba(232,168,56,.45)","rgba(192,192,192,.3)","rgba(205,127,50,.3)"];
                  var avatarSizes=[80,64,60];
                  var nameSizes=[16,13,13];
                  var cardPaddings=["20px 18px","16px 14px","16px 14px"];
                  var prizeEntry=prizes.find(function(pr){return pr.placement===pos;});
                  var isFirst=pos===1;
                  var orderMap=[2,1,3];
                  var displayOrder=orderMap[rankIdx];
                  return(
                    <div key={entry.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,order:displayOrder,flex:isFirst?"0 0 160px":"0 0 130px",background:cardBgs[rankIdx],border:"1px solid "+cardBorders[rankIdx],borderRadius:14,padding:cardPaddings[rankIdx],minWidth:isFirst?140:110,maxWidth:isFirst?180:150}}>
                      {isFirst&&<div style={{fontSize:26,lineHeight:1,marginBottom:2}}>{React.createElement("i",{className:"ti ti-trophy",style:{color:"#E8A838"}})}</div>}
                      {!isFirst&&<div style={{fontSize:20,lineHeight:1,marginBottom:2}}>{React.createElement("i",{className:"ti ti-"+(ICON_REMAP["award-fill"]||"award-fill")})}</div>}
                      <div style={{width:avatarSizes[rankIdx],height:avatarSizes[rankIdx],borderRadius:"50%",background:"linear-gradient(135deg,"+colors[rankIdx]+"44,"+colors[rankIdx]+"11)",border:"2.5px solid "+colors[rankIdx],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:isFirst?24:18,color:colors[rankIdx],boxShadow:isFirst?"0 0 18px "+colors[rankIdx]+"55":"none"}}>{"#"+pos}</div>
                      <div style={{fontWeight:700,fontSize:nameSizes[rankIdx],color:"#F2EDE4",textAlign:"center",marginTop:4,lineHeight:1.2}}>{entry.name}</div>
                      <div style={{fontSize:12,color:colors[rankIdx],fontWeight:700,background:colors[rankIdx]+"18",borderRadius:8,padding:"2px 10px"}}>{entry.totalPts+" pts"}</div>
                      {prizeEntry&&<div style={{fontSize:isFirst?14:12,fontWeight:800,color:colors[rankIdx],background:colors[rankIdx]+"22",border:"1px solid "+colors[rankIdx]+"55",borderRadius:8,padding:"4px 12px",marginTop:2}}>{prizeEntry.prize}</div>}
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {/* Standings table */}
          {standings.length===0?(
            <Panel style={{padding:"48px 20px",textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:12}}>{React.createElement("i",{className:"ti ti-chart-bar"})}</div>
              <div style={{fontWeight:700,fontSize:16,color:"#F2EDE4",marginBottom:6}}>Standings</div>
              <div style={{fontSize:13,color:"#9AAABF"}}>No results yet. Complete games to see standings.</div>
            </Panel>
          ):(
            <Panel style={{padding:"16px 0 0 0",overflow:"hidden"}}>
              <div style={{padding:"0 18px 12px 18px",fontWeight:700,fontSize:14,color:"#F2EDE4"}}>
                {"Standings  -  Game "+(allGameNums.length>0?allGameNums[allGameNums.length-1]:currentGameNumber)+" of "+(tournament.round_count||3)}
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,tableLayout:"auto",minWidth:360}}>
                  <thead>
                    <tr style={{background:"rgba(255,255,255,.03)",borderBottom:"1px solid rgba(242,237,228,.08)"}}>
                      <th style={{padding:"8px 10px 8px 18px",textAlign:"left",fontWeight:600,fontSize:11,color:"#8896A8",whiteSpace:"nowrap",position:"sticky",left:0,zIndex:3,background:"#0D1421"}}>#</th>
                      <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,fontSize:11,color:"#8896A8",whiteSpace:"nowrap",position:"sticky",left:40,zIndex:3,background:"#0D1421"}}>Player</th>
                      <th style={{padding:"8px 10px",textAlign:"center",fontWeight:600,fontSize:11,color:"#E8A838",whiteSpace:"nowrap"}}>Pts</th>
                      <th style={{padding:"8px 10px",textAlign:"center",fontWeight:600,fontSize:11,color:"#8896A8",whiteSpace:"nowrap"}}>Avg</th>
                      <th style={{padding:"8px 10px",textAlign:"center",fontWeight:600,fontSize:11,color:"#8896A8",whiteSpace:"nowrap"}}>Wins</th>
                      <th style={{padding:"8px 10px",textAlign:"center",fontWeight:600,fontSize:11,color:"#8896A8",whiteSpace:"nowrap"}}>Top4</th>
                      {allGameNums.map(function(gn){
                        return(<th key={gn} style={{padding:"8px 8px",textAlign:"center",fontWeight:600,fontSize:11,color:"#9B72CF",whiteSpace:"nowrap"}}>{"G"+gn}</th>);
                      })}
                      {phase==="complete"&&prizes.length>0&&(
                        <th style={{padding:"8px 10px 8px 10px",textAlign:"center",fontWeight:600,fontSize:11,color:"#52C47C",whiteSpace:"nowrap"}}>Prize</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map(function(entry,rankIdx){
                      var pos=rankIdx+1;
                      var isMe=myPlayer&&entry.id===myPlayer.id;
                      var isCut=tournament.cut_line_pts&&entry.totalPts<tournament.cut_line_pts&&phase==="in_progress";
                      var rowColors=["rgba(232,168,56,.08)","rgba(192,192,192,.05)","rgba(205,127,50,.05)"];
                      var borderColors=["rgba(232,168,56,.3)","rgba(192,192,192,.15)","rgba(205,127,50,.15)"];
                      var bg=pos<=3?rowColors[pos-1]:(isCut?"rgba(248,113,113,.04)":"transparent");
                      var borderL=isMe?"3px solid #E8A838":(pos<=3?"3px solid "+borderColors[pos-1]:(isCut?"3px solid rgba(248,113,113,.3)":"3px solid transparent"));
                      var prizeEntry=prizes.find(function(pr){return pr.placement===pos;});
                      return(
                        <tr key={entry.id} style={{background:bg,borderBottom:"1px solid rgba(242,237,228,.04)",outline:isMe?"1px solid rgba(232,168,56,.35)":"none",position:"relative"}}>
                          <td style={{padding:"10px 10px 10px 16px",fontWeight:700,color:pos===1?"#E8A838":pos===2?"#C0C0C0":pos===3?"#CD7F32":"#8896A8",borderLeft:borderL,whiteSpace:"nowrap",position:"sticky",left:0,zIndex:2,background:"#0D1421"}}>
                            {pos<=3?React.createElement("i",{className:"ti ti-"+(ICON_REMAP["award-fill"]||"award-fill"),style:{color:pos===1?"#E8A838":pos===2?"#C0C0C0":"#CD7F32"}}):pos}
                          </td>
                          <td style={{padding:"10px 10px",maxWidth:160,position:"sticky",left:40,zIndex:2,background:"#0D1421"}}>
                            <div style={{fontWeight:600,color:isMe?"#E8A838":"#F2EDE4",fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{entry.name+(isMe?" (you)":"")}</div>
                            <div style={{fontSize:10,color:"#8896A8"}}>{entry.rank}</div>
                          </td>
                          <td style={{padding:"10px 10px",textAlign:"center",fontWeight:700,color:"#E8A838",fontSize:14,whiteSpace:"nowrap"}}>{entry.totalPts}</td>
                          <td style={{padding:"10px 10px",textAlign:"center",color:"#BECBD9",fontSize:12,whiteSpace:"nowrap"}}>{entry.avgPlace.toFixed(1)}</td>
                          <td style={{padding:"10px 10px",textAlign:"center",color:"#F2EDE4",fontWeight:600,whiteSpace:"nowrap"}}>{entry.wins}</td>
                          <td style={{padding:"10px 10px",textAlign:"center",color:"#F2EDE4",whiteSpace:"nowrap"}}>{entry.top4}</td>
                          {allGameNums.map(function(gn){
                            var detail=entry.gameDetails.find(function(d){return d.game===gn;});
                            var plc=detail?detail.placement:null;
                            var plcColor=plc===1?"#E8A838":plc===2?"#C0C0C0":plc===3?"#CD7F32":plc<=4?"#52C47C":"#8896A8";
                            return(
                              <td key={gn} style={{padding:"10px 8px",textAlign:"center",whiteSpace:"nowrap"}}>
                                {plc?(
                                  <span style={{fontSize:12,fontWeight:700,color:plcColor,background:plcColor+"18",borderRadius:4,padding:"2px 6px"}}>{plc}</span>
                                ):(
                                  <span style={{fontSize:11,color:"rgba(136,150,168,.4)"}}> - </span>
                                )}
                              </td>
                            );
                          })}
                          {phase==="complete"&&prizes.length>0&&(
                            <td style={{padding:"10px 10px 10px 10px",textAlign:"center",whiteSpace:"nowrap"}}>
                              {prizeEntry?(
                                <span style={{fontSize:12,fontWeight:700,color:"#52C47C",background:"rgba(82,196,124,.12)",borderRadius:4,padding:"2px 8px"}}>{prizeEntry.prize}</span>
                              ):(
                                <span style={{fontSize:11,color:"rgba(136,150,168,.4)"}}> - </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tournament.cut_line_pts&&phase==="in_progress"&&(
                <div style={{padding:"10px 18px",fontSize:11,color:"#F87171",borderTop:"1px solid rgba(248,113,113,.15)",background:"rgba(248,113,113,.03)"}}>
                  {"Cut line: "+tournament.cut_line_pts+" pts  -  players below this threshold are at risk of elimination"}
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* Admin: Disputes panel */}
      {isAdmin&&disputes.length>0&&(
        <Panel style={{padding:"18px",marginTop:16,borderColor:"rgba(249,115,22,.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F97316"}}>{"Disputes"}</div>
            {openDisputeCount>0&&(
              <span style={{fontSize:11,fontWeight:700,color:"#F97316",background:"rgba(249,115,22,.15)",borderRadius:20,padding:"2px 9px",border:"1px solid rgba(249,115,22,.3)"}}>{openDisputeCount+" open"}</span>
            )}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {disputes.map(function(d){
              var lobbyIdx=lobbies.findIndex(function(l){return l.id===d.lobby_id;});
              var lobbyLabel=lobbyIdx>=0?"Lobby "+String.fromCharCode(65+lobbyIdx):"Unknown lobby";
              var pData=d.players||{};
              var isOpen=d.status==='open';
              return(
                <div key={d.id} style={{background:isOpen?"rgba(249,115,22,.05)":"rgba(255,255,255,.02)",border:"1px solid "+(isOpen?"rgba(249,115,22,.25)":"rgba(242,237,228,.06)"),borderRadius:8,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                        <span style={{fontWeight:700,fontSize:13,color:"#F2EDE4"}}>{pData.username||"Player"}</span>
                        <span style={{fontSize:11,color:"#9B72CF"}}>{lobbyLabel}</span>
                        <span style={{fontSize:11,fontWeight:600,color:isOpen?"#F97316":"#52C47C",background:isOpen?"rgba(249,115,22,.1)":"rgba(82,196,124,.1)",borderRadius:4,padding:"1px 6px"}}>{d.status==='open'?"Open":d.status==='resolved_accepted'?"Accepted":"Rejected"}</span>
                      </div>
                      <div style={{fontSize:12,color:"#BECBD9",marginBottom:4}}>
                        {"Claimed: "+(d.claimed_placement||"?")+(d.claimed_placement===1?"st":d.claimed_placement===2?"nd":d.claimed_placement===3?"rd":"th")+" · Reported: "+(d.reported_placement||"?")+(d.reported_placement===1?"st":d.reported_placement===2?"nd":d.reported_placement===3?"rd":"th")}
                      </div>
                      {d.reason&&<div style={{fontSize:12,color:"#9AAABF",fontStyle:"italic",marginBottom:4}}>{d.reason}</div>}
                      {isSafeUrl(d.screenshot_url)&&<a href={d.screenshot_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#4ECDC4"}}>{"View screenshot"}</a>}
                    </div>
                    {isOpen&&(
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <Btn v="success" s="sm" onClick={function(){resolveDispute(d.id,true);}}>Accept</Btn>
                        <Btn v="danger" s="sm" onClick={function(){resolveDispute(d.id,false);}}>Reject</Btn>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Admin controls */}
      {isAdmin&&(
        <Panel style={{padding:"18px",marginTop:20,borderColor:"rgba(248,113,113,.15)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#F87171",marginBottom:14}}>{"Admin Controls"}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {phase==="draft"&&<Btn v="purple" s="sm" onClick={adminOpenRegistration}>Open Registration</Btn>}
            {phase==="registration"&&<Btn v="primary" s="sm" onClick={adminOpenCheckIn}>Open Check-In</Btn>}
            {phase==="check_in"&&<Btn v="primary" s="sm" onClick={adminCloseCheckIn}>Close Check-In</Btn>}
            {phase==="check_in"&&checkedInCount>=2&&lobbies.length===0&&(
              <Btn v="success" s="sm" onClick={generateLobbies} disabled={actionLoading}>{actionLoading?"Generating...":"Generate Lobbies"}</Btn>
            )}
            {phase==="check_in"&&lobbies.length>0&&(
              <span style={{fontSize:12,color:"#52C47C",padding:"4px 10px",background:"rgba(82,196,124,.1)",borderRadius:6,border:"1px solid rgba(82,196,124,.2)",fontWeight:600}}>{"\u2713 "+lobbies.length+" lobbies ready"}</span>
            )}
            {(phase==="check_in"||phase==="registration")&&<Btn v="dark" s="sm" onClick={adminStartTournament}>Start Tournament</Btn>}
            {phase==="in_progress"&&allLobbiesLocked&&!isLastGame&&(
              <Btn v="primary" s="sm" onClick={startNextGame}>{"Start Game "+(currentGameNumber+1)}</Btn>
            )}
            {phase==="in_progress"&&allLobbiesLocked&&isLastGame&&(
              <Btn v="success" s="sm" onClick={finalizeTournament}>Finalize Tournament</Btn>
            )}
          </div>
          <div style={{fontSize:11,color:"#8896A8",marginTop:10}}>
            {"Phase: "+(phaseLabels[phase]||phase)+" · Registered: "+regCount+" · Checked in: "+checkedInCount+(lobbies.length>0?" · "+lobbies.length+" lobbies":"")+(phase==="in_progress"?" · Game "+currentGameNumber+" of "+(tournament.round_count||3):"")}
          </div>
        </Panel>
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
  var past=allEvents.filter(function(e){return e.status==="complete";});
  var active=live.concat(upcoming);
  var shown=filter==="all"?active:filter==="live"?live:upcoming;

  return(
    <div className="page wrap">

      <div style={{marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,flexWrap:"wrap"}}>
          <h1 style={{color:"#F2EDE4",fontSize:24,fontWeight:700,margin:0}}>Featured Events</h1>
          {live.length>0&&(
            <span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite",display:"inline-block"}}/>
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
          <div style={{fontSize:48,marginBottom:16}}>{React.createElement("i",{className:"ti ti-building"})}</div>
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
                <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite",display:"inline-block"}}/>LIVE NOW
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
                          <span style={{width:4,height:4,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite",display:"inline-block"}}/>LIVE
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
          <div style={{fontSize:32,marginBottom:12}}>{React.createElement("i",{className:"ti ti-calendar-event"})}</div>
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
                      <div style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>{React.createElement("i",{className:"ti ti-trophy",style:{fontSize:12,color:"#E8A838",marginRight:3}})}{ev.champion}</div>
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
        <div style={{fontSize:28,marginBottom:10}}>{React.createElement("i",{className:"ti ti-device-gamepad-2"})}</div>
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

var RULES_SECTIONS = [
  {id:"format",title:"Tournament Format",icon:"tournament",content:"Weekly Saturday clashes with 3-5 games per session. 8 players per lobby. Standard EMEA scoring."},
  {id:"points",title:"Points System",icon:"chart-bar",content:"1st: 8 pts, 2nd: 7 pts, 3rd: 6 pts, 4th: 5 pts, 5th: 4 pts, 6th: 3 pts, 7th: 2 pts, 8th: 1 pt",isPointsTable:true},
  {id:"tiebreakers",title:"Tiebreakers",icon:"arrows-sort",content:"1. Total tournament points. 2. Wins + top 4s (wins count twice). 3. Most of each placement (1st, then 2nd, then 3rd...). 4. Most recent game finish."},
  {id:"registration",title:"Registration and Check-in",icon:"clipboard-check",content:"Register anytime before the clash. Check-in opens 60 minutes before start and closes at start time. No-shows lose their spot to the next waitlisted player."},
  {id:"results",title:"Result Submission",icon:"send",content:"Any player in a lobby can submit results. A different player must confirm. If disputed, an admin reviews. Admin can always override."},
  {id:"swiss",title:"Swiss Reseeding",icon:"refresh",content:"When Swiss mode is enabled, lobbies are reseeded after every 2 games. Players are sorted by cumulative points and snake-seeded into new lobbies."},
  {id:"conduct",title:"Code of Conduct",icon:"shield",content:"Respectful behavior is required. Intentional disconnects, collusion, or abusive communication may result in warnings, temporary bans, or permanent removal."},
  {id:"disputes",title:"Disputes and Appeals",icon:"gavel",content:"Click Dispute on any result submission to flag it for admin review. Admins will review within 24 hours. Decisions are final."}
];

function RulesScreen({setScreen}){
  var [expanded,setExpanded]=useState(null);
  var [rulesSearch,setRulesSearch]=useState("");

  var q=rulesSearch.trim().toLowerCase();
  var filtered=q?RULES_SECTIONS.filter(function(s){
    return s.title.toLowerCase().indexOf(q)!==-1||s.content.toLowerCase().indexOf(q)!==-1;
  }):RULES_SECTIONS;

  var ptColors=["#E8A838","#C4B5FD","#4ECDC4","#34D399","#9AAABF","#8896A8","#6B7280","#4B5563"];

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>Official Rules</h2>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {[
          {label:"1st Place",value:"8 pts",color:"#E8A838",icon:"trophy"},
          {label:"Games per Clash",value:"3-5",color:"#9B72CF",icon:"cards"},
          {label:"Check-in Opens",value:"60 min before",color:"#4ECDC4",icon:"clock"}
        ].map(function(fact){
          return(
            <div key={fact.label} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.08)",borderRadius:12,padding:"14px 12px",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:6,color:fact.color}}>{React.createElement("i",{className:"ti ti-"+fact.icon})}</div>
              <div style={{fontSize:16,fontWeight:800,color:fact.color,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:2}}>{fact.value}</div>
              <div style={{fontSize:11,color:"#8896A8",textTransform:"uppercase",letterSpacing:".08em"}}>{fact.label}</div>
            </div>
          );
        })}
      </div>

      <input
        type="text"
        placeholder="Search rules..."
        value={rulesSearch}
        onChange={function(e){setRulesSearch(e.target.value);setExpanded(null);}}
        style={{width:"100%",padding:"10px 14px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(242,237,228,.1)",borderRadius:10,color:"#F2EDE4",fontSize:14,marginBottom:16,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
      />

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.length===0&&(
          <div style={{textAlign:"center",padding:"32px 16px",color:"#8896A8",fontSize:14}}>{"No results for \""+rulesSearch+"\". Try a different term."}</div>
        )}
        {filtered.map(function(sec){
          var isOpen=expanded===sec.id;
          return(
            <div key={sec.id} style={{background:isOpen?"rgba(155,114,207,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(isOpen?"rgba(155,114,207,.25)":"rgba(242,237,228,.08)"),borderRadius:12,overflow:"hidden",transition:"all .2s"}}>
              <button onClick={function(){setExpanded(isOpen?null:sec.id);}} style={{width:"100%",padding:"16px 18px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:isOpen?"#9B72CF":"#8896A8",fontSize:18}}>{React.createElement("i",{className:"ti ti-"+sec.icon})}</span>
                  <span style={{fontSize:14,fontWeight:600,color:isOpen?"#C4B5FD":"#F2EDE4"}}>{sec.title}</span>
                </div>
                <span style={{fontSize:18,color:isOpen?"#9B72CF":"#8896A8",flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(45deg)":"rotate(0deg)"}}>+</span>
              </button>
              {isOpen&&(
                <div style={{padding:"0 18px 18px 18px"}}>
                  {sec.isPointsTable?(
                    <div style={{overflowX:"auto"}}>
                      <div style={{display:"flex",gap:6,minWidth:360}}>
                        {[1,2,3,4,5,6,7,8].map(function(place){
                          return(
                            <div key={place} style={{flex:1,textAlign:"center",background:"rgba(255,255,255,.03)",border:"1px solid rgba(242,237,228,.08)",borderRadius:8,padding:"10px 4px"}}>
                              <div style={{fontSize:11,color:"#8896A8",marginBottom:6,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",letterSpacing:".06em"}}>{place===1?"1st":place===2?"2nd":place===3?"3rd":place+"th"}</div>
                              <div style={{fontSize:20,fontWeight:800,color:ptColors[place-1],fontFamily:"'Barlow Condensed',sans-serif"}}>{9-place}</div>
                              <div style={{fontSize:10,color:"#8896A8",marginTop:2}}>pts</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ):(
                    <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.7}}>{sec.content}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



// ─── FAQ SCREEN ───────────────────────────────────────────────────────────────

var FAQ_DATA = [
  {cat:"Getting Started",icon:"rocket",items:[
    {q:"How do I join a clash?",a:"Navigate to the Clash screen and click Register. Check-in opens 60 minutes before the clash starts."},
    {q:"Is it free to play?",a:"Yes, competing is always free. Pro and Host tiers unlock extra features like advanced stats, broadcast mode, and tournament hosting."},
    {q:"Do I need a Riot account?",a:"You need a TFT Clash account. Linking your Riot ID is optional but recommended for verification."}
  ]},
  {cat:"During a Clash",icon:"swords",items:[
    {q:"How are lobbies assigned?",a:"Players are distributed into 8-player lobbies. With Swiss mode, lobbies reseed after every 2 games based on cumulative points."},
    {q:"How do I submit results?",a:"After each game, any player in the lobby can submit placements. Another player must confirm them."},
    {q:"What if results are wrong?",a:"Click Dispute on the result. An admin will review within 24 hours."}
  ]},
  {cat:"Scoring and Rankings",icon:"chart-bar",items:[
    {q:"How does scoring work?",a:"Standard EMEA scoring: 1st gets 8 pts, 2nd gets 7 pts, down to 8th getting 1 pt. Points accumulate across all games in a clash."},
    {q:"How are tiebreakers resolved?",a:"Total points first, then wins + top 4s (wins count double), then most of each placement starting from 1st, then most recent finish."},
    {q:"What are seasons?",a:"Seasons run for a set period. Points reset each season. Season champions are enshrined in the Hall of Fame."}
  ]},
  {cat:"Pro and Host Tiers",icon:"crown",items:[
    {q:"What does Pro unlock?",a:"Advanced stats, head-to-head comparisons, broadcast mode, custom profile banners, and priority support."},
    {q:"What does Host unlock?",a:"Create and brand your own tournaments, custom landing pages, featured event placement, and full analytics dashboard."},
    {q:"Can I cancel anytime?",a:"Yes. Your tier remains active until the end of the billing period."}
  ]}
];

function FAQScreen({setScreen}){
  var [openKey,setOpenKey]=useState(null);
  var [faqSearch,setFaqSearch]=useState("");
  var [expandedCats,setExpandedCats]=useState({"Getting Started":true,"During a Clash":true,"Scoring and Rankings":true,"Pro and Host Tiers":true});

  var q=faqSearch.trim().toLowerCase();

  var filteredData=FAQ_DATA.map(function(cat){
    var items=q?cat.items.filter(function(item){
      return item.q.toLowerCase().indexOf(q)!==-1||item.a.toLowerCase().indexOf(q)!==-1;
    }):cat.items;
    return Object.assign({},cat,{items:items});
  }).filter(function(cat){return cat.items.length>0;});

  var totalResults=filteredData.reduce(function(acc,cat){return acc+cat.items.length;},0);

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>← Back</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>Frequently Asked Questions</h2>
      </div>

      <input
        type="text"
        placeholder="Search FAQ..."
        value={faqSearch}
        onChange={function(e){setFaqSearch(e.target.value);setOpenKey(null);}}
        style={{width:"100%",padding:"10px 14px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(242,237,228,.1)",borderRadius:10,color:"#F2EDE4",fontSize:14,marginBottom:16,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
      />

      {totalResults===0&&(
        <div style={{textAlign:"center",padding:"32px 16px",color:"#8896A8",fontSize:14}}>{"No results for \""+faqSearch+"\". Try a different search term."}</div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {filteredData.map(function(cat){
          var isCatOpen=expandedCats[cat.cat]!==false;
          return(
            <div key={cat.cat}>
              <button
                onClick={function(){setExpandedCats(function(prev){var next=Object.assign({},prev);next[cat.cat]=!isCatOpen;return next;});}}
                style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 0",background:"none",border:"none",borderBottom:"1px solid rgba(242,237,228,.1)",cursor:"pointer",marginBottom:10,textAlign:"left"}}
              >
                <span style={{color:"#9B72CF",fontSize:16}}>{React.createElement("i",{className:"ti ti-"+cat.icon})}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#C4B5FD",textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'Barlow Condensed',sans-serif",flex:1}}>{cat.cat}</span>
                <span style={{fontSize:12,color:"#8896A8",fontWeight:600}}>{cat.items.length+" Q"}</span>
                <span style={{fontSize:16,color:"#8896A8",transition:"transform .2s",transform:isCatOpen?"rotate(180deg)":"rotate(0deg)"}}>{React.createElement("i",{className:"ti ti-chevron-down"})}</span>
              </button>
              {isCatOpen&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {cat.items.map(function(item){
                    var key=cat.cat+"|"+item.q;
                    var isOpen=openKey===key;
                    return(
                      <div key={key} style={{background:isOpen?"rgba(155,114,207,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(isOpen?"rgba(155,114,207,.25)":"rgba(242,237,228,.08)"),borderRadius:12,overflow:"hidden",transition:"all .2s"}}>
                        <button onClick={function(){setOpenKey(isOpen?null:key);}} style={{width:"100%",padding:"14px 16px",background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,textAlign:"left"}}>
                          <span style={{fontSize:14,fontWeight:600,color:isOpen?"#C4B5FD":"#F2EDE4",lineHeight:1.4}}>{item.q}</span>
                          <span style={{fontSize:18,color:isOpen?"#9B72CF":"#8896A8",flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(45deg)":"rotate(0deg)"}}>+</span>
                        </button>
                        {isOpen&&(
                          <div style={{padding:"0 16px 16px 16px"}}>
                            <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.7}}>{item.a}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalResults>0&&(
        <div style={{marginTop:32,background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:14,padding:"20px 24px",textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:700,color:"#C4B5FD",marginBottom:6}}>Still have questions?</div>
          <div style={{fontSize:13,color:"#BECBD9",lineHeight:1.6,marginBottom:14}}>Join the community on Discord or reach out to an admin directly.</div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <Btn v="primary" s="sm" onClick={function(){window.open("https://discord.gg/tftclash","_blank");}}>
              {React.createElement("i",{className:"ti ti-brand-discord",style:{marginRight:5}})}
              {"Join Discord"}
            </Btn>
            <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>Back to Home</Btn>
          </div>
        </div>
      )}
    </div>
  );
}



// ─── REFERRAL SYSTEM ─────────────────────────────────────────────────────────

function ReferralPanel(props){
  var currentUser=props.currentUser;
  var toast=props.toast;
  if(!currentUser)return null;
  var code=currentUser.username?currentUser.username.toLowerCase().replace(/[^a-z0-9]/g,""):"";
  var refUrl="https://tft-clash.vercel.app/?ref="+code+"#home";
  var referrals=0;
  try{var s=localStorage.getItem("tft-referral-count-"+code);if(s)referrals=parseInt(s)||0;}catch(e){}
  var tier=referrals>=10?"gold":referrals>=5?"silver":referrals>=1?"bronze":"none";
  var tierColors={gold:"#E8A838",silver:"#C0C0C0",bronze:"#CD7F32",none:"#8896A8"};
  var tierNames={gold:"Gold Recruiter",silver:"Silver Recruiter",bronze:"Bronze Recruiter",none:"No referrals yet"};
  return(
    <div style={{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.2)",borderRadius:12,padding:18,marginTop:16}}>
      <div style={{fontSize:14,fontWeight:700,color:"#C4B5FD",marginBottom:10}}>Referral Program</div>
      <div style={{fontSize:12,color:"#BECBD9",lineHeight:1.6,marginBottom:12}}>Invite friends to TFT Clash. Both of you earn a badge when they complete their first clash.</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input readOnly value={refUrl} style={{flex:1,minWidth:180,background:"rgba(0,0,0,.3)",border:"1px solid rgba(242,237,228,.1)",borderRadius:8,padding:"8px 10px",color:"#F2EDE4",fontSize:12,fontFamily:"monospace"}} onClick={function(e){e.target.select();}}/>
        <button onClick={function(){navigator.clipboard.writeText(refUrl).then(function(){toast("Referral link copied!","success");}).catch(function(){toast("Copy failed","error");});}} style={{padding:"8px 14px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:12,flexShrink:0}}>Copy Link</button>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontWeight:700,color:tierColors[tier]}}>{tierNames[tier]}</span>
        {tier!=="none"&&<span style={{fontSize:9,fontWeight:800,color:tierColors[tier],background:tierColors[tier]+"18",padding:"2px 6px",borderRadius:4,textTransform:"uppercase",letterSpacing:".06em"}}>{referrals} referred</span>}
      </div>
    </div>
  );
}

// ─── GEAR / MERCHANDISE ──────────────────────────────────────────────────────

function GearScreen(props) {
  var isAdmin = props.isAdmin;
  var toast = props.toast;
  var _items = useState([]);
  var items = _items[0];
  var setItems = _items[1];
  var _loading = useState(true);
  var loading = _loading[0];
  var setLoading = _loading[1];

  useEffect(function() {
    supabase.from("gear_items").select("*").order("sort_order").then(function(res) {
      if (res.data) setItems(res.data);
      setLoading(false);
    });
  }, []);

  var categories = [];
  items.forEach(function(item) {
    if (categories.indexOf(item.category) === -1) categories.push(item.category);
  });

  return React.createElement("div", {className: "page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{fontSize:22,color:"#F2EDE4",marginBottom:4}}, "Gear"),
    React.createElement("div", {style:{fontSize:12,color:"#9AAABF",marginBottom:20}}, "Official TFT Clash merchandise and gear"),
    loading ? React.createElement("div", {style:{color:"#9AAABF",textAlign:"center",padding:40}}, "Loading...") :
    items.length === 0 ? React.createElement("div", {style:{color:"#9AAABF",textAlign:"center",padding:60}},
      React.createElement("i", {className:"ti ti-shopping-bag",style:{fontSize:32,marginBottom:8,display:"block",opacity:.5}}),
      "Coming soon. Check back for TFT Clash merch."
    ) :
    categories.map(function(cat) {
      var catItems = items.filter(function(i){return i.category === cat;});
      return React.createElement("div", {key:cat,style:{marginBottom:24}},
        React.createElement("div", {className:"cond",style:{fontSize:10,fontWeight:700,color:"#9B72CF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}, cat),
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}},
          catItems.map(function(item) {
            return React.createElement(Panel, {key:item.id,style:{padding:0,overflow:"hidden"}},
              item.image_url ? React.createElement("img", {src:item.image_url,alt:item.name,style:{width:"100%",height:140,objectFit:"cover"}}) : React.createElement("div", {style:{width:"100%",height:140,background:"linear-gradient(135deg,rgba(155,114,207,.15),rgba(155,114,207,.05))",display:"flex",alignItems:"center",justifyContent:"center"}}, React.createElement("i", {className:"ti ti-shopping-bag",style:{fontSize:28,color:"#9B72CF",opacity:.4}})),
              React.createElement("div", {style:{padding:"12px 14px"}},
                React.createElement("div", {style:{fontSize:14,fontWeight:700,color:"#F2EDE4",marginBottom:4}}, item.name),
                React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginBottom:8,lineHeight:1.4}}, item.description || ""),
                React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
                  item.price ? React.createElement("span", {style:{fontSize:13,fontWeight:700,color:"#E8A838"}}, item.price) : null,
                  item.external_url ? React.createElement("a", {href:item.external_url,target:"_blank",rel:"noopener noreferrer",style:{fontSize:12,color:"#9B72CF",textDecoration:"none",fontWeight:600}}, "View") : null
                )
              )
            );
          })
        )
      );
    })
  );
}

// ─── PRIVACY POLICY ──────────────────────────────────────────────────────────

function PrivacyScreen() {
  var sections = [
    {id:"collect",title:"Information We Collect",body:"We collect information you provide directly: account credentials, Riot ID, region, and optional profile details (bio, social links). We also collect usage data including participation records, placement results, and platform interactions."},
    {id:"use",title:"How We Use Your Information",body:"Your information powers your competitive profile, leaderboard standings, achievement tracking, and season statistics. We use aggregate data to improve the platform. We never sell personal data."},
    {id:"share",title:"Information Sharing",body:"Your competitive results and profile are visible to other users. We do not share personal data with third parties except as required by law or to protect against fraud."},
    {id:"security",title:"Data Security",body:"We use Supabase with row-level security policies. All data is encrypted in transit and at rest. Authentication is handled through industry-standard protocols."},
    {id:"rights",title:"Your Rights",body:"You can update or delete your account at any time via Account Settings. Upon deletion, your personal data is removed. Anonymized competitive records may be retained for historical standings integrity."},
    {id:"contact",title:"Contact",body:"Questions about privacy? Reach us via Discord."}
  ];
  return React.createElement("div", {className:"page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{fontSize:22,color:"#F2EDE4",marginBottom:4}}, "Privacy Policy"),
    React.createElement("div", {style:{fontSize:11,color:"#9AAABF",marginBottom:20}}, "Last updated: March 2026"),
    React.createElement("div", {style:{marginBottom:24,padding:"12px 16px",background:"rgba(255,255,255,.03)",borderRadius:10}},
      sections.map(function(s) {
        return React.createElement("a", {key:s.id,href:"#privacy-" + s.id,style:{display:"block",fontSize:12,color:"#9B72CF",textDecoration:"none",padding:"4px 0"}}, s.title);
      })
    ),
    sections.map(function(s) {
      return React.createElement("div", {key:s.id,id:"privacy-" + s.id,style:{marginBottom:20}},
        React.createElement("h3", {style:{fontSize:15,fontWeight:700,color:"#F2EDE4",marginBottom:8}}, s.title),
        React.createElement("p", {style:{fontSize:13,color:"#BECBD9",lineHeight:1.6}}, s.body)
      );
    })
  );
}

// ─── TERMS OF SERVICE ────────────────────────────────────────────────────────

function TermsScreen() {
  var sections = [
    {id:"acceptance",title:"Acceptance of Terms",body:"By creating an account or using TFT Clash, you agree to these terms. If you do not agree, please do not use the platform."},
    {id:"accounts",title:"Accounts",body:"You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. One account per person."},
    {id:"conduct",title:"Acceptable Use",body:"You agree not to: manipulate game results, use automated tools to interact with the platform, harass other users, impersonate others, or exploit bugs instead of reporting them."},
    {id:"content",title:"User Content",body:"You retain ownership of content you create (profile info, messages). By posting, you grant TFT Clash a license to display it within the platform. We may remove content that violates these terms."},
    {id:"subscriptions",title:"Subscriptions and Payments",body:"Paid tiers (Pro, Host) are billed monthly. You may cancel at any time. Refunds are handled case-by-case. Features are subject to change with notice."},
    {id:"termination",title:"Termination",body:"We may suspend or terminate accounts that violate these terms. You may delete your account at any time via Account Settings."},
    {id:"liability",title:"Limitation of Liability",body:"TFT Clash is provided as-is. We are not liable for competitive outcomes, data loss from service interruptions, or third-party actions. Use the platform at your own risk."},
    {id:"changes",title:"Changes to Terms",body:"We may update these terms periodically. Continued use after changes constitutes acceptance. We will notify users of significant changes via the platform."}
  ];
  return React.createElement("div", {className:"page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{fontSize:22,color:"#F2EDE4",marginBottom:4}}, "Terms of Service"),
    React.createElement("div", {style:{fontSize:11,color:"#9AAABF",marginBottom:20}}, "Last updated: March 2026"),
    React.createElement("div", {style:{marginBottom:24,padding:"12px 16px",background:"rgba(255,255,255,.03)",borderRadius:10}},
      sections.map(function(s) {
        return React.createElement("a", {key:s.id,href:"#terms-" + s.id,style:{display:"block",fontSize:12,color:"#9B72CF",textDecoration:"none",padding:"4px 0"}}, s.title);
      })
    ),
    sections.map(function(s) {
      return React.createElement("div", {key:s.id,id:"terms-" + s.id,style:{marginBottom:20}},
        React.createElement("h3", {style:{fontSize:15,fontWeight:700,color:"#F2EDE4",marginBottom:8}}, s.title),
        React.createElement("p", {style:{fontSize:13,color:"#BECBD9",lineHeight:1.6}}, s.body)
      );
    })
  );
}


// ─── ROOT ─────────────────────────────────────────────────────────────────────


// ─── FOOTER ───────────────────────────────────────────────────────────────────

function NewsletterSignup(props){
  var toast=props.toast;
  var email=props.emailRef;
  var submitted=props.submitted;
  var setSubmitted=props.setSubmitted;
  return(
    <div style={{background:"linear-gradient(145deg,rgba(14,22,40,.88),rgba(8,12,24,.92))",border:"1px solid rgba(155,114,207,.2)",borderRadius:14,padding:"24px 20px",textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#F2EDE4",marginBottom:6,fontFamily:"'Russo One',sans-serif"}}>Stay in the Loop</div>
      <div style={{fontSize:12,color:"#BECBD9",marginBottom:14,lineHeight:1.5}}>Weekly recap, upcoming clashes, and meta updates. No spam.</div>
      {submitted?<div style={{color:"#6EE7B7",fontSize:13,fontWeight:600}}>{"\u2713"} Subscribed! Check your inbox.</div>:(
        <form onSubmit={function(e){e.preventDefault();var val=email.current&&email.current.value;if(!val||!val.includes("@")){if(toast)toast("Enter a valid email","error");return;}try{var subs=JSON.parse(localStorage.getItem("tft-newsletter-subs")||"[]");if(!subs.includes(val)){subs.push(val);localStorage.setItem("tft-newsletter-subs",JSON.stringify(subs));}}catch(ex){}setSubmitted(true);if(toast)toast("Subscribed! Welcome aboard.","success");}} style={{display:"flex",gap:8,maxWidth:360,margin:"0 auto"}}>
          <input ref={email} type="email" placeholder="your@email.com" style={{flex:1,background:"#0D1525",border:"1px solid rgba(242,237,228,.1)",borderRadius:8,padding:"10px 12px",color:"#F2EDE4",fontSize:13,fontFamily:"'Chakra Petch',sans-serif"}}/>
          <button type="submit" style={{padding:"10px 20px",background:"linear-gradient(135deg,#9B72CF,#7C5AAF)",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Chakra Petch',sans-serif",fontSize:13,flexShrink:0}}>Subscribe</button>
        </form>
      )}
    </div>
  );
}

function ClashReminderBtn(props){
  var toast=props.toast;
  var enabled=props.enabled;
  var setEnabled=props.setEnabled;
  function requestNotif(){
    if(!("Notification" in window)){if(toast)toast("Browser doesn't support notifications","error");return;}
    if(Notification.permission==="granted"){setEnabled(true);if(toast)toast("Clash reminders enabled!","success");}
    else if(Notification.permission!=="denied"){Notification.requestPermission().then(function(perm){if(perm==="granted"){setEnabled(true);if(toast)toast("Clash reminders enabled!","success");}else{if(toast)toast("Notification permission denied","error");}});}
    else{if(toast)toast("Notifications blocked. Enable in browser settings.","error");}
  }
  return(
    <button onClick={function(){if(enabled){setEnabled(false);if(toast)toast("Reminders disabled","info");}else{requestNotif();}}}
      style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",
        background:enabled?"rgba(78,205,196,.1)":"rgba(155,114,207,.08)",
        border:"1px solid "+(enabled?"rgba(78,205,196,.4)":"rgba(155,114,207,.2)"),
        borderRadius:10,cursor:"pointer",color:enabled?"#5EEAD4":"#C4B5FD",fontSize:13,fontWeight:600,
        fontFamily:"'Chakra Petch',sans-serif",transition:"all .2s"}}>
      {enabled?React.createElement("i",{className:"ti ti-bell",style:{fontSize:16}}):React.createElement("i",{className:"ti ti-bell-off",style:{fontSize:16}})}
      {enabled?"Reminders On":"Enable Clash Reminders"}
    </button>
  );
}

function WeeklyRecapCard(props){
  var players=props.players;
  var pastClashes=props.pastClashes;
  if(!players||players.length===0)return null;
  var thisWeek=new Date();thisWeek.setDate(thisWeek.getDate()-7);
  var recentClashes=pastClashes?pastClashes.filter(function(c){return new Date(c.date)>=thisWeek;}):[];
  var sorted=players.slice().sort(function(a,b){return(b.pts||0)-(a.pts||0);});
  var top5=sorted.slice(0,5);
  var totalGames=players.reduce(function(acc,p){return acc+(p.games||0);},0);
  var totalWins=players.reduce(function(acc,p){return acc+(p.wins||0);},0);
  if(totalGames===0)return null;
  return(
    <Panel style={{padding:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <span style={{fontSize:18}}>{React.createElement("i",{className:"ti ti-chart-bar"})}</span>
        <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",fontFamily:"'Russo One',sans-serif"}}>Weekly Recap</div>
        <Tag color="#9B72CF">This Week</Tag>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        <div className="inner-box" style={{padding:12,textAlign:"center"}}><div className="mono" style={{fontSize:20,fontWeight:700,color:"#E8A838"}}>{recentClashes.length}</div><div style={{fontSize:10,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".06em"}}>Clashes</div></div>
        <div className="inner-box" style={{padding:12,textAlign:"center"}}><div className="mono" style={{fontSize:20,fontWeight:700,color:"#4ECDC4"}}>{totalGames}</div><div style={{fontSize:10,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".06em"}}>Games</div></div>
        <div className="inner-box" style={{padding:12,textAlign:"center"}}><div className="mono" style={{fontSize:20,fontWeight:700,color:"#6EE7B7"}}>{totalWins}</div><div style={{fontSize:10,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".06em"}}>Total Wins</div></div>
      </div>
      <div style={{fontSize:12,fontWeight:700,color:"#C4B5FD",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Top Performers</div>
      {top5.map(function(p,i){return(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<4?"1px solid rgba(242,237,228,.04)":"none"}}>
          <span className="mono" style={{fontSize:12,fontWeight:700,color:i<3?"#E8A838":"#9AAABF",width:18}}>{i+1}</span>
          <span style={{flex:1,fontSize:13,color:"#F2EDE4",fontWeight:600}}>{p.name}</span>
          <span className="mono" style={{fontSize:13,fontWeight:700,color:"#E8A838"}}>{p.pts} pts</span>
        </div>
      );})}
    </Panel>
  );
}

function Footer(props){
  var setScreen=props.setScreen;
  var platformLinks=[["home","Home"],["roster","Roster"],["leaderboard","Leaderboard"],["hof","Hall of Fame"],["archive","Archive"]];
  var communityLinks=[["featured","Featured Events"],["rules","Rules"],["faq","FAQ"],["gear","Gear"]];
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
            <img src="/icon-border.png" alt="TFT Clash" style={{width:16,height:16,opacity:0.4}}/>
            <span style={{fontSize:10,color:"#5A6573"}}>Built for the community</span>
          </div>
        </div>
      </div>
    </footer>
  );
}


function PlayerComparisonModal(props) {
  var me = props.playerA;
  var them = props.playerB;
  var players = props.players;
  var onClose = props.onClose;
  if (!me || !them) return null;

  var meStats = getStats(me);
  var themStats = getStats(them);
  var h2h = computeH2H(me, them, props.pastClashes || []);
  var meRank = players.filter(function(p){return p.pts > me.pts;}).length + 1;
  var themRank = players.filter(function(p){return p.pts > them.pts;}).length + 1;

  var rows = [
    {label:"Rank",a:"#"+meRank,b:"#"+themRank,better:meRank < themRank ? "a" : meRank > themRank ? "b" : null},
    {label:"Points",a:me.pts,b:them.pts,better:me.pts > them.pts ? "a" : me.pts < them.pts ? "b" : null},
    {label:"Wins",a:me.wins,b:them.wins,better:me.wins > them.wins ? "a" : me.wins < them.wins ? "b" : null},
    {label:"Avg Placement",a:meStats.avgPlacement ? meStats.avgPlacement.toFixed(1) : "-",b:themStats.avgPlacement ? themStats.avgPlacement.toFixed(1) : "-",better:meStats.avgPlacement < themStats.avgPlacement ? "a" : meStats.avgPlacement > themStats.avgPlacement ? "b" : null},
    {label:"Win Rate",a:Math.round(meStats.winRate || 0)+"%",b:Math.round(themStats.winRate || 0)+"%",better:(meStats.winRate||0) > (themStats.winRate||0) ? "a" : (meStats.winRate||0) < (themStats.winRate||0) ? "b" : null},
    {label:"Top 4 Rate",a:Math.round(meStats.top4Rate || 0)+"%",b:Math.round(themStats.top4Rate || 0)+"%",better:(meStats.top4Rate||0) > (themStats.top4Rate||0) ? "a" : (meStats.top4Rate||0) < (themStats.top4Rate||0) ? "b" : null}
  ];

  return React.createElement("div", {style:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999},onClick:onClose},
    React.createElement("div", {style:{background:"#111827",border:"1px solid rgba(155,114,207,.3)",borderRadius:16,padding:"24px",maxWidth:480,width:"90%",maxHeight:"80vh",overflowY:"auto"},onClick:function(e){e.stopPropagation();}},
      h2h ? React.createElement("div", {style:{textAlign:"center",marginBottom:16}},
        React.createElement("div", {style:{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:4}}, me.name + " vs " + them.name),
        React.createElement("div", {style:{fontSize:11,color:"#9B72CF"}}, h2h.wins + "-" + h2h.losses + " in " + h2h.total + " shared lobbies")
      ) : React.createElement("div", {style:{textAlign:"center",fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:16}}, me.name + " vs " + them.name),
      rows.map(function(row) {
        return React.createElement("div", {key:row.label,style:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.06)",alignItems:"center"}},
          React.createElement("div", {style:{textAlign:"right",fontSize:15,fontWeight:700,color:row.better === "a" ? "#6EE7B7" : "#F2EDE4",background:row.better === "a" ? "rgba(110,231,183,.08)" : "transparent",borderRadius:6,padding:"4px 8px"}}, row.a),
          React.createElement("div", {style:{fontSize:10,color:"#9AAABF",textTransform:"uppercase",fontWeight:600,textAlign:"center",minWidth:80}}, row.label),
          React.createElement("div", {style:{textAlign:"left",fontSize:15,fontWeight:700,color:row.better === "b" ? "#6EE7B7" : "#F2EDE4",background:row.better === "b" ? "rgba(110,231,183,.08)" : "transparent",borderRadius:6,padding:"4px 8px"}}, row.b)
        );
      }),
      React.createElement("div", {style:{position:"relative",height:40,marginTop:16,marginBottom:8}},
        React.createElement("div", {style:{position:"absolute",inset:0}},
          React.createElement(Sparkline, {data:(me.clashHistory||[]).slice(-8).map(function(c){return c.placement||4;}), width:200, height:40, color:"#9B72CF"})
        ),
        React.createElement("div", {style:{position:"absolute",inset:0}},
          React.createElement(Sparkline, {data:(them.clashHistory||[]).slice(-8).map(function(c){return c.placement||4;}), width:200, height:40, color:"#4ECDC4"})
        ),
        React.createElement("div", {style:{display:"flex",gap:12,justifyContent:"center",marginTop:2}},
          React.createElement("span", {style:{fontSize:9,color:"#9B72CF",fontWeight:600}}, me.name),
          React.createElement("span", {style:{fontSize:9,color:"#4ECDC4",fontWeight:600}}, them.name)
        )
      ),
      React.createElement("div", {style:{textAlign:"center",marginTop:16}},
        React.createElement(Btn, {v:"dark",s:"sm",onClick:onClose}, "Close")
      )
    )
  );
}


function OnboardingFlow(props) {
  var currentUser = props.currentUser;
  var onComplete = props.onComplete;
  var onRegister = props.onRegister;
  var nextClash = props.nextClash;
  var playerCount = props.playerCount || 0;

  var _step = useState(1);
  var step = _step[0];
  var setStep = _step[1];
  var _riotId = useState("");
  var riotId = _riotId[0];
  var setRiotId = _riotId[1];
  var _region = useState("EUW");
  var region = _region[0];
  var setRegion = _region[1];
  var _linking = useState(false);
  var linking = _linking[0];
  var setLinking = _linking[1];

  // Screen 1: Welcome cinematic
  if (step === 1) {
    return React.createElement("div", {style:{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10000,textAlign:"center",padding:32}},
      React.createElement("div", {style:{fontSize:14,color:"#E8A838",fontWeight:700,animation:"fadeIn 1s ease"}},
        "Welcome, " + (currentUser ? currentUser.username : "Player") + "."
      ),
      React.createElement("div", {style:{fontSize:13,color:"#C8D4E0",marginTop:16,animation:"fadeIn 2s ease"}},
        "Your story starts now."
      ),
      React.createElement("div", {style:{marginTop:32,animation:"fadeIn 3s ease"}},
        React.createElement(Btn, {v:"primary",onClick:function(){setStep(2);}}, "Enter the Arena")
      )
    );
  }

  // Screen 2: Link Riot ID
  if (step === 2) {
    return React.createElement("div", {style:{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10000,padding:32}},
      React.createElement("div", {style:{maxWidth:360,width:"100%",textAlign:"center"}},
        React.createElement("h2", {className:"display",style:{color:"#F2EDE4",marginBottom:8}}, "Link Your Riot ID"),
        React.createElement("p", {style:{fontSize:13,color:"#BECBD9",marginBottom:24}}, "So we can track your placements and build your legacy."),
        React.createElement(Inp, {placeholder:"Name#TAG",value:riotId,onChange:function(e){setRiotId(e.target.value);},style:{marginBottom:12,textAlign:"center"}}),
        React.createElement("select", {value:region,onChange:function(e){setRegion(e.target.value);},style:{width:"100%",padding:"10px 14px",borderRadius:10,background:"#1A2235",border:"1px solid rgba(255,255,255,.1)",color:"#F2EDE4",fontSize:13,marginBottom:16}},
          REGIONS.map(function(r) { return React.createElement("option", {key:r,value:r}, r); })
        ),
        React.createElement(Btn, {v:"primary",full:true,disabled:linking,onClick:function(){
          if (!riotId.includes("#")) return;
          setLinking(true);
          supabase.from("user_profiles").update({riot_id:riotId,region:region,onboarding_step:3}).eq("user_id",currentUser.id).then(function() {
            setLinking(false);
            setStep(3);
          });
        }}, linking ? "Linking..." : "Link Account"),
        React.createElement("div", {style:{marginTop:12,fontSize:12,color:"#6B7B8F",cursor:"pointer"},onClick:function(){setStep(3);}}, "Skip for now")
      )
    );
  }

  // Screen 3: Your Player Card
  if (step === 3) {
    var displayName = riotId || (currentUser ? currentUser.username : "Player");
    var displayRegion = region || "EUW";
    return React.createElement("div", {style:{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10000,padding:32}},
      React.createElement("div", {style:{background:"#111827",border:"1px solid rgba(155,114,207,.3)",borderRadius:16,padding:"28px 24px",maxWidth:340,width:"100%",textAlign:"center"}},
        React.createElement("div", {style:{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,rgba(155,114,207,.3),rgba(78,205,196,.15))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:"2px solid rgba(155,114,207,.4)"}},
          React.createElement("i", {className:"ti ti-user",style:{fontSize:22,color:"#C4B5FD"}})
        ),
        React.createElement("div", {style:{fontSize:11,color:"#9AAABF",fontWeight:600,textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}, "Unranked"),
        React.createElement("div", {style:{fontSize:20,fontWeight:700,color:"#F2EDE4",marginBottom:4}}, currentUser ? currentUser.username : "Player"),
        React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginBottom:12}}, displayName + " - " + displayRegion),
        React.createElement("div", {style:{fontSize:12,color:"#9AAABF",marginBottom:16}}, "0 pts - 0 clashes"),
        React.createElement("div", {style:{borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:12}},
          React.createElement("div", {style:{fontSize:11,color:"#BECBD9",marginBottom:4}}, "Next Clash: " + (nextClash || "Saturday")),
          React.createElement("div", {style:{fontSize:10,color:"#9AAABF"}}, "Status: Not yet registered")
        ),
        React.createElement("div", {style:{fontSize:12,fontStyle:"italic",color:"#9B72CF",marginTop:12}}, "Every champion started here.")
      ),
      React.createElement("div", {style:{display:"flex",gap:12,marginTop:24}},
        React.createElement(Btn, {v:"dark",onClick:function(){
          supabase.from("user_profiles").update({onboarding_complete:true,onboarding_step:4}).eq("user_id",currentUser.id);
          if (onComplete) onComplete();
        }}, "See the Leaderboard"),
        React.createElement(Btn, {v:"primary",onClick:function(){
          supabase.from("user_profiles").update({onboarding_complete:true,onboarding_step:4}).eq("user_id",currentUser.id);
          if (onRegister) onRegister();
          if (onComplete) onComplete();
        }}, "Register for Clash")
      )
    );
  }

  return null;
}

function BroadcastOverlay(props) {
  var tournamentState = props.tournamentState;
  var players = props.players;
  var params = props.params || {};
  var type = params.type || "standings";
  var bg = params.bg || "dark";
  var size = params.size || "compact";

  var _liveData = useState(players);
  var liveData = _liveData[0];
  var setLiveData = _liveData[1];
  var _lastUpdate = useState(new Date());
  var lastUpdate = _lastUpdate[0];
  var setLastUpdate = _lastUpdate[1];

  useEffect(function() {
    var interval = setInterval(function() {
      supabase.from("players").select("*").order("pts", {ascending: false}).then(function(res) {
        if (res.data) {
          setLiveData(res.data);
          setLastUpdate(new Date());
        }
      });
    }, 10000);

    var channel = supabase.channel("broadcast-live")
      .on("postgres_changes", {event: "INSERT", schema: "public", table: "game_results"}, function() {
        supabase.from("players").select("*").order("pts", {ascending: false}).then(function(res) {
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

  var sorted = [].concat(liveData).sort(function(a,b){return b.pts - a.pts;});
  var bgColor = bg === "transparent" ? "transparent" : "#08080F";

  if (type === "standings") {
    return React.createElement("div", {style:{background:bgColor,padding:size === "compact" ? 12 : 20,fontFamily:"Inter,system-ui,sans-serif",minHeight:"100vh"}},
      React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}},
        React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".1em"}}, tournamentState.clashName || "TFT Clash"),
        tournamentState.phase === "inprogress" ? React.createElement("div", {style:{display:"flex",alignItems:"center",gap:4}},
          React.createElement("div", {style:{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite"}}),
          React.createElement("span", {style:{fontSize:11,fontWeight:700,color:"#6EE7B7"}}, "LIVE - Game " + (tournamentState.round || 1) + "/" + (tournamentState.totalGames || 3))
        ) : null
      ),
      sorted.slice(0, 24).map(function(p, i) {
        return React.createElement("div", {key:p.id,style:{display:"flex",alignItems:"center",gap:8,padding:size === "compact" ? "4px 8px" : "8px 12px",borderBottom:"1px solid rgba(255,255,255,.06)",background:i < 3 ? "rgba(232,168,56,.04)" : "transparent"}},
          React.createElement("span", {style:{width:24,textAlign:"right",fontSize:13,fontWeight:700,color:i === 0 ? "#E8A838" : i < 3 ? "#C0C0C0" : "#9AAABF"}}, i+1),
          React.createElement("span", {style:{flex:1,fontSize:13,fontWeight:600,color:"#F2EDE4"}}, p.name),
          React.createElement("span", {style:{fontSize:13,fontWeight:700,color:"#E8A838",fontFamily:"monospace"}}, p.pts)
        );
      }),
      React.createElement("div", {style:{textAlign:"right",marginTop:8,fontSize:8,color:"rgba(155,114,207,.4)",letterSpacing:".1em"}}, "TFT CLASH"),
      React.createElement("div", {style:{fontSize:8,color:"rgba(255,255,255,.3)",marginTop:4}},
        "Updated: " + lastUpdate.toLocaleTimeString()
      )
    );
  }

  if (type === "lobbies" && tournamentState.lobbies) {
    return React.createElement("div", {style:{background:bgColor,padding:12,fontFamily:"Inter,system-ui,sans-serif"}},
      React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"#E8A838",textTransform:"uppercase",marginBottom:8}}, "Lobby Assignments"),
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}},
        (tournamentState.lobbies || []).map(function(lobby, li) {
          return React.createElement("div", {key:li,style:{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(255,255,255,.08)"}},
            React.createElement("div", {style:{fontSize:10,fontWeight:700,color:"#9B72CF",marginBottom:4}}, lobby.name || "Lobby " + (li+1)),
            (lobby.players || []).map(function(pid) {
              var p = liveData.find(function(pl){return String(pl.id) === String(pid);});
              return React.createElement("div", {key:pid,style:{fontSize:11,color:"#BECBD9",padding:"2px 0"}}, p ? p.name : "Player " + pid);
            })
          );
        })
      )
    );
  }

  return React.createElement("div", {style:{background:bgColor,padding:20,color:"#9AAABF",fontSize:13}}, "No data available");
}

function TFTClash(){

  const [screen,setScreen]=useState(function(){var h=window.location.hash.replace("#","");var parts=h.split("/");return parts[0]||"home";});
  var [subRoute,setSubRoute]=useState(function(){
    var h=window.location.hash.replace("#","");
    var parts=h.split("/");
    return parts[1]||"";
  });

  const [players,setPlayers]=useState(()=>{try{const s=localStorage.getItem("tft-players");return s?JSON.parse(s):[];}catch{return [];}});

  const [isLoadingData,setIsLoadingData]=useState(true);

  const [isAdmin,setIsAdmin]=useState(()=>{try{return localStorage.getItem("tft-admin")==="1";}catch{return false;}});

  const [scrimAccess,setScrimAccess]=useState([]);
  const [tickerOverrides,setTickerOverrides]=useState([]);

  const [scrimSessions,setScrimSessions]=useState([]);


  const [notifications,setNotifications]=useState([]);

  const [toasts,setToasts]=useState([]);

  const [disputes]=useState([]);

  const [announcement,setAnnouncement]=useState("");

  const [profilePlayer,setProfilePlayer]=useState(null);

  var _cmp = useState(null);
  var comparePlayer = _cmp[0];
  var setComparePlayer = _cmp[1];

  const [tournamentState,setTournamentState]=useState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[],waitlistIds:[],maxPlayers:24});

  const [seasonConfig,setSeasonConfig]=useState(()=>{try{var s=localStorage.getItem("tft-season-config");return s?JSON.parse(s):DEFAULT_SEASON_CONFIG;}catch(e){return DEFAULT_SEASON_CONFIG;}});

  const [quickClashes,setQuickClashes]=useState(()=>{try{var s=localStorage.getItem("tft-events");return s?JSON.parse(s):[];}catch(e){return [];}});

  const [orgSponsors,setOrgSponsors]=useState(()=>{try{var s=localStorage.getItem("tft-sponsors");return s?JSON.parse(s):{};}catch(e){return {};}});

  const [scheduledEvents,setScheduledEvents]=useState(()=>{try{var s=localStorage.getItem('tft-scheduled-events');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [auditLog,setAuditLog]=useState([]);

  const [hostApps,setHostApps]=useState(()=>{try{var s=localStorage.getItem('tft-host-apps');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [hostTournaments,setHostTournaments]=useState(function(){try{var s=localStorage.getItem('tft-host-tournaments');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [hostBranding,setHostBranding]=useState(function(){try{var s=localStorage.getItem('tft-host-branding');return s?JSON.parse(s):{};}catch(e){return {};}});

  const [hostAnnouncements,setHostAnnouncements]=useState(function(){try{var s=localStorage.getItem('tft-host-announcements');return s?JSON.parse(s):[];}catch(e){return [];}});

  const [pastClashes,setPastClashes]=useState([]);

  const [featuredEvents,setFeaturedEvents]=useState(function(){try{var s=localStorage.getItem('tft-featured-events');return s?JSON.parse(s):[];}catch(e){return [];}});



  const [challengeCompletions,setChallengeCompletions]=useState(function(){try{var s=localStorage.getItem('tft-challenge-completions');return s?JSON.parse(s):{};}catch(e){return {};}});

  // Auth state

  const [currentUser,setCurrentUser]=useState({id:1,username:"Levitate",email:"levitate@tftclash.gg",riot_id:"Levitate#EUW",is_admin:true}); // DEV: mock user for preview - revert to null for prod
  const [isAuthLoading,setIsAuthLoading]=useState(true);
  var [isOffline,setIsOffline]=useState(false);

  var _sub=useState({});
  var subscriptions=_sub[0];
  var setSubscriptions=_sub[1];

  const [authScreen,setAuthScreen]=useState(null); // "login" | "signup" | null
  const [cookieConsent,setCookieConsent]=useState(function(){try{return localStorage.getItem("tft-cookie-consent")==="1";}catch(e){return false;}});

  var _onb = useState(false);
  var showOnboarding = _onb[0];
  var setShowOnboarding = _onb[1];

  // Newsletter + push notification state
  const newsletterEmailRef=useRef(null);
  const [newsletterSubmitted,setNewsletterSubmitted]=useState(function(){try{var subs=JSON.parse(localStorage.getItem("tft-newsletter-subs")||"[]");return subs.length>0;}catch(e){return false;}});
  const [clashRemindersOn,setClashRemindersOn]=useState(function(){try{return localStorage.getItem("tft-clash-reminders")==="1";}catch(e){return false;}});



  useEffect(function(){try{localStorage.setItem("tft-clash-reminders",clashRemindersOn?"1":"0");}catch(e){}},[clashRemindersOn]);

  useEffect(function(){
    if(!currentUser)return;
    supabase.from('notifications').select('*')
      .eq('user_id',currentUser.id)
      .order('created_at',{ascending:false})
      .limit(20)
      .then(function(res){
        if(res.data){
          setNotifications(res.data.map(function(n){
            var d=n.created_at?new Date(n.created_at):null;
            var time=d?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";
            return Object.assign({},n,{time:time});
          }));
        }
      });
  },[currentUser]);

  useEffect(function(){
    supabase.from("user_subscriptions").select("*").then(function(res){
      if(res.data){
        var map={};
        res.data.forEach(function(s){map[s.user_id]=s;});
        setSubscriptions(map);
      }
    });
  },[]);

  function markAllRead(){
    if(!currentUser)return;
    supabase.from('notifications').update({read:true})
      .eq('user_id',currentUser.id).eq('read',false)
      .then(function(){
        setNotifications(function(prev){
          return prev.map(function(n){return Object.assign({},n,{read:true});});
        });
      });
  }

  function toast(msg,type){const id=Date.now()+Math.random();setToasts(ts=>[...ts,{id,msg,type}]);}

  function removeToast(id){setToasts(ts=>ts.filter(t=>t.id!==id));}

// Supabase auth listener  -  hydrates currentUser on load and keeps it in sync

  useEffect(()=>{

    function mapUser(u){

      if(!u)return null;

      const discordName=u.identities?.find(i=>i.provider==='discord')?.identity_data?.global_name

        ||u.user_metadata?.full_name;

      const username=u.user_metadata?.username||discordName||u.email?.split('@')[0]||"Player";

      const riotId=u.user_metadata?.riotId||u.user_metadata?.riot_id||"";

      const region=u.user_metadata?.riotRegion||u.user_metadata?.riot_region||u.user_metadata?.region||"EUW";

      return{...u,username,riotId,region};

    }

    // DEV: skip auth hydration when mock user is set
    var DEV_MOCK=currentUser&&currentUser.email==="levitate@tftclash.gg";
    if(DEV_MOCK){setIsAuthLoading(false);return function(){};}

    supabase.auth.getSession().then(({data:{session}})=>{setCurrentUser(mapUser(session?.user??null));setIsAuthLoading(false);}).catch(function(){setIsAuthLoading(false);});

    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>setCurrentUser(mapUser(session?.user??null)));

    return ()=>subscription.unsubscribe();

  },[]);

  // Auto-create player row for OAuth users (Discord etc.) who bypass SignUpScreen
  useEffect(function(){
    if(!currentUser||!currentUser.id)return;
    supabase.from('players').select('id,riot_id').eq('auth_user_id',currentUser.id).maybeSingle()
      .then(function(res){
        if(res.error){console.error("[TFT] player check failed:",res.error);return;}
        if(res.data){
          // Player row exists  -  reload players to pick it up
          loadPlayersFromTable();
          return;
        }
        // No player row  -  create one
        var username=currentUser.username||currentUser.email?.split('@')[0]||"Player";
        var riotId=currentUser.riotId||"";
        var region=currentUser.region||"EUW";
        supabase.from('players').insert({
          username:username,
          riot_id:riotId,
          region:region,
          rank:'Iron',
          auth_user_id:currentUser.id
        }).select().single().then(function(ins){
          if(ins.error&&ins.error.code!=='23505'){
            console.error("[TFT] auto-create player failed:",ins.error);
            return;
          }
          console.log("[TFT] auto-created player row for",username);
          loadPlayersFromTable();
        });
      });
  },[currentUser?.id]);

  // Monitor realtime connection status for offline banner
  useEffect(function(){
    var channel=supabase.channel("app-status");
    channel.on("system",{},function(payload){
      if(payload.extension==="error"||payload.status==="channel_error"){
        setIsOffline(true);
      }
    });
    channel.subscribe(function(status){
      if(status==="SUBSCRIBED")setIsOffline(false);
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setIsOffline(true);
    });
    return function(){supabase.removeChannel(channel);};
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

  // ── Hash routing  -  single popstate handler for back/forward ────────────
  var navSourceRef=useRef("user");
  useEffect(function(){function onPop(){navSourceRef.current="popstate";var h=window.location.hash.replace("#","");var parts=h.split("/");var base=parts[0]||"home";setScreen(base);setSubRoute(parts[1]||"");}window.addEventListener("popstate",onPop);return function(){window.removeEventListener("popstate",onPop);};},[]);

  // ── Redirect legacy screens into StandingsScreen tabs ──
  useEffect(function(){
    var redirects={leaderboard:"standings",hof:"standings/hof",roster:"standings/roster",account:"profile",milestones:"profile/milestones",challenges:"profile/challenges",archive:"events",tournaments:"events/tournaments",featured:"events/featured",bracket:"clash",results:"clash/results"};
    if(redirects[screen]){navTo(redirects[screen]);}
  },[screen,navTo]);

  // ── Screen→hash sync: auto-updates URL, title, meta, scroll on any screen change ──
  useEffect(function(){
    if(navSourceRef.current==="popstate"){navSourceRef.current="user";}
    else{var fullHash=subRoute?screen+"/"+subRoute:screen;try{window.history.pushState({screen:screen,subRoute:subRoute},"","#"+fullHash);}catch(e){}}
    var titles={home:"Home",standings:"Standings",clash:"Clash",bracket:"Bracket",leaderboard:"Leaderboard",hof:"Hall of Fame",archive:"Archive",milestones:"Milestones",challenges:"Challenges",results:"Results",pricing:"Pricing",admin:"Admin",scrims:"Scrims",rules:"Rules",faq:"FAQ",featured:"Events",account:"Account",recap:"Season Recap",roster:"Roster","host-apply":"Host Application","host-dashboard":"Host Dashboard",profile:"Player Profile",privacy:"Privacy Policy",terms:"Terms of Service",gear:"Recommended Gear"};
    var t=titles[screen]||(screen.indexOf("tournament-")===0?"Tournament":"");
    document.title="TFT Clash"+(t?" \u2014 "+t:"");
    var descs={home:"Weekly TFT tournaments for competitive players. Free to compete, real rankings, community-driven.",standings:"Live season standings and rankings for TFT Clash tournaments.",bracket:"Tournament bracket, lobby assignments, and live results.",leaderboard:"Full leaderboard with stats, comparisons, and streak tracking.",hof:"Hall of Fame \u2014 records, champions, and legends of TFT Clash.",archive:"Past tournament results and clash history.",pricing:"TFT Clash subscription plans \u2014 Player (free), Pro, and Host tiers.",rules:"Official TFT Clash tournament rules, scoring, and tiebreaker system.",faq:"Frequently asked questions about TFT Clash tournaments.",featured:"Browse upcoming and featured TFT tournaments.",privacy:"TFT Clash privacy policy \u2014 how we handle your data.",gear:"Recommended gear for competitive TFT players.",terms:"TFT Clash terms of service \u2014 rules for using the platform."};
    var desc=descs[screen]||"TFT Clash \u2014 weekly competitive TFT tournaments.";
    var metaDesc=document.querySelector('meta[name="description"]');
    if(metaDesc)metaDesc.setAttribute("content",desc);
    var ogTitle=document.querySelector('meta[property="og:title"]');
    if(ogTitle)ogTitle.setAttribute("content","TFT Clash"+(t?" \u2014 "+t:""));
    var ogDesc=document.querySelector('meta[property="og:description"]');
    if(ogDesc)ogDesc.setAttribute("content",desc);
    var existingLD=document.getElementById("tft-jsonld");
    if(existingLD)existingLD.remove();
    var ld=null;
    if(screen==="home")ld={"@context":"https://schema.org","@type":"WebApplication","name":"TFT Clash","url":"https://tft-clash.vercel.app","description":desc,"applicationCategory":"GameApplication","operatingSystem":"Any","offers":{"@type":"AggregateOffer","lowPrice":"0","highPrice":"19.99","priceCurrency":"EUR"}};
    if(screen.indexOf("tournament-")===0)ld={"@context":"https://schema.org","@type":"SportsEvent","name":"TFT Clash Tournament","location":{"@type":"VirtualLocation","url":"https://tft-clash.vercel.app/#"+screen},"organizer":{"@type":"Organization","name":"TFT Clash"}};
    if(screen==="profile"||screen==="leaderboard")ld={"@context":"https://schema.org","@type":"SportsOrganization","name":"TFT Clash","sport":"Teamfight Tactics","url":"https://tft-clash.vercel.app"};
    if(ld){var s2=document.createElement("script");s2.type="application/ld+json";s2.id="tft-jsonld";s2.textContent=JSON.stringify(ld);document.head.appendChild(s2);}
    window.scrollTo(0,0);
  },[screen,subRoute]);

  // ── Stamp checkedIn from tournamentState.checkedInIds onto players ────────────

  useEffect(function(){

    var ids=new Set((tournamentState.checkedInIds||[]).map(String));

    setPlayers(function(ps){return ps.map(function(p){return{...p,checkedIn:ids.has(String(p.id))};});});

  },[tournamentState.checkedInIds]);

  // localStorage sync (fast cache)

  useEffect(()=>{var t=setTimeout(()=>{try{localStorage.setItem("tft-players",JSON.stringify(players));}catch{}},300);return()=>clearTimeout(t);},[players]);

  // notifications are stored in Supabase, not localStorage

  useEffect(()=>{try{localStorage.setItem("tft-admin",isAdmin?"1":"0");}catch{}},[isAdmin]);


  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-season-config",JSON.stringify(seasonConfig));}catch(e){}},300);return function(){clearTimeout(t);};},[seasonConfig]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-events",JSON.stringify(quickClashes));}catch(e){}},300);return function(){clearTimeout(t);};},[quickClashes]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-sponsors",JSON.stringify(orgSponsors));}catch(e){}},300);return function(){clearTimeout(t);};},[orgSponsors]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-scheduled-events",JSON.stringify(scheduledEvents));}catch(e){}},300);return function(){clearTimeout(t);};},[scheduledEvents]);
  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-host-apps",JSON.stringify(hostApps));}catch(e){}},300);return function(){clearTimeout(t);};},[hostApps]);



  // ── Load players from normalized players table (primary source of truth) ──
  function loadPlayersFromTable(){
    if(!supabase.from)return;
    supabase.from('players').select('*').order('username',{ascending:true})
      .then(function(res){
        if(res.error){console.error("[TFT] Failed to load players:",res.error);return;}
        if(!res.data||!res.data.length){setPlayers([]);return;}
        var mapped=res.data.map(function(r){
          return{
            id:r.id,name:r.username,username:r.username,
            riotId:r.riot_id||'',rank:r.rank||'Iron',region:r.region||'EUW',
            bio:r.bio||'',discord_user_id:r.discord_user_id||null,
            authUserId:r.auth_user_id||null,auth_user_id:r.auth_user_id||null,
            twitch:(r.social_links&&r.social_links.twitch)||'',
            twitter:(r.social_links&&r.social_links.twitter)||'',
            youtube:(r.social_links&&r.social_links.youtube)||'',
            pts:r.season_pts||0,wins:r.wins||0,top4:r.top4||0,games:r.games||0,
            avg:r.avg_placement?String(r.avg_placement):"0",
            banned:false,dnpCount:0,notes:'',checkedIn:false,
            clashHistory:[],sparkline:[],bestStreak:0,currentStreak:0,
            tiltStreak:0,bestHaul:0,attendanceStreak:0,lastClashId:null,
            role:"player",sponsor:null
          };
        });
        // Enrich with game_results for detailed stats (clashHistory, streaks, etc.)
        supabase.from('game_results').select('player_id,placement,points,round_number,tournament_id,game_number')
          .order('tournament_id',{ascending:true}).order('round_number',{ascending:true}).order('game_number',{ascending:true})
          .then(function(gr){
            if(!gr.error&&gr.data&&gr.data.length>0){
              var historyMap={};
              gr.data.forEach(function(g){
                var pid=g.player_id;
                if(!historyMap[pid])historyMap[pid]=[];
                historyMap[pid].push({place:g.placement,placement:g.placement,points:g.points,round:g.round_number,tournamentId:g.tournament_id,gameNumber:g.game_number});
              });
              mapped=mapped.map(function(p){
                var hist=historyMap[p.id];
                if(!hist||!hist.length)return p;
                var totalPts=hist.reduce(function(s,g){return s+(g.points||0);},0);
                var wins=hist.filter(function(g){return g.placement===1;}).length;
                var top4=hist.filter(function(g){return g.placement<=4;}).length;
                var avgP=hist.reduce(function(s,g){return s+g.placement;},0)/hist.length;
                return Object.assign({},p,{
                  pts:totalPts,wins:wins,top4:top4,games:hist.length,
                  avg:avgP.toFixed(1),clashHistory:hist
                });
              });
            }
            setPlayers(mapped);
          }).catch(function(e){ console.error("[TFT] game_results enrichment failed:", e); setPlayers(mapped); });
      });
  }

  // ── Supabase shared state  -  single channel for all keys ──────────────────

  const rtRef=useRef({tournament_state:false,quick_clashes:false,announcement:false,season_config:false,org_sponsors:false,scheduled_events:false,audit_log:false,host_apps:false,host_tournaments:false,host_branding:false,host_announcements:false,featured_events:false,challenge_completions:false,scrim_access:false,scrim_data:false,ticker_overrides:false});

  const announcementInitRef=useRef(false);

  useEffect(function(){

    if(!supabase.from){setIsLoadingData(false);return;}

    // Players: load from normalized players table (primary source of truth)
    loadPlayersFromTable();

    // Settings/config: load from site_settings (these remain as key-value pairs)
    supabase.from('site_settings').select('key,value')

      .in('key',['tournament_state','quick_clashes','announcement','season_config','org_sponsors','scheduled_events','audit_log','host_apps','scrim_access','scrim_data','ticker_overrides','host_tournaments','host_branding','host_announcements','featured_events','challenge_completions'])

      .then(function(res){

        if(!res.data){setIsLoadingData(false);return;}

        res.data.forEach(function(row){

          try{

            if(row.key==='announcement'){rtRef.current.announcement=true;setAnnouncement(typeof row.value==='string'?row.value:JSON.stringify(row.value)||'');}

            else{

              var val=typeof row.value==='string'?JSON.parse(row.value):row.value;

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

        // Reconcile registrations from DB  -  source of truth for who is registered
        setTournamentState(function(ts){
          if(!ts.dbTournamentId)return ts;
          supabase.from('registrations').select('player_id,status')
            .eq('tournament_id',ts.dbTournamentId)
            .then(function(regRes){
              if(regRes.error||!regRes.data)return;
              var regIds=[];
              var checkIds=[];
              regRes.data.forEach(function(r){
                if(r.status==='registered'||r.status==='checked_in')regIds.push(String(r.player_id));
                if(r.status==='checked_in')checkIds.push(String(r.player_id));
              });
              setTournamentState(function(ts2){
                rtRef.current.tournament_state=true;
                return Object.assign({},ts2,{registeredIds:regIds,checkedInIds:checkIds.length>0?checkIds:ts2.checkedInIds||[]});
              });
            });
          return ts;
        });

        setIsLoadingData(false);

      });

    // realtime  -  push changes to all browsers instantly

    var ch=supabase.channel('shared_state')

      .on('postgres_changes',{event:'*',schema:'public',table:'site_settings'},function(payload){

        try{

          var key=payload.new&&payload.new.key;

          var raw=payload.new&&payload.new.value;

          if(!key)return;

          if(key==='announcement'){rtRef.current.announcement=true;setAnnouncement(typeof raw==='string'?raw:JSON.stringify(raw)||'');return;}

          var val=typeof raw==='string'?JSON.parse(raw||'null'):raw;

          if(!val)return;

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

    // Realtime on players table  -  reload when any player row changes
    var playersCh=supabase.channel('players_realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'players'},function(){
        loadPlayersFromTable();
      })
      .subscribe();

    // Realtime on game_results  -  triggers player stats refresh (via DB trigger) and reloads players
    var gameResultsCh=supabase.channel('game_results_realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'game_results'},function(){
        loadPlayersFromTable();
      })
      .subscribe();

    // Realtime on registrations  -  handle INSERT, UPDATE, and DELETE
    var regCh=supabase.channel('registrations_realtime')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'registrations'},function(payload){
        var row=payload.new;
        if(!row||!row.player_id)return;
        var pid=String(row.player_id);
        if(row.status==='checked_in'){
          setTournamentState(function(ts){
            var ids=new Set((ts.checkedInIds||[]).map(String));
            ids.add(pid);
            return Object.assign({},ts,{checkedInIds:Array.from(ids)});
          });
        }
        if(row.status==='registered'){
          setTournamentState(function(ts){
            var ids=new Set((ts.registeredIds||[]).map(String));
            ids.add(pid);
            return Object.assign({},ts,{registeredIds:Array.from(ids)});
          });
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'registrations'},function(payload){
        var row=payload.new;
        if(!row||!row.player_id)return;
        var pid=String(row.player_id);
        if(row.status==='checked_in'){
          setTournamentState(function(ts){
            var cids=new Set((ts.checkedInIds||[]).map(String));
            cids.add(pid);
            return Object.assign({},ts,{checkedInIds:Array.from(cids)});
          });
        }
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'registrations'},function(payload){
        var old=payload.old;
        if(!old||!old.player_id)return;
        var pid=String(old.player_id);
        setTournamentState(function(ts){
          return Object.assign({},ts,{
            registeredIds:(ts.registeredIds||[]).filter(function(id){return String(id)!==pid;}),
            checkedInIds:(ts.checkedInIds||[]).filter(function(id){return String(id)!==pid;})
          });
        });
      })
      .subscribe();

    return function(){supabase.removeChannel(ch);supabase.removeChannel(playersCh);supabase.removeChannel(gameResultsCh);supabase.removeChannel(regCh);};

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

  // Players no longer synced to site_settings  -  players table is the source of truth

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
  // Use players.length as stable flag  -  only refetch when count changes, not on every mutation
  var playersLoadedCount=players.length;
  useEffect(function(){
    if(!supabase.from||!playersLoadedCount)return;
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
            var playersCopy=players;
            var clashes=res.data.map(function(t){
              var results=rRes.data.filter(function(r){return r.tournament_id===t.id;});
              var top8=results.slice(0,8).map(function(r){
                var p=playersCopy.find(function(pl){return String(pl.id)===String(r.player_id);});
                return p?p.name:('Player '+r.player_id);
              });
              return{id:t.id,name:t.name,date:t.date,season:'S1',players:results.length,lobbies:Math.ceil(results.length/8),champion:top8[0]||'Unknown',top3:top8};
            });
            setPastClashes(clashes);
          });
      });
  },[playersLoadedCount]);

  var navTo=useCallback(function(s,sub){
    var parts=s.split("/");
    var base=parts[0];
    var sr=sub||parts[1]||"";
    if(base==="admin"&&!isAdmin){toast("Admin access required","error");return;}
    var canScrims=isAdmin||(currentUser&&scrimAccess.includes(currentUser.username));
    if(base==="scrims"&&!canScrims){toast("Access restricted","error");return;}
    setScreen(base);
    setSubRoute(sr);
    if(base==="profile"){setProfilePlayer(null);}
  },[isAdmin,currentUser,scrimAccess,toast]);

  useEffect(function(){
    var params=new URLSearchParams(window.location.search);
    if(params.get("error")){
      var desc=params.get("error_description")||"Sign-in failed. Please try again.";
      toast(decodeURIComponent(desc.replace(/\+/g," ")),"error");
    }
    var refParam=params.get("ref");
    if(refParam){try{var prev=localStorage.getItem("tft-referred-by");if(!prev){localStorage.setItem("tft-referred-by",refParam);var rc=parseInt(localStorage.getItem("tft-referral-count-"+refParam)||"0");localStorage.setItem("tft-referral-count-"+refParam,String(rc+1));}}catch(e){}}
    if(params.get("checkout")==="success"){
      toast("Subscription activated! Welcome to Pro.","success");
      window.history.replaceState({},"",window.location.pathname+"#account");
    }
    var h=window.location.hash.slice(1);
    var isAuthCallback=h.startsWith("access_token")||h.startsWith("error_description")||params.get("code");
    if(isAuthCallback)return;
    var safeScreens=["home","standings","clash","events","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms","gear","tournaments","signup","login"];
    var hParts=h.split("/");var hBase=hParts[0];var hSub=hParts[1]||"";
    var isSafe=safeScreens.includes(hBase)||hBase.indexOf("tournament-")===0;
    var dest=isSafe?hBase:"home";
    if(dest!=="home"){setScreen(dest);setSubRoute(hSub);}
    window.history.replaceState({screen:dest,subRoute:hSub},"","#"+(hSub?dest+"/"+hSub:dest));
  },[]);

  function handleLogin(user){
    setCurrentUser(user);
    setAuthScreen(null);
    // Hydrate player from DB if not in local state
    if(user&&supabase.from){
      var alreadyLocal=players.some(function(p){
        return(p.name&&user.username&&p.name.toLowerCase()===user.username.toLowerCase())
          ||(p.riotId&&user.riotId&&p.riotId.toLowerCase()===user.riotId.toLowerCase());
      });
      if(alreadyLocal){
        // Patch authUserId onto existing local player if missing
        if(user.id){
          setPlayers(function(ps){return ps.map(function(p){
            var nameMatch=p.name&&user.username&&p.name.toLowerCase()===user.username.toLowerCase();
            var riotMatch=p.riotId&&user.riotId&&p.riotId.toLowerCase()===user.riotId.toLowerCase();
            if((nameMatch||riotMatch)&&!p.authUserId)return Object.assign({},p,{authUserId:user.id});
            return p;
          });});
        }
      }else{
        supabase.from('players').select('*').eq('auth_user_id',user.id).single()
          .then(function(res){
            if(res.data){
              var r=res.data;
              var np={
                id:r.id,name:r.username,username:r.username,
                riotId:r.riot_id||'',rank:r.rank||'Iron',region:r.region||'EUW',
                bio:r.bio||'',authUserId:r.auth_user_id,auth_user_id:r.auth_user_id,
                twitch:(r.social_links&&r.social_links.twitch)||'',
                twitter:(r.social_links&&r.social_links.twitter)||'',
                youtube:(r.social_links&&r.social_links.youtube)||'',
                pts:0,wins:0,top4:0,games:0,avg:"0",
                banned:false,dnpCount:0,notes:'',checkedIn:false,
                clashHistory:[],sparkline:[],bestStreak:0,currentStreak:0,
                tiltStreak:0,bestHaul:0,attendanceStreak:0,lastClashId:null,
                role:"player",sponsor:null
              };
              setPlayers(function(ps){return ps.concat([np]);});
            }
          });
      }
    }
  }

  function handleSignUp(user){
    setCurrentUser(user);
    setAuthScreen(null);
    setShowOnboarding(true);
  }

  async function handleLogout(){
    try{
      await supabase.auth.signOut();
      setCurrentUser(null);
      setScreen("home");
      toast("Logged out successfully","info");
    }catch(e){
      console.error("[TFT] logout failed:",e);
      toast("Logout failed","error");
    }
  }

  function updateUser(updated){setCurrentUser(updated);}

  function handleRegister(playerId){
    var sid=String(playerId);
    var isRegistered=(tournamentState.registeredIds||[]).includes(sid);
    setTournamentState(function(ts){
      var ids=ts.registeredIds||[];
      return {...ts,registeredIds:isRegistered?ids.filter(function(id){return id!==sid;}):[...ids,sid]};
    });
    // Sync to DB registrations table  -  auto-create tournament if needed
    if(supabase.from){
      if(isRegistered&&tournamentState.dbTournamentId){
        supabase.from('registrations').delete()
          .eq('tournament_id',tournamentState.dbTournamentId)
          .eq('player_id',playerId)
          .then(function(r){if(r.error)console.error("[TFT] unregister failed:",r.error);});
      }else if(!isRegistered){
        var doInsert=function(tid){
          supabase.from('registrations').upsert({
            tournament_id:tid,
            player_id:playerId,
            status:'registered'
          },{onConflict:'tournament_id,player_id'}).then(function(r){if(r.error)console.error("[TFT] registration insert failed:",r.error);});
        };
        if(tournamentState.dbTournamentId){
          doInsert(tournamentState.dbTournamentId);
        }else{
          supabase.from('tournaments').insert({name:tournamentState.clashName||'Next Clash',date:new Date().toISOString().split('T')[0],phase:'registration',max_players:parseInt(tournamentState.maxPlayers)||24}).select().single().then(function(res){
            if(!res.error&&res.data){
              var newId=res.data.id;
              setTournamentState(function(ts){return Object.assign({},ts,{dbTournamentId:newId});});
              doInsert(newId);
            }
          });
        }
      }
    }
    if(!isRegistered&&currentUser){
      createNotification(currentUser.id,"Registration Confirmed","You are registered for the next clash. Check in when the check-in window opens.","controller");
    }
    toast(isRegistered?"Unregistered from next clash":"Registered for next clash!",isRegistered?"info":"success");
  }

  function joinQuickClash(qcId,playerId){

    setQuickClashes(function(qs){return qs.map(function(q){

      if(q.id!==qcId||q.players.includes(playerId)) return q;

      var np=q.players.concat([playerId]);

      return Object.assign({},q,{players:np,status:np.length>=q.cap?"full":q.status});

    });});

  }



  // -- Compute SEASON_CHAMPION from live standings (derived state, not mutated) --
  var computedChampion=useMemo(function(){
    if(!players||players.length===0)return null;
    var scSorted=players.slice().sort(function(a,b){return(b.pts||0)-(a.pts||0);});
    var scTop=scSorted[0];
    if(scTop&&scTop.pts>0){
      return{name:scTop.name,title:"Season Leader",season:seasonConfig.name||"Season 1",since:"",pts:scTop.pts,wins:scTop.wins||0,rank:scTop.rank||"Challenger"};
    }
    return null;
  },[players,seasonConfig]);
  SEASON_CHAMPION=computedChampion;

  // Pre-compute tournament detail content to avoid IIFE in JSX
  var tournamentDetailContent=null;
  if(screen.indexOf("tournament-")===0){
    var evId=screen.replace("tournament-","");
    var ev=featuredEvents.find(function(e){return e.id===evId;});
    if(!ev){
      tournamentDetailContent=React.createElement("div",{className:"page wrap",style:{textAlign:"center",paddingTop:80}},
        React.createElement("div",{style:{fontSize:36,marginBottom:16}},"\ud83d\udd0d"),
        React.createElement("h2",{style:{color:"#F2EDE4",marginBottom:10}},"Event Not Found"),
        React.createElement("p",{style:{color:"#BECBD9"}},"This event may have been removed."),
        React.createElement(Btn,{v:"primary",onClick:function(){navTo("events/featured");}},"Back to Featured")
      );
    }else{
      tournamentDetailContent=React.createElement(TournamentDetailScreen,{event:ev,featuredEvents:featuredEvents,setFeaturedEvents:setFeaturedEvents,currentUser:currentUser,onAuthClick:function(m){setAuthScreen(m);},toast:toast,setScreen:navTo,players:players});
    }
  }

  // Compute current user's tier for feature gating
  var userTier=currentUser?getUserTier(subscriptions,currentUser.id):"free";

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

        <SignUpScreen onSignUp={handleSignUp} onGoLogin={()=>setAuthScreen("login")} onBack={()=>setAuthScreen(null)} toast={toast} setPlayers={setPlayers}/>

        <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

          {toasts.map(t=><div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>)}

        </div>

      </div>

    </>

  );

  if (screen === "broadcast") {
    var bParams = {};
    var hashParts = (window.location.hash || "").split("?");
    if (hashParts[1]) {
      hashParts[1].split("&").forEach(function(kv) {
        var parts = kv.split("=");
        bParams[parts[0]] = parts[1] || "";
      });
    }
    return React.createElement(BroadcastOverlay, {
      tournamentState: tournamentState,
      players: players,
      params: bParams
    });
  }

  return(

    <>

      <style>{GCSS+styleHideMobile+`

        .hide-mobile-text{display:inline;}

        @media(max-width:600px){.hide-mobile-text{display:none;}}

        @media(max-width:767px){

          .hide-mobile{display:none!important;}

          body,#root{overflow-x:hidden;max-width:100vw;}

          .wrap{overflow-x:hidden;padding:0 12px;}

          .page{padding:16px 12px 40px;}

        }

        @media(max-width:480px){

          .grid-home{grid-template-columns:1fr!important;gap:12px!important;}

          .wrap{padding:0 8px;}

          .page{padding:12px 8px 40px;}

        }

        @media(max-width:375px){

          .wrap{padding:0 6px;}

          .page{padding:10px 6px 40px;}

          h1{font-size:clamp(18px,5vw,28px)!important;}

          h2{font-size:clamp(16px,4.5vw,22px)!important;}

          .bottom-nav{padding:6px 4px!important;}

          .bottom-nav button{font-size:10px!important;padding:4px 2px!important;}

        }

        @keyframes ticker-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

        .ticker-scroll{display:flex;width:max-content;animation:ticker-scroll 32s linear infinite;will-change:transform;}

        .ticker-scroll:hover{animation-play-state:paused;}

        @keyframes fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slide-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse-glow{0%,100%{box-shadow:0 0 12px rgba(232,168,56,.3),0 0 24px rgba(232,168,56,.1)}50%{box-shadow:0 0 20px rgba(232,168,56,.5),0 0 40px rgba(232,168,56,.2)}}
        @keyframes live-dot{0%,100%{opacity:1}50%{opacity:.4}}
        .fade-up{animation:fade-up .4s ease both;}
        .slide-in{animation:slide-in .35s ease both;}
        .tab-btn{transition:all .2s ease;}
        .tab-btn:hover{color:#F2EDE4 !important;background:rgba(155,114,207,.08) !important;border-color:rgba(155,114,207,.25) !important;}

        @media(max-width:768px){
          .lobby-grid{grid-template-columns:1fr !important;}
          .live-standings-grid{grid-template-columns:28px 1fr 48px 40px !important;font-size:12px !important;}
          .tab-bar-wrap{gap:4px !important;}
          .tab-btn{padding:8px 14px !important;font-size:12px !important;}
          .page{padding:12px !important;}
          .stats-grid{grid-template-columns:repeat(2,1fr) !important;}
        }

        @media(max-width:480px){
          .page{padding:8px !important;}
          .stats-grid{grid-template-columns:1fr !important;}
          .display{font-size:18px !important;}
        }

        @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .count-up{animation:countUp 0.4s ease-out forwards;}
        @keyframes staggerIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .stagger-row{animation:staggerIn 0.3s ease-out forwards;opacity:0;}

      `}</style>

      <Hexbg/>

      {isOffline&&(
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9998,background:"rgba(220,38,38,.9)",color:"#fff",textAlign:"center",padding:"8px 16px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          <span>Connection lost  -  trying to reconnect...</span>
          <button onClick={function(){window.location.reload();}} style={{background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.3)",borderRadius:6,padding:"4px 12px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Retry</button>
        </div>
      )}

      {(isLoadingData||isAuthLoading)&&(
        <div style={{position:"fixed",inset:0,background:"#08080F",zIndex:9999,overflow:"hidden"}}>
          {/* Skeleton navbar */}
          <div style={{height:56,background:"#111827",borderBottom:"1px solid rgba(242,237,228,.06)",display:"flex",alignItems:"center",padding:"0 20px",gap:16}}>
            <Skeleton width={120} height={20} radius={6}/>
            <div style={{flex:1}}/>
            <Skeleton width={60} height={14} radius={4}/>
            <Skeleton width={60} height={14} radius={4}/>
            <Skeleton width={60} height={14} radius={4}/>
          </div>
          {/* Skeleton content */}
          <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 24px",display:"grid",gridTemplateColumns:"1fr 340px",gap:24}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <Skeleton height={140} radius={12}/>
              <Skeleton height={24} width={200} radius={6}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <Skeleton height={80} radius={10}/>
                <Skeleton height={80} radius={10}/>
                <Skeleton height={80} radius={10}/>
              </div>
              <Skeleton height={200} radius={12}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Skeleton height={180} radius={12}/>
              <Skeleton height={120} radius={12}/>
              <Skeleton height={100} radius={12}/>
            </div>
          </div>
          {/* Loading indicator */}
          <div style={{position:"fixed",bottom:40,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:20,height:20,border:"2px solid rgba(155,114,207,.2)",borderTopColor:"#9B72CF",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
            <div style={{fontFamily:"'Chakra Petch',sans-serif",fontSize:12,color:"#6B7280",letterSpacing:"0.1em"}}>Loading TFT Clash...</div>
          </div>
        </div>
      )}

      {showOnboarding&&React.createElement(OnboardingFlow,{
        currentUser:currentUser,
        onComplete:function(){setShowOnboarding(false);},
        onRegister:function(){setScreen("home");},
        nextClash:(tournamentState&&tournamentState.clashDate)||"Saturday",
        playerCount:players.length
      })}

      <div style={{position:"relative",zIndex:1,minHeight:"100vh",paddingBottom:72}}>

        <Navbar screen={screen} setScreen={navTo} players={players} isAdmin={isAdmin} setIsAdmin={setIsAdmin} toast={toast} disputes={disputes}

          currentUser={currentUser} onAuthClick={(mode)=>setAuthScreen(mode)} notifications={notifications} onMarkAllRead={markAllRead} scrimAccess={scrimAccess} tournamentState={tournamentState}/>



        <ScreenBoundary key={screen} name={screen} onHome={function(){navTo("home");}}>

        {screen==="home"       &&<HomeScreen players={players} setPlayers={setPlayers} setScreen={navTo} toast={toast} announcement={announcement} setProfilePlayer={setProfilePlayer} currentUser={currentUser} onAuthClick={(m)=>setAuthScreen(m)} tournamentState={tournamentState} setTournamentState={setTournamentState} quickClashes={quickClashes} onJoinQuickClash={joinQuickClash} onRegister={handleRegister} tickerOverrides={tickerOverrides} hostAnnouncements={hostAnnouncements} featuredEvents={featuredEvents} seasonConfig={seasonConfig}/>}

        {screen==="standings"  &&<StandingsScreen subRoute={subRoute} players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser} toast={toast} pastClashes={pastClashes}/>}

        {screen==="clash"      &&<ClashScreen subRoute={subRoute} players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig}/>}

        {screen==="bracket"    &&<MemoBracketScreen players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig}/>}

        {screen==="profile"    &&profilePlayer&&<MemoPlayerProfileScreen player={profilePlayer} onBack={()=>setScreen("leaderboard")} allPlayers={players} setScreen={navTo} currentUser={currentUser} seasonConfig={seasonConfig} setComparePlayer={setComparePlayer}/>}

        {screen==="profile"    &&!profilePlayer&&<ProfileScreen subRoute={subRoute} currentUser={currentUser} setAuthScreen={setAuthScreen} onUpdate={updateUser} onLogout={handleLogout} toast={toast} setScreen={navTo} players={players} setPlayers={setPlayers} setProfilePlayer={setProfilePlayer} isAdmin={isAdmin} hostApps={hostApps} challengeCompletions={challengeCompletions}/>}

        {screen==="results"    &&<MemoResultsScreen players={players} toast={toast} setScreen={navTo} setProfilePlayer={setProfilePlayer} tournamentState={tournamentState}/>}

        {screen==="events"     &&<EventsScreen subRoute={subRoute} players={players} currentUser={currentUser} setScreen={navTo} pastClashes={pastClashes} toast={toast} onAuthClick={function(m){setAuthScreen(m);}} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents}/>}

        {screen==="rules"      &&<RulesScreen setScreen={navTo}/>}

        {screen==="faq"        &&<FAQScreen setScreen={navTo}/>}

        {screen==="privacy"    &&<PrivacyScreen setScreen={navTo}/>}

        {screen==="terms"      &&<TermsScreen setScreen={navTo}/>}

        {screen==="gear"       &&<GearScreen setScreen={navTo} isAdmin={isAdmin} toast={toast}/>}

        {screen==="pricing"    &&<PricingScreen currentPlan={currentUser&&currentUser.plan||"free"} toast={toast} currentUser={currentUser} setScreen={navTo} userTier={userTier}/>}

        {screen==="recap"      &&profilePlayer&&<SeasonRecapScreen player={profilePlayer} players={players} toast={toast} setScreen={navTo}/>}

        {screen==="recap"      &&!profilePlayer&&<SeasonRecapScreen player={players[0]||null} players={players} toast={toast} setScreen={navTo}/>}

        {screen.indexOf("flash-")===0&&<FlashTournamentScreen tournamentId={screen.replace("flash-","")} currentUser={currentUser} onAuthClick={function(m){setAuthScreen(m);}} toast={toast} setScreen={navTo} players={players} isAdmin={isAdmin}/>}

        {screen.indexOf("tournament-")===0&&tournamentDetailContent}

        {screen==="host-apply" &&<HostApplyScreen currentUser={currentUser} toast={toast} setScreen={navTo} setHostApps={setHostApps}/>}

        {screen==="host-dashboard"&&(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&(a.name===currentUser.username||a.email===currentUser.email);})))&&<HostDashboardScreen currentUser={currentUser} players={players} toast={toast} setScreen={navTo} hostApps={hostApps} hostTournaments={hostTournaments} setHostTournaments={setHostTournaments} hostBranding={hostBranding} setHostBranding={setHostBranding} hostAnnouncements={hostAnnouncements} setHostAnnouncements={setHostAnnouncements} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents}/>}

        {screen==="host-dashboard"&&!(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&(a.name===currentUser.username||a.email===currentUser.email);})))&&<div className="page wrap" style={{textAlign:"center",paddingTop:80}}><div style={{fontSize:36,marginBottom:16}}>{React.createElement("i",{className:"ti ti-lock"})}</div><h2 style={{color:"#F2EDE4",marginBottom:10}}>Host Access Required</h2><p style={{color:"#BECBD9",fontSize:14,marginBottom:20}}>Your host application is pending review. You'll be notified once approved.</p><Btn v="primary" onClick={function(){navTo("home");}}>Back to Home</Btn></div>}


        {screen==="scrims"     &&(isAdmin||(currentUser&&scrimAccess.includes(currentUser.username)))&&<ScrimsScreen players={players} toast={toast} setScreen={navTo} sessions={scrimSessions} setSessions={setScrimSessions} isAdmin={isAdmin} scrimAccess={scrimAccess} setScrimAccess={setScrimAccess} tickerOverrides={tickerOverrides} setTickerOverrides={setTickerOverrides} setNotifications={setNotifications} currentUser={currentUser} linkedPlayer={linkedPlayer}/>}

        {screen==="admin"      &&isAdmin&&<AdminPanel players={players} setPlayers={setPlayers} toast={toast} setAnnouncement={setAnnouncement} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig} setSeasonConfig={setSeasonConfig} quickClashes={quickClashes} setQuickClashes={setQuickClashes} orgSponsors={orgSponsors} setOrgSponsors={setOrgSponsors} scheduledEvents={scheduledEvents} setScheduledEvents={setScheduledEvents} auditLog={auditLog} setAuditLog={setAuditLog} hostApps={hostApps} setHostApps={setHostApps} scrimAccess={scrimAccess} setScrimAccess={setScrimAccess} tickerOverrides={tickerOverrides} setTickerOverrides={setTickerOverrides} setNotifications={setNotifications} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents} currentUser={currentUser}/>}

        {screen==="admin"      &&!isAdmin&&(

          <div className="page" style={{textAlign:"center",maxWidth:440,margin:"0 auto"}}>

            <div style={{fontSize:38,marginBottom:14}}>{React.createElement("i",{className:"ti ti-lock"})}</div>

            <h2 style={{color:"#F2EDE4",marginBottom:8}}>Admin Required</h2>

            <div style={{fontSize:13,color:"#9AAABF"}}>Contact an admin to get access.</div>

          </div>

        )}

        </ScreenBoundary>

        <Footer setScreen={navTo}/>

      </div>



      {/* Newsletter + Weekly Recap  -  before footer */}
      {screen==="home"&&(
        <div className="wrap" style={{maxWidth:1200,margin:"0 auto",padding:"24px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <WeeklyRecapCard players={players} pastClashes={pastClashes}/>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <NewsletterSignup toast={toast} emailRef={newsletterEmailRef} submitted={newsletterSubmitted} setSubmitted={setNewsletterSubmitted}/>
            <ClashReminderBtn toast={toast} nextClash={scheduledEvents&&scheduledEvents[0]&&scheduledEvents[0].date} enabled={clashRemindersOn} setEnabled={setClashRemindersOn}/>
          </div>
        </div>
      )}

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

      {comparePlayer&&React.createElement(PlayerComparisonModal, {
        playerA: currentUser ? players.find(function(p){return (p.authUserId&&p.authUserId===currentUser.id)||(p.name===currentUser.username);}) || null : null,
        playerB: comparePlayer,
        players: players,
        pastClashes: pastClashes,
        onClose: function(){setComparePlayer(null);}
      })}

    </>

  );

}

export default function App(){return(<ErrorBoundary><TFTClash/></ErrorBoundary>);}

