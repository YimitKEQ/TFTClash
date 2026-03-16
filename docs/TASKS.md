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

### [ ] #12 — Registration System
Add register/unregister button to HomeScreen when phase === "registration". Store registeredIds in tournamentState. Admin can promote registered → checked-in.
**Status:** Partially implemented (registeredIds added to state, UI in HomeScreen)

### [ ] #13 — Multi-Game Round Flow
Round progression in BracketScreen: round indicator, "End Round" button, "Complete Tournament" button.
**Status:** In progress

### [ ] #14 — Live Standings During Clash
Show cumulative points table in BracketScreen when phase === "inprogress".
**Status:** In progress

### [ ] #15 — Lobby Builder Seeding UI
Better seeding option picker in AdminPanel with visual toggle buttons.
**Status:** In progress

---

## Phase 4 — UI Polish

### [ ] #16 — Loading State
Spinner overlay when Supabase is loading and players array is empty.
**Status:** Implemented

### [ ] #17 — Empty States
Proper empty state messaging for ArchiveScreen and HofScreen.
**Status:** Implemented

### [ ] #18 — Mobile Responsiveness Audit
Test at 375px/390px/414px. Fix tables, navbar, bracket screen.
**Status:** TODO

### [ ] #19 — Form Validation UX
Inline validation on signup/login forms, Riot ID format check.
**Status:** TODO

---

## Phase 6 — Features

### [ ] #20 — Player Comparison Tool
Select 2-3 players → side-by-side stats.
**Status:** TODO

### [ ] #21 — Streak Records Display
Hot/cold streaks visible on leaderboard and profile.
**Status:** TODO

### [ ] #22 — Export / Share Card
"Share my stats" PNG card generator.
**Status:** TODO

---

## Phase 7 — Monetization

### [ ] #23 — Stripe Integration
Stripe Checkout for Pro/Host tiers, webhook handler, subscription gate.
**Status:** TODO
