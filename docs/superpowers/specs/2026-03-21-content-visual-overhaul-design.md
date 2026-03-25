# TFT Clash — Content & Visual Overhaul Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Author:** Claude + Levitate
**Context:** Structural UX overhaul (routing, wrappers, phase-adaptive clash) is complete. This spec covers the CONTENT overhaul — what each screen actually shows, how it feels, and the functionality behind it. Every feature described here must work end-to-end with database persistence. No placeholder buttons. Build to ship.

---

## 1. Core Philosophy

### The Three Pillars

1. **Competitive Identity** — TFT Clash is your competitive home. Your rank, your trajectory, your stats. The FACEIT Level equivalent for TFT community competition.
2. **Season Narrative** — Turn raw numbers into stories. Comebacks, streaks, rivalries, projected finishes. The platform tells you what happened and what's about to happen.
3. **Dopamine Loop** — Every time you open the app, something changed. A number moved. Someone passed you. A streak is building. Medium pressure: loud position changes and projections, but no point decay. The anxiety comes from watching others climb, not from punishment.

### Design Identity: Luxury Competitive

TFT Clash is the **boutique** competitive platform — not a FACEIT clone, not a generic esports site. Every platform in the space uses dark blue + geometric sans-serif + orange accents. We don't.

- **Playfair Display** for headings (editorial, classy — our signature)
- **Barlow Condensed** for labels/badges/stats (tight, competitive)
- **Inter** for body text and pill buttons (clean, readable) — *upgrade from "system mono" in CLAUDE.md; intentional change*
- **Palette:** `#08080F` bg, `#111827` panels, `#9B72CF` purple, `#E8A838` gold, `#4ECDC4` teal, `#F87171` red
- **Depth system:** 4-layer surfaces (bg → surface1 → surface2 → surface3) for dimensional feel
- **Glows, gradients, micro-animations** — the visual soul is sacred and enhanced, never stripped

### Build to Ship

Every UI element must have working functionality connected to the database. If a feature can't be made functional, don't add the UI. Pricing tiers must gate actual features. Scrims must persist with retrievable stats. Admin controls must execute real operations.

### Technical Constraints (from CLAUDE.md)

1. **NO IIFEs in JSX** — `{(()=>{...})()}` crashes the Babel renderer
2. **GCSS block is a template literal** — do NOT touch its structure
3. **Brace balance must stay at 0** after every edit
4. **No backtick string literals inside JS functions** — use string concatenation or pre-computed helper variables. This affects template text generation (recaps, share text, season narratives). Pattern: compute strings in variables BEFORE the return statement using `"str" + var + "str"` syntax.
5. **No named function components defined inside another component's body**
6. All changes happen in `src/App.jsx` (single-file monolith)
7. **ZERO EM DASHES anywhere in user-facing content.** No `—` (em dash), no `–` (en dash) in titles, headings, body text, tooltips, meta tags, SEO, toasts, labels, or any rendered string. Use hyphens `-`, commas, periods, or rewrite the sentence. This applies to ALL screens, ALL copy, ALL generated text (recaps, narratives, share text). Non-negotiable.

### Complete Screen Function Inventory (37 functions in App.jsx)

The codebase contains 37 screen/panel functions, not 27. This spec covers ALL of them:

**Wrapper Screens (created during UX overhaul sprint):**
- `StandingsScreen` — wraps Leaderboard + HoF + Roster tabs
- `ProfileScreen` — wraps Account + Milestones + Challenges tabs
- `ClashScreen` — phase-adaptive wrapper for clash content
- `EventsScreen` — wraps Featured + Archive + Tournaments tabs

**Primary Screens (covered in dedicated sections):**
- `HomeScreen` (Sections 3-4), `BracketScreen` (Section 9), `ResultsScreen` (Section 9)
- `LeaderboardScreen` (Section 5), `HofScreen` (Section 5), `RosterScreen` (Section 5)
- `AccountScreen` (Section 6), `MilestonesScreen` (Section 6), `ChallengesScreen` (Section 6)
- `ArchiveScreen` (Section 8), `TournamentsListScreen` (Section 8), `FeaturedScreen` (Section 8)
- `FlashTournamentScreen` (Section 8), `TournamentDetailScreen` (Section 8)
- `PlayerProfileScreen` (Section 7), `SeasonRecapScreen` (Section 7.2)
- `ScrimsScreen` (Section 10), `PricingScreen` (Section 11)
- `RulesScreen` (Section 12), `FAQScreen` (Section 13)
- `AdminPanel` (Section 16), `HostApplyScreen` (Section 17), `HostDashboardScreen` (Section 17)
- `SignUpScreen` (Section 18), `LoginScreen` (Section 18)
- `GearScreen` (Section 20), `PrivacyScreen` (Section 21), `TermsScreen` (Section 21)

**Panels (existing, accounted for):**
- `LiveStandingsPanel` — used within ClashScreen live phase (Section 9). Keep and enhance with animations.
- `ScrimAccessPanel` — access gate for ScrimsScreen. Keep as-is.
- `TickerAdminPanel` — ticker management within AdminPanel. Keep, covered by Section 16 Announcement System.
- `AICommentaryPanel` — auto-generated match commentary. **Decision: Keep and integrate into Clash Results phase and Recap system.** Feed its output into the narrative engine described in Section 9.
- `ReferralPanel` — referral/invite system. **Decision: Keep. Enhance with proper referral tracking in DB.** Add to Profile screen as a compact "Invite Friends" card. Referral data stored in `referrals` table.

**Net-New Components (must be created):**
- `OnboardingFlow` — Section 18 (new component, ~150 lines)
- `BroadcastOverlay` — Section 15 (new component + new route, ~200 lines)
- `PlayerComparisonModal` — Section 7.1 (new modal, ~100 lines)

