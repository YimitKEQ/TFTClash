# TFT Clash - Launch Readiness Audit (2026-06-09)

> **STATUS UPDATE 2026-06-10:** Criticals 1-4 are SHIPPED. Migration 115 applied to
> production (claim_standby_seat guard verified live, promote_next_waitlisted RPC live,
> anon revokes, indexes, notifications dropped from realtime publication). Waitlist is
> now DB-backed (registrations.status='waitlisted') with atomic FIFO auto-promotion in
> ClashScreen + DashboardScreen + AppContext. Refetch storm defused (5-15s jittered
> debounce + hidden-tab gate). Write retries with Sentry capture via src/lib/dbRetry.js.
> Load test script at scripts/loadtest.mjs. STILL MANUAL: Supabase dashboard - switch
> Auth pool to percentage-based, enable leaked-password protection. STILL OPEN: run the
> load test before Saturday.

Production-grade audit ahead of the Saturday clash. Evidence-based: every infrastructure
finding below was verified against the live Supabase project (advisors, pg_policies,
pg_stat_statements, pg_stat_activity), the production bundle in `dist/`, and the source.

**Live project facts measured during the audit:**

- Postgres `max_connections` = **60**, with **31 already in use at idle** (PostgREST pool,
  Auth, Realtime, Storage hold standing connections). Headroom for bursts: ~25-29.
- Auth server capped at **10 DB connections** (advisor `auth_db_connections_absolute`).
- `pg_stat_statements`: the **Realtime WAL poller is the #1 consumer of the entire
  database** - 3.69M calls, ~9.0 hours cumulative exec time (the #2 entry is the same
  poller on another slot at 1.2 hours). Everything else is noise by comparison.
- 15 tables in the `supabase_realtime` publication, including `players`, `game_results`,
  `registrations`, `site_settings`, `lobbies`, `pending_results`, `notifications`,
  `tournaments`.
- Advisors: 254 `multiple_permissive_policies` warnings, 35 unindexed FKs, 72 unused
  indexes, 7 `auth_rls_initplan` policies, 1 duplicate index, leaked-password protection
  disabled, 3 SECURITY DEFINER RPCs executable by `anon`.
- DB size 21 MB. `game_results` 152 rows today - will grow ~768 rows per 128-player
  6-game clash.
- Production JS: 4.5 MB total; largest chunks `vendor` 664 KB, `augments` 620 KB,
  `items` 212 KB, `champions` 132 KB (TFT static data), `AdminScreen` 168 KB.

---

## 1. Why the database fell over last time (root cause)

The previous "database failures and rate-limiting" almost certainly had **one mechanism
with three multipliers**:

**Mechanism - Realtime fan-out × per-client refetch storm.**
`AppContext.jsx` subscribes every connected browser to whole-table `postgres_changes`
on `players` AND `game_results` (`AppContext.jsx:762-768`). Any change to either table
schedules `loadPlayersFromTable()` - a 3-query waterfall: all 184 players, all
season tournament ids, and **up to 50,000 `game_results` rows** (`AppContext.jsx:285-291`).

During a live clash, score entry writes `game_results` continuously. So:

> every result entered → broadcast to N browsers → N browsers each re-download the
> entire season's game_results within 5 seconds.

With 128 concurrent viewers and a result entered every few seconds, that is a sustained
~25 full-table reads/sec against PostgREST, which shares a 60-connection Postgres.
Meanwhile Supabase Realtime itself does per-subscriber RLS evaluation for
`postgres_changes` - its cost scales with (changes × subscribers), which is why the WAL
poller already dominates `pg_stat_statements` even at friend-group scale.

**Multipliers:**
1. The 5s debounce (`AppContext.jsx:754-761`) collapses bursts per client but does
   nothing across clients - all N clients fire in the same 5s window (synchronized
   thundering herd, no jitter).
2. Refetches run even for hidden/background tabs - people leave the standings open.
3. Mass login at clash time funnels through an Auth server capped at 10 DB connections;
   PKCE + token refresh storms queue behind it (visible in pg_stat_statements:
   `flow_state` inserts at 63ms mean even at low load).

**Verdict:** the app does not need a bigger instance to survive Saturday - it needs to
stop multiplying reads by viewers. Fixes in section 3 (CRIT-2, CRIT-3).

---

## 2. Critical findings (fix before Saturday)

