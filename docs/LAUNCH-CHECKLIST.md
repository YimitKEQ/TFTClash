# TFT Clash -- Go-Live Checklist

Last updated: 2026-04-20
Target launch: Full public launch (open signup + marketing push)

This is the operational checklist for going live. Each item has **What / Verify / Status**.
Status legend: `[x]` done, `[ ]` not done, `[~]` partial, `[?]` unknown / needs check.

---

## P0 -- Hard blockers (do not launch if any are open)

These are the items that, if broken, cause data loss, downtime, or auth bypass on day one. Everything else can be patched in flight; these cannot.

- [ ] **Supabase Pro plan active**
  - **What:** Upgrade from free tier to Pro ($25/mo).
  - **Why blocker:** Free tier pauses after 7 days of inactivity, has no daily backups, and caps DB at 500MB. A single low-traffic Tuesday on free plan can take the whole site offline overnight.
  - **Verify:** `supabase projects list` shows tier `pro`. Dashboard > Settings > Billing shows active subscription.
  - **Status:** ❌ Currently on free plan

- [ ] **Backup restore dry run passed**
  - **What:** Take a Supabase backup, restore it to a branch / staging project, confirm row counts match within 1%.
  - **Why blocker:** A backup you have never restored is not a backup.
  - **Verify:** Dated entry in `docs/runbooks/backup-restore.md` showing date + row counts.
  - **Status:** ⚠️ Backups partial, restore never tested

- [ ] **Sentry capturing prod errors**
  - **What:** `VITE_SENTRY_DSN` set in Vercel prod env. Test error appears in Sentry dashboard within 60s.
  - **Why blocker:** Without error tracking you will not know users are crashing until they tell you in Discord (and most will not).
  - **Verify:** In prod, open browser console: `throw new Error('sentry-test-' + Date.now())`. Event appears in Sentry within 60s.
  - **Status:** ❌ Not configured

- [ ] **PayPal webhook signature verified in live mode**
  - **What:** Webhook handler validates PayPal signature using `PAYPAL_WEBHOOK_ID` before mutating `user_subscriptions`.
  - **Why blocker:** Without verification, anyone who finds the webhook URL can grant themselves Pro/Host status.
  - **Verify:** Trigger a real $0.01 subscription. Check Supabase logs show `[paypal-webhook] signature valid`. Then send a forged POST with bad headers; should return 401.
  - **Status:** ❓ Live mode active, signature path needs spot check

- [x] **All migrations 001-055 applied to prod** (verified 2026-04-20)
  - **What:** `supabase migration list --linked` shows every migration in `supabase/migrations/` as applied.
  - **Verify:** `mcp__supabase__list_migrations` returns 055_audit_log_actor_integrity at the top of the chain.
  - **Status:** ✅ Verified 2026-04-20 -- all critical migrations including 052-055 are live in prod

- [ ] **No screen crashes outside `<ScreenBoundary>`**
  - **What:** Every route renders inside a `ScreenBoundary` so a render error shows a fallback, not a white screen.
  - **Verify:** Grep `App.jsx` and route definitions for unwrapped routes. Manually `throw` in one component per route group, confirm fallback renders.
  - **Status:** ❓ Audit needed

- [ ] **Leaderboard agrees with raw `game_results`**
  - **What:** For top 20 players, `players.season_pts` equals `SUM(PTS[placement]) FROM game_results WHERE season_id = current`.
  - **Verify:** Run reconciliation query in `OpsMaintenance > Recompute Standings`. Diffs > 0 are blockers.
  - **Status:** ❓ Run before launch

---

## P1 -- Launch day required

### Infrastructure

- [x] Production domain pointed at Vercel, SSL green
- [x] PayPal in live mode (not sandbox)
- [x] Email deliverability (Supabase auth emails reach inbox, not spam)
- [ ] **Vercel env vars complete in prod environment**
  - Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID`, `ADMIN_PASSWORD_HASH`, `VITE_SENTRY_DSN`
  - **Verify:** `vercel env ls production` -- list contains all 8.
- [ ] **`/api/health` returns 200 and includes git SHA**
  - **Verify:** `curl https://tftclash.com/api/health` returns `{ok: true, sha: '...'}`.
- [ ] **Service worker invalidates on each deploy**
  - **Verify:** Deploy a trivial change, hard reload in incognito, network tab shows new asset hashes loaded.
- [ ] **404 and 500 pages styled, not browser default**
  - **Verify:** Hit `/this-route-does-not-exist`. Should show branded 404 with Home link.
