# Codebase Concerns

**Analysis Date:** 2026-03-13

## Monolithic Architecture

**Issue:** The entire application is a single 5,735-line React file with no component extraction or code splitting

**Files:** `src/App.jsx`

**Impact:**
- Extremely difficult to maintain and test individual components
- 30+ screen/modal components defined sequentially in one file
- Any change risks breaking unrelated features due to tight coupling
- Performance degrades with app scale (no code splitting, all code loaded at startup)
- Impossible to reuse components across multiple files

**Fix approach:**
Extract screen components into separate files in a `src/screens/` directory (e.g., `HomeScreen.jsx`, `BracketScreen.jsx`). Create `src/components/` for reusable UI atoms and patterns. Establish clear separation of concerns between business logic, UI components, and state management.

---

## Weak Unique Identifier Generation

**Issue:** Player IDs are generated using `Date.now()%100000`, which can produce collisions

**Files:** `src/App.jsx` line 1254

**Impact:**
- Multiple rapid registrations could generate identical IDs
- Race conditions could corrupt player state (two players with same ID overwrite each other)
- Statistics aggregation could attribute data to wrong player
- No audit trail to detect ID collisions

**Workaround:** Currently mitigated because registration is manual and slow, but breaks if automated

**Fix approach:**
Use UUID v4 (`crypto.randomUUID()`) or nanoid library for guaranteed uniqueness. Alternatively, use server-side sequential IDs if moving to database backend.

---

## No Data Persistence

**Issue:** All state lives in React state only; no localStorage, no database, entire game state lost on page refresh

**Files:** `src/App.jsx` lines 5617-5625 (root state initialization)

**Impact:**
- Tournament results are lost on page refresh
- Admin cannot close browser during tournament
- Bracket/dispute data not persisted
- No backup if browser crashes
- No audit trail of changes

**Workaround:** None currently implemented

**Fix approach:**
Implement Supabase or Firebase Realtime Database for persistent state. Minimum viable: localStorage for player list and completed tournament data. Add automatic save-on-change and conflict resolution.

---

## Unsafe Player Data Mutations

**Issue:** Direct state mutations via `setPlayers()` without validation or immutability checks

**Files:** `src/App.jsx` throughout (especially lines 1255, 1352, in AdminPanel and BracketScreen)

**Impact:**
- Impossible to undo/redo operations
- No optimistic updates possible
- Race conditions if multiple tabs/windows edit simultaneously
- Data corruption from accidental overwrites
- Difficult to debug state changes

**Example:** Line 1255 silently appends new player without checking for duplicate IDs beyond Riot ID

**Fix approach:**
Implement immutable state updates using Immer or similar library. Add middleware to validate all mutations. Create explicit actions for common operations (registerPlayer, updatePlacement, resolveDispute). Log all changes for audit trail.

---

## Unvalidated Achievement Checks

**Issue:** Achievement unlock logic wrapped in try-catch that silently swallows errors

**Files:** `src/App.jsx` line 174, and repeated at lines 4011, 4055, 4103, 4494, 4500

```javascript
function getAchievements(p){
  return ACHIEVEMENTS.filter(a=>{
    try{return a.check(p);}
    catch{return false;}
  });
}
```

**Impact:**
- Broken achievement checks produce no error signal; players never know why they didn't unlock
- Impossible to debug achievement logic in production
- Silent failures could hide bugs in stat calculations

**Fix approach:**
Log caught errors to console and error tracking service. Validate achievement requirements at definition time. Add unit tests for each achievement check function. Test achievement logic independently of component rendering.

---

## Race Condition in Admin Dispute Resolution

**Issue:** Multiple admins could simultaneously resolve the same dispute, and array indices could shift during concurrent updates

**Files:** `src/App.jsx` line 988 in `DisputeBanner`

```javascript
onResolve={(idx,action)=>{
  setDisputes(d=>d.filter((_,i)=>i!==idx));
  ...
}}
```

**Impact:**
- If admin A removes dispute at index 2 while admin B also resolves index 2, wrong dispute is deleted
- Disputes state array is not stable if edits happen simultaneously
- No way to verify which dispute was actually resolved

**Fix approach:**
Use dispute IDs instead of array indices. Use optimistic locking (version numbers) before accepting update. Require server confirmation before removing from list. Add audit log of who resolved what when.

---

## Placement Validation Gap

