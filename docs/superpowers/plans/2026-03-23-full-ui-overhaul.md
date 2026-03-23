# Full UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 20K-line monolithic `src/App.jsx` into ~50 modular files with Tailwind CSS, React Router v6, Material Design 3 tokens, and pixel-perfect implementation of the new UI designs.

**Architecture:** Extract business logic into `lib/`, state management into `hooks/` and `context/`, UI primitives into `components/ui/`, layout into `components/layout/`, and each page into `screens/`. Tailwind CSS replaces all inline styles and the GCSS template literal. React Router v6 replaces hash-based routing. Google Material Symbols replaces Tabler Icons.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Supabase, Google Material Symbols, Sentry

**Spec:** `docs/superpowers/specs/2026-03-23-full-ui-overhaul-design.md`
**Designs:** `docs/UI-DESIGNS.html` (22 reference pages)
**Current source:** `src/App.jsx` (19,915 lines)

---

## Phase 0: Infrastructure

### Task 1: Install dependencies and configure Tailwind

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `vite.config.js` (if needed)

- [ ] **Step 1: Install Tailwind CSS v3 + plugins + React Router**

```bash
npm install tailwindcss@3 postcss autoprefixer @tailwindcss/forms @tailwindcss/container-queries react-router-dom@6
```

- [ ] **Step 2: Create `postcss.config.js`**

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create `tailwind.config.js`**

Copy the exact Tailwind config from the spec (Section 2.1) with the ESM import syntax from Section 13:

```js
import forms from '@tailwindcss/forms'
import containerQueries from '@tailwindcss/container-queries'

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // ... rest from spec Section 2.1, using `forms` and `containerQueries` in plugins array
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds (Tailwind is installed but not yet imported).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tailwind.config.js postcss.config.js
git commit -m "chore: install tailwind css v3, react router, and plugins"
```

---

### Task 2: Create global CSS and update index.html

**Files:**
- Create: `src/index.css`
- Modify: `index.html`
- Modify: `src/main.jsx`

- [ ] **Step 1: Create `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { @apply dark; }
  body {
    @apply bg-background text-on-background font-body min-h-screen;
    @apply selection:bg-primary selection:text-on-primary;
  }
}

@layer components {
  .glass-panel {
    background: rgba(52, 52, 60, 0.6);
    backdrop-filter: blur(24px);
  }
  .glass-card {
    background: rgba(52, 52, 60, 0.4);
    backdrop-filter: blur(16px);
  }
  .obsidian-shadow {
    box-shadow: 0 40px 40px rgba(228, 225, 236, 0.06);
  }
  .gold-gradient {
    background: linear-gradient(135deg, #ffc66b 0%, #e8a838 100%);
  }
  .gold-gradient-text {
    background: linear-gradient(135deg, #ffc66b 0%, #e8a838 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .gold-glow {
    box-shadow: 0 0 30px rgba(253, 186, 73, 0.15);
  }
}

@layer utilities {
  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
}
```

- [ ] **Step 2: Update `index.html`**

Replace the `<style>` block in `<head>` with minimal reset (Tailwind handles the rest). Add Google Fonts and Material Symbols links. Update `theme-color` to `#13131A`.

```html
<!-- Add BEFORE </head>, replacing the existing <style> block -->
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link crossorigin href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Barlow+Condensed:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;700&family=Russo+One&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { min-height: 100vh; }
</style>
```

- [ ] **Step 3: Update `src/main.jsx`**

Add `import './index.css'` and remove the Tabler Icons import:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// ... rest unchanged
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds. Tailwind CSS is now active.

- [ ] **Step 5: Commit**

```bash
git add src/index.css index.html src/main.jsx
git commit -m "feat: add tailwind css global styles and material symbols fonts"
```

---

## Phase 1: Foundation Extraction

### Task 3: Extract `lib/supabase.js`

**Files:**
- Create: `src/lib/supabase.js`
- Modify: `src/App.jsx` (add import, remove extracted code)

- [ ] **Step 1: Read the Supabase client initialization from App.jsx**

Search for `createClient` in App.jsx. It should be near the top (imports section, lines 0-8). Extract the Supabase URL and key environment variables and the `createClient` call.

- [ ] **Step 2: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3: Update App.jsx imports**

Replace the inline Supabase init with `import { supabase } from './lib/supabase'`. Remove the old `createClient` call.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.js src/App.jsx
git commit -m "refactor: extract supabase client to lib/supabase.js"
```

---

### Task 4: Extract `lib/constants.js`

**Files:**
- Create: `src/lib/constants.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Extract all constants from App.jsx lines 86-1211**

Move these to `src/lib/constants.js`:
- `RANKS` (line 88)
- `RCOLS` / rank colors (line 90)
- `REGIONS` (line 92)
- `PTS` (line 96)
- `DEFAULT_SEASON_CONFIG` (lines 98-116)
- `TIERS` (line 118)
- `CLASH_RANKS` (lines 151-171)
- `XP_REWARDS` (lines 177-197)
- `TIERS_FEATURES` (lines 380-438)
- `HOMIES_IDS` (line 1146)
- `SEED` player roster (line 1148)
- `PAST_CLASHES` (line 1150)
- `SEASON_CHAMPION` (line 1163)
- `PREMIUM_TIERS` (lines 1173-1211)
- `DATA_VERSION` and debug constants (lines 5-13)
- `RULES_SECTIONS` (line 17942-17951)
- `FAQ_DATA` (before FAQScreen)

Export each as a named export.

- [ ] **Step 2: Update App.jsx**

