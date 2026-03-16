# TFT Clash — Master Plan

> Generated: 2026-03-16 | Status: READY TO EXECUTE
> Goal: Ship a production-ready tournament platform

---

## Current State Assessment

**What's done:** All 11 original tasks complete. Auth wired (Supabase email + Discord OAuth). Discord bot built. 6 Playwright E2E test suites. Deployed to Vercel. Security headers. SEO tags.

**What's broken or incomplete:**
- App.jsx is a 15,500-line monolith (should be ~30 files)
- Data layer still uses localStorage/SEED — Supabase reads not wired
- Empty arrays: `SEED`, `PAST_CLASHES`, `HOF_RECORDS`, `RETIRED_LEGENDS`, `NOTIF_SEED`, `SPONSORS`
- ArchiveScreen is a stub with no real data
- No URL routing (browser back/forward broken)
- No memoization anywhere (performance issues on re-render)
- Admin panel writes to local state only, not Supabase
- No Stripe integration
- No error tracking (Sentry)
- Discord bot not committed to repo
- `MOCK_ACCOUNTS` and `mkHistory()` are dead code

---

## Execution Phases

### PHASE 1 — DATA LAYER (Priority: CRITICAL)
*Nothing works for real without this*

| # | Task | Details |
|---|------|---------|
| 1.1 | **Wire Supabase player reads** | `useEffect` in `TFTClash()` to load players from `players` table. Keep SEED as fallback. Map DB columns → app shape (`season_pts→pts`, `avg_placement→avg`, `username→name`). |
| 1.2 | **Wire Supabase tournament state** | Load `tournamentState` from `site_settings` on mount. Subscribe to realtime changes. Write back on admin actions. |
| 1.3 | **Admin dual-write** | Every admin action (add player, edit stats, start tournament, enter placements) must write to both local state AND Supabase. |
| 1.4 | **Persist clash results to DB** | When admin submits placements, write to `lobby_players` and `tournament_results` tables. Leaderboard/standings pull from DB. |
| 1.5 | **Populate PAST_CLASHES from DB** | Query `tournaments` + `tournament_results` to build archive data. ArchiveScreen becomes functional. |
| 1.6 | **Populate HOF from DB** | Query season winners from `tournament_results` grouped by season. HofScreen shows real champions. |

**Estimated effort:** 2-3 sessions

---

### PHASE 2 — URL ROUTING & NAVIGATION (Priority: HIGH)
*Users can't share links or use browser back button*

| # | Task | Details |
|---|------|---------|
| 2.1 | **Hash-based routing** | Map `screen` state to URL hash (`#standings`, `#bracket`, `#profile/Levitate`). On load, read hash → set screen. On screen change, update hash. |
| 2.2 | **Browser history integration** | `popstate` listener for back/forward. Push state on navigation. |
| 2.3 | **Deep links** | Support `#profile/:name`, `#clash/:id`, `#leaderboard`. Share-friendly URLs. |
| 2.4 | **404 fallback** | Unknown hashes → redirect to home. |

**Estimated effort:** 1 session

---

### PHASE 3 — TOURNAMENT RUNNER (Priority: HIGH)
*The core product loop — running a clash end-to-end*

| # | Task | Details |
|---|------|---------|
| 3.1 | **Registration system** | Registration window with open/close timestamps. "Register" button on HomeScreen. Status badges: Registered / Checked In / Waitlisted / Dropped. Cap at 24 (configurable). Waitlist auto-promote when spots open. |
| 3.2 | **Check-in flow** | Check-in window opens 60min before start. Countdown timer. Auto-drop no-shows at T-15min. Waitlist players promoted. Clear visual state per player. |
| 3.3 | **Lobby builder** | Admin "Generate Lobbies" button with seeding options (rank/snake/random). Handle uneven numbers (lobbies of 7 are fine). Designate lobby host. Show lobby code per player. Manual drag-drop override. |
| 3.4 | **Multi-game flow** | Support 3-5 games per clash. After each game: enter placements → auto-calc points → update live standings → next game. Round indicator in bracket view. |
| 3.5 | **DNP & DQ handling** | Admin marks DNP (0 pts, worse than 8th). After 2 DNPs → prompt DQ. DQ badge in standings. |
| 3.6 | **Live standings between games** | After each game, standings update in real-time. Show point deltas (+8, +5, etc.). Highlight position changes. |
| 3.7 | **Tournament completion** | Auto-detect when all games done. Generate ClashReport. Write final results to DB. Update season standings. Trigger confetti + champion announcement. |

**Estimated effort:** 3-4 sessions

---

### PHASE 4 — UI/UX IMPROVEMENTS (Priority: MEDIUM-HIGH)
*Polish that makes it feel like a real product*