### CRIT-1 - Waitlist is silently lost for every non-admin player
**What:** When a clash is full, `handleRegister()` (`ClashScreen.jsx:2249-2259`) adds the
player to `tournamentState.waitlistIds` **locally** and toasts "added to waitlist". But
the only thing that persists `tournamentState` is the admin-gated effect
(`AppContext.jsx:839-848`, `if(supabase.from&&isAdmin)`), and RLS on `site_settings`
correctly blocks non-admin writes anyway. So a player's waitlist entry exists only in
their own tab and evaporates on refresh. No other admin browser ever sees it.
**Why it matters:** Saturday is exactly when the clash fills and the waitlist matters.
Players will believe they're queued; they are not. This also means waitlist promotion
order is unrecoverable.
**Severity/likelihood:** Critical / near-certain at 128+ signups.
**Fix:** Persist waitlist in the `registrations` table like everything else:
```js
// ClashScreen.jsx handleRegister(), full-tournament branch — replace the
// setTournamentState-only block with a real registration row:
supabase.from('registrations').upsert({
  tournament_id: tournamentState.dbTournamentId,
  player_id: linkedPlayer.id,
  status: 'waitlisted'
}, { onConflict: 'tournament_id,player_id' })
```
The realtime `registrations` handler in AppContext already treats unknown statuses as
"remove from registered/checked-in", so add a branch that maintains `waitlistIds` from
`status==='waitlisted'` rows, and include waitlisted rows in the initial reconcile
(`AppContext.jsx:639-657`). Check the `registrations.status` CHECK constraint allows
`'waitlisted'` before shipping (migration 100/101 added status constraints).

### CRIT-2 - Refetch storm: every game_results/players change makes every browser re-download the season
**What:** Section 1 mechanism. `AppContext.jsx:748-768`.
**Why:** This is the proven outage path; it gets strictly worse every week as
`game_results` grows.
**Fix (minimal, safe, ~15 lines in AppContext):**
1. **Jitter the debounce across clients** so refetches spread over a window:
```js
function scheduleLoadPlayers(){
  if(loadDebounceTimer)clearTimeout(loadDebounceTimer);
  var delay=5000+Math.floor(Math.random()*10000); // 5-15s, desynchronized
  loadDebounceTimer=setTimeout(function(){
    loadDebounceTimer=null;
    if(document.visibilityState==='hidden'){hiddenDirtyRef.current=true;return;}
    loadPlayersFromTable();
  },delay);
}
```
2. **Skip refetch for hidden tabs**, refetch once on `visibilitychange` if dirty.
3. **Slice the enrichment query**: select only needed columns is already done; add
   `.gte('created_at', seasonStartIso)` once seasons exist, and lower `.limit(50000)`
   to a realistic ceiling (e.g. 10000).
**Structural fix (post-launch, HIGH-1):** compute standings server-side in a view/RPC so
clients fetch ~184 aggregated rows instead of every game ever played.

### CRIT-3 - Trim the realtime publication and subscriptions
**What:** 15 tables are in `supabase_realtime`; every visitor (including signed-out
home-page traffic) opens 4+ channels with whole-table subscriptions. Realtime
`postgres_changes` evaluates RLS per change per subscriber and is the documented
scaling bottleneck; it is already the top DB consumer.
**Fix:**
- Remove from the publication tables nothing on the client subscribes to
  (`bt_*` x7, `tournaments`, `notifications` if unused by realtime):
  `alter publication supabase_realtime drop table public.bt_content_cards, ...;`
- In AppContext, don't open the `players_realtime`/`game_results_realtime` channels for
  signed-out visitors on static pages; they only need `site_settings` (ticker/state).
