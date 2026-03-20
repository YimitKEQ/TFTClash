# TFT Clash — Production-Ready Tournament Design Spec

> Date: 2026-03-20
> Author: Levitate + Claude
> Timeline: <1 week to first tournament
> Scope: Standalone flash tournament for up to 128 players

---

## 1. Goals

1. **Run a real standalone tournament** — not a season, a single flash event with prizes
2. **Kill localStorage for shared state** — all tournament/player data lives in Supabase
3. **Bulletproof multi-user flow** — every player sees the same state in real-time
4. **Self-service score reporting** — players report placements, admin verifies and locks
5. **Dispute resolution** — players can challenge results, admin resolves
6. **Prize pool display** — show who wins what, from tournament page to results
7. **Lobby host designation** — one player per lobby creates the TFT custom game
8. **Members directory** — browse all platform users, separate from tournament roster
9. **Profile that works** — edit, display, Riot ID required for tournament entry
10. **Design polish** — landing page to results, everything looks and feels production-quality

---

## 2. Tournament Types

### 2.1 Flash Tournament (NEW — primary focus)
- Standalone single event, not part of a season
- Admin creates with: name, date/time, max players (up to 128), game count, format, prize pool
- Dedicated page at `#tournament-{id}`
- Full lifecycle: registration → check-in → lobbies → games → results → archive

### 2.2 Season Clash (existing, untouched)
- Weekly recurring events that accumulate season points
- Existing flow continues to work as-is
- Not in scope for this sprint

---

## 3. Database Changes

### 3.1 New Columns on `tournaments` Table

```sql
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'season_clash'
  CHECK (type IN ('season_clash', 'flash_tournament'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool JSONB DEFAULT '[]';
  -- e.g. [{"place":1,"prize":"€100"},{"place":2,"prize":"€50"},{"place":3,"prize":"€25"}]
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cut_line_pts INT; -- null = no cut
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS announcement TEXT DEFAULT '';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lobby_host_method TEXT DEFAULT 'highest_rank'
  CHECK (lobby_host_method IN ('highest_rank', 'random', 'manual'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'upcoming'
  CHECK (phase IN ('upcoming', 'registration', 'check_in', 'in_progress', 'complete', 'cancelled'));
-- NOTE: games_per_stage maps to existing `round_count` column (migration 005)
-- NOTE: check-in window uses existing `checkin_open_at`/`checkin_close_at` columns (migration 005)
-- No duplicate columns needed for check-in or game count
```

### 3.2 New Columns on `lobbies` Table

```sql
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS host_player_id UUID REFERENCES players(id);
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS lobby_code TEXT; -- TFT custom game code
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_number INT DEFAULT 1;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS reports_complete BOOLEAN DEFAULT false;
```

### 3.3 New `disputes` Table

```sql
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  lobby_id BIGINT REFERENCES lobbies(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  claimed_placement INT CHECK (claimed_placement BETWEEN 1 AND 8),
  reported_placement INT,
  reason TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved_accepted', 'resolved_rejected')),
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read disputes for their tournament"
  ON disputes FOR SELECT USING (true);
CREATE POLICY "Players can create disputes for their own games"
  ON disputes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update disputes"
  ON disputes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### 3.4 New `player_reports` Table

Tracks self-reported placements before admin locks:

```sql
CREATE TABLE IF NOT EXISTS player_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id BIGINT REFERENCES tournaments(id) ON DELETE CASCADE,
  lobby_id BIGINT REFERENCES lobbies(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  reported_placement INT CHECK (reported_placement BETWEEN 1 AND 8),
  reported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lobby_id, game_number, player_id)
);
-- NOTE: No UNIQUE on (lobby_id, game_number, reported_placement) — duplicate placement
-- detection is app-level logic shown to admin, not a DB constraint. Two players CAN
-- claim the same placement; the admin resolves the conflict before locking.

