# TFT Clash UX Overhaul — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Author:** Claude + Levitate
**Context:** The previous UI overhaul made the app dull and broke navigation clarity during clashes. This spec defines the redesign from the reverted pre-overhaul state (`cb0d25a`, 18,190-line `App.jsx`).

---

## 1. Goals

1. **Navigation clarity** — always know where you are, especially during live clashes
2. **Phase-adaptive Clash screen** — one screen that morphs based on tournament state
3. **Screen consolidation** — reorganize 27 screen functions into a cleaner nav structure without losing any functionality
4. **Killer features** — 5 features no other TFT platform has
5. **Protect the soul** — glows, gradients, animations, color pops on dark canvas stay sacred

### Non-Goals

- Full code architecture rewrite (stays as single-file React monolith for now)
- Mobile app (responsive web only)

---

## 2. Visual Identity (Protected)

These visual elements are locked and must be preserved or enhanced in every change:

| Element | Rule |
|---------|------|
| **Glows / light effects** | Radial glows behind cards, box-shadow pulses on live elements |
| **Gradient depth** | Multi-stop gradients on accents, borders, backgrounds |
| **Micro-animations** | Fade-up on mount, slide-in on rows, hover transforms on cards |
| **Color pops on dark** | `#08080F` bg, `#111827` panels, `#9B72CF` purple, `#E8A838` gold, `#4ECDC4` teal, `#F87171` red |
| **Stats density** | Numbers, deltas, position arrows — the data IS the decoration |
| **Typography** | Playfair Display (headings), Barlow Condensed (labels/badges), Inter (body) — unchanged |

### Icon System
Tabler Icons (already migrated). Use consistently across all screens.

---

## 3. Navigation Architecture

### Complete Screen Inventory (27 functions in App.jsx)

Every screen function in the codebase is accounted for below:

| Screen Function | Destination | How |
|-----------------|-------------|-----|
| HomeScreen | **Home** | Unchanged — primary nav |
| BracketScreen | **Clash** | Phase-adaptive: renders as registration/live phase content |
| ResultsScreen | **Clash** | Phase-adaptive: renders as results phase content |
| LeaderboardScreen | **Standings** | Tab: "Leaderboard" (default tab) |
| HofScreen | **Standings** | Tab: "Hall of Fame" |
| RosterScreen | **Standings** | Tab: "Player Directory" |
| AccountScreen | **Profile** | Tab: "Account" (default tab) |
| MilestonesScreen | **Profile** | Tab: "Milestones" |
| ChallengesScreen | **Profile** | Tab: "Challenges" |
| ArchiveScreen | **Events** | Tab: "Archive" (default tab) |
| TournamentsListScreen | **Events** | Tab: "Tournaments" |
| FeaturedScreen | **Events** | Tab: "Featured" |
| FlashTournamentScreen | **Events** | Click-through from Tournaments tab (not a tab itself) |
| TournamentDetailScreen | **Events** | Click-through from Tournaments tab (not a tab itself) |
| ScrimsScreen | **Scrims** | Unchanged — More menu (admin/invited only) |
| PricingScreen | **Pricing** | Unchanged — More menu |
| RulesScreen | **Rules** | Unchanged — More menu |
| FAQScreen | **FAQ** | Unchanged — More menu |
| HostApplyScreen | **Host** | More menu — visible to logged-in users |
| HostDashboardScreen | **Host** | More menu — visible to approved hosts |
| PlayerProfileScreen | **Player Profile** | Click-through only (not in nav) — accessed from standings/roster/H2H |
| SeasonRecapScreen | **Season Recap** | Click-through only — accessed from Profile or end-of-season |
| SignUpScreen | **Auth** | Modal/overlay — not a nav item |
| LoginScreen | **Auth** | Modal/overlay — not a nav item |
| GearScreen | **Gear** | More menu |
| PrivacyScreen | **Privacy** | Footer link |
| TermsScreen | **Terms** | Footer link |

**Key rule:** All 27 screen functions remain in the codebase. Merged screens wrap existing functions as tab content. No code is thrown away.

### Complete Hash Route Table