- [ ] **Custom domain redirect: `www.tftclash.com` -> `tftclash.com` (or reverse, pick one)**
  - **Verify:** `curl -I https://www.tftclash.com/` returns 301 to canonical.

### Auth & Security

- [x] Cookie consent banner shipped
- [x] Privacy + Terms reachable from Footer
- [x] Admin override server-validated (AppContext)
- [x] `check-admin` uses timing-safe compare
- [x] Audit log INSERT requires `actor_id = auth.uid()` (migration 055)
- [ ] **All RLS policies confirmed in prod**
  - **Verify:** `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'` returns expected count for: `players`, `registrations`, `game_results`, `tournaments`, `lobbies`, `prize_claims`, `user_subscriptions`, `user_roles`, `audit_log`, `notifications`, `host_applications`.
- [ ] **`user_roles` seed: at least 1 admin in prod**
  - **Verify:** `SELECT COUNT(*) FROM user_roles WHERE role = 'admin'` returns >= 1.
- [x] **CSP header set** (`script-src` self + Supabase + PayPal only)
- [ ] **No `VITE_` env var contains a server-side secret**
  - **Verify:** Grep `vercel env ls` output -- nothing starting with `VITE_` should be a service role / webhook secret.
- [ ] **Rate limiting on auth endpoints**
  - **Verify:** Hit `/auth/login` 20 times in 60s with bad password from same IP. Supabase returns 429 by default; confirm not bypassed by our wrapper.
- [ ] **Signup flow has Terms acceptance checkbox**
  - **Verify:** `SignUpScreen.jsx` has unchecked-by-default checkbox linking to `/terms`. Submit disabled until checked.
- [ ] **Password reset flow tested end-to-end**
  - **Verify:** Use real email, request reset, click link, set new password, log in.

### Payments

- [x] PayPal live credentials in env
- [ ] **Subscribe -> webhook -> badge appears within 30s**
  - **Verify:** Real $4.99 subscribe with secondary account. Watch `user_subscriptions` row appear, badge appear in nav.
- [ ] **Cancel -> webhook -> badge removed by next billing date**
  - **Verify:** Cancel via PayPal dashboard. Confirm `user_subscriptions.status = 'cancelled'` and badge removed at period end.
- [ ] **Refund flow documented**
  - **Verify:** `docs/runbooks/refund.md` exists with PayPal admin refund steps + DB cleanup query.
- [ ] **PricingScreen shows tax/VAT note for EU users (or correct net price)**
  - **Verify:** Open from EU IP via VPN, check copy reflects price model.

### Monitoring & Observability

- [ ] **Sentry release tracking + source maps uploaded on deploy**
  - **Verify:** Sentry dashboard > Releases shows current commit SHA. Source maps icon present.
- [ ] **Sentry alert routes to Discord webhook**
  - **Verify:** Trigger test issue, message lands in `#alerts` Discord channel within 5min.
- [ ] **Uptime monitor on `/api/health` with 1min interval**
  - **Verify:** Pick one: UptimeRobot (free tier 5min interval is fine for launch) or Better Stack. Show monitor URL in `docs/runbooks/oncall.md`.
- [ ] **Supabase advisor warnings reviewed**
  - **Verify:** `mcp__supabase__get_advisors` returns no critical issues. Document any accepted warnings.
- [x] Audit log queryable in admin panel (CommandCenter > Audit)
- [x] Activity feed writes on key events

### Core flows (smoke test, dated within 7 days of launch)

Run these end-to-end in prod with a clean test account, mark date completed.

- [ ] Sign-up -> email confirm -> linked player -> login (`____-__-__`)
- [ ] Discord OAuth sign-in (`____-__-__`)
- [ ] Register for next clash, appears in registered list (`____-__-__`)
- [ ] Check-in window opens, registered user checks in (`____-__-__`)
- [ ] Admin builds lobbies (try all 4 seeding algos) (`____-__-__`)
- [ ] Round 1 entered, Round 2 seeded, finals compute correctly (`____-__-__`)
- [ ] PayPal subscribe -> badge -> cancel -> badge removed (`____-__-__`)
- [ ] Host applies -> admin approves -> host-dashboard unlocks (`____-__-__`)
- [ ] Host creates flash tournament -> registers -> runs -> results (`____-__-__`)
- [ ] Notifications: write + mark-all-read + bell badge accurate (`____-__-__`)
- [ ] Prize claim flow: set address -> submit -> admin approves (`____-__-__`)
- [ ] Account settings: change username, avatar, password (`____-__-__`)
- [ ] Account deletion request flow (`____-__-__`)
- [ ] Dashboard flash banner shows "Registered" when registered, "Register" when not (`____-__-__`)

