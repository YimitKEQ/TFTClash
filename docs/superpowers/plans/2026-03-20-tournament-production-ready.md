# Flash Tournament Production-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TFT Clash production-ready to run a real standalone flash tournament with up to 128 players, self-reporting, disputes, prizes, and DB-driven state.

**Architecture:** Single-file React monolith (src/App.jsx, ~16,605 lines) with Supabase backend. All shared tournament state moves from localStorage/site_settings to proper normalized DB tables. Single Broadcast channel for realtime. Flash tournaments are separate from the existing season system.

**Tech Stack:** React 18, Supabase (Postgres + Auth + Realtime + Storage), Vite, Vercel serverless functions

**Spec:** `docs/superpowers/specs/2026-03-20-tournament-production-ready-design.md`

**CRITICAL RULES (from CLAUDE.md):**
1. NO IIFEs in JSX — `{(()=>{...})()}` crashes the Babel renderer
2. GCSS block (~lines 305-403) is a template literal — do NOT touch
3. Brace balance must stay at 0 after every edit
4. No backtick string literals inside JS functions
5. No named function components defined inside another component's body
6. Always verify brace balance after every edit block

---

## Phase 1: Database Migrations (Day 1, ~2 hours)

### Task 1.1: New Tournament Columns Migration

**Files:**
- Create: `supabase/migrations/032_flash_tournament_columns.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Flash tournament support: type, prizes, cut-line, announcement, lobby host method, phase constraint
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'season_clash'
  CHECK (type IN ('season_clash', 'flash_tournament'));
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_pool JSONB DEFAULT '[]';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS cut_line_pts INT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS announcement TEXT DEFAULT '';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS lobby_host_method TEXT DEFAULT 'highest_rank'
  CHECK (lobby_host_method IN ('highest_rank', 'random', 'manual'));

-- Add phase CHECK constraint (drop existing if any, re-add with all valid values)
-- Note: tournaments.phase already exists from create_tournaments.sql, just add constraint
DO $$ BEGIN
  ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_phase_check;
  ALTER TABLE tournaments ADD CONSTRAINT tournaments_phase_check
    CHECK (phase IN ('upcoming', 'registration', 'check_in', 'in_progress', 'complete', 'cancelled'));
EXCEPTION WHEN others THEN NULL;
END $$;
```

- [ ] **Step 2: Apply migration to Supabase**

Run via Supabase MCP tool `apply_migration` or SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/032_flash_tournament_columns.sql
git commit -m "feat: add flash tournament columns (type, prizes, cut-line, phase constraint)"
```

### Task 1.2: New Lobby Columns Migration

**Files:**
- Create: `supabase/migrations/033_lobby_host_and_reports.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Lobby host designation and game tracking
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS host_player_id UUID REFERENCES players(id);
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS lobby_code TEXT;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_number INT DEFAULT 1;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS reports_complete BOOLEAN DEFAULT false;
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

### Task 1.3: Create player_reports Table

**Files:**
- Create: `supabase/migrations/034_create_player_reports.sql`

- [ ] **Step 1: Write migration SQL**

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

ALTER TABLE player_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reports" ON player_reports FOR SELECT USING (true);
CREATE POLICY "Players report own placement"
  ON player_reports FOR INSERT WITH CHECK (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "Players can update own report"
  ON player_reports FOR UPDATE USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );
CREATE POLICY "Admins can manage reports"
  ON player_reports FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_player_reports_lobby ON player_reports(lobby_id, game_number);
CREATE INDEX idx_player_reports_tournament ON player_reports(tournament_id);
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

### Task 1.4: Create disputes Table

**Files:**
- Create: `supabase/migrations/035_create_disputes.sql`

- [ ] **Step 1: Write migration SQL**

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
CREATE POLICY "Anyone can read disputes" ON disputes FOR SELECT USING (true);
CREATE POLICY "Players can create disputes"
  ON disputes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update disputes"
  ON disputes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_disputes_tournament ON disputes(tournament_id, status);
