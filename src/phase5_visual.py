"""
Phase 5: Visual Redesign - Dramatically different at a glance
- Add CSS utility classes (glass, display, section-title, accent-bar, pulse)
- Update Panel component to glassmorphism
- Redesign countdown to tile/block digit style
- Add navbar top border + increase height
- Add gradient panel fills for key sections
"""

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Add new CSS classes before closing GCSS backtick ──────────────────────
OLD_GCSS_END = '''@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes glow-text{0%,100%{text-shadow:0 0 14px rgba(232,168,56,.5)}50%{text-shadow:0 0 32px rgba(232,168,56,.9),0 0 64px rgba(232,168,56,.3)}}
`;'''

NEW_GCSS_END = '''@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes glow-text{0%,100%{text-shadow:0 0 14px rgba(232,168,56,.5)}50%{text-shadow:0 0 32px rgba(232,168,56,.9),0 0 64px rgba(232,168,56,.3)}}

/* ── Phase 5: Arena redesign ──────────────────────────────────────────── */
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)}}
.glass{background:rgba(255,255,255,.04)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.09)!important;}
.display{font-family:'Cinzel',serif;font-size:clamp(40px,6vw,72px);font-weight:900;letter-spacing:-.02em;}
.section-title{font-family:'Cinzel',serif;font-size:clamp(18px,2.5vw,28px);font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.accent-bar::before{content:"";display:block;height:3px;background:linear-gradient(90deg,#9B72CF,#4ECDC4);border-radius:2px;margin-bottom:16px;}
.panel-glass{background:rgba(255,255,255,.035)!important;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.09)!important;border-radius:16px!important;}
.panel-gradient{background:linear-gradient(135deg,rgba(155,114,207,.1),rgba(78,205,196,.04))!important;border:1px solid rgba(155,114,207,.18)!important;}
.countdown-tile{background:linear-gradient(160deg,rgba(155,114,207,.15),rgba(78,205,196,.05));border:1px solid rgba(155,114,207,.3);border-radius:12px;padding:14px 12px;text-align:center;min-width:64px;}
.countdown-tile .digit{font-family:'JetBrains Mono',monospace;font-size:38px;font-weight:800;color:#E8A838;line-height:1;text-shadow:0 0 24px rgba(232,168,56,.6),0 0 48px rgba(232,168,56,.2);}
.countdown-tile .unit{font-family:'Inter',sans-serif;font-size:9px;color:#6B7280;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:4px;}
.hero-panel{background:radial-gradient(ellipse at 50% 0%,rgba(155,114,207,.18) 0%,rgba(8,8,15,.0) 70%);border:1px solid rgba(155,114,207,.2);border-radius:20px;padding:40px 32px;position:relative;overflow:hidden;}
.hero-panel::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(155,114,207,.06),rgba(78,205,196,.02));pointer-events:none;}
.top-nav{border-top:2px solid #9B72CF!important;box-shadow:0 2px 0 rgba(155,114,207,.08),0 1px 0 rgba(232,168,56,.1),0 8px 40px rgba(0,0,0,.7)!important;}
`;'''

assert OLD_GCSS_END in content, "OLD_GCSS_END not found"
content = content.replace(OLD_GCSS_END, NEW_GCSS_END, 1)

# ── 2. Update Panel to glassmorphism ─────────────────────────────────────────
OLD_PANEL = '''      style={Object.assign({background:"linear-gradient(160deg,#131C2B,#0C1320)",border:"1px solid "+bdr,borderRadius:14,position:"relative",overflow:"hidden",'''
NEW_PANEL = '''      style={Object.assign({background:"rgba(13,19,33,.75)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:"1px solid "+bdr,borderRadius:16,position:"relative",overflow:"hidden",'''

assert OLD_PANEL in content, "OLD_PANEL not found"
content = content.replace(OLD_PANEL, NEW_PANEL, 1)

# ── 3. Redesign HomeScreen countdown to tile style ────────────────────────────
OLD_COUNTDOWN = '''          {/* Countdown */}
          <div style={{background:"linear-gradient(145deg,#0F1827,#090E1A)",border:"1px solid rgba(232,168,56,.18)",borderRadius:14,padding:"20px",textAlign:"center"}}>
            <div className="cond" style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:".12em",textTransform:"uppercase",marginBottom:12}}>⏳ Clash #14 In</div>
            <div style={{display:"flex",justifyContent:"center",gap:16}}>
              {[[D,"Days"],[H,"Hrs"],[M,"Min"],[S,"Sec"]].map(([v,l])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div className="mono countdown-digit" style={{fontSize:36,fontWeight:800,color:"#E8A838",lineHeight:1}}>{String(v).padStart(2,"0")}</div>
                  <div className="cond" style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginTop:3}}>{l}</div>
                </div>
              ))}
            </div>
          </div>'''

