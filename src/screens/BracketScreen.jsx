import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS } from '../lib/constants.js'
import { computeSeasonBonuses, getAttendanceStreak, isHotStreak, checkAchievements, syncAchievements } from '../lib/stats.js'
import { applyCutLine, computeTournamentStandings } from '../lib/tournament.js'
import { writeActivityEvent, createNotification } from '../lib/notifications.js'
import { Panel, Btn, Inp, Sel } from '../components/ui'
import Icon from '../components/ui/Icon.jsx'
import PageLayout from '../components/layout/PageLayout'
import SponsorShowcase from '../components/shared/SponsorShowcase'

// ── LiveStandingsPanel ─────────────────────────────────────────────────────────
function LiveStandingsPanel({checkedIn,tournamentState,lobbies,round}){
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
    <div className="mt-6 bg-surface-container-low rounded border border-outline-variant/15 overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-3">
        <Icon name="bar_chart" size={18} className="text-primary" />
        <span className="font-label font-bold text-sm tracking-widest uppercase text-on-surface">
          {"Live Standings - Game " + round + "/" + totalGames}
        </span>
        <span className="text-xs text-on-surface-variant/50 font-mono ml-auto">
          {"(" + lockedCount + "/" + lobbies.length + " locked)"}
        </span>
      </div>
      {showCutLine&&(
        <div className="px-5 py-2 bg-primary/5 border-b border-primary/15 text-xs text-primary font-label tracking-wider">
          {"Cut line: " + cutLine + " pts - players at or below are eliminated after Game " + cutAfterGame}
        </div>
      )}
      <div className="divide-y divide-outline-variant/5">
        {liveRows.map(function(row,ri){
          var isLeader=ri===0&&row.earned>0;
          var belowCut=showCutLine&&row.earned<=cutLine;
          var nearCut=showCutLine&&!belowCut&&row.earned<=cutLine+3;
          return(
            <div key={row.id} className={"flex items-center gap-3 px-5 py-2 " + (belowCut?"opacity-60 bg-error/5":isLeader?"bg-primary/5":"")}>
              <span className={"font-mono text-xs font-bold min-w-[22px] text-center " + (belowCut?"text-error":ri===0?"text-primary":ri===1?"text-on-surface-variant":ri===2?"text-on-surface-variant/70":"text-on-surface-variant/40")}>
                {ri+1}
              </span>
              <span className={"flex-1 text-sm " + (belowCut?"text-error":isLeader?"text-primary font-bold":"text-on-surface")}>
                {row.name}
              </span>
              {belowCut&&(
                <span className="text-[9px] font-bold font-label tracking-widest text-error bg-error/10 border border-error/25 px-1.5 py-0.5 rounded">CUT</span>
              )}
              {nearCut&&(
                <span className="text-[10px] font-bold font-label tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">BUBBLE</span>
              )}
              <span className={"font-mono text-xs font-bold " + (belowCut?"text-error":row.earned>0?"text-tertiary":"text-on-surface-variant/40")}>
                {row.earned>0?"+"+row.earned+" pts":"- pts"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BracketScreen ─────────────────────────────────────────────────────────────
function BracketScreen(){
  var ctx=useApp();
  var players=ctx.players;
  var playersRef=useRef(players);
  playersRef.current=players;
  var setPlayers=ctx.setPlayers;
  var toast=ctx.toast;
  var isAdmin=ctx.isAdmin;
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

  var _placementEntry=useState({});
  var placementEntry=_placementEntry[0];
  var setPlacementEntry=_placementEntry[1];

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
    var algo=(tournamentState&&tournamentState.seedAlgo)||"rank-based";
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
    var valid=vals.every(function(v){return v>=1&&v<=8;});
    var unique=new Set(vals).size===vals.length;
    return valid&&unique;
  }

  function applyGameResults(li){
    var lobby=lobbies[li];
    if(!placementEntry[li])return;
    var placements={};
    lobby.forEach(function(p){placements[p.id]=parseInt(placementEntry[li].placements[p.id]||"0");});
    var allClashIds=pastClashes.map(function(c){return "c"+c.id;});

    setPlayers(function(prev){return prev.map(function(p){
      var place=placements[p.id];
      if(place===undefined)return p;
      var earned=PTS[place]||0;
      var bonuses=computeSeasonBonuses(p,currentClashId,allClashIds,seasonConfig);
      var totalEarned=earned+(bonuses.bonusPts||0);
      var newGames=(p.games||0)+1;
      var newWins=(p.wins||0)+(place===1?1:0);
      var newTop4=(p.top4||0)+(place<=4?1:0);
      var newPts=(p.pts||0)+totalEarned;
      var newAvg=(((parseFloat(p.avg)||0)*(p.games||0)+place)/newGames).toFixed(2);
      var newHistory=[...(p.clashHistory||[]),{round:round,place:place,pts:earned,clashId:currentClashId,bonusPts:bonuses.bonusPts||0,comebackTriggered:bonuses.comebackTriggered,attendanceMilestone:bonuses.attendanceMilestone}];
      var newSparkline=[...(p.sparkline||[p.pts]),newPts];
      var newStreak=place<=4?(p.currentStreak||0)+1:0;
      var bestStreak=Math.max(p.bestStreak||0,newStreak);
      var newAttendanceStreak=getAttendanceStreak(p,allClashIds.concat([currentClashId]));
      return Object.assign({},p,{pts:newPts,wins:newWins,top4:newTop4,games:newGames,avg:newAvg,
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

    function rollbackLock(){
      setTournamentState(function(ts){
        return Object.assign({},ts,{
          lockedLobbies:(ts.lockedLobbies||[]).filter(function(x){return x!==li;}),
          lockedPlacements:Object.keys(ts.lockedPlacements||{}).reduce(function(acc,k){if(String(k)!==String(li))acc[k]=ts.lockedPlacements[k];return acc;},{})
        });
      });
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
        var place=parseInt(placementEntry[li].placements[p.id]||"0");
        if(place>0)gameRows.push({tournament_id:dbTid,round_number:round,player_id:p.id,placement:place,points:PTS[place]||0,is_dnp:false,game_number:round});
      });
      if(gameRows.length>0){
        supabase.from('game_results').insert(gameRows).then(function(res){
          if(res.error){toast("Failed to save game results - please retry","error");rollbackLock();return;}
          lobby.forEach(function(lp){
              var place=parseInt(placementEntry[li].placements[lp.id]||"0");
              if(place<=0)return;
              var updatedP=playersRef.current.find(function(pp){return pp.id===lp.id;});
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
                if(pr.error)console.warn('Player stat update failed:',pr.error.message);
              }).catch(function(e){console.warn('Player stat update error:',e);});
            });
        }).catch(function(){ toast('Failed to save game results','error'); rollbackLock(); });
      }
    }

    // Notify the current player if their lobby was just locked
    var myLobby=currentUser?lobbies[li]&&lobbies[li].some(function(p){return p.name===currentUser.username;}):false;
    var myPlayer=myLobby?checkedIn.find(function(p){return p.name===currentUser.username;}):null;
    if(myPlayer){
      var myPlace=placements[myPlayer.id];
      var myPts=PTS[myPlace]||0;
      toast("Your results are in! You placed #"+myPlace+" (+"+myPts+"pts)","success");
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
      supabase.from('player_reports').upsert({
        tournament_id:tournamentState.dbTournamentId,
        lobby_id:null,
        game_number:round,
        player_id:playerId,
        reported_placement:p,
        reported_at:new Date().toISOString()
      },{onConflict:'tournament_id,game_number,player_id'}).then(function(r){
      }).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
    }
    toast("Placement submitted - waiting for admin confirmation","success");
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
      var lobbyPlayerIds=lobbies[li]?lobbies[li].map(function(p){return p.id;}):[];
      if(lobbyPlayerIds.length>0){
        supabase.from('game_results').delete()
          .eq('tournament_id',tournamentState.dbTournamentId)
          .eq('round_number',round)
          .in('player_id',lobbyPlayerIds)
          .then(function(res){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
      }
      supabase.from('lobbies').update({status:'active'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
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
          }).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
        });
      }
    }
    toast("Lobby "+(li+1)+" unlocked - results reverted","success");
  }

  var allLocked=lobbies.length>0&&lobbies.every(function(_,i){return lockedLobbies.includes(i);});

  // Auto-advance countdown when all lobbies locked
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
        if(c<=1){clearInterval(autoAdvanceRef.current);autoAdvanceRef.current=null;return 0;}
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
      setTournamentState(function(ts){
        var newRH=Object.assign({},ts.roundHistory||{});
        if(ts.lockedPlacements&&Object.keys(ts.lockedPlacements).length>0)newRH[round]=ts.lockedPlacements;
        var newRL=Object.assign({},ts.roundLobbies||{});
        newRL[round]=lobbies.map(function(lobby){return lobby.map(function(p){return {id:p.id,name:p.name,rank:p.rank,riotId:p.riotId||p.riot_id_eu||''};});});
        return Object.assign({},ts,{round:nextRound,lockedLobbies:[],savedLobbies:[],roundHistory:newRH,roundLobbies:newRL});
      });
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
      supabase.from('tournaments').update({phase:'complete',completed_at:new Date().toISOString()}).eq('id',tId)
        .then(function(r){}).catch(function(e){ console.error('[BracketScreen] DB op failed:', e); });
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
          if(r.error){toast("Failed to save player results","error");return;}
          allPlayers.forEach(function(p){
            if(p.authUserId){createNotification(p.authUserId,"Results Finalized",clashName+" results are in! Check the Results screen to see your placement and points.","trophy");}
          });
          var winnerRow=rows.reduce(function(best,row){return row.final_placement<best.final_placement?row:best;},rows[0]);
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
              supabase.from('players').update({
                season_pts:p.pts||0,wins:p.wins||0,top4:p.top4||0,games:p.games||0,
                avg_placement:parseFloat(parseFloat(p.avg||0).toFixed(2)),
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
                    saveResultsToSupabase(playersRef.current,currentClashId);
                    setTournamentState(function(ts){return Object.assign({},ts,{phase:"complete",lockedLobbies:[],savedLobbies:[]});});
                    toast("Clash complete! View results","success");
                  }}
                  className="px-5 py-2.5 bg-primary text-on-primary font-label font-bold text-xs tracking-widest uppercase rounded shadow-lg shadow-primary/20 hover:brightness-110 transition-all">
                  Finalize Clash
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1 className="font-editorial italic text-4xl md:text-5xl text-on-background mb-2">
              {clashName.includes(":")
                ? clashName.split(":")[0]+":"
                : "TFT Clash:"
              }
              {" "}
              <span className="text-primary not-italic font-display uppercase tracking-tight">
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
                disabled={!allLocked}
                onClick={function(){
                  var maxRounds=tournamentState.totalGames||4;
                  var cutL=tournamentState.cutLine||0;
                  var cutG=tournamentState.cutAfterGame||0;
                  if(round>=maxRounds){
                    setShowFinalizeConfirm(true);
                  }else{
                    var nextRound=round+1;
                    var cutMsg="";
                    if(cutL>0&&round===cutG){
                      var standings=computeTournamentStandings(checkedIn,[],null);
                      var cutResult=applyCutLine(standings,cutL,cutG);
                      var elimCount=cutResult.eliminated.length;
                      if(elimCount>0){
                        cutMsg=" - "+elimCount+" players eliminated (below "+cutL+"pts)";
                        cutResult.eliminated.forEach(function(ep){
                          setPlayers(function(ps){return ps.map(function(p){return p.id===ep.id?Object.assign({},p,{checkedIn:false}):p;});});
                        });
                        setTournamentState(function(ts){
                          var kept=(ts.checkedInIds||[]).filter(function(cid){return!cutResult.eliminated.some(function(e){return String(e.id)===String(cid);});});
                          return Object.assign({},ts,{checkedInIds:kept});
                        });
                      }
                    }
                    setTournamentState(function(ts){
                      // Save current round's placements and lobbies into history before advancing
                      var newRoundHistory=Object.assign({},ts.roundHistory||{});
                      if(ts.lockedPlacements&&Object.keys(ts.lockedPlacements).length>0){
                        newRoundHistory[round]=ts.lockedPlacements;
                      }
                      var newRoundLobbies=Object.assign({},ts.roundLobbies||{});
                      newRoundLobbies[round]=lobbies.map(function(lobby){
                        return lobby.map(function(p){return {id:p.id,name:p.name,rank:p.rank,riotId:p.riotId||p.riot_id_eu||''};});
                      });
                      return Object.assign({},ts,{round:nextRound,lockedLobbies:[],savedLobbies:[],roundHistory:newRoundHistory,roundLobbies:newRoundLobbies});
                    });
                    toast("Advanced to Game "+nextRound+cutMsg,"success");
                  }
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold font-label uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none transition-all hover:brightness-110">
                {round>=(tournamentState.totalGames||4)?"Finalize Clash":"Next Game"}
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
          <div className="mb-6 bg-tertiary/8 border border-tertiary/25 rounded px-5 py-3 flex items-center gap-3">
            <Icon name="check_circle" size={18} fill className="text-tertiary" />
            <span className="text-tertiary font-label font-bold text-sm tracking-wider flex-1">
              {"All " + lobbies.length + " lobbies locked - " + (round>=(totalGames)?"ready to finalize!":"ready for next game!")}
              {isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<totalGames?" Auto-advancing in "+autoAdvanceCountdown+"s...":""}
            </span>
          </div>
        )}

        {/* Cut line / eliminated players banner */}
        {tournamentState.eliminatedIds&&tournamentState.eliminatedIds.length>0&&isLive&&(
          <div className="mb-6 bg-error/8 border border-error/25 rounded px-5 py-4">
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
          <div className="mb-6 bg-primary/8 border border-primary/30 rounded px-5 py-4 flex items-center gap-4">
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
              <div className="bg-surface-container-low rounded p-6 border-l-4 border-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Icon name="sensors" size={56} />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="relative flex h-3 w-3">
                    <span className={"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 " + (isLive?"bg-error":tournamentState.phase==="complete"?"bg-tertiary":"bg-secondary")}></span>
                    <span className={"relative inline-flex rounded-full h-3 w-3 " + (isLive?"bg-error":tournamentState.phase==="complete"?"bg-tertiary":"bg-secondary")}></span>
                  </span>
                  <span className="font-display text-xl tracking-tighter">
                    {isLive?"LIVE - Round "+round+" of "+totalGames:tournamentState.phase==="complete"?"COMPLETE":tournamentState.phase==="checkin"?"CHECK-IN":"SETUP"}
                  </span>
                </div>
                <p className="text-on-surface-variant text-sm mb-5 leading-relaxed">
                  {isLive?"The arena is live. All lobbies have been synchronized. Placement data entry is now active for lobby admins.":tournamentState.phase==="complete"?"All rounds are locked. Final results have been recorded.":"Tournament is in setup or check-in phase. Players are joining the lobby."}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-lowest p-3 border border-outline-variant/10">
                    <div className="text-[10px] font-label text-on-surface-variant/60 uppercase mb-1">Lobbies</div>
                    <div className="font-mono text-lg font-bold text-primary">{lobbies.length}</div>
                  </div>
                  <div className="bg-surface-container-lowest p-3 border border-outline-variant/10">
                    <div className="text-[10px] font-label text-on-surface-variant/60 uppercase mb-1">Players</div>
                    <div className="font-mono text-lg font-bold text-tertiary">{checkedIn.length}</div>
                  </div>
                </div>

                {/* Lobby lock progress */}
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

              {/* Find my lobby */}
              <div className="bg-surface-container-low rounded p-5 border border-outline-variant/15">
                <h3 className="font-label text-sm font-bold tracking-widest uppercase mb-4 text-on-surface">Find Your Lobby</h3>
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

              {/* Round progress */}
              <div className="bg-surface-container-low rounded p-5 border border-outline-variant/15">
                <h3 className="font-label text-sm font-bold tracking-widest uppercase mb-4 text-on-surface">Round Progress</h3>
                <div className="space-y-2">
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
                    <div className="mt-3 bg-surface-container-lowest rounded border border-tertiary/15 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-tertiary/10 flex items-center justify-between">
                        <span className="font-label text-xs font-bold uppercase tracking-widest text-tertiary">{"Round " + viewingRound + " Results"}</span>
                        <button onClick={function(){setViewingRound(null);}} className="text-on-surface-variant/40 hover:text-on-surface bg-transparent border-0 cursor-pointer">
                          <Icon name="close" size={14} />
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
                <div className="bg-surface-container-lowest border border-outline-variant/15 p-5 rounded">
                  <h3 className="font-label text-sm font-bold tracking-widest uppercase mb-4 text-on-surface-variant/60">Admin Quick Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={function(){
                        setTournamentState(function(ts){return Object.assign({},ts,{savedLobbies:[]});});
                        toast("Lobbies re-rolled!","success");
                      }}
                      className="w-full text-left p-3 hover:bg-surface-container-low transition-colors flex items-center justify-between group rounded">
                      <span className="text-sm font-medium text-on-surface">Re-roll Lobbies</span>
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

              {/* Live standings */}
              {tournamentState&&isLive&&(
                <LiveStandingsPanel checkedIn={checkedIn} tournamentState={tournamentState} lobbies={lobbies} round={round}/>
              )}

              {/* Finals display */}
              {round>3&&checkedIn.length>0&&(
                <div className="bg-surface-container-low rounded p-6 text-center border border-primary/20">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {lobbies.map(function(lobby,li){
                  var isMyLobby=effectiveHighlight===li;
                  var locked=lockedLobbies.includes(li);
                  var lobbyLetter=lobbyLetters[li]||String(li+1);
                  var hasPlacements=placementEntry[li]&&placementEntry[li].open;

                  return(
                    <div key={li} className={"bg-surface-container-high rounded overflow-hidden border-2 transition-all " + (isMyLobby?"border-secondary shadow-[0_0_30px_rgba(217,185,255,0.08)]":locked?"border-tertiary/30":"border-outline-variant/15")}>

                      {/* Lobby header */}
                      <div className={"px-4 py-3 flex justify-between items-center border-b " + (isMyLobby?"bg-secondary/10 border-secondary/20":locked?"bg-tertiary/5 border-tertiary/15":"bg-surface-container border-outline-variant/10")}>
                        <div className="flex items-center gap-2">
                          <span className={"font-display " + (isMyLobby?"text-secondary":locked?"text-tertiary":"text-on-surface-variant/80")}>
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
                          <span className="font-mono text-xs text-on-surface-variant/40">{lobby.length + " players"}</span>
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
                              className={"flex items-center justify-between px-4 py-2 hover:bg-surface-container-highest transition-colors cursor-pointer " + (isMe?"bg-secondary/5":"")}>
                              <div className="flex items-center gap-3">
                                <span className={"font-mono text-xs " + (pi===0?"text-primary":pi===1?"text-on-surface-variant/60":pi===2?"text-on-surface-variant/50":"text-on-surface-variant/30")}>
                                  {String(pi+1).padStart(2,"0")}
                                </span>
                                <div className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center flex-shrink-0">
                                  <Icon name="person" size={16} className="text-on-surface-variant/40" />
                                </div>
                                <div>
                                  <div className={"text-sm font-semibold flex items-center gap-1 " + (isMe?"text-secondary":isMyLobby?"text-on-surface":"text-on-surface-variant/90")}>
                                    {p.name}
                                    {isHotStreak(p)&&<Icon name="local_fire_department" size={12} fill className="text-orange-400" />}
                                    {pi===0&&<span className="text-[8px] font-label font-bold tracking-wider uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">HOST</span>}
                                  </div>
                                  <div className="text-[10px] text-on-surface-variant/40">{p.rank}</div>
                                  {(p.riotId||p.riot_id_eu)&&<div className="flex items-center gap-1">
                                    <span className="text-[10px] text-on-surface-variant/30 truncate">{p.riotId||p.riot_id_eu}</span>
                                    <button
                                      onClick={function(e){e.stopPropagation();navigator.clipboard.writeText(p.riotId||p.riot_id_eu||"");toast("Copied "+p.name+"'s Riot ID","success");}}
                                      className="text-on-surface-variant/25 hover:text-primary transition-colors flex-shrink-0"
                                      title="Copy Riot ID">
                                      <Icon name="content_copy" size={11} />
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
