# TFT Tournament System — Deep Dive

> Research doc for TFT Clash platform design.
> Covers: registration, check-in, lobby structure, formats, edge cases, admin flow.

---

## 1. HOW REAL TOURNAMENTS ARE STRUCTURED

### AEGIS (Riot's Official Circuit)
AEGIS is Riot's mid-tier competitive circuit sitting between open qualifiers and pro play.

**Format:**
- Open qualifiers feed into AEGIS cups
- Typically 2–3 stages per event
- **Stage 1:** Multiple lobbies of 8 run simultaneously. Top X advance (usually top 4 from each lobby, sometimes top 2–3 depending on field size)
- **Stage 2:** Survivors from Stage 1 consolidated into new lobbies
- **Finals:** Single lobby of 8 (the best performers)
- Each stage plays **3–5 games** and cumulative points within the stage determine advancement
- Points reset between stages (you start fresh in Stage 2)

**Key rule:** Advancement is purely by cumulative placement points within the stage, not across stages.

---

### CompeteTFT (competetft.com)
Community-run competitive platform, one of the most organized third-party circuits.

**Format:**
- Registration via their website with Riot ID
- Check-in window: typically **30 minutes** before tournament start
- If you don't check in → auto-dropped, waitlist fills your spot
- Lobbies of 8, seeded by **current ladder rank** (higher ranked players seeded to different lobbies to balance skill)
- Multiple rounds: usually **2–3 stages**
- **Lobby format:** Each lobby plays 3 games, top 4 advance
- Results submitted via screenshot + honor system, verified by mods
- Uses Discord as main communication hub — lobby codes sent via DM or private Discord channel

---

### Northern Legends
Nordic/EU community circuit, slightly more casual but well-structured.

- Registration: Discord sign-up + Riot ID submission
- Smaller fields (32–64 players typical)
- Format: 4–8 lobbies in round 1, top 4 per lobby advance
- Tiebreakers applied if needed before advancement cuts
- Finals are a single lobby of the best performers

---

### Official EMEA/AMER Rulebook (Riot Tactician's Trials / Cups)
These are the rules TFT Clash should closely follow for legitimacy.

**Scoring:**
| Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-------|---|---|---|---|---|---|---|---|
| Pts   | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

**Tiebreakers (in order):**
1. Total tournament points
2. Number of wins + top4s (wins count double)
3. Most favorable individual placement counts (most 1sts → most 2nds → etc.)
4. Most recent game result, then prior games

**No bonus points** for eliminations or damage dealt (purely placement-based).

---

## 2. REGISTRATION & CHECK-IN

### Registration Flow (best practice)
1. Player visits platform, clicks "Register for Clash"
2. Must be logged in with an account (Riot ID linked or username set)
3. Registration window: typically opens 24–48h before event, closes 15–30 min before start
4. Player added to a **pending roster** — not confirmed until check-in

### Check-In Flow
- Check-in window opens **30–60 minutes** before start time
- Player clicks "Check In" button — confirms they are present and ready
- If player registered but does NOT check in by close → **auto-removed from roster**
- This prevents no-shows ruining lobbies
- Waitlisted players are offered spots as registered players fail to check in

### Waitlist
- After registration cap is hit, additional signups go to a waitlist
- When a registered player fails to check in, next waitlist player is offered the spot (ideally auto-promoted if platform-based)
- Waitlist players should also check in to confirm availability

---

## 3. LOBBY CREATION

### Seeding Logic
**Competitive standard:** Seeded lobbies — players sorted by rank/rating, then distributed using a "snake draft" style so lobby skill is balanced.

Example with 24 players (3 lobbies):
```
Sort all 24 by rank descending → rank them 1–24
Lobby assignment by snake:
  Lobby A: seeds 1, 6, 7, 12, 13, 18, 19, 24
  Lobby B: seeds 2, 5, 8, 11, 14, 17, 20, 23
  Lobby C: seeds 3, 4, 9, 10, 15, 16, 21, 22
```
This ensures each lobby has a mix of top and lower seeds — no lobby is stacked.

**Casual alternative:** Pure random draw — simpler, used in friend-group tournaments where skill balance doesn't matter as much.

### Lobby Code Distribution
- Tournament organizer (or admin system) creates the in-game lobby
- Lobby code shared via:
  - Platform DM to each player in the lobby
  - Private Discord channel per lobby (most common)
  - Directly shown on the bracket page for that player (platform-based)
- Grace period before lobby starts: **5 minutes** after code is sent

### Who Creates the Lobby
- In Riot's system: a designated **Lobby Host** (could be a TO, mod, or one of the players acting as host)
- Platform should track who the lobby host is and surface that info clearly
- For TFT Clash: admin creates lobby codes or one player is designated host per lobby

---

## 4. TOURNAMENT FORMATS

### Format A — Single Stage (casual / small events)
- All players in one set of lobbies
- Play 3–5 games
- Final standings by cumulative points
- Best for: ≤32 players, friend-group clashes

