# TFT Clash UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize 27 screens into a context-aware nav with phase-adaptive Clash screen and 5 killer features, without losing any functionality or visual soul.

**Architecture:** All changes happen in `src/App.jsx` (18,190 lines). Old screen functions stay as-is and become tab content inside new wrapper components. The hash router is extended to support sub-routes (`#standings/hof`). Nav arrays become dynamic based on `tournamentState.phase`.

**Tech Stack:** React 18.2, Vite 5.1, Supabase, Tabler Icons, no router library (manual hash routing)

**Spec:** `docs/superpowers/specs/2026-03-21-tft-clash-ux-overhaul-design.md`

**Code style note:** The `TFTClash()` root component's return block uses JSX syntax (`<HomeScreen .../>`). Standalone component function bodies (like the new wrapper screens) use `React.createElement` calls. Both patterns coexist in the file — match whichever section you're editing.

**Squad Mode:** Deferred to a separate spec per §5.4 of the design spec (P2 priority). Not included in this plan.

---

## Critical Rules (read before every task)

1. **NO IIFEs in JSX** — `{(()=>{...})()}` crashes the Babel renderer
2. **GCSS block (~lines 993–1705) is a template literal** — do NOT touch its structure
3. **Brace balance must stay at 0** after every edit
4. **No backtick string literals inside JS functions**
5. **No named function components defined inside another component's body**
6. After every edit, verify brace balance: `grep -o '{' src/App.jsx | wc -l` must equal `grep -o '}' src/App.jsx | wc -l`

---

# Sprint 1: Navigation & Structure

## Task 1: Extend Hash Router for Sub-Routes

**Files:**
- Modify: `src/App.jsx:17077` (screen state init)
- Modify: `src/App.jsx:17269` (popstate handler)
- Modify: `src/App.jsx:17272-17284` (screen→hash sync)
- Modify: `src/App.jsx:17746-17752` (navTo callback)
- Modify: `src/App.jsx:17769` (safeScreens array)

**What:** The current router only supports flat screen IDs (`#leaderboard`, `#hof`). We need sub-route support (`#standings/hof`, `#profile/milestones`) so merged screens can deep-link to specific tabs.

- [ ] **Step 1: Add `subRoute` state next to `screen` state**

At line 17077 in `TFTClash()`, after the `screen` state, add:

```js
var [subRoute,setSubRoute]=useState(function(){
  var h=window.location.hash.replace("#","");
  var parts=h.split("/");
  return parts[1]||"";
});
```

- [ ] **Step 2: Update screen state init to parse base route**

Change line 17077 from:
```js
const [screen,setScreen]=useState(function(){var h=window.location.hash.replace("#","");return h||"home";});
```
to:
```js
const [screen,setScreen]=useState(function(){var h=window.location.hash.replace("#","");var parts=h.split("/");return parts[0]||"home";});
```

- [ ] **Step 3: Update popstate handler to parse sub-routes**

Change line 17269 from:
```js
useEffect(function(){function onPop(){navSourceRef.current="popstate";var h=window.location.hash.replace("#","");if(h==="standings")h="leaderboard";setScreen(h||"home");}window.addEventListener("popstate",onPop);return function(){window.removeEventListener("popstate",onPop);};},[]);
```
to:
```js
useEffect(function(){function onPop(){navSourceRef.current="popstate";var h=window.location.hash.replace("#","");var parts=h.split("/");var base=parts[0]||"home";setScreen(base);setSubRoute(parts[1]||"");}window.addEventListener("popstate",onPop);return function(){window.removeEventListener("popstate",onPop);};},[]);
```

- [ ] **Step 4: Update screen→hash sync to include sub-routes**

Change line 17274 from:
```js
else{try{window.history.pushState({screen:screen},"","#"+screen);}catch(e){}}
```
to:
```js
else{var fullHash=subRoute?screen+"/"+subRoute:screen;try{window.history.pushState({screen:screen,subRoute:subRoute},"","#"+fullHash);}catch(e){}}
```

Also add `subRoute` to the dependency array of this useEffect (line 17272). The closing of this effect is around line 17290 — find the `},[screen]);` and change to `},[screen,subRoute]);`.

- [ ] **Step 5: Update `navTo` to accept sub-routes**

Change line 17746-17752 from:
```js
var navTo=useCallback(function(s){
    if(s==="standings")s="leaderboard";
    if(s==="admin"&&!isAdmin){toast("Admin access required","error");return;}
    var canScrims=isAdmin||(currentUser&&scrimAccess.includes(currentUser.username));
    if(s==="scrims"&&!canScrims){toast("Access restricted","error");return;}
    setScreen(s);
  },[isAdmin,currentUser,scrimAccess,toast]);
```
to:
```js
var navTo=useCallback(function(s,sub){
    var parts=s.split("/");
    var base=parts[0];
    var sr=sub||parts[1]||"";
    if(base==="admin"&&!isAdmin){toast("Admin access required","error");return;}
    var canScrims=isAdmin||(currentUser&&scrimAccess.includes(currentUser.username));
    if(base==="scrims"&&!canScrims){toast("Access restricted","error");return;}
    setScreen(base);
    setSubRoute(sr);
  },[isAdmin,currentUser,scrimAccess,toast]);
```

- [ ] **Step 6: Update safeScreens to include new merged screen IDs**

At line 17769, update the `safeScreens` array to include `"standings"`, `"clash"`, `"events"`, and keep all existing IDs for backwards compatibility:

```js
var safeScreens=["home","standings","clash","events","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms","gear","tournaments","signup","login"];
```

- [ ] **Step 7: Add backwards-compatible aliases in popstate handler**

In the popstate handler (Step 3), after parsing `base`, add aliases so old bookmarks still work:

```js
var aliases={"leaderboard":"standings","hof":"standings","roster":"standings","milestones":"profile","challenges":"profile","archive":"events","tournaments":"events","featured":"events","bracket":"clash","results":"clash"};
if(aliases[base]){var newSub=base;if(base==="leaderboard")newSub="";base=aliases[base];parts[1]=parts[1]||newSub;}
```

- [ ] **Step 8: Verify brace balance and test on dev server**

Run: `node -e "var f=require('fs').readFileSync('src/App.jsx','utf8');var o=0;for(var i=0;i<f.length;i++){if(f[i]==='{')o++;if(f[i]==='}')o--;}console.log('Balance:',o)"`
Expected: `Balance: 0`

Open `http://localhost:5176` and test:
- `#home` loads HomeScreen
- `#standings` loads (will show leaderboard for now, wrapper comes in Task 3)
- `#standings/hof` sets screen=standings, subRoute=hof
- Browser back/forward preserves sub-routes
- Old bookmarks like `#leaderboard` still work

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "feat: extend hash router with sub-route support for merged screens"
```

---

## Task 2: Context-Aware Navbar

**Files:**
- Modify: `src/App.jsx:2948-3335` (Navbar function)
- Modify: `src/App.jsx:2979-2993` (PRIMARY array)
- Modify: `src/App.jsx:3003-3021` (DESKTOP_PRIMARY array)
- Modify: `src/App.jsx:3023-3038` (DESKTOP_MORE array)

**What:** Replace static nav arrays with dynamic ones that change based on `tournamentState.phase`. Add the glowing "LIVE CLASH" button, gold "Register" badge, teal "Results" badge.

**Prerequisite:** The Navbar function receives `tournamentState` — check its props. If not, it needs to be threaded from TFTClash → Navbar at line 18063.

- [ ] **Step 1: Thread `tournamentState` into Navbar**

At line 18063-18065, the Navbar JSX call is:
```jsx
<Navbar screen={screen} setScreen={navTo} players={players} isAdmin={isAdmin} setIsAdmin={setIsAdmin} toast={toast} disputes={disputes}
  currentUser={currentUser} onAuthClick={(mode)=>setAuthScreen(mode)} notifications={notifications} onMarkAllRead={markAllRead} scrimAccess={scrimAccess}/>
