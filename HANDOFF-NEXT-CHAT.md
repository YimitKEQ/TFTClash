# TFT Clash — Handoff for Next Chat

> Last updated: 2026-03-12
> Git: `ce9f365` on `master` — deployed to Vercel

---

## Working File

`src/App.jsx` — single-file React app. **5764 lines, brace balance = 0.**

No more version numbering (v22, v23-WIP etc.) — `src/App.jsx` is always the working file.
Claude Code has direct file access — no need to upload the file.

---

## How to Start Next Chat

Open the project folder in Claude Code and say:
> "Continue building TFT Clash. Check CLAUDE.md and docs/TASKS.md, then start with task #1 (bracket PIN removal)."

Claude will read `CLAUDE.md` automatically. All context is in the docs.

---

## Product Identity (LOCKED)

- **Platform:** TFT Clash — weekly clashes, season, community platform
- **Tiers:** Player (free) / Pro ($4.99/mo) / Host ($19.99/mo)
- **Free to compete always** — no paywall on entry
- Dark theme: bg `#08080F`, panels `#111827`, accent purple `#9B72CF`, gold `#E8A838`, teal `#4ECDC4`
- Fonts: Playfair Display (headings), Barlow Condensed (labels), system mono

---

## CRITICAL TECHNICAL RULES

1. **NEVER use IIFEs `{(()=>{...})()}` directly in JSX** — Babel renderer crashes
2. **GCSS block (~lines 305–403) is a template literal** — do NOT convert or touch structure
3. **Brace balance must stay at 0** after every edit — verify with Python: `content.count('{') - content.count('}')`
4. **No backtick string literals inside JS functions**
5. **No named function components defined inside another component's body**
6. For multi-part edits use careful sequential str_replace or Python scripts
7. Run `npm run build` after significant edits to catch JSX errors early

---

## What Was Done This Session (2026-03-12)

### ✅ COMPLETED
1. **Project structure** — `CLAUDE.md`, `docs/TASKS.md`, `docs/DESIGN.md`, `docs/PRODUCTION.md`, `docs/TOURNAMENT-SYSTEM.md` all created
2. **Tournament research** — deep-dive into AEGIS, CompeteTFT, Northern Legends, official EMEA rulebook (PDF read in full). All findings in `docs/TOURNAMENT-SYSTEM.md`
3. **RulesScreen** — new screen (`screen==="rules"`), 5 tabs:
   - Format: clash format, snake-draft seeding with visual example, multi-stage, Swiss reseeding, result submission
   - Points & Ties: official 1st=8 → 8th=1 table, DNP explanation, 5-step tiebreaker chain
   - Check-in: registration vs check-in, T-60min → T-0 timeline, auto-drop, waitlist, grace period
   - Edge Cases: lobby of 7/6, BYEs, no-show scenarios, disconnect rules, pause limits
   - Conduct: 7 rules, disciplinary action escalation
4. **FAQScreen** — new screen (`screen==="faq"`), accordion Q&A, 6 categories, 24 questions total
5. **Navbar updated** — both screens added to desktop nav and mobile drawer
6. **Pushed to GitHub** — commit `ce9f365`, auto-deployed to Vercel

---

## REMAINING TASKS (pick up here)

See `docs/TASKS.md` for full detail. Priority order:

### #1 — Bracket: Remove PIN gate ← START HERE
**File:** `App.jsx` ~L1396–1725 (`BracketScreen`)

Remove: `pins`, `pinInputs`, `unlockedLobbies` state, `tryPin()` function, the entire 🔒 locked panel JSX block.
Replace any `isUnlocked` check with `true` — always show `LobbyCard`.
Keep: "Find My Lobby" search bar, admin submit/lock, lobby overview tab.

### #2 — Scrims: Proper stats sheet
**File:** `App.jsx` ~L3224–3699 (`ScrimsScreen`)

Stats tab: player rows with avg placement, win%, top4%, game count, best/worst placement. Sessions/Log tabs: leave alone.

### #3 — Results: Premium Grand Finalist card
**File:** `App.jsx` ~L2167–2534 (`ResultsScreen`)

Trophy card: large crown, Playfair Display name, stats block, gold gradient + glowing border. Improve existing Download PNG button styling.

### #4 — Hall of Fame: Trophy room feel
**File:** `App.jsx` ~L2541–2743 (`HofScreen`)

Keep King banner. Add hover glow/animation on record cards. Make it feel like a trophy room.

