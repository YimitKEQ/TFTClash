# Clash Engine Sprint 1 — Design Spec
**Date:** 2026-03-24
**Status:** Approved by user

---

## 1. Goal

Make the TFT Clash platform production-ready for hosting the weekly Saturday night clash. Players self-register, link their Riot IDs, check in, play, and submit their own results. Admin reviews submissions and confirms scores. Results persist to the database. Standings update live.

---

## 2. Scope

**In scope:** Riot ID linking, tournament server field (NA/EU), self-service registration with Riot ID confirmation, player placement submission, admin submission review, result persistence audit + fix, lobby Riot ID display.

**Out of scope:** Discord bot auto-channel creation (future sprint), Riot API verification of accounts (requires API access), custom multi-phase tournament engine (Sprint 2), Stripe payments, email verification.

---

## 3. Data Model Changes

### 3.1 `players` table — 2 new columns

| Column | Type | Default | Description |
|---|---|---|---|
| `riot_id_na` | text | null | Player's NA Riot ID, e.g. `Levitate#NA1` |
| `riot_id_eu` | text | null | Player's EU Riot ID, e.g. `Levitate#EUW` |

Migration: `ALTER TABLE players ADD COLUMN riot_id_na text, ADD COLUMN riot_id_eu text;`

### 3.2 `tournament_state` table — 1 new column

| Column | Type | Default | Description |
|---|---|---|---|
| `server` | text | `'EU'` | Server for this clash week. `'NA'` or `'EU'`. |

Migration: `ALTER TABLE tournament_state ADD COLUMN server text DEFAULT 'EU';`

### 3.3 New table: `pending_results`

Stores player-submitted placements before admin confirmation. Keeps dirty/unconfirmed data separate from the authoritative `game_results` table.

```sql
CREATE TABLE pending_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id),
  round integer NOT NULL,
  lobby_number integer NOT NULL,
  player_id integer REFERENCES players(id),
  placement integer NOT NULL CHECK (placement BETWEEN 1 AND 8),
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
  UNIQUE (tournament_id, round, player_id)
);

-- Index for admin lobby-scoped queries
CREATE INDEX pending_results_lookup ON pending_results (tournament_id, round, lobby_number);

ALTER TABLE pending_results ENABLE ROW LEVEL SECURITY;
-- Players can insert/read their own row; admin can read all + update status
CREATE POLICY "players insert own" ON pending_results FOR INSERT WITH CHECK (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));
CREATE POLICY "players read own" ON pending_results FOR SELECT USING (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));
-- Admin policy uses is_admin column on players table (added in migration 3.1a below)
CREATE POLICY "admin full access" ON pending_results USING (EXISTS (SELECT 1 FROM players WHERE auth_user_id = auth.uid() AND is_admin = true));
```

**Additional migration 3.1a — add `is_admin` column to `players`:**
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
-- Set admin flag for known admin player (Levitate, id=1):
UPDATE players SET is_admin = true WHERE id = 1;
```

Note: AppContext currently stores `isAdmin` in `localStorage` as a UI flag. The DB `is_admin` column is the authoritative source used by RLS policies. AppContext should derive `isAdmin` from `currentUser.is_admin` after this migration (Phase 1 includes updating AppContext to read `currentUser.is_admin` instead of `localStorage`).

AppContext exposes `pendingResults` state, subscribed via Supabase realtime on the `pending_results` table (admin sees all rows, players see their own).

---

## 4. Account Screen — Riot ID Section

### 4.1 UI

New section added to `AccountScreen.jsx` below the existing profile fields, titled **"Riot Accounts"** with a `sports_esports` icon.

Two input fields:
- **EU Riot ID** — label includes `EU` server badge (teal), placeholder `Username#EUW`
- **NA Riot ID** — label includes `NA` server badge (gold), placeholder `Username#NA1`

Each field shows a status row below it:
- If filled: teal `check_circle` icon + "Linked — used for [EU/NA] clash weeks"
- If empty: gold `warning` icon + "Not linked — you won't be able to register for [NA/EU] weeks"

Save button: "Save Riot IDs" — calls `supabase.from('players').update({riot_id_eu, riot_id_na}).eq('id', currentUser.id)`, then calls `setCurrentUser(Object.assign({}, currentUser, { riot_id_eu: riot_id_eu, riot_id_na: riot_id_na }))` to update AppContext state immediately without a re-fetch. AppContext's `currentUser` is a live reflection of the `players` row (loaded via `SELECT *`), so the new fields are present after the next auth session load automatically — the `setCurrentUser` call ensures the UI reflects the change instantly.

### 4.2 Validation

Format: must contain exactly one `#` character. Neither segment can be empty. No other validation (trust-based, no Riot API call). Invalid format shows inline error: "Use the format Username#Tag".

### 4.3 Constants update

`src/lib/constants.js` — update `SEED` rows to include `riot_id_eu` for each homie (e.g. `riot_id_eu: 'Levitate#EUW'`). `riot_id_na` left null in seed data.

