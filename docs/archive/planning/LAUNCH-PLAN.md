# TFT Clash — Production Launch Plan

> Generated: 2026-03-18
> Goal: Ship a launch-ready product that can start acquiring real users
> Approach: 5 focused sprints, each independently shippable

---

## What's Already Done (don't redo)

- All 47 tasks from TASKS.md complete
- 24 DB migrations applied to Supabase
- Auth (email + Discord OAuth), API hardening, rate limiting, RLS
- Stripe endpoints ready (needs env vars)
- Discord bot built (untracked)
- E2E tests configured, CI/CD on GitHub Actions
- Security headers, CSP, HSTS, input sanitization
- Host system: apply, dashboard, branding, image upload, tournament creation
- Production audit cleanup (dead code, Season 1, brace balance, error handling)

## What's Blocking Launch (UPDATED 2026-03-18)

~~1. **Data doesn't survive**~~ — FIXED: players load from DB via site_settings on mount, bootstrapPlayersFromTable fallback, double-call bug fixed
~~2. **No URLs**~~ — FIXED: hash routing auto-syncs via screen useEffect, back/forward works, dynamic titles + meta descriptions
~~3. **No error visibility**~~ — FIXED: console usage already clean (all console.error with [TFT] prefix), per-screen ScreenBoundary added, dbg() debug helper exists
4. **Stripe not configured** — still needs env vars in Vercel dashboard
~~5. **50+ console.logs**~~ — FIXED: was actually all console.error (correct), no raw console.log calls exist

---

## Sprint 1: Data Layer (CRITICAL — nothing works without this)

**Time: 3-4 hours | Impact: App goes from demo to functional**

### 1.1 — Players load from DB on mount

The `bootstrapPlayersFromTable` function exists but only runs on admin action. Make it run on app mount.

**File:** `src/App.jsx` — `TFTClash()` component, after `isLoadingData` state

```
On mount:
1. Query `players` table
2. For each player, query their `game_results` to build clashHistory
3. Map DB columns to app shape (username->name, season_pts->pts, etc.)
4. setPlayers(mapped)
5. Fall back to empty array (NOT SEED) if query fails
```

### 1.2 — Leaderboard/standings read from live state

Already works IF players state is populated from DB (1.1 fixes this). Verify `computeStats()` and `computeSeasonPoints()` work with DB-shaped data.

### 1.3 — Archive loads from DB

**Current:** `PAST_CLASHES` is empty array.
**Fix:** Query `tournaments` WHERE phase='complete' + join `tournament_results`. Already partially wired (line ~15029 `useEffect` loads past clashes). Verify it populates `pastClashes` state and ArchiveScreen reads it.

### 1.4 — Hall of Fame from DB

**Current:** `HOF_RECORDS` is hardcoded.
**Fix:** Derive from `pastClashes` — group by season, find champion of each. Or query `tournament_results` grouped by season. HofScreen already has empty state.

### 1.5 — Session persistence

**Current:** Auth session works but flashes logged-out state on reload.
**Fix:** Add loading state while `supabase.auth.getSession()` resolves. Don't render auth-dependent UI until session check completes.

### 1.6 — Remove SEED fallbacks

After DB loading works, change all `SEED` fallbacks to `[]`. The app should show empty states, not fake data.

---

## Sprint 2: URL Routing + SEO Foundation (HIGH — enables sharing and Google)

**Time: 2-3 hours | Impact: Shareable links, back button, Google can find you**

### 2.1 — Hash-based routing

Map `screen` state to URL hash. No library needed.

```
#home, #standings, #bracket, #leaderboard, #hof, #archive,
#milestones, #challenges, #results, #pricing, #admin,
#scrims, #rules, #faq, #featured, #host-apply, #host-dashboard,
#account, #recap, #profile/:name, #tournament/:id
```

On mount: read `location.hash` -> set initial screen.
On screen change: `history.pushState` + update hash.
On `popstate`: read hash -> set screen.

