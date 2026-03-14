"""
Phase 3: Check-in System
- Add tournamentState to HomeScreen (check-in button for logged-in player)
- Dynamic hero status text based on phase
- Add phase controls to AdminPanel Round tab
"""

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Update HomeScreen function signature ───────────────────────────────────
OLD_HOME_SIG = '''function HomeScreen({players,setPlayers,setScreen,toast,announcement,setProfilePlayer,currentUser,onAuthClick}){'''
NEW_HOME_SIG = '''function HomeScreen({players,setPlayers,setScreen,toast,announcement,setProfilePlayer,currentUser,onAuthClick,tournamentState,setTournamentState}){'''

assert OLD_HOME_SIG in content, "OLD_HOME_SIG not found"
content = content.replace(OLD_HOME_SIG, NEW_HOME_SIG, 1)

# ── 2. Add check-in logic variables after `const myRankIdx` line ─────────────
OLD_MY_RANK = '''  const myRankIdx=linkedPlayer?[...players].sort((a,b)=>b.pts-a.pts).findIndex(p=>p.id===linkedPlayer.id)+1:0;'''

NEW_MY_RANK = '''  const myRankIdx=linkedPlayer?[...players].sort((a,b)=>b.pts-a.pts).findIndex(p=>p.id===linkedPlayer.id)+1:0;
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
  }'''

assert OLD_MY_RANK in content, "OLD_MY_RANK not found"
content = content.replace(OLD_MY_RANK, NEW_MY_RANK, 1)

# ── 3. Find the announcement banner and add a phase status pill after it ─────
# Find where the guest sign-in nudge section starts and insert check-in card before it
OLD_GUEST_NUDGE = '''      {/* Guest sign-in nudge */}
      {!currentUser&&('''

NEW_GUEST_NUDGE = '''      {/* Phase status pill */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{background:"rgba(0,0,0,.3)",border:"1px solid "+phaseStatusColor(),borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:phaseStatusColor(),letterSpacing:".04em",cursor:tPhase==="complete"?"pointer":"default"}}
          onClick={()=>tPhase==="complete"&&setScreen("leaderboard")}>
          {tPhase==="inprogress"&&<span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#52C47C",marginRight:7,verticalAlign:"middle",animation:"pulse 1.5s infinite"}}/>}
          {phaseStatusText()}
        </div>
      </div>

      {/* Check-in card (only when check-in is open and user is a registered player) */}
      {tPhase==="checkin"&&currentUser&&linkedPlayer&&(
        <div style={{background:myCheckedIn?"rgba(82,196,124,.08)":"rgba(232,168,56,.08)",border:"1px solid "+(myCheckedIn?"rgba(82,196,124,.4)":"rgba(232,168,56,.4)"),borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:22}}>{myCheckedIn?"✅":"⏰"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:2}}>{myCheckedIn?"You're checked in!":"Check-in is open"}</div>
            <div style={{fontSize:12,color:"#9CA3AF"}}>{myCheckedIn?"Good luck today, "+linkedPlayer.name+"!":"Confirm you're ready for today's clash"}</div>
          </div>
          {!myCheckedIn&&<Btn v="primary" onClick={handleCheckIn}>Check In Now →</Btn>}
          {myCheckedIn&&<div style={{fontSize:12,fontWeight:700,color:"#6EE7B7",background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:8,padding:"6px 14px"}}>✓ Checked In</div>}
        </div>
      )}

      {/* Guest sign-in nudge */}
      {!currentUser&&('''

assert OLD_GUEST_NUDGE in content, "OLD_GUEST_NUDGE not found"
content = content.replace(OLD_GUEST_NUDGE, NEW_GUEST_NUDGE, 1)

# ── 4. Update AdminPanel Round tab to include tournament phase controls ────────
OLD_ROUND_TAB = '''      {tab==="round"&&(
        <div className="grid-2">
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Round Controls</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn v={paused?"success":"danger"} full onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Resumed":"Paused");}}>
                {paused?"▶ Resume Round":"⏸ Pause Round"}
              </Btn>
              <Btn v="dark" full onClick={()=>{addAudit("ACTION","Force advance");toast("Force advancing","success");}}>Force Advance →</Btn>
              <Btn v="purple" full onClick={()=>{addAudit("ACTION","Reseeded - "+seedAlgo);toast("Lobbies reseeded","success");}}>Reseed Lobbies</Btn>
            </div>
          </Panel>'''

NEW_ROUND_TAB = '''      {tab==="round"&&(
        <div className="grid-2">
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Tournament Phase</h3>
            <div style={{marginBottom:12,padding:"10px 12px",background:"#0F1520",borderRadius:8,border:"1px solid rgba(242,237,228,.07)"}}>
              <div style={{fontSize:11,color:"#6B7280",marginBottom:3,textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}}>Current Phase</div>
              <div style={{fontWeight:700,fontSize:14,color:{registration:"#9B72CF",checkin:"#E8A838",inprogress:"#52C47C",complete:"#4ECDC4"}[tournamentState?tournamentState.phase:"registration"]||"#9B72CF"}}>
                {{registration:"Registration Open",checkin:"Check-in Open",inprogress:"In Progress — Round "+(tournamentState?tournamentState.round:1),complete:"Complete"}[tournamentState?tournamentState.phase:"registration"]||"Registration"}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn v="primary" full disabled={tournamentState&&tournamentState.phase!=="registration"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"checkin"}));addAudit("ACTION","Check-in opened");toast("Check-in is now open!","success");}}>Open Check-in</Btn>
              <Btn v="success" full disabled={tournamentState&&tournamentState.phase!=="checkin"} onClick={()=>{setTournamentState(ts=>({...ts,phase:"inprogress",round:1,lockedLobbies:[]}));addAudit("ACTION","Tournament started");toast("Tournament started! Bracket ready.","success");}}>Start Tournament</Btn>
              <Btn v="danger" full onClick={()=>{if(window.confirm("Reset tournament to registration?")){setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[]});addAudit("DANGER","Tournament reset");toast("Tournament reset","success");}}}>Reset Tournament</Btn>
            </div>
          </Panel>
          <Panel style={{padding:"20px"}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Round Controls</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn v={paused?"success":"danger"} full onClick={()=>{setPaused(p=>!p);addAudit("ACTION",paused?"Resumed":"Paused");}}>
                {paused?"▶ Resume Round":"⏸ Pause Round"}
              </Btn>
              <Btn v="dark" full onClick={()=>{addAudit("ACTION","Force advance");toast("Force advancing","success");}}>Force Advance →</Btn>
              <Btn v="purple" full onClick={()=>{addAudit("ACTION","Reseeded - "+seedAlgo);toast("Lobbies reseeded","success");}}>Reseed Lobbies</Btn>
            </div>
          </Panel>'''

assert OLD_ROUND_TAB in content, "OLD_ROUND_TAB not found"
content = content.replace(OLD_ROUND_TAB, NEW_ROUND_TAB, 1)

# ── Verify brace balance ─────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
print(f"Brace balance: {opens} open, {closes} close, diff={opens-closes}")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Phase 3 done. File is now {content.count(chr(10))+1} lines.")
