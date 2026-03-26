# Advanced Stats — Design Spec
**Date:** 2026-03-26
**Status:** Draft

---

## 1. Goal

Deliver a meaningful statistics layer on top of existing `game_results` data. Two deliverables: a new Stats Hub screen (`/stats`) and a Deep Stats tab on the existing PlayerProfileScreen. No new tables — two SQL views only.

---

## 2. Scope

**In scope:**
- `/stats` Stats Hub screen (`StatsHubScreen.jsx`) — new file
- Deep Stats tab on `PlayerProfileScreen.jsx` — additive change
- `player_h2h_stats` SQL view — head-to-head records computed from `game_results`
- `player_consistency_stats` SQL view — per-player consistency + clutch metrics
- Stats nav pill added to `DESKTOP_PRIMARY` in `Navbar.jsx`
- `/stats` route added to `App.jsx`

**Out of scope:**
- Comp/augment/item tracking (no new data collection)
- New database tables
- Real-time stat updates (query on load, cached for session)
- Mobile-specific Stats Hub layout (mobile gets a simplified stacked view)
- Historical season-over-season comparisons

---

## 3. Data Layer

### 3.1 Approach

All stats are computed from the existing `game_results` table via two read-only SQL views. No ETL, no cron jobs, no new tables. Views are queried directly via Supabase `.from('view_name').select(...)`.

### 3.2 View: `player_h2h_stats`

Joins `game_results` to itself on `(lobby_id, round_number)` to identify every time two players shared a lobby in the same round.

**Columns:**
| Column | Type | Description |
|---|---|---|
| `player_a_id` | uuid | First player (alphabetically by id) |
| `player_b_id` | uuid | Second player |
| `player_a_name` | text | Display name |
| `player_b_name` | text | Display name |
| `meetings` | int | Total rounds they shared a lobby |
| `player_a_wins` | int | Rounds where player_a placed better (lower number) |
| `player_b_wins` | int | Rounds where player_b placed better |
| `player_a_avg_placement` | numeric(4,2) | Avg placement when facing player_b |
| `player_b_avg_placement` | numeric(4,2) | Avg placement when facing player_a |

**Key logic:**
- Canonical pairing enforces `player_a_id < player_b_id` so each pair appears once
- A "win" is defined as placing better (lower placement number) in that round
- Ties (identical placement) are excluded from win counts
- Filter out rounds with fewer than 2 distinct players (data integrity guard)

**Approximate SQL shape:**
```sql
CREATE OR REPLACE VIEW player_h2h_stats AS
SELECT
  LEAST(a.player_id, b.player_id)    AS player_a_id,
  GREATEST(a.player_id, b.player_id) AS player_b_id,
  pa.username                         AS player_a_name,
  pb.username                         AS player_b_name,
  COUNT(*)                            AS meetings,
  SUM(CASE WHEN a.player_id = LEAST(a.player_id, b.player_id)
            AND a.placement < b.placement THEN 1
       WHEN b.player_id = LEAST(a.player_id, b.player_id)
            AND b.placement < a.placement THEN 1
       ELSE 0 END)                    AS player_a_wins,
  SUM(CASE WHEN a.player_id = GREATEST(a.player_id, b.player_id)
            AND a.placement < b.placement THEN 1
       WHEN b.player_id = GREATEST(a.player_id, b.player_id)
            AND b.placement < a.placement THEN 1
       ELSE 0 END)                    AS player_b_wins,
  AVG(CASE WHEN a.player_id = LEAST(a.player_id, b.player_id)
            THEN a.placement ELSE b.placement END) AS player_a_avg_placement,
  AVG(CASE WHEN a.player_id = GREATEST(a.player_id, b.player_id)
            THEN a.placement ELSE b.placement END) AS player_b_avg_placement
FROM game_results a
JOIN game_results b
  ON  a.lobby_id = b.lobby_id
  AND a.round_number = b.round_number
  AND a.player_id <> b.player_id
JOIN profiles pa ON pa.id = LEAST(a.player_id, b.player_id)
JOIN profiles pb ON pb.id = GREATEST(a.player_id, b.player_id)
GROUP BY
  LEAST(a.player_id, b.player_id),
  GREATEST(a.player_id, b.player_id),
  pa.username,
  pb.username;
```