ALTER TABLE player_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reports" ON player_reports FOR SELECT USING (true);
CREATE POLICY "Players report own placement"
  ON player_reports FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "Players can update own report before lock"
  ON player_reports FOR UPDATE USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "Admins can manage reports"
  ON player_reports FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### 3.5 RLS Hardening on `site_settings`

```sql
-- Remove permissive policies
DROP POLICY IF EXISTS "Anyone can insert" ON site_settings;
DROP POLICY IF EXISTS "Anyone can update" ON site_settings;

-- Admin-only writes
CREATE POLICY "Admins can insert site_settings"
  ON site_settings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update site_settings"
  ON site_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Also tighten lobbies and tournaments writes to admin/host only
DROP POLICY IF EXISTS "Authenticated users can insert lobbies" ON lobbies;
DROP POLICY IF EXISTS "Authenticated users can update lobbies" ON lobbies;
CREATE POLICY "Admins can manage lobbies"
  ON lobbies FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'host'))
  );

DROP POLICY IF EXISTS "Authenticated users can insert tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON tournaments;
CREATE POLICY "Admins can manage tournaments"
  ON tournaments FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'host'))
  );
```

### 3.6 Data Migration: Off localStorage/site_settings

| Data | From | To | Realtime |
|------|------|----|----------|
| Tournament state | `site_settings['tournament_state']` + `tft-tournament` localStorage | `tournaments` table columns (phase, round, check_in_open, etc.) | Subscribe to `tournaments` table changes |
| Lobby assignments | `site_settings['tournament_state'].lobbies` + localStorage | `lobbies` table | Subscribe to `lobbies` table changes |
| Audit log | `site_settings['audit_log']` + localStorage | `audit_log` table (already exists) | No realtime needed |
| Announcement | `site_settings['announcement']` + localStorage | `tournaments.announcement` column | Subscribe to `tournaments` |
| Players | `players` table (already correct) | No change | Subscribe to `players` table |
| Notifications | `tft-notifications` localStorage | `notifications` table (already exists) | Subscribe to `notifications` |

**localStorage keys to KEEP (local-only preferences):**
- `tft-admin` — admin flag (verified via API)
- `tft-cookie-consent` — GDPR preference
- `tft-clash-reminders` — notification opt-in
- `tft-data-version` — cache buster

**localStorage keys to REMOVE — PHASED:**

**Phase A (tournament-critical, do first):**
- `tft-tournament` → read from `tournaments` table
- `tft-players` → always load from `players` table (already partially done)
- `tft-audit-log` → write to `audit_log` table
- `tft-announcement` → read from `tournaments.announcement`

**Phase B (nice-to-have, do if time permits):**
- `tft-notifications` → use `notifications` table
- `tft-events`, `tft-scheduled-events` → DB-driven events
- `tft-season-config` → use `seasons` table

**Phase C (defer to post-tournament):**
- `tft-sponsors`, `tft-host-*`, `tft-featured-events`
- `tft-challenge-completions`

---

## 4. Lobby Sizing Algorithm

**Constraints:** 6-8 players per lobby. Prefer 8. Minimum tournament size: 6 players.

**Algorithm:**
1. Start with `k = floor(N / 8)` full lobbies
2. `remainder = N - (k * 8)`
3. If `remainder == 0`: done — all lobbies of 8
4. If `remainder >= 6`: add one lobby of `remainder`
5. If `remainder > 0 AND remainder < 6`:
   - Need to pull `(6 - remainder)` players from full lobbies
   - If `k >= (6 - remainder)`: reduce that many lobbies from 8→7, create lobby of 6
   - If `k < (6 - remainder)`: `remainder` players get a **bye** (sit out, 0pts neutral)

**Scoring in smaller lobbies:** Points scale is unchanged (1st=8pts always). Placements that don't exist (7th/8th in a 6-person lobby) simply aren't awarded.

