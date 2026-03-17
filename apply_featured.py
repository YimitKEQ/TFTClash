#!/usr/bin/env python3
"""Apply Featured screen + enhanced HostDashboard to App.jsx"""

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Add "Featured" to DESKTOP_PRIMARY ──────────────────────────────────────
old1 = '    {id:"results",label:"Results"},\n\n    {id:"hof",label:"Hall of Fame"},'
new1 = '    {id:"results",label:"Results"},\n\n    {id:"featured",label:"Featured"},\n\n    {id:"hof",label:"Hall of Fame"},'
assert content.count(old1) == 1, f"old1 not found uniquely: {content.count(old1)}"
content = content.replace(old1, new1, 1)

# ── 2. Add "Featured" to DRAWER_ITEMS ─────────────────────────────────────────
old2 = '    {id:"aegis-showcase",icon:"\U0001f3c6",label:"AEGIS #151 \u2014 Client Demo"},'
new2 = '    {id:"featured",icon:"\u2b50",label:"Featured Events"},\n\n    {id:"aegis-showcase",icon:"\U0001f3c6",label:"AEGIS #151 \u2014 Client Demo"},'
assert content.count(old2) == 1, f"old2 not found uniquely: {content.count(old2)}"
content = content.replace(old2, new2, 1)

# ── 3. Add "featured" to DESKTOP_MORE so it highlights in "More" dropdown too ─
old3 = '    {id:"archive",label:"Archive"},'
new3 = '    {id:"featured",label:"Featured Events"},\n\n    {id:"archive",label:"Archive"},'
# Only replace first occurrence (inside DESKTOP_MORE)
assert content.count(old3) == 1, f"old3 count: {content.count(old3)}"
content = content.replace(old3, new3, 1)

# ── 4. Add "featured" to safeScreens ──────────────────────────────────────────
old4 = '"admin","roster"'
new4 = '"admin","roster","featured"'
assert content.count(old4) == 1, f"old4 not found"
content = content.replace(old4, new4, 1)

# ── 5. Add featured to "more active" screens list ─────────────────────────────
old5 = 'const active=isMore?["hof","archive","aegis-showcase","scrims","admin","milestones","pricing","account","challenges","recap","host-apply","host-dashboard","rules","faq"].includes(screen)'
new5 = 'const active=isMore?["hof","archive","aegis-showcase","scrims","admin","milestones","pricing","account","challenges","recap","host-apply","host-dashboard","rules","faq","featured"].includes(screen)'
assert content.count(old5) == 1, f"old5 count: {content.count(old5)}"
content = content.replace(old5, new5, 1)

# ── 6. Add featured screen render ─────────────────────────────────────────────
old6 = '        {screen==="aegis-showcase"&&<AegisShowcaseScreen setScreen={navTo}/>}'
new6 = '        {screen==="featured"&&<FeaturedScreen setScreen={navTo} currentUser={currentUser} onAuthClick={function(m){setAuthScreen(m);}} toast={toast}/>}\n\n        {screen==="aegis-showcase"&&<AegisShowcaseScreen setScreen={navTo}/>}'
assert content.count(old6) == 1, f"old6 count: {content.count(old6)}"
content = content.replace(old6, new6, 1)