CREATE INDEX idx_disputes_lobby ON disputes(lobby_id, game_number);
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Commit**

### Task 1.5: RLS Hardening

**Files:**
- Create: `supabase/migrations/036_rls_hardening.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Lock down site_settings: admin-only writes
DROP POLICY IF EXISTS "Anyone can insert" ON site_settings;
DROP POLICY IF EXISTS "Anyone can update" ON site_settings;
DROP POLICY IF EXISTS "Allow insert for all" ON site_settings;
DROP POLICY IF EXISTS "Allow update for all" ON site_settings;

CREATE POLICY "Admins can insert site_settings"
  ON site_settings FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update site_settings"
  ON site_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Lock down lobbies: admin/host only for writes
DROP POLICY IF EXISTS "Authenticated users can insert lobbies" ON lobbies;
DROP POLICY IF EXISTS "Authenticated users can update lobbies" ON lobbies;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON lobbies;
DROP POLICY IF EXISTS "Allow update for authenticated" ON lobbies;

CREATE POLICY "Admins can manage lobbies"
  ON lobbies FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'host'))
  );

-- Lock down tournaments: admin/host only for writes
DROP POLICY IF EXISTS "Authenticated users can insert tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can update tournaments" ON tournaments;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON tournaments;
DROP POLICY IF EXISTS "Allow update for authenticated" ON tournaments;

CREATE POLICY "Admins can manage tournaments"
  ON tournaments FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'host'))
  );
```

- [ ] **Step 2: Apply migration**
- [ ] **Step 3: Verify by attempting an INSERT as a non-admin user (should fail)**
- [ ] **Step 4: Commit**

---

## Phase 2: Bug Fixes & Auth (Day 1-2, ~3 hours)

### Task 2.1: Fix Player Linking (auth_user_id)

**Files:**
- Modify: `src/App.jsx` — search for `currentUser.username.toLowerCase()` player matching

- [ ] **Step 1: Find all player-linking code**

Search for patterns like: `p.name.toLowerCase() === currentUser.username.toLowerCase()`
Replace with: `p.authUserId === currentUser.id`

The `loadPlayersFromTable` function (line ~15770) already maps `auth_user_id` to `authUserId`. Update all consumers.

- [ ] **Step 2: Update linkedPlayer derivation in TFTClash root component**

Find: `var linkedPlayer = players.find(...)` — update to match on `authUserId === currentUser.id`

- [ ] **Step 3: Verify brace balance**
- [ ] **Step 4: Commit**

### Task 2.2: Add Logout Button

**Files:**
- Modify: `src/App.jsx` — AccountScreen (line ~12610) and Navbar (line ~2878)

- [ ] **Step 1: Add logout handler in TFTClash root**

Find `handleLogout` or create one near the auth handlers:
```javascript
function handleLogout(){
  supabase.auth.signOut().then(function(){
    setCurrentUser(null);
    setScreen("home");
    toast("Logged out successfully","info");
  }).catch(function(e){
    console.error("[TFT] logout failed:",e);
    toast("Logout failed","error");
  });
}
```

- [ ] **Step 2: Add logout button in AccountScreen header area**
- [ ] **Step 3: Pass handleLogout to AccountScreen via props**
- [ ] **Step 4: Verify brace balance**
- [ ] **Step 5: Commit**

### Task 2.3: Wire Password Reset

**Files:**
- Modify: `src/App.jsx` — LoginScreen (line ~12444)

- [ ] **Step 1: Find the dead "Forgot password?" span (around line 12548)**

Replace the `<span>` with a clickable element that:
1. Prompts for email (or uses the already-entered email field)
2. Calls `supabase.auth.resetPasswordForEmail(email)`
3. Shows toast: "Password reset email sent"

- [ ] **Step 2: Verify brace balance**
- [ ] **Step 3: Commit**

### Task 2.4: Add .catch() to Game Results Enrichment

**Files:**
- Modify: `src/App.jsx` — `loadPlayersFromTable` function (line ~15764)