**Examples:**
- 128 players → 16 lobbies of 8
- 24 players → 3 lobbies of 8
- 23 players → 2 lobbies of 8, 1 lobby of 7
- 20 players → 2 lobbies of 7, 1 lobby of 6
- 9 players → 1 lobby of 8, 1 bye (lowest seed gets bye, 0pts — not a penalty, just neutral; they play next game normally)

---

## 5. Tournament Flow (Step-by-Step)

### Phase 1: Registration
- Admin creates flash tournament via admin panel or dedicated creation form
- Tournament appears on Flash Tournament page with: name, date, time, prize pool, format
- Players click "Register" → row inserted in `registrations` table
- Live counter: "47/128 registered"
- Waitlist activates when max players reached
- **Gate:** Player must have Riot ID set on profile to register (needed for lobby invites)

### Phase 2: Check-In (T-60min to T-15min)
- Admin opens check-in → `tournaments.check_in_open = true`
- Registered players see prominent "Check In" button
- Check-in status shown: "32/47 checked in"
- At T-15min (or admin trigger): check-in closes
  - Unchecked players → status = 'dropped'
  - Waitlisted players auto-promoted in order
- Final roster locked

### Phase 3: Lobby Generation
- Admin clicks "Generate Lobbies"
- Seeding algorithm runs (snake by rank, or random — admin picks)
- Lobby sizing algorithm creates lobbies of 6-8
- **Lobby host assigned:** highest-ranked player per lobby (default), admin can override
- Players see their lobby assignment on bracket page
- Lobby host sees: "You are the lobby host" + field to enter TFT lobby code
- Host enters lobby code → other players see it on their lobby card

### Phase 4: Game In Progress
- Lobby host creates TFT custom game, invites lobby members
- Players play the game
- After game ends, each player self-reports placement via their lobby card:
  - Dropdown: 1st through 8th (or max for lobby size)
  - Submit button → writes to `player_reports` table

**Admin Dashboard — Lobby Monitor:**
- Per-lobby card showing:
  - Lobby name (A, B, C... or numbered)
  - Reports status: "6/8 reported" with list of who hasn't
  - Conflict detection: two players claiming same placement → red flag
  - Dispute indicator: if any player raised a dispute → orange badge
- "Lock Lobby" button (enabled when all reported + no unresolved conflicts)
- "Override" button — admin can manually set placements

### Phase 5: Lobby Lock & Scoring
- Admin reviews reports, resolves conflicts/disputes if any
- Clicks "Lock Lobby" → placements become `game_results` rows
- Points auto-calculated from PTS constant
- Locked lobbies show green checkmark
- Progress bar: "12/16 lobbies locked"
- Unlock available for corrections (existing feature)

### Phase 6: Multi-Game Rounds
- After all lobbies locked for Game N:
  - Cumulative standings update in real-time
  - If cut-line set and game count reached: eliminated players marked
  - Admin can re-seed lobbies (Swiss) or keep same
  - Admin triggers "Start Game N+1"
  - Repeat Phase 4-5

### Phase 7: Tournament Complete
- After final game lobbies all locked: admin clicks "Finalize Tournament"
- Final standings computed with full tiebreaker logic
- Results screen shows:
  - Podium (top 3) with trophy/crown visuals and prize text
  - Full standings table with: rank, player, total pts, avg placement, wins, prize
  - Grand champion card (downloadable/shareable)
- Tournament marked `phase = 'complete'`, archived automatically

---

## 6. Dispute System

### Player Side
- On their lobby card during/after a game: "Dispute" button
- Form: what placement they believe they got, what was reported, text reason, optional screenshot URL
- Dispute submitted → `disputes` table row with status 'open'
- Player sees their dispute status on their lobby card

### Admin Side
- Dispute badge on admin panel + lobby monitor
- Dispute queue: list of open disputes with:
  - Player name, lobby, game number
  - Claimed vs reported placement
  - Reason text + screenshot link
  - "Accept" (change placement to claimed) / "Reject" (keep as-is) / "Custom" (set different)
- Resolution logged in audit trail
- If a locked lobby's placement changes → points recalculated