```

Add `tournamentState={tournamentState}` to this props list.

At line 2948, the Navbar function signature is:
```js
function Navbar({screen,setScreen,players,isAdmin,setIsAdmin,toast,disputes,currentUser,onAuthClick,notifications,onMarkAllRead,scrimAccess}){
```

Add `tournamentState` to the destructuring:
```js
function Navbar({screen,setScreen,players,isAdmin,setIsAdmin,toast,disputes,currentUser,onAuthClick,notifications,onMarkAllRead,scrimAccess,tournamentState}){
```

Also add `canScrims` variable computation inside Navbar (before the nav arrays):
```js
var canScrims=isAdmin||(currentUser&&scrimAccess.includes(currentUser.username));
```

- [ ] **Step 2: Replace PRIMARY (mobile) array with phase-aware version**

Replace lines 2979-2993 with:

```js
var phase=tournamentState&&tournamentState.phase;
var clashItem=null;
if(phase==="registration") clashItem={id:"clash",icon:"ti-swords",label:"Clash",badge:"Register",badgeColor:"#E8A838"};
else if(phase==="live") clashItem={id:"clash",icon:"ti-swords",label:"LIVE",glow:true};
else if(phase==="complete") clashItem={id:"clash",icon:"ti-swords",label:"Clash",badge:"Results",badgeColor:"#4ECDC4"};

var PRIMARY=[
  {id:"home",icon:"ti-home",label:"Home"},
  clashItem,
  {id:"standings",icon:"ti-chart-bar",label:"Standings"},
  {id:"profile",icon:"ti-user",label:"Profile"},
  {id:"more",icon:"ti-dots",label:"More"},
].filter(Boolean);
```

- [ ] **Step 3: Replace DESKTOP_PRIMARY with phase-aware version**

Replace lines 3003-3021 with:

```js
var DESKTOP_PRIMARY=[
  {id:"home",label:"Home"},
  clashItem&&Object.assign({},clashItem,{label:phase==="live"?"\u25cf LIVE CLASH":phase==="registration"?"Clash \xb7 Register":phase==="complete"?"Clash \xb7 Results":"Clash"}),
  {id:"standings",label:"Standings"},
  phase!=="live"?{id:"events",label:"Events"}:null,
  {id:"profile",label:"Profile"},
].filter(Boolean);
```

- [ ] **Step 4: Update DESKTOP_MORE with all secondary screens**

Replace lines 3023-3038 with:

```js
var DESKTOP_MORE=[
  phase==="live"?{id:"events",label:"Events"}:null,
  canScrims?{id:"scrims",label:"Scrims"}:null,
  {id:"pricing",label:"Pricing"},
  {id:"rules",label:"Rules"},
  {id:"faq",label:"FAQ"},
  {id:"host-apply",label:"Host"},
  {id:"gear",label:"Gear"},
  isAdmin?{id:"admin",label:"Admin"}:null,
].filter(Boolean);
```

- [ ] **Step 5: Add glowing LIVE CLASH button styles to GCSS**

Do NOT modify the GCSS template literal structure. Instead, add a new `<style>` block in the Navbar's return JSX (inline styles or a style tag rendered by Navbar). Add:

```js
var liveGlowStyle=phase==="live"?{
  background:"linear-gradient(135deg,rgba(232,168,56,.25),rgba(248,113,113,.15))",
  color:"#E8A838",
  fontWeight:700,
  border:"1px solid rgba(232,168,56,.4)",
  boxShadow:"0 0 12px rgba(232,168,56,.3),0 0 24px rgba(232,168,56,.1)",
  animation:"pulse-glow 2s infinite",
}:null;
```

Apply `liveGlowStyle` to the Clash nav item when rendering (in the desktop nav item loop and mobile bottom bar).

- [ ] **Step 6: Add badge rendering for registration/results states**

In the nav item rendering loop, after the label text, conditionally render a badge:

```js
item.badge?React.createElement("span",{style:{
  marginLeft:6,fontSize:10,fontWeight:700,
  padding:"2px 6px",borderRadius:4,
  background:"rgba("+(item.badgeColor==="#E8A838"?"232,168,56":"78,205,196")+",.15)",
  color:item.badgeColor,
  border:"1px solid rgba("+(item.badgeColor==="#E8A838"?"232,168,56":"78,205,196")+",.3)",
}},item.badge):null
```

- [ ] **Step 7: Verify brace balance and test**

Brace balance check. Then test on dev server:
- With `phase:"registration"` → nav shows "Clash · Register" with gold badge
- With `phase:"live"` → nav shows glowing "LIVE CLASH" button, Events moves to More
- With `phase:"complete"` → nav shows "Clash · Results" with teal badge
- With `phase:null` → nav shows Home, Standings, Events, Profile, More (no Clash)

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: context-aware navbar that adapts to tournament phase"
```

---

## Task 3: StandingsScreen Wrapper (Leaderboard + HoF + Roster as Tabs)

**Files:**
- Modify: `src/App.jsx` — add new `StandingsScreen` function (insert before `HomeScreen` at ~line 3504)
- Modify: `src/App.jsx:18071-18085` (screen rendering block — update standings/leaderboard/hof/roster entries)

**What:** Create a wrapper component with a tab bar that renders the existing LeaderboardScreen, HofScreen, or RosterScreen based on `subRoute`.

- [ ] **Step 1: Create StandingsScreen wrapper function**

Insert before `HomeScreen` (before line 3504):

```js
function StandingsScreen(props){
  var tab=props.subRoute||"";
  var tabs=[
    {id:"",label:"Leaderboard"},
    {id:"hof",label:"Hall of Fame"},
    {id:"roster",label:"Player Directory"},
  ];
  return React.createElement("div",{className:"page"},
    React.createElement("div",{style:{display:"flex",gap:4,padding:"0 16px",marginBottom:20,borderBottom:"1px solid rgba(242,237,228,.06)"}},
      tabs.map(function(t){
        var active=tab===t.id;
        return React.createElement("button",{
          key:t.id,
          onClick:function(){props.setScreen("standings"+(t.id?"/"+t.id:""));},
          style:{
            padding:"10px 18px",
            background:"none",
            border:"none",
            borderBottom:active?"2px solid #9B72CF":"2px solid transparent",
            color:active?"#F2EDE4":"#9AAABF",
            fontFamily:"'Barlow Condensed',sans-serif",
            fontSize:14,
            fontWeight:active?700:500,
            cursor:"pointer",
            letterSpacing:".02em",
            transition:"all .2s",
          }
        },t.label);
      })
    ),
    tab===""?React.createElement(MemoLeaderboardScreen,Object.assign({},props)):null,
    tab==="hof"?React.createElement(MemoHofScreen,Object.assign({},props,{pastClashes:props.pastClashes})):null,
    tab==="roster"?React.createElement(RosterScreen,Object.assign({},props)):null
  );
}
```

- [ ] **Step 2: Update screen rendering block for standings**

In the screen rendering block (lines 18071+), replace the individual entries for `leaderboard`, `hof`, and `roster` with a single `standings` entry:

Remove these lines:
```js
{screen==="leaderboard"&&<MemoLeaderboardScreen .../>}
{screen==="hof"        &&<MemoHofScreen .../>}
{screen==="roster"     &&<RosterScreen .../>}
```

Add:
```js
{screen==="standings"&&<StandingsScreen subRoute={subRoute} players={players} setScreen={navTo} setProfilePlayer={setProfilePlayer} currentUser={currentUser} toast={toast} pastClashes={pastClashes}/>}
```

Keep the old `screen==="leaderboard"` line BUT make it redirect: change it to:
```js
{screen==="leaderboard"&&navTo("standings")&&null}
{screen==="hof"&&navTo("standings/hof")&&null}
{screen==="roster"&&navTo("standings/roster")&&null}
```

Wait — that would cause render issues. Instead, handle legacy screen IDs in `navTo` or in a useEffect:

Add a useEffect in TFTClash (after the popstate handler). **Important:** Only add redirects for screens that have their wrapper ready. In Task 3 we only redirect standings-related screens. Tasks 4 and 5 will extend this useEffect with their own redirects.

```js
useEffect(function(){
  // Add redirects incrementally as wrapper screens are created:
  // Task 3: standings-related, Task 4: profile-related, Task 5: events-related + clash
  var redirects={leaderboard:"standings",hof:"standings/hof",roster:"standings/roster"};
  if(redirects[screen]){navTo(redirects[screen]);}
},[screen,navTo]);
```

**Note:** The `if(s==="standings")s="leaderboard"` alias in the old `navTo` is intentionally removed (Task 1 Step 5) because this redirect useEffect replaces it.

Then remove the old individual screen rendering lines for leaderboard, hof, roster (they'll never render since the redirect catches them first). Keep other screen lines (milestones, challenges, archive, etc.) until their respective wrapper tasks.

- [ ] **Step 3: Verify brace balance and test**

Test on dev server:
- `#standings` → shows tab bar with "Leaderboard" active, renders LeaderboardScreen content
- `#standings/hof` → "Hall of Fame" tab active, renders HofScreen
- `#standings/roster` → "Player Directory" tab active, renders RosterScreen
- `#leaderboard` → auto-redirects to `#standings`
- Tab switching works, browser back/forward preserves tab

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: merge Leaderboard + HoF + Roster into Standings screen with tabs"
```

---

## Task 4: ProfileScreen Wrapper (Account + Milestones + Challenges as Tabs)

**Files:**
- Modify: `src/App.jsx` — add `ProfileScreen` function
- Modify: `src/App.jsx:18087-18109` (screen rendering block)

**What:** Same pattern as StandingsScreen — tab wrapper for Account, Milestones, Challenges.

- [ ] **Step 1: Create ProfileScreen wrapper function**

Insert after StandingsScreen:

```js
function ProfileScreen(props){
  var tab=props.subRoute||"";
  var tabs=[
    {id:"",label:"Account"},
    {id:"milestones",label:"Milestones"},
    {id:"challenges",label:"Challenges"},
  ];
  if(!props.currentUser){
    return React.createElement(AutoLogin,{setAuthScreen:props.setAuthScreen});
  }
  return React.createElement("div",{className:"page"},
    React.createElement("div",{style:{display:"flex",gap:4,padding:"0 16px",marginBottom:20,borderBottom:"1px solid rgba(242,237,228,.06)"}},
      tabs.map(function(t){
        var active=tab===t.id;
        return React.createElement("button",{
          key:t.id,
          onClick:function(){props.setScreen("profile"+(t.id?"/"+t.id:""));},
          style:{
            padding:"10px 18px",
            background:"none",
            border:"none",
            borderBottom:active?"2px solid #9B72CF":"2px solid transparent",
            color:active?"#F2EDE4":"#9AAABF",
            fontFamily:"'Barlow Condensed',sans-serif",
            fontSize:14,
            fontWeight:active?700:500,
            cursor:"pointer",
            letterSpacing:".02em",
            transition:"all .2s",
          }
        },t.label);
      })
    ),
    tab===""?React.createElement(React.Fragment,null,
      React.createElement(AccountScreen,Object.assign({},props,{user:props.currentUser,onUpdate:props.onUpdate,onLogout:props.onLogout})),
      React.createElement("div",{className:"wrap",style:{maxWidth:600,margin:"0 auto",padding:"0 16px"}},
        React.createElement(ReferralPanel,{currentUser:props.currentUser,toast:props.toast})
      )
    ):null,
    tab==="milestones"?React.createElement(MilestonesScreen,Object.assign({},props)):null,
    tab==="challenges"?React.createElement(ChallengesScreen,Object.assign({},props)):null
  );
}
```

- [ ] **Step 2: Extend the redirect useEffect (from Task 3) with profile-related redirects**

In the redirect useEffect created in Task 3, extend the `redirects` object:

```js
var redirects={leaderboard:"standings",hof:"standings/hof",roster:"standings/roster",account:"profile",milestones:"profile/milestones",challenges:"profile/challenges"};
```

- [ ] **Step 3: Update screen rendering block**

Replace the individual `account`, `milestones`, `challenges` entries with:

```js
{screen==="profile"&&!profilePlayer&&<ProfileScreen subRoute={subRoute} currentUser={currentUser} setAuthScreen={setAuthScreen} onUpdate={updateUser} onLogout={handleLogout} toast={toast} setScreen={navTo} players={players} setPlayers={setPlayers} setProfilePlayer={setProfilePlayer} isAdmin={isAdmin} hostApps={hostApps} challengeCompletions={challengeCompletions}/>}
```

**PlayerProfileScreen collision fix:** The existing `screen==="profile"&&profilePlayer` renders PlayerProfileScreen (viewing another player). To avoid confusion, also clear `profilePlayer` when navigating to `#profile` via the nav bar. Add inside the redirect useEffect or navTo:

```js
// Inside navTo, when navigating to "profile" from nav (not from a player click):
if(base==="profile"&&!sub){setProfilePlayer(null);}
```

This ensures clicking "Profile" in the nav always shows your own profile.

- [ ] **Step 4: Verify brace balance and test**

Test: `#profile` shows Account tab (clears profilePlayer), `#profile/milestones` shows Milestones, `#profile/challenges` shows Challenges. Old `#account` redirects to `#profile`.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: merge Account + Milestones + Challenges into Profile screen with tabs"
```

---

## Task 5: EventsScreen Wrapper (Archive + Tournaments + Featured as Tabs)

**Files:**
- Modify: `src/App.jsx` — add `EventsScreen` function
- Modify: `src/App.jsx` screen rendering block

**What:** Tab wrapper for Archive, Tournaments, Featured. Flash tournament and tournament detail remain as click-throughs.

- [ ] **Step 1: Create EventsScreen wrapper function**

Same tab pattern. Tabs: Archive (default), Tournaments, Featured.

```js
function EventsScreen(props){
  var tab=props.subRoute||"";
  var tabs=[
    {id:"",label:"Archive"},
    {id:"tournaments",label:"Tournaments"},
    {id:"featured",label:"Featured"},
  ];
  return React.createElement("div",{className:"page"},
    React.createElement("div",{style:{display:"flex",gap:4,padding:"0 16px",marginBottom:20,borderBottom:"1px solid rgba(242,237,228,.06)"}},
      tabs.map(function(t){
        var active=tab===t.id;
        return React.createElement("button",{
          key:t.id,
          onClick:function(){props.setScreen("events"+(t.id?"/"+t.id:""));},
          style:{
            padding:"10px 18px",background:"none",border:"none",
            borderBottom:active?"2px solid #9B72CF":"2px solid transparent",
            color:active?"#F2EDE4":"#9AAABF",
            fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,
            fontWeight:active?700:500,cursor:"pointer",
            letterSpacing:".02em",transition:"all .2s",
          }
        },t.label);
      })
    ),
    tab===""?React.createElement(ArchiveScreen,Object.assign({},props)):null,
    tab==="tournaments"?React.createElement(TournamentsListScreen,Object.assign({},props)):null,
    tab==="featured"?React.createElement(FeaturedScreen,Object.assign({},props)):null
  );
}
```

- [ ] **Step 2: Extend the redirect useEffect with events-related and clash redirects**

In the redirect useEffect, extend the `redirects` object to its final form:

```js
var redirects={leaderboard:"standings",hof:"standings/hof",roster:"standings/roster",account:"profile",milestones:"profile/milestones",challenges:"profile/challenges",archive:"events",tournaments:"events/tournaments",featured:"events/featured",bracket:"clash",results:"clash/results"};
```

- [ ] **Step 3: Update screen rendering block**

Replace `archive`, `tournaments`, `featured` entries with:

```js
{screen==="events"&&<EventsScreen subRoute={subRoute} players={players} currentUser={currentUser} setScreen={navTo} pastClashes={pastClashes} toast={toast} onAuthClick={function(m){setAuthScreen(m);}} featuredEvents={featuredEvents} setFeaturedEvents={setFeaturedEvents}/>}
```

Keep `flash-*` and `tournament-*` screen entries as-is (they are click-throughs, not tabs).

- [ ] **Step 4: Fix the IIFE on line 18117**

Line 18117 uses an IIFE `(function(){...})()` which violates Critical Rule #1. Replace it with a helper variable computed before the JSX return.

**Insertion point:** Immediately before the `return` statement of `TFTClash()`, after all state, effects, and callbacks are defined (around line 18055-18060). The variable depends on `featuredEvents`, `currentUser`, `navTo`, `setAuthScreen`, `toast`, and `players` which are all defined by this point.

Add:
```js
var tournamentDetailContent=null;
if(screen.indexOf("tournament-")===0){
  var evId=screen.replace("tournament-","");
  var ev=featuredEvents.find(function(e){return e.id===evId;});
  if(!ev){
    tournamentDetailContent=React.createElement("div",{className:"page wrap",style:{textAlign:"center",paddingTop:80}},
      React.createElement("div",{style:{fontSize:36,marginBottom:16}},"\ud83d\udd0d"),
      React.createElement("h2",{style:{color:"#F2EDE4",marginBottom:10}},"Event Not Found"),
      React.createElement("p",{style:{color:"#BECBD9"}},"This event may have been removed."),
      React.createElement(Btn,{v:"primary",onClick:function(){navTo("events/featured");}},"Back to Featured")
    );
  }else{
    tournamentDetailContent=React.createElement(TournamentDetailScreen,{event:ev,featuredEvents:featuredEvents,setFeaturedEvents:setFeaturedEvents,currentUser:currentUser,onAuthClick:function(m){setAuthScreen(m);},toast:toast,setScreen:navTo,players:players});
  }
}
```

Then replace line 18117 with:
```js
{screen.indexOf("tournament-")===0&&tournamentDetailContent}
```

- [ ] **Step 4: Verify brace balance and test**

Test: `#events` → Archive tab, `#events/tournaments` → Tournaments tab, `#events/featured` → Featured tab. Old `#archive` redirects. Flash/tournament detail click-throughs still work.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: merge Archive + Tournaments + Featured into Events screen with tabs

Also fix IIFE violation on tournament detail rendering."
```

---

## Task 6: Mobile Bottom Bar

**Files:**
- Modify: `src/App.jsx:2948-3335` (Navbar function — mobile section)

**What:** The mobile nav (PRIMARY array) was already updated in Task 2 to be context-aware. This task ensures the mobile bottom bar has proper styling: fixed bottom position, 5 tabs with icons, same glow/badge behavior as desktop.

- [ ] **Step 1: Update mobile bottom bar rendering**

Find the mobile nav rendering section inside the Navbar function (the section that maps over PRIMARY). Update the styling to:

```js
// Mobile bottom bar container
{style:{
  position:"fixed",bottom:0,left:0,right:0,
  background:"rgba(8,8,15,.97)",
  borderTop:"1px solid rgba(242,237,228,.08)",
  display:"flex",justifyContent:"space-around",alignItems:"center",
  padding:"8px 0 calc(8px + env(safe-area-inset-bottom))",
  zIndex:9990,
  backdropFilter:"blur(12px)",
}}
```

Each tab item:
```js
{style:{
  display:"flex",flexDirection:"column",alignItems:"center",gap:2,
  padding:"4px 12px",
  cursor:"pointer",
  color:isActive?"#F2EDE4":"#9AAABF",
  position:"relative",
}}
```

For the LIVE CLASH tab on mobile, add the gold glow dot:
```js
phase==="live"&&item.glow?React.createElement("div",{style:{
  position:"absolute",top:2,right:8,
  width:6,height:6,borderRadius:"50%",
  background:"#E8A838",
  boxShadow:"0 0 8px #E8A838",
  animation:"live-dot 1.5s infinite",
}}):null
```

- [ ] **Step 2: Ensure body has bottom padding for fixed bar**

Add bottom padding to the main content area so the fixed bottom bar doesn't overlap content. In the main wrapper div (around line 18061), add `paddingBottom:72` to the style for mobile viewports. Use a media query check or just always add it (the desktop nav is at top, so bottom padding is harmless).

- [ ] **Step 3: Verify and test**

Test on mobile viewport (Chrome DevTools responsive mode):
- Bottom bar shows 5 tabs: Home, Clash (or nothing when no clash), Standings, Profile, More
- LIVE state shows gold glowing dot on Clash tab
- Registration state shows badge
- Tapping tabs navigates correctly

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: styled mobile bottom bar with context-aware clash indicator"
```

---

# Sprint 2: Clash Night Experience

## Task 7: ClashScreen Phase-Adaptive Wrapper

**Files:**
- Modify: `src/App.jsx` — add `ClashScreen` function
- Modify: `src/App.jsx` screen rendering block

**What:** A single component that renders different content based on `tournamentState.phase`. Delegates to existing BracketScreen for live/registration and ResultsScreen for results, with new phase-specific headers and accent colors.

- [ ] **Step 1: Create ClashScreen wrapper function**

```js
function ClashScreen(props){
  var phase=props.tournamentState&&props.tournamentState.phase;
  var phaseColors={registration:"#9B72CF",live:"#E8A838",complete:"#4ECDC4"};
  var phaseLabels={registration:"Registration",live:"Live \u2014 Game "+(props.tournamentState.round||1)+" of "+(props.tournamentState.totalGames||4),complete:"Complete"};
  var accentColor=phaseColors[phase]||"#9B72CF";

  return React.createElement("div",{className:"page"},
    // Phase header bar
    React.createElement("div",{style:{
      position:"relative",overflow:"hidden",
      padding:"16px 20px",marginBottom:20,
      borderRadius:14,
      background:"rgba(17,24,39,.8)",
      border:"1px solid rgba("+hexToRgb(accentColor)+",.2)",
    }},
      // Top accent line
      React.createElement("div",{style:{
        position:"absolute",top:0,left:0,right:0,height:3,
        background:"linear-gradient(90deg,transparent,"+accentColor+",transparent)",
      }}),
      // Phase indicator
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
        React.createElement("div",{style:{
          width:8,height:8,borderRadius:"50%",background:accentColor,
          boxShadow:phase==="live"?"0 0 8px "+accentColor:"none",
          animation:phase==="live"?"live-dot 1.5s infinite":"none",
        }}),
        React.createElement("span",{style:{
          fontSize:10,textTransform:"uppercase",letterSpacing:".12em",
          color:accentColor,fontWeight:700,
          fontFamily:"'Barlow Condensed',sans-serif",
        }},"Phase: "+phaseLabels[phase])
      )
    ),
    // Phase content
    phase==="registration"||phase==="live"?React.createElement(MemoBracketScreen,Object.assign({},props)):null,
    phase==="complete"?React.createElement(MemoResultsScreen,Object.assign({},props)):null,
    !phase?React.createElement("div",{style:{textAlign:"center",padding:"60px 20px",color:"#9AAABF"}},
      React.createElement("i",{className:"ti ti-swords",style:{fontSize:48,opacity:.3,display:"block",marginBottom:16}}),
      React.createElement("h2",{style:{color:"#F2EDE4",marginBottom:8,fontFamily:"'Playfair Display',serif"}},"No Active Clash"),
      React.createElement("p",{style:{fontSize:14}},"Check back when registration opens for the next clash.")
    ):null
  );
}

// IMPORTANT: Place hexToRgb at module scope (not inside any component).
// It is used by ClashScreen, LobbyCard, and other components.
function hexToRgb(hex){
  var r=parseInt(hex.slice(1,3),16);
  var g=parseInt(hex.slice(3,5),16);
  var b=parseInt(hex.slice(5,7),16);
  return r+","+g+","+b;
}
```

- [ ] **Step 2: Update screen rendering block**

Add:
```js
{screen==="clash"&&<ClashScreen subRoute={subRoute} players={players} setPlayers={setPlayers} toast={toast} isAdmin={isAdmin} currentUser={currentUser} setProfilePlayer={setProfilePlayer} setScreen={navTo} tournamentState={tournamentState} setTournamentState={setTournamentState} seasonConfig={seasonConfig}/>}
```

The redirects useEffect from Task 3 already handles `bracket→clash` and `results→clash/results`.

- [ ] **Step 3: Verify and test**

Test with different `tournamentState.phase` values:
- `phase:"registration"` → purple accent, BracketScreen content
- `phase:"live"` → gold accent with pulsing dot, BracketScreen content
- `phase:"complete"` → teal accent, ResultsScreen content
- `phase:null` → "No Active Clash" placeholder

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: phase-adaptive Clash screen with registration/live/results rendering"
```

---

## Task 8: Live Phase Lobby Cards

**Files:**
- Modify: `src/App.jsx` — add `LobbyCard` component (insert near ClashScreen)

**What:** Enhanced lobby cards for the live phase with status badges, color-coded borders, player lists, and expand-to-submit behavior. These integrate into the existing BracketScreen lobby rendering.

- [ ] **Step 1: Create LobbyCard component**

```js
function LobbyCard(props){
  var lobby=props.lobby;
  var expanded=props.expanded;
  var statusColors={LOCKED:"#6EE7B7",IN_GAME:"#E8A838",AWAITING:"#9B72CF",COMPLETE:"#4ECDC4"};
  var status=lobby.status||"AWAITING";
  var borderColor=statusColors[status]||"#9B72CF";

  return React.createElement("div",{
    onClick:props.onToggle,
    style:{
      background:"rgba(17,24,39,.8)",
      border:"1px solid rgba("+hexToRgb(borderColor)+",.2)",
      borderRadius:12,padding:14,cursor:"pointer",
      borderLeft:"3px solid "+borderColor,
      transition:"all .25s ease",
      transform:expanded?"scale(1)":"scale(1)",
      boxShadow:status==="IN_GAME"?"0 0 20px rgba(232,168,56,.08)":"none",
    }
  },
    // Header: Lobby name + status badge
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}},
      React.createElement("span",{style:{fontSize:13,fontWeight:700,color:borderColor,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".04em"}},lobby.name||"Lobby"),
      React.createElement("span",{style:{
        fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",
        padding:"2px 8px",borderRadius:4,
        background:"rgba("+hexToRgb(borderColor)+",.12)",
        color:borderColor,
      }},status.replace("_"," "))
    ),
    // Player list
    React.createElement("div",{style:{fontSize:11,color:"#BECBD9",lineHeight:1.6}},
      (lobby.players||[]).map(function(p,i){
        return React.createElement("span",{key:i},
          (i>0?", ":""),
          React.createElement("span",{style:{color:"#F2EDE4",fontWeight:500}},p.username||p.name||p)
        );
      })
    ),
    // Expanded: result submission area
    expanded?React.createElement("div",{style:{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(242,237,228,.06)"}},
      React.createElement("div",{style:{fontSize:11,color:"#9AAABF",marginBottom:8}},"Expand for result submission during live games.")
    ):null
  );
}
```

- [ ] **Step 2: Integrate LobbyCard into BracketScreen's lobby rendering**

Find the lobby rendering section inside BracketScreen (around lines 4963-5839). The existing code likely renders lobbies in a list. Replace the lobby item rendering with `LobbyCard`. This requires reading the exact lobby rendering code first to find the right insertion point.

**Note to implementer:** Read BracketScreen carefully before editing. The lobby data structure may use `tournamentState.lobbies[]` with fields like `name`, `players[]`, `status`. Map over these and render LobbyCard for each.

- [ ] **Step 3: Verify and test**

Test with mock lobby data: cards show status badges, color-coded borders, player lists. Click to expand.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: styled lobby cards with status badges and color-coded borders"
```

---

## Task 9: Live Standings Table with Animations

**Files:**
- Modify: `src/App.jsx` — enhance the existing StandingsTable or create `LiveStandingsTable` component

**What:** Animated standings table for the live phase showing cumulative points, position deltas, crown icon on 1st place, slide-in animation on rows.

- [ ] **Step 1: Create LiveStandingsTable component**

```js
function LiveStandingsTable(props){
  var standings=props.standings||[];
  return React.createElement("div",{style:{
    background:"rgba(8,8,15,.6)",border:"1px solid rgba(242,237,228,.06)",
    borderRadius:12,overflow:"hidden",
  }},
    // Header row
    React.createElement("div",{style:{
      display:"grid",gridTemplateColumns:"36px 1fr 60px 50px",
      padding:"8px 14px",fontSize:10,color:"#9AAABF",
      borderBottom:"1px solid rgba(242,237,228,.04)",
      fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".06em",textTransform:"uppercase",
    }},
      React.createElement("span",null,"#"),
      React.createElement("span",null,"Player"),
      React.createElement("span",{style:{textAlign:"right"}},"Pts"),
      React.createElement("span",{style:{textAlign:"right"}},"Delta")
    ),
    // Player rows
    standings.map(function(p,i){
      var isFirst=i===0;
      var delta=p.delta||0;
      var posChange=p.posChange||0;
      return React.createElement("div",{
        key:p.id||p.username||i,
        style:{
          display:"grid",gridTemplateColumns:"36px 1fr 60px 50px",
          padding:"10px 14px",fontSize:13,
          background:isFirst?"rgba(232,168,56,.04)":"transparent",
          borderLeft:isFirst?"3px solid #E8A838":"3px solid transparent",
          animation:"slide-in .4s ease both",
          animationDelay:(i*0.05)+"s",
        }
      },
        React.createElement("span",{style:{
          color:isFirst?"#E8A838":"#BECBD9",fontWeight:isFirst?700:400,
        }},isFirst?"\ud83d\udc51":String(i+1)),
        React.createElement("span",{style:{color:"#F2EDE4",fontWeight:isFirst?700:500}},
          p.username||p.name,
          posChange!==0?React.createElement("span",{style:{
            fontSize:10,marginLeft:6,
            color:posChange>0?"#6EE7B7":"#F87171",
          }},posChange>0?"\u25b2 "+posChange:"\u25bc "+Math.abs(posChange)):null
        ),
        React.createElement("span",{style:{textAlign:"right",color:isFirst?"#E8A838":"#F2EDE4",fontWeight:700}},p.points||0),
        React.createElement("span",{style:{
          textAlign:"right",fontSize:12,
          color:delta>0?"#6EE7B7":delta<0?"#F87171":"#9AAABF",
        }},delta>0?"+"+delta:delta===0?"-":String(delta))
      );
    })
  );
}
```

- [ ] **Step 2: Integrate into ClashScreen live phase**

In ClashScreen, when `phase==="live"`, render LiveStandingsTable below the lobby cards section. Compute standings from `tournamentState` data.

- [ ] **Step 3: Verify and test**

Test with mock standings data. Crown on 1st, green/red arrows, slide-in animation, gold accent on leader.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: animated live standings table with position deltas and crown icon"
```

---

## Task 10: Results Phase — Your Finish Card

**Files:**
- Modify: `src/App.jsx` — enhance ClashScreen results rendering

**What:** When results phase shows, highlight the logged-in user's placement with a purple-bordered "Your Finish" card.

- [ ] **Step 1: Add YourFinishCard to ClashScreen results phase**

In ClashScreen, when `phase==="complete"`, before rendering ResultsScreen, add:

```js
var userFinish=null;
if(props.currentUser&&props.tournamentState.finalStandings){
  var found=props.tournamentState.finalStandings.find(function(s){
    return s.username===props.currentUser.username;
  });
  if(found){
    userFinish=React.createElement("div",{style:{
      background:"rgba(155,114,207,.06)",
      border:"1px solid rgba(155,114,207,.25)",
      borderLeft:"4px solid #9B72CF",
      borderRadius:12,padding:"16px 20px",marginBottom:20,
      display:"flex",alignItems:"center",justifyContent:"space-between",
      animation:"fade-up .5s ease both",
    }},
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:10,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4,fontFamily:"'Barlow Condensed',sans-serif"}},"Your Finish"),
        React.createElement("div",{style:{fontSize:24,fontWeight:900,color:"#9B72CF",fontFamily:"'Playfair Display',serif"}},
          found.position<=3?["\ud83e\udd47","\ud83e\udd48","\ud83e\udd49"][found.position-1]+" ":"",
          "#"+found.position
        )
      ),
      React.createElement("div",{style:{textAlign:"right"}},
        React.createElement("div",{style:{fontSize:22,fontWeight:700,color:"#E8A838"}},found.points+" pts"),
        React.createElement("div",{style:{fontSize:11,color:found.posChange>0?"#6EE7B7":"#F87171"}},
          found.posChange>0?"\u25b2 "+found.posChange+" from last clash":
          found.posChange<0?"\u25bc "+Math.abs(found.posChange)+" from last clash":
          "Same as last clash"
        )
      )
    );
  }
}
```

Render `userFinish` at the top of the results phase content.

- [ ] **Step 2: Verify and test**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: your-finish highlight card in clash results phase"
```

