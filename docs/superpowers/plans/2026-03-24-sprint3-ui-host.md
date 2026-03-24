# Sprint 3 — UI/UX Fixes + Host Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix nav (add Events pill), add idle states to ClashCard and ClashScreen, build the Host Dashboard Command Center with click-to-assign round control, and remove Quick Clash from AdminScreen.

**Architecture:** Six targeted edits across five existing files. No new files created. No new Supabase tables. All components follow CLAUDE.md style: `var` declarations, `function(){}` callbacks, Tailwind classes only, Material Symbols via `<Icon>`, module-scope components only.

**Tech Stack:** React 18, Tailwind CSS 3, React Router 6, AppContext for shared state

**Spec:** `docs/superpowers/specs/2026-03-24-sprint3-ui-host-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/components/layout/Navbar.jsx` | Insert Events into DESKTOP_PRIMARY array |
| `src/screens/DashboardScreen.jsx` | Add `ClashCardIdle` component at module scope; call it when `phase === 'idle'` |
| `src/screens/ClashScreen.jsx` | Add `ClashIdleView` at module scope; replace existing idle block; add `useNavigate` |
| `src/screens/AdminScreen.jsx` | Remove Quick Clash from ADMIN_GROUPS, ADMIN_ICON_MAP, TAB_INFO, and JSX |
| `src/screens/HostDashboardScreen.jsx` | Add `PlayerPool`, `PlacementSlots`, `LobbyCard`, `RoundControl` at module scope; replace screen body JSX with 3-column Command Center layout |

---

## Task 1: Navbar — Add Events Pill

**Files:**
- Modify: `src/components/layout/Navbar.jsx` (line ~218)

- [ ] **Step 1: Find the insertion point**

  Open `src/components/layout/Navbar.jsx`. Find the `DESKTOP_PRIMARY` array (line ~218). It looks like:
  ```js
  var DESKTOP_PRIMARY = [
    clashItem ? ... : { id: "clash", label: "Clash" },
    { id: "standings", label: "Standings" },
    { id: "hof", label: "Hall of Fame" },
    { id: "pricing", label: "Pricing" }
  ]
  ```

- [ ] **Step 2: Insert Events entry after Standings**

  After the line `{ id: "standings", label: "Standings" },` insert:
  ```js
  { id: "events", label: "Events" },
  ```
  Result:
  ```js
  var DESKTOP_PRIMARY = [
    clashItem ? ... : { id: "clash", label: "Clash" },
    { id: "standings", label: "Standings" },
    { id: "events", label: "Events" },
    { id: "hof", label: "Hall of Fame" },
    { id: "pricing", label: "Pricing" }
  ]
  ```
  The `navTo("events")` call already resolves to `/events` via `SCREEN_TO_ROUTE.events` at line 10 of this file. No path property needed.