- [ ] **Step 1: Find the `.then(function(gr){` chain (line ~15787)**

Add `.catch(function(e){ console.error("[TFT] game_results enrichment failed:", e); })` after the .then block.

- [ ] **Step 2: Verify brace balance**
- [ ] **Step 3: Commit**

---

## Phase 3: Flash Tournament CRUD & Screen (Day 2-3, ~6 hours)

### Task 3.1: Admin — Create Flash Tournament Form

**Files:**
- Modify: `src/App.jsx` — AdminPanel (line ~8327)

- [ ] **Step 1: Add "Create Flash Tournament" section to AdminPanel**

Form fields:
- Tournament name (text input)
- Date/time (datetime-local input)
- Max players (number, default 128)
- Game count (number, default 3)
- Format preset dropdown (casual/standard/competitive from TOURNAMENT_FORMATS)
- Seeding method dropdown (snake/random/rank-based)
- Prize pool (dynamic rows: placement number + prize text, add/remove)

- [ ] **Step 2: Write createFlashTournament handler**

Inserts into `tournaments` table:
```javascript
function createFlashTournament(formData) {
  var row = {
    name: formData.name,
    date: formData.date,
    phase: 'registration',
    type: 'flash_tournament',
    max_players: formData.maxPlayers,
    round_count: formData.gameCount,
    seeding_method: formData.seedingMethod,
    prize_pool: JSON.stringify(formData.prizes),
    lobby_host_method: 'highest_rank',
    registration_open_at: new Date().toISOString()
  };
  supabase.from('tournaments').insert(row).select().single()
    .then(function(res) {
      if (res.error) { toast("Failed to create tournament", "error"); return; }
      toast("Tournament created!", "success");
      // Navigate to tournament page
      setScreen("tournament-" + res.data.id);
    })
    .catch(function(e) { toast("Error: " + e.message, "error"); });
}
```

- [ ] **Step 3: Verify brace balance**
- [ ] **Step 4: Commit**

### Task 3.2: Flash Tournament Screen — Pre-Event View

**Files:**
- Modify: `src/App.jsx` — add new FlashTournamentScreen function + wire in root render

- [ ] **Step 1: Create FlashTournamentScreen component**

This is a NEW function component added to App.jsx (NOT inside another component).

Props: `tournamentId, currentUser, onAuthClick, toast, setScreen, players`

On mount: fetch tournament from `supabase.from('tournaments').select('*').eq('id', tournamentId).single()`
Also fetch registrations: `supabase.from('registrations').select('*, players(username, riot_id, rank, region)').eq('tournament_id', tournamentId)`

Renders:
- Hero: tournament name, date, format, game count
- Prize pool cards (parsed from tournament.prize_pool JSONB)
- Registration counter: "X / maxPlayers registered"
- Register / Unregister / Check In button (context-aware based on phase + user status)
- Player list: registered players with check-in status indicators

- [ ] **Step 2: Wire into root TFTClash render**

Find the screen routing section. Add:
```javascript
if (screen.indexOf("tournament-") === 0) {
  var tId = parseInt(screen.replace("tournament-", ""));
  content = FlashTournamentScreen({
    tournamentId: tId, currentUser: currentUser,
    onAuthClick: function(s){setAuthScreen(s);},
    toast: toast, setScreen: setScreen, players: players,
    isAdmin: isAdmin
  });
}
```

- [ ] **Step 3: Add "Tournaments" to Navbar**

In the Navbar function, add a nav item for "Tournaments" (screen: "tournaments").
Also add a TournamentsListScreen that fetches all flash tournaments and shows cards.

- [ ] **Step 4: Verify brace balance**
- [ ] **Step 5: Commit**

### Task 3.3: Registration & Check-In for Flash Tournaments

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen

- [ ] **Step 1: Register handler**