### Content

- [x] All copy reviewed (no em dashes, no LARP language)
- [x] FAQ matches actual flow
- [x] Rules match EMEA 2026 rulebook
- [x] Footer social links correct, Discord invite permanent
- [x] favicon + og:image + apple-touch-icon present
- [ ] **All `Coming Soon` placeholders shipped or hidden**
  - **Verify:** `Grep 'Coming Soon' src/` returns 0 in production code paths.
- [x] Player seed data matches CLAUDE.md roster
- [ ] **First 4 weeks of clashes seeded on calendar**
  - **Verify:** `SELECT COUNT(*) FROM tournaments WHERE date > now() AND date < now() + interval '28 days'` >= 4.

### Legal

- [x] Privacy Policy and Terms reachable
- [ ] **Privacy Policy lists every data processor**
  - **Required:** Supabase, PayPal, Discord (OAuth), Sentry, Vercel, your email provider, your analytics if any.
  - **Verify:** Read `/privacy` -- each must be named.
- [ ] **Terms cover refund policy + ban policy + content ownership**
  - **Verify:** Read `/terms` against checklist.
- [ ] **GDPR data export tool exists**
  - **What:** Admin can export all data for a given user as JSON.
  - **Verify:** OpsMaintenance or AdminScreen has button. Test on dummy user.
- [ ] **GDPR account deletion tool exists**
  - **What:** Admin can soft-delete a user (anonymize + remove PII, keep aggregate stats).
  - **Verify:** Tool present, dry-run on dummy user.
- [x] Riot Games Developer Policies reviewed (riot.txt in public/)
- [ ] **Cookie banner remembers consent across sessions**
  - **Verify:** Accept, hard reload, banner does not reappear.

### Performance

- [ ] **Lighthouse scores: mobile >= 85, desktop >= 90**
  - **Verify:** Run on `/` and `/dashboard` and `/leaderboard`. Document scores in `docs/runbooks/perf-baseline.md`.
- [ ] **LCP < 2.5s on simulated 4G**
  - **Verify:** Lighthouse mobile run.
- [x] Bundle < 250kb gzipped initial route
- [x] Routes lazy-loaded
- [x] Fonts: `font-display: swap`
- [ ] **Images: lazy loaded below the fold**
  - **Verify:** Grep `<img` in screens, ensure `loading="lazy"` except hero/nav images.
- [ ] **Mobile: tested on real iOS Safari and Android Chrome**
  - **Verify:** Tester runs through signup, register, view leaderboard. No horizontal scroll, no z-index bugs, drawer works.

### Accessibility

- [ ] **All images have `alt` (decorative use `alt="" aria-hidden="true"`)**
  - **Verify:** Lighthouse a11y check passes.
- [x] All buttons have visible text or `aria-label`
- [x] Focus ring visible on Btn, Inp, Navbar
- [ ] **Color contrast >= 4.5:1 for body text**
  - **Verify:** Lighthouse a11y check.
- [ ] **`prefers-reduced-motion` respected**
  - **Verify:** Toggle OS setting, animations either disabled or reduced.
- [ ] **Keyboard nav: full signup flow without mouse**
  - **Verify:** Tab through, Enter to submit, no traps.

---

## P2 -- Launch week required

These can ship within 5 days of launch. Not blockers but should not slip past week 1.

- [ ] **Status page** at `status.tftclash.com` -- can be a Vercel-hosted simple page or third party (Better Stack free tier)
- [ ] **Google Search Console verified, sitemap submitted**
  - **Verify:** GSC dashboard shows site verified and sitemap.xml indexed.
- [ ] **`robots.txt` and `sitemap.xml` served from `public/`**
  - **Verify:** `curl https://tftclash.com/sitemap.xml` returns valid XML.
- [ ] **Open Graph preview tested on Discord, X, WhatsApp**
  - **Verify:** Share `https://tftclash.com/` in each. Preview shows og:image + title + description.
- [ ] **Press kit at `/media-kit`** with logo files (PNG + SVG), screenshots, one-paragraph blurb
- [ ] **Day 3 + Day 7 retention email** drafted and scheduled (Supabase Auth + simple cron)
- [ ] **Weekly recap content generation tested** (CommandCenter > Content Engine)
- [ ] **Discord bot or webhook posting clash results to public channel**
- [ ] **Analytics dashboard:** at minimum, daily active users + signups per day. Can be a Supabase view + chart, no need for Plausible/GA on day one.

