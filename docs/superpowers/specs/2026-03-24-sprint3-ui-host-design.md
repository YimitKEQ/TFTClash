# Sprint 3 — UI/UX Fixes + Host Dashboard Design Spec
**Date:** 2026-03-24
**Status:** Approved by user

---

## 1. Goal

Fix the remaining visible brokenness (nav pills, idle ClashCard, idle ClashScreen) and build the Host Dashboard with live round control. This sprint covers UI only — no new Supabase tables.

---

## 2. Scope

**In scope:**
- Navbar: add Events pill (5 primary pills total)
- ClashCard (dashboard widget): idle state when no clash is running
- ClashScreen (`/clash`): idle state when no clash is running (Waiting Room layout)
- HostDashboardScreen: Command Center layout with round control
- Round control: click-to-assign placement input (click player → click their rank slot)
- Remove Quick Clash tab from AdminScreen

**Out of scope:** New Supabase tables, payment wiring, Discord integration, player self-submit (future sprint), push notifications.

---

## 3. Navbar — 5 Primary Pills

### 3.1 Current state
Navbar shows 4 pills: `Clash · Standings · Hall of Fame · Pricing`. Events is missing.

### 3.2 Target state
5 pills in order: **`Clash · Standings · Events · Hall of Fame · Pricing`**

### 3.3 Implementation
- File: `src/components/layout/Navbar.jsx` — the active navbar (extracted from App.jsx in Sprint 2)
- The `DESKTOP_PRIMARY` array is defined at line ~218. Insert `{ id: "events", label: "Events" }` **between the `standings` entry and the `hof` entry**. Do not touch the `clash` entry (it has a complex conditional shape). The result after insertion:
  ```
  clash (index 0, existing — do not modify)
  standings (index 1, existing — do not modify)
  events (index 2, NEW — insert here)
  hof (index 3, existing — shifts right)
  pricing (index 4, existing — shifts right)
  ```
  Locate the line `{ id: "standings", label: "Standings" }` and insert the new entry immediately after it.
- **Do NOT add a `path` property** — pills navigate via `navTo(l.id)` which looks up `SCREEN_TO_ROUTE[id]`. `SCREEN_TO_ROUTE.events` is already `"/events"` (line 10 of Navbar.jsx). The routing is automatic.
- Active state: `var isActive = screen === l.id` — already in place, no change needed.

---

## 4. ClashCard — Idle State (Dashboard Widget)

### 4.1 Current state
When no clash is running, the card shows zero-filled stats. `tournamentState.phase` defaults to `"idle"` (string) in AppContext.

### 4.2 Target state (Hero Empty State)
Replace the zero-stat grid with a hero empty state plus a compact mini stats row.

**Layout (top to bottom):**
1. **Card header** (unchanged): season label, player name, "No Active Clash" status pill
2. **Empty hero body:**
   - Icon: `<Icon name="swords" className="text-3xl text-primary" />`
   - Title: `"No clash this week — yet"` — use `font-display` class (Russo One via CSS, see Section 9)
   - Subtitle: `"Next clash is scheduled for Saturday night. Registration opens 24h before."` — default body text, `text-on-surface/40`
   - Next clash chip: `"Next: Saturday · 20:00 CET"` — muted outlined pill, use `.cond` CSS class (Chakra Petch condensed, uppercase)
   - Two CTAs: primary `"View Standings"` → `navTo('standings')`, ghost `"Browse Events"` → `navTo('events')`. Use `<Btn>` from `components/ui/`.
3. **Mini stats row** (always visible at bottom): 4 cells: PTS · Wins · Rank · Clashes
   - `var pts = linkedPlayer && linkedPlayer.pts > 0 ? linkedPlayer.pts : '—'`
   - `var wins = linkedPlayer && linkedPlayer.wins > 0 ? linkedPlayer.wins : '—'`
   - `var clashes = linkedPlayer && linkedPlayer.games > 0 ? linkedPlayer.games : '—'`
   - For rank: compute as separate `var` statements (no IIFEs — CLAUDE.md rule):
    ```js
    var sortedPlayers = [].concat(players).sort(function(a,b){return (b.pts||0)-(a.pts||0);});
    var rankIdx = linkedPlayer ? sortedPlayers.findIndex(function(p){return p.id===linkedPlayer.id;}) : -1;
    var rank = rankIdx >= 0 ? '#'+(rankIdx+1) : '—';
    ```