```javascript
function handleRegister() {
  if (!currentUser) { onAuthClick("login"); return; }
  // Check Riot ID gate
  var linkedPlayer = players.find(function(p) { return p.authUserId === currentUser.id; });
  if (!linkedPlayer || !linkedPlayer.riotId) {
    toast("Set your Riot ID in your profile before registering", "error");
    return;
  }
  supabase.from('registrations').insert({
    tournament_id: tournamentId,
    player_id: linkedPlayer.id,
    status: 'registered'
  }).then(function(res) {
    if (res.error) { toast("Registration failed: " + res.error.message, "error"); return; }
    toast("Registered!", "success");
    loadRegistrations(); // refetch
  });
}
```

- [ ] **Step 2: Check-in handler**

Updates registration status to 'checked_in' with checked_in_at timestamp.

- [ ] **Step 3: Unregister handler**

Deletes registration row. Shows confirmation first.

- [ ] **Step 4: Waitlist logic**

If registrations >= max_players, new registrations get status 'waitlisted'.

- [ ] **Step 5: Verify brace balance**
- [ ] **Step 6: Commit**

### Task 3.4: Admin Check-In Controls

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen (admin section)

- [ ] **Step 1: Open/Close check-in buttons (admin only)**

"Open Check-In" → updates `tournaments.checkin_open_at = now()` and `phase = 'check_in'`
"Close Check-In" → updates `tournaments.checkin_close_at = now()`, drops unchecked players, promotes waitlist

- [ ] **Step 2: Drop no-shows logic**

```javascript
function closeCheckIn() {
  // Mark unchecked registered players as 'dropped'
  supabase.from('registrations')
    .update({ status: 'dropped' })
    .eq('tournament_id', tournamentId)
    .eq('status', 'registered') // not checked_in
    .then(function(res) {
      // Promote waitlisted players
      // ... promote in order of waitlist_position
    });
}
```

- [ ] **Step 3: Verify brace balance**
- [ ] **Step 4: Commit**

---

## Phase 4: Lobby Generation & Host Designation (Day 3, ~4 hours)

### Task 4.1: Lobby Generation with Sizing Algorithm

**Files:**
- Modify: `src/App.jsx` — add `buildFlashLobbies` function near existing `buildLobbies` (line ~697)

- [ ] **Step 1: Implement lobby sizing algorithm**

```javascript
function buildFlashLobbies(checkedInPlayers, seedingMethod) {
  var N = checkedInPlayers.length;
  if (N < 6) return { lobbies: [], byes: checkedInPlayers };

  // Sort for seeding
  var pool = [].concat(checkedInPlayers);
  if (seedingMethod === "snake") {
    pool.sort(function(a, b) { return (RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank)) || (b.pts || 0) - (a.pts || 0); });
  } else if (seedingMethod === "random") {
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
  }

  var k = Math.floor(N / 8);
  var remainder = N - (k * 8);
  var byes = [];

  if (remainder === 0) {
    // Perfect — all lobbies of 8
  } else if (remainder >= 6) {
    k = k + 1; // one extra lobby of remainder size
  } else {
    var needed = 6 - remainder;
    if (k >= needed) {
      k = k + 1; // will redistribute
    } else {
      // Not enough lobbies to redistribute — byes for remainder
      byes = pool.splice(pool.length - remainder, remainder);
    }
  }

  // Use snake seeding to distribute into k lobbies
  var lobbies = snakeSeed(pool, 8);
  // Trim to k lobbies max (snakeSeed uses ceil, we want exact)
  if (lobbies.length > k) lobbies = lobbies.slice(0, k);

  return { lobbies: lobbies, byes: byes };
}
```

- [ ] **Step 2: Verify with edge cases: 128, 24, 23, 20, 9, 6**
- [ ] **Step 3: Commit**

### Task 4.2: Generate Lobbies Admin Action

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen admin controls

- [ ] **Step 1: "Generate Lobbies" button + handler**

Fetches checked-in players, runs `buildFlashLobbies`, inserts lobby rows into `lobbies` table with `host_player_id` (highest-ranked player per lobby).

