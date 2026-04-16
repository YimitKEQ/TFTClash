with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

orig_len = len(content)

# ── 1. Default tournamentState: add checkedInIds:[] ───────────────────────────
old = '{phase:"registration",round:1,lobbies:[],lockedLobbies:[]}'
new = '{phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[]}'
content = content.replace(old, new)
print(f"1. tournamentState defaults updated: {content.count('checkedInIds:[]')} occurrences")

# ── 2. Players table load: preserve existing checkedIn + add merge effect ──────
old_block = (
    '  // \u2500\u2500 Load players from Supabase players table (source of truth) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  useEffect(function(){\n'
    '    if(!supabase.from)return;\n'
    '    supabase.from(\'players\').select(\'*\').order(\'season_pts\',{ascending:false})\n'
    '      .then(function(res){\n'
    '        if(res.error){console.error(\'Failed to load players:\',res.error);return;}\n'
    '        if(res.data&&res.data.length){\n'
    '          setPlayers(res.data.map(function(r){\n'
    '            return{\n'
    '              ...r,\n'
    '              name:r.username,\n'
    '              pts:r.season_pts||0,\n'
    '              avg:r.avg_placement!=null?Number(r.avg_placement):null,\n'
    '              riotId:r.riot_id||\'\',\n'
    '              wins:r.wins||0,\n'
    '              games:r.games||0,\n'
    '              top4:r.top4||0,\n'
    '              rank:r.rank||\'Iron\',\n'
    '              region:r.region||\'EUW\',\n'
    '            };\n'
    '          }));\n'
    '        }\n'
    '      });\n'
    '  },[]);'
)

