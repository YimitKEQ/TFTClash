# TFT Competitive Tournament Ecosystem — Deep Research

> Researched: 2026-03-18
> Confidence: HIGH (sourced from Riot official docs, Liquipedia, competitive rulesets, API documentation)
> Purpose: Drive the next phase of TFT Clash tournament system development

---

## Table of Contents

1. [Riot's Official Competitive Structure (2025-2026)](#1-riots-official-competitive-structure-2025-2026)
2. [How TFT Tournaments Actually Work](#2-how-tft-tournaments-actually-work)
3. [Tournament Formats in Detail](#3-tournament-formats-in-detail)
4. [Lobby Creation and Seeding Algorithms](#4-lobby-creation-and-seeding-algorithms)
5. [Community Tournament Platforms](#5-community-tournament-platforms)
6. [Riot API Integration](#6-riot-api-integration)
7. [Best Practices for Tournament UX](#7-best-practices-for-tournament-ux)
8. [EMEA Community Framework (New 2026)](#8-emea-community-framework-new-2026)
9. [What Would Make TFT Clash Stand Out](#9-what-would-make-tft-clash-stand-out)
10. [Implementation Priorities](#10-implementation-priorities)

---

## 1. Riot's Official Competitive Structure (2025-2026)

### The Pro Circuit Pathway

Riot's TFT competitive ecosystem for Set 16 (Lore and Legends) is the most ambitious yet, spanning four regions: Americas (AMER), Asia Pacific (APAC), China (CN), and Europe/Middle East/Africa (EMEA).

Three-stage qualification pathway:

```
Ranked Ladder
    |
    v
TFT Pro Circuit (TPC) -- 32 top players from previous set
    |                        - 3 weekends of competition
    |                        - 12 games across first 2 days
    |                        - Top 24 advance to Day 2 (points carry over)
    |                        - Top 16 advance to Day 3
    v
Regional Finals -- 64 top tacticians
    |                - Two weekends of competition
    |                - Determine regional representatives
    v
Tactician's Crown -- 40 best players globally
                     - World championship
                     - Ends in Checkmate format
                     - $450,000+ prize pool
```

Prize pools: Over $150,000 per region, plus $450,000 at the Tactician's Crown.

### Scoring System (Universal)

Every official TFT tournament uses the same placement-based scoring:

| Place | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th |
|-------|-----|-----|-----|-----|-----|-----|-----|-----|
| Points | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

No bonus points for eliminations, damage dealt, or any other metric. Purely placement-based. This is the system TFT Clash already uses, which is correct.

### The Checkmate Format (Finals)

Used in Tactician's Crown finals (Day 3):

1. Players accumulate points across games
2. Once a player reaches 20 points (or 18 in some variants), they put the lobby in "check"
3. A player in "check" must then win a game (1st place) to be crowned champion
4. Multiple players can have the lobby in "check" simultaneously
5. If no player in "check" wins after 8 games, highest total points wins
6. Remaining players sorted by Day 3 points for final standings

Relevance to TFT Clash: The Checkmate format is exciting and could be offered as a premium tournament format for hosts. It creates dramatic tension and natural climax moments -- perfect for streams.

### CompeteTFT -- Riot's Official Platform

Launched August 2025, CompeteTFT (competetft.com) is Riot's dedicated esports hub:

- Pro Circuit schedules, standings, stats
- Region-specific pages with localized content
- Compete Cards -- player identity cards for showcasing competitive identity
- Tournament Realm credentials access
- Path to Pro registration for regional Trials and Cups

What CompeteTFT does NOT do:
- Does not handle community/grassroots tournament management
- No lobby creation tools
- No bracket generation for community events
- No season tracking for non-Riot events
- No registration/check-in system for community organizers

This is the gap TFT Clash fills. Riot builds infrastructure for the top of the pyramid. Nobody builds for the base.

### Sources
- [Set 16 TFT Pro Circuit](https://teamfighttactics.leagueoflegends.com/en-us/news/esports/set-16-tft-pro-circuit-everything-you-need-to-know/)
- [Compete in Lore and Legends](https://teamfighttactics.leagueoflegends.com/en-us/news/esports/compete-in-lore--legends/)
- [Riot Competitive Operations -- TFT](https://competitiveops.riotgames.com/en-US/teamfight-tactics)
- [CompeteTFT Hub](https://competetft.com/en-US/)
- [Esports Insider -- Set 16 Pro Circuit](https://esportsinsider.com/2026/01/tft-set-16-pro-circuit-schedule-format-players-to-watch)

---

## 2. How TFT Tournaments Actually Work

### The Fundamental Challenge: TFT Is Not 1v1

Every major tournament platform (Battlefy, Challengermode, Start.gg) was built for 1v1 or team-vs-team brackets. TFT is a free-for-all with 8 players per lobby, which breaks standard bracket logic:

- There is no "winner" and "loser" -- there are 8 placements
- Points accumulate across multiple games, not single-match elimination
- Lobbies must be reshuffled between rounds for competitive integrity
- A "series" means playing 3-6 games in the same lobby, not best-of-3

This structural mismatch is why community TOs still rely on Discord + Google Sheets + manual everything.

### Typical Tournament Timeline

Based on competitive standards across AEGIS, CompeteTFT community events, Northern Legends, and CEA leagues:

```
T-48h    Registration opens (platform or Discord sign-up with Riot ID)
T-24h    Reminder notification sent
T-1h     Registration closes
T-60min  Check-in window opens
T-30min  Waitlist players offered late spots as no-shows are removed
T-15min  Check-in closes -- final roster locked
T-10min  Admin builds lobbies (seeded or random)
T-5min   Lobby codes distributed (Discord DM, platform UI, or private channel)
T-0      Grace period begins (5 minutes for stragglers)

[Game 1: ~30-40 min]

T+40min  Results submitted (screenshot posted in Discord, or admin enters)
T+45min  Admin verifies results, updates standings
T+50min  Optional: Lobbies reshuffled (if using Swiss reseeding)
T+55min  Lobby codes for Game 2 sent

[Game 2: ~30-40 min]

...repeat for Game 3-5...

T+2.5-4h  Tournament complete, final standings posted
```

### Result Submission (Current State of the Art)

How it works today in 95% of community tournaments:

1. Game ends
2. One player screenshots the end-of-game lobby (shows all 8 placements)
3. Screenshot posted in a Discord channel (e.g., #results-lobby-1)
4. Tournament admin reads placements from screenshot
5. Admin manually enters results into spreadsheet/platform
6. Takes 3-5 minutes per lobby

Why manual entry persists:
- Riot's TFT API does not support tournament codes (unlike League of Legends)
- Match history API has a delay (minutes, not real-time)
- No webhook/callback system for TFT game completion
- Custom games are not differentiated from normal games in the API

This is a massive pain point. Every community organizer spends 15-30 minutes per round just entering and verifying results.

### No-Shows and DNP Handling

Standard across competitive circuits:

| Scenario | Standard Response |
|----------|------------------|
| Player does not check in | Auto-removed, waitlist fills spot |
| Player does not join lobby within grace period | DNP = 0 points (worse than 8th place at 1pt) |
| Player disconnects mid-game | Their in-game placement counts as-is |
| Player DCs before Stage 2-1 | Varies: some TOs give 0pts, some give 1pt |
| 2+ DNPs in a tournament | Player is DQ'd |
| Player drops between rounds | Slot filled by next-best performer or left empty |

### Game of Record (GOR)

A critical concept from official rules: Stage 2-1 is the Game of Record point. Before Stage 2-1, a restart can be granted for technical issues. After Stage 2-1, the game counts regardless of technical issues, disconnects, or bugs.

TFT Clash should implement this rule. It prevents abuse (intentional DC when losing early) while being fair to genuine technical issues.

### Sources
- [CEA TFT Rulebook](https://cea.gg/teamfight-tactics-rulebook/)
- [TFT Global Tournament Rules](https://teamfighttactics.leagueoflegends.com/en-us/news/esports/tft-global-tournament-rules/)

---

## 3. Tournament Formats in Detail

### Format A: Single Stage (Cumulative Points)

Best for: 8-32 players, casual/friend-group events

```
All players -> Lobbies of 8 -> Play 3-5 games -> Cumulative points = final standings
```

- Simplest format, no advancement rounds
- Everyone plays every game (no elimination)
- Final standings purely by total points
- TFT Clash's current target format

Lobby persistence: Same lobbies for all games (most common at this scale) or reshuffle between games (more competitive but harder to manage).

### Format B: Two-Stage Elimination

Best for: 32-128 players, competitive events

```
Stage 1: Full field -> Multiple lobbies x 3 games -> Top 4 per lobby advance
Stage 2: Survivors -> New lobbies x 3 games -> Top 4 advance (or final 8)
Finals:  Single lobby of 8 -> 3-5 games -> Champion crowned
```

- Points reset between stages (you start fresh)
- Advancement is by cumulative points within the stage
- Creates natural narrative arc: survival -> proving ground -> championship

### Format C: Swiss System

Best for: 16-64 players, competitive events wanting fairness

The Swiss system is considered the gold standard for TFT competitive events. Here is how it actually works:

Core principle: After every X games, lobbies are reshuffled so players with similar point totals play together. This prevents a weak lobby from producing false qualifiers.

Implementation:

```
Round 1 (Games 1-2): Initial lobbies by snake seeding (see Section 4)
                       Points accumulate.

Reseed: Sort all players by total points. Snake-seed into new lobbies.

Round 2 (Games 3-4): New lobbies of similarly-ranked players.
                       Points continue accumulating.

Reseed again.

Round 3 (Games 5-6): Final lobbies.
                       Total points across all 6 games = final standings.
```

Why Swiss is superior:
- Players with similar records play each other (like chess Swiss)
- Reduces variance -- a bad game 1 does not doom you forever
- More fair than static lobbies where one lobby might be much harder
- Standard in Riot's official circuit for a reason

When to reseed: Typically after every 2 games. Some events reseed after every game, but this is logistically heavy.

### Format D: Checkmate (Dramatic Finals)

Best for: Finals of 8 players, high-stakes events

```
8 players play games until someone reaches 18-20 points AND wins a game.
Multiple players can be in "check" simultaneously.
Maximum 8 games -- if no checkmate, highest points wins.
```

This format creates incredible tension because:
- A player with 19 points who gets 2nd does not win
- A player with 20 points and a 5th place can be overtaken
- The "just win one game" pressure is immense

### Format E: Round Robin (Team Variant)

Best for: Team-based TFT events (4v4)

From the CEA rulebook:
- Teams of 4 players each
- Both teams share one 8-player lobby
- Individual placements scored, but team total determines the match winner
- Scoring: 9/7/6/5/4/3/2/1 (note: CEA uses 9 for 1st, not 8)
- Tiebreaker: team with highest individual placement wins

Relevance to TFT Clash: Team mode could be a differentiating feature. "Squad Clash" where friend groups compete as teams.

### Sources
- [Swiss Seeding System -- Liquipedia](https://liquipedia.net/tft/Swiss_Seeding_System)
- [CEA TFT Rulebook](https://cea.gg/teamfight-tactics-rulebook/)
- [Set 16 TFT Pro Circuit](https://teamfighttactics.leagueoflegends.com/en-us/news/esports/set-16-tft-pro-circuit-everything-you-need-to-know/)

---

## 4. Lobby Creation and Seeding Algorithms

### Snake Seeding (Standard)

The Snake Seeding System (also called Serpentine System) is the most widely used method in competitive TFT. It distributes ranked players across lobbies to ensure balanced skill distribution.

Algorithm:

Given N players ranked 1 to N, distributed into M lobbies:

```
Round 1: Player 1 -> Lobby 1, Player 2 -> Lobby 2, ... Player M -> Lobby M
Round 2: Player M+1 -> Lobby M, Player M+2 -> Lobby M-1, ... Player 2M -> Lobby 1
Round 3: Same as Round 1 direction
Round 4: Same as Round 2 direction
...continue until all players assigned
```

Example: 24 players, 3 lobbies

```
Sort by rank descending: seeds 1-24

Lobby A: 1,  6,  7,  12, 13, 18, 19, 24
Lobby B: 2,  5,  8,  11, 14, 17, 20, 23
Lobby C: 3,  4,  9,  10, 15, 16, 21, 22
```

Each lobby gets a mix of top, middle, and lower seeds. No lobby is significantly stronger.

Example: 16 players, 2 lobbies

```
Lobby A: 1, 4, 5, 8, 9, 12, 13, 16
Lobby B: 2, 3, 6, 7, 10, 11, 14, 15
```

### Swiss Reseeding

After a set of games, players are re-sorted by cumulative points and snake-seeded into new lobbies:

```
After Games 1-2:
  Sort all players by total points (tiebreak: placement in most recent game)
  Snake-seed into new lobbies for Games 3-4

After Games 3-4:
  Sort again by total points
  Snake-seed into new lobbies for Games 5-6
```

Implementation note: When reseeding, players with identical point totals should be randomly shuffled within their tier before snake-seeding. This prevents the same matchups repeating.

### Random Draw

Simple random assignment. Used for:
- Friend-group events where skill balance does not matter
- Events without reliable rank data
- Casual weekly clashes

### Seeding Data Sources

For seeding by rank, TFT Clash can use:
1. Platform-internal rating: Season points on TFT Clash (best option for returning players)
2. Riot ranked tier: Via Riot API -- Diamond, Master, GM, Challenger
3. Manual entry: Admin assigns seed numbers
4. Hybrid: Platform rating primary, Riot rank as tiebreaker

### Sources
- [Snake Seeding System -- Liquipedia](https://liquipedia.net/tft/Snake_Seeding_System)
- [Swiss Seeding System -- Liquipedia](https://liquipedia.net/tft/Swiss_Seeding_System)

---

## 5. Community Tournament Platforms

### Battlefy

What it offers for TFT:
- FFA (Free For All) bracket type specifically designed for multi-player games
- Lobby information sharing (lobby name/password)
- Adjustable player counts per lobby
- Registration and check-in
- Result reporting

What is missing:
- No TFT-specific scoring automation
- No snake seeding or Swiss reseeding
- No season/league tracking
- No Riot API integration
- FFA brackets are generic, not TFT-native
- No multi-game series management within a single lobby
- No lobby reshuffling between rounds

Pricing: Free for basic tournaments, premium plans for organizers.

### Challengermode

What it offers for TFT:
- Official TFT tournament support
- Organizer "Spaces" with community features and social feeds
- Player check-in and result reporting from browser/desktop/mobile
- Marketplace for coaches and freelancers
- Monetization tools for organizers
- 200+ game support across 80+ countries

What is missing:
- Generic tournament infrastructure, not TFT-purpose-built
- No recurring season tracking across events
- No snake seeding algorithm
- No lobby reshuffling/Swiss system
- No head-to-head records between players
- No comp/augment/trait analytics
- Payments only in euros (friction for non-EU users)

Notable: There is literally a tournament called "TFT Clash" on Challengermode already (from an organizer called "saturdayleague"), which validates the concept.

### Start.gg (formerly Smash.gg)

What it offers:
- Strong FGC/fighting game community roots
- Free platform -- no organizer charges
- Tournament discovery and community tools
- Bracket visualization

What is missing for TFT:
- TFT support is bolt-on, not native
- Cap of 32 players in some configurations
- No FFA-specific tooling
- No point accumulation across multiple games
- No season tracking
- No Riot integration

### Toornament

What it offers:
- Professional tournament management
- FFA bracket support
- League of Legends tournament code integration (LoL only, not TFT)
- Multi-stage tournaments

What is missing for TFT:
- Tournament codes do not exist for TFT
- No TFT-specific scoring
- No lobby management

### The Common Gap Across All Platforms

Every existing platform fails at the same things for TFT:

| Gap | Impact |
|-----|--------|
| No multi-game series tracking within a lobby | Admin manually tallies across games |
| No snake seeding / Swiss reseeding | Admin does math on paper or spreadsheet |
| No season-long point accumulation | Separate spreadsheet maintained outside platform |
| No lobby code distribution integrated with brackets | Admin DMs codes on Discord separately |
| No automatic result pulling from Riot API | Manual screenshot + data entry every round |
| No head-to-head / player history across events | Lost institutional knowledge |
| No TFT-specific tiebreaker logic | Manual tiebreaking with spreadsheets |
| No recurring event scheduling | Create new tournament from scratch each week |

This table is TFT Clash's product roadmap. Solve these gaps and you own the niche.

### Sources
- [Battlefy FFA Brackets](https://help.battlefy.com/en/articles/6409423-how-to-use-our-ffa-brackets)
- [Challengermode TFT](https://www.challengermode.com/tft/tournaments?lang=en)
- [Start.gg](https://www.start.gg/)

---

## 6. Riot API Integration

### Available TFT API Endpoints

The Riot Developer Portal provides three core TFT API groups:

1. TFT-Summoner-v1
   - Get summoner by name, PUUID, account ID
   - Used for: Player identity verification, linking Riot accounts

2. TFT-League-v1
   - Get ranked ladder data (Challenger, GM, Master, Diamond, etc.)
   - Get league entries by summoner ID
   - Used for: Seeding players by rank, verifying rank claims, profile enrichment

3. TFT-Match-v1 (most important for tournaments)
   - GET /tft/match/v1/matches/by-puuid/{puuid}/ids -- List match IDs for a player
   - GET /tft/match/v1/matches/{matchId} -- Get full match details

Match data fields available per participant:

```
augments: list of augment IDs chosen
companion: Little Legend cosmetic data
gold_left: gold remaining at elimination
last_round: final round reached
level: Little Legend level at elimination
placement: 1-8 final placement
players_eliminated: number of players this player eliminated
puuid: encrypted player unique ID
time_eliminated: timestamp of elimination
total_damage_to_players: total HP damage dealt to other players
traits: list of active traits with tier info
units: list of champions with items, tier, rarity
```

### Regional Routing

TFT Match-v1 uses regional routing (NOT platform routing):
- AMERICAS -- NA, BR, LAN, LAS, OCE
- EUROPE -- EUW, EUNE, TR, RU
- ASIA -- KR, JP
- SEA -- SEA clusters

### What the API CAN Do for TFT Clash

| Feature | API Endpoint | Feasibility |
|---------|-------------|-------------|
| Verify player rank | TFT-League-v1 | HIGH -- straightforward |
| Auto-pull match results | TFT-Match-v1 by PUUID | MEDIUM -- requires matching game to tournament |
| Show player comp/items/augments | TFT-Match-v1 match detail | HIGH -- rich data available |
| Display match history on profiles | TFT-Match-v1 match list | HIGH -- standard feature |
| Live game tracking during tournament | Not available | LOW -- no real-time game API for TFT |
| Tournament codes (auto-create lobbies) | NOT available for TFT | NONE -- LoL only |

### The Critical Limitation: No Tournament Codes for TFT

League of Legends has Tournament-v5 API with tournament codes that:
- Auto-create custom game lobbies
- Automatically POST results to a callback URL when game ends
- Link specific games to specific tournament matches

TFT has NONE of this. There are no tournament codes, no auto-lobby creation, and no result callbacks. This is the single biggest pain point in the entire TFT competitive ecosystem.

### Auto-Result Pulling: How to Make It Work

Despite no tournament codes, TFT Clash can still auto-pull results with this approach:

```
1. Each player links their Riot ID + PUUID on TFT Clash
2. Tournament starts, admin creates lobbies, sends codes manually
3. Players play the game (manual lobby join)
4. Game ends -- results appear in Riot match history (1-5 minute delay)
5. TFT Clash polls TFT-Match-v1 for each player's recent matches
6. System identifies the tournament game by:
   a. Timestamp (within tournament window)
   b. Participant PUUIDs (all 8 lobby members appear in same match)
   c. Game type (normal custom game)
7. System auto-populates placements from match data
8. Admin confirms with one click (not manual entry)
```

Challenges:
- 1-5 minute API delay after game ends
- Must match the specific game (player may have played other games)
- Need all 8 PUUIDs to reliably identify the correct match
- Rate limits: 20 requests per second (development key), 100/2min (production key)
- Custom games may not appear in match history (needs verification)

Recommendation: Build manual entry first (already planned). Add API-assisted entry as an enhancement later -- it turns a 5-minute process into a 30-second confirmation.

### Rate Limits

| Key Type | Limit | Notes |
|----------|-------|-------|
| Development | 20 req/sec, 100 req/2min | Free, immediate |
| Production | Higher limits (varies) | Requires application with working product |

For a 24-player tournament with 3 games, you would need about 24 API calls per round (one per player to find matches) + 3 match detail calls = about 27 calls per round. Well within development key limits.

### Sources
- [Riot Developer Portal -- TFT](https://developer.riotgames.com/docs/tft)
- [Riot Developer Portal -- APIs](https://developer.riotgames.com/apis)
- [RiotWatcher TFT MatchApi](https://riot-watcher.readthedocs.io/en/latest/riotwatcher/TeamFightTactics/MatchApi.html)
- [Riot DevRel -- TFT Match History](https://www.riotgames.com/en/DevRel/new-game-policy-and-tft-match-history)

---

## 7. Best Practices for Tournament UX

### Real-Time Bracket/Standings Updates

What works in practice:

1. Live standings board -- Updates after each game's results are entered. Shows:
   - Current total points
   - Position change arrows (up/down/same)
   - Point delta from last game (+8, +3, etc.)
   - Games remaining indicator

2. Between-game status -- Clear visual state machine:
   ```
   REGISTERING -> CHECKED IN -> LOBBIES ASSIGNED -> GAME 1 IN PROGRESS ->
   AWAITING RESULTS -> GAME 2 IN PROGRESS -> ... -> TOURNAMENT COMPLETE
   ```

3. Player-specific view -- Each player sees:
   - Their lobby assignment and lobby code
   - Their current position in overall standings
   - Who else is in their lobby
   - Countdown to next game

### Lobby Code Distribution

Best practice hierarchy (most to least reliable):

1. Platform-native (best): Player logs into TFT Clash, sees their lobby code on their personal tournament page. No Discord needed.
2. Discord bot DM: Bot DMs each player their lobby code. Reliable but requires Discord account.
3. Private Discord channel: One channel per lobby, only lobby members can see the code.
4. Public announcement: Admin posts all codes in a channel. Least secure, players might join wrong lobby.

TFT Clash should implement option 1 with Discord bot as backup. The lobby code should be visible to the player AND the admin simultaneously.

### Result Submission and Verification

Tiered verification system:

| Method | Reliability | Speed | Effort |
|--------|-------------|-------|--------|
| Riot API auto-pull | Highest | 2-5 min delay | Minimal (one-click confirm) |
| Player self-report + screenshot | Medium | Immediate | Low (per player) |
| Admin manual entry from screenshot | Medium | 3-5 min/lobby | High (admin bottleneck) |
| Honor system (player self-report) | Lowest | Immediate | Lowest |

Recommended flow for TFT Clash:

1. Game ends
2. Any player in the lobby clicks "Submit Results" on TFT Clash
3. They either:
   a. Enter placements manually (dropdown for each player), OR
   b. Upload end-game screenshot (future: OCR to auto-read), OR
   c. System auto-pulls from Riot API (future)
4. A second player from the same lobby confirms ("looks correct")
5. Admin has override power for disputes
6. Points auto-calculated, standings update

Two-player confirmation is key. It prevents a single player from submitting false results without needing admin involvement for every lobby.

### Anti-Cheat / Result Validation

Practical measures for community tournaments:

| Measure | Description | Priority |
|---------|-------------|----------|
| Two-player confirmation | Two different players must agree on results | HIGH |
| Screenshot requirement | End-game screenshot as evidence (stored) | HIGH |
| Riot API cross-reference | Compare submitted results with API data | MEDIUM (future) |
| Game of Record rule | Games count after Stage 2-1, no restarts | MEDIUM |
| Bug abuse reporting | Players can report with screenshot evidence | MEDIUM |
| Account verification | Riot ID linked, verified via Riot API | LOW (future) |
| Smurf detection | Compare Riot rank with tournament performance over time | LOW (future) |

What NOT to worry about at community scale:
- Stream sniping (not relevant unless streaming)
- Third-party software (TFT has no meaningful cheats -- it is a strategy game, not an FPS)
- Account sharing (honor system is fine for friend groups)

### Spectator Mode Integration

Current state of TFT spectating:
- TFT has built-in spectator mode (delayed by about 3 minutes)
- No official API for live game state
- Streamers use Overwolf overlays (Tracker.gg, OP.GG) for stream overlays
- No tournament-specific spectator tools exist

What TFT Clash can build:

1. Broadcast-friendly standings page -- Full-screen, dark theme, large fonts, auto-updating. Add as OBS browser source. This alone would be huge.
2. Transparent overlay mode -- Standings with transparent background for stream overlay.
3. Cast mode -- Simplified view showing only the current game's lobby + live standings, designed for casters.
4. Auto-generated highlight text -- After each game, generate a text-based "narrative" of what happened (biggest upset, closest finish, etc.)

### Sources
- [Tracker.gg Stream Overlays](https://tracker.gg/overlays)
- [OP.GG Streamer Overlay](https://streamer-overlay.op.gg/)
- [EsportsDash Overlays](https://esportsdash.com/blog/how-to-create-esports-overlay)
- [LHM Broadcast Management](https://lhm.gg/features/broadcast-tournament-and-overlay-management)

---

## 8. EMEA Community Framework (New 2026)

### The Opportunity

Riot launched the TFT Community Framework in EMEA in March 2026 -- a three-tier system to professionalize grassroots competitive TFT. This is directly relevant to TFT Clash.

### Three Tiers

Tier 1: Community Events (Foundation)
- For content creators, tournament organizers, community managers
- Online or in-person
- Must live-stream with minimum 3-hour coverage on main channel
- Must include engagement elements (missions, challenges, watch parties)
- Applications open year-round starting March 19, 2026
- Must be validated 14+ days before event date

Tier 2: TFT Minors
- Competitive tournaments for established organizers
- Currently limited to France, Spain, Germany, Poland (one per country per Set)
- Must serve as Official Qualifier for TFT Major
- Requires content creator partnership for broadcasting
- Set 17 applications: Feb 6 - Mar 21, 2026
- Set 18 applications: May 6 - Jun 4, 2026

Tier 3: TFT Majors
- Large-scale regional in-person events
- Managed by professional Tournament Organizers
- One per Set in EMEA
- First scheduled for end of Set 17
- Winners connect directly to TFT Open

### What Riot Provides to Approved Organizers
- Event validation and official recognition
- Community asset kit (logos, promotional materials)
- Content amplification on Riot channels
- Community team support for individual requests

### What Riot Does NOT Provide (The Gap)
- No tournament management software
- No bracket/lobby generation tools
- No player registration system
- No result tracking infrastructure
- No streaming overlays or broadcast tools
- No prize pool distribution systems
- No marketing budget support

This is a massive opportunity. Riot is telling community organizers: "We will validate and promote your events, but you need to figure out the tooling yourself." TFT Clash IS the tooling.

### Strategic Positioning

TFT Clash should position itself as the platform Riot-approved community organizers use to run their events. When a community organizer applies for Tier 1 or Tier 2 status, they should be able to say "we run our events on TFT Clash" and have that be a credibility signal.

Concrete actions:
1. Add "Riot Community Event" badge/tag for tournaments that have Riot approval
2. Build export functionality that generates the event reporting Riot requires
3. Ensure the platform meets the 14-day advance validation requirement (events can be created and submitted early)
4. Support the streaming requirements (broadcast-friendly views, OBS overlays)

### Sources
- [THE FUTURE OF TFT EVENTS IN EMEA](https://teamfighttactics.leagueoflegends.com/en-gb/news/community/the-future-of-teamfight-tactics-events-in-emea/)
- [Esports Insider -- TFT Open Las Vegas 2026](https://esportsinsider.com/2025/12/tft-open-las-vegas-return-2026)

---

## 9. What Would Make TFT Clash Stand Out

### Features No Other Platform Offers

Based on the gap analysis across all existing platforms:

#### 1. Integrated Multi-Game Series Management
What: A single tournament interface that tracks points across 3-5 games within a lobby, with running totals, position changes, and automatic tiebreaker resolution.
Why it matters: Currently requires spreadsheets. This alone solves the number one pain point.
Complexity: Medium -- core data model work, but straightforward UI.

#### 2. Swiss Reseeding Engine
What: After every 2 games, automatically reseed players into new lobbies based on current standings using snake seeding algorithm.
Why it matters: Swiss is the gold standard format but nobody automates it. TOs do it manually with spreadsheets.
Complexity: Medium -- algorithm is well-defined, UX needs to be smooth.

#### 3. Season-Long Tracking
What: Points accumulate across weekly events. Season standings, season history, season champion.
Why it matters: Zero competition. Every platform treats each tournament as isolated. Nobody tracks performance across a season.
Complexity: Low -- just database design and queries.

#### 4. Two-Click Result Confirmation
What: One player submits results, another player confirms. No admin bottleneck.
Why it matters: Eliminates the 5-minute-per-lobby admin delay between games.
Complexity: Low -- UI + simple confirmation flow.

#### 5. Broadcast/OBS Mode
What: Full-screen, auto-updating standings display optimized for streaming. Add as OBS browser source.
Why it matters: Every tournament streamer builds custom overlays. A built-in one would be used immediately.
Complexity: Low -- it is just a CSS mode for existing standings.

#### 6. Head-to-Head Records
What: When viewing any two players, see their historical performance against each other across all shared lobbies.
Why it matters: Creates narratives, rivalries, and engagement. Nobody tracks this.
Complexity: Medium -- requires matching players who were in the same lobby across all historical games.

#### 7. Automatic Riot API Result Pull
What: After a game, system auto-detects the match via Riot API and pre-fills results for admin confirmation.
Why it matters: Turns a 5-minute manual process into a 10-second confirmation.
Complexity: High -- Riot API integration, rate limiting, match identification logic.

#### 8. Team/Squad Mode
What: Players form teams of 4. Teams share a lobby (4v4 in an 8-player game). Individual placements sum to team score.
Why it matters: Unique format (used by CEA) that adds a social layer.
Complexity: Medium -- new data model for teams, scoring adjustment.

#### 9. Checkmate Format Support
What: Support the dramatic "reach X points then win" format used in official Tactician's Crown finals.
Why it matters: Creates the most exciting tournament climax possible. No community platform supports it.
Complexity: Medium -- requires different tournament state machine logic.

#### 10. Player Comp/Augment Analytics
What: Using Riot API match data, show what comps and augments each player used in each tournament game.
Why it matters: Post-game analysis is hugely popular in the TFT community. Combining it with tournament data is novel.
Complexity: High -- requires API integration + data normalization across sets.

### Community Engagement Tools

| Tool | Value | Effort |
|------|-------|--------|
| Pre-match predictions (predict top 3) | Social engagement, fun side game | Medium |
| Achievement/milestone system | Retention, progression feel | Low (already partially built) |
| Shareable season stats cards (PNG) | Viral growth, social proof | Medium |
| Weekly automated recap (narrative text) | Content without effort | Medium |
| Rivalry system (auto-detect frequent matchups) | Narrative building | Low |
| "On Fire" / streak badges | Visual flair, competitive dopamine | Low (already partially built) |

### Data/Analytics Players Actually Want

Based on what tactics.tools, lolchess.gg, and metatft.com prioritize:

1. Placement distribution -- "I get top 4 in 65% of my games" (histogram chart)
2. Consistency score -- Low variance = consistent player
3. Peak performance vs average -- "My best game was 42pts, my average is 28"
4. Improvement over time -- Points trend line across a season
5. Comp preferences -- Most-played traits/comps (requires API)
6. Lobby difficulty rating -- Was your lobby strong or weak? (compare avg rank of lobby members)

---

## 10. Implementation Priorities

### What to Build First (Based on This Research)

Priority 1 -- Core Tournament Loop (already in MASTER-PLAN Phase 3)

These are table stakes. Without these, you cannot run a real tournament:

1. Registration with cap + waitlist
2. Check-in with auto-drop
3. Lobby builder with snake seeding
4. Multi-game point tracking
5. Result entry (admin) with auto-calculated points
6. Live standings between games
7. Tournament completion + final standings

Priority 2 -- Competitive Credibility Features

These elevate TFT Clash from "friend group tool" to "legitimate tournament platform":

1. Swiss reseeding between rounds (toggle on/off)
2. Two-player result confirmation (reduce admin burden)
3. DNP/DQ handling with proper 0-point scoring
4. Game of Record rule enforcement
5. Tiebreaker logic (already defined, needs implementation)
6. Uneven number handling (lobbies of 7, bye system)

Priority 3 -- Differentiation Features

These are what make TFT Clash uniquely valuable:

1. Season-long standings (already conceptualized)
2. Broadcast/OBS mode for streamers
3. Head-to-head records
4. Shareable stats cards
5. Checkmate format support

Priority 4 -- API Integration

High impact but high complexity. Do after core loop is solid:

1. Riot ID verification via API
2. Rank display from API data
3. Auto-result pulling (match identification + pre-fill)
4. Post-game comp/augment data display

Priority 5 -- EMEA Framework Alignment

Position for Riot's community framework:

1. "Riot Community Event" badge/tag
2. Event export for Riot reporting
3. Stream-ready views meeting broadcast requirements
4. 14-day advance event creation

### What NOT to Build

| Feature | Why Skip |
|---------|----------|
| Live game tracking | No API support, would require screen scraping |
| Tournament codes (auto-lobby creation) | Does not exist for TFT, LoL only |
| Built-in voice chat | Discord owns this, do not compete |
| Comp builder / tier list | tactics.tools and lolchess own this, stay in your lane |
| Ranked ladder integration (matchmaking) | Out of scope, Riot owns ranked |
| Video streaming | Twitch/YouTube own this, just build overlay support |
| Mobile game integration | TFT mobile does not support custom lobbies reliably |

---

## Appendix A: Glossary of TFT Tournament Terms

| Term | Definition |
|------|-----------|
| Lobby | A single 8-player TFT game instance |
| Stage | A set of games played before an advancement cut |
| Round | A single game within a stage |
| Snake Seeding | Serpentine distribution of ranked players across lobbies for balance |
| Swiss System | Reseeding lobbies between rounds so similarly-ranked players compete |
| Checkmate | Finals format: reach X points then win a game to be champion |
| Check | State when a player has reached the point threshold but has not won yet |
| GOR (Game of Record) | The point (Stage 2-1) after which a game counts regardless of issues |
| DNP | Did Not Play -- 0 points, worse than 8th place (1pt) |
| DQ | Disqualified -- removed from tournament, 0 points all remaining games |
| BYE | Auto-advancement when brackets do not fill evenly |
| TO | Tournament Organizer |
| PUUID | Player Universally Unique ID -- Riot's cross-platform player identifier |
| Compete Card | Riot's official player identity card on CompeteTFT |

## Appendix B: Key URLs and Resources

| Resource | URL | Purpose |
|----------|-----|---------|
| Riot Developer Portal | https://developer.riotgames.com/docs/tft | API documentation |
| CompeteTFT | https://competetft.com/en-US/ | Riot's official esports hub |
| Liquipedia TFT | https://liquipedia.net/tft/Main_Page | Tournament results, format docs |
| Snake Seeding | https://liquipedia.net/tft/Snake_Seeding_System | Algorithm reference |
| Swiss Seeding | https://liquipedia.net/tft/Swiss_Seeding_System | Algorithm reference |
| EMEA Community Framework | https://teamfighttactics.leagueoflegends.com/en-gb/news/community/the-future-of-teamfight-tactics-events-in-emea/ | Official community event guidelines |
| CEA Rulebook | https://cea.gg/teamfight-tactics-rulebook/ | Community tournament rules reference |
| Riot Competitive Ops | https://competitiveops.riotgames.com/en-US/teamfight-tactics | Official competitive structure |
| TFT Global Rules | https://teamfighttactics.leagueoflegends.com/en-us/news/esports/tft-global-tournament-rules/ | Official rulebook (links to Dropbox) |
| Battlefy FFA | https://help.battlefy.com/en/articles/6409423-how-to-use-our-ffa-brackets | Competitor FFA implementation |
| Challengermode TFT | https://www.challengermode.com/tft/tournaments?lang=en | Competitor tournament platform |