---

# Sprint 3: Killer Features

## Task 11: Swiss Reseeding Engine

**Files:**
- Modify: `src/App.jsx:690-701` (existing `snakeSeed` function)
- Modify: `src/App.jsx` admin tournament creation section
- Modify: ClashScreen live phase

**What:** Add Swiss Mode toggle to tournament creation. After every 2 games, auto-sort players by points and snake-seed into new lobbies.

- [ ] **Step 1: Add swissMode to tournamentState**

Update the tournamentState initialization (line 17101) to include `swissMode:false`.

- [ ] **Step 2: Add Swiss Mode toggle in admin tournament creation**

Find the tournament creation UI in AdminPanel. Add a toggle:
```js
React.createElement("label",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#BECBD9"}},
  React.createElement("input",{type:"checkbox",checked:tournamentState.swissMode||false,onChange:function(){
    setTournamentState(Object.assign({},tournamentState,{swissMode:!tournamentState.swissMode}));
  }}),
  "Swiss Mode (reseed lobbies after every 2 games)",
  React.createElement("i",{className:"ti ti-info-circle",style:{color:"#9AAABF",fontSize:14},title:"Players are sorted by cumulative points and snake-seeded into new lobbies after Games 2, 4, etc."})
)
```

- [ ] **Step 3: Create swissReseed function**

