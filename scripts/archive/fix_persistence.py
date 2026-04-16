with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

orig = len(content)

# ─── CHANGE 1: rtRef — add players:false back ────────────────────────────────
old = "const rtRef=useRef({tournament_state:false,"
new = "const rtRef=useRef({players:false,tournament_state:false,"
assert old in content, "rtRef not found"
content = content.replace(old, new, 1)
print("1. rtRef updated")

# ─── CHANGE 2: .in() list — add 'players' back ───────────────────────────────
old = ".in('key',['tournament_state','quick_clashes','announcement','season_config','org_sponsors','scheduled_events','audit_log','host_apps'])"
new = ".in('key',['players','tournament_state','quick_clashes','announcement','season_config','org_sponsors','scheduled_events','audit_log','host_apps'])"
assert old in content, ".in() not found"
content = content.replace(old, new, 1)
print("2. .in() list updated")

# ─── CHANGE 3: forEach — add players handler before tournament_state line ─────
# Find the line: if(row.key==='tournament_state'&&val){...}
# Insert players handler before it
old = "              if(row.key==='tournament_state'&&val){rtRef.current.tournament_state=true;setTournamentState(val);}"
new = ("              if(row.key==='players'&&Array.isArray(val)&&val.length>0){rtRef.current.players=true;setPlayers(val);hadPlayers=true;}\n"
       "              if(row.key==='tournament_state'&&val){rtRef.current.tournament_state=true;setTournamentState(val);}")
assert old in content, "forEach tournament_state line not found"
content = content.replace(old, new, 1)
print("3. forEach players handler added")

# ─── CHANGE 4: After forEach .then, add hadPlayers var + bootstrap call ──────
# The forEach is inside .then(function(res){ ... res.data.forEach(...); announcementInitRef.current=true; });
# We need to:
# a) declare hadPlayers before forEach
# b) after forEach, if !hadPlayers call bootstrap
old = "        if(!res.data)return;\n\n        res.data.forEach(function(row){"
new = ("        if(!res.data){bootstrapPlayersFromTable();return;}\n\n"
       "        var hadPlayers=false;\n\n        res.data.forEach(function(row){")
assert old in content, "res.data check not found"
content = content.replace(old, new, 1)
print("4a. hadPlayers var declared")

old = "        announcementInitRef.current=true;\n\n      });"
new = ("        announcementInitRef.current=true;\n\n"
       "        if(!hadPlayers)bootstrapPlayersFromTable();\n\n      });")
assert old in content, "announcementInitRef line not found"
content = content.replace(old, new, 1)
print("4b. bootstrap fallback call added")

# ─── CHANGE 5: realtime handler — add players key ────────────────────────────
old = "          if(key==='tournament_state'){rtRef.current.tournament_state=true;setTournamentState(val);}"
new = ("          if(key==='players'&&Array.isArray(val)&&val.length>0){rtRef.current.players=true;setPlayers(val);}\n"
       "          if(key==='tournament_state'){rtRef.current.tournament_state=true;setTournamentState(val);}")
assert old in content, "realtime tournament_state not found"
content = content.replace(old, new, 1)
print("5. realtime players handler added")

# ─── CHANGE 6: add bootstrapPlayersFromTable function before the main useEffect ─
# Insert before "  // ── Supabase shared state"
old = "  // ── Supabase shared state — single channel for all keys ──────────────"
new = (
    "  // ── Bootstrap players from players table (fallback when site_settings has none) ──\n"
    "  function bootstrapPlayersFromTable(){\n"
    "    if(!supabase.from)return;\n"
    "    supabase.from('players').select('*').order('season_pts',{ascending:false})\n"
    "      .then(function(res){\n"
    "        if(res.error||!res.data||!res.data.length)return;\n"
    "        var mapped=res.data.map(function(r){\n"
    "          return{\n"
    "            ...r,name:r.username,pts:r.season_pts||0,\n"
    "            avg:r.avg_placement!=null?Number(r.avg_placement):null,\n"
    "            riotId:r.riot_id||'',wins:r.wins||0,games:r.games||0,\n"
    "            top4:r.top4||0,rank:r.rank||'Iron',region:r.region||'EUW',\n"
    "            banned:false,dnpCount:0,notes:'',checkedIn:false,\n"
    "            clashHistory:[],sparkline:[],bestStreak:0,currentStreak:0,\n"
    "            tiltStreak:0,bestHaul:0,attendanceStreak:0,lastClashId:null,\n"
    "          };\n"
    "        });\n"
    "        setPlayers(mapped);\n"
    "        // Write bootstrap data to site_settings so future loads use it\n"
    "        supabase.from('site_settings').upsert({key:'players',value:JSON.stringify(mapped),updated_at:new Date().toISOString()}).then(function(){});\n"
    "      });\n"
    "  }\n\n"
    "  // ── Supabase shared state — single channel for all keys ──────────────"
)
assert old in content, "Supabase shared state comment not found"
content = content.replace(old, new, 1)
print("6. bootstrapPlayersFromTable() added")

