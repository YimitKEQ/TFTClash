import React, { useState, useEffect, useMemo, useCallback, Component } from "react";
import * as Sentry from '@sentry/react';

import { supabase } from './lib/supabase.js';
import { DATA_VERSION, dbg } from './lib/constants.js';
import { createNotification } from './lib/notifications.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';

// ─── LAZY WITH RETRY ──────────────────────────────────────────────────────────
// Recovers from "Failed to fetch dynamically imported module" errors that
// happen when a user has a stale index.html referencing old chunk hashes
// after a deploy. On first chunk-load failure in a session, force one
// full reload to pick up the new index.html; if it still fails, surface
// the error instead of looping.
function lazyWithRetry(factory) {
  return React.lazy(function () {
    return factory()
      .then(function (mod) {
        try { sessionStorage.removeItem('tft-chunk-reload'); } catch (e) {}
        return mod;
      })
      .catch(function (err) {
        var msg = (err && err.message) || '';
        var isChunkError =
          msg.indexOf('Failed to fetch dynamically imported') !== -1 ||
          msg.indexOf('Importing a module script failed') !== -1 ||
          msg.indexOf('error loading dynamically imported module') !== -1 ||
          msg.indexOf('Unable to preload CSS') !== -1;
        if (isChunkError) {
          var key = 'tft-chunk-reload';
          var reloaded = null;
          try { reloaded = sessionStorage.getItem(key); } catch (e) {}
          if (!reloaded) {
            try { sessionStorage.setItem(key, '1'); } catch (e) {}
            try { window.location.reload(); } catch (e) {}
            return new Promise(function () {});
          }
        }
        throw err;
      });
  });
}

// Also catch Vite's preloadError event as a belt-and-braces fallback.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', function () {
    try {
      var key = 'tft-chunk-reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    } catch (e) {}
  });
}

var LoginScreenNew = lazyWithRetry(function(){ return import('./screens/LoginScreen'); });
var SignUpScreenNew = lazyWithRetry(function(){ return import('./screens/SignUpScreen'); });
var GuestHomeScreen = lazyWithRetry(function(){ return import('./screens/HomeScreen'); });
var DashboardScreen = lazyWithRetry(function(){ return import('./screens/DashboardScreen'); });
var LeaderboardScreenNew = lazyWithRetry(function(){ return import('./screens/LeaderboardScreen'); });
var PlayerProfileScreenNew = lazyWithRetry(function(){ return import('./screens/PlayerProfileScreen'); });
var StandingsScreenNew = lazyWithRetry(function(){ return import('./screens/StandingsScreen'); });
var BracketScreenNew = lazyWithRetry(function(){ return import('./screens/BracketScreen'); });
var PricingScreenNew = lazyWithRetry(function(){ return import('./screens/PricingScreen'); });
var EventsScreenNew = lazyWithRetry(function(){ return import('./screens/EventsScreen'); });
var ResultsScreenNew = lazyWithRetry(function(){ return import('./screens/ResultsScreen'); });
var SeasonRecapScreenNew = lazyWithRetry(function(){ return import('./screens/SeasonRecapScreen'); });
var ArchiveScreenNew = lazyWithRetry(function(){ return import('./screens/ArchiveScreen'); });
var MilestonesScreenNew = lazyWithRetry(function(){ return import('./screens/MilestonesScreen'); });
var ChallengesScreenNew = lazyWithRetry(function(){ return import('./screens/ChallengesScreen'); });
var RulesScreenNew = lazyWithRetry(function(){ return import('./screens/RulesScreen'); });
var FAQScreenNew = lazyWithRetry(function(){ return import('./screens/FAQScreen'); });
var AccountScreenNew = lazyWithRetry(function(){ return import('./screens/AccountScreen'); });
var PrivacyScreenNew = lazyWithRetry(function(){ return import('./screens/PrivacyScreen'); });
var TermsScreenNew = lazyWithRetry(function(){ return import('./screens/TermsScreen'); });
var ScrimsScreenNew = lazyWithRetry(function(){ return import('./screens/ScrimsScreen'); });
var HostApplyScreenNew = lazyWithRetry(function(){ return import('./screens/HostApplyScreen'); });
var HostDashboardScreenNew = lazyWithRetry(function(){ return import('./screens/HostDashboardScreen'); });
var TournamentRouterScreen = lazyWithRetry(function(){ return import('./screens/TournamentRouter'); });
var TournamentsListScreenNew = lazyWithRetry(function(){ return import('./screens/TournamentsListScreen'); });
var AdminScreenNew = lazyWithRetry(function(){ return import('./screens/AdminScreen'); });
var HofScreenNew = lazyWithRetry(function(){ return import('./screens/HofScreen'); });
var GearScreenNew = lazyWithRetry(function(){ return import('./screens/GearScreen'); });
var SquadsSimScreen = lazyWithRetry(function(){ return import('./screens/sim/SquadsSimScreen'); });
var TeamsScreen = lazyWithRetry(function(){ return import('./screens/TeamsScreen'); });
var TeamProfileScreen = lazyWithRetry(function(){ return import('./screens/TeamProfileScreen'); });
import PageLayout from './components/layout/PageLayout';
import ScreenSkeleton from './components/layout/ScreenSkeleton';
var ClashScreenNew = lazyWithRetry(function(){ return import('./screens/ClashScreen'); });
var NotFoundScreen = lazyWithRetry(function(){ return import('./screens/NotFoundScreen'); });
var StatusScreenNew = lazyWithRetry(function(){ return import('./screens/StatusScreen'); });
var ChangelogScreenNew = lazyWithRetry(function(){ return import('./screens/ChangelogScreen'); });
var ObsOverlayScreenNew = lazyWithRetry(function(){ return import('./screens/ObsOverlayScreen'); });
var StatsHubScreenNew = lazyWithRetry(function(){ return import('./screens/StatsHubScreen'); });