### #5 — Archive: "My Position" row
**File:** `App.jsx` ~L2745–2798 (`ArchiveScreen`)

If logged in: show `"Your finish: #5 · +14 pts"` or `"You didn't participate"` at bottom of each clash card.

### #6 — Achievements: Real tiers
**File:** `App.jsx` ~L3865–4072 (`MilestonesScreen`)

TFT-flavored, tiered (Bronze/Silver/Gold/Legendary), unlock animation. Competitive not participation-trophy.

### #7 — Account Screen: Player card rebuild
**File:** `App.jsx` ~L4280–4459 (`AccountScreen`)

Stats block (avg placement, win rate, top4 rate, season rank), career sparkline, badges strip. Edit profile moves to bottom.

### #8 — Leaderboard: Search + jump to self
**File:** `App.jsx` ~L1994–2165 (`LeaderboardScreen`)

Search/filter bar + "Jump to my position" button for logged-in users.

### #9 — Points system: Verify PTS constant
**File:** `App.jsx` ~L1–50

Confirm `PTS` constant = `{1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1}`. The Rules screen already displays these correctly — just make sure the actual scoring logic matches.

---

## File Structure (App.jsx — ~5764 lines)

| Lines | Section |
|-------|---------|
| 1–170 | Constants, helpers, stats engine, PTS constant |
| 116–131 | Achievements |
| 172–233 | SEED data (24 players) |
| 234–403 | Auth, champion system, **GCSS** (template literal — don't touch) |
| 404–963 | Atoms + components (Hexbg, Panel, Btn, Av, etc.) |
| 965–1134 | Navbar |
| 1135–1194 | StandingsTable |
| 1195–1394 | HomeScreen |
| 1396–1725 | **BracketScreen** ← task #1 |
| 1731–1993 | PlayerProfileScreen |
| 1994–2165 | **LeaderboardScreen** ← task #8 |
| 2167–2534 | ClashReport, **ResultsScreen** ← task #3, AutoLogin |
| 2541–2743 | **HofScreen** ← task #4 |
| 2745–2798 | **ArchiveScreen** ← task #5 |
| 2800–3222 | AdminPanel |
| 3224–3699 | **ScrimsScreen** ← task #2 |
| 3700–3864 | PricingScreen |
| 3865–4072 | **MilestonesScreen**, ChallengesScreen ← task #6 |
| 4074–4279 | SignUpScreen, LoginScreen |
| 4280–4459 | **AccountScreen** ← task #7 |
| 4460–4603 | SeasonRecapScreen |
| 4605–4679 | AICommentaryPanel |
| 4680–5074 | HostApplyScreen, HostDashboardScreen |
| 5075–5340 | **RulesScreen** ← added this session |
| 5341–5490 | **FAQScreen** ← added this session |
| 5491–5764 | Root TFTClash() component |

---

## Navigation Screens

`home | roster | bracket | leaderboard | results | archive | rules | faq | pricing`
Drawer: `hof | archive | rules | faq | challenges | milestones | pricing | account`
Admin only: `scrims | admin`

---

## Player Roster (SEED)

**Homies:** Levitate, Zounderkite, Uri, BingBing, Wiwi, Ole, Sybor, Ivdim, Vlad
**Excluded (never re-add):** Denial, Max, Ribenardo
**Randoms (filler):** Dishsoap, k3soju, Setsuko, Mortdog, Robinsongz, Wrainbash, BunnyMuffins, Frodan, NightShark, CrystalFox, VoidWalker, StarForge, IronMask, DawnBreaker, GhostRider

**Levitate = the user, season champion**
- id: 1, rank: Challenger, 1024 pts, 16 wins, `SEASON_CHAMPION` constant

---

## Points System (Official EMEA Rulebook 2026)

| Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-------|---|---|---|---|---|---|---|---|
| Pts   | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

DNP (no-show) = 0 pts (worse than 8th place).

**Tiebreakers:** Total pts → wins+top4s (wins×2) → placement counts (1st→2nd→…) → most recent game → random.

---

## Docs Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Auto-loaded by Claude Code — critical rules, player roster, file map |
| `docs/TASKS.md` | Full prioritized backlog with file locations |
| `docs/DESIGN.md` | Colors, fonts, component conventions |
| `docs/PRODUCTION.md` | What needs to be done before going live |
| `docs/TOURNAMENT-SYSTEM.md` | Tournament operations deep-dive (formats, check-in, edge cases, what to build) |
