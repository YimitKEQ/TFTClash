# TFT Clash -- Claude Context

## Architecture

Modular React 18 SPA with Vite 5, Tailwind CSS 3, React Router 6, Supabase backend.

### Directory Structure

```
src/
  App.jsx              -- Router + route table + ErrorBoundary/ScreenBoundary + auth screens (~844 lines; legacy fully extracted)
  main.jsx             -- Entry point
  index.css            -- Tailwind directives + base styles
  context/
    AppContext.jsx      -- Global state provider (useApp hook)
  lib/
    constants.js        -- RANKS, REGIONS, PTS, etc.
    utils.js            -- sanitize, rc, tier, avgCol, ordinal, etc.
    stats.js            -- computeStats, tiebreaker, achievements, etc.
    tournament.js       -- TOURNAMENT_FORMATS, buildLobbies, phases, etc.
    tiers.js            -- getUserTier, hasFeature
    supabase.js         -- Supabase client
    notifications.js    -- writeActivityEvent, createNotification
  components/
    ui/                 -- Shared UI primitives (Panel, Btn, Inp, Icon, Tag, Badge, etc.)
    layout/
      PageLayout.jsx    -- Standard page wrapper with sidebar
      Sidebar.jsx       -- Navigation sidebar
    shared/
      CountdownTimer.jsx
      RankBadge.jsx
  screens/              -- All page-level components (~85 files incl subdirs)
    Tournament-critical: BracketScreen.jsx (live clash control), ClashScreen.jsx,
    FlashTournamentScreen.jsx, HostDashboardScreen.jsx, admin/ (OverviewTab,
    TournamentTab, ResultsTab, PlayersTab, TeamsTab, SponsorsTab, AuditTab,
    SettingsTab, HostsTab), ops/ (CommandCenterScreen + OpsTournaments/OpsRevenue/...).
    Player-facing: HomeScreen, DashboardScreen, EventsScreen, StandingsScreen,
    LeaderboardScreen, PlayerProfileScreen, ResultsScreen, AccountScreen, TeamsScreen,
    TeamProfileScreen, Login/SignUp, plus Hof/Archive/Milestones/Challenges/Pricing/
    SeasonRecap/Rules/FAQ/Privacy/Terms/News/Scrims/sim and more.
```

### App.jsx is fully extracted (2026-06)

App.jsx is now ~844 lines: route table, the lazyWithRetry registry, ErrorBoundary +
per-screen ScreenBoundary, and the fullscreen auth screens. The old legacy block
(Navbar/Footer/ClashScreen/atoms/Tabler icons) has been extracted to components/ and
screens/. Treat App.jsx as the router/shell only.

---

## CRITICAL TECHNICAL RULES

1. **Code style:** Use `var` declarations, `function(){}` callbacks -- no arrow functions, no IIFEs in JSX
2. **No backtick string literals inside JS functions**
3. **No named function components defined inside another component's body**
4. **All new/migrated screens:** Use Tailwind CSS classes, `useApp()` for state, `<Icon>` for Material Symbols
5. **Sel component:** Not in shared UI library -- define locally in screens that need `<select>` wrappers

---

## Product Identity (LOCKED)

- **Platform:** TFT Clash -- weekly clashes, season, community platform
- **Tiers:** Player (free) / Pro ($4.99/mo) / Host ($19.99/mo)
- **Free to compete always** -- no paywall on entry
- **Theme:** Dark -- MD3 tokens via Tailwind (surface, primary, secondary, tertiary, error, success)
- **Fonts (4-token scale):** Russo One (`font-display` -- hero numbers, champ names, page titles, all-caps brand), Inter (`font-body` -- prose), Barlow Condensed (`font-label` -- uppercase eyebrows/tags/buttons), JetBrains Mono (`font-mono` -- numerics, IDs). `font-editorial` is DEPRECATED (no cursive/italic headlines) -- use `font-display` for titles. No `font-headline`/`font-serif`/`font-sans` aliases.
- **Icons:** Google Material Symbols Outlined via `<Icon>` component (Tabler migration complete)

---

## Player Roster (SEED DATA)

**Homies (use everywhere):** Levitate, Zounderkite, Uri, BingBing, Wiwi, Ole, Sybor, Ivdim, Vlad
**Excluded by request:** Denial, Max, Ribenardo -- never add these back
**Randoms (filler):** Dishsoap, k3soju, Setsuko, Mortdog, Robinsongz, Wrainbash, BunnyMuffins, Frodan, NightShark, CrystalFox, VoidWalker, StarForge, IronMask, DawnBreaker, GhostRider

**Levitate = the user, season champion**
- id: 1, rank: Challenger, 1024 pts, 16 wins

---

## Points System (Official EMEA Rulebook)

| Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-------|---|---|---|---|---|---|---|---|
| Pts   | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

`PTS` constant: `{1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`

**Two tiebreaker chains (do not conflate):**

*In-tournament eliminations / final clash standings* (`lib/tournament.js`:
`computeFlashStandings`, `computeTournamentStandings`) -- spec Section 5.2/8.9:
1. Total tournament points
2. Most Top 4 finishes
3. Fewest Bot 3s (6th/7th/8th)
4. Most 1st place finishes
5. Best placement in the most recent game