var SponsorsScreenNew = lazyWithRetry(function(){ return import('./screens/SponsorsScreen'); });
var CommandCenterScreen = lazyWithRetry(function(){ return import('./screens/CommandCenterScreen'); });
var ContentEngineScreen = lazyWithRetry(function(){ return import('./screens/ContentEngineScreen'); });
var Donut17ScreenNew = lazyWithRetry(function(){ return import('./donut17/Donut17Screen'); });
var BrosephTechScreen = lazyWithRetry(function(){ return import('./screens/BrosephTechScreen'); });
var TfttechScreen = lazyWithRetry(function(){ return import('./screens/TfttechScreen'); });
var LinksScreenNew = lazyWithRetry(function(){ return import('./screens/LinksScreen'); });
var MarketplaceScreenNew = lazyWithRetry(function(){ return import('./screens/MarketplaceScreen'); });
var RoadmapScreenNew = lazyWithRetry(function(){ return import('./screens/RoadmapScreen'); });
var PredictionsScreenNew = lazyWithRetry(function(){ return import('./screens/PredictionsScreen'); });
import NewsletterSignup from './components/shared/NewsletterSignup';
import ClashReminderBtn from './components/shared/ClashReminderBtn';
import WeeklyRecapCard from './components/shared/WeeklyRecapCard';
import PlayerComparisonModal from './components/shared/PlayerComparisonModal';
import OnboardingFlow from './components/shared/OnboardingFlow';
import BroadcastOverlay from './components/shared/BroadcastOverlay';
import CommandPalette from './components/shared/CommandPalette';
import { Btn } from './components/ui';

// ─── DATA VERSION  -  bump to bust stale localStorage ─────────────────────────
(function(){try{var v=localStorage.getItem("tft-data-version");if(v!==String(DATA_VERSION)){var keys=Object.keys(localStorage).filter(function(k){return k.startsWith("tft-");});keys.forEach(function(k){localStorage.removeItem(k);});localStorage.setItem("tft-data-version",String(DATA_VERSION));dbg("[TFT] Cleared stale localStorage (v"+DATA_VERSION+")");}}catch(e){}}());

// ─── ERROR BOUNDARY ────────────────────────────────────────────────────────────

class ErrorBoundary extends Component {

  constructor(props){super(props);this.state={hasError:false};}

  static getDerivedStateFromError(){return{hasError:true};}

  componentDidCatch(error,info){Sentry.captureException(error,{extra:{componentStack:info&&info.componentStack}});}