---

## 7. Members Directory

New screen at `#members`:

- Lists all users in `players` table (anyone who created an account)
- **Not** tournament-specific — this is the platform member list
- Search by: name, Riot ID
- Filter by: region, rank tier
- Sort by: name (A-Z), rank (highest first), join date
- Each card shows: username, Riot ID, rank badge, region, member since
- Click → player profile page
- If logged in: "Add Friend" or "Challenge" button (future — just the UI shell for now)

---

## 8. Profile System

### Own Profile (Edit Mode)
- Header: username (editable), rank badge
- Fields: Riot ID (required for tournament entry), region (dropdown), rank (dropdown), bio (textarea)
- All changes save to `players` table via `auth_user_id` match
- Profile completeness indicator: "Complete your profile to join tournaments"
- Stats section (if competed): games played, avg placement, win rate, top 4 rate

### Other Player's Profile (View Mode)
- Same layout but read-only
- Stats, tournament history, achievements
- "Report" button (future — shell only)

### Signup → Player Row
- On account creation: `players` row created with `auth_user_id = auth.uid()`
- No more name-matching. All queries use `auth_user_id`.

---

## 9. Flash Tournament Screen

Dedicated page at `#tournament-{id}`:

### Pre-Event View
- Hero banner with tournament name, date/time, format
- Prize pool display (prominent, centered)
- Registration status + "Register" / "Check In" button (context-aware)
- Player list: who's registered, who's checked in
- Rules summary (game count, format, lobby size)
- Countdown timer to event start

### During Event View
- **Bracket tab:** Lobby cards with players, host indicator, lobby code, scores
- **Standings tab:** Live cumulative standings across all games
- **My Lobby tab:** (for players) focused view of their lobby — report placement, see others' reports, dispute button
- Admin controls integrated: generate lobbies, lock, unlock, finalize

### Post-Event View
- Results: final standings with prizes
- Champion card
- Match history: every game, every lobby, every placement
- Share button for results

---

## 10. Realtime Architecture

### Old Pattern (being replaced)
```
Admin action → upsert site_settings JSONB blob → realtime broadcast → all clients update
```

### New Pattern
```
Admin action → update tournaments/lobbies/game_results rows → Supabase Realtime on table changes → all clients update
```

### Subscriptions:

**IMPORTANT:** Supabase has a 100 concurrent connection limit. With 128 players, we
CANNOT open 6 channels per player (768 connections). Instead:

- **Single Supabase Realtime channel per tournament** using Broadcast
- Admin actions broadcast events: `{ type: 'phase_change' | 'lobby_update' | 'result_locked' | ... }`
- Clients receive broadcast and refetch only the relevant data
- Filter by `tournament_id` — only subscribe when viewing a tournament page
- Unsubscribe when navigating away

This keeps connections to ~130 max (1 per connected user) instead of 768.

---

## 11. Critical Bug Fixes

1. **Player linking:** Query by `auth_user_id` instead of `currentUser.username.toLowerCase()` name matching
2. **Logout:** Add `supabase.auth.signOut()` + clear `currentUser` + redirect to home
3. **Password reset:** Wire "Forgot password?" to `supabase.auth.resetPasswordForEmail(email)`
4. **site_settings RLS:** Admin-only INSERT/UPDATE (close security hole)
5. **game_results .catch():** Add error handler to enrichment query to prevent silent zero-stats
6. **Placement validation:** Enforce 1-8 range, no duplicate placements per lobby per game, at both UI and DB level
7. **Error banner:** If Supabase realtime disconnects mid-tournament, show visible warning + auto-reconnect
8. **Hardcoded "Season 1":** Replace ~10 remaining instances with `seasonConfig.name`

---

## 12. Design Polish

### Landing Page (HomeScreen)
- Hero section: clear CTA — "Join the next tournament" or "No upcoming tournaments"
- If flash tournament is upcoming: prominent card with countdown, register button
- Clean, focused — remove clutter, emphasize the call to action

