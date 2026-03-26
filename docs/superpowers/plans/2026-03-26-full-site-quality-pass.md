# Full-Site Quality Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every broken/dead piece of UI across all 33 screens, wire real DB operations throughout, and ensure every user-facing interaction works end-to-end.

**Architecture:** React 18 SPA with Vite 5, Tailwind CSS 3, React Router 6, Supabase backend. Dual routing: `screen` state in AppContext + React Router. All screens are lazy-loaded. Error isolation via ScreenBoundary (per-screen) + ErrorBoundary (outer).

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Supabase JS v2, React Router 6. Code style: `var` declarations, `function(){}` callbacks, no arrow functions, no IIFEs in JSX, no named function components inside another component body.

---

## File Map

Files to modify per stage:

| Stage | Files |
|-------|-------|
| 1 - Critical Fixes | `src/screens/LoginScreen.jsx`, `src/screens/SignUpScreen.jsx`, `src/screens/AdminScreen.jsx`, `src/screens/HostApplyScreen.jsx`, `src/App.jsx` |
| 2 - Static/Legal | `src/screens/TermsScreen.jsx`, `src/screens/PrivacyScreen.jsx`, `src/screens/GearScreen.jsx`, `src/screens/RulesScreen.jsx`, `src/screens/FAQScreen.jsx`, `src/screens/SeasonRecapScreen.jsx`, `src/screens/ArchiveScreen.jsx` |
| 3 - Auth + Account | `src/screens/LoginScreen.jsx`, `src/screens/SignUpScreen.jsx`, `src/screens/AccountScreen.jsx` |
| 4 - Core Competitive | `src/screens/HomeScreen.jsx`, `src/screens/DashboardScreen.jsx`, `src/screens/StandingsScreen.jsx`, `src/screens/LeaderboardScreen.jsx`, `src/screens/ResultsScreen.jsx`, `src/screens/HofScreen.jsx`, `src/screens/PlayerProfileScreen.jsx` |
| 5 - Tournament | `src/screens/ClashScreen.jsx` (in App.jsx legacy), `src/screens/BracketScreen.jsx`, `src/screens/EventsScreen.jsx`, `src/screens/TournamentsListScreen.jsx`, `src/screens/TournamentDetailScreen.jsx`, `src/screens/FlashTournamentScreen.jsx` |
| 6 - Community + Premium | `src/screens/MilestonesScreen.jsx`, `src/screens/ChallengesScreen.jsx`, `src/screens/ScrimsScreen.jsx`, `src/screens/PricingScreen.jsx` |
| 7 - Host System | `src/screens/HostApplyScreen.jsx`, `src/screens/HostDashboardScreen.jsx` |
| 8 - Admin + Stats | `src/screens/AdminScreen.jsx`, `src/screens/StatsHubScreen.jsx` |

---

## Stage 1: Critical Fixes

### Task 1.1: Remove fake metadata from LoginScreen

**Files:**
- Modify: `src/screens/LoginScreen.jsx` (lines ~269-285)

The bottom of the card shows hardcoded `EUW_ARENA_BETA` and `24 MS` — remove this fake widget entirely.

- [ ] **Step 1: Open and find the metadata section**

Read `src/screens/LoginScreen.jsx` and locate the "Technical metadata" comment block (~line 268). It renders two divs with Region/Latency/System Status.

- [ ] **Step 2: Remove the metadata section**

Delete the entire `{/* Technical metadata */}` block (the outer `<div className="flex justify-between...">` with all children).

- [ ] **Step 3: Verify**

Run `npm run dev`, visit `/login`. The card should end at "Establish Profile" — no fake latency or region text.

- [ ] **Step 4: Commit**

```bash
git add src/screens/LoginScreen.jsx
git commit -m "fix: remove fake EUW/latency metadata from LoginScreen"
```

---

### Task 1.2: Remove fake metadata from SignUpScreen

**Files:**
- Modify: `src/screens/SignUpScreen.jsx` (lines ~285-305)

Same fake widget exists at the bottom of SignUpScreen.

- [ ] **Step 1: Delete the metadata section**

Remove the entire `{/* Technical metadata */}` block (lines ~285-305, the outer `<div className="flex justify-between items-center px-4">` with Region/Latency/System Status children).

- [ ] **Step 2: Verify**

