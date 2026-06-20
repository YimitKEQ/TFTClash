# Clash Day Summary — Design

Date: 2026-06-20
Status: Approved (design)

## Problem

`/results` (ResultsScreen) sorts everything by `p.pts` = **season** points
(cumulative across all clashes) and labels its table "Season Standings". The hero
champion only flips after a clash is finalized into `tournament_results`. There is
**no view that says "who won *this day's* clash"** (a clash = 4 games on one day).

Consequence: a player who sits high on the season board from prior weeks reads as
"winning" even on a day they didn't (the "implies RavingRaven won the day" report).

## Goal

Add a per-clash **Day Summary** to `/results`: the day's winner + podium + standings
computed from that clash's points, shown **alongside** the season board with clear
labels so neither misleads. Auto-available once a clash is finalized; every past
clash is browsable. Existing results/points are never modified.

## Decisions (from brainstorming)

- **Anchor:** "a bit of all" — day winner + day podium from the clash's points, shown
  next to (not replacing) the season standings, clearly labeled.
- **Timing:** appears automatically once the day's 4 games are finalized; every past
  finalized clash keeps its own browsable summary.
- **Approach A:** clash-scoped `/results` with a selector. No new route — selection
  via `?clash=<tournamentId>` query param. Reuse existing ResultsScreen + podium
  patterns.

## Data sources (authoritative, no recompute of rankings)

- **Clash list / selector:** `pastClashes` (already in AppContext) — built from
  `tournaments` where `phase='complete' AND type='season_clash' AND archived_at IS
  NULL`, ordered by date desc. Each entry: `{ id (tournament uuid), name, date,
  season, players, lobbies, champion, top3 }`. Default selection = `pastClashes[0]`
  (most recent finished clash).
- **Day standings (ranking + points):** `tournament_results WHERE
  tournament_id = <clash.id> ORDER BY final_placement ASC` → `{ player_id,
  final_placement, total_points }`. This is the official finalized result (includes
  any bonuses/corrections applied at finalize), so the Day Summary cannot drift from
  the real results. Join `player_id` → `players` for name/rank/region; if a player
  left, fall back to a name from the row.
- **Display enrichment only (never changes ranking):** for the selected clash,
  `game_results WHERE tournament_id = <clash.id>` → derive avg placement / wins /
  top4 per player for the day. Optional; if absent, show points/placement only.
  (`computeTournamentStandings(players, gameResults, tournamentId)` already produces
  placements/wins/top4/tournamentPts with the correct in-tournament tiebreaker and is
  available as a fallback ranking source if `tournament_results` is ever empty.)

## Components (keep files small; ResultsScreen is already ~770 lines)

- **`useClashStandings(tournamentId)`** (new hook, e.g. `src/hooks` or co-located):
  fetches `tournament_results` (+ optional `game_results`) for the clash, joins to
  `players`, returns `{ standings, champion, loading, error }`. Caches by
  `tournamentId` (module-level or ref map) so switching clashes is instant and avoids
  refetch. Read-only; uses the normal client (no service role).
- **`ClashSelector`** (new): compact control listing recent finished clashes (name +
  date), drives the `?clash=` param. Dropdown for many; the existing
  `RecentChampionsStrip` can also deep-link into a selection.
- **`DayPodium`** (new): top-3 podium fed by **day points** (`total_points`), visually
  mirroring the existing season podium block but labeled "Day Result — <clash name>".
- **ResultsScreen** becomes composition: selector → hero (selected clash champion) →
  DayPodium → "This Clash" day-standings table → "Season Standings" (existing board,
  relabeled to read clearly as cumulative) → existing Awards / Clash Report tabs.

## UI structure on `/results`

1. **Clash selector** (top), default latest finished clash; reflects/writes `?clash=`.
2. **Hero champion** = selected clash's day winner (`standings[0]` /
   `pastClashes.champion`). Already largely present; make it follow the selector.
3. **"Won the Day" podium** = top 3 by that clash's `total_points`, labeled with the
   clash name/date.
4. **"This Clash" standings table** = day points + (enriched) avg/wins for the
   selected clash. Clearly labeled as the day's result.
5. **"Season Standings"** = the existing season board, kept and clearly labeled as
   cumulative so the two never blur.
6. **Awards / Clash Report** tabs unchanged. Share / Copy / Save-Card scope to the
   **selected clash's** day result (champion + day points), not season pts.

## Edge cases

- No finished clashes → existing empty state ("No clash results yet").
- Active, not-yet-finalized clash → not in the selector; `/results` shows the last
  finished clash (matches "auto after 4 games").
- `?clash=<id>` not in the finished list (bad/stale link) → fall back to latest, no crash.
- Selected clash has partial/missing `game_results` → ranking still comes from
  `tournament_results`; enrichment columns degrade gracefully.
- Player left the platform → render name from the result row; no dead profile links.

## Testing

- **Unit:** add a test (alongside `src/lib/__tests__/tournament.test.js`) asserting
  the day champion derived from a clash's results ≠ the season leader given sample
  data — i.e. the "Raven case" is fixed and day ranking uses clash points.
- **Manual:** load `/results`; switch between clashes via selector and `?clash=`;
  confirm day podium/standings differ from the season board when they should, labels
  are unambiguous, and share/copy reflect the selected clash.

## Non-goals (YAGNI)

- No live/in-progress day summary (timing is post-finalize only).
- No new top-level route.
- No editing/recomputing of finalized results — strictly read-and-display.