# ── 7. Insert FEATURED_EVENTS + FeaturedScreen before AegisShowcaseScreen ─────
FEATURED_CODE = r"""// ─── FEATURED EVENTS SCREEN ──────────────────────────────────────────────────

var FEATURED_EVENTS=[
  {id:"clash-kings-3",name:"Clash Kings Invitational #3",host:"ClashKings",sponsor:"RiotBar",status:"live",date:"Mar 17 2026",time:"NOW",format:"Double Elim",size:16,registered:16,prizePool:"$100",region:"EUW",description:"Invite-only invitational for top EUW players. Live brackets and real-time commentary.",tags:["Invite Only","EUW","Broadcast"],color:"#E8A838",logo:"👑",screen:null},
  {id:"aegis-152",name:"Aegis Esports TFT Showdown #152",host:"Aegis Esports",sponsor:"ZenMarket",status:"upcoming",date:"Mar 22 2026",time:"8:00 PM EST",format:"Swiss (6 rounds)",size:64,registered:47,prizePool:"$200",region:"NA/LATAM",description:"The premier weekly TFT series. Open to all ranked players. Top 8 earn prizes and broadcast coverage.",tags:["Broadcast","Prizes","Open"],color:"#9B72CF",logo:"\uD83C\uDFC6",screen:"aegis-showcase"},
  {id:"tft-academy-8",name:"TFT Academy Weekly #8",host:"TFT Academy",sponsor:null,status:"upcoming",date:"Mar 21 2026",time:"6:00 PM CET",format:"Single Lobby",size:8,registered:6,prizePool:null,region:"EMEA",description:"Community learning series for Diamond+ players. Coaches analyze every game post-tournament.",tags:["Educational","EMEA","Diamond+"],color:"#4ECDC4",logo:"\uD83C\uDF93",screen:null},
  {id:"aegis-151",name:"Aegis Esports TFT Showdown #151",host:"Aegis Esports",sponsor:"ZenMarket",status:"completed",date:"Mar 15 2026",format:"Swiss",size:64,registered:64,prizePool:"$200",region:"NA/LATAM",champion:"D0PA#111",top4:["D0PA#111","LC Abyss#CAPO","vnck#NA1","Ken Kitade"],logo:"\uD83C\uDFC6",screen:"aegis-showcase"},
  {id:"tft-community-feb",name:"TFT Community Open — February",host:"TFT Community",sponsor:null,status:"completed",date:"Feb 28 2026",format:"Swiss",size:32,registered:32,prizePool:null,champion:"Levitate",top4:["Levitate","Zounderkite","Uri","BingBing"],logo:"\u26A1",screen:null},
  {id:"clash-kings-2",name:"Clash Kings Invitational #2",host:"ClashKings",sponsor:"RiotBar",status:"completed",date:"Feb 14 2026",format:"Double Elim",size:16,registered:16,prizePool:"$100",region:"EUW",champion:"StarForge",top4:["StarForge","IronMask","DawnBreaker","GhostRider"],logo:"\uD83D\uDC51",screen:null},
];

function FeaturedScreen({setScreen,currentUser,onAuthClick,toast}){
  var [filter,setFilter]=useState("all");
  var live=FEATURED_EVENTS.filter(function(e){return e.status==="live";});
  var upcoming=FEATURED_EVENTS.filter(function(e){return e.status==="upcoming";});
  var past=FEATURED_EVENTS.filter(function(e){return e.status==="completed";});
  var active=live.concat(upcoming);
  var shown=filter==="all"?active:filter==="live"?live:upcoming;

  return(
    <div className="page wrap">

      {/* Header */}
      <div style={{marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,flexWrap:"wrap"}}>
          <h1 style={{color:"#F2EDE4",fontSize:24,fontWeight:700,margin:0}}>Featured Events</h1>
          {live.length>0&&(
            <span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>
              {live.length} LIVE NOW
            </span>
          )}
        </div>
        <p style={{color:"#BECBD9",fontSize:13,margin:0}}>Partner tournaments, community clashes and special events. Free to watch, free to enter.</p>
      </div>

      {/* Filter tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[["all","All Active"],["live","Live Now"],["upcoming","Upcoming"]].map(function(arr){
          var f=arr[0],label=arr[1];
          return(
            <button key={f} onClick={function(){setFilter(f)}}
              style={{background:filter===f?"rgba(155,114,207,.2)":"rgba(255,255,255,.04)",border:"1px solid "+(filter===f?"rgba(155,114,207,.5)":"rgba(242,237,228,.08)"),borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,color:filter===f?"#C4B5FD":"#BECBD9",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Hero — first live event */}
      {live.length>0&&(function(){
        var hero=live[0];
        return(
          <div style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid rgba(232,168,56,.3)",borderRadius:16,overflow:"hidden",marginBottom:20,cursor:hero.screen?"pointer":"default"}}
            onClick={function(){if(hero.screen){setScreen(hero.screen);}}}>
            <div style={{background:"rgba(232,168,56,.07)",borderBottom:"1px solid rgba(232,168,56,.18)",padding:"9px 18px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(82,196,124,.15)",border:"1px solid rgba(82,196,124,.35)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE NOW
              </span>
              <span style={{color:"#E8A838",fontWeight:600,fontSize:12,marginLeft:4}}>Round in progress</span>
            </div>
            <div style={{padding:"20px 22px"}}>
              <div style={{display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{width:52,height:52,borderRadius:14,background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{hero.logo}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:18,color:"#F2EDE4",marginBottom:4}}>{hero.name}</div>
                  <div style={{fontSize:12,color:"#9B72CF",fontWeight:600,marginBottom:10}}>Hosted by {hero.host}{hero.sponsor?" \u00b7 Presented by "+hero.sponsor:""}</div>
                  <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.5,marginBottom:14}}>{hero.description}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {hero.tags.map(function(t){return(
                      <span key={t} style={{background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.25)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#C4B5FD"}}>{t}</span>
                    );})}
                    <span style={{background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.2)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#E8A838"}}>{hero.registered}/{hero.size} players</span>
                    {hero.prizePool&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#4ECDC4"}}>{"\uD83D\uDCB0"} {hero.prizePool}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Event grid */}
      {shown.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14,marginBottom:32}}>
          {shown.map(function(ev){
            var isLive=ev.status==="live";
            return(
              <div key={ev.id}
                style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid rgba(155,114,207,.2)",borderRadius:14,overflow:"hidden",cursor:ev.screen?"pointer":"default",transition:"border-color .2s"}}
                onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(155,114,207,.5)";}}
                onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(155,114,207,.2)";}}
                onClick={function(){if(ev.screen){setScreen(ev.screen);}}}>
                <div style={{padding:"16px 18px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                    <div style={{width:38,height:38,borderRadius:10,background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ev.logo}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#F2EDE4",lineHeight:1.3,marginBottom:2}}>{ev.name}</div>
                      <div style={{fontSize:11,color:"#9B72CF",fontWeight:600}}>{ev.host}</div>
                    </div>
                    <div style={{flexShrink:0}}>
                      {isLive?(
                        <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 8px",fontSize:9,fontWeight:700,color:"#6EE7B7"}}>
                          <span style={{width:4,height:4,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
                        </span>
                      ):(
                        <span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 8px",fontSize:9,fontWeight:700,color:"#4ECDC4"}}>UPCOMING</span>
                      )}
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.5,marginBottom:12}}>{ev.description}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                    <span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#BECBD9"}}>{"📅"} {ev.date}</span>
                    {ev.time&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#BECBD9"}}>{"⏰"} {ev.time}</span>}
                    {ev.region&&<span style={{background:"rgba(255,255,255,.04)",borderRadius:6,padding:"3px 8px",fontSize:10,color:"#BECBD9"}}>{"🗺"} {ev.region}</span>}
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:10,color:"#BECBD9"}}>Registration</span>
                      <span style={{fontSize:10,fontWeight:700,color:"#E8A838"}}>{ev.registered}/{ev.size}</span>
                    </div>
                    <Bar val={ev.registered} max={ev.size} color="#E8A838" h={4}/>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {ev.prizePool&&<span style={{background:"rgba(78,205,196,.08)",border:"1px solid rgba(78,205,196,.2)",borderRadius:20,padding:"3px 8px",fontSize:10,fontWeight:700,color:"#4ECDC4"}}>{ev.prizePool}</span>}
                    {ev.sponsor&&<span style={{background:"rgba(155,114,207,.08)",border:"1px solid rgba(155,114,207,.2)",borderRadius:20,padding:"3px 8px",fontSize:10,fontWeight:600,color:"#C4B5FD"}}>by {ev.sponsor}</span>}
                    {ev.tags&&ev.tags.slice(0,2).map(function(t){return(
                      <span key={t} style={{background:"rgba(255,255,255,.03)",borderRadius:20,padding:"2px 7px",fontSize:9,color:"#9AAABF"}}>{t}</span>
                    );})}
                    {ev.screen&&(
                      <button style={{marginLeft:"auto",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.3)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#C4B5FD",cursor:"pointer",fontFamily:"inherit"}}
                        onClick={function(e){e.stopPropagation();setScreen(ev.screen);}}>
                        View {"→"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shown.length===0&&(
        <div style={{textAlign:"center",padding:"48px 24px",color:"#BECBD9",marginBottom:24}}>
          <div style={{fontSize:32,marginBottom:12}}>{"📅"}</div>
          <div style={{fontSize:14}}>No events matching this filter right now.</div>
        </div>
      )}

      {/* Past Events */}
      {past.length>0&&(
        <div style={{marginBottom:32}}>
          <h3 style={{color:"#F2EDE4",fontSize:15,fontWeight:700,marginBottom:14}}>Past Events</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {past.map(function(ev){
              return(
                <div key={ev.id}
                  style={{background:"#111827",border:"1px solid rgba(242,237,228,.06)",borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,cursor:ev.screen?"pointer":"default",transition:"border-color .2s"}}
                  onMouseEnter={function(e){if(ev.screen)e.currentTarget.style.borderColor="rgba(155,114,207,.3)";}}
                  onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(242,237,228,.06)";}}
                  onClick={function(){if(ev.screen){setScreen(ev.screen);}}}>
                  <div style={{fontSize:20,flexShrink:0}}>{ev.logo}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4",marginBottom:2}}>{ev.name}</div>
                    <div style={{fontSize:11,color:"#BECBD9"}}>{"📅"} {ev.date} {"·"} {ev.registered} players {"·"} {ev.format}</div>
                  </div>
                  {ev.champion&&(
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:10,color:"#BECBD9",marginBottom:2}}>Champion</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#E8A838"}}>{"🏆"} {ev.champion}</div>
                    </div>
                  )}
                  {ev.screen&&<span style={{fontSize:12,color:"#9B72CF",flexShrink:0}}>{"→"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Become a Host CTA */}
      <div style={{background:"linear-gradient(135deg,rgba(155,114,207,.08),rgba(78,205,196,.05))",border:"1px solid rgba(155,114,207,.2)",borderRadius:16,padding:"28px 24px",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:10}}>{"🎮"}</div>
        <h3 style={{color:"#F2EDE4",fontSize:18,fontWeight:700,marginBottom:8}}>Run Your Own Tournament</h3>
        <p style={{fontSize:13,color:"#BECBD9",lineHeight:1.7,marginBottom:20,maxWidth:420,margin:"0 auto 20px"}}>
          Get featured here. Create and manage TFT tournaments with our full host suite — brackets, registration, standings, and more.
        </p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn v="primary" onClick={function(){currentUser?setScreen("host-apply"):onAuthClick("signup");}}>Apply to Host {"→"}</Btn>
          <Btn v="dark" onClick={function(){setScreen("pricing");}}>View Host Plans</Btn>
        </div>
      </div>

    </div>
  );
}

"""

