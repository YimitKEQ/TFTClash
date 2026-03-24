# TFT Clash — Full Platform Vision
**Date:** 2026-03-24
**Status:** Approved by user (session brainstorm 2026-03-24)

This document captures the product vision for every screen and feature on the platform. It is the north star reference for all future sprints.

---

## The Platform In One Sentence

TFT Clash is a TFT-only tournament platform — built for the weekly Saturday clash, and open to hosts who want to run their own TFT events under the same roof.

---

## Tiers

### Player (Free)
- Join any public clash or host event
- Season leaderboard access
- Basic stats + match history

### Pro ($4.99/mo)
Real perks that are worth paying for:
- Auto check-in (no manual action needed before registration closes)
- Priority registration (can register 10 min before the general pool)
- Pro badge on profile + leaderboard
- Full career stats history (non-Pro sees limited history)
- Exclusive Pro Discord role

Payment: Stripe not yet available. Exploring PayPal or alternative. Pricing page shows "Coming Soon" state honestly for now.

### Host (Custom pricing — "Contact us")
Not self-serve. For people running serious TFT events. Hosts apply, get onboarded via Discord, get their own panel. Pricing card on site = "Get in touch" → Discord + contact form.

What a host gets:
- Their own tournament creation panel (scoped to their events only — cannot see weekly clash data)
- Events appear publicly on Events page
- Custom branding per event (name, description, banner image)
- Player registration + lobby management + result confirmation for their event
- Participant announcements
- Event visibility toggle (public vs invite-only)
- Check-in management
- Results export (CSV)

---

## Pages

### `/` — Home

**Logged out:**
- Hero: "The weekly TFT clash. Every Saturday night."
- Next clash countdown + date
- Leaderboard preview strip (top 3 players — real data, public)
- Featured events strip (pinned by admin)
- Factual value props: "Free to enter · Always", "EUW · EUNE · NA", "Results every Saturday"
- CTA: Sign Up Free → `/signup`

**Logged in (Dashboard):**
- ClashCard first (most important — shows registration / live / complete state)
- Current season standings (top 5 or full)
- Recent activity feed
- Featured events strip

### `/events` — Events

Full calendar + hub for all events:
- Weekly clashes (recurring)
- Flash tournaments (admin-created one-offs)
- Host events (from approved hosts)

Each event card: name, date, format, player count, sign-up CTA.
Featured events are pinned at the top (admin-controlled).
Hosts can make events public or invite-only.

### `/standings` + `/leaderboard` — Same screen, different entry points

Current season rankings for the weekly clash. Player name, rank badge, pts, wins, top 4s. Sort by pts by default. Filter/tabs for all-time vs current season.

### `/bracket` — Lobbies (rename to "Lobbies" in UI)

Shows the current clash's lobby assignments — 4 lobbies × 8 players. Weekly clash uses this. Flash tournaments and host events use a separate bracket/elimination view where applicable.

### `/results` — Last Clash Results

Showcase screen for the most recently completed clash. Final standings, per-lobby placements, champion announcement. Not historical — just the last one. For history, go to Archive.

### `/archive` — All Tournaments

Every held tournament listed: weekly clashes + flash tournaments + host events. Click any entry to see its full ClashReport (lobbies, placements, final standings). Filterable by type / season / host.

### `/player/:name` — Player Profile

Public — anyone can view without login.

Shows:
- Display name, avatar, bio, socials (set in Account settings)
- Rank badge + current pts
- Career stats: games played, wins, top 4s, avg placement, best finish
- Match history (last N clashes with placement per game)
- Achievements/milestones earned

### `/hall-of-fame` — Hall of Fame

HOF-worthy achievements. Creative, meaningful, not just "you played a lot."

Ideas:
- **Season Champion** — won a full season
- **Perfect Score** — first place in every game of a single clash
- **Iron Curtain** — never placed outside top 4 in a full clash
- **Comeback Kid** — won the clash after being last after game 1
- **Streak King** — top 4 in 10 consecutive games
- **Clash Veteran** — played 50 clashes
- **Untouchable** — won 3 clashes in a single season
- **The Grinder** — most total games played in a season
- **Kingslayer** — beat the current season champion in a head-to-head lobby