| Route | Screen | Notes |
|-------|--------|-------|
| `#home` | HomeScreen | Default route |
| `#clash` | ClashScreen (phase-adaptive) | Auto-selects phase |
| `#clash/register` | ClashScreen → Registration | Direct link to registration |
| `#clash/live` | ClashScreen → Live | Direct link to live view |
| `#clash/results` | ClashScreen → Results | Direct link to results |
| `#standings` | StandingsScreen → Leaderboard | Default tab |
| `#standings/hof` | StandingsScreen → Hall of Fame | |
| `#standings/roster` | StandingsScreen → Player Directory | |
| `#profile` | ProfileScreen → Account | Default tab |
| `#profile/milestones` | ProfileScreen → Milestones | |
| `#profile/challenges` | ProfileScreen → Challenges | |
| `#events` | EventsScreen → Archive | Default tab |
| `#events/tournaments` | EventsScreen → Tournaments | |
| `#events/featured` | EventsScreen → Featured | |
| `#events/tournament/:id` | TournamentDetailScreen | Click-through |
| `#events/flash/:id` | FlashTournamentScreen | Click-through |
| `#scrims` | ScrimsScreen | Admin/invited only |
| `#admin` | AdminPanel | Admin only |
| `#pricing` | PricingScreen | |
| `#rules` | RulesScreen | |
| `#faq` | FAQScreen | |
| `#host/apply` | HostApplyScreen | Logged-in users |
| `#host/dashboard` | HostDashboardScreen | Approved hosts |
| `#player/:id` | PlayerProfileScreen | Click-through |
| `#recap` | SeasonRecapScreen | Click-through |
| `#gear` | GearScreen | |
| `#signup` | SignUpScreen | Auth flow |
| `#login` | LoginScreen | Auth flow |
| `#privacy` | PrivacyScreen | Footer |
| `#terms` | TermsScreen | Footer |

### Context-Aware Nav States

The nav adapts based on `tournamentState.phase` from the database. All screens remain accessible — only the **primary** nav items change. Secondary items live in the "More" menu.

| State | Trigger | Primary Nav Items | Clash Item Appearance |
|-------|---------|-------------------|----------------------|
| **Default** (between clashes) | `phase === null` or no active tournament | Home, Standings, Events, Profile, More | Not shown in primary nav |
| **Registration Open** | `phase === 'registration'` (set by admin when creating clash) | Home, Clash · Register, Standings, Profile, More | Gold highlight + "Register" badge |
| **Live Clash** | `phase === 'live'` (set by admin when starting first game) | Home, LIVE CLASH, Standings, Profile, More | Glowing pulsing gold button, Events hidden |
| **Post-Clash** (results) | `phase === 'complete'` (auto-set when final game results confirmed) | Home, Clash · Results, Standings, Profile, More | Teal "Results" badge, reverts to Default when next clash is created |

**"More" menu contents:** Scrims (admin/invited), Pricing, Rules, FAQ, Host Apply/Dashboard, Gear, Admin (admin only)

### Mobile Bottom Bar

4-tab bottom bar mirrors desktop primary nav + hamburger for "More":
`Home | Clash | Standings | Profile | More`

Same context-aware behavior — Clash icon glows gold when live, shows dot indicator for new results.

---

## 4. Phase-Adaptive Clash Screen

One component that renders different content based on `tournamentState.phase`. No tabs — the phase IS the screen.

### 4.1 Registration Phase

- **Event info card:** Name, date/time, countdown timer (gold `#E8A838`)
- **Register Now button:** Purple gradient CTA
- **Registered players list:** Avatar + name + Riot ID, scrollable, shows count (e.g., "14/24")
- **Phase accent:** Purple (`#9B72CF`)

### 4.2 Live Phase

- **Phase header:** "Live — Game X of Y" with amber accent, round info
- **Lobbies overview:** Grid of lobby cards (3-col on desktop, stack on mobile)
  - Each lobby card shows: name, status badge (LOCKED/IN GAME/AWAITING), player list
  - Color-coded borders: green (locked), amber (in game), purple (awaiting)
  - Click to expand for full details + result submission
- **Live standings table:** After each game, shows cumulative points
  - Position, player name, points, delta, position change arrows (green up / red down)
  - Champion row gets gold left border + crown icon
  - Animated slide-in on data update
- **Phase accent:** Gold (`#E8A838`) with glow effects

### 4.3 Results Phase

- **Final standings table:** Full leaderboard with crown on 1st, silver on 2nd, bronze on 3rd
- **"Your finish" highlight row:** Purple left border, shows logged-in user's placement
- **Per-game breakdown:** Expandable section showing placement per game
- **Clash awards:** (see §5.5 Auto Recap)
- **Share buttons:** Discord copy-paste, share card
- **Phase accent:** Teal (`#4ECDC4`)