---

## 2. Visual Enhancements (Applied Globally)

These patterns apply across ALL screens:

### Number Animations
- Stats count up when entering viewport (odometer effect)
- Position change deltas animate in with elastic bounce
- ELO/points changes use the FACEIT-style "watching your number move" feel

### Delta Indicators Everywhere
- Every stat shows its change: "+3" in green, "-2" in red
- Position arrows with numbers (green up, red down)
- "Since last clash" as the default comparison timeframe

### Sparklines
- Tiny inline line charts (60x20px) showing last 5 clash placements
- Used in leaderboard rows, profile cards, player comparisons
- Color: purple line on transparent background

### Card Hover States
- Subtle Y-translate (-2px to -4px) + border color shift
- Never opacity changes (feels cheap)
- 150ms ease-out transition

### Depth System
| Layer | Color | Use |
|-------|-------|-----|
| Background | `#08080F` | Page background |
| Surface 1 | `#111827` | Primary cards/panels |
| Surface 2 | `#1A2235` | Elevated cards, modals, hover states |
| Surface 3 | `#1F2937` | Active states, selected items |

### Responsive Behavior
- Desktop: Multi-column layouts, side-by-side comparisons
- Tablet: 2-column, sidebars collapse to tabs
- Mobile: Single column, tables transform to cards, swipeable tabs
- NEVER horizontally scroll tables on mobile — transform rows to vertical stat cards

---

## 3. Guest Home Screen (Not Logged In)

**Purpose:** Marketing. Convert visitors to signups. One scroll, not three.

### Layout

**Hero section** (full-width, centered):
- Subtle animated purple/gold radial glow background
- Live status pill: "Free to compete — No paywall, ever"
- Headline (Playfair): `The COMPETITIVE TFT PLATFORM`
- Subtext: "Weekly Saturday tournaments, seasonal standings, and a permanent record of every champion crowned. Join [X] players competing this season."
- Two CTAs: "Create Free Account" (primary) / "Sign In" (ghost)
- Social proof stats row: Players | Games Played | Season Points (count-up animation)

**How It Works** (compact, 4 steps):
- Sign Up → Register & Check In → Play & Submit → Win the Crown
- Numbered step cards with icons, single row on desktop

**That's it.** No champion hero card for guests. No countdown timer. No registration forms. No stat boxes. Clean, confident, converts.

### Functionality
- "Create Free Account" → opens SignUpScreen modal
- "Sign In" → opens LoginScreen modal
- Player count is live from database

---

## 4. Logged-In Home Screen: "Your Season Dashboard"

**Purpose:** Personalized competitive dashboard. Every pixel answers: "What changed since I was last here?"

### Zone 1: The Pulse (top strip)

A compact, always-visible status bar:

| Element | Content | Behavior |
|---------|---------|----------|
| Next Clash | Countdown timer OR "LIVE — Game X/Y" with pulse | Gold during registration, glowing during live |
| Your Rank | "#2 — up 1 since Clash #47" | Rank number large, delta colored green/red |
| Points to Next | "47 pts to Challenger tier" | Progress bar toward next tier threshold |
| Action Button | Register / Check In / Watch Live (context-dependent) | Only shows when there's an action to take |

**Functionality:**
- Countdown timer reads from `tournamentState.clashTimestamp`
- Rank computed from `players` array sorted by points
- Delta computed by comparing current rank to stored `lastClashRank` field
- Tier thresholds defined in config: Champion (top 1), Challenger (top 3), Contender (top 8)
- Action button triggers `registerFromAccount()`, `handleCheckIn()`, or `setScreen("clash")` based on phase

### Zone 2: Your Story (main content)

