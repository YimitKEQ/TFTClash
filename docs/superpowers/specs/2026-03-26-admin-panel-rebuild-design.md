# Admin Panel + Events & Host Dashboard - Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Goal

Three parallel workstreams:
1. Rebuild `AdminScreen.jsx` from a 1,777-line monolith into a modular, fully-wired 7-tab admin panel.
2. Fix six confirmed bugs in `EventsScreen.jsx` and `TournamentDetailScreen.jsx`.
3. Fix four confirmed bugs in `HostDashboardScreen.jsx` and close design gaps in tournament detail presentation.

---

## File Structure

```
src/screens/
  AdminScreen.jsx          ~150 lines  (tab nav shell, admin auth gate, lazy tab loading)
  admin/
    OverviewTab.jsx        ~200 lines
    PlayersTab.jsx         ~400 lines
    TournamentTab.jsx      ~400 lines
    ResultsTab.jsx         ~300 lines
    SettingsTab.jsx        ~350 lines
    AuditTab.jsx           ~200 lines
    HostsTab.jsx           ~250 lines
```

All files stay under 800 lines. Each tab file imports `useApp()`, `supabase`, and shared UI primitives directly - no prop-drilling through the shell.

Code style: `var` declarations, `function(){}` callbacks, no arrow functions, no IIFEs in JSX, no named function components defined inside another component body. Local `Sel` component defined at the top of each file that needs it.

---

## Tab Inventory

### 1. Overview

**Purpose:** At-a-glance command center. The first thing you see when you open admin.

**Contents:**
- Phase badge in sidebar header (registration / check-in / live / complete) - already exists, keep it
- Pending host apps alert badge (links to Hosts tab) - already exists, keep it
- 4 stat cards: Players, Checked In, Banned, Scheduled Events
- Quick Actions panel: Check In All, Clear Check-In, Pause/Resume round, shortcut buttons to Broadcast (in Settings) and Round Controls (in Tournament)
- Recent Activity: last 10 entries fetched from `audit_log` table on mount (server-side, survives refresh)

**DB:** `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10`

---

### 2. Players

**Purpose:** Full roster management and player moderation.

**Contents:**

**Roster table** (all players):
- Columns: Name, Riot ID, Region, Rank, Season Pts, Role, Status (banned/DNP), Actions
- Row actions: Edit, Note, Ban/Unban, Delete
- "Add Player" button opens inline form: name, riotId, region, rank

**Edit player modal** (inline panel, replaces table):
- Fields: Display Name, Riot ID, Region, Role (player/pro/host/admin), Rank, Season Pts
- Season Pts field has a red DANGER label - changes logged as DANGER in audit
- Ban toggle + DNP counter
- Save writes to `players` table

**Internal notes modal:** Existing note modal, admin-only, freetext, stored in player record

**Scrims Access panel** (below roster):
- Allowlist for The Lab access
- Add by username, remove by X button
- Persists to `site_settings` key `scrim_access`

**Disputes sub-section** (below Scrims Access):
- Table of player-submitted disputes from `disputes` table
- Columns: Player, Type, Description, Status, Date, Actions (Resolve/Dismiss)
- Pending count badge on tab label when disputes exist

**DB:** `players` table (select/insert/update/delete), `site_settings` (scrim_access), `disputes` (select/update)

---

### 3. Tournament

**Purpose:** Run every type of event - weekly clash and custom tournaments.

**Contents:**

**Weekly Clash section:**
- Clash details form: Name, Date (text), Time (text), Countdown ISO timestamp, Server (EU/NA)
- Phase stepper: Registration -> Check-in -> Live -> Complete (4-step visual progress bar)
- Phase action buttons: Open Check-in (disabled unless registration), Start Tournament (disabled unless check-in), Reset to Registration
- Tournament started creates/updates row in `tournaments` table
- Round config: Max Players, Round Count, Check-in Window, Cut Line, Cut After Game
- Seeding algorithm selector: Random, Rank-Based, Snake, Anti-Stack
- Schedule Events sub-section: create upcoming events (name, type, date, time, cap, format), list with cancel; writes to `scheduled_events` table

**Custom Tournaments section** (below Weekly Clash):
- Create form: Name, Date/Time (datetime-local), Max Players, Game Count, Format Preset (casual/standard/competitive), Seeding Method, Prize Pool builder (add rows per placement)
- Writes to `tournaments` table with `type: 'flash_tournament'`
- Existing tournaments list: name, date, phase, Open Registration / View / Delete actions

**DB:** `tournaments` (insert/update), `scheduled_events` (insert/delete)

---

### 4. Results

