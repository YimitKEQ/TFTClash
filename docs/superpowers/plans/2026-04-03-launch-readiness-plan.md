# TFT Clash Launch Readiness - Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, security, and high-severity issues to make TFT Clash launch-ready by April 17, 2026.

**Architecture:** Fix-in-place across the existing React 18 SPA + Supabase + Vercel stack. No architectural rewrites - targeted surgical fixes. Work is decomposed into 6 phases that can be executed sequentially, with phases 1-3 being mandatory for launch and phases 4-6 being high-value polish.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Supabase (Postgres + Auth + Storage), Vercel Serverless, Stripe

**IMPORTANT CODE STYLE RULES (from CLAUDE.md):**
- Use `var` declarations, `function(){}` callbacks - NO arrow functions, NO IIFEs in JSX
- No backtick string literals inside JS functions
- No named function components defined inside another component's body
- New/migrated screens use Tailwind CSS, `useApp()` for state, `<Icon>` for Material Symbols

---

## Phase 1: Security Fixes (MANDATORY - Do First)

### Task 1.1: Fix `is_admin` Self-Escalation via RLS

**Files:**
- Create: `supabase/migrations/050_fix_admin_escalation.sql`

Any authenticated user can currently set `is_admin: true` on their own player row because the UPDATE policy allows all columns.

- [ ] **Step 1: Create migration to restrict player self-update**

```sql
-- 050_fix_admin_escalation.sql
-- Fix: players UPDATE policy allows users to set is_admin on themselves
-- The old policy "Users can update own player" allows ALL columns.
-- Replace with a policy that blocks sensitive fields.

BEGIN;

DROP POLICY IF EXISTS "Users can update own player" ON players;

-- Users can update their own row but cannot change admin/role fields
-- We use a WITH CHECK that ensures is_admin stays unchanged
CREATE POLICY "Users can update own player safely" ON players
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (
    auth.uid() = auth_user_id
    AND is_admin IS NOT DISTINCT FROM (SELECT p.is_admin FROM players p WHERE p.auth_user_id = auth.uid())
  );

COMMIT;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run: `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/050_fix_admin_escalation.sql
git commit -m "fix: prevent is_admin self-escalation via RLS policy"
```

---

### Task 1.2: Fix Audit Log Readable by All Users

**Files:**
- Create: `supabase/migrations/051_restrict_audit_log.sql`

- [ ] **Step 1: Create migration**

```sql
-- 051_restrict_audit_log.sql
BEGIN;

DROP POLICY IF EXISTS "Authenticated can read audit log" ON audit_log;

CREATE POLICY "Admins read audit log" ON audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin = true)
  );

COMMIT;
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

---

### Task 1.3: Add Missing Columns to `players` Table

**Files:**
- Create: `supabase/migrations/052_add_player_columns.sql`

Admin panel writes to `banned`, `checked_in`, `notes`, `role` columns that don't exist.

- [ ] **Step 1: Create migration**

```sql
-- 052_add_player_columns.sql
BEGIN;

ALTER TABLE players ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS role text DEFAULT 'player';

-- Add check constraint for role
ALTER TABLE players ADD CONSTRAINT players_role_check
  CHECK (role IN ('player', 'pro', 'host', 'admin'))
  NOT VALID;

COMMIT;
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

---

### Task 1.4: Fix Stripe Webhook `VITE_` Env Var

**Files:**
- Modify: `api/stripe-webhook.js:63-64`

The webhook uses `process.env.VITE_SUPABASE_URL` which is a Vite client-side variable - never available in Vercel serverless functions.

- [ ] **Step 1: Fix the env var reference**

In `api/stripe-webhook.js`, change:
```js
// OLD
process.env.VITE_SUPABASE_URL,
```
to:
```js
// NEW
process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
```

- [ ] **Step 2: Update `.env.example` to document `SUPABASE_URL`**

Add after the VITE vars:
```
# Server-side Supabase URL (same value as VITE_SUPABASE_URL, but accessible in serverless functions)
SUPABASE_URL=your-supabase-url
```

- [ ] **Step 3: Commit**

```bash
git add api/stripe-webhook.js .env.example
git commit -m "fix: use SUPABASE_URL instead of VITE_ prefix in webhook"
```

---

### Task 1.5: Fix `ping-search-engines` No Auth

**Files:**
- Modify: `api/ping-search-engines.js`

- [ ] **Step 1: Add admin secret check**

Add at the top of the handler, after the existing imports:
```js
var PING_SECRET = process.env.PING_SECRET || process.env.ADMIN_PASSWORD;

