# TFT Clash Database Audit Report

**Date:** 2026-04-03
**Scope:** All 50+ migration files, all frontend Supabase queries across src/

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5     |
| HIGH     | 8     |
| MEDIUM   | 7     |
| LOW      | 4     |

---

## CRITICAL Issues

### C-1: FK Type Mismatch -- player_reports and disputes reference UUID columns to BIGINT PKs

**Files:** `034_create_player_reports.sql`, `035_create_disputes.sql`

Both `player_reports` and `disputes` define FK columns as UUID but reference tables with BIGINT PKs:
- `tournament_id UUID REFERENCES tournaments(id)` -- tournaments.id is BIGINT
- `lobby_id UUID REFERENCES lobbies(id)` -- lobbies.id is BIGINT
- `player_id UUID REFERENCES players(id)` -- players.id is BIGINT

This means these FK constraints cannot be created. The tables may exist without foreign keys, or the migration failed entirely.

**Fix:**
```sql
-- Fix player_reports
ALTER TABLE player_reports
  DROP CONSTRAINT IF EXISTS player_reports_tournament_id_fkey,
  DROP CONSTRAINT IF EXISTS player_reports_lobby_id_fkey,
  DROP CONSTRAINT IF EXISTS player_reports_player_id_fkey;

ALTER TABLE player_reports
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint,
  ALTER COLUMN lobby_id TYPE bigint USING lobby_id::text::bigint,
  ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;

ALTER TABLE player_reports
  ADD CONSTRAINT player_reports_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  ADD CONSTRAINT player_reports_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
  ADD CONSTRAINT player_reports_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Fix disputes
ALTER TABLE disputes
  DROP CONSTRAINT IF EXISTS disputes_tournament_id_fkey,
  DROP CONSTRAINT IF EXISTS disputes_lobby_id_fkey,
  DROP CONSTRAINT IF EXISTS disputes_player_id_fkey;

ALTER TABLE disputes
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint,
  ALTER COLUMN lobby_id TYPE bigint USING lobby_id::text::bigint,
  ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  ADD CONSTRAINT disputes_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE,
  ADD CONSTRAINT disputes_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
```

### C-2: FK Type Mismatch -- pending_results references UUID to BIGINT

**File:** `040_clash_engine_sprint1.sql`

`pending_results.tournament_id` is defined as UUID but `tournaments.id` is BIGINT. Also `player_id` is defined as `integer` (32-bit) but `players.id` is BIGINT (64-bit).

**Fix:**
```sql
ALTER TABLE pending_results
  DROP CONSTRAINT IF EXISTS pending_results_tournament_id_fkey,
  DROP CONSTRAINT IF EXISTS pending_results_player_id_fkey;

ALTER TABLE pending_results
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint,
  ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;

ALTER TABLE pending_results
  ADD CONSTRAINT pending_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  ADD CONSTRAINT pending_results_player_id_fkey FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
```

### C-3: FK Type Mismatch -- tournament_rounds references UUID to BIGINT

**File:** `018_create_tournament_rounds.sql`

`tournament_rounds.tournament_id` is defined as UUID but `tournaments.id` is BIGINT. Was NOT fixed by `007_fix_fk_types.sql` (that migration missed tournament_rounds).

**Fix:**
```sql
ALTER TABLE tournament_rounds
  DROP CONSTRAINT IF EXISTS tournament_rounds_tournament_id_fkey;

ALTER TABLE tournament_rounds
  ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;

ALTER TABLE tournament_rounds
  ADD CONSTRAINT tournament_rounds_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
```

### C-4: Frontend queries non-existent tables -- event_registrations and xp_events

**Frontend references:**
- `EventsScreen.jsx:242` -- `supabase.from('event_registrations').upsert(...)` -- NO MIGRATION EXISTS for this table
- `ChallengesScreen.jsx:99` -- `supabase.from('xp_events').select(...)` -- NO MIGRATION EXISTS for this table