- [ ] **Step 3: Verify in browser**

  Run `npm run dev`. Open any page. Count 5 pills in the top nav: Clash · Standings · Events · Hall of Fame · Pricing. Click Events — should navigate to `/events`. Active pill highlights.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/layout/Navbar.jsx
  git commit -m "feat: add Events to primary nav pills"
  ```

---

## Task 2: ClashCard — Idle Empty State

**Files:**
- Modify: `src/screens/DashboardScreen.jsx` (around line 518 — `ClashCard` function)

### Context
`ClashCard` is a module-scope function at line ~518 in `DashboardScreen.jsx`. It already calls `useApp()`, has `useNavigate()`, and computes `phase = tournamentState.phase || 'idle'`. In idle state the existing bottom section shows a minimal two-button row. The 4-stat grid on top already shows real values or `'—'` — that grid stays as-is and becomes the "mini stats row" in idle.

The change: replace the `{(phase === 'idle') && (...)}` block with the hero empty state content (icon + message + next-clash chip + two CTAs).

- [ ] **Step 1: Find the idle section inside ClashCard's return**

  In `ClashCard`, find the JSX block:
  ```jsx
  {(phase === 'idle') && (
    <div>
      <p className="text-sm text-on-surface-variant mb-3">No clash scheduled yet. Check back Saturday.</p>
      <div className="flex gap-2">
        <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>Standings</Btn>
        <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/results') }}>Past Results</Btn>
      </div>
    </div>
  )}
  ```

- [ ] **Step 2: Replace it with the hero empty state**

  Replace that entire block with:
  ```jsx
  {(phase === 'idle') && (
    <div className="flex flex-col items-center text-center gap-3 py-2">
      <div className="w-12 h-12 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
        <Icon name="swords" size={24} className="text-primary" />
      </div>
      <div>
        <div className="font-display text-sm font-bold text-on-surface mb-1">No clash this week — yet</div>
        <div className="text-xs text-on-surface/40 leading-relaxed max-w-[220px] mx-auto">Next clash is scheduled for Saturday night. Registration opens 24h before.</div>
      </div>
      <div className="cond text-[9px] font-bold uppercase tracking-widest text-on-surface/30 px-3 py-1.5 rounded-full border border-on-surface/10 bg-on-surface/[0.02]">
        Next: Saturday · 20:00 CET
      </div>
      <div className="flex gap-2 w-full">
        <Btn variant="primary" size="sm" className="flex-1" onClick={function() { navigate('/standings') }}>View Standings</Btn>
        <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/events') }}>Browse Events</Btn>
      </div>
    </div>
  )}
  ```

- [ ] **Step 3: Verify in browser**

  Log in as any user with `tournamentState.phase === 'idle'` (the default state). The dashboard ClashCard should show: the 4-stat grid on top with real values (or `'—'` for new players), then a separator, then the swords icon + "No clash this week — yet" message + "Next: Saturday · 20:00 CET" chip + View Standings / Browse Events buttons.

- [ ] **Step 4: Commit**

  ```bash
  git add src/screens/DashboardScreen.jsx
  git commit -m "feat: ClashCard idle state — hero empty state with season stats"
  ```

---

## Task 3: ClashScreen — Waiting Room Idle State

**Files:**
- Modify: `src/screens/ClashScreen.jsx`

### Context
- `ClashScreen` is at line ~2252 in this file.
- `PAST_CLASHES` is already imported at line 3 — do NOT add a duplicate import.
- `CountdownTimer` is NOT currently imported — needs to be added.
- The existing idle block uses `if (!phase)` which never triggers because AppContext initializes `phase` as `"idle"` (truthy string). The fix changes this condition and replaces the content.
- `ClashScreen` receives `tournamentState`, `players`, `currentUser` as props from App.jsx (line 613). It does not currently use `useNavigate`. Add it.

- [ ] **Step 1: Add `useNavigate` import and `CountdownTimer` import**

  At the top of `src/screens/ClashScreen.jsx`, find existing imports. Add:
  - `import { useNavigate } from 'react-router-dom'` (if not already present — check line 1-15)
  - `import CountdownTimer from '../components/shared/CountdownTimer'` (if not already present)

  Do NOT add `PAST_CLASHES` — it is already imported at line 3.

- [ ] **Step 2: Define `ClashIdleView` at module scope — before `function ClashScreen`**

  Add this new component definition at module scope, before the `function ClashScreen(props)` line (~2252). Follow CLAUDE.md rules throughout (var, function(){}, no arrow functions, Tailwind only):

  ```jsx
  function ClashIdleView(props) {
    var players = props.players || []
    var currentUser = props.currentUser
    var linkedPlayer = props.linkedPlayer
    var navigate = props.navigate

    var lastClash = PAST_CLASHES[0]

    var now = new Date()
    var daysUntilSat = (6 - now.getDay() + 7) % 7 || 7
    var nextSaturday = new Date(now)
    nextSaturday.setDate(now.getDate() + daysUntilSat)
    nextSaturday.setHours(20, 0, 0, 0)

    var top3 = lastClash && lastClash.top8 ? lastClash.top8.slice(0, 3) : []
    var top3Colors = ['text-primary', 'text-on-surface/60', 'text-tertiary']
    var top3Labels = ['1st', '2nd', '3rd']

    return (
      <div className="max-w-2xl mx-auto py-10 px-4 flex flex-col gap-6">

        {/* Panel 1 — Countdown Hero */}
        <Panel>
          <div className="text-center py-4">
            <div className="cond text-[9px] font-bold uppercase tracking-[0.15em] text-primary mb-4">Next Clash</div>
            <CountdownTimer targetDate={nextSaturday} />
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-on-surface/20 text-on-surface/40 text-[10px] cond font-bold uppercase tracking-widest mt-4 mb-2">
              No Active Clash
            </div>
            <div className="text-xs text-on-surface/40 mt-1">Registration opens Saturday at 18:00 CET</div>
          </div>
        </Panel>

        {/* Panel 2 — Last Clash Recap */}
        {lastClash && (
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-sm font-bold text-on-surface">{lastClash.name} — Results</div>
              <button className="text-[11px] text-primary underline bg-transparent border-0 cursor-pointer p-0" onClick={function() { navigate('/results') }}>View All Results</button>
            </div>
            <div className="flex gap-3">
              {top3.map(function(entry, i) {
                return (
                  <div key={i} className="flex-1 text-center bg-white/[0.03] rounded-lg p-3 border border-on-surface/10">
                    <div className={'cond text-[8px] font-bold uppercase tracking-widest mb-1 ' + top3Colors[i]}>{top3Labels[i]}</div>
                    <div className={'font-bold text-sm ' + top3Colors[i]}>{entry.name}</div>
                    <div className="text-[10px] text-on-surface/40 mt-0.5">{entry.pts} pts</div>
                  </div>
                )
              })}
            </div>
          </Panel>
        )}

        {/* Panel 3 — Season Standing */}
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-sm font-bold text-on-surface">Your Season</div>
            <button className="text-[11px] text-primary underline bg-transparent border-0 cursor-pointer p-0" onClick={function() { navigate('/standings') }}>Full Standings</button>
          </div>
          {currentUser && linkedPlayer ? (
            <div className="flex items-center gap-3 bg-primary/[0.04] rounded-lg p-3 border border-primary/10">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex-shrink-0"></div>
              <div className="flex-1">
                <div className="font-bold text-sm text-on-surface">{linkedPlayer.name}</div>
                <div className="text-[10px] text-on-surface/40">{linkedPlayer.rank || 'Unranked'}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-bold text-primary">{linkedPlayer.pts || 0}</div>
                <div className="text-[9px] text-on-surface/30 uppercase tracking-wider">pts</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-on-surface">{linkedPlayer.wins || 0}</div>
                <div className="text-[9px] text-on-surface/30 uppercase tracking-wider">wins</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-on-surface">{linkedPlayer.games || 0}</div>
                <div className="text-[9px] text-on-surface/30 uppercase tracking-wider">clashes</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-on-surface/40 mb-3">Sign up to track your stats</div>
              <Btn variant="primary" size="sm" onClick={function() { navigate('/signup') }}>Sign Up Free</Btn>
            </div>
          )}
        </Panel>
      </div>
    )
  }
  ```

  Note: `Panel` and `Btn` are already used in this file. Verify by searching for `Panel` usage in `ClashScreen.jsx` — if they are defined locally in this file (as legacy components), use whatever name is used there. If they are imported from `components/ui`, the imports are already at the top.

- [ ] **Step 3: Add `useNavigate` call inside `ClashScreen` and compute `linkedPlayer`**

  Inside `function ClashScreen(props)`, near the top (after the existing `var phase = ...` line), add:
  ```js
  var navigate = useNavigate()
  var linkedPlayer = (props.players || []).find(function(p) {
    return props.currentUser && p.name === (props.currentUser.username || props.currentUser.name)
  }) || null
  ```

- [ ] **Step 4: Replace the existing idle early-return**

  Find the existing block (starting at line ~2263):
  ```js
  if (!phase) {
    var idlePlayers = props.players || [];
    var idleTop5 = ...
    return (
      <div className="fade-up py-10 ...">
        ...
      </div>
    );
  }
  ```

  Replace the entire `if (!phase) { ... }` block (including the `return (...)` inside it) with:
  ```js
  if (!phase || phase === 'idle') {
    return <ClashIdleView players={props.players} currentUser={props.currentUser} linkedPlayer={linkedPlayer} navigate={navigate} />
  }
  ```

- [ ] **Step 5: Verify in browser**

  Navigate to `/clash` with default state (`tournamentState.phase === 'idle'`). Should see three panels stacked: countdown timer (ticking), last clash recap (Clash #7 top 3 with names and pts), and season standing (Levitate's row with real stats, or sign-up prompt if logged out).

- [ ] **Step 6: Commit**

  ```bash
  git add src/screens/ClashScreen.jsx
  git commit -m "feat: ClashScreen idle state — Waiting Room with countdown and last clash recap"
  ```

---

## Task 4: AdminScreen — Remove Quick Clash

**Files:**
- Modify: `src/screens/AdminScreen.jsx`

- [ ] **Step 1: Remove from `ADMIN_ICON_MAP`**

  Find line ~132:
  ```js
  var ADMIN_ICON_MAP = {
    dashboard: 'speed', round: 'bolt', quickclash: 'casino', flash: 'emoji_events',
  ```
  Remove `quickclash: 'casino',`:
  ```js
  var ADMIN_ICON_MAP = {
    dashboard: 'speed', round: 'bolt', flash: 'emoji_events',
  ```

- [ ] **Step 2: Remove from `ADMIN_GROUPS`**

  Find in `ADMIN_GROUPS` (line ~404):
  ```js
  { label: 'TOURNAMENT', items: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'round', label: 'Round Control' },
    { id: 'quickclash', label: 'Quick Clash' },
    { id: 'flash', label: 'Flash Tournaments' },
  ]},
  ```
  Remove the `{ id: 'quickclash', label: 'Quick Clash' },` line.

- [ ] **Step 3: Remove from `TAB_INFO`**

  Find line ~434:
  ```js
  quickclash: 'Spin up an instant open clash (4-16 players, no registration). Appears live on the home screen.',
  ```
  Delete that line.

- [ ] **Step 4: Remove the JSX content block**

  Find the block at line ~1018:
  ```jsx
  {tab === 'quickclash' && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      ...
    </div>
  )}
  ```
  Delete the entire block from `{tab === 'quickclash' && (` through the matching closing `)}`.

- [ ] **Step 5: Remove dead `quickClashes` and `setQuickClashes` destructures**

  Find lines ~148-149:
  ```js
  var quickClashes = ctx.quickClashes
  var setQuickClashes = ctx.setQuickClashes
  ```
  Delete both lines.

  Also find line ~565 inside the dashboard stats grid — a reference to `quickClashes` inside a string:
  ```js
  { label: 'Events', value: ..., sub: (quickClashes || []).length + ' quick clash' + ... },
  ```
  Replace the `sub` value with a static string: `sub: '0 quick clashes'` — or remove the `sub` property entirely if it's optional.

- [ ] **Step 6: Check initial tab default**

  Find where `tab` state is initialized (line ~172 — comment says line 170):
  ```js
  var [tab, setTab] = useState("dashboard");
  ```
  Confirmed: the default is `"dashboard"`. Leave it as-is.

- [ ] **Step 7: Verify in browser**

  Log in as admin, navigate to `/admin`. Confirm no "Quick Clash" tab in the sidebar. Confirm the screen renders without errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/screens/AdminScreen.jsx
  git commit -m "fix: remove Quick Clash tab from AdminScreen"
  ```

