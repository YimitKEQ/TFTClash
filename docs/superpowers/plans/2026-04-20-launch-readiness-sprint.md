# Launch Readiness Sprint -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship every code-bearing P0 and critical P1 item from `docs/LAUNCH-CHECKLIST.md` so TFT Clash is ready for full public launch.

**Architecture:** TFT Clash is a React 18 + Vite + Tailwind SPA on Vercel with Supabase (Postgres + Auth + Storage + RLS) and PayPal subscriptions. Sentry SDK is already wired in `src/main.jsx` -- it just needs the prod DSN. ScreenBoundary already wraps every screen render in `App.jsx:624`. Most blockers are operational (Supabase upgrade, backup restore, migration verify), with a small set of code patches in front of them: signup terms checkbox, health endpoint git SHA, www->apex redirect, GDPR data export tool, standings reconciliation script.

**Tech Stack:** React 18, Vite 5, Tailwind 3, React Router 6, Supabase JS v2, PayPal JS SDK, Sentry React SDK, Playwright (E2E only -- no unit test framework). House rules: `var` declarations, `function() {}` callbacks, no arrow functions in source, no backtick string literals in JS, Tailwind tokens over hex, no em/en dashes in user-facing copy.

---

## Task 0: Spec recon (already done, listed for traceability)

**Confirmed during plan-writing:**
- Sentry SDK is initialized in `src/main.jsx:8-15` and gated by `VITE_SENTRY_DSN`. P0 collapses to "set the env var in Vercel" -- no SDK code change required.
- `ScreenBoundary` wraps the entire screen render at `src/App.jsx:624` and already calls `Sentry.captureException` (`src/App.jsx:154`). P0 "no crashes outside ScreenBoundary" is structurally satisfied; only need to verify each screen renders inside the boundary (it does -- they are children of the single boundary).
- `vercel.json:5-12` already redirects `tft-clash.vercel.app` to `tftclash.com`. The www->apex redirect must be added.
- `api/delete-account.js` exists and properly verifies JWT before mutating. GDPR "account deletion" is satisfied. Only "data export" is missing.
- `SignUpScreen.jsx` is Discord OAuth only with no Terms acceptance gate. Must add.
- Cookie consent uses `localStorage.setItem("tft-cookie-consent","1")` (`App.jsx:701`). Persistence already works -- verify only.

**No code changes needed for these P0/P1 items below. Listed so they are not re-scoped:**
- Sentry SDK code (already in `main.jsx`)
- ScreenBoundary wrapping (already in `App.jsx`)
- Cookie consent persistence (already uses localStorage)
- Account deletion endpoint (already in `api/delete-account.js`)
- Vercel preview-domain redirect (already in `vercel.json`)

---

## Task 1: Health endpoint -- expose git SHA and uptime

**Files:**
- Modify: `api/health.js`

**Why:** A health endpoint with no version makes rollbacks ambiguous -- you cannot tell which commit is live from `curl /api/health`. The launch checklist requires this for the rollback runbook.

- [ ] **Step 1: Update health endpoint to return Vercel git SHA**

Replace contents of `api/health.js` with:

```js
// Vercel serverless function -- health check endpoint
// Returns build identity for rollback decisions and uptime monitoring.
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var sha = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
  var ref = process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
  var env = process.env.VERCEL_ENV || 'unknown';

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
    sha: sha,
    ref: ref,
    env: env,
  });
}
```

- [ ] **Step 2: Verify locally that the JSON shape compiles**

Run: `node -e "import('./api/health.js').then(function(m){var fake={method:'GET'};var res={setHeader:function(){},json:function(j){console.log(JSON.stringify(j))}};m.default(fake,res);})"`
Expected: prints `{"status":"ok","timestamp":...,"version":"0.1.0","sha":"unknown","ref":"unknown","env":"unknown"}`. (Locally `VERCEL_*` vars are empty -- that is expected.)

- [ ] **Step 3: Commit**

```bash
git add api/health.js
git commit -m "feat(api): include git sha + ref in /api/health for rollback identity"
```

- [ ] **Step 4: After deploy, verify in prod**