old7 = 'function AegisShowcaseScreen({setScreen}){'
assert content.count(old7) == 1, f"old7 count: {content.count(old7)}"
content = content.replace(old7, FEATURED_CODE + old7, 1)

# ── 8. Replace HostDashboardScreen with enhanced version ─────────────────────
old8_start = '// ─── HOST DASHBOARD ───────────────────────────────────────────────────────────\n\nfunction HostDashboardScreen({currentUser,players,toast,setScreen,hostApps}){'
# Find end of HostDashboardScreen function
idx_start = content.find(old8_start)
assert idx_start != -1, "HostDashboard start not found"

# Find the closing of this function — look for the pattern that ends the function
# The function ends with:  }\n\n}\n\n\n\n// ─── (next section)
# Let's find it by looking for the next function comment after it
idx_aegis_fn = content.find('\nfunction AegisShowcaseScreen', idx_start)
assert idx_aegis_fn != -1

# Everything between idx_start and the blank lines before AegisShowcaseScreen is old HostDashboard
# Find the end: some blank lines then AegisShowcaseScreen
# The old HostDashboardScreen ends with a closing brace before that
old8_end_search = content[idx_start:idx_aegis_fn]
# The old block ends just before AegisShowcaseScreen
old_host_block = content[idx_start:idx_aegis_fn]