---

## Task 5: Host Dashboard — Command Center Layout + Round Control

**Files:**
- Modify: `src/screens/HostDashboardScreen.jsx`

### Context
This is the largest task. The screen currently has a wizard-based tournament creation UI with multiple tabs. This task:
1. Adds 4 new module-scope components: `PlayerPool`, `PlacementSlots`, `LobbyCard`, `RoundControl`
2. Adds a new "Command Center" tab (`commandcenter`) to the existing tab navigation
3. Renders the 3-column layout when that tab is active

**Important: Do NOT remove existing tabs or state.** Preserve all existing state declarations, Supabase calls, wizard state, branding state, etc. Only ADD new components and a new tab.

- [ ] **Step 1: Add new state to `HostDashboardScreen`**

  Inside `function HostDashboardScreen()`, after the existing state declarations, add:
  ```js
  // Command Center state
  var _selEvt = useState(tournaments.length > 0 ? tournaments[0].id : null)
  var selectedEventId = _selEvt[0]
  var setSelectedEventId = _selEvt[1]

  var _ar = useState(1)
  var activeRound = _ar[0]
  var setActiveRound = _ar[1]

  var _pending = useState({})
  var pendingPlacements = _pending[0]
  var setPendingPlacements = _pending[1]

  var _selP = useState(null)
  var selectedPlayer = _selP[0]
  var setSelectedPlayer = _selP[1]

  var _stack = useState([])
  var placementStack = _stack[0]
  var setPlacementStack = _stack[1]

  var setTournamentState = ctx.setTournamentState
  var tournamentState = ctx.tournamentState || {}

  var activeEvent = tournaments.find(function(e) { return e.id === selectedEventId }) || null
  var activeRoundLobbyPlayers = (players || []).slice(0, 8)
  var totalRounds = 3
  ```