### 4.3 Implementation
- File: `src/screens/DashboardScreen.jsx` — `ClashCard` is defined at module scope locally in this file
- Get state: `var tournamentState = ctx.tournamentState; var isIdle = !tournamentState || tournamentState.phase === 'idle' || !tournamentState.phase`
- `ctx` = `useApp()` (already called in DashboardScreen, `tournamentState` is already destructured there)
- Inside `ClashCard`'s render: `if (isIdle) return <ClashCardIdle linkedPlayer={linkedPlayer} players={players} />`
- Define `ClashCardIdle` at module scope in `DashboardScreen.jsx` — **not inside `ClashCard` or any other function**
- `ClashCardIdle` receives `{ linkedPlayer, players }` as props. It does not call `useApp()` — data is passed in.
- Navigation: `ClashCardIdle` receives `navigate` as a prop (from `useNavigate()` called inside `ClashCard`) and calls `navigate('/standings')` / `navigate('/events')`

### 4.4 Font note
CLAUDE.md's Product Identity lists `Playfair Display, Barlow Condensed` — this is **outdated**. The actual loaded fonts are defined in `src/index.css`: Russo One (`font-display` / `h1-h4`), Chakra Petch (body default, `.cond` class), JetBrains Mono (`.mono` class). Use these tokens only.

---

## 5. ClashScreen — Idle State (Waiting Room)

### 5.1 Current state
- File: `src/screens/ClashScreen.jsx` (confirmed on disk)
- `ClashScreen` receives `tournamentState` as a prop passed from `App.jsx`
- There is already an idle early-return at line ~2263: `if (!phase) { ... }` — this checks `!phase` (falsy), but AppContext initializes `phase` as the string `"idle"` which is truthy, so **the existing idle state does not trigger**
- The fix must change the condition to catch `phase === 'idle'` (the actual value)

### 5.2 Target state (Waiting Room — replaces existing idle block)
Three panels stacked vertically inside the idle early-return:

**Panel 1 — Countdown Hero:**
- Label: `"NEXT CLASH"` — `.cond` class, `text-primary`, small (`text-xs`)
- Countdown: `<CountdownTimer targetDate={nextSaturday} />` where `nextSaturday` is computed at render time:
  ```js
  var now = new Date();
  var nextSaturday = new Date(now);
  var daysUntilSat = (6 - now.getDay() + 7) % 7 || 7;
  nextSaturday.setDate(now.getDate() + daysUntilSat);
  nextSaturday.setHours(20, 0, 0, 0);
  ```
  `CountdownTimer` accepts a single prop `targetDate` (a Date object). The component is pre-existing at `src/components/shared/CountdownTimer.jsx` — use it as-is without modification (it was written before CLAUDE.md rules; do not rewrite it).
- Status pill: `"No Active Clash"` — `text-on-surface/40`, `border-on-surface/20`, rounded pill
- Subtitle: `"Registration opens Saturday at 18:00 CET"` — muted body text

**Panel 2 — Last Clash Recap:**
- Header: `lastClash.name + " — Results"` (e.g. `"Clash #7 — Results"`) — NOT hardcoded — with `"View All Results"` link → `navigate('/results')`
- Data: `var lastClash = PAST_CLASHES[0]` — import `PAST_CLASHES` from `'../../lib/constants'`. `PAST_CLASHES[0]` is the most recent entry (array is newest-first).
- Top 3 from `lastClash.top8.slice(0, 3)`: each entry has `{ name, pts }`. Render as podium row:
  - 1st: `text-primary` (gold)
  - 2nd: `text-on-surface/60` (silver)
  - 3rd: `text-tertiary` (purple)
  - Show: placement number + player name + `entry.pts + " pts"`

