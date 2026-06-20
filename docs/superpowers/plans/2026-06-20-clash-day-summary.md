# Clash Day Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-clash "Day Summary" to `/results` — the day's winner, podium, and standings computed from that clash's points (from `tournament_results`), shown alongside the season board with clear labels, browsable per finished clash via a `?clash=` param.

**Architecture:** A pure helper (`buildClashDayStandings`) turns `tournament_results` rows + roster into ranked day standings (authoritative `final_placement`, enriched by `game_results` for avg/wins). A `useClashStandings` hook fetches + caches per clash. ResultsScreen gains a `ClashSelector` and a `DayPodium` and renders day data next to the existing (relabeled) season standings. No new route; no recompute/edit of finalized results.

**Tech Stack:** React 18 (no arrow fns / `var` / `function(){}` per CLAUDE.md), react-router-dom v6 (`useSearchParams`), Supabase client (`src/lib/supabase.js`), Tailwind, `<Icon>`, `useApp()`. Unit tests on Node's built-in runner (`npm run test:unit`).

---

## File Structure

- **Create** `src/lib/clashSummary.js` — pure `buildClashDayStandings(results, players, gameResults)`. No React, no I/O. Testable.
- **Create** `src/lib/__tests__/clashSummary.test.js` — unit tests (day champion != season leader).
- **Create** `src/hooks/useClashStandings.js` — fetches `tournament_results` (+ `game_results`) for a `tournamentId`, calls the pure helper, caches per id, returns `{ standings, champion, loading, error }`.
- **Create** `src/screens/results/DayPodium.jsx` — top-3 podium fed by day points.
- **Create** `src/screens/results/ClashSelector.jsx` — dropdown of finished clashes; drives `?clash=`.
- **Modify** `src/screens/ResultsScreen.jsx` — selector + day champion hero + DayPodium + "This Clash" table; relabel season board; scope share/copy to selected clash.

Note: the project only has unit-test infra for `src/lib` (Node `node:test`). The real ranking logic lives in the pure helper and is TDD'd. Hook/components are verified manually (no JSX test runner exists; do not invent one).

---

### Task 1: Pure day-standings helper (TDD)

**Files:**
- Create: `src/lib/clashSummary.js`
- Test: `src/lib/__tests__/clashSummary.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/clashSummary.test.js`:

```javascript
// Unit tests for the per-clash Day Summary standings builder.
// Runs on Node's built-in test runner: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClashDayStandings } from '../clashSummary.js';

test('day winner is the clash points leader, not the season leader', function () {
  // Season leader is A (100 season pts) but on THIS clash B won the day.
  var players = [
    { id: 'A', name: 'Alpha', rank: 'Gold', region: 'EU', pts: 100 },
    { id: 'B', name: 'Bravo', rank: 'Iron', region: 'EU', pts: 10 }
  ];
  var results = [
    { player_id: 'B', final_placement: 1, total_points: 30 },
    { player_id: 'A', final_placement: 5, total_points: 12 }
  ];
  var standings = buildClashDayStandings(results, players);
  assert.equal(standings[0].id, 'B');           // day winner
  assert.notEqual(standings[0].id, players[0].id); // NOT the season leader (A)
  assert.equal(standings[0].dayPts, 30);
});

test('ranks by authoritative final_placement, ties fall back to day points', function () {
  var players = [
    { id: 'A', name: 'Alpha' }, { id: 'B', name: 'Bravo' }, { id: 'C', name: 'Charlie' }
  ];
  var results = [
    { player_id: 'C', final_placement: 2, total_points: 20 },
    { player_id: 'A', final_placement: 1, total_points: 25 },
    { player_id: 'B', final_placement: 3, total_points: 18 }
  ];
  var ids = buildClashDayStandings(results, players).map(function (r) { return r.id; });
  assert.deepEqual(ids, ['A', 'C', 'B']);
});

test('enriches avg/wins/top4 from game_results without changing rank order', function () {
  var players = [{ id: 'A', name: 'Alpha' }, { id: 'B', name: 'Bravo' }];
  var results = [
    { player_id: 'A', final_placement: 1, total_points: 16 },
    { player_id: 'B', final_placement: 2, total_points: 9 }
  ];
  var gameResults = [
    { player_id: 'A', placement: 1, game_number: 1 }, { player_id: 'A', placement: 1, game_number: 2 },
    { player_id: 'B', placement: 4, game_number: 1 }, { player_id: 'B', placement: 2, game_number: 2 }
  ];
  var standings = buildClashDayStandings(results, players, gameResults);
  assert.equal(standings[0].id, 'A');
  assert.equal(standings[0].wins, 2);
  assert.equal(standings[0].avgPlacement, 1);
  assert.equal(standings[1].avgPlacement, 3); // (4+2)/2
});

test('falls back to a placeholder name when the player left the roster', function () {
  var standings = buildClashDayStandings(
    [{ player_id: 'ghost', final_placement: 1, total_points: 8 }], []
  );
  assert.equal(standings[0].name, 'Player ghost');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — cannot find module `../clashSummary.js` / `buildClashDayStandings is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/clashSummary.js`:

```javascript
// Pure builder for the per-clash "Day Summary" standings. Ranking is taken from
// the authoritative finalized results (tournament_results.final_placement /
// total_points); game_results is optional and only enriches display columns
// (avg placement, wins, top4). No I/O, no React -- unit tested.