### 3.3 View: `player_consistency_stats`

Per-player aggregation of placement standard deviation and clutch factor.

**Columns:**
| Column | Type | Description |
|---|---|---|
| `player_id` | uuid | Player identifier |
| `username` | text | Display name |
| `games_played` | int | Total rounds in game_results |
| `avg_placement` | numeric(4,2) | Mean placement across all games |
| `stddev_placement` | numeric(4,2) | Population std deviation of placements |
| `consistency_score` | numeric(5,1) | 0-100 score: `GREATEST(0, LEAST(100, 100 - (stddev * 10)))` |
| `clutch_factor` | numeric(5,2) | % of games where placement <= personal avg (performed at or above average) |
| `win_rate` | numeric(5,2) | % of games finishing 1st |
| `top4_rate` | numeric(5,2) | % of games finishing 1st-4th |
| `bot4_rate` | numeric(5,2) | % of games finishing 5th-8th |
| `eighth_rate` | numeric(5,2) | % of games finishing 8th |
| `best_finish` | int | Best placement ever recorded |
| `worst_finish` | int | Worst placement ever recorded |

**Key logic:**
- Minimum 3 games required for a valid consistency score (fewer games = excluded from rankings)
- `clutch_factor` counts games where `placement <= FLOOR(avg_placement)` divided by total games
- `consistency_score` is bounded [0, 100]; a player with stddev=0 (always same place) scores 100; stddev=10 scores 0

**Approximate SQL shape:**
```sql
CREATE OR REPLACE VIEW player_consistency_stats AS
SELECT
  p.id                                            AS player_id,
  p.username,
  COUNT(gr.id)                                    AS games_played,
  AVG(gr.placement)                               AS avg_placement,
  STDDEV_POP(gr.placement)                        AS stddev_placement,
  GREATEST(0, LEAST(100,
    100 - (STDDEV_POP(gr.placement) * 10)
  ))                                              AS consistency_score,
  ROUND(
    100.0 * SUM(CASE WHEN gr.placement <= AVG(gr.placement) OVER (PARTITION BY p.id)
                     THEN 1 ELSE 0 END) / COUNT(gr.id), 2
  )                                               AS clutch_factor,
  ROUND(100.0 * SUM(CASE WHEN gr.placement = 1 THEN 1 ELSE 0 END) / COUNT(gr.id), 2) AS win_rate,
  ROUND(100.0 * SUM(CASE WHEN gr.placement <= 4 THEN 1 ELSE 0 END) / COUNT(gr.id), 2) AS top4_rate,
  ROUND(100.0 * SUM(CASE WHEN gr.placement >= 5 THEN 1 ELSE 0 END) / COUNT(gr.id), 2) AS bot4_rate,
  ROUND(100.0 * SUM(CASE WHEN gr.placement = 8 THEN 1 ELSE 0 END) / COUNT(gr.id), 2) AS eighth_rate,
  MIN(gr.placement)                               AS best_finish,
  MAX(gr.placement)                               AS worst_finish
FROM profiles p
JOIN game_results gr ON gr.player_id = p.id
GROUP BY p.id, p.username
HAVING COUNT(gr.id) >= 3;
```

---

## 4. Stats Hub Screen (`/stats`)

### 4.1 File

`src/screens/StatsHubScreen.jsx` — new file, module-scope component, follows CLAUDE.md style.

### 4.2 Layout

Full-page layout using `<PageLayout>`. Two-column desktop grid (main content left, sidebar right). Single column on mobile.

**Section order (top to bottom):**