**Panel 3 — Your Season Standing:**
- Header: `"Your Season"` with `"Full Standings"` link → `navigate('/standings')`
- If `currentUser` is truthy and `linkedPlayer` exists: show rank badge + name + `linkedPlayer.pts` pts + `linkedPlayer.wins` wins + `linkedPlayer.games` clashes
- If `!currentUser`: show `"Sign up to track your stats"` with a `"Sign Up Free"` link → `navigate('/signup')`

### 5.3 Implementation
- File: `src/screens/ClashScreen.jsx`
- `ClashScreen` does not currently import `useNavigate`. Add import at top: `import { useNavigate } from 'react-router-dom';`
- Inside the `ClashScreen` function body, add: `var navigate = useNavigate();`
- Replace the existing idle early-return (the `if (!phase) { ... }` block starting at line ~2263) with:
  ```js
  var linkedPlayer = (props.players || []).find(function(p){ return props.currentUser && p.id === props.currentUser.id; }) || null;
  if (!phase || phase === 'idle') {
    return <ClashIdleView players={props.players} currentUser={props.currentUser} linkedPlayer={linkedPlayer} navigate={navigate} />;
  }
  ```
  (`linkedPlayer` is not passed as a prop from App.jsx — always compute it as shown above, inside `ClashScreen`, before the idle early-return.)
- Define `ClashIdleView` at module scope in `ClashScreen.jsx` — before the `ClashScreen` function definition
- Props: `{ players, currentUser, linkedPlayer, navigate }` — all passed in, no `useApp()` call inside `ClashIdleView`
- **Do NOT add another `<PageLayout>` wrapper** — `App.jsx` line 613 wraps ClashScreen: `{screen==="clash" && <PageLayout><ClashScreenNew .../></PageLayout>}`. `ClashIdleView` renders inner page content only — no extra `<PageLayout>` tag.
- `PAST_CLASHES` is **already imported** at line 3 of `ClashScreen.jsx` (`import { PAST_CLASHES } from '../lib/constants.js'`) — do NOT add a duplicate import.
- Import `CountdownTimer` at top of file if not already present: `import CountdownTimer from '../components/shared/CountdownTimer';`

---

## 6. Host Dashboard — Command Center Layout

### 6.1 Context
`/host/dashboard` → `src/screens/HostDashboardScreen.jsx`. Hosts have `isAdmin === true` or `tier === 'host'`.

**Auth guard:** At the top of `HostDashboardScreen`, verify there is a guard: `if (!currentUser) return null;` (or a redirect). If absent, add it. `currentUser` comes from `useApp()`.

### 6.2 `hostTournaments` data shape
`hostTournaments` from `useApp()` is an array of objects. Each object has the following fields (from AppContext and Supabase query at line ~713):
```js
{
  id: string,          // e.g. "t-1711234567890"
  name: string,        // e.g. "Week 4 Clash"
  date: string,        // e.g. "2026-03-28"
  season: string,      // e.g. "S1"
  players: number,     // count of players
  lobbies: number,     // count of lobbies
  champion: string,    // winner name (after completion)
  top3: string[],      // top 3 names (after completion)
  // Fields NOT yet in shape: totalRounds, status, lobby details, registeredIds
}
```
Fields `totalRounds`, `status`, per-round placements, and individual lobby rosters are **not** yet stored in `hostTournaments`. For this sprint, treat them as mock/placeholder data: `var totalRounds = 3; var activeRoundLobbyPlayers = players.slice(0, 8);`. Live wiring is a future sprint.

### 6.3 Layout (3-column split)
```
[ Left w-48     ] [ Center flex-1                ] [ Right w-44  ]
[ Events list   ] [ Round Control (dominant)     ] [ Players     ]
[ + Live Stats  ] [ Live standings preview       ] [ Activity    ]
```

**Left column (`w-48 flex-col gap-3`):**
- "Your Events" panel: list from `hostTournaments`. Active event has gold border. Show `event.name`, `"Round N / 3"` (N = `activeRound`), `event.players + " players"`. Click → `setSelectedEventId(event.id)`.
- "Live Stats" panel: 4 stat rows — Players (`activeEvent.players + " / " + activeEvent.players`), Round (`activeRound + " / 3"`), Lobbies (`"1 active"`), Est. End (`"~35 min"`) — all static placeholders for now.