Add near the existing `snakeSeed` function (line 690):

```js
function swissReseed(players,lobbySize){
  var sorted=players.slice().sort(function(a,b){return(b.points||0)-(a.points||0);});
  return snakeSeed(sorted,lobbySize);
}
```

- [ ] **Step 4: Add reseed indicator to ClashScreen live phase**

In ClashScreen, when `phase==="live"` and `tournamentState.swissMode` and round is even (after game 2,4,...), show a compact indicator:

```js
var showReseed=props.tournamentState.swissMode&&props.tournamentState.round>1&&props.tournamentState.round%2===0;

showReseed?React.createElement("div",{style:{
  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
  padding:"8px 16px",margin:"12px 0",
  background:"rgba(232,168,56,.04)",
  border:"1px solid rgba(232,168,56,.12)",
  borderRadius:8,maxHeight:48,
  fontSize:11,color:"#E8A838",
  fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:".04em",
}},
  React.createElement("i",{className:"ti ti-arrows-shuffle",style:{fontSize:16}}),
  "Swiss Reseed \u2014 Lobbies reorganized by standings"
):null
```

- [ ] **Step 5: Verify and test**

Toggle Swiss Mode in admin → create clash → after game 2, reseed indicator appears, lobbies are reseeded.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: Swiss reseeding engine with admin toggle and compact live indicator"
```

---

## Task 12: Two-Click Result Confirmation

**Files:**
- Modify: `src/App.jsx` — add result submission UI inside LobbyCard expanded state
- Modify: `src/App.jsx` — add confirmation modal component

**What:** Players can submit results from inside a lobby card. A second player confirms. Disputes go to admin.

- [ ] **Step 1: Add result submission state to BracketScreen or ClashScreen**

Add state:
```js
var [resultSubmission,setResultSubmission]=useState(null);
// {lobbyId, submittedBy, rankings:[{playerId,position}], status:'pending'|'confirmed'|'disputed'}
```

- [ ] **Step 2: Add "Submit Results" button to LobbyCard expanded area**

When expanded and game is complete for this lobby, show:
```js
React.createElement(Btn,{v:"primary",size:"sm",onClick:function(e){
  e.stopPropagation();
  props.onSubmitResults(lobby);
}},
  React.createElement("i",{className:"ti ti-clipboard-check",style:{marginRight:6}}),
  "Submit Results"
)
```

- [ ] **Step 3: Create ResultSubmitModal component**

A modal with 8 dropdowns (one per player position 1st-8th). Player names from the lobby. Submit button.

```js
function ResultSubmitModal(props){
  var lobby=props.lobby;
  var players=lobby.players||[];
  var [rankings,setRankings]=useState(players.map(function(p,i){return {player:p,position:i+1};}));

  function handlePositionChange(playerIndex,newPosition){
    var updated=rankings.map(function(r,i){
      if(i===playerIndex)return Object.assign({},r,{position:parseInt(newPosition)});
      return r;
    });
    setRankings(updated);
  }

  return React.createElement("div",{style:{
    position:"fixed",inset:0,background:"rgba(8,8,15,.85)",zIndex:9995,
    display:"flex",alignItems:"center",justifyContent:"center",
    backdropFilter:"blur(8px)",
  },onClick:props.onClose},
    React.createElement("div",{style:{
      background:"#111827",border:"1px solid rgba(155,114,207,.2)",
      borderRadius:16,padding:24,maxWidth:420,width:"90%",
      maxHeight:"80vh",overflowY:"auto",
    },onClick:function(e){e.stopPropagation();}},
      React.createElement("h3",{style:{color:"#F2EDE4",marginBottom:16,fontFamily:"'Playfair Display',serif"}},"Submit Results \u2014 "+(lobby.name||"Lobby")),
      rankings.map(function(r,i){
        return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:10,marginBottom:8}},
          React.createElement("span",{style:{fontSize:13,color:"#F2EDE4",flex:1}},r.player.username||r.player.name||r.player),
          React.createElement("select",{
            value:r.position,
            onChange:function(e){handlePositionChange(i,e.target.value);},
            style:{padding:"6px 10px",borderRadius:6,background:"#08080F",border:"1px solid rgba(242,237,228,.1)",color:"#F2EDE4",fontSize:13},
          },
            [1,2,3,4,5,6,7,8].map(function(pos){
              return React.createElement("option",{key:pos,value:pos},ordinal(pos));
            })
          )
        );
      }),
      React.createElement("div",{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement(Btn,{v:"primary",onClick:function(){props.onSubmit(rankings);}},"Submit"),
        React.createElement(Btn,{v:"ghost",onClick:props.onClose},"Cancel")
      )
    )
  );
}