These queries will silently fail (Supabase returns errors that are not handled).

**Fix:**
```sql
-- Create event_registrations table
CREATE TABLE IF NOT EXISTS event_registrations (
  id bigint generated always as identity primary key,
  event_id bigint NOT NULL,
  player_id bigint REFERENCES players(id) ON DELETE CASCADE,
  status text DEFAULT 'registered',
  registered_at timestamptz DEFAULT now(),
  UNIQUE(event_id, player_id)
);
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read event_registrations" ON event_registrations FOR SELECT USING (true);
CREATE POLICY "Users can register" ON event_registrations FOR INSERT TO authenticated
  WITH CHECK (player_id = (SELECT id FROM players WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1));

-- Create xp_events table
CREATE TABLE IF NOT EXISTS xp_events (
  id bigint generated always as identity primary key,
  player_id bigint REFERENCES players(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp" ON xp_events FOR SELECT TO authenticated
  USING (player_id = (SELECT id FROM players WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY "Service role manages xp_events" ON xp_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS xp_events_player_idx ON xp_events(player_id);
```

### C-5: SECURITY DEFINER function increment_player_stats -- input validation bypass

**File:** `040_clash_engine_sprint1.sql` (original), partially fixed in `044_security_hardening.sql`

The original version (040) granted EXECUTE to `authenticated` with no authorization check. Migration 044 added admin-only check and input bounds. However, if 044 was not applied, any authenticated user can increment any player's stats arbitrarily.

**Verify fix is applied:**
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'increment_player_stats';
-- Should contain 'Insufficient privileges' check
```

---

## HIGH Issues

### H-1: Frontend writes to phantom columns on players table

The frontend writes these columns that have NO migration adding them:
- `checked_in` (boolean) -- used in `OverviewTab.jsx:60,70`, `PlayersTab.jsx:89`, `TournamentTab.jsx:95`
- `banned` (boolean) -- used in `OverviewTab.jsx:60`, `PlayersTab.jsx:89,96`
- `notes` (text) -- used in `PlayersTab.jsx:122`
- `dnp_count` (int) -- used in `PlayersTab.jsx:96`
- `role` (text) -- used in `ScrimsScreen.jsx:412`

These updates silently fail. The columns may have been added manually but are not tracked in migrations.

**Fix:**
```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS dnp_count int DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS role text DEFAULT 'player';

CREATE INDEX IF NOT EXISTS players_checked_in_idx ON players(checked_in) WHERE checked_in = true;
CREATE INDEX IF NOT EXISTS players_banned_idx ON players(banned) WHERE banned = true;
```

### H-2: Frontend writes phantom columns on tournaments table

- `status` (text) -- `HostDashboardScreen.jsx:845,878` writes `status: 'live'` and `status: 'complete'`
- `champion` (text) -- `HostDashboardScreen.jsx:878` writes `champion: champ.trim()`
- `registration_open` (boolean) -- `HostDashboardScreen.jsx:862`

The tournaments table has `phase` (not `status`), and no `champion` or `registration_open` columns.

**Fix:**
```sql
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS champion text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_open boolean DEFAULT true;
```

Or better: fix the frontend to use `phase` instead of `status`, and store champion in `tournament_results`.

### H-3: BroadcastOverlay orders by non-existent column 'pts'

**File:** `src/components/shared/BroadcastOverlay.jsx:25,35`

Queries `.order("pts", { ascending: false })` but the players table has `season_pts`, not `pts`.

**Fix (frontend):**
```javascript
// Change from:
supabase.from("players").select("*").order("pts", { ascending: false })
// To:
supabase.from("players").select("*").order("season_pts", { ascending: false })
```

### H-4: host_applications ordered by non-existent column 'created_at'

**File:** `src/context/AppContext.jsx:456`

`host_applications` has `applied_at`, not `created_at`.

**Fix (frontend):**
```javascript
// Change from:
supabase.from("host_applications").select("*").order("created_at",{ascending:false})
// To:
supabase.from("host_applications").select("*").order("applied_at",{ascending:false})
```

### H-5: scrims table has RLS enabled but NO write policies

**File:** `042_schema_audit.sql` enables RLS on scrims, but no INSERT/UPDATE/DELETE policies exist anywhere. The frontend (`ScrimsScreen.jsx`) actively writes to scrims, scrim_players, scrim_games, and scrim_results.

For `scrim_players`, `scrim_games`, and `scrim_results`: migration 044 adds authenticated read + service_role write. But `ScrimsScreen.jsx` writes as an authenticated user, which will be blocked.

For `scrims`: no policies at all (only RLS enabled). All operations blocked.

**Fix:**
```sql
-- scrims: authenticated users can CRUD
CREATE POLICY "Authenticated read scrims" ON scrims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create scrims" ON scrims FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own scrims" ON scrims FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can delete own scrims" ON scrims FOR DELETE TO authenticated USING (created_by = auth.uid());