**Purpose:** Enter per-game placements after a clash, auto-calculate earned points using the `PTS` constant, and publish to DB.

**Contents:**
- Lobby selector (if multiple lobbies ran this clash)
- Per-lobby placement grid: each checked-in player gets a 1-8 placement dropdown
- Auto-calculated pts preview column (read-only, updates live as placements are entered): uses `PTS = {1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`
- Validation: all 8 slots must be filled, no duplicate placements per lobby
- "Publish Results" button: adds earned pts to `players.season_pts`, writes rows to `game_results` table, logs as ACTION in audit
- Published lobbies lock (read-only view with edit override requiring confirm)

**Distinction from player edit:** The Results tab is for post-game batch entry (placement -> pts calculation). Raw point overrides (arbitrary number, logged as DANGER) live in the player edit modal in the Players tab.

**DB:** `game_results` (insert), `players` (increment season_pts), `audit_log` (ACTION entries)

---

### 5. Settings

**Purpose:** All site configuration, season management, outward-facing communications, and the danger zone.

**Contents:**

**Site Toggles:**
- `registration_open` toggle (bool) - writes to `site_settings`
- `season_active` toggle (bool) - writes to `site_settings`

**Broadcast:**
- Type selector: NOTICE / ALERT / UPDATE / RESULT / INFO
- Message input + Send button
- Active announcements list with dismiss
- Writes to `site_settings` key `announcement`

**Ticker Overrides:**
- Custom ticker items list (add/remove)
- Persists to `site_settings` key `ticker_overrides`

**Sponsorships:**
- View/remove existing org sponsors (org name, logo text, hex color, assigned player)
- Add new sponsorship form
- Persists to `site_settings` key `org_sponsors`

**Season Management:**
- Season name field + Save
- Season stats readout (players, total pts, games, clashes)
- Start Season / End Season (writes to `seasons` table, snapshots stats)

**Danger Zone:**
- Reset Season Stats (zeroes all player pts/games, syncs to DB)
- Clear All Players (empties `players` table)
- Full Season Reset (stats + roster + tournament state)

**DB:** `site_settings` (upsert), `seasons` (insert/update), `players` (bulk update/delete)

---

### 6. Audit

**Purpose:** Full, persistent, server-side log of every admin action.

**Contents:**
- Filter bar: All / ACTION / WARN / DANGER / BROADCAST
- Server-side paginated query: 25 rows per page, newest first
- Each row: type badge (color-coded), timestamp, actor name, message
- "Load More" pagination (cursor-based via `created_at`)
- No in-memory fallback - reads directly from `audit_log` table

**DB:** `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 25 OFFSET n WHERE action = filter`

---

### 7. Hosts

**Purpose:** Review host applications and manage host profiles.

**Contents:**
- Pending / Approved / Rejected counts
- Application cards: applicant name, org, email, frequency, applied date, reason text
- Approve: updates `host_applications` status, upserts `user_roles` with role='host', fires notification
- Reject: updates `host_applications` status
- Approved hosts list below with link to their `host_profiles` record

**DB:** `host_applications` (select/update), `user_roles` (upsert), `host_profiles` (select)

---

## Shell (AdminScreen.jsx)

- Admin auth gate: if `!isAdmin` render access-denied panel, return early
- Collapsible sidebar nav with grouped sections (LIVE, MANAGE, SYSTEM) matching current design
- Phase badge + pending hosts alert in sidebar header
- Tab info footer in sidebar (descriptive hint text per tab)
- Sidebar toggle button (collapse/expand)
- Each tab rendered via a simple `{tab === 'x' && <XTab />}` conditional - no React.lazy needed since admin is already lazy-loaded at the router level

---

## Data Flow

- Each tab fetches its own data on mount via `useEffect`
- Shared state (players, tournamentState, etc.) read from `useApp()` - no prop drilling
- All writes go to Supabase first, then update local state on success
- All destructive actions require `window.confirm()` before executing
- All admin mutations call `addAudit()` from `useApp()` immediately after success

---

## Error Handling

- Every Supabase call checks `.error` and calls `toast(msg, 'error')` on failure
- No silent swallows - all errors surface to the user
- Disputes and audit log show loading states while fetching
- Empty states for every list that can be empty

---

---

## Part 2: EventsScreen Fixes

### File: `src/screens/EventsScreen.jsx`

**Fix 1 - Featured registrations loaded on mount**

`FeaturedTab` currently relies on optimistic local state for `registeredIds`. On page refresh, registrations vanish. Fix: on mount, query `event_registrations` for `player_username = currentUser.username` and merge matched event IDs into `featuredEvents` so the "Registered" state persists.