function ordinal(n){return n===1?"1st":n===2?"2nd":n===3?"3rd":n+"th";}
```

- [ ] **Step 4: Create ConfirmResultsModal component**

Similar to submit modal but read-only rankings with "Confirm" and "Dispute" buttons:

```js
function ConfirmResultsModal(props){
  var submission=props.submission;
  return React.createElement("div",{style:{
    position:"fixed",inset:0,background:"rgba(8,8,15,.85)",zIndex:9995,
    display:"flex",alignItems:"center",justifyContent:"center",
    backdropFilter:"blur(8px)",
  },onClick:props.onClose},
    React.createElement("div",{style:{
      background:"#111827",border:"1px solid rgba(78,205,196,.2)",
      borderRadius:16,padding:24,maxWidth:420,width:"90%",
    },onClick:function(e){e.stopPropagation();}},
      React.createElement("h3",{style:{color:"#F2EDE4",marginBottom:4,fontFamily:"'Playfair Display',serif"}},"Confirm Results?"),
      React.createElement("p",{style:{fontSize:12,color:"#9AAABF",marginBottom:16}},"Submitted by "+submission.submittedBy),
      (submission.rankings||[]).map(function(r,i){
        return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid rgba(242,237,228,.04)"}},
          React.createElement("span",{style:{width:28,fontSize:12,fontWeight:700,color:i<3?["#E8A838","#C0C0C0","#CD7F32"][i]:"#BECBD9"}},ordinal(r.position)),
          React.createElement("span",{style:{fontSize:13,color:"#F2EDE4"}},r.player.username||r.player.name||r.player)
        );
      }),
      React.createElement("div",{style:{display:"flex",gap:10,marginTop:16}},
        React.createElement(Btn,{v:"primary",onClick:props.onConfirm},React.createElement("i",{className:"ti ti-check",style:{marginRight:4}}),"Confirm"),
        React.createElement(Btn,{v:"ghost",style:{borderColor:"rgba(248,113,113,.3)",color:"#F87171"},onClick:props.onDispute},React.createElement("i",{className:"ti ti-flag",style:{marginRight:4}}),"Dispute")
      )
    )
  );
}
```

- [ ] **Step 5: Wire modals into ClashScreen/BracketScreen**

Add state for modal visibility and the submission/confirmation flow logic. Handle the self-confirm check (submitter cannot confirm their own results).

- [ ] **Step 6: Verify and test**

Test: Submit results for a lobby → second user sees confirmation prompt → confirm updates standings. Dispute shows admin notification.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: two-click result confirmation with submit/confirm/dispute flow"
```