NEW_HOST = r"""// ─── HOST DASHBOARD ───────────────────────────────────────────────────────────

var HOST_SEED_TOURNAMENTS=[
  {id:1,name:"Weekly TFT Clash #12",date:"Mar 17 2026",size:32,registered:28,status:"live",invite:false,entryFee:"",rules:"EMEA rulebook. 4 lobbies, top 2 advance. Swiss tiebreakers.",approved:true},
  {id:2,name:"Weekly TFT Clash #13",date:"Mar 24 2026",size:32,registered:14,status:"upcoming",invite:false,entryFee:"",rules:"",approved:true},
  {id:3,name:"Invite Showdown — March",date:"Mar 20 2026",size:8,registered:8,status:"upcoming",invite:true,entryFee:"",rules:"Invite only. 1 lobby, 3 games, cumulative points.",approved:true},
];

function HostDashboardScreen({currentUser,players,toast,setScreen,hostApps}){
  var [tab,setTab]=useState("overview");
  var [showCreate,setShowCreate]=useState(false);
  var [tName,setTName]=useState("");
  var [tDate,setTDate]=useState("");
  var [tSize,setTSize]=useState("16");
  var [tInvite,setTInvite]=useState(false);
  var [tEntryFee,setTEntryFee]=useState("");
  var [tRules,setTRules]=useState("");
  var [tournaments,setTournaments]=useState(HOST_SEED_TOURNAMENTS);
  var [brandName,setBrandName]=useState((currentUser&&currentUser.username)||"My Org");
  var [brandLogo,setBrandLogo]=useState("🎮");
  var [brandColor,setBrandColor]=useState("#9B72CF");
  var [brandBio,setBrandBio]=useState("");
  var [brandSaved,setBrandSaved]=useState(false);
  var [announceMsg,setAnnounceMsg]=useState("");
  var [announceTo,setAnnounceTo]=useState("all");
  var [announcements,setAnnouncements]=useState([
    {id:1,to:"all",msg:"Welcome to Weekly TFT Clash! Check-in opens 30 min before start.",sentAt:"Mar 17 2026 7:30 PM"},
  ]);
  var [selectedT,setSelectedT]=useState(null);

  function createTournament(){
    if(!tName.trim()||!tDate.trim()){toast("Name and date required","error");return;}
    var newT={id:Date.now(),name:tName,date:tDate,size:parseInt(tSize),invite:tInvite,entryFee:tEntryFee,rules:tRules,status:tEntryFee?"pending_approval":"upcoming",registered:0,approved:!tEntryFee};
    setTournaments(function(ts){return ts.concat([newT]);});
    setShowCreate(false);setTName("");setTDate("");setTEntryFee("");setTRules("");setTInvite(false);
    toast(tEntryFee?"Tournament created — pending admin approval for entry fee":"Tournament created!","success");
  }

  function saveBranding(){
    setBrandSaved(true);
    toast("Branding saved!","success");
    setTimeout(function(){setBrandSaved(false);},3000);
  }

  function sendAnnouncement(){
    if(!announceMsg.trim()){toast("Write a message first","error");return;}
    var a={id:Date.now(),to:announceTo,msg:announceMsg.trim(),sentAt:new Date().toLocaleString()};
    setAnnouncements(function(arr){return [a].concat(arr);});
    setAnnounceMsg("");
    toast("Announcement sent to "+(announceTo==="all"?"all players":announceTo+" players"),"success");
  }

  var liveTournaments=tournaments.filter(function(t){return t.status==="live";});
  var upcomingTournaments=tournaments.filter(function(t){return t.status==="upcoming";});
  var completedTournaments=tournaments.filter(function(t){return t.status==="completed";});
  var totalHosted=tournaments.length;
  var totalPlayers=tournaments.reduce(function(s,t){return s+t.registered;},0);

  var TABS=[["overview","Overview"],["tournaments","Tournaments"],["registrations","Players"],["announce","Announce"],["branding","Branding"]];

  return(
    <div className="page wrap">

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <span style={{fontSize:24}}>{brandLogo}</span>
            <h2 style={{color:"#F2EDE4",fontSize:20,margin:0}}>{brandName}</h2>
            <Tag color="#9B72CF">{"🎮"} Host</Tag>
            {liveTournaments.length>0&&(
              <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 9px",fontSize:10,fontWeight:700,color:"#6EE7B7"}}>
                <span style={{width:4,height:4,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
              </span>
            )}
          </div>
          <p style={{fontSize:13,color:"#BECBD9",margin:0}}>Host Dashboard — manage tournaments, players, and branding.</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="dark" s="sm" onClick={function(){setScreen("featured");}}>{"← "} Featured</Btn>
          <Btn v="primary" onClick={function(){setShowCreate(function(s){return !s;})}}>{showCreate?"Cancel":"+ New Tournament"}</Btn>
        </div>
      </div>

      {/* Create form */}
      {showCreate&&(
        <Panel style={{padding:"20px",marginBottom:20,border:"1px solid rgba(232,168,56,.25)"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:16}}>Create Tournament</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Tournament Name</div>
              <Inp value={tName} onChange={setTName} placeholder="e.g. Weekly Clash #15"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Date</div>
              <Inp value={tDate} onChange={setTDate} placeholder="Mar 24 2026"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Max Players</div>
              <Sel value={tSize} onChange={setTSize}>{[8,16,24,32,48,64].map(function(n){return <option key={n} value={n}>{n} players</option>;})}</Sel>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Entry Fee <span style={{color:"#9AAABF",fontWeight:400}}>(requires admin approval)</span></div>
              <Inp value={tEntryFee} onChange={setTEntryFee} placeholder="Leave blank = free"/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Custom Rules <span style={{color:"#9AAABF",fontWeight:400}}>(optional)</span></div>
            <textarea value={tRules} onChange={function(e){setTRules(e.target.value);}} placeholder="Any special rules, format notes, or tiebreaker info..."
              style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:72,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div onClick={function(){setTInvite(function(v){return !v;});}} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <div style={{width:36,height:20,borderRadius:99,background:tInvite?"rgba(155,114,207,.3)":"rgba(255,255,255,.08)",border:"1px solid "+(tInvite?"rgba(155,114,207,.5)":"rgba(242,237,228,.1)"),position:"relative",transition:"all .2s"}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:tInvite?"#C4B5FD":"#9AAABF",position:"absolute",top:2,left:tInvite?18:2,transition:"left .2s"}}/>
              </div>
              <span style={{fontSize:13,color:"#C8D4E0"}}>Invite-only registration</span>
            </div>
          </div>
          {tEntryFee&&(
            <div style={{background:"rgba(232,168,56,.06)",border:"1px solid rgba(232,168,56,.2)",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#E8A838"}}>
              {"⚠"} Entry fee tournaments require admin approval before going live.
            </div>
          )}
          <Btn v="primary" onClick={createTournament}>Create Tournament</Btn>
        </Panel>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap"}}>
        {TABS.map(function(arr){
          var t=arr[0],label=arr[1];
          return <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={function(){setTab(t);}}>{label}</Btn>;
        })}
      </div>

      {/* Overview tab */}
      {tab==="overview"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
            {[["Tournaments",""+totalHosted,"#E8A838"],["Players Hosted",""+totalPlayers,"#6EE7B7"],["Live Now",""+liveTournaments.length,"#52C47C"],["Upcoming",""+upcomingTournaments.length,"#4ECDC4"]].map(function(arr){
              var l=arr[0],v=arr[1],c=arr[2];
              return(
                <Panel key={l} style={{padding:"18px",textAlign:"center"}}>
                  <div className="mono" style={{fontSize:28,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                  <div className="cond" style={{fontSize:10,color:"#BECBD9",fontWeight:700,textTransform:"uppercase",marginTop:6,letterSpacing:".06em"}}>{l}</div>
                </Panel>
              );
            })}
          </div>
          {liveTournaments.length>0&&(
            <Panel style={{padding:"18px",marginBottom:16,border:"1px solid rgba(82,196,124,.2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{display:"flex",alignItems:"center",gap:4,background:"rgba(82,196,124,.12)",border:"1px solid rgba(82,196,124,.3)",borderRadius:20,padding:"3px 9px",fontSize:11,fontWeight:700,color:"#6EE7B7"}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite",display:"inline-block"}}/>LIVE
                </span>
                <span style={{fontSize:13,fontWeight:600,color:"#F2EDE4"}}>Active Tournament</span>
              </div>
              {liveTournaments.map(function(t){
                return(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4",marginBottom:4}}>{t.name}</div>
                      <div style={{fontSize:12,color:"#BECBD9",marginBottom:8}}>{"📅"} {t.date} {"·"} {"👥"} {t.registered}/{t.size} players</div>
                      <Bar val={t.registered} max={t.size} color="#6EE7B7" h={4}/>
                    </div>
                    <Btn v="primary" s="sm" onClick={function(){setScreen("bracket");}}>Live Bracket {"→"}</Btn>
                  </div>
                );
              })}
            </Panel>
          )}
          <Panel style={{padding:"18px"}}>
            <div style={{fontWeight:600,fontSize:14,color:"#F2EDE4",marginBottom:12}}>Quick Actions</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="ghost" s="sm" onClick={function(){setShowCreate(true);setTab("tournaments");}}>{"+"} New Tournament</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setTab("announce");}}>{"📢"} Announce</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setTab("branding");}}>{"🎨"} Edit Branding</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setScreen("bracket");}}>{"⚔"} View Bracket</Btn>
              <Btn v="ghost" s="sm" onClick={function(){setScreen("featured");}}>{"⭐"} Featured Page</Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* Tournaments tab */}
      {tab==="tournaments"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {tournaments.map(function(t){
            var statusColor=t.status==="live"?"#6EE7B7":t.status==="upcoming"?"#4ECDC4":t.status==="pending_approval"?"#E8A838":"#BECBD9";
            var statusLabel=t.status==="live"?"🔴 Live":t.status==="upcoming"?"✓ Upcoming":t.status==="pending_approval"?"⏳ Pending":"Completed";
            return(
              <Panel key={t.id} style={{padding:"18px",border:t.status==="live"?"1px solid rgba(82,196,124,.25)":"1px solid rgba(242,237,228,.07)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{t.name}</span>
                      <Tag color={statusColor} size="sm">{statusLabel}</Tag>
                      {t.invite&&<Tag color="#9B72CF" size="sm">{"🔒"} Invite Only</Tag>}
                      {t.entryFee&&<Tag color="#EAB308" size="sm">{"💰"} {t.entryFee}</Tag>}
                    </div>
                    <div style={{fontSize:13,color:"#BECBD9",marginBottom:8}}>{"📅"} {t.date} {"·"} {"👥"} {t.registered}/{t.size} registered</div>
                    <Bar val={t.registered} max={t.size} color="#E8A838" h={4}/>
                    <div style={{fontSize:10,color:"#BECBD9",marginTop:3}}>{t.size-t.registered} spots remaining</div>
                    {t.rules&&<div style={{fontSize:11,color:"#9AAABF",marginTop:6,fontStyle:"italic"}}>{"📋"} {t.rules}</div>}
                  </div>
                  <div style={{display:"flex",gap:8,flexShrink:0}}>
                    <Btn v="ghost" s="sm" onClick={function(){toast("Edit coming soon","success");}}>Edit</Btn>
                    <Btn v="primary" s="sm" onClick={function(){setScreen("bracket");}}>Manage {"→"}</Btn>
                  </div>
                </div>
              </Panel>
            );
          })}
          {tournaments.length===0&&(
            <div style={{textAlign:"center",padding:"48px",color:"#BECBD9"}}>
              <div style={{fontSize:32,marginBottom:12}}>{"🎮"}</div>
              <div style={{fontSize:14}}>No tournaments yet. Create your first one above.</div>
            </div>
          )}
        </div>
      )}

      {/* Registrations / Players tab */}
      {tab==="registrations"&&(
        <div>
          {tournaments.filter(function(t){return t.status!=="completed";}).map(function(t){
            return(
              <Panel key={t.id} style={{padding:"18px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <h3 style={{fontSize:14,color:"#F2EDE4",margin:0,flex:1}}>{t.name}</h3>
                  <Tag color={t.status==="live"?"#6EE7B7":"#4ECDC4"} size="sm">{t.registered}/{t.size}</Tag>
                </div>
                {players.slice(0,t.registered).map(function(p,i){
                  return(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<t.registered-1?"1px solid rgba(242,237,228,.05)":"none"}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#F2EDE4"}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#BECBD9"}}>{p.rank} {"·"} {p.region}</div>
                      </div>
                      <Tag color="#6EE7B7" size="sm">{"✓"} Registered</Tag>
                    </div>
                  );
                })}
                <div style={{marginTop:12,display:"flex",gap:8}}>
                  <Btn v="ghost" s="sm" onClick={function(){toast("Player list exported (mock)","success");}}>{"📥"} Export CSV</Btn>
                  <Btn v="ghost" s="sm" onClick={function(){toast("Check-in link copied (mock)","success");}}>{"🔗"} Check-in Link</Btn>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Announce tab */}
      {tab==="announce"&&(
        <div>
          <Panel style={{padding:"20px",marginBottom:16}}>
            <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:14}}>Send Announcement</h3>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Send to</div>
              <Sel value={announceTo} onChange={setAnnounceTo}>
                <option value="all">All registered players</option>
                {tournaments.map(function(t){return <option key={t.id} value={t.name}>{t.name}</option>;})}
              </Sel>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Message</div>
              <textarea value={announceMsg} onChange={function(e){setAnnounceMsg(e.target.value);}}
                placeholder="e.g. Check-in is now open! Join the Discord for lobby codes..."
                style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:90,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <Btn v="primary" onClick={sendAnnouncement}>{"📢"} Send Announcement</Btn>
          </Panel>
          <Panel style={{padding:"18px"}}>
            <h3 style={{fontSize:14,color:"#F2EDE4",marginBottom:14}}>Sent Announcements</h3>
            {announcements.length===0&&<div style={{fontSize:13,color:"#BECBD9",padding:"16px 0",textAlign:"center"}}>No announcements sent yet.</div>}
            {announcements.map(function(a){
              return(
                <div key={a.id} style={{borderBottom:"1px solid rgba(242,237,228,.05)",padding:"12px 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:11,background:"rgba(155,114,207,.1)",border:"1px solid rgba(155,114,207,.2)",borderRadius:20,padding:"2px 8px",color:"#C4B5FD",fontWeight:600}}>To: {a.to}</span>
                    <span style={{fontSize:10,color:"#9AAABF",marginLeft:"auto"}}>{a.sentAt}</span>
                  </div>
                  <div style={{fontSize:13,color:"#C8D4E0",lineHeight:1.5}}>{a.msg}</div>
                </div>
              );
            })}
          </Panel>
        </div>
      )}

      {/* Branding tab */}
      {tab==="branding"&&(
        <Panel style={{padding:"24px"}}>
          <h3 style={{fontSize:15,color:"#F2EDE4",marginBottom:18}}>{"🎨"} Host Branding</h3>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap",marginBottom:24}}>
            {/* Preview card */}
            <div style={{background:"linear-gradient(145deg,#0D1520,#0f1827)",border:"1px solid "+brandColor+"55",borderRadius:14,padding:"16px 20px",minWidth:220,flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:40,height:40,borderRadius:10,background:brandColor+"22",border:"1px solid "+brandColor+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{brandLogo}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#F2EDE4"}}>{brandName}</div>
                  <div style={{fontSize:11,color:brandColor,fontWeight:600}}>Host Partner</div>
                </div>
              </div>
              {brandBio&&<div style={{fontSize:12,color:"#C8D4E0",lineHeight:1.5}}>{brandBio}</div>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Org / Display Name</div>
              <Inp value={brandName} onChange={setBrandName} placeholder="Your org or community name"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Logo Emoji</div>
              <Inp value={brandLogo} onChange={setBrandLogo} placeholder="e.g. 🎮 🏆 👑"/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:8}}>Brand Color</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["#9B72CF","#4ECDC4","#E8A838","#F87171","#6EE7B7","#60A5FA","#FB923C"].map(function(c){
                  return(
                    <div key={c} onClick={function(){setBrandColor(c);}}
                      style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:brandColor===c?"3px solid #fff":"3px solid transparent",transition:"border .15s"}}/>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:"#C8D4E0",marginBottom:6}}>Bio / Description <span style={{color:"#9AAABF",fontWeight:400}}>(shown on Featured page)</span></div>
              <textarea value={brandBio} onChange={function(e){setBrandBio(e.target.value);}}
                placeholder="Tell players about your org, community, and what kind of clashes you run..."
                style={{width:"100%",background:"#0F1520",border:"1px solid rgba(242,237,228,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#F2EDE4",resize:"vertical",minHeight:80,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <Btn v="primary" onClick={saveBranding}>{brandSaved?"✓ Saved!":"Save Branding"}</Btn>
          </div>
        </Panel>
      )}

    </div>
  );
}

"""

content = content[:idx_start] + NEW_HOST + content[idx_aegis_fn:]

# ── Verify ────────────────────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
balance = opens - closes
print(f"Brace balance: {opens} - {closes} = {balance}")

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done. Lines:", content.count('\n'))