### Format B — Two Stage (standard competitive)
- **Stage 1:** Full field → multiple lobbies of 8 → top 4 per lobby advance
- **Stage 2:** Survivors → new lobbies → top 4 per lobby advance (or all play final)
- **Finals:** Single lobby of top 8
- Best for: 32–128 players

### Format C — Swiss-style (large open events)
- Everyone plays every round, no eliminations
- Points accumulate across all rounds
- Final standings determine prizes/qualifications
- Best for: 100+ players where everyone wants full games

### For TFT Clash (friend-group scale, ~24 players)
**Recommended: Single Stage, 3 lobbies × 3–5 games**
- 24 players → 3 lobbies of 8
- Play 3 games per lobby (or 5 for a longer event)
- Cumulative points determine final standings
- No advancement stage needed at this size
- Optional: top 8 overall qualify for a "Grand Final" lobby

---

## 5. HANDLING EDGE CASES

### Uneven Numbers (not a multiple of 8)

This is the most common real problem. Solutions:

| Players | Situation | Solution |
|---------|-----------|---------|
| 24 | 3 full lobbies | Perfect — no action needed |
| 23 | One lobby short by 1 | One lobby plays with 7. Acceptable. |
| 22 | Two lobbies short | Two lobbies of 7, one of 8. Or: 22 = lobbies of 8+7+7 |
| 20 | Can't make clean 8s | Lobbies of 8+6+6 (bad) — better: add a free player or drop to 16+4 waitlist |
| 16 | 2 lobbies of 8 | Perfect |
| 17–23 | Awkward | See BYE system below |

**BYE system (for advancement stages):**
- When you can't fill a full lobby for the next stage, some players get a **bye** — they automatically advance without playing
- BYE is awarded to **highest seeds** (best performers from prior stage) — it's a reward
- Alternatively: award bye to fill the bracket mathematically (e.g., if 10 advance but you need 8 for finals, top 2 get byes to finals)

**Lobby of 7 (running short):**
- Entirely valid — most platforms allow 4–8 per lobby
- Points still use same scale (1st still 8pts)
- 8th place simply doesn't exist — no 1pt awarded that game

**Lobby of 6:**
- Uncommon but handled same way
- Consider merging smaller groups rather than running 6-person lobbies (worse game experience)

---

### No-Shows During the Game

**Scenario A: Player doesn't join the lobby at all**
- If within the grace period (5 min): wait, then proceed without them
- Player gets a **DNP (Did Not Play)** score = 0 points for that game
- Do NOT give them last place (1pt) — 0 pts is the DNP penalty, it's worse
- After 2 DNPs: player is disqualified from the tournament

**Scenario B: Player joins but disconnects mid-game**
- Treat as a normal game result — Riot's client assigns them a placement when eliminated
- If they DC early (before first carousel): some TOs give last place (1pt), some give 0
- TFT Clash rule: **their in-game placement counts**, regardless of DC reason (no exceptions — too easy to abuse)

**Scenario C: Player drops out between rounds**
- Do not hold up the tournament
- Their slot in the next round is filled by the next highest performer who didn't advance (if advancement stage) or they simply drop from standings (if single stage)

---

### Late Arrivals
- No tolerance after lobby is full and game started
- Grace period: 5 minutes from when code is sent
- If they arrive during grace period: they can still join
- If lobby already has game running: they are DNP for that game

---

### Replacement Players
- Generally not used in competitive formats mid-tournament
- Acceptable in casual friend-group clashes
- If a replacement is added: they start with 0 points and can only affect final standings from that point

---

### Tiebreakers (cumulative across games)
Apply in this order:
1. Total cumulative points
2. Number of 1st place finishes
3. Number of top-4 finishes
4. Best individual game result
5. Coin flip / random (last resort)

---

## 6. ADMIN / TO WORKFLOW

### Timeline for a single-stage 24-player clash:

```
T-48h  Registration opens
T-1h   Registration closes
T-60m  Check-in opens
T-30m  Waitlist players offered late spots
T-15m  Check-in closes — final roster locked
T-10m  Admin builds lobbies (seeded or random)
T-5m   Lobby codes sent to players
T-0    Games begin (Grace period: 5 min for stragglers)

[Game 1: ~35–45 min]

T+45m  Results submitted (screenshot or auto)
T+50m  Admin verifies results, updates standings
T+55m  Lobby codes for Game 2 sent (same lobbies)
[Game 2: ~35–45 min]

...repeat for Game 3...

T+2.5h Tournament complete, final standings posted
```

### Result Submission
**Honor system + screenshot (current standard for friend groups):**
- End-of-game lobby screenshot posted in Discord channel by any player
- Admin reads placements from screenshot and enters into system
- Takes ~5 min per lobby

**Automated (ideal platform behavior):**
- Riot API could theoretically pull results but requires match history access
- For now: admin enters results via AdminPanel
- Future: players self-report, admin confirms

---

## 7. WHAT TFT CLASH NEEDS TO BUILD