---

## Task 13: Head-to-Head Records

**Files:**
- Modify: `src/App.jsx:5840-6609` (PlayerProfileScreen — add Rivals section)
- Add `computeH2H` helper function near `computeStats`

**What:** Compute H2H records from shared lobby history. Display on player profiles.

- [ ] **Step 1: Create computeH2H helper function**

Insert near `computeStats` (around line 332):

```js
function computeH2H(playerA,playerB,pastClashes){
  var shared=[];
  (pastClashes||[]).forEach(function(clash){
    (clash.lobbies||[]).forEach(function(lobby){
      var aResult=null,bResult=null;
      (lobby.results||[]).forEach(function(r){
        if(r.username===playerA)aResult=r;
        if(r.username===playerB)bResult=r;
      });
      if(aResult&&bResult){
        shared.push({clash:clash.name||clash.id,aPos:aResult.position,bPos:bResult.position});
      }
    });
  });
  var wins=0,losses=0,aAvg=0,bAvg=0;
  shared.forEach(function(s){
    if(s.aPos<s.bPos)wins++;
    else if(s.aPos>s.bPos)losses++;
    aAvg+=s.aPos;
    bAvg+=s.bPos;
  });
  var count=shared.length;
  return {
    sharedLobbies:count,
    wins:wins,losses:losses,
    ties:count-wins-losses,
    aAvg:count?+(aAvg/count).toFixed(1):0,
    bAvg:count?+(bAvg/count).toFixed(1):0,
    recent:shared.slice(-5),
  };
}
```