```
SELECT event_id FROM event_registrations WHERE player_username = currentUser.username
```

**Fix 2 - Filter pills wired to real event types**

The Community / Official / Regional pills filter by `ev.type` but featured events never have this field set, so they always show all. Two options: (a) remove the pills and replace with a single Live/Upcoming toggle which is actually useful, or (b) keep pills but derive filter from `ev.tags` array which IS populated. Use option (b) - filter checks if `ev.tags` includes the filter value (case-insensitive). "All Events" always shows everything.

**Fix 3 - Archive links navigate to specific clash**

`ArchiveTab` hardcodes `navigate('/results')` for every item. Fix: navigate to `/results?clash=${clash.id}` (or the closest specific route). If a specific results route doesn't exist for that clash, link to `/results` with the clash name passed as state so `ResultsScreen` can filter. The key fix is not all items pointing to the same generic page.

**Fix 4 - Tournaments tab cards get inline register button**

`TournamentsTab` cards navigate on click but have no register action. Add a "Register" button at the bottom of each card (same pattern as `TournamentCard` in FeaturedTab) that calls `supabase.from('registrations').upsert(...)` for the flash tournament. Show "Registered" state if already registered. Requires loading current user's registrations on mount.

**Fix 5 - "WATCH BROADCAST" ID mismatch**

`TournamentCard` navigates to `/tournament/${ev.id}` but `featuredEvents` use a numeric local ID, not the DB tournament UUID. Fix: use `ev.dbTournamentId` if present, fall back to `ev.id`. This ensures the link reaches the correct `TournamentDetailScreen`.

---

## Part 3: TournamentDetailScreen Fixes

### File: `src/screens/TournamentDetailScreen.jsx`

**Fix 6 - Rules read from `rules_text` column**

The Overview tab shows four hardcoded generic rules. Fix: if `event.rulesText` or `event.rules_text` is present, render it as preformatted text in the rules panel. If null, show the generic fallback rules. The host sets `rules_text` in the tournament wizard.

**Fix 7 - Prize distribution uses real data**

The prize bar section uses hardcoded `PRIZE_BARS` with fixed 50%/30%/20% widths. Fix: if `event.prize_pool_json` (array of `{placement, prize}`) exists, render each entry as a row with its placement and prize value. Remove the fake percentage bars. If no prize data, hide the section entirely rather than showing misleading placeholder bars.

**Fix 8 - "Manage Tournament" link uses DB ID**

The manage link only renders when `event.hostTournamentId && event.host === currentUser.username` - both fragile in-memory checks. Fix: render the link when `event.dbTournamentId` is present and `currentUser.id` matches `event.host_id` (or fall back to the username check). Navigate to `/host/dashboard` instead of using `setScreen`.

---

## Part 4: HostDashboardScreen Fixes

### File: `src/screens/HostDashboardScreen.jsx`

**Fix 9 - Image uploads use `host-assets` bucket**

`uploadImage()` uploads to the `avatars` bucket. Migration 024 created `host-assets` for this purpose. Change `supabase.storage.from("avatars")` to `supabase.storage.from("host-assets")` in both the upload call and the `getPublicUrl` call.

**Fix 10 - Tournament query uses auth user ID**

`.eq("host_id", currentUser.id)` uses the profile row ID. The `tournaments.host_id` column stores the Supabase auth UUID. Fix: use `currentUser.auth_user_id || currentUser.id` consistently, matching how other screens resolve auth identity. Also update `submitWizard` to write `host_id: currentUser.auth_user_id || currentUser.id`.

**Fix 11 - Host-created tournaments appear in Tournaments tab**

`submitWizard` creates with `type: savedWizData.type` (swiss/standard). `TournamentsTab` in `EventsScreen` queries `type = 'flash_tournament'`. Fix: write `type: 'flash_tournament'` for all host-created tournaments regardless of format. The format/type distinction (swiss vs standard) is stored separately in the `type` or `total_games` columns and doesn't need to pollute the top-level `type` field.

**Fix 12 - Announcements write to `notifications` table**

`sendAnnouncement()` only updates local state. Fix: insert a row into `notifications` with `type = 'host_announce'`, `body = announceMsg`, `target_user_id = null` (broadcast to all tournament registrants). Also write to `site_settings` key `host_announcement_{tournamentId}` so it persists across refresh.

---

## What Is Not In Scope

- Stripe integration (explicitly skipped per project rules)
- AI commentary wiring (separate task)
- Discord bot commands (separate system)
- Playwright E2E tests (separate phase)