---

## 5. Admin Panel — Tournament Server Field

In `AdminScreen.jsx`, the tournament creation/edit form (dashboard tab) adds a **Server** field:

```
Server: [EU ▾] / [NA]   (segmented control or select)
```

Saves `server` field to `tournament_state` table alongside `clashTimestamp`, `maxPlayers`, etc.

Displayed in the AdminScreen tournament info section as "Server: EU" or "Server: NA".

---

## 6. Registration Flow — Server + Riot ID Confirmation

### 6.1 ClashCard registration phase (DashboardScreen)

The existing registration bottom zone gains two additions:

**When Riot ID IS linked for that server:**
A teal confirmation box appears above the Register Now button:
```
[sports_esports icon]  Your EU account
                       Levitate#EUW
```

**When Riot ID is NOT linked for that server:**
A gold warning box replaces the confirmation box:
```
[warning icon]  Link your EU Riot ID in Account settings before registering.
```
Register Now button is disabled. "Go to Account" ghost button appears alongside it.

### 6.2 Logic

```js
var server = tournamentState.server || 'EU'
var riotField = server === 'NA' ? 'riot_id_na' : 'riot_id_eu'
var linkedId = currentUser && currentUser[riotField]
var canRegister = isRegistered || !!linkedId
```

Registration CTA copy stays "Register Now". "Who's In" ghost button remains.

---

## 7. ClashScreen — Lobby Cards with Riot IDs

In ClashScreen, each player row in a lobby card displays their Riot ID for the current server:

```
Levitate       Levitate#EUW        ← riot_id_eu (this is an EU week)
Zounderkite    Zounderkite#EUW
Uri            [warning icon]       ← riot_id_eu not set
```

The Riot ID is pulled from the `players` array in AppContext (already loaded). No additional fetch needed.

Admin uses this to read out lobby assignments in Discord so players can find each other in-game.

---

## 8. Player Result Submission

### 8.1 Live phase ClashCard — player side

The live phase bottom zone in `DashboardScreen.jsx` currently renders: a phase tag (teal live dot + "Round X of Y"), a "Round X of Y" body text line, a lobby box showing player names, and two buttons ("Submit Results" + "Live Board"). The "Submit Results" button currently navigates to `/clash`. This navigation is replaced: clicking "Submit Results" now toggles `showPicker` local state to `true`, which swaps the lobby box + buttons for the inline placement picker below. The "Live Board" button is retained and continues to navigate to `/clash`.

**Picker state** (when `showPicker === true`):

**Picker state:**
- Text: "How did you finish in Lobby [N]?"
- 8 buttons in a 4×2 grid: 1st through 8th
- Tapping a button selects it (highlights gold)
- "Confirm [X]th Place" button below (disabled until selection made)
- "Cancel" text link to return to default live state

**Submitted state** (after confirmation):
- Large placement number (Russo One font, gold)
- Label: "Your submission · Lobby [N]"
- Teal status: "Waiting for admin to confirm"
- Body text: "Results lock in once admin confirms all lobbies."

### 8.2 Data write

On confirmation:
```js
supabase.from('pending_results').upsert({
  tournament_id: tournamentState.id,
  round: tournamentState.round,
  lobby_number: myLobbyNumber,
  player_id: currentUser.id,
  placement: selectedPlacement,
  status: 'pending'
}, { onConflict: 'tournament_id,round,player_id' })
```

`upsert` with conflict key allows a player to change their submission before admin confirms. `myLobbyNumber` is derived by finding which lobby index contains `currentUser.id` in `tournamentState.lobbies`.

### 8.3 Round tracking

`tournamentState.round` (integer, field name confirmed in AppContext line 87 and ClashScreen) determines which round submissions belong to.

---

## 9. Admin Submission Review (ClashScreen)

### 9.1 Submission panel per lobby

In ClashScreen, each lobby card gains a results tab/section showing all 8 submissions for the current round:

| # | Player | Status |
|---|---|---|
| 1 | Levitate | Submitted (teal) |
| 2 | Zounderkite | Submitted (teal) |
| 5 | Wiwi | Conflict: also claims 5th (red) |
| ? | Sybor | Pending (gray) |

**Conflict detection:** If two players in the same lobby submit the same placement, both rows are flagged red with a conflict message.

**Footer buttons:**
- "Confirm All" (gold, primary) — enabled only when all 8 have submitted AND no conflicts exist
- "Dispute" (red ghost) — allows admin to override any row with a manual placement

### 9.2 Confirm All flow

On "Confirm All":
1. `pending_results` rows for this lobby + round → status set to `'confirmed'`
2. For each confirmed row: insert into `game_results` (`player_id`, `tournament_id`, `round`, `placement`, `pts` from PTS constant)
3. Update player stats atomically using Postgres increment (not client-side read-modify-write):
   ```sql
   UPDATE players SET
     pts = pts + $pts,
     wins = wins + $winsIncrement
   WHERE id = $player_id
   ```
   Called via `supabase.rpc('increment_player_stats', { p_player_id, p_pts, p_wins })` — a Postgres function added in Phase 1 migration. This prevents lost-update races from concurrent admin confirms.