**Center column (`flex-1 flex-col gap-3`):**
- "Round Control" panel: header `"Round Control — Round " + activeRound` + red LIVE badge. Contains the `<RoundControl>` component (Section 7). Below: `Undo Last` ghost btn, `Save Draft` ghost btn, `Confirm Round N` teal btn (disabled until all slots filled).
- "Live Standings" panel: compact ranked list. Columns: rank / name / pts / record. After each round confirm, standings recalculate from `pendingPlacements` history. For this sprint, standings are computed from the placements entered this session only (not from Supabase history).

**Right column (`w-44 flex-col gap-3`):**
- "Players" panel: list of `activeRoundLobbyPlayers` (first 8 from `players`). Each row: small avatar circle + name + `"In"` badge.
- "Activity" panel: hardcoded recent-action log for now: `"Round 1 confirmed"`, `"Lobby A started"`, `"Event created"` — each with a timestamp string. Live wiring is a future sprint.

### 6.4 Responsive
Add `hidden lg:flex` to the outer 3-col wrapper. Add a separate `lg:hidden` single-column fallback below it (just the round control panel + a condensed stats strip). Use Tailwind `lg:` breakpoint (1024px).

### 6.5 Implementation
- File: `src/screens/HostDashboardScreen.jsx` — rewrite the screen body JSX. Keep all existing state declarations and Supabase load calls at the top of the component — do not remove them.
- `hostTournaments` is already available at line 62 in the existing file
- `setTournamentState` is exposed from `useApp()` (AppContext line 825). Destructure it alongside other state: `var setTournamentState = ctx.setTournamentState;` where `var ctx = useApp();` is already called at the top of the component.
- State additions (using CLAUDE.md convention):
  ```js
  var _selEvt = useState(hostTournaments.length > 0 ? hostTournaments[0].id : null);
  var selectedEventId = _selEvt[0]; var setSelectedEventId = _selEvt[1];
  var _ar = useState(1);
  var activeRound = _ar[0]; var setActiveRound = _ar[1];
  ```
- Active event: `var activeEvent = (hostTournaments || []).find(function(e) { return e.id === selectedEventId; }) || null`
- Player list for round control: `var activeRoundLobbyPlayers = players.slice(0, 8)` (from `useApp()` — `players` is already available)
- **Supabase sync note:** Calling `setTournamentState(...)` triggers the existing `useEffect` at line ~607 in AppContext, which automatically upserts to Supabase `site_settings`. This is expected — round confirmation writes via this existing mechanism.

---

## 7. Round Control — Click-to-Assign Placement

### 7.1 Interaction model
Two-step: (1) click player name in pool → highlights gold; (2) click empty rank slot → assigns player to that rank.

- **Highlight:** Selected player gets `border-primary` + `bg-primary/10`
- **Dimming:** Used players get `opacity-40 pointer-events-none`
- **Filled slot:** Shows player name, `bg-surface-container`, `border-on-surface/20`
- **Empty slot:** Dashed border `border-on-surface/10`, shows rank number in muted text
- **Re-open:** Clicking a filled slot clears it (returns player to pool)
- **Undo:** Removes most recent placement (LIFO stack)
- **Confirm:** Enabled only when all 8 rank slots have a player assigned
- **On confirm:**
  ```js
  setTournamentState(Object.assign({}, tournamentState, {
    lockedLobbies: (tournamentState.lockedLobbies || []).concat([{ round: activeRound, placements: pendingPlacements }])
  }));
  setActiveRound(activeRound + 1);
  setPendingPlacements({});
  setPlacementStack([]);
  ```
  (Immutable update — always `Object.assign({}, existing, changes)`, never mutate `tournamentState` directly.)
- **Save Draft:** `localStorage.setItem('tft-round-draft-' + (selectedEventId || 'default'), JSON.stringify(pendingPlacements))`

### 7.2 Component structure (all at module scope in HostDashboardScreen.jsx)