```javascript
function generateLobbies() {
  supabase.from('registrations').select('player_id, players(id, username, rank, riot_id, region)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'checked_in')
    .then(function(res) {
      if (res.error || !res.data) { toast("Failed to load players", "error"); return; }
      var checkedIn = res.data.map(function(r) { return r.players; }).filter(Boolean);
      var result = buildFlashLobbies(checkedIn, tournament.seeding_method);

      // Insert lobby rows
      var lobbyRows = result.lobbies.map(function(lobbyPlayers, idx) {
        // Host = highest ranked in lobby
        var host = lobbyPlayers.reduce(function(best, p) {
          return RANKS.indexOf(p.rank) > RANKS.indexOf(best.rank) ? p : best;
        }, lobbyPlayers[0]);
        return {
          tournament_id: tournamentId,
          round_number: 1,
          lobby_number: idx + 1,
          player_ids: lobbyPlayers.map(function(p) { return p.id; }),
          host_player_id: host.id,
          status: 'pending',
          game_number: tournament.current_round || 1
        };
      });

      supabase.from('lobbies').insert(lobbyRows).select()
        .then(function(lRes) {
          if (lRes.error) { toast("Failed to save lobbies: " + lRes.error.message, "error"); return; }
          // Update tournament phase
          supabase.from('tournaments').update({ phase: 'in_progress', started_at: new Date().toISOString() })
            .eq('id', tournamentId);
          toast("Lobbies generated! " + result.lobbies.length + " lobbies, " + result.byes.length + " byes", "success");
          broadcastUpdate("lobbies_generated");
        });
    });
}
```

- [ ] **Step 2: Verify brace balance**
- [ ] **Step 3: Commit**

### Task 4.3: Lobby Cards with Host & Code

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen bracket tab

- [ ] **Step 1: Render lobby cards**

Each lobby card shows:
- Lobby letter (A, B, C...)
- Player list with rank badges
- Host badge on the designated host
- If current user is host: text input for lobby code
- If lobby code set: display it for all players
- Lock status indicator

- [ ] **Step 2: Lobby code submission handler**

Host enters code → updates `lobbies` row: `supabase.from('lobbies').update({ lobby_code: code }).eq('id', lobbyId)`

- [ ] **Step 3: Verify brace balance**
- [ ] **Step 4: Commit**

---

## Phase 5: Score Reporting & Lobby Locking (Day 3-4, ~5 hours)

### Task 5.1: Player Self-Report UI

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen "My Lobby" tab

- [ ] **Step 1: Find player's lobby from loaded lobbies data**

```javascript
var myLobby = lobbies.find(function(l) {
  return l.player_ids && l.player_ids.indexOf(linkedPlayer.id) !== -1;
});
```

- [ ] **Step 2: Render placement report form**

Dropdown (1-8 based on lobby size) + Submit button.
Shows existing report if already submitted.
"Update" button if they want to change before lock.

- [ ] **Step 3: Submit handler**

```javascript
function submitReport(placement) {
  supabase.from('player_reports').upsert({
    tournament_id: tournamentId,
    lobby_id: myLobby.id,
    game_number: currentGameNumber,
    player_id: linkedPlayer.id,
    reported_placement: placement,
    reported_at: new Date().toISOString()
  }, { onConflict: 'lobby_id,game_number,player_id' })
    .then(function(res) {
      if (res.error) { toast("Failed to submit", "error"); return; }
      toast("Placement reported!", "success");
      broadcastUpdate("report_submitted");
    });
}
```

- [ ] **Step 4: Dispute button + form**

"Dispute" opens inline form: claimed placement, reason text, screenshot URL (optional).
Inserts to `disputes` table.

- [ ] **Step 5: Verify brace balance**
- [ ] **Step 6: Commit**

### Task 5.2: Admin Lobby Monitor

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen admin view

- [ ] **Step 1: Fetch reports and disputes per lobby**

```javascript
supabase.from('player_reports')
  .select('*')
  .eq('tournament_id', tournamentId)
  .eq('game_number', currentGameNumber)
```

- [ ] **Step 2: Render lobby monitor cards**