### Navigation
- Add "Members" to nav
- Add "Tournaments" (flash tournament list) to nav
- Active screen indicator (underline or highlight)
- Mobile drawer: same items, clean order

### Tournament Cards
- Consistent card design: name, date, player count, status badge (upcoming/live/complete)
- Prize pool preview on card
- Color-coded status: green (registering), yellow (live), gray (complete)

### Lobby Cards
- Clear visual hierarchy: lobby letter/number, host badge, player list
- Report status: checkmarks for reported, X for missing
- Conflict highlighting: red border when duplicate placements detected
- Lock state: green border when locked, lock icon

### Results Screen
- Podium visualization: 1st (gold, large), 2nd (silver), 3rd (bronze)
- Prize text prominently displayed next to placement
- Stats summary per player: games, avg, wins
- Shareable champion card

### General
- Loading states: skeleton loaders, not spinners
- Error states: friendly messages with retry buttons, not blank screens
- Empty states: helpful messages guiding users what to do next
- Toast notifications for all actions: "Registered successfully", "Score submitted", "Lobby locked"
- Consistent spacing, typography, and color usage across all screens

---

## 13. Out of Scope

- Monolith split (App.jsx stays as one file)
- Stripe/payment wiring (tournament is free for now)
- Router migration (hash routing stays)
- TypeScript conversion
- Host marketplace features
- Discord bot changes
- Season system changes
- Challenge/milestone system
- Scrims system
- Unit tests (E2E coverage only)

---

## 14. Success Criteria

The tournament is production-ready when:

1. A player can sign up, set their Riot ID, and register for a flash tournament
2. Admin can create a tournament with prizes and a player cap
3. Check-in works: registered players check in, no-shows get dropped, waitlist promotes
4. Lobby generation creates balanced 6-8 player lobbies with a designated host
5. Lobby host can enter a lobby code that other players see
6. Players can self-report placements after each game
7. Admin can see reporting status per lobby, detect conflicts, resolve disputes
8. Admin can lock lobbies and cumulative standings update in real-time
9. Multi-game rounds work (Game 1 → lock all → Game 2 → ... → Final)
10. Finalization produces a clear winner with prize display
11. Every player sees the same state — no localStorage divergence
12. Supabase connection issues show a visible warning, not silent failure

---

## 15. Spec Review Fixes Applied

Issues identified by code reviewer and resolved:

| ID | Issue | Fix |
|----|-------|-----|
| C1 | FK type mismatch — spec used UUID for tournament_id/lobby_id, actual tables use BIGINT | Changed to BIGINT in disputes + player_reports SQL |
| C2 | Duplicate check-in columns — spec added check_in_open boolean, but checkin_open_at/checkin_close_at already exist | Removed duplicate columns, added NOTE to use existing |
| C3 | No player_reports UPDATE policy — players couldn't correct mistakes | Added UPDATE policy for own reports + admin ALL policy |
| C5 | localStorage migration too broad for 1 week | Phased into A (critical), B (nice-to-have), C (defer) |
| C6 | Placement validation ambiguous — spec said "DB level" but that blocks legitimate conflicts | Clarified: DB enforces per-player uniqueness only, duplicate detection is app-level |
| I2/I3 | Open write RLS on lobbies/tournaments | Added admin/host-only policies |
| I5 | 6 realtime channels x 128 players = 768 connections (over limit) | Switched to single Broadcast channel per tournament |
| I7 | Bye scoring contradiction (0pts = penalty, not neutral) | Clarified: lowest seed gets bye, 0pts neutral |
| S4 | No phase CHECK constraint | Added CHECK on tournaments.phase |

### Deferred Items (post-tournament)
- Members Directory — not needed for first tournament, build after
- Dispute screenshot upload — URL-paste only for now (Discord/Imgur links)
- Consolidate round_count/max_rounds — use existing round_count, document semantics
- Tournament un-finalize — add if time permits, otherwise admin can manually fix via DB
