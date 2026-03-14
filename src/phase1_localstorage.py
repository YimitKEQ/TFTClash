"""
Phase 1: localStorage Persistence
- Lazy-init players, currentUser, notifications from localStorage
- Add tournamentState with lazy-init + sync
- Add useEffect syncs for all 4 state vars
- Pass tournamentState/setTournamentState to BracketScreen, HomeScreen, AdminPanel
- Add Reset Season Data button to AdminPanel season tab
"""

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Replace state declarations in TFTClash() ─────────────────────────────
OLD_STATE = '''  const [screen,setScreen]=useState("home");
  const [players,setPlayers]=useState(SEED);
  const [isAdmin,setIsAdmin]=useState(false);
  const [notifications,setNotifications]=useState(NOTIF_SEED);
  const [toasts,setToasts]=useState([]);
  const [disputes]=useState([]);
  const [announcement,setAnnouncement]=useState("⚡ Clash #14 is LIVE NOW - Round 1 underway! 24 players across 3 lobbies. Good luck!");
  const [profilePlayer,setProfilePlayer]=useState(null);
  // Auth state
  const [currentUser,setCurrentUser]=useState(null); // null = guest
  const [authScreen,setAuthScreen]=useState(null); // "login" | "signup" | null'''

NEW_STATE = '''  const [screen,setScreen]=useState("home");
  const [players,setPlayers]=useState(()=>{try{const s=localStorage.getItem("tft-players");return s?JSON.parse(s):SEED;}catch{return SEED;}});
  const [isAdmin,setIsAdmin]=useState(false);
  const [notifications,setNotifications]=useState(()=>{try{const s=localStorage.getItem("tft-notifications");return s?JSON.parse(s):NOTIF_SEED;}catch{return NOTIF_SEED;}});
  const [toasts,setToasts]=useState([]);
  const [disputes]=useState([]);
  const [announcement,setAnnouncement]=useState("⚡ Clash #14 is LIVE NOW - Round 1 underway! 24 players across 3 lobbies. Good luck!");
  const [profilePlayer,setProfilePlayer]=useState(null);
  const [tournamentState,setTournamentState]=useState(()=>{try{const s=localStorage.getItem("tft-tournament");return s?JSON.parse(s):{phase:"registration",round:1,lobbies:[],lockedLobbies:[]};}catch{return {phase:"registration",round:1,lobbies:[],lockedLobbies:[]};}});
  // Auth state
  const [currentUser,setCurrentUser]=useState(()=>{try{const s=localStorage.getItem("tft-user");return s?JSON.parse(s):null;}catch{return null;}}); // null = guest
  const [authScreen,setAuthScreen]=useState(null); // "login" | "signup" | null'''

assert OLD_STATE in content, "OLD_STATE not found"
content = content.replace(OLD_STATE, NEW_STATE, 1)

# ── 2. Add useEffect syncs after markAllRead/toast/removeToast functions ─────
OLD_MARK = '''  function markAllRead(){setNotifications(ns=>ns.map(n=>({...n,read:true})));}
  function toast(msg,type){const id=Date.now()+Math.random();setToasts(ts=>[...ts,{id,msg,type}]);}
  function removeToast(id){setToasts(ts=>ts.filter(t=>t.id!==id));}'''

NEW_MARK = '''  function markAllRead(){setNotifications(ns=>ns.map(n=>({...n,read:true})));}
  function toast(msg,type){const id=Date.now()+Math.random();setToasts(ts=>[...ts,{id,msg,type}]);}
  function removeToast(id){setToasts(ts=>ts.filter(t=>t.id!==id));}
  // localStorage sync
  useEffect(()=>{try{localStorage.setItem("tft-players",JSON.stringify(players));}catch{}},[players]);
  useEffect(()=>{try{localStorage.setItem("tft-notifications",JSON.stringify(notifications));}catch{}},[notifications]);
  useEffect(()=>{try{localStorage.setItem("tft-tournament",JSON.stringify(tournamentState));}catch{}},[tournamentState]);
  useEffect(()=>{try{if(currentUser)localStorage.setItem("tft-user",JSON.stringify(currentUser));else localStorage.removeItem("tft-user");}catch{}},[currentUser]);'''

assert OLD_MARK in content, "OLD_MARK not found"
content = content.replace(OLD_MARK, NEW_MARK, 1)

# ── 3. Update handleLogout to also clear localStorage user ───────────────────
OLD_LOGOUT = '''  function handleLogout(){
    setCurrentUser(null);
    setScreen("home");
  }'''