### Swiss Reseed Indicator (within Live Phase)

When Swiss Mode is active, display a compact reseed notification between game pairs:

- Appears as a subtle divider between game results, not a separate large section
- Shows: "Swiss Reseed — Lobbies reorganized by standings"
- Small animation showing players shuffling between lobbies
- Must NOT dominate the live view — it's informational, not a focal point
- Max height: 60px

---

## 5. Killer Features

### Priority

| Priority | Feature | Complexity |
|----------|---------|-----------|
| **P0** | Swiss Reseeding Engine | Medium — logic + UI indicator |
| **P0** | Two-Click Result Confirmation | Medium — flow + confirmation modal |
| **P1** | Head-to-Head Records | Low — computed from existing lobby data |
| **P1** | Auto-Generated Clash Recap | Low — template-based text generation |
| **P2** | Squad / Team Mode | High — new tournament type, deferred to separate spec if Sprint 3 overflows |

### 5.1 Swiss Reseeding Engine

**What:** Automated Swiss-system lobby reseeding after every 2 games.

**How it works:**
1. Admin toggles "Swiss Mode" when creating a clash
2. After Games 1-2, system auto-sorts all players by cumulative points
3. Snake-seeds into new lobbies (1st/16th/17th → Lobby A, 2nd/15th/18th → Lobby B, etc.)
4. Admin can manually adjust after auto-seed before starting next round
5. Toggle is per-tournament — casual clashes stay static

**Data model:** Uses existing `tournamentState` object. Add:
- `tournamentState.swissMode: boolean` — toggle
- `tournamentState.lobbies[].reseedRound: number` — which reseed produced this lobby
- Reseed logic is pure frontend computation from cumulative points → no new DB tables needed for MVP. Lobby assignments stored in existing `lobbies` array.

**UI:**
- Toggle in admin tournament creation
- Compact reseed indicator between game pairs in Live phase (see §4 note)
- Lobby cards update with new assignments after reseed

### 5.2 Two-Click Result Confirmation

**What:** Any player can submit results; a second player confirms. Kills the admin bottleneck.

**Flow:**
1. Game ends → any player in the lobby clicks "Submit Results"
2. They rank all 8 players using dropdowns (1st-8th)
3. A **different** player from the same lobby sees a "Confirm Results" prompt
4. If confirmed → points auto-calculated, standings update instantly
5. If disputed → flags for admin review with a red "Disputed" badge; admin gets a notification
6. Admin can always override any result

**Edge cases:**
- A player cannot confirm their own submission
- If no second player confirms within 10 minutes, submission stays as "Pending" and admin is notified
- Submitter can cancel and re-submit before confirmation
- If two players submit different results simultaneously, the first submission wins; second player sees "Already submitted — please confirm or dispute"

**Data model:** Uses existing game results structure. Add:
- `game.submittedBy: userId` — who submitted
- `game.confirmedBy: userId` — who confirmed (null = pending)
- `game.status: 'pending' | 'confirmed' | 'disputed'`
- Stored in existing tournament state / Supabase `clash_games` or equivalent

**UI:**
- "Submit Results" button inside expanded lobby card
- Confirmation modal with the submitted rankings for the second player
- Green checkmark animation on successful confirmation
- Dispute badge (red) if disagreement

### 5.3 Head-to-Head Records

**What:** Track rivalry stats between any two players across all shared lobbies.

**Where it shows:**
- PlayerProfileScreen → new "Rivals" section (below existing stats, not a separate tab)
- Standings screen → click two players to compare

**Data model:** Computed at render time from existing `pastClashes` data — no new DB tables. For each pair of players, scan all clashes where both were in the same lobby and compare placements.

**Data displayed:**
- Shared lobby count
- Win/loss ratio (times placed higher vs lower)
- Average placement in shared lobbies for each player
- Win bar visualization (green/red proportional bar)
- Trend over time (last 5 shared lobbies)

### 5.4 Squad / Team Mode (P2 — Deferred if Sprint 3 Overflows)

**What:** Teams of 4 share an 8-player lobby (4v4). Individual placements scored normally, team totals determine winner.

**Note:** This is the most complex killer feature. If Sprint 3 runs long, this gets deferred to a separate design spec and implementation cycle. The other 4 features are self-contained and do not depend on Squad Mode.

**How it works:**
- Admin creates a "Squad Clash" type tournament (`tournamentState.mode: 'squad'`)
- Players form or join squads during registration
- Each lobby has exactly 2 squads of 4
- Individual placements use standard points (8/7/6/5/4/3/2/1)
- Team score = sum of all 4 members' points
- Season standings track both individual and squad records