# ─── CHANGE 7: Remove the old separate players table useEffect ───────────────
# This is now handled by bootstrapPlayersFromTable()
# Find and remove the block from "  // ── Load players from Supabase players table" to the checkedInIds effect
old_load = (
    "  // \u2500\u2500 Load players from Supabase players table (source of truth) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "\n"
    "  useEffect(function(){\n"
    "\n"
    "    if(!supabase.from)return;\n"
    "\n"
    "    supabase.from('players').select('*').order('season_pts',{ascending:false})\n"
    "\n"
    "      .then(function(res){\n"
    "\n"
    "        if(res.error){console.error('Failed to load players:',res.error);return;}\n"
    "\n"
    "        if(res.data&&res.data.length){\n"
    "\n"
    "          setPlayers(function(prev){\n"
    "\n"
    "            var prevById={};\n"
    "\n"
    "            (prev||[]).forEach(function(p){prevById[String(p.id)]=p;});\n"
    "\n"
    "            return res.data.map(function(r){\n"
    "\n"
    "              var prevP=prevById[String(r.id)]||{};\n"
    "\n"
    "              return{\n"
    "\n"
    "                ...r,\n"
    "\n"
    "                name:r.username,\n"
    "\n"
    "                pts:r.season_pts||0,\n"
    "\n"
    "                avg:r.avg_placement!=null?Number(r.avg_placement):null,\n"
    "\n"
    "                riotId:r.riot_id||'',\n"
    "\n"
    "                wins:r.wins||0,\n"
    "\n"
    "                games:r.games||0,\n"
    "\n"
    "                top4:r.top4||0,\n"
    "\n"
    "                rank:r.rank||'Iron',\n"
    "\n"
    "                region:r.region||'EUW',\n"
    "\n"
    "                checkedIn:prevP.checkedIn||false,\n"
    "\n"
    "              };\n"
    "\n"
    "            });\n"
    "\n"
    "          });\n"
    "\n"
    "        }\n"
    "\n"
    "      });\n"
    "\n"
    "  },[]);\n"
    "\n"
    "  // \u2500\u2500 Stamp checkedIn from tournamentState.checkedInIds onto players \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
)
new_load = "  // \u2500\u2500 Stamp checkedIn from tournamentState.checkedInIds onto players \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"

if old_load in content:
    content = content.replace(old_load, new_load, 1)
    print("7. Old players table useEffect removed")
else:
    print("7. WARNING: old load block not found - may have different whitespace")

# ─── CHANGE 8: add players write-back useEffect after host_apps one ──────────
old = "  },[hostApps]);\n\n  function navTo"
new = (
    "  },[hostApps]);\n\n"
    "  useEffect(function(){\n"
    "    if(rtRef.current.players){rtRef.current.players=false;return;}\n"
    "    if(supabase.from)supabase.from('site_settings').upsert({key:'players',value:JSON.stringify(players),updated_at:new Date().toISOString()}).then(function(){});\n"
    "  },[players]);\n\n"
    "  function navTo"
)
assert old in content, "hostApps end not found"
content = content.replace(old, new, 1)
print("8. players write-back useEffect added")

# ─── CHANGE 9: localStorage for scheduledEvents, auditLog, hostApps ──────────
# Add after the existing localStorage sync block (after tft-announcement line)
old = "  useEffect(function(){try{localStorage.setItem(\"tft-announcement\",announcement);}catch(e){}},[announcement]);"
new = (
    "  useEffect(function(){try{localStorage.setItem(\"tft-announcement\",announcement);}catch(e){}},[announcement]);\n"
    "  useEffect(function(){try{localStorage.setItem(\"tft-scheduled-events\",JSON.stringify(scheduledEvents));}catch(e){}},[scheduledEvents]);\n"
    "  useEffect(function(){try{localStorage.setItem(\"tft-audit-log\",JSON.stringify(auditLog));}catch(e){}},[auditLog]);\n"
    "  useEffect(function(){try{localStorage.setItem(\"tft-host-apps\",JSON.stringify(hostApps));}catch(e){}},[hostApps]);"
)
assert old in content, "tft-announcement localStorage not found"
content = content.replace(old, new, 1)
print("9. localStorage for scheduledEvents/auditLog/hostApps added")

# ─── CHANGE 10: Initialize scheduledEvents/auditLog/hostApps from localStorage ─
# Find their declarations and add localStorage init
old = "  const [scheduledEvents,setScheduledEvents]=useState([]);"
new = "  const [scheduledEvents,setScheduledEvents]=useState(()=>{try{var s=localStorage.getItem('tft-scheduled-events');return s?JSON.parse(s):[];}catch(e){return [];}});"
assert old in content, "scheduledEvents declaration not found"
content = content.replace(old, new, 1)

old = "  const [auditLog,setAuditLog]=useState([]);"
new = "  const [auditLog,setAuditLog]=useState(()=>{try{var s=localStorage.getItem('tft-audit-log');return s?JSON.parse(s):[];}catch(e){return [];}});"
assert old in content, "auditLog declaration not found"
content = content.replace(old, new, 1)

old = "  const [hostApps,setHostApps]=useState([]);"
new = "  const [hostApps,setHostApps]=useState(()=>{try{var s=localStorage.getItem('tft-host-apps');return s?JSON.parse(s):[];}catch(e){return [];}});"
assert old in content, "hostApps declaration not found"
content = content.replace(old, new, 1)
print("10. scheduledEvents/auditLog/hostApps get localStorage init")

# ─── Final checks ─────────────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
print(f"\nBrace balance: {opens-closes}")
print(f"bootstrapPlayersFromTable: {content.count('bootstrapPlayersFromTable')} refs")
print(f"players in site_settings .in(): {'players' in content[content.find('.in('):content.find('.in(')+200]}")
players_wb = "key:'players',value:JSON.stringify(players)"
print(f"players write-back: {content.count(players_wb)} refs")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"\nDone. Size change: {len(content)-orig:+d} chars")