### 2.2 — Meta tags with react-helmet-async

Install `react-helmet-async`. Set per-screen:
- `<title>`: "TFT Clash — Standings" / "Levitate — TFT Clash Profile"
- `<meta description>`: Dynamic per page
- OG tags: title, description, image (use a default card image)

### 2.3 — Structured data (JSON-LD)

Add `SportsEvent` schema to tournament pages. Add `Person` schema to player profiles. This enables rich snippets in Google results.

### 2.4 — Prerender for SPA SEO

Install `react-snap` (build-time) or sign up for Prerender.io ($9/mo). Generates static HTML snapshots for Google crawler. Without this, Google sees empty `<div id="root">`.

---

## Sprint 3: Production Hardening

**Time: 2 hours | Impact: Visibility into errors, professional polish**

### 3.1 — Sentry error tracking

```
npm install @sentry/react
```

Initialize in `main.jsx`. Wrap app in `Sentry.ErrorBoundary`. Configure:
- Environment: production/development
- Release: git commit hash
- Breadcrumbs: Supabase calls, navigation, user actions

### 3.2 — Console.log cleanup

Replace all `console.log` with conditional debug logging:
```js
var DEBUG = import.meta.env.DEV;
function dbg(){if(DEBUG)console.log.apply(console,arguments);}
```

Keep `console.error` for real errors (Sentry captures these too).

### 3.3 — Per-screen error boundaries

Wrap each screen render in the route switch with individual ErrorBoundary. Currently one crash kills the entire app. Each screen should fail independently with "Something went wrong in [Screen]. Go back to Home."

### 3.4 — Analytics

Install Plausible ($9/mo) or self-host Umami (free). Track:
- Page views per screen
- Registration conversions
- Check-in completion rate
- Feature usage (which screens get traffic)

No PII, GDPR-compliant by default.

---

## Sprint 4: Monetization Wiring

**Time: 1-2 hours | Impact: Revenue capability**

### 4.1 — Stripe env vars

In Vercel dashboard, add:
- `STRIPE_SECRET_KEY` — from Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` — from webhook endpoint config
- `STRIPE_PRO_PRICE_ID` — create $4.99/mo product in Stripe
- `STRIPE_HOST_PRICE_ID` — create $19.99/mo product in Stripe

### 4.2 — Subscription status on user

After webhook confirms payment, write `plan: "pro"` or `plan: "host"` to user's profile in Supabase. Read this in `currentUser` state. Already partially wired — `PricingScreen` now reads `currentUser.plan`.

### 4.3 — Pro feature gates

Light touches — don't build complex gating:
- Pro badge on profile and leaderboard
- "Pro" tag next to name in standings
- Ad-free flag (for when ads are added later)

### 4.4 — Affiliate links page

Add a "Gear" or "Recommended" section (can be a simple page or footer section):
- VPN affiliate (NordVPN/Surfshark — 40-100% commission)
- Gaming peripheral links (Razer, Logitech — 3-10%)
- Zero development effort, immediate passive revenue potential

---

## Sprint 5: Growth Foundation

**Time: 2-3 hours | Impact: Sets up organic growth engine**

### 5.1 — Shareable recap images

Use `canvas` API (already used for stats cards in SeasonRecapScreen) to auto-generate:
- Post-clash result card: placement, points earned, season standing
- Season stats card: rank, wins, avg placement, achievements
- Add "Share to Twitter" and "Copy to clipboard" buttons

### 5.2 — Discord server setup

Create the community Discord:
- `#announcements`, `#clash-registration`, `#results`, `#general`, `#looking-for-group`
- Bot integration for auto-posting results
- Tiered roles: Rookie, Regular, Veteran, Champion

### 5.3 — Commit Discord bot

The bot is built in `discord-bot/` but untracked. Stage and commit it.

### 5.4 — Riot API key

