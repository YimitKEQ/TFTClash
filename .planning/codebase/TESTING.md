# Testing

**Current state:** No test framework configured. Zero test files. Test coverage = 0%.

---

## Test Framework

**Recommended:** Vitest (compatible with Vite if project migrates) or Jest
**Current:** None

No `jest.config.*`, `vitest.config.*`, or `*.test.*` files exist anywhere in the project.

---

## Critical Untested Paths (Priority Order)

### Tier 1 — Core Logic (highest risk)

**`computeStats(player)`** — `src/App.jsx` line 65
- Multi-source fallback logic (clashHistory vs. cached fields)
- Edge cases: empty history, missing fields, NaN propagation
- Example test: player with 3 games — verify pts/wins/avg calculated correctly

**Tiebreaker sorting** — `src/App.jsx` line 1184
- All 4 official tiebreaker rules must be applied in order
- Test with players at identical points, identical wins, etc.
- Current code likely does NOT match official rulebook order

**Placement scoring (PTS constant)**
- `PTS = {1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`
- Test that placement → points mapping is correct
- Test that `clashHistory` accumulation produces correct `pts` total

### Tier 2 — Reliability (medium risk)

**Achievement checks** — `src/App.jsx` lines 116–131
- Each `check(player)` function independently testable
- Currently wrapped in silent try-catch — broken checks return false silently
- Test all 10+ achievements against qualifying and non-qualifying player data

**Player ID uniqueness** — line 1254
- `Date.now() % 100000` collision scenario
- Test rapid successive registrations

**Placement validation** — BracketScreen
- Invalid values: 0, 9, -1, NaN, undefined
- Verify bounds [1–8] enforced

### Tier 3 — Edge Cases (lower priority)

- Dispute resolution with array index stability
- Toast auto-dismiss timing
- Hash navigation with invalid screen name
- Duplicate Riot ID registration rejection

---

## Testing Challenges (Monolith)

The single-file architecture makes standard unit testing difficult:

1. **No exports** — `App.jsx` exports only the root component; internal functions like `computeStats` are not exported
2. **Coupled state** — logic intertwined with render, hard to test in isolation
3. **No dependency injection** — hardcoded seed data, no way to inject test data without mocking

**Workarounds before refactor:**
- Extract pure functions to a separate `src/utils.js` file and export them
- Or use eval-based extraction in tests (not recommended)
- Or test via E2E (Playwright/Cypress) which tests behavior not units

---

## Recommended Test Structure (when added)

```
src/
  __tests__/
    computeStats.test.js      # Stats engine unit tests
    tiebreaker.test.js        # Leaderboard sort determinism
    achievements.test.js      # Each achievement check
    scoring.test.js           # PTS constant application
    validation.test.js        # Input validation
```

---

## E2E Testing Approach (Playwright)

Since unit testing the monolith is difficult, E2E tests provide the most value now:

**Critical flows to cover:**
1. Admin logs in → submits placements → standings update
2. Player registers → appears in leaderboard
3. Navigate all screens without crash
4. TOC/FAQ links scroll to correct sections

---

## Mocking Needs

When unit tests are added:
- **Player factory:** `makePlayer({overrides})` for test data
- **Clash history factory:** `makeGame({placement, date})` for history entries
- **No API mocks needed** — no external API calls currently

---

## Recommendations

1. Extract `computeStats`, `getAchievements`, tiebreaker sort into `src/utils.js` (exportable)
2. Add Vitest: `npm install -D vitest`
3. Write unit tests for extracted utils first
4. Add Playwright for E2E coverage of critical admin flows
5. Add achievement test cases as regression tests when bugs are found
