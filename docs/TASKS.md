# TFT Clash — Task Backlog

> Last updated: 2026-03-11
> Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Priority 1 — Core Functionality Fixes

### [1] Bracket — Remove PIN gate, show full bracket
**File:** `App.jsx` ~L1396–1725 (`BracketScreen`)

Remove:
- `pins` state
- `pinInputs` state
- `unlockedLobbies` state
- `tryPin()` function
- Entire PIN gate JSX block (the 🔒 locked panel)
- Replace `isUnlocked` check: just always render `LobbyCard`

Keep:
- "Find My Lobby" search bar
- Admin-only submit/lock functionality
- Lobby overview/monitor tab

---

### [2] Scrims — Proper stats sheet layout
**File:** `App.jsx` ~L3224–3699 (`ScrimsScreen`)

Stats tab improvements:
- Player rows with: avg placement, win%, top4%, game count, best/worst placement
- Make it look like a proper competitive stats sheet
- Recent games sidebar: keep existing name+placement row list
- Sessions tab: no changes
- Log tab: no changes

---

## Priority 2 — Polish & Premium Feels

### [3] Results screen — Premium Grand Finalist card
**File:** `App.jsx` ~L2167–2534 (`ResultsScreen`)

- Large crown/trophy visual
- Player name in big Playfair Display
- Stats: wins, avg placement, season pts
- "Copy" / "Download PNG" button (already exists — just needs to look better)
- Gold gradient background, glowing border

---

### [4] Hall of Fame — Trophy room feel
**File:** `App.jsx` ~L2541–2743 (`HofScreen`)

- Keep "King" banner at top
- Record cards: subtle animation/glow on hover
- Make it feel like a trophy room, not a table

---

### [5] Archive — "My Position" row
**File:** `App.jsx` ~L2745–2798 (`ArchiveScreen`)

If logged in, show at the bottom of each clash card:
- `"Your finish: #5 · +14 pts"` — or —
- `"You didn't participate"`

Subtle, small text row. No design overhaul needed.

---

## Priority 3 — Features

### [6] Achievements/Milestones — Make them real
**File:** `App.jsx` ~L3865–4072 (`MilestonesScreen`)

- TFT-flavored names (e.g. "Augment God — Won 3 clashes in a row", "Top 4 Machine — 10 consecutive top4s")
- Tiered: Bronze / Silver / Gold / Legendary
- Show unlock animation on profile
- Competitive, not participation-trophy vibes

---

### [7] Account Screen — Full player card rebuild
**File:** `App.jsx` ~L4280–4459 (`AccountScreen`)

Replace bland settings page with:
- Stats block: avg placement, win rate, top4 rate, season rank, clash history
- Career sparkline: pts over time graph
- Badges/achievements strip
- Edit profile (username, bio, Riot ID) — move to bottom

---

### [8] Leaderboard — Search + jump to self
**File:** `App.jsx` ~L1994–2165 (`LeaderboardScreen`)

- Search/filter bar at top
- "Jump to my position" button for logged-in users (highlights their row)

---

## Priority 4 — Production Readiness

### [9] Points system — Verify EMEA rulebook match
**File:** `App.jsx` ~L1–50 (`PTS` constant)

Confirm or update `PTS` constant to: `{1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`
Also wire tiebreaker logic to match official order (see `CLAUDE.md`).

---

### [10] Production checklist
See `docs/PRODUCTION.md` for full deploy checklist.

---

## Completed Since Handoff

- [x] Rules screen — 5 tabs: Format, Points & Tiebreakers, Check-in, Edge Cases, Code of Conduct (sourced from EMEA rulebook)
- [x] FAQ screen — 6 categories, accordion Q&A, cross-linked to Rules and Pricing
- [x] Both added to desktop nav + mobile drawer
- [x] `docs/TOURNAMENT-SYSTEM.md` — comprehensive tournament operations reference doc

## Completed This Session (v22 → v23)

- [x] Seed data — 24 players, 3 lobbies, homies correctly placed
- [x] Past clashes + HOF — homies names, Levitate is season champion
- [x] Home screen right panel — auth gate (logged-in vs logged-out states)
- [x] Champion → account spacing (28px div)
- [x] Fantasy TFT removed from nav + root render
- [x] "Become a Host" button removed from player profiles
- [x] Back buttons verified on PlayerProfileScreen