Visit `/signup`. Card ends cleanly at the sign-in link.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SignUpScreen.jsx
git commit -m "fix: remove fake EUW/latency metadata from SignUpScreen"
```

---

### Task 1.3: Fix AdminScreen "Add Featured Event" dead form

**Files:**
- Modify: `src/screens/AdminScreen.jsx` (lines ~1619-1635)

All 6 inputs in the "Add Featured Event" panel have `onChange={function() {}}` — they store nothing and the "Add Event" button does nothing.

- [ ] **Step 1: Add state for the form fields**

Near the top of `AdminScreen` (around the other `useState` declarations), add:

```jsx
var _evName = useState('')
var evName = _evName[0]
var setEvName = _evName[1]
var _evHost = useState('')
var evHost = _evHost[0]
var setEvHost = _evHost[1]
var _evDate = useState('')
var evDate = _evDate[0]
var setEvDate = _evDate[1]
var _evStatus = useState('upcoming')
var evStatus = _evStatus[0]
var setEvStatus = _evStatus[1]
var _evFormat = useState('')
var evFormat = _evFormat[0]
var setEvFormat = _evFormat[1]
var _evSize = useState('')
var evSize = _evSize[0]
var setEvSize = _evSize[1]
```

- [ ] **Step 2: Add an addFeaturedEvent function**

After the other admin action functions, add:

```jsx
async function addFeaturedEvent() {
  if (!evName.trim() || !evHost.trim() || !evDate.trim()) {
    toast('Event name, host, and date are required', 'error')
    return
  }
  var res = await supabase.from('featured_events').insert({
    name: evName.trim(),
    host: evHost.trim(),
    date: evDate.trim(),
    status: evStatus,
    format: evFormat.trim() || 'Swiss',
    size: evSize ? parseInt(evSize, 10) : 16
  }).select().single()
  if (res.error) {
    toast('Failed to add event: ' + res.error.message, 'error')
    return
  }
  toast('Event added!', 'success')
  setEvName('')
  setEvHost('')
  setEvDate('')
  setEvStatus('upcoming')
  setEvFormat('')
  setEvSize('')
}
```

- [ ] **Step 3: Wire state and handler to the inputs**

Replace the 6 dead `onChange={function() {}}` inputs and the `<Btn>` at lines ~1625-1633:

```jsx
<div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Event Name</label><Inp value={evName} placeholder="Tournament name..." onChange={function(e) { setEvName(e.target.value) }} /></div>
<div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Host</label><Inp value={evHost} placeholder="Host org..." onChange={function(e) { setEvHost(e.target.value) }} /></div>
<div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Date</label><Inp value={evDate} placeholder="Mar 22 2026" onChange={function(e) { setEvDate(e.target.value) }} /></div>
<div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Status</label><Sel value={evStatus} onChange={function(e) { setEvStatus(e.target.value) }}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></Sel></div>
<div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Format</label><Inp value={evFormat} placeholder="Swiss" onChange={function(e) { setEvFormat(e.target.value) }} /></div>
<div><label className="block text-[11px] text-on-surface/60 mb-1 font-bold uppercase tracking-wider">Size</label><Inp type="number" value={evSize} placeholder="16" onChange={function(e) { setEvSize(e.target.value) }} /></div>
```

Replace the dead note and Btn:
```jsx
<Btn variant="primary" onClick={addFeaturedEvent}>Add Event</Btn>
```

Also delete the stale `<div className="text-xs text-on-surface/30 mb-2">Note: ...</div>` line.

- [ ] **Step 4: Create the DB migration**

Run in Supabase SQL editor (or via MCP):
```sql
create table if not exists featured_events (
  id bigserial primary key,
  name text not null,
  host text not null,
  date text not null,
  status text not null default 'upcoming',
  format text not null default 'Swiss',
  size integer not null default 16,
  created_at timestamptz default now()
);
alter table featured_events enable row level security;
create policy "admins can manage featured_events"
  on featured_events for all
  using (true) with check (true);
