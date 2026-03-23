import React, { useState, useEffect, useRef, useMemo, useCallback, memo, Component } from "react";
import * as Sentry from '@sentry/react';

import { supabase, CANONICAL_ORIGIN } from './lib/supabase.js';
import { DATA_VERSION, TFT_DEBUG, dbg, RANKS, RCOLS, REGIONS, PTS, DEFAULT_SEASON_CONFIG, TIERS, CLASH_RANKS, XP_REWARDS, TIER_FEATURES, HOMIES_IDS, SEED, PAST_CLASHES, getSeasonChampion, setSeasonChampion, PREMIUM_TIERS, RULES_SECTIONS, FAQ_DATA } from './lib/constants.js';
import { sanitize, rc, tier, avgCol, ordinal, shareToTwitter, buildShareText, isValidRiotId } from './lib/utils.js';
import { computeStats, computeH2H, getStats, effectivePts, tiebreaker, isComebackEligible, getAttendanceStreak, computeSeasonBonuses, ACHIEVEMENTS, MILESTONES, getAchievements, checkAchievements, syncAchievements, isHotStreak, isOnTilt, computeClashAwards, generateRecap, getClashRank, getXpProgress, estimateXp } from './lib/stats.js';
import { T_PHASE, T_TRANSITIONS, canTransition, TOURNAMENT_FORMATS, snakeSeed, buildLobbies, buildFlashLobbies, applyCutLine, suggestedCutLine, computeTournamentStandings } from './lib/tournament.js';
import { getUserTier, hasFeature } from './lib/tiers.js';
import { writeActivityEvent, createNotification } from './lib/notifications.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import LoginScreenNew from './screens/LoginScreen';
import SignUpScreenNew from './screens/SignUpScreen';
import GuestHomeScreen from './screens/HomeScreen';
import DashboardScreen from './screens/DashboardScreen';
import LeaderboardScreenNew from './screens/LeaderboardScreen';
import PlayerProfileScreenNew from './screens/PlayerProfileScreen';
import StandingsScreenNew from './screens/StandingsScreen';
import BracketScreenNew from './screens/BracketScreen';
import PricingScreenNew from './screens/PricingScreen';
import EventsScreenNew from './screens/EventsScreen';
import ResultsScreenNew from './screens/ResultsScreen';
import SeasonRecapScreenNew from './screens/SeasonRecapScreen';
import ArchiveScreenNew from './screens/ArchiveScreen';
import MilestonesScreenNew from './screens/MilestonesScreen';
import ChallengesScreenNew from './screens/ChallengesScreen';
import RulesScreenNew from './screens/RulesScreen';
import FAQScreenNew from './screens/FAQScreen';
import AccountScreenNew from './screens/AccountScreen';
import PrivacyScreenNew from './screens/PrivacyScreen';
import TermsScreenNew from './screens/TermsScreen';
import ScrimsScreenNew from './screens/ScrimsScreen';
import HostApplyScreenNew from './screens/HostApplyScreen';
import HostDashboardScreenNew from './screens/HostDashboardScreen';
import FlashTournamentScreenNew from './screens/FlashTournamentScreen';
import TournamentDetailScreenNew from './screens/TournamentDetailScreen';
import TournamentsListScreenNew from './screens/TournamentsListScreen';
import AdminScreenNew from './screens/AdminScreen';
import HofScreenNew from './screens/HofScreen';
import GearScreenNew from './screens/GearScreen';
import FooterNew from './components/layout/Footer';
import NavbarNew from './components/layout/Navbar';

// ─── DATA VERSION  -  bump to bust stale localStorage ─────────────────────────
(function(){try{var v=localStorage.getItem("tft-data-version");if(v!==String(DATA_VERSION)){var keys=Object.keys(localStorage).filter(function(k){return k.startsWith("tft-");});keys.forEach(function(k){localStorage.removeItem(k);});localStorage.setItem("tft-data-version",String(DATA_VERSION));dbg("[TFT] Cleared stale localStorage (v"+DATA_VERSION+")");}}catch(e){}}());

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



// ─── CONSTANTS & UTILS imported from lib/ ────────────────────────────────────

















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
        var text=recap.clashName+" Recap\n\n"+recap.lines.join("\n")+"\n\ntftclash.com";
        if(navigator.share){navigator.share({title:recap.clashName+" Recap",text:text}).catch(function(){});}
        else{navigator.clipboard.writeText(text);if(props.toast)props.toast("Recap copied to clipboard!","success");}
      }},React.createElement("i",{className:"ti ti-share",style:{marginRight:4}}),"Share Card")
    )
  );
}












