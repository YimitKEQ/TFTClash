# TFT Clash — Go-Live Checklist

Last updated: 2026-04-16

The list below is what has to be true before a public launch announcement. Check each before pushing the go button.

---

## 1. Infrastructure

- [ ] Production domain (`tftclash.com`) is pointed at Vercel, SSL is green
- [ ] Supabase prod project is on a paid plan (free tier pauses after 7 days idle)
- [ ] Daily Supabase DB backups enabled
- [ ] Supabase Storage retention rules set on `host-assets` bucket
- [ ] Sentry DSN set in Vercel env vars (`VITE_SENTRY_DSN`)
- [ ] Sentry release tracking + source maps uploaded on build
- [ ] Service worker (`/sw.js`) updated on each deploy (Vite version hash)
- [ ] Vercel project has correct envs: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID`, `ADMIN_PASSWORD_HASH`, `VITE_SENTRY_DSN`
- [ ] `/api/health` returns 200

## 2. Auth & Security

- [ ] All RLS policies applied (migrations 001-024)
- [ ] `user_roles` seed: at least 1 admin row
- [ ] `check-admin` endpoint uses timing-safe compare (verified — hardened)
- [ ] PayPal webhook signature verification enabled
- [ ] CSP header set on Vercel (script-src self + Supabase + PayPal only)
- [ ] No `VITE_` env var contains a server-side secret
- [ ] Admin override is server-validated (verified in AppContext)
- [ ] Cookie consent banner shipped (verified)
- [ ] Privacy Policy + Terms of Service reachable from every page (Footer — verified)

## 3. Core Flows (smoke test)

- [ ] Sign-up -> email confirm -> linked player record -> login
- [ ] Discord OAuth sign-in path works end-to-end
- [ ] Register for next clash -> appears in tournamentState.registeredIds
- [ ] Check-in window opens, registered user checks in
- [ ] Admin builds lobbies (4 seeding algos)
- [ ] Round 1 results entered, Round 2 seeded, final standings compute
- [ ] PayPal subscribe -> webhook fires -> `user_subscriptions` row -> badge shows
- [ ] PayPal cancel -> subscription ends -> badge removed
- [ ] Host applies -> admin approves -> host-dashboard unlocks
- [ ] Host creates a flash tournament -> players register -> admin runs -> results
- [ ] Notifications write + mark-all-read

## 4. Performance

- [ ] Lighthouse score ≥ 85 mobile, ≥ 90 desktop
- [ ] Largest Contentful Paint < 2.5s on 4G
- [ ] Images use `loading="lazy"` where appropriate
- [ ] Bundle < 250kb gzipped for initial route (verified — ~146kb vendor-react + ~34kb index)
- [ ] No unused routes loaded on first paint (React.lazy — verified)
- [ ] Fonts: `font-display: swap` set in @font-face

## 5. Content

- [ ] All copy reviewed — no em dashes, no LARPy "Obsidian Arena" language (done 2026-04-16)
- [ ] All `Coming Soon` placeholders either shipped or hidden
- [ ] Player seed data matches CLAUDE.md roster (homies only)
- [ ] FAQ answers reflect actual flow (no screenshot-to-Discord language)
- [ ] Rules page matches EMEA 2026 rulebook
- [ ] Footer shows correct social links, Discord invite is permanent
- [ ] favicon + og:image + apple-touch-icon all present

## 6. Accessibility

- [ ] All images have `alt` (decorative use `alt=""` + `aria-hidden`)
- [ ] All buttons have visible text or `aria-label` (Navbar verified)
- [ ] Focus ring visible on every interactive element (Btn, Inp, Navbar verified)
- [ ] Color contrast ≥ 4.5:1 for body text
- [ ] `prefers-reduced-motion` respected on animations
- [ ] Keyboard navigation works end-to-end (tab through sign-up)
- [ ] Screen-reader: drawer / notification bell / modals announce properly

## 7. SEO & Discovery

- [ ] `index.html` has og:image, twitter:card, canonical (verified)
- [ ] Structured data: Organization + WebSite schema (verified)
- [ ] `robots.txt` + `sitemap.xml` served from public/
- [ ] Open Graph preview on Discord, X, WhatsApp looks correct
- [ ] Google Search Console verified
- [ ] Riot Games API compliance (riot.txt verified in public/)

## 8. Monitoring & Ops

- [ ] Sentry alerts wired to Discord/Slack
- [ ] Supabase advisor warnings reviewed and either fixed or noted
- [ ] Audit log queryable in admin panel (AdminScreen > AuditTab verified)
- [ ] Activity feed writes on key events (reg/check-in/result/subscription)
- [ ] `/api/health` monitored by uptime service (UptimeRobot/Better Stack)
- [ ] DB size + monthly active user dashboard in Supabase
- [ ] Daily error rate threshold: < 0.5% of sessions

## 9. Legal

- [ ] Privacy Policy covers: data collected, PayPal, Discord OAuth, cookies, Sentry, Supabase
- [ ] Terms cover: account termination, ban policy, user content, refund policy
- [ ] GDPR: data export on request (admin tool)
- [ ] GDPR: account deletion on request (admin tool)
- [ ] Riot Games Developer Policies reviewed — we only display public match info, no match data storage

## 10. Launch Day

- [ ] Status page live at `status.tftclash.com` (or use Vercel/Supabase statuses)
- [ ] Discord announcement drafted + scheduled
- [ ] First 3 clashes seeded and on the public calendar
- [ ] Featured events set for homepage (or hidden via empty-state)
- [ ] Admin on standby for first 48h
- [ ] Rollback plan: `vercel rollback` command tested
- [ ] Social posts ready: X, Reddit r/CompetitiveTFT, Discord communities
- [ ] Press kit at `/media-kit.html` reviewed

## 11. Post-Launch Week 1

- [ ] Daily Sentry review
- [ ] Daily DB query review (slow queries, stuck rows)
- [ ] Discord feedback triaged into GitHub issues
- [ ] First retention email drafted (Day 3 and Day 7 onboard)
- [ ] First weekly recap content generated (ContentEngineScreen)

---

## Known issues carried into launch (acceptable)

- Legacy App.jsx still holds ~678 lines of orchestration (was 6,900 — reduced significantly). Not a user-facing issue.
- Some shared components duplicate (PageHeader vs SectionHeader vs SectionTitle). Consolidation can happen post-launch.

## Hard blockers (do not launch if any are true)

- Payment webhook failing silently
- Auth bypass path discovered
- Any screen that crashes without hitting ScreenBoundary
- Leaderboard standings disagree with raw `game_results` aggregation
