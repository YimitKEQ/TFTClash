# TFT Clash Restoration & Enhancement — Design Spec
**Date:** 2026-03-24
**Status:** Approved by user

---

## 1. Problem Statement

The app accumulated fake content across multiple sessions: hardcoded mock auth, broken navigation routes, fake "LIVE" badges, daily/weekly challenges with no backend, and seed data that was stripped out. The UI overhaul (Stitch "Obsidian Arena" design) is solid - the problem is content accuracy, broken flows, and missing real data. Goal: strip the fake, wire up the real, make the Clash engine shine.

---

## 2. What Gets Killed

| Fake Thing | Fix |
|---|---|
| Hardcoded mock auth (`currentUser = Levitate` always) | Real Supabase auth - null by default, proper login/signup flow |
| `tournamentState` default phase `"registration"` | Change default to `"idle"` so Dashboard shows correct idle state |
| "Register Your Team" CTA copy | "Register Now" |
| Fake "Status: LIVE" pulsing badge on HomeScreen | Only show when `tournamentState.phase === 'live'` |
| Fake season stats (0 clashes, 0 players) | Only show real counts from loaded data; show "—" when no data |
| "Where legends are forged in the convergence" tagline | Clean, direct: "Weekly TFT Clash. Saturday nights." |
| Broken sidebar `/support` route | Maps to `/faq` |
| Broken sidebar `/logout` route | Calls `supabase.auth.signOut()` directly |
| Broken sidebar `/clash` CTA | Navigates to `/` (Dashboard) |
| Sidebar arrow functions (violates CLAUDE.md) | Rewrite with `var` + `function(){}` |
| Daily/Weekly Challenges with fake XP progress | Remove from sidebar nav; screens stay but aren't promoted |
| Milestones with frontend-only logic | Same - not in main nav |
| Empty SEED / HOMIES_IDS / PAST_CLASHES | Seed the real homies and realistic past clash data |

---

## 3. Navigation — Grouped Structure

Sidebar splits into three sections. Logout is a real auth action. Support routes to FAQ.

```
PLAY
  Dashboard        /
  Results          /results  (navigates to /results; ResultsScreen itself finds the latest clash — sorts pastClashes by date descending and shows the most recent entry, no ID needed in the nav link)
  Archive          /archive

COMPETE
  Standings        /standings
  Leaderboard      /leaderboard
  Hall of Fame     /hof

ME
  Profile          /player/:name  (own profile, uses currentUser.username)
  Account          /account
  Admin            /admin  (admin-only, hidden when !isAdmin)

─────────────────
[FAQ / Support]  → /faq
[Sign Out]       → supabase.auth.signOut() then navigate('/')
```

**Sidebar guest visibility:** `Sidebar.jsx` currently returns `null` for unauthenticated users. With real auth, `currentUser` starts as `null` (guest), so the sidebar would disappear entirely. Fix: guests see Play and Compete sections (Dashboard, Results, Archive, Standings, Leaderboard, Hall of Fame) but the Me section is hidden. The footer shows a "Sign In" button (opens the login modal via `setAuthScreen('login')`) instead of Sign Out. The grouped structure handles this naturally — render Me section and Sign Out only when `currentUser` is set.

**ClashScreen access:** `/clash` route is not in the sidebar. Admin reaches it via the Admin panel (`/admin`) — add a "Run Clash" button to the **dashboard tab** of AdminScreen (the first/default tab), linking to `/clash`. This keeps it out of the main nav but accessible to the one person who needs it.

---

## 4. Dashboard — Clash Card (Hybrid)

The Clash card is the centerpiece of the Dashboard. It has two zones:

**Top zone (always visible):** Player's season stats
- Season name + week number (from `seasonConfig.seasonName` + computed week)
- Player name · rank · region (from `currentUser`)
- 4 stat boxes: Season PTS, Wins, Standing (#rank by pts), Clashes played

**Bottom zone (contextual):** Changes based on `tournamentState.phase`

| Phase | Content |
|---|---|
| `idle` | "Next clash TBA" tag · "No clash scheduled yet. Check back Saturday." · Standings + Past Results buttons |
| `registration` | "Registration Open" tag · countdown to `tournamentState.clashTimestamp` · `registeredIds.length` / `maxPlayers` count · Register Now CTA + Who's In |
| `checkin` | "Check-In Open" tag · countdown to `tournamentState.clashTimestamp` · Check In Now CTA |
| `live` | Live dot tag · "Round X of Y" · Lobby box showing current user's lobby player names · Submit Results + Live Board buttons |
| `complete` | "Clash Complete" tag · top 3 result rows with pts delta · Full Results + Standings buttons |

**Countdown source:** `tournamentState.clashTimestamp` is the single source of truth for all countdowns (Dashboard card + HomeScreen). This field is set by admin when scheduling a clash via the Admin panel.

**Style:** Glass panel (`rgba(52,52,60,0.5)` + `backdrop-filter:blur(24px)`), gold primary (#E8A838/#FFC66B), teal for live (#67E2D9), purple for complete (#D9B9FF), JetBrains Mono for stats, Russo One for timer, Space Grotesk for names.

---

## 5. Seed Data — The Homies

**Strategy:** Seed data lives in `src/lib/constants.js` as the `SEED` constant. On AppContext mount, if the `players` Supabase table is empty (0 rows returned), run a one-time upsert of `SEED` rows into the `players` table using `supabase.from('players').upsert(SEED, {onConflict:'id'})`. This is idempotent — safe to re-run. Guard with a `seedApplied` ref so it only runs once per session.

| id | name | rank | region | pts | wins |
|---|---|---|---|---|---|
| 1 | Levitate | Challenger | EUW | 1024 | 16 |
| 2 | Zounderkite | Grandmaster | EUW | 896 | 13 |
| 3 | Uri | Master | EUW | 780 | 11 |
| 4 | BingBing | Master | EUW | 720 | 10 |
| 5 | Wiwi | Diamond | EUW | 610 | 8 |
| 6 | Ole | Diamond | EUW | 540 | 7 |
| 7 | Sybor | Platinum | EUW | 430 | 5 |
| 8 | Ivdim | Platinum | EUW | 380 | 4 |
| 9 | Vlad | Gold | EUW | 290 | 3 |

Filler randoms (ids 10-24) for clash lobbies: Dishsoap, k3soju, Setsuko, Mortdog, Robinsongz, Wrainbash, BunnyMuffins, Frodan, NightShark, CrystalFox, VoidWalker, StarForge, IronMask, DawnBreaker, GhostRider — all EUW, various ranks.

`PAST_CLASHES` constant: 7 entries with date (Saturday nights, weekly intervals ending ~2 weeks ago), winner (rotating homies), top 8 placements, pts awarded per EMEA scoring.

**`pastClashes` fallback wiring in AppContext:** The past clashes loader queries the `tournaments` table (AppContext line 660): `if(!res.data||!res.data.length)return;`. Change this `return` to `return setPastClashes(PAST_CLASHES);` — so when Supabase returns 0 completed tournaments, the constant fallback fires. This ensures HomeScreen stats and ResultsScreen show real-looking data on a fresh deploy.

---

## 6. Supabase Auth — Real Flow

- Remove `currentUser = {id:1, username:"Levitate"...}` hardcode from AppContext (line 140)
- `currentUser` starts as `null`; `isAuthLoading` starts as `true`
- On mount: call `supabase.auth.getSession()`:
  - If session exists: fetch player row from `players` where `auth_user_id = session.user.id`, set `currentUser`, set `isAuthLoading = false`
  - If no session: set `currentUser = null`, set `isAuthLoading = false`
- **Also delete the DEV_MOCK guard** at AppContext lines 303-305: `var DEV_MOCK=currentUser&&currentUser.email==="levitate@tftclash.gg"; if(DEV_MOCK){setIsAuthLoading(false);return function(){};}` — this block short-circuits real auth when the mock user is present. Once the mock `useState` initializer is removed, this guard evaluates to false anyway and is dead code, but it must be deleted to keep the file clean.
- **No-env-vars / mock auth fallback:** `supabase.js` falls back to noop auth when env vars are missing. `getSession()` returns null, `isAuthLoading` resolves to `false`, `currentUser = null`. App shows as logged-out guest. No dev banner needed.
- `supabase.auth.onAuthStateChange` listener: on `SIGNED_IN` fetch and set player profile; on `SIGNED_OUT` set `currentUser = null`
- Login/Signup: existing `authScreen` modal overlays — no structural change needed
- Logout: `supabase.auth.signOut()` → `setCurrentUser(null)` → `navigate('/')`

---

## 7. HomeScreen (Guest)

- Hero: "TFT Clash" title + "Weekly tournament. Every Saturday." (no cinematic tagline)
- Season pill: shows real season name from `seasonConfig.seasonName`
- Stats bar (4 boxes):
  1. **Players** — `players.length` if > 0, else "—"
  2. **Clashes Run** — `pastClashes.length` if > 0, else "—"
  3. **Season** — `seasonConfig.seasonName || "Season 1"`
  4. **Status** — "Live" with green dot ONLY when `tournamentState.phase === 'live'`, otherwise "Weekly"
- Countdown: only render `HeroCountdown` when `tournamentState.clashTimestamp` is set and `new Date(tournamentState.clashTimestamp) > new Date()`
- CTA copy: "Join the Clash" (not "Register Your Team")
- Leaderboard preview: real data from `players` sorted by pts; show Skeleton loading state while `isLoadingData === true`

---

## 8. ClashScreen

ClashScreen (`/clash`) is the full tournament engine for the admin running the weekly clash. Not in main nav — reached via Admin panel "Run Clash" link. Fixes:

- Ensure `tournament_state` Supabase realtime subscription is active (already in AppContext, verify it's not gated behind mock user)
- Result submission and dispute flows: no code changes needed, just verify they work with real Supabase data
- Lobby player name display: uses `players` array from context, looked up by player id
- `tournamentState` default phase changed to `"idle"` (see Section 2) so ClashScreen opens in idle/registration state correctly

---

## 9. Code Style Rules (Non-Negotiable)

Every file touched must comply with CLAUDE.md rules:
- `var` declarations throughout — no `const`, no `let` in new/modified code
- `function(){}` callbacks — no arrow functions
- No backtick string literals inside JS functions
- No named function components defined inside another component's body
- `supabase.js` itself uses `const`/arrow functions — **do not rewrite it**; it is a library config file exempt from the app code style rules. The rule applies to React components and app logic only.
- Tailwind CSS classes for all styling — no inline styles in new code
- Material Symbols Outlined icons (`<Icon>`) in all new/modified screens

---

## 10. Implementation Phases

**Phase 1 — Strip the Fake**
- HomeScreen: fix copy, fix stats bar, fix countdown condition, fix CTA text
- AppContext: change `tournamentState` default phase from `"registration"` to `"idle"`
- Sidebar: fix arrow functions → `var`/`function`, fix `/support`→`/faq`, `/logout`→signOut, `/clash`→`/`

**Phase 2 — Seed Real Data**
- `constants.js`: populate `SEED` with homies (ids 1-9) + randoms (ids 10-24), `HOMIES_IDS = [1,2,3,4,5,6,7,8,9]`, `PAST_CLASHES` with 7 realistic entries
- `AppContext`: add seed-on-empty logic on players load

**Phase 3 — Navigation Rebuild**
- **Rewrite `Sidebar.jsx` from scratch** (current file uses `const`/arrow functions throughout + flat 5-link array; the grouped 3-section structure + auth actions requires a full rewrite, not a patch). Use `var`/`function(){}` throughout.
- Sections: Play (Dashboard, Results, Archive) / Compete (Standings, Leaderboard, Hall of Fame) / Me (Profile, Account, Admin-only)
- Add FAQ + Sign Out footer with real `supabase.auth.signOut()` call
- Add "Run Clash" button to the dashboard tab of `AdminScreen.jsx` linking to `/clash`

**Phase 4 — Dashboard Clash Card**
- Build hybrid Clash card component in `DashboardScreen.jsx`
- All 5 states: idle, registration, checkin, live, complete
- Reads from `tournamentState` + `currentUser` + `players` via `useApp()`

**Phase 5 — Real Supabase Auth**
- AppContext: remove mock `currentUser`, wire `getSession` + `onAuthStateChange`
- Test full login → profile load → logout cycle

**Phase 6 — ClashScreen Hardening**
- Verify realtime `tournament_state` subscription works with real auth
- Smoke test result submission + dispute with real Supabase data
- Verify lobby player names render from `players` array