**Issue:** Placement values are parsed from user input without type validation; placement scores have no bounds checking

**Files:** `src/App.jsx` line 845, throughout `BracketScreen` placement submission

**Impact:**
- User could submit placement "9" or "NaN" which breaks scoring
- Negative placements (e.g., "-5") not caught
- Average placement calculations become meaningless with invalid data
- Leaderboard standings corrupted

**Fix approach:**
Validate placements are integers in range [1-8]. Use TypeScript or prop-types for runtime schema validation. Add client-side validation before submission. Add server-side validation to reject invalid data. Sanitize any user input before calculations.

---

## Unstable Sort for Leaderboard Ties

**Issue:** Multiple sort approaches for tiebreaking exist but none match official rulebook; sorting is done in JSX with no stable comparison

**Files:** `src/App.jsx` line 1184 (StandingsTable), various leaderboard sorting logic

**Impact:**
- Player order changes unpredictably when points are tied
- Leaderboard rank #3 could shift based on scroll or filter changes
- Official tiebreaker rules (wins+top4s, then placement counts) not consistently applied
- Player confusion about why their rank changed

**Rulebook tiebreaker order:**
1. Total tournament points
2. Wins + top4s (wins count twice)
3. Most of each placement (1st → 2nd → 3rd...)
4. Most recent game finish

**Fix approach:**
Create deterministic `comparePlayers()` function that implements all 4 tiebreaker rules in order. Use it consistently across all sorting. Add test cases for tie scenarios. Document sort stability.

---

## Stats Engine Silent Failures

**Issue:** `computeStats()` at line 65 has multiple fallback paths that mask incomplete data

```javascript
const games = h.length || player.games || 0;
const avg = (h.reduce(...)) : (parseFloat(player.avg) || 0);
```

**Files:** `src/App.jsx` lines 65-102

**Impact:**
- If `clashHistory` is missing but `player.wins` exists, stats come from incomplete source
- Leaderboard and profile show stale cached stats, not live calculated stats
- No way to know if displayed stats are fresh or from fallback
- Averaging placement from different data sources produces incorrect averages

**Fix approach:**
Implement `clashHistory` as canonical source of truth. Pre-compute and cache stats on server. Add `statsSource` field to player to track which data was used. Validate all required history fields before computing. Fail loudly if data is incomplete.

---

## Hardcoded Tournament Constants

**Issue:** Tournament state (player cap, format, lobby size, dates, seasons) hardcoded throughout JSX

