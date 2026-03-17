# TFT Clash — Task Backlog

> Last updated: 2026-03-16
> Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Priority 1 — Core Functionality

### [x] #1 — Bracket: Remove PIN gate
**File:** `App.jsx` ~L1396–1725 (`BracketScreen`)

Remove:
- `pins` state
- `pinInputs` state
- `unlockedLobbies` state
- `tryPin()` function
- Entire PIN gate JSX block (the 🔒 locked panel)
- Replace any `isUnlocked` check with `true` — always show `LobbyCard`

Keep:
- "Find My Lobby" search bar
- Admin-only submit/lock functionality
- Lobby overview/monitor tab

---

### [x] #2 — Scrims: Proper stats sheet
**File:** `App.jsx` ~L3224–3699 (`ScrimsScreen`)

Stats tab only:
- Player rows with: avg placement, win%, top4%, game count, best/worst placement
- Look like a real competitive stats sheet
- Recent games sidebar: keep existing name+placement row list
- Sessions tab: no changes
- Log tab: no changes

---

## Priority 2 — Polish & Premium Feels

### [x] #3 — Results: Premium Grand Finalist card
**File:** `App.jsx` ~L2167–2534 (`ResultsScreen`)

- Large crown/trophy visual
- Player name in big Playfair Display font
- Stats: wins, avg placement, season pts
- "Copy" / "Download PNG" button — already exists, just needs better styling
- Gold gradient background, glowing border

---

### [x] #4 — Hall of Fame: Trophy room feel
**File:** `App.jsx` ~L2541–2743 (`HofScreen`)

- Keep "King" banner at top — it's good
- Record cards: subtle animation/glow on hover
- Feel like a trophy room, not a flat table

---

### [x] #5 — Archive: "My Position" row
**File:** `App.jsx` ~L2745–2798 (`ArchiveScreen`)

For logged-in users, show at the bottom of each clash card:
- `"Your finish: #5 · +14 pts"` — or —
- `"You didn't participate"`

Subtle small text. No design overhaul needed.

---

## Priority 3 — Features

### [x] #6 — Achievements: Real tiers
**File:** `App.jsx` ~L3865–4072 (`MilestonesScreen`)

- TFT-flavored names: "Augment God — Won 3 clashes in a row", "Top 4 Machine — 10 consecutive top4s"
- Tiered: Bronze / Silver / Gold / Legendary
- Show unlock animation on profile
- Competitive, not participation-trophy vibes

---

### [x] #7 — Account Screen: Full player card rebuild
**File:** `App.jsx` ~L4280–4459 (`AccountScreen`)

Replace bland settings page with:
- Stats block: avg placement, win rate, top4 rate, season rank, clash history
- Career sparkline: pts over time graph
- Badges/achievements strip
- Edit profile (username, bio, Riot ID) — move to bottom

---

### [x] #8 — Leaderboard: Search + jump to self
**File:** `App.jsx` ~L1994–2165 (`LeaderboardScreen`)

- Search/filter bar at top
- "Jump to my position" button for logged-in users (highlights their row)

---

## Priority 4 — Production Readiness

### [x] #9 — Points system: Verify PTS constant
**File:** `App.jsx` ~L1–50 (`PTS` constant)

Confirm or fix `PTS` constant = `{1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1}`
The RulesScreen already displays these correctly — make sure the actual scoring logic matches.
Also verify tiebreaker logic in stats engine matches official order (see `CLAUDE.md`).

---

### [x] #10 — Production deploy
See `docs/PRODUCTION.md` for full checklist.
Key blockers: real auth (Supabase/Firebase), DB for results, Stripe for subscriptions.

---

### [x] #11 — FAQ: Update content to reflect actual score submission flow
**File:** `App.jsx` ~L5568 (`FAQScreen`)

The current FAQ says players screenshot and submit to admin via Discord. Update to reflect that:
- Results are entered directly on the bracket/lobby page (no screenshots)
- Players fill in placements on the site themselves (or admin does)
- Remove/update references to "screenshot obligation" and Discord submission
- Also update the relevant bullet in RulesScreen > Format > "Result Submission" panel

---

## Completed

### Session 2 — 2026-03-12
- [x] **RulesScreen** — 5 tabs (Format, Points & Tiebreakers, Check-in, Edge Cases, Conduct) sourced from official 2026 EMEA Esports rulebook PDF
- [x] **FAQScreen** — 6 categories, 24 questions, accordion Q&A, cross-linked to Rules and Pricing
- [x] Both screens added to desktop nav + mobile drawer + root render
- [x] `docs/TOURNAMENT-SYSTEM.md` — comprehensive tournament operations reference
- [x] `docs/DESIGN.md`, `docs/PRODUCTION.md`, `docs/TASKS.md`, `CLAUDE.md` — full project docs structure
- [x] Pushed to GitHub `ce9f365`, deployed to Vercel

### Session 1 — prior
- [x] Seed data — 24 players, 3 lobbies, homies correctly placed
- [x] Past clashes + HOF — homies names, Levitate is season champion
- [x] Home screen right panel — auth gate (logged-in vs logged-out states)
- [x] Champion → account spacing (28px div)
- [x] Fantasy TFT removed from nav + root render
- [x] "Become a Host" button removed from player profiles
- [x] Back buttons verified on PlayerProfileScreen

