# TFT Clash -- Claude Context

## Architecture

Modular React 18 SPA with Vite 5, Tailwind CSS 3, React Router 6, Supabase backend.

### Directory Structure

```
src/
  App.jsx              -- Main orchestrator (~6,900 lines, still has legacy Navbar/Footer/ClashScreen)
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
  screens/              -- All page-level components (29 files)
    HomeScreen.jsx, DashboardScreen.jsx, LoginScreen.jsx, SignUpScreen.jsx,
    StandingsScreen.jsx, LeaderboardScreen.jsx, BracketScreen.jsx,
    PlayerProfileScreen.jsx, EventsScreen.jsx, ResultsScreen.jsx,
    ClashReportScreen.jsx, HofScreen.jsx, ArchiveScreen.jsx,
    MilestonesScreen.jsx, ChallengesScreen.jsx, PricingScreen.jsx,
    SeasonRecapScreen.jsx, AccountScreen.jsx, AdminScreen.jsx,
    ScrimsScreen.jsx, HostApplyScreen.jsx, HostDashboardScreen.jsx,
    FlashTournamentScreen.jsx, TournamentDetailScreen.jsx,
    TournamentsListScreen.jsx, RulesScreen.jsx, FAQScreen.jsx,
    PrivacyScreen.jsx, TermsScreen.jsx
```

### Legacy Code in App.jsx

App.jsx still contains ~6,900 lines of legacy code not yet extracted:
- Old atom components (Panel, Btn, Inp, etc. -- duplicated in components/ui/)
- Navbar, Footer, ClashScreen, ProfileScreen, GearScreen
- Helper components (LobbyCard, PlacementBoard, Toast, etc.)
- These still use inline styles and Tabler Icons (`ti ti-*`)

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
- **Fonts:** Russo One (display), Space Grotesk (headline), Playfair Display (editorial/serif), Inter (body), Barlow Condensed (label/sans), JetBrains Mono (mono)
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

**Tiebreakers (in order):**
1. Total tournament points
2. Wins + top4s (wins count twice)
3. Most of each placement (1st, 2nd, 3rd...)
4. Most recent game finish

---

## Navigation Screens

Routes: `/`, `/login`, `/signup`, `/standings`, `/leaderboard`, `/bracket`, `/player/:name`, `/events`, `/results`, `/hall-of-fame`, `/archive`, `/milestones`, `/challenges`, `/pricing`, `/season-recap`, `/rules`, `/faq`, `/account`, `/admin`, `/scrims`, `/host/apply`, `/host/dashboard`, `/flash/:id`, `/tournament/:id`, `/privacy`, `/terms`, `/gear`

---

## Task List

See `docs/TASKS.md` for the full prioritized backlog.
See `docs/TOURNAMENT-SYSTEM.md` for tournament system details.