| # | Task | Details |
|---|------|---------|
| 4.1 | **Loading states** | Add skeleton loaders for data-fetching screens (standings, leaderboard, profile). Currently shows empty or flash of SEED data. |
| 4.2 | **Empty states** | Design proper empty states for: no players registered, no past clashes, no achievements unlocked, no notifications. Currently shows blank space. |
| 4.3 | **Toast system upgrade** | Current toasts are basic. Add: auto-dismiss timer, stacking (max 3), action buttons ("Undo"), error/success/warning/info variants with icons. |
| 4.4 | **Mobile responsiveness audit** | Test every screen at 375px, 390px, 414px widths. Fix: table horizontal scroll, navbar overflow, card padding, font sizes. Bracket screen needs special mobile layout. |
| 4.5 | **Animations & transitions** | Screen transitions (fade/slide). Button press feedback. Card hover states consistent across all screens. Lobby card flip on result reveal. |
| 4.6 | **Dark mode contrast pass** | Multiple commits already fixing contrast — do one systematic pass. Check every text color against WCAG AA (4.5:1 ratio). Fix muted text that's too dim. |
| 4.7 | **Consistent spacing system** | Currently uses 8/10/12/14/16px inconsistently. Standardize to 4px grid: 4, 8, 12, 16, 24, 32, 48. Apply globally. |
| 4.8 | **Form validation UX** | Inline validation on signup/login. Show password requirements. Riot ID format validation (Name#TAG). Email format check. Red border + helper text on error. |
| 4.9 | **Confirmation dialogs** | Add "Are you sure?" modals for destructive actions: delete player, reset tournament, DQ player, clear results. Currently these happen instantly. |
| 4.10 | **Favicon & PWA basics** | Proper favicon at multiple sizes. `manifest.json` with app name, colors, icon. Add-to-homescreen support. |

**Estimated effort:** 2-3 sessions

---

### PHASE 5 — CODE ARCHITECTURE (Priority: MEDIUM)
*Technical debt that slows future development*

| # | Task | Details |
|---|------|---------|
| 5.1 | **Split App.jsx into modules** | Extract into ~30 files. Structure: `src/components/` (atoms), `src/screens/` (pages), `src/hooks/` (custom hooks), `src/utils/` (helpers), `src/constants/` (config), `src/styles/` (GCSS). Keep one-file working at each step. |
| 5.2 | **Add React.memo to expensive components** | Wrap: StandingsTable, LeaderboardScreen, PlayerProfileScreen, BracketScreen. These re-render on every state change. |
| 5.3 | **useMemo for computed data** | Memoize: sorted standings, filtered leaderboard, player stats computation, lobby generation. Currently recomputed every render. |
| 5.4 | **Custom hooks extraction** | `useSupabase()` — data fetching + realtime. `useTournament()` — tournament state machine. `useAuth()` — auth state + linked player. `useLocalStorage()` — persistence with fallback. |
| 5.5 | **Remove dead code** | Delete: `MOCK_ACCOUNTS`, `mkHistory()`, unused `isOnTilt()`, empty `SPONSORS`/`ACTIVE_SPONSOR`. Clean up commented-out code. |
| 5.6 | **Error boundaries per feature** | Wrap each screen in its own ErrorBoundary. Currently only 1 top-level boundary — a crash in Bracket takes down the whole app. |
| 5.7 | **Lazy loading screens** | `React.lazy()` + `Suspense` for screens not on initial load (Admin, Scrims, HoF, Archive, Pricing, Account, SeasonRecap, HostDashboard). |

**Estimated effort:** 2-3 sessions

---

### PHASE 6 — NEW FEATURES (Priority: MEDIUM)
*Features that differentiate TFT Clash*

| # | Task | Details |
|---|------|---------|
| 6.1 | **Player-vs-Player head-to-head** | When viewing a profile, show H2H record against each other player. "You vs Zounderkite: 12W-8L, avg diff: +1.2 places". Already partially in PlayerProfileScreen's h2h tab — make it real with DB data. |
| 6.2 | **Season timeline** | Visual timeline showing all clashes in the season. Click a clash → see results. Show point progression as a line graph. "Season 16: 8 clashes played, 3 remaining". |
| 6.3 | **Clash predictions** | Before each clash, players predict top 3 finishers. Points for correct predictions. Leaderboard tab for prediction accuracy. Fun social feature. |
| 6.4 | **Player comparison tool** | Select 2-3 players → side-by-side stats comparison. Radar chart: consistency, peak performance, clutch factor, attendance. |
| 6.5 | **Streak tracking & records** | Track: win streaks, top-4 streaks, attendance streaks, hot/cold streaks. Display on profile and leaderboard. "On Fire" badge for 3+ game win streak. |
| 6.6 | **Clash reminders** | Email/push notification 24h and 1h before clash. "Clash starts in 1 hour — are you ready?" Opt-in per user. |
| 6.7 | **Export & share** | "Share my stats" card generator (PNG). Season recap shareable card. Tournament results shareable link. Social media meta tags for shared links. |
| 6.8 | **Spectator/broadcast mode** | Full-screen standings display optimized for streaming. Auto-updating. Large fonts, clean layout. OBS-friendly transparent background option. |

**Estimated effort:** 3-4 sessions

---

### PHASE 7 — MONETIZATION (Priority: LOW-MEDIUM)
*Revenue features — Pro & Host tiers*

| # | Task | Details |
|---|------|---------|
| 7.1 | **Stripe integration** | Stripe Checkout for Pro ($4.99/mo) and Host ($19.99/mo). Webhook endpoint on Vercel for subscription events. Store subscription status in Supabase `users` table. |
| 7.2 | **Pro features gate** | Pro badge on profile. Advanced stats (placement distribution chart, trend analysis). Custom profile themes. Priority registration for clashes. |
| 7.3 | **Host features gate** | Create custom tournaments. Set own rules/format. Invite-only events. Custom branding on tournament pages. Revenue split on entry fees. |
| 7.4 | **Subscription management** | Account page: current plan, billing history, cancel/upgrade. Stripe Customer Portal link. Grace period on lapsed subscriptions. |

**Estimated effort:** 2 sessions

---

### PHASE 8 — MONITORING & POLISH (Priority: LOW)
*Production hardening*

| # | Task | Details |
|---|------|---------|
| 8.1 | **Sentry error tracking** | Install `@sentry/react`. Wrap app in Sentry boundary. Track JS errors, failed API calls, Supabase errors. |
| 8.2 | **Analytics** | Plausible or PostHog. Track: page views, registration conversions, check-in rates, feature usage. No PII. |
| 8.3 | **Rate limiting** | Add rate limiting to `api/check-admin.js`. Consider Vercel Edge Middleware for API protection. |
| 8.4 | **Accessibility pass** | ARIA labels on all interactive elements. Focus indicators on inputs. Screen reader testing. Keyboard navigation for all flows. Color-blind safe indicators (not color-only). |
| 8.5 | **Performance audit** | Lighthouse score > 90. Bundle size analysis. Image optimization. Font loading strategy (preload Inter). |
| 8.6 | **Commit Discord bot** | Stage and commit the full `discord-bot/` directory. It's built and tested but never committed. |
| 8.7 | **CI/CD pipeline** | GitHub Actions: lint → type-check → E2E tests → deploy. Block merge on test failure. |

**Estimated effort:** 2 sessions

---

## Quick Wins (Can Do Right Now, < 30 min each)

These are independent, low-risk improvements that can be knocked out immediately:

| # | Quick Win | Why |
|---|-----------|-----|
| QW1 | Delete dead code (`MOCK_ACCOUNTS`, `mkHistory()`) | Reduces file size, removes confusion |
| QW2 | Add loading spinner component | Reusable across all data-fetching screens |
| QW3 | Fix browser back button (basic `hashchange` listener) | Most reported UX issue for SPAs |
| QW4 | Add "No data yet" empty states | Prevents blank screens for new users |
| QW5 | Commit discord-bot/ to repo | It's built, tested, sitting untracked |
| QW6 | Add confirmation dialog for admin destructive actions | Prevents accidental data loss |
| QW7 | Wire the Phase 3 useEffect (Supabase player load) | 10 lines of code, massive impact |
| QW8 | Update CLAUDE.md line numbers (15.5k, not 5.7k) | Keeps documentation accurate |

---

## Execution Priority (What to do FIRST)

```
Session 1:  QW1-QW8 (quick wins) + Phase 1.1-1.2 (data layer basics)
Session 2:  Phase 1.3-1.6 (complete data layer) + Phase 2 (URL routing)
Session 3:  Phase 3.1-3.3 (registration + check-in + lobby builder)
Session 4:  Phase 3.4-3.7 (multi-game flow + tournament completion)
Session 5:  Phase 4.1-4.5 (UI polish first half)
Session 6:  Phase 4.6-4.10 (UI polish second half) + Phase 5.5 (dead code)
Session 7:  Phase 5.1-5.4 (file splitting + performance)
Session 8:  Phase 6 (pick 3-4 most impactful features)
Session 9:  Phase 7 (Stripe + monetization)
Session 10: Phase 8 (monitoring + final polish)
```

---

## What NOT to Do

- **Don't rebuild in Next.js** — the current Vite SPA works fine. Rewriting is a trap.
- **Don't add i18n** — English-only audience, not worth the complexity.
- **Don't add a chat system** — Discord handles this already.
- **Don't integrate Riot API yet** — manual entry works for friend-group scale. API adds auth complexity and rate limits.
- **Don't add a fantasy league** — defer until core tournament loop is rock-solid.
- **Don't over-abstract** — 3 similar lines > premature utility function.

---

## Success Criteria

The project is "done" when:
1. A new player can sign up, register for a clash, check in, play, and see results — all on the platform
2. Admin can run a full clash (registration → check-in → lobbies → 3 games → results) without touching localStorage or console
3. Season standings persist across clashes and browser sessions
4. At least 2 friends have used it for a real clash
5. Stripe is wired and at least 1 test payment processed
6. Discord bot posts results automatically after a clash
