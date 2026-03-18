# TFT Clash — Database Audit Report

**Date:** 2026-03-18
**Migrations reviewed:** 31 files (001–025 numbered + 6 unnumbered)

---

## 1. Current Schema Summary

### Tables

| Table | PK Type | RLS |
|---|---|---|
| `players` | `bigint IDENTITY` | Enabled |
| `tournaments` | `bigint IDENTITY` | Enabled |
| `registrations` | `bigint IDENTITY` | Enabled |
| `lobbies` | `bigint IDENTITY` | Enabled |
| `game_results` | `bigint IDENTITY` | Enabled |
| `tournament_results` | `bigint IDENTITY` | Enabled |
| `tournament_rounds` | `bigint IDENTITY` | Enabled |
| `seasons` | `bigint IDENTITY` | Enabled |
| `season_snapshots` | `bigint IDENTITY` | Enabled |
| `notifications` | `bigint IDENTITY` | Enabled |
| `user_roles` | `uuid` PK | Enabled |
| `host_profiles` | `bigint IDENTITY` | Enabled |
| `player_achievements` | `bigint IDENTITY` | Enabled |
| `subscriptions` | `uuid` PK | Enabled |
| `audit_log` | `bigint IDENTITY` | Enabled |
| `site_settings` | `text` PK | Enabled |

---

## 2. Issues Found

### CRITICAL

**C-1: `registrations` UPDATE policy has no ownership check**
Any authenticated user can update any player's registration (`status`, `checked_in_at`, `dropped_at`). A user can check in rivals, drop competitors, or promote themselves from waitlisted to checked_in.

**C-2: `game_results` write policies are completely open**
Any authenticated user can insert fake results, update placements, or delete results. Because `trg_refresh_player_stats` runs on mutations, any user can silently inflate their own stats.

**C-3: `site_settings` "write all" policy may still be active**
`add_site_settings.sql` creates `"write all"` but `tighten_site_settings_rls.sql` drops `"Allow all writes"`, `"write_all"` — never drops `"write all"` (with space).

**C-4: `tournament_results.player_id` has no foreign key**
No `REFERENCES players(id)`, no `NOT NULL`, no index. Orphaned rows accumulate silently.

**C-5: `lobbies.player_ids` array has no referential integrity**
Deleted players leave stale IDs in lobby arrays with no cascade. No GIN index either.

### HIGH

**H-1: `players` INSERT allows arbitrary `auth_user_id`** — No `WITH CHECK (auth_user_id = auth.uid())`

**H-2: `players` DELETE allows any authenticated user to delete any player** — `USING (true)` with no admin check

**H-3: `seasons` INSERT allows any authenticated user to create seasons**

**H-4: `tournament_rounds` write policies have no ownership check**

**H-5: `refresh_player_stats` trigger declares `pid UUID` but `player_id` is `bigint`** — Runtime type error on every game result mutation. Stats never refresh in production.

**H-6: `seasons.champion_player_id` and `player_achievements.player_id` have UUID FK references to `bigint` PKs** — Inserts fail silently.

**H-7: `tournament_results` has no indexes on `tournament_id` or `player_id`**

**H-8: `player_stats_v` excludes DNPs from `games` count** — Needs separate `dnp_count` column.

### MEDIUM

**M-1: No `game_number` column on `game_results`** — Can't distinguish games within a round. "Most recent game" tiebreaker impossible.

**M-2: `lobbies` has conflicting `player_ids` column types across migrations** — uuid[] vs bigint[]

**M-3: `notifications` INSERT allows any user to insert for any `user_id`**

**M-4: `audit_log` INSERT is open to all authenticated users** — Users can fabricate audit entries.

**M-5: Lobby assignments duplicated between `lobbies.player_ids` and `tournament_rounds.lobby_assignments`**

**M-6: `subscriptions` table missing `current_period_end`, `cancel_at_period_end`**

**M-7: No DNP/DQ tracking fields on `registrations`**

**M-8: `players.rank` has no CHECK constraint**

**M-9: `game_results.placement = 0` and `is_dnp = false` is valid but nonsensical**

**M-10: `players.updated_at` has no auto-refresh trigger**

### LOW

**L-1:** 6 unnumbered migrations break deterministic ordering
**L-2:** `player_achievements` has no UPDATE policy
**L-3:** `host_profiles` SELECT policy uses `auth.uid()` per-row instead of `(SELECT auth.uid())`
**L-4:** `user_roles` has two conflicting SELECT policies
**L-5:** `subscriptions` has no `updated_at` trigger
**L-6:** `season_snapshots.standings` JSONB has no schema validation

---

## 3. Missing Tables and Columns

- `head_to_head` records table
- `tournament_stages` table (multi-stage/Swiss)
- `bye_assignments` table
- `lobby_players` junction table (replace player_ids array)
- `game_number` column on `game_results`
- `dnp_count`, `disqualified`, `disqualified_at`, `disqualified_reason` on `registrations`
- `waitlist_notified_at` on `registrations`
- `push_subscriptions` table
- `current_period_end`, `cancel_at_period_end` on `subscriptions`

---

## 4. Priority Fix Order

1. **H-5** — Stats trigger UUID/bigint mismatch — stats not refreshing at all
2. **C-2** — Open game_results writes — anyone can fake results
3. **C-1** — Open registrations UPDATE — anyone can drop rivals
4. **C-3** — "write all" policy never cleaned up
5. **H-6** — UUID/bigint FK mismatches — champion and achievements broken

See `RECOMMENDED-MIGRATIONS.sql` for fix scripts.