Based on all of the above, here's what the platform needs:

### Registration System
- [ ] Registration window with open/close timestamps
- [ ] Waitlist when cap is reached
- [ ] "Check In" button that appears 60min before start
- [ ] Auto-drop players who don't check in by T-15min
- [ ] Show registration status: `Registered` / `Checked In` / `Waitlisted` / `Dropped`

### Lobby Builder (Admin)
- [ ] Admin sees confirmed checked-in roster
- [ ] One-click "Generate Lobbies" — random or seeded by rank
- [ ] Manual override — drag players between lobbies
- [ ] Designate lobby host per lobby
- [ ] Send lobby codes (show in UI per player + in lobby page)
- [ ] Handle uneven numbers: flag when not divisible by 8, offer options

### Bye & Uneven Number Handler
- [ ] If N players, calculate: `lobbies = floor(N/8)`, `remainder = N % 8`
- [ ] If remainder > 0: either add a lobby of <8, or award byes to top seeds
- [ ] BYE players shown in bracket with "BYE" badge
- [ ] BYE = 0 points for that game (neutral, not rewarded, not punished)

### Results & Standings
- [ ] Admin enters placements per lobby per game
- [ ] Points auto-calculated: `{1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`
- [ ] DNP = 0 points (worse than last place)
- [ ] Live standings update between games
- [ ] Tiebreaker logic applied automatically

### No-Show Handling
- [ ] Admin can mark a player as DNP for a specific game
- [ ] After 2 DNPs: prompt admin to DQ player
- [ ] DQ'd player shown in standings with `DQ` badge, 0pts

### Tournament Stages (future)
- [ ] Define advancement rules per stage (top X per lobby, or top X overall)
- [ ] Auto-generate Stage 2 lobbies from Stage 1 results
- [ ] Points reset at stage boundary

---

## 8. LARGE TOURNAMENT FORMAT — 128 PLAYERS (by Ole)

Exact math for a 128-player, 6-game tournament with a cut after Game 4.

### Scoring Math

| Metric | Value |
|--------|-------|
| Points per lobby per game | 8+7+6+5+4+3+2+1 = **36** |
| Lobbies (128 / 8) | **16** |
| Total points after 4 games | 16 x 36 x 4 = **2,304** |
| Average per player after 4 games | 2,304 / 128 = **18 pts** |
| Max points from Games 5-6 | **16 pts** |
| Typical 16th-place score after 6 games | **~27-30 pts** |

### The Cut: 13 Points or Fewer = Eliminated

After 4 games, players with **13 points or fewer are eliminated**. You need **at least 14 points** to advance to Phase 2.

**Announceable rule:** "You must average better than 6th place across 4 games to advance."

### Why 13 Is the Correct Cut Line

**1. Clean competitive separation:**
- 6th every game = 3 x 4 = 12 pts -> eliminated
- 5th every game = 4 x 4 = 16 pts -> survives

**2. Avoids unfair edge cases:**
- Player A: 4th, 4th, 4th, 4th = 16 pts -> advances
- Player B: 8th, 4th, 4th, 4th = 15 pts -> advances (would be eliminated at a 15-pt cut despite near-identical performance)

**3. Handles high variance properly:**
- 1st, 1st, 8th, 8th = 18 pts -> advances (rewards strong peaks)
- 1st, 6th, 7th, 8th = 14 pts -> advances (barely, but deserved)

### Cut Line Comparison

| Cut Line | Players Advancing | Lobbies | Verdict |
|----------|-------------------|---------|---------|
| <=10 pts | ~72-80 | 9-10 | Too lenient |
| <=11 pts | ~64-72 | 8-9 | Lenient |
| <=12 pts | ~56-64 | 7-8 | Slightly lenient |
| **<=13 pts** | **~48-56** | **6-7** | **Recommended** |
| <=14 pts | ~40-48 | 5-6 | Also viable |
| <=15 pts | ~32-40 | 4-5 | Slightly harsh |
| <=16 pts | ~24-32 | 3-4 | Too harsh |

### Score Reference (After 4 Games)

| Avg Placement | Total Points | Result |
|---------------|-------------|--------|
| 1st | 32 | Advances |
| 2nd | 28 | Advances |
| 3rd | 24 | Advances |
| 4th | 20 | Advances |
| 5th | 16 | Advances |
| 6th | 12 | Eliminated |
| 7th | 8 | Eliminated |
| 8th | 4 | Eliminated |

### Expected Outcome
- ~48-56 players advance to Phase 2
- 6-7 clean lobbies of 8
- Strong competitive field for Games 5-6
- Clear, fair, and defensible system

### Implementation Notes
- Cut line should be **configurable per tournament** (host sets threshold in tournament config)
- Default: 13 pts for 128-player events
- For smaller events (64 players), the cut math changes — provide a calculator or suggested defaults per player count
- The system must support **mid-tournament elimination** (Phase 4.2 registration flow already covers DQ/DNP tracking)