- [ ] **Step 2: Add Command Center tab to the secondary nav**

  The tab state in this file is `var [tab, setTab] = useState("overview")` (line 73). The secondary nav is at line ~1150 — it renders tab buttons from a hardcoded array:
  ```js
  {[["announce", "Announce"], ["branding", "Branding"], ["game-flow", "Game Flow"], ["registrations", "Players"]].map(...)}
  ```
  Add `["commandcenter", "Round Control"]` at the start of that array:
  ```js
  {[["commandcenter", "Round Control"], ["announce", "Announce"], ["branding", "Branding"], ["game-flow", "Game Flow"], ["registrations", "Players"]].map(...)}
  ```
  This adds a "Round Control" pill in the secondary nav that switches to the new tab. No icon map exists in this file — no icon mapping needed.

- [ ] **Step 3: Define `PlayerPool` at module scope (before `HostDashboardScreen`)**

  Add before the `export default function HostDashboardScreen()` line:

  ```jsx
  function PlayerPool(props) {
    var players = props.players || []
    var selectedId = props.selectedId
    var usedIds = props.usedIds || []
    var onSelect = props.onSelect

    return (
      <div className="flex flex-col gap-1">
        <div className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/30 mb-2">Players</div>
        {players.map(function(p) {
          var isUsed = usedIds.indexOf(p.id) > -1
          var isSelected = selectedId === p.id
          return (
            <div
              key={p.id}
              onClick={function() { if (!isUsed) onSelect(p) }}
              className={'flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ' +
                (isSelected ? 'bg-primary/10 border-primary/30 text-primary' :
                 isUsed ? 'bg-white/[0.02] border-on-surface/5 text-on-surface/25 cursor-not-allowed' :
                 'bg-white/[0.03] border-on-surface/10 text-on-surface/70 hover:border-on-surface/20')}
            >
              <div className="w-5 h-5 rounded-full bg-secondary/20 border border-secondary/30 flex-shrink-0"></div>
              <span className="flex-1 text-xs font-medium">{p.name}</span>
              {isUsed && <Icon name="check_circle" size={12} className="text-secondary/40 flex-shrink-0" />}
            </div>
          )
        })}
      </div>
    )
  }
  ```

