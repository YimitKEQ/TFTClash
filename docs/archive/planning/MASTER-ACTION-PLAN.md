# TFT Clash — Master Action Plan

**Generated:** 2026-03-18
**Based on:** 6 parallel agent audits (Architecture, Database, Security, Code Review, E2E Tests, TFT Research)

---

## Priority Legend

- **P0 (NOW):** Security vulnerabilities, data corruption risks — fix before any feature work
- **P1 (THIS WEEK):** Bugs that crash the app or produce wrong data
- **P2 (NEXT SPRINT):** Performance, UX, and infrastructure improvements
- **P3 (ROADMAP):** New features informed by competitive TFT research

---

## PHASE 0: Emergency Security Fixes (P0)

_Do these FIRST. Some are one-line fixes._

### 0.1 — Rotate Exposed Credentials
- [ ] Add `**/.env` to root `.gitignore`
- [ ] Rotate Discord bot token (Developer Portal)
- [ ] Rotate Supabase service role key (Dashboard > Settings > API)
- [ ] Run `git log --all -S "service_role"` to check for history exposure

### 0.2 — Fix RLS Policies (Database Migration)
Apply `docs/RECOMMENDED-MIGRATIONS.sql` FIX-002:
- [ ] Drop `"write all"` policy on `site_settings` (C-3)
- [ ] Restrict `game_results` writes to service_role only (C-2)
- [ ] Restrict `registrations` UPDATE to own player (C-1)
- [ ] Restrict `players` INSERT to own `auth_user_id` (H-1)
- [ ] Remove open `players` DELETE policy (H-2)
- [ ] Restrict `seasons` INSERT to service_role (H-3)
- [ ] Restrict `tournament_rounds` writes to tournament hosts (H-4)
- [ ] Restrict `notifications` INSERT to service_role (M-3)
- [ ] Restrict `audit_log` INSERT to service_role (M-4)

### 0.3 — Remove SVG Upload
- [ ] Remove `image/svg+xml` from `host_assets_bucket` allowed_mime_types (CRIT-4)

### 0.4 — Move AI API Call Server-Side
- [ ] Create `api/ai-commentary.js` serverless function
- [ ] Move Anthropic API key to Vercel server-side env var
- [ ] Update `AICommentaryPanel` to call `/api/ai-commentary` instead of direct API

### 0.5 — Fix CORS on check-admin
- [ ] Whitelist production domain instead of reflecting any `Origin` header

### 0.6 — Switch Auth to PKCE
- [ ] Change `flowType: 'implicit'` to `flowType: 'pkce'` in `src/lib/supabase.js`

---

## PHASE 1: Critical Bug Fixes (P1)

### 1.1 — Fix Stats Trigger (DATABASE — most impactful single fix)
Apply `RECOMMENDED-MIGRATIONS.sql` FIX-004:
- [ ] Change `DECLARE pid UUID` to `DECLARE pid BIGINT` in `refresh_player_stats()`
- [ ] Recreate trigger on `game_results`
- **Impact:** Player stats (season_pts, wins, top4, avg_placement) are currently NEVER updating in production

### 1.2 — Fix FK Type Mismatches
Apply FIX-003:
- [ ] Cast `seasons.champion_player_id` from UUID to BIGINT
- [ ] Cast `player_achievements.player_id` from UUID to BIGINT
- [ ] Add FK + indexes on `tournament_results.player_id`

### 1.3 — Fix AdminPanel Crash
- [ ] Pass `currentUser` as prop to `AdminPanel` component (~line 7887)
- [ ] Every audit action currently crashes with TypeError

### 1.4 — Fix SEASON_CHAMPION Mutation in Render
- [ ] Replace module-level `SEASON_CHAMPION` assignment with `useMemo` (~lines 15685–15696)

### 1.5 — Fix Tiebreaker Step 4
- [ ] Compare `clashHistory[last].date` or `clashId` for recency, not placement value (~lines 411–415)

### 1.6 — Fix "Most Improved" / "Ice Cold" Awards
- [ ] "Most Improved" should use AVP delta vs prior period, not raw AVP rank (~lines 676–682)
- [ ] "Ice Cold" should be a separate metric (e.g., longest streak without top-4)