- [ ] **Step 2: Add Rivals section to PlayerProfileScreen**

Inside PlayerProfileScreen (after the existing stats section), add a "Rivals" section that shows H2H records against other players:

```js
// Compute H2H against all players who shared lobbies
var rivals=(props.allPlayers||[]).filter(function(p){return p.username!==player.username;}).map(function(p){
  var h2h=computeH2H(player.username,p.username,props.pastClashes||[]);
  return h2h.sharedLobbies>0?Object.assign({},h2h,{opponent:p}):null;
}).filter(Boolean).sort(function(a,b){return b.sharedLobbies-a.sharedLobbies;}).slice(0,5);
```

Render each rival as a compact card with win/loss bar:

```js
rivals.length>0?React.createElement("div",{style:{marginTop:24}},
  React.createElement("h3",{style:{fontSize:14,color:"#9AAABF",fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}},"Rivals"),
  rivals.map(function(r){
    var winPct=r.sharedLobbies>0?Math.round(r.wins/r.sharedLobbies*100):0;
    return React.createElement("div",{key:r.opponent.username,style:{
      display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
      background:"rgba(17,24,39,.6)",borderRadius:10,marginBottom:8,
      border:"1px solid rgba(96,165,250,.1)",
    }},
      React.createElement("span",{style:{fontSize:13,fontWeight:600,color:"#F2EDE4",flex:1}},r.opponent.username),
      React.createElement("span",{style:{fontSize:12,color:"#6EE7B7",fontWeight:700}},r.wins+"W"),
      React.createElement("span",{style:{fontSize:12,color:"#9AAABF"}},"-"),
      React.createElement("span",{style:{fontSize:12,color:"#F87171",fontWeight:700}},r.losses+"L"),
      React.createElement("div",{style:{width:60,height:4,borderRadius:2,background:"rgba(248,113,113,.3)",overflow:"hidden"}},
        React.createElement("div",{style:{width:winPct+"%",height:"100%",borderRadius:2,background:"linear-gradient(90deg,#6EE7B7,#4ECDC4)"}})
      ),
      React.createElement("span",{style:{fontSize:10,color:"#9AAABF"}},r.sharedLobbies+" games")
    );
  })
):null
```

- [ ] **Step 3: Thread pastClashes into PlayerProfileScreen**

Check if `pastClashes` is already passed as a prop. If not, add it to the PlayerProfileScreen call in the screen rendering block.

- [ ] **Step 4: Verify and test**