  render(){

    if(this.state.hasError){

      return(

        <div style={{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,zIndex:99999,padding:24}}>

          <div style={{fontSize:48,color:"#E8A838"}}>&#9888;</div>

          <div style={{fontFamily:"'Subtle',system-ui,sans-serif",fontSize:22,color:"#F2EDE4",textAlign:"center"}}>Something went wrong</div>

          <div style={{fontSize:14,color:"#9AAABF",maxWidth:340,textAlign:"center",lineHeight:1.6}}>The app hit an unexpected error. Your data is safe - refresh to get back in.</div>

          <button onClick={function(){this.setState({hasError:false})}.bind(this)} style={{marginTop:8,padding:"10px 24px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Subtle',system-ui,sans-serif",fontSize:14}}>Try Again</button>

          <button onClick={function(){window.location.reload()}} style={{padding:"8px 20px",background:"transparent",border:"1px solid rgba(155,114,207,.4)",borderRadius:8,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Subtle',system-ui,sans-serif",fontSize:13}}>Reload Page</button>

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

  componentDidCatch(error,info){Sentry.captureException(error,{tags:{screen:this.props.name},extra:{componentStack:info&&info.componentStack}});}

  render(){
    if(this.state.hasError){
      var self=this;
      return(
        <div className="page wrap" style={{textAlign:"center",paddingTop:80,maxWidth:440,margin:"0 auto"}}>
          <div style={{fontSize:42,marginBottom:16,color:"#E8A838"}}>&#9888;</div>
          <h2 style={{color:"#F2EDE4",marginBottom:8,fontFamily:"'Subtle',system-ui,sans-serif"}}>{"Something went wrong"}</h2>
          <div style={{fontSize:14,color:"#9AAABF",marginBottom:8,lineHeight:1.6}}>{"This screen ran into an error. Your data is safe."}</div>
          {this.state.error&&<div style={{fontSize:11,color:"#F87171",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:6,padding:"8px 12px",marginBottom:16,textAlign:"left",fontFamily:"'Subtle',ui-monospace,monospace",wordBreak:"break-all",maxHeight:120,overflow:"auto"}}>{String(this.state.error)}</div>}
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={function(){self.setState({hasError:false,error:null});}} style={{padding:"10px 24px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Subtle',system-ui,sans-serif",fontSize:14}}>Try Again</button>
            <button onClick={function(){self.setState({hasError:false,error:null});if(self.props.onHome)self.props.onHome();}} style={{padding:"8px 20px",background:"transparent",border:"1px solid rgba(155,114,207,.4)",borderRadius:8,color:"#C4B5FD",cursor:"pointer",fontFamily:"'Subtle',system-ui,sans-serif",fontSize:13}}>Go Home</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }

}

function Hexbg() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div className="scanlines absolute inset-0 z-[1] pointer-events-none" />
      <svg className="absolute inset-0 w-full h-full opacity-[.055]" xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="hxp" x="0" y="0" width="60" height="104" patternUnits="userSpaceOnUse">
          <path d="M30 2L58 18L58 50L30 66L2 50L2 18Z" fill="none" stroke="#9B72CF" strokeWidth=".8"/>
          <path d="M30 38L58 54L58 86L30 102L2 86L2 54Z" fill="none" stroke="#E8A838" strokeWidth=".8"/>
        </pattern></defs>
        <rect width="100%" height="100%" fill="url(#hxp)"/>
      </svg>
      <div className="absolute rounded-full" style={{top:"-15%",right:"-5%",width:900,height:900,background:"radial-gradient(circle,rgba(155,114,207,.11),transparent 60%)"}} />
      <div className="absolute rounded-full" style={{bottom:"-10%",left:"-10%",width:800,height:800,background:"radial-gradient(circle,rgba(78,205,196,.09),transparent 60%)"}} />
      <div className="absolute rounded-full" style={{top:"35%",left:"30%",width:700,height:700,background:"radial-gradient(circle,rgba(232,168,56,.06),transparent 60%)"}} />
      <div className="retro-scan-line" />
    </div>
  )
}

function Skeleton(props) {
  var w = props.width || "100%"
  var h = props.height || 16
  var r = props.radius || 8
  return React.createElement("div", {
    className: "animate-pulse",
    style: {
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%)",
      backgroundSize: "200% 100%"
    }
  })
}

function Toast(props) {
  var msg = props.msg
  var type = props.type
  var onClose = props.onClose
  useEffect(function() { var t = setTimeout(onClose, 5000); return function() { clearTimeout(t) } }, [])
  var c = type === "success" ? "#6EE7B7" : type === "error" ? "#F87171" : type === "info" ? "#60A5FA" : "#E8A838"
  return (
    <div className="flex items-center gap-3 rounded-lg shadow-xl min-w-[260px] max-w-[360px]" style={{background:"#151D2B",border:"1px solid " + c + "40",borderLeft:"3px solid " + c,padding:"12px 16px",animation:"slidein .3s ease"}}>
      <span style={{color:c,fontSize:17,lineHeight:1}}>{type === "success" ? "\u2713" : type === "error" ? "\u2717" : "\u2139"}</span>
      <span className="flex-1 text-on-surface text-sm leading-snug">{msg}</span>
      <button onClick={onClose} className="bg-transparent border-none text-on-surface/60 cursor-pointer text-xl leading-none p-0.5">{"\u00d7"}</button>
    </div>
  )
}

function TFTClash(){

  var navigate=useNavigate();
  var location=useLocation();
  var ctx=useApp();
  var screen=ctx.screen, setScreen=ctx.setScreen;
  var subRoute=ctx.subRoute, setSubRoute=ctx.setSubRoute;
  var navSourceRef=ctx.navSourceRef;

  // ── Route-to-screen backward compatibility sync ──
  // Maps React Router pathname back to legacy screen/subRoute state
  var ROUTE_TO_SCREEN={
    "/":"home","/login":"login","/signup":"signup","/standings":"standings",
    "/leaderboard":"leaderboard","/bracket":"bracket","/player":"profile",
    "/results":"results","/events":"events","/scrims":"scrims","/pricing":"pricing",
    "/milestones":"milestones","/challenges":"challenges","/hall-of-fame":"hof",
    "/archive":"archive","/season-recap":"recap","/rules":"rules","/faq":"faq",
    "/account":"account","/host/apply":"host-apply","/host/dashboard":"host-dashboard",
    "/admin":"admin","/privacy":"privacy","/terms":"terms","/clash":"clash",
    "/tournaments":"tournaments","/roster":"roster","/featured":"featured","/gear":"gear","/stats":"stats","/sponsors":"sponsors","/ops":"ops","/content-engine":"content-engine","/status":"status","/donut17":"donut17","/brosephtech":"brosephtech","/tfttech":"tfttech","/changelog":"changelog","/marketplace":"marketplace","/roadmap":"roadmap","/predictions":"predictions","/links":"links","/sim/squads":"squads-sim","/teams":"teams"
  };
  useEffect(function(){
    var path=location.pathname;
    // Direct match
    var mapped=ROUTE_TO_SCREEN[path];
    if(mapped){
      if(mapped==="login"||mapped==="signup"){navSourceRef.current="router";setAuthScreen(mapped);return;}
      if(mapped!==screen){navSourceRef.current="router";setScreen(mapped);}
      if(subRoute){navSourceRef.current="router";setSubRoute("");}
      return;
    }
    // Dynamic segments: /player/:name, /bracket/:id, /results/:id, /flash/:id, /tournament/:id
    var segs=path.replace(/^\//,"").split("/");
    if(segs[0]==="player"&&segs[1]){navSourceRef.current="router";setScreen("profile");setSubRoute(segs[1]);return;}
    if(segs[0]==="bracket"&&segs[1]){navSourceRef.current="router";setScreen("bracket");setSubRoute(segs[1]);return;}
    if(segs[0]==="results"&&segs[1]){navSourceRef.current="router";setScreen("results");setSubRoute(segs[1]);return;}
    if(segs[0]==="flash"&&segs[1]){navSourceRef.current="router";navigate("/tournament/"+segs[1],{replace:true});return;}
    if(segs[0]==="tournament"&&segs[1]){navSourceRef.current="router";setScreen("tournament-"+segs[1]);return;}
    if(segs[0]==="team"&&segs[1]){navSourceRef.current="router";setScreen("team-"+segs[1]);return;}
    if(segs[0]==="obs"&&segs[1]){navSourceRef.current="router";setScreen("obs-"+segs[1]);return;}
    if(segs[0]==="host"){
      if(segs[1]==="apply"){navSourceRef.current="router";setScreen("host-apply");return;}
      if(segs[1]==="dashboard"){navSourceRef.current="router";setScreen("host-dashboard");return;}
    }
    // Standings sub-routes
    if(segs[0]==="standings"&&segs[1]){navSourceRef.current="router";setScreen("standings");setSubRoute(segs[1]);return;}
    // Events sub-routes
    if(segs[0]==="events"&&segs[1]){navSourceRef.current="router";setScreen("events");setSubRoute(segs[1]);return;}
    // No match - 404
    navSourceRef.current="router";setScreen("not-found");
  },[location.pathname]);
  var players=ctx.players, setPlayers=ctx.setPlayers;
  var isLoadingData=ctx.isLoadingData;
  var isAdmin=ctx.isAdmin;
  var scrimAccess=ctx.scrimAccess, setScrimAccess=ctx.setScrimAccess;
  var scrimHostAccess=ctx.scrimHostAccess||[];
  var tickerOverrides=ctx.tickerOverrides, setTickerOverrides=ctx.setTickerOverrides;
  var scrimSessions=ctx.scrimSessions, setScrimSessions=ctx.setScrimSessions;
  var notifications=ctx.notifications, setNotifications=ctx.setNotifications;
  var toasts=ctx.toasts;
  var disputes=ctx.disputes;
  var announcement=ctx.announcement, setAnnouncement=ctx.setAnnouncement;
  var profilePlayer=ctx.profilePlayer, setProfilePlayer=ctx.setProfilePlayer;
  var comparePlayer=ctx.comparePlayer, setComparePlayer=ctx.setComparePlayer;
  var tournamentState=ctx.tournamentState, setTournamentState=ctx.setTournamentState;
  var seasonConfig=ctx.seasonConfig, setSeasonConfig=ctx.setSeasonConfig;
  var quickClashes=ctx.quickClashes, setQuickClashes=ctx.setQuickClashes;
  var orgSponsors=ctx.orgSponsors, setOrgSponsors=ctx.setOrgSponsors;
  var scheduledEvents=ctx.scheduledEvents, setScheduledEvents=ctx.setScheduledEvents;
  var auditLog=ctx.auditLog, setAuditLog=ctx.setAuditLog;
  var hostApps=ctx.hostApps, setHostApps=ctx.setHostApps;
  var hostTournaments=ctx.hostTournaments, setHostTournaments=ctx.setHostTournaments;
  var hostBranding=ctx.hostBranding, setHostBranding=ctx.setHostBranding;
  var hostAnnouncements=ctx.hostAnnouncements, setHostAnnouncements=ctx.setHostAnnouncements;
  var pastClashes=ctx.pastClashes;
  var featuredEvents=ctx.featuredEvents, setFeaturedEvents=ctx.setFeaturedEvents;
  var challengeCompletions=ctx.challengeCompletions;
  var allPendingResults=ctx.allPendingResults;
  var currentUser=ctx.currentUser, setCurrentUser=ctx.setCurrentUser;
  var isAuthLoading=ctx.isAuthLoading;
  var isOffline=ctx.isOffline;
  var subscriptions=ctx.subscriptions;
  var authScreen=ctx.authScreen, setAuthScreen=ctx.setAuthScreen;
  var cookieConsent=ctx.cookieConsent, setCookieConsent=ctx.setCookieConsent;
  var showOnboarding=ctx.showOnboarding, setShowOnboarding=ctx.setShowOnboarding;
  var newsletterEmailRef=ctx.newsletterEmailRef;
  var newsletterSubmitted=ctx.newsletterSubmitted, setNewsletterSubmitted=ctx.setNewsletterSubmitted;
  var clashRemindersOn=ctx.clashRemindersOn, setClashRemindersOn=ctx.setClashRemindersOn;
  var toast=ctx.toast;
  var removeToast=ctx.removeToast;
  var markAllRead=ctx.markAllRead;
  var loadPlayersFromTable=ctx.loadPlayersFromTable;
  var userTier=ctx.userTier;

  // ── Command palette (Cmd/Ctrl + K, plus global "tft:open-cmd" event) ──
  var _cmdOpen=useState(false);
  var cmdOpen=_cmdOpen[0];
  var setCmdOpen=_cmdOpen[1];
  useEffect(function(){
    function onKey(e){
      var isK=(e.key==="k"||e.key==="K");
      if(isK&&(e.metaKey||e.ctrlKey)){
        e.preventDefault();
        setCmdOpen(function(v){return !v;});
      }
    }
    function onOpen(){setCmdOpen(true);}
    window.addEventListener("keydown",onKey);
    window.addEventListener("tft:open-cmd",onOpen);
    return function(){
      window.removeEventListener("keydown",onKey);
      window.removeEventListener("tft:open-cmd",onOpen);
    };
  },[]);

  // ── Redirect legacy screens ──
  useEffect(function(){
    var redirects={roster:"standings",tournaments:"events/tournaments",featured:"events/featured"};
    if(redirects[screen]){navTo(redirects[screen]);}
  },[screen,navTo]);

  // ── Screen→title/meta sync: auto-updates title, meta, scroll on any screen change ──
  // URL is now managed by React Router; no more hash pushState
  useEffect(function(){
    navSourceRef.current="user";
    var titles={home:"Home",standings:"Standings",clash:"Clash",bracket:"Bracket",leaderboard:"Leaderboard",hof:"Hall of Fame",archive:"Archive",milestones:"Milestones",challenges:"Challenges",results:"Results",pricing:"Pricing",admin:"Admin",scrims:"Scrims",rules:"Rules",faq:"FAQ",featured:"Events",account:"Account",recap:"Season Recap",roster:"Roster","host-apply":"Host Application","host-dashboard":"Host Dashboard",profile:"Player Profile",privacy:"Privacy Policy",terms:"Terms of Service",gear:"Recommended Gear",changelog:"Changelog",marketplace:"Sponsor Marketplace",roadmap:"Roadmap",predictions:"My Predictions"};
    var t=titles[screen]||(screen.indexOf("tournament-")===0?"Tournament":"");
    document.title="TFT Clash"+(t?" - "+t:"");
    var descs={home:"Weekly TFT tournaments for competitive players. Free to compete, real rankings, community-driven.",standings:"Live season standings and rankings for TFT Clash tournaments.",bracket:"Tournament bracket, lobby assignments, and live results.",leaderboard:"Full leaderboard with stats, comparisons, and streak tracking.",hof:"Hall of Fame - records, champions, and legends of TFT Clash.",archive:"Past tournament results and clash history.",pricing:"TFT Clash subscription plans - Player (free), Pro, and Host tiers.",rules:"Official TFT Clash tournament rules, scoring, and tiebreaker system.",faq:"Frequently asked questions about TFT Clash tournaments.",featured:"Browse upcoming and featured TFT tournaments.",privacy:"TFT Clash privacy policy - how we handle your data.",gear:"Recommended gear for competitive TFT players.",terms:"TFT Clash terms of service - rules for using the platform."};
    var desc=descs[screen]||"TFT Clash - weekly competitive TFT tournaments.";
    var metaDesc=document.querySelector('meta[name="description"]');
    if(metaDesc)metaDesc.setAttribute("content",desc);
    var ogTitle=document.querySelector('meta[property="og:title"]');
    if(ogTitle)ogTitle.setAttribute("content","TFT Clash"+(t?" - "+t:""));
    var ogDesc=document.querySelector('meta[property="og:description"]');
    if(ogDesc)ogDesc.setAttribute("content",desc);
    var existingLD=document.getElementById("tft-jsonld");
    if(existingLD)existingLD.remove();
    var ld=null;
    if(screen==="home")ld={"@context":"https://schema.org","@type":"WebApplication","name":"TFT Clash","url":"https://tftclash.com","description":desc,"applicationCategory":"GameApplication","operatingSystem":"Any","offers":{"@type":"AggregateOffer","lowPrice":"0","highPrice":"19.99","priceCurrency":"EUR"}};
    if(screen.indexOf("tournament-")===0)ld={"@context":"https://schema.org","@type":"SportsEvent","name":"TFT Clash Tournament","location":{"@type":"VirtualLocation","url":"https://tftclash.com/tournament/"+screen.replace("tournament-","")},"organizer":{"@type":"Organization","name":"TFT Clash"}};
    if(screen==="profile"||screen==="leaderboard")ld={"@context":"https://schema.org","@type":"SportsOrganization","name":"TFT Clash","sport":"Teamfight Tactics","url":"https://tftclash.com"};
    if(ld){var s2=document.createElement("script");s2.type="application/ld+json";s2.id="tft-jsonld";s2.textContent=JSON.stringify(ld);document.head.appendChild(s2);}
    window.scrollTo(0,0);
  },[screen,subRoute]);

  // State, localStorage sync, Supabase subscriptions, and data loading
  // are all handled in AppContext (src/context/AppContext.jsx)




  // Compute linkedPlayer for ScrimsScreen
  var linkedPlayer=useMemo(function(){
    if(!currentUser)return null;
    return players.find(function(p){
      if(p.authUserId&&currentUser.id&&p.authUserId===currentUser.id)return true;
      if(p.name&&currentUser.username&&p.name.toLowerCase()===currentUser.username.toLowerCase())return true;
      if(p.riotId&&currentUser.riotId&&p.riotId.toLowerCase()===currentUser.riotId.toLowerCase())return true;
      return false;
    })||null;
  },[players,currentUser]);

  // Screen-to-route mapping for navigate()
  var SCREEN_TO_ROUTE={
    home:"/",login:"/login",signup:"/signup",standings:"/standings",
    leaderboard:"/leaderboard",bracket:"/bracket",profile:"/player",
    results:"/results",events:"/events",scrims:"/scrims",pricing:"/pricing",
    milestones:"/milestones",challenges:"/challenges",hof:"/hall-of-fame",
    archive:"/archive",recap:"/season-recap",rules:"/rules",faq:"/faq",
    account:"/account","host-apply":"/host/apply","host-dashboard":"/host/dashboard",
    admin:"/admin",privacy:"/privacy",terms:"/terms",clash:"/clash",
    tournaments:"/tournaments",roster:"/roster",featured:"/featured",gear:"/gear",sponsors:"/sponsors",donut17:"/donut17"
  };

  var navTo=useCallback(function(s,sub){
    var parts=s.split("/");
    var base=parts[0];
    var sr=sub||parts[1]||"";
    if(base==="admin"&&!isAdmin){toast("Admin access required","error");return;}
    var canScrims=isAdmin||(currentUser&&(scrimAccess.includes(currentUser.username)||scrimHostAccess.includes(currentUser.username)));
    if(base==="scrims"&&!canScrims){toast("Access restricted","error");return;}
    setScreen(base);
    setSubRoute(sr);
    // Navigate via React Router
    var route=SCREEN_TO_ROUTE[base];
    if(route){
      var fullRoute=sr?route+"/"+sr:route;
      navigate(fullRoute);
    } else if(base.indexOf("flash-")===0){
      navigate("/tournament/"+base.replace("flash-",""));
    } else if(base.indexOf("tournament-")===0){
      navigate("/tournament/"+base.replace("tournament-",""));
    } else {
      navigate("/"+base+(sr?"/"+sr:""));
    }
    // profilePlayer is set by the caller before navigating; do not clear it here
  },[isAdmin,currentUser,scrimAccess,scrimHostAccess,toast,navigate]);

  useEffect(function(){
    var params=new URLSearchParams(window.location.search);
    if(params.get("error")){
      var desc=params.get("error_description")||"Sign-in failed. Please try again.";
      toast(decodeURIComponent(desc.replace(/\+/g," ")),"error");
    }
    var refParam=params.get("ref");
    if(refParam){try{var prev=localStorage.getItem("tft-referred-by");if(!prev){localStorage.setItem("tft-referred-by",refParam);if(supabase.from){supabase.from('referrals').upsert({referrer_code:refParam,referred_at:new Date().toISOString()},{onConflict:'referrer_code'}).then(function(){}).catch(function(){});}}}catch(e){}}
    if(params.get("checkout")==="success"){
      toast("Subscription activated! Welcome to Pro.","success");
      navigate("/account",{replace:true});
    }
    // Hash migration: if user arrives with old hash URL, redirect to clean path
    var h=window.location.hash.slice(1);
    var isAuthCallback=h.startsWith("access_token")||h.startsWith("error_description")||params.get("code");
    if(isAuthCallback)return;
    if(h){
      var safeScreens=["home","standings","clash","events","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms","gear","tournaments","signup","login","status","sponsors","ops","content-engine","stats","brosephtech","tfttech","donut17"];
      var hParts=h.split("/");var hBase=hParts[0];var hSub=hParts[1]||"";
      var isSafe=safeScreens.includes(hBase)||hBase.indexOf("tournament-")===0;
      if(isSafe){
        var route=SCREEN_TO_ROUTE[hBase];
        if(route){navigate(hSub?route+"/"+hSub:route,{replace:true});}
        else if(hBase.indexOf("tournament-")===0){navigate("/tournament/"+hBase.replace("tournament-",""),{replace:true});}
        else if(hBase.indexOf("flash-")===0){navigate("/tournament/"+hBase.replace("flash-",""),{replace:true});}
      }
    }
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
      toast("Logout failed","error");
    }
  }

  function updateUser(updated){setCurrentUser(updated);}

  function handleRegister(playerId){
    var sid=String(playerId);
    var isRegistered=(tournamentState.registeredIds||[]).includes(sid);
    if(!isRegistered&&!tournamentState.dbTournamentId){
      toast("Registration is not open yet. Wait for a host to open the next clash.","error");
      return;
    }
    if(!isRegistered){
      var p=(players||[]).find(function(pp){return String(pp.id)===sid;});
      if(p&&p.banned){toast("This account is banned from registration.","error");return;}
      if(p&&(p.dnpCount||0)>=3){toast("3 no-shows recorded. Strikes must be cleared by an admin.","error");return;}
    }
    setTournamentState(function(ts){
      var ids=ts.registeredIds||[];
      return {...ts,registeredIds:isRegistered?ids.filter(function(id){return id!==sid;}):[...ids,sid]};
    });
    if(supabase.from&&tournamentState.dbTournamentId){
      if(isRegistered){
        supabase.from('registrations').delete()
          .eq('tournament_id',tournamentState.dbTournamentId)
          .eq('player_id',playerId)
          .then(function(r){if(r&&r.error)toast('Unregister may not have saved','error')});
      }else{
        supabase.from('registrations').upsert({
          tournament_id:tournamentState.dbTournamentId,
          player_id:playerId,
          status:'registered'
        },{onConflict:'tournament_id,player_id'}).then(function(r){
          if(!r||!r.error)return;
          var code=r.error.code||'';
          if(code==='23503'){
            // The dbTournamentId points at a deleted tournament. Self-heal
            // locally AND ask the server to clear site_settings so the next
            // user to load doesn't hit the same dangling reference. The RPC
            // is a no-op if the tournament still exists (admin protected).
            if(setTournamentState){setTournamentState(function(ts){return Object.assign({},ts,{dbTournamentId:null,activeTournamentId:null,phase:'idle',registeredIds:(ts.registeredIds||[]).filter(function(id){return id!==sid})})});}
            var region=(tournamentState&&tournamentState.server==='NA')?'NA':'EU';
            if(supabase&&supabase.rpc)supabase.rpc('clear_stale_tournament_state',{p_region:region}).then(function(){}).catch(function(){});
            toast('Registration is not open. The clash was reset.','error');
            return;
          }
          if(setTournamentState){setTournamentState(function(ts){return Object.assign({},ts,{registeredIds:(ts.registeredIds||[]).filter(function(id){return id!==sid})})});}
          toast('Registration failed: '+(r.error.message||'unknown'),'error');
        });
      }
    }
    if(!isRegistered&&currentUser){
      createNotification(currentUser.id,"Registration Confirmed","You are registered for the next clash. Check in when the check-in window opens.","controller");
    }
    toast(isRegistered?"Unregistered from next clash":"Registered for next clash!",isRegistered?"info":"success");
  }

  // joinQuickClash removed -- no UI renders quick clashes and no route reaches it



  // Show auth screens fullscreen

  if(authScreen==="login") return(

    <>

      <React.Suspense fallback={<ScreenSkeleton/>}><LoginScreenNew/></React.Suspense>

      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

        {toasts.map(function(t){return <div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={function(){removeToast(t.id)}}/></div>})}

      </div>

    </>

  );

  if(authScreen==="signup") return(

    <>

      <React.Suspense fallback={<ScreenSkeleton/>}><SignUpScreenNew/></React.Suspense>

      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

        {toasts.map(function(t){return <div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={function(){removeToast(t.id)}}/></div>})}

      </div>

    </>

  );

  if (screen.indexOf("obs-") === 0) {
    return (
      <React.Suspense fallback={null}>
        <ObsOverlayScreenNew />
      </React.Suspense>
    );
  }

  if (screen === "broadcast") {
    var bParams = {};
    var searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach(function(val, key) { bParams[key] = val; });
    // Fallback: also check hash for legacy broadcast URLs
    var hashParts = (window.location.hash || "").split("?");
    if (hashParts[1]) {
      hashParts[1].split("&").forEach(function(kv) {
        var parts = kv.split("=");
        if(!bParams[parts[0]]) bParams[parts[0]] = parts[1] || "";
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

      <Hexbg/>

      {isOffline&&(
        <div role="status" aria-live="assertive" className="fixed top-0 left-0 right-0 z-[9998] bg-error text-on-error flex items-center justify-center gap-3 px-4 py-2 text-sm font-semibold shadow-lg">
          <span className="live-dot live-dot--off" aria-hidden="true" />
          <span>Connection lost. Trying to reconnect...</span>
          <button
            type="button"
            onClick={function(){window.location.reload();}}
            className="px-3 py-1 rounded text-xs font-bold uppercase tracking-wider bg-on-error/10 border border-on-error/30 hover:bg-on-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-error/50"
          >
            Retry
          </button>
        </div>
      )}

      {currentUser&&(isLoadingData||isAuthLoading)&&(
        <div style={{position:"fixed",inset:0,background:"#13131a",zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:32}}>
          <img src="/icon-border.png" alt="TFT Clash" style={{width:72,height:72,opacity:0.9}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Subtle',system-ui,sans-serif",fontSize:22,fontWeight:800,color:"#E8A838",letterSpacing:"-0.02em",marginBottom:8}}>TFT CLASH</div>
            <div style={{width:160,height:2,background:"rgba(232,168,56,0.15)",borderRadius:2,overflow:"hidden",margin:"0 auto"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,transparent,#E8A838,transparent)",animation:"tft-scan 1.4s ease-in-out infinite"}}/>
            </div>
          </div>
          <style>{"@keyframes tft-scan{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}"}</style>
        </div>
      )}

      {showOnboarding&&React.createElement(OnboardingFlow,{
        currentUser:currentUser,
        onComplete:function(){setShowOnboarding(false);},
        onRegister:function(){setScreen("home");},
        onRiotLinked:function(euId,naId){setCurrentUser(function(u){return Object.assign({},u,{riotId:euId||naId||'',riot_id:euId||naId||'',riot_id_eu:euId||null,riot_id_na:naId||null});});},
        nextClash:(tournamentState&&tournamentState.clashDate)||"This week",
        playerCount:players.length
      })}

      <div style={{position:"relative",zIndex:1,minHeight:"100vh"}}>

        <React.Suspense fallback={<ScreenSkeleton/>}>
        <ScreenBoundary key={screen} name={screen} onHome={function(){navTo("home");}}>

        {screen==="home"&&!currentUser&&<GuestHomeScreen/>}
        {screen==="home"&&currentUser&&<DashboardScreen/>}

        {screen==="standings"  &&<StandingsScreenNew/>}
        {screen==="leaderboard"&&<LeaderboardScreenNew/>}
        {screen==="hof"        &&<HofScreenNew/>}
        {screen==="archive"    &&<ArchiveScreenNew/>}
        {screen==="milestones" &&<MilestonesScreenNew/>}
        {screen==="challenges" &&<ChallengesScreenNew/>}

        {screen==="clash"      &&<ClashScreenNew subRoute={subRoute} players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig} allPendingResults={allPendingResults} pastClashes={pastClashes}/>}

        {screen==="bracket"    &&<BracketScreenNew/>}

        {screen==="profile"    &&(profilePlayer||subRoute)&&<PlayerProfileScreenNew/>}

        {screen==="profile"    &&!profilePlayer&&!subRoute&&<AccountScreenNew/>}

        {screen==="results"    &&<ResultsScreenNew/>}

        {screen==="events"     &&<EventsScreenNew/>}

        {screen==="rules"      &&<RulesScreenNew/>}

        {screen==="faq"        &&<FAQScreenNew/>}

        {screen==="privacy"    &&<PrivacyScreenNew/>}

        {screen==="terms"      &&<TermsScreenNew/>}

        {screen==="gear"       &&<GearScreenNew/>}

        {screen==="account"    &&<AccountScreenNew />}

        {screen==="pricing"    &&<PricingScreenNew />}

        {screen==="recap"      &&<SeasonRecapScreenNew />}

        {screen.indexOf("flash-")===0&&<TournamentRouterScreen/>}

        {screen.indexOf("tournament-")===0&&<TournamentRouterScreen/>}

        {screen==="host-apply" &&<HostApplyScreenNew/>}

        {screen==="host-dashboard"&&(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&a.user_id===currentUser.auth_user_id;})))&&<HostDashboardScreenNew/>}

        {screen==="host-dashboard"&&!(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&a.user_id===currentUser.auth_user_id;})))&&<div className="page wrap text-center pt-20"><div className="text-4xl mb-4">&#128274;</div><h2 className="text-on-surface mb-2">Host Access Required</h2><p className="text-on-surface/60 text-sm mb-5">Your host application is pending review. You will be notified once approved.</p><Btn variant="primary" onClick={function(){navTo("home");}}>Back to Home</Btn></div>}


        {screen==="stats"      &&<StatsHubScreenNew/>}

        {screen==="scrims"     &&<ScrimsScreenNew/>}

        {screen==="admin"&&<AdminScreenNew/>}

        {screen==="ops"&&<CommandCenterScreen/>}
        {screen==="content-engine"&&<ContentEngineScreen/>}

        {screen==="not-found"&&<NotFoundScreen/>}

        {screen==="status"&&<StatusScreenNew/>}

        {screen==="changelog"&&<ChangelogScreenNew/>}

        {screen==="sponsors"&&<SponsorsScreenNew/>}

        {screen==="donut17"&&<Donut17ScreenNew/>}

        {screen==="brosephtech"&&<BrosephTechScreen/>}
        {screen==="tfttech"&&<TfttechScreen/>}
        {screen==="marketplace"&&<MarketplaceScreenNew/>}
        {screen==="roadmap"&&<RoadmapScreenNew/>}
        {screen==="predictions"&&<PredictionsScreenNew/>}
        {screen==="links"&&<LinksScreenNew/>}

        {screen==="squads-sim"&&<SquadsSimScreen/>}
        {screen==="teams"&&<TeamsScreen/>}
        {screen.indexOf("team-")===0&&<TeamProfileScreen/>}


        </ScreenBoundary>
        </React.Suspense>

      </div>




      {/* Cookie Consent */}
      {!cookieConsent&&(
        <div className="mb-16 md:mb-0" style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(17,24,39,.97)",borderTop:"1px solid rgba(155,114,207,.2)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:16,zIndex:9997,flexWrap:"wrap",backdropFilter:"blur(8px)"}}>
          <span style={{fontSize:13,color:"#BECBD9",maxWidth:480}}>We use essential cookies for authentication. No tracking cookies. <button onClick={function(){navTo("privacy");}} style={{background:"none",border:"none",color:"#9B72CF",cursor:"pointer",fontFamily:"inherit",fontSize:13,textDecoration:"underline",padding:0}}>Privacy Policy</button></span>
          <button onClick={function(){setCookieConsent(true);try{localStorage.setItem("tft-cookie-consent","1");}catch(e){}}} style={{padding:"8px 20px",background:"#9B72CF",border:"none",borderRadius:8,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Subtle',system-ui,sans-serif",fontSize:13,flexShrink:0}}>Got it</button>
        </div>
      )}

      {/* Toasts */}

      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

        {toasts.map(function(t){return <div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={function(){removeToast(t.id)}}/></div>})}

      </div>

      {comparePlayer&&React.createElement(PlayerComparisonModal, {
        playerA: currentUser ? players.find(function(p){return (p.authUserId&&p.authUserId===currentUser.id)||(p.name===currentUser.username);}) || null : null,
        playerB: comparePlayer,
        players: players,
        pastClashes: pastClashes,
        onClose: function(){setComparePlayer(null);}
      })}

      <CommandPalette open={cmdOpen} onClose={function(){setCmdOpen(false);}}/>

    </>

  );

}

export default function App(){return(<ErrorBoundary><AppProvider><TFTClash/></AppProvider></ErrorBoundary>);}