Each card shows:
- Lobby name + player count
- Per-player row: name, reported placement (or "Not reported" in yellow)
- Reports progress: "6/8 reported"
- Conflict detection: highlight duplicate placements in red
- Dispute badge: orange icon if open disputes exist for this lobby
- "Lock Lobby" button (enabled when all reported + no unresolved conflicts)
- "Override" button — admin can manually set any player's placement

- [ ] **Step 3: Lock lobby handler**

```javascript
function lockLobby(lobbyId, reports) {
  // Convert reports to game_results rows
  var gameRows = reports.map(function(r) {
    return {
      tournament_id: tournamentId,
      lobby_id: lobbyId,
      player_id: r.player_id,
      placement: r.reported_placement,
      points: PTS[r.reported_placement] || 0,
      round_number: currentGameNumber,
      game_number: currentGameNumber
    };
  });
  supabase.from('game_results').insert(gameRows)
    .then(function(res) {
      if (res.error) { toast("Failed to lock: " + res.error.message, "error"); return; }
      supabase.from('lobbies').update({ status: 'locked' }).eq('id', lobbyId);
      toast("Lobby locked!", "success");
      broadcastUpdate("lobby_locked");
    });
}
```

- [ ] **Step 4: Verify brace balance**
- [ ] **Step 5: Commit**

### Task 5.3: Dispute Resolution UI (Admin)

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen or AdminPanel

- [ ] **Step 1: Dispute queue panel**

Fetches open disputes: `supabase.from('disputes').select('*, players(username)').eq('tournament_id', tournamentId).eq('status', 'open')`

Shows: player name, lobby, game, claimed vs reported placement, reason, screenshot link.

- [ ] **Step 2: Accept/Reject handlers**

Accept: update dispute status + update the player_report placement.
Reject: update dispute status only.

- [ ] **Step 3: Verify brace balance**
- [ ] **Step 4: Commit**

---

## Phase 6: Standings, Multi-Game & Finalization (Day 4, ~4 hours)

### Task 6.1: Live Tournament Standings

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen standings tab

- [ ] **Step 1: Fetch cumulative results**

```javascript
supabase.from('game_results')
  .select('player_id, placement, points, game_number, players(username, rank, riot_id)')
  .eq('tournament_id', tournamentId)
  .order('game_number')
```

- [ ] **Step 2: Aggregate standings with tiebreakers**

Group by player_id, sum points, count wins/top4, compute avg, apply tiebreaker sort.
Use existing `tiebreaker()` function logic.

- [ ] **Step 3: Render standings table**

Columns: Rank, Player, Total Pts, Avg, Wins, Top4, Games, Prize (if applicable).
Highlight current user's row.
Show cut-line indicator if tournament has cut_line_pts set.

- [ ] **Step 4: Commit**

### Task 6.2: Multi-Game Round Flow

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen admin controls

- [ ] **Step 1: "All Lobbies Locked" detection**

Check if all lobbies for current game_number have status 'locked'.
Show "Start Game N+1" button when true.

- [ ] **Step 2: Start next game handler**

```javascript
function startNextGame() {
  var nextGame = currentGameNumber + 1;
  // Update tournament current_round
  supabase.from('tournaments').update({ current_round: nextGame }).eq('id', tournamentId);
  // If Swiss re-seeding: generate new lobbies based on current standings
  // If same lobbies: create new lobby rows with incremented game_number
  toast("Game " + nextGame + " started!", "success");
  broadcastUpdate("next_game");
}
```

- [ ] **Step 3: Cut-line enforcement (if enabled)**

