# TFT Clash — Code Review

**Date:** 2026-03-18
**Scope:** `src/App.jsx` (15,969 lines), `api/` (4 functions), `discord-bot/`, `src/lib/`

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 7 |
| MEDIUM | 9 |
| LOW | 10 |

---

## HIGH Bugs

### 1. `AdminPanel` references `currentUser` which is out of scope (~line 7887)

`AdminPanel` does not receive `currentUser` as a prop. Every audit action crashes with `TypeError: Cannot read properties of undefined`.

**Fix:** Add `currentUser` to AdminPanel's props.

### 2. `SEASON_CHAMPION` mutated during render (~lines 15685–15696)

Module-level `let SEASON_CHAMPION` is directly assigned inside `TFTClash()` on every render. Bypasses React state, causes stale reads in async contexts.

**Fix:** Replace with `useMemo`.

### 3. `computeClashAwards` — "Most Improved" and "Ice Cold" always same player (~lines 676–682)

Both assigned `byAvp[0]`. Guard prevents both from showing, so "Ice Cold" never appears.

### 4. Discord bot `profileEmbed` divides by hardcoded `SEASON.currentClash = 15` (~line 142)

Win rate shows 20% instead of 60% for a player with 3 wins in 5 games.

### 5. Tiebreaker Step 4 compares placement, not recency (~lines 411–415)

EMEA rulebook says "most recent game finish" (recency). Code compares who placed better last.

### 6. `create-checkout.js` leaks Stripe error messages to client (~line 149)

### 7. `stripe-webhook.js` silently swallows subscription upsert errors (~lines 68–78)

DB failures respond 200 to Stripe, stopping retries and losing subscription state.

---

## MEDIUM Issues

- `pastClashes` effect re-runs on every `players` change, cascading waterfall DB queries (~line 15531)
- `computeStats` called 3+ times per player per render with no memoization
- `navTo` recreated every render without `useCallback`, defeats `React.memo` on children (~line 15556)
- `check-admin.js` CORS reflects any origin (~line 52)
- `checkedInIds` stamp effect has potential Supabase realtime feedback loop (~lines 15188–15194)
- `players` serialized to localStorage on every change including realtime pushbacks — needs debounce
- `ResultsScreen` podium `height` variable computed but never used (~line 6847)
- `authScreen` early returns from component with hooks above — fragile pattern
- `LeaderboardScreen` sorts players twice for different tabs without separate memos

---

## LOW Issues

- IIFE in JSX at `PlayerProfileScreen` (~line 5516) and `ChallengesScreen` (~line 11480)
- `supabase.js` mock has no `.from()` method — crashes without env vars
- `GearScreen` affiliate cards have no clickable links
- Discord bot `welcomeEmbed` uses placeholder `<#RULES_ID>` and `<#VERIFY_ID>` strings
- `TickerAdminPanel` uses array index as key (~line 7827)
- `disputes` state initialized but never updated (~line 15059)
- `Hexbg` renders 5 fixed gradient divs unconditionally — performance on mobile
- Podium only shows with 3+ players, hides if only 2
- Color contrast issues with purple on dark backgrounds (WCAG AA fail)
- Zero ARIA labels, no keyboard navigation for custom components

---

## Tournament Logic Correctness

- **Points system (PTS constant):** Correct — matches EMEA rulebook
- **Tiebreaker Steps 1-3:** Correct
- **Tiebreaker Step 4:** BUG — compares placement not recency
- **Drop weeks logic:** Correct
- **Finals boost:** May be applying to highest-scoring clashes rather than chronologically final ones

---

## Performance Hotspots

1. `computeStats` called O(n) times per render across multiple screens — needs memoization
2. `players` serialized to localStorage synchronously on every realtime event — needs debounce
3. `pastClashes` waterfall query fires on every players change
4. `navTo` without `useCallback` defeats all `React.memo` wrappers
5. `Hexbg` fixed gradient divs always mounted — heavy on mobile compositor