- [ ] **Step 4: Define `PlacementSlots` at module scope**

  ```jsx
  function PlacementSlots(props) {
    var players = props.players || []
    var slots = props.slots || {}
    var selectedPlayerId = props.selectedPlayerId
    var onPlace = props.onPlace

    var rankColors = ['text-primary', 'text-on-surface/50', 'text-tertiary', 'text-on-surface/40', 'text-on-surface/30', 'text-on-surface/30', 'text-on-surface/25', 'text-on-surface/25']

    return (
      <div className="flex flex-col gap-1">
        <div className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/30 mb-2">Click a slot to place</div>
        {[1,2,3,4,5,6,7,8].map(function(rank) {
          var playerId = slots[rank]
          var player = playerId ? players.find(function(p) { return p.id === playerId }) : null
          var isTarget = selectedPlayerId && !playerId
          return (
            <div
              key={rank}
              onClick={function() { onPlace(rank) }}
              className={'flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ' +
                (player ? 'bg-surface-container border-on-surface/15' :
                 isTarget ? 'bg-primary/[0.06] border-primary/30 border-dashed' :
                 'bg-white/[0.02] border-on-surface/8 border-dashed hover:border-on-surface/15')}
            >
              <span className={'cond text-xs font-bold w-5 text-center flex-shrink-0 ' + (rankColors[rank-1] || 'text-on-surface/25')}>{rank}</span>
              {player ? (
                <span className="text-xs text-on-surface/80 flex-1">{player.name}</span>
              ) : (
                <span className={'text-[10px] flex-1 ' + (isTarget ? 'text-primary/60 italic' : 'text-on-surface/20 italic')}>
                  {isTarget ? 'click to place' : 'empty'}
                </span>
              )}
              {player && (
                <Icon name="close" size={12} className="text-on-surface/20 hover:text-on-surface/50 flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    )
  }
  ```

