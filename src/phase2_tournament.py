"""
Phase 2: Tournament Execution
- Update BracketScreen to accept tournamentState/setTournamentState
- Add applyGameResults function
- Replace dumb "Lock Results" button with "Enter Placements" inline card
- Add round advancement / finalize clash logic
"""

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Update BracketScreen function signature ───────────────────────────────
OLD_BS_SIG = '''function BracketScreen({players,setPlayers,toast,isAdmin,currentUser,setProfilePlayer,setScreen}){'''
NEW_BS_SIG = '''function BracketScreen({players,setPlayers,toast,isAdmin,currentUser,setProfilePlayer,setScreen,tournamentState,setTournamentState}){'''

assert OLD_BS_SIG in content, "OLD_BS_SIG not found"
content = content.replace(OLD_BS_SIG, NEW_BS_SIG, 1)

# ── 2. Replace inner state + getLobbies with full rewrite of bracket logic ───
OLD_BS_BODY = '''  const checkedIn=players.filter(p=>p.checkedIn);
  const lobbySize=8;
  const [round,setRound]=useState(1);
  const [roundResults,setRoundResults]=useState({});
  const [mySearch,setMySearch]=useState(currentUser?currentUser.username:"");
  const [highlightLobby,setHighlightLobby]=useState(null);

  function getLobbies(){
    const pool=round===1?[...checkedIn]:[...checkedIn].sort((a,b)=>b.pts-a.pts);
    const lobbies=[];
    for(let i=0;i<pool.length;i+=lobbySize)lobbies.push(pool.slice(i,i+lobbySize));
    return lobbies;
  }
  const lobbies=getLobbies();
  const roundKey="r"+round;

  function findMyLobby(){
    const q=mySearch.trim().toLowerCase();
    if(!q)return;
    const li=lobbies.findIndex(lobby=>lobby.some(p=>p.name.toLowerCase().includes(q)||p.riotId?.toLowerCase().includes(q)));
    if(li>=0){setHighlightLobby(li);toast("Found in Lobby "+(li+1)+"! ✓","success");}
    else toast("Not found in active lobbies","error");
  }

  function lockRound(lobbyIdx,placement){
    const rk=roundKey;
    setRoundResults(r=>({...r,[rk]:{...(r[rk]||{}),[lobbyIdx]:placement}}));
    toast("Lobby "+(lobbyIdx+1)+" results locked ✓","success");
  }

  const allLocked=lobbies.length>0&&lobbies.every((_,i)=>(roundResults[roundKey]||{})[i]!==undefined);

  // auto-highlight if logged in
  const myLobbyAuto=currentUser?lobbies.findIndex(lb=>lb.some(p=>p.name===currentUser.username)):-1;
  const effectiveHighlight=highlightLobby!==null?highlightLobby:myLobbyAuto>=0?myLobbyAuto:null;'''