View a player profile → Rivals section shows H2H records with win/loss bars.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: head-to-head records with rival stats on player profiles"
```

---

## Task 14: Auto-Generated Clash Recap

**Files:**
- Modify: `src/App.jsx` — add `generateRecap` function and `ClashRecap` component
- Modify: `src/App.jsx` HomeScreen and ClashScreen results phase

**What:** Data-driven narrative recap after each clash. Templates based on position changes, streaks, comebacks.

- [ ] **Step 1: Create generateRecap function**

Insert near `computeClashAwards` (around line 990):

```js
function generateRecap(clashData){
  if(!clashData||!clashData.finalStandings||clashData.finalStandings.length===0)return null;
  var lines=[];
  var standings=clashData.finalStandings;
  var winner=standings[0];
  lines.push(winner.username+" claimed the crown with "+winner.points+" points.");

  // Biggest comeback
  var biggestClimb=null;
  standings.forEach(function(p){
    if(p.game1Pos&&p.position){
      var climb=p.game1Pos-p.position;
      if(!biggestClimb||climb>biggestClimb.climb)biggestClimb={player:p.username,from:p.game1Pos,to:p.position,climb:climb};
    }
  });
  if(biggestClimb&&biggestClimb.climb>=3){
    lines.push(biggestClimb.player+" pulled off an incredible comeback, climbing from "+ordinal(biggestClimb.from)+" after Game 1 to finish "+ordinal(biggestClimb.to)+".");
  }

  // Consistency king
  var consistent=standings.find(function(p){
    return p.allPlacements&&p.allPlacements.every(function(pos){return pos<=4;});
  });
  if(consistent&&consistent.username!==winner.username){
    lines.push(consistent.username+" earned the Consistency King award with all placements inside the top 4.");
  }

  // Close race
  if(standings.length>=2&&standings[0].points-standings[1].points<=2){
    lines.push("It came down to the wire \u2014 only "+(standings[0].points-standings[1].points)+" point"+(standings[0].points-standings[1].points===1?"":"s")+" separated "+standings[0].username+" and "+standings[1].username+".");
  }

  return {lines:lines,winner:winner.username,clashName:clashData.name||"Clash"};
}
```

- [ ] **Step 2: Create ClashRecap display component**

```js
function ClashRecap(props){
  var recap=props.recap;
  if(!recap)return null;
  return React.createElement("div",{style:{
    background:"rgba(17,24,39,.8)",border:"1px solid rgba(52,211,153,.15)",
    borderRadius:14,padding:20,position:"relative",overflow:"hidden",
  }},
    React.createElement("div",{style:{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#34D399,transparent)"}}),
    React.createElement("div",{style:{fontSize:10,textTransform:"uppercase",letterSpacing:".12em",color:"#34D399",fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}},recap.clashName+" Recap"),
    React.createElement("div",{style:{fontSize:14,color:"#F2EDE4",lineHeight:1.8}},
      recap.lines.map(function(line,i){
        return React.createElement("p",{key:i,style:{marginBottom:8}},line);
      })
    ),
    React.createElement("div",{style:{display:"flex",gap:8,marginTop:12}},
      React.createElement(Btn,{v:"ghost",size:"sm",onClick:function(){
        var text=recap.clashName+" Recap\n\n"+recap.lines.join("\n");
        navigator.clipboard.writeText(text);
        if(props.toast)props.toast("Copied to clipboard!","success");
      }},React.createElement("i",{className:"ti ti-brand-discord",style:{marginRight:4}}),"Copy for Discord"),
      React.createElement(Btn,{v:"ghost",size:"sm",onClick:function(){
        if(props.toast)props.toast("Share card coming soon!","info");
      }},React.createElement("i",{className:"ti ti-share",style:{marginRight:4}}),"Share Card")
    )
  );
}
```

- [ ] **Step 3: Integrate into ClashScreen results phase and HomeScreen**

In ClashScreen results phase, render ClashRecap below the your-finish card:
```js
var recap=generateRecap(props.tournamentState);
recap?React.createElement(ClashRecap,{recap:recap,toast:props.toast}):null
```

In HomeScreen, if the most recent clash has results, show the recap card.

- [ ] **Step 4: Verify and test**

Test with mock clash data that has comebacks, close finishes, consistency.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: auto-generated clash recap with Discord copy and share"
```

---

# Sprint 4: Visual Soul

## Task 15: Animation Pass

**Files:**
- Modify: `src/App.jsx` — GCSS or inline styles on new components

**What:** Ensure all new components (StandingsScreen, ProfileScreen, EventsScreen, ClashScreen, LobbyCard, LiveStandingsTable, modals) have the signature animations: fade-up on mount, slide-in on rows, hover transforms on cards.

- [ ] **Step 1: Add animation keyframes if not already in GCSS**

Check if `fade-up`, `slide-in`, `pulse-glow`, `live-dot` are defined in GCSS (lines 993-1705). If not, add them as a `<style>` tag in the root TFTClash return (NOT inside GCSS template literal):

```js
React.createElement("style",null,
  "@keyframes fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}"+
  "@keyframes slide-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}"+
  "@keyframes pulse-glow{0%,100%{box-shadow:0 0 12px rgba(232,168,56,.3),0 0 24px rgba(232,168,56,.1)}50%{box-shadow:0 0 20px rgba(232,168,56,.5),0 0 40px rgba(232,168,56,.2)}}"+
  "@keyframes live-dot{0%,100%{opacity:1}50%{opacity:.4}}"
)
```

- [ ] **Step 2: Add fade-up to wrapper screens**

Each wrapper screen (StandingsScreen, ProfileScreen, EventsScreen, ClashScreen) should have `animation:"fade-up .4s ease both"` on their outer `div.page`.

- [ ] **Step 3: Add hover transforms to tab buttons**

Tab buttons should have a subtle hover effect. Since we can't use `:hover` in inline styles, add a CSS class via the style tag:

```css
.tab-btn:hover{color:#F2EDE4!important;border-bottom-color:rgba(155,114,207,.4)!important}
```

Add `className:"tab-btn"` to all tab buttons in wrapper screens.

- [ ] **Step 4: Verify and test**

Navigate between screens — fade-up animation on mount. Lobby cards have hover lift. Tab buttons highlight on hover. Standings rows slide in.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: animation pass — fade-up, slide-in, hover transforms on all new components"
```

---

## Task 16: Gradient and Glow Audit

**Files:**
- Modify: `src/App.jsx` — review all new components for visual consistency

**What:** Ensure all new components match the visual identity: radial glows behind key cards, multi-stop gradient borders, proper use of accent colors.

- [ ] **Step 1: Audit each new component**

Check and enhance:
- StandingsScreen tab bar: add subtle gradient bottom border
- ClashScreen phase header: ensure radial glow overlay behind phase indicator
- LobbyCard: add subtle inner glow on IN_GAME status
- LiveStandingsTable: gold gradient on leader row
- Your Finish Card: purple radial glow behind the position number
- ClashRecap: teal gradient line at top (already there)

- [ ] **Step 2: Add missing glows**

For example, on the ClashScreen phase header when live:
```js
phase==="live"?React.createElement("div",{style:{
  position:"absolute",top:"-50%",left:"30%",width:"40%",height:"200%",
  background:"radial-gradient(ellipse,rgba(232,168,56,.06) 0%,transparent 70%)",
  pointerEvents:"none",
}}):null
```

- [ ] **Step 3: Verify and test**

Visual inspection on dev server. Every new card/section should have the characteristic "soul" — glows, gradients, depth.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: gradient and glow audit — visual soul preserved on all new components"
```

---

## Task 17: Mobile Responsive Pass

**Files:**
- Modify: `src/App.jsx` — responsive styles on new components

**What:** Ensure all new components work on mobile viewports (375px-768px).

- [ ] **Step 1: Check and fix grid layouts**

- Lobby cards grid: 3-col on desktop → 1-col on mobile. Use a JS check:
```js
var isMobile=window.innerWidth<768;
```
Or add CSS media queries in the style tag from Task 15.

- Standings table: ensure columns don't overflow on small screens
- Tab bars: horizontal scroll if tabs overflow

- [ ] **Step 2: Add CSS media queries**

In the style tag:
```css
@media(max-width:768px){
  .lobby-grid{grid-template-columns:1fr!important}
  .standings-grid{grid-template-columns:30px 1fr 50px 40px!important;font-size:12px!important}
}
```

- [ ] **Step 3: Verify and test**

Test in Chrome DevTools responsive mode at 375px, 414px, 768px widths.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: mobile responsive pass on all new components"
```

---

## Task 18: Final Polish and Consistency Check

**Files:**
- Modify: `src/App.jsx` — final fixes

**What:** Final review pass for consistency, edge cases, and polish.

- [ ] **Step 1: Verify all 27 screens are accessible**

Test each route from the complete route table in the spec. Every route should load its screen.

- [ ] **Step 2: Test all tournament phases end-to-end**

Walk through: no clash → registration → live → complete → back to no clash. Verify nav changes, Clash screen adapts, standings update.

- [ ] **Step 3: Verify brace balance one final time**

```bash
node -e "var f=require('fs').readFileSync('src/App.jsx','utf8');var o=0;for(var i=0;i<f.length;i++){if(f[i]==='{')o++;if(f[i]==='}')o--;}console.log('Balance:',o)"
```

- [ ] **Step 4: Final commit**

```bash
git add src/App.jsx
git commit -m "chore: final polish pass — consistency, edge cases, brace balance verified"
```
