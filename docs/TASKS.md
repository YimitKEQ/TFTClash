# TFT Clash — Task Backlog

> Last updated: 2026-05-02
> Status key: `[ ]` todo · `[~]` in progress · `[x]` done

The platform shipped to public launch in late April 2026. This file now tracks
**only what is currently pending or in flight**. Historical phase backlogs
(Phases 1-9, March 2026) are archived at the bottom for reference.

---

## Pending — Priority 1 (squads + custom tournament parity)

_All three squads parity items shipped 2026-05-02. See "Recently shipped"._

---

## Pending — Priority 2 (housekeeping)

### [ ] Toggle "Leaked Password Protection" in Supabase Auth dashboard
**Where:** Supabase Dashboard → Authentication → Policies → Password protection.

Last open security advisor warning, no SQL fix. Enables HaveIBeenPwned.org
breach check on signup/password change.

### [ ] Redeploy Discord bot
The `games_played` → `games` column fix was pushed in `120db78`. Until the
bot service is restarted/redeployed, `/standings` and `/player` continue
returning `0` for game counts (the 400 fails silently and the helper
returns the fallback).

### [ ] Refresh `docs/TOURNAMENT-SYSTEM.md` for team format variants
That doc was written before squads + 2v2 Double Up shipped. Add team_size,
teams_per_lobby, points_scale, and the season-clash exclusion rule.

---

## Pending — Priority 3 (deferred, not blocking launch)

### [ ] Stripe / PayPal host payout flow (deferred from host dashboard rewrite)
Hosts currently take registrations, but payout to the host (after platform
cut) is manual. **HOLD** — explicitly deferred by user 2026-05-01.

### [ ] Team-specific sponsor branding (deferred)
Sponsors today are platform-level. Letting hosts attach their own sponsors
to a tournament needs a host_sponsors join table and overlay/page rendering
work. **HOLD** — deferred 2026-05-01.

### [ ] FlashTournamentScreen split (carryover from 2026-04-25)
File is 1700+ lines. Splitting into 5 sub-components (overview, register,
checkin, live, finalize) would cut bundle and make the file editable
without context-window pressure. Low priority while it works.

### [ ] AccountScreen guest preview (carryover)
Logged-out users currently see a redirect/blank state. Show a preview of
what the account screen looks like to drive signups.

### [ ] Auto-advance countdown race (carryover)
`BracketScreen.jsx` line ~472-487, countdown=0 transition has a minor race
when state updates rapidly. Only shows at exactly countdown=0 — low priority.

---

## Recently shipped (since 2026-04-01)

For full detail see commit history; high-level summary:

- **Squads 4v4** (commits `1173113`, `8a9a2be`, `86c4883`, `09e438b`,
  `ecdb016`, `84ad198`, `444bce0`, `16da7a8`, `7520f86`): persistent teams,
  tournament integration, in-event lineup, host-dashboard results entry,
  team profile pages, post-review hardening.
- **2v2 Double Up** (`6c232b6`, `a4907e2`): Riot 4-3-2-1 scoring, host
  dashboard awareness.
- **Custom tournament hardening** (`2b7fbb1`, `c03e9fa`, `780a30b`): full
  audit pass; capacity, badges, waitlist promotion, region/team-shape
  triggers.
- **Host dashboard production rewrite** (`a357e0b`, `5af8a40`, `5fd935a`):
  paying-host (€19.99/mo) self-service via universal `/tournament/:uuid`,
  active-subscription gate, archive persistence.
- **News feed** (`2abb930`): platform-wide announcements with admin composer.
- **Events consolidation** (`8f7d9df`, `034d2b7`, `dbea7bc`): single
  Live & Upcoming feed; archived tournaments hidden from public + season
  stats; unified `/flash/:id` and `/tournament/:id`.
- **Admin polish** (`13ceb92`, `9f9c2d9`, `3cc4991`, `0750cbb`, `cb00578`,
  `4cd5550`, `e671237`, `2201613`, `cf94b50`, `bf261f5`, `e946111`,
  `fec34e0`): cut config, prize-pool UI, archive + broadcast, payouts tab,
  region selector, broadcast templates, admin live controls, persistent
  start times.
- **Database hardening** (migs 100-103, commits `c03e9fa`, `2b7fbb1`,
  `d73a3ba`): 6 triggers + 1 CHECK constraint + RPC/policy hardening +
  Supabase advisor cleanup (lints 64 → 8).
- **Discord bot** (`784242b`, `b657aef`, `120db78`): per-tournament
  channels, fresh permanent invite, players.games column fix.

---

## Archive — Phases 1-9 (March 2026, all shipped)

The original 47-task backlog covering bracket PIN removal, scrims stats,
HOF, leaderboard search, achievements, account rebuild, FAQ, monetization
(PayPal), API hardening, audit logging, host system overhaul, etc. — all
items are complete and live in production. See git history `2026-03-01..2026-04-01`
or memory `project_session_2026_03_*.md` for detail.