- Long-term: switch score updates to a single **broadcast channel** keyed by tournament
  id (Supabase Broadcast doesn't touch the WAL poller or per-subscriber RLS).

### CRIT-4 - `claim_standby_seat` lets any signed-in user promote any player and bypass the seat cap
**What:** SECURITY DEFINER, executable by `authenticated` (and `anon` per advisor), with
no ownership check; `p_seat_cap` is caller-supplied and a NULL/0 cap skips the capacity
check entirely (verified against live `pg_proc` source).
**Why:** Griefing vector on tournament day: over-fill the bracket, force-promote players
who sat out, corrupt seeding.
**Fix:** Migration `115_launch_hardening.sql` (APPLIED 2026-06-10) - requires caller to
be service_role (Discord bot), admin/mod, or the owner of `p_player_id`, and clamps the
cap to `tournaments.max_players`. Discord bot confirmed on the service key
(`discord-bot/utils/supabase.js` uses SUPABASE_SERVICE_ROLE_KEY), and the guard was
verified live against production.

### CRIT-5 - Auth server capped at 10 DB connections during a mass-login window
**What:** Advisor `auth_db_connections_absolute`. Login bursts (everyone signs in at
check-in time), PKCE flow-state inserts and refresh-token rotations all funnel through
10 connections out of 60.
**Fix:** In Supabase dashboard → Auth settings, switch the Auth pool to the recommended
percentage-based allocation (or raise to ~15-20). Zero code change, 2 minutes. While in
the dashboard: **enable leaked-password protection** (currently off) - it's free.

### CRIT-6 - No load test has ever been run
**What:** Nothing in the repo simulates concurrent load; previous failures were
discovered live.
**Fix (2-3 hours):** a k6 or even plain-Node script that, with 100-200 virtual users:
signs in (or reuses tokens), opens the realtime socket, polls `/rest/v1/players`,
upserts a registration, flips it to checked_in. Run Thursday, watch
`pg_stat_activity`/dashboard. This converts Saturday from a hope into a rehearsal.
A starter script outline is in section 7.

---

## 3. High priority (days after launch)

### HIGH-1 - Server-side standings (kills the N×season-history download permanently)
Create a `season_standings` view (or matview refreshed on write) aggregating
`game_results` by player for `type='season_clash'` tournaments; client fetches 184 rows.
The enrichment loop in `loadPlayersFromTable` (`AppContext.jsx:288-330`) reduces to one
select. This also fixes the "every client recomputes streaks in JS" CPU burn on mobile.

### HIGH-2 - Consolidate duplicate RLS policies (254 advisor hits)
Most-read tables (`players`, `game_results`, `registrations`, `activity_feed`,
`announcements`, `event_registrations`, `gear_items`...) have 2-3 permissive SELECT
policies each, ALL evaluated per row per query. Merge to one policy per action per
table. Mechanical but touchy - do it with a checklist, table by table, re-running the
advisor after each. Also fix the 7 `auth_rls_initplan` policies (wrap `auth.uid()` in
`(select auth.uid())`) on `standby_pool`, `team_event_rsvps`, `team_event_ringers`,
`soft_bans`, `subscriptions`.

### HIGH-3 - tournament_state JSON blob is a single point of failure and a race
The entire live clash (phase, lobbies, cut state, round history) is one JSONB value in
`site_settings`, rewritten wholesale from the admin's browser on every state change
(`AppContext.jsx:839-848`). Risks: two admin tabs = last-writer-wins wipes; admin's
laptop sleeping mid-clash stalls automation (auto-advance/auto-checkin run **in the
admin's browser**, `AppContext.jsx:870-898`); one malformed write bricks every client.
Post-launch: move phase/round to the `tournaments` row (already has `phase`), keep the
blob for cosmetic state only, and move auto-phase-advance to `api/cron.js` or a
pg_cron job so it doesn't depend on an open admin tab.
**Saturday mitigation:** one admin browser tab only, on a machine that won't sleep.

### HIGH-4 - Observability for tournament day
Sentry is wired (good: `main.jsx`, errors only). Gaps: no alerting, no DB-side
visibility, no uptime check.
- Create a Supabase dashboard bookmark: Reports → Database for connections/CPU; have it
  open during the clash.
- Add a Sentry alert rule (error rate spike → Discord webhook).
- Add `navigator.sendBeacon`-based custom event or Sentry `captureMessage` on
  registration/check-in failure paths (currently they only toast - you will not know
  players are failing unless they tell you; `ClashScreen.jsx:2292-2301,2345-2346`).
- `api/health.js` exists - point an uptime monitor (UptimeRobot/BetterStack free tier)
  at it now.

### HIGH-5 - Client retry/backoff is inconsistent
`loadPlayersFromTable` has a 3-retry backoff (good). Registration/check-in writes have
none - a single transient 5xx during the burst shows "Registration failed" and the
player gives up. Add one retry with 1-2s backoff + jitter for the three write paths in
ClashScreen (register/unregister/checkin); keep optimistic UI as is (it's already
optimistic-with-rollback, which is the right pattern).

### HIGH-6 - Bundle: 620 KB of TFT static data ships to everyone who opens the builder
`augments` (620 KB) + `items` (212 KB) + `champions` (132 KB) are code-split (good) but
gzip can't save JSON-as-JS that big on mobile. Move to static `.json` in `/public`
fetched on demand with `Cache-Control: immutable`, or trim unused fields. `vendor`
664 KB likely contains three.js via `horizon-hero-section` - it's lazy-routed
(`App.jsx:92`), so confirm with `npx vite-bundle-visualizer` that three isn't leaking
into the shared vendor chunk; if it is, add a manualChunks rule.

---

## 4. Medium priority

- **MED-1 Index hygiene:** 72 unused indexes add write amplification on every
  registration/result insert. After the season's first real weekend (real query
  patterns), drop the dead ones. The hot-FK additions are in migration 115.
- **MED-2 `select('*')` discipline:** `players` select pulls every column including
  `notes` (admin-only content? verify) and `sponsor_json` for all 184 rows on every
  refetch. Name the columns; it also keeps payloads stable as columns get added.
- **MED-3 AppContext size/coupling:** 1300 lines, ~40 useState slices, one context →
  every consumer re-renders on any change (toasts re-render the bracket). Split into
  AuthContext / TournamentContext / UIContext post-launch; or at minimum memoize heavy
  screens with `React.memo` and move `toasts` out of the main context value.
- **MED-4 Per-component countdown timers:** `CountdownTimer` ticks per-second per
  instance; events list can mount many. Fine today; share one ticking source later.
- **MED-5 Admin-browser Discord webhook + no-show marking** (`AppContext.jsx:900-957`)
  belong server-side eventually (cron or DB trigger + edge function) - they silently
  don't happen if the admin closes the tab at the wrong moment.
- **MED-6 `api/public.js` caching is good** (s-maxage=120 + SWR). Apply the same
  pattern to `api/widget.js` and `api/calendar.js` if not already; they're hit by
  third-party embeds.
- **MED-7 Tests:** unit tests cover the scoring engine well; there is zero coverage on
  AppContext realtime reducers (the registration INSERT/UPDATE/DELETE handlers).
  Those are pure functions begging for extraction to `lib/registrationState.js` + tests.
- **MED-8 Dead code:** `TournamentDetailScreen.jsx` (1467 lines) is known-dead - delete
  it; it still ships risk via accidental route resurrection. Run knip for the rest.

---

## 5. Security posture summary

Good news: the historical critical (players self-modifying `season_pts`) is fixed - the
UPDATE policy diffs protected fields via `get_own_player_fields`. RLS is enabled on all
69 tables. `site_settings` writes are admin-only at the DB level. Serverless endpoints
verify JWTs server-side with the service key (`discord-notify.js` checks `user_roles`).
CSP, HSTS, X-Frame-Options are set in `vercel.json` and reasonably tight.

Remaining items, in order:
1. CRIT-4 `claim_standby_seat` (above).
2. Revoke `anon` EXECUTE on `archive_lft_on_team_join`, `leave_team`,
   `transfer_captaincy` (in migration 115). The other ~20 authenticated-callable
   SECURITY DEFINER RPCs were spot-checked and DO have internal admin/ownership checks
   (`admin_grant_subscription`, `softban_add/remove`, `increment_dnp_for_players`,
   `notify_tournament_players`, `leave_team`, `transfer_captaincy` verified).
3. Enable leaked-password protection (dashboard toggle).
4. `clear_stale_tournament_state` is callable by any authenticated user; it only clears
   state whose tournament row is gone, so abuse impact is low - acceptable.
5. CSP allows `'unsafe-inline'` scripts (needed for GTM today). Post-launch: nonce-based.

---

## 6. Product / UX review (directional, not exhaustive)

Strengths seen in code: consistent Panel/Btn/Icon primitives, optimistic check-in with
rollback toasts, countdowns everywhere, per-screen error boundaries with lazy retry,
an offline banner driven by realtime channel state.

Opportunities, highest leverage first:
1. **Tournament-day "single pane"**: on clash day, the player's job is
   register → check in → find lobby → report score. Today that journey spans
   Clash/Dashboard/Bracket screens. A persistent sticky "match bar" (current phase,
   countdown, your lobby + code, one CTA) rendered on every route during an active
   clash would collapse the #1 source of day-of confusion. This is the single most
   memorable upgrade available and is additive (one shared component reading
   tournamentState; no backend change).
2. **Check-in feedback under failure**: writes that fail only toast. On tournament day,
   make the check-in button show explicit pending → confirmed (server ack) states; on
   error keep the button in "retry" state instead of a vanishing toast.
3. **Empty/loading states**: screens render `players=[]` honestly, but several compute
   derived stats from empty arrays and show "0" rather than skeletons during
   `isLoadingData`. Audit the 5 player-facing screens for skeletons (Standings,
   Leaderboard, Events, Clash, Dashboard).
4. **Waitlist UX** (pairs with CRIT-1): show queue position and auto-promote
   notification; it's a retention moment, not an apology.
5. **Accessibility quick pass**: icon-only buttons need `aria-label`; check focus
   states on the dark theme (focus ring vs surface contrast); toasts should be
   `role="status"`.
6. **Mobile bracket**: 1440-line BracketScreen renders dense admin tables; players on
   phones during the clash mostly need "my lobby + standings". Consider a
   player-mode collapse on <md.

---

## 7. Load test sketch (CRIT-6)

```js
// scripts/loadtest.mjs — run with: node scripts/loadtest.mjs 150
// Requires a pool of test users (seed once) or pre-issued refresh tokens.
import { createClient } from '@supabase/supabase-js'
const N = Number(process.argv[2] || 100)
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_ANON_KEY
async function virtualUser(i) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } })
  await sb.auth.signInWithPassword({ email: `lt${i}@test.tftclash.gg`, password: process.env.LT_PASS })
  const ch = sb.channel('shared_state')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => {})
    .subscribe()
  for (let t = 0; t < 30; t++) {                       // ~5 min of "tournament behavior"
    await sb.from('players').select('id,username,season_pts').limit(200)
    if (t === 2) await sb.from('registrations').upsert({ tournament_id: process.env.LT_TID, player_id: process.env['LT_PID_'+i], status: 'registered' }, { onConflict: 'tournament_id,player_id' })
    if (t === 5) await sb.from('registrations').update({ status: 'checked_in' }).eq('tournament_id', process.env.LT_TID).eq('player_id', process.env['LT_PID_'+i])
    await new Promise(r => setTimeout(r, 8000 + Math.random() * 8000))
  }
  await sb.removeChannel(ch)
}
await Promise.allSettled(Array.from({ length: N }, (_, i) => virtualUser(i)))
```
Watch during the run: Supabase dashboard DB connections/CPU, `select count(*) from
pg_stat_activity`, realtime message counts, and whether the app stays responsive in a
real browser alongside.

---

## 8. Over- vs under-engineering

**Over:** 69 tables for a platform whose live tables number ~10 (bt_*, content engine,
trend_cache, social_connections are a separate product living in the same DB - they
inflate the RLS advisor surface and the realtime publication); 72 unused indexes;
7 realtime channels per client when 2-3 carry all the value.
**Under:** no load testing, no server-side aggregation (standings), no queue/server
authority for tournament automation (admin-browser-as-server), no alerting.
The single JSONB tournament_state blob is both: elaborate client sync logic built on an
under-engineered storage primitive.

---

## 9. Prioritized action plan

**Critical (before Saturday)** - order matters:
1. CRIT-5 Auth pool % + leaked-password toggle (dashboard, 5 min, zero risk).
2. Apply migration `115_launch_hardening.sql` after confirming the Discord bot uses the
   service key for `claim_standby_seat` (15 min).
3. CRIT-1 waitlist persistence via `registrations.status='waitlisted'` (1-2 h + test).
4. CRIT-2 jittered debounce + visibility gate in AppContext (30 min + test).
5. CRIT-3 drop unsubscribed tables from the realtime publication (15 min).
6. CRIT-6 load test Thursday; fix what it surfaces Friday.
7. Ops: one admin tab, machine awake, Supabase dashboard open, uptime monitor on
   /api/health.

**High (week after):** HIGH-1 server-side standings; HIGH-2 RLS consolidation;
HIGH-3 move automation server-side; HIGH-4 alerting; HIGH-5 write retries;
HIGH-6 static-data bundle diet.

**Medium (this month):** MED-1..8 above.

**Future:** broadcast-channel score streaming; split AppContext; tournament-day match
bar (section 6.1) as the flagship UX feature; player-mode mobile bracket; nonce CSP;
move bt_*/content-engine product to its own Supabase project.
