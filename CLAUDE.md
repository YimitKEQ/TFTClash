# TFT Clash — Claude Context

## Active Working File
`src/App.jsx` — this is the single-file React app (previously `TFT-Clash-v23-WIP.jsx`).
Before editing, always check current line count and brace balance.

---

## CRITICAL TECHNICAL RULES (never violate these)

1. **NO IIFEs in JSX** — `{(()=>{...})()}` crashes the Babel renderer
2. **GCSS block (~lines 305–403) is a template literal** — do NOT convert or touch its structure
3. **Brace balance must stay at 0** after every edit: `content.count('{') - content.count('}')`
4. **No backtick string literals inside JS functions**
5. **No named function components defined inside another component's body**
6. For multi-part edits, use Python scripts or careful sequential str_replace to avoid failures
7. Always verify brace balance after every edit block

---

## Product Identity (LOCKED)

- **Platform:** TFT Clash — weekly clashes, season, community platform
- **Tiers:** Player (free) / Pro ($4.99/mo) / Host ($19.99/mo)
- **Free to compete always** — no paywall on entry
- **Theme:** Dark — bg `#08080F`, panels `#111827`, accent purple `#9B72CF`, gold `#E8A838`, teal `#4ECDC4`
- **Fonts:** Playfair Display (headings), Barlow Condensed (labels), system mono

---

## Player Roster (SEED DATA)

**Homies (use everywhere):** Levitate, Zounderkite, Uri, BingBing, Wiwi, Ole, Sybor, Ivdim, Vlad
**Excluded by request:** Denial, Max, Ribenardo — never add these back
**Randoms (filler):** Dishsoap, k3soju, Setsuko, Mortdog, Robinsongz, Wrainbash, BunnyMuffins, Frodan, NightShark, CrystalFox, VoidWalker, StarForge, IronMask, DawnBreaker, GhostRider

**Levitate = the user, season champion**
- id: 1, rank: Challenger, 1024 pts, 16 wins
- Referenced in `SEASON_CHAMPION` constant and HOF

---

## Points System (Official EMEA Rulebook)

| Place | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-------|---|---|---|---|---|---|---|---|
| Pts   | 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1 |

`PTS` constant should be `{1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}`

**Tiebreakers (in order):**
1. Total tournament points
2. Wins + top4s (wins count twice)
3. Most of each placement (1st → 2nd → 3rd…)
4. Most recent game finish

---

## Navigation Screens

`home | standings | bracket | scrims (admin only) | leaderboard | hof | archive | milestones | challenges | results | pricing | admin`

---

## File Structure (App.jsx major sections)

| Lines | Section |
|-------|---------|
| 1–170 | Constants, helpers, stats engine |
| 116–131 | Achievements |
| 172–233 | SEED data (24 players) |
| 234–403 | Auth, champion system, GCSS (template literal — don't touch) |
| 404–963 | Atoms + components (Hexbg, Panel, Btn, Av, etc.) |
| 965–1134 | Navbar |
| 1135–1194 | StandingsTable |
| 1195–1394 | HomeScreen |
| 1396–1725 | BracketScreen |
| 1731–1993 | PlayerProfileScreen |
| 1994–2165 | LeaderboardScreen |
| 2167–2534 | ClashReport, ResultsScreen, AutoLogin |
| 2541–2743 | HofScreen |
| 2745–2798 | ArchiveScreen |
| 2800–3222 | AdminPanel |
| 3224–3699 | ScrimsScreen |
| 3700–3864 | PricingScreen |
| 3865–4072 | MilestonesScreen, ChallengesScreen |
| 4074–4279 | SignUpScreen, LoginScreen |
| 4280–4459 | AccountScreen |
| 4460–4603 | SeasonRecapScreen |
| 4605–4679 | AICommentaryPanel |
| 4680–4907 | HostApplyScreen, HostDashboardScreen |
| 5016–5123 | Root TFTClash() component |

---

## Task List

See `docs/TASKS.md` for the full prioritized backlog.
See `docs/TOURNAMENT-SYSTEM.md` for deep-dive on tournament formats, registration, check-in, lobby creation, edge cases, and what needs to be built.