---

## P3 -- First month post-launch

- [ ] **Lighthouse perf budget enforced in CI** (fail PR if score drops > 5 pts)
- [ ] **DB query review:** find any query > 200ms in `pg_stat_statements`, optimize or index
- [ ] **Dead code cleanup:** legacy App.jsx orchestration extracted to screens
- [ ] **Component duplication:** consolidate PageHeader / SectionHeader / SectionTitle
- [ ] **Service worker cache strategy** reviewed (currently network-first; consider stale-while-revalidate for static assets)
- [ ] **Sentry: tag releases, set up release health (crash-free sessions metric)**
- [ ] **Onboarding tour** for first-time users on Dashboard
- [ ] **Email digest** (weekly) of own player stats sent to opted-in users

---

## Launch day runbook

### T-24h

- [ ] Final smoke test: complete the Core Flows section above with timestamps
- [ ] Verify all P0 items are green
- [ ] Verify all P1 monitoring items: Sentry, uptime, Discord alerts firing on test events
- [ ] Confirm rollback works: deploy a test commit, run `vercel rollback`, confirm site reverts
- [ ] Pre-write 3 announcement variants (excited / measured / oh-no-rollback)
- [ ] Charge phone, fill water bottle

### T-2h

- [ ] Hard-reload site in incognito on mobile + desktop, click through major pages
- [ ] Check Sentry is empty of new issues
- [ ] Check `/api/health` responds <100ms
- [ ] Confirm Discord announcement is queued, not sent
- [ ] Confirm one trusted person is on-call backup

### T-0 (announcement)

- [ ] Post Discord announcement
- [ ] Post X / Reddit r/CompetitiveTFT announcements
- [ ] Watch Sentry, watch Discord #feedback, watch DB CPU graph in Supabase
- [ ] Stay near keyboard for first 4 hours

### T+4h

- [ ] First check-in: error rate, signup count, any crash reports
- [ ] Triage: anything > "small annoyance" gets a same-day patch or feature flag

### T+24h

- [ ] Daily summary: signups, errors, DB rows added, Discord sentiment
- [ ] Decide: continue, pause marketing push, or rollback

---

## Rollback triggers (automatic decision rules)

If any of the following are true, run `vercel rollback` to last known good deploy:

- Sentry error rate > 2% of sessions over any 15min window
- `/api/health` returns non-200 for > 5min
- Supabase DB CPU sustained > 80% for > 10min (likely a runaway query)
- > 5 distinct users report inability to sign up or log in
- Payment webhook returning 5xx for > 5min
- Any auth bypass discovered (immediate, no debate)

---

## On-call protocol (first 2 weeks)

- Primary: you, daytime Europe hours
- Backup: trusted Discord mod with admin role and your phone number
- Escalation: if site down > 30min, post status to Discord + status page
- Every issue gets a GitHub issue, even if you fix it the same hour. This is your bug list for week 2.

---

## Known issues carried into launch (acceptable)

- Legacy App.jsx still has ~700 lines of orchestration. Not user-facing.
- Some shared component duplication (PageHeader vs SectionHeader). Internal only.
- Some screens still use `var` + `function() {}` patterns inconsistent with rest. Internal only.

---

## Hard blockers (recap, do not launch if true)

- Any P0 item is open
- Sentry not capturing errors
- PayPal webhook accepts unsigned requests
- A single core flow in the smoke test fails
- Supabase backup has never been restored
- A screen crashes without `ScreenBoundary` fallback

---

## Verification commands (handy reference)

```bash
# Migrations applied
supabase migration list --linked

# Env vars in prod
vercel env ls production

# Health
curl -i https://tftclash.com/api/health

# RLS policies count
psql "$DATABASE_URL" -c "SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname='public' GROUP BY 1 ORDER BY 1"

# Standings reconciliation (replace season id)
psql "$DATABASE_URL" -c "SELECT p.id, p.username, p.season_pts, COALESCE(SUM(CASE gr.placement WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 6 WHEN 4 THEN 5 WHEN 5 THEN 4 WHEN 6 THEN 3 WHEN 7 THEN 2 WHEN 8 THEN 1 END), 0) AS computed FROM players p LEFT JOIN game_results gr ON gr.player_id = p.id WHERE gr.season_id = (SELECT id FROM seasons WHERE active LIMIT 1) GROUP BY p.id, p.username, p.season_pts HAVING p.season_pts <> COALESCE(SUM(...),0)"
```
