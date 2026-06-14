import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS } from '../lib/constants.js'
import { computeSeasonBonuses, getAttendanceStreak, isHotStreak, checkAchievements, syncAchievements } from '../lib/stats.js'
import { applyCutLine, applyLadderCut, advanceCountAfterGame, ladderCutsAfterGame, checkCheckmateWinner, checkmateProgress, FINALS_CHECK_DEFAULT_THRESHOLD } from '../lib/tournament.js'
import { sfxLock, sfxAdvance, sfxWin, sfxFinalTick, sfxTick } from '../lib/audio.js'
import { writeActivityEvent, createNotification } from '../lib/notifications.js'
import { Panel, Btn, Inp, Sel } from '../components/ui'
import Icon from '../components/ui/Icon.jsx'
import PageLayout from '../components/layout/PageLayout'
import SponsorShowcase from '../components/shared/SponsorShowcase'

// ── LiveStandingsPanel ─────────────────────────────────────────────────────────
function LiveStandingsPanel({checkedIn,tournamentState,lobbies,round,liveResults,currentUser,isCheckmate,checkmate,finalsThreshold}){
  var clashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:"";
  var cutLine=tournamentState&&tournamentState.cutLine?tournamentState.cutLine:0;
  var cutAfterGame=tournamentState&&tournamentState.cutAfterGame?tournamentState.cutAfterGame:0;
  var showCutLine=cutLine>0&&cutAfterGame>0&&round>=cutAfterGame;
  var totalGames=tournamentState&&tournamentState.totalGames?tournamentState.totalGames:4;
  // Elimination-ladder display: cut position = number of players who advance
  // after this game. Rows ranked at/after that index are on the wrong side of
  // the line and get cut when this game's results lock.
  var ladderMode=tournamentState&&tournamentState.cutMode==="ladder";
  var ladderStartSize=tournamentState&&tournamentState.ladderStartSize?tournamentState.ladderStartSize:0;
  var ladderCutsThisGame=ladderMode&&ladderCutsAfterGame(ladderStartSize,round);
  var ladderAdvance=ladderMode?advanceCountAfterGame(ladderStartSize,round):0;
  var cmProgress=(checkmate&&checkmate.progress)||{};

  var lrMap=liveResults||{};
  var liveRows=checkedIn.map(function(p){
    var lr=lrMap[String(p.id)]||{points:0,games:0};
    return {name:p.name,id:p.id,earned:lr.points||0,gamesPlayed:lr.games||0,cmPts:cmProgress[p.id]||0};
  }).sort(function(a,b){return b.earned-a.earned;});

  var lockedCount=tournamentState&&tournamentState.lockedLobbies?tournamentState.lockedLobbies.length:0;

  // An always-on plain-language explainer of how this clash is decided, so a
  // player never has to guess what the format is mid-game.
  var formatLine=isCheckmate
    ?("Checkmate finals - first to WIN a game at " + (finalsThreshold||20) + "+ finals points is champion")
    :ladderMode
      ?(ladderCutsThisGame?("Elimination ladder - top " + ladderAdvance + " advance after Game " + round + ", the rest are cut")
        :"Elimination ladder - no cut this game, everyone plays on")
      :(cutLine>0&&cutAfterGame>0)
        ?(round>=cutAfterGame?("Cut line: " + cutLine + " pts - below the line is out after Game " + cutAfterGame)
          :("Cut after Game " + cutAfterGame + " at " + cutLine + " pts - everyone plays until then"))
        :"All games count - highest total points wins, no cuts";

  // The current player's own row, for the "Your Status" header.
  var meName=currentUser?currentUser.username:null;
  var meIdx=meName?liveRows.findIndex(function(r){return r.name===meName;}):-1;
  var meRow=meIdx>=0?liveRows[meIdx]:null;
  function statusFor(ri,earned){
    var belowCut=ladderMode?(ladderCutsThisGame&&ri>=ladderAdvance):(showCutLine&&earned<cutLine);
    var nearCut=ladderMode?(ladderCutsThisGame&&!belowCut&&ri>=ladderAdvance-2):(showCutLine&&!belowCut&&earned<=cutLine+2);
    return {belowCut:belowCut,nearCut:nearCut};
  }
  var meStatus=meRow?statusFor(meIdx,meRow.earned):null;
  var meChampion=isCheckmate&&checkmate&&checkmate.winner&&meRow&&checkmate.winner.winnerId===meRow.id;
  var meLabel=meChampion?"CHAMPION":meStatus?(meStatus.belowCut?"ELIMINATED":meStatus.nearCut?"BUBBLE":"SAFE"):"SAFE";
  var meColor=meChampion?"text-primary bg-primary/15 border-primary/40":(meLabel==="ELIMINATED"?"text-error bg-error/10 border-error/30":meLabel==="BUBBLE"?"text-secondary bg-secondary/10 border-secondary/30":"text-success bg-success/10 border-success/30");

  return(
    <div className="mt-6 bg-surface-container-low rounded-lg border border-outline-variant/15 overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
        <Icon name="bar_chart" size={18} className="text-primary" />
        <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
          {"Live Standings - Game " + round + "/" + totalGames}
        </span>
        <span className="text-xs text-on-surface-variant/50 font-mono ml-auto">
          {"(" + lockedCount + "/" + lobbies.length + " locked)"}
        </span>
      </div>
      <div className="px-5 py-2 bg-primary/5 border-b border-primary/15 text-xs text-primary font-label tracking-wider">
        {formatLine}
      </div>
      {meRow&&(
        <div className="px-5 py-2.5 border-b border-outline-variant/10 flex items-center gap-2 flex-wrap bg-surface-container/40">
          <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60">Your status</span>
          <span className={"text-[10px] font-bold font-label tracking-widest uppercase px-2 py-0.5 rounded border " + meColor}>{meLabel}</span>
          <span className="text-xs font-mono text-on-surface-variant/80">{"#" + (meIdx+1) + " of " + liveRows.length}</span>
          <span className="text-xs font-mono text-tertiary ml-auto">{(isCheckmate?(meRow.cmPts+" finals pts"):(meRow.earned+" pts"))}</span>
        </div>
      )}
      <div className="divide-y divide-outline-variant/5">
        {liveRows.map(function(row,ri){
          var isLeader=ri===0&&row.earned>0;
          var st=statusFor(ri,row.earned);
          var belowCut=st.belowCut;
          var nearCut=st.nearCut;
          var isMe=meName&&row.name===meName;
          var onCheckmate=isCheckmate&&row.cmPts>=(finalsThreshold||20);
          return(
            <div key={row.id} className={"flex items-center gap-3 px-5 py-2 " + (isMe?"bg-tertiary/10 ring-1 ring-inset ring-tertiary/40 ":"") + (belowCut?"opacity-60 bg-error/5":isLeader?"bg-primary/5":"")}>
              <span className={"font-mono text-xs font-bold min-w-[22px] text-center " + (belowCut?"text-error":ri===0?"text-primary":ri===1?"text-on-surface-variant":ri===2?"text-on-surface-variant/70":"text-on-surface-variant/40")}>
                {ri+1}
              </span>
              <span className={"flex-1 text-sm " + (belowCut?"text-error":isLeader?"text-primary font-bold":isMe?"text-tertiary font-bold":"text-on-surface")}>
                {row.name}
                {isMe&&<span className="ml-2 text-[9px] font-bold font-label tracking-widest text-tertiary bg-tertiary/15 border border-tertiary/30 px-1 py-0.5 rounded align-middle">YOU</span>}
              </span>
              {onCheckmate&&!belowCut&&(
                <span className="text-[9px] font-bold font-label tracking-widest text-primary bg-primary/15 border border-primary/30 px-1.5 py-0.5 rounded">CHECKMATE</span>
              )}
              {belowCut&&(
                <span className="text-[9px] font-bold font-label tracking-widest text-error bg-error/10 border border-error/25 px-1.5 py-0.5 rounded">CUT</span>
              )}
              {nearCut&&!onCheckmate&&(
                <span className="text-[10px] font-bold font-label tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">BUBBLE</span>
              )}
              <span className={"font-mono text-xs font-bold " + (belowCut?"text-error":row.earned>0?"text-tertiary":"text-on-surface-variant/40")}>
                {isCheckmate?(row.cmPts+"/"+(finalsThreshold||20)):(row.earned>0?"+"+row.earned+" pts":"- pts")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BracketScreen ─────────────────────────────────────────────────────────────
// ── LobbyManagerPanel ───────────────────────────────────────────────────────
// Admin-only surface for fixing lobbies before a game locks: move a player to a
// different lobby, mark a no-show (removes them), or rebalance sizes. Kept
// separate from the live placement grid so it can never corrupt locked results.
function LobbyManagerPanel(props){
  var lobbies=props.lobbies||[];
  var lobbyLetters=props.lobbyLetters||[];
  var lockedCount=props.lockedCount||0;
  var locked=lockedCount>0;
  var totalPlayers=lobbies.reduce(function(s,l){return s+l.length;},0);
  var anyUneven=lobbies.some(function(l){return l.length!==8;});
  return(
    <div className="bg-surface-container-high border-2 border-secondary/30 rounded-lg overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-secondary/20 bg-secondary/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Icon name="tune" size={18} className="text-secondary" />
          <span className="font-label font-bold text-sm tracking-widest uppercase text-secondary">Lobby Manager</span>
          <span className="font-mono text-[11px] text-on-surface-variant/60">{lobbies.length+" lobbies, "+totalPlayers+" players"}</span>
        </div>
        <button onClick={props.onClose} className="text-on-surface-variant/50 hover:text-on-surface transition-colors flex-shrink-0" aria-label="Close lobby manager">
          <Icon name="close" size={18} />
        </button>
      </div>
      {locked&&(
        <div className="px-5 py-2 bg-error/8 text-error text-xs font-label">
          {lockedCount+(lockedCount===1?" lobby is":" lobbies are")+" locked. Unlock all lobbies to move or remove players."}
        </div>
      )}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {lobbies.map(function(lobby,li){
          var size=lobby.length;
          var bad=size!==8;
          return(
            <div key={li} className={"rounded border "+(bad?"border-amber-400/40 bg-amber-400/[.03]":"border-outline-variant/15 bg-surface-container-low")}>
              <div className="px-3 py-2 flex items-center justify-between border-b border-outline-variant/10">
                <span className="font-display text-sm text-on-surface-variant/80">{"LOBBY "+(lobbyLetters[li]||(li+1))}</span>
                <span className={"font-mono text-xs font-bold "+(bad?"text-amber-400":"text-tertiary")}>{size+"/8"}</span>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {lobby.slice().sort(function(a,b){return (b.pts||0)-(a.pts||0);}).map(function(p){
                  return(
                    <div key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="flex-1 min-w-0 truncate text-sm text-on-surface">
                        {p.name}
                        <span className="text-[10px] text-on-surface-variant/40 ml-1.5">{p.rank}</span>
                      </span>
                      <select
                        value={String(li)}
                        disabled={locked}
                        onChange={function(e){props.onMove(p.id,parseInt(e.target.value,10));}}
                        aria-label={"Move "+p.name+" to a different lobby"}
                        className="bg-surface-container border border-outline-variant/20 rounded px-1.5 py-1 text-xs text-on-surface appearance-none cursor-pointer disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary/60">
                        {lobbies.map(function(_,oi){return <option key={oi} value={oi}>{lobbyLetters[oi]||(oi+1)}</option>;})}
                      </select>
                      <button
                        type="button"
                        onClick={function(){props.onNoShow(p);}}
                        disabled={locked}
                        aria-label={"Mark "+p.name+" as no-show"}
                        title="Mark no-show (remove from lobby)"
                        className="text-error/70 hover:text-error disabled:opacity-30 transition-colors flex-shrink-0">
                        <Icon name="person_remove" size={16} />
                      </button>
                    </div>
                  );
                })}
                {size===0&&<div className="px-3 py-2 text-[11px] text-on-surface-variant/40">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-outline-variant/10 flex flex-wrap gap-2 items-center">
        <Btn variant="secondary" size="sm" onClick={props.onRebalance} disabled={locked}>
          <Icon name="balance" size={14} className="mr-1" />Rebalance sizes
        </Btn>
        <Btn variant="ghost" size="sm" onClick={props.onReroll} disabled={locked}>
          <Icon name="shuffle" size={14} className="mr-1" />Re-roll all
        </Btn>
        {anyUneven&&<span className="text-[11px] text-amber-400/80 font-label">Some lobbies are not 8 players. Move players or rebalance to even them out.</span>}
      </div>
    </div>
  );
}

// ── BroadcastStudioCard ─────────────────────────────────────────────────────
// Admin control surface for the OBS overlay: copy-ready browser-source URLs plus
// a live spotlight picker that pushes the featured player to the overlay.
function BroadcastStudioCard(props){
  var checkedIn=props.checkedIn||[];
  var origin=props.origin||"";
  var toast=props.toast||function(){};
  var _sel=useState(""); var sel=_sel[0]; var setSel=_sel[1];
  var views=[["rotate","Auto-Rotate (all-in-one)"],["spotlight","Player Spotlight"],["standings","Live Standings"],["soon","Starting Soon"],["lobbies","Lobby Overview"]];
  function copyUrl(url){
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(url);toast("Overlay URL copied","success");}
  }
  return(
    <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
        <Icon name="cast" size={18} className="text-primary/80" />
        <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface-variant/70">Broadcast Studio</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="text-[11px] text-on-surface-variant/50 font-label uppercase tracking-wider">Add these as OBS browser sources</div>
        <div className="space-y-1.5">
          {views.map(function(v){
            var url=origin+"/overlay?view="+v[0];
            return(
              <div key={v[0]} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-on-surface truncate">{v[1]}</span>
                <button onClick={function(){copyUrl(url);}} className="px-2 py-1 bg-primary/10 border border-primary/30 text-primary rounded text-[10px] font-label font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors flex-shrink-0">Copy URL</button>
              </div>
            );
          })}
        </div>
        <div className="pt-2 border-t border-outline-variant/10">
          <div className="text-[11px] text-on-surface-variant/50 font-label uppercase tracking-wider mb-2">Spotlight player (live)</div>
          <div className="flex gap-2">
            <select value={sel} onChange={function(e){setSel(e.target.value);}}
              className="flex-1 min-w-0 bg-surface-container border border-outline-variant/20 rounded px-2 py-1.5 text-sm text-on-surface appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/60">
              <option value="">Select player...</option>
              {checkedIn.slice().sort(function(a,b){return (b.pts||0)-(a.pts||0);}).map(function(p){return <option key={p.id} value={p.id}>{p.name}</option>;})}
            </select>
            <button onClick={function(){if(sel)props.onCast(sel);}} disabled={!sel}
              className="px-3 py-1.5 bg-secondary text-on-secondary rounded text-xs font-label font-bold uppercase tracking-wider disabled:opacity-40 hover:brightness-110 transition-all flex-shrink-0">Cast</button>
            <button onClick={function(){props.onCast(null);setSel("");}} title="Auto-rotate through the top players"
              className="px-3 py-1.5 bg-surface-container-high text-on-surface/70 rounded text-xs font-label font-bold uppercase tracking-wider hover:bg-surface-container-highest transition-colors flex-shrink-0">Auto</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketScreen(){
  var ctx=useApp();
  var players=ctx.players;
  var playersRef=useRef(players);
  playersRef.current=players;
  var setPlayers=ctx.setPlayers;
  var toast=ctx.toast;
  var isAdmin=ctx.isAdmin;
  var liveResults=ctx.liveResults||{};
  var currentUser=ctx.currentUser;
  var setProfilePlayer=ctx.setProfilePlayer;
  var navigate=useNavigate();
  var tournamentState=ctx.tournamentState;
  var setTournamentState=ctx.setTournamentState;
  var seasonConfig=ctx.seasonConfig;
  var pastClashes=ctx.pastClashes||[];

  var checkedIn=useMemo(function(){return players.filter(function(p){return p.checkedIn;});},[players]);

  var lobbySize=8;

  var round=tournamentState?tournamentState.round:1;

  var lockedLobbies=tournamentState?tournamentState.lockedLobbies:[];

  var currentClashId=tournamentState&&tournamentState.clashId?tournamentState.clashId:("c"+Date.now());

  var _mySearch=useState(currentUser?currentUser.username:"");
  var mySearch=_mySearch[0];
  var setMySearch=_mySearch[1];

  var _highlightLobby=useState(null);
  var highlightLobby=_highlightLobby[0];
  var setHighlightLobby=_highlightLobby[1];

  var _manageMode=useState(false);
  var manageMode=_manageMode[0];
  var setManageMode=_manageMode[1];

  var _placementEntry=useState({});
  var placementEntry=_placementEntry[0];
  var setPlacementEntry=_placementEntry[1];

  var _lobbyCodeInputs=useState({});
  var lobbyCodeInputs=_lobbyCodeInputs[0];
  var setLobbyCodeInputs=_lobbyCodeInputs[1];

  function getLobbyMeta(li){
    var stateLobbies=(tournamentState&&tournamentState.lobbies)||[];
    return stateLobbies.find(function(L){return L.lobby_number===li+1;})||null;
  }

  function saveLobbyCode(li,code){
    var meta=getLobbyMeta(li);
    var trimmed=(code||"").trim().toUpperCase();
    if(!supabase.from||!tournamentState.dbTournamentId){toast("Tournament not synced","error");return;}
    if(!meta||!meta.id){
      supabase.from('lobbies')
        .update({lobby_code:trimmed||null})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('round_number',round)
        .eq('lobby_number',li+1)
        .then(function(res){
          if(res&&res.error){toast("Failed to save code","error");return;}
          toast(trimmed?"Lobby "+(li+1)+" code saved":"Lobby "+(li+1)+" code cleared","success");
          setLobbyCodeInputs(function(prev){var next=Object.assign({},prev);delete next[li];return next;});
        }).catch(function(){toast("Failed to save code","error");});
      return;
    }
    supabase.from('lobbies')
      .update({lobby_code:trimmed||null})
      .eq('id',meta.id)
      .then(function(res){
        if(res&&res.error){toast("Failed to save code","error");return;}
        toast(trimmed?"Lobby "+(li+1)+" code saved":"Lobby "+(li+1)+" code cleared","success");
        setLobbyCodeInputs(function(prev){var next=Object.assign({},prev);delete next[li];return next;});
      }).catch(function(){toast("Failed to save code","error");});
  }

  var _playerSubmissions=useState({});
  var playerSubmissions=_playerSubmissions[0];
  var setPlayerSubmissions=_playerSubmissions[1];

  var _showFinalizeConfirm=useState(false);
  var showFinalizeConfirm=_showFinalizeConfirm[0];
  var setShowFinalizeConfirm=_showFinalizeConfirm[1];

  var _viewingRound=useState(null);
  var viewingRound=_viewingRound[0];
  var setViewingRound=_viewingRound[1];

  var _autoAdvanceCountdown=useState(null);
  var autoAdvanceCountdown=_autoAdvanceCountdown[0];
  var setAutoAdvanceCountdown=_autoAdvanceCountdown[1];

  var autoAdvanceRef=useRef(null);

  function computeLobbies(){
    // Read whichever key the admin surface wrote. TournamentTab persists
    // `seedingMethod`; older paths used `seedAlgo`. Accept both so the admin's
    // Snake/Random/Anti-Stack choice is actually honored on round 1.
    var algo=(tournamentState&&(tournamentState.seedingMethod||tournamentState.seedAlgo))||"rank-based";
    var pool;
    if(round===1){
      if(algo==="random"){
        pool=[...checkedIn].sort(function(){return Math.random()-0.5;});
      } else if(algo==="snake"){
        var sorted=[...checkedIn].sort(function(a,b){return b.lp-a.lp;});
        pool=[];
        sorted.forEach(function(p,i){if(Math.floor(i/lobbySize)%2===0)pool.push(p);else pool.unshift(p);});
      } else if(algo==="anti-stack"){
        var ranked=[...checkedIn].sort(function(a,b){return b.pts-a.pts||b.lp-a.lp;});
        var lobbyCount=Math.ceil(ranked.length/lobbySize);
        var buckets=Array.from({length:lobbyCount},function(){return[];});
        ranked.forEach(function(p,i){
          var row=Math.floor(i/lobbyCount);
          var col=row%2===0?i%lobbyCount:(lobbyCount-1-(i%lobbyCount));
          buckets[col].push(p);
        });
        pool=[].concat.apply([],buckets);
      } else {
        pool=[...checkedIn].sort(function(a,b){return b.pts-a.pts||b.lp-a.lp;});
      }
    } else {
      var byPts=[...checkedIn].sort(function(a,b){return b.pts-a.pts||b.lp-a.lp;});
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

  var lobbies=useMemo(function(){
    var saved=tournamentState&&tournamentState.savedLobbies;
    if(saved&&saved.length>0&&saved[0]&&saved[0].length>0){
      return saved.map(function(lobbyIds){
        return lobbyIds.map(function(id){return checkedIn.find(function(p){return p.id===id;})||null;}).filter(Boolean);
      }).filter(function(l){return l.length>0;});
    }
    return computeLobbies();
  },[tournamentState&&tournamentState.savedLobbies,checkedIn,round]);

  // ── FINALS "CHECKMATE" MODE (opt-in; standard clashes skip all of this) ──────
  // In checkmate the Top-8 finals lobby keeps playing until a player wins a game
  // while sitting at/over the threshold in finals points. finalsStartRound marks
  // the first round at the Top-8 single lobby so only finals games count.
  var finalsMode=(tournamentState&&tournamentState.finalsMode)||'standard';
  var isCheckmate=finalsMode==='checkmate';
  var finalsThreshold=(tournamentState&&tournamentState.finalsThreshold)?tournamentState.finalsThreshold:FINALS_CHECK_DEFAULT_THRESHOLD;
  var finalsStartRound=(tournamentState&&tournamentState.finalsStartRound)||0;

  useEffect(function(){
    if(!isCheckmate||!isAdmin)return;
    if(finalsStartRound>0)return;
    if(lobbies.length===1&&checkedIn.length<=8&&checkedIn.length>0){
      setTournamentState(function(ts){return Object.assign({},ts,{finalsStartRound:ts.round||round});});
    }
  },[isCheckmate,isAdmin,finalsStartRound,lobbies.length,checkedIn.length,round]);

  var checkmate=useMemo(function(){
    if(!isCheckmate)return {winner:null,progress:{}};
    var startR=finalsStartRound>0?finalsStartRound:round;
    var rows=[];
    checkedIn.forEach(function(p){
      (p.clashHistory||[]).forEach(function(h){
        if(h.clashId!==currentClashId)return;
        if((h.round||0)<startR)return;
        rows.push({player_id:p.id,game_number:h.round,placement:(h.place||h.placement)||9,points:(h.pts||0)});
      });
    });
    return {winner:checkCheckmateWinner(rows,finalsThreshold),progress:checkmateProgress(rows)};
  },[isCheckmate,finalsStartRound,round,checkedIn,currentClashId,finalsThreshold]);

  var checkmateWinner=checkmate.winner;
  var checkmateWinnerPlayer=checkmateWinner?checkedIn.find(function(p){return p.id===checkmateWinner.winnerId;}):null;

  var checkmateSfxRef=useRef(null);
  useEffect(function(){
    if(checkmateWinner&&checkmateSfxRef.current!==checkmateWinner.winnerId){
      checkmateSfxRef.current=checkmateWinner.winnerId;
      sfxWin();
    }
    if(!checkmateWinner)checkmateSfxRef.current=null;
  },[checkmateWinner]);

  // Load existing player_reports from DB on mount
  useEffect(function(){
    if(!supabase.from||!tournamentState.dbTournamentId)return;
    supabase.from('player_reports').select('player_id,reported_placement,game_number')
      .eq('tournament_id',tournamentState.dbTournamentId).eq('game_number',round)
      .then(function(res){
        if(res.error||!res.data||!res.data.length)return;
        var restored={};
        res.data.forEach(function(r){
          lobbies.forEach(function(lobby,li){
            var found=lobby.find(function(p){return String(p.id)===String(r.player_id);});
            if(found){
              if(!restored[li])restored[li]={};
              restored[li][r.player_id]={placement:r.reported_placement,name:found.name||found.username||'',confirmed:false};
            }
          });
        });
        if(Object.keys(restored).length>0)setPlayerSubmissions(restored);
      }).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
  },[tournamentState.dbTournamentId,round,lobbies.length]);

  // Auto-persist lobby assignments
  useEffect(function(){
    if(lobbies.length===0)return;
    var saved=tournamentState&&tournamentState.savedLobbies;
    var lobbyIds=lobbies.map(function(l){return l.map(function(p){return p.id;});});
    if(saved&&JSON.stringify(saved)===JSON.stringify(lobbyIds))return;
    setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:lobbyIds});});
    if(supabase.from&&tournamentState.dbTournamentId){
      lobbyIds.forEach(function(playerIds,idx){
        supabase.from('lobbies').upsert({
          tournament_id:tournamentState.dbTournamentId,
          lobby_number:idx+1,
          round_number:round,
          player_ids:playerIds,
          status:'pending'
        },{onConflict:'tournament_id,lobby_number,round_number'})
        .then(function(res){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
      });
    }
  },[lobbies]);

  function findMyLobby(){
    var q=mySearch.trim().toLowerCase();
    if(!q)return;
    var li=lobbies.findIndex(function(lobby){return lobby.some(function(p){var rid=(p.riotId||p.riot_id_eu||p.riot_id_na||'').toLowerCase();return (p.name||'').toLowerCase().includes(q)||rid.includes(q);});});
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
    setPlacementEntry(function(pe){
      var entry=Object.assign({},pe[li]||{});
      var placements=Object.assign({},entry.placements||{});
      placements[pid]=val;
      entry.placements=placements;
      return Object.assign({},pe,{[li]:entry});
    });
  }

  function placementValid(li){
    var lobby=lobbies[li];
    if(!placementEntry[li])return false;
    var vals=lobby.map(function(p){return parseInt(placementEntry[li].placements[p.id]||"0");});
    var rangeValid=vals.every(function(v){return v>=0&&v<=8;});
    // 1-8 placements must be unique; DNP (0) can repeat.
    var placedVals=vals.filter(function(v){return v>0;});
    var unique=new Set(placedVals).size===placedVals.length;
    return rangeValid&&unique;
  }

  var lockingRef=useRef({});
  function applyGameResults(li){
    var lobby=lobbies[li];
    if(!placementEntry[li])return;
    // Guard against a fast double-click locking the same lobby twice (which would
    // append a duplicate clashHistory entry and inflate local points until reload).
    // The DB upsert is already idempotent; this keeps optimistic local state honest.
    if(lockingRef.current[li]||(lockedLobbies||[]).indexOf(li)>=0)return;
    lockingRef.current[li]=true;
    setTimeout(function(){delete lockingRef.current[li];},2000);
    var placements={};
    lobby.forEach(function(p){placements[p.id]=parseInt(placementEntry[li].placements[p.id]||"0");});
    var allClashIds=pastClashes.map(function(c){return "c"+c.id;});

    // Snapshot every player's NEW values ONCE based on current ref state, so
    // local setState and DB writes use the SAME numbers (prevents double-count).
    var snapshot={};
    lobby.forEach(function(p){
      var place=placements[p.id];
      if(place===undefined)return;
      var current=playersRef.current.find(function(x){return x.id===p.id;})||p;
      var earned=PTS[place]||0;
      var bonuses=place>0?computeSeasonBonuses(current,currentClashId,allClashIds,seasonConfig):{bonusPts:0,comebackTriggered:false,attendanceMilestone:null};
      var bonusPts=bonuses.bonusPts||0;
      var totalEarned=earned+bonusPts;
      var newGames=(current.games||0)+1;
      var newWins=(current.wins||0)+(place===1?1:0);
      var newTop4=(current.top4||0)+(place>=1&&place<=4?1:0);
      var newPts=(current.pts||0)+totalEarned;
      var newAvgRaw=place>0?(((parseFloat(current.avg)||0)*(current.games||0)+place)/newGames):(parseFloat(current.avg)||0);
      var newAvg=parseFloat(newAvgRaw.toFixed(2));
      snapshot[p.id]={
        place:place,earned:earned,bonusPts:bonusPts,bonuses:bonuses,
        newPts:newPts,newWins:newWins,newTop4:newTop4,newGames:newGames,newAvg:newAvg
      };
    });

    setPlayers(function(prev){return prev.map(function(p){
      var snap=snapshot[p.id];
      if(!snap)return p;
      var newHistory=[...(p.clashHistory||[]),{round:round,place:snap.place,pts:snap.earned,clashId:currentClashId,bonusPts:snap.bonusPts,comebackTriggered:snap.bonuses.comebackTriggered,attendanceMilestone:snap.bonuses.attendanceMilestone,lobbyIndex:li}];
      var newSparkline=[...(p.sparkline||[p.pts]),snap.newPts];
      var newStreak=snap.place>=1&&snap.place<=4?(p.currentStreak||0)+1:0;
      var bestStreak=Math.max(p.bestStreak||0,newStreak);
      var newAttendanceStreak=getAttendanceStreak(p,allClashIds.concat([currentClashId]));
      return Object.assign({},p,{pts:snap.newPts,wins:snap.newWins,top4:snap.newTop4,games:snap.newGames,avg:String(snap.newAvg),
        clashHistory:newHistory,sparkline:newSparkline,currentStreak:newStreak,bestStreak:bestStreak,
        lastClashId:currentClashId,attendanceStreak:newAttendanceStreak});
    });});

    setTournamentState(function(ts){
      return Object.assign({},ts,{
        lockedLobbies:[...(ts.lockedLobbies||[]),li],
        lockedPlacements:Object.assign({},ts.lockedPlacements||{},{[li]:placements})
      });
    });
    setPlacementEntry(function(pe){return Object.assign({},pe,{[li]:Object.assign({},pe[li],{open:false})});});

    sfxLock();
    var hasFirst=Object.keys(snapshot).some(function(pid){return snapshot[pid].place===1;});
    if(hasFirst)sfxWin();

    function rollbackLock(){
      setTournamentState(function(ts){
        return Object.assign({},ts,{
          lockedLobbies:(ts.lockedLobbies||[]).filter(function(x){return x!==li;}),
          lockedPlacements:Object.keys(ts.lockedPlacements||{}).reduce(function(acc,k){if(String(k)!==String(li))acc[k]=ts.lockedPlacements[k];return acc;},{})
        });
      });
      // Also revert local player state so UI stays consistent with DB.
      setPlayers(function(prev){return prev.map(function(p){
        var snap=snapshot[p.id];
        if(!snap)return p;
        var totalReverted=snap.earned+snap.bonusPts;
        var hist=(p.clashHistory||[]).filter(function(h){return!(h.clashId===currentClashId&&h.round===round&&h.lobbyIndex===li);});
        var newGames=Math.max((p.games||1)-1,0);
        var newWins=Math.max((p.wins||0)-(snap.place===1?1:0),0);
        var newTop4=Math.max((p.top4||0)-(snap.place>=1&&snap.place<=4?1:0),0);
        var newPts=Math.max((p.pts||0)-totalReverted,0);
        var newAvg=newGames>0&&snap.place>0?(((parseFloat(p.avg)||0)*(p.games||1)-snap.place)/newGames):0;
        return Object.assign({},p,{pts:newPts,wins:newWins,top4:newTop4,games:newGames,
          avg:String(parseFloat(newAvg.toFixed(2))),clashHistory:hist});
      });});
      setPlacementEntry(function(pe){return Object.assign({},pe,{[li]:Object.assign({},pe[li],{open:true})});});
    }

    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('lobbies').update({status:'locked'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){}).catch(function(){ toast('Failed to lock lobby','error'); });
    }

    if(supabase.from&&tournamentState.dbTournamentId){
      var dbTid=tournamentState.dbTournamentId;
      var gameRows=[];
      lobby.forEach(function(p){
        var snap=snapshot[p.id];
        if(!snap)return;
        // Persist only ranked placements (place>0) into game_results.
        // Persist total points (base + bonus) so re-summing matches local state.
        if(snap.place>0){
          gameRows.push({tournament_id:dbTid,round_number:round,player_id:p.id,
            placement:snap.place,points:snap.earned+snap.bonusPts,is_dnp:false,game_number:round});
        }
      });
      if(gameRows.length>0){
        // Upsert (not insert) so a retry after a partial-success save cannot create
        // duplicate rows for the same player/round, which would double-count season pts
        // via the refresh_player_stats trigger. Matches the unique key from mig 052.
        supabase.from('game_results').upsert(gameRows,{onConflict:'tournament_id,game_number,player_id'}).then(function(res){
          if(res.error){toast("Failed to save game results - please retry","error");rollbackLock();return;}
          // Aggregate stats are owned by the refresh_player_stats trigger on game_results.
          // Client-side players.update was duplicating the trigger's work and racing with it.
        }).catch(function(){ toast('Failed to save game results','error'); rollbackLock(); });
      }
    }

    // Notify the current player if their lobby was just locked
    var myLobby=currentUser?lobbies[li]&&lobbies[li].some(function(p){return p.name===currentUser.username;}):false;
    var myPlayer=myLobby?checkedIn.find(function(p){return p.name===currentUser.username;}):null;
    if(myPlayer){
      var snapMy=snapshot[myPlayer.id];
      var myPlace=snapMy?snapMy.place:0;
      var myPts=snapMy?(snapMy.earned+snapMy.bonusPts):0;
      if(myPlace>0)toast("Your results are in! You placed #"+myPlace+" (+"+myPts+"pts)","success");
      else toast("Your results are in! Marked DNP","info");
    }else{
      toast("Lobby "+(li+1)+" results applied!","success");
    }
  }

  function submitMyPlacement(li,playerId,playerName,placement){
    var p=parseInt(placement);
    if(p<1||p>8){toast("Invalid placement","error");return;}
    setPlayerSubmissions(function(ps){
      var lobbySubmissions=Object.assign({},ps[li]||{});
      lobbySubmissions[playerId]={placement:p,name:playerName,confirmed:false};
      return Object.assign({},ps,{[li]:lobbySubmissions});
    });
    if(supabase.from&&tournamentState.dbTournamentId){
      // The DB unique key is (lobby_id, game_number, player_id) but BracketScreen does
      // not track lobby UUIDs (season-clash flow), so lobby_id is null and NULL!=NULL
      // means the constraint never dedupes. Delete prior null-lobby rows for this
      // player/round before inserting to avoid stacking duplicate self-reports.
      supabase.from('player_reports').delete()
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('player_id',playerId)
        .eq('game_number',round)
        .is('lobby_id',null)
        .then(function(){
          supabase.from('player_reports').insert({
            tournament_id:tournamentState.dbTournamentId,
            lobby_id:null,
            game_number:round,
            player_id:playerId,
            reported_placement:p,
            reported_at:new Date().toISOString()
          }).then(function(r){
          }).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
        }).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
    }
    toast("Placement submitted - waiting for admin confirmation","success");
  }

  function unlockLobby(li){
    if(!window.confirm("Unlock Lobby "+(li+1)+"? This will revert all results for this lobby in the current round."))return;
    var savedPlacements=(tournamentState.lockedPlacements||{})[li];

    // Snapshot reverts ONCE so local + DB writes stay aligned (mirrors applyGameResults).
    var revertSnapshot={};
    if(savedPlacements){
      Object.keys(savedPlacements).forEach(function(pid){
        var place=savedPlacements[pid];
        if(place===undefined)return;
        var current=playersRef.current.find(function(x){return String(x.id)===String(pid);});
        if(!current)return;
        var hist=current.clashHistory||[];
        var matchIdx=-1;
        for(var i=hist.length-1;i>=0;i--){
          var h=hist[i];
          var lobbyMatch=h.lobbyIndex===undefined||h.lobbyIndex===li;
          if(h.clashId===currentClashId&&h.round===round&&lobbyMatch){matchIdx=i;break;}
        }
        var bonusPts=matchIdx>=0?(hist[matchIdx].bonusPts||0):0;
        var earned=PTS[place]||0;
        var totalReverted=earned+bonusPts;
        var newGames=Math.max((current.games||1)-1,0);
        var newWins=Math.max((current.wins||0)-(place===1?1:0),0);
        var newTop4=Math.max((current.top4||0)-(place>=1&&place<=4?1:0),0);
        var newPts=Math.max((current.pts||0)-totalReverted,0);
        var newAvgRaw=newGames>0&&place>0?(((parseFloat(current.avg)||0)*(current.games||1)-place)/newGames):0;
        var newAvg=parseFloat(newAvgRaw.toFixed(2));
        revertSnapshot[pid]={place:place,earned:earned,bonusPts:bonusPts,
          newPts:newPts,newWins:newWins,newTop4:newTop4,newGames:newGames,newAvg:newAvg};
      });

      setPlayers(function(prev){return prev.map(function(p){
        var snap=revertSnapshot[p.id];
        if(!snap)return p;
        var newHistory=(p.clashHistory||[]).filter(function(h){
          var lobbyMatch=h.lobbyIndex===undefined||h.lobbyIndex===li;
          return!(h.round===round&&h.clashId===currentClashId&&lobbyMatch);
        });
        var newSparkline=(p.sparkline||[]).slice(0,-1);
        var newStreak=snap.place>=1&&snap.place<=4?Math.max((p.currentStreak||0)-1,0):p.currentStreak;
        return Object.assign({},p,{
          pts:snap.newPts,wins:snap.newWins,top4:snap.newTop4,games:snap.newGames,
          avg:String(snap.newAvg),
          clashHistory:newHistory,sparkline:newSparkline,currentStreak:newStreak
        });
      });});
    }
    setTournamentState(function(ts){
      var newLocked=(ts.lockedLobbies||[]).filter(function(i){return i!==li;});
      var newSavedPlacements=Object.assign({},ts.lockedPlacements||{});
      delete newSavedPlacements[li];
      return Object.assign({},ts,{lockedLobbies:newLocked,lockedPlacements:newSavedPlacements});
    });
    if(supabase.from&&tournamentState.dbTournamentId){
      var lobbyPlayerIds=lobbies[li]?lobbies[li].map(function(p){return p.id;}):[];
      if(lobbyPlayerIds.length>0){
        supabase.from('game_results').delete()
          .eq('tournament_id',tournamentState.dbTournamentId)
          .eq('round_number',round)
          .in('player_id',lobbyPlayerIds)
          .then(function(res){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
      }
      // Reset to 'pending' so it matches the initial lobby insert state.
      supabase.from('lobbies').update({status:'pending'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
      // Stats revert is handled by refresh_player_stats trigger when game_results rows
      // are deleted above.
    }
    toast("Lobby "+(li+1)+" unlocked - results reverted","success");
  }

  var allLocked=lobbies.length>0&&lobbies.every(function(_,i){return lockedLobbies.includes(i);});

  // Advance to the next round, applying the cut line when this is the cut round.
  // Shared by the manual "Next Game" button AND the 15s auto-advance so the cut is
  // never silently skipped. No-ops on the final round (finalize is handled separately).
  function performRoundAdvance(isAuto){
    var maxRounds=tournamentState.totalGames||4;
    // Checkmate finals are open-ended: keep playing the Top-8 lobby past the
    // nominal game count until someone clinches. Everywhere else, no-op on the
    // final round (finalize is handled separately).
    var checkmateExtend=isCheckmate&&!checkmateWinner&&lobbies.length===1;
    if(round>=maxRounds&&!checkmateExtend)return;
    var nextRound=round+1;
    var cutMode=tournamentState.cutMode||"threshold";
    var cutL=tournamentState.cutLine||0;
    var cutG=tournamentState.cutAfterGame||0;
    var cutMsg="";

    // Apply eliminations to a set of player ids: drop them from checked-in and
    // record them as eliminated. Shared by both cut modes.
    function applyElimination(elimIds){
      if(!elimIds||elimIds.length===0)return;
      setPlayers(function(ps){return ps.map(function(p){return elimIds.indexOf(String(p.id))>=0?Object.assign({},p,{checkedIn:false}):p;});});
      setTournamentState(function(ts){
        var kept=(ts.checkedInIds||[]).filter(function(cid){return elimIds.indexOf(String(cid))<0;});
        var existingElim=(ts.eliminatedIds||[]).map(String);
        var mergedElim=existingElim.concat(elimIds.filter(function(eid){return existingElim.indexOf(eid)<0;}));
        return Object.assign({},ts,{checkedInIds:kept,eliminatedIds:mergedElim});
      });
    }

    if(cutMode==="ladder"){
      // Elimination-ladder: rank by the spec tiebreaker chain, then cut down to
      // the survivor count for this game. No cut after game 1.
      var startSize=tournamentState.ladderStartSize||((tournamentState.checkedInIds||[]).length)||checkedIn.length;
      if(ladderCutsAfterGame(startSize,round)){
        var advanceCount=advanceCountAfterGame(startSize,round);
        var ladderStandings=checkedIn.map(function(p){
          var clashEntries=(p.clashHistory||[]).filter(function(h){return h.clashId===currentClashId;});
          var totalPts=clashEntries.reduce(function(s,h){return s+((h.pts||0)+(h.bonusPts||0));},0);
          var places=clashEntries.map(function(h){return (h.place||h.placement)||9;});
          return Object.assign({},p,{
            tournamentPts:totalPts,
            gamesInTournament:clashEntries.length,
            _top4:places.filter(function(x){return x<=4;}).length,
            _bot3:places.filter(function(x){return x>=6;}).length,
            _wins:places.filter(function(x){return x===1;}).length,
            _lastPlacement:places.length?places[places.length-1]:9
          });
        });
        ladderStandings.sort(function(a,b){
          if(b.tournamentPts!==a.tournamentPts)return b.tournamentPts-a.tournamentPts;
          if(b._top4!==a._top4)return b._top4-a._top4;
          if(a._bot3!==b._bot3)return a._bot3-b._bot3;
          if(b._wins!==a._wins)return b._wins-a._wins;
          return a._lastPlacement-b._lastPlacement;
        });
        var lad=applyLadderCut(ladderStandings,advanceCount);
        if(lad.eliminated.length>0){
          cutMsg=" - "+lad.eliminated.length+" cut (top "+advanceCount+" advance)";
          applyElimination(lad.eliminated.map(function(ep){return String(ep.id);}));
        }
      }
    } else if(cutL>0&&round===cutG){
      var standings=checkedIn.map(function(p){
        var clashEntries=(p.clashHistory||[]).filter(function(h){return h.clashId===currentClashId;});
        var tournamentPts=clashEntries.reduce(function(s,h){return s+((h.pts||0)+(h.bonusPts||0));},0);
        return Object.assign({},p,{tournamentPts:tournamentPts,gamesInTournament:clashEntries.length});
      });
      var cutResult=applyCutLine(standings,cutL,cutG);
      if(cutResult.eliminated.length>0){
        cutMsg=" - "+cutResult.eliminated.length+" players eliminated (below "+cutL+"pts)";
        applyElimination(cutResult.eliminated.map(function(ep){return String(ep.id);}));
      }
    }
    var currentLobbies=lobbies;
    setTournamentState(function(ts){
      var newRoundHistory=Object.assign({},ts.roundHistory||{});
      if(ts.lockedPlacements&&Object.keys(ts.lockedPlacements).length>0){newRoundHistory[round]=ts.lockedPlacements;}
      var newRoundLobbies=Object.assign({},ts.roundLobbies||{});
      newRoundLobbies[round]=currentLobbies.map(function(lobby){
        return lobby.map(function(p){return {id:p.id,name:p.name,rank:p.rank,riotId:p.riotId||p.riot_id_eu||''};});
      });
      var patch={round:nextRound,lockedLobbies:[],savedLobbies:[],roundHistory:newRoundHistory,roundLobbies:newRoundLobbies};
      // Extending the checkmate finals past the nominal count: keep the display
      // (Game X of Y) honest by growing totalGames to match.
      if(checkmateExtend&&nextRound>(ts.totalGames||0))patch.totalGames=nextRound;
      return Object.assign({},ts,patch);
    });
    if(isAuto)sfxAdvance();
    toast((isAuto?"Auto-advanced to Game ":"Advanced to Game ")+nextRound+cutMsg,"success");
  }

  // Auto-advance countdown when all lobbies locked.
  // advanceTriggeredRef guards against double-fire if state churns rapidly at countdown=0.
  var advanceTriggeredRef=useRef(false);
  useEffect(function(){
    if(!isAdmin||!allLocked||round>=(tournamentState.totalGames||4)){
      if(autoAdvanceRef.current){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;}
      setAutoAdvanceCountdown(null);
      advanceTriggeredRef.current=false;
      return;
    }
    advanceTriggeredRef.current=false;
    setAutoAdvanceCountdown(15);
    autoAdvanceRef.current=setInterval(function(){
      setAutoAdvanceCountdown(function(c){
        if(c===null)return null;
        if(c<=1){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;sfxFinalTick();return 0;}
        if(c<=5)sfxTick();
        return c-1;
      });
    },1000);
    return function(){if(autoAdvanceRef.current){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;}};
  },[allLocked,isAdmin,round,tournamentState.totalGames]);

  // Trigger advance when countdown hits 0. Delegates to performRoundAdvance so the
  // cut line is applied on auto-advance exactly as it is on the manual button.
  // lobbies/round are in deps so the closure captures latest state at advance time.
  useEffect(function(){
    if(autoAdvanceCountdown!==0||!isAdmin||!allLocked)return;
    if(advanceTriggeredRef.current)return;
    advanceTriggeredRef.current=true;
    var maxRounds=tournamentState.totalGames||4;
    if(round<maxRounds){performRoundAdvance(true);}
    setAutoAdvanceCountdown(null);
  },[autoAdvanceCountdown,isAdmin,allLocked,round,lobbies,tournamentState.totalGames]);

  function cancelAutoAdvance(){
    if(autoAdvanceRef.current){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;}
    setAutoAdvanceCountdown(null);
    toast("Auto-advance cancelled","info");
  }

  function saveResultsToSupabase(allPlayers,clashId,forceWinnerId){
    if(!supabase.from)return;
    var clashName=(tournamentState&&tournamentState.clashName)?tournamentState.clashName:("Clash "+new Date().toLocaleDateString());
    var doSave=function(tId){
      supabase.from('tournaments').update({phase:'complete',completed_at:new Date().toISOString()}).eq('id',tId)
        .then(function(r){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
      // Aggregate per-player stats from clashHistory and rank them with the canonical
      // solo tiebreaker chain (matches FlashTournamentScreen.finalizeTournament).
      // Uses standard competition ranking so equal rows share a placement instead
      // of being arbitrarily ordered by Map iteration order.
      var playerTotals={};
      allPlayers.forEach(function(p){
        var entries=(p.clashHistory||[]).filter(function(h){return h.clashId===clashId;});
        if(entries.length===0)return;
        var totalPts=entries.reduce(function(s,h){return s+((h.pts||0)+(h.bonusPts||0));},0);
        var wins=entries.filter(function(h){return(h.place||h.placement)===1;}).length;
        var top4=entries.filter(function(h){return(h.place||h.placement)>=1&&(h.place||h.placement)<=4;}).length;
        var placeSum=entries.reduce(function(s,h){return s+((h.place||h.placement)||0);},0);
        var sorted=entries.slice().sort(function(a,b){return(a.round||0)-(b.round||0);});
        var lastEntry=sorted[sorted.length-1];
        var lastPlacement=lastEntry?(lastEntry.place||lastEntry.placement||9):9;
        playerTotals[p.id]={tournament_id:tId,player_id:p.id,total_points:totalPts,wins:wins,top4_count:top4,_placeSum:placeSum,_lastPlacement:lastPlacement};
      });
      var ranked=Object.values(playerTotals).slice().sort(function(a,b){
        if(b.total_points!==a.total_points)return b.total_points-a.total_points;
        var aTie=(a.wins*2)+a.top4_count;
        var bTie=(b.wins*2)+b.top4_count;
        if(bTie!==aTie)return bTie-aTie;
        if(b.wins!==a.wins)return b.wins-a.wins;
        if(b.top4_count!==a.top4_count)return b.top4_count-a.top4_count;
        if(a._placeSum!==b._placeSum)return a._placeSum-b._placeSum;
        return a._lastPlacement-b._lastPlacement;
      });
      // Checkmate finals: the champion is whoever clinched the win, not whoever
      // has the most total points. Pin them to the front and rank strictly so
      // they take 1st regardless of the points tiebreaker chain.
      var forceWinner=forceWinnerId?ranked.find(function(r){return r.player_id===forceWinnerId;}):null;
      if(forceWinner){
        ranked=[forceWinner].concat(ranked.filter(function(r){return r.player_id!==forceWinnerId;}));
      }
      function tieKey(r){return [r.total_points,(r.wins*2)+r.top4_count,r.wins,r.top4_count,-r._placeSum,-r._lastPlacement].join('|');}
      var lastKey=null;
      var lastRank=0;
      var rows=ranked.map(function(r,idx){
        if(forceWinner)return {tournament_id:r.tournament_id,player_id:r.player_id,total_points:r.total_points,wins:r.wins,top4_count:r.top4_count,final_placement:idx+1};
        var k=tieKey(r);
        if(k!==lastKey){lastRank=idx+1;lastKey=k;}
        return {tournament_id:r.tournament_id,player_id:r.player_id,total_points:r.total_points,wins:r.wins,top4_count:r.top4_count,final_placement:lastRank};
      });
      if(rows.length>0){
        supabase.from('tournament_results').upsert(rows,{onConflict:'tournament_id,player_id'}).then(function(r){
          if(r.error){toast("Failed to save player results","error");return;}
          allPlayers.forEach(function(p){
            if(p.authUserId){createNotification(p.authUserId,"Results Finalized",clashName+" results are in! Check the Results screen to see your placement and points.","trophy");}
          });
          var winnerRow=rows.find(function(row){return row.final_placement===1;});
          if(winnerRow){
            var winnerPlayer=allPlayers.find(function(p){return p.id===winnerRow.player_id;});
            if(winnerPlayer)writeActivityEvent("result",winnerPlayer.id,winnerPlayer.name+" won "+clashName);
          }
          var sortedByPts=allPlayers.slice().sort(function(a,b){return(b.pts||0)-(a.pts||0);});
          allPlayers.forEach(function(p){
            if(p.id){
              var newRank=sortedByPts.findIndex(function(q){return q.id===p.id;})+1;
              if(p.lastClashRank&&p.lastClashRank!==newRank){
                writeActivityEvent("rank_change",p.id,p.name+" moved to #"+newRank);
              }
            }
          });
          allPlayers.forEach(function(p){
            if(p.id){
              var ppRankA=allPlayers.filter(function(q){return q.pts>p.pts;}).length+1;
              var earnedA=checkAchievements(p,ppRankA);
              if(earnedA.length>0)syncAchievements(p.id,earnedA);
            }
          });
          allPlayers.forEach(function(p){
            if(p.id&&playerTotals[p.id]){
              // Aggregate stats (season_pts, wins, top4, games, avg_placement) are owned
              // by the refresh_player_stats trigger. Only the denormalized last_clash_rank
              // is written here.
              supabase.from('players').update({
                last_clash_rank:sortedByPts.findIndex(function(q){return q.id===p.id;})+1
              }).eq('id',p.id).then(function(pr){
              }).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
            }
          });
        }).catch(function(){ toast('Failed to save player results','error'); });
      }
    };
    var existingId=tournamentState.dbTournamentId;
    if(existingId){
      doSave(existingId);
    }else{
      supabase.from('tournaments').insert({name:clashName,date:new Date().toISOString().split('T')[0],phase:'complete',type:'season_clash'}).select('id').single().then(function(res){
        if(res.error){toast("Failed to save results to database","error");return;}
        if(res.data)doSave(res.data.id);
      }).catch(function(){ toast('Failed to save results to database','error'); });
    }
  }

  var myLobbyAuto=currentUser?lobbies.findIndex(function(lb){return lb.some(function(p){return p.name===currentUser.username;});}): -1;
  var effectiveHighlight=highlightLobby!==null?highlightLobby:myLobbyAuto>=0?myLobbyAuto:null;

  var isLive=tournamentState.phase==="inprogress"||tournamentState.phase==="live";
  var phaseLabel=isLive?"Live":tournamentState.phase==="complete"?"Complete":tournamentState.phase==="checkin"?"Check-in":"Setup";
  var totalGames=tournamentState.totalGames||4;
  var clashName=(tournamentState&&tournamentState.clashName)||"TFT Clash";
  var lockedCount=lockedLobbies.length;
  var survivingCount=checkedIn.length;

  var lobbyLetters=["A","B","C","D","E","F","G","H","I","J"];

  // ── Live lobby management (admin) ───────────────────────────────────────────
  // All three operate on savedLobbies (the persisted id-arrays that drive both
  // the lobby grid and the OBS overlay). Blocked while any lobby is locked so we
  // never re-key locked placements onto a different roster.
  function lobbyIdMatrix(){
    return lobbies.map(function(l){return l.map(function(p){return p.id;});});
  }

  function movePlayerToLobby(pid,toIdx){
    if(lockedCount>0){toast("Unlock all lobbies before moving players","error");return;}
    var arr=lobbyIdMatrix();
    var fromIdx=-1;
    arr.forEach(function(l,i){if(l.indexOf(pid)>=0)fromIdx=i;});
    if(fromIdx<0||fromIdx===toIdx)return;
    var pname=((lobbies[fromIdx]||[]).find(function(p){return p.id===pid;})||{}).name||"Player";
    arr=arr.map(function(l){return l.filter(function(id){return id!==pid;});});
    while(arr.length<=toIdx)arr.push([]);
    arr[toIdx].push(pid);
    setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:arr});});
    toast(pname+" moved to Lobby "+(lobbyLetters[toIdx]||(toIdx+1)),"success");
  }

  function markNoShow(player){
    if(lockedCount>0){toast("Unlock all lobbies before removing players","error");return;}
    if(!player||!player.id)return;
    var pid=player.id;
    setPlayers(function(ps){return ps.map(function(p){return p.id===pid?Object.assign({},p,{checkedIn:false}):p;});});
    setTournamentState(function(ts){
      var base=(ts.savedLobbies&&ts.savedLobbies.length)?ts.savedLobbies:lobbyIdMatrix();
      var arr=base.map(function(l){return l.filter(function(id){return id!==pid;});});
      var cids=(ts.checkedInIds||[]).filter(function(id){return String(id)!==String(pid);});
      return Object.assign({},ts,{savedLobbies:arr,checkedInIds:cids});
    });
    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('registrations').update({status:'registered'})
        .eq('tournament_id',tournamentState.dbTournamentId).eq('player_id',pid)
        .then(function(){}).catch(function(e){ console.error('[BracketScreen] no-show DB op failed:', e); });
    }
    toast((player.name||"Player")+" marked no-show, removed from lobby","info");
  }

  function rebalanceLobbies(){
    if(lockedCount>0){toast("Unlock all lobbies before rebalancing","error");return;}
    var arr=lobbyIdMatrix().filter(function(l){return l.length>0;});
    if(arr.length<2){toast("Need at least two lobbies to rebalance","error");return;}
    var guard=0;
    while(guard++<1000){
      var sizes=arr.map(function(l){return l.length;});
      var maxV=Math.max.apply(null,sizes);
      var minV=Math.min.apply(null,sizes);
      if(maxV-minV<=1)break;
      arr[sizes.indexOf(minV)].push(arr[sizes.indexOf(maxV)].pop());
    }
    setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:arr});});
    toast("Lobbies rebalanced to even sizes","success");
  }

  // Push the broadcast spotlight selection to the OBS overlay via site_settings.
  // playerId null = clear (overlay auto-rotates through the top players).
  function castSpotlight(playerId){
    var payload={spotlightPlayerId:playerId||null,mode:playerId?"manual":"auto",updatedAt:Date.now()};
    if(!supabase.from){toast("Overlay update failed","error");return;}
    supabase.from('site_settings').upsert({key:'broadcast_control',value:JSON.stringify(payload),updated_at:new Date().toISOString()})
      .then(function(res){
        if(res&&res.error){toast("Overlay update failed: "+res.error.message,"error");return;}
        toast(playerId?"Spotlight updated on stream":"Spotlight set to auto-rotate","success");
      }).catch(function(e){ console.error('[BracketScreen] spotlight op failed:', e); toast("Overlay update failed","error"); });
  }

  return(
    <PageLayout>
      <div className="max-w-7xl mx-auto">

        {/* Finalize confirm modal */}
        {showFinalizeConfirm&&(
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[1003] p-4">
            <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl w-full max-w-md p-7">
              <div className="text-center mb-5">
                <div className="mb-3 flex justify-center">
                  <Icon name="emoji_events" size={48} fill className="text-primary" />
                </div>
                <h3 className="text-on-surface text-xl font-bold mb-2">Finalize This Clash?</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mb-2">
                  {"This will end the tournament and post final results. All " + checkedIn.length + " players will receive their season points."}
                </p>
                <p className="text-primary text-xs font-bold">This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={function(){setShowFinalizeConfirm(false);}}
                  className="px-5 py-2.5 bg-surface-container-high text-on-surface font-label font-bold text-xs tracking-widest uppercase rounded hover:bg-surface-container-highest transition-colors">
                  Cancel
                </button>
                <button
                  onClick={function(){
                    setShowFinalizeConfirm(false);
                    saveResultsToSupabase(playersRef.current,currentClashId,checkmateWinner?checkmateWinner.winnerId:null);
                    setTournamentState(function(ts){return Object.assign({},ts,{phase:"complete",lockedLobbies:[],savedLobbies:[]});});
                    toast(checkmateWinnerPlayer?("Checkmate! "+checkmateWinnerPlayer.name+" is champion"):"Clash complete! View results","success");
                  }}
                  className="px-5 py-2.5 bg-primary text-on-primary font-label font-bold text-xs tracking-widest uppercase rounded shadow-lg shadow-primary/20 hover:brightness-110 transition-all">
                  Finalize Clash
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checkmate finals banner */}
        {isCheckmate&&isLive&&(checkmateWinner?(
          <div className="mb-6 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-5 py-4 flex items-center gap-4">
            <Icon name="military_tech" size={32} fill className="text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-display text-xl md:text-2xl text-primary uppercase tracking-tight truncate">
                {"Checkmate · " + (checkmateWinnerPlayer?checkmateWinnerPlayer.name:"Winner") + " takes it"}
              </div>
              <div className="text-xs text-on-surface-variant/80 font-mono">
                {"Won game " + checkmateWinner.winningGame + " at " + checkmateWinner.points + " finals pts (threshold " + finalsThreshold + "). " + (isAdmin?"Click Crown · Finalize to lock it in.":"Awaiting host to finalize.")}
              </div>
            </div>
          </div>
        ):lobbies.length===1?(
          <div className="mb-6 rounded-xl border border-tertiary/30 bg-tertiary/5 px-5 py-3 flex items-center gap-3">
            <Icon name="swords" size={20} className="text-tertiary flex-shrink-0" />
            <div className="text-xs md:text-sm text-on-surface-variant/85 font-mono">
              {"Checkmate finals — first to WIN a game at " + finalsThreshold + "+ finals points is champion. Keep playing until someone clinches."}
            </div>
          </div>
        ):null)}

        {/* Admin next-step hint */}
        {isAdmin&&isLive&&(
          <div className="mb-6 rounded-lg border border-secondary/25 bg-secondary/5 px-4 py-2.5 flex items-center gap-3 flex-wrap">
            <Icon name="bolt" size={16} className="text-secondary flex-shrink-0" />
            <span className="text-[10px] font-label tracking-widest uppercase text-secondary/80">Next step</span>
            <span className="text-xs text-on-surface-variant/85 font-mono">
              {isCheckmate&&checkmateWinner
                ? ("Champion detected - click \"Crown " + (checkmateWinnerPlayer?checkmateWinnerPlayer.name:"Winner") + "\" to finalize")
                : !allLocked
                  ? ("Enter results, then lock every lobby (" + (lockedLobbies||[]).length + "/" + lobbies.length + " locked)")
                  : (isCheckmate&&lobbies.length===1)
                    ? "All locked - play the next finals game, or finalize once someone clinches"
                    : round>=(tournamentState.totalGames||4)
                      ? "All locked - finalize the clash to post results"
                      : ("All locked - advance to Game " + (round+1))}
            </span>
          </div>
        )}

        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl text-on-background mb-2 uppercase tracking-tight">
              <span className="text-on-surface-variant/80">
                {clashName.includes(":")
                  ? clashName.split(":")[0]
                  : "TFT Clash"
                }
              </span>
              <span className="text-on-surface-variant/40 mx-2">/</span>
              <span className="text-primary">
                {clashName.includes(":")
                  ? clashName.split(":").slice(1).join(":").trim()
                  : clashName
                }
              </span>
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <span className={"px-3 py-1 rounded font-label text-xs tracking-wider border " + (isLive?"bg-tertiary/10 text-tertiary border-tertiary/20":tournamentState.phase==="complete"?"bg-primary/10 text-primary border-primary/20":"bg-secondary/10 text-secondary border-secondary/20")}>
                {isLive?"ACTIVE TOURNAMENT":tournamentState.phase==="complete"?"COMPLETE":tournamentState.phase==="checkin"?"CHECK-IN OPEN":"SETUP"}
              </span>
              <div className="flex items-center gap-2 text-on-surface-variant/60 font-mono text-sm">
                <Icon name="calendar_today" size={14} />
                {"Game " + round + " of " + totalGames + " - " + checkedIn.length + " players"}
              </div>
            </div>
          </div>

          {/* Admin phase controls */}
          {isAdmin&&(
            <div className="bg-surface-container-low p-2 rounded-xl border border-outline-variant/10 flex gap-2 flex-wrap">
              <button
                disabled={round<=1}
                onClick={function(){setTournamentState(function(ts){return Object.assign({},ts,{round:ts.round-1,lockedLobbies:[],savedLobbies:[]});});}}
                className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-xs font-bold font-label uppercase tracking-widest opacity-40 hover:opacity-70 disabled:pointer-events-none transition-opacity">
                Prev Round
              </button>
              <button
                disabled={!allLocked&&!(isCheckmate&&checkmateWinner)}
                onClick={function(){
                  var maxRounds=tournamentState.totalGames||4;
                  // Checkmate: a clinched winner -> finalize; otherwise keep
                  // playing finals games even past the nominal count.
                  if(isCheckmate&&checkmateWinner){setShowFinalizeConfirm(true);}
                  else if(isCheckmate&&lobbies.length===1){performRoundAdvance(false);}
                  else if(round>=maxRounds){setShowFinalizeConfirm(true);}
                  else{performRoundAdvance(false);}
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold font-label uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none transition-all hover:brightness-110">
                {isCheckmate&&checkmateWinner
                  ?("Crown "+(checkmateWinnerPlayer?checkmateWinnerPlayer.name:"Winner")+" · Finalize")
                  :isCheckmate&&lobbies.length===1
                    ?"Next Finals Game"
                    :round>=(tournamentState.totalGames||4)?"Finalize Clash":"Next Game"}
              </button>
              {allLocked&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<totalGames&&(
                <button
                  onClick={cancelAutoAdvance}
                  className="px-4 py-2 rounded-lg bg-surface-container-high text-error text-xs font-bold font-label uppercase tracking-widest border border-error/20 hover:bg-error/10 transition-colors">
                  {"Cancel Auto (" + autoAdvanceCountdown + "s)"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* All lobbies locked banner */}
        {allLocked&&checkedIn.length>0&&(
          <div className="mb-6 bg-tertiary/8 border border-tertiary/25 rounded-lg px-5 py-3 flex items-center gap-3">
            <Icon name="check_circle" size={18} fill className="text-tertiary" />
            <span className="text-tertiary font-label font-bold text-sm tracking-wider flex-1">
              {"All " + lobbies.length + " lobbies locked - " + (round>=(totalGames)?"ready to finalize!":"ready for next game!")}
              {isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<totalGames?" Auto-advancing in "+autoAdvanceCountdown+"s...":""}
            </span>
          </div>
        )}

        {/* Cut line / eliminated players banner */}
        {tournamentState.eliminatedIds&&tournamentState.eliminatedIds.length>0&&isLive&&(
          <div className="mb-6 bg-error/8 border border-error/25 rounded-lg px-5 py-4">
            <div className="flex items-center gap-3 mb-2">
              <Icon name="content_cut" size={18} className="text-error" />
              <span className="text-error font-label font-bold text-sm tracking-wider">
                {"Cut after Game " + (tournamentState.cutAfterGame||4) + " - " + tournamentState.eliminatedIds.length + " players eliminated (below " + (tournamentState.cutLine||0) + " pts)"}
              </span>
            </div>
            <div className="text-on-surface-variant/50 text-xs leading-relaxed">
              {survivingCount + " players remain across " + lobbies.length + " lobbies for the final " + (totalGames - round + 1) + " games"}
            </div>
          </div>
        )}

        {/* Bracket Sponsors */}
        <div className="mb-6">
          <SponsorShowcase placement="bracket" variant="strip" />
        </div>

        {tournamentState&&tournamentState.phase==="complete"&&checkedIn.length>0&&(
          <div className="mb-6 bg-primary/8 border border-primary/30 rounded-lg px-5 py-4 flex items-center gap-4">
            <Icon name="emoji_events" size={24} fill className="text-primary" />
            <div className="flex-1">
              <div className="font-bold text-primary text-base mb-0.5">Clash Complete!</div>
              <div className="text-on-surface-variant text-sm">All rounds locked. View final standings on the Leaderboard.</div>
            </div>
            <Btn variant="primary" size="sm" onClick={function(){navigate("/leaderboard");}}>
              View Results
            </Btn>
          </div>
        )}

        {/* Empty state */}
        {checkedIn.length===0&&(
          <div className="text-center py-20">
            <div className="flex justify-center mb-4">
              <Icon name={tournamentState&&tournamentState.phase==="complete"?"emoji_events":tournamentState&&isLive?"bolt":"sports_esports"} size={56} className="text-on-surface-variant/30" />
            </div>
            <h3 className="text-on-surface text-xl font-bold mb-2">
              {tournamentState&&tournamentState.phase==="complete"?"Tournament Complete":tournamentState&&isLive?"Waiting for Players":"No Active Tournament"}
            </h3>
            <p className="text-on-surface-variant text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              {tournamentState&&tournamentState.phase==="complete"?"The last tournament has been finalized. Check Results for the full breakdown.":tournamentState&&isLive?"Players need to check in to join the bracket.":"No tournament is running right now. Check back when the next clash is announced!"}
            </p>
            <div className="flex gap-3 justify-center">
              <Btn variant="primary" size="sm" onClick={function(){navigate("/");}}>
                Back to Home
              </Btn>
              {tournamentState&&tournamentState.phase==="complete"&&(
                <Btn variant="secondary" size="sm" onClick={function(){navigate("/results");}}>
                  View Results
                </Btn>
              )}
            </div>
          </div>
        )}

        {checkedIn.length>0&&(
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left column: Status + controls */}
            <div className="lg:col-span-4 space-y-5">

              {/* Live status card */}
              <div className="bg-surface-container-low rounded-lg border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className={"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 " + (isLive?"bg-tertiary":tournamentState.phase==="complete"?"bg-primary":"bg-secondary")}></span>
                    <span className={"relative inline-flex rounded-full h-2.5 w-2.5 " + (isLive?"bg-tertiary":tournamentState.phase==="complete"?"bg-primary":"bg-secondary")}></span>
                  </span>
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
                    {isLive?"Live · Round "+round+" of "+totalGames:tournamentState.phase==="complete"?"Complete":tournamentState.phase==="checkin"?"Check-in":"Setup"}
                  </span>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-surface-container-low border-outline-variant/15 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="groups" size={14} className="text-on-surface-variant/50" />
                        <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant/60">Lobbies</span>
                      </div>
                      <div className="font-display text-2xl tabular-nums text-on-surface">{lobbies.length}</div>
                    </div>
                    <div className="rounded-lg border bg-surface-container-low border-outline-variant/15 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="person" size={14} className="text-on-surface-variant/50" />
                        <span className="font-label text-[10px] tracking-widest uppercase text-on-surface-variant/60">Players</span>
                      </div>
                      <div className="font-display text-2xl tabular-nums text-on-surface">{checkedIn.length}</div>
                    </div>
                  </div>

                  {lobbies.length>0&&isLive&&(
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-label text-on-surface-variant/50 uppercase tracking-wider">Lobbies Locked</span>
                        <span className={"text-xs font-mono font-bold " + (allLocked?"text-tertiary":"text-primary")}>{lockedCount+"/"+lobbies.length}</span>
                      </div>
                      <div className="w-full bg-surface-container-lowest rounded-full h-1.5 overflow-hidden">
                        <div
                          className={"h-full rounded-full transition-all duration-500 " + (allLocked?"bg-tertiary":"bg-primary")}
                          style={{width:Math.round(lockedCount/lobbies.length*100)+"%"}}>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Find my lobby */}
              <div className="bg-surface-container-low rounded-lg border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="search" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Find Your Lobby</span>
                </div>
                <div className="p-5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mySearch}
                      onChange={function(e){setMySearch(e.target.value);}}
                      onKeyDown={function(e){if(e.key==="Enter")findMyLobby();}}
                      placeholder="Your name or Riot ID"
                      className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded text-sm text-on-surface placeholder:text-on-surface-variant/30 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary" />
                    <button
                      onClick={findMyLobby}
                      className="px-4 py-2 bg-secondary-container text-on-secondary-container font-label font-bold text-xs tracking-widest uppercase rounded hover:brightness-110 transition-all">
                      Find
                    </button>
                  </div>
                  {effectiveHighlight!==null&&(
                    <div className="mt-3 flex items-center gap-2 text-tertiary text-sm font-semibold">
                      <Icon name="location_on" size={14} fill />
                      {"You are in Lobby " + (effectiveHighlight+1)}
                    </div>
                  )}
                </div>
              </div>

              {/* Round progress */}
              <div className="bg-surface-container-low rounded-lg border border-outline-variant/15 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                  <Icon name="timeline" size={18} className="text-primary" />
                  <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">Round Progress</span>
                </div>
                <div className="p-5 space-y-2">
                  {Array.from({length:totalGames},function(_,idx){return idx+1;}).map(function(r){
                    var isComplete=r<round;
                    var isCurrent=r===round;
                    return(
                      <div key={r}
                        onClick={isComplete?function(){setViewingRound(viewingRound===r?null:r);}:undefined}
                        className={"flex items-center gap-3 px-3 py-2.5 rounded border transition-colors " + (isComplete?"bg-tertiary/5 border-tertiary/20 cursor-pointer hover:bg-tertiary/10":isCurrent?"bg-primary/8 border-primary/30":"bg-surface-container-lowest/50 border-outline-variant/8")}>
                        <div className={"w-6 h-6 rounded flex items-center justify-center flex-shrink-0 " + (isComplete?"bg-tertiary/20":isCurrent?"bg-primary/20":"bg-surface-container-high")}>
                          {isComplete
                            ? <Icon name="check" size={14} className="text-tertiary" />
                            : isCurrent
                              ? <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>
                              : <span className="font-mono text-[10px] text-on-surface-variant/30 font-bold">{r}</span>
                          }
                        </div>
                        <div className="flex-1">
                          <div className={"text-xs font-label font-bold uppercase tracking-widest " + (isComplete?"text-tertiary":isCurrent?"text-primary":"text-on-surface-variant/40")}>
                            {"Round " + r}
                          </div>
                        </div>
                        <div className={"text-[10px] font-mono font-bold flex items-center gap-1 " + (isComplete?"text-tertiary":isCurrent?"text-primary":"text-on-surface-variant/30")}>
                          {isComplete?"Done":isCurrent?"Active":"Soon"}
                          {isComplete&&<Icon name={viewingRound===r?"expand_less":"expand_more"} size={14} className="text-tertiary/60" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Past round results panel - lobby grouped */}
                {viewingRound!==null&&(function(){
                  var rh=tournamentState.roundHistory||{};
                  var pastPlacements=rh[viewingRound]||tournamentState.lockedPlacements||{};

                  // Use stored lobbies for past rounds (pre-cut rosters) or current lobbies
                  var rl=tournamentState.roundLobbies||{};
                  var viewLobbies=rl[viewingRound]||lobbies;

                  // Calculate cumulative points per player up to and including viewed round
                  var allPlayers=players||[];
                  var cumulativeMap={};
                  allPlayers.forEach(function(p){
                    var total=0;
                    (p.clashHistory||[]).forEach(function(h){
                      if(h.clashId===currentClashId&&h.round<=viewingRound){
                        total+=(PTS[h.place||h.placement]||0);
                      }
                    });
                    cumulativeMap[String(p.id)]=total;
                  });

                  // Build per-lobby results
                  var lobbyGroups=[];
                  viewLobbies.forEach(function(lobby,li){
                    if(!pastPlacements[li])return;
                    var lpPlayers=[];
                    lobby.forEach(function(p){
                      var pid=String(p.id);
                      var place=pastPlacements[li][pid]||pastPlacements[li][p.id];
                      if(place){
                        var gained=PTS[place]||0;
                        var cumulative=cumulativeMap[pid]||gained;
                        lpPlayers.push({id:pid,name:p.name||p.username,rank:p.rank,riotId:p.riotId||p.riot_id_eu||"",placement:place,gained:gained,total:cumulative});
                      }
                    });
                    lpPlayers.sort(function(a,b){return a.placement-b.placement;});
                    if(lpPlayers.length>0)lobbyGroups.push({idx:li,players:lpPlayers});
                  });

                  if(lobbyGroups.length===0)return null;
                  return(
                    <div className="mt-3 bg-surface-container-lowest rounded-lg border border-tertiary/15 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-tertiary/10 flex items-center justify-between">
                        <span className="font-label text-xs font-bold uppercase tracking-widest text-tertiary">{"Round " + viewingRound + " Results"}</span>
                        <button type="button" aria-label="Close round results" onClick={function(){setViewingRound(null);}} className="text-on-surface-variant/40 hover:text-on-surface bg-transparent border-0 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                          <Icon name="close" size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto">
                        {lobbyGroups.map(function(lg){
                          return(
                            <div key={lg.idx}>
                              <div className="px-4 py-2 bg-surface-container-low/50 border-b border-outline-variant/10 flex items-center gap-2">
                                <Icon name="groups" size={14} className="text-on-surface-variant/40" />
                                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">{"Lobby " + String.fromCharCode(65+lg.idx)}</span>
                              </div>
                              <div className="divide-y divide-outline-variant/5">
                                {lg.players.map(function(r,ri){
                                  return(
                                    <div key={r.id} className={"flex items-center gap-3 px-4 py-2 " + (ri===0?"bg-primary/5":"")}>
                                      <span className={"font-mono text-xs font-bold min-w-[20px] text-center " + (ri===0?"text-primary":ri<=2?"text-tertiary":"text-on-surface-variant/40")}>
                                        {"#"+r.placement}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className={"text-sm truncate " + (ri===0?"text-primary font-bold":"text-on-surface")}>{r.name}</span>
                                          {ri===0&&<span className="text-[8px] font-label font-bold tracking-wider uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">HOST</span>}
                                        </div>
                                        {r.riotId&&<div className="text-[10px] text-on-surface-variant/30 truncate">{r.riotId}</div>}
                                      </div>
                                      <span className="text-[10px] text-on-surface-variant/30 font-label uppercase">{r.rank}</span>
                                      <span className="font-mono text-xs text-tertiary font-bold">{r.total+" pts"}</span>
                                      <span className="font-mono text-[10px] text-tertiary/60">{"+"+r.gained}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Admin quick actions */}
              {isAdmin&&(
                <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                    <Icon name="admin_panel_settings" size={18} className="text-error/70" />
                    <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface-variant/70">Admin Quick Actions</span>
                  </div>
                  <div className="p-5 space-y-2">
                    <button
                      onClick={function(){setManageMode(function(m){return !m;});}}
                      className={"w-full text-left p-3 transition-colors flex items-center justify-between group rounded " + (manageMode?"bg-secondary/10":"hover:bg-surface-container-low")}>
                      <span className="text-sm font-medium text-on-surface">
                        {manageMode?"Hide Lobby Manager":"Manage Lobbies"}
                        <span className="text-[10px] text-on-surface-variant/50 font-label ml-2">no-shows / move / rebalance</span>
                      </span>
                      <Icon name="tune" size={18} className={"transition-colors " + (manageMode?"text-secondary":"text-on-surface-variant group-hover:text-secondary")} />
                    </button>
                    <button
                      disabled={lockedCount>0}
                      onClick={function(){
                        // Re-rolling after any lobby is locked would re-key lockedPlacements
                        // (indexed by lobby position) onto a different roster, garbling locked
                        // results. Block it until locks are cleared (unlock or advance round).
                        if(lockedCount>0){toast("Unlock all lobbies before re-rolling","error");return;}
                        setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:[]});});
                        toast("Lobbies re-rolled!","success");
                      }}
                      className="w-full text-left p-3 hover:bg-surface-container-low transition-colors flex items-center justify-between group rounded disabled:opacity-40 disabled:pointer-events-none">
                      <span className="text-sm font-medium text-on-surface">
                        Re-roll Lobbies
                        {lockedCount>0&&<span className="text-[10px] text-on-surface-variant/50 font-label ml-2">(unlock first)</span>}
                      </span>
                      <Icon name="shuffle" size={18} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                    </button>
                    {isLive&&round>=(tournamentState.totalGames||4)&&(
                      <button
                        onClick={function(){setShowFinalizeConfirm(true);}}
                        className="w-full text-left p-3 hover:bg-surface-container-low transition-colors flex items-center justify-between group rounded">
                        <span className="text-sm font-medium text-error">Finalize Tournament</span>
                        <Icon name="emoji_events" size={18} fill className="text-error opacity-60" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Broadcast Studio (OBS overlay control) */}
              {isAdmin&&(
                <BroadcastStudioCard
                  checkedIn={checkedIn}
                  origin={typeof window!=="undefined"?window.location.origin:""}
                  toast={toast}
                  onCast={castSpotlight}
                />
              )}

              {/* Live standings */}
              {tournamentState&&isLive&&(
                <LiveStandingsPanel checkedIn={checkedIn} tournamentState={tournamentState} lobbies={lobbies} round={round} liveResults={liveResults} currentUser={currentUser} isCheckmate={isCheckmate} checkmate={checkmate} finalsThreshold={finalsThreshold}/>
              )}

              {/* Finals display */}
              {round>3&&checkedIn.length>0&&(
                <div className="bg-surface-container-low rounded-lg p-6 text-center border border-primary/20">
                  <div className="flex justify-center mb-3">
                    <Icon name="emoji_events" size={40} fill className="text-primary" />
                  </div>
                  <h3 className="text-primary text-lg font-display uppercase tracking-widest mb-2">Grand Finals</h3>
                  <p className="text-on-surface-variant text-sm">All rounds complete. Finals results locked in.</p>
                </div>
              )}
            </div>

            {/* Right column: Lobby grid */}
            <div className="lg:col-span-8">
              {isAdmin&&manageMode&&(
                <LobbyManagerPanel
                  lobbies={lobbies}
                  lobbyLetters={lobbyLetters}
                  lockedCount={lockedCount}
                  onMove={movePlayerToLobby}
                  onNoShow={markNoShow}
                  onRebalance={rebalanceLobbies}
                  onReroll={function(){
                    if(lockedCount>0){toast("Unlock all lobbies before re-rolling","error");return;}
                    setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:[]});});
                    toast("Lobbies re-rolled!","success");
                  }}
                  onClose={function(){setManageMode(false);}}
                />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {lobbies.map(function(lobby,li){
                  var isMyLobby=effectiveHighlight===li;
                  var locked=lockedLobbies.includes(li);
                  var lobbyLetter=lobbyLetters[li]||String(li+1);
                  var hasPlacements=placementEntry[li]&&placementEntry[li].open;
                  var lobbyMeta=getLobbyMeta(li);
                  var lobbyCode=lobbyMeta&&lobbyMeta.lobby_code;

                  return(
                    <div key={li} className={"bg-surface-container-high rounded-lg overflow-hidden border-2 transition-all " + (isMyLobby?"border-secondary shadow-[0_0_30px_rgba(217,185,255,0.08)]":locked?"border-tertiary/30":"border-outline-variant/15")}>

                      {/* Lobby header */}
                      <div className={"px-3 py-2 sm:px-4 sm:py-3 flex justify-between items-center border-b " + (isMyLobby?"bg-secondary/10 border-secondary/20":locked?"bg-tertiary/5 border-tertiary/15":"bg-surface-container border-outline-variant/10")}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={"font-display text-sm sm:text-base " + (isMyLobby?"text-secondary":locked?"text-tertiary":"text-on-surface-variant/80")}>
                            {"LOBBY " + lobbyLetter}
                          </span>
                          {isMyLobby&&(
                            <span className="bg-secondary/20 text-[10px] text-secondary px-2 py-0.5 rounded font-label font-bold tracking-tighter">YOUR LOBBY</span>
                          )}
                          {locked&&!isMyLobby&&(
                            <span className="bg-tertiary/10 text-[10px] text-tertiary px-2 py-0.5 rounded font-label font-bold tracking-tighter flex items-center gap-1">
                              <Icon name="lock" size={10} fill />
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {lobbyCode&&(
                            <button
                              type="button"
                              onClick={function(e){e.stopPropagation();navigator.clipboard.writeText(lobbyCode);toast("Copied lobby code","success");}}
                              className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5 tracking-widest hover:bg-primary/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                              aria-label={"Copy code for Lobby " + lobbyLetter}
                              title="Click to copy">
                              {lobbyCode}
                            </button>
                          )}
                          <span className={"font-mono text-xs " + (lobby.length!==8?"text-amber-400":"text-on-surface-variant/40")} title={lobby.length!==8?"Lobby is not 8 players":undefined}>{lobby.length + " players"}</span>
                          {locked&&isAdmin&&(
                            <button
                              onClick={function(){unlockLobby(li);}}
                              className="text-[10px] text-error font-bold font-label cursor-pointer bg-error/8 border border-error/25 rounded px-2 py-0.5 hover:bg-error/15 transition-colors">
                              Unlock
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Player list */}
                      <div className="divide-y divide-outline-variant/10">
                        {lobby.slice().sort(function(a,b){return b.pts-a.pts;}).map(function(p,pi){
                          var isMe=currentUser&&p.name===currentUser.username;

                          return(
                            <div
                              key={p.id}
                              onClick={function(){setProfilePlayer(p);navigate("/player/"+p.name);}}
                              className={"flex items-center justify-between px-3 py-2 sm:px-4 hover:bg-surface-container-highest transition-colors cursor-pointer " + (isMe?"bg-secondary/5":"")}>
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <span className={"font-mono text-xs " + (pi===0?"text-primary":pi===1?"text-on-surface-variant/60":pi===2?"text-on-surface-variant/50":"text-on-surface-variant/30")}>
                                  {String(pi+1).padStart(2,"0")}
                                </span>
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-surface-container-low flex items-center justify-center flex-shrink-0">
                                  <Icon name="person" size={16} className="text-on-surface-variant/40" />
                                </div>
                                <div className="min-w-0">
                                  <div className={"text-sm font-semibold flex items-center gap-1 truncate " + (isMe?"text-secondary":isMyLobby?"text-on-surface":"text-on-surface-variant/90")}>
                                    {p.name}
                                    {isHotStreak(p)&&<Icon name="local_fire_department" size={12} fill className="text-orange-400" />}
                                    {pi===0&&<span className="text-[8px] font-label font-bold tracking-wider uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">HOST</span>}
                                  </div>
                                  <div className="text-[10px] text-on-surface-variant/40">{p.rank}</div>
                                  {(p.riotId||p.riot_id_eu)&&<div className="flex items-center gap-1 max-w-[160px] sm:max-w-none">
                                    <span className="text-[10px] text-on-surface-variant/30 truncate">{p.riotId||p.riot_id_eu}</span>
                                    <button
                                      type="button"
                                      onClick={function(e){e.stopPropagation();navigator.clipboard.writeText(p.riotId||p.riot_id_eu||"");toast("Copied "+p.name+"'s Riot ID","success");}}
                                      className="text-on-surface-variant/25 hover:text-primary transition-colors flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                      aria-label={"Copy " + p.name + "'s Riot ID"}
                                      title="Copy Riot ID">
                                      <Icon name="content_copy" size={11} aria-hidden="true" />
                                    </button>
                                  </div>}
                                </div>
                              </div>
                              {/* Player placement controls */}
                              {locked&&tournamentState.lockedPlacements&&tournamentState.lockedPlacements[li]&&tournamentState.lockedPlacements[li][p.id]?(
                                <span className={"font-mono text-xs font-bold " + (tournamentState.lockedPlacements[li][p.id]===1?"text-primary":tournamentState.lockedPlacements[li][p.id]<=4?"text-tertiary":"text-on-surface-variant/50")}>
                                  {"#" + tournamentState.lockedPlacements[li][p.id]}
                                </span>
                              ):isMe&&!locked&&isLive?(
                                playerSubmissions[li]&&playerSubmissions[li][p.id]?(
                                  <div className="font-mono text-xs text-tertiary font-bold">
                                    {"#" + playerSubmissions[li][p.id].placement + " sub"}
                                  </div>
                                ):(
                                  <div onClick={function(e){e.stopPropagation();}}>
                                    <Sel value="" onChange={function(v){if(v)submitMyPlacement(li,p.id,p.name,v);}}>
                                      <option value="">{" - "}</option>
                                      {[1,2,3,4,5,6,7,8].map(function(n){return <option key={n} value={n}>{n}</option>;})}
                                    </Sel>
                                  </div>
                                )
                              ):(
                                <div className={"font-mono text-xs font-bold " + (locked?"text-on-surface-variant/20":"text-on-surface-variant/20")}>
                                  {isLive&&!locked?"In Progress":"-"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Admin lobby_code entry */}
                      {isAdmin&&!locked&&(
                        <div className="border-t border-outline-variant/10 p-3 bg-surface-container-low/40 flex gap-2 items-center">
                          <Icon name="vpn_key" size={14} className="text-on-surface-variant/50 flex-shrink-0" aria-hidden="true" />
                          <input
                            type="text"
                            placeholder={lobbyCode?"":"Enter custom lobby code"}
                            value={(lobbyCodeInputs[li]!==undefined)?lobbyCodeInputs[li]:(lobbyCode||"")}
                            onChange={function(e){var v=e.target.value;setLobbyCodeInputs(function(prev){var next=Object.assign({},prev);next[li]=v;return next;});}}
                            onKeyDown={function(e){if(e.key==='Enter'){saveLobbyCode(li,e.target.value);}}}
                            aria-label={"Lobby code for Lobby "+lobbyLetter}
                            className="flex-1 bg-surface-container-lowest border-b border-outline-variant/30 rounded-none text-sm text-on-surface font-mono tracking-widest placeholder:text-on-surface-variant/30 px-2 py-1.5 focus:outline-none focus:border-primary uppercase"
                          />
                          <button
                            type="button"
                            onClick={function(){saveLobbyCode(li,(lobbyCodeInputs[li]!==undefined)?lobbyCodeInputs[li]:(lobbyCode||""));}}
                            className="px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary font-label font-bold text-[10px] tracking-widest uppercase rounded hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                            Save
                          </button>
                          {lobbyCode&&(
                            <button
                              type="button"
                              onClick={function(){saveLobbyCode(li,"");}}
                              aria-label={"Clear code for Lobby "+lobbyLetter}
                              className="px-2 py-1.5 bg-on-surface/5 border border-outline-variant/20 text-on-surface/50 font-label text-[10px] uppercase rounded hover:bg-on-surface/10 hover:text-on-surface/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                              Clear
                            </button>
                          )}
                        </div>
                      )}

                      {/* Admin placement entry */}
                      {isAdmin&&!locked&&(
                        <div className="border-t border-outline-variant/10">
                          {!hasPlacements?(
                            <div className="p-4 bg-surface-container-low">
                              <button
                                onClick={function(){openPlacementEntry(li);}}
                                className="w-full py-2 bg-secondary text-on-secondary font-bold font-label text-xs rounded shadow-sm hover:brightness-110 transition-all uppercase tracking-widest">
                                {"Enter Placements" + (playerSubmissions[li]?" ("+Object.keys(playerSubmissions[li]).length+" submitted)":"")}
                              </button>
                            </div>
                          ):(
                            <div className="p-4 bg-secondary/3 border-t border-secondary/10">
                              <div className="text-[11px] font-label font-bold text-secondary/70 uppercase tracking-widest mb-3">
                                {"Enter Placements - Round " + round}
                              </div>
                              <div className="space-y-2 mb-3">
                                {lobby.slice().sort(function(a,b){return b.pts-a.pts;}).map(function(p){
                                  var dup=lobby.filter(function(x){return placementEntry[li].placements[x.id]===placementEntry[li].placements[p.id];}).length>1;
                                  var wasSelfSubmitted=((playerSubmissions||{})[li]||{})[p.id];
                                  return(
                                    <div key={p.id} className="flex items-center gap-2">
                                      <span className="text-sm text-on-surface flex-1 truncate">
                                        {p.name}
                                        {wasSelfSubmitted&&<span className="text-[9px] text-tertiary font-bold ml-1">SELF</span>}
                                      </span>
                                      <Sel
                                        value={placementEntry[li].placements[p.id]||"1"}
                                        onChange={function(v){setPlace(li,p.id,v);}}
                                        className={dup?"ring-1 ring-error":""}>
                                        {[1,2,3,4,5,6,7,8].map(function(n){return <option key={n} value={n}>{n}</option>;})}
                                        <option value="0">DNP</option>
                                      </Sel>
                                    </div>
                                  );
                                })}
                              </div>
                              {!placementValid(li)&&(
                                <div className="text-xs text-error mb-2">Each placement must be unique (1-8)</div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  disabled={!placementValid(li)}
                                  onClick={function(){applyGameResults(li);}}
                                  className="flex-1 py-2 bg-tertiary text-on-tertiary font-label font-bold text-xs uppercase tracking-widest rounded disabled:opacity-40 disabled:pointer-events-none hover:brightness-110 transition-all">
                                  Confirm and Lock
                                </button>
                                <button
                                  onClick={function(){setPlacementEntry(function(pe){return Object.assign({},pe,{[li]:Object.assign({},pe[li],{open:false})});});}}
                                  className="px-4 py-2 bg-surface-container-high text-on-surface font-label font-bold text-xs uppercase tracking-widest rounded hover:bg-surface-container-highest transition-colors">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Locked overlay footer */}
                      {locked&&(
                        <div className="px-4 py-3 bg-tertiary/5 border-t border-tertiary/10 flex items-center justify-center gap-2">
                          <Icon name="lock" size={14} fill className="text-tertiary" />
                          <span className="text-xs font-label font-bold text-tertiary uppercase tracking-wider">Results Locked</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default memo(BracketScreen);