Add `import { PTS, RANKS, RCOLS, ... } from './lib/constants'` at the top. Remove the extracted constant definitions.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.js src/App.jsx
git commit -m "refactor: extract constants to lib/constants.js"
```

---

### Task 5: Extract `lib/utils.js`

**Files:**
- Create: `src/lib/utils.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Extract small utility functions**

Move these from App.jsx to `src/lib/utils.js`:
- `sanitize()` (line 123)
- `rc()` (line 125)
- `tier()` (line 127)
- `avgCol()` (lines 133-145)
- `ordinal()` (line 3060)
- `shareToTwitter()` (lines 3062-3065)
- `buildShareText()` (lines 3067-3078)
- `isValidRiotId()` (lines 13314-13317)

These functions may reference constants - import them from `./constants`.

- [ ] **Step 2: Update App.jsx imports**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils.js src/App.jsx
git commit -m "refactor: extract utility functions to lib/utils.js"
```

---

### Task 6: Extract `lib/stats.js`

**Files:**
- Create: `src/lib/stats.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Extract stats engine functions**

Move these to `src/lib/stats.js`:
- `computeStats()` (lines 233-331)
- `computeH2H()` (lines 335-365)
- `_statsCache` WeakMap + `getStats()` (lines 370-378)
- `effectivePts()` (lines 457-502)
- `tiebreaker()` (lines 506-539)
- `isComebackEligible()` (lines 543-573)
- `getAttendanceStreak()` (lines 577-597)
- `computeSeasonBonuses()` (lines 601-647)
- `getAchievements()` (line 744)
- `checkAchievements()` (lines 746-771)
- `syncAchievements()` (lines 773-781)
- `isHotStreak()` (line 802)
- `isOnTilt()` (line 806)
- `computeClashAwards()` (lines 971-1068)
- `generateRecap()` (lines 1072-1143)

Import constants from `./constants` as needed.

- [ ] **Step 2: Extract tournament engine to `lib/tournament.js`**

Move these to `src/lib/tournament.js`:
- `T_PHASE` (lines 813-821)
- `T_TRANSITIONS` (lines 824-831)
- `canTransition()` (lines 833-835)
- `TOURNAMENT_FORMATS` (lines 838-843)
- `snakeSeed()` (lines 848-858)
- `buildLobbies()` (lines 861-881)
- `buildFlashLobbies()` (lines 884-913)
- `applyCutLine()` (lines 917-929)
- `suggestedCutLine()` (lines 932-937)
- `computeTournamentStandings()` (lines 940-964)

- [ ] **Step 3: Extract subscription/tier helpers**

Move to `src/lib/tiers.js`:
- `getUserTier()` (lines 440-450)
- `hasFeature()` (lines 452-455)

- [ ] **Step 4: Update App.jsx imports and remove extracted code**

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stats.js src/lib/tournament.js src/lib/tiers.js src/App.jsx
git commit -m "refactor: extract stats engine, tournament logic, and tier helpers"
```

---

### Task 7: Extract `lib/notifications.js`

**Files:**
- Create: `src/lib/notifications.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Extract notification helpers**

Move to `src/lib/notifications.js`:
- `writeActivityEvent()` (lines 783-791)
- `createNotification()` (lines 794-800)

These depend on `supabase` - import from `./supabase`.

- [ ] **Step 2: Update App.jsx and verify build**

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications.js src/App.jsx
git commit -m "refactor: extract notification helpers to lib/notifications.js"
```

---

### Task 8: Extract `context/AppContext.jsx`

**Files:**
- Create: `src/context/AppContext.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Read the TFTClash root component (lines 18686-19912)**

Identify all `useState`, `useEffect`, `useCallback`, `useMemo`, and `useRef` calls. These are the shared state that needs to move to context.

- [ ] **Step 2: Create `src/context/AppContext.jsx`**

Create a React context with provider that holds all shared state:
- `players`, `setPlayers`
- `currentUser`, `setCurrentUser`
- `screen` -> will become router-based (keep temporarily for backward compat)
- `tournamentState`, `setTournamentState`
- `notifications`, `setNotifications`
- `seasonConfig`, `setSeasonConfig`
- `quickClashes`, `setQuickClashes`
- `hostApps`, `hostTournaments`
- `featuredEvents`
- `challengeCompletions`
- `subscriptions`
- `isAdmin`, `setIsAdmin`
- `announcement`
- All Supabase realtime subscriptions (useEffect blocks)

Import from `../lib/supabase`, `../lib/constants`, `../lib/stats`.

Export `AppProvider` and `useApp` hook.

- [ ] **Step 3: Wrap App in AppProvider**

In App.jsx, wrap the root render in `<AppProvider>`.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/context/AppContext.jsx src/App.jsx
git commit -m "refactor: extract shared state to AppContext provider"
```

---

### Task 8.5: Extract custom hooks

**Files:**
- Create: `src/hooks/useAuth.js`
- Create: `src/hooks/usePlayers.js`
- Create: `src/hooks/useTournaments.js`
- Create: `src/hooks/useNotifications.js`
- Create: `src/hooks/useAdmin.js`
- Create: `src/hooks/useSubscriptions.js`
- Create: `src/hooks/useSeason.js`

- [ ] **Step 1: Create domain-specific hooks that consume AppContext**

Each hook wraps `useApp()` and exposes only the relevant slice of state + actions:

- `useAuth()` - returns `{ currentUser, login, logout, isLoggedIn }`
- `usePlayers()` - returns `{ players, getPlayerByName, getPlayerById }`
- `useTournaments()` - returns `{ tournamentState, quickClashes, register, unregister }`
- `useNotifications()` - returns `{ notifications, addNotification, dismissNotification }`
- `useAdmin()` - returns `{ isAdmin, siteSettings, updateSettings }`
- `useSubscriptions()` - returns `{ subscriptions, getUserTier, hasFeature }`
- `useSeason()` - returns `{ seasonConfig, currentWeek }`

Screens should import these hooks, NOT `useApp()` directly.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/
git commit -m "refactor: add domain-specific hooks wrapping AppContext"
```

