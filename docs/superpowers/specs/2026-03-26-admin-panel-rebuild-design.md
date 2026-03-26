# Admin Panel Rebuild - Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Goal

Rebuild `AdminScreen.jsx` from a 1,777-line monolith into a modular, fully-wired 7-tab admin panel. All existing functionality is preserved and reorganized. Three genuine upgrades over the current panel: score overrides move into the player edit modal, disputes move into Players, and the audit log becomes server-side.

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

## What Is Not In Scope

- Stripe integration (explicitly skipped per project rules)
- AI commentary wiring (separate task)
- Discord bot (separate system)
- Playwright E2E tests (separate phase)