**Season Trajectory Card** (the hero element — this is TFT Clash's "ELO number"):
- Line chart showing cumulative points across all clashes this season
- X-axis: clash numbers, Y-axis: points
- Current position marked with a glowing dot
- Projected finish shown as a dashed line extension
- Below chart: "At this pace, you'll finish the season at #2 with ~1,180 pts"

**Last Clash Result Card:**
- "Clash #47 — You finished 3rd"
- Points gained: "+18 pts" (large, green, animated count-up)
- Position change: "Moved from #3 to #2"
- Per-game breakdown: compact row showing placement per game (e.g., "2nd · 4th · 1st")

**Active Stats Row** (compact horizontal strip):
- Current streak: "3-clash top-4 streak" with flame icon if 3+
- Best finish this season: "1st (Clash #44)"
- Win rate: circular progress ring
- Consistency grade: S/A/B/C based on placement variance

**Rivalry Snapshot** (compact, not dominating — single line):
- "vs Uri: 8-5 in shared lobbies" — only shows if meaningful H2H data exists
- Clickable → opens player comparison modal

**Functionality:**
- Trajectory data: computed from `pastClashes` array, each entry has player's points
- Projected finish: linear regression from current trend
- Streak data: computed from consecutive clash results
- Consistency: standard deviation of placements → mapped to letter grade
- All data persists in Supabase `past_clashes` and `players` tables

### Zone 3: The Scene (activity feed)

**Leaderboard Movement Feed** — structured event cards, NOT a chat:
- "Zounderkite passed BingBing for #4" (with timestamp)
- "Wiwi registered for Clash #48"
- "New season record: Uri hit 890 pts"
- "Clash #48 registration open — 8/24 spots filled"

**Season Narrative** — auto-generated one-liner:
- "Levitate has held #1 for 5 consecutive clashes"
- "The race for #3 is heating up — 4 pts separate positions 3-5"
- Rotates/updates based on actual data

**Quick Actions Row:**
- Standings → `#standings`
- My Profile → `#profile`
- Flash Tournament (if upcoming) → card with countdown

**Functionality:**
- Activity feed: generated from a combination of real-time data and computed events
- Events stored in Supabase `activity_feed` table: `{type, player_id, detail, created_at}`
- Feed populates on clash result submission, registration, rank changes
- Season narrative: template-based generation from `computeStats()` data — runs client-side
- Limited to 5-8 most recent items, "See all" expands

### What's Removed from Current Home Screen
- "THE CONVERGENCE AWAITS" hero banner (guests only now)
- StatBoxes (total players, checked in, season pts, games) — redundant for logged-in users
- "How It Works" section — guests only
- Duplicate registration cards for 5 auth states — replaced by single context-aware action button
- "Join [clashName]" panel on right side — redundant with Pulse zone
- Champion hero card on home — moved to Hall of Fame where it belongs

---

## 5. Standings Screen

Three tabs: **Leaderboard** (default) | **Hall of Fame** | **Player Directory**

### Leaderboard Tab

**Tier Threshold Lines** — horizontal dividers at rank cutoffs:
- Top 1: Gold line + crown icon — "Champion Zone"
- Top 3: Purple line — "Challenger"
- Top 8: Teal line — "Contender"
- Below 8: No line, table continues

**Player Row Columns:**
| Column | Content | Style |
|--------|---------|-------|
| Position | # + delta arrow | Large number, green/red arrow with magnitude |
| Player | Name + rank badge | Clickable → player profile |
| Points | Season total | Monospace, tabular-lining, large |
| Sparkline | Last 5 clashes trend | 60x20px line chart |
| Wins | Win count | Gold if > 0 |
| Avg | Average placement | Color-coded: green < 4.0, gold < 3.0 |
| Last | Most recent clash result | Compact: "2nd" |

**Your Row:** Always highlighted with purple left border + subtle glow. If scrolled past, pinned at bottom of viewport.

**Row Expand (click/tap):**
- Placement distribution bar (visual histogram of 1st-8th finishes)
- Best finish, current streak, season trajectory mini-chart
- "View Profile" and "Compare" buttons

**Functionality:**
- All data computed from `players` array + `pastClashes`
- Sparkline data: last 5 entries from player's clash history
- Delta: compared to stored position from previous clash
- Tier thresholds: configurable in `seasonConfig` (defaults: 1, 3, 8)
- Sort by: points (default), wins, avg placement, recent form
- Search/filter bar at top

### Hall of Fame Tab

**Ceremonial trophy case.** Past season champions with full stats.

- Each champion gets a portrait card: name, season, final points, wins, avg placement
- Gold border, Playfair Display name, crown icon
- Current season champion (SEASON_CHAMPION) gets a hero card at top with glow
- Below: chronological list of all past champions
- This is the prestige page — generous spacing, gold everywhere

**Functionality:**
- Champions data from Supabase `seasons` table: `{season_name, champion_id, champion_stats, end_date}`
- Current champion from `SEASON_CHAMPION` constant / `seasonConfig`

### Player Directory Tab

- Clean searchable roster of all players
- Each row: name, Riot ID, rank badge, region, season points
- Search by name or Riot ID
- Filter by rank tier
- Click → player profile

**Functionality:**
- Data from `players` array
- Search is client-side filtering (small dataset)

---

## 6. Profile Screen

Three tabs: **Account** (default) | **Milestones** | **Challenges**

### Account Tab — Your Competitive Passport

**Profile Header:**
- Avatar / initials circle
- Username + Riot ID
- Current rank badge (large, tier-colored glow)
- Season points + "#X of Y players"
- Member since date + total clashes played
- Social links (if set): Twitter, Discord, Twitch
- "Edit Profile" button (own profile only)

**Stats Grid (2x3 cards):**
| Stat | Display | Icon |
|------|---------|------|
| Win Rate | Circular progress ring, % center | Trophy |
| Avg Placement | Number, color-coded | Chart |
| Best Streak | Number + "active" flame if current | Flame |
| Total Wins | Number + crown | Crown |
| Top 4 Rate | Percentage bar | Target |
| Consistency | Letter grade (S/A/B/C) + subtitle | Shield |

**Placement Distribution** — THE signature data viz:
- Horizontal stacked bar showing frequency of each placement (1st-8th)
- Color-coded: gold (1st), silver (2nd), bronze (3rd), gradient for rest
- Percentages on hover/tap
- No other TFT platform shows this

**Season Trajectory Chart:**
- Larger line chart (full width) showing points over the season
- Each clash marked as a dot with placement tooltip on hover
- Trend line showing overall direction

**Recent Clashes (last 5):**
- Compact cards: clash name, date, your placement, points gained, position change
- Click to expand → full clash results

**Rivals Section (compact, below fold):**
- Top 3 most-played-against opponents
- H2H record bar (green/red proportional)
- "View all rivalries" link
- Only shows if meaningful data exists (3+ shared lobbies)

**Achievements Grid:**
- Tiered badges: Bronze / Silver / Gold / Legendary
- Locked badges show progress: "4/5 top-4 finishes for Gold Consistency"
- Visible on public profile — creates achievement envy
- Categories: Performance, Consistency, Social, Milestones

**Functionality:**
- Profile data from `players` table + `user_profiles` table in Supabase
- Stats computed by `computeStats()` + `getStats()` functions
- Placement distribution: count occurrences from `pastClashes` per-game data
- Trajectory: built from clash-by-clash points accumulation
- Achievements: evaluated client-side against criteria, stored in `player_achievements` table
- Social links: stored in `user_profiles` table, editable
- Edit profile: updates `user_profiles` via Supabase

### Milestones Tab
- Seasonal milestones with progress bars
- "Play 10 clashes" / "Reach 500 points" / "Win 3 clashes" etc.
- Each milestone: title, description, progress bar, reward description
- Completed milestones show checkmark + date earned
- Functionality: milestones defined in `seasonConfig`, progress computed from player stats, completions stored in `player_milestones` table

### Challenges Tab
- Weekly/monthly challenges that refresh
- "Finish top 2 in your next clash" / "Improve your avg placement by 0.5" etc.
- Active challenges with deadline countdown
- Completed challenges with XP/badge rewards
- Functionality: challenges generated weekly from templates, stored in `challenges` table, completions tracked in `player_challenges` table

---

## 7. Player Profile Screen (Click-Through)

Accessed by clicking any player name anywhere in the app.

**Same layout as Account tab profile** but:
- No edit controls
- **"Compare" button** at top → opens comparison modal (see Section 7.1)
- **H2H record with you** prominently displayed if shared lobbies exist
- **"Shared Clashes" section** — every clash both of you participated in, both placements shown side by side
- Their achievement grid visible (creates "they have badges I don't" motivation)

### 7.1 Player Comparison Modal

Slide-up modal, two columns: **You** on left, **Them** on right.

| Row | Your Value | Their Value |
|-----|-----------|-------------|
| Rank | #2 | #4 |
| Points | 1024 | 890 |
| Win Rate | 62% (ring) | 55% (ring) |
| Avg Placement | 2.8 | 3.4 |
| Wins | 16 | 12 |
| Consistency | A | B |
| Best Streak | 5 | 3 |

- Sparklines overlaid on same chart (your color vs their color)
- Placement distributions stacked for comparison
- H2H record as modal header: "Levitate vs Uri — 8-5 in 13 shared lobbies"
- Highlight winning stat in each row (subtle green background)

**Functionality:**
- All data computed client-side from existing `players` + `pastClashes` data
- H2H computed by `computeH2H()` function (already exists)
- Modal state managed in parent component

---

## 8. Events Screen

Three tabs: **Featured** (default) | **Archive** | **Tournaments**

**Note:** This overrides the UX overhaul spec which had Archive as default. Featured-first is correct — the platform should feel forward-looking, not backward-looking. Route `#events` now maps to Featured tab.

### Featured Tab (default — forward-looking)

**Hero Event Card** — next big event:
- Large card with event name, date, countdown, format, player count
- Register CTA button
- Purple/gold gradient border glow

**Upcoming Events List:**
- Next 3-4 scheduled events (clashes + flash tournaments)
- Each: name, date/time, format, spots remaining, status badge
- Click to expand or navigate to detail

**Functionality:**
- Events from Supabase `tournaments` table
- Filtered by `phase IN ('upcoming', 'registration', 'check_in')`
- Ordered by date ascending
- Registration triggers `registerFromAccount()` flow

### Archive Tab

**Past clashes in reverse chronological order:**
- Each entry: clash name, date, winner (gold name + crown), your placement (highlighted), participant count
- Click to expand: full standings, per-game breakdown, recap narrative
- "View Full Results" → navigates to clash results page

**Functionality:**
- Data from Supabase `tournaments` table where `phase = 'complete'`
- Full results from `clash_results` / `past_clashes` data
- Recap generated by `generateRecap()` function

### Tournaments Tab

**Flash tournaments and special events:**
- Filter pills: Upcoming | In Progress | Completed
- Each card: name, format, date, prize info (if any), player count, register button
- Click → TournamentDetailScreen or FlashTournamentScreen

**Functionality:**
- From `tournaments` table filtered by `type = 'flash_tournament'`
- Registration via existing tournament registration flow
- Detail screens already exist

---

## 9. Clash Screen (Phase-Adaptive)

Already built in Sprint 2. Enhancements for this overhaul:

### Registration Phase Enhancements
- Registered players list shows rank badges and sparklines
- "Scouting" preview — see registered opponents' recent form (inspired by League Clash)
- Projected lobby composition based on current registrants

### Live Phase — "Saturday Night Electric"
When a clash is live, the entire app shifts:
- Nav item glows gold with pulse animation
- Home screen Pulse zone shows live game status
- Lobby cards pulse with status colors (green locked, amber in-game, purple awaiting)
- Standings table animates on every update — rows slide to new positions
- Swiss reseed indicator between game pairs (compact, max 60px)

### Results Phase Enhancements
- "Your Finish" card with animated reveal (count up to your placement)
- Per-game breakdown with placement in each game
- Clash awards: auto-generated from data (Comeback King, Mr. Consistent, etc.)
- "Share to Twitter" button (see Section 14)
- Full recap narrative from `generateRecap()`

---

## 10. Scrims Screen (Admin/Invited Only)

**The practice room.** Different energy from the main platform — more "back room grind" than ceremonial.

### Scrim Lobby Creator
- Select players from roster (checkboxes)
- Set number of games
- Optional: tag with purpose ("Practicing comps for Clash #48")
- "Create Scrim" → saves to database

### Active/Recent Scrims
- List of scrim sessions: date, players, games played, status (active/completed)
- Click to expand: full results, per-game placements, scrim-specific standings

### Scrim Standings
- Separate from official season standings
- Same format: points, placements, sparklines
- Filter by date range
- "All-time scrim stats" vs "This month"

### Scrim Detail View
- Per-game results entry (same flow as clash results)
- Running standings within the scrim session
- MVP indicator per game

**Functionality — ALL persisted to Supabase:**

Tables needed:
```
scrims: {id, name, created_by, created_at, status, notes, tag}
scrim_players: {scrim_id, player_id}
scrim_games: {id, scrim_id, game_number, status, created_at}
scrim_results: {scrim_game_id, player_id, placement, points}
```

- Create scrim → inserts into `scrims` + `scrim_players`
- Submit results → inserts into `scrim_results` with standard TFT point values
- Standings computed from `scrim_results` aggregation
- All-time scrim stats: aggregate across all scrims per player
- Access control: `scrims.created_by` must be admin, or player must be in `scrim_players`

---

## 11. Pricing Screen

**Three tiers with REAL feature gating:**

### Player (Free)
- Compete in every clash — no paywall ever
- Full standings and leaderboard access
- Basic profile (stats, placement history, achievements)
- View all results and recaps

### Pro ($4.99/mo)
- **Everything in Free, plus:**
- **Enhanced stats:** Consistency grade, projected finish, detailed placement distribution, advanced sparklines
- **Pro badge on profile** — visible to everyone (the flex)
- **Priority registration** — if clash is near capacity, Pro users get guaranteed spot before waitlist
- **Extended history** — full career stats across all seasons (free sees current season only)
- **Custom profile banner** — upload a banner image for your profile
- **Detailed comparison tool** — side-by-side player comparison with advanced metrics
- **Weekly email digest** — personalized stats + upcoming clash reminder

### Host ($19.99/mo)
- **Everything in Pro, plus:**
- **Create custom tournaments** — full tournament creation wizard
- **Branded tournament pages** — your logo, your accent color, your banner
- **Host dashboard** — analytics, player management, revenue overview
- **Custom rules** — modify points system, formats, lobby sizes for your events
- **API access** — embed standings/brackets on your own site
- **Priority support** — dedicated support channel

**Functionality — Feature Gating Implementation:**

```
user_subscriptions: {user_id, tier ('free'|'pro'|'host'), stripe_customer_id, stripe_subscription_id, status, current_period_end}
```

- Tier check function: `getUserTier(userId)` → queries `user_subscriptions`
- Feature flags per tier defined in a `TIER_FEATURES` constant
- UI conditionally renders enhanced features based on tier
- Gated features show a subtle "Pro" badge with upgrade prompt when clicked by free users
- **Payment provider TBD** — Stripe is the likely choice but not yet set up. Could be Stripe, Paddle, LemonSqueezy, or other.
- **Build the tier system NOW, wire payment later.** The entire feature gating, UI, and subscription management works via the `user_subscriptions` table regardless of which payment provider is used.
- Admin can manually set tiers via `user_subscriptions` table or admin panel for testing/beta users
- When payment provider is chosen: add Edge Function for webhook handling + checkout session creation (secret keys stay server-side, never in App.jsx)
- Grace period: 3 days after expiration before downgrading features

**Pricing Page Layout:**
- Three cards side by side
- Player: clean, functional
- Pro: purple border glow, slight elevation — the recommended tier
- Host: gold border — the premium tier
- Feature comparison table below
- "Free to compete, always" banner at bottom
- FAQ accordion for pricing questions

---

## 12. Rules Screen

**Structured, scannable, not a wall of text.**

### Quick Reference Card (top)
Three things you need to know:
1. Points system (1st=8, 2nd=7, ... 8th=1)
2. Check-in deadline (60 min before start)
3. How to submit results (two-click confirmation)

### Accordion Sections
Each section collapsible with icon:

1. **Tournament Format** — Weekly clashes, game count, lobby structure
2. **Points System** — The table, color-coded (gold 1st, silver 2nd, bronze 3rd)
3. **Tiebreakers** — Numbered priority list with clear hierarchy
4. **Registration & Check-in** — Deadlines, waitlist rules, no-show policy
5. **Result Submission** — Two-click flow, disputes, admin override
6. **Swiss Reseeding** — When it triggers, how snake-seed works
7. **Code of Conduct** — Behavior expectations, penalty structure
8. **Disputes & Appeals** — How to dispute, admin review process

### Search
- Search bar at top filters sections and highlights matching text
- Keyboard shortcut: Ctrl+K or /

**Functionality:**
- Rules content stored as structured data (not hardcoded JSX)
- Could later be admin-editable via host dashboard
- Points table rendered from `PTS` constant

---

## 13. FAQ Screen

- Grouped by category: Getting Started | Tournaments | Scoring | Account | Technical
- Accordion expand/collapse per question
- Search bar with real-time filtering
- "Still have questions?" CTA → Discord invite link
- Clean, functional — no flash needed

**Functionality:**
- FAQ entries as structured array: `{category, question, answer}`
- Search filters on both question and answer text
- Could later be admin-editable

---

## 14. Social Sharing System

### Twitter/X Share Cards

**Flow:**
1. User clicks "Share" on a result, profile, or recap
2. System generates a shareable URL: `tftclash.gg/#share/clash-48/levitate`
3. Opens Twitter compose with pre-filled text:
   - "Finished #2 in TFT Clash #48 — 1024 season pts 🏆"
   - URL appended
4. The URL renders as an Open Graph card with:
   - Dark background with TFT Clash branding
   - Player name, placement, season rank
   - Key stats
   - "Join free at tftclash.gg" CTA

**Share Points (where share buttons appear):**
- Clash results ("Share My Result")
- Profile page ("Share Profile")
- Season recap ("Share My Season")
- Achievement earned ("Share Achievement")

**Discord Copy:**
- "Copy for Discord" button generates formatted text with link
- Includes the CTA URL back to TFT Clash

**Functionality:**
- Pre-filled tweet text constructed client-side using string concatenation (no backticks)
- Uses `window.open()` to Twitter intent URL: `https://twitter.com/intent/tweet?text=...&url=...`
- **OG card rendering requires server-side support** — a Supabase Edge Function at `/share/:type/:id/:player` returns static HTML with OG meta tags for social crawlers (Twitter, Discord). The Edge Function reads player/clash data from DB and returns a minimal HTML page with `<meta property="og:image">` etc. This is the ONLY way to get rich preview cards in a client-side SPA.
- Fallback if Edge Function is not yet deployed: share works as plain text link without rich card preview. Still functional, just less pretty.
- Share URL format: `tftclash.gg/share/clash/48/levitate` (not hash route — must be a real URL path for OG crawlers)

---

## 15. Broadcast / OBS Mode

**Status: NET-NEW FEATURE** — No existing component. Requires new `BroadcastOverlay` function (~200 lines), new `#broadcast` route handler in the root component, and Supabase real-time subscription. Complexity: Medium.

**Route:** `#broadcast` with query params

### Standings Overlay
`#broadcast?type=standings&clash=48`
- Clean, chromeless standings table
- Dark background (configurable: solid or transparent)
- Auto-updates in real-time as results come in
- Shows: position, player name, points, delta
- "LIVE — Game X of Y" header
- TFT Clash logo watermark (small, corner)
- Designed to fit in a stream layout corner (400x600px default)

### Lobby Card Overlay
`#broadcast?type=lobbies&clash=48`
- Current lobby assignments for active game
- Player names grouped by lobby
- Status indicators (in game, awaiting, locked)
- Perfect for between-game stream screens

### Configuration
- `&bg=transparent` or `&bg=dark` — background mode
- `&size=compact` or `&size=full` — density
- `&theme=default` or `&theme=minimal` — styling
- Auto-refresh interval: 10 seconds
- **Fallback behavior:** Invalid param values use defaults (`bg=dark`, `size=compact`, `theme=default`)

**Functionality:**
- Reads from same `tournamentState` as main app
- No auth required (public read-only view)
- Minimal JS bundle — just the overlay components + real-time subscription
- Supabase real-time subscription for live updates

---

## 16. Admin Panel

**Route:** `#admin` — admin only, hidden from non-admin users.
**The command center for running clashes. EVERY control must execute real operations.**

### Tournament Management Tab
- **Create Clash:** Name, date, time, max players, game count, format (standard/Swiss), Swiss toggle
  - Writes to `tournaments` table
- **Manage Active:** Phase controls (registration → check-in → live → complete)
  - Updates `tournaments.phase` in Supabase
  - Triggers real-time updates to all connected clients
- **Edit Tournament:** Modify details of upcoming/active tournaments
- **Lobby Management:** View/edit lobby assignments, manual player moves
  - Updates `lobbies` table
- **History:** All past tournaments with full data access

### Live Clash Controls (during active clash)
- **Advance Round:** Move to next game
  - Updates `tournaments.current_round`
- **Approve Results:** Review pending result submissions, approve/dispute/override
  - Updates `clash_games` status and placements
- **Swiss Reseed:** Trigger auto-reseed, preview new lobbies, confirm/adjust
  - Computes new assignments, writes to `lobbies`
- **Handle No-Shows:** Mark players as no-show, assign subs
  - Updates `registrations.status`
- **Emergency Controls:** Pause tournament, reset game, manual point override

### Player Management Tab
- **Roster:** Full player list with edit capabilities
  - CRUD on `players` table
- **Link Accounts:** Connect Supabase auth users to player profiles
  - Updates `players.auth_user_id`
- **Disputes:** Review and resolve disputed results
  - Updates `clash_games.status`
- **Bans/Warnings:** Issue warnings or temporary bans
  - Writes to `player_penalties` table

### Season Management Tab
- **Season Config:** Name, start/end dates, point system, tier thresholds
  - Writes to `seasons` table
- **Start/End Season:** Official season lifecycle
  - Updates season status, triggers recap generation
- **Set Champion:** Designate season champion for Hall of Fame
  - Updates `seasons.champion_id`
- **Points Override:** Manual point adjustments with reason logging
  - Writes to `point_adjustments` table with audit trail

### Announcement System
- **Ticker Messages:** Post to community ticker
  - Writes to `announcements` table
- **Push Notifications:** Send important updates
- **Scheduled Posts:** Pre-schedule announcements

### Analytics Tab
- Registration numbers per clash (trend chart)
- Check-in rates
- Completion rates
- Player retention (returning players per clash)
- Growth metrics

**Functionality:**
- All actions write to Supabase with proper RLS (Row Level Security)
- Admin-only access enforced both client-side and via Supabase RLS policies
- Audit logging: every admin action logged with timestamp and admin user ID
- Real-time: admin changes propagate instantly to all connected clients via Supabase real-time

---

## 17. Host System

### Host Apply Screen (logged-in users)

**Application form:**
- Community name
- Discord server link
- Estimated player count
- Experience running tournaments (dropdown)
- Why they want to host (text)
- Submit → writes to `host_applications` table

**Post-submission:**
- Status tracker: Applied → Under Review → Approved / Rejected
- Status reads from `host_applications.status`

### Host Dashboard (approved hosts only)

**Tournament Creation Wizard:**
1. Basic Info: name, date, time, description
2. Format: standard / Swiss / custom, game count, max players
3. Branding: upload logo, set accent color, custom banner
4. Rules: use default or customize points system
5. Review & Create

**Active Tournaments:**
- List with live status, registrations, phase controls
- Same phase management as admin but scoped to host's tournaments only

**Analytics:**
- Participation trends for host's events
- Player retention across their tournaments
- Popular formats

**Branding Controls:**
- Logo upload (stored in Supabase Storage)
- Accent color picker
- Banner image
- Custom welcome message

**Player Management:**
- Registered players for their events
- Waitlist management
- Communication tools (announcement to registered players)

**Functionality:**
```
host_profiles: {user_id, community_name, discord_link, logo_url, accent_color, banner_url, status, approved_at}
host_tournaments: standard tournaments table with host_id foreign key
```
- Hosts can only manage their own tournaments (RLS policy)
- Branding assets stored in Supabase Storage bucket
- Host dashboard reads from same `tournaments` table but filtered by `host_id`

---

## 18. Onboarding Flow (Post-Signup)

**Goal:** Get a new user from signup to "I'm competing Saturday" in under 60 seconds. Create immediate emotional investment. The principle: **the tutorial IS the game** — don't explain, then let them use it. Let them use it and explain as they go.

**Flow:** `Signup → Welcome Cinematic → Link Riot ID → Your Player Card → Home (warm)`

### Screen 1: Signup (Streamlined)

Remove the current 2-step signup. Collect ONLY credentials:
- Discord OAuth button (primary, top)
- Divider: "or with email"
- Email, Username, Password
- Social proof: "[X] players competing this season" (live from DB)

After submit → don't dump on home. Transition to Screen 2.

### Screen 2: "The Welcome Moment" (3-4 seconds, auto-advances)

**This is the emotional peak.** Full-screen dark background. TFT Clash logo pulses with purple glow. Username types out letter-by-letter in gold (#E8A838) with typewriter effect:

```
Welcome, Levitate.

Season 3 has begun.
Your story starts now.
```

Subtle shimmer/particle effect. Single button fades in:

```
[ Enter the Arena → ]
```

**Why:** This is the Valorant agent-select moment. Takes 3 seconds, transforms "I filled out a form" into "I joined a competitive league." Pure CSS animation — opacity transitions, typewriter keyframes, existing glow effects.

### Screen 3: "Link Your Riot ID" (focused single-purpose)

Clean, centered. One input field.

```
Link Your Riot ID
So we can track your placements and build your legacy.

[ Name#TAG                    ]
[ Region: EUW ▼               ]

[ Link Account → ]

                    Skip for now
```

- Real-time format validation (Name#TAG)
- Green check + "Linked. You're ready to compete." on success
- Region defaults to EUW
- "Skip for now" is small, gray — works but discouraged
- If skipped: persistent but dismissible banner on home later
- Writes to `user_profiles.riot_id` + `user_profiles.region`

### Screen 4: "Your Player Card" (the identity reveal)

Shows a mini profile card — already populated:

```
┌──────────────────────────────────┐
│  [Rank Badge]  UNRANKED          │
│                                  │
│  Levitate                        │
│  Levitate#EUW · EUW             │
│                                  │
│  Season 3 · 0 pts · 0 clashes   │
│  ────────────────────            │
│  Next Clash: Saturday 20:00 CET  │
│  Status: Not yet registered      │
│                                  │
│  "Every champion started here."  │
└──────────────────────────────────┘

    [ See the Leaderboard ]
    [ Register for Clash #48 → ]
```

**Why:** The Duolingo "streak of 1" moment. You're not looking at an empty profile — you're looking at YOUR CARD. The "0 pts, 0 clashes" creates natural desire to fill it. Two CTAs give agency: explore or commit. Both are wins.

### Screen 5: Home Dashboard (with first-time banner)

One-time dismissible welcome banner at top:

```
Welcome to TFT Clash, Levitate!
Your first clash is Saturday at 20:00. Register to lock in your spot.
[ Register for Clash #48 ]  [ Dismiss × ]
```

After dismissal → never shows again.

### What to Defer (prompted contextually later)
- **Bio** → prompt when they first visit their own profile
- **Social links** → prompt in account settings after first clash
- **Avatar** → prompt after first week
- **Discord join** → prompt after first clash completion

**Functionality:**
- Signup becomes credentials-only (remove step 2 from current `SignUpScreen`)
- New `OnboardingFlow` component renders when `showOnboarding` state is true
- Each screen advances with button or auto-timer
- On completion: set `onboarding_complete` in `user_profiles` + localStorage
- Riot ID collection moved from signup form into onboarding Screen 3
- If skipped: `riot_id_pending: true` in user_profiles, shows nudge bar
- Onboarding state tracked in `user_profiles.onboarding_step` — resumable if dropped
- Player card quote rotates: "Every champion started here." / "Season 3. Game 1. Let's go." / "The leaderboard is waiting."

---

## 19. Notification Strategy

**No bell icon. No notification center. The home dashboard IS the notification.**

### In-App (The Pulse + Activity Feed)
- Position changes surface in Zone 1 (The Pulse)
- Activity feed in Zone 3 (The Scene) shows what happened
- Toast notifications for real-time events during active session (result confirmed, position change)

### Email Digest (Weekly, Thursday/Friday)
**One email, high value:**
- "Clash #48 is Saturday at [time]"
- Your current rank + who's close to you
- Position changes since last clash
- Any achievements nearly unlocked
- One-click register button in email
- Unsubscribe link (required)

**Functionality:**
- Email via Supabase Edge Functions + email provider (Resend, Postmark, or similar)
- Scheduled via cron: runs Thursday evening
- Template populated with per-user data
- Opt-in/opt-out stored in `user_profiles.email_notifications`
- Only send if user has been active in last 30 days

### Push Notifications (Future — not MVP)
- Time-sensitive only: "Clash starts in 1 hour", "Results posted"
- Requires service worker / PWA setup
- Deferred to future sprint

---

## 20. Gear Screen

- Grid of product cards: image, name, description, price, external link
- Categories: Merch (if applicable), Partner Gear, Recommended
- Clean cards matching the platform aesthetic
- External links open in new tab

**Functionality:**
- Products stored in Supabase `gear_items` table: `{name, description, image_url, price, external_url, category, sort_order}`
- Admin can add/edit/remove items
- Simple CRUD, no payment processing (external links)

---

## 21. Privacy & Terms Screens

- Clean, readable legal text on dark background
- Heading hierarchy with anchor links
- Table of contents for navigation
- "Last updated: [date]" at top
- Matches platform aesthetic — no jarring white backgrounds

**Functionality:**
- Content can be stored as markdown in Supabase or hardcoded
- No dynamic functionality needed beyond rendering

---

## 22. "More" Menu

**Desktop:** Dropdown panel from nav
**Mobile:** Full-screen slide-over

**Items (contextual visibility):**

| Item | Icon | Description | Visibility |
|------|------|-------------|------------|
| Scrims | Swords | Practice lobbies | Admin + invited |
| Pricing | Diamond | Plans & features | All |
| Rules | Book | Tournament rules | All |
| FAQ | Help circle | Common questions | All |
| Host | Crown | Apply or manage | Logged in |
| Gear | Shopping bag | Merch & gear | All |
| Admin | Shield | Control panel | Admin only |

Each item: icon + name + subtle description line.

---

## 23. Database Schema Requirements

### New Tables Needed

```sql
-- Activity feed for home dashboard
activity_feed (id, type, player_id, detail_json, created_at)

-- Scrim system
scrims (id, name, created_by, created_at, status, notes, tag)
scrim_players (scrim_id, player_id)
scrim_games (id, scrim_id, game_number, status, created_at)
scrim_results (scrim_game_id, player_id, placement, points)

-- Subscription/pricing
user_subscriptions (user_id, tier, provider, provider_customer_id, provider_subscription_id, status, current_period_end)
-- provider: 'manual'|'stripe'|'paddle'|'lemonsqueezy' etc. Start with 'manual' for admin-assigned tiers

-- Achievements
player_achievements (player_id, achievement_id, earned_at, progress)

-- Challenges
challenges (id, title, description, criteria_json, start_date, end_date, reward)
player_challenges (player_id, challenge_id, progress, completed_at)

-- Milestones
player_milestones (player_id, milestone_id, progress, completed_at)

-- Host system
host_applications (user_id, community_name, discord_link, player_count, experience, reason, status, applied_at, reviewed_at)
host_profiles (user_id, community_name, logo_url, accent_color, banner_url, status)

-- Point adjustments audit trail
point_adjustments (id, player_id, admin_id, amount, reason, created_at)

-- Gear
gear_items (id, name, description, image_url, price, external_url, category, sort_order)

-- Seasons
seasons (id, name, start_date, end_date, champion_id, config_json, status)

-- Player penalties
player_penalties (id, player_id, admin_id, type, reason, expires_at, created_at)

-- Announcements (ticker + notifications)
announcements (id, type, message, created_by, scheduled_at, created_at, expires_at)

-- Admin audit log (every admin action)
admin_audit_log (id, admin_id, action, target_table, target_id, detail_json, created_at)

-- Referrals
referrals (id, referrer_id, referred_id, status, created_at)
```

### Existing Tables (must already exist — document for reference)

These tables are referenced throughout the spec and must exist in Supabase:

```sql
-- Already in use (verify schema matches)
tournaments (id, name, date, phase, type, max_players, current_round, total_games, host_id, branding_json, ...)
registrations (tournament_id, player_id, status, checked_in_at)
clash_games (id, tournament_id, game_number, status, submitted_by, confirmed_by, ...)
lobbies (id, tournament_id, game_number, name, players_json, reseed_round)
players (id, name, riot_id, pts, wins, games, auth_user_id, last_clash_rank, consistency_grade, ...)
user_profiles (user_id, username, riot_id, region, bio, onboarding_step, onboarding_complete, email_notifications, banner_url, social_twitter, social_discord, social_twitch, tier_override)
past_clashes (id, tournament_id, results_json, recap_json, ...)
```

### Existing Tables to Extend

```sql
-- user_profiles: add columns
onboarding_step, onboarding_complete, email_notifications, banner_url, bio, social_twitter, social_discord, social_twitch, tier_override

-- players: add columns
last_clash_rank, consistency_grade  -- consistency_grade is a cached value, recalculated after each clash completes

-- tournaments: add columns
host_id, branding_json
```

---

## 24. Implementation Priority

### Phase 1: Core Dashboard & Identity (highest impact)
1. Logged-in home screen overhaul (3 zones)
2. Guest home screen cleanup
3. Standings with tier lines, sparklines, deltas
4. Profile overhaul with stats grid, placement distribution, trajectory
5. Player comparison modal

### Phase 2: Competitive Features
6. Pricing page with Stripe integration + feature gating
7. Achievement/milestone system with DB persistence
8. Activity feed with real-time events
9. Onboarding flow

### Phase 3: Community & Tools
10. Scrims with full DB persistence
11. Host dashboard enhancements
12. Broadcast/OBS mode
13. Social sharing (Twitter cards)

### Phase 4: Admin & Polish
14. Admin panel with all working controls
15. Rules/FAQ restructure
16. Email digest system
17. Weekly challenges system
18. Final animation pass + mobile responsive polish

---

## 25. Success Criteria

- [ ] Logged-in home screen shows personalized dashboard (rank, trajectory, last result, activity feed)
- [ ] Guest home screen converts (clean hero, CTA, social proof — no clutter)
- [ ] Every stat shows a delta/change indicator
- [ ] Sparklines appear on leaderboard rows and profile
- [ ] Tier threshold lines visible on leaderboard
- [ ] Placement distribution chart on profiles
- [ ] Player comparison modal works with H2H data
- [ ] Pricing tiers gate actual features via `user_subscriptions`
- [ ] Scrims persist to DB with retrievable stats and standings
- [ ] Admin panel controls execute real DB operations
- [ ] All new features write to and read from Supabase
- [ ] Broadcast mode renders standalone overlay at `#broadcast`
- [ ] Twitter share generates proper intent URL with formatted text
- [ ] Onboarding flow completes in under 60 seconds
- [ ] No placeholder buttons — every clickable element has functionality
- [ ] Mobile responsive on all new/changed screens
- [ ] Animation pass: count-up numbers, stagger rows, card hovers, live pulses
- [ ] Visual soul preserved: glows, gradients, Playfair headings, depth layers