After the cut game (e.g., game 4), check each player's total points.
Players at or below cut_line_pts get marked as eliminated (don't appear in next round lobbies).

- [ ] **Step 4: Commit**

### Task 6.3: Finalize Tournament & Results

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen

- [ ] **Step 1: "Finalize Tournament" button (admin, after last game locked)**

Updates `tournaments.phase = 'complete'`, `tournaments.completed_at = now()`.

- [ ] **Step 2: Results view (post-event)**

Podium: top 3 with visual treatment (gold/silver/bronze) + prize text from tournament.prize_pool.
Full standings table with prize column.
Grand champion card (reuse existing downloadable card pattern).

- [ ] **Step 3: Verify brace balance**
- [ ] **Step 4: Commit**

---

## Phase 7: Realtime & localStorage Migration (Day 4-5, ~4 hours)

### Task 7.1: Broadcast Channel for Tournament

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen

- [ ] **Step 1: Subscribe to tournament broadcast channel on mount**

```javascript
useEffect(function() {
  if (!tournamentId) return;
  var channel = supabase.channel("tournament-" + tournamentId);
  channel.on("broadcast", { event: "update" }, function(payload) {
    // Refetch relevant data based on payload.type
    if (payload.payload.type === "phase_change") loadTournament();
    if (payload.payload.type === "lobbies_generated") loadLobbies();
    if (payload.payload.type === "report_submitted") loadReports();
    if (payload.payload.type === "lobby_locked") { loadLobbies(); loadResults(); }
    if (payload.payload.type === "next_game") loadTournament();
  });
  channel.subscribe();
  return function() { supabase.removeChannel(channel); };
}, [tournamentId]);
```

- [ ] **Step 2: Create broadcastUpdate helper**

```javascript
function broadcastUpdate(type) {
  supabase.channel("tournament-" + tournamentId).send({
    type: "broadcast", event: "update", payload: { type: type }
  });
}
```

Call this after every admin action (generate lobbies, lock, finalize, etc).

- [ ] **Step 3: Commit**

### Task 7.2: localStorage Phase A Migration

**Files:**
- Modify: `src/App.jsx` — TFTClash root component (lines ~15583-15760)

- [ ] **Step 1: Remove `tft-tournament` localStorage init**

Change the `tournamentState` useState to just use defaults (no localStorage read).
The flash tournament reads directly from DB. Season tournament state can stay on site_settings for now.

- [ ] **Step 2: Remove `tft-players` localStorage init**

Change `players` useState to `useState([])` — always load from `loadPlayersFromTable()`.
Remove the localStorage sync useEffect for players.

- [ ] **Step 3: Remove `tft-audit-log` localStorage**

Remove the audit log useState init from localStorage.
The `addAudit` function already writes to the `audit_log` DB table.

- [ ] **Step 4: Remove `tft-announcement` localStorage**

Announcement for flash tournaments comes from `tournaments.announcement`.
Keep site_settings announcement for season/global announcements.

- [ ] **Step 5: Verify brace balance after all removals**
- [ ] **Step 6: Commit**

### Task 7.3: Error Banner for Disconnection

**Files:**
- Modify: `src/App.jsx` — TFTClash root

- [ ] **Step 1: Add connection status state**

```javascript
var [isOffline, setIsOffline] = useState(false);
```

- [ ] **Step 2: Monitor Supabase realtime connection**

On channel error/timeout: `setIsOffline(true)`.
On reconnect: `setIsOffline(false)`.

- [ ] **Step 3: Render error banner at top of page when offline**

Yellow/red banner: "Connection lost — trying to reconnect..." with manual retry button.

- [ ] **Step 4: Commit**

---

## Phase 8: Profile & Navigation Polish (Day 5, ~3 hours)

### Task 8.1: Profile System — Riot ID Gate

**Files:**
- Modify: `src/App.jsx` — AccountScreen (line ~12610)

- [ ] **Step 1: Ensure profile fields save to players table**

On save: `supabase.from('players').update({ riot_id, region, rank, bio }).eq('auth_user_id', currentUser.id)`

- [ ] **Step 2: Profile completeness indicator**

If no Riot ID set: show warning banner "Set your Riot ID to join tournaments"

- [ ] **Step 3: On signup: create players row with auth_user_id**

In SignUpScreen success handler, ensure `supabase.from('players').insert({ username, auth_user_id: user.id, riot_id, region })` is called.

- [ ] **Step 4: Commit**

### Task 8.2: Navigation Updates

**Files:**
- Modify: `src/App.jsx` — Navbar (line ~2878)

- [ ] **Step 1: Add "Tournaments" nav item**

Points to a TournamentsListScreen showing all flash tournaments as cards.

- [ ] **Step 2: Tournament list screen**

Fetches `supabase.from('tournaments').select('*').eq('type', 'flash_tournament').order('date', { ascending: false })`.
Renders cards with: name, date, player count, status badge, prize preview.
Click → navigate to `#tournament-{id}`.

- [ ] **Step 3: Update HomeScreen**

If there's an upcoming flash tournament: show prominent card with countdown + register CTA.

- [ ] **Step 4: Commit**

---

## Phase 9: Design Polish (Day 5, ~2 hours)

### Task 9.1: Tournament Card Design

**Files:**
- Modify: `src/App.jsx` — TournamentsListScreen, FlashTournamentScreen

- [ ] **Step 1: Consistent card styling**

Status badges: green (registration), yellow (live/in_progress), gray (complete).
Prize pool preview on list cards.
Countdown timer for upcoming tournaments.

- [ ] **Step 2: Commit**

### Task 9.2: Lobby Card Polish

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen bracket tab

- [ ] **Step 1: Visual hierarchy**

Host badge (crown icon), report status checkmarks, conflict red border, lock green border.

- [ ] **Step 2: Commit**

### Task 9.3: Results Podium & Prize Display

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen post-event view

- [ ] **Step 1: Podium visualization**

1st (gold, large card), 2nd (silver, medium), 3rd (bronze, medium).
Prize text prominently displayed.
Champion card reusing existing downloadable pattern.

- [ ] **Step 2: Commit**

### Task 9.4: Loading, Error, and Empty States

**Files:**
- Modify: `src/App.jsx` — FlashTournamentScreen all tabs

- [ ] **Step 1: Add loading state** — skeleton placeholders while data loads
- [ ] **Step 2: Add error state** — "Failed to load tournament" with retry button
- [ ] **Step 3: Add empty states** — "No lobbies yet" / "No results yet" contextual messages
- [ ] **Step 4: Commit**

---

## Phase 10: Smoke Test & Final Verification (Day 5, ~1 hour)

### Task 10.1: End-to-End Tournament Flow Test

- [ ] **Step 1: Create a test flash tournament via admin**
- [ ] **Step 2: Register 2+ test accounts**
- [ ] **Step 3: Open check-in, check in all players**
- [ ] **Step 4: Generate lobbies, verify host assignment + lobby codes**
- [ ] **Step 5: Submit placements from player accounts**
- [ ] **Step 6: Verify admin sees reports, conflict detection works**
- [ ] **Step 7: Lock lobbies, verify standings update**
- [ ] **Step 8: Start game 2, repeat report/lock cycle**
- [ ] **Step 9: Finalize tournament, verify results + prizes display**
- [ ] **Step 10: Verify different browsers see same state (no localStorage divergence)**

### Task 10.2: Final Commit & Deploy

- [ ] **Step 1: Run `npm run build` — verify no build errors**
- [ ] **Step 2: Verify brace balance on final App.jsx**
- [ ] **Step 3: Final commit with all changes**
- [ ] **Step 4: Push to trigger Vercel deploy**
- [ ] **Step 5: Verify on production URL**

---

## Summary

| Phase | What | Time Est |
|-------|------|----------|
| 1 | DB Migrations (5 migration files) | 2h |
| 2 | Bug Fixes & Auth (linking, logout, password reset, .catch) | 3h |
| 3 | Flash Tournament CRUD & Screen | 6h |
| 4 | Lobby Generation & Host Designation | 4h |
| 5 | Score Reporting & Lobby Locking | 5h |
| 6 | Standings, Multi-Game & Finalization | 4h |
| 7 | Realtime & localStorage Migration | 4h |
| 8 | Profile & Navigation Polish | 3h |
| 9 | Design Polish | 2h |
| 10 | Smoke Test & Deploy | 1h |
| **Total** | | **~34h (4-5 days)** |