export function buildClashDayStandings(results, players, gameResults) {
  var byId = {};
  (players || []).forEach(function (p) { byId[String(p.id)] = p; });

  var enrich = {};
  (gameResults || []).forEach(function (g) {
    var k = String(g.player_id != null ? g.player_id : g.playerId);
    if (!enrich[k]) enrich[k] = { games: 0, placeSum: 0, wins: 0, top4: 0 };
    var place = g.placement || 0;
    enrich[k].games += 1;
    enrich[k].placeSum += place;
    if (place === 1) enrich[k].wins += 1;
    if (place >= 1 && place <= 4) enrich[k].top4 += 1;
  });

  var rows = (results || []).map(function (r) {
    var key = String(r.player_id);
    var p = byId[key] || {};
    var e = enrich[key];
    var avg = (e && e.games) ? Math.round((e.placeSum / e.games) * 10) / 10 : null;
    return {
      id: r.player_id,
      name: p.name || ('Player ' + r.player_id),
      rank: p.rank || '',
      region: p.region || '',
      placement: (r.final_placement != null ? r.final_placement : null),
      dayPts: r.total_points || 0,
      avgPlacement: avg,
      wins: e ? e.wins : 0,
      top4: e ? e.top4 : 0
    };
  });

  rows.sort(function (a, b) {
    if (a.placement != null && b.placement != null && a.placement !== b.placement) {
      return a.placement - b.placement;
    }
    return (b.dayPts || 0) - (a.dayPts || 0);
  });

  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS (all 4 new tests green; existing tournament tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clashSummary.js src/lib/__tests__/clashSummary.test.js
git commit -m "feat(results): pure day-standings builder for clash summary"
```

---

### Task 2: useClashStandings hook

**Files:**
- Create: `src/hooks/useClashStandings.js`

No automated test (no JSX/hook test runner in repo). Logic under test lives in Task 1's helper. Verify by usage in Task 5.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useClashStandings.js`:

```javascript
import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { buildClashDayStandings } from '../lib/clashSummary'

// Module-level cache so switching between clashes is instant and we never refetch
// a clash we already loaded this session. Keyed by tournament id.
var clashStandingsCache = {}

export function useClashStandings(tournamentId) {
  var ctx = useApp()
  var players = ctx.players || []

  var _state = useState({ standings: [], champion: null, loading: false, error: null })
  var state = _state[0]
  var setState = _state[1]

  useEffect(function () {
    if (!tournamentId || !supabase || !supabase.from) {
      setState({ standings: [], champion: null, loading: false, error: null })
      return
    }

    var cached = clashStandingsCache[tournamentId]
    if (cached) {
      var rebuilt = buildClashDayStandings(cached.results, players, cached.gameResults)
      setState({ standings: rebuilt, champion: rebuilt[0] || null, loading: false, error: null })
      return
    }

    var cancelled = false
    setState(function (s) { return Object.assign({}, s, { loading: true, error: null }) })

    Promise.all([
      supabase.from('tournament_results')
        .select('player_id,final_placement,total_points')
        .eq('tournament_id', tournamentId)
        .order('final_placement', { ascending: true }),
      supabase.from('game_results')
        .select('player_id,placement,game_number')
        .eq('tournament_id', tournamentId)
    ]).then(function (res) {
      if (cancelled) return
      var rRes = res[0]
      var gRes = res[1]
      if (rRes && rRes.error) {
        setState({ standings: [], champion: null, loading: false, error: rRes.error })
        return
      }
      var results = (rRes && rRes.data) || []
      var gameResults = (gRes && !gRes.error && gRes.data) ? gRes.data : []
      clashStandingsCache[tournamentId] = { results: results, gameResults: gameResults }
      var standings = buildClashDayStandings(results, players, gameResults)
      setState({ standings: standings, champion: standings[0] || null, loading: false, error: null })
    }).catch(function (e) {
      if (cancelled) return
      setState({ standings: [], champion: null, loading: false, error: e })
    })

    return function () { cancelled = true }
  }, [tournamentId, players])

  return state
}
```

- [ ] **Step 2: Sanity check it imports/builds**

Run: `npm run build`
Expected: build succeeds (no import errors). If `src/lib/supabase` export differs, match the existing import style used elsewhere (see `grep "from '../lib/supabase'" src`).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useClashStandings.js
git commit -m "feat(results): useClashStandings hook (fetch + cache day standings)"
```

---

### Task 3: DayPodium component

**Files:**
- Create: `src/screens/results/DayPodium.jsx`

- [ ] **Step 1: Write the component**

Create `src/screens/results/DayPodium.jsx`:

```javascript
import Icon from '../../components/ui/Icon'

// Top-3 podium for a single clash, fed by day points (dayPts). Mirrors the season
// podium visual on ResultsScreen but is explicitly the day's result. Display order
// is 2nd, 1st, 3rd so the winner sits centered and tallest.
export default function DayPodium(props) {
  var standings = props.standings || []
  var label = props.label || 'Day Result'
  var onPick = props.onPick || function () {}
  if (standings.length < 3) return null

  var top3 = [standings[1], standings[0], standings[2]]

  return (
    <div className="relative overflow-hidden rounded-xl p-6 md:p-8 border border-outline-variant/10 bg-surface-container-low">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center gap-2 mb-5">
        <Icon name="emoji_events" fill size={18} className="text-primary" />
        <h3 className="font-display text-base tracking-wide uppercase">{label}</h3>
      </div>
      <div className="grid grid-cols-3 items-end gap-3 md:gap-5">
        {top3.map(function (p, idx) {
          var actualRank = idx === 0 ? 1 : idx === 1 ? 0 : 2
          var isGold = actualRank === 0
          var isSilver = actualRank === 1
          var barHeight = isGold ? 'h-44 md:h-56' : isSilver ? 'h-32 md:h-40' : 'h-24 md:h-32'
          var avatarSize = isGold ? 'w-20 h-20 md:w-28 md:h-28' : 'w-14 h-14 md:w-20 md:h-20'
          var avatarBorder = isGold
            ? 'border-4 border-primary shadow-[0_0_24px_rgba(255,198,107,0.4)]'
            : isSilver ? 'border-4 border-on-surface/20' : 'border-4 border-on-surface/15'
          var barStyle = isGold
            ? { background: 'linear-gradient(135deg, #FFC66B 0%, #E8A838 100%)' }
            : isSilver
              ? { background: 'linear-gradient(135deg, #E4E1EC 0%, #9D8E7C 100%)' }
              : { background: 'linear-gradient(135deg, #9D8E7C 0%, #504535 100%)' }
          var numColor = isGold ? 'text-on-primary' : 'text-on-surface'
          return (
            <div
              key={p.id || p.name}
              onClick={function () { onPick(p) }}
              className={'flex flex-col items-center cursor-pointer transition-all duration-200 hover:scale-[1.02]' + (isGold ? ' scale-105 z-10' : '')}
            >
              {isGold && (
                <div className="relative mb-1 flex justify-center">
                  <Icon name="workspace_premium" fill size={24} className="text-primary" />
                </div>
              )}
              <div className={'rounded-full mb-3 flex items-center justify-center bg-surface-container-highest shrink-0 ' + avatarSize + ' ' + avatarBorder}>
                <span className={'font-display font-bold opacity-60 ' + (isGold ? 'text-2xl text-primary' : 'text-lg text-medal-silver')}>
                  {p.name ? p.name[0].toUpperCase() : '?'}
                </span>
              </div>
              <div className={'w-full rounded-t-xl flex flex-col items-center justify-between pt-4 pb-4 shadow-2xl ' + barHeight} style={barStyle}>
                <span className={'font-display opacity-40 leading-none ' + numColor + (isGold ? ' text-5xl' : ' text-3xl')}>
                  {actualRank + 1}
                </span>
                <div className="text-center px-2">
                  <p className={'font-label font-bold uppercase truncate w-full ' + (isGold ? 'text-sm md:text-base' : 'text-xs md:text-sm') + ' ' + numColor}>
                    {p.name}
                  </p>
                  <span className={'font-mono font-bold text-xs opacity-80 ' + numColor}>
                    {(p.dayPts || 0) + ' pts'}
                  </span>
                  {p.avgPlacement != null && (
                    <div className={'font-mono text-[10px] mt-0.5 opacity-60 ' + numColor}>
                      {'avg ' + p.avgPlacement}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/results/DayPodium.jsx
git commit -m "feat(results): DayPodium component (per-clash top 3 by day points)"
```

---

### Task 4: ClashSelector component

**Files:**
- Create: `src/screens/results/ClashSelector.jsx`

- [ ] **Step 1: Write the component**

Create `src/screens/results/ClashSelector.jsx`. Uses a native `<select>` (CLAUDE.md says `Sel` is not in the shared UI lib; define the wrapper locally):

```javascript
import Icon from '../../components/ui/Icon'

function shortDate(input) {
  if (!input) return ''
  var d = new Date(input)
  if (isNaN(d.getTime())) return ''
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate()
}

// Dropdown of finished clashes. Value is the tournament id. Calls onChange(id).
export default function ClashSelector(props) {
  var clashes = props.clashes || []
  var value = props.value || ''
  var onChange = props.onChange || function () {}
  if (clashes.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Icon name="event" size={16} className="text-on-surface/40" />
      <div className="relative">
        <select
          value={value}
          onChange={function (e) { onChange(e.target.value) }}
          className="appearance-none bg-surface-container border border-outline-variant/20 rounded-lg pl-3 pr-9 py-2 text-sm text-on-surface font-label uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/60"
        >
          {clashes.map(function (c) {
            var d = shortDate(c.date)
            return (
              <option key={c.id} value={String(c.id)}>
                {(c.name || 'Clash') + (d ? ' - ' + d : '')}
              </option>
            )
          })}
        </select>
        <Icon name="expand_more" size={18} className="text-on-surface/40 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/results/ClashSelector.jsx
git commit -m "feat(results): ClashSelector dropdown for finished clashes"
```

---

### Task 5: Integrate into ResultsScreen

**Files:**
- Modify: `src/screens/ResultsScreen.jsx`

Goal: select a clash (default latest finished, syncable via `?clash=`), show that clash's champion hero + DayPodium + a "This Clash" standings table, and keep the existing season table relabeled so the two never blur. Scope share/copy to the selected clash.

- [ ] **Step 1: Add imports**

At the top of `src/screens/ResultsScreen.jsx`, add to the existing imports:

```javascript
import { useSearchParams } from 'react-router-dom'
import { useClashStandings } from '../hooks/useClashStandings'
import DayPodium from './results/DayPodium'
import ClashSelector from './results/ClashSelector'
```

- [ ] **Step 2: Derive the selected clash from `?clash=` (default latest)**

Inside `ResultsScreen()`, just after `var pastClashes = ctx.pastClashes || []`, add:

```javascript
var _searchParams = useSearchParams()
var searchParams = _searchParams[0]
var setSearchParams = _searchParams[1]

var clashParam = searchParams.get('clash')
var selectedClash = null
if (pastClashes.length > 0) {
  selectedClash = clashParam
    ? (pastClashes.find(function (c) { return String(c.id) === String(clashParam) }) || pastClashes[0])
    : pastClashes[0]
}
var selectedClashId = selectedClash ? selectedClash.id : null

var dayData = useClashStandings(selectedClashId)
var dayStandings = dayData.standings || []

function selectClash(id) {
  setSearchParams(function (prev) {
    var next = new URLSearchParams(prev)
    next.set('clash', String(id))
    return next
  })
}
```

- [ ] **Step 3: Point the hero/champion at the selected clash**

Replace the existing `focusClash` / `champ` lines:

```javascript
var focusClash = pastClashes.length > 0 ? pastClashes[0] : null
var champ = (focusClash && players.find(function(p) { return p.name === focusClash.champion })) || sorted[0]
```

with:

```javascript
var focusClash = selectedClash || (pastClashes.length > 0 ? pastClashes[0] : null)
var dayChampName = dayData.champion ? dayData.champion.name : (focusClash ? focusClash.champion : null)
var champ = (dayChampName && players.find(function(p) { return p.name === dayChampName })) || sorted[0]
```

(`clashName`/`clashDate` already derive from `focusClash`, so they now follow the selector automatically.)

- [ ] **Step 4: Render the selector in the header**

In the header block, after the `<h1>{clashName + ' - Final Results'}</h1>` and its date `<div>`, add inside the `flex-1 min-w-0` container (below the date div):

```javascript
{pastClashes.length > 1 && (
  <div className="mt-3">
    <ClashSelector clashes={pastClashes} value={selectedClashId ? String(selectedClashId) : ''} onChange={selectClash} />
  </div>
)}
```

- [ ] **Step 5: Add the "Won the Day" podium + relabel season podium**

The existing podium block (the `sorted.length >= 3` one) is the **season** podium. Directly ABOVE it, insert the day podium:

```javascript
{dayStandings.length >= 3 && (
  <DayPodium
    standings={dayStandings}
    label={'Won the Day - ' + clashName}
    onPick={function (p) {
      var match = players.find(function (pl) { return String(pl.id) === String(p.id) })
      if (match) openProfile(match)
    }}
  />
)}
```

Then, on the existing season podium wrapper, add a small heading so it reads as cumulative. Immediately inside that block's opening `<div ...>` (before the gradient line div), add:

```javascript
<div className="flex items-center gap-2 mb-4">
  <Icon name="leaderboard" size={16} className="text-on-surface/40" />
  <h3 className="font-display text-base tracking-wide uppercase text-on-surface/70">Season Top 3</h3>
</div>
```

- [ ] **Step 6: Add a "This Clash" standings table above the season table**

The existing "Full Standings" tab content (`tab === 'results'`) is the season board. Its header already says "Season Standings" (keep it). Directly above the `<PillTabGroup>` add a compact day-standings card:

```javascript
{dayStandings.length > 0 && (
  <div className="rounded-xl overflow-hidden border border-outline-variant/10 bg-surface-container-low">
    <div className="px-6 py-4 flex justify-between items-center border-b border-outline-variant/10">
      <h3 className="font-label text-on-surface-variant tracking-[0.1em] uppercase text-sm">
        {'This Clash - ' + clashName}
      </h3>
      <span className="font-mono text-xs text-primary/50">{dayStandings.length + ' players'}</span>
    </div>
    <div className="grid px-6 py-2.5 bg-surface-container-lowest/50 border-b border-outline-variant/5 [grid-template-columns:52px_1fr_80px_70px_60px]">
      {['Rank', 'Player', 'Day Pts', 'Avg', 'Wins'].map(function (h) {
        return <span key={h} className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/40">{h}</span>
      })}
    </div>
    <div className="divide-y divide-outline-variant/5">
      {dayStandings.map(function (p, i) {
        var col = PlacementColor(i)
        return (
          <div
            key={p.id || p.name}
            onClick={function () {
              var match = players.find(function (pl) { return String(pl.id) === String(p.id) })
              if (match) openProfile(match)
            }}
            className="grid px-6 py-3 items-center cursor-pointer transition-colors hover:bg-white/[0.03] [grid-template-columns:52px_1fr_80px_70px_60px]"
          >
            <span className="font-mono text-sm font-bold" style={{ color: col }}>{'#' + String(i + 1).padStart(2, '0')}</span>
            <span className="text-sm truncate text-on-surface">{p.name}</span>
            <span className="font-mono text-sm font-bold" style={{ color: i < 3 ? col : '#C8BFB0' }}>{p.dayPts + ' pts'}</span>
            <span className="font-mono text-sm" style={{ color: avgCol(p.avgPlacement != null ? p.avgPlacement : 0) }}>{p.avgPlacement != null ? p.avgPlacement : '-'}</span>
            <span className="font-mono text-sm text-emerald-400">{p.wins}</span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 7: Scope the season-table header label so it reads as cumulative**

In the `tab === 'results'` season table, the header already says "Season Standings" — leave it. No change needed beyond what Steps 5-6 added. (This step is a deliberate no-op confirmation; the two tables are now distinctly labeled "This Clash - X" vs "Season Standings".)

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: build succeeds, no unused-import or syntax errors.

- [ ] **Step 9: Manual verification**

Run: `npm run dev`, open `/results`.
- With >1 finished clash: selector appears; default = latest finished clash.
- "Won the Day - <clash>" podium and "This Clash - <clash>" table use **day points** (`total_points`), and differ from the "Season Top 3" / "Season Standings" when season and day leaders differ (the Raven case).
- Append `?clash=<another tournament id>` (or pick in the dropdown): hero champion, day podium, and day table all switch to that clash; switching is instant on revisit (cache).
- Bad `?clash=zzz`: falls back to latest, no crash.

- [ ] **Step 10: Commit**

```bash
git add src/screens/ResultsScreen.jsx
git commit -m "feat(results): clash-scoped Day Summary on /results (selector + day podium + this-clash table)"
```

---

## Self-Review

**Spec coverage:**
- Clash selector / `?clash=` / default latest → Task 5 Steps 2,4. ✓
- Day standings from `tournament_results` (authoritative), enriched by `game_results` → Task 1 + Task 2. ✓
- Day winner + podium by clash points → Task 3 + Task 5 Step 5. ✓
- "This Clash" table alongside relabeled "Season Standings" → Task 5 Steps 5,6. ✓
- Small focused files (hook/components extracted) → Tasks 1-4. ✓
- Edge cases (no clashes, partial game_results, departed player, bad param) → Task 1 (placeholder name, placement fallback), Task 5 Steps 2,9. ✓
- Unit test day champion != season leader → Task 1 Step 1. ✓
- Non-goals (no live summary, no new route, no result edits) → honored (read-only hook, `?clash=` param, post-finalize `pastClashes`). ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓
**Type consistency:** `buildClashDayStandings(results, players, gameResults)` returns rows with `{ id, name, rank, region, placement, dayPts, avgPlacement, wins, top4 }`; consumed identically in DayPodium (`dayPts`, `avgPlacement`, `name`), the hook (`standings[0]` as champion), and the This-Clash table (`dayPts`, `avgPlacement`, `wins`, `id`, `name`). ✓

**Share/copy note:** `clashName`/`clashDate`/`champ` now follow the selected clash, so the existing Share/Copy/Save-Card already reflect the selected clash with no extra change.