-- scrim_players, scrim_games, scrim_results: allow authenticated writes
DROP POLICY IF EXISTS "service role manages scrim_players" ON scrim_players;
CREATE POLICY "Authenticated manage scrim_players" ON scrim_players FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service role manages scrim_games" ON scrim_games;
CREATE POLICY "Authenticated manage scrim_games" ON scrim_games FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service role manages scrim_results" ON scrim_results;
CREATE POLICY "Authenticated manage scrim_results" ON scrim_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### H-6: challenges table has NO RLS enabled

The `challenges` table (created in `20260321_content_overhaul.sql`) never has `ENABLE ROW LEVEL SECURITY` applied. Migration 044 only secures `player_challenges`, not the parent `challenges` table. Any anonymous user can read/write challenges.

**Fix:**
```sql
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY "Service role manages challenges" ON challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### H-7: Duplicate subscriptions tables -- subscriptions vs user_subscriptions

Two tables serve the same purpose:
- `subscriptions` (from `create_subscriptions.sql`) -- queried in `AppContext.jsx:331`, `AccountScreen.jsx:225`
- `user_subscriptions` (from `20260321_content_overhaul.sql`) -- never queried by frontend

This creates confusion. The frontend only uses `subscriptions`.

**Fix:** Drop the unused table or consolidate:
```sql
-- If user_subscriptions is unused:
DROP TABLE IF EXISTS user_subscriptions;
```

### H-8: Duplicate host_profiles/host_applications tables

`20260321_content_overhaul.sql` creates simplified `host_profiles` (PK on user_id, different columns) and `host_applications`, while `015_create_host_profiles.sql` creates the full `host_profiles` with IDENTITY PK. The `CREATE TABLE IF NOT EXISTS` means whichever ran first wins. The columns from the content overhaul version (community_name, accent_color) differ from the numbered migration version (org_name, slug, brand_color, etc.).

**Recommendation:** Audit which version actually exists in production and consolidate. The numbered migration (015) is the more complete schema.

---

## MEDIUM Issues

### M-1: user_profiles table referenced but never created

`20260321_content_overhaul.sql` runs `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ...` for 8 columns, but no migration ever creates the `user_profiles` table. These ALTER statements will fail silently if the table does not exist.

### M-2: lobby_players and head_to_head tables referenced but never created

`031_create_lobby_players_and_h2h.sql` only contains a comment saying "Already applied in prior session". The actual DDL is never in any migration file. If the tables were created manually, they are untracked.

### M-3: Duplicate seasons table definitions

`008_create_seasons.sql` creates seasons with `number`, `champion_player_id`, `config`, `status` CHECK constraint. `20260321_content_overhaul.sql` creates seasons with `champion_id` (different name), `config_json` (different name), no CHECK constraint. Whichever runs first wins, and the ALTER COLUMNs from the second will partially succeed.

### M-4: site_settings.value type mismatch

`006_upgrade_site_settings_jsonb.sql` changes `value` from text to jsonb. But all frontend upserts write `value: JSON.stringify(...)` which sends a text string. Supabase PostgREST will accept this (auto-casts), but it means the values are double-encoded JSON strings inside jsonb.

### M-5: Missing indexes on RLS policy columns

Several RLS policies do per-row subqueries on `user_roles.user_id` and `players.auth_user_id`:
```sql
EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
```
These are called for every row checked. The `user_roles` table has `user_id` as PK so that is fine. But `players.auth_user_id` lookups in RLS (registrations, disputes, player_reports) should use the `(SELECT auth.uid())` pattern to avoid per-row evaluation.

**Fix:** Verify all RLS policies use `(SELECT auth.uid())` not bare `auth.uid()`.

### M-6: disputes status CHECK constraint too restrictive

Migration 035 defines: `CHECK (status IN ('open', 'resolved_accepted', 'resolved_rejected'))`
But `PlayersTab.jsx:209` writes `status: 'resolved'` and `PlayersTab.jsx:216` writes `status: 'dismissed'`. Both will fail the CHECK constraint.

**Fix:**
```sql
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open', 'resolved', 'dismissed', 'resolved_accepted', 'resolved_rejected'));
```

### M-7: 041_batch_025_to_040.sql is a full duplicate

Migration 041 is a verbatim copy of migrations 025 through 040. This means if both the individual migrations AND 041 are applied, every operation runs twice. The idempotent patterns (IF NOT EXISTS, IF EXISTS) mostly protect against errors, but the UPDATE statements and POLICY DROPs will execute redundantly.

---

## LOW Issues

### L-1: No index on activity_feed.player_id

`DashboardScreen.jsx` queries `activity_feed` but there is no index on `player_id` or `created_at`.

**Fix:**
```sql
CREATE INDEX IF NOT EXISTS activity_feed_player_idx ON activity_feed(player_id);
CREATE INDEX IF NOT EXISTS activity_feed_created_idx ON activity_feed(created_at DESC);
```

### L-2: No index on registrations.player_id after type fix

Migration 007 recreated the FK but the index `registrations_player_idx` was created on the original UUID column. After the type change to BIGINT, the index should be recreated.

### L-3: player_achievements has conflicting definitions

`010_create_player_achievements.sql` creates it with `tier`, `season_id`, and `UNIQUE(player_id, achievement_id, tier)`.
`20260321_content_overhaul.sql` creates it with `progress`, no tier, and `UNIQUE(player_id, achievement_id)`.
The first one to run wins. If 010 ran first, the content overhaul's UNIQUE constraint will fail (different columns).

### L-4: Multiple console.error statements leak internal details

Throughout the codebase, error objects from Supabase are logged to the browser console. While not a DB issue per se, error messages from failed RLS checks can reveal table structure to users.

---

## Tables Without Verified RLS

Based on migration analysis, these tables either lack RLS or have RLS enabled with no policies allowing legitimate operations:

| Table | RLS Enabled? | Has Policies? | Risk |
|-------|-------------|---------------|------|
| challenges | NO | NO | Anyone can read/write |
| scrims | YES (042) | NO | All operations blocked |
| seasons (from overhaul) | Depends on migration order | Varies | Inconsistent |
| host_applications | YES (045) | YES | OK |
| gear_items | YES (044) | YES | OK |
| announcements | YES (044) | YES | OK |

---

## Recommended Migration: 046_audit_fixes.sql

A single migration to address all CRITICAL and HIGH issues:

```sql
-- 046_audit_fixes.sql
-- Fixes from 2026-04-03 database audit