**Files:** `src/App.jsx` lines 1250 (64 player cap), 1327 (Clash #14), 1311 (Set 16), 1345 (8PM EST), many others

**Impact:**
- Cannot run multiple tournaments simultaneously without code changes
- Hard to test different tournament formats
- Cannot implement "seasons" or "events" as data-driven features
- Changing tournament format requires code edit + redeploy
- No way to archive past tournament configs

**Fix approach:**
Create tournament configuration object with all mutable parameters. Store in Firestore/Supabase. Load at app startup. Pass as context to all screens. Support multiple concurrent tournaments with separate UIs.

---

## Missing Input Sanitization

**Issue:** Player names and Riot IDs taken directly from input fields, used in display without escaping

**Files:** `src/App.jsx` line 1254 (new player creation), throughout display code

**Impact:**
- XSS vulnerability if attacker registers with name containing `<img src=x onerror=alert(1)>`
- Injection attacks possible if Riot ID validation weak
- Could deface leaderboard display

**Fix approach:**
Use DOMPurify or similar library to sanitize all user-provided text before rendering. React's JSX provides some protection by default, but HTML-injection-safe functions needed. Add input length limits (32 chars for names). Validate Riot ID format against official Riot ID spec.

---

## Stranded State Variables

**Issue:** Several state variables created but never used or updated

**Files:** `src/App.jsx` line 5621

```javascript
const [disputes]=useState([]);  // Defined but never updated — disputes array never grows
```

**Impact:**
- Dead code path if disputes feature works
- Confusing for maintainers
- Bug if disputes were supposed to work

**Fix approach:**
Remove unused state. If disputes feature intentional, implement full CRUD operations. Add UI to file dispute. Test dispute flow end-to-end.

---

## Test Coverage Gaps

**Issue:** No test files present in codebase; achievement checks, stats calculations, and tiebreaker logic untested

**Files:** No test files found; test coverage = 0%

**Impact:**
- Placement calculations could be wrong without detection
- Achievement unlocks unreliable
- Leaderboard ordering unpredictable
- Regression detection impossible

**Critical untested paths:**
- `computeStats()` and all its fallback logic
- Tiebreaker implementation against official rulebook
- Achievement checks (try-catch masks errors)
- Placement scoring (PTS constant application)
- Dispute resolution logic

**Fix approach:**
Create `src/__tests__/` directory. Add Jest or Vitest config. Write unit tests for all stat functions with multiple player scenarios. Test tiebreaker with known edge cases. Test achievement logic independently of component rendering.

---

## Unclear Admin Password

**Issue:** Admin access is a hardcoded string hint revealed in UI; no secure authentication

**Files:** `src/App.jsx` line 5721

```javascript
<div style={{fontSize:13,color:"#4A4438"}}>Hint: <span style={{color:"#E8A838"}}>admin</span></div>
```

**Impact:**
- Any user can see the hint and guess admin password
- No audit trail of who accessed admin
- Admin cannot be securely shared between multiple hosts
- No session/timeout protection

**Fix approach:**
Remove client-side password check. Implement server-side role-based access control (RBAC) with proper auth (OAuth, Supabase Auth). Store admin status in user account database. Support multiple admins. Add session timeout and audit logging.

---

## Floating Point Precision Errors

**Issue:** Average placements stored and calculated using JavaScript floats; rounding errors accumulate

**Files:** `src/App.jsx` lines 73-74, 81, 102

```javascript
const avgPlacement = h.length > 0
  ? (h.reduce((s,g)=>s+(g.placement||0),0)/h.length)
  : (parseFloat(player.avg||0));
```

**Impact:**
- Leaderboard sort order could change due to floating point comparison
- Display shows 4.999999 instead of 5.0
- Tiebreaker (most recent game) could be affected by tiny precision differences

**Fix approach:**
Store averages as integers (e.g., average * 1000 as int). Convert to fixed decimal places for display using `toFixed(2)`. Use integer arithmetic for tiebreaker comparisons. Document precision strategy.

---

## Missing Null Safety

**Issue:** Many operations assume objects exist without null checks

**Files:** `src/App.jsx` throughout, e.g., line 1279

```javascript
const p = players.find(pl => pl.name === SEASON_CHAMPION.name);
if(p) { setProfilePlayer(p); setScreen("profile"); }
```

**Impact:**
- If SEASON_CHAMPION not in players array, clicking hero card fails silently
- Player profile could receive null and crash
- No error reporting to admin

**Fix approach:**
Use TypeScript with strict null checking (`--strictNullChecks`). Add optional chaining and nullish coalescing throughout. Validate critical objects on load. Add error boundary components.

---

## Performance: Large Array Rerenders

**Issue:** Components rerender when `players` array changes, even if they don't use updated player

**Files:** `src/App.jsx` lines 5695-5716 (root render)

**Impact:**
- Changing one player's stats triggers rerender of all screens
- Leaderboard with 64 players rerenders on each result entry
- Mobile devices lag noticeably
- Scales poorly as player count grows

**Fix approach:**
Memoize screen components with React.memo and useMemo. Implement selector functions to pass only needed player subset. Consider Context API or Zustand to avoid prop drilling. Use React DevTools Profiler to identify hot paths.

---

## Browser History Management Risk

**Issue:** Manual window.history.pushState() without proper URL encoding or state validation

**Files:** `src/App.jsx` lines 5632, 5638

```javascript
window.history.pushState({screen:s},'','#'+s);
window.history.replaceState({screen:h||"home"},'','#'+(h||"home"));
```

**Impact:**
- If screen name contains special characters, URL breaks
- Bookmarks with invalid screens could crash app on load
- Back button could navigate to non-existent screens

**Fix approach:**
Use React Router instead of manual history management. Validate screen names against known list before navigation. URL-encode screen parameter. Test browser back/forward thoroughly.

---

## Missing Accessibility

**Issue:** No semantic HTML, ARIA labels, or keyboard navigation support

**Files:** `src/App.jsx` throughout JSX

**Impact:**
- Screen reader users cannot navigate the app
- Keyboard-only users cannot access tournament features
- WCAG compliance violations
- Legal liability for public tournament platform

**Fix approach:**
Add semantic HTML (`<button>` instead of `<div>` with onClick). Add `role`, `aria-label`, `aria-describedby` attributes. Implement tab order and focus management. Test with axe accessibility checker.

---

## Dependency on Hardcoded Seed Data

**Issue:** `SEED` array of 24 players used as initial state; immutable and hardcoded

**Files:** `src/App.jsx` lines 172-232, line 5618

```javascript
const [players,setPlayers]=useState(SEED);
```

**Impact:**
- Cannot run fresh tournaments (must remove seed players first)
- Seed player Riot IDs fixed (only valid ones: Levitate, Zounderkite, etc.)
- Cannot support multiple concurrent tournaments
- Real tournament data mixed with demo data

**Fix approach:**
Load initial players from database if available, else empty array. Separate demo mode from production. Add "clear tournament" button to admin panel. Support importing tournament roster from CSV/JSON.

---

## Incomplete Rules Enforcement

**Issue:** Official rulebook exists (RulesScreen) but no technical enforcement of rules in code

**Files:** RulesScreen displays rules (lines 5075-5340) but validation logic missing

**Examples:**
- No check that players don't soft-play same opponent repeatedly
- No detection of account sharing
- No screenshot requirement enforcement
- Auto-drop logic mentioned in FAQ (line 5437) but not implemented

**Impact:**
- Admins must manually enforce all rules
- Cheating/collusion undetected
- Inconsistent enforcement between tournaments

**Fix approach:**
Implement rule enforcement in code: duplicate match detection, DNP auto-drop 15min before start, screenshot verification hooks, dispute flag system for suspected collusion.

---

## Session State in URL Only

**Issue:** Screen navigation relies entirely on URL hash with no server-side session

**Files:** `src/App.jsx` lines 5630-5641

**Impact:**
- If user bookmarks `/index.html#profile` but no `profilePlayer` context, app crashes
- Sharing links like `/index.html#profile` won't work (profilePlayer state lost)
- No way to link to specific player profiles publicly
- Session lost on tab refresh

**Fix approach:**
Implement server-side session management. Include player ID in URL: `#profile/12345`. Parse and validate URL parameters. Generate shareable public profile URLs. Use sessionStorage as cache layer.

---

## Missing Error Boundary

**Issue:** Any JavaScript error in component tree crashes entire app with blank screen

**Files:** `src/App.jsx` root component (lines 5616-5735) has no Error Boundary

**Impact:**
- Single bug in one screen component crashes tournament
- Admins cannot recover without page refresh
- Users see blank page instead of error message
- No error logging to track issues

**Fix approach:**
Implement React Error Boundary component. Log errors to error tracking service (Sentry, LogRocket). Display user-friendly error screen with retry button. Add error logging for debugging.

---

## Duplicate Player Name Edge Case

**Issue:** Riot ID uniqueness is checked (line 1251) but display name is not, leading to confusion

**Files:** `src/App.jsx` line 1251 only checks Riot ID

**Impact:**
- Two players could register with name "Alex" but different Riot IDs
- Player profile linking breaks: `players.find(pl=>pl.name===SEASON_CHAMPION.name)` could return wrong player
- Leaderboard display ambiguous

**Fix approach:**
Enforce unique display names OR use player ID in lookups instead of name. Add "copy ID" button to share player profiles by ID not name. Document that names are display-only.

---

## Task Backlog Indicator

**Issue:** Task backlog (docs/TASKS.md) lists 11 tasks with multiple marked incomplete; platform not production-ready

**Priority items stalled:**
- #1: Bracket PIN gate removal (UI clutter)
- #2: Scrims stats sheet incomplete
- #3-#8: Polish and premium features
- #9: Points system verification needed
- #10: Production deploy blocked on real auth + DB
- #11: FAQ content outdated re: score submission

**Impact:**
- UI has deprecated PIN security theater
- Admin experience suboptimal
- Missing premium user features
- Scoring logic unverified against official rules
- Deployment blocked

---

## Scaling Concerns

**Current capacity:** Hardcoded 64-player maximum (line 1250)

**Limitations:**
- Linear array operations on players list become O(n^2) as n grows
- Entire app rerenders on each player state change
- No pagination on leaderboard (all 64 players rendered)
- No database indexing possible (state-only)
- No support for multiple simultaneous tournaments

**Scaling path:**
Implement Firestore/Supabase with proper indexing. Add pagination. Split app state using Context or state management library. Implement worker processes for stat calculations. Cache frequently-accessed data.

---

*Concerns audit: 2026-03-13*
