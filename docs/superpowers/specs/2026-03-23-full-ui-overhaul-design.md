# TFT Clash: Full UI Overhaul Design Spec

> **Date:** 2026-03-23
> **Scope:** Complete decomposition of monolithic App.jsx into modular component architecture, Tailwind CSS migration, React Router integration, and pixel-perfect implementation of 22 new page designs.

---

## 1. ARCHITECTURE

### 1.1 From Monolith to Modules

The current `src/App.jsx` (~20K lines, inline styles, hash routing, GCSS template literal) is decomposed into ~50 focused files organized by feature.

```
src/
├── App.jsx                    # Router setup, providers, global state
├── main.jsx                   # Entry point (unchanged)
├── index.css                  # Tailwind directives + custom utilities
│
├── lib/
│   ├── supabase.js            # Supabase client init
│   ├── constants.js           # PTS, RANKS, SEASON_CHAMPION, seed data, rankColors
│   ├── stats.js               # computeStats(), tiebreakers, placement logic
│   └── utils.js               # formatDate, ordinal, small helpers
│
├── hooks/
│   ├── useAuth.js             # Auth state, login/logout, currentUser
│   ├── usePlayers.js          # Players realtime subscription
│   ├── useTournaments.js      # Tournament state, registrations, quickClashes
│   ├── useNotifications.js    # Toast system
│   ├── useAdmin.js            # Admin flag, site settings
│   ├── useSubscriptions.js    # Stripe tier status
│   └── useSeason.js           # Season config, drop weeks, boosts
│
├── context/
│   └── AppContext.jsx         # Shared state provider (players, user, season, etc.)
│
├── components/
│   ├── ui/                    # Design system primitives
│   │   ├── Panel.jsx
│   │   ├── GlassPanel.jsx
│   │   ├── Btn.jsx
│   │   ├── Inp.jsx
│   │   ├── Icon.jsx           # Material Symbols wrapper
│   │   ├── Badge.jsx
│   │   ├── Tag.jsx
│   │   ├── Progress.jsx
│   │   ├── Skeleton.jsx
│   │   ├── Toast.jsx
│   │   ├── StatCard.jsx
│   │   └── Divider.jsx
│   │
│   ├── layout/
│   │   ├── Navbar.jsx         # Top sticky navbar
│   │   ├── Sidebar.jsx        # Desktop left sidebar (NEW)
│   │   ├── MobileNav.jsx      # Bottom mobile navigation (NEW)
│   │   ├── Footer.jsx
│   │   └── PageLayout.jsx     # Orchestrates sidebar + content + responsive
│   │
│   └── shared/
│       ├── StandingsTable.jsx
│       ├── PlayerCard.jsx
│       ├── CountdownTimer.jsx
│       ├── RankBadge.jsx
│       └── Podium.jsx         # Top-3 podium display (NEW)
│
├── screens/
│   ├── HomeScreen.jsx         # Guest landing
│   ├── DashboardScreen.jsx    # Logged-in home (NEW split)
│   ├── StandingsScreen.jsx
│   ├── BracketScreen.jsx
│   ├── PlayerProfileScreen.jsx
│   ├── LeaderboardScreen.jsx
│   ├── ResultsScreen.jsx
│   ├── ClashReportScreen.jsx
│   ├── HofScreen.jsx
│   ├── ArchiveScreen.jsx
│   ├── EventsScreen.jsx
│   ├── ScrimsScreen.jsx
│   ├── PricingScreen.jsx
│   ├── MilestonesScreen.jsx
│   ├── ChallengesScreen.jsx
│   ├── SeasonRecapScreen.jsx
│   ├── RulesScreen.jsx
│   ├── FAQScreen.jsx
│   ├── AccountScreen.jsx
│   ├── LoginScreen.jsx
│   ├── SignUpScreen.jsx
│   ├── HostApplyScreen.jsx
│   ├── HostDashboardScreen.jsx
│   ├── AdminScreen.jsx
│   ├── PrivacyScreen.jsx
│   ├── TermsScreen.jsx
│   ├── FlashTournamentScreen.jsx
│   ├── TournamentDetailScreen.jsx
│   └── TournamentsListScreen.jsx
```

### 1.2 Routing (React Router v6)

**New dependency:** `react-router-dom@6`

```
/                        → HomeScreen (guest) | DashboardScreen (authed)
/login                   → LoginScreen
/signup                  → SignUpScreen
/standings               → StandingsScreen
/leaderboard             → LeaderboardScreen
/bracket/:id?            → BracketScreen
/player/:name            → PlayerProfileScreen
/results/:id?            → ResultsScreen
/clash-report/:id        → ClashReportScreen
/events                  → EventsScreen
/scrims                  → ScrimsScreen (admin-gated)
/pricing                 → PricingScreen
/milestones              → MilestonesScreen
/challenges              → ChallengesScreen
/hall-of-fame            → HofScreen
/archive                 → ArchiveScreen
/season-recap            → SeasonRecapScreen
/rules                   → RulesScreen
/faq                     → FAQScreen
/account                 → AccountScreen
/host/apply              → HostApplyScreen
/host/dashboard          → HostDashboardScreen
/admin                   → AdminScreen (admin-gated)
/privacy                 → PrivacyScreen
/terms                   → TermsScreen
/flash/:id               → FlashTournamentScreen
/tournament/:id          → TournamentDetailScreen
/tournaments             → TournamentsListScreen
```

