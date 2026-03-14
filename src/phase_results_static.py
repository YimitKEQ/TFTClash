"""
Replace ResultsScreen with a clean static banger.
No reveal animation, no confetti, no phase state.
Just: champion hero → podium → full standings table → awards → share.
"""

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

OLD = '''// ─── RESULTS SCREEN ───────────────────────────────────────────────────────────
function ResultsScreen({players,toast,setScreen,setProfilePlayer}){
  const sorted=[...players].sort((a,b)=>b.pts-a.pts);
  const champ=sorted[0];
  const [phase,setPhase]=useState(0);
  const [revealed,setRevealed]=useState([]);
  const [confetti,setConfetti]=useState(false);
  const [tab,setTab]=useState("reveal");
  const canvasRef=useRef(null);
  const REVEAL_ORDER=[7,6,5,4,3,2,1,0];

  useEffect(()=>{
    if(phase===0){const t=setTimeout(()=>setPhase(1),600);return()=>clearTimeout(t);}
    if(phase===1&&revealed.length<8){
      const nextIdx=REVEAL_ORDER[revealed.length];
      if(nextIdx===undefined)return;
      const t=setTimeout(()=>{
        setRevealed(r=>[...r,nextIdx]);
        if(revealed.length===7){setTimeout(()=>{setPhase(2);setConfetti(true);setTimeout(()=>setConfetti(false),7000);},900);}
      },revealed.length===7?900:580);
      return()=>clearTimeout(t);
    }
  },[phase,revealed]);

  const awards=computeClashAwards(players.length>0?players:sorted);
  const REWARDS=["👑 Clash Crown","🖼 Icon","🎨 Frame","📦 Loot Orb","📦 Loot Orb","","",""];

  if(!champ)return<div className="page wrap" style={{textAlign:"center",color:"#6B7280",paddingTop:60}}>Complete a clash first!</div>;

  const FAKE_CLASH={id:"latest",name:"Clash #14",date:"Mar 6 2026",season:"S16",champion:champ.name,top3:sorted.slice(0,3).map(p=>p.name),players:players.length,lobbies:Math.ceil(players.length/8),report:{mostImproved:sorted[3]?.name,biggestUpset:(sorted[4]?.name||"")+" beat "+(sorted[0]?.name||"")}};

  // ── Share helpers ─────────────────────────────────────────
  function shareText(platform){
    const top3=sorted.slice(0,3);
    const medals=["🥇","🥈","🥉"];
    const lines=[
      "🏆 TFT Clash S16 - Results",
      "",
      ...top3.map((p,i)=>`${medals[i]} ${p.name} - ${p.pts}pts (AVP: ${computeStats(p).avgPlacement})`),
      "",
      `Full standings: ${sorted.length} players competed`,
      "#TFTClash #TFT #TeamfightTactics",
    ];
    const discord=[
      "**🏆 TFT Clash S16 - Final Results**",
      "```",
      ...sorted.slice(0,8).map((p,i)=>`${String(i+1).padStart(2)} │ ${p.name.padEnd(14)} ${p.pts}pts  AVP:${computeStats(p).avgPlacement}`),
      "```",
      `👑 Champion: **${champ.name}**  🎉`,
    ];
    const text=platform==="discord"?discord.join("\\n"):lines.join("\\n");
    navigator.clipboard?.writeText(text).then(()=>toast(platform==="discord"?"Discord format copied! 🎮":"Copied for "+platform+" ✓","success"));
  }

  function downloadCard(){
    const canvas=document.createElement("canvas");
    canvas.width=900;canvas.height=520;
    const ctx=canvas.getContext("2d");
    // Background
    const bg=ctx.createLinearGradient(0,0,900,520);
    bg.addColorStop(0,"#0A0F1A");bg.addColorStop(1,"#08080F");
    ctx.fillStyle=bg;ctx.fillRect(0,0,900,520);
    // Gold accent line
    const gold=ctx.createLinearGradient(0,0,900,0);
    gold.addColorStop(0,"#E8A838");gold.addColorStop(0.5,"#FFD700");gold.addColorStop(1,"#E8A838");
    ctx.fillStyle=gold;ctx.fillRect(0,0,900,3);
    // Title
    ctx.font="bold 13px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="4px";
    ctx.fillText("TFT CLASH S16 - FINAL RESULTS",40,44);
    ctx.letterSpacing="0px";
    // Date
    ctx.font="11px monospace";ctx.fillStyle="#6B7280";
    ctx.fillText("Mar 6 2026  ·  "+sorted.length+" players",40,64);
    // Champion block
    ctx.fillStyle="rgba(232,168,56,0.1)";
    ctx.beginPath();ctx.roundRect(40,85,820,100,8);ctx.fill();
    ctx.strokeStyle="rgba(232,168,56,0.4)";ctx.lineWidth=1;ctx.stroke();
    ctx.font="bold 40px serif";ctx.fillStyle="#E8A838";ctx.fillText("👑",55,152);
    ctx.font="bold 28px serif";ctx.fillStyle="#F2EDE4";
    ctx.fillText(champ.name,110,150);
    ctx.font="bold 22px monospace";ctx.fillStyle="#E8A838";
    ctx.fillText(champ.pts+" pts",110,174);
    ctx.font="11px monospace";ctx.fillStyle="#6B7280";
    ctx.fillText("Champion · AVP: "+computeStats(champ).avgPlacement,110,194);
    // Standings
    sorted.slice(0,8).forEach((p,i)=>{
      const y=210+i*36;const x=40+(i>3?440:0);const iy=i>3?i-4:i;
      const c2=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#6B7280";
      ctx.font="bold 14px monospace";ctx.fillStyle=c2;ctx.fillText("#"+(i+1),x,210+iy*36);
      ctx.font="14px sans-serif";ctx.fillStyle=i<3?"#F2EDE4":"#9CA3AF";
      ctx.fillText(p.name,x+36,210+iy*36);
      ctx.font="bold 14px monospace";ctx.fillStyle="#E8A838";
      ctx.fillText(p.pts+"pts",x+200,210+iy*36);
      const av=computeStats(p).avgPlacement;
      ctx.font="12px monospace";ctx.fillStyle=av!=="-"?(parseFloat(av)<3?"#4ade80":parseFloat(av)<5?"#facc15":"#f87171"):"#6B7280";
      ctx.fillText("avg:"+av,x+280,210+iy*36);
    });
    // Footer
    ctx.fillStyle="rgba(232,168,56,0.15)";ctx.fillRect(0,488,900,32);
    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";
    ctx.fillText("TFT CLASH  ·  tftclash.gg",40,508);ctx.letterSpacing="0px";
    ctx.font="11px monospace";ctx.fillStyle="#6B7280";
    ctx.fillText("#TFTClash  #TFT",700,508);
    // Download
    const a=document.createElement("a");a.download="TFTClash-Results.png";a.href=canvas.toDataURL("image/png");a.click();
    toast("Results card downloaded! 🎉","success");
  }

  return(
    <div className="page wrap">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
      </div>
      <Confetti active={confetti}/>

      {/* Tabs once revealed */}
      {phase>=2&&(
        <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",paddingBottom:2}}>
          {["reveal","report","awards"].map(t=>(
            <Btn key={t} v={tab===t?"primary":"dark"} s="sm" onClick={()=>setTab(t)} style={{textTransform:"capitalize",flexShrink:0}}>{t==="report"?"Clash Report":t}</Btn>
          ))}
        </div>
      )}

      {/* Cinematic Reveal */}
      {(phase<2||tab==="reveal")&&(
        <div>
          {phase>=2&&(
            <div style={{background:"linear-gradient(135deg,rgba(232,168,56,.12),rgba(155,114,207,.06),rgba(8,8,15,.98))",border:"1px solid rgba(232,168,56,.4)",borderRadius:16,padding:"40px 32px",textAlign:"center",marginBottom:24,position:"relative",overflow:"hidden",boxShadow:"0 0 80px rgba(232,168,56,.12)"}}>
              {/* Decorative rays */}
              <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
                {[0,45,90,135,180,225,270,315].map(deg=>(
                  <div key={deg} style={{position:"absolute",top:"50%",left:"50%",width:600,height:1,background:"linear-gradient(90deg,rgba(232,168,56,.15),transparent)",transform:`rotate(${deg}deg)`,transformOrigin:"0 0"}}/>
                ))}
              </div>
              <div style={{position:"relative",animation:"champ-reveal .9s ease both"}}>
                <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".28em",textTransform:"uppercase",marginBottom:16,opacity:.8}}>⚔ Season 16 - Grand Finalist ⚔</div>
                <div style={{width:90,height:90,borderRadius:"50%",background:`linear-gradient(135deg,${rc(champ.rank)}44,${rc(champ.rank)}11)`,border:`3px solid ${rc(champ.rank)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:700,color:rc(champ.rank),margin:"0 auto 12px",fontFamily:"'Cinzel',serif",animation:"crown-glow 2s infinite"}}>
                  {champ.name.charAt(0)}
                </div>
                <div style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>🏆 Champion</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(32px,5vw,56px)",fontWeight:900,color:"#E8A838",textShadow:"0 0 80px rgba(232,168,56,.6),0 4px 24px rgba(0,0,0,.8)",lineHeight:1,marginBottom:8}}>{champ.name}</div>
                <div className="mono" style={{fontSize:28,fontWeight:700,color:"#E8A838",marginBottom:6}}>{champ.pts} <span style={{fontSize:16,color:"#9CA3AF",fontWeight:400}}>season pts</span></div>
                <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:20,flexWrap:"wrap"}}>
                  {[["AVP",computeStats(champ).avgPlacement,avgCol(computeStats(champ).avgPlacement)],["Wins",computeStats(champ).wins,"#6EE7B7"],["Top4%",computeStats(champ).top4Rate+"%","#C4B5FD"],["Clutch",computeStats(champ).clutchRate+"%","#9B72CF"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center",padding:"8px 14px",background:"rgba(255,255,255,.04)",borderRadius:8}}>
                      <div className="mono" style={{fontSize:16,fontWeight:700,color:c}}>{v}</div>
                      <div className="cond" style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase"}}>{l}</div>
                    </div>
                  ))}
                </div>
                {/* Share buttons row */}
                <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                  <Btn v="primary" s="lg" onClick={()=>{setConfetti(true);setTimeout(()=>setConfetti(false),6000);}}>🎉 Celebrate</Btn>
                  <Btn v="ghost" onClick={downloadCard}>⬇ PNG Card</Btn>
                  <Btn v="dark" onClick={()=>shareText("Twitter/X")}>𝕏 Twitter</Btn>
                  <Btn v="purple" onClick={()=>shareText("discord")}>Discord</Btn>
                  <Btn v="dark" onClick={()=>shareText("copy")}>📋 Copy</Btn>
                </div>
              </div>
            </div>
          )}

          {phase<2&&(
            <div style={{textAlign:"center",marginBottom:24,padding:"20px 0"}}>
              <div className="cond" style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".24em",textTransform:"uppercase",marginBottom:12}}>⚔ TFT Clash S16 - Placements Incoming ⚔</div>
              <h2 style={{color:"#F2EDE4",fontSize:22,marginBottom:8}}>Revealing standings...</h2>
              <div style={{display:"flex",justifyContent:"center",gap:5}}>
                {[0,1,2,3].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:"#E8A838",animation:`blink 1.2s ${i*.18}s infinite`}}/>)}
              </div>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:580,margin:"0 auto"}}>
            {(phase>=2?[...revealed].sort((a,b)=>a-b):revealed).map((idx,ri)=>{
              const p=sorted[idx];const pos=idx+1;const isLast=phase>=2?pos===1:ri===revealed.length-1;
              const isWin=pos===1,isTop3=pos<=3,isTop4=pos<=4;
              const st=computeStats(p);
              return(
                <div key={p.id} onClick={()=>{if(setProfilePlayer){setProfilePlayer(p);setScreen("profile");}}}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",
                    background:isWin?"rgba(232,168,56,.09)":isTop3?"rgba(232,168,56,.04)":isTop4?"rgba(78,205,196,.03)":"#111827",
                    border:"1px solid "+(isWin?"rgba(232,168,56,.45)":isTop3?"rgba(232,168,56,.2)":isTop4?"rgba(78,205,196,.12)":"rgba(242,237,228,.06)"),
                    borderRadius:10,animation:"reveal-up .4s ease both",
                    cursor:setProfilePlayer?"pointer":"default",
                    boxShadow:isLast&&isWin?"0 0 24px rgba(232,168,56,.2)":"none"}}>
                  <div className="mono" style={{fontSize:isWin?26:20,fontWeight:800,color:pos===1?"#E8A838":pos===2?"#C0C0C0":pos===3?"#CD7F32":pos<=4?"#4ECDC4":"#6B7280",minWidth:28,textAlign:"center",lineHeight:1}}>{pos}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:isWin?17:14,color:"#F2EDE4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                    <div style={{display:"flex",gap:8,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#6B7280"}}>{p.rank} · {p.region}</span>
                      {isHotStreak(p)&&<span style={{fontSize:11}}>🔥 {p.currentStreak}-streak</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div className="mono" style={{fontSize:isWin?20:16,fontWeight:700,color:"#E8A838"}}>{p.pts}pts</div>
                    <div style={{fontSize:10,color:avgCol(st.avgPlacement),marginTop:2}}>avg {st.avgPlacement}</div>
                  </div>
                  {isLast&&pos===1&&<div style={{fontSize:28,animation:"crown-glow 2s infinite"}}>👑</div>}
                </div>
              );
            })}
            {revealed.length<8&&phase===1&&(
              <div style={{textAlign:"center",padding:20,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#E8A838",animation:`blink 1s ${i*.2}s infinite`}}/>)}
              </div>
            )}
          </div>

          {/* Full table after reveal */}
          {phase>=2&&(
            <Panel style={{overflow:"hidden",marginTop:24}}>
              <div style={{padding:"12px 16px",background:"#0A0F1A",borderBottom:"1px solid rgba(242,237,228,.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <h3 style={{fontSize:15,color:"#F2EDE4"}}>Full Standings</h3>
                <Btn v="ghost" s="sm" onClick={downloadCard}>⬇ PNG</Btn>
              </div>
              {sorted.map((p,i)=>{
                const st=computeStats(p);
                return(
                  <div key={p.id} onClick={()=>{if(setProfilePlayer){setProfilePlayer(p);setScreen("profile");}}}
                    style={{display:"grid",gridTemplateColumns:"32px 1fr 70px 70px 70px 100px",padding:"11px 16px",borderBottom:"1px solid rgba(242,237,228,.04)",alignItems:"center",background:i===0?"rgba(232,168,56,.04)":"transparent",cursor:setProfilePlayer?"pointer":"default"}}>
                    <div className="mono" style={{fontSize:13,fontWeight:800,color:i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#4A4438"}}>{i+1}</div>
                    <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:14,color:"#E8A838",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#6B7280"}}>{p.rank}</div>
                      </div>
                    </div>
                    <div className="mono" style={{fontSize:16,fontWeight:700,color:"#E8A838"}}>{p.pts}</div>
                    <AvgBadge avg={parseFloat(p.avg)||0}/>
                    <div className="mono" style={{fontSize:12,color:"#4ECDC4"}}>{st.top4Rate}%</div>
                    <div>{REWARDS[i]&&<Tag color={i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#4A4438"} size="sm">{REWARDS[i]}</Tag>}</div>
                  </div>
                );
              })}
            </Panel>
          )}
        </div>
      )}

      {/* Clash Report */}
      {phase>=2&&tab==="report"&&(
        <Panel style={{padding:"20px"}}>
          <h3 style={{fontSize:16,color:"#F2EDE4",marginBottom:4}}>{FAKE_CLASH.name} - Full Report</h3>
          <p style={{fontSize:13,color:"#6B7280",marginBottom:18}}>{FAKE_CLASH.date} · {FAKE_CLASH.players} players</p>
          <ClashReport clashData={FAKE_CLASH} players={players}/>
        </Panel>
      )}

      {phase>=2&&tab==="awards"&&(
        <div>
          <div style={{marginBottom:16,padding:"12px 16px",background:"rgba(232,168,56,.05)",border:"1px solid rgba(232,168,56,.2)",borderRadius:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:20}}>🏆</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"#E8A838"}}>Post-Clash Awards</div>
              <div style={{fontSize:12,color:"#6B7280"}}>Click any award to view the player\'s profile</div>
            </div>
          </div>
          <div className="grid-2">
            {awards.filter(a=>a.winner).map(a=>(
              <AwardCard key={a.id} award={a} onClick={()=>{if(setProfilePlayer&&a.winner){setProfilePlayer(a.winner);setScreen("profile");}}}/>
            ))}
          </div>
          <div style={{marginTop:20}}>
            <AICommentaryPanel players={players} toast={toast}/>
          </div>
          <div style={{marginTop:16,padding:"16px 20px",background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.25)",borderRadius:12,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <span style={{fontSize:28}}>🎁</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:"#C4B5FD",marginBottom:4}}>Milestone Rewards Unlocked</div>
              <div style={{fontSize:13,color:"#9CA3AF"}}>Some players earned new milestones this clash. Check the Milestones page for full progress.</div>
            </div>
            <Btn v="purple" s="sm" onClick={()=>setScreen("milestones")}>View Milestones →</Btn>
          </div>
        </div>
      )}
    </div>
  );
}'''