1. Page header — "Stats Hub" title + subtitle
2. Spotlight cards row (4 cards)
3. H2H Search panel
4. Two-column section: Consistency Rankings (left) | Clutch Factor Rankings (right)
5. Placement Heatmap (full width)
6. Two-column section: Top Rivalries (left) | Season Trend (right)

### 4.3 Spotlight Cards

Four auto-detected highlight cards displayed in a 4-column responsive row (2x2 on mobile).

| Card | Label | Metric Source | Display |
|---|---|---|---|
| Most Consistent | "Most Consistent Player" | Highest `consistency_score` in `player_consistency_stats` | Player name + score badge |
| Biggest Rivalry | "Biggest Rivalry" | Most `meetings` in `player_h2h_stats` | "Player A vs Player B — N meetings" |
| Hottest Streak | "Hottest Streak" | Longest consecutive top-4 streak from `game_results` (computed client-side from ordered results) | Player name + streak count |
| Clutch King | "Clutch King" | Highest `clutch_factor` in `player_consistency_stats` | Player name + percentage |

Each card uses a `<Panel>` with an `<Icon>` (Material Symbols), stat value in `font-display` (Playfair Display), and label in `font-label` (Barlow Condensed). Accent colour matches card type (primary / secondary / tertiary / success).

### 4.4 H2H Panel

**Default view (< 20 total players):**
- Dropdown to select a player
- On selection: fetch all rows from `player_h2h_stats` where `player_a_id = selected` OR `player_b_id = selected`
- Render table sorted by `meetings DESC`, top 8 rows visible, "Show all" expander

**At scale (>= 20 players):**
- Search input (debounced 300ms) to find player
- Same table output

**Table columns:** Opponent | Meetings | W-L | Avg Placement vs Them

**Empty state:** "No head-to-head data yet. Play some clashes!" shown when fewer than 2 players have results.

### 4.5 Consistency Rankings

Leaderboard table pulled from `player_consistency_stats`, ordered by `consistency_score DESC`.

**Columns:** Rank | Player | Games | Avg Placement | Std Dev | Score

Score displayed as a coloured pill:
- 80-100: success green
- 60-79: primary blue
- 40-59: secondary yellow
- 0-39: error red

Paginated: 10 rows per page, page controls at bottom.

### 4.6 Clutch Factor Rankings

Same table layout as Consistency Rankings, ordered by `clutch_factor DESC`.

**Columns:** Rank | Player | Games | Avg Placement | Clutch %

Clutch % displayed as a coloured pill using same threshold bands as consistency score.

### 4.7 Placement Heatmap

Grid: rows = players (top 20 by games played, paginated in groups of 20), columns = placements 1-8.

Each cell shows the % of games at that placement. Cell background intensity scales with percentage (0% = surface, 100% = primary with full opacity). Exact value shown on hover (tooltip).

Header row: placement numbers 1-8. First column: player name.

"Next 20" / "Prev 20" pagination controls below the grid.

### 4.8 Top Rivalries

List of top 10 matchups by `meetings` from `player_h2h_stats`.

Each row: `Player A vs Player B` with a record pill `(A wins - B wins)` and meetings count.

### 4.9 Season Trend

Per-player sparkline: avg placement per clash event over time.

- X axis: clash events in chronological order (derived from `game_results` grouped by `event_id` or `clash_date`)
- Y axis: avg placement (inverted — lower is better, so 1st is at top)
- Display top 5 players by games played; remaining players selectable via a dropdown

Sparklines rendered as inline SVG paths — no external chart library. One polyline per player, colour-coded. Legend below the chart.

---

## 5. Player Profile Deep Stats Tab

### 5.1 Location

`src/screens/PlayerProfileScreen.jsx` — additive change. New tab added to the existing tab row alongside the current tabs (Overview, Results, etc.).

Tab label: "Deep Stats"
Tab icon: `analytics` (Material Symbols)

### 5.2 Tab Content Sections

#### 5.2.1 Season Breakdown