Run: `curl -s https://tftclash.com/api/health | head`
Expected: `sha` field is a 40-char hex matching the latest deploy. If `unknown`, Vercel did not inject `VERCEL_GIT_COMMIT_SHA` -- file an issue and check Project Settings > Git.

---

## Task 2: WWW to apex redirect

**Files:**
- Modify: `vercel.json:5-12` (extend the `redirects` array)

**Why:** Search engines, social previews, and outbound links can all land on `www.tftclash.com`. Without a 301 redirect, you serve duplicate content and dilute SEO.

- [ ] **Step 1: Extend the `redirects` array in `vercel.json`**

Locate the existing `redirects` block:

```json
"redirects": [
  {
    "source": "/:path(.*)",
    "has": [{ "type": "host", "value": "tft-clash.vercel.app" }],
    "destination": "https://tftclash.com/:path",
    "permanent": true
  }
],
```

Replace with:

```json
"redirects": [
  {
    "source": "/:path(.*)",
    "has": [{ "type": "host", "value": "tft-clash.vercel.app" }],
    "destination": "https://tftclash.com/:path",
    "permanent": true
  },
  {
    "source": "/:path(.*)",
    "has": [{ "type": "host", "value": "www.tftclash.com" }],
    "destination": "https://tftclash.com/:path",
    "permanent": true
  }
],
```

- [ ] **Step 2: Validate JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(vercel): add 301 redirect from www.tftclash.com to apex"
```

- [ ] **Step 4: After deploy, verify**

Run: `curl -sI https://www.tftclash.com/ | grep -iE "^(http|location)"`
Expected: `HTTP/2 301` and `location: https://tftclash.com/`

If the www subdomain is not yet in DNS, add a CNAME record `www -> cname.vercel-dns.com` in your DNS provider before this redirect is reachable.

---

## Task 3: Branded 404 -- catch unknown routes

**Files:**
- Read first: `src/App.jsx` (find where `screen` resolves and unknown screen falls through)
- Modify: `src/App.jsx` -- update the route resolver to set `screen='not-found'` for any unrecognized path
- Verify: `src/screens/NotFoundScreen.jsx` exists and renders correctly

**Why:** `App.jsx:684` already renders `NotFoundScreen` when `screen==='not-found'`, but there is no fall-through that sets `screen='not-found'` for unknown routes. Today, an unknown route like `/zzz` likely renders blank (no condition matches).

- [ ] **Step 1: Verify `NotFoundScreen` exists**

Run: `ls src/screens/NotFoundScreen.jsx`
If missing, create it with:

```jsx
import { Btn, Icon, Panel } from '../components/ui'
import PageLayout from '../components/layout/PageLayout'
import { useApp } from '../context/AppContext'

export default function NotFoundScreen() {
  var ctx = useApp()
  var navTo = ctx.navTo
  return (
    <PageLayout showSidebar={false}>
      <div className="min-h-[70vh] flex items-center justify-center py-8">
        <Panel className="p-8 max-w-md text-center space-y-5">
          <Icon name="explore_off" size={48} className="text-primary mx-auto" />
          <h1 className="font-display text-3xl text-on-surface">Page not found</h1>
          <p className="text-sm text-on-surface/60">
            The route you tried to load does not exist. It may have been renamed or removed.
          </p>
          <div className="flex justify-center gap-3">
            <Btn variant="primary" onClick={function() { navTo('home') }}>Go Home</Btn>
            <Btn variant="ghost" onClick={function() { navTo('events') }}>See Events</Btn>
          </div>
        </Panel>
      </div>
    </PageLayout>
  )
}
```

- [ ] **Step 2: Find route resolver in `App.jsx`**

Run: `grep -n "setScreen\|screen===\|navTo" src/App.jsx | head -40`
Locate where the URL pathname is parsed into `screen`. Look for a function like `resolveScreen(pathname)` or a `useEffect` that sets `screen` from `location.pathname`.

- [ ] **Step 3: Add a fall-through to `not-found`**

In the route resolver function, after all known route checks, add a fall-through:

```js
// Unknown route -- show branded 404
setScreen('not-found')
```

The exact insertion point depends on the resolver structure. The rule: if no known prefix matches the pathname, set `screen='not-found'`. Do NOT redirect to `/` -- that hides routing bugs.