NEW_COUNTDOWN = '''          {/* Countdown */}
          <div style={{background:"linear-gradient(145deg,rgba(155,114,207,.08),rgba(8,8,15,.6))",border:"1px solid rgba(155,114,207,.25)",borderRadius:16,padding:"20px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 1.5s infinite"}}/>
              <span className="cond" style={{fontSize:11,fontWeight:700,color:"#9B72CF",letterSpacing:".14em",textTransform:"uppercase"}}>Clash #14 Starts In</span>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-start",flexWrap:"wrap"}}>
              {[[D,"Days"],[H,"Hrs"],[M,"Min"],[S,"Sec"]].map(([v,l])=>(
                <div key={l} className="countdown-tile">
                  <div className="digit">{String(v).padStart(2,"0")}</div>
                  <div className="unit">{l}</div>
                </div>
              ))}
            </div>
          </div>'''

assert OLD_COUNTDOWN in content, "OLD_COUNTDOWN not found"
content = content.replace(OLD_COUNTDOWN, NEW_COUNTDOWN, 1)

# ── 4. Upgrade HomeScreen hero heading with .display class ────────────────────
OLD_HERO_H1 = '''          <h1 className="au1" style={{fontWeight:900,fontSize:"clamp(48px,7vw,82px)",color:"#F2EDE4",lineHeight:.86,letterSpacing:"-.03em",marginBottom:20}}>
            The<br/><span style={{color:"#E8A838",fontStyle:"italic",textShadow:"0 0 60px rgba(232,168,56,.35)"}}>Convergence</span><br/>Awaits
          </h1>'''

NEW_HERO_H1 = '''          <h1 className="au1 display" style={{color:"#F2EDE4",lineHeight:.88,letterSpacing:"-.02em",marginBottom:20}}>
            The<br/><span style={{color:"#E8A838",fontStyle:"italic",textShadow:"0 0 60px rgba(232,168,56,.4),0 0 120px rgba(232,168,56,.15)"}}>Convergence</span><br/><span style={{background:"linear-gradient(135deg,#9B72CF,#4ECDC4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Awaits</span>
          </h1>'''

assert OLD_HERO_H1 in content, "OLD_HERO_H1 not found"
content = content.replace(OLD_HERO_H1, NEW_HERO_H1, 1)

# ── 5. Add gradient fill to hero section container ────────────────────────────
OLD_HERO_LIVE = '''          <div className="au" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 12px",background:"rgba(82,196,124,.08)",border:"1px solid rgba(82,196,124,.25)",borderRadius:20,marginBottom:20}}>
            <Dot size={6}/><span className="cond" style={{fontSize:11,fontWeight:700,color:"#6EE7B7",letterSpacing:".1em",textTransform:"uppercase"}}>Set 16 - Season Active · Weekly Clash</span>
          </div>'''

NEW_HERO_LIVE = '''          <div className="au" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 14px",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.35)",borderRadius:20,marginBottom:20}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#9B72CF",animation:"pulse 2s infinite"}}/>
            <span className="cond" style={{fontSize:11,fontWeight:700,color:"#C4B5FD",letterSpacing:".1em",textTransform:"uppercase"}}>Set 16 · Season Active · Weekly Clash</span>
          </div>'''

assert OLD_HERO_LIVE in content, "OLD_HERO_LIVE not found"
content = content.replace(OLD_HERO_LIVE, NEW_HERO_LIVE, 1)

# ── 6. Add gradient bg to hero left panel ────────────────────────────────────
OLD_GRID_HOME_LEFT = '''        {/* Left: Hero */}
        <div>'''

NEW_GRID_HOME_LEFT = '''        {/* Left: Hero */}
        <div style={{position:"relative",padding:"28px 24px",borderRadius:20,background:"radial-gradient(ellipse at 30% 20%,rgba(155,114,207,.12) 0%,rgba(8,8,15,0) 60%)",border:"1px solid rgba(155,114,207,.1)"}}>'''

assert OLD_GRID_HOME_LEFT in content, "OLD_GRID_HOME_LEFT not found"
content = content.replace(OLD_GRID_HOME_LEFT, NEW_GRID_HOME_LEFT, 1)

# ── Verify brace balance ─────────────────────────────────────────────────────
opens = content.count('{')
closes = content.count('}')
print(f"Brace balance: {opens} open, {closes} close, diff={opens-closes}")

with open('C:/Users/gubje/Downloads/tft-clash/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Phase 5 done. File is now {content.count(chr(10))+1} lines.")