```

- [ ] **Step 5: Verify**

Open AdminScreen > Events tab. Fill in the form and click "Add Event". Should succeed (toast: "Event added!") and insert a row in Supabase.

- [ ] **Step 6: Commit**

```bash
git add src/screens/AdminScreen.jsx
git commit -m "fix: wire AdminScreen Add Featured Event form to Supabase"
```

---

### Task 1.4: Fix HostApplyScreen silent DB error

**Files:**
- Modify: `src/screens/HostApplyScreen.jsx` (lines ~57-73)

Currently the submit function calls `setSubmitted(true)` and shows success toast regardless of whether the Supabase insert fails.

- [ ] **Step 1: Make submit async and await the DB call**

Replace the `submit` function (lines ~41-73):

```jsx
async function submit() {
  if (!org.trim() || !reason.trim()) {
    toast('Organization name and reason are required', 'error')
    return
  }

  var slug = org.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  if (currentUser) {
    var res = await supabase.from('host_profiles').upsert({
      user_id: currentUser.id,
      org_name: org.trim(),
      slug: slug,
      bio: reason.trim(),
      status: 'pending',
      social_links: { freq: freq, discord: discord.trim() },
      vision: vision.trim()
    }, { onConflict: 'user_id' }).select().single()

    if (res.error) {
      toast('Failed to submit application: ' + res.error.message, 'error')
      return
    }
  }

  var app = {
    id: Date.now(),
    name: (currentUser && currentUser.username) || '',
    org: org.trim(),
    reason: reason.trim(),
    freq: freq,
    email: (currentUser && currentUser.email) || '',
    status: 'pending',
    submittedAt: new Date().toLocaleDateString()
  }
  if (setHostApps) setHostApps(function(apps) { return [app].concat(apps) })
  setSubmitted(true)
  toast('Application submitted! We will review it within 48h', 'success')
}
```

Also change the button from `onClick={submit}` if it still uses the old sync call — the button should already use `onClick={submit}`, but confirm it's not `type="submit"` on a form (it's not; it's a `<Btn onClick={submit}>`).

- [ ] **Step 2: Verify**

Submit the host apply form while logged in. If Supabase is connected and `host_profiles` table exists, insert should succeed. If table is missing, user sees a real error toast instead of false success.

- [ ] **Step 3: Commit**

```bash
git add src/screens/HostApplyScreen.jsx
git commit -m "fix: HostApplyScreen await DB insert and show error on failure"
```

---

### Task 1.5: Diagnose + confirm "something went wrong" runtime errors

**Files:**
- Read: `src/App.jsx` (ScreenBoundary section, ~lines 6700-6800)

The previous session added a diagnostic error display to ScreenBoundary. This task is to reproduce and read the actual error.

- [ ] **Step 1: Hard-refresh browser**

In the running dev server, press `Ctrl+Shift+R` (Windows) to force a full cache clear. Navigate to several pages. If the crashes were from stale JS bundles, they will stop.

- [ ] **Step 2: Check ScreenBoundary diagnostic**

If any page still shows "Something went wrong", the red error text below it will show the actual exception message (e.g. "Cannot read properties of undefined (reading 'map')"). Note the exact message and which route it appears on.

- [ ] **Step 3: Fix the specific runtime error**

The likely causes to check in the affected screen:
- Accessing `.map()` or `.filter()` on a value that is `null`/`undefined` (add `|| []` guard)
- Calling a hook like `useApp()` and destructuring a value that doesn't exist on the context
- A component using `useNavigate()` outside a Router context

Fix by adding null guards where the crash occurs. Example pattern:
```jsx
// Instead of: items.map(...)
// Use: (items || []).map(...)
```

- [ ] **Step 4: Commit fix if found**

```bash
git add src/screens/<ScreenName>.jsx
git commit -m "fix: null guard for <description> in <ScreenName>"
```

---

## Stage 2: Static and Legal Pages

### Task 2.1: Dynamic dates in TermsScreen and PrivacyScreen

**Files:**
- Modify: `src/screens/TermsScreen.jsx`
- Modify: `src/screens/PrivacyScreen.jsx`

Both screens have a hardcoded "Last updated: March 2026" (or similar). Replace with a JS date expression.

- [ ] **Step 1: Find the hardcoded date strings**

Read both files, search for "Last updated" or similar. Note the exact line numbers.

- [ ] **Step 2: Replace with dynamic date in TermsScreen**

```jsx
// At top of component, before return:
var lastUpdated = new Date('2026-03-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

// In JSX, replace "March 2026" with:
{lastUpdated}
```

- [ ] **Step 3: Same change in PrivacyScreen**

Same pattern. Use `new Date('2026-03-01').toLocaleDateString(...)`.

- [ ] **Step 4: Verify**

Visit `/terms` and `/privacy`. Dates render correctly.

- [ ] **Step 5: Commit**

```bash
git add src/screens/TermsScreen.jsx src/screens/PrivacyScreen.jsx
git commit -m "fix: dynamic last-updated date in Terms and Privacy screens"
```

---

### Task 2.2: GearScreen - create gear_items table and seed data

**Files:**
- Modify: `src/screens/GearScreen.jsx`
- DB: create `gear_items` table

GearScreen already queries `supabase.from('gear_items')` but the table likely doesn't exist, so it shows "No gear available" forever.

- [ ] **Step 1: Create gear_items table**

Run in Supabase SQL editor:
```sql
create table if not exists gear_items (
  id bigserial primary key,
  name text not null,
  category text not null default 'Apparel',
  description text,
  price numeric(10,2) not null default 0,
  image_url text,
  shop_url text,
  sort_order integer not null default 0,
  available boolean not null default true,
  created_at timestamptz default now()
);
alter table gear_items enable row level security;
create policy "public read gear_items"
  on gear_items for select using (true);
create policy "admin manage gear_items"
  on gear_items for all using (true) with check (true);
```

- [ ] **Step 2: Seed with real-looking items**

```sql
insert into gear_items (name, category, description, price, image_url, shop_url, sort_order) values
  ('TFT Clash Hoodie', 'Apparel', 'Premium heavyweight hoodie with embroidered TFT Clash crest. Unisex sizing.', 49.99, null, null, 1),
  ('TFT Clash Tee', 'Apparel', 'Soft 100% cotton tee. "Compete Weekly" back print.', 24.99, null, null, 2),
  ('Season 1 Champion Cap', 'Accessories', 'Structured 6-panel cap. Gold embroidery. Limited edition.', 29.99, null, null, 3),
  ('Mousepad XL', 'Desk Setup', 'Extended 900x400mm gaming mousepad. TFT Clash branding on corner.', 34.99, null, null, 4),
  ('Enamel Pin Set', 'Accessories', 'Set of 3 rank pins: Iron, Diamond, Challenger. 1.5" hard enamel.', 14.99, null, null, 5),
  ('Sticker Pack', 'Accessories', '8 premium vinyl stickers. Waterproof. Clash emblems + rank icons.', 8.99, null, null, 6);
```

- [ ] **Step 3: Update GearScreen to show price and link**

Read `src/screens/GearScreen.jsx` fully. In the items loop, render the price and a buy link. Find where each item card is rendered and add:

```jsx
{item.price > 0 && (
  <div className="text-primary font-mono text-sm font-bold">
    {'€' + item.price.toFixed(2)}
  </div>
)}
{item.shop_url ? (
  <a
    href={item.shop_url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block mt-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded text-xs font-condensed uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
  >
    Buy Now
  </a>
) : (
  <span className="inline-block mt-2 px-3 py-1 bg-surface-variant/20 rounded text-xs font-condensed uppercase tracking-wider text-on-surface/30">
    Coming Soon
  </span>
)}
```

- [ ] **Step 4: Verify**

Visit `/gear`. Items should load from DB and display with price and "Coming Soon" badges (since `shop_url` is null in seed).

- [ ] **Step 5: Commit**

```bash
git add src/screens/GearScreen.jsx
git commit -m "feat: wire GearScreen to gear_items table with seeded items"
```

---

### Task 2.3: Audit RulesScreen and FAQScreen content completeness

**Files:**
- Read: `src/screens/RulesScreen.jsx`
- Read: `src/screens/FAQScreen.jsx`

- [ ] **Step 1: Read RulesScreen**

Check that: rules reflect the official EMEA points table from CLAUDE.md (1st=8pts, 2nd=7pts, ..., 8th=1pt), tiebreaker rules match CLAUDE.md, and no stale or contradictory content.

- [ ] **Step 2: Update points table if wrong**

If points are wrong, update the JSX constants or table to match: `{1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`.

- [ ] **Step 3: Read FAQScreen**

Check that all FAQ entries have real answers (not "TBD" or empty). Check that the Pricing FAQ entries align with current tier prices: Player (free), Pro ($4.99/mo), Host ($19.99/mo).

- [ ] **Step 4: Fix any stale content**

Update any incorrect prices, features, or blank answers. Use direct string edits in JSX.

- [ ] **Step 5: Commit**

```bash
git add src/screens/RulesScreen.jsx src/screens/FAQScreen.jsx
git commit -m "fix: rules points table and FAQ content accuracy"
```

---

### Task 2.4: SeasonRecapScreen - real data or clear placeholder

**Files:**
- Modify: `src/screens/SeasonRecapScreen.jsx`

- [ ] **Step 1: Read SeasonRecapScreen**

Look for any hardcoded "Season 1" data: player names, stats, champion. Verify the champion is Levitate (id:1, 1024pts, 16 wins) as per CLAUDE.md.

- [ ] **Step 2: Update champion data**

If champion isn't Levitate, update the hardcoded data to match:
```
champion: 'Levitate', pts: 1024, wins: 16, rank: 'Challenger'
```

- [ ] **Step 3: Commit if changed**

```bash
git add src/screens/SeasonRecapScreen.jsx
git commit -m "fix: Season 1 recap champion data matches Levitate"
```

---

### Task 2.5: ArchiveScreen - verify past clash data renders

**Files:**
- Modify: `src/screens/ArchiveScreen.jsx`

- [ ] **Step 1: Read ArchiveScreen**

Check if it queries Supabase or uses `PAST_CLASHES` from `lib/constants.js`. Verify that past clash entries render with all fields (date, winner, participants, placements).

- [ ] **Step 2: Fix empty states**

If the list is empty or shows an error, ensure the fallback uses `PAST_CLASHES` from constants when DB returns nothing:
```jsx
import { PAST_CLASHES } from '../lib/constants.js'
// In useEffect callback:
if (res.data && res.data.length > 0) {
  setClashes(res.data)
} else {
  setClashes(PAST_CLASHES)
}
```

- [ ] **Step 3: Verify and commit**

```bash
git add src/screens/ArchiveScreen.jsx
git commit -m "fix: ArchiveScreen fallback to PAST_CLASHES when DB empty"
```

---

## Stage 3: Auth + Account

### Task 3.1: AccountScreen - verify all tabs work end-to-end

**Files:**
- Modify: `src/screens/AccountScreen.jsx`

- [ ] **Step 1: Read AccountScreen fully**

Identify all tabs (e.g. Profile, Settings, Subscription, Stats). For each tab, note which DB operations are wired and which are dead.

- [ ] **Step 2: Wire Profile tab save**

The profile save should upsert into `players` table using `auth_user_id`. Check the save handler:
```jsx
var res = await supabase.from('players')
  .update({ username: username.trim(), rank: rank, bio: bio.trim(), riot_id: riotId.trim() })
  .eq('auth_user_id', currentUser.id)
if (res.error) { toast('Failed to save: ' + res.error.message, 'error'); return }
toast('Profile saved', 'success')
```

- [ ] **Step 3: Wire Settings tab (region, notifications)**

If there's a region dropdown or notification toggles, they should save to `player_settings` or the `players` row:
```jsx
var res = await supabase.from('players')
  .update({ region: selectedRegion })
  .eq('auth_user_id', currentUser.id)
```

- [ ] **Step 4: Verify avatar upload if present**

If there's an avatar upload input, check it uses Supabase Storage. If it's dead, add a note or remove the UI. Don't build Supabase Storage from scratch — that's a separate task.

- [ ] **Step 5: Verify logout button**

Should call `supabase.auth.signOut()` then `setCurrentUser(null)` and navigate to `/`.

- [ ] **Step 6: Commit**

```bash
git add src/screens/AccountScreen.jsx
git commit -m "fix: AccountScreen profile/settings tabs wired to Supabase"
```

---

### Task 3.2: SignUpScreen - username uniqueness check

**Files:**
- Modify: `src/screens/SignUpScreen.jsx`

Currently the form allows duplicate usernames (the `players` table insert has a `23505` duplicate guard but just swallows the error).

- [ ] **Step 1: Add username availability check before submit**

In `handleSubmit`, before `supabase.auth.signUp`, add:
```jsx
var checkRes = await supabase.from('players')
  .select('id')
  .eq('username', username.trim())
  .maybeSingle()
if (checkRes.data) {
  setUsernameErr('Username already taken')
  setLoading(false)
  return
}
```

- [ ] **Step 2: Improve the duplicate insert error handling**

Change the `23505` handling to show the user a message:
```jsx
if (dbInsert.error) {
  console.error('[TFT] Failed to create player row:', dbInsert.error)
  if (dbInsert.error.code === '23505') {
    setUsernameErr('Username already taken')
    toast('Username already taken, please choose another', 'error')
  } else {
    toast('Account created but profile setup failed. Please contact support.', 'error')
  }
  return
}
```

- [ ] **Step 3: Verify**

Try signing up with an existing username. Should show "Username already taken" inline error.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SignUpScreen.jsx
git commit -m "fix: username uniqueness check in SignUpScreen before insert"
```

---

## Stage 4: Core Competitive Pages

### Task 4.1: DashboardScreen - remove stale Saturday references

**Files:**
- Modify: `src/screens/DashboardScreen.jsx`

- [ ] **Step 1: Find "Saturday" references**

Read DashboardScreen and search for "Saturday". These are informational countdown references (not marketing), but if they refer to a fixed day they should use the next actual clash date.

- [ ] **Step 2: Update countdown target**

If the countdown is hardcoded to "next Saturday":
```jsx
// Replace:
var nextSat = ...Saturday logic...

// With: use the next clash timestamp from context or a constant
var clashDate = ctx.nextClashDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
```

If `ctx.nextClashDate` doesn't exist, leave the Saturday logic but confirm it's functionally correct (computes the next Saturday dynamically, not a hardcoded date string).

- [ ] **Step 3: Verify countdown shows correct time**

Run dev server. Dashboard countdown should show a real future time, not 0.

- [ ] **Step 4: Commit if changed**

```bash
git add src/screens/DashboardScreen.jsx
git commit -m "fix: DashboardScreen countdown uses dynamic date, not hardcoded"
```

---

### Task 4.2: StandingsScreen - verify DB data loads

**Files:**
- Modify: `src/screens/StandingsScreen.jsx`

- [ ] **Step 1: Read StandingsScreen**

Find the data fetch: does it query Supabase or use seed data from AppContext? Confirm it doesn't crash when `players` array is empty.

- [ ] **Step 2: Add empty state guard**

Ensure the standings table has an empty state:
```jsx
{(players || []).length === 0 && (
  <div className="text-center py-16 text-on-surface/40 text-sm">No standings yet.</div>
)}
```

- [ ] **Step 3: Verify sort/filter controls work**

Test any filter dropdowns (by rank/region) and sort buttons. Each click should re-render the list correctly.

- [ ] **Step 4: Commit if changed**

```bash
git add src/screens/StandingsScreen.jsx
git commit -m "fix: StandingsScreen null guards and empty state"
```

---

### Task 4.3: LeaderboardScreen - verify all tabs and DB query

**Files:**
- Modify: `src/screens/LeaderboardScreen.jsx`

- [ ] **Step 1: Read LeaderboardScreen**

Identify all tabs (Overall, Win Rate, Attendance, etc.). For each tab, trace whether the sorting/query works.

- [ ] **Step 2: Verify DB or context data source**

If querying Supabase directly, add a fallback to AppContext `players` if the DB returns empty. If using AppContext `players`, confirm `computeStats()` is called on load.

- [ ] **Step 3: Fix any broken tab**

If a tab shows an empty list while there is data, trace the filter/sort logic and fix the predicate.

- [ ] **Step 4: Commit if changed**

```bash
git add src/screens/LeaderboardScreen.jsx
git commit -m "fix: LeaderboardScreen tab data and null guards"
```

---

### Task 4.4: PlayerProfileScreen - deep stats tab loads from DB

**Files:**
- Modify: `src/screens/PlayerProfileScreen.jsx`

- [ ] **Step 1: Read PlayerProfileScreen**

Confirm that: (a) the player row loads from Supabase by username param, (b) the "Deep Stats" tab is functional (shows sparkline, streak, achievements), (c) no crash if `player` is null while loading.

- [ ] **Step 2: Add loading and not-found states**

```jsx
if (loading) return (
  <PageLayout>
    <div className="text-center py-20 text-on-surface/40 text-sm">Loading...</div>
  </PageLayout>
)
if (!player) return (
  <PageLayout>
    <div className="text-center py-20 text-on-surface/40 text-sm">Player not found.</div>
  </PageLayout>
)
```

- [ ] **Step 3: Commit if changed**

```bash
git add src/screens/PlayerProfileScreen.jsx
git commit -m "fix: PlayerProfileScreen loading and not-found states"
```

---

### Task 4.5: ResultsScreen and HofScreen - verify render

**Files:**
- Modify: `src/screens/ResultsScreen.jsx`
- Modify: `src/screens/HofScreen.jsx`

- [ ] **Step 1: Read both screens**

For each: do they render a list? Is the list empty? Is there an empty state message?

- [ ] **Step 2: Add empty state if missing**

```jsx
{(results || []).length === 0 && (
  <div className="text-center py-16 text-on-surface/40 text-sm">No results yet.</div>
)}
```

- [ ] **Step 3: Commit if changed**

```bash
git add src/screens/ResultsScreen.jsx src/screens/HofScreen.jsx
git commit -m "fix: ResultsScreen and HofScreen null guards and empty states"
```

---

## Stage 5: Tournament Screens

### Task 5.1: EventsScreen - verify event list and check-in button

**Files:**
- Modify: `src/screens/EventsScreen.jsx`

- [ ] **Step 1: Read EventsScreen**

Confirm: events load (from DB or context), upcoming events show a "Register" or "Check In" button, past events show results link.

- [ ] **Step 2: Wire check-in to DB**

If check-in button calls `setPlayers(...)` but doesn't persist to DB, add:
```jsx
async function handleCheckIn(eventId) {
  if (!currentUser) { toast('Please log in to check in', 'error'); return }
  var res = await supabase.from('event_registrations').upsert({
    event_id: eventId,
    player_id: currentUser.id,
    checked_in: true
  }, { onConflict: 'event_id,player_id' })
  if (res.error) { toast('Check-in failed: ' + res.error.message, 'error'); return }
  toast('Checked in!', 'success')
}
```

Create the table if it doesn't exist:
```sql
create table if not exists event_registrations (
  id bigserial primary key,
  event_id bigint not null,
  player_id uuid not null,
  checked_in boolean not null default false,
  registered_at timestamptz default now(),
  unique (event_id, player_id)
);
alter table event_registrations enable row level security;
create policy "users manage own registrations"
  on event_registrations for all
  using (player_id = auth.uid()) with check (player_id = auth.uid());
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/EventsScreen.jsx
git commit -m "fix: EventsScreen check-in persists to event_registrations table"
```

---

### Task 5.2: BracketScreen - verify bracket renders

**Files:**
- Modify: `src/screens/BracketScreen.jsx`

- [ ] **Step 1: Read BracketScreen**

Confirm the bracket component renders. Check that `buildLobbies` or `TOURNAMENT_FORMATS` from `lib/tournament.js` are correctly imported and used.

- [ ] **Step 2: Fix any import or null crash**

If `buildLobbies(players, format)` is called with null, add guards:
```jsx
var lobbies = (players && players.length > 0) ? buildLobbies(players, format) : []
```

- [ ] **Step 3: Commit if changed**

```bash
git add src/screens/BracketScreen.jsx
git commit -m "fix: BracketScreen null guards for empty player list"
```

---

### Task 5.3: TournamentsListScreen and TournamentDetailScreen - DB wire

**Files:**
- Modify: `src/screens/TournamentsListScreen.jsx`
- Modify: `src/screens/TournamentDetailScreen.jsx`

- [ ] **Step 1: Read TournamentsListScreen**

Does it query `flash_tournaments` or `tournaments` from Supabase? Does it fall back gracefully?

- [ ] **Step 2: Ensure list screen shows tournaments**

If table is empty, show:
```jsx
<div className="text-center py-16 text-on-surface/40 text-sm">No tournaments scheduled yet.</div>
```

- [ ] **Step 3: Read TournamentDetailScreen**

Confirm it loads a single tournament by `id` route param. Check that join/register button persists to DB.

- [ ] **Step 4: Commit**

```bash
git add src/screens/TournamentsListScreen.jsx src/screens/TournamentDetailScreen.jsx
git commit -m "fix: tournament list and detail null guards and empty states"
```

---

### Task 5.4: FlashTournamentScreen - verify all 10 phases functional

**Files:**
- Read: `src/screens/FlashTournamentScreen.jsx`

This was marked COMPLETE in memory. Verify smoke test passes, no regressions.

- [ ] **Step 1: Visit /flash/:id in dev**

Use a flash tournament ID from DB or create one via AdminScreen. Confirm phases render and transitions work.

- [ ] **Step 2: No action needed if working**

If phases work correctly, no code changes needed. Move to Stage 6.

---

## Stage 6: Community + Premium

### Task 6.1: ChallengesScreen - decide and implement XP Log tab

**Files:**
- Modify: `src/screens/ChallengesScreen.jsx`

Lines 183 and 381 have `{/* TODO: XP Log tab — hidden until XP system is built */}`. Decision: build a minimal XP log or permanently remove the tab.

- [ ] **Step 1: Read ChallengesScreen**

Find where the XP log tab is commented out. Determine if there's an `xp_events` table in Supabase.

- [ ] **Step 2: Create minimal XP log**

Create table if it doesn't exist:
```sql
create table if not exists xp_events (
  id bigserial primary key,
  player_id uuid not null references auth.users(id),
  amount integer not null,
  reason text not null,
  created_at timestamptz default now()
);
alter table xp_events enable row level security;
create policy "users read own xp"
  on xp_events for select using (player_id = auth.uid());
```

Uncomment and implement the XP Log tab to query this table:
```jsx
// In XP Log tab body:
var [xpLog, setXpLog] = useState([])
useEffect(function() {
  if (!currentUser) return
  supabase.from('xp_events')
    .select('*')
    .eq('player_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50)
    .then(function(res) {
      if (res.data) setXpLog(res.data)
    })
}, [currentUser])
```

Render the log as a simple list: date, reason, +XP amount.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ChallengesScreen.jsx
git commit -m "feat: ChallengesScreen XP Log tab with xp_events DB query"
```

---

### Task 6.2: MilestonesScreen - verify achievement data

**Files:**
- Modify: `src/screens/MilestonesScreen.jsx`

- [ ] **Step 1: Read MilestonesScreen**

Check: are milestones hardcoded or queried from DB? Are they personalized to currentUser (showing their progress)?

- [ ] **Step 2: Personalize with player stats**

If milestones are static JSX, wire them to actual player data from AppContext:
```jsx
var ctx = useApp()
var currentUser = ctx.currentUser
var players = ctx.players
var myPlayer = (players || []).find(function(p) { return p.authUserId === (currentUser && currentUser.id) })
var wins = myPlayer ? myPlayer.wins : 0
var games = myPlayer ? myPlayer.games : 0
```

Use these to compute milestone progress percentages.

- [ ] **Step 3: Commit if changed**

```bash
git add src/screens/MilestonesScreen.jsx
git commit -m "fix: MilestonesScreen personalized milestone progress from player stats"
```

---

### Task 6.3: ScrimsScreen - verify scrim creation and join

**Files:**
- Modify: `src/screens/ScrimsScreen.jsx`

- [ ] **Step 1: Read ScrimsScreen**

Scrim overhaul was marked COMPLETE. Verify: create scrim inserts to `scrims` table, join scrim updates the row, list loads from DB.

- [ ] **Step 2: Fix any regressions**

If create/join don't persist, re-wire using same pattern:
```jsx
var res = await supabase.from('scrims').insert({ host: currentUser.id, ... })
if (res.error) { toast(res.error.message, 'error'); return }
```

- [ ] **Step 3: Commit if changed**

```bash
git add src/screens/ScrimsScreen.jsx
git commit -m "fix: ScrimsScreen DB operations regression check"
```

---

### Task 6.4: PricingScreen - verify upgrade CTA

**Files:**
- Modify: `src/screens/PricingScreen.jsx`

- [ ] **Step 1: Read PricingScreen**

Confirm: "Get Pro" and "Go Host" buttons either navigate to a Stripe checkout or show "Coming Soon" if Stripe isn't configured. No dead buttons that do nothing silently.

- [ ] **Step 2: Add feedback on dead CTAs**

If Stripe isn't configured (`VITE_STRIPE_PUBLISHABLE_KEY` missing), buttons should show:
```jsx
onClick={function() { toast('Billing coming soon - stay tuned!', 'info') }}
```

Not a dead no-op. At minimum the user gets feedback.

- [ ] **Step 3: Verify comparison table accuracy**

Confirm the feature matrix (free vs pro vs host) matches CLAUDE.md tier definitions: Player (free), Pro ($4.99/mo), Host ($19.99/mo). Ad-free row should be present (added in previous session).

- [ ] **Step 4: Commit if changed**

```bash
git add src/screens/PricingScreen.jsx
git commit -m "fix: PricingScreen upgrade buttons give feedback when Stripe not configured"
```

---

## Stage 7: Host System

### Task 7.1: HostDashboardScreen - verify all tabs work

**Files:**
- Modify: `src/screens/HostDashboardScreen.jsx`

- [ ] **Step 1: Read HostDashboardScreen**

Identify all tabs. For each: check the DB operation is wired (query, insert, update). The 5-phase host overhaul was marked COMPLETE — verify no regressions.

- [ ] **Step 2: Fix any broken tab action**

Apply same pattern as other screens: await DB call, check error, toast on failure.

- [ ] **Step 3: Verify host branding page renders**

If the host has a branded tournament page (a public URL like `/host/:slug`), confirm the route exists in App.jsx and renders correctly.

- [ ] **Step 4: Commit if changed**

```bash
git add src/screens/HostDashboardScreen.jsx
git commit -m "fix: HostDashboardScreen tab DB operations verified"
```

---

## Stage 8: Admin + Stats

### Task 8.1: AdminScreen - audit all dead buttons and inputs

**Files:**
- Modify: `src/screens/AdminScreen.jsx`

Beyond the "Add Featured Event" form (fixed in Task 1.3), audit every other button in AdminScreen for dead handlers.

- [ ] **Step 1: Read AdminScreen fully (1734 lines)**

List every `<Btn>` and `<button>` that has `onClick={function(){}}` or no onClick handler at all.

- [ ] **Step 2: Wire or remove each dead button**

For buttons that should trigger admin actions (ban player, reset season, etc.), wire to the appropriate Supabase call. For UI-only toggles (tabs, filters), they should already work via `useState`.

Key patterns for admin actions:
```jsx
async function banPlayer(playerId) {
  var res = await supabase.from('players').update({ banned: true }).eq('id', playerId)
  if (res.error) { toast('Failed: ' + res.error.message, 'error'); return }
  toast('Player banned', 'success')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/AdminScreen.jsx
git commit -m "fix: AdminScreen dead buttons wired to Supabase operations"
```

---

### Task 8.2: StatsHubScreen - verify stats load and filters work

**Files:**
- Modify: `src/screens/StatsHubScreen.jsx`

StatsHub was built in the previous session (Advanced Stats feature). Verify no regressions.

- [ ] **Step 1: Read StatsHubScreen**

Confirm: stats load from Supabase, filters (by rank/region) re-query correctly, no crashes when data is empty.

- [ ] **Step 2: Verify named supabase import**

Confirm `import { supabase } from '../lib/supabase.js'` (named, not default). This was a known bug fixed in commit 8af63de.

- [ ] **Step 3: Add empty state if missing**

```jsx
{(!stats || stats.length === 0) && !loading && (
  <div className="text-center py-16 text-on-surface/40 text-sm">No stats data available yet.</div>
)}
```

- [ ] **Step 4: Commit if changed**

```bash
git add src/screens/StatsHubScreen.jsx
git commit -m "fix: StatsHubScreen empty state and null guards"
```

---

## Cross-Cutting Tasks

### Task X.1: DB migration numbering

All new SQL from this plan (featured_events, gear_items, event_registrations, xp_events) should be applied via Supabase MCP in order. Check `docs/migrations/` or `supabase/migrations/` for existing migration files and continue the numbering.

### Task X.2: Final smoke test

After all 8 stages, run through every route:
- `/` `/login` `/signup` `/standings` `/leaderboard` `/bracket`
- `/player/Levitate` `/events` `/results` `/hall-of-fame` `/archive`
- `/milestones` `/challenges` `/pricing` `/season-recap` `/rules` `/faq`
- `/account` `/admin` `/scrims` `/host/apply` `/host/dashboard`
- `/flash/:id` `/tournament/:id` `/privacy` `/terms` `/gear`

For each: loads without "Something went wrong", renders content, primary CTA works.