### 1.7 — Fix Discord Bot Win Rate
- [ ] Replace `SEASON.currentClash` (hardcoded 15) with `player.games` in `profileEmbed` (~line 142)

### 1.8 — Fix Stripe Error Leakage
- [ ] Return generic error message to client in `api/create-checkout.js`
- [ ] Keep `err.message` in `console.error` only

### 1.9 — Fix Webhook Silent Failures
- [ ] Check return value of `supabase.from('subscriptions').upsert(...)` in `stripe-webhook.js`
- [ ] Return 500 to Stripe if DB write fails (so Stripe retries)

---

## PHASE 2: Performance & Infrastructure (P2)

### 2.1 — Memoize computeStats
- [ ] Pre-compute stats once per player, store in a Map
- [ ] Remove inline `computeStats()` calls from render loops (saves 90+ calls per render)

### 2.2 — Debounce localStorage Sync
- [ ] Add 300ms debounce to `players` → localStorage serialization effect
- [ ] Use `requestIdleCallback` if available

### 2.3 — Fix pastClashes Waterfall
- [ ] Change dependency from `[players]` to a stable flag (e.g., `[playersLoaded]`)
- [ ] Combine `tournaments` + `tournament_results` into a single joined query

### 2.4 — Wrap navTo in useCallback
- [ ] `const navTo = useCallback(function(s) { ... }, [])` (~line 15556)
- [ ] This makes all `React.memo` wrappers actually work

### 2.5 — Add React.memo to Heavy Screens
- [ ] Wrap `StandingsTable`, `LeaderboardScreen`, `PlayerProfileScreen`, `BracketScreen`, `AdminPanel`

### 2.6 — Add game_number Column
Apply FIX-005:
- [ ] `ALTER TABLE game_results ADD COLUMN game_number INT NOT NULL DEFAULT 1`
- [ ] Enables proper "most recent game" tiebreaker and multi-game-per-round support

### 2.7 — Add Missing DB Columns
Apply FIX-006 through FIX-009:
- [ ] DNP/DQ tracking on registrations
- [ ] Rank CHECK constraint on players
- [ ] updated_at trigger on players
- [ ] Billing columns on subscriptions

---

## PHASE 3: Data Layer Migration (P2 — Architectural)

_This is the single most important architectural change. The app currently stores ALL state as JSON blobs in `site_settings`. The normalized tables exist but are barely used._

### 3.1 — Wire Screens to Read from Normalized Tables
- [ ] `StandingsTable` → query `player_stats_v` view
- [ ] `BracketScreen` → query `lobbies` + `game_results`
- [ ] `ArchiveScreen` → query `tournaments`
- [ ] `ResultsScreen` → query `tournament_results` + `game_results`
- [ ] `PlayerProfileScreen` → query `players` + `game_results`

### 3.2 — Add Supabase Realtime on Normalized Tables
- [ ] Subscribe to `game_results` changes (live tournament updates)
- [ ] Subscribe to `registrations` changes (registration/check-in live)
- [ ] Subscribe to `lobbies` changes (lobby assignments live)

### 3.3 — Remove site_settings JSON Blob Sync
- [ ] Delete the 17 `useEffect` hooks that serialize state to `site_settings`
- [ ] Keep `site_settings` only for actual settings (theme, announcements)
- [ ] Keep localStorage as read-through cache, not source of truth

### 3.4 — Create New Tables
Apply NEW-001 through NEW-005:
- [ ] `lobby_players` junction table (replaces `player_ids` array)
- [ ] `head_to_head` records table
- [ ] `tournament_stages` table (multi-stage/Swiss support)
- [ ] `bye_assignments` table
- [ ] Improved `player_stats_v` view with DNP count

---

## PHASE 4: Tournament Engine (P3 — Core Product)

_Informed by TFT competitive research. This is what makes the product real._

### 4.1 — Tournament State Machine
```
DRAFT → REGISTRATION → CHECK_IN → LOBBY_SETUP → IN_PROGRESS → BETWEEN_ROUNDS → COMPLETE
```
- [ ] Each state determines available actions and visible UI
- [ ] State transitions write to DB immediately
- [ ] Browser refresh reconstructs state from DB (no localStorage dependency)