module.exports = function(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Require secret
  var secret = req.headers['x-ping-secret'] || (req.body && req.body.secret);
  if (!PING_SECRET || secret !== PING_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // ... rest of handler
```

- [ ] **Step 2: Commit**

---

## Phase 2: Critical Data Fixes (MANDATORY)

### Task 2.1: Fix `PREMIUM_TIERS` id Mismatch

**Files:**
- Modify: `src/lib/constants.js:199`

`PREMIUM_TIERS` uses `id:"org"` but `TIER_FEATURES` uses key `"host"`. Every Host subscriber gets free-tier features.

- [ ] **Step 1: Change the id from "org" to "host"**

In `src/lib/constants.js`, change:
```js
{id:"org", name:"Host", price:"\u20AC24.99", period:"/ month", color:"#9B72CF",
```
to:
```js
{id:"host", name:"Host", price:"\u20AC24.99", period:"/ month", color:"#9B72CF",
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants.js
git commit -m "fix: PREMIUM_TIERS id 'org' -> 'host' to match TIER_FEATURES"
```

---

### Task 2.2: Fix `applyCutLine` Boundary Bug

**Files:**
- Modify: `src/lib/tournament.js:113`

Players with exactly the cut line points are incorrectly eliminated.

- [ ] **Step 1: Change `>` to `>=`**

```js
// OLD
if (pts > cutLine) { advancing.push(p); }
// NEW
if (pts >= cutLine) { advancing.push(p); }
```

- [ ] **Step 2: Commit**

---

### Task 2.3: Fix Dead `/clash` Route in DashboardScreen

**Files:**
- Modify: `src/screens/DashboardScreen.jsx:743,749,769`

Three buttons navigate to `/clash` which doesn't exist. Should be `/bracket`.

- [ ] **Step 1: Replace all `/clash` navigations with `/bracket`**

Find and replace all `navigate('/clash')` with `navigate('/bracket')` in DashboardScreen.jsx.

- [ ] **Step 2: Commit**

```bash
git add src/screens/DashboardScreen.jsx
git commit -m "fix: route /clash does not exist, use /bracket"
```

---

### Task 2.4: Fix `profileComplete` Checking Wrong Field

**Files:**
- Modify: `src/screens/DashboardScreen.jsx:992`

`profileComplete` checks `currentUser.riotId` which never exists on Supabase auth user objects. This blocks ALL users from registering.

- [ ] **Step 1: Fix to check linkedPlayer instead**

```js
// OLD
var profileComplete = currentUser && currentUser.riotId && currentUser.riotId.trim().length > 0
// NEW
var profileComplete = linkedPlayer && (linkedPlayer.riot_id || linkedPlayer.riotId || (linkedPlayer.riot_id_eu && linkedPlayer.riot_id_eu.trim().length > 0))
```

- [ ] **Step 2: Commit**

---

### Task 2.5: Fix HoF `byTop4` Sort Inversion

**Files:**
- Modify: `src/screens/HofScreen.jsx:56-60`

Variable names `aRate`/`bRate` are swapped - shows the WORST player as "Top 4 Machine".

- [ ] **Step 1: Fix the variable assignment**

```js
// OLD
var byTop4 = wp.slice().sort(function(a, b) {
  var aRate = b.games > 0 ? (b.top4 || 0) / b.games : 0
  var bRate = a.games > 0 ? (a.top4 || 0) / a.games : 0
  return aRate - bRate
})
// NEW
var byTop4 = wp.slice().sort(function(a, b) {
  var aRate = a.games > 0 ? (a.top4 || 0) / a.games : 0
  var bRate = b.games > 0 ? (b.top4 || 0) / b.games : 0
  return bRate - aRate
})
```

- [ ] **Step 2: Commit**

---

### Task 2.6: Fix Em Dash in `generateRecap`

**Files:**
- Modify: `src/lib/stats.js:424`

Project rule: zero em/en dashes in user-facing content.

- [ ] **Step 1: Replace em dash with comma**

```js
// OLD
lines.push("It came down to the wire \u2014 only " + diff + ...
// NEW
lines.push("It came down to the wire, only " + diff + ...
```

- [ ] **Step 2: Grep for any other em/en dashes across the codebase**

Run: `grep -rn '\u2014\|\u2013\|—\|–' src/ --include="*.jsx" --include="*.js"`

Fix any others found.

- [ ] **Step 3: Commit**

---

### Task 2.7: Fix `subscriptions` vs `user_subscriptions` Table Split

**Files:**
- Modify: `src/context/AppContext.jsx` (the subscription read)
- Modify: `api/stripe-webhook.js` (verify which table it writes to)

The webhook writes to `subscriptions`. The app reads from `user_subscriptions`. They are never synced.

- [ ] **Step 1: Change AppContext to read from `subscriptions` table**

Find the line that reads from `user_subscriptions` and change to `subscriptions`. The table the webhook writes to is the source of truth.

- [ ] **Step 2: Verify the webhook writes to `subscriptions`**

Confirm `stripe-webhook.js` upserts into the `subscriptions` table (it does per the audit). No change needed there.

- [ ] **Step 3: Commit**

---

### Task 2.8: Fix `pendingResults` Using Wrong ID Field

**Files:**
- Modify: `src/context/AppContext.jsx:786`

Queries `tournamentState.id` which is always undefined. Should be `tournamentState.dbTournamentId`.

- [ ] **Step 1: Fix the field reference**

```js
// OLD
.eq('tournament_id', tournamentState.id)
// NEW
.eq('tournament_id', tournamentState.dbTournamentId)
```

- [ ] **Step 2: Commit**

---

### Task 2.9: Fix `tftclash.gg` Domain References

**Files:**
- Modify: `src/screens/ResultsScreen.jsx` (canvas download + copyResults)

- [ ] **Step 1: Search and replace all `tftclash.gg` with `tftclash.com`**

Run grep to find all occurrences:
```bash
grep -rn 'tftclash\.gg' src/
```

Replace each one.

- [ ] **Step 2: Also fix JSON-LD URLs in App.jsx**

Change `tft-clash.vercel.app` to `tftclash.com` in the structured data.

- [ ] **Step 3: Commit**

---

### Task 2.10: Fix Missing `increment_season_pts` RPC

**Files:**
- Modify: `src/screens/admin/ResultsTab.jsx:134`

The RPC `increment_season_pts` doesn't exist. `increment_player_stats` exists but takes different params.

- [ ] **Step 1: Check what `increment_player_stats` expects and adapt the call**

Either:
a) Change ResultsTab to call `increment_player_stats` with correct params, OR
b) Replace the RPC call with a direct UPDATE query

- [ ] **Step 2: Commit**

---

## Phase 3: Database Cleanup (MANDATORY)

### Task 3.1: Fix FK Type Mismatches

**Files:**
- Create: `supabase/migrations/053_fix_fk_types.sql`

Multiple migrations use UUID for FKs pointing at BIGINT columns.

- [ ] **Step 1: Create consolidated fix migration**

```sql
-- 053_fix_fk_types.sql
-- Fix FK type mismatches: tournament_rounds, player_reports, disputes, pending_results
-- all use UUID but reference BIGINT identity columns

BEGIN;

-- tournament_rounds: tournament_id should be bigint
ALTER TABLE tournament_rounds
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;

-- player_reports: tournament_id, lobby_id, player_id should be bigint  
ALTER TABLE player_reports
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint,
  ALTER COLUMN lobby_id TYPE bigint USING lobby_id::text::bigint,
  ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;

-- disputes: similar fixes
ALTER TABLE disputes
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint,
  ALTER COLUMN lobby_id TYPE bigint USING lobby_id::text::bigint;

-- pending_results: player_id int->bigint, tournament_id uuid->bigint
ALTER TABLE pending_results
  ALTER COLUMN player_id TYPE bigint,
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;

COMMIT;
```

NOTE: If these tables are empty (they likely are), a simpler approach is to DROP and recreate them. Check with `SELECT count(*) FROM table` first.

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

---

### Task 3.2: Create Missing Tables

**Files:**
- Create: `supabase/migrations/054_create_missing_tables.sql`

`xp_events`, `event_registrations` are queried but never created.

- [ ] **Step 1: Create migration**

```sql
-- 054_create_missing_tables.sql
BEGIN;

CREATE TABLE IF NOT EXISTS xp_events (
  id bigint generated always as identity primary key,
  player_id bigint references players(id) on delete cascade,
  event_type text not null,
  xp_amount integer not null default 0,
  description text,
  created_at timestamptz default now()
);

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp" ON xp_events FOR SELECT TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS event_registrations (
  id bigint generated always as identity primary key,
  event_id bigint references tournaments(id) on delete cascade,
  player_id bigint references players(id) on delete cascade,
  status text default 'registered',
  registered_at timestamptz default now(),
  UNIQUE(event_id, player_id)
);

ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read registrations" ON event_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users register themselves" ON event_registrations FOR INSERT TO authenticated
  WITH CHECK (player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid()));

COMMIT;
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

---

### Task 3.3: Fix `game_results.placement` Allowing 0

**Files:**
- Create: `supabase/migrations/055_fix_placement_check.sql`

- [ ] **Step 1: Create migration**

```sql
-- 055_fix_placement_check.sql
BEGIN;
ALTER TABLE game_results DROP CONSTRAINT IF EXISTS game_results_placement_check;
ALTER TABLE game_results ADD CONSTRAINT game_results_placement_check CHECK (placement BETWEEN 1 AND 8);
COMMIT;
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

---

## Phase 4: UI/UX Fixes (HIGH VALUE)

### Task 4.1: Wire PricingScreen Pro Button to Stripe

**Files:**
- Modify: `src/screens/PricingScreen.jsx`

The Pro subscribe button is currently a dead "Coming Soon" div.

- [ ] **Step 1: Add checkout handler**

Add a function that calls `/api/create-checkout`:
```js
var handleSubscribe = function(plan) {
  if (!currentUser) {
    navigate('/login')
    return
  }
  fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: plan,
      userId: currentUser.id,
      email: currentUser.email,
      successUrl: window.location.origin + '/account?subscription=success',
      cancelUrl: window.location.origin + '/pricing'
    })
  })
  .then(function(res) { return res.json() })
  .then(function(data) {
    if (data.url) window.location.href = data.url
  })
  .catch(function(err) {
    console.error('Checkout error:', err)
  })
}
```

- [ ] **Step 2: Replace the dead "Coming Soon" div with a real button**

Replace the disabled div with:
```jsx
<Btn variant="primary" onClick={function() { handleSubscribe('pro') }}>
  Go Pro
