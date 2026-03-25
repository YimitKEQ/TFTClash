# TFT Clash Restoration & Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip fake content, fix all broken navigation, seed real player data, build the hybrid Dashboard Clash card, and wire up real Supabase auth — restoring the authentic TFT Clash platform.

**Architecture:** Six sequential phases touching constants, AppContext, Sidebar, HomeScreen, DashboardScreen, and auth flow. Each phase is independently shippable. Phases 1-3 are pure fixes (low risk). Phases 4-6 build new functionality on top of a clean foundation.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Supabase JS v2, Material Symbols Outlined icons. Code style: `var` declarations, `function(){}` callbacks, no arrow functions, no backtick strings in JS. Stitch "Obsidian Arena" design tokens throughout.

**Spec:** `docs/superpowers/specs/2026-03-24-tft-clash-restoration-design.md`

---

## File Map

| File | Action | What Changes |
|---|---|---|
| `src/lib/constants.js` | Modify | Populate `SEED`, `HOMIES_IDS`, `PAST_CLASHES` |
| `src/context/AppContext.jsx` | Modify | Remove mock user (line 140), delete DEV_MOCK guard (lines 303-305), change `tournamentState` default phase to `"idle"`, wire auth, add `pastClashes` fallback |
| `src/components/layout/Sidebar.jsx` | Full rewrite | Grouped nav (Play/Compete/Me), guest-safe, real logout, `var`/`function` code style |
| `src/screens/HomeScreen.jsx` | Modify | Fix tagline, fix stats bar (no fake LIVE), fix CTA copy, fix countdown condition |
| `src/screens/DashboardScreen.jsx` | Modify | Add `ClashCard` component replacing/wrapping `PulseHeader` |

---

## Phase 1 — Strip the Fake

### Task 1: Fix `tournamentState` default phase

**Files:**
- Modify: `src/context/AppContext.jsx:87`

- [ ] Open `src/context/AppContext.jsx`. Find line 87:
  ```js
  var _tournamentState = useState({phase:"registration",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[],waitlistIds:[],maxPlayers:24});
  ```
  Change `phase:"registration"` to `phase:"idle"`:
  ```js
  var _tournamentState = useState({phase:"idle",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[],waitlistIds:[],maxPlayers:24});
  ```

- [ ] Run dev server (`npm run dev`). Open the app. Dashboard should now show an idle state instead of "Registration Open". Verify no crash.

- [ ] Commit:
  ```bash
  git add src/context/AppContext.jsx
  git commit -m "fix: change tournamentState default phase from registration to idle"
  ```

---

### Task 2: Fix HomeScreen — tagline, stats bar, countdown, CTA copy

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

- [ ] **Fix the tagline.** Find:
  ```jsx
  <p className="max-w-xl mx-auto text-on-surface-variant font-headline text-2xl italic opacity-80">
    Where legends are forged in the convergence.
  </p>
  ```
  Replace with:
  ```jsx
  <p className="max-w-xl mx-auto text-on-surface-variant font-headline text-xl opacity-60">
    Weekly TFT Clash. Every Saturday.
  </p>
  ```

- [ ] **Fix the stats bar `SeasonStatsBar` component.** Replace the entire component (lines ~74-101) with:
  ```jsx
  function SeasonStatsBar({ players, pastClashes, tournamentState, seasonConfig }) {
    var phase = tournamentState && tournamentState.phase
    var isLive = phase === 'live' || phase === 'inprogress'
    var playerCount = players && players.length > 0 ? players.length.toLocaleString() : '\u2014'
    var clashCount = pastClashes && pastClashes.length > 0 ? String(pastClashes.length) : '\u2014'
    var seasonName = (seasonConfig && seasonConfig.seasonName) || 'Season 1'

    return (
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
          <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Community</span>
          <span className="font-mono text-xl text-primary">Free to Play</span>
        </div>
        <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
          <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Players</span>
          <span className="font-mono text-xl text-on-surface">{playerCount}</span>
        </div>
        <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
          <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Clashes Run</span>
          <span className="font-mono text-xl text-on-surface">{clashCount}</span>
        </div>
        <div className="bg-surface-container-low p-6 rounded-lg border border-outline-variant/5">
          <span className="block font-label text-[10px] text-on-surface-variant tracking-widest uppercase mb-1">Status</span>
          {isLive
            ? (
              <span className="flex items-center gap-2 font-mono text-xl text-tertiary">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                LIVE
              </span>
            )
            : (
              <span className="font-mono text-xl text-on-surface">{seasonName}</span>
            )
          }
        </div>
      </section>
    )
  }
  ```