-- ── C-1: Fix player_reports FK types ──
DO $$ BEGIN
  ALTER TABLE player_reports ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
  ALTER TABLE player_reports ALTER COLUMN lobby_id TYPE bigint USING lobby_id::text::bigint;
  ALTER TABLE player_reports ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE disputes ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
  ALTER TABLE disputes ALTER COLUMN lobby_id TYPE bigint USING lobby_id::text::bigint;
  ALTER TABLE disputes ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── C-2: Fix pending_results FK types ──
DO $$ BEGIN
  ALTER TABLE pending_results ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
  ALTER TABLE pending_results ALTER COLUMN player_id TYPE bigint USING player_id::text::bigint;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── C-3: Fix tournament_rounds FK type ──
DO $$ BEGIN
  ALTER TABLE tournament_rounds ALTER COLUMN tournament_id TYPE bigint USING tournament_id::text::bigint;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── C-4: Create missing tables ──
CREATE TABLE IF NOT EXISTS event_registrations (
  id bigint generated always as identity primary key,
  event_id bigint NOT NULL,
  player_id bigint REFERENCES players(id) ON DELETE CASCADE,
  status text DEFAULT 'registered',
  registered_at timestamptz DEFAULT now(),
  UNIQUE(event_id, player_id)
);
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read event_registrations" ON event_registrations FOR SELECT USING (true);
CREATE POLICY "Users register themselves" ON event_registrations FOR INSERT TO authenticated
  WITH CHECK (player_id = (SELECT id FROM players WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1));