---

### Task 9: Set up React Router

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Wrap app in BrowserRouter**

In `src/main.jsx`:
```jsx
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [ ] **Step 2: Set up Routes in App.jsx**

Replace the hash-based screen switching in TFTClash with React Router `<Routes>` and `<Route>`. For now, each route renders the existing screen component inline (they haven't been extracted yet).

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'

// Inside the root component render:
<Routes>
  <Route path="/" element={currentUser ? <DashboardContent /> : <HomeContent />} />
  <Route path="/login" element={<LoginContent />} />
  <Route path="/signup" element={<SignUpContent />} />
  <Route path="/standings" element={<StandingsContent />} />
  <Route path="/leaderboard" element={<LeaderboardContent />} />
  <Route path="/bracket/:id?" element={<BracketContent />} />
  <Route path="/player/:name" element={<PlayerProfileContent />} />
  {/* ... all other routes */}
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

The `*Content` components are temporary wrappers around the existing inline screen code. They'll be replaced in Phase 3 as each screen gets its own file.

- [ ] **Step 3: Replace `setScreen()` calls with `useNavigate()` (bulk operation)**

Search for `setScreen(` in App.jsx - there will be many call sites (50-100+). **Do NOT replace them all at once.** Instead:
1. In the root TFTClash component, replace the screen-switching logic with `<Routes>`
2. In the Navbar component, replace `setScreen` with `navigate()` calls (this is the most critical)
3. For screen functions that haven't been extracted yet, add a `navigate` prop or use `useNavigate()` inside them temporarily
4. Remaining `setScreen` calls inside individual screens will be fixed when each screen is extracted in Phase 3

This is intentionally incremental - fixing every call site now would be fragile since the screen functions will be moved to their own files soon.

- [ ] **Step 4: Replace all hash-change listeners**

Remove `window.addEventListener('hashchange', ...)` and `window.location.hash` reads.

- [ ] **Step 5: Verify build and test navigation**

```bash
npm run build
npm run dev
```

Manually test: clicking nav links navigates to correct routes. Browser back/forward works.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/main.jsx
git commit -m "feat: migrate from hash routing to react router v6"
```

---

## Phase 2: UI Primitives

### Task 10: Build `components/ui/Icon.jsx`

**Files:**
- Create: `src/components/ui/Icon.jsx`

- [ ] **Step 1: Create the Icon component**

```jsx
export default function Icon({ name, fill = false, size = 24, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`
      }}
    >
      {name}
    </span>
  )
}
```

- [ ] **Step 2: Create icon name mapping**

Create `src/lib/iconMap.js` with the Tabler-to-Material mapping from the spec (Section 2.4). Export a `mapIcon(tablerName)` function that returns the Material Symbol name. This enables gradual migration - screens can keep using old names until they're rebuilt.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Icon.jsx src/lib/iconMap.js
git commit -m "feat: add Material Symbols Icon component and icon mapping"
```

---

### Task 11: Build `components/ui/Panel.jsx`

**Files:**
- Create: `src/components/ui/Panel.jsx`

- [ ] **Step 1: Create Panel with glass prop**

Single unified component matching spec Section 4.1:

```jsx
export default function Panel({ children, className = '', accent, glow, glass, ...props }) {
  const base = glass
    ? 'glass-panel border border-outline-variant/10'
    : 'bg-surface-container-low border border-outline-variant/10'
  const accentBorder = accent === 'gold' ? 'border-t-4 border-t-primary'
    : accent === 'purple' ? 'border-t-4 border-t-secondary'
    : accent === 'teal' ? 'border-t-4 border-t-tertiary'
    : ''
  const glowClass = glow ? 'gold-glow' : ''

  return (
    <div
      className={`${base} ${accentBorder} ${glowClass} rounded-sm p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
```

Usage: `<Panel>` for solid, `<Panel glass>` for glassmorphism.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Panel.jsx
git commit -m "feat: add Panel UI component with glass variant"
```

---

### Task 12: Build `components/ui/Btn.jsx`

**Files:**
- Create: `src/components/ui/Btn.jsx`

- [ ] **Step 1: Create Btn with variants**

Implement primary, secondary, ghost, destructive variants and sm/md/lg/xl sizes per spec Section 4.2.