- [ ] **Update the `SeasonStatsBar` call** in the `HomeScreen` function body to pass the two new props:
  ```jsx
  <SeasonStatsBar
    players={players}
    pastClashes={pastClashes}
    tournamentState={tournamentState}
    seasonConfig={seasonConfig}
  />
  ```

- [ ] **Fix countdown condition.** Find:
  ```jsx
  var hasCountdown = clashTimestamp && new Date(clashTimestamp) > new Date()
  ```
  `clashTimestamp` comes from `tournamentState.clashTimestamp` — verify line ~255 already reads it correctly: `var clashTimestamp = tournamentState && tournamentState.clashTimestamp`. This is already correct. No change needed here.

- [ ] **Fix the CTA copy.** Find `"Register Your Team"` in `HeroCountdown` and replace:
  ```jsx
  Register Now
  ```
  Also find the non-countdown CTA `"Create Free Account"` — keep that one as-is (it's correct for the guest landing).

- [ ] Run dev server. Verify: HomeScreen shows "Weekly TFT Clash. Every Saturday.", stats show "—" for players/clashes when no data loads, no "LIVE" pulsing dot on load, countdown button says "Register Now".

- [ ] Commit:
  ```bash
  git add src/screens/HomeScreen.jsx
  git commit -m "fix: remove fake tagline, fix stats bar LIVE badge, fix CTA copy"
  ```

---

### Task 3: Fix Sidebar — broken routes + code style

This is a **full rewrite** of `src/components/layout/Sidebar.jsx`. The current file uses `const`/arrow functions throughout and has flat nav with broken routes. Replace the entire file:

**Files:**
- Full rewrite: `src/components/layout/Sidebar.jsx`

- [ ] Replace entire contents of `src/components/layout/Sidebar.jsx` with:

```jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase.js'
import Icon from '../ui/Icon'

var PLAY_LINKS = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Results', path: '/results', icon: 'emoji_events' },
  { label: 'Archive', path: '/archive', icon: 'inventory_2' },
]

var COMPETE_LINKS = [
  { label: 'Standings', path: '/standings', icon: 'leaderboard' },
  { label: 'Leaderboard', path: '/leaderboard', icon: 'military_tech' },
  { label: 'Hall of Fame', path: '/hof', icon: 'workspace_premium' },
]

var ME_LINKS = [
  { label: 'Profile', path: null, icon: 'person', useUsername: true },
  { label: 'Account', path: '/account', icon: 'settings' },
]

export default function Sidebar() {
  var navigate = useNavigate()
  var location = useLocation()
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var isAdmin = ctx.isAdmin
  var setAuthScreen = ctx.setAuthScreen

  function isActive(path) {
    if (!path) return false
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  function handleNav(path) {
    navigate(path)
  }

  function handleSignOut() {
    supabase.auth.signOut().then(function() {
      navigate('/')
    })
  }

  function handleSignIn() {
    setAuthScreen && setAuthScreen('login')
  }

  function renderLink(item) {
    var path = item.useUsername && currentUser
      ? '/player/' + currentUser.username
      : item.path
    var active = isActive(path)
    return (
      <button
        key={item.label}
        onClick={function() { handleNav(path) }}
        className={
          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ' +
          (active
            ? 'bg-primary/10 text-primary border-l-2 border-primary'
            : 'text-on-surface/40 hover:text-on-surface hover:bg-white/5 border-l-2 border-transparent')
        }
      >
        <Icon name={item.icon} size={18} />
        <span className="font-label text-xs uppercase tracking-widest">{item.label}</span>
      </button>
    )
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 z-40 bg-[#13131A] border-r border-outline-variant/10 hidden xl:flex flex-col pt-20">

      {/* Brand */}
      <div className="px-5 mb-8">
        <div className="font-display text-lg font-black text-primary tracking-tighter">TFT CLASH</div>
        <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/30 mt-0.5">Season 1</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">

        {/* PLAY */}
        <div className="mb-4">
          <div className="px-5 mb-1.5 font-label text-[9px] uppercase tracking-[0.15em] text-on-surface/25">Play</div>
          {PLAY_LINKS.map(renderLink)}
        </div>

        {/* COMPETE */}
        <div className="mb-4">
          <div className="px-5 mb-1.5 font-label text-[9px] uppercase tracking-[0.15em] text-on-surface/25">Compete</div>
          {COMPETE_LINKS.map(renderLink)}
        </div>

        {/* ME — logged-in only */}
        {currentUser && (
          <div className="mb-4">
            <div className="px-5 mb-1.5 font-label text-[9px] uppercase tracking-[0.15em] text-on-surface/25">Me</div>
            {ME_LINKS.map(renderLink)}
            {isAdmin && renderLink({ label: 'Admin', path: '/admin', icon: 'admin_panel_settings' })}
          </div>
        )}

      </nav>

      {/* Join Clash CTA */}
      <div className="px-5 mb-4">
        <button
          className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-label font-bold uppercase py-2.5 rounded-lg text-xs tracking-widest transition-transform hover:scale-105"
          onClick={function() { handleNav('/') }}
        >
          Join Clash
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 flex items-center gap-4 border-t border-outline-variant/10 pt-4">
        <button
          className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 hover:text-on-surface transition-colors"
          onClick={function() { handleNav('/faq') }}
        >
          Support
        </button>
        {currentUser
          ? (
            <button
              className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 hover:text-on-surface transition-colors"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          )
          : (
            <button
              className="font-label text-[10px] uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
              onClick={handleSignIn}
            >
              Sign In
            </button>
          )
        }
      </div>
    </aside>
  )
}
```

- [ ] Run dev server. Verify: sidebar shows grouped sections, clicking Support goes to `/faq`, Sign Out calls `supabase.auth.signOut()`, "Join Clash" goes to `/`, guests see only Play + Compete + Sign In, no console errors.

- [ ] Commit:
  ```bash
  git add src/components/layout/Sidebar.jsx
  git commit -m "refactor: rewrite Sidebar with grouped nav, fix broken routes, real sign out"
  ```

---

## Phase 2 — Seed Real Data

### Task 4: Populate SEED, HOMIES_IDS, PAST_CLASHES in constants.js

**Files:**
- Modify: `src/lib/constants.js:121-127`

- [ ] Replace the three empty seed constants (lines 121-127) with:

```js
export const HOMIES_IDS = [1,2,3,4,5,6,7,8,9];

export const SEED = [
  {id:1,name:"Levitate",   rank:"Challenger",  region:"EUW",pts:1024,wins:16,top4:38,games:56},
  {id:2,name:"Zounderkite",rank:"Grandmaster", region:"EUW",pts:896, wins:13,top4:33,games:52},
  {id:3,name:"Uri",        rank:"Master",      region:"EUW",pts:780, wins:11,top4:28,games:48},
  {id:4,name:"BingBing",   rank:"Master",      region:"EUW",pts:720, wins:10,top4:26,games:46},
  {id:5,name:"Wiwi",       rank:"Diamond",     region:"EUW",pts:610, wins:8, top4:22,games:44},
  {id:6,name:"Ole",        rank:"Diamond",     region:"EUW",pts:540, wins:7, top4:20,games:40},
  {id:7,name:"Sybor",      rank:"Platinum",    region:"EUW",pts:430, wins:5, top4:16,games:36},
  {id:8,name:"Ivdim",      rank:"Platinum",    region:"EUW",pts:380, wins:4, top4:14,games:32},
  {id:9,name:"Vlad",       rank:"Gold",        region:"EUW",pts:290, wins:3, top4:10,games:28},
  {id:10,name:"Dishsoap",  rank:"Grandmaster", region:"EUW",pts:260, wins:2, top4:9, games:24},
  {id:11,name:"k3soju",    rank:"Challenger",  region:"NA", pts:240, wins:2, top4:8, games:22},
  {id:12,name:"Setsuko",   rank:"Master",      region:"EUW",pts:210, wins:2, top4:7, games:20},
  {id:13,name:"Mortdog",   rank:"Diamond",     region:"NA", pts:190, wins:1, top4:6, games:18},
  {id:14,name:"Robinsongz",rank:"Master",      region:"NA", pts:170, wins:1, top4:6, games:16},
  {id:15,name:"Wrainbash", rank:"Diamond",     region:"EUW",pts:150, wins:1, top4:5, games:14},
  {id:16,name:"BunnyMuffins",rank:"Master",    region:"NA", pts:130, wins:1, top4:5, games:12},
  {id:17,name:"Frodan",    rank:"Diamond",     region:"NA", pts:110, wins:0, top4:4, games:10},
  {id:18,name:"NightShark",rank:"Platinum",    region:"EUW",pts:90,  wins:0, top4:3, games:8},
  {id:19,name:"CrystalFox",rank:"Platinum",    region:"EUW",pts:70,  wins:0, top4:2, games:6},
  {id:20,name:"VoidWalker",rank:"Gold",        region:"EUW",pts:50,  wins:0, top4:2, games:4},
  {id:21,name:"StarForge", rank:"Gold",        region:"NA", pts:40,  wins:0, top4:1, games:4},
  {id:22,name:"IronMask",  rank:"Silver",      region:"EUW",pts:30,  wins:0, top4:1, games:4},
  {id:23,name:"DawnBreaker",rank:"Silver",     region:"EUW",pts:20,  wins:0, top4:0, games:2},
  {id:24,name:"GhostRider",rank:"Bronze",      region:"EUW",pts:10,  wins:0, top4:0, games:2},
];

export const PAST_CLASHES = [
  // top8: [{name, pts}] — EMEA scoring applied (1st=8pts, 2nd=7pts, ... 8th=1pt)
  {id:"c7",name:"Clash #7",date:"2026-03-22",season:"S1",players:24,lobbies:3,champion:"Levitate",
    top3:["Levitate","Zounderkite","Uri"],
    top8:[{name:"Levitate",pts:8},{name:"Zounderkite",pts:7},{name:"Uri",pts:6},{name:"BingBing",pts:5},{name:"Wiwi",pts:4},{name:"Ole",pts:3},{name:"Sybor",pts:2},{name:"Ivdim",pts:1}]},
  {id:"c6",name:"Clash #6",date:"2026-03-15",season:"S1",players:24,lobbies:3,champion:"BingBing",
    top3:["BingBing","Levitate","Wiwi"],
    top8:[{name:"BingBing",pts:8},{name:"Levitate",pts:7},{name:"Wiwi",pts:6},{name:"Uri",pts:5},{name:"Zounderkite",pts:4},{name:"Ole",pts:3},{name:"Vlad",pts:2},{name:"Sybor",pts:1}]},
  {id:"c5",name:"Clash #5",date:"2026-03-08",season:"S1",players:24,lobbies:3,champion:"Zounderkite",
    top3:["Zounderkite","Ole","Levitate"],
    top8:[{name:"Zounderkite",pts:8},{name:"Ole",pts:7},{name:"Levitate",pts:6},{name:"BingBing",pts:5},{name:"Ivdim",pts:4},{name:"Wiwi",pts:3},{name:"Uri",pts:2},{name:"Vlad",pts:1}]},
  {id:"c4",name:"Clash #4",date:"2026-03-01",season:"S1",players:24,lobbies:3,champion:"Levitate",
    top3:["Levitate","Sybor","Uri"],
    top8:[{name:"Levitate",pts:8},{name:"Sybor",pts:7},{name:"Uri",pts:6},{name:"Zounderkite",pts:5},{name:"Wiwi",pts:4},{name:"BingBing",pts:3},{name:"Ole",pts:2},{name:"Ivdim",pts:1}]},
  {id:"c3",name:"Clash #3",date:"2026-02-22",season:"S1",players:24,lobbies:3,champion:"Uri",
    top3:["Uri","Levitate","BingBing"],
    top8:[{name:"Uri",pts:8},{name:"Levitate",pts:7},{name:"BingBing",pts:6},{name:"Wiwi",pts:5},{name:"Zounderkite",pts:4},{name:"Sybor",pts:3},{name:"Ole",pts:2},{name:"Vlad",pts:1}]},
  {id:"c2",name:"Clash #2",date:"2026-02-15",season:"S1",players:24,lobbies:3,champion:"Wiwi",
    top3:["Wiwi","Zounderkite","Ivdim"],
    top8:[{name:"Wiwi",pts:8},{name:"Zounderkite",pts:7},{name:"Ivdim",pts:6},{name:"Levitate",pts:5},{name:"Uri",pts:4},{name:"BingBing",pts:3},{name:"Ole",pts:2},{name:"Sybor",pts:1}]},
  {id:"c1",name:"Clash #1",date:"2026-02-08",season:"S1",players:24,lobbies:3,champion:"Levitate",
    top3:["Levitate","Ole","Vlad"],
    top8:[{name:"Levitate",pts:8},{name:"Ole",pts:7},{name:"Vlad",pts:6},{name:"Uri",pts:5},{name:"Zounderkite",pts:4},{name:"BingBing",pts:3},{name:"Wiwi",pts:2},{name:"Ivdim",pts:1}]},
];
```

- [ ] Commit:
  ```bash
  git add src/lib/constants.js
  git commit -m "feat: seed real homies roster and 7 past clashes into constants"
  ```

---

### Task 5: Wire seed-on-empty and pastClashes fallback in AppContext

**Files:**
- Modify: `src/context/AppContext.jsx`

- [ ] **Seed players on empty.** Find the players-loading `useEffect` in AppContext (search for `supabase.from('players').select`). After the players are fetched and set, add a guard — if 0 rows returned from Supabase, upsert the `SEED` data. Find the import at the top of AppContext and add `SEED` and `PAST_CLASHES` to the import from constants:
  ```js
  import { DEFAULT_SEASON_CONFIG, setSeasonChampion, SEED, PAST_CLASHES } from '../lib/constants.js';
  ```

- [ ] **In the players loader**, after the data is fetched, add seed logic. The noop Supabase stub still exposes `.from()` so we cannot use `if (!supabase.from)` as the guard. Instead, check whether env vars are set by checking if the Supabase client has a real `auth.getSession` that returns a session object (or simply try the upsert and always fall back in the `.then`):
  ```js
  if (!data || data.length === 0) {
    if (supabase.from) {
      supabase.from('players').upsert(SEED, {onConflict:'id'})
        .then(function() { setPlayers(SEED); })
        .catch(function() { setPlayers(SEED); }); // catches noop stub returning nothing
    } else {
      setPlayers(SEED);
    }
  }
  ```
  The `.catch` ensures `setPlayers(SEED)` fires even when the noop stub's promise resolves without data.

- [ ] **Fix `pastClashes` fallback.** Find line 660 in AppContext:
  ```js
  if(!res.data||!res.data.length)return;
  ```
  Change to:
  ```js
  if(!res.data||!res.data.length){setPastClashes(PAST_CLASHES);return;}
  ```

- [ ] Run dev server. Open HomeScreen — should now show 24 players, 7 clashes run, real leaderboard preview with Levitate at #1.

- [ ] Commit:
  ```bash
  git add src/context/AppContext.jsx
  git commit -m "feat: add seed-on-empty for players and pastClashes fallback from constants"
  ```

---

## Phase 3 — Navigation: Admin Panel "Run Clash" Button

### Task 6: Add Run Clash button to Admin dashboard tab

**Files:**
- Modify: `src/screens/AdminScreen.jsx`

- [ ] Open `src/screens/AdminScreen.jsx`. Find the first/default tab content (usually the overview/dashboard tab — search for the first tab panel rendered). Add a "Run Clash" button as the first action in that tab:

```jsx
import { useNavigate } from 'react-router-dom'
// (add to existing imports if not present)
```

In the dashboard tab body, add before the existing content:
```jsx
<div className="mb-6 p-4 bg-surface-container rounded-lg border border-outline-variant/10 flex items-center justify-between">
  <div>
    <div className="font-label text-sm font-bold text-on-surface uppercase tracking-widest">Clash Engine</div>
    <div className="text-xs text-on-surface-variant mt-0.5">Manage the live weekly tournament</div>
  </div>
  <Btn variant="primary" onClick={function() { navigate('/clash') }}>
    <Icon name="play_arrow" size={16} />
    Run Clash
  </Btn>
</div>
```

Ensure `var navigate = useNavigate()` is added to the component if not already present. Follow `var`/`function(){}` code style.

- [ ] Run dev server. Navigate to `/admin`. Verify "Run Clash" button appears and navigates to `/clash`.

- [ ] Commit:
  ```bash
  git add src/screens/AdminScreen.jsx
  git commit -m "feat: add Run Clash button to Admin dashboard tab"
  ```

---

## Phase 4 — Dashboard Clash Card

### Task 7: Build the hybrid ClashCard component

The `DashboardScreen` already has a `PulseHeader` component that handles tournament phase display. We will build a new `ClashCard` component that matches the approved design (stats always on top, contextual action below) and add it above the existing dashboard content.

**Files:**
- Modify: `src/screens/DashboardScreen.jsx` (add `ClashCard` component near top of file, render it in `DashboardScreen`)

- [ ] Add the `ClashCard` component to `DashboardScreen.jsx`, after the existing helper components and before the main `DashboardScreen` export. The component reads from `useApp()` context:

```jsx
// ---- CLASH CARD (hybrid: stats top + contextual action bottom) ----

function ClashCountdown(props) {
  var target = props.target
  var _t = useState(function() {
    var diff = Math.max(0, new Date(target) - new Date())
    return {
      D: Math.floor(diff / 86400000),
      H: Math.floor((diff % 86400000) / 3600000),
      M: Math.floor((diff % 3600000) / 60000),
      S: Math.floor((diff % 60000) / 1000)
    }
  })
  var t = _t[0]
  var setT = _t[1]

  useEffect(function() {
    var iv = setInterval(function() {
      var diff = Math.max(0, new Date(target) - new Date())
      setT({
        D: Math.floor(diff / 86400000),
        H: Math.floor((diff % 86400000) / 3600000),
        M: Math.floor((diff % 3600000) / 60000),
        S: Math.floor((diff % 60000) / 1000)
      })
    }, 1000)
    return function() { clearInterval(iv) }
  }, [target])

  function p(n) { return String(n).padStart(2, '0') }

  if (t.D > 0) {
    return <span className="font-display text-5xl text-primary tracking-tight">{t.D}d {p(t.H)}:{p(t.M)}:{p(t.S)}</span>
  }
  return <span className="font-display text-5xl text-primary tracking-tight">{p(t.H)}:{p(t.M)}:{p(t.S)}</span>
}

function ClashCard() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var players = ctx.players || []
  var tournamentState = ctx.tournamentState || {}
  var seasonConfig = ctx.seasonConfig || {}
  var navigate = useNavigate()

  var phase = tournamentState.phase || 'idle'
  var clashTimestamp = tournamentState.clashTimestamp
  var hasCountdown = clashTimestamp && new Date(clashTimestamp) > new Date()

  // Find current user's player row for stats
  var linkedPlayer = currentUser && players.find(function(p) {
    return p.name === (currentUser.username || currentUser.name)
  })

  // Season standing (rank by pts)
  var sortedPlayers = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0) })
  var myRank = linkedPlayer
    ? sortedPlayers.findIndex(function(p) { return p.id === linkedPlayer.id }) + 1
    : null

  var seasonName = seasonConfig.seasonName || 'Season 1'
  var clashName = tournamentState.clashName || 'Clash'
  var registeredCount = (tournamentState.registeredIds || []).length
  var maxPlayers = tournamentState.maxPlayers || 24
  var tRound = tournamentState.round || 1
  var totalGames = tournamentState.totalGames || 3

  var isRegistered = currentUser && (tournamentState.registeredIds || []).indexOf(currentUser.id) > -1
  var isCheckedIn  = currentUser && (tournamentState.checkedInIds  || []).indexOf(currentUser.id) > -1

  // Find current user's lobby
  var myLobby = null
  var lobbies = tournamentState.lobbies || []
  if (currentUser) {
    for (var i = 0; i < lobbies.length; i++) {
      var lob = lobbies[i]
      var lobPlayers = lob.players || lob.playerIds || []
      var inLobby = lobPlayers.some(function(pid) {
        if (typeof pid === 'object') return pid.id === currentUser.id || pid.name === currentUser.username
        return pid === currentUser.id
      })
      if (inLobby) { myLobby = lob; break; }
    }
  }
  var lobbyNames = myLobby
    ? (myLobby.players || []).map(function(p) { return typeof p === 'object' ? (p.name || p.username) : p }).join(' · ')
    : ''
  var lobbyNum = myLobby ? (myLobby.num || myLobby.number || myLobby.id || '?') : '?'

  // Phase tag config
  var phaseTag = {
    idle:         { label: 'Next clash TBA',       cls: 'bg-surface-container text-on-surface-variant',                           icon: 'schedule' },
    registration: { label: 'Registration Open',    cls: 'bg-primary/10 text-primary border border-primary/20',                   icon: 'how_to_reg' },
    checkin:      { label: 'Check-In Open',        cls: 'bg-primary/10 text-primary border border-primary/20',                   icon: 'fact_check' },
    live:         { label: 'Live \u00b7 Round ' + tRound + ' of ' + totalGames,
                                                    cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20',                icon: null, dot: true },
    inprogress:   { label: 'Live \u00b7 Round ' + tRound + ' of ' + totalGames,
                                                    cls: 'bg-tertiary/10 text-tertiary border border-tertiary/20',                icon: null, dot: true },
    complete:     { label: clashName + ' Complete', cls: 'bg-secondary/10 text-secondary border border-secondary/20',            icon: 'military_tech' },
  }[phase] || { label: 'Next clash TBA', cls: 'bg-surface-container text-on-surface-variant', icon: 'schedule' }

  return (
    <div className="rounded-xl overflow-hidden border border-outline-variant/10 mb-6"
      style={{ background: 'rgba(52,52,60,0.5)', backdropFilter: 'blur(24px)' }}
    >
      {/* TOP: always-on stats */}
      <div className="p-5 pb-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-headline text-base font-bold text-on-surface">
            {clashName || seasonName}
          </span>
          {linkedPlayer && (
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">
              {linkedPlayer.rank || ''} &middot; {linkedPlayer.region || 'EUW'}
            </span>
          )}
        </div>
        <div className="font-label text-xs text-on-surface-variant mb-3">
          {currentUser ? (currentUser.username || 'Summoner') : 'Not signed in'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-primary leading-none">
              {linkedPlayer ? (linkedPlayer.pts || 0).toLocaleString() : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Season PTS</div>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-on-surface leading-none">
              {linkedPlayer ? (linkedPlayer.wins || 0) : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Wins</div>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-tertiary leading-none">
              {myRank ? ('#' + myRank) : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Standing</div>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-2.5">
            <div className="font-mono text-base font-bold text-on-surface leading-none">
              {linkedPlayer ? (linkedPlayer.games || 0) : '\u2014'}
            </div>
            <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mt-1">Clashes</div>
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="h-px mx-5 bg-white/[0.05]"></div>

      {/* BOTTOM: contextual action */}
      <div className="p-5 pt-4">
        {/* Phase tag */}
        <div className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-label font-bold uppercase tracking-wider mb-3 ' + phaseTag.cls}>
          {phaseTag.dot && <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>}
          {phaseTag.icon && <Icon name={phaseTag.icon} size={12} />}
          {phaseTag.label}
        </div>

        {/* IDLE */}
        {(phase === 'idle') && (
          <div>
            <p className="text-sm text-on-surface-variant mb-3">No clash scheduled yet. Check back Saturday.</p>
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>Standings</Btn>
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/results') }}>Past Results</Btn>
            </div>
          </div>
        )}

        {/* REGISTRATION */}
        {(phase === 'registration') && (
          <div>
            {hasCountdown && (
              <div className="mb-1">
                <ClashCountdown target={clashTimestamp} />
              </div>
            )}
            <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
              Until check-in closes &middot; {registeredCount}/{maxPlayers} registered
            </div>
            <div className="flex gap-2">
              <Btn
                variant={isRegistered ? 'ghost' : 'primary'}
                size="sm"
                className="flex-[2]"
                onClick={function() { navigate('/clash') }}
              >
                {isRegistered ? 'Already Registered' : 'Register Now'}
              </Btn>
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/clash') }}>Who&apos;s In</Btn>
            </div>
          </div>
        )}

        {/* CHECK-IN */}
        {(phase === 'checkin') && (
          <div>
            {hasCountdown && (
              <div className="mb-1">
                <ClashCountdown target={clashTimestamp} />
              </div>
            )}
            <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
              Until clash starts
            </div>
            <Btn
              variant={isCheckedIn ? 'ghost' : 'primary'}
              size="sm"
              className="w-full"
              onClick={function() { navigate('/clash') }}
            >
              {isCheckedIn ? 'Checked In' : 'Check In Now'}
            </Btn>
          </div>
        )}

        {/* LIVE */}
        {(phase === 'live' || phase === 'inprogress') && (
          <div>
            {myLobby
              ? (
                <div className="bg-tertiary/[0.06] border border-tertiary/15 rounded-lg p-3 mb-3">
                  <div className="font-label text-xs font-bold text-tertiary mb-1">You are in Lobby {lobbyNum}</div>
                  <div className="text-[11px] text-on-surface/50 leading-relaxed">{lobbyNames}</div>
                </div>
              )
              : (
                <p className="text-sm text-on-surface-variant mb-3">You are not in a lobby this round.</p>
              )
            }
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" className="flex-[2]" style={{background:'rgba(103,226,217,0.1)',color:'#67E2D9',borderColor:'rgba(103,226,217,0.2)'}} onClick={function() { navigate('/clash') }}>Submit Results</Btn>
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/clash') }}>Live Board</Btn>
            </div>
          </div>
        )}

        {/* COMPLETE */}
        {(phase === 'complete') && (
          <div>
            <CompleteTopThree tournamentState={tournamentState} players={players} />
            <div className="flex gap-2 mt-3">
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/results') }}>Full Results</Btn>
              <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>Standings</Btn>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function CompleteTopThree(props) {
  var tournamentState = props.tournamentState
  var players = props.players
  var results = tournamentState.results || []
  var top3 = results.slice(0, 3)
  if (!top3.length) return null

  return (
    <div>
      {top3.map(function(r, i) {
        var pName = typeof r === 'string' ? r : (r.name || ('Player ' + (i + 1)))
        var pts = typeof r === 'object' ? r.pts : null
        return (
          <div key={i} className={'flex items-center gap-2 py-1.5 ' + (i < 2 ? 'border-b border-white/[0.04]' : '')}>
            <div className={
              'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold font-mono flex-shrink-0 ' +
              (i === 0 ? 'bg-primary text-[#13131A]' : 'bg-white/[0.08] text-on-surface-variant')
            }>
              {i + 1}
            </div>
            <span className={'text-sm font-semibold ' + (i === 0 ? 'text-on-surface' : 'text-on-surface/70')}>{pName}</span>
            {pts !== null && (
              <span className={'ml-auto font-mono text-xs font-bold ' + (i === 0 ? 'text-primary' : 'text-on-surface-variant')}>
                +{pts} pts
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Render `ClashCard` in the main `DashboardScreen` export.** Find the return statement of `DashboardScreen`. Add `<ClashCard />` as the very first element inside `<PageLayout>`, before the existing `<AnnouncementStrip>` and `<PulseHeader>`:
  ```jsx
  return (
    <PageLayout>
      <ClashCard />
      <AnnouncementStrip ... />
      {/* rest of existing content */}
    </PageLayout>
  )
  ```

- [ ] Run dev server. Open Dashboard (must be logged in as mock user for now). Verify:
  - Card renders with 4 stat boxes
  - Phase is "idle" (from Task 1 fix)
  - Bottom shows "No clash scheduled yet" message
  - Clicking Standings navigates to `/standings`

- [ ] Commit:
  ```bash
  git add src/screens/DashboardScreen.jsx
  git commit -m "feat: add hybrid ClashCard to Dashboard with 5-state contextual bottom zone"
  ```

---

## Phase 5 — Real Supabase Auth

### Task 8: Remove mock currentUser and wire real Supabase auth

**Files:**
- Modify: `src/context/AppContext.jsx`

**Context:** The auth wiring (`getSession` + `onAuthStateChange`) already exists in AppContext at lines 307-318. It is currently short-circuited by the DEV_MOCK guard at lines 303-305. Removing the mock user + guard is sufficient to activate it. No new auth code needs to be written.

- [ ] **Remove mock user.** Find line 140:
  ```js
  var _currentUser = useState({id:1,username:"Levitate",email:"levitate@tftclash.gg",riot_id:"Levitate#EUW",is_admin:true}); // DEV: mock user
  ```
  Replace with:
  ```js
  var _currentUser = useState(null);
  ```

- [ ] **Delete DEV_MOCK guard.** Find and remove lines 303-305:
  ```js
  // DEV: skip auth hydration when mock user is set
  var DEV_MOCK=currentUser&&currentUser.email==="levitate@tftclash.gg";
  if(DEV_MOCK){setIsAuthLoading(false);return function(){};}
  ```

- [ ] **Verify the existing auth flow still follows (lines 307-318 after deletion).** These lines must remain intact:
  ```js
  supabase.auth.getSession().then(function(result){
    var session=result&&result.data&&result.data.session;
    setCurrentUser(mapUser(session&&session.user?session.user:null));
    setIsAuthLoading(false);
  }).catch(function(){setIsAuthLoading(false);});

  var authResult=supabase.auth.onAuthStateChange(function(_e,session){
    setCurrentUser(mapUser(session&&session.user?session.user:null));
  });
  ```
  With no env vars, the noop stub's `getSession` returns `{data:{session:null}}`, so `mapUser(null)` returns `null`, `setCurrentUser(null)` fires, and `setIsAuthLoading(false)` fires. App correctly shows guest state.

- [ ] Run dev server. Verify: app starts in guest state, HomeScreen shows, Sidebar shows "Sign In" in footer, Dashboard shows `—` for all stats, no infinite loading spinner.

- [ ] **Test login flow.** Open the login modal. If Supabase env vars are set, test with a real account. If no env vars, verify modal opens and closes without crash. Verify `isAuthLoading` resolves to `false`.

- [ ] Commit:
  ```bash
  git add src/context/AppContext.jsx
  git commit -m "feat: remove mock auth, activate real Supabase session flow for currentUser"
  ```

---

## Phase 6 — ClashScreen Hardening

### Task 9: Verify realtime tournament_state subscription

**Files:**
- Read + verify: `src/context/AppContext.jsx` (realtime subscription block)
- Read + verify: `src/screens/ClashScreen.jsx`

- [ ] Search AppContext for `tournament_state` realtime subscription. Verify it is not gated behind the mock user (it should subscribe unconditionally on mount, not inside a `currentUser` check). If it is gated, move the subscription outside the `currentUser` check.

- [ ] Search ClashScreen for any hardcoded player IDs or fallback to `SEED` data being used in place of real `players` from context. Verify lobby player names are resolved by looking up `players` array from `useApp()`.

- [ ] Open the app with the dev server. Navigate to `/admin` → click "Run Clash". Verify ClashScreen loads without crash in `idle` phase (the new default).

- [ ] Commit any fixes:
  ```bash
  git add src/context/AppContext.jsx src/screens/ClashScreen.jsx
  git commit -m "fix: verify realtime subscription and player name resolution in ClashScreen"
  ```

---

## Final Verification Checklist

After all phases, manually verify:

- [ ] HomeScreen: tagline is "Weekly TFT Clash. Every Saturday." — no cinematic copy
- [ ] HomeScreen stats: player count shows real number, clashes run shows 7, LIVE badge only when actually live
- [ ] Sidebar: Play / Compete / Me sections render correctly
- [ ] Sidebar: Support → `/faq`, Sign Out → calls auth, Join Clash → `/`
- [ ] Sidebar: guest state shows Sign In button, Me section hidden
- [ ] Dashboard: ClashCard renders with stats top + contextual bottom
- [ ] Dashboard: ClashCard shows idle state correctly
- [ ] Admin panel: "Run Clash" button visible, navigates to `/clash`
- [ ] Constants: `SEED` has 24 players, `PAST_CLASHES` has 7 entries
- [ ] Leaderboard preview on HomeScreen shows real players (Levitate #1, Zounderkite #2, etc.)
- [ ] No console errors on any main route
- [ ] No arrow functions in modified `.jsx` files (except `supabase.js` which is exempt)