Register at developer.riotgames.com. Get Development API key. Future use:
- Auto-verify player ranks
- Pull match results automatically
- Player identity verification

### 5.5 — 3 SEO landing pages

Write and publish (can be static HTML or blog posts):
1. "How to Host a TFT Tournament" — targets long-tail keyword
2. "TFT Tournament Points System Explained" — targets competitive queries
3. "Free TFT Tournament Platform" — targets direct competitor queries

### 5.6 — Privacy Policy + Terms

Required for Google AdSense approval, GDPR compliance, and professionalism:
- Privacy Policy (what data you collect, Supabase, cookies)
- Terms of Service (tournament rules, fair play, account termination)
- Cookie consent banner (simple, not intrusive)

---

## Post-Launch Priority Queue

After Sprints 1-5, the platform is live and functional. These are ordered by impact:

### Week 2-3: Performance
- `React.memo` on StandingsTable, LeaderboardScreen, BracketScreen
- `useMemo` for sorted standings, filtered data, computed stats
- `React.lazy` + `Suspense` for Admin, Scrims, Host Dashboard, Pricing

### Week 3-4: Google AdSense
- Apply once you have 30+ content pages (tournament results count)
- Place ads on: results pages, archive, player profiles
- Dark-themed ad containers matching `#111827`
- Start at $1-4 RPM, plan to move to NitroPay at 15K+ daily pageviews

### Month 2: Community Growth
- Reddit engagement on r/CompetitiveTFT (genuine participation first)
- Approach 2-3 micro-streamers (500-5K viewers) for invitational clashes
- Weekly newsletter via Beehiiv (free tier)
- Auto-generated weekly recap pages for Google Discover

### Month 3: Advanced Features
- Player-vs-Player head-to-head records
- Clash predictions (predict top 3, earn points)
- Spectator/broadcast mode for streamers
- Push notifications for clash reminders

### Month 4+: Scale
- Riot API integration for auto-results
- Entry fee tournaments (geo-restricted, legal review first)
- First sponsor outreach ($500-$1K tournament naming deals)
- Consider NitroPay/Venatus for premium ad revenue

---

## What NOT to Do (Scope Traps)

- **Don't split App.jsx before launch** — it works, splitting risks breaking things. Do it post-launch
- **Don't add TypeScript** — not worth the migration cost right now
- **Don't build a mobile app** — PWA/responsive web is sufficient
- **Don't add i18n** — English only audience
- **Don't integrate Riot API yet** — manual entry works for friend-group scale
- **Don't chase Next.js migration** — Vite SPA + Prerender.io gets you 90% of SSR benefits
- **Don't add entry fee tournaments yet** — legal complexity requires proper counsel
- **Don't over-engineer ad infrastructure** — start with AdSense, upgrade later

---

## Success Criteria

The platform is launch-ready when:

1. A new user can sign up, see the leaderboard, register for a clash, and view results — all from DB
2. Page reload preserves everything (auth, data, screen)
3. URLs are shareable (`tftclash.com/#standings`, `tftclash.com/#profile/Levitate`)
4. Errors are captured in Sentry (not just console.log)
5. Stripe checkout works end-to-end (test mode)
6. Google can crawl and index key pages
7. At least one real clash has been run with friends using the platform

---

## Timeline

| Sprint | Time | What ships |
|--------|------|-----------|
| Sprint 1 | 3-4 hrs | Real data, no more SEED, session persistence |
| Sprint 2 | 2-3 hrs | URLs, meta tags, Google can index |
| Sprint 3 | 2 hrs | Sentry, analytics, console cleanup |
| Sprint 4 | 1-2 hrs | Stripe configured, affiliate links |
| Sprint 5 | 2-3 hrs | Shareable images, Discord, Riot API key, SEO pages |
| **Total** | **~12-14 hrs** | **Production-ready, revenue-capable, growth-enabled** |

After that: performance optimization (week 2), AdSense (week 3), community growth (month 2), advanced features (month 3+).