HoF lists players who've earned each achievement. Season champions have a dedicated section at the top.

### `/milestones` — Personal Milestones

Permanent achievements tied to career history. Examples: first win, 10th clash, first season top 3, 100 games. Progress bars for incomplete milestones. Cosmetic rewards marked "Coming Soon."

### `/challenges` — Challenges

Time-limited objectives (weekly or seasonal). Examples: finish top 4 three times this week, play 5 games this season, win a game on NA. XP Log tab hidden until XP system is built.

### `/season-recap` — Season Recap

Auto-generated at end of season. Per-player stats card: best finish, avg placement, total pts, achievements earned, clash count. Shareable card format.

### `/scrims` — Scrims

Private — for the core group only (requires auth + permission).

Two features:
1. **Practice lobbies** — admin creates a scrim lobby, assigns players, runs it informally (no season pts). Admin can grant "scrim manager" role to other players to manage lobbies too.
2. **Comp tracker** — admin inputs: comp name + placement for each player in a game. System aggregates over time: pick rate, top 4 rate, win rate per comp. Private meta tracker for the group.

### `/flash/:id` — Flash Tournament

Admin-created one-off tournament. Configurable: date, invited players, number of games, cut rules (Stage 1 → cut → Stage 2 as built in Sprint 3 engine). Used by admin to test the platform and run special events before the season starts. Appears on Events page. Has its own results/standings/bracket views scoped to that event.

### `/tournament/:id` — Host Event

Same structure as flash tournament but created and managed by an approved host. Fully branded to the host. Scoped data — weekly clash data not visible here.

### `/admin` — Admin Panel

Tabs:
- **Tournament** — create/edit weekly clash, assign lobbies, confirm results (existing)
- **Players** — search players, ban/warn, manually edit pts/stats
- **Season** — start/end season, set season name + dates
- **Host Applications** — review + approve/reject incoming host applications
- **Featured Events** — pin events to Home + Events page featured strip
- **Site Settings** — Discord URL, clash day/time defaults, season name, site-wide config
- **Content** — edit Rules page content, FAQ entries, announcements — live CMS, no deploy needed

### `/host/apply` — Host Application

Form: name, Discord handle (must be in the server + connected to platform), event type, expected player count, frequency. On submit → Discord webhook posts to a dedicated applications channel. Admin reviews in Discord, approves/rejects in Admin panel.

### `/host/dashboard` — Host Dashboard

Fully scoped to the host's own events. No weekly clash data visible.

Features: create event, manage event (lobbies, check-in, results), announcements to participants, event visibility toggle, results export.

### `/account` — Account Settings

Profile: display name, avatar, bio, socials (shown on public profile).
Riot IDs: EU + NA (built in Sprint 1).
Billing: subscription status (Pro/Host).
Notifications preferences.

### `/pricing` — Pricing

Three columns: Player (Free), Pro ($4.99/mo — real perks only), Host (Contact Us).
Pro CTA: Coming Soon (no Stripe yet).
Host CTA: "Get in touch" → Discord + contact form.
No fake features anywhere.

### `/gear` — Gear / Sponsors

Sponsor/affiliate cards. Each card: sponsor name, description, referral CTA button. Admin-managed list (via Site Settings or Content tab). Revenue via referral commissions. Honest about what it is — "our partners" or similar.

### `/rules` — Rules

Real rulebook only. No fake support promises. Discord link for questions.

### `/faq` — FAQ

Real questions only. Support via Discord. Year: 2026.

### `/login`, `/signup`, `/privacy`, `/terms` — Standard

No notable product decisions needed.

---

## Sprint Alignment

| Sprint | What it builds |
|---|---|
| 1 | Clash engine core (Riot IDs, result submission, admin confirm) — **SHIPPED** |
| 2 | Nav consolidation, content integrity, home improvements |
| 3 | Custom tournament engine (multi-stage, cuts, lobbies re-seeding) |
| 4 | Tournament lifecycle automation (registration windows, check-in, email) |
| 5 | Discord bot integration (lobby channels, result posts, host application webhook) |
| 6 | Final polish (season recap, achievements wired to DB, player profiles full, Gear page, comp tracker in Scrims) |