Navigation helpers:
- `<Link>` and `useNavigate()` replace all `setScreen()` / `window.location.hash` calls
- Protected routes wrap admin/host screens with auth checks
- `useParams()` replaces `subRoute` state for dynamic segments

### 1.3 State Management

**AppContext provider** wraps the router and holds all shared state currently in the root `TFTClash` component:
- `players`, `currentUser`, `tournamentState`, `notifications`
- `seasonConfig`, `quickClashes`, `hostApps`, `hostTournaments`
- `featuredEvents`, `challengeCompletions`, `subscriptions`, `isAdmin`
- All Supabase realtime subscriptions initialize in `AppContext`

Custom hooks (`useAuth`, `usePlayers`, etc.) consume context and encapsulate domain logic. Screens import hooks, not raw context.

### 1.4 New Dependencies

| Package | Purpose |
|---------|---------|
| `react-router-dom` | Client-side routing |
| `tailwindcss` | Utility CSS framework |
| `postcss` + `autoprefixer` | Tailwind build pipeline |
| `@tailwindcss/forms` | Form reset plugin |
| `@tailwindcss/container-queries` | Container query support |

**Removed:**
- `@tabler/icons-webfont` (replaced by Google Material Symbols via CDN font link)

---

## 2. DESIGN SYSTEM

### 2.1 Tailwind Configuration

Exact config from the HTML designs:

```js
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#ffc66b",
        "primary-container": "#e8a838",
        "primary-fixed": "#ffddaf",
        "primary-fixed-dim": "#fdba49",
        "on-primary": "#432c00",
        "on-primary-container": "#5f3f00",
        "on-primary-fixed": "#281800",
        "on-primary-fixed-variant": "#614000",
        "secondary": "#d9b9ff",
        "secondary-container": "#5c348d",
        "secondary-fixed": "#eedcff",
        "secondary-fixed-dim": "#d9b9ff",
        "on-secondary": "#421773",
        "on-secondary-container": "#cea7ff",
        "on-secondary-fixed": "#2a0054",
        "on-secondary-fixed-variant": "#59328b",
        "tertiary": "#67e2d9",
        "tertiary-container": "#45c6bd",
        "tertiary-fixed": "#7cf6ec",
        "tertiary-fixed-dim": "#5dd9d0",
        "on-tertiary": "#003734",
        "on-tertiary-container": "#004f4a",
        "on-tertiary-fixed": "#00201e",
        "on-tertiary-fixed-variant": "#00504c",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        "surface": "#13131a",
        "surface-dim": "#13131a",
        "surface-bright": "#393841",
        "surface-tint": "#fdba49",
        "surface-variant": "#34343c",
        "surface-container-lowest": "#0e0d15",
        "surface-container-low": "#1b1b23",
        "surface-container": "#1f1f27",
        "surface-container-high": "#2a2931",
        "surface-container-highest": "#34343c",
        "on-surface": "#e4e1ec",
        "on-surface-variant": "#d5c4af",
        "on-background": "#e4e1ec",
        "background": "#13131a",
        "outline": "#9d8e7c",
        "outline-variant": "#504535",
        "inverse-surface": "#e4e1ec",
        "inverse-on-surface": "#303038",
        "inverse-primary": "#805600",
        // Semantic aliases
        "success": "#6ee7b7",
        "warning": "#fb923c",
      },
      fontFamily: {
        "display": ["Russo One", "sans-serif"],
        "headline": ["Space Grotesk", "sans-serif"],
        "serif": ["Playfair Display", "serif"],
        "sans": ["Barlow Condensed", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
    },
  },
  plugins: [
    // ESM imports - see Section 13 for import syntax
    forms,
    containerQueries,
  ],
}
```

### 2.2 Global CSS (`index.css`)

Replaces the entire GCSS template literal:

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

### 2.3 Font Loading