---

## Phase 3 — Tournament Runner

### [x] #12 — Registration System
Register/unregister button on HomeScreen. registeredIds persists in tournamentState, carried over on check-in. registerFromAccount() creates player + adds to registeredIds. DB table `registrations` migration exists.
**Status:** Done — front-end flow complete, DB migration ready

### [x] #13 — Multi-Game Round Flow
Round progression, per-game result entry, Finalize Clash flow. Fixed: tournament_id now uses clashId (was hardcoded 0). Lobbies now persist in tournamentState.savedLobbies so page refresh doesn't lose them. Anti-stack seeding implemented.
**Status:** Done

### [x] #14 — Live Standings During Clash
LiveStandingsPanel shows cumulative points during inprogress phase, sorted by earned points. Displays after at least one lobby is locked.
**Status:** Done — was already implemented

### [x] #15 — Lobby Builder Seeding UI
4 seeding algorithms: random, rank-based, snake, anti-stack. Visual toggle in AdminPanel. Lobbies persist across page refresh via savedLobbies in tournamentState.
**Status:** Done

---

## Phase — Database Foundation (NEW — 2026-03-17)

### [x] #24 — DATA_VERSION cache buster
Clear stale localStorage on version mismatch. Kills old hardcoded friend data.
**Status:** Done

### [x] #25 — Remove hardcoded SEASON_CHAMPION
Was hardcoded as Levitate with fake stats. Now computed dynamically from live standings. Shows null (no champion) when no one has real points.
**Status:** Done

### [x] #26 — SQL Migrations
Created formal migrations for: `players` (001), `registrations` (002), `lobbies` (003), `game_results` (004), `tournaments` fields (005), `site_settings` JSONB upgrade (006).
**Status:** Done — migrations written, need to apply to Supabase

### [x] #27 — Error handling on all Supabase operations
Replaced 15+ silent `.then(function(){})` with error logging. Added try/catch to critical operations.
**Status:** Done

### [x] #28 — JSONB compatibility
Updated site_settings readers (mount + realtime) to handle both TEXT and JSONB column types.
**Status:** Done

### [x] #29 — Reset buttons fixed
"Reset Season Stats" and "Full Season Reset" now clear clashHistory, sparkline, attendanceStreak, and all accumulated stats. Syncs to Supabase.
**Status:** Done

---

## Phase 4 — UI Polish

### [x] #16 — Loading State
Spinner overlay when Supabase is loading and players array is empty.
**Status:** Already implemented

### [x] #17 — Empty States
Proper empty state messaging for ArchiveScreen, HofScreen, and LeaderboardScreen.
**Status:** Done — added empty state to leaderboard season tab

### [x] #18 — Mobile Responsiveness Audit
Added 480px/375px breakpoints: grid-home gap reduction, challenges grid column shrink, standings table minWidth reset, lab tabs/grids collapse to single column. Tables with overflowX:auto handle horizontal scroll correctly on mobile.
**Status:** Done

### [x] #19 — Form Validation UX
Inline validation on signup/login forms, Riot ID format check.
**Status:** Already implemented (isValidRiotId, riotIdErr inline display)

---

## Phase 5 — Post-Reset Cleanup

### [x] #30 — Roster still shows old names after reset
Full Season Reset now clears roster entirely (setPlayers([])), not just zeroing stats. Separate "Reset Season Stats" button still exists for zeroing stats while keeping players. "Clear All Players" button also available.
**Status:** Done

### [x] #31 — Achievement/reward badges still showing after reset
Verified: all achievement/milestone checks are dynamic (computed from current stats). With stats zeroed or players cleared, badges correctly disappear. Was likely a display cache issue resolved by DATA_VERSION bump.
**Status:** Done — no code change needed, was already correct

### [x] #32 — Bracket empty after reset
Bracket now shows phase-aware empty state: "No Active Tournament" (registration), "Waiting for Players" (inprogress), "Tournament Complete" (complete, with link to Results).
**Status:** Done

### [x] #33 — Clean up hardcoded FEATURED_EVENTS
FEATURED_EVENTS constant is now empty array. Events are DB-driven via site_settings. FeaturedScreen shows friendly empty state when no events exist. Full Season Reset also clears featured events.
**Status:** Done

---

## Phase 6 — Features

### [x] #20 — Player Comparison Tool
LeaderboardScreen: select 2-3 players via cards/stats tabs, comparison panel shows Season Points, Avg, Wins, Top4%, Win%, Games with gold highlight for best. Clear button to reset.
**Status:** Done — already implemented

### [x] #21 — Streak Records Display
Streaks tab on LeaderboardScreen (best streak, current streak, comeback%, clutch%). Hot/cold streak icons on StandingsTable rows. Career streak display on PlayerProfileScreen overview.
**Status:** Done — already implemented

### [x] #22 — Export / Share Card
downloadStatsCard() on PlayerProfileScreen generates 600x340 PNG with player name, rank, region, 6 stat boxes. Exported as {name}-stats.png.
**Status:** Done — already implemented

---

## Phase 7 — Monetization

### [ ] #23 — Stripe Integration
Stripe Checkout for Pro/Host tiers, webhook handler, subscription gate.
**Status:** TODO
