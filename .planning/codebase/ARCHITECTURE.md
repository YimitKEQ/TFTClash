# Architecture

**Pattern:** Monolithic Single-File React SPA
**Entry Point:** `src/App.jsx` (5,764 lines) — all components, logic, and styles in one file
**Rendering:** Babel standalone (in-browser transpilation via CDN), no build step
**Routing:** Manual hash-based routing (`window.location.hash`) with `useEffect` listener

---

## Layers (top to bottom in file)

| Lines | Layer | Purpose |
|-------|-------|---------|
| 1–170 | Constants & Helpers | `PTS`, `TIERS`, `RANKS`, `computeStats()`, achievement helpers |
| 116–131 | Achievements | `ACHIEVEMENTS` array with `check(player)` functions |
| 172–233 | Seed Data | 24 hardcoded players used as `useState` initial value |
| 234–403 | Auth + GCSS | `AUTH` object, season champion, global CSS template literal |
| 404–963 | UI Atoms | `HexBg`, `Panel`, `Btn`, `Av`, `Toast`, `Modal`, reusable primitives |
| 965–1134 | Navbar | Navigation component, screen switching, tier badge display |
| 1135–5490 | Screen Components | All screens defined sequentially (see below) |
| 5491–5764 | Root Component | `TFTClash()` — all state, screen router, toast/modal managers |

---

## Root State (defined in `TFTClash()`, lines 5617–5625)

```javascript
const [players, setPlayers] = useState(SEED);      // All player data
const [screen, setScreen] = useState("home");       // Active screen
const [disputes, setDisputes] = useState([]);       // Dispute queue
const [profilePlayer, setProfilePlayer] = useState(null); // Profile nav target
const [toast, setToast] = useState(null);           // Toast notification
const [modal, setModal] = useState(null);           // Modal overlay
const [currentUser, setCurrentUser] = useState(null); // Logged-in user
```

All state lives here. Props are drilled down to every screen component.

---

## Data Flow

### Navigation Flow
```
User clicks nav item
  → Navbar calls setScreen(s)
  → Root re-renders with new screen
  → window.history.pushState({screen:s}, '', '#'+s)
  → Matching screen component mounts
```

### Game Reporting Flow
```
Admin submits placement in BracketScreen
  → setPlayers(prev => prev.map(p => update if matched))
  → clashHistory entry appended to player
  → computeStats() recalculates on next render
  → StandingsTable re-renders with new scores
```

### Auth Flow
```
User enters password in LoginScreen
  → Compared against AUTH.adminPass (hardcoded)
  → setCurrentUser({role: "admin"}) on match
  → Navbar shows admin-only nav items (scrims, admin)
```

### Toast/Modal Flow
```
Any component calls showToast(msg) / showModal(content)
  → Root state updated
  → Toast/Modal overlay renders above all screens
  → Auto-dismiss after 3s (toast) or user close (modal)
```

---

## Screen Components (sequential in file)

| Screen Key | Component | Lines |
|-----------|-----------|-------|
| `home` | `HomeScreen` | 1195–1394 |
| `bracket` | `BracketScreen` | 1396–1725 |
| `profile` | `PlayerProfileScreen` | 1731–1993 |
| `leaderboard` | `LeaderboardScreen` | 1994–2165 |
| `results` | `ResultsScreen` + `ClashReport` | 2167–2534 |
| `hof` | `HofScreen` | 2541–2743 |
| `archive` | `ArchiveScreen` | 2745–2798 |
| `admin` | `AdminPanel` | 2800–3222 |
| `scrims` | `ScrimsScreen` | 3224–3699 |
| `pricing` | `PricingScreen` | 3700–3864 |
| `milestones` | `MilestonesScreen` | 3865–4072 |
| `challenges` | `ChallengesScreen` | 4072–4073 |
| `signup` | `SignUpScreen` | 4074–4279 |
| `login` | `LoginScreen` | 4074–4279 |
| `account` | `AccountScreen` | 4280–4459 |
| `recap` | `SeasonRecapScreen` | 4460–4603 |
| `ai` | `AICommentaryPanel` | 4605–4679 |
| `host-apply` | `HostApplyScreen` | 4680–5074 |
| `host-dashboard` | `HostDashboardScreen` | 4680–5074 |
| `rules` | `RulesScreen` | 5075–5340 |
| `faq` | `FAQScreen` | 5341–5490 |

---

## Key Abstractions

### Player Object
```javascript
{
  id: number,           // Date.now() % 100000
  name: string,         // Display name
  riotId: string,       // Riot#Tag format
  rank: string,         // e.g. "Challenger"
  pts: number,          // Season points total
  wins: number,         // Win count
  top4: number,         // Top-4 finish count
  games: number,        // Total games
  avg: number,          // Average placement
  tier: string,         // "Player" | "Pro" | "Host"
  clashHistory: Array   // [{clashId, placement, pts, date}]
}
```

### computeStats(player) — `src/App.jsx` line 65
Derives live stats from `clashHistory` with fallback to cached fields. Returns `{pts, wins, top4, games, avg, winRate}`.

### Achievement System — lines 116–131
`ACHIEVEMENTS` array of `{id, name, desc, check(player) => boolean}`. Evaluated lazily in `getAchievements(player)` with try-catch swallowing errors.

### GCSS (Global CSS) — lines 305–403
Template literal string injected into a `<style>` tag. Contains all global styles, keyframe animations, and utility classes. **Do not modify structure.**

---

## Error Handling

- Achievement checks: silent try-catch (errors swallowed)
- Player lookups: conditional rendering guards (`if(p) ...`)
- No global error boundary
- No error logging/reporting service

---

## Cross-Cutting Concerns

| Concern | Approach |
|---------|---------|
| Styling | Inline `style={{}}` objects + GCSS template literal |
| Auth | Hardcoded password check in `LoginScreen` |
| Notifications | `toast` state in root, shown via `Toast` atom |
| Modals | `modal` state in root, shown via `Modal` atom |
| Navigation | Hash routing + `setScreen()` prop drilling |
| Data | All in React state, no persistence |