Summary stat grid (2-column on mobile, 4-column on desktop):

| Stat | Source |
|---|---|
| Games Played | `games_played` |
| Avg Placement | `avg_placement` |
| Win Rate | `win_rate` |
| Top-4 Rate | `top4_rate` |
| Bot-4 Rate | `bot4_rate` |
| 8th Rate | `eighth_rate` |
| Best Finish | `best_finish` |
| Worst Finish | `worst_finish` |

Each stat displayed in a mini card: label (Barlow Condensed, muted) over value (Playfair Display, large). Win rate and top-4 rate use success green; bot-4 and 8th use error red.

#### 5.2.2 Performance Scores

Four score cards in a row:

| Card | Value | Label |
|---|---|---|
| Consistency Score | `consistency_score` / 100 | "Consistency" |
| Clutch Factor | `clutch_factor`% | "Clutch Factor" |
| Form Grade | Derived (see below) | "Current Form" |
| Std Deviation | `stddev_placement` | "Volatility" |

**Form Grade derivation** (computed client-side from last 10 games):
- Avg placement last 10 games <= 2.0: A+
- <= 3.0: A
- <= 4.0: B
- <= 5.0: C
- > 5.0: D

Form grade displayed as a large letter with colour (A+/A = success, B = primary, C = secondary, D = error).

#### 5.2.3 Placement Distribution

Horizontal bar chart (8 bars, one per placement). Each bar shows `%` of games at that placement.