new_block = (
    '  // \u2500\u2500 Load players from Supabase players table (source of truth) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  useEffect(function(){\n'
    '    if(!supabase.from)return;\n'
    '    supabase.from(\'players\').select(\'*\').order(\'season_pts\',{ascending:false})\n'
    '      .then(function(res){\n'
    '        if(res.error){console.error(\'Failed to load players:\',res.error);return;}\n'
    '        if(res.data&&res.data.length){\n'
    '          setPlayers(function(prev){\n'
    '            var prevById={};\n'
    '            (prev||[]).forEach(function(p){prevById[String(p.id)]=p;});\n'
    '            return res.data.map(function(r){\n'
    '              var prevP=prevById[String(r.id)]||{};\n'
    '              return{\n'
    '                ...r,\n'
    '                name:r.username,\n'
    '                pts:r.season_pts||0,\n'
    '                avg:r.avg_placement!=null?Number(r.avg_placement):null,\n'
    '                riotId:r.riot_id||\'\',\n'
    '                wins:r.wins||0,\n'
    '                games:r.games||0,\n'
    '                top4:r.top4||0,\n'
    '                rank:r.rank||\'Iron\',\n'
    '                region:r.region||\'EUW\',\n'
    '                checkedIn:prevP.checkedIn||false,\n'
    '              };\n'
    '            });\n'
    '          });\n'
    '        }\n'
    '      });\n'
    '  },[]);\n'
    '  // \u2500\u2500 Stamp checkedIn from tournamentState.checkedInIds onto players \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    '  useEffect(function(){\n'
    '    var ids=new Set((tournamentState.checkedInIds||[]).map(String));\n'
    '    setPlayers(function(ps){return ps.map(function(p){return{...p,checkedIn:ids.has(String(p.id))};});});\n'
    '  },[tournamentState.checkedInIds]);'
)

# Normalize line endings for comparison
old_norm = old_block.replace('\r\n', '\n')
content_norm = content.replace('\r\n', '\n')

if old_norm in content_norm:
    # Replace in normalized content, then restore CRLF
    content_norm = content_norm.replace(old_norm, new_block, 1)
    content = content_norm.replace('\n', '\r\n')
    print("2. Players load + merge effect updated OK")
else:
    # Try without line ending normalization
    if old_block in content:
        content = content.replace(old_block, new_block, 1)
        print("2. Players load + merge effect updated OK (direct)")
    else:
        print("2. ERROR: players load block not found - checking partial match")
        # Check if the first line exists
        first_line = '  // \u2500\u2500 Load players from Supabase players table (source of truth)'
        idx = content.find(first_line)
        if idx >= 0:
            print(f"   Found start at char {idx}, context: {repr(content[idx:idx+100])}")
        else:
            print("   Start line not found either")

# Re-read after possible CRLF restoration
with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Re-read to confirm
with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 3. handleCheckIn ─────────────────────────────────────────────────────────
search3 = 'setPlayers(ps=>ps.map(p=>p.id===linkedPlayer.id?{...p,checkedIn:true}:p));\n    toast("You\'re checked in! Good luck, "+linkedPlayer.name+" \u2713","success");\n  }'
replace3 = 'setPlayers(ps=>ps.map(p=>p.id===linkedPlayer.id?{...p,checkedIn:true}:p));\n    setTournamentState(function(ts){var ids=ts.checkedInIds||[];var sid=String(linkedPlayer.id);return ids.includes(sid)?ts:{...ts,checkedInIds:[...ids,sid]};});\n    toast("You\'re checked in! Good luck, "+linkedPlayer.name+" \u2713","success");\n  }'
search3n = search3.replace('\r\n','\n')
content_n = content.replace('\r\n','\n')
if search3n in content_n:
    content = content_n.replace(search3n, replace3, 1).replace('\n','\r\n')
    print("3. handleCheckIn updated OK")
elif search3 in content:
    content = content.replace(search3, replace3, 1)
    print("3. handleCheckIn updated OK (CRLF)")
else:
    print("3. ERROR: handleCheckIn target not found")

# Re-read
with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 4. Admin Check In All ─────────────────────────────────────────────────────
s4 = 'setPlayers(ps=>ps.map(p=>({...p,checkedIn:true})));addAudit("ACTION","Check In All");toast("All players checked in","success");'
r4 = 'setPlayers(ps=>ps.map(p=>({...p,checkedIn:true})));setTournamentState(function(ts){return{...ts,checkedInIds:players.map(function(p){return String(p.id);})};});addAudit("ACTION","Check In All");toast("All players checked in","success");'
if s4 in content:
    content = content.replace(s4, r4, 1)
    print("4. Check In All updated OK")
else:
    print("4. ERROR: Check In All not found")

# ── 5. Admin Clear Check-In ───────────────────────────────────────────────────
s5 = 'setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));addAudit("ACTION","Check Out All");toast("All players checked out","success");'
r5 = 'setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));setTournamentState(function(ts){return{...ts,checkedInIds:[]};});addAudit("ACTION","Check Out All");toast("All players checked out","success");'
if s5 in content:
    content = content.replace(s5, r5, 1)
    print("5. Clear Check-In updated OK")
else:
    print("5. ERROR: Clear Check-In not found")

# ── 6. ban(): remove from checkedInIds ───────────────────────────────────────
s6 = 'function ban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:true,checkedIn:false}:p));addAudit("WARN","Banned: "+name);toast(name+" banned","success");}'
r6 = 'function ban(id,name){setPlayers(ps=>ps.map(p=>p.id===id?{...p,banned:true,checkedIn:false}:p));setTournamentState(function(ts){return{...ts,checkedInIds:(ts.checkedInIds||[]).filter(function(cid){return String(cid)!==String(id);})};});addAudit("WARN","Banned: "+name);toast(name+" banned","success");}'
if s6 in content:
    content = content.replace(s6, r6, 1)
    print("6. ban() updated OK")
else:
    print("6. ERROR: ban() not found")

# ── 7. markDNP isDQ ───────────────────────────────────────────────────────────
s7 = '      return{...p,dnpCount:newCount,banned:isDQ?true:p.banned,checkedIn:isDQ?false:p.checkedIn};'
r7 = '      if(isDQ){setTournamentState(function(ts){return{...ts,checkedInIds:(ts.checkedInIds||[]).filter(function(cid){return String(cid)!==String(id);})};});} return{...p,dnpCount:newCount,banned:isDQ?true:p.banned,checkedIn:isDQ?false:p.checkedIn};'
if s7 in content:
    content = content.replace(s7, r7, 1)
    print("7. markDNP updated OK")
else:
    print("7. ERROR: markDNP not found")

# ── 8. Reset to Registration ──────────────────────────────────────────────────
s8 = 'setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[]});addAudit("DANGER","Tournament reset")'
r8 = 'setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[]});setPlayers(ps=>ps.map(p=>({...p,checkedIn:false})));addAudit("DANGER","Tournament reset")'
if s8 in content:
    content = content.replace(s8, r8, 1)
    print("8. Reset to Registration updated OK")
else:
    print("8. ERROR: Reset to Registration not found")

# ── 9. Full Season Reset ──────────────────────────────────────────────────────
s9 = 'setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[]});setScheduledEvents'
r9 = 'setTournamentState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[]});setScheduledEvents'
if s9 in content:
    content = content.replace(s9, r9, 1)
    print("9. Full Season Reset updated OK")
else:
    print("9. ERROR: Full Season Reset not found")

# ── Final checks ──────────────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
print(f"\nBrace balance: {opens} opens, {closes} closes, diff={opens-closes}")
print(f"checkedInIds appears {content.count('checkedInIds')} times")
print(f"tournamentState.checkedInIds appears {content.count('tournamentState.checkedInIds')} times")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Done. Size change: {len(content)-orig_len:+d} chars")