```jsx
const variants = {
  primary: 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95',
  secondary: 'bg-surface-variant/20 border border-outline-variant/15 hover:bg-surface-variant',
  ghost: 'text-on-surface/60 hover:text-on-surface hover:bg-white/5',
  destructive: 'bg-error-container/20 text-error border border-error/20',
}

const sizes = {
  sm: 'py-2 px-4 text-xs',
  md: 'py-3 px-6 text-sm',
  lg: 'py-4 px-8 text-sm',
  xl: 'py-5 w-full text-sm',
}

export default function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`rounded-full font-sans font-bold uppercase tracking-widest transition-all duration-300 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/Btn.jsx
git commit -m "feat: add Btn component with variant and size support"
```

---

### Task 13: Build remaining UI primitives

**Files:**
- Create: `src/components/ui/Inp.jsx`
- Create: `src/components/ui/Badge.jsx`
- Create: `src/components/ui/Tag.jsx`
- Create: `src/components/ui/Progress.jsx`
- Create: `src/components/ui/Skeleton.jsx`
- Create: `src/components/ui/Toast.jsx`
- Create: `src/components/ui/StatCard.jsx`
- Create: `src/components/ui/Divider.jsx`

- [ ] **Step 1: Create `Inp.jsx`** per spec Section 4.3 (underline input style)

- [ ] **Step 2: Create `Badge.jsx`** per spec Section 4.5 (primary/tertiary/secondary/error variants)

- [ ] **Step 3: Create `Tag.jsx`** (similar to Badge but for rank/status tags)

- [ ] **Step 4: Create `Progress.jsx`** per spec Section 4.6 (linear progress with gradient fill)

- [ ] **Step 5: Create `Skeleton.jsx`** - loading placeholder with `bg-surface-container-high animate-pulse rounded-sm`

- [ ] **Step 6: Create `Toast.jsx`** - extract from App.jsx lines 2404-2430, restyle with Tailwind

- [ ] **Step 7: Create `StatCard.jsx`** per spec Section 4.4 (label + value + icon + trend)

- [ ] **Step 8: Create `Divider.jsx`** per spec Section 4.7 (optional label between border lines)

- [ ] **Step 9: Create barrel export `src/components/ui/index.js`**

```js
export { default as Panel } from './Panel'
// Panel supports glass prop: <Panel glass> for glassmorphism
export { default as Btn } from './Btn'
export { default as Inp } from './Inp'
export { default as Icon } from './Icon'
export { default as Badge } from './Badge'
export { default as Tag } from './Tag'
export { default as Progress } from './Progress'
export { default as Skeleton } from './Skeleton'
export { default as Toast } from './Toast'
export { default as StatCard } from './StatCard'
export { default as Divider } from './Divider'
```

- [ ] **Step 10: Verify build**

```bash
npm run build
```

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add all UI primitive components"
```

---

### Task 14: Build layout components

**Files:**
- Create: `src/components/layout/Navbar.jsx`
- Create: `src/components/layout/Sidebar.jsx`
- Create: `src/components/layout/MobileNav.jsx`
- Create: `src/components/layout/Footer.jsx`
- Create: `src/components/layout/PageLayout.jsx`

- [ ] **Step 1: Create `Navbar.jsx`**

Sticky top navbar per spec Section 3.1. Use `<Link>` from react-router-dom for navigation. Match the HTML design from `docs/UI-DESIGNS.html` lines 96-118.

Key elements:
- `sticky top-0 z-50 bg-[#13131A] obsidian-shadow`
- Logo: `font-headline text-2xl font-black text-primary tracking-tighter`
- Nav links: `hidden md:flex items-center gap-8`, each link is `font-sans uppercase tracking-wider text-sm`
- Active link: `text-primary border-b-2 border-primary pb-1 font-bold`
- Right side: notification icon, settings icon, user avatar
- Use `useLocation()` from react-router to determine active link
- Use `useApp()` context for currentUser (show avatar or login button)

- [ ] **Step 2: Create `Sidebar.jsx`**

Fixed left sidebar per spec Section 3.2. Desktop only (`hidden xl:flex flex-col`).

Key elements:
- `fixed left-0 top-0 h-full w-64 z-40 bg-[#13131A] border-r border-outline-variant/15 pt-24`
- Rank card at top: avatar + rank name + LP
- Nav links: `flex items-center gap-4 px-6 py-4`, Barlow Condensed uppercase
- Active: `bg-gradient-to-r from-primary/20 to-transparent text-primary border-l-4 border-primary`
- CTA button: `w-full gold-gradient text-on-primary rounded-full py-3`
- Footer: Support + Logout links
- Use `useLocation()` to highlight active link
- Use `useNavigate()` for link clicks

- [ ] **Step 3: Create `MobileNav.jsx`**

Fixed bottom nav per spec Section 3.3. Mobile only (`md:hidden flex`).

Key elements:
- `fixed bottom-0 left-0 w-full z-50 bg-[#13131A]/95 backdrop-blur-xl border-t border-outline-variant/15`
- `flex justify-around items-center px-4 pb-6 pt-3`
- 5 items: Home, Events, Clash (highlighted), Recap, Account
- Active item: `bg-primary text-on-primary rounded-xl px-4 py-1`
- Labels: `text-[10px] uppercase font-bold font-sans`
- Use `useLocation()` to determine active item

- [ ] **Step 4: Create `Footer.jsx`**

Per spec Section 3.5:
- `bg-surface-container-lowest border-t border-outline-variant/10`
- Copyright, nav links, branding
- `hidden` when MobileNav is shown (use `md:block hidden`)

- [ ] **Step 5: Create `PageLayout.jsx`**

Orchestrates all layout components per spec Section 3.4:

```jsx
import { useApp } from '../../context/AppContext'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Footer from './Footer'

export default function PageLayout({ children, showSidebar = true, maxWidth = 'max-w-7xl' }) {
  const { currentUser } = useApp()
  const isLoggedIn = !!currentUser
  const showSide = isLoggedIn && showSidebar

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {showSide && <Sidebar />}
      <main className={`pt-20 pb-24 md:pb-12 px-4 md:px-8 ${showSide ? 'xl:ml-64' : ''}`}>
        <div className={`${maxWidth} mx-auto`}>
          {children}
        </div>
      </main>
      <Footer />
      {isLoggedIn && <MobileNav />}
    </div>
  )
}
```

- [ ] **Step 6: Create barrel export `src/components/layout/index.js`**