4. Check if all lobbies for this round are confirmed: query `pending_results` where `tournament_id = X AND round = Y AND status != 'confirmed'` — if 0 rows remain, all lobbies are done.
   - If more rounds remain (`tournamentState.round < tournamentState.totalGames`): call `setTournamentState(function(ts){ return Object.assign({}, ts, { round: ts.round + 1 }) })` and persist to DB.
   - If final round (`tournamentState.round === tournamentState.totalGames`): call `setTournamentState(function(ts){ return Object.assign({}, ts, { phase: 'complete' }) })` and persist to DB.

### 9.3 Dispute / Override

Admin clicks "Dispute" on a row → inline number input appears to enter the correct placement manually. Admin saves → that player's `pending_results` row updated with admin-entered placement and status `'confirmed'`, then Confirm All can proceed.

---

## 10. Result Persistence Audit

Before implementing new features, audit the existing `game_results` write path in `ClashScreen.jsx`:

1. Locate all `supabase.from('game_results').insert()` or `.upsert()` calls
2. Verify they are not UI-only (i.e. they actually await and handle errors)
3. Verify `players.pts` and `players.wins` are updated in the DB (not just in local state)
4. Verify `tournament_state.phase` transitions to `'complete'` after final round

Fix any broken writes. The new pending_results → game_results flow (Section 9.2) replaces any existing direct admin-entry result writes in ClashScreen — remove the old path once the new one is verified.

---

## 11. Standings + Results Screens

No new UI needed. Both screens read from `game_results` and `players` tables which are already wired. Once result persistence is fixed (Section 10) and the new confirmation flow writes correctly (Section 9), standings and results update automatically.

Verify:
- StandingsScreen re-renders when `players` state updates in AppContext
- ResultsScreen finds the latest clash correctly (sorts `pastClashes` by date desc, shows most recent)
- DashboardScreen ClashCard shows `complete` phase state after `tournamentState.phase = 'complete'`

---

## 12. Code Style Rules (Non-Negotiable)

Every file touched must comply with CLAUDE.md:
- `var` declarations — no `const`/`let` in React components and app logic
- `function(){}` callbacks — no arrow functions
- No backtick string literals inside JS functions
- No named function components defined inside another component's body
- Tailwind CSS classes for all styling — no inline styles in new/modified code
- Material Symbols Outlined icons (`<Icon>`) in all new/modified screens
- `supabase.js` is exempt from these rules
- **`Sel` component** (select wrapper): not in shared UI library. Define locally in any screen that needs a `<select>` element (e.g. AdminScreen server selector). Pattern: `function Sel(props){ return <select className="..." {...props} /> }`
- **ClashScreen location**: `src/screens/ClashScreen.jsx` (standalone file, not inside App.jsx). The legacy App.jsx still references it but the actual implementation is in the screens directory.

---

## 13. Implementation Phases

**Phase 1 — DB migrations + AppContext `isAdmin` fix**
- Add `riot_id_na`, `riot_id_eu` to `players` table
- Add `is_admin boolean DEFAULT false` to `players` table; set `is_admin = true` for id=1
- Add `server text DEFAULT 'EU'` to `tournament_state` table
- Create `pending_results` table with `lobby_number` column, index, and RLS policies
- Create `increment_player_stats` Postgres RPC function
- Update AppContext to read `isAdmin` from `currentUser.is_admin` instead of `localStorage`
- Update `SEED` constant with `riot_id_eu` values for each homie

**Phase 2 — Account Screen Riot IDs**
- Add Riot ID section to `AccountScreen.jsx`
- Input validation (`username#tag` format)
- Save to Supabase, update AppContext `currentUser`

**Phase 3 — Admin Server Field**
- Add server selector to AdminScreen tournament form
- Persist `server` field to `tournament_state`

**Phase 4 — Registration Riot ID Confirmation**
- Update DashboardScreen ClashCard registration phase
- Show server label, linked Riot ID confirmation or warning
- Disable Register Now when ID not linked

**Phase 5 — Lobby Riot ID Display**
- Update ClashScreen lobby cards to show Riot ID per player
- Show warning icon when player has no ID for that server

**Phase 6 — Result Persistence Audit**
- Read and audit existing `game_results` write path
- Fix any broken or missing DB writes
- Verify `players.pts`, `players.wins`, `tournament_state.phase` all update correctly

**Phase 7 — Player Placement Submission**
- Add `pendingResults` state + realtime subscription to AppContext
- Build inline placement picker in DashboardScreen ClashCard live phase
- Write to `pending_results` table on confirm

**Phase 8 — Admin Submission Review**
- Add submission review panel to ClashScreen lobby cards
- Conflict detection, Confirm All flow
- Dispute / override mechanism
- Wire Confirm All → `game_results` insert → player stats update → phase advance