- [ ] **Step 4: Manual verify**

Run: `npm run dev`
Navigate to `http://localhost:5173/zzz-does-not-exist`
Expected: Branded 404 panel, not blank page or auto-home redirect.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/screens/NotFoundScreen.jsx
git commit -m "feat(routing): branded 404 fallback for unknown routes"
```

---

## Task 4: Terms of Service acceptance gate in signup

**Files:**
- Modify: `src/screens/SignUpScreen.jsx`

**Why:** GDPR + DPA require explicit, unambiguous opt-in to the Terms of Service. Today the signup flow goes straight to Discord OAuth with no Terms acknowledgement. This is a legal blocker for EU users.

- [ ] **Step 1: Add `useState` import and a `tosAccepted` state**

Modify the imports at the top of `src/screens/SignUpScreen.jsx`:

```jsx
import { useEffect, useState } from 'react'
```

Inside the component body, after the existing `var ctx = useApp()` line, add:

```jsx
var tosAccepted = useState(false)
var tos = tosAccepted[0]
var setTos = tosAccepted[1]
```

(Using the destructure-free pattern to match house style. Direct array indexing is fine.)

- [ ] **Step 2: Gate the Discord OAuth button on `tos` being true**

Replace the existing `handleDiscordSignUp` function with:

```jsx
async function handleDiscordSignUp() {
  if (!tos) {
    toast('Please accept the Terms and Privacy Policy first', 'error')
    return
  }
  var res = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: CANONICAL_ORIGIN }
  })
  if (res.error) { toast(res.error.message, 'error') }
}
```

- [ ] **Step 3: Add the checkbox markup above the Discord button**

Add `var navTo = ctx.navTo` near the other ctx destructures.

Above the Discord button (between the `<div className="space-y-1">...</div>` heading block and the `<button onClick={handleDiscordSignUp}...>` button), insert:

```jsx
<label className="flex items-start gap-2.5 cursor-pointer select-none">
  <input
    type="checkbox"
    checked={tos}
    onChange={function(e) { setTos(e.target.checked) }}
    className="mt-0.5 w-4 h-4 rounded border border-outline-variant/40 bg-surface-container text-primary focus:ring-2 focus:ring-primary/40 cursor-pointer flex-shrink-0"
  />
  <span className="text-xs text-on-surface/70 leading-relaxed">
    I agree to the{' '}
    <button
      type="button"
      onClick={function() { navTo('terms') }}
      className="text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer font-bold"
    >Terms of Service</button>
    {' '}and{' '}
    <button
      type="button"
      onClick={function() { navTo('privacy') }}
      className="text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer font-bold"
    >Privacy Policy</button>.
  </span>
</label>
```

- [ ] **Step 4: Apply disabled styling to the Discord button when `!tos`**

Modify the existing Discord button JSX. Add a `disabled` attribute and conditional opacity:

```jsx
<button
  type="button"
  disabled={!tos}
  onClick={handleDiscordSignUp}
  className={'w-full flex items-center justify-center gap-3 py-3.5 bg-[#5865F2] border-0 rounded-lg active:scale-[0.98] transition-all ' + (tos ? 'hover:bg-[#4752C4] cursor-pointer' : 'opacity-50 cursor-not-allowed')}