// ─── AUTH / ACCOUNT SYSTEM ───────────────────────────────────────────────────














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

      {label&&<span className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".14em",textTransform:"uppercase"}}>{label}</span>}

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

function FormDots({history,max}){
  var n=max||5;
  var recent=(history||[]).slice(-n);
  if(recent.length===0)return null;
  return React.createElement("div",{style:{display:"flex",gap:3,alignItems:"center"}},
    recent.map(function(h,i){
      var p=h.placement||h.place||5;
      var cls="form-dot "+(p===1?"form-dot-win":p<=4?"form-dot-top4":"form-dot-bot4");
      var title="Game "+(i+1)+": #"+p;
      return React.createElement("span",{key:i,className:cls,title:title});
    })
  );
}

function TournamentSponsorBadge({sponsor}){
  if(!sponsor)return null;
  return React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,background:sponsor.color+"15",border:"1px solid "+sponsor.color+"30",fontSize:10,fontWeight:700,color:sponsor.color,letterSpacing:".04em"}},
    React.createElement("span",{style:{fontSize:9}},sponsor.logo||sponsor.org.slice(0,2).toUpperCase()),
    "Sponsored by ",
    sponsor.org
  );
}

// ─── SPONSOR BANNER ───────────────────────────────────────────────────────────

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

  var moreItems=[
    {id:"scrims",label:"Scrims",icon:"swords",desc:"Practice lobbies",show:canScrims},
    {id:"pricing",label:"Pricing",icon:"diamond",desc:"Plans and features",show:true},
    {id:"rules",label:"Rules",icon:"book",desc:"Tournament rules",show:true},
    {id:"faq",label:"FAQ",icon:"help-circle",desc:"Common questions",show:true},
    {id:"host-apply",label:"Host",icon:"crown",desc:"Apply or manage",show:!!currentUser},
    {id:"gear",label:"Gear",icon:"shopping-bag",desc:"Merch and gear",show:true},
    {id:"admin",label:"Admin",icon:"shield",desc:"Control panel",show:isAdmin},
  ].filter(function(item){return item.show;});

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

      <nav className="top-nav" style={{borderBottom:"1px solid rgba(155,114,207,.15)"}}>

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

              <div className="cond" style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#BECBD9",fontWeight:600,letterSpacing:".06em"}}>
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

                  <div style={{position:"absolute",left:0,top:"calc(100% + 4px)",minWidth:240,background:"linear-gradient(160deg,#0F1828,#0B1220)",

                    border:"1px solid rgba(155,114,207,.2)",borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,.7)",zIndex:99,padding:8}}>

                    {moreItems.map(function(item){
                      return React.createElement("button",{key:item.id,onClick:function(){setScreen(item.id);setDesktopMore(false);},
                        style:{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,cursor:"pointer",
                          width:"100%",textAlign:"left",background:screen===item.id?"rgba(155,114,207,.12)":"none",
                          border:"none",transition:"background .15s"}},
                        React.createElement("i",{className:"ti ti-"+item.icon,style:{fontSize:16,color:"#9B72CF",flexShrink:0}}),
                        React.createElement("div",null,
                          React.createElement("div",{style:{fontSize:13,fontWeight:600,color:screen===item.id?"#9B72CF":"#F2EDE4",lineHeight:1.2}},item.label),
                          React.createElement("div",{style:{fontSize:10,color:"#9AAABF",marginTop:2}},item.desc)
                        )
                      );
                    })}

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
          return React.createElement("button",{key:item.id,onClick:function(){if(item.id==="more"){setDrawer(true);}else{setScreen(item.id);}},
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
            React.createElement("span",{style:{fontSize:10,letterSpacing:".04em"}},item.label)
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

  const cols=compact?"28px 1fr 60px 55px 50px 50px":"28px 1fr 70px 70px 50px 55px 110px";

  return(

    <Panel style={{overflowX:"auto"}}>

      <div className="standings-table-wrap" style={{minWidth:compact?260:380}}>

      <div style={{display:"grid",gridTemplateColumns:cols,padding:"9px 14px",borderBottom:"1px solid rgba(242,237,228,.07)",background:"#0A0F1A"}}>

        <span className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em"}}>#</span>

        <H k="name" label="Player"/><H k="pts" label="Pts"/><H k="avg" label="Avg"/><H k="games" label="G"/>

        {!compact&&<H k="wins" label="W"/>}

        <span className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".1em"}}>Trend</span>

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
              React.createElement("span",{className:"cond",style:{fontSize:10,fontWeight:700,color:tColor,letterSpacing:".1em",textTransform:"uppercase"}},tName),
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

            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {sparkData.length>=2?React.createElement(Sparkline,{data:sparkData,w:50,h:16,color:"#9B72CF"}):null}
              {React.createElement(FormDots,{history:(p.clashHistory||[]).slice(-5)})}
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
  var phaseLabels={registration:"Registration Open",live:"Live - Game "+(props.tournamentState&&props.tournamentState.round||1)+" of "+(props.tournamentState&&props.tournamentState.totalGames||4),complete:"Results"};
  var accentColor=phaseColors[phase]||"#9B72CF";

  if(!phase){
    var idlePlayers=props.players||[];
    var idleTop5=[].concat(idlePlayers).sort(function(a,b){return(b.pts||0)-(a.pts||0);}).slice(0,5);
    return React.createElement("div",{className:"page fade-up",style:{padding:"40px 20px",maxWidth:600,margin:"0 auto"}},
      React.createElement("div",{style:{textAlign:"center",marginBottom:32}},
        React.createElement("i",{className:"ti ti-swords",style:{fontSize:48,color:"#9B72CF",opacity:.35,display:"block",marginBottom:12}}),
        React.createElement("h2",{style:{color:"#F2EDE4",marginBottom:6,fontFamily:"'Playfair Display',serif",fontSize:26}},"No Active Clash"),
        React.createElement("p",{style:{fontSize:14,color:"#9AAABF",maxWidth:380,margin:"0 auto",lineHeight:1.6}},"Stay tuned for the next clash. Keep an eye on announcements and warm up in scrims!")
      ),
      idleTop5.length>0?React.createElement(Panel,{style:{padding:"16px 18px",marginBottom:20}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
          React.createElement("i",{className:"ti ti-trophy",style:{fontSize:16,color:"#E8A838"}}),
          React.createElement("span",{style:{fontWeight:700,fontSize:13,color:"#F2EDE4",letterSpacing:".02em"}},"Season Standings")
        ),
        idleTop5.map(function(p,i){
          return React.createElement("div",{key:p.id||i,onClick:function(){props.setProfilePlayer(p);props.setScreen("profile");},style:{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:i>0?"1px solid rgba(242,237,228,.06)":"none",cursor:"pointer"}},
            React.createElement("span",{className:"mono",style:{fontSize:12,fontWeight:700,color:i===0?"#E8A838":i<3?"#C4B5FD":"#BECBD9",width:20,textAlign:"center"}},"#"+(i+1)),
            React.createElement("span",{style:{flex:1,fontWeight:600,fontSize:13,color:"#F2EDE4"}},p.name),
            React.createElement("span",{className:"mono",style:{fontSize:13,fontWeight:700,color:"#E8A838"}},p.pts||0),
            React.createElement("span",{style:{fontSize:10,color:"#9AAABF",marginLeft:2}},"pts")
          );
        })
      ):null,
      React.createElement("div",{style:{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}},
        React.createElement(Btn,{v:"primary",onClick:function(){props.setScreen("standings");}},"View Standings"),
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
            sparkData.length>=2?React.createElement(Sparkline,{data:sparkData,w:40,h:14,color:"#9B72CF"}):React.createElement("div",{style:{width:40,height:14,opacity:.2,fontSize:10,color:"#9AAABF",display:"flex",alignItems:"center"}},"--")
          );
        })
      )
    ):null,
    phase==="registration"||phase==="live"?React.createElement(MemoBracketScreen,{players:props.players,setPlayers:props.setPlayers,toast:props.toast,isAdmin:props.isAdmin,currentUser:props.currentUser,setProfilePlayer:props.setProfilePlayer,setScreen:props.setScreen,tournamentState:props.tournamentState,setTournamentState:props.setTournamentState,seasonConfig:props.seasonConfig}):null,
    phase==="live"?React.createElement("div",{style:{display:"flex",gap:4,marginBottom:16,justifyContent:"center",padding:"0 16px"}},
      Array.from({length:props.tournamentState.totalGames||4},function(_,i){
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
      "Swiss Reseed - Lobbies reorganized by standings"
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

function LiveStandingsPanel({checkedIn,tournamentState,lobbies,round}) {

  var clashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:"";
  var cutLine=tournamentState&&tournamentState.cutLine?tournamentState.cutLine:0;
  var cutAfterGame=tournamentState&&tournamentState.cutAfterGame?tournamentState.cutAfterGame:0;
  var showCutLine=cutLine>0&&cutAfterGame>0&&round>=cutAfterGame;
  var totalGames=tournamentState&&tournamentState.totalGames?tournamentState.totalGames:4;

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

              {nearCut&&<span style={{fontSize:10,fontWeight:700,color:"#E8A838",background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.2)",borderRadius:3,padding:"1px 6px"}}>Bubble</span>}

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

  // Load existing player_reports from DB on mount (survive page refresh)
  useEffect(function(){
    if(!supabase.from||!tournamentState.dbTournamentId)return;
    supabase.from('player_reports').select('player_id,reported_placement,game_number')
      .eq('tournament_id',tournamentState.dbTournamentId).eq('game_number',round)
      .then(function(res){
        if(res.error||!res.data||!res.data.length)return;
        var restored={};
        res.data.forEach(function(r){
          // Find which lobby this player is in
          lobbies.forEach(function(lobby,li){
            var found=lobby.find(function(p){return String(p.id)===String(r.player_id);});
            if(found){
              if(!restored[li])restored[li]={};
              restored[li][r.player_id]={placement:r.reported_placement,name:found.name||found.username||'',confirmed:false};
            }
          });
        });
        if(Object.keys(restored).length>0)setPlayerSubmissions(restored);
      });
  },[tournamentState.dbTournamentId,round,lobbies.length]);

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
          else{
            // Sync updated aggregate stats back to players table
            lobby.forEach(function(lp){
              var place=parseInt(placementEntry[li].placements[lp.id]||"0");
              if(place<=0)return;
              var updatedP=players.find(function(pp){return pp.id===lp.id;});
              if(!updatedP)return;
              var newGames=(updatedP.games||0)+1;
              var newWins=(updatedP.wins||0)+(place===1?1:0);
              var newTop4=(updatedP.top4||0)+(place<=4?1:0);
              var newPts=(updatedP.pts||0)+(PTS[place]||0);
              var newAvg=(((parseFloat(updatedP.avg)||0)*(updatedP.games||0)+place)/newGames);
              supabase.from('players').update({
                season_pts:newPts,wins:newWins,top4:newTop4,games:newGames,
                avg_placement:parseFloat(newAvg.toFixed(2))
              }).eq('id',lp.id).then(function(pr){
                if(pr.error)console.error("[TFT] Failed to sync player stats for",lp.name||lp.id,pr.error);
              });
            });
          }
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
    // Persist to player_reports table so submissions survive page refresh
    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('player_reports').upsert({
        tournament_id:tournamentState.dbTournamentId,
        lobby_id:null,
        game_number:round,
        player_id:playerId,
        reported_placement:p,
        reported_at:new Date().toISOString()
      },{onConflict:'tournament_id,game_number,player_id'}).then(function(r){
        if(r.error)console.error("[TFT] Failed to persist placement report:",r.error);
      });
    }
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
      // Only delete game_results for players in THIS lobby, not all lobbies
      var lobbyPlayerIds=lobbies[li]?lobbies[li].map(function(p){return p.id;}):[];
      if(lobbyPlayerIds.length>0){
        supabase.from('game_results').delete()
          .eq('tournament_id',tournamentState.dbTournamentId)
          .eq('round_number',round)
          .in('player_id',lobbyPlayerIds)
          .then(function(res){if(res.error)console.error("[TFT] Failed to delete game results:",res.error);});
      }
      supabase.from('lobbies').update({status:'active'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){if(res.error)console.error("[TFT] Failed to unlock lobby in DB:",res.error);});
      // Sync reverted stats to players table
      if(savedPlacements){
        lobbyPlayerIds.forEach(function(pid){
          var place=savedPlacements[pid];
          if(place===undefined)return;
          var pp=players.find(function(q){return q.id===pid;});
          if(!pp)return;
          var earned=PTS[place]||0;
          var newGames=Math.max((pp.games||1)-1,0);
          var newWins=Math.max((pp.wins||0)-(place===1?1:0),0);
          var newTop4=Math.max((pp.top4||0)-(place<=4?1:0),0);
          var newPts=Math.max((pp.pts||0)-earned,0);
          var newAvg=newGames>0?(((parseFloat(pp.avg)||0)*(pp.games||1)-place)/newGames):0;
          supabase.from('players').update({
            season_pts:newPts,wins:newWins,top4:newTop4,games:newGames,
            avg_placement:parseFloat(newAvg.toFixed(2))
          }).eq('id',pid).then(function(pr){
            if(pr.error)console.error("[TFT] Failed to revert player stats:",pr.error);
          });
        });
      }
    }
    toast("Lobby "+(li+1)+" unlocked  -  results reverted","success");
  }

  const allLocked=lobbies.length>0&&lobbies.every((_,i)=>lockedLobbies.includes(i));

  // Auto-advance countdown when all lobbies locked (admin only, not on final round)
  useEffect(function(){
    if(!isAdmin||!allLocked||round>=(tournamentState.totalGames||4)){
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
    var maxRounds=tournamentState.totalGames||4;
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
          // Sync final aggregate stats to players table
          allPlayers.forEach(function(p) {
            if (p.id && playerTotals[p.id]) {
              supabase.from('players').update({
                season_pts:p.pts||0,wins:p.wins||0,top4:p.top4||0,games:p.games||0,
                avg_placement:parseFloat(parseFloat(p.avg||0).toFixed(2)),
                last_clash_rank:sortedByPts.findIndex(function(q){return q.id===p.id;})+1
              }).eq('id',p.id).then(function(pr){
                if(pr.error)console.error("[TFT] Failed to sync final stats for",p.name,pr.error);
              });
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

          <span>Game {round}/{tournamentState.totalGames||4}</span>

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

            <Btn v="primary" s="sm" disabled={!allLocked} onClick={()=>{var maxRounds=tournamentState.totalGames||4;var cutL=tournamentState.cutLine||0;var cutG=tournamentState.cutAfterGame||0;if(round>=maxRounds){setShowFinalizeConfirm(true);}else{var nextRound=round+1;var cutMsg="";if(cutL>0&&round===cutG){var standings=computeTournamentStandings(checkedIn,[],null);var cutResult=applyCutLine(standings,cutL,cutG);var elimCount=cutResult.eliminated.length;if(elimCount>0){cutMsg="  -  "+elimCount+" players eliminated (below "+cutL+"pts)";cutResult.eliminated.forEach(function(ep){setPlayers(function(ps){return ps.map(function(p){return p.id===ep.id?Object.assign({},p,{checkedIn:false}):p;});});});setTournamentState(function(ts){var kept=(ts.checkedInIds||[]).filter(function(cid){return!cutResult.eliminated.some(function(e){return String(e.id)===String(cid);});});return Object.assign({},ts,{checkedInIds:kept});});}}setTournamentState(ts=>({...ts,round:nextRound,lockedLobbies:[],savedLobbies:[]}));toast("Advanced to Game "+nextRound+cutMsg,"success");}}}>

              {round>=(tournamentState.totalGames||4)?"Finalize Clash":"Next Game →"}

            </Btn>

          </div>

        )}

      </div>

      {allLocked&&checkedIn.length>0&&(
        <div style={{background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.3)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,animation:"pulse 2s infinite"}}>
          <span style={{fontSize:16}}>{React.createElement("i",{className:"ti ti-circle-check",style:{color:"#52C47C"}})}</span>
          <span style={{fontSize:13,fontWeight:600,color:"#6EE7B7",flex:1}}>All {lobbies.length} lobbies locked  -  {round>=(tournamentState.totalGames||4)?"ready to finalize!":"ready for next game!"}{isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<(tournamentState.totalGames||4)?" Auto-advancing in "+autoAdvanceCountdown+"s":""}</span>
          {isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<(tournamentState.totalGames||4)&&(
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
    React.createElement("div",{className:"cond",style:{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}},"Placement Distribution"),
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
        return React.createElement("div",{key:i,style:{textAlign:"center",flex:1,fontSize:10,color:c>0?colors[i]:"#4A5568",fontWeight:600}},
          ordinal(i+1)
        );
      })
    )
  );
}

var MemoPlayerProfileScreen=memo(PlayerProfileScreen);

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

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

                <div style={{fontSize:10,color:"#BECBD9",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginTop:3}}>Season Pts</div>

                <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:10}}>

                  {[["W",getStats(p).wins,"#6EE7B7"],["Avg",getStats(p).avgPlacement,avgCol(getStats(p).avgPlacement)]].map(([l,v,c])=>(

                    <div key={l} style={{textAlign:"center"}}>

                      <div className="mono" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>

                      <div style={{fontSize:10,color:"#9AAABF",textTransform:"uppercase"}}>{l}</div>

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





var MemoResultsScreen=memo(ResultsScreen);

// ─── HALL OF FAME ─────────────────────────────────────────────────────────────

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
  var orgSponsors=props.orgSponsors||{};
  var sponsorEntries=Object.values(orgSponsors);
  var platformLinks=[["home","Home"],["roster","Roster"],["leaderboard","Leaderboard"],["hof","Hall of Fame"],["archive","Archive"]];
  var communityLinks=[["featured","Featured Events"],["rules","Rules"],["faq","FAQ"],["gear","Gear"]];
  var hostingLinks=[["pricing","Pricing"],["host-apply","Apply to Host"],["host-dashboard","Host Dashboard"]];
  return(
    <footer style={{background:"#06060C",borderTop:"1px solid rgba(155,114,207,.15)",padding:"40px 24px 24px",marginTop:40}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        {sponsorEntries.length>0&&<div className="sponsor-strip" style={{marginBottom:24}}>
          <span className="cond" style={{fontSize:10,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginRight:12}}>Partners</span>
          {sponsorEntries.map(function(s,i){
            return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:6,background:s.color+"12",border:"1px solid "+s.color+"25"}},
              React.createElement("span",{style:{fontSize:12,fontWeight:800,color:s.color}},s.logo||s.org.slice(0,2).toUpperCase()),
              React.createElement("span",{style:{fontSize:11,fontWeight:600,color:"#9AAABF"}},s.org)
            );
          })}
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:32,marginBottom:32}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Platform</div>
            {platformLinks.map(function(arr){return(
              <button key={arr[0]} onClick={function(){setScreen(arr[0]);}} style={{display:"block",background:"none",border:"none",color:"#9AAABF",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit",transition:"color .15s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="#F2EDE4";}}
                onMouseLeave={function(e){e.currentTarget.style.color="#8896A8";}}>{arr[1]}</button>
            );})}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Community</div>
            {communityLinks.map(function(arr){return(
              <button key={arr[0]} onClick={function(){setScreen(arr[0]);}} style={{display:"block",background:"none",border:"none",color:"#9AAABF",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit",transition:"color .15s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="#F2EDE4";}}
                onMouseLeave={function(e){e.currentTarget.style.color="#8896A8";}}>{arr[1]}</button>
            );})}
            <button onClick={function(){window.open("https://discord.gg/tftclash","_blank");}} style={{display:"block",background:"none",border:"none",color:"#9AAABF",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit"}}>Discord</button>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".08em",marginBottom:14}}>Hosting</div>
            {hostingLinks.map(function(arr){return(
              <button key={arr[0]} onClick={function(){setScreen(arr[0]);}} style={{display:"block",background:"none",border:"none",color:"#9AAABF",fontSize:13,padding:"4px 0",cursor:"pointer",fontFamily:"inherit",transition:"color .15s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="#F2EDE4";}}
                onMouseLeave={function(e){e.currentTarget.style.color="#8896A8";}}>{arr[1]}</button>
            );})}
          </div>
        </div>
        <div style={{borderTop:"1px solid rgba(155,114,207,.08)",paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"#9AAABF"}}>{"\u00a9"} 2026 TFT Clash {"\u00b7"} Season 1 {"\u00b7"} Free to compete, always.</span>
            <button onClick={function(){setScreen("privacy");}} style={{background:"none",border:"none",color:"#9AAABF",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",padding:0}}>Privacy</button>
            <button onClick={function(){setScreen("terms");}} style={{background:"none",border:"none",color:"#9AAABF",fontSize:11,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",padding:0}}>Terms</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <img src="/icon-border.png" alt="TFT Clash" style={{width:16,height:16,opacity:0.4}}/>
            <span style={{fontSize:10,color:"#9AAABF"}}>Built for the community</span>
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
          React.createElement("span", {style:{fontSize:10,color:"#9B72CF",fontWeight:600}}, me.name),
          React.createElement("span", {style:{fontSize:10,color:"#4ECDC4",fontWeight:600}}, them.name)
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
        React.createElement("div", {style:{marginTop:12,fontSize:12,color:"#9AAABF",cursor:"pointer"},onClick:function(){setStep(3);}}, "Skip for now")
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
          React.createElement("span", {style:{fontSize:11,fontWeight:700,color:"#6EE7B7"}}, "LIVE - Game " + (tournamentState.round || 1) + "/" + (tournamentState.totalGames || 4))
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
    "/tournaments":"tournaments","/roster":"roster","/featured":"featured","/gear":"gear"
  };
  useEffect(function(){
    var path=location.pathname;
    // Direct match
    var mapped=ROUTE_TO_SCREEN[path];
    if(mapped){
      if(mapped!==screen){navSourceRef.current="router";setScreen(mapped);}
      return;
    }
    // Dynamic segments: /player/:name, /bracket/:id, /results/:id, /flash/:id, /tournament/:id
    var segs=path.replace(/^\//,"").split("/");
    if(segs[0]==="player"&&segs[1]){navSourceRef.current="router";setScreen("profile");setSubRoute(segs[1]);return;}
    if(segs[0]==="bracket"&&segs[1]){navSourceRef.current="router";setScreen("bracket");setSubRoute(segs[1]);return;}
    if(segs[0]==="results"&&segs[1]){navSourceRef.current="router";setScreen("results");setSubRoute(segs[1]);return;}
    if(segs[0]==="flash"&&segs[1]){navSourceRef.current="router";setScreen("flash-"+segs[1]);return;}
    if(segs[0]==="tournament"&&segs[1]){navSourceRef.current="router";setScreen("tournament-"+segs[1]);return;}
    if(segs[0]==="host"){
      if(segs[1]==="apply"){navSourceRef.current="router";setScreen("host-apply");return;}
      if(segs[1]==="dashboard"){navSourceRef.current="router";setScreen("host-dashboard");return;}
    }
    // Standings sub-routes
    if(segs[0]==="standings"&&segs[1]){navSourceRef.current="router";setScreen("standings");setSubRoute(segs[1]);return;}
    // Events sub-routes
    if(segs[0]==="events"&&segs[1]){navSourceRef.current="router";setScreen("events");setSubRoute(segs[1]);return;}
  },[location.pathname]);
  var players=ctx.players, setPlayers=ctx.setPlayers;
  var isLoadingData=ctx.isLoadingData;
  var isAdmin=ctx.isAdmin, setIsAdmin=ctx.setIsAdmin;
  var scrimAccess=ctx.scrimAccess, setScrimAccess=ctx.setScrimAccess;
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

  // ── Redirect legacy screens ──
  useEffect(function(){
    var redirects={roster:"standings",tournaments:"events/tournaments",featured:"events/featured"};
    if(redirects[screen]){navTo(redirects[screen]);}
  },[screen,navTo]);

  // ── Screen→title/meta sync: auto-updates title, meta, scroll on any screen change ──
  // URL is now managed by React Router; no more hash pushState
  useEffect(function(){
    navSourceRef.current="user";
    var titles={home:"Home",standings:"Standings",clash:"Clash",bracket:"Bracket",leaderboard:"Leaderboard",hof:"Hall of Fame",archive:"Archive",milestones:"Milestones",challenges:"Challenges",results:"Results",pricing:"Pricing",admin:"Admin",scrims:"Scrims",rules:"Rules",faq:"FAQ",featured:"Events",account:"Account",recap:"Season Recap",roster:"Roster","host-apply":"Host Application","host-dashboard":"Host Dashboard",profile:"Player Profile",privacy:"Privacy Policy",terms:"Terms of Service",gear:"Recommended Gear"};
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
    if(screen==="home")ld={"@context":"https://schema.org","@type":"WebApplication","name":"TFT Clash","url":"https://tft-clash.vercel.app","description":desc,"applicationCategory":"GameApplication","operatingSystem":"Any","offers":{"@type":"AggregateOffer","lowPrice":"0","highPrice":"19.99","priceCurrency":"EUR"}};
    if(screen.indexOf("tournament-")===0)ld={"@context":"https://schema.org","@type":"SportsEvent","name":"TFT Clash Tournament","location":{"@type":"VirtualLocation","url":"https://tft-clash.vercel.app/tournament/"+screen.replace("tournament-","")},"organizer":{"@type":"Organization","name":"TFT Clash"}};
    if(screen==="profile"||screen==="leaderboard")ld={"@context":"https://schema.org","@type":"SportsOrganization","name":"TFT Clash","sport":"Teamfight Tactics","url":"https://tft-clash.vercel.app"};
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
    tournaments:"/tournaments",roster:"/roster",featured:"/featured",gear:"/gear"
  };

  var navTo=useCallback(function(s,sub){
    var parts=s.split("/");
    var base=parts[0];
    var sr=sub||parts[1]||"";
    if(base==="admin"&&!isAdmin){toast("Admin access required","error");return;}
    var canScrims=isAdmin||(currentUser&&scrimAccess.includes(currentUser.username));
    if(base==="scrims"&&!canScrims){toast("Access restricted","error");return;}
    setScreen(base);
    setSubRoute(sr);
    // Navigate via React Router
    var route=SCREEN_TO_ROUTE[base];
    if(route){
      var fullRoute=sr?route+"/"+sr:route;
      navigate(fullRoute);
    } else if(base.indexOf("flash-")===0){
      navigate("/flash/"+base.replace("flash-",""));
    } else if(base.indexOf("tournament-")===0){
      navigate("/tournament/"+base.replace("tournament-",""));
    } else {
      navigate("/"+base+(sr?"/"+sr:""));
    }
    // profilePlayer is set by the caller before navigating; do not clear it here
  },[isAdmin,currentUser,scrimAccess,toast,navigate]);

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
      navigate("/account",{replace:true});
    }
    // Hash migration: if user arrives with old hash URL, redirect to clean path
    var h=window.location.hash.slice(1);
    var isAuthCallback=h.startsWith("access_token")||h.startsWith("error_description")||params.get("code");
    if(isAuthCallback)return;
    if(h){
      var safeScreens=["home","standings","clash","events","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms","gear","tournaments","signup","login"];
      var hParts=h.split("/");var hBase=hParts[0];var hSub=hParts[1]||"";
      var isSafe=safeScreens.includes(hBase)||hBase.indexOf("tournament-")===0;
      if(isSafe){
        var route=SCREEN_TO_ROUTE[hBase];
        if(route){navigate(hSub?route+"/"+hSub:route,{replace:true});}
        else if(hBase.indexOf("tournament-")===0){navigate("/tournament/"+hBase.replace("tournament-",""),{replace:true});}
        else if(hBase.indexOf("flash-")===0){navigate("/flash/"+hBase.replace("flash-",""),{replace:true});}
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

  // Show auth screens fullscreen

  if(authScreen==="login") return(

    <>

      <style>{GCSS+styleHideMobile}</style>

      <LoginScreenNew/>

      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

        {toasts.map(t=><div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>)}

      </div>

    </>

  );

  if(authScreen==="signup") return(

    <>

      <style>{GCSS+styleHideMobile}</style>

      <SignUpScreenNew/>

      <div style={{position:"fixed",bottom:72,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:9998,pointerEvents:"none",maxWidth:360}}>

        {toasts.map(t=><div key={t.id} style={{pointerEvents:"auto"}}><Toast msg={t.msg} type={t.type} onClose={()=>removeToast(t.id)}/></div>)}

      </div>

    </>

  );

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

        <NavbarNew/>



        <ScreenBoundary key={screen} name={screen} onHome={function(){navTo("home");}}>

        {screen==="home"&&!currentUser&&<GuestHomeScreen/>}
        {screen==="home"&&currentUser&&<DashboardScreen/>}

        {screen==="standings"  &&<StandingsScreenNew/>}
        {screen==="leaderboard"&&<LeaderboardScreenNew/>}
        {screen==="hof"        &&<HofScreenNew/>}
        {screen==="archive"    &&<ArchiveScreenNew/>}
        {screen==="milestones" &&<MilestonesScreenNew/>}
        {screen==="challenges" &&<ChallengesScreenNew/>}

        {screen==="clash"      &&<ClashScreen subRoute={subRoute} players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig}/>}

        {screen==="bracket"    &&<BracketScreenNew/>}

        {screen==="profile"    &&profilePlayer&&<PlayerProfileScreenNew/>}

        {screen==="profile"    &&!profilePlayer&&<AccountScreenNew/>}

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

        {screen.indexOf("flash-")===0&&<FlashTournamentScreenNew tournamentId={screen.replace("flash-","")}/>}

        {screen.indexOf("tournament-")===0&&<TournamentDetailScreenNew/>}

        {screen==="host-apply" &&<HostApplyScreenNew/>}

        {screen==="host-dashboard"&&(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&(a.name===currentUser.username||a.email===currentUser.email);})))&&<HostDashboardScreenNew/>}

        {screen==="host-dashboard"&&!(isAdmin||(currentUser&&hostApps.some(function(a){return a.status==="approved"&&(a.name===currentUser.username||a.email===currentUser.email);})))&&<div className="page wrap" style={{textAlign:"center",paddingTop:80}}><div style={{fontSize:36,marginBottom:16}}>{React.createElement("i",{className:"ti ti-lock"})}</div><h2 style={{color:"#F2EDE4",marginBottom:10}}>Host Access Required</h2><p style={{color:"#BECBD9",fontSize:14,marginBottom:20}}>Your host application is pending review. You'll be notified once approved.</p><Btn v="primary" onClick={function(){navTo("home");}}>Back to Home</Btn></div>}


        {screen==="scrims"     &&(isAdmin||(currentUser&&scrimAccess.includes(currentUser.username)))&&<ScrimsScreenNew/>}

        {screen==="admin"&&<AdminScreenNew/>}

        </ScreenBoundary>

        <FooterNew/>

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

export default function App(){return(<ErrorBoundary><AppProvider><TFTClash/></AppProvider></ErrorBoundary>);}