</Btn>
```

- [ ] **Step 3: Commit**

---

### Task 4.2: Fix Admin Season Toggle Controls

**Files:**
- Modify: `src/screens/admin/SettingsTab.jsx`

`regOpen` and `seasonActive` toggles never save to DB.

- [ ] **Step 1: Add save handlers that write to site_settings**

Each toggle should call a save function that upserts to `site_settings` with the `season_config` key, updating the relevant field in the JSON.

- [ ] **Step 2: Commit**

---

### Task 4.3: Fix PlayerProfileScreen - Add Riot ID Display

**Files:**
- Modify: `src/screens/PlayerProfileScreen.jsx`

The user specifically complained about Riot ID - it's never displayed on the profile.

- [ ] **Step 1: Add Riot ID to the profile header or Career Stats section**

In the Overview tab, add a row showing the player's linked Riot ID:
```jsx
{player.riot_id_eu && (
  <div className="flex items-center gap-2 text-on-surface-variant text-sm">
    <Icon name="sports_esports" size={16} />
    <span className="font-label">{player.riot_id_eu}</span>
  </div>
)}
```

- [ ] **Step 2: Remove duplicate sections if any exist**
- [ ] **Step 3: Commit**

---

### Task 4.4: Fix Achievements Leaderboard Sort

**Files:**
- Modify: `src/screens/MilestonesScreen.jsx:207`

Sorts by pts instead of achievement count.

- [ ] **Step 1: Fix sort to use earned achievement count**

```js
// OLD
var sorted = players.slice().sort(function(a, b) { return b.pts - a.pts; })
// NEW
var sorted = players.slice().sort(function(a, b) {
  var aCount = ACHIEVEMENTS.filter(function(ach) {
    var s = getStats(a)
    return ach.check && ach.check(a, s)
  }).length
  var bCount = ACHIEVEMENTS.filter(function(ach) {
    var s = getStats(b)
    return ach.check && ach.check(b, s)
  }).length
  return bCount - aCount
})
```

- [ ] **Step 2: Commit**

---

### Task 4.5: Fix "Compare" Button and "Socials" Button Labels

**Files:**
- Modify: `src/screens/PlayerProfileScreen.jsx`

- [ ] **Step 1: Rename "Socials" to "Share" or "Share Profile"**
- [ ] **Step 2: Either wire Compare to navigate to leaderboard with comparison state, or remove the button**
- [ ] **Step 3: Commit**

---

### Task 4.6: Fix AchievementCard Missing onClick

**Files:**
- Modify: `src/screens/MilestonesScreen.jsx`

Cards have cursor-pointer but no click handler.

- [ ] **Step 1: Either add a detail expansion or remove the interactive styling**

Remove `cursor-pointer` from locked cards. For unlocked cards, add an expand/collapse for the achievement description.

- [ ] **Step 2: Commit**

---

### Task 4.7: Fix Countdown Missing Seconds

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

- [ ] **Step 1: Add seconds to the countdown display**

Add `timeLeft.seconds` as a fourth tile in the countdown grid.

- [ ] **Step 2: Commit**

---

### Task 4.8: Fix Login Screen Issues

**Files:**
- Modify: `src/screens/LoginScreen.jsx`

- [ ] **Step 1: Fix "Summoner Identity" label to "Email"**
- [ ] **Step 2: Fix Riot ID button SVG icon (currently shows pause icon)**
- [ ] **Step 3: Add error handling to Discord OAuth**

```js
var handleDiscordLogin = function() {
  supabase.auth.signInWithOAuth({ provider: 'discord' }).then(function(res) {
    if (res.error) {
      setError(res.error.message)
    }
  })
}
```

- [ ] **Step 4: Commit**

---

### Task 4.9: Fix SignUp DB Error Fallthrough

**Files:**
- Modify: `src/screens/SignUpScreen.jsx`

When DB insert fails (non-duplicate), execution falls through and creates a ghost player.

- [ ] **Step 1: Add `return` after the error toast**

After the error handling block that calls `toast()` and `setLoading(false)`, add `return` to prevent falling through to the player creation code.

- [ ] **Step 2: Commit**

---

### Task 4.10: Fix Discord OAuth Error Handling in SignUp

**Files:**
- Modify: `src/screens/SignUpScreen.jsx`

Same pattern as LoginScreen - no error handling on OAuth.

- [ ] **Step 1: Add `.then` error check**
- [ ] **Step 2: Commit**

---

## Phase 5: Host System & Tournament Fixes (HIGH VALUE)

### Task 5.1: Fix Host Tournament Lifecycle to Write to DB

**Files:**
- Modify: `src/screens/HostDashboardScreen.jsx`

"Publish", "Close Reg", "Complete Tournament" only update in-memory context. Lost on refresh.

- [ ] **Step 1: Add Supabase write to Publish handler**

When publishing, also upsert to `tournaments` table with `status: 'live'`.

- [ ] **Step 2: Add Supabase write to Close Reg handler**

Update `tournaments` row with `registration_closed: true`.

- [ ] **Step 3: Add Supabase write to Complete handler**

Update `tournaments` row with `status: 'complete'`, `champion: champName`.

- [ ] **Step 4: Commit**

---

### Task 5.2: Fix FlashTournamentScreen `standings` Crash

**Files:**
- Modify: `src/screens/FlashTournamentScreen.jsx`

`startNextGame` references `standings` before it's defined. Snake-seeded game 2+ crashes.

- [ ] **Step 1: Move `standings` computation before `startNextGame` or pass it as parameter**
- [ ] **Step 2: Commit**

---

### Task 5.3: Fix TournamentDetailScreen Blank on Direct Navigation

**Files:**
- Modify: `src/screens/TournamentDetailScreen.jsx`

Event lookup relies on context `featuredEvents` which is empty on refresh.

- [ ] **Step 1: Add a Supabase fallback fetch**

If `event` is not found in context, fetch from `tournaments` table by ID:
```js
useEffect(function() {
  if (!event && tournamentId) {
    supabase.from('tournaments').select('*').eq('id', tournamentId).single()
      .then(function(res) {
        if (res.data) setFallbackEvent(res.data)
      })
  }
}, [event, tournamentId])
```

- [ ] **Step 2: Commit**

---

### Task 5.4: Fix TournamentDetailScreen Standings Showing UUIDs

**Files:**
- Modify: `src/screens/TournamentDetailScreen.jsx`

Standings show `s.player_id` (raw UUID) instead of player names.

- [ ] **Step 1: Build a player name map from the players array in context**
- [ ] **Step 2: Display `playerMap[s.player_id] || 'Unknown'` instead of `s.player_id`**
- [ ] **Step 3: Commit**

---

### Task 5.5: Fix BracketScreen Stale Players in `saveResultsToSupabase`

**Files:**
- Modify: `src/screens/BracketScreen.jsx`

`saveResultsToSupabase` captures stale `players` from closure.

- [ ] **Step 1: Use a ref to always get current players**

Add `var playersRef = useRef(players)` and update it via useEffect. Use `playersRef.current` in the save function.

- [ ] **Step 2: Commit**

---

## Phase 6: Content & Legal Fixes (IMPORTANT)

### Task 6.1: Fix Privacy Policy Inaccuracies

**Files:**
- Modify: `src/screens/PrivacyScreen.jsx`

- [ ] **Step 1: Remove "hardware identifiers" claim (not collected)**
- [ ] **Step 2: Remove "results reported to official API for MMR adjustments" claim (Riot API is read-only)**
- [ ] **Step 3: Commit**

---

### Task 6.2: Fix Terms vs Pricing Contradiction

**Files:**
- Modify: `src/screens/TermsScreen.jsx`

Terms says Host is "$19.99/mo", PricingScreen says "Custom Pricing".

- [ ] **Step 1: Update Terms to match PricingScreen - use "Custom Pricing" or the actual EUR price from constants**
- [ ] **Step 2: Commit**

---

### Task 6.3: Standardize Discord Invite Links

**Files:**
- Modify: Multiple screens (PrivacyScreen, TermsScreen, FAQScreen, RulesScreen)

Two different Discord URLs used across screens.

- [ ] **Step 1: Add `DISCORD_INVITE` constant to `constants.js`**
- [ ] **Step 2: Import and use it everywhere**
- [ ] **Step 3: Commit**

---

### Task 6.4: Fix "SEASON 1 LEADER" Hardcoded Text

**Files:**
- Modify: `src/screens/HofScreen.jsx:144`

- [ ] **Step 1: Make dynamic based on current season number**

```js
var seasonLabel = 'SEASON ' + (seasonConfig && seasonConfig.seasonNumber || 1) + ' LEADER'
```

- [ ] **Step 2: Commit**

---

### Task 6.5: Remove Personal PayPal Link

**Files:**
- Modify: `src/screens/PricingScreen.jsx:398`

- [ ] **Step 1: Replace `paypal.me/monkelodie` with a proper donation/support link or remove entirely**
- [ ] **Step 2: Commit**

---

### Task 6.6: Hide `/donut17` Design Prototype from Production

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Gate the donut17 route behind `isAdmin`**
- [ ] **Step 2: Commit**

---

### Task 6.7: Fix JSON-LD Schema URLs

**Files:**
- Modify: `src/App.jsx:287-289`

- [ ] **Step 1: Replace `tft-clash.vercel.app` with `tftclash.com`**
- [ ] **Step 2: Commit**

---

## Deferred (Post-Launch)

These are real issues but NOT launch-blocking:

- Challenges/XP system persistence (decorative, no gameplay impact)
- AI commentary endpoint hardening
- Host command center tab (unreachable but unused)
- Heatmap accuracy (cosmetic)
- `tiltStreak` computation (cosmetic icon)
- `PAST_CLASHES` seed data removal (only shows when DB empty)
- Compare tool on leaderboard
- Broadcast overlay field names
- Full E2E test suite
- CSP nonce-based scripts (current `unsafe-inline` is acceptable for launch)
- Persistent rate limiting (in-memory is acceptable for initial traffic)

---

## Execution Order

1. Phase 1 (Security) - Tasks 1.1-1.5
2. Phase 2 (Critical Data) - Tasks 2.1-2.10
3. Phase 3 (Database) - Tasks 3.1-3.3
4. Phase 4 (UI/UX) - Tasks 4.1-4.10
5. Phase 5 (Host/Tournament) - Tasks 5.1-5.5
6. Phase 6 (Content/Legal) - Tasks 6.1-6.7

**Total: 40 tasks across 6 phases**