>
```

(Keep the SVG and span children unchanged.)

- [ ] **Step 5: Manual verify**

Run: `npm run dev`
Navigate to signup, confirm:
- Discord button is dimmed and not clickable on load
- Checking the box enables the button
- Clicking Terms/Privacy links navigates to `/terms` and `/privacy`
- Submitting without box checked shows error toast

- [ ] **Step 6: Commit**

```bash
git add src/screens/SignUpScreen.jsx
git commit -m "feat(auth): require Terms+Privacy acceptance before signup"
```

---

## Task 5: GDPR data export -- admin tool

**Files:**
- Modify: `src/screens/ops/OpsMaintenance.jsx` -- add new ActionCard "Export user data"
- No DB change required (read-only)

**Why:** GDPR Article 15 grants users the right to access their personal data. Until automated, admin must be able to export a user's full data set on request. Without this, you cannot lawfully accept EU users at scale.

- [ ] **Step 1: Read the file to find the right place**

Run: `grep -n "ActionCard\|export default function\|function OpsMaintenance" src/screens/ops/OpsMaintenance.jsx | head`
Locate where the existing ActionCards are rendered. The new card goes alongside existing ones.

- [ ] **Step 2: Add `exportUserData` handler at top-level of the component**

In `OpsMaintenance.jsx`, near the existing async helpers (e.g. `recomputeStandings`, `bulkDisqualify`), add:

```jsx
function exportUserData() {
  var idInput = window.prompt('Enter the player auth_user_id (UUID) to export:')
  if (!idInput || !idInput.trim()) return
  var authUserId = idInput.trim()

  setBusy('export')

  Promise.all([
    supabase.from('players').select('*').eq('auth_user_id', authUserId).maybeSingle(),
    supabase.from('registrations').select('*, players!inner(auth_user_id)').eq('players.auth_user_id', authUserId),
    supabase.from('game_results').select('*, players!inner(auth_user_id)').eq('players.auth_user_id', authUserId),
    supabase.from('notifications').select('*').eq('user_id', authUserId),
    supabase.from('user_subscriptions').select('*').eq('user_id', authUserId),
    supabase.from('user_roles').select('*').eq('user_id', authUserId),
    supabase.from('host_applications').select('*').eq('user_id', authUserId),
    supabase.from('host_profiles').select('*').eq('user_id', authUserId),
    supabase.from('prize_claims').select('*, players!inner(auth_user_id)').eq('players.auth_user_id', authUserId),
    supabase.from('audit_log').select('*').eq('actor_id', authUserId).limit(500),
  ]).then(function(results) {
    var bundle = {
      generated_at: new Date().toISOString(),
      auth_user_id: authUserId,
      player: results[0].data || null,
      registrations: results[1].data || [],
      game_results: results[2].data || [],
      notifications: results[3].data || [],
      user_subscriptions: results[4].data || [],
      user_roles: results[5].data || [],
      host_applications: results[6].data || [],
      host_profiles: results[7].data || [],
      prize_claims: results[8].data || [],
      audit_log_actions: results[9].data || [],
    }
    var json = JSON.stringify(bundle, null, 2)
    var blob = new Blob([json], { type: 'application/json' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a')
    a.href = url
    a.download = 'tftclash-export-' + authUserId + '.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    if (currentUser && currentUser.auth_user_id) {
      supabase.from('audit_log').insert({
        action: 'gdpr_export',
        actor_id: currentUser.auth_user_id,
        actor_name: currentUser.username || currentUser.email || 'Admin',
        target_type: 'user',
        target_id: authUserId,
        details: { row_counts: {
          registrations: bundle.registrations.length,
          game_results: bundle.game_results.length,
          notifications: bundle.notifications.length,
          prize_claims: bundle.prize_claims.length,
        } },
      }).then(function() {})
    }

    toast('Export downloaded', 'success')
    setBusy('')
  }).catch(function(err) {
    console.error('[gdpr-export] failed:', err)
    toast('Export failed: ' + (err && err.message ? err.message : 'unknown'), 'error')
    setBusy('')
  })
}
```

(Confirm `setBusy`, `toast`, `currentUser`, and `supabase` are in scope. They are -- they're used by the surrounding component already.)

- [ ] **Step 3: Add the ActionCard to the JSX**

Below the existing ActionCards (e.g. after the `Bulk Disqualify` card), insert:

```jsx
<ActionCard
  tone="primary"
  icon="folder_zip"
  title="Export User Data (GDPR)"
  desc="Download a JSON bundle of every row associated with a user's auth_user_id. Use for GDPR Article 15 requests."
>
  <Btn
    variant="primary"
    size="sm"
    disabled={busy === 'export'}
    onClick={exportUserData}
  >
    {busy === 'export' ? 'Exporting...' : 'Export by auth_user_id'}
  </Btn>
</ActionCard>
```

- [ ] **Step 4: Manual verify**

Run: `npm run dev`. As admin, navigate to Command Center > Maintenance.
- Click "Export by auth_user_id"
- Paste your own `auth_user_id` (find it in browser DevTools: `localStorage.getItem('sb-...-auth-token')` or query `players` table)
- Confirm a JSON file downloads with all expected sections populated.
- Confirm `audit_log` gains a row with `action='gdpr_export'`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ops/OpsMaintenance.jsx
git commit -m "feat(ops): GDPR data export tool by auth_user_id"
```

---

## Task 6: Standings reconciliation -- catch leaderboard drift before launch

**Files:**
- Create: `docs/runbooks/standings-reconciliation.md`
- (Reuses existing `OpsMaintenance > Recompute Standings` button -- no new code)

**Why:** The launch checklist names this as a P0: leaderboard must agree with raw `game_results`. We have a `recomputeStandings` function in `OpsMaintenance.jsx` already. The runbook captures how to detect drift, decide whether to fix, and document the fix.

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/standings-reconciliation.md` with:

```markdown
# Standings Reconciliation Runbook

Run before launch and after any incident that may have affected `players.season_pts`.

## Detect drift

In Supabase SQL Editor, run for the active season:

```sql
WITH active_season AS (
  SELECT id FROM seasons WHERE active = true LIMIT 1
),
computed AS (
  SELECT
    gr.player_id,
    SUM(CASE gr.placement
      WHEN 1 THEN 8 WHEN 2 THEN 7 WHEN 3 THEN 6 WHEN 4 THEN 5
      WHEN 5 THEN 4 WHEN 6 THEN 3 WHEN 7 THEN 2 WHEN 8 THEN 1
      ELSE 0 END) AS pts,
    SUM(CASE WHEN gr.placement = 1 THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN gr.placement <= 4 THEN 1 ELSE 0 END) AS top4,
    COUNT(*) AS games
  FROM game_results gr
  WHERE gr.season_id = (SELECT id FROM active_season)
  GROUP BY gr.player_id
)
SELECT
  p.username,
  p.season_pts AS stored_pts,
  COALESCE(c.pts, 0) AS computed_pts,
  p.wins AS stored_wins,
  COALESCE(c.wins, 0) AS computed_wins,
  p.games AS stored_games,
  COALESCE(c.games, 0) AS computed_games
FROM players p
LEFT JOIN computed c ON c.player_id = p.id
WHERE p.season_pts <> COALESCE(c.pts, 0)
   OR p.wins <> COALESCE(c.wins, 0)
   OR p.games <> COALESCE(c.games, 0)
ORDER BY ABS(p.season_pts - COALESCE(c.pts, 0)) DESC;
```

Zero rows = green. Any row = drift.

## Fix drift

1. Sign in as admin -> Command Center -> Maintenance.
2. Click "Recompute Standings".
3. Wait for confirmation toast.
4. Re-run the detect query above. Confirm zero rows.
5. Append a dated entry to this runbook: date, drift count, root cause if known.

## Acceptable drift

None. Any drift is a launch blocker per `docs/LAUNCH-CHECKLIST.md`.

## Drift log

| Date | Players drifted | Cause | Fixed |
|------|-----------------|-------|-------|
|      |                 |       |       |
```

- [ ] **Step 2: Run the detect query against prod**

Use Supabase SQL Editor or `mcp__supabase__execute_sql`. Save the result count.

- [ ] **Step 3: If drift > 0, run "Recompute Standings" from Maintenance**

In the running app, sign in as admin and trigger the recompute. Re-run detect query. Append to drift log.

- [ ] **Step 4: Commit runbook**

```bash
git add docs/runbooks/standings-reconciliation.md
git commit -m "docs(runbook): standings reconciliation procedure"
```

---

## Task 7: Backup restore dry run runbook

**Files:**
- Create: `docs/runbooks/backup-restore.md`

**Why:** A backup that has never been restored is not a backup. The launch checklist requires this be documented and dated.

- [ ] **Step 1: Write the runbook**

Create `docs/runbooks/backup-restore.md` with:

```markdown
# Supabase Backup + Restore Runbook

## Prerequisites

- Supabase project on Pro plan or higher (free tier has no automated backups)
- `supabase` CLI installed (`npm install -g supabase`)
- Access token in `~/.supabase/access-token`

## Take a manual backup

In Supabase Dashboard > Database > Backups, click "Create backup". Wait for green checkmark (typically 30-90 seconds).

Or via CLI:

```bash
supabase db dump --linked --file backups/manual-$(date +%Y%m%d-%H%M%S).sql
```

## Restore to a branch (dry run)

1. Supabase Dashboard > Branches > Create branch (e.g. `restore-test`).
2. Wait for branch ready.
3. In branch dashboard > Database > Backups > Restore from production backup.
4. Pick the most recent backup. Confirm.
5. Wait for restore to complete (~2-10 min depending on DB size).

## Verify restore

Connect to the branch DB and run:

```sql
SELECT
  (SELECT COUNT(*) FROM players) AS players,
  (SELECT COUNT(*) FROM game_results) AS game_results,
  (SELECT COUNT(*) FROM tournaments) AS tournaments,
  (SELECT COUNT(*) FROM registrations) AS registrations;
```

Compare to prod counts. Diffs > 1% = backup is incomplete or stale -- DO NOT LAUNCH until investigated.

## Cleanup

After verification, delete the branch (Supabase Dashboard > Branches > Delete).

## Restore log

| Date | Backup taken | Branch tested | Players | game_results | tournaments | registrations | Result |
|------|--------------|---------------|---------|--------------|-------------|---------------|--------|
|      |              |               |         |              |             |               |        |
```

- [ ] **Step 2: Execute the dry run after Supabase Pro upgrade**

This runs after the Supabase upgrade ops task (see Manual Operations section). Append to restore log when done.

- [ ] **Step 3: Commit runbook**

```bash
git add docs/runbooks/backup-restore.md
git commit -m "docs(runbook): backup restore dry run procedure"
```

---

## Task 8: PayPal webhook verification spot-check

**Files:**
- Read: `api/paypal-webhook.js`
- Create: `docs/runbooks/paypal-verify.md`

**Why:** P0 blocker is "PayPal webhook signature verified in live mode". The code may already verify -- but the launch checklist demands an explicit, dated verification. This task is to read the handler, confirm signature verification is enforced, and document the test.

- [ ] **Step 1: Read the webhook handler**

Run: `cat api/paypal-webhook.js`
Confirm:
- Reads `paypal-transmission-sig` (or equivalent) header
- Calls PayPal verify-webhook-signature endpoint or local verifier
- Returns 401/403 if signature invalid -- BEFORE any DB mutation

If verification is missing or after the DB mutation, file an immediate fix issue. This is a security-reviewer-level concern.

- [ ] **Step 2: If verification is correct, write runbook**

Create `docs/runbooks/paypal-verify.md` with:

```markdown
# PayPal Webhook Verification Runbook

## Spot-check live signature path

1. Subscribe with a real account at the lowest tier ($4.99 Pro). Use a card you control.
2. Watch Vercel logs: `vercel logs https://tftclash.com --follow | grep paypal-webhook`
3. Within ~30 seconds, expect log line indicating signature was verified and the subscription row was inserted.
4. Confirm in DB: `SELECT * FROM user_subscriptions WHERE user_id = 'YOUR_AUTH_UUID' ORDER BY created_at DESC LIMIT 1`. Row should exist with `status='active'`.
5. Confirm UI: Pro badge appears in nav within 30 seconds of webhook.
6. Cancel subscription via PayPal dashboard. Watch logs for cancellation webhook. Confirm `status` updates and badge removes at period end.

## Forged-signature negative test

Send a forged POST to `/api/paypal-webhook`:

```bash
curl -X POST https://tftclash.com/api/paypal-webhook \
  -H "Content-Type: application/json" \
  -H "paypal-transmission-id: forged" \
  -H "paypal-transmission-sig: forged" \
  -H "paypal-transmission-time: 2026-01-01T00:00:00Z" \
  -H "paypal-cert-url: https://example.com/cert" \
  -H "paypal-auth-algo: SHA256withRSA" \
  -d '{"event_type":"BILLING.SUBSCRIPTION.ACTIVATED","resource":{"id":"FAKE","subscriber":{"email_address":"forged@example.com"}}}'
```

Expected: HTTP 4xx (401 or 403). NO database row should be created.

## Verification log

| Date | Real subscribe verified | Forged rejected | Pro badge appeared | Notes |
|------|-------------------------|-----------------|---------------------|-------|
|      |                         |                 |                     |       |
```

- [ ] **Step 3: Commit runbook**

```bash
git add docs/runbooks/paypal-verify.md
git commit -m "docs(runbook): paypal webhook signature verification procedure"
```

- [ ] **Step 4: Execute the runbook before launch**

Append a row to verification log with date and result.

---

## Task 9: Migration verification

**Files:**
- (Verification only -- no code changes)

**Why:** P0 blocker requires confirming migrations 001-055 are applied to prod. Drift between local migration files and prod state is silent and dangerous.

- [ ] **Step 1: List local migration files**

Run: `ls supabase/migrations/ | sort`
Save the count and the highest-numbered file.

- [ ] **Step 2: Query prod for applied migrations**

Use `mcp__supabase__list_migrations` (preferred, queries the live DB) or in Supabase SQL Editor:

```sql
SELECT version, name, executed_at FROM supabase_migrations.schema_migrations ORDER BY version;
```

- [ ] **Step 3: Compare**

Confirm every local file has a corresponding prod row. Any local file missing in prod = unapplied migration. Run `supabase db push --linked` to apply, or use `mcp__supabase__apply_migration` for individual files.

- [ ] **Step 4: Document the result**

Append to `docs/LAUNCH-CHECKLIST.md` under the migration P0 line: change `[ ]` to `[x]` and add a date stamp comment.

```bash
git commit -am "docs(launch): mark migration verification complete on YYYY-MM-DD"
```

---

## Task 10: On-call protocol document

**Files:**
- Create: `docs/runbooks/oncall.md`

**Why:** The launch checklist references on-call but no document exists. Without it, the first incident is also the first time you decide who responds.

- [ ] **Step 1: Write the on-call doc**

Create `docs/runbooks/oncall.md` with:

```markdown
# On-Call Protocol (First 2 Weeks Post-Launch)

## Roles

- **Primary:** Levitate (you), daytime CET hours
- **Backup:** TBD trusted Discord moderator with admin role and your phone number
- **Escalation triggers:** see "Rollback triggers" in `docs/LAUNCH-CHECKLIST.md`

## Communication channels

- Internal: Discord #ops (private channel)
- Public status: Discord #announcements + status page (when live)
- Sentry alerts: route to Discord #ops via webhook

## Response time targets

| Severity | Target acknowledge | Target mitigation |
|----------|--------------------|--------------------|
| Auth bypass / data leak | 5 min | 30 min (rollback if needed) |
| Site down (health 5xx > 5 min) | 5 min | 30 min |
| Payment broken | 15 min | 2 hours |
| Single feature broken (non-payment) | 1 hour | Same day |
| Cosmetic / copy | Best effort | Next deploy |

## Standing checks (run twice daily, week 1)

- Sentry inbox: any new issues > 5 occurrences?
- DB CPU graph: any sustained spikes?
- Signup count: trending up? plateau? cliff?
- Payment row count vs prior day
- Discord #feedback: triage to GitHub issues

## Rollback command

```bash
vercel rollback
```

Pick the last green deploy. Confirms in 60 seconds.

## Post-incident

Every incident gets:
1. A GitHub issue with timeline
2. Root-cause line in `docs/runbooks/incidents.md` (create if missing)
3. A change to a runbook or test if it could happen again
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/oncall.md
git commit -m "docs(runbook): on-call protocol for first 2 weeks post-launch"
```

---

## Manual operations (no code -- but blockers all the same)

These do not need a coding plan, but they are the actual gating items. Do them in order. Once each is done, flip its checkbox in `docs/LAUNCH-CHECKLIST.md` and commit.

### Op 1: Upgrade Supabase to Pro

1. Supabase Dashboard > Settings > Billing > Upgrade to Pro ($25/mo).
2. Wait for green checkmark on the project header (instant).
3. Verify daily backups are now scheduled: Database > Backups > should show "Daily backups enabled".
4. Verify pause is disabled: Settings > General > Project status reads "Active" with no pause warning.

### Op 2: Set Sentry DSN in Vercel prod env

1. Sentry > New Project > Platform: React. Get DSN.
2. Vercel > Project > Settings > Environment Variables > add `VITE_SENTRY_DSN` (Production scope only).
3. Redeploy: `vercel --prod` or push any commit.
4. Test: open prod in incognito, browser console: `throw new Error('sentry-test-' + Date.now())`. Within 60 seconds, the event appears in Sentry.

### Op 3: Set up uptime monitoring

1. UptimeRobot (free) or Better Stack > Add monitor > URL `https://tftclash.com/api/health` > 5 min interval.
2. Configure alert: Discord webhook in #ops channel.
3. Test by stopping a Vercel deployment briefly and confirming alert fires within 10 minutes.

### Op 4: Verify Google Search Console

1. search.google.com/search-console > Add property > `https://tftclash.com`.
2. Verify via DNS TXT record (Vercel manages DNS, add the TXT in Vercel DNS settings).
3. Submit sitemap: `https://tftclash.com/sitemap.xml`.
4. Confirm sitemap is processed (status "Success") within 24 hours.

### Op 5: Backup restore dry run

Follow `docs/runbooks/backup-restore.md`. Append to its log.

### Op 6: PayPal webhook live spot-check

Follow `docs/runbooks/paypal-verify.md`. Append to its log.

### Op 7: Run all 14 smoke-test core flows

Follow the "Core flows" checklist section in `docs/LAUNCH-CHECKLIST.md`. Date-stamp each one in the document and commit.

### Op 8: Mobile real-device pass

iOS Safari + Android Chrome. Follow signup -> register -> view leaderboard. Note any horizontal scroll, z-index bugs, drawer issues. File issues in GitHub.

### Op 9: Lighthouse baseline

Run Lighthouse mobile + desktop on `/`, `/dashboard`, `/leaderboard`. Save scores to `docs/runbooks/perf-baseline.md` (create as a simple table). Target mobile >= 85, desktop >= 90.

### Op 10: OG preview test

Share `https://tftclash.com/` in Discord, X, WhatsApp. Verify thumbnail + title + description render correctly. Fix any incorrect og: tags in `index.html`.

---

## Self-Review (already performed inline)

- **Spec coverage:** Each P0 in `docs/LAUNCH-CHECKLIST.md` has either a code task (Tasks 1-9) or an Op (Manual operations). Standings reconciliation (P0) -> Task 6. Backup restore (P0) -> Task 7 + Op 5. Sentry (P0) -> Op 2 (no code needed; SDK already wired). PayPal verify (P0) -> Task 8 + Op 6. Migration verify (P0) -> Task 9. Supabase Pro (P0) -> Op 1. ScreenBoundary (P0) -> Task 0 (already structurally satisfied).
- **Placeholder scan:** No TBDs or "implement later" inside coding tasks. Every code step has the actual code. Op 3 backup contact is "TBD trusted Discord moderator" -- this is genuinely a name to fill in, not code.
- **Type / name consistency:** `setBusy` / `busy` / `toast` / `currentUser` references in Task 5 match existing usage in `OpsMaintenance.jsx`. `auth_user_id` is consistently used as the GDPR identifier. `screen='not-found'` matches the existing condition in `App.jsx:684`.

---

## Plan execution choice

**Plan complete and saved to `docs/superpowers/plans/2026-04-20-launch-readiness-sprint.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** -- dispatch a fresh subagent per task, review between tasks. Good for tasks with discrete file boundaries (Tasks 1-9). Higher token cost, lower context risk.
2. **Inline Execution** -- run tasks in this session. Good for "sicko mode" speed, but the GDPR export task and the 404 routing task touch enough surface that mistakes are easier.

For this plan, **inline execution is the right call** because:
- Most coding tasks are < 50 lines of change in one file
- The runbook tasks (6, 7, 8, 10) are pure markdown
- All OPs are gated on the user (only the user can click "Upgrade" in Supabase, paste the Sentry DSN, etc.)
- Speed matters per the user's directive

Recommend: execute Tasks 1-10 inline, hand the OPs list to the user.