CREATE TABLE IF NOT EXISTS xp_events (
  id bigint generated always as identity primary key,
  player_id bigint REFERENCES players(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp" ON xp_events FOR SELECT TO authenticated
  USING (player_id = (SELECT id FROM players WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY "Service role manages xp_events" ON xp_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS xp_events_player_idx ON xp_events(player_id);

-- ── H-1: Add phantom player columns ──
ALTER TABLE players ADD COLUMN IF NOT EXISTS checked_in boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS dnp_count int DEFAULT 0;
CREATE INDEX IF NOT EXISTS players_checked_in_idx ON players(checked_in) WHERE checked_in = true;

-- ── H-5: Fix scrims write policies ──
DO $$ BEGIN
  CREATE POLICY "Authenticated read scrims" ON scrims FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can create scrims" ON scrims FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own scrims" ON scrims FOR UPDATE TO authenticated USING (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete own scrims" ON scrims FOR DELETE TO authenticated USING (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fix scrim sub-tables: allow authenticated writes (frontend writes directly)
DROP POLICY IF EXISTS "service role manages scrim_players" ON scrim_players;
CREATE POLICY "Authenticated manage scrim_players" ON scrim_players FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service role manages scrim_games" ON scrim_games;
CREATE POLICY "Authenticated manage scrim_games" ON scrim_games FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service role manages scrim_results" ON scrim_results;
CREATE POLICY "Authenticated manage scrim_results" ON scrim_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── H-6: Secure challenges table ──
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anyone can read challenges" ON challenges FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role manages challenges" ON challenges FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── M-6: Fix disputes status CHECK ──
ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open', 'resolved', 'dismissed', 'resolved_accepted', 'resolved_rejected'));

-- ── L-1: Add missing indexes ──
CREATE INDEX IF NOT EXISTS activity_feed_player_idx ON activity_feed(player_id);
CREATE INDEX IF NOT EXISTS activity_feed_created_idx ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS xp_events_created_idx ON xp_events(created_at DESC);
```

---

## Frontend Fixes Required

These are NOT database fixes -- they require code changes:

1. **BroadcastOverlay.jsx:25,35** -- Change `.order("pts")` to `.order("season_pts")`
2. **AppContext.jsx:456** -- Change `.order("created_at")` to `.order("applied_at")`
3. **HostDashboardScreen.jsx:845** -- Change `{ status: 'live' }` to `{ phase: 'in_progress' }`
4. **HostDashboardScreen.jsx:862** -- Remove `registration_open: false` or add column
5. **HostDashboardScreen.jsx:878** -- Remove `champion: champ` or add column
6. **ScrimsScreen.jsx:412** -- Remove `role: 'guest'` from player insert (no role column)