NEW = '''// ─── RESULTS SCREEN ───────────────────────────────────────────────────────────
function ResultsScreen({players,toast,setScreen,setProfilePlayer}){
  const sorted=[...players].sort((a,b)=>b.pts-a.pts);
  const champ=sorted[0];
  const [tab,setTab]=useState("results");
  const awards=computeClashAwards(players.length>0?players:sorted);
  const CLASH_NAME="Clash #14";
  const CLASH_DATE="Mar 8 2026";
  const MEDALS=["🥇","🥈","🥉"];
  const PODIUM_COLS=["#C0C0C0","#E8A838","#CD7F32"];

  if(!champ)return<div className="page wrap" style={{textAlign:"center",color:"#6B7280",paddingTop:60}}>Complete a clash first!</div>;

  const top3=[sorted[1],sorted[0],sorted[2]].filter(Boolean);
  const REWARDS=["👑 Clash Crown","🖼 Icon","🎨 Frame","📦 Loot Orb","📦 Loot Orb","","",""];

  function shareDiscord(){
    const lines=[
      "**🏆 TFT Clash S16 — "+CLASH_NAME+" Results**",
      "```",
      ...sorted.slice(0,8).map((p,i)=>"#"+(i+1)+" "+p.name.padEnd(16)+" "+String(p.pts).padStart(4)+"pts  avg "+computeStats(p).avgPlacement),
      "```",
      "👑 Champion: **"+champ.name+"**  🎉  "+champ.pts+"pts",
    ];
    navigator.clipboard?.writeText(lines.join("\\n")).then(()=>toast("Copied for Discord ✓","success"));
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
    ctx.fillText("TFT CLASH S16 — FINAL RESULTS",40,44);ctx.letterSpacing="0px";
    ctx.font="11px monospace";ctx.fillStyle="#6B7280";
    ctx.fillText(CLASH_DATE+"  ·  "+sorted.length+" players",40,64);
    ctx.fillStyle="rgba(232,168,56,0.1)";
    ctx.beginPath();ctx.roundRect(40,85,820,100,8);ctx.fill();
    ctx.strokeStyle="rgba(232,168,56,0.4)";ctx.lineWidth=1;ctx.stroke();
    ctx.font="bold 40px serif";ctx.fillStyle="#E8A838";ctx.fillText("👑",55,152);
    ctx.font="bold 28px serif";ctx.fillStyle="#F2EDE4";ctx.fillText(champ.name,110,150);
    ctx.font="bold 22px monospace";ctx.fillStyle="#E8A838";ctx.fillText(champ.pts+" pts",110,174);
    ctx.font="11px monospace";ctx.fillStyle="#6B7280";ctx.fillText("Champion · AVP: "+computeStats(champ).avgPlacement,110,194);
    sorted.slice(0,8).forEach((p,i)=>{
      const x=40+(i>3?440:0);const iy=i>3?i-4:i;
      const c2=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#6B7280";
      ctx.font="bold 14px monospace";ctx.fillStyle=c2;ctx.fillText("#"+(i+1),x,210+iy*36);
      ctx.font="14px sans-serif";ctx.fillStyle=i<3?"#F2EDE4":"#9CA3AF";ctx.fillText(p.name,x+36,210+iy*36);
      ctx.font="bold 14px monospace";ctx.fillStyle="#E8A838";ctx.fillText(p.pts+"pts",x+200,210+iy*36);
      const av=computeStats(p).avgPlacement;
      ctx.font="12px monospace";ctx.fillStyle=parseFloat(av)<3?"#4ade80":parseFloat(av)<5?"#facc15":"#f87171";
      ctx.fillText("avg:"+av,x+280,210+iy*36);
    });
    ctx.fillStyle="rgba(232,168,56,0.15)";ctx.fillRect(0,488,900,32);
    ctx.font="bold 11px monospace";ctx.fillStyle="#E8A838";ctx.letterSpacing="2px";
    ctx.fillText("TFT CLASH  ·  tftclash.gg",40,508);ctx.letterSpacing="0px";
    ctx.font="11px monospace";ctx.fillStyle="#6B7280";ctx.fillText("#TFTClash  #TFT",700,508);
    const a=document.createElement("a");a.download="TFTClash-Results.png";a.href=canvas.toDataURL("image/png");a.click();
    toast("Results card downloaded ✓","success");
  }

  return(
    <div className="page wrap">
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,flexWrap:"wrap"}}>
        <Btn v="dark" s="sm" onClick={()=>setScreen("home")}>← Back</Btn>
        <div style={{flex:1,minWidth:0}}>
          <div className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".18em",textTransform:"uppercase",marginBottom:2}}>Season 16</div>
          <h1 style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(22px,3.5vw,34px)",fontWeight:900,color:"#F2EDE4",lineHeight:1}}>{CLASH_NAME} — Final Results</h1>
          <div style={{fontSize:12,color:"#6B7280",marginTop:3}}>{CLASH_DATE} · {sorted.length} players · {Math.ceil(sorted.length/8)} lobbies</div>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <Btn v="dark" s="sm" onClick={shareDiscord}>Discord</Btn>
          <Btn v="ghost" s="sm" onClick={downloadCard}>⬇ PNG</Btn>
        </div>
      </div>

      {/* Champion banner */}
      <div style={{background:"linear-gradient(135deg,rgba(232,168,56,.14),rgba(155,114,207,.06))",border:"1px solid rgba(232,168,56,.35)",borderRadius:18,padding:"28px 32px",marginBottom:24,display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#E8A838,#FFD700,#E8A838)"}}/>
        <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,rgba(232,168,56,.3),rgba(232,168,56,.08))",border:"2px solid rgba(232,168,56,.6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:"#E8A838",fontFamily:"'Cinzel',serif",flexShrink:0}}>
          {champ.name.charAt(0)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:"#E8A838",letterSpacing:".16em",textTransform:"uppercase",marginBottom:4}}>👑 Clash Champion</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(26px,4vw,44px)",fontWeight:900,color:"#F2EDE4",lineHeight:1,marginBottom:6}}>{champ.name}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Tag color="#E8A838" size="sm">{champ.rank}</Tag>
            <Tag color="#4ECDC4" size="sm">{champ.region}</Tag>
            {isHotStreak(champ)&&<Tag color="#F97316" size="sm">🔥 {champ.currentStreak}-streak</Tag>}
          </div>
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[["Season Pts",champ.pts,"#E8A838"],["Wins",champ.wins,"#6EE7B7"],["Avg",computeStats(champ).avgPlacement,avgCol(computeStats(champ).avgPlacement)],["Top4%",computeStats(champ).top4Rate+"%","#C4B5FD"]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center",padding:"10px 16px",background:"rgba(0,0,0,.3)",borderRadius:10,minWidth:64}}>
              <div className="mono" style={{fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Podium — top 3 */}
      {sorted.length>=3&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1.1fr 1fr",gap:10,marginBottom:24,alignItems:"end"}}>
          {top3.map((p,idx)=>{
            const actualRank=idx===0?1:idx===1?0:2;
            const col=PODIUM_COLS[actualRank];
            const isGold=actualRank===1;
            const height=isGold?1:actualRank===0?0.88:0.76;
            return(
              <div key={p.id} onClick={()=>{setProfilePlayer(p);setScreen("profile");}}
                style={{background:isGold?"rgba(232,168,56,.08)":"rgba(255,255,255,.02)",border:"1px solid "+(isGold?"rgba(232,168,56,.3)":"rgba(255,255,255,.07)"),borderRadius:14,padding:"20px 14px",textAlign:"center",cursor:"pointer",borderTop:"3px solid "+col,paddingTop:isGold?28:20}}>
                <div style={{fontSize:28,marginBottom:8}}>{MEDALS[actualRank]}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:isGold?17:14,fontWeight:700,color:"#F2EDE4",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:10}}>{p.rank} · {p.region}</div>
                <div className="mono" style={{fontSize:isGold?28:20,fontWeight:800,color:col,lineHeight:1}}>{p.pts}</div>
                <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginTop:3}}>Season Pts</div>
                <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:10}}>
                  {[["W",computeStats(p).wins,"#6EE7B7"],["Avg",computeStats(p).avgPlacement,avgCol(computeStats(p).avgPlacement)]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div className="mono" style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                      <div style={{fontSize:9,color:"#4A4438",textTransform:"uppercase"}}>{l}</div>
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
              <span key={h} className="cond" style={{fontSize:10,fontWeight:700,color:"#4A4438",letterSpacing:".1em",textTransform:"uppercase"}}>{h}</span>
            ))}
          </div>
          {sorted.map((p,i)=>{
            const st=computeStats(p);
            const isTop3=i<3;
            const col=i===0?"#E8A838":i===1?"#C0C0C0":i===2?"#CD7F32":"#6B7280";
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
                      {HOMIES_IDS.includes(p.id)&&<span style={{fontSize:10}}>💜</span>}
                      {isHotStreak(p)&&<span style={{fontSize:10}}>🔥</span>}
                    </div>
                    <div style={{fontSize:11,color:"#6B7280"}}>{p.rank} · {p.region}</div>
                  </div>
                </div>
                <div className="mono" style={{fontSize:15,fontWeight:700,color:isTop3?col:"#C8BFB0"}}>{p.pts}</div>
                <AvgBadge avg={parseFloat(p.avg)||0}/>
                <div className="mono" style={{fontSize:13,color:"#6EE7B7"}}>{st.wins}</div>
                <div className="mono" style={{fontSize:13,color:"#4ECDC4"}}>{st.top4Rate}%</div>
                <div style={{fontSize:12}}>{REWARDS[i]?<Tag color={col} size="sm">{REWARDS[i]}</Tag>:<span style={{color:"#4A4438"}}>—</span>}</div>
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
            <span style={{fontSize:24}}>🎁</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:"#C4B5FD",marginBottom:3}}>Milestone Rewards Unlocked</div>
              <div style={{fontSize:13,color:"#9CA3AF"}}>Some players earned new milestones this clash.</div>
            </div>
            <Btn v="purple" s="sm" onClick={()=>setScreen("milestones")}>View →</Btn>
          </div>
        </div>
      )}

      {/* Clash Report */}
      {tab==="report"&&(
        <Panel style={{padding:"20px"}}>
          <h3 style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"#F2EDE4",marginBottom:4}}>{CLASH_NAME} — Round by Round</h3>
          <p style={{fontSize:13,color:"#6B7280",marginBottom:20}}>{CLASH_DATE} · {sorted.length} players</p>
          <ClashReport clashData={{id:"latest",name:CLASH_NAME,date:CLASH_DATE,season:"S16",champion:champ.name,top3:sorted.slice(0,3).map(p=>p.name),players:sorted.length,lobbies:Math.ceil(sorted.length/8),report:{mostImproved:sorted[3]?.name,biggestUpset:(sorted[4]?.name||"")+" beat "+(sorted[0]?.name||"")}}} players={players}/>
        </Panel>
      )}
    </div>
  );
}'''

assert OLD in content, "OLD ResultsScreen block not found"
content = content.replace(OLD, NEW, 1)

opens = content.count('{')
closes = content.count('}')
print(f"Brace balance: {opens} open, {closes} close, diff={opens-closes}")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File is now {content.count(chr(10))+1} lines.")