```
RoundControl({ players, round, pendingPlacements, selectedPlayer, placementStack,
               onSelect, onPlace, onUndo, onConfirm, onSaveDraft })
  └── LobbyCard({ players, placements, selectedPlayerId, onSelect, onPlace })
        ├── PlayerPool({ players, selectedId, usedIds, onSelect })
        └── PlacementSlots({ players, slots, selectedPlayerId, onPlace })
```

- `placements` / `slots`: same object `{ 1: playerId, 2: playerId, ... }` keyed by rank 1-8
- `usedIds`: `Object.values(slots)` — set of already-placed player IDs

### 7.3 State (CLAUDE.md convention — unpack useState with var)
```js
var _pending = useState({});
var pendingPlacements = _pending[0]; var setPendingPlacements = _pending[1];
// Shape: { 1: playerId, 2: playerId, ... } keyed by rank (1-8)

var _selP = useState(null);
var selectedPlayer = _selP[0]; var setSelectedPlayer = _selP[1];
// Shape: { id, name } or null

var _stack = useState([]);
var placementStack = _stack[0]; var setPlacementStack = _stack[1];
// Shape: [{ rank, playerId }] — LIFO, last element is most recent
```

---

## 8. Remove Quick Clash from AdminScreen

- File: `src/screens/AdminScreen.jsx`
- Remove `quickclash: 'casino'` entry from `ADMIN_ICON_MAP`
- Remove the tab button that calls `setTab('quickclash')` (or equivalent)
- Remove the JSX conditional block: `{tab === 'quickclash' && (...)}`
- Remove any `case 'quickclash':` entries in switch statements
- If `tab` state's initial value is `'quickclash'`, change it to `'overview'` or whichever is the first remaining tab

---

## 9. Design Tokens + Code Style

**Font classes** (authoritative — based on `src/index.css`, which supersedes the outdated CLAUDE.md font list):
- `font-display` or heading tags (`h1`–`h4`) → Russo One
- Default body text → Chakra Petch (set on `html` element globally)
- `.cond` class → Chakra Petch condensed style (labels, uppercase, letter-spacing)
- `.mono` class → JetBrains Mono (numbers, stats)
- **Do NOT use:** Space Grotesk, Inter, Barlow Condensed, Playfair Display — none are loaded

**Code rules (CLAUDE.md — mandatory):**
- `var` declarations only — no `const`, `let`
- `function(){}` callbacks — no arrow functions in new code
- No backtick strings inside JS functions
- No inline styles — Tailwind classes only
- `<Icon name="..." />` for Material Symbols
- Components at module scope only — never defined inside another component's body
- Immutability: always `Object.assign({}, existing, changes)`, never mutate objects in place

**Color tokens:**
- Gold: `text-primary`, `bg-primary/10`, `border-primary/25`
- Teal: `text-secondary`, `bg-secondary/10`
- Purple: `text-tertiary`
- Muted: `text-on-surface/40`, `text-on-surface-variant`
- Surface: `bg-surface`, `bg-surface-container`
- Borders: `border-on-surface/10`, `border-on-surface/20`

---

## 10. Testing

- **Nav pills:** Count 5 pills on any page (Clash · Standings · Events · HoF · Pricing). Click Events → `/events` loads.
- **ClashCard idle:** Ensure `tournamentState.phase === 'idle'` (default). Dashboard shows hero empty state with icon + message + mini stats row. Levitate sees real pts/wins; new player sees `"—"`.
- **ClashScreen idle:** Navigate to `/clash` with phase `'idle'`. Verify 3 panels: countdown (ticking), last clash recap (`Clash #7`, top 3 names + pts), season standing for Levitate.
- **Host Dashboard:** Log in as admin, go to `/host/dashboard`. Verify 3-column layout. If `hostTournaments` is empty, verify empty state message shows.
- **Round control:** Select a player from pool (gold highlight), click a slot (fills). Click filled slot (clears). Fill all 8 → Confirm enables. Click Confirm → standings panel updates, round increments.
- **Quick Clash removed:** AdminScreen has no Quick Clash tab or panel.