Bar width scales to fill available space (100% = most frequent placement). Bars are colour-coded:
- 1st: gold (#FFD700)
- 2nd-3rd: success green
- 4th: primary blue
- 5th-6th: secondary/muted
- 7th-8th: error red

Label left of bar: placement number. Label right of bar: percentage value.

Rendered as simple `<div>` elements with Tailwind width utilities — no SVG needed.

#### 5.2.4 H2H Record

Table of all opponents this player has faced, pulled from `player_h2h_stats` filtered by `player_id`.

**Columns:** Opponent | Meetings | Wins | Losses | Avg Placement vs Them | Result

"Result" column: coloured pill — "Winning" (success) if wins > losses, "Losing" (error) if losses > wins, "Even" (muted) if equal.

Sorted by `meetings DESC`. Paginated at 10 rows.

#### 5.2.5 Game-by-Game Timeline

Coloured grid of last N games (N = all games or up to 50, whichever is smaller), displayed newest-first left-to-right, wrapping.

Each cell is a small square (~28px) with tooltip showing clash name + placement on hover.

Cell colours:
- 1st place: gold/yellow (`bg-yellow-400`)
- 2nd-4th: success green (`bg-success`)
- 5th-7th: muted surface variant (`bg-surface-variant`)
- 8th place: error red (`bg-error`)

Label above grid: "Last N Games" where N = actual count.

---

## 6. Navigation Changes

### 6.1 Navbar — DESKTOP_PRIMARY

Add "Stats" pill between "Events" and "Hall of Fame" in the `DESKTOP_PRIMARY` navigation array in `src/components/layout/Navbar.jsx`.

```
Current: [..., Events, Hall of Fame, ...]
After:   [..., Events, Stats, Hall of Fame, ...]
```

Route: `/stats`
Icon: `bar_chart` (Material Symbols)
Label: `Stats`

### 6.2 App.jsx Route

Add route entry in `App.jsx`:

```jsx
<Route path="/stats" element={<StatsHubScreen />} />
```

Import `StatsHubScreen` at top of file alongside other screen imports.

---

## 7. Migration File

**File:** `supabase/migrations/043_advanced_stats_views.sql`

**Contents:**
1. `DROP VIEW IF EXISTS player_h2h_stats;` (idempotent)
2. `CREATE OR REPLACE VIEW player_h2h_stats AS ...` (full definition from section 3.2)
3. `DROP VIEW IF EXISTS player_consistency_stats;`
4. `CREATE OR REPLACE VIEW player_consistency_stats AS ...` (full definition from section 3.3)
5. Comments on each view explaining purpose and source table

No `UP`/`DOWN` separation needed — views are fully replaceable.

---

## 8. File Map

| File | Change Type | Description |
|---|---|---|
| `src/screens/StatsHubScreen.jsx` | New file | Stats Hub page — all sections |
| `src/screens/PlayerProfileScreen.jsx` | Modified | Add Deep Stats tab and tab content |
| `src/components/layout/Navbar.jsx` | Modified | Add Stats pill to DESKTOP_PRIMARY |
| `src/App.jsx` | Modified | Add `/stats` route + import |
| `supabase/migrations/043_advanced_stats_views.sql` | New file | Two SQL views |

---

## 9. Code Style Requirements

All new code must follow `CLAUDE.md` rules:

- `var` declarations only — no `const`, no `let`
- `function() {}` callbacks — no arrow functions
- No backtick string literals inside JS functions
- No named function components defined inside another component's body
- Tailwind CSS classes only — no inline styles
- `<Icon name="...">` for all icons (Material Symbols Outlined)
- `useApp()` hook for global state access
- `<Panel>` from `components/ui/` for card containers

`StatsHubScreen` is a module-scope component (not defined inside another component).

Any local `<select>` wrappers needed in StatsHubScreen must be defined as `Sel` locally in that file (not imported from shared UI, per CLAUDE.md).

---

## 10. Empty States and Loading

Every data section must handle three states:

| State | Display |
|---|---|
| Loading | Skeleton shimmer using `bg-surface-variant animate-pulse` divs matching section shape |
| Empty | Friendly message with icon, e.g. "No data yet — play some clashes!" |
| Error | Error panel with retry button |

Use consistent pattern:

```js
// Pseudocode — actual implementation uses var + function(){}
if (loading) return <SkeletonSection />
if (error) return <ErrorPanel onRetry={reload} />
if (!data || data.length === 0) return <EmptyState message="..." />
return <ActualContent />
```

---

## 11. Open Questions

1. **Clutch factor definition** — currently "% of games at or above personal average." Should ties (placement = floor(avg)) count as clutch or not? Recommended: count them (placement <= avg).
2. **Season scope** — should views filter by current season only, or lifetime? Current spec is lifetime. If season-scoped, add `WHERE season_id = current_season_id` filter.
3. **Sparkline data granularity** — "per clash event" assumes a clash groups multiple rounds. If `event_id` is not on `game_results`, derive from `clash_date` grouping instead.
4. **Minimum games threshold** — currently 3 games for inclusion in consistency rankings. Adjust after seeing real data distribution.
5. **H2H at scale** — the self-join on `game_results` is O(n^2) in the number of rows per lobby. For large datasets, consider materialising the view or adding a `game_results(lobby_id, round_number)` composite index.

---

## 12. Acceptance Criteria

- [ ] `/stats` route renders `StatsHubScreen` without error
- [ ] All 4 spotlight cards populate from real data (not hardcoded)
- [ ] H2H panel shows correct W-L record for any selected player
- [ ] Consistency Rankings table is sorted correctly and paginated
- [ ] Clutch Factor Rankings table is sorted correctly and paginated
- [ ] Placement Heatmap renders all 8 placement columns for top 20 players
- [ ] Top Rivalries list shows correct meeting counts
- [ ] Season Trend sparklines render for at least the top 5 players
- [ ] PlayerProfileScreen Deep Stats tab appears in tab row
- [ ] All 5 Deep Stats sections populate from real `player_consistency_stats` and `player_h2h_stats` data
- [ ] All sections show appropriate loading skeleton, empty state, and error state
- [ ] Nav pill "Stats" appears between Events and Hall of Fame
- [ ] Migration `043_advanced_stats_views.sql` applies cleanly to existing schema
- [ ] No arrow functions, no `const`/`let`, no inline styles in new code
- [ ] No em dashes in any user-facing text