- [ ] **Step 5: Define `LobbyCard` at module scope**

  ```jsx
  function LobbyCard(props) {
    var players = props.players || []
    var slots = props.slots || {}
    var selectedPlayerId = props.selectedPlayerId
    var onSelect = props.onSelect
    var onPlace = props.onPlace

    var usedIds = Object.values(slots).filter(Boolean)
    var filledCount = usedIds.length

    return (
      <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-on-surface/8">
          <span className="cond text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface/50">Lobby A — {players.length} players</span>
          <span className="cond text-[9px] font-bold text-secondary">{filledCount}/8 placed</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <PlayerPool players={players} selectedId={selectedPlayerId} usedIds={usedIds} onSelect={onSelect} />
          <PlacementSlots players={players} slots={slots} selectedPlayerId={selectedPlayerId} onPlace={onPlace} />
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 6: Define `RoundControl` at module scope**

  ```jsx
  function RoundControl(props) {
    var players = props.players || []
    var round = props.round
    var totalRounds = props.totalRounds || 3
    var pendingPlacements = props.pendingPlacements || {}
    var selectedPlayer = props.selectedPlayer
    var placementStack = props.placementStack || []
    var onSelect = props.onSelect
    var onPlace = props.onPlace
    var onUndo = props.onUndo
    var onConfirm = props.onConfirm
    var onSaveDraft = props.onSaveDraft

    var filledCount = Object.keys(pendingPlacements).filter(function(k) { return pendingPlacements[k] }).length
    var allFilled = filledCount === 8

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="sports_esports" size={14} className="text-primary" />
            <span className="cond text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface/50">Round Control — Round {round}</span>
          </div>
          <span className="cond text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">Live</span>
        </div>

        <LobbyCard
          players={players}
          slots={pendingPlacements}
          selectedPlayerId={selectedPlayer ? selectedPlayer.id : null}
          onSelect={onSelect}
          onPlace={onPlace}
        />

        <div className="flex items-center gap-2 pt-1">
          <Btn variant="ghost" size="sm" onClick={onUndo} disabled={placementStack.length === 0}>Undo Last</Btn>
          <div className="flex-1"></div>
          <Btn variant="ghost" size="sm" onClick={onSaveDraft}>Save Draft</Btn>
          <Btn variant="secondary" size="sm" onClick={onConfirm} disabled={!allFilled}>
            Confirm Round {round} →
          </Btn>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 7: Add Command Center JSX to the screen body**

  Inside the main return of `HostDashboardScreen`, find where tabs are rendered (the section that shows `{tab === 'overview' && ...}` etc.). Add the new tab content block:

  ```jsx
  {tab === 'commandcenter' && (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-4 lg:items-start">

      {/* Left column — event list + live stats */}
      <div className="w-full lg:w-48 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-on-surface/8">
            <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Your Events</span>
            {tournaments.some(function(e) { return e.status === 'live' }) && (
              <span className="cond text-[8px] font-bold uppercase text-red-400 px-1.5 py-0.5 bg-red-400/10 rounded">1 Live</span>
            )}
          </div>
          <div className="p-2 flex flex-col gap-1">
            {tournaments.length === 0 && (
              <div className="text-[11px] text-on-surface/30 text-center py-4">No events yet</div>
            )}
            {tournaments.map(function(ev) {
              var isActive = ev.id === selectedEventId
              return (
                <div
                  key={ev.id}
                  onClick={function() { setSelectedEventId(ev.id) }}
                  className={'rounded-lg p-2 cursor-pointer border transition-colors ' +
                    (isActive ? 'bg-primary/8 border-primary/25' : 'bg-white/[0.02] border-on-surface/8 hover:border-on-surface/15')}
                >
                  <div className={'text-xs font-bold ' + (isActive ? 'text-primary' : 'text-on-surface/70')}>{ev.name}</div>
                  <div className="text-[10px] text-on-surface/35 mt-0.5">Round {activeRound} / {totalRounds} · {ev.players || 0} players</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
          <div className="px-3 py-2 border-b border-on-surface/8">
            <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Live Stats</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {[
              ['Players', (activeEvent ? activeEvent.players : 0) + ' / ' + (activeEvent ? activeEvent.players : 0), 'text-primary'],
              ['Round', activeRound + ' / ' + totalRounds, 'text-secondary'],
              ['Lobbies', '1 active', 'text-on-surface/50'],
              ['Est. End', '~35 min', 'text-tertiary'],
            ].map(function(row) {
              return (
                <div key={row[0]} className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface/35">{row[0]}</span>
                  <span className={'cond text-[10px] font-bold ' + row[2]}>{row[1]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Center column — round control + standings */}
      <div className="flex-1 flex flex-col gap-3">
        {activeEvent ? (
          <RoundControl
            players={activeRoundLobbyPlayers}
            round={activeRound}
            totalRounds={totalRounds}
            pendingPlacements={pendingPlacements}
            selectedPlayer={selectedPlayer}
            placementStack={placementStack}
            onSelect={function(p) { setSelectedPlayer(p) }}
            onPlace={function(rank) {
              if (selectedPlayer) {
                var existing = pendingPlacements[rank]
                if (existing) {
                  setPendingPlacements(function(prev) {
                    var next = Object.assign({}, prev)
                    delete next[rank]
                    return next
                  })
                  setPlacementStack(function(s) { return s.filter(function(item) { return item.rank !== rank }) })
                } else {
                  setPendingPlacements(function(prev) { return Object.assign({}, prev, { [rank]: selectedPlayer.id }) })
                  setPlacementStack(function(s) { return s.concat([{ rank: rank, playerId: selectedPlayer.id }]) })
                  setSelectedPlayer(null)
                }
              } else {
                var pid = pendingPlacements[rank]
                if (pid) {
                  setPendingPlacements(function(prev) {
                    var next = Object.assign({}, prev)
                    delete next[rank]
                    return next
                  })
                  setPlacementStack(function(s) { return s.filter(function(item) { return item.rank !== rank }) })
                }
              }
            }}
            onUndo={function() {
              if (placementStack.length === 0) return
              var last = placementStack[placementStack.length - 1]
              setPendingPlacements(function(prev) {
                var next = Object.assign({}, prev)
                delete next[last.rank]
                return next
              })
              setPlacementStack(function(s) { return s.slice(0, s.length - 1) })
            }}
            onConfirm={function() {
              setTournamentState(Object.assign({}, tournamentState, {
                lockedLobbies: (tournamentState.lockedLobbies || []).concat([{ round: activeRound, placements: pendingPlacements }])
              }))
              setActiveRound(activeRound + 1)
              setPendingPlacements({})
              setPlacementStack([])
              setSelectedPlayer(null)
              toast('Round ' + activeRound + ' confirmed!', 'success')
            }}
            onSaveDraft={function() {
              localStorage.setItem('tft-round-draft-' + (selectedEventId || 'default'), JSON.stringify(pendingPlacements))
              toast('Draft saved', 'success')
            }}
          />
        ) : (
          <div className="bg-surface-container rounded-xl border border-on-surface/10 p-8 text-center">
            <Icon name="sports_esports" size={32} className="text-primary/30 mb-3" />
            <div className="text-sm text-on-surface/40 font-semibold">No event selected</div>
            <div className="text-xs text-on-surface/25 mt-1">Create an event first to use round control</div>
          </div>
        )}

        {/* Live Standings */}
        {activeEvent && (
          <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
            <div className="px-3 py-2 border-b border-on-surface/8 flex items-center justify-between">
              <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Live Standings</span>
              <span className="text-[9px] text-on-surface/20">Updates after confirm</span>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {activeRoundLobbyPlayers.slice(0, 5).map(function(p, i) {
                return (
                  <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="cond text-xs font-bold w-5 text-center text-on-surface/40">{'#' + (i+1)}</span>
                    <span className="flex-1 text-xs text-on-surface/70">{p.name}</span>
                    <span className="font-mono text-xs font-bold text-on-surface/50">{p.pts || 0} pts</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right column — players + activity */}
      <div className="w-full lg:w-44 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-on-surface/8">
            <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Players</span>
            <span className="cond text-[8px] font-bold text-secondary">{activeRoundLobbyPlayers.length}/8</span>
          </div>
          <div className="p-2 flex flex-col">
            {activeRoundLobbyPlayers.map(function(p) {
              return (
                <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-on-surface/[0.04] last:border-0">
                  <div className="w-4 h-4 rounded-full bg-secondary/20 border border-secondary/30 flex-shrink-0"></div>
                  <span className="flex-1 text-[10px] text-on-surface/70">{p.name}</span>
                  <span className="cond text-[8px] font-bold uppercase text-secondary/70 bg-secondary/8 px-1.5 rounded">In</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
          <div className="px-3 py-2 border-b border-on-surface/8">
            <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Activity</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {[
              ['Round 1 confirmed by host', '5m', 'bg-secondary'],
              ['Lobby A started', '45m', 'bg-on-surface/20'],
              ['Event created', '1h', 'bg-on-surface/15'],
            ].map(function(item, i) {
              return (
                <div key={i} className="flex gap-2 items-start">
                  <div className={'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ' + item[1]}></div>
                  <div className="flex-1 text-[9px] text-on-surface/40 leading-relaxed">{item[0]}</div>
                  <div className="text-[8px] text-on-surface/20 flex-shrink-0">{item[1]}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )}
  ```

- [ ] **Step 8: Verify in browser**

  Log in as admin, navigate to `/host/dashboard`. Click the new "Round Control" tab. Verify 3-column layout renders. Click a player in the pool — gold highlight appears. Click a rank slot — player fills the slot. Fill all 8 — Confirm button enables. Click Confirm — toast shows "Round 1 confirmed!", round advances to 2, slots reset.

- [ ] **Step 9: Commit**

  ```bash
  git add src/screens/HostDashboardScreen.jsx
  git commit -m "feat: Host Dashboard Command Center with click-to-assign round control"
  ```

---

## Task 6: Push to master

- [ ] **Step 1: Run the dev server and do a final manual pass**

  ```bash
  npm run dev
  ```

  Walk through each change:
  1. Nav shows 5 pills including Events
  2. Dashboard ClashCard shows hero empty state in idle
  3. `/clash` shows Waiting Room (countdown + last clash + standing)
  4. Admin has no Quick Clash tab
  5. `/host/dashboard` has Round Control tab with working placement UI

- [ ] **Step 2: Push to master**

  ```bash
  git push origin master
  ```