*Season-long cumulative leaderboard* (`lib/stats.js`:`tiebreaker`) -- locked EMEA chain:
1. Total season points
2. Wins x2 + top4s
3. Most of each placement (1st, 2nd, 3rd...)
4. Most recent finish

The spec governs how a single clash resolves ties for cuts/winner; the EMEA chain
governs the season standings/leaderboard. Player-facing Rules/FAQ describe the
in-tournament chain (`RULES_SECTIONS`, `FAQ_DATA`, `RulesScreen.TIEBREAKER_ITEMS`).

**Elimination formats** (`cutMode` on tournament state):
- `threshold` (default): single points-cut after game N (`applyCutLine`).
- `ladder`: no cuts G1-G2, then cut 8 per game to a Top-8 finals
  (`ladderSchedule`/`applyLadderCut`, spec Section 4.4/8.8). Canonical 64p/128p
  schedules in `LADDER_SCHEDULES`; selectable in the admin clash setup.

**Finals mode** (`finalsMode` on tournament state, default `standard`):
- `checkmate`: opt-in Top-8 finals. The final lobby keeps playing past the
  nominal game count until a player WINS a game while at/over `finalsThreshold`
  (default 20) in finals points - first to clinch is champion, pinned to 1st.
  Engine: `checkCheckmateWinner`/`checkmateProgress` in `lib/tournament.js`
  (unit-tested). Admin selector in `TournamentTab` (Finals Mode + threshold);
  live detection/banner/extend-finals/crown in `BracketScreen`. Standard clashes
  are completely unaffected.

**Soft bans** (migration 114, spec Section 2.6/8.10): `soft_bans` table + a
registration trigger that forces a soft-banned player onto the waitlist for their
next tournament, auto-lifting after they sit one out. Admin UI in `PlayersTab`;
Discord `/softban add|remove|list` (staff-only).

Unit tests for the scoring/tiebreaker/ladder engine: `npm run test:unit`
(`src/lib/__tests__/tournament.test.js`, Node built-in runner, no deps).

---

## Navigation Screens

Routes: `/`, `/login`, `/signup`, `/standings`, `/leaderboard`, `/bracket`, `/player/:name`, `/events`, `/results`, `/hall-of-fame`, `/archive`, `/milestones`, `/challenges`, `/pricing`, `/season-recap`, `/rules`, `/faq`, `/account`, `/admin`, `/scrims`, `/host/apply`, `/host/dashboard`, `/flash/:id`, `/tournament/:id`, `/privacy`, `/terms`, `/gear`

---

## Task List

See `docs/TASKS.md` for the full prioritized backlog.
See `docs/TOURNAMENT-SYSTEM.md` for tournament system details.

---

## Knowledge Graph (graphify)

A graphify knowledge graph of `src/` lives in `graphify-out/` (graph.json, graph.html,
GRAPH_REPORT.md). Built 2026-06-02 from 243 code files -> 1401 nodes, 3028 edges,
77 communities. For codebase questions ("how does X work", "what calls Y"), run
`python -m graphify query "<question>"` before grepping. After code changes, refresh
with `python -m graphify update src` (AST-only, no LLM cost for code files). The
canonical graph lives at the repo-root `graphify-out/`; if a CLI version writes to
`src/graphify-out/`, sync `graph.json`/`graph.html`/`GRAPH_REPORT.md` back to the root.

---

## gstack

gstack is installed (prefixed mode) at `~/.claude/skills/gstack`. Use these for AI-assisted dev:

**Planning & forcing-question gates (run BEFORE coding):**
`/gstack-office-hours` `/gstack-plan-ceo-review` `/gstack-plan-eng-review` `/gstack-plan-design-review` `/gstack-plan-devex-review` `/gstack-autoplan`

**Design system + mockup generation:**
`/gstack-design-consultation` `/gstack-design-shotgun` `/gstack-design-html` `/gstack-design-review`

**Code review, debugging, security:**
`/gstack-review` `/gstack-investigate` `/gstack-cso` `/gstack-codex`

**Live browser QA + dogfooding (preferred over playwright/MCP browser):**
`/gstack-browse` `/gstack-qa` `/gstack-qa-only` `/gstack-pair-agent` `/gstack-open-gstack-browser`

**Release + ops:**
`/gstack-ship` `/gstack-land-and-deploy` `/gstack-canary` `/gstack-benchmark` `/gstack-document-release` `/gstack-retro`

**Safety guardrails:**
`/gstack-careful` `/gstack-freeze` `/gstack-guard` `/gstack-unfreeze`

**Memory + utility:**
`/gstack-learn` `/gstack-context-save` `/gstack-context-restore` `/gstack-health` `/gstack-upgrade`

Use `/gstack-browse` for all web browsing. Do not use `mcp__claude-in-chrome__*` tools.

---

## Related repositories

The BrosephTech / BaronTactics accountability bot used to live here as `bt-bot/`.
It was extracted on 2026-08-21 into its own repo, `Baron-Tactics/barontactics-bot`
(private), with its full history, and removed from this repo so there is one source
of truth. Local clone: `D:\dev\barontactics\bt-bot`. It commits under a different
git identity (see `~/.gitconfig` includeIf) and pushes via the `github.com-bt` SSH
alias. `deploy.ps1 baron` now packs from that repo.

The TFT Clash Discord bot (`discord-bot/`) is unaffected and still lives here.
