# Structure

**Project type:** Single-page React app, no build step, Babel in-browser transpilation

---

## Directory Layout

```
tft-clash/
├── src/
│   └── App.jsx              # Entire application (5,764 lines)
├── public/                  # Static assets (if any)
├── docs/
│   ├── TASKS.md             # Prioritized task backlog
│   ├── TOURNAMENT-SYSTEM.md # Deep-dive on tournament formats and rules
│   └── HANDOFF.md           # Session handoff notes
├── .planning/
│   └── codebase/            # This codebase map
├── index.html               # HTML shell, loads Babel + React from CDN
├── vercel.json              # Vercel routing config (serves riot.txt static)
├── riot.txt.txt             # Riot Games domain verification
├── CLAUDE.md                # Claude Code project instructions
└── package.json             # Minimal — no bundler, CDN dependencies
```

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Main application | `src/App.jsx` |
| HTML entry point | `index.html` |
| Task backlog | `docs/TASKS.md` |
| Tournament design docs | `docs/TOURNAMENT-SYSTEM.md` |
| Deployment config | `vercel.json` |
| Claude instructions | `CLAUDE.md` |

---

## App.jsx Internal Organization

The file is divided into logical sections by line range (see ARCHITECTURE.md for full table).

Key landmarks to navigate by:
- **`const PTS =`** — line ~1, scoring constants
- **`const SEED =`** — line ~172, player seed data
- **`const GCSS =`** — line ~305, global CSS template literal (do not modify)
- **`function TFTClash()`** — line ~5491, root component with all state

---

## Naming Conventions

### Files
- Single application file: `App.jsx` (PascalCase, `.jsx` extension)
- Docs: `SCREAMING_SNAKE_CASE.md`
- No component files split out yet (monolith)

### Components
- PascalCase: `HomeScreen`, `BracketScreen`, `PlayerProfileScreen`
- Screen suffix for top-level screens: `*Screen`
- Panel/atom suffix for reusable UI: `Panel`, `Btn`, `Av`, `Modal`, `Toast`

### Constants
- SCREAMING_SNAKE_CASE: `PTS`, `SEED`, `TIERS`, `RANKS`, `GCSS`, `ACHIEVEMENTS`, `SEASON_CHAMPION`

### Variables / Functions
- camelCase: `computeStats`, `getAchievements`, `showToast`, `profilePlayer`
- State setters: `set` prefix matching state name (`setPlayers`, `setScreen`)

### CSS Classes (in GCSS)
- kebab-case: `.hex-bg`, `.panel`, `.btn-primary`
- Inline styles used for component-specific styling

---

## Adding New Code

### New Screen
1. Define component function after last screen component (before line ~5491)
2. Add screen key to Navbar nav items array (line ~965)
3. Add `{screen==="yourscreen" && <YourScreen ...props />}` in root render (line ~5695)
4. Pass needed state/setters as props

### New Constant / Seed Data
- Add to top of file (lines 1–172 range)
- Keep SCREAMING_SNAKE_CASE naming

### New UI Atom
- Add to atoms section (lines 404–963)
- Follow existing pattern: functional component, inline styles, props destructuring

### New Achievement
- Add to `ACHIEVEMENTS` array (lines 116–131)
- Shape: `{id: string, name: string, desc: string, icon: string, check: (player) => boolean}`
- Wrap `check` logic safely — errors are swallowed silently

---

## Dependencies (CDN, no package install)

Loaded in `index.html`:
- React + ReactDOM (production CDN)
- Babel standalone (in-browser JSX transpilation)
- No CSS framework, no router library, no state management library