In `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Barlow+Condensed:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;700&family=Russo+One&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

### 2.4 Icon System

**Google Material Symbols Outlined** replaces Tabler Icons.

Wrapper component:
```jsx
// components/ui/Icon.jsx
function Icon({ name, fill, size = 24, className = '' }) {
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
  );
}
```

**Icon mapping** (Tabler to Material Symbols):

| Tabler | Material Symbol |
|--------|----------------|
| `trophy` | `military_tech` |
| `sword` | `swords` |
| `users` | `groups` |
| `chart-bar` | `leaderboard` |
| `calendar-event` | `event` |
| `settings` | `settings` |
| `bell` | `notifications` |
| `shield-check` | `verified_user` |
| `star` | `star` |
| `home` | `home` |
| `logout` | `logout` |
| `search` | `search` |
| `plus` | `add` |
| `refresh` | `refresh` |
| `filter` | `filter_list` |
| `chevron-right` | `chevron_right` |
| `check` | `check_circle` |
| `lock` | `lock` |
| `info-circle` | `info` |
| `alert-triangle` | `warning` |
| `crown` | `workspace_premium` |
| `share` | `share` |
| `user-plus` | `person_add` |
| `help-circle` | `help` |
| `dashboard` | `dashboard` |
| `account-tree` | `account_tree` |
| `sports-esports` | `sports_esports` |

---

## 3. LAYOUT COMPONENTS

### 3.1 Navbar (`components/layout/Navbar.jsx`)

Sticky top bar, present on all pages:

```
[TFT CLASH logo]  [Home] [Clash] [Standings] [Events] [Profile]  [🔔] [⚙️] [Avatar]
```

- **Position:** `sticky top-0 z-50`
- **Background:** `bg-[#13131A]` with `obsidian-shadow`
- **Logo:** `font-headline text-2xl font-black text-primary tracking-tighter`
- **Links:** `font-sans uppercase tracking-wider text-sm` with `opacity-70 hover:opacity-100`
- **Active link:** `text-primary border-b-2 border-primary pb-1 font-bold`
- **Desktop:** `hidden md:flex items-center gap-8` for nav links
- **Mobile:** Links hidden, hamburger menu or rely on MobileNav

### 3.2 Sidebar (`components/layout/Sidebar.jsx`) - NEW

Fixed left sidebar for logged-in users on desktop:

```
[Logo + tagline]
[Rank card: avatar + rank + LP]
─────────────────
Dashboard        ← active: gradient bg + left border
Tournaments
Leaderboards
Events
Profile
─────────────────
[JOIN CLASH button]
─────────────────
Support
Logout
```

- **Position:** `fixed left-0 top-0 h-full w-64 z-40`
- **Visibility:** `hidden xl:flex flex-col`
- **Background:** `bg-[#13131A]` or `bg-surface-container-low` with right border
- **Nav items:** `flex items-center gap-4 px-6 py-4`, Barlow Condensed uppercase
- **Active state:** `bg-gradient-to-r from-primary/20 to-transparent text-primary border-l-4 border-primary translate-x-1`
- **Inactive:** `text-on-surface/40 hover:text-on-surface hover:bg-white/5`
- **CTA button:** Full-width gold gradient, `rounded-full py-3`
- **Footer links:** `text-on-surface/60 hover:text-on-surface text-xs`

### 3.3 MobileNav (`components/layout/MobileNav.jsx`) - NEW

Fixed bottom navigation for mobile:

```
[Home] [Events] [⚔ Clash] [Recap] [Account]
```

- **Position:** `fixed bottom-0 left-0 w-full z-50`
- **Visibility:** `md:hidden flex`
- **Background:** `bg-[#13131A]/95 backdrop-blur-xl border-t border-outline-variant/15`
- **Items:** `flex justify-around items-center px-4 pb-6 pt-3`
- **Labels:** `text-[10px] uppercase font-bold font-sans`
- **Active item:** `bg-primary text-on-primary rounded-xl px-4 py-1`
- **Inactive:** `text-on-surface/50`

### 3.4 PageLayout (`components/layout/PageLayout.jsx`)

Orchestrates navbar + sidebar + content + mobile nav:

```jsx
function PageLayout({ children, showSidebar = true }) {
  const { currentUser } = useAuth();
  const isLoggedIn = !!currentUser;
  const showSide = isLoggedIn && showSidebar;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {showSide && <Sidebar />}
      <main className={`pt-20 pb-24 md:pb-12 px-4 md:px-8 ${showSide ? 'xl:ml-64' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <Footer />
      {isLoggedIn && <MobileNav />}
    </div>
  );
}
```

- Content offset: `xl:ml-64` when sidebar is shown
- Max width: `max-w-7xl` (some screens use `max-w-[880px]`)
- Bottom padding: `pb-24` on mobile (for MobileNav clearance), `md:pb-12` on desktop

### 3.5 Footer (`components/layout/Footer.jsx`)

Minimal site footer:

- **Background:** `bg-surface-container-lowest border-t border-outline-variant/10`
- **Layout:** `max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-4`
- **Left:** Copyright text `font-sans text-xs text-on-surface/40 uppercase tracking-widest`
- **Center:** Links row (Rules, Privacy, Terms, FAQ) `font-sans text-xs uppercase tracking-wider text-on-surface/40 hover:text-on-surface`
- **Right:** "TFT Clash" branding in `font-display text-sm text-primary/40`
- **Hidden on mobile** when MobileNav is shown (to avoid double bottom nav)

---

## 4. UI PRIMITIVES

### 4.1 Panel

Card wrapper with variant support:

```jsx
function Panel({ children, className = '', accent, glow, glass, ...props }) {
  const base = glass
    ? 'glass-panel border border-outline-variant/10'
    : 'bg-surface-container-low border border-outline-variant/10';
  const accentBorder = accent === 'gold' ? 'border-t-4 border-t-primary'
    : accent === 'purple' ? 'border-t-4 border-t-secondary'
    : accent === 'teal' ? 'border-t-4 border-t-tertiary'
    : '';
  const glowClass = glow ? 'gold-glow' : '';

  return (
    <div className={`${base} ${accentBorder} ${glowClass} rounded-sm p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
```

### 4.2 Btn

Button with size/variant:

- **Primary:** `bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-sans font-bold uppercase tracking-widest shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95 transition-transform`
- **Secondary:** `bg-surface-variant/20 border border-outline-variant/15 rounded-full font-sans uppercase tracking-widest hover:bg-surface-variant transition-all`
- **Ghost:** `text-on-surface/60 hover:text-on-surface hover:bg-white/5 rounded-full transition-all`
- **Destructive:** `bg-error-container/20 text-error border border-error/20 rounded-full`
- **Sizes:** `sm` (py-2 px-4 text-xs), `md` (py-3 px-6 text-sm), `lg` (py-4 px-8 text-sm), `xl` (py-5 w-full text-sm)

### 4.3 Inp

Input with underline style:

- **Base:** `w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 py-4 px-4 rounded-none`
- **Focus:** `focus:ring-1 focus:ring-primary focus:border-primary`
- **Placeholder:** `placeholder:text-on-surface/20`
- **Label:** `font-sans text-xs uppercase tracking-widest text-on-surface/70 block ml-1 mb-2`
- **With icon:** Wrap in relative div, icon `absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/20`

### 4.4 StatCard

Label + big number + optional icon:

```jsx
function StatCard({ label, value, icon, trend, className = '' }) {
  return (
    <div className={`bg-surface-container-low p-6 rounded-lg relative overflow-hidden group ${className}`}>
      {icon && (
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Icon name={icon} size={48} />
        </div>
      )}
      <span className="font-sans text-on-surface/40 uppercase text-xs tracking-widest mb-4 block">
        {label}
      </span>
      <div className="flex items-end gap-2">
        <span className="font-mono text-3xl font-bold text-on-surface">{value}</span>
        {trend && (
          <span className={`font-mono text-sm ${trend > 0 ? 'text-success' : 'text-error'}`}>
            {trend > 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>
    </div>
  );
}
```

### 4.5 Badge / Tag

- **Badge:** `inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-sans uppercase tracking-widest border`
- **Variants:** `bg-primary/10 text-primary border-primary/20`, `bg-tertiary/10 text-tertiary border-tertiary/20`, `bg-secondary/10 text-secondary border-secondary/20`, `bg-error/10 text-error border-error/20`

### 4.6 Progress

Linear progress bar:

- **Track:** `w-full h-2 bg-surface-container-highest rounded-full overflow-hidden`
- **Fill:** `h-full bg-gradient-to-r from-primary-container via-primary to-secondary rounded-full transition-all`
- **Segmented:** Add `after:` pseudo-elements for segment markers

### 4.7 Divider

Section divider with optional label:

```jsx
function Divider({ label }) {
  if (!label) return <div className="border-t border-outline-variant/10" />;
  return (
    <div className="relative flex items-center">
      <div className="flex-grow border-t border-outline-variant/20" />
      <span className="px-4 font-sans text-[10px] uppercase tracking-tighter text-on-surface/30">
        {label}
      </span>
      <div className="flex-grow border-t border-outline-variant/20" />
    </div>
  );
}
```

---

## 5. SCREEN SPECIFICATIONS

### 5.1 HomeScreen (Guest Landing)

**Route:** `/` (when not authenticated)

**Layout:** No sidebar. Full-width hero with atmospheric background.

**Sections:**
1. **Background atmosphere:** Absolute positioned radial gradient `from-primary/10 to-transparent blur-[120px]` centered, h-[600px]
2. **Hero header:** Centered, `mb-16`
   - Subtitle badge: `inline-block px-6 py-1 bg-tertiary-container/10 text-tertiary font-sans uppercase tracking-[0.2em] text-sm border border-tertiary/20 rounded-sm`
   - H1: `text-6xl md:text-8xl font-serif font-black tracking-tight leading-none`
   - Paragraph: `max-w-2xl mx-auto text-on-surface-variant text-lg leading-relaxed italic`
3. **Countdown timer:** Glass panel with large monospace numbers (days/hours/minutes/seconds), gold gradient CTA button
4. **Feature cards:** `grid grid-cols-1 md:grid-cols-3 gap-6`
5. **CTA section:** Join/register buttons

### 5.2 DashboardScreen (Logged-in Home) - NEW

**Route:** `/` (when authenticated)

**Layout:** With sidebar. Content at `max-w-[880px]`.

**Sections:**
1. **Pulse header:** `p-8 rounded-lg bg-surface-container-low` with user avatar (w-20 h-20), name (font-serif text-4xl), season subtitle
2. **Stats row:** Two-column layout using `grid grid-cols-1 md:grid-cols-5 gap-6`
   - Left column (`md:col-span-3`): Single tall card - season trajectory with progress bar, current standings position, recent trend
   - Right column (`md:col-span-2`): Stack of two smaller cards - win rate donut/stat at top, top compositions list below
3. **Upcoming clash:** Countdown + registration status
4. **Recent results:** Mini results table
5. **Challenges preview:** Active challenges with progress bars

### 5.3 LeaderboardScreen

**Route:** `/leaderboard`

**Sections:**
1. **Page header:** Serif title, condensed subtitle
2. **Podium section:** `grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-24`
   - 1st place: Center, `w-48 h-48` avatar, `-translate-y-8`, `border-primary`, `gold-glow`, crown icon above, `h-48` bar below with gold gradient
   - 2nd place: Left, `w-32 h-32`, silver border, `grayscale opacity-80`, `h-32` bar
   - 3rd place: Right, `w-32 h-32`, bronze border, `sepia-[.3]`, `h-24` bar
   - Reordered on mobile with `order-*` classes
3. **Filters:** Region select + tier select + search input
4. **Rankings table:** `bg-surface-container-low rounded-sm border border-outline-variant/10`
   - Header row: `font-sans uppercase tracking-[0.2em] text-[10px]`
   - Player rows: Avatar + name + rank badge + LP + win rate + trend

### 5.4 PlayerProfileScreen

**Route:** `/player/:name`

**Sections:**
1. **Hero banner:** `h-72 w-full relative overflow-hidden`
   - Gradient overlays: rank-colored gradient + `from-background` bottom fade
   - Profile overlay: `absolute bottom-0 left-0 flex flex-col md:flex-row items-end gap-8 px-8 pb-8`
   - Avatar: `w-32 h-32 md:w-40 md:h-40 border-4 border-primary rounded-full gold-glow`
   - Level badge: `absolute -bottom-2 right-4 bg-primary text-on-primary rounded-full`
   - Name: `text-5xl font-serif`
   - Rank badge: `bg-tertiary/10 text-tertiary px-3 py-1 rounded-sm`
   - Action buttons: Share, Follow
   - Regional rank: `hidden lg:flex text-4xl font-display text-primary`
2. **Stats grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` of StatCards
3. **Match history:** Recent games table
4. **Achievements:** Grid of milestone badges with locked/unlocked states
5. **Season performance:** Simple CSS bar charts for placement distribution (no charting library needed - pure div widths)

### 5.5 BracketScreen

**Route:** `/bracket/:id?`

**Layout:** Full-width for bracket visualization.

**Sections:**
1. **Header:** Tournament name, date, format info
2. **Round tabs:** Horizontal scrollable tabs for each round
3. **Bracket visualization:** Existing bracket rendering logic (preserved)
4. **Match cards:** Player matchups with scores
5. **Standing sidebar:** Current standings for this bracket

### 5.6 PricingScreen

**Route:** `/pricing`

**Sections:**
1. **Header:** `font-serif text-6xl md:text-8xl` "Choose Your Path", condensed subtitle
2. **Pricing grid:** `grid grid-cols-1 md:grid-cols-3 gap-6 items-start`
   - Player (free): `bg-surface-container-low border-t-2 border-outline-variant/20`
   - Pro (highlighted): `bg-surface-container-high border-t-4 border-primary -mt-4 scale-105 z-10 obsidian-shadow` with "Most Popular" badge
   - Host: `bg-surface-container-low border-t-2 border-secondary/40`
   - Features list: check_circle (included) / lock (excluded)
   - CTA: Primary gradient for Pro, secondary for others

**NOTE:** Prices shown in designs ($0/$12/$29) differ from current app ($0/$4.99/$19.99). Keep current prices from CLAUDE.md.

### 5.7 LoginScreen / SignUpScreen

**Route:** `/login`, `/signup`

**Layout:** Centered, no sidebar, no mobile nav. Just navbar + centered card.

**Structure:**
1. **Brand header:** `text-center`, logo in headline italic, tagline in serif
2. **Auth card:** `max-w-[480px] bg-surface-container-low p-10 rounded-none shadow-[0_40px_40px_rgba(0,0,0,0.4)]`
   - Decorative top accent: `absolute top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50`
   - Form header: `font-serif text-3xl` + condensed subtitle
   - Inputs: Underline style (Inp component), icons right-aligned
   - Remember me + forgot password row
   - Submit: Full-width gold gradient `rounded-full`
   - Divider: "Partner Login" with border lines
   - Social buttons: `grid grid-cols-2 gap-4`, glass-panel, rounded-full
3. **Footer:** `bg-surface-container-highest/30 p-6 text-center` with signup/login toggle link

### 5.8 AdminScreen

**Route:** `/admin`

**Layout:** With sidebar (admin variant with additional nav items).

**Sections:**
1. **Rank card in sidebar:** Avatar + rank + LP display
2. **Active nav items:** Dashboard, Tournaments, Management, Configure, System
3. **Main content:**
   - Status cards row: Active players, live tournaments, system health
   - Tournament management panel
   - Player management table
   - Announcements editor
   - Site settings controls

### 5.9 HofScreen (Hall of Fame)

**Route:** `/hall-of-fame`

**Sections:**
1. **Hero header:** Large serif title with gold gradient text
2. **Champion spotlight:** Featured champion card with stats
3. **Season history:** Cards for each completed season
4. **Records section:** All-time records (most wins, highest points, etc.)

### 5.10 ArchiveScreen

**Route:** `/archive`

**Sections:**
1. **Header:** Serif title, condensed subtitle
2. **Season selector:** Dropdown or tabs for past seasons
3. **Legacy data:** Standings snapshots, bracket results per season

### 5.11 EventsScreen

**Route:** `/events`

**Sections:**
1. **Header:** "Community Events" with condensed subtitle
2. **Featured event:** Large hero card
3. **Event grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
4. ~~Calendar view~~ - deferred to future iteration

### 5.12 ScrimsScreen

**Route:** `/scrims` (admin-gated)

**Sections:**
1. **Header:** "Scrims Hub" practice arena title
2. **Create lobby:** Form for new scrim lobby
3. **Active lobbies:** List of current scrim lobbies with join buttons
4. **History:** Recent scrim results

### 5.13 MilestonesScreen

**Route:** `/milestones`

**Sections:**
1. **Header:** "Milestones & Progression" with season progress bar
2. **Achievement vault:** Grid of milestone cards
   - Unlocked: Full color, checkmark
   - Locked: `opacity-60 grayscale`, lock icon
3. **XP progress:** Level progress bar with current/next level

### 5.14 ChallengesScreen

**Route:** `/challenges`

**Sections:**
1. **Header:** "Daily & Weekly Challenges"
2. **Active challenges:** Cards with progress bars
3. **Completed challenges:** Greyed out with checkmarks
4. **Rewards preview:** What you earn per challenge

### 5.15 SeasonRecapScreen

**Route:** `/season-recap`

**Sections:**
1. **Hero:** Large serif title with gold gradient "Season 1 Recap"
2. **Rank card:** `glass-card gold-glow` centered with final rank
3. **Performance narrative:** Text summary
4. **Stats bento grid:** `grid-cols-12` asymmetric layout
5. **Placement distribution:** Bar chart
6. **Highlight moments:** Key achievements

### 5.16 RulesScreen

**Route:** `/rules`

**Sections:**
1. **Header:** "Official Rules" with handbook subtitle
2. **Rules sections:** Accordion-style expandable sections
3. **Points table:** The official EMEA scoring table
4. **Tiebreaker rules:** Ordered list

### 5.17 FAQScreen

**Route:** `/faq`

**Sections:**
1. **Header:** "FAQ & Support"
2. **Search:** Input to filter questions
3. **Categories:** Grouped FAQ items
4. **Accordion items:** Click to expand, Material Symbol add/remove icons
5. **Contact:** Support link at bottom

### 5.18 AccountScreen

**Route:** `/account`

**Sections:**
1. **Header:** "Account Settings"
2. **Profile section:** Avatar upload, display name, bio
3. **Riot ID linking:** Connect/disconnect
4. **Social connections:** Discord, Twitter links
5. **Subscription status:** Current tier, upgrade CTA
6. **Preferences:** Notification settings, theme (dark only for now)
7. **Danger zone:** Delete account

### 5.19 HostApplyScreen

**Route:** `/host/apply`

**Sections:**
1. **Header:** "Become a Host"
2. **Benefits list:** What hosting includes
3. **Application form:** Organization name, experience, plans
4. **Submit CTA**

### 5.20 HostDashboardScreen

**Route:** `/host/dashboard`

**Sections:**
1. **Dashboard stats:** Active tournaments, total players, revenue
2. **Tournament management:** Create/edit/delete tournaments
3. **Player management:** Registered players per tournament
4. **Analytics:** Participation trends

### 5.21 PrivacyScreen / TermsScreen

**Routes:** `/privacy`, `/terms`

Simple content pages with serif headings, body text, last-updated date.

### 5.22 ResultsScreen / ClashReportScreen

**Routes:** `/results/:id?`, `/clash-report/:id`

**Sections:**
1. **Header:** Clash name, date, format
2. **Final standings:** Ranked player list with points
3. **Game-by-game breakdown:** Each game's placements
4. **MVP highlight:** Best performer

---

## 6. PAGE HEADER PATTERN

All content pages follow a consistent header pattern from the designs:

```jsx
<header className="text-center mb-16 relative">
  {/* Optional subtitle badge */}
  <div className="inline-block mb-4 px-6 py-1 bg-tertiary-container/10 text-tertiary font-sans uppercase tracking-[0.2em] text-sm border border-tertiary/20 rounded-sm">
    {subtitle}
  </div>
  {/* Main title */}
  <h1 className="text-5xl md:text-7xl font-serif font-black tracking-tight leading-none mb-4">
    {title}
  </h1>
  {/* Optional description */}
  <p className="max-w-2xl mx-auto text-on-surface-variant text-lg leading-relaxed italic">
    {description}
  </p>
</header>
```

---

## 7. RESPONSIVE STRATEGY

**Breakpoints (Tailwind defaults):**
- `sm`: 640px
- `md`: 768px (primary layout shift)
- `lg`: 1024px
- `xl`: 1280px (sidebar appears)

**Patterns:**
- Sidebar: `hidden xl:flex` (desktop only)
- Mobile nav: `md:hidden flex` (mobile only)
- Content offset: `xl:ml-64` when sidebar present
- Grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` etc.
- Typography: `text-5xl md:text-7xl` scaling
- Spacing: `p-6 md:p-8 lg:p-12`
- Desktop nav links: `hidden md:flex`

---

## 8. MIGRATION STRATEGY

### Phase 0: Infrastructure (do first)
1. Install Tailwind CSS + PostCSS + plugins
2. Create `tailwind.config.js` with full design system
3. Create `index.css` with Tailwind directives + custom utilities
4. Add React Router dependency
5. Update `index.html` with new font links (Material Symbols + new fonts)
6. Remove `@tabler/icons-webfont` dependency
7. Verify build works with empty Tailwind setup

### Phase 1: Foundation extraction
1. Extract `lib/constants.js`, `lib/stats.js`, `lib/utils.js`, `lib/supabase.js` from App.jsx
2. Extract `context/AppContext.jsx` with all shared state + Supabase subscriptions
3. Extract custom hooks (`useAuth`, `usePlayers`, `useTournaments`, etc.)
4. Set up React Router in new `App.jsx` with all routes
5. Verify app boots and routes work (screens can be empty shells initially)

### Phase 2: UI primitives
1. Build all `components/ui/*` (Panel, Btn, Inp, Icon, Badge, Tag, Progress, StatCard, etc.)
2. Build layout components (Navbar, Sidebar, MobileNav, PageLayout, Footer)
3. These are pure presentation - can be built and tested independently

### Phase 3: Screen migration (one at a time)
Migrate each screen from App.jsx into its own file, replacing inline styles with Tailwind classes and matching the HTML designs. Order by importance:

1. **LoginScreen / SignUpScreen** - Auth flow (standalone, no dependencies)
2. **HomeScreen** (guest) - First impression
3. **DashboardScreen** - Logged-in home (new)
4. **LeaderboardScreen** - Core feature with podium
5. **PlayerProfileScreen** - High-visibility
6. **StandingsScreen** - Core competitive feature
7. **BracketScreen** - Tournament visualization
8. **EventsScreen** - Community hub
9. **PricingScreen** - Monetization
10. **ResultsScreen / ClashReportScreen** - Match reports
11. **HofScreen** - Hall of Fame
12. **MilestonesScreen / ChallengesScreen** - Progression
13. **SeasonRecapScreen** - Season review
14. **ArchiveScreen** - Historical data
15. **RulesScreen / FAQScreen** - Info pages
16. **AccountScreen** - Settings
17. **ScrimsScreen** - Admin tool
18. **AdminScreen** - Admin dashboard
19. **HostApplyScreen / HostDashboardScreen** - Host features
20. **PrivacyScreen / TermsScreen** - Legal (simplest)

### Phase 4: Cleanup
1. Delete old App.jsx (or keep as reference)
2. Remove GCSS template literal
3. Remove all inline style objects
4. Remove Tabler icon references
5. Final build verification
6. Test all routes and navigation
7. Mobile responsiveness pass

---

## 9. KEY DIFFERENCES FROM CURRENT APP

| Aspect | Current | New |
|--------|---------|-----|
| Architecture | Single 20K-line file | ~50 modular files |
| Styling | Inline styles + GCSS literal | Tailwind CSS classes |
| Routing | Hash-based (`#screen`) | React Router (`/path`) |
| Icons | Tabler Icons webfont | Google Material Symbols |
| Fonts | Russo One, Chakra Petch | + Space Grotesk, Inter |
| Navigation | Top nav only | Top nav + sidebar + mobile bottom nav |
| Home (logged in) | Same as guest with extras | Dedicated DashboardScreen |
| Color system | Hardcoded hex values | Material Design 3 tokens |
| Backgrounds | `#08080F` / `#111827` | `#13131A` / `#1B1B23` (warmer) |
| Cards | Simple border + bg | Glassmorphism, obsidian shadow, accent borders |
| Buttons | Basic styled buttons | Gold gradient, scale transforms, pill shape |
| Data display | Inline numbers | StatCard component, monospace, background icons |
| Leaderboard | Table list | Podium visualization + table |
| Profile | Stats panel | Full hero banner with avatar overlay |
| Forms | Basic inputs | Underline style, icon hints, glass panels |

---

## 10. DESIGN SYSTEM OVERRIDES

This overhaul **deliberately replaces** the CLAUDE.md "Product Identity (LOCKED)" palette with the new Material Design 3 tokens from the HTML designs. The user explicitly chose these designs and approved the new system.

**Color changes (old -> new):**
- Background: `#08080F` -> `#13131A` (warmer obsidian)
- Panels: `#111827` -> `#1B1B23` (surface-container-low)
- Gold accent: `#E8A838` -> `#FFC66B` primary, `#E8A838` demoted to primary-container
- Purple accent: `#9B72CF` -> `#D9B9FF` secondary, `#5C348D` secondary-container
- Teal accent: `#4ECDC4` -> `#67E2D9` tertiary
- Primary text: `#F2EDE4` -> `#E4E1EC` (on-surface)
- Secondary text: `#BECBD9` -> `#D5C4AF` (on-surface-variant)

**Font changes (old -> new):**
- Headings: Playfair Display (kept, now `font-serif` for editorial titles)
- Labels: Barlow Condensed (kept, now `font-sans`)
- NEW: Space Grotesk (`font-headline`) for page titles and section headers
- NEW: Inter (`font-body`) for all body text (replaces system UI)
- NEW: Russo One (`font-display`) for hero/champion display text
- Kept: JetBrains Mono (`font-mono`) for stats/data
- Removed: Chakra Petch (no longer used)

**Icon change:** Tabler Icons -> Google Material Symbols Outlined. This reverses the recent Tabler migration, but the new designs are built entirely around Material Symbols.

**CLAUDE.md will be updated** after implementation to reflect the new locked palette.

---

## 11. CONTENT RULES

Carried forward from CLAUDE.md - apply to ALL user-facing strings:

- **ZERO em/en dashes** in any content. Use hyphens, commas, or rewrite.
- **Player roster:** Use Homies group (Levitate, Zounderkite, Uri, BingBing, Wiwi, Ole, Sybor, Ivdim, Vlad). NEVER include Denial, Max, or Ribenardo.
- **Levitate = the user**, season champion, id: 1, Challenger rank.
- **Pricing:** Player $0/mo, Pro $4.99/mo, Host $19.99/mo. Do not use design placeholder prices.
- **Points:** 1st=8, 2nd=7, 3rd=6, 4th=5, 5th=4, 6th=3, 7th=2, 8th=1.

---

## 12. MISSING SCREEN SPECS

### 12.1 StandingsScreen

**Route:** `/standings`

**Layout:** With sidebar.

**Sections:**
1. **Page header:** Standard header pattern - "Season Standings"
2. **Season info bar:** Current season name, week number, next clash date
3. **Tier breakdown tabs:** Filter by tier (All, Challenger, GM, Master, etc.)
4. **StandingsTable:** Full standings with rank, player, tier, points, wins, top4s, games played
5. **Drop week indicator:** If applicable, show which weeks are dropped

### 12.2 FlashTournamentScreen

**Route:** `/flash/:id`

**Layout:** With sidebar.

**Sections:**
1. **Tournament header:** Name, format, status (registration/in-progress/completed)
2. **Registration panel:** Join button, player list, countdown to start
3. **Lobby management:** Admin controls for creating lobbies
4. **Live bracket:** Real-time bracket updates during play
5. **Results:** Final standings when complete

### 12.3 TournamentDetailScreen

**Route:** `/tournament/:id`

**Layout:** With sidebar.

**Sections:**
1. **Hero banner:** Tournament name, host branding, date range
2. **Info panel:** Format, rules, prize pool, registration status
3. **Registered players:** Grid of player cards
4. **Schedule:** Round/game schedule
5. **Results:** If completed, show final standings

### 12.4 TournamentsListScreen

**Route:** `/tournaments`

**Layout:** With sidebar.

**Sections:**
1. **Page header:** "Tournaments"
2. **Filter bar:** Status (upcoming/active/completed), format, host
3. **Tournament cards:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
4. **Each card:** Name, date, format, player count, status badge, host avatar

---

## 13. TAILWIND VERSION

**Use Tailwind CSS v3** (latest v3.x). Rationale:
- The HTML designs use v3 CDN syntax (`@tailwind base/components/utilities`)
- v3 is stable and all plugins (`@tailwindcss/forms`, `@tailwindcss/container-queries`) are v3-compatible
- v4 migration can be done later as a separate task

**Plugin imports** use ESM syntax (Vite project):
```js
import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

export default {
  // ...
  plugins: [forms, containerQueries],
}
```

---

## 14. NAVIGATION GAP FIX

The sidebar shows at `xl` (1280px+) and mobile nav hides at `md` (768px+). Between `md` and `xl` (768-1279px), navigation is provided by the **top navbar links** which are visible at `md:flex`. This is the tablet experience:

- **< 768px (mobile):** Top navbar (logo + icons) + bottom MobileNav
- **768-1279px (tablet):** Top navbar with full nav links (no sidebar, no bottom nav)
- **1280px+ (desktop):** Top navbar + left Sidebar (no bottom nav)

This is intentional and matches the HTML designs.

---

## 15. LOADING & ERROR STATES

**Loading:** Each screen shows `<Skeleton>` placeholders matching its layout while data loads. Skeleton uses `bg-surface-container-high animate-pulse rounded-sm`.

**Errors:** Wrap each screen in an error boundary. On error, show a Panel with error icon, message, and retry button. No silent failures.

**Empty states:** When a list/table has no data, show centered icon + message + optional CTA (e.g., "No tournaments yet" with "Create One" button for hosts).

---

## 16. NON-GOALS (Out of scope)

- Server-side rendering or Next.js migration
- Database schema changes
- New Supabase tables or RLS policies
- Stripe payment flow changes
- E2E test updates (will need separate pass)
- Light mode / theme switching
- i18n / localization
- Performance optimization (lazy loading, code splitting) - fast follow-up
- Accessibility audit (ARIA, keyboard nav) - fast follow-up
- Page transition animations - fast follow-up