NEW_LOGOUT = '''  function handleLogout(){
    setCurrentUser(null);
    localStorage.removeItem("tft-user");
    setScreen("home");
  }'''

assert OLD_LOGOUT in content, "OLD_LOGOUT not found"
content = content.replace(OLD_LOGOUT, NEW_LOGOUT, 1)

# ── 4. Pass tournamentState to BracketScreen ─────────────────────────────────
OLD_BRACKET_RENDER = '''        {screen==="bracket"    &&<BracketScreen players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo}/>}'''
NEW_BRACKET_RENDER = '''        {screen==="bracket"    &&<BracketScreen players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState}/>}'''

assert OLD_BRACKET_RENDER in content, "OLD_BRACKET_RENDER not found"
content = content.replace(OLD_BRACKET_RENDER, NEW_BRACKET_RENDER, 1)

# ── 5. Pass tournamentState to HomeScreen ────────────────────────────────────
OLD_HOME_RENDER = '''        {screen==="home"       &&<HomeScreen players={players} setPlayers={setPlayers} setScreen={navTo} toast={toast} announcement={announcement} setProfilePlayer={setProfilePlayer} currentUser={currentUser} onAuthClick={(m)=>setAuthScreen(m)}/>}'''
NEW_HOME_RENDER = '''        {screen==="home"       &&<HomeScreen players={players} setPlayers={setPlayers} setScreen={navTo} toast={toast} announcement={announcement} setProfilePlayer={setProfilePlayer} currentUser={currentUser} onAuthClick={(m)=>setAuthScreen(m)} tournamentState={tournamentState} setTournamentState={setTournamentState}/>}'''

assert OLD_HOME_RENDER in content, "OLD_HOME_RENDER not found"
content = content.replace(OLD_HOME_RENDER, NEW_HOME_RENDER, 1)

# ── 6. Pass tournamentState to AdminPanel ────────────────────────────────────
OLD_ADMIN_RENDER = '''        {screen==="admin"      &&isAdmin&&<AdminPanel players={players} setPlayers={setPlayers} toast={toast} setAnnouncement={setAnnouncement} setScreen={navTo}/>}'''
NEW_ADMIN_RENDER = '''        {screen==="admin"      &&isAdmin&&<AdminPanel players={players} setPlayers={setPlayers} toast={toast} setAnnouncement={setAnnouncement} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState}/>}'''

assert OLD_ADMIN_RENDER in content, "OLD_ADMIN_RENDER not found"
content = content.replace(OLD_ADMIN_RENDER, NEW_ADMIN_RENDER, 1)

# ── 7. Update AdminPanel function signature ──────────────────────────────────
OLD_ADMIN_SIG = '''function AdminPanel({players,setPlayers,toast,setAnnouncement,setScreen}){'''
NEW_ADMIN_SIG = '''function AdminPanel({players,setPlayers,toast,setAnnouncement,setScreen,tournamentState,setTournamentState}){'''

assert OLD_ADMIN_SIG in content, "OLD_ADMIN_SIG not found"
content = content.replace(OLD_ADMIN_SIG, NEW_ADMIN_SIG, 1)

# ── 8. Add "Reset Season Data" button to AdminPanel season tab ────────────────
# Find the Danger Zone panel and add a third button
OLD_DANGER = '''                <Btn v="danger" full onClick={()=>{if(window.confirm("Clear ALL players?")){setPlayers([]);addAudit("DANGER","Players cleared");}}}>Clear All Players</Btn>
              </div>'''

NEW_DANGER = '''                <Btn v="danger" full onClick={()=>{if(window.confirm("Clear ALL players?")){setPlayers([]);addAudit("DANGER","Players cleared");}}}>Clear All Players</Btn>
                <Btn v="danger" full onClick={()=>{if(window.confirm("Reset season data? This will clear all points and tournament state.")){setPlayers(ps=>ps.map(p=>({...p,pts:0,wins:0,top4:0,games:0,avg:"0",bestStreak:0,currentStreak:0,tiltStreak:0,bestHaul:0,clashHistory:[],sparkline:[]})));setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[]});localStorage.removeItem("tft-players");localStorage.removeItem("tft-tournament");addAudit("DANGER","Season data reset");toast("Season data reset","success");}}}>Reset Season Data</Btn>
              </div>'''

assert OLD_DANGER in content, "OLD_DANGER not found"
content = content.replace(OLD_DANGER, NEW_DANGER, 1)

# ── Verify brace balance ─────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
print(f"Brace balance: {opens} open, {closes} close, diff={opens-closes}")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Phase 1 done. File is now {content.count(chr(10))+1} lines.")
