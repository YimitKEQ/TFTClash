import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import { PTS, HOMIES_IDS, PAST_CLASHES } from '../lib/constants.js'
import { computeSeasonBonuses, getAttendanceStreak, isHotStreak, checkAchievements, syncAchievements } from '../lib/stats.js'
import { applyCutLine, computeTournamentStandings } from '../lib/tournament.js'
import { writeActivityEvent, createNotification } from '../lib/notifications.js'
import { Panel, Btn, Inp } from '../components/ui'

// ── Sel component (inline copy from App.jsx) ──────────────────────────────────
function Sel({value,onChange,children,style}){
  return(
    <div style={{position:"relative",...(style&&style.width?{width:style.width}:{})}}>
      <select value={value} onChange={function(e){onChange(e.target.value);}}
        style={Object.assign({width:"100%",background:"#141E30",border:"1px solid rgba(242,237,228,.11)",
          borderRadius:8,padding:"12px 36px 12px 14px",color:"#F2EDE4",fontSize:15,minHeight:46,
          appearance:"none",cursor:"pointer"},style||{})}>
        {children}
      </select>
      <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#BECBD9",fontSize:11}}>{"▼"}</div>
    </div>
  );
}

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
    <Panel style={{padding:"20px",marginTop:24}}>
      <div style={{fontWeight:700,fontSize:14,color:"#E8A838",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}><i className="ti ti-chart-bar"/></span>
        {"Live Standings - Game "+round+"/"+totalGames}
        <span style={{fontSize:11,color:"#BECBD9",fontWeight:400,marginLeft:4}}>{"("+lockedCount+" of "+lobbies.length+" "+(lobbies.length===1?"lobby":"lobbies")+" locked)"}</span>
      </div>
      {showCutLine&&(
        <div style={{fontSize:11,color:"#E8A838",marginBottom:10,padding:"4px 10px",background:"rgba(232,168,56,.06)",borderRadius:4,border:"1px solid rgba(232,168,56,.12)"}}>{"Cut line: "+cutLine+" pts - players at or below are eliminated after Game "+cutAfterGame}</div>
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
              <span className="mono" style={{fontSize:13,fontWeight:700,color:belowCut?"#F87171":row.earned>0?"#6EE7B7":"#9AAABF"}}>{row.earned>0?"+"+row.earned:" - "}{"pts"}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── BracketScreen ─────────────────────────────────────────────────────────────
function BracketScreen(){
  var ctx=useApp();
  var players=ctx.players;
  var setPlayers=ctx.setPlayers;
  var toast=ctx.toast;
  var isAdmin=ctx.isAdmin;
  var currentUser=ctx.currentUser;
  var setProfilePlayer=ctx.setProfilePlayer;
  var setScreen=ctx.setScreen;
  var tournamentState=ctx.tournamentState;
  var setTournamentState=ctx.setTournamentState;
  var seasonConfig=ctx.seasonConfig;

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
      });
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
        .then(function(res){if(res.error)console.error("[TFT] Failed to persist lobby "+(idx+1)+":",res.error);});
      });
    }
  },[lobbies]);

  function findMyLobby(){
    var q=mySearch.trim().toLowerCase();
    if(!q)return;
    var li=lobbies.findIndex(function(lobby){return lobby.some(function(p){return p.name.toLowerCase().includes(q)||(p.riotId&&p.riotId.toLowerCase().includes(q));});});
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
    var allClashIds=PAST_CLASHES.map(function(c){return "c"+c.id;});

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

    if(supabase.from&&tournamentState.dbTournamentId){
      supabase.from('lobbies').update({status:'locked'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){if(res.error)console.error("[TFT] Failed to lock lobby in DB:",res.error);});
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
          if(res.error){console.error("[TFT] Failed to save game results:",res.error);toast("Failed to save game results","error");}
          else{
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
          .then(function(res){if(res.error)console.error("[TFT] Failed to delete game results:",res.error);});
      }
      supabase.from('lobbies').update({status:'active'})
        .eq('tournament_id',tournamentState.dbTournamentId)
        .eq('lobby_number',li+1)
        .eq('round_number',round)
        .then(function(res){if(res.error)console.error("[TFT] Failed to unlock lobby in DB:",res.error);});
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
      supabase.from('tournaments').update({phase:'complete',completed_at:new Date().toISOString()}).eq('id',tId)
        .then(function(r){if(r.error)console.error("Failed to update tournament phase:",r.error);});
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
                if(pr.error)console.error("[TFT] Failed to sync final stats for",p.name,pr.error);
              });
            }
          });
        });
      }
    };
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

  var myLobbyAuto=currentUser?lobbies.findIndex(function(lb){return lb.some(function(p){return p.name===currentUser.username;});}): -1;
  var effectiveHighlight=highlightLobby!==null?highlightLobby:myLobbyAuto>=0?myLobbyAuto:null;

  return(
    <div className="page wrap">

      {showFinalizeConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1003,padding:16}}>
          <Panel glow style={{width:"100%",maxWidth:420,padding:"28px"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:48,marginBottom:12}}><i className="ti ti-trophy"/></div>
              <h3 style={{color:"#F2EDE4",fontSize:20,marginBottom:8}}>Finalize This Clash?</h3>
              <p style={{color:"#BECBD9",fontSize:14,lineHeight:1.5,marginBottom:4}}>{"This will end the tournament and post final results. All "+checkedIn.length+" players will receive their season points."}</p>
              <p style={{color:"#E8A838",fontSize:12,fontWeight:600}}>This action cannot be undone.</p>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn v="dark" onClick={function(){setShowFinalizeConfirm(false);}}>Cancel</Btn>
              <Btn v="primary" onClick={function(){
                setShowFinalizeConfirm(false);
                saveResultsToSupabase(players,currentClashId);
                setTournamentState(function(ts){return Object.assign({},ts,{phase:"complete",lockedLobbies:[],savedLobbies:[]});});
                toast("Clash complete! View results","success");
              }}>Finalize Clash</Btn>
            </div>
          </Panel>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={function(){setScreen("home");}}>{"<- Back"}</Btn>
        <h2 style={{color:"#F2EDE4",fontSize:20,margin:0,flex:1,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span>{"Game "+round+"/"+(tournamentState.totalGames||4)}</span>
          <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,letterSpacing:".08em",textTransform:"uppercase",
            background:tournamentState.phase==="inprogress"?"rgba(82,196,124,.12)":tournamentState.phase==="complete"?"rgba(78,205,196,.12)":"rgba(155,114,207,.12)",
            color:tournamentState.phase==="inprogress"?"#6EE7B7":tournamentState.phase==="complete"?"#4ECDC4":"#C4B5FD",
            border:"1px solid "+(tournamentState.phase==="inprogress"?"rgba(82,196,124,.3)":tournamentState.phase==="complete"?"rgba(78,205,196,.3)":"rgba(155,114,207,.3)")}}>
            {tournamentState.phase==="inprogress"?"Live":tournamentState.phase==="complete"?"Complete":tournamentState.phase==="checkin"?"Check-in":"Setup"}
          </span>
          <span style={{fontSize:13,fontWeight:400,color:"#BECBD9"}}>{lobbies.length+" "+(lobbies.length===1?"Lobby":"Lobbies")+" - "+checkedIn.length+" players"}</span>
        </h2>
        {isAdmin&&(
          <div style={{display:"flex",gap:8}}>
            <Btn v="dark" s="sm" disabled={round<=1} onClick={function(){setTournamentState(function(ts){return Object.assign({},ts,{round:ts.round-1,lockedLobbies:[],savedLobbies:[]});});}}>{"<- Round"}</Btn>
            <Btn v="primary" s="sm" disabled={!allLocked} onClick={function(){
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
                setTournamentState(function(ts){return Object.assign({},ts,{round:nextRound,lockedLobbies:[],savedLobbies:[]});});
                toast("Advanced to Game "+nextRound+cutMsg,"success");
              }
            }}>
              {round>=(tournamentState.totalGames||4)?"Finalize Clash":"Next Game ->"}
            </Btn>
          </div>
        )}
      </div>

      {allLocked&&checkedIn.length>0&&(
        <div style={{background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.3)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,animation:"pulse 2s infinite"}}>
          <span style={{fontSize:16}}><i className="ti ti-circle-check" style={{color:"#52C47C"}}/></span>
          <span style={{fontSize:13,fontWeight:600,color:"#6EE7B7",flex:1}}>
            {"All "+lobbies.length+" lobbies locked - "+(round>=(tournamentState.totalGames||4)?"ready to finalize!":"ready for next game!")}
            {isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<(tournamentState.totalGames||4)?" Auto-advancing in "+autoAdvanceCountdown+"s":""}
          </span>
          {isAdmin&&autoAdvanceCountdown!==null&&autoAdvanceCountdown>0&&round<(tournamentState.totalGames||4)&&(
            <button onClick={cancelAutoAdvance} style={{fontSize:11,color:"#F87171",fontWeight:700,cursor:"pointer",background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"4px 12px",fontFamily:"inherit",whiteSpace:"nowrap"}}>Cancel</button>
          )}
        </div>
      )}

      {checkedIn.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>
            {tournamentState&&tournamentState.phase==="complete"?<i className="ti ti-trophy"/>:tournamentState&&tournamentState.phase==="inprogress"?<i className="ti ti-bolt"/>:<i className="ti ti-device-gamepad-2"/>}
          </div>
          <h3 style={{color:"#F2EDE4",marginBottom:8}}>{tournamentState&&tournamentState.phase==="complete"?"Tournament Complete":tournamentState&&tournamentState.phase==="inprogress"?"Waiting for Players":"No Active Tournament"}</h3>
          <p style={{color:"#BECBD9",fontSize:14,marginBottom:20}}>{tournamentState&&tournamentState.phase==="complete"?"The last tournament has been finalized. Check Results for the full breakdown.":tournamentState&&tournamentState.phase==="inprogress"?"Players need to check in to join the bracket.":"No tournament is running right now. Check back when the next clash is announced!"}</p>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <Btn v="primary" onClick={function(){setScreen("home");}}>{"<- Back to Home"}</Btn>
            {tournamentState&&tournamentState.phase==="complete"&&<Btn v="dark" onClick={function(){setScreen("results");}}>View Results</Btn>}
          </div>
        </div>
      )}

      {checkedIn.length>0&&(
        <>
          {/* Find my lobby */}
          <Panel style={{padding:"14px 16px",marginBottom:20,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:"#C8D4E0",flexShrink:0}}><i className="ti ti-search" style={{fontSize:13,marginRight:4}}/>Find your lobby:</span>
            <Inp value={mySearch} onChange={setMySearch} placeholder="Your name or Riot ID" onKeyDown={function(e){if(e.key==="Enter")findMyLobby();}}/>
            <Btn v="purple" s="sm" onClick={findMyLobby}>Find Me</Btn>
            {effectiveHighlight!==null&&<span style={{fontSize:12,color:"#6EE7B7",fontWeight:600}}>{"You are in Lobby "+(effectiveHighlight+1)}</span>}
          </Panel>

          {/* Lobby lock progress */}
          {lobbies.length>0&&tournamentState.phase==="inprogress"&&(
            <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1,background:"rgba(255,255,255,.04)",borderRadius:8,height:6,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:8,background:allLocked?"linear-gradient(90deg,#52C47C,#6EE7B7)":"linear-gradient(90deg,#E8A838,#9B72CF)",width:Math.round(lockedLobbies.length/lobbies.length*100)+"%",transition:"width .5s ease"}}/>
              </div>
              <span style={{fontSize:11,fontWeight:700,color:allLocked?"#6EE7B7":"#E8A838",whiteSpace:"nowrap"}}>{lockedLobbies.length+"/"+lobbies.length+" locked"}</span>
            </div>
          )}

          {/* Tournament complete banner */}
          {tournamentState&&tournamentState.phase==="complete"&&(
            <div style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.4)",borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:22}}><i className="ti ti-trophy"/></span>
              <div>
                <div style={{fontWeight:700,color:"#E8A838",fontSize:15}}>Clash Complete!</div>
                <div style={{fontSize:12,color:"#C8D4E0"}}>All rounds locked. View final standings on the Leaderboard.</div>
              </div>
              <Btn v="primary" s="sm" style={{marginLeft:"auto"}} onClick={function(){setScreen("leaderboard");}}>{"View Results ->"}</Btn>
            </div>
          )}

          {/* Round progress indicators */}
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {[1,2,3].map(function(r){return(
              <div key={r} style={{flex:1,minWidth:80,
                background:r<round?"rgba(82,196,124,.08)":r===round?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",
                border:"1px solid "+(r<round?"rgba(82,196,124,.3)":r===round?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),
                borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:r<round?"#6EE7B7":r===round?"#E8A838":"#9AAABF",letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>{"Round "+r}</div>
                <div style={{fontSize:11,color:r<round?"#6EE7B7":r===round?"#E8A838":"#9AAABF"}}>{r<round?"Complete":r===round?"In Progress":"Upcoming"}</div>
              </div>
            );})}
          </div>

          {/* Lobby grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(320px,100%),1fr))",gap:16}}>
            {lobbies.map(function(lobby,li){
              var isMyLobby=effectiveHighlight===li;
              var locked=lockedLobbies.includes(li);

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
                        <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4"}}>{"Lobby "+(li+1)}</div>
                        <div style={{fontSize:11,color:"#BECBD9"}}>{lobby.length+" players"+(isMyLobby?" - Your Lobby":"")}</div>
                      </div>
                    </div>
                    {isMyLobby&&<div style={{fontSize:12,fontWeight:700,color:"#9B72CF",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:6,padding:"3px 10px"}}>YOU</div>}
                    {locked&&!isMyLobby&&<div style={{fontSize:11,color:"#6EE7B7",fontWeight:700}}>{"✓ Locked"}</div>}
                    {locked&&isAdmin&&<button onClick={function(e){e.stopPropagation();unlockLobby(li);}} style={{fontSize:11,color:"#F87171",fontWeight:700,cursor:"pointer",background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.3)",borderRadius:6,padding:"3px 10px",marginLeft:6}}>Unlock</button>}
                  </div>

                  {/* Player list */}
                  <div style={{padding:"10px 12px"}}>
                    {lobby.slice().sort(function(a,b){return b.pts-a.pts;}).map(function(p,pi){
                      var isMe=currentUser&&p.name===currentUser.username;
                      var homie=HOMIES_IDS.includes(p.id);

                      return(
                        <div key={p.id} onClick={function(){setProfilePlayer(p);setScreen("profile");}}
                          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 6px",
                            borderBottom:pi<lobby.length-1?"1px solid rgba(242,237,228,.05)":"none",
                            cursor:"pointer",borderRadius:6,
                            background:isMe?"rgba(155,114,207,.08)":"transparent",
                            transition:"background .15s"}}
                          onMouseEnter={function(e){e.currentTarget.style.background=isMe?"rgba(155,114,207,.12)":"rgba(242,237,228,.03)";}}
                          onMouseLeave={function(e){e.currentTarget.style.background=isMe?"rgba(155,114,207,.08)":"transparent";}}>

                          <div className="mono" style={{fontSize:12,fontWeight:800,color:pi===0?"#E8A838":pi===1?"#C0C0C0":pi===2?"#CD7F32":"#9AAABF",minWidth:18,textAlign:"center"}}>{pi+1}</div>

                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <span style={{fontWeight:isMe?700:600,fontSize:13,color:isMe?"#C4B5FD":"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                              {homie&&<span style={{fontSize:10}}><i className="ti ti-heart" style={{color:"#9B72CF"}}/></span>}
                              {isHotStreak(p)&&<span style={{fontSize:10}}><i className="ti ti-flame" style={{color:"#F97316"}}/></span>}
                            </div>
                            <div style={{fontSize:10,color:"#BECBD9"}}>{p.rank+" - "+p.region}</div>
                          </div>

                          <div className="mono" style={{fontSize:12,fontWeight:700,color:"#E8A838",flexShrink:0}}>{p.pts+"pts"}</div>

                          {isMe&&!locked&&tournamentState.phase==="inprogress"&&(
                            playerSubmissions[li]&&playerSubmissions[li][p.id]?(
                              <div style={{fontSize:10,color:"#6EE7B7",fontWeight:700,flexShrink:0}}>{"#"+playerSubmissions[li][p.id].placement+" ✓"}</div>
                            ):(
                              <Sel value="" onChange={function(v){if(v)submitMyPlacement(li,p.id,p.name,v);}} style={{width:52,fontSize:11,flexShrink:0}}>
                                <option value="">{" - "}</option>
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
                            {"Enter Placements"+(playerSubmissions[li]?" ("+Object.keys(playerSubmissions[li]).length+" submitted)":"")}
                          </Btn>
                        </div>
                      ):(
                        <div style={{padding:"12px",background:"rgba(78,205,196,.03)",borderTop:"1px solid rgba(78,205,196,.12)"}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#4ECDC4",marginBottom:10,textTransform:"uppercase",letterSpacing:".08em"}}>{"Enter Placements - Round "+round}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                            {lobby.slice().sort(function(a,b){return b.pts-a.pts;}).map(function(p){
                              var dup=lobby.filter(function(x){return placementEntry[li].placements[x.id]===placementEntry[li].placements[p.id];}).length>1;
                              var wasSelfSubmitted=((playerSubmissions||{})[li]||{})[p.id];
                              return(
                                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:12,color:"#F2EDE4",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                    {p.name}
                                    {wasSelfSubmitted&&<span style={{fontSize:9,color:"#4ECDC4",fontWeight:700,marginLeft:4}}>SELF</span>}
                                  </span>
                                  <Sel value={placementEntry[li].placements[p.id]||"1"} onChange={function(v){setPlace(li,p.id,v);}} style={{width:60,border:dup?"1px solid #F87171":undefined}}>
                                    {[1,2,3,4,5,6,7,8].map(function(n){return <option key={n} value={n}>{n}</option>;})}
                                    <option value="0">DNP</option>
                                  </Sel>
                                </div>
                              );
                            })}
                          </div>
                          {!placementValid(li)&&<div style={{fontSize:11,color:"#F87171",marginBottom:8}}>Each placement must be unique (1-8)</div>}
                          <div style={{display:"flex",gap:8}}>
                            <Btn v="success" s="sm" full disabled={!placementValid(li)} onClick={function(){applyGameResults(li);}}>{"Confirm & Lock ✓"}</Btn>
                            <Btn v="dark" s="sm" onClick={function(){setPlacementEntry(function(pe){return Object.assign({},pe,{[li]:Object.assign({},pe[li],{open:false})});});}}>Cancel</Btn>
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
          {tournamentState&&tournamentState.phase==="inprogress"&&lockedLobbies.length>0&&(
            <LiveStandingsPanel checkedIn={checkedIn} tournamentState={tournamentState} lobbies={lobbies} round={round}/>
          )}

          {/* Finals display */}
          {round>3&&checkedIn.length>0&&(
            <Panel style={{padding:"24px",marginTop:24,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}><i className="ti ti-trophy"/></div>
              <h3 style={{color:"#E8A838",fontSize:20,marginBottom:8}}>Grand Finals</h3>
              <p style={{color:"#BECBD9",fontSize:14}}>All rounds complete. Finals results locked in.</p>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export default memo(BracketScreen);