**Data model (if implemented):**
- `tournamentState.mode: 'solo' | 'squad'`
- `tournamentState.squads: Array<{id, name, captain, members: userId[]}>` — max 4 members per squad
- Existing `computeStats()` extended to also compute team totals when `mode === 'squad'`
- Squad formation happens during registration phase only
- If a squad has fewer than 4 members at clash start, admin can fill or merge squads

**UI:**
- Squad formation during registration (create/join)
- Team color coding on lobby cards and standings
- Team standings table alongside individual standings
- Separate tournament type — doesn't replace normal clashes

### 5.5 Auto-Generated Clash Recap

**What:** After every clash, the system generates a narrative recap from point data.

**What it generates:**
- Comeback stories (largest position climb)
- Consistency awards (all top-4 placements)
- Rivalry moments (close H2H in final game)
- Streak data (consecutive 1st places, etc.)
- Point deltas and dramatic position changes

**Data model:** Pure computation from existing `pastClashes` data. Template strings with player name interpolation. No new storage needed — recap is generated on-the-fly when the Results phase renders.

**UI:**
- Displayed on Home screen after clash completion
- Available in Results phase of Clash screen
- "Copy for Discord" button (formatted for Discord embeds)
- "Share Card" button (generates shareable image/link)

**Implementation:** Pure data-driven templates — no AI needed. Pattern matching on position changes, streak data, point deltas, comeback distance, consistency metrics.

---

## 6. Implementation Approach

**Hybrid Sprints with Micro-Checkpoints** — 4 sprints, each with 2-4 testable commits. User tests on dev server before each sprint is finalized.

### Sprint 1: Navigation & Structure
- Hash routing system (complete route table from §3)
- Context-aware nav component (driven by `tournamentState.phase`)
- Screen merges: Standings (Leaderboard + HoF + Roster tabs), Profile (Account + Milestones + Challenges tabs), Events (Archive + Tournaments + Featured tabs)
- Mobile bottom bar
- "More" menu with all secondary screens

### Sprint 2: Clash Night Experience
- Phase-adaptive Clash screen component
- Registration phase UI
- Live phase with lobby cards and standings
- Results phase with final standings and "your finish" card

### Sprint 3: Killer Features (P0 first, then P1, P2 if time allows)
1. Swiss reseeding engine (admin toggle + auto-reseed logic + compact UI indicator)
2. Two-click result confirmation flow
3. Head-to-head records computation and display
4. Auto-generated clash recap templates
5. Squad/team mode (P2 — defer to separate spec if sprint overflows)

### Sprint 4: Visual Soul
- Animation pass (fade-up, slide-in, hover transforms, pulse-glow)
- Gradient and glow audit on all new components
- Mobile responsive pass
- Final polish and consistency check

### Commit Strategy
- Each sprint: 2-4 commits, each independently testable
- Dev server testing between commits
- No push to remote until user approves full sprint
- Easy to revert any single commit if something breaks

---

## 7. Technical Constraints

From CLAUDE.md (must be followed in all edits):

1. **NO IIFEs in JSX** — `{(()=>{...})()}` crashes the Babel renderer
2. **GCSS block is a template literal** — do NOT convert or touch its structure
3. **Brace balance must stay at 0** after every edit
4. **No backtick string literals inside JS functions**
5. **No named function components defined inside another component's body**
6. Always verify brace balance after every edit block

### File: `src/App.jsx`
- Currently ~18,190 lines (reverted to `cb0d25a`)
- Single-file React monolith — all changes happen here
- Old screen functions become tab content inside merged screens (no deletion)

---

## 8. Success Criteria

- [ ] All 27 screen functions remain accessible via hash routes
- [ ] Nav shows correct context-aware state for each tournament phase
- [ ] Clash screen renders correct content for registration/live/results phases
- [ ] Phase transitions complete within 500ms
- [ ] Swiss reseed indicator is compact (max 60px height) and well-placed
- [ ] Two-click result flow: submit → confirm/dispute works without admin
- [ ] Two-click edge cases handled: timeout (10min), cancel/re-submit, self-confirm blocked
- [ ] Visual soul (glows, gradients, animations) preserved or enhanced on all new/changed components
- [ ] Mobile bottom bar works correctly with context-aware states
- [ ] User (Levitate) approves each sprint on dev server before merging