### 4.2 — Registration + Check-in Flow
- [ ] Registration with player cap + waitlist
- [ ] Auto-open/close based on timestamps
- [ ] 60-minute check-in window
- [ ] Auto-drop no-shows at T-15 minutes
- [ ] Waitlist auto-promotion when spots open

### 4.3 — Lobby Builder
- [ ] Snake seeding algorithm (1-8-9-16 pattern)
- [ ] Handle uneven player counts (7-player lobbies OK, 6 acceptable, below 6 merge)
- [ ] BYE system for odd numbers
- [ ] Lobby code distribution (visible only to assigned players)
- [ ] 5-minute grace period after codes sent

### 4.4 — Multi-Game Result Tracking
- [ ] Support 3-5 games per round
- [ ] Cumulative points across games
- [ ] Live standings updates between games
- [ ] Player self-submission with two-player confirmation
- [ ] Admin override capability

### 4.5 — Swiss Reseeding (Differentiator)
- [ ] Reseed lobbies after every 2 games based on current standings
- [ ] Randomize within same-point tiers to prevent repeat matchups
- [ ] Track pairing history to avoid rematches within a stage
- [ ] Toggle on/off per tournament

### 4.6 — Broadcast/OBS Mode (Differentiator)
- [ ] Full-screen standings overlay with transparent background
- [ ] Auto-updating during live tournament
- [ ] Customizable colors for host branding
- [ ] Low effort, high value for streamers

### 4.7 — Checkmate Format (Premium Feature)
- [ ] Reach 18-20 points → "check" status
- [ ] Must win a game while in check to be crowned
- [ ] Multiple players can be in check simultaneously
- [ ] Dramatic tension for finals — nobody else offers this

---

## PHASE 5: Polish & Testing (P3)

### 5.1 — E2E Test Coverage
Current: 12/23 screens touched, weak assertions
- [ ] Add `data-testid` attributes to key UI elements
- [ ] Replace `waitForTimeout` with condition-based waits
- [ ] Write tests for: admin panel, player profile, pricing, rules/FAQ, mobile responsive
- [ ] Target: all 25 screens covered with meaningful assertions

### 5.2 — Accessibility
- [ ] Add ARIA labels to all interactive elements (Btn, Inp, custom controls)
- [ ] Add keyboard navigation for modals and drawers
- [ ] Fix color contrast (purple on dark fails WCAG AA)
- [ ] Add `aria-selected` to tab components

### 5.3 — Dead Code Cleanup
- [ ] Remove unused `height` variable in ResultsScreen podium
- [ ] Remove unused `disputes` state
- [ ] Fix or remove non-functional GearScreen affiliate links
- [ ] Replace Discord bot placeholder channel IDs

### 5.4 — Mobile Audit
- [ ] Test all screens at 375px
- [ ] Verify hamburger menu works
- [ ] Check `Hexbg` gradient performance on mobile devices

---

## What NOT to Build (Anti-Features from Research)

- Live game tracking (no API support)
- Tournament codes / auto-lobby creation (TFT doesn't support it)
- Built-in voice chat (Discord owns this)
- Comp builder / tier list (tactics.tools owns this)
- Ranked matchmaking (Riot owns this)
- Fantasy league (premature complexity)
- Riot API integration (defer until manual flow runs 3+ real tournaments)

---

## Success Metrics

| Milestone | How to Know It's Done |
|-----------|----------------------|
| Phase 0 complete | No credentials in repo, all RLS policies restricted |
| Phase 1 complete | Zero known crashes, stats trigger works, tiebreakers correct |
| Phase 2 complete | Page feels snappy, no jank on realtime updates |
| Phase 3 complete | Browser refresh preserves all tournament state, site_settings only for settings |
| Phase 4 complete | Run a real 8-player tournament end-to-end without touching browser console |
| Phase 5 complete | All screens tested, WCAG AA contrast, keyboard navigable |

---

## Estimated Session Breakdown

| Phase | Sessions | Notes |
|-------|----------|-------|
| Phase 0 | 1 | Mostly config + SQL migration |
| Phase 1 | 1-2 | Targeted fixes, small diffs |
| Phase 2 | 1 | Performance tuning |
| Phase 3 | 3-4 | Biggest lift — rewiring data layer |
| Phase 4 | 4-6 | Core product work |
| Phase 5 | 2-3 | Testing and polish |

**Total: ~12-17 sessions to production-ready tournament platform**