NEW_BS_BODY = '''  const checkedIn=players.filter(p=>p.checkedIn);
  const lobbySize=8;
  const round=tournamentState?tournamentState.round:1;
  const lockedLobbies=tournamentState?tournamentState.lockedLobbies:[];
  const [mySearch,setMySearch]=useState(currentUser?currentUser.username:"");
  const [highlightLobby,setHighlightLobby]=useState(null);
  // Per-lobby placement entry UI state: lobbyIdx -> {open:bool, placements:{playerId->place}}
  const [placementEntry,setPlacementEntry]=useState({});

  function getLobbies(){
    const pool=round===1?[...checkedIn]:[...checkedIn].sort((a,b)=>b.pts-a.pts);
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
    const placements=placementEntry[li]?placements={},lobby.forEach(p=>{placements[p.id]=parseInt(placementEntry[li].placements[p.id]||"0");}),placements:{};
    setPlayers(prev=>prev.map(p=>{
      const place=placements[p.id];
      if(place===undefined)return p;
      const earned=PTS[place]||0;
      const newGames=(p.games||0)+1;
      const newWins=(p.wins||0)+(place===1?1:0);
      const newTop4=(p.top4||0)+(place<=4?1:0);
      const newPts=(p.pts||0)+earned;
      const newAvg=(((parseFloat(p.avg)||0)*(p.games||0)+place)/newGames).toFixed(2);
      const newHistory=[...(p.clashHistory||[]),{round,place,pts:earned,clashId:Date.now()}];
      const newSparkline=[...(p.sparkline||[p.pts]),newPts];
      const newStreak=place<=4?(p.currentStreak||0)+1:0;
      const bestStreak=Math.max(p.bestStreak||0,newStreak);
      return {...p,pts:newPts,wins:newWins,top4:newTop4,games:newGames,avg:newAvg,
        clashHistory:newHistory,sparkline:newSparkline,currentStreak:newStreak,bestStreak};
    }));
    setTournamentState(ts=>({...ts,lockedLobbies:[...(ts.lockedLobbies||[]),li]}));
    setPlacementEntry(pe=>({...pe,[li]:{...pe[li],open:false}}));
    toast("Lobby "+(li+1)+" results applied! ✓","success");
  }

  const allLocked=lobbies.length>0&&lobbies.every((_,i)=>lockedLobbies.includes(i));

  // auto-highlight if logged in
  const myLobbyAuto=currentUser?lobbies.findIndex(lb=>lb.some(p=>p.name===currentUser.username)):-1;
  const effectiveHighlight=highlightLobby!==null?highlightLobby:myLobbyAuto>=0?myLobbyAuto:null;'''

assert OLD_BS_BODY in content, "OLD_BS_BODY not found"
content = content.replace(OLD_BS_BODY, NEW_BS_BODY, 1)

# ── 3. Replace round navigation header buttons ────────────────────────────────
OLD_ROUND_NAV = '''        {isAdmin&&(
          <div style={{display:"flex",gap:8}}>
            <Btn v="dark" s="sm" disabled={round<=1} onClick={()=>setRound(r=>r-1)}>← Round</Btn>
            <Btn v="primary" s="sm" disabled={!allLocked} onClick={()=>setRound(r=>r+1)}>Next Round →</Btn>
          </div>
        )}'''

NEW_ROUND_NAV = '''        {isAdmin&&(
          <div style={{display:"flex",gap:8}}>
            <Btn v="dark" s="sm" disabled={round<=1} onClick={()=>setTournamentState(ts=>({...ts,round:ts.round-1,lockedLobbies:[]}))}>← Round</Btn>
            <Btn v="primary" s="sm" disabled={!allLocked} onClick={()=>{if(round>=3){setTournamentState(ts=>({...ts,phase:"complete",lockedLobbies:[]}));toast("Clash complete! View results →","success");}else{setTournamentState(ts=>({...ts,round:ts.round+1,lockedLobbies:[]}));toast("Advanced to Round "+(round+1),"success");}}}>
              {round>=3?"Finalize Clash ✓":"Next Round →"}
            </Btn>
          </div>
        )}'''

assert OLD_ROUND_NAV in content, "OLD_ROUND_NAV not found"
content = content.replace(OLD_ROUND_NAV, NEW_ROUND_NAV, 1)

# ── 4. Replace the round progress pills (was hardcoded 1,2,3) ────────────────
OLD_ROUND_PILLS = '''          {/* Round progress */}
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {[1,2,3].map(r=>(
              <div key={r} style={{flex:1,minWidth:80,background:r<round?"rgba(82,196,124,.08)":r===round?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",
                border:"1px solid "+(r<round?"rgba(82,196,124,.3)":r===round?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),
                borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:r<round?"#6EE7B7":r===round?"#E8A838":"#4A4438",letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>Round {r}</div>
                <div style={{fontSize:11,color:r<round?"#6EE7B7":r===round?"#E8A838":"#4A4438"}}>{r<round?"Complete ✓":r===round?"In Progress":"Upcoming"}</div>
              </div>
            ))}
          </div>'''