- [ ] **Step 7: Verify build**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add layout components (navbar, sidebar, mobile nav, footer, page layout)"
```

---

### Task 15: Build shared components

**Files:**
- Create: `src/components/shared/StandingsTable.jsx`
- Create: `src/components/shared/PlayerCard.jsx`
- Create: `src/components/shared/CountdownTimer.jsx`
- Create: `src/components/shared/RankBadge.jsx`
- Create: `src/components/shared/Podium.jsx`
- Create: `src/components/shared/PageHeader.jsx`

- [ ] **Step 1: Create `PageHeader.jsx`**

Reusable page header per spec Section 6:

```jsx
export default function PageHeader({ title, subtitle, description, goldWord }) {
  return (
    <header className="text-center mb-16 relative">
      {subtitle && (
        <div className="inline-block mb-4 px-6 py-1 bg-tertiary-container/10 text-tertiary font-sans uppercase tracking-[0.2em] text-sm border border-tertiary/20 rounded-sm">
          {subtitle}
        </div>
      )}
      <h1 className="text-5xl md:text-7xl font-serif font-black tracking-tight leading-none mb-4">
        {goldWord ? (
          <>{title} <span className="gold-gradient-text">{goldWord}</span></>
        ) : title}
      </h1>
      {description && (
        <p className="max-w-2xl mx-auto text-on-surface-variant text-lg leading-relaxed italic">
          {description}
        </p>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Create `RankBadge.jsx`**

Tier badge with color from rank colors:
```jsx
import { RCOLS } from '../../lib/constants'

export default function RankBadge({ rank, className = '' }) {
  const color = RCOLS[rank] || '#9AAABF'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-sans uppercase tracking-widest border ${className}`}
      style={{ color, borderColor: `${color}33`, backgroundColor: `${color}1a` }}
    >
      {rank}
    </span>
  )
}
```

- [ ] **Step 3: Create `CountdownTimer.jsx`**

Extract countdown logic from HomeScreen. Glass panel with monospace numbers.

- [ ] **Step 4: Create `PlayerCard.jsx`**

Player name + avatar + rank + key stat. Used in leaderboard rows and player lists.

- [ ] **Step 5: Create `Podium.jsx`**

Top-3 podium visualization per spec Section 5.3 leaderboard. Three columns with avatar circles, names, LP, and height bars.

- [ ] **Step 6: Create `StandingsTable.jsx`**

Extract from App.jsx lines 3789-4471. Restyle with Tailwind classes matching the design. Keep all the existing sort/filter logic.

- [ ] **Step 7: Create barrel export `src/components/shared/index.js`**

- [ ] **Step 8: Verify build**

- [ ] **Step 9: Commit**

```bash
git add src/components/shared/
git commit -m "feat: add shared components (standings table, podium, countdown, etc.)"
```

---

## Phase 3: Screen Migration

> For each screen: extract from App.jsx into its own file, replace inline styles with Tailwind, match the HTML design reference. Import shared components and UI primitives. Wrap in `<PageLayout>`.

### Task 16: Migrate LoginScreen and SignUpScreen

**Files:**
- Create: `src/screens/LoginScreen.jsx`
- Create: `src/screens/SignUpScreen.jsx`
- Modify: `src/App.jsx` (update route to use new component)

- [ ] **Step 1: Create `LoginScreen.jsx`**

Extract from App.jsx lines 13532-13694. Rebuild using Tailwind classes matching the Auth design (docs/UI-DESIGNS.html page 22). Use `<PageLayout showSidebar={false}>`. Structure per spec Section 5.7:
- Brand header with logo
- Auth card: `max-w-[480px] bg-surface-container-low p-10`
- Decorative top accent line
- Form with Inp components (underline style)
- Social login buttons (Discord, Riot ID)
- Footer with signup link

Keep all existing auth logic (Supabase auth calls, form validation, error handling).

- [ ] **Step 2: Create `SignUpScreen.jsx`**

Extract from App.jsx lines 13319-13528. Same design pattern as LoginScreen but with registration fields.

- [ ] **Step 3: Update App.jsx routes**

Replace inline login/signup rendering with:
```jsx
import LoginScreen from './screens/LoginScreen'
import SignUpScreen from './screens/SignUpScreen'

<Route path="/login" element={<LoginScreen />} />
<Route path="/signup" element={<SignUpScreen />} />
```

Remove the old LoginScreen and SignUpScreen functions from App.jsx.

- [ ] **Step 4: Verify build and test auth flow**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/LoginScreen.jsx src/screens/SignUpScreen.jsx src/App.jsx
git commit -m "feat: migrate login and signup screens with new UI design"
```

---

### Task 17: Migrate HomeScreen (guest)

**Files:**
- Create: `src/screens/HomeScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `HomeScreen.jsx`**

Extract guest landing from App.jsx lines 4476-5664 (the guest branch). Match Guest Home design (page 16 in UI-DESIGNS.html). Per spec Section 5.1:
- Background atmosphere gradient
- Hero header with serif title
- Countdown timer (use CountdownTimer component)
- Feature cards grid
- CTA section

Use `<PageLayout showSidebar={false}>`.

- [ ] **Step 2: Update App.jsx route**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.jsx src/App.jsx
git commit -m "feat: migrate guest home screen with new landing design"
```

---

### Task 18: Create DashboardScreen (logged-in home)

**Files:**
- Create: `src/screens/DashboardScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `DashboardScreen.jsx`**

Extract logged-in home content from App.jsx HomeScreen. Match Dashboard design (page 14 in UI-DESIGNS.html). Per spec Section 5.2:
- Pulse header with user avatar, name, season info
- Stats row: 5-column grid (3:2 split)
- Upcoming clash section
- Recent results mini table
- Challenges preview

Use `<PageLayout>` (with sidebar).

- [ ] **Step 2: Update App.jsx route**

```jsx
<Route path="/" element={currentUser ? <DashboardScreen /> : <HomeScreen />} />
```

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add src/screens/DashboardScreen.jsx src/App.jsx
git commit -m "feat: add dashboard screen for logged-in users"
```

---

### Task 19: Migrate LeaderboardScreen

**Files:**
- Create: `src/screens/LeaderboardScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `LeaderboardScreen.jsx`**

Extract from App.jsx lines 7518-7885. Match Leaderboard design (page 10 in UI-DESIGNS.html). Per spec Section 5.3:
- Page header
- Podium section (use Podium component)
- Filter bar (region, tier, search)
- Rankings table

Use `<PageLayout>`.

- [ ] **Step 2: Update route, remove old code from App.jsx**

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add src/screens/LeaderboardScreen.jsx src/App.jsx
git commit -m "feat: migrate leaderboard screen with podium design"
```

---

### Task 20: Migrate PlayerProfileScreen

**Files:**
- Create: `src/screens/PlayerProfileScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `PlayerProfileScreen.jsx`**

Extract from App.jsx lines 6700-7508. Match Player Profile design (page 7 in UI-DESIGNS.html). Per spec Section 5.4:
- Hero banner with gradient overlays
- Profile overlay (avatar, name, rank, actions)
- Stats grid (4-column StatCards)
- Match history table
- Achievements grid
- Placement distribution bars

Use `<PageLayout>`. Get player name from `useParams()`.

- [ ] **Step 2: Update route**

```jsx
<Route path="/player/:name" element={<PlayerProfileScreen />} />
```

- [ ] **Step 3: Verify build**

- [ ] **Step 4: Commit**

```bash
git add src/screens/PlayerProfileScreen.jsx src/App.jsx
git commit -m "feat: migrate player profile with hero banner design"
```

---

### Task 21: Migrate StandingsScreen

**Files:**
- Create: `src/screens/StandingsScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `StandingsScreen.jsx`**

Uses the shared StandingsTable component. Per spec Section 12.1:
- Page header: "Season Standings"
- Season info bar
- Tier filter tabs
- Full StandingsTable

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/StandingsScreen.jsx src/App.jsx
git commit -m "feat: migrate standings screen"
```

---

### Task 22: Migrate BracketScreen

**Files:**
- Create: `src/screens/BracketScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `BracketScreen.jsx`**

Extract from App.jsx lines 5670-6698. Match Bracket design (page 12 in UI-DESIGNS.html). Per spec Section 5.5. Preserve existing bracket rendering logic (this is complex custom code). Restyle containers with Tailwind.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/BracketScreen.jsx src/App.jsx
git commit -m "feat: migrate bracket screen with new styling"
```

---

### Task 23: Migrate EventsScreen

**Files:**
- Create: `src/screens/EventsScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `EventsScreen.jsx`**

Match Events design (page 9 in UI-DESIGNS.html). Per spec Section 5.11:
- Page header: "Community Events"
- Featured event hero card
- Event cards grid

Extract relevant event display code from HomeScreen/App.jsx.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/EventsScreen.jsx src/App.jsx
git commit -m "feat: migrate events screen"
```

---

### Task 24: Migrate PricingScreen

**Files:**
- Create: `src/screens/PricingScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `PricingScreen.jsx`**

Extract from App.jsx lines 12456-12546. Match Pricing design (page 1 in UI-DESIGNS.html). Per spec Section 5.6. Use correct prices: $0/$4.99/$19.99.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/PricingScreen.jsx src/App.jsx
git commit -m "feat: migrate pricing screen with tier cards design"
```

---

### Task 25: Migrate ResultsScreen and ClashReportScreen

**Files:**
- Create: `src/screens/ResultsScreen.jsx`
- Create: `src/screens/ClashReportScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `ResultsScreen.jsx`**

Extract from App.jsx lines 8071-8520. Match Clash Report design (page 8 in UI-DESIGNS.html).

- [ ] **Step 2: Create `ClashReportScreen.jsx`**

Extract from App.jsx lines 7895-8065. Restyle with Tailwind.

- [ ] **Step 3: Update routes, verify, commit**

```bash
git add src/screens/ResultsScreen.jsx src/screens/ClashReportScreen.jsx src/App.jsx
git commit -m "feat: migrate results and clash report screens"
```

---

### Task 26: Migrate HofScreen

**Files:**
- Create: `src/screens/HofScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `HofScreen.jsx`**

Extract from App.jsx lines 8540-9049. Match Hall of Fame design (page 11 in UI-DESIGNS.html). Per spec Section 5.9.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/HofScreen.jsx src/App.jsx
git commit -m "feat: migrate hall of fame screen"
```

---

### Task 27: Migrate MilestonesScreen and ChallengesScreen

**Files:**
- Create: `src/screens/MilestonesScreen.jsx`
- Create: `src/screens/ChallengesScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `MilestonesScreen.jsx`**

Extract from App.jsx lines 12552-12985. Match Milestones design (page 6 in UI-DESIGNS.html). Per spec Section 5.13.

- [ ] **Step 2: Create `ChallengesScreen.jsx`**

Extract from App.jsx lines 12998-13308. Match Challenges design (page 13 in UI-DESIGNS.html). Per spec Section 5.14. Include the `getDailyReset`/`getWeeklyReset` helper functions.

- [ ] **Step 3: Update routes, verify, commit**

```bash
git add src/screens/MilestonesScreen.jsx src/screens/ChallengesScreen.jsx src/App.jsx
git commit -m "feat: migrate milestones and challenges screens"
```

---

### Task 28: Migrate SeasonRecapScreen

**Files:**
- Create: `src/screens/SeasonRecapScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `SeasonRecapScreen.jsx`**

Extract from App.jsx lines 14658-14999. Match Season Recap design (page 2 in UI-DESIGNS.html). Per spec Section 5.15.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/SeasonRecapScreen.jsx src/App.jsx
git commit -m "feat: migrate season recap screen"
```

---

### Task 29: Migrate ArchiveScreen

**Files:**
- Create: `src/screens/ArchiveScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `ArchiveScreen.jsx`**

Extract from App.jsx lines 9055-9205. Match Archive design (page 4 in UI-DESIGNS.html). Per spec Section 5.10.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/ArchiveScreen.jsx src/App.jsx
git commit -m "feat: migrate archive screen"
```

---

### Task 30: Migrate RulesScreen and FAQScreen

**Files:**
- Create: `src/screens/RulesScreen.jsx`
- Create: `src/screens/FAQScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `RulesScreen.jsx`**

Extract from App.jsx lines 17953-18065. Match Rules design (page 3 in UI-DESIGNS.html). Per spec Section 5.16. Move `RULES_SECTIONS` constant to this file or to `lib/constants.js`.

- [ ] **Step 2: Create `FAQScreen.jsx`**

Extract from App.jsx lines 18066-18243. Match FAQ design (page 15 in UI-DESIGNS.html). Per spec Section 5.17. Implement accordion with `useState` for open/close. Move `FAQ_DATA` constant.

- [ ] **Step 3: Update routes, verify, commit**

```bash
git add src/screens/RulesScreen.jsx src/screens/FAQScreen.jsx src/App.jsx
git commit -m "feat: migrate rules and faq screens with accordion design"
```

---

### Task 31: Migrate AccountScreen

**Files:**
- Create: `src/screens/AccountScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `AccountScreen.jsx`**

Extract from App.jsx lines 13698-14650. Match Account Settings design (page 18 in UI-DESIGNS.html). Per spec Section 5.18. Keep all existing profile edit, Riot ID linking, and subscription logic.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/AccountScreen.jsx src/App.jsx
git commit -m "feat: migrate account settings screen"
```

---

### Task 32: Migrate ScrimsScreen

**Files:**
- Create: `src/screens/ScrimsScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `ScrimsScreen.jsx`**

Extract from App.jsx lines 11175-12450. Match Scrims design (page 5 in UI-DESIGNS.html). Per spec Section 5.12. Include helper functions and ScrimSparkline sub-component. Keep admin gating.

- [ ] **Step 2: Update route, verify, commit**

```bash
git add src/screens/ScrimsScreen.jsx src/App.jsx
git commit -m "feat: migrate scrims screen"
```

---

### Task 33: Migrate AdminScreen

**Files:**
- Create: `src/screens/AdminScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `AdminScreen.jsx`**

Extract from App.jsx lines 9315-11112. Match Admin Command Center design (page 21 in UI-DESIGNS.html). Per spec Section 5.8. This is the largest screen (~1800 lines). Include `setPlayerTier` helper. Keep all admin functionality (player management, tournament config, announcements, site settings).

Consider splitting into sub-components within the file if over 800 lines:
- `AdminScreen.jsx` (main shell + routing between admin tabs)
- Internal components: PlayerManagement, TournamentManagement, Announcements, SiteSettings

- [ ] **Step 2: Update route with admin gate, verify, commit**

```bash
git add src/screens/AdminScreen.jsx src/App.jsx
git commit -m "feat: migrate admin command center screen"
```

---

### Task 34: Migrate HostApplyScreen and HostDashboardScreen

**Files:**
- Create: `src/screens/HostApplyScreen.jsx`
- Create: `src/screens/HostDashboardScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `HostApplyScreen.jsx`**

Extract from App.jsx lines 15149-15299. Match Host Apply design (page 19 in UI-DESIGNS.html). Per spec Section 5.19.

- [ ] **Step 2: Create `HostDashboardScreen.jsx`**

Extract from App.jsx lines 15305-17952. Match Host Dashboard design (page 20 in UI-DESIGNS.html). Per spec Section 5.20. This is a large screen (~2650 lines). Consider splitting into sub-components.

- [ ] **Step 3: Update routes, verify, commit**

```bash
git add src/screens/HostApplyScreen.jsx src/screens/HostDashboardScreen.jsx src/App.jsx
git commit -m "feat: migrate host apply and host dashboard screens"
```

---

### Task 35: Migrate PrivacyScreen and TermsScreen

**Files:**
- Create: `src/screens/PrivacyScreen.jsx`
- Create: `src/screens/TermsScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `PrivacyScreen.jsx` and `TermsScreen.jsx`**

Extract from App.jsx lines 18247+. Simple content pages. Match Privacy/Terms design (page 17 in UI-DESIGNS.html). Per spec Section 5.21. Serif headings, body text, last-updated date.

- [ ] **Step 2: Update routes, verify, commit**

```bash
git add src/screens/PrivacyScreen.jsx src/screens/TermsScreen.jsx src/App.jsx
git commit -m "feat: migrate privacy and terms screens"
```

---

### Task 36: Migrate remaining screens

**Files:**
- Create: `src/screens/FlashTournamentScreen.jsx`
- Create: `src/screens/TournamentDetailScreen.jsx`
- Create: `src/screens/TournamentsListScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `FlashTournamentScreen.jsx`**

Extract from App.jsx. Search for `FlashTournament` or `flash` in screen routing. The flash tournament code is part of the HostDashboardScreen area (lines ~15305-17952) and uses `buildFlashLobbies()` from `lib/tournament.js`. Match spec Section 12.2: registration panel, lobby management, live bracket, results.

- [ ] **Step 2: Create `TournamentDetailScreen.jsx`**

Extract tournament detail display code. Search for `TournamentDetail` in App.jsx routing. This renders a single tournament's info, registered players, schedule, and results. Match spec Section 12.3.

- [ ] **Step 3: Create `TournamentsListScreen.jsx`**

Extract tournaments list code. Search for `TournamentsList` in App.jsx routing. This is a grid of tournament cards with filters. Match spec Section 12.4. May need to be partially built new if the current app only shows tournaments inline on other screens.

- [ ] **Step 4: Update routes, verify, commit**

```bash
git add src/screens/FlashTournamentScreen.jsx src/screens/TournamentDetailScreen.jsx src/screens/TournamentsListScreen.jsx src/App.jsx
git commit -m "feat: migrate tournament screens"
```

---

## Phase 4: Cleanup

### Task 37: Remove old code and finalize App.jsx

**Files:**
- Modify: `src/App.jsx` (should now be ~100-200 lines)
- Delete or archive: old inline components

- [ ] **Step 1: Verify all screens are extracted**

Check that App.jsx only contains:
- Imports (React, Router, Context, Screens)
- Error boundary wrappers
- Route definitions
- No screen component functions remaining

- [ ] **Step 2: Remove GCSS template literal**

The entire GCSS block (lines 1217-1997 originally) should no longer be needed. All styles are now Tailwind classes. Remove it.

- [ ] **Step 3: Remove old atom components**

Old Panel, Btn, Inp, BI, Hexbg, etc. should be replaced by the new `components/ui/` versions. Remove them from App.jsx.

- [ ] **Step 4: Remove Tabler icon imports and references**

- [ ] **Step 5: Clean up App.jsx**

Final App.jsx should be roughly:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
// ... screen imports
// ... error boundary import

export default function App() {
  return (
    <AppProvider>
      <Routes>
        {/* all routes */}
      </Routes>
    </AppProvider>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: clean up app.jsx, remove gcss and old components"
```

---

### Task 38: Update index.html and main.jsx

**Files:**
- Modify: `index.html`
- Modify: `src/main.jsx`

- [ ] **Step 1: Update `index.html` theme-color**

Change `#08080F` to `#13131A` in the theme-color meta tag.

- [ ] **Step 2: Remove Tabler import from `main.jsx`**

Ensure `import '@tabler/icons-webfont/dist/tabler-icons.min.css'` is removed.

- [ ] **Step 3: Uninstall Tabler package**

```bash
npm uninstall @tabler/icons-webfont
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.jsx package.json package-lock.json
git commit -m "chore: remove tabler icons, update theme color"
```

---

### Task 39: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect new architecture**

Update the following sections:
- **Active Working File:** Change from single `App.jsx` to describe the modular structure
- **Product Identity:** Update color palette to new Material Design 3 tokens
- **File Structure:** Replace the old line-number table with the new directory structure
- **CRITICAL TECHNICAL RULES:** Remove rules specific to the monolith (GCSS, brace balance, IIFEs in JSX). Add new rules (Tailwind class conventions, component naming).
- **Navigation Screens:** Update with new routes

- [ ] **Step 2: Verify, commit**

```bash
git add CLAUDE.md
git commit -m "docs: update claude.md for new modular architecture"
```

---

### Task 40: Full integration test

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: Run dev server and test all routes**

```bash
npm run dev
```

Manually navigate to every route and verify:
- [ ] `/` (guest) - landing page renders
- [ ] `/login` - auth form renders
- [ ] `/signup` - registration form renders
- [ ] `/standings` - standings table loads
- [ ] `/leaderboard` - podium + table renders
- [ ] `/player/Levitate` - profile loads
- [ ] `/bracket` - bracket renders
- [ ] `/events` - event grid renders
- [ ] `/pricing` - tier cards render
- [ ] `/results` - results render
- [ ] `/hall-of-fame` - HoF renders
- [ ] `/milestones` - milestones render
- [ ] `/challenges` - challenges render
- [ ] `/season-recap` - recap renders
- [ ] `/archive` - archive renders
- [ ] `/rules` - rules render
- [ ] `/faq` - FAQ accordion works
- [ ] `/account` - settings render
- [ ] `/scrims` - scrims render (admin)
- [ ] `/admin` - admin panel renders (admin)
- [ ] `/host/apply` - host form renders
- [ ] `/host/dashboard` - host dashboard renders
- [ ] `/privacy` - privacy text renders
- [ ] `/terms` - terms text renders
- [ ] Responsive: sidebar hides below xl, mobile nav shows below md
- [ ] Navigation: all links work, active states correct

- [ ] **Step 3: Content rules verification**

```bash
# Check for em/en dashes in user-facing strings
grep -rn "[—–]" src/screens/ src/components/
# Check pricing values are correct ($0, $4.99, $19.99)
grep -rn '\$12\|\$29\|\$24\.99' src/
# Check excluded players are not present
grep -rn 'Denial\|Ribenardo' src/
```

Fix any violations found.

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete UI overhaul - all screens migrated and verified"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 0 | 1-2 | Infrastructure: Tailwind, fonts, CSS |
| 1 | 3-9 | Foundation: extract lib/, context/, hooks/, router |
| 2 | 10-15 | UI primitives + layout + shared components |
| 3 | 16-36 | Screen migration (21 tasks, one per screen or group) |
| 4 | 37-40 | Cleanup, CLAUDE.md update, integration test |

**Total: 40 tasks**