NEW_ROUND_PILLS = '''          {/* Round progress + complete banner */}
          {tournamentState&&tournamentState.phase==="complete"&&(
            <div style={{background:"rgba(232,168,56,.1)",border:"1px solid rgba(232,168,56,.4)",borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:22}}>🏆</span>
              <div>
                <div style={{fontWeight:700,color:"#E8A838",fontSize:15}}>Clash Complete!</div>
                <div style={{fontSize:12,color:"#9CA3AF"}}>All rounds locked. View final standings on the Leaderboard.</div>
              </div>
              <Btn v="primary" s="sm" style={{marginLeft:"auto"}} onClick={()=>setScreen("leaderboard")}>View Results →</Btn>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
            {[1,2,3].map(r=>(
              <div key={r} style={{flex:1,minWidth:80,background:r<round?"rgba(82,196,124,.08)":r===round?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",
                border:"1px solid "+(r<round?"rgba(82,196,124,.3)":r===round?"rgba(232,168,56,.4)":"rgba(242,237,228,.08)"),
                borderRadius:8,padding:"10px 14px",textAlign:"center"}}>
                <div style={{fontSize:11,fontWeight:700,color:r<round?"#6EE7B7":r===round?"#E8A838":"#4A4438",letterSpacing:".08em",textTransform:"uppercase",marginBottom:2}}>Round {r}</div>
                <div style={{fontSize:11,color:r<round?"#6EE7B7":r===round?"#E8A838":"#4A4438"}}>{r<round?"Complete ✓":r===round?"In Progress":"Upcoming"}</div>
              </div>
            ))}
          </div>'''

assert OLD_ROUND_PILLS in content, "OLD_ROUND_PILLS not found"
content = content.replace(OLD_ROUND_PILLS, NEW_ROUND_PILLS, 1)

# ── 5. Replace per-lobby locked check and admin controls ─────────────────────
OLD_LOBBY_LOCKED = '''              const locked=(roundResults[roundKey]||{})[li]!==undefined;'''
NEW_LOBBY_LOCKED = '''              const locked=lockedLobbies.includes(li);'''

assert OLD_LOBBY_LOCKED in content, "OLD_LOBBY_LOCKED not found"
content = content.replace(OLD_LOBBY_LOCKED, NEW_LOBBY_LOCKED, 1)

# ── 6. Replace "Lock Results ✓" button with placement entry UI ────────────────
OLD_LOCK_BTN = '''                  {/* Admin lock controls */}
                  {isAdmin&&!locked&&(
                    <div style={{padding:"10px 12px",borderTop:"1px solid rgba(242,237,228,.06)",background:"rgba(255,255,255,.01)"}}>
                      <Btn v="teal" s="sm" full onClick={()=>lockRound(li,{})}>Lock Results ✓</Btn>
                    </div>
                  )}'''

NEW_LOCK_BTN = '''                  {/* Admin placement entry */}
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
                  )}'''

assert OLD_LOCK_BTN in content, "OLD_LOCK_BTN not found"
content = content.replace(OLD_LOCK_BTN, NEW_LOCK_BTN, 1)

# ── Fix the applyGameResults inline object bug ────────────────────────────────
# The function has a syntax issue with inline placements construction, fix it:
OLD_APPLY = '''  function applyGameResults(li){
    const lobby=lobbies[li];
    const placements=placementEntry[li]?placements={},lobby.forEach(p=>{placements[p.id]=parseInt(placementEntry[li].placements[p.id]||"0");}),placements:{};'''

NEW_APPLY = '''  function applyGameResults(li){
    const lobby=lobbies[li];
    if(!placementEntry[li])return;
    const placements={};
    lobby.forEach(p=>{placements[p.id]=parseInt(placementEntry[li].placements[p.id]||"0");});'''

assert OLD_APPLY in content, "OLD_APPLY not found"
content = content.replace(OLD_APPLY, NEW_APPLY, 1)

# ── Verify brace balance ─────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
print(f"Brace balance: {opens} open, {closes} close, diff={opens-closes}")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Phase 2 done. File is now {content.count(chr(10))+1} lines.")
