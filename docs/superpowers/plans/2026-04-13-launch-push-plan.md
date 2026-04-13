# TFT Clash Launch Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify TFT Clash visually, fix visible bugs, wire up monetization hooks, harden Discord, and ship the platform to a public launch.

**Architecture:** React 18 + Vite 5 SPA with Tailwind tokens already defined. Fix-in-place approach: keep the existing 29-screen structure and 6-font system, but enforce strict lanes via a codified design system (Btn, Panel, SectionHeader) and sweep every screen to conform. Discord bot extends existing command pattern with 4 new commands.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, React Router 6, Supabase, PayPal (link-based), discord.js, Node (bot), Sentry. Codebase uses `var`/`function(){}` style (no arrow functions, no backtick literals, no IIFEs in JSX).

**Reference spec:** `docs/superpowers/specs/2026-04-13-launch-push-design.md`

**Testing approach:** This codebase has no automated unit test harness. Verification is: (1) `npm run build` passes, (2) dev-server visual spot-check, (3) grep guards confirm pattern removal. Each task ends with these checks where applicable.

---

## File Map

### Created
- `src/components/shared/SectionHeader.jsx` — unified section intro component
- `src/components/shared/SponsorShowcase.jsx` — sponsor display component
- `discord-bot/commands/lobby.js` — `/lobby` slash command
- `discord-bot/commands/submit.js` — `/submit` slash command
- `discord-bot/commands/dispute.js` — `/dispute` slash command
- `discord-bot/commands/tournament.js` — `/tournament` slash command
- `docs/DESIGN-SYSTEM.md` — design system reference document

### Modified
- `src/App.jsx` — router effect subRoute reset (Phase 0)
- `src/screens/LeaderboardScreen.jsx` — PodiumCard z-index/glyph fix + sponsor strip replacement
- `src/components/ui/Btn.jsx` — expand to 6 variants
- `src/components/ui/Panel.jsx` — padding + elevation variants
- `src/lib/constants.js` — add `maxScrimPlayers` to TIER_FEATURES
- `src/lib/tiers.js` — add `getMaxScrimPlayers` helper
- `src/lib/paypal.js` — donate fallback URL
- `src/screens/ScrimsScreen.jsx` — enforce scrim caps
- `src/screens/PricingScreen.jsx` — scrim copy + comparison row
- `src/screens/HomeScreen.jsx` — sponsor + support section
- `src/screens/DashboardScreen.jsx` — sponsor integration
- `src/screens/BracketScreen.jsx` — sponsor integration
- `src/screens/AccountScreen.jsx` — support sidebar
- `src/screens/AdminScreen.jsx` — admin sponsor preview
- All 29 screens — font/radius sweep (Phase 2)
- `discord-bot/setup.js` — permission audit fixes
- `discord-bot/deploy-commands.js` — register 4 new commands

---

## Phase 0 — Hotfix visible bugs

### Task 1: StandingsScreen subRoute reset on re-entry

**Files:**
- Modify: `src/App.jsx:196-222`

**Context:** When the user navigates `/standings/hof` then leaves then returns to `/standings`, the router effect's direct-match branch sets `screen = 'standings'` but never clears `subRoute`. The StandingsScreen reads `subRoute` from context and keeps showing the Hall of Fame tab even though the URL is bare. This same bug prevents the Leaderboard tab from becoming active when clicked after visiting a subroute.

- [ ] **Step 1: Read the current router effect block**

Run: `sed -n '196,222p' src/App.jsx` (or use Read tool on `src/App.jsx` lines 196-222)

Confirm the current shape matches the plan below before editing.

- [ ] **Step 2: Replace the direct-match branch to also reset subRoute**

Current code (lines 198-204):
```jsx
    var mapped=ROUTE_TO_SCREEN[path];
    if(mapped){
      if(mapped==="login"||mapped==="signup"){navSourceRef.current="router";setAuthScreen(mapped);return;}
      if(mapped!==screen){navSourceRef.current="router";setScreen(mapped);}
      return;
    }
```

Replace with:
```jsx
    var mapped=ROUTE_TO_SCREEN[path];
    if(mapped){
      if(mapped==="login"||mapped==="signup"){navSourceRef.current="router";setAuthScreen(mapped);return;}
      if(mapped!==screen){navSourceRef.current="router";setScreen(mapped);}
      if(subRoute){navSourceRef.current="router";setSubRoute("");}
      return;
    }
```

The new line `if(subRoute){...setSubRoute("")}` fires whenever a path without a subroute segment (like bare `/standings`) is matched, clearing any stale `subRoute` state. Guarded by `if(subRoute)` so it only triggers a re-render when there's something to clear.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 4: Manual smoke test in dev server**

Run: `npm run dev`
Open the app in browser, then:
1. Navigate to `/standings`
2. Click the "Hall of Fame" tab → URL becomes `/standings/hof`
3. Click another top-level nav item (e.g. `/dashboard`)
4. Click "Standings" in the nav → URL becomes `/standings`
5. Verify the Leaderboard tab is active (NOT Hall of Fame)
6. Click the Leaderboard tab directly → should stay on Leaderboard

Expected: Tab state resets cleanly when returning to `/standings` without a subroute.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "fix(router): reset subRoute on bare /standings and /events paths"
```

---

### Task 2: Podium first-place crown z-index + glyph

**Files:**
- Modify: `src/screens/LeaderboardScreen.jsx:52-72` (PodiumCard first-place branch)

**Context:** The `workspace_premium` icon at `-top-6` sits earlier in DOM order than the scaled circle with `gold-glow-boss`. On hover, the circle's `group-hover:scale-105` and radial glow paint over the crown, visually sending it "behind." Fix: give the crown wrapper `z-20 relative` to lift it, and swap `workspace_premium` for `emoji_events` (filled trophy) for clearer semantics.

- [ ] **Step 1: Locate the first-place branch**

Run: Read tool on `src/screens/LeaderboardScreen.jsx` lines 47-72.

Confirm the current markup matches:
```jsx
  if (isFirst) {
    return (
      <div className="order-1 md:order-2 flex flex-col items-center -translate-y-8">
        <div className="relative group cursor-pointer mb-6" onClick={onClick}>
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Icon name="workspace_premium" fill size={48} className="text-primary" />
          </div>
          <div className="w-36 h-36 rounded-full border-4 border-primary overflow-hidden bg-surface-container-high transition-transform duration-300 group-hover:scale-105 flex items-center justify-center gold-glow-boss">
            <span className="font-headline text-5xl font-bold text-primary">{initial}</span>
          </div>
          ...
```

- [ ] **Step 2: Fix the crown wrapper**

Replace:
```jsx
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Icon name="workspace_premium" fill size={48} className="text-primary" />
          </div>
```

With:
```jsx
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20">
            <Icon name="emoji_events" fill size={52} className="text-primary drop-shadow-[0_2px_8px_rgba(255,206,120,0.6)]" />
          </div>
```

Changes:
- Add `z-20` to stack above the hover-scaled circle
- Bump to `-top-7` for slightly more clearance
- Swap glyph to `emoji_events` (filled trophy)
- Bump size from 48 to 52 to match the larger visual weight
- Add a soft drop-shadow glow so the trophy reads clearly against the gold circle below

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 4: Manual hover test**

Run: `npm run dev`
Navigate to `/standings` or `/leaderboard`, then:
1. Locate the #1 gold podium card
2. Hover over it → the trophy icon should stay visibly on top (not clipped, not obscured by the circle's glow)
3. Move away → the trophy stays in place

Expected: Trophy icon is always visible and sits above the scaling circle on hover.

- [ ] **Step 5: Commit**

```bash
git add src/screens/LeaderboardScreen.jsx
git commit -m "fix(leaderboard): z-index + glyph swap for #1 podium trophy"
```

---

## Phase 1 — Design system codification

### Task 3: Expand Btn component to six variants

**Files:**
- Modify: `src/components/ui/Btn.jsx`

**Context:** Current `Btn` has 4 variants (primary, secondary, ghost, destructive). Phase 1 adds two more (tertiary, link) and locks the base styling. Every inline `<button>` in subsequent tasks references this component.

- [ ] **Step 1: Replace the full file with the expanded version**

Replace the entire contents of `src/components/ui/Btn.jsx` with:

```jsx
const variants = {
  primary: 'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-95',
  secondary: 'bg-surface-container-high text-on-surface border border-outline-variant/15 hover:bg-surface-container-highest',
  ghost: 'text-on-surface/60 hover:text-on-surface hover:bg-white/5',
  destructive: 'bg-error-container/20 text-error border border-error/20 hover:bg-error-container/30',
  tertiary: 'bg-tertiary/10 text-tertiary border border-tertiary/30 hover:bg-tertiary/20',
  link: 'text-primary hover:underline underline-offset-4 decoration-2',
}

const sizes = {
  sm: 'py-2 px-4 text-xs min-h-[36px]',
  md: 'py-3 px-6 text-sm min-h-[44px]',
  lg: 'py-4 px-8 text-sm min-h-[52px]',
  xl: 'py-5 w-full text-sm min-h-[56px]',
}

export default function Btn({ children, variant = 'primary', size = 'md', icon, iconPosition = 'left', loading = false, disabled = false, className = '', ...props }) {
  var base = 'inline-flex items-center justify-center gap-2 rounded-full font-label font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed'
  if (variant === 'link') {
    base = 'inline-flex items-center gap-1 font-label font-bold uppercase tracking-widest text-xs transition-all duration-200 disabled:opacity-50'
  }
  var variantClass = variants[variant] || variants.primary
  var sizeClass = variant === 'link' ? '' : (sizes[size] || sizes.md)
  return (
    <button
      className={base + ' ' + variantClass + ' ' + sizeClass + ' ' + className}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
      {!loading && icon && iconPosition === 'left' ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
      {children}
      {!loading && icon && iconPosition === 'right' ? <span className="material-symbols-outlined text-base">{icon}</span> : null}
    </button>
  )
}
```

Key changes from current:
- 6 variants instead of 4 (added tertiary, link)
- `font-label` instead of `font-sans` (canonical token, part of Phase 1 lane enforcement)
- `min-h-*` on every size for touch target compliance (44px minimum)
- `icon` prop + `iconPosition` for consistent icon rendering
- `loading` prop renders a spinner
- `link` variant uses completely different base styling (no pill shape)
- `disabled` prop handled natively with opacity/cursor

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build completes without errors. If any callsite passes a variant or size this component no longer accepts, it would still build (defaults take over), but watch for warnings.

- [ ] **Step 3: Spot-check existing usage**

Run: `npm run dev`
Navigate to a screen with existing Btn usage (e.g. `/` HomeScreen). Verify the buttons still render and clicks work. No visual regressions on primary/secondary/ghost/destructive buttons.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Btn.jsx
git commit -m "feat(ui): expand Btn to 6 variants with icon/loading props"
```

---

### Task 4: Expand Panel component with padding + elevation variants

**Files:**
- Modify: `src/components/ui/Panel.jsx`

**Context:** Current Panel accepts `accent`, `glow`, `glass`. Add `padding` and `elevation` props for consistent spacing and surface levels across screens.

- [ ] **Step 1: Replace the full Panel file**

Replace `src/components/ui/Panel.jsx` with:

```jsx
var paddings = {
  none: '',
  tight: 'p-4',
  default: 'p-6',
  spacious: 'p-8',
}

var elevations = {
  low: 'bg-surface-container-lowest',
  default: 'bg-surface-container-low',
  elevated: 'bg-surface-container',
  highest: 'bg-surface-container-high',
}

export default function Panel({ children, className = '', padding = 'default', elevation = 'default', accent, glow, glass, ...props }) {
  var base = glass
    ? 'glass-panel border border-outline-variant/10'
    : (elevations[elevation] || elevations.default) + ' border border-outline-variant/10'
  var accentBorder = accent === 'gold' ? 'border-t-4 border-t-primary'
    : accent === 'purple' ? 'border-t-4 border-t-secondary'
    : accent === 'teal' ? 'border-t-4 border-t-tertiary'
    : ''
  var glowClass = glow ? 'gold-glow' : ''
  var paddingClass = paddings[padding] || paddings.default

  return (
    <div className={base + ' ' + accentBorder + ' ' + glowClass + ' rounded-lg ' + paddingClass + ' ' + className} {...props}>
      {children}
    </div>
  )
}
```

Key changes from current:
- `rounded-lg` instead of `rounded-sm` (Phase 1 radius scale)
- `padding` prop: `none | tight | default | spacious` → `'' | p-4 | p-6 | p-8`
- `elevation` prop: `low | default | elevated | highest` → maps to surface-container tokens
- Preserves existing `accent`, `glow`, `glass` props for backwards compatibility

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Build completes. Existing usage continues to work because defaults preserve current behavior (except the radius bump from `rounded-sm` to `rounded-lg`).

- [ ] **Step 3: Visual spot-check**

Run: `npm run dev`
Open HomeScreen or Dashboard and verify Panels still render. The corner radius will look slightly larger (4px → 8px) — this is intentional.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Panel.jsx
git commit -m "feat(ui): Panel padding/elevation variants + rounded-lg default"
```

---

### Task 5: Create SectionHeader shared component

**Files:**
- Create: `src/components/shared/SectionHeader.jsx`
- Modify: `src/components/shared/index.js` (export SectionHeader if it exists; if not, skip)

**Context:** Every screen currently rolls its own section intro pattern. This component unifies them.

- [ ] **Step 1: Create the component file**

Create `src/components/shared/SectionHeader.jsx` with:

```jsx
import Btn from '../ui/Btn'

export default function SectionHeader({ eyebrow, title, description, action, align = 'left', className = '' }) {
  var alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start'
  var outerLayout
  if (action && align === 'center') {
    outerLayout = 'flex flex-col items-center gap-4'
  } else if (action) {
    outerLayout = 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4'
  } else {
    outerLayout = 'flex flex-col ' + alignClass
  }
  var actionAlign = align === 'center' ? 'justify-center' : ''

  return (
    <div className={outerLayout + ' mb-6 ' + className}>
      <div className={'flex flex-col ' + alignClass}>
        {eyebrow ? (
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface leading-tight">
          {title}
        </h2>
        {description ? (
          <p className="font-body text-sm sm:text-base text-on-surface-variant mt-2 max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={'flex ' + actionAlign + ' flex-shrink-0'}>
          {action}
        </div>
      ) : null}
    </div>
  )
}
```

Follows the project conventions: `var` declarations, no arrow functions, no backtick template literals inside functions.

- [ ] **Step 2: Check if shared/index.js exists and export**

Run: `ls src/components/shared/index.*` (use Bash) or check via Read tool.

If `src/components/shared/index.js` exists and re-exports other components, add:
```js
export { default as SectionHeader } from './SectionHeader'
```

If it doesn't exist, skip — screens can import directly via `'../components/shared/SectionHeader'`.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build completes (new file is unused for now, so no regressions possible).

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/SectionHeader.jsx
# If index.js was modified:
# git add src/components/shared/index.js
git commit -m "feat(ui): SectionHeader shared component"
```

---

### Task 6: Sweep radius scale — replace every exotic `rounded-[Npx]` and `rounded-sm`

**Files:**
- Modify: all files under `src/screens/` and `src/components/` that use non-canonical radius classes

**Context:** The radius scale is: `rounded` (4px), `rounded-lg` (8px), `rounded-xl` (12px), `rounded-full`. Every other radius class is wrong. Sweep the codebase and normalize.

- [ ] **Step 1: Inventory the damage**

Run these grep commands and capture the counts:
```
Grep pattern: rounded-\[
Path: src/
Mode: count
```

```
Grep pattern: rounded-sm\b
Path: src/
Mode: count
```

```
Grep pattern: rounded-2xl\b
Path: src/
Mode: count
```

```
Grep pattern: rounded-3xl\b
Path: src/
Mode: count
```

Record the totals. These are the files we'll touch.

- [ ] **Step 2: Replace `rounded-[4px]` → `rounded`**

Use Grep with `output_mode: files_with_matches` for pattern `rounded-\[4px\]`, then Edit each file using `replace_all: true`:
- `rounded-[4px]` → `rounded`

- [ ] **Step 3: Replace `rounded-[8px]` → `rounded-lg`**

Same approach for `rounded-[8px]` → `rounded-lg`.

- [ ] **Step 4: Replace `rounded-[12px]` → `rounded-xl`**

Same approach for `rounded-[12px]` → `rounded-xl`.

- [ ] **Step 5: Replace other exotic literals case-by-case**

For each remaining `rounded-[Npx]` match:
- `rounded-[2px]` → `rounded` (round up to 4px — 2px is visually identical at this scale)
- `rounded-[6px]` → `rounded-lg`
- `rounded-[16px]` → `rounded-xl`
- `rounded-[20px]` → `rounded-xl` (or keep as hero accent if the screen is Home/Dashboard hero card only; default: `rounded-xl`)
- `rounded-[24px]` → `rounded-xl`

Any other values → `rounded-lg` (default safe pick).

- [ ] **Step 6: Replace `rounded-sm` → `rounded`**

Use Grep with pattern `rounded-sm\b` and Edit each file with `replace_all: true`:
- `rounded-sm` → `rounded`

- [ ] **Step 7: Replace `rounded-2xl` and `rounded-3xl` → `rounded-xl`**

Same approach. Both collapse to `rounded-xl` (12px).

- [ ] **Step 8: Verify grep guards are clean**

Run:
```
Grep pattern: rounded-\[
Path: src/
Mode: count
```
Expected: 0 matches.

```
Grep pattern: rounded-sm\b|rounded-2xl\b|rounded-3xl\b
Path: src/
Mode: count
```
Expected: 0 matches.

- [ ] **Step 9: Verify build passes**

Run: `npm run build`
Expected: Build completes. Visual radii will shift slightly on some screens — that's intended.

- [ ] **Step 10: Visual smoke test**

Run: `npm run dev`. Walk through Home, Dashboard, Standings, Pricing. Confirm nothing broke catastrophically (buttons still pill-shaped, cards still have reasonable corners).

- [ ] **Step 11: Commit**

```bash
git add src/
git commit -m "refactor(ui): normalize radius scale to rounded/rounded-lg/rounded-xl/rounded-full"
```

---

### Task 7: Write docs/DESIGN-SYSTEM.md reference document

**Files:**
- Create: `docs/DESIGN-SYSTEM.md`

**Context:** The rules from the spec need to live in the repo as a permanent reference. This is the one doc every future change points at.

- [ ] **Step 1: Create the design system document**

Create `docs/DESIGN-SYSTEM.md` with the following content:

```markdown
# TFT Clash Design System

Last updated: 2026-04-13

This is the authoritative reference for visual consistency across TFT Clash. Every new screen and every edit to an existing screen must conform to these rules. The rules exist because without them, every screen drifts and the product stops feeling like one product.

## Typography — six lanes, strict

| Token | Typeface | Use for | Never use for |
|---|---|---|---|
| `font-display` | Russo One 400 | TFT CLASH wordmark, hero numerals, countdown digits | Body, headers, buttons |
| `font-headline` | Space Grotesk 500-700 | Section titles, card titles, modal titles, page titles | Paragraphs, labels, numbers |
| `font-editorial` (alias: `font-serif`) | Playfair Display 400-700 italic | 1-2 italic accents per page max (e.g. "Competing is always free.") | Buttons, labels, body |
| `font-body` | Inter 400-600 | Paragraphs, button labels, input text, card body, descriptions | Stat numerals, uppercase labels, hero headings |
| `font-label` (alias: `font-sans`) | Barlow Condensed 400-700 | Uppercase eyebrows, tags, tab labels — anything with `uppercase tracking-widest` | Body, large titles |
| `font-mono` (alias: `font-stats`) | JetBrains Mono 400-700 | All UI numerals (stats, pts, placements, countdown, timestamps, ranks) | Prose, titles, labels |

**Aliases are deprecated** (`font-sans`, `font-condensed`, `font-sans-condensed`, `font-nav`, `font-technical`, `font-stats`). They still resolve for backwards compatibility, but new code uses canonical names only.

## Border radius — four values, strict

| Class | Px | Use for |
|---|---|---|
| `rounded` | 4px | Inputs, small tags, table cells, tiny chips |
| `rounded-lg` | 8px | All cards, panels, modals, tiles |
| `rounded-xl` | 12px | Hero cards, spotlight blocks, featured sponsors |
| `rounded-full` | pill | Buttons, badges, avatars, status dots |

Never use `rounded-[Npx]`, `rounded-sm`, `rounded-2xl`, `rounded-3xl`. If you think you need an exotic radius, you don't.

## Buttons — always `<Btn>`

Import from `src/components/ui/Btn.jsx`. Never write a raw `<button className="...bg-primary...">`.

**Variants:** `primary | secondary | ghost | destructive | tertiary | link`
**Sizes:** `sm | md | lg | xl`
**Props:** `icon`, `iconPosition`, `loading`, `disabled`

```jsx
<Btn variant="primary" size="lg" icon="arrow_forward" iconPosition="right">
  Get Started
</Btn>
```

## Panels — always `<Panel>`

Import from `src/components/ui/Panel.jsx`. Never write a raw `<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-6">`.

**Padding:** `none | tight | default | spacious` (default is `p-6`)
**Elevation:** `low | default | elevated | highest`
**Legacy props:** `accent`, `glow`, `glass` (still supported)

```jsx
<Panel padding="spacious" elevation="elevated">
  <SectionHeader title="Featured" />
  ...
</Panel>
```

## Section headers — always `<SectionHeader>`

Import from `src/components/shared/SectionHeader.jsx`. Never roll your own intro.

**Props:** `eyebrow`, `title`, `description`, `action`, `align`

```jsx
<SectionHeader
  eyebrow="Season 1"
  title="Weekly Clash"
  description="Every Sunday, 20:00 CET"
  action={<Btn variant="link">View All</Btn>}
/>
```

## How to add a new screen

1. Wrap in `<PageLayout>` with a `<PageHeader>` if it's a standalone page
2. Group content into `<Panel>` blocks
3. Every section intro is a `<SectionHeader>`
4. Every button is a `<Btn>`
5. Fonts: `font-headline` for titles, `font-body` for prose, `font-label` for eyebrows, `font-mono` for numbers
6. No inline `rounded-[Npx]`, no inline gradient backgrounds
7. No inline styles (`style={{...}}`) for colors — use Tailwind tokens

## Grep guards (CI-ready)

```bash
# Zero matches expected for these:
git grep -n 'rounded-\[' src/
git grep -n 'rounded-sm\b' src/
git grep -n 'rounded-2xl\b' src/
git grep -n 'rounded-3xl\b' src/
git grep -n 'font-sans\b' src/screens/
git grep -n 'font-condensed\b' src/screens/

# Fewer than 5 matches (only justified inline buttons):
git grep -n '<button className' src/screens/

# Zero matches in production code (Sentry captures errors elsewhere):
git grep -n 'console\.log' src/
```

Run these before every push. If the guards fail, fix the code, not the guards.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DESIGN-SYSTEM.md
git commit -m "docs: add DESIGN-SYSTEM.md reference"
```

---

## Phase 2 — Screen sweep

Each top-10 screen gets its own task so the checklist is trackable and commits stay focused.

### Per-screen checklist (applies to Tasks 8-17)

For each screen:
1. Replace every raw `<button>` with `<Btn variant="..." size="...">`
2. Replace every raw card div (pattern: `bg-surface-container-*.*rounded.*border.*outline-variant`) with `<Panel>`
3. Replace every section intro (pattern: `<h2>` or `<h3>` followed by description text and/or action button) with `<SectionHeader>`
4. Normalize fonts: replace `font-sans` → `font-label` where the text is uppercase tracking-widest; replace `font-sans` → `font-body` otherwise. Replace `font-condensed`, `font-sans-condensed`, `font-nav`, `font-technical` → `font-label`. Leave `font-mono` and `font-stats` alone (both resolve to JetBrains Mono).
5. Delete inline `style={{...}}` color overrides — replace with Tailwind token classes
6. Delete inline gradient backgrounds on buttons — move to `<Btn variant="primary">`
7. Build passes, dev server loads the screen without white-screen

---

### Task 8: Sweep HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

- [ ] **Step 1: Read the current file**

Use Read tool on `src/screens/HomeScreen.jsx`. Note every `<button>`, every card div, every section intro, every `font-sans` / `font-condensed`.

- [ ] **Step 2: Import the design system components at the top**

Add these imports if not already present:
```jsx
import Btn from '../components/ui/Btn'
import Panel from '../components/ui/Panel'
import SectionHeader from '../components/shared/SectionHeader'
```

- [ ] **Step 3: Replace raw buttons**

For each `<button className="...">`, convert to `<Btn variant="..." size="...">`:
- Primary CTAs (`bg-primary`, `bg-gradient-*`) → `<Btn variant="primary" size="lg">`
- Secondary actions → `<Btn variant="secondary" size="md">`
- Text links ("View All") → `<Btn variant="link">`

Keep `onClick`, `disabled`, and children unchanged.

- [ ] **Step 4: Replace raw card divs with `<Panel>`**

Pattern to find: `<div className="...bg-surface-container-low...rounded.*border.*outline-variant.*p-[0-9]">`
Replace with:
```jsx
<Panel padding="default" className="...any-remaining-classes...">
  ...
</Panel>
```

If the card has `p-8` use `padding="spacious"`. If `p-4` use `padding="tight"`. If `p-6` use `padding="default"` (or omit).

- [ ] **Step 5: Replace section intros with `<SectionHeader>`**

For each pattern like:
```jsx
<div className="mb-6">
  <p className="text-xs uppercase tracking-widest text-primary">Eyebrow</p>
  <h2 className="text-3xl font-bold">Title</h2>
  <p className="text-on-surface-variant">Description</p>
</div>
```

Replace with:
```jsx
<SectionHeader
  eyebrow="Eyebrow"
  title="Title"
  description="Description"
/>
```

- [ ] **Step 6: Normalize font classes**

Use Edit with `replace_all: true` within this file:
- `font-sans font-bold uppercase` → `font-label font-bold uppercase`
- Other `font-sans` (non-uppercase body) → `font-body`
- `font-condensed` → `font-label`
- `font-nav` → `font-label`
- `font-technical` → `font-label`

Leave `font-mono`, `font-headline`, `font-editorial`, `font-display` alone.

- [ ] **Step 7: Delete inline style color overrides**

Search for `style={{` in the file. For each:
- `style={{ color: 'var(--md-sys-color-primary)' }}` → delete, add `text-primary`
- `style={{ background: '...' }}` on static elements → delete, use Tailwind token

Leave dynamic `style={{ width: progress + '%' }}` style calculations alone.

- [ ] **Step 8: Build + dev server check**

Run: `npm run build`
Expected: Clean build.

Run: `npm run dev`. Load `/`. Verify:
- Hero renders
- Countdown timer visible
- Leaderboard preview loads
- Sponsor strip visible (will be replaced in Task 27)
- Donate link visible in footer
- No console errors

- [ ] **Step 9: Commit**

```bash
git add src/screens/HomeScreen.jsx
git commit -m "refactor(home): sweep to design system (Btn, Panel, SectionHeader)"
```

---

### Task 9: Sweep DashboardScreen

**Files:**
- Modify: `src/screens/DashboardScreen.jsx`

Follow the per-screen checklist. Key things to watch for on DashboardScreen:
- Multiple stat cards → `<Panel padding="tight" elevation="elevated">` each
- "Next Clash" countdown card uses `font-display` for the digits and `font-mono` elsewhere — keep this
- Action buttons ("Register", "Check In") → `<Btn variant="primary" size="lg">`

- [ ] **Step 1: Read the current file**
- [ ] **Step 2: Add imports (`Btn`, `Panel`, `SectionHeader`)**
- [ ] **Step 3: Replace raw buttons with `<Btn>`**
- [ ] **Step 4: Replace raw card divs with `<Panel>`**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize font classes (see Task 8 step 6)**
- [ ] **Step 7: Delete inline style color overrides**
- [ ] **Step 8: Build + dev server check — load `/dashboard` as a logged-in user**
- [ ] **Step 9: Commit**

```bash
git add src/screens/DashboardScreen.jsx
git commit -m "refactor(dashboard): sweep to design system"
```

---

### Task 10: Sweep PricingScreen

**Files:**
- Modify: `src/screens/PricingScreen.jsx`

Watch for: tier cards (already Panel-like but may be raw divs), comparison table rows, FAQ accordion items.

- [ ] **Step 1: Read the current file**
- [ ] **Step 2: Add imports**
- [ ] **Step 3: Replace raw buttons** — "Subscribe" CTAs → `<Btn variant="primary" size="xl">`, "Compare" → `<Btn variant="secondary">`
- [ ] **Step 4: Replace card/tier containers with `<Panel>`**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize fonts**
- [ ] **Step 7: Delete inline style color overrides — pricing screen often has hard-coded tier colors in style={{}} — replace with `text-primary`, `text-tertiary`, etc.**
- [ ] **Step 8: Build + dev server check — load `/pricing`, verify all 5 tiers render and subscribe URLs work**
- [ ] **Step 9: Commit**

```bash
git add src/screens/PricingScreen.jsx
git commit -m "refactor(pricing): sweep to design system"
```

---

### Task 11: Sweep StandingsScreen + LeaderboardScreen + HofScreen

**Files:**
- Modify: `src/screens/StandingsScreen.jsx`
- Modify: `src/screens/LeaderboardScreen.jsx`
- Modify: `src/screens/HofScreen.jsx`

Note: StandingsScreen is a tab container that embeds LeaderboardScreen and HofScreen. Sweep all three together in one commit.

- [ ] **Step 1: Read all three files**
- [ ] **Step 2: Add imports in each file**
- [ ] **Step 3: Replace raw buttons (tab buttons → keep as custom pill buttons, or create a Tabs component — for now, keep tab markup but ensure fonts/radii conform)**
- [ ] **Step 4: Replace card divs with `<Panel>`**
- [ ] **Step 5: Replace section intros with `<SectionHeader>` (title over the table, the division dividers stay custom)**
- [ ] **Step 6: Normalize fonts**
- [ ] **Step 7: Delete inline style overrides — LeaderboardScreen has several `style={{ color: medalColor }}` on podium spans, these can stay because they're dynamic, but delete static color styles**
- [ ] **Step 8: Build + dev server check — load `/standings`, verify:**
  - Leaderboard tab shows the full table
  - Switch to HoF tab, switch back to Leaderboard — no state bug (Phase 0 fix held)
  - Hover #1 podium — trophy stays on top (Phase 0.2 fix held)
- [ ] **Step 9: Commit**

```bash
git add src/screens/StandingsScreen.jsx src/screens/LeaderboardScreen.jsx src/screens/HofScreen.jsx
git commit -m "refactor(standings): sweep all three tabs to design system"
```

---

### Task 12: Sweep ScrimsScreen

**Files:**
- Modify: `src/screens/ScrimsScreen.jsx`

**Warning:** This is the largest screen (~1740 lines) and the worst font offender (84x font-sans, 63x font-mono, 54x font-bold). Budget extra time and expect to touch many call sites.

- [ ] **Step 1: Read the file in chunks**

Read in sections: lines 1-400, 400-800, 800-1200, 1200-1740. Map out what's there before making changes.

- [ ] **Step 2: Add imports**

- [ ] **Step 3: Replace raw buttons with `<Btn>`**

Use Grep with pattern `<button\s+className` in the file (content mode) to find every inline button. For each, read the classes, match to a Btn variant, rewrite.

- [ ] **Step 4: Replace card divs with `<Panel>`**

Use Grep with pattern `bg-surface-container` in the file (content mode) to find raw panel divs. Convert.

- [ ] **Step 5: Replace section intros with `<SectionHeader>`**

Sessions list intro, create-session intro, scrim-stats intro — each gets a SectionHeader.

- [ ] **Step 6: Normalize fonts (biggest win on this screen)**

Use Edit with `replace_all: true` for these within ScrimsScreen.jsx:
- `font-sans font-bold uppercase` → `font-label font-bold uppercase`
- `font-condensed` → `font-label`

Then do targeted Edit calls for remaining `font-sans` usages (non-uppercase) → `font-body`.

- [ ] **Step 7: Delete inline style color overrides**

- [ ] **Step 8: Build + dev server check — load `/scrims`, verify no white-screen, sessions list renders**

- [ ] **Step 9: Commit**

```bash
git add src/screens/ScrimsScreen.jsx
git commit -m "refactor(scrims): sweep to design system (biggest cleanup)"
```

---

### Task 13: Sweep EventsScreen + TournamentsListScreen

**Files:**
- Modify: `src/screens/EventsScreen.jsx`
- Modify: `src/screens/TournamentsListScreen.jsx`

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Add imports in each**
- [ ] **Step 3: Replace raw buttons (tournament cards likely have "View" / "Register" buttons → `<Btn variant="primary">`)**
- [ ] **Step 4: Replace card divs with `<Panel>` — each tournament row becomes a Panel**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize fonts**
- [ ] **Step 7: Delete inline style overrides**
- [ ] **Step 8: Build + dev server check — load `/events` and `/tournaments`**
- [ ] **Step 9: Commit**

```bash
git add src/screens/EventsScreen.jsx src/screens/TournamentsListScreen.jsx
git commit -m "refactor(events,tournaments): sweep to design system"
```

---

### Task 14: Sweep PlayerProfileScreen

**Files:**
- Modify: `src/screens/PlayerProfileScreen.jsx`

Public-facing, shared externally, needs to look polished.

- [ ] **Step 1: Read the file**
- [ ] **Step 2: Add imports**
- [ ] **Step 3: Replace raw buttons ("Follow", "Compare", "Share" → `<Btn>`)**
- [ ] **Step 4: Replace card divs with `<Panel>` — stat cards, match history cards, achievement cards**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize fonts**
- [ ] **Step 7: Delete inline style overrides**
- [ ] **Step 8: Build + dev server check — load `/player/Levitate`, verify all sections render**
- [ ] **Step 9: Commit**

```bash
git add src/screens/PlayerProfileScreen.jsx
git commit -m "refactor(profile): sweep to design system"
```

---

### Task 15: Sweep AccountScreen

**Files:**
- Modify: `src/screens/AccountScreen.jsx`

- [ ] **Step 1: Read the file**
- [ ] **Step 2: Add imports**
- [ ] **Step 3: Replace raw buttons (subscription actions, billing links → `<Btn>`)**
- [ ] **Step 4: Replace card divs with `<Panel>` — subscription card, billing card, danger zone card**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize fonts**
- [ ] **Step 7: Delete inline style overrides**
- [ ] **Step 8: Build + dev server check — load `/account` as logged-in user**
- [ ] **Step 9: Commit**

```bash
git add src/screens/AccountScreen.jsx
git commit -m "refactor(account): sweep to design system"
```

---

### Task 16: Sweep SponsorsScreen

**Files:**
- Modify: `src/screens/SponsorsScreen.jsx`

Sales surface — must look like the company is real and partnerships are live.

- [ ] **Step 1: Read the file**
- [ ] **Step 2: Add imports**
- [ ] **Step 3: Replace raw buttons ("Contact us", "Become a sponsor" → `<Btn variant="primary" size="lg">`)**
- [ ] **Step 4: Replace card divs with `<Panel>` — each sponsor tile becomes a Panel**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize fonts**
- [ ] **Step 7: Delete inline style overrides**
- [ ] **Step 8: Build + dev server check — load `/sponsors`**
- [ ] **Step 9: Commit**

```bash
git add src/screens/SponsorsScreen.jsx
git commit -m "refactor(sponsors): sweep to design system"
```

---

### Task 17: Sweep RulesScreen + FAQScreen

**Files:**
- Modify: `src/screens/RulesScreen.jsx`
- Modify: `src/screens/FAQScreen.jsx`

Trust surfaces — mostly long-form text, so the main wins are font normalization and wrapping sections in Panels.

- [ ] **Step 1: Read both files**
- [ ] **Step 2: Add imports in each**
- [ ] **Step 3: Replace raw buttons ("Back to home", table-of-contents links)**
- [ ] **Step 4: Replace card divs with `<Panel>` — each rule category or FAQ section becomes a Panel**
- [ ] **Step 5: Replace section intros with `<SectionHeader>`**
- [ ] **Step 6: Normalize fonts — most body content should be `font-body`, section headers `font-headline`**
- [ ] **Step 7: Delete inline style overrides**
- [ ] **Step 8: Build + dev server check — load `/rules` and `/faq`**
- [ ] **Step 9: Commit**

```bash
git add src/screens/RulesScreen.jsx src/screens/FAQScreen.jsx
git commit -m "refactor(rules,faq): sweep to design system"
```

---

### Task 18: Lighter pass — remaining 19 screens

**Files:**
- Modify: `src/screens/ChallengesScreen.jsx`, `src/screens/MilestonesScreen.jsx`, `src/screens/ArchiveScreen.jsx`, `src/screens/ClashReportScreen.jsx`, `src/screens/SeasonRecapScreen.jsx`, `src/screens/HostApplyScreen.jsx`, `src/screens/HostDashboardScreen.jsx`, `src/screens/FlashTournamentScreen.jsx`, `src/screens/TournamentDetailScreen.jsx`, `src/screens/BracketScreen.jsx`, `src/screens/ResultsScreen.jsx`, `src/screens/ContentEngineScreen.jsx`, `src/screens/CommandCenterScreen.jsx`, `src/screens/AdminScreen.jsx`, `src/screens/StatsHubScreen.jsx`, `src/screens/PrivacyScreen.jsx`, `src/screens/TermsScreen.jsx`, `src/screens/NotFoundScreen.jsx` (plus any I missed — use `ls src/screens/`)

**Context:** Lighter pass — don't try to SectionHeader-ify everything. Just normalize fonts and buttons across the board so the app feels unified.

- [ ] **Step 1: Run font normalization grep across all listed files**

For each file:
- Open with Read
- Use Edit with `replace_all: true`:
  - `font-sans font-bold uppercase` → `font-label font-bold uppercase`
  - `font-condensed` → `font-label`
  - `font-nav` → `font-label`
  - `font-technical` → `font-label`

Leave `font-mono`, `font-sans` (non-uppercase), `font-headline`, `font-editorial`, `font-display` alone for this pass.

- [ ] **Step 2: Replace obvious raw buttons with `<Btn>`**

For each file, use Grep with pattern `<button\s+className` (content mode). For each match:
- If the classes include `bg-primary` or `bg-gradient-to` → add `import Btn from '../components/ui/Btn'` if missing, replace with `<Btn variant="primary" size="md">`
- If the classes include `bg-surface-container` or `border-outline-variant` → `<Btn variant="secondary">`
- If it's clearly a text link ("View all", "Learn more") → `<Btn variant="link">`

Do not touch buttons that are clearly structural (tab buttons, toggle buttons, icon-only buttons with ad-hoc styling) — leave them and flag for Phase 2.1 retroactive fix if needed.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Grep guard verification**

```
Grep pattern: font-condensed\b|font-nav\b|font-technical\b
Path: src/screens/
Mode: count
```
Expected: 0 matches.

Note: `font-sans` may still appear in non-uppercase body contexts — that's acceptable for the lighter pass.

- [ ] **Step 5: Visual spot-check**

Run: `npm run dev`. Load 5 random screens from the list. No white-screens, fonts look cohesive.

- [ ] **Step 6: Commit**

```bash
git add src/screens/
git commit -m "refactor(screens): lighter sweep — normalize fonts and buttons across remaining 19 screens"
```

---

## Phase 3 — Scrim limits, pricing, donate, support

### Task 19: Add `maxScrimPlayers` field to TIER_FEATURES

**Files:**
- Modify: `src/lib/constants.js:73-140` (TIER_FEATURES object)

- [ ] **Step 1: Read the TIER_FEATURES object**

Run Read tool on `src/lib/constants.js` lines 70-140.

- [ ] **Step 2: Add `maxScrimPlayers: 0` to `free` tier**

Find the `free:` block. Add at the end of the features list (before the closing `}`):
```js
    maxScrimPlayers: 0,
```

- [ ] **Step 3: Add `maxScrimPlayers: 0` to `pro` tier**

Same pattern — append `maxScrimPlayers: 0,` to the `pro` tier block.

- [ ] **Step 4: Add `maxScrimPlayers: 8` to `scrim` tier**

Append `maxScrimPlayers: 8,` to the `scrim` tier block.

- [ ] **Step 5: Add `maxScrimPlayers: 16` to `bundle` tier**

Append `maxScrimPlayers: 16,` to the `bundle` tier block.

- [ ] **Step 6: Add `maxScrimPlayers: 32` to `host` tier**

Append `maxScrimPlayers: 32,` to the `host` tier block.

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 8: Commit**

```bash
git add src/lib/constants.js
git commit -m "feat(tiers): add maxScrimPlayers field to TIER_FEATURES"
```

---

### Task 20: Add `getMaxScrimPlayers` helper to tiers.js

**Files:**
- Modify: `src/lib/tiers.js`

- [ ] **Step 1: Read the file**

Use Read tool on `src/lib/tiers.js` (the whole file, ~22 lines).

- [ ] **Step 2: Append the helper function**

Add at the end of the file (after the `hasFeature` function):

```js
export function getMaxScrimPlayers(tier) {
  var safeTier = tier && TIER_FEATURES[tier] ? tier : 'free';
  var features = TIER_FEATURES[safeTier];
  if (!features || typeof features.maxScrimPlayers !== 'number') return 0;
  return features.maxScrimPlayers;
}
```

Matches the style of `hasFeature` — same safe-tier fallback pattern, returns 0 for unknown or malformed tiers.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tiers.js
git commit -m "feat(tiers): add getMaxScrimPlayers helper"
```

---

### Task 21: Enforce scrim player cap in ScrimsScreen

**Files:**
- Modify: `src/screens/ScrimsScreen.jsx` (scrim session creation flow)

**Context:** ScrimsScreen currently allows any user with `createScrimRoom: true` to create a session with any roster size. Add a cap check using `getMaxScrimPlayers(userTier)` and block the create button + show an inline error when the roster exceeds the cap.

- [ ] **Step 1: Locate the create-session flow**

Use Grep with pattern `createScrimRoom|hasFeature.*scrim|scrimRoster|sessionRoster|createSession` on `src/screens/ScrimsScreen.jsx` to find the create-session UI.

Also grep for the current import of `hasFeature` to find where to add `getMaxScrimPlayers`.

- [ ] **Step 2: Update the import**

Find the import line:
```js
import { getUserTier, hasFeature } from '../lib/tiers'
```

Replace with:
```js
import { getUserTier, hasFeature, getMaxScrimPlayers } from '../lib/tiers'
```

- [ ] **Step 3: Read `userTier` and compute `maxPlayers` in the create-session component**

Near the top of the create-session component (wherever `userTier` is already available via `useApp()` or a prop):
```js
  var maxPlayers = getMaxScrimPlayers(userTier)
  var rosterSize = (scrimRoster || []).length
  var overCap = rosterSize > maxPlayers
```

Use variable names that match the existing code — if the roster state is called `sessionRoster` or `players` in this file, adapt accordingly.

- [ ] **Step 4: Block the "Create Session" button when over cap**

Find the create-session button. Add `disabled={overCap || ...existing disabled conditions}` and wire up a tooltip or inline message.

- [ ] **Step 5: Add an inline error message below the roster editor**

```jsx
{overCap ? (
  <div className="mt-3 p-3 rounded-lg bg-error-container/20 border border-error/20 text-error font-body text-sm">
    Your {TIER_LABELS[userTier] || 'current tier'} allows up to {maxPlayers} players per scrim.
    {userTier === 'scrim' ? ' Upgrade to Pro + Scrim for 16 (two lobbies).' : ''}
    {' '}Reduce roster or <a href="/pricing" className="underline">upgrade</a>.
  </div>
) : null}
```

Add `import { TIER_LABELS } from '../lib/paypal'` if not already imported.

- [ ] **Step 6: Hard-cap the "Add Player" button**

Find the button that adds a player to the roster. Add `disabled={rosterSize >= maxPlayers}` so users cannot exceed the cap through the UI.

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 8: Manual test**

Run: `npm run dev`. Log in as a free-tier user (or fake the tier in dev). Load `/scrims`, try to create a session, verify:
- Free / pro tier: "Create Session" is hidden or disabled (they don't have `createScrimRoom`)
- Scrim tier: cap at 8 players — adding a 9th is blocked, error message appears
- Bundle tier: cap at 16 players
- Host tier: cap at 32 players

- [ ] **Step 9: Commit**

```bash
git add src/screens/ScrimsScreen.jsx
git commit -m "feat(scrims): enforce tier-based player cap (8/16/32)"
```

---

### Task 22: Update PricingScreen copy and comparison row

**Files:**
- Modify: `src/screens/PricingScreen.jsx` (SCRIM_FEATURES, COMPARISON_ROWS, FAQ_ITEMS)

- [ ] **Step 1: Update SCRIM_FEATURES first bullet**

Find:
```js
  { text: 'Create scrim rooms (up to 32 players)', icon: 'meeting_room' },
```

Replace with:
```js
  { text: 'Create scrim rooms (up to 8 players, one lobby)', icon: 'meeting_room' },
```

- [ ] **Step 2: Add a Scrim+Pro bundle feature line about 16 players**

Find the `BUNDLE_FEATURES` array. After the existing bullets, add:
```js
  { text: 'Scrim rooms up to 16 players (two lobbies)', icon: 'meeting_room', highlight: true },
```

- [ ] **Step 3: Update COMPARISON_ROWS "Max scrim players" row**

Find:
```js
  { label: 'Max scrim players',        free: '-',        pro: '-',        scrim: '32',        bundle: '32',       host: '32',       type: 'text' },
```

Replace with:
```js
  { label: 'Max scrim players',        free: '-',        pro: '-',        scrim: '8',         bundle: '16',       host: '32',       type: 'text' },
```

- [ ] **Step 4: Update FAQ_ITEMS "What is a Scrim Pass?" answer**

Find:
```js
    q: 'What is a Scrim Pass?',
    a: 'The Scrim Pass lets you create private practice rooms for up to 32 players with multi-lobby seeding. Perfect for friend groups and practice squads.',
```

Replace with:
```js
    q: 'What is a Scrim Pass?',
    a: 'The Scrim Pass lets you create private practice rooms for up to 8 players (one lobby). Upgrade to the Pro + Scrim bundle for two-lobby seeding with up to 16 players. Host tier unlocks 32 players.',
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Visual check**

Run: `npm run dev`. Load `/pricing`. Verify:
- Scrim Pass tier card shows "up to 8 players, one lobby"
- Bundle tier card shows "Scrim rooms up to 16 players (two lobbies)"
- Comparison table Max scrim players row reads `- / - / 8 / 16 / 32`
- FAQ answer is updated

- [ ] **Step 7: Commit**

```bash
git add src/screens/PricingScreen.jsx
git commit -m "feat(pricing): scrim caps 8/16/32 across copy, comparison, FAQ"
```

---

### Task 23: Donate fallback URL

**Files:**
- Modify: `src/lib/paypal.js:35-39`

- [ ] **Step 1: Read the current getDonateUrl**

The current function returns `null` when `VITE_PAYPAL_DONATE_ID` is unset. This hides the donate button everywhere `getDonateUrl()` is used.

- [ ] **Step 2: Replace the function**

Find:
```js
export function getDonateUrl() {
  var id = import.meta.env.VITE_PAYPAL_DONATE_ID || '';
  if (!id) return null;
  return 'https://www.paypal.com/donate/?hosted_button_id=' + encodeURIComponent(id);
}
```

Replace with:
```js
export function getDonateUrl() {
  var id = import.meta.env.VITE_PAYPAL_DONATE_ID || '';
  if (id) return 'https://www.paypal.com/donate/?hosted_button_id=' + encodeURIComponent(id);
  return 'https://paypal.me/monkelodie';
}
```

The function now always returns a string. Every UI that reads it will render.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Smoke test**

Run: `npm run dev`. Load `/`. Scroll to footer. Verify the donate button is visible and the href goes to `paypal.me/monkelodie` (since the env var isn't set locally).

- [ ] **Step 5: Commit**

```bash
git add src/lib/paypal.js
git commit -m "feat(donate): hardcoded paypal.me fallback so button always renders"
```

---

### Task 24: Add Support-the-Platform section

**Files:**
- Modify: `src/screens/HomeScreen.jsx` (add section before footer)
- Modify: `src/screens/AccountScreen.jsx` (add smaller variant in sidebar)

- [ ] **Step 1: Add imports in HomeScreen.jsx**

Ensure these are imported:
```jsx
import Panel from '../components/ui/Panel'
import SectionHeader from '../components/shared/SectionHeader'
import Btn from '../components/ui/Btn'
import { getDonateUrl } from '../lib/paypal'
```

- [ ] **Step 2: Add the support section markup**

Find the final CTA section in HomeScreen (last major block before the sponsor strip or the footer). Insert just above it:

```jsx
        {/* ── Support the platform ───────────────────────────────────────── */}
        <div className="mt-16 mb-16">
          <Panel padding="spacious" elevation="elevated" className="text-center">
            <SectionHeader
              eyebrow="Community Supported"
              title="Keep TFT Clash free forever"
              description="Running weekly tournaments costs real money. If you get value from competing here, a tip keeps the lights on, the servers fast, and the entry fee at zero."
              align="center"
            />
            <div className="mt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Btn
                variant="primary"
                size="lg"
                icon="favorite"
                iconPosition="left"
                onClick={function(){ window.open(getDonateUrl(), '_blank', 'noopener') }}
              >
                Donate via PayPal
              </Btn>
              <Btn
                variant="link"
                onClick={function(){ navigate('/pricing') }}
              >
                Or go Pro
              </Btn>
            </div>
          </Panel>
        </div>
```

Verify `navigate` is already imported via `useNavigate()` in this file (it is — `var navigate = useNavigate()` is already on line ~231).

- [ ] **Step 3: Add imports in AccountScreen.jsx**

Same imports:
```jsx
import Panel from '../components/ui/Panel'
import Btn from '../components/ui/Btn'
import { getDonateUrl } from '../lib/paypal'
```

- [ ] **Step 4: Add a smaller support card in AccountScreen sidebar**

Find the sidebar or secondary column in AccountScreen. Add at the bottom of the sidebar:

```jsx
      <Panel padding="default" elevation="elevated" className="mt-6">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-3xl">favorite</span>
          <h3 className="font-headline text-lg font-bold mt-2">Support TFT Clash</h3>
          <p className="font-body text-xs text-on-surface-variant mt-1 mb-4">
            Keep the platform free for everyone.
          </p>
          <Btn
            variant="secondary"
            size="sm"
            onClick={function(){ window.open(getDonateUrl(), '_blank', 'noopener') }}
          >
            Donate
          </Btn>
        </div>
      </Panel>
```

If AccountScreen doesn't have a clear sidebar, insert above the "Danger Zone" or at the bottom of the main column.

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Visual check**

Run: `npm run dev`. Load `/` — verify the support section renders above the footer. Load `/account` — verify the support card is in the sidebar.

- [ ] **Step 7: Commit**

```bash
git add src/screens/HomeScreen.jsx src/screens/AccountScreen.jsx
git commit -m "feat(support): add keep-it-free support section on Home + Account"
```

---

## Phase 4 — Sponsor visibility upgrade

### Task 25: Create SponsorShowcase component

**Files:**
- Create: `src/components/shared/SponsorShowcase.jsx`

**Context:** Replaces the grayscale/opacity-40 sponsor strips with full-color, larger logos. Supports three variants (strip, featured, grid) so one component serves HomeScreen, LeaderboardScreen, DashboardScreen, BracketScreen, and SponsorsScreen.

- [ ] **Step 1: Create the component**

Create `src/components/shared/SponsorShowcase.jsx` with:

```jsx
import { useApp } from '../../context/AppContext'

function SponsorLogo({ sponsor, size }) {
  var heightClass = size === 'lg' ? 'h-20' : size === 'md' ? 'h-12' : 'h-8'
  var href = sponsor.url || sponsor.link_url || '#'
  var initial = (sponsor.name || '?').charAt(0).toUpperCase()

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="flex flex-col items-center gap-2 group"
      title={sponsor.name}
    >
      {sponsor.logo_url ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          className={heightClass + ' object-contain transition-transform duration-200 group-hover:scale-105'}
        />
      ) : (
        <div className={heightClass + ' aspect-square rounded-lg bg-surface-container-high border border-outline-variant/20 flex items-center justify-center'}>
          <span className="font-headline text-2xl font-bold text-primary">{initial}</span>
        </div>
      )}
      {sponsor.tagline ? (
        <span className="font-body text-xs text-on-surface-variant max-w-[200px] text-center">
          {sponsor.tagline}
        </span>
      ) : null}
    </a>
  )
}

export default function SponsorShowcase({ placement = 'homepage', variant = 'strip', eyebrow, className = '' }) {
  var ctx = useApp()
  var orgSponsors = ctx.orgSponsors || []

  var filtered = orgSponsors.filter(function(s) {
    if (s.status !== 'active') return false
    if (!s.placements || !Array.isArray(s.placements)) return true
    return s.placements.indexOf(placement) > -1
  })

  if (filtered.length === 0) return null

  var defaultEyebrow = placement === 'homepage' ? 'Partnered With'
    : placement === 'leaderboard' ? 'Leaderboard Powered By'
    : placement === 'dashboard' ? 'This week brought to you by'
    : placement === 'bracket' ? 'Bracket Presented By'
    : 'Our Partners'

  var finalEyebrow = eyebrow || defaultEyebrow

  if (variant === 'featured') {
    var first = filtered[0]
    return (
      <div className={'py-8 ' + className}>
        <div className="text-center mb-4">
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {finalEyebrow}
          </span>
        </div>
        <div className="flex justify-center">
          <SponsorLogo sponsor={first} size="lg" />
        </div>
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className={'py-8 ' + className}>
        <div className="text-center mb-6">
          <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {finalEyebrow}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 items-center">
          {filtered.map(function(sp) {
            return <SponsorLogo key={sp.id || sp.name} sponsor={sp} size="md" />
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={'py-6 border-y border-outline-variant/20 ' + className}>
      <div className="text-center mb-3">
        <span className="font-label text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {finalEyebrow}
        </span>
      </div>
      <div className="flex items-center justify-center gap-8 flex-wrap px-4">
        {filtered.map(function(sp) {
          return <SponsorLogo key={sp.id || sp.name} sponsor={sp} size="md" />
        })}
      </div>
    </div>
  )
}
```

Key properties:
- Full-color logos, no grayscale, no opacity reduction
- `h-12` default (up from `h-5` previously — 2.4x bigger)
- Border top/bottom only on strip variant (no background, no panel)
- `rel="sponsored noopener noreferrer"` for SEO compliance
- Graceful empty state (returns null if no matching sponsors)
- Reads `orgSponsors` from context, same as existing screens

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: Clean build (new file, no usages yet).

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/SponsorShowcase.jsx
git commit -m "feat(sponsors): SponsorShowcase component with strip/featured/grid variants"
```

---

### Task 26: Replace sponsor strips on HomeScreen and LeaderboardScreen

**Files:**
- Modify: `src/screens/HomeScreen.jsx:440-456`
- Modify: `src/screens/LeaderboardScreen.jsx:268-284`

- [ ] **Step 1: Add import in HomeScreen**

```jsx
import SponsorShowcase from '../components/shared/SponsorShowcase'
```

- [ ] **Step 2: Replace HomeScreen sponsor strip**

Find the existing sponsor strip block in HomeScreen (around line 440):
```jsx
        {/* ── Sponsor Strip ─────────────────────────────────────────────────── */}
        {homepageSponsors.length > 0 && (
          <div className="flex items-center justify-center gap-6 flex-wrap py-6 px-4 border-y border-outline-variant/10">
            <span className="text-[9px] font-bold text-on-surface/30 uppercase tracking-widest">Partnered With</span>
            {homepageSponsors.map(function(sp) {
              return (
                <div key={sp.name} className="flex items-center gap-2 opacity-40 hover:opacity-80 transition-opacity">
                  {sp.logo_url ? (
                    <img src={sp.logo_url} alt={sp.name} className="h-5 object-contain grayscale hover:grayscale-0 transition-all" />
                  ) : (
                    ...
                  )}
                </div>
              )
            })}
          </div>
        )}
```

Replace the entire block with:
```jsx
        {/* ── Sponsor Strip ─────────────────────────────────────────────────── */}
        <SponsorShowcase placement="homepage" variant="strip" />
```

- [ ] **Step 3: Remove the now-unused `homepageSponsors` computation**

Since the component handles filtering internally, delete the local filter:
```jsx
  var homepageSponsors = orgSponsors.filter(function(s) {
    return s.status === 'active' && s.placements && s.placements.indexOf('homepage') > -1
  })
```

Verify `orgSponsors` isn't used anywhere else in HomeScreen. If it isn't, also remove `var orgSponsors = ctx.orgSponsors || []`.

- [ ] **Step 4: Add import in LeaderboardScreen**

```jsx
import SponsorShowcase from '../components/shared/SponsorShowcase'
```

- [ ] **Step 5: Replace LeaderboardScreen sponsor strip**

Find (around line 268):
```jsx
        {/* Leaderboard Sponsors */}
        {lbSponsors.length > 0 && (
          <div className="flex items-center justify-center gap-6 flex-wrap py-4 mb-8 border-y border-outline-variant/10">
            ...
          </div>
        )}
```

Replace with:
```jsx
        {/* Leaderboard Sponsors */}
        <div className="mb-8">
          <SponsorShowcase placement="leaderboard" variant="strip" />
        </div>
```

- [ ] **Step 6: Remove the `lbSponsors` computation in LeaderboardScreen**

Same cleanup — delete the local filter and the `orgSponsors` var if unused.

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 8: Visual check**

Run: `npm run dev`. Load `/` and `/leaderboard`. Verify:
- Sponsors render full-color at h-12 size (not h-5 grayscale)
- If no sponsors are in the DB, the strip gracefully disappears

- [ ] **Step 9: Commit**

```bash
git add src/screens/HomeScreen.jsx src/screens/LeaderboardScreen.jsx
git commit -m "refactor(sponsors): replace grayscale strips with SponsorShowcase"
```

---

### Task 27: Add sponsors to Dashboard and Bracket

**Files:**
- Modify: `src/screens/DashboardScreen.jsx`
- Modify: `src/screens/BracketScreen.jsx`

- [ ] **Step 1: Add import in DashboardScreen**

```jsx
import SponsorShowcase from '../components/shared/SponsorShowcase'
```

- [ ] **Step 2: Insert featured sponsor above the fold**

Find the first major section in DashboardScreen (likely the next-clash countdown or welcome card). Insert just above it:

```jsx
        <div className="mb-8">
          <SponsorShowcase placement="dashboard" variant="featured" />
        </div>
```

The `featured` variant shows one large sponsor logo with optional tagline.

- [ ] **Step 3: Add import in BracketScreen**

```jsx
import SponsorShowcase from '../components/shared/SponsorShowcase'
```

- [ ] **Step 4: Insert sponsor strip in bracket header**

Find the bracket header section. Insert just below the bracket title:

```jsx
        <div className="mb-6">
          <SponsorShowcase placement="bracket" variant="strip" />
        </div>
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Visual check**

Run: `npm run dev`. Load `/dashboard` and `/bracket`. Verify sponsors render (or gracefully disappear if none).

- [ ] **Step 7: Commit**

```bash
git add src/screens/DashboardScreen.jsx src/screens/BracketScreen.jsx
git commit -m "feat(sponsors): show sponsors on Dashboard (featured) and Bracket (strip)"
```

---

### Task 28: Admin sponsor preview button

**Files:**
- Modify: `src/screens/AdminScreen.jsx` (sponsors tab)

**Context:** AdminScreen is a single-file 7-tab panel (per project memory). The sponsors tab is inside it. Add a "Preview" button next to each sponsor row that opens a modal rendering the live `SponsorShowcase` component.

- [ ] **Step 1: Locate the sponsors tab in AdminScreen**

Use Grep with pattern `sponsor` (case-insensitive) on `src/screens/AdminScreen.jsx` to find the sponsors tab markup and state.

- [ ] **Step 2: Add imports**

```jsx
import SponsorShowcase from '../components/shared/SponsorShowcase'
import Btn from '../components/ui/Btn'
```

(Btn may already be imported.)

- [ ] **Step 3: Add preview modal state**

Near the other `useState` calls in AdminScreen, add:
```js
var _previewSponsor = useState(null)
var previewSponsor = _previewSponsor[0]
var setPreviewSponsor = _previewSponsor[1]
```

- [ ] **Step 4: Add a preview button to each sponsor row**

In the sponsor row markup (within the sponsors tab), add:
```jsx
<Btn
  variant="secondary"
  size="sm"
  icon="visibility"
  iconPosition="left"
  onClick={function(){ setPreviewSponsor(sponsor) }}
>
  Preview
</Btn>
```

Adapt `sponsor` to whatever loop variable the existing map uses.

- [ ] **Step 5: Add a preview modal**

At the bottom of AdminScreen's render (or near existing modals), add:
```jsx
{previewSponsor ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={function(){ setPreviewSponsor(null) }}>
    <div className="bg-surface-container-highest rounded-xl p-8 max-w-2xl w-[90%] max-h-[80vh] overflow-auto" onClick={function(e){ e.stopPropagation() }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline text-xl font-bold">Sponsor Preview</h3>
        <Btn variant="ghost" size="sm" icon="close" onClick={function(){ setPreviewSponsor(null) }}>Close</Btn>
      </div>
      <div className="mb-6">
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-2">Homepage Strip</p>
        <SponsorShowcase placement={previewSponsor.placements && previewSponsor.placements[0] ? previewSponsor.placements[0] : 'homepage'} variant="strip" />
      </div>
      <div className="mb-2">
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-2">Featured</p>
        <SponsorShowcase placement={previewSponsor.placements && previewSponsor.placements[0] ? previewSponsor.placements[0] : 'homepage'} variant="featured" />
      </div>
    </div>
  </div>
) : null}
```

Note: This modal renders `SponsorShowcase` which pulls from context. If the preview sponsor isn't already in `orgSponsors` with `status: 'active'`, the preview will be empty. That's intentional — admins see exactly what users will see.

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 7: Manual test**

Run: `npm run dev`. Log in as admin. Load `/admin`. Switch to sponsors tab. Click Preview on any active sponsor. Verify modal opens and shows the live showcase component.

- [ ] **Step 8: Commit**

```bash
git add src/screens/AdminScreen.jsx
git commit -m "feat(admin): preview button for sponsors tab"
```

---

## Phase 5 — Discord audit and commands

### Task 29: Discord permission audit and fix

**Files:**
- Modify: `discord-bot/setup.js`

**Context:** Verify and fix channel permissions so `@Player` role can talk in community channels, read-only announcement channels are enforced, and admin channels are gated.

- [ ] **Step 1: Read the full setup.js file**

Use Read tool on `discord-bot/setup.js`.

Map out:
- Role definitions
- Category definitions
- Channel definitions
- Permission overwrites per channel

- [ ] **Step 2: Verify community channels allow @Player to send messages**

For each of these channels, verify `@Player` has `SendMessages: Allow`, `AddReactions: Allow`, `AttachFiles: Allow`, `EmbedLinks: Allow`:
- `general`
- `lfg` (looking for group)
- `clips`
- `meta-talk`
- `bot-commands`

If any are missing, add them to the channel's `permissionOverwrites` in the STRUCTURE constant. Example pattern:
```js
permissionOverwrites: [
  { id: '@everyone', deny: ['ViewChannel'] },
  { id: '@Player', allow: ['ViewChannel', 'SendMessages', 'AddReactions', 'AttachFiles', 'EmbedLinks'] },
  { id: '@Host', allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] },
]
```

Use discord.js `PermissionFlagsBits` constants if that's the existing pattern.

- [ ] **Step 3: Verify read-only channels deny @Player from sending**

For each of these channels, verify `@Player` has `ViewChannel: Allow`, `SendMessages: Deny`:
- `announcements`
- `rules`
- `results`
- `standings`
- `bracket`

And `@Host` has `SendMessages: Allow` (so hosts can post results/announcements).

- [ ] **Step 4: Verify admin channels deny @Player from viewing**

For each of these channels, verify `@Player` has `ViewChannel: Deny`:
- `bot-logs`
- `admin` (if exists)
- Any host-only channels

And `@Host` has full access.

- [ ] **Step 5: Test the setup script against the live guild**

Only run this step if you are certain you're pointed at the test guild, not the production guild. Check `.env.GUILD_ID` first.

Run from the `discord-bot/` directory:
```bash
node setup.js
```

Expected: Script reports which channels it created or updated, no errors.

**Alternative:** If you don't want to run against any live guild, just verify the STRUCTURE constant is correct and commit. A host can run setup.js against the production guild manually before launch.

- [ ] **Step 6: Document changes in the commit message**

List which channels' permissions were updated. Example: "community channels get @Player SendMessages, read-only gates @Player from announcements/results/standings/bracket, admin channels hidden from @Player."

- [ ] **Step 7: Commit**

```bash
git add discord-bot/setup.js
git commit -m "fix(discord): permission audit - community channels allow @Player talk, admin channels hidden"
```

---

### Task 30: Ship `/lobby` command

**Files:**
- Create: `discord-bot/commands/lobby.js`

**Context:** Shows the caller's current lobby assignment + opponents for the active tournament. Follows the same pattern as `checkin.js`.

- [ ] **Step 1: Read the existing checkin.js pattern**

Already done. Pattern: import SlashCommandBuilder, import getTournamentState + getPlayerByDiscordId, export data and execute function, defer reply ephemeral.

- [ ] **Step 2: Check what data helpers exist for lobbies**

Run Grep on `discord-bot/utils/data.js` (and adjacent utils files) for patterns like `lobby`, `tournament_rounds`, `lobby_players`. Identify the function that returns the current lobby for a player, or confirm no such helper exists.

- [ ] **Step 3: Create lobby.js**

Create `discord-bot/commands/lobby.js` with:

```js
import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('lobby')
  .setDescription('Show your current lobby assignment for the active TFT Clash');

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const ts = await getTournamentState();
  if (!ts || (ts.phase !== 'inprogress' && ts.phase !== 'checkin')) {
    return interaction.editReply('There is no active tournament right now. Use `/clash` to see the next clash.');
  }

  let player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) {
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('Link your account first with `/link account <username>`.');
    }
    const { data: pData } = await supabase
      .from('players')
      .select('id,username')
      .ilike('username', link.platform_name)
      .single();
    if (!pData) {
      return interaction.editReply('Could not find your linked player profile.');
    }
    player = { id: pData.id, name: pData.username };
  }

  const { data: assignment, error } = await supabase
    .from('lobby_players')
    .select('lobby_id, round, lobbies:lobby_id(id, name, room_code, room_password), players:player_id(username)')
    .eq('player_id', player.id)
    .eq('clash_number', ts.clashNumber)
    .order('round', { ascending: false })
    .limit(1)
    .single();

  if (error || !assignment) {
    return interaction.editReply('You are not assigned to a lobby for Clash #' + ts.clashNumber + '. Did you check in? Use `/checkin`.');
  }

  const { data: opponents } = await supabase
    .from('lobby_players')
    .select('players:player_id(username)')
    .eq('lobby_id', assignment.lobby_id)
    .neq('player_id', player.id);

  const opponentNames = (opponents || [])
    .map(function(o) { return o.players && o.players.username ? o.players.username : null; })
    .filter(Boolean)
    .join(', ');

  const lobby = assignment.lobbies || {};
  const lines = [
    '**Lobby:** ' + (lobby.name || 'Lobby ' + assignment.lobby_id),
    '**Round:** ' + assignment.round,
    '**Opponents:** ' + (opponentNames || 'Unknown'),
  ];
  if (lobby.room_code) lines.push('**Room code:** `' + lobby.room_code + '`');
  if (lobby.room_password) lines.push('**Password:** `' + lobby.room_password + '`');

  return interaction.editReply(lines.join('\n'));
}
```

- [ ] **Step 4: Verify the schema matches**

Confirm the table names and columns. Run:
```
Grep pattern: lobby_players|lobbies
Path: supabase/migrations/
Mode: files_with_matches
```

Then read the relevant migration to confirm column names. If the schema differs from the assumptions above (e.g. `round_number` instead of `round`), update the command accordingly.

- [ ] **Step 5: Syntax check**

Run from the `discord-bot/` directory:
```bash
node -e "import('./commands/lobby.js').then(function(m){ console.log('OK:', m.data.name); }).catch(function(e){ console.error('FAIL:', e.message); process.exit(1); });"
```

Expected: `OK: lobby`

- [ ] **Step 6: Commit**

```bash
git add discord-bot/commands/lobby.js
git commit -m "feat(discord): /lobby command shows current lobby assignment"
```

---

### Task 31: Ship `/submit` command

**Files:**
- Create: `discord-bot/commands/submit.js`

**Context:** Accepts a placement (1-8), inserts into `pending_results`. Validates the caller is assigned to a lobby in the active round.

- [ ] **Step 1: Verify `pending_results` table exists**

Run:
```
Grep pattern: pending_results
Path: supabase/migrations/
Mode: content
```

Note the column names. If the table doesn't exist, this command cannot ship — flag as blocker and create a migration first. The spec assumes it exists.

- [ ] **Step 2: Create submit.js**

Create `discord-bot/commands/submit.js` with:

```js
import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submit your placement for the current round')
  .addIntegerOption(function(option) {
    return option
      .setName('placement')
      .setDescription('Your placement (1-8)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8);
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const placement = interaction.options.getInteger('placement');

  const ts = await getTournamentState();
  if (!ts || ts.phase !== 'inprogress') {
    return interaction.editReply('No active round to submit for. Use `/clash` to see tournament status.');
  }

  let player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) {
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('Link your account first with `/link account <username>`.');
    }
    const { data: pData } = await supabase
      .from('players')
      .select('id,username')
      .ilike('username', link.platform_name)
      .single();
    if (!pData) {
      return interaction.editReply('Could not find your linked player profile.');
    }
    player = { id: pData.id, name: pData.username };
  }

  const { data: assignment } = await supabase
    .from('lobby_players')
    .select('lobby_id, round')
    .eq('player_id', player.id)
    .eq('clash_number', ts.clashNumber)
    .order('round', { ascending: false })
    .limit(1)
    .single();

  if (!assignment) {
    return interaction.editReply('You are not in a lobby for Clash #' + ts.clashNumber + '. Cannot submit.');
  }

  const currentRound = assignment.round;

  const { data: existing } = await supabase
    .from('pending_results')
    .select('id')
    .eq('player_id', player.id)
    .eq('clash_number', ts.clashNumber)
    .eq('round', currentRound)
    .maybeSingle();

  if (existing) {
    const { error: updateErr } = await supabase
      .from('pending_results')
      .update({ placement: placement, submitted_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (updateErr) {
      console.error('[submit] update error:', updateErr);
      return interaction.editReply('Failed to update placement. Try again.');
    }
    return interaction.editReply('✅ Updated placement to **' + placement + '** for Round ' + currentRound + '.');
  }

  const { error: insertErr } = await supabase
    .from('pending_results')
    .insert({
      player_id: player.id,
      clash_number: ts.clashNumber,
      round: currentRound,
      lobby_id: assignment.lobby_id,
      placement: placement,
      submitted_via: 'discord',
      submitted_at: new Date().toISOString(),
    });

  if (insertErr) {
    console.error('[submit] insert error:', insertErr);
    return interaction.editReply('Failed to submit placement. Try again or submit on the website.');
  }

  return interaction.editReply('✅ Submitted placement **' + placement + '** for Round ' + currentRound + '. An admin will verify.');
}
```

Note: This command inserts with `player_id = player.id` where `player.id` was derived from `getPlayerByDiscordId(interaction.user.id)`. This enforces the caller can only submit for themselves — no `player_id` parameter is accepted from the user.

- [ ] **Step 3: Adapt schema if needed**

If the `pending_results` columns don't match (e.g. `lobby_number` vs `lobby_id`, `clash` vs `clash_number`), adjust. Read the migration to confirm.

- [ ] **Step 4: Syntax check**

```bash
node -e "import('./commands/submit.js').then(function(m){ console.log('OK:', m.data.name); }).catch(function(e){ console.error('FAIL:', e.message); process.exit(1); });"
```

Expected: `OK: submit`

- [ ] **Step 5: Commit**

```bash
git add discord-bot/commands/submit.js
git commit -m "feat(discord): /submit command for placement entry"
```

---

### Task 32: Ship `/dispute` command

**Files:**
- Create: `discord-bot/commands/dispute.js`

- [ ] **Step 1: Verify `disputes` table exists**

Run:
```
Grep pattern: CREATE TABLE.*disputes|disputes_id_seq
Path: supabase/migrations/
Mode: content
```

If no migration creates `disputes`, flag as blocker. The 2026-04-06 spec designed this table but it may not have been applied. If missing, create a migration first with minimum columns: `id`, `player_id`, `clash_number`, `round`, `reason`, `status`, `created_at`.

- [ ] **Step 2: Create dispute.js**

Create `discord-bot/commands/dispute.js` with:

```js
import { SlashCommandBuilder } from 'discord.js';
import { getTournamentState, getPlayerByDiscordId } from '../utils/data.js';
import { getLink } from '../utils/db.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('dispute')
  .setDescription('File a dispute for a round you are in')
  .addIntegerOption(function(option) {
    return option
      .setName('round')
      .setDescription('The round number being disputed')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(8);
  })
  .addStringOption(function(option) {
    return option
      .setName('reason')
      .setDescription('What happened')
      .setRequired(true)
      .setMaxLength(500);
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const round = interaction.options.getInteger('round');
  const reason = interaction.options.getString('reason');

  const ts = await getTournamentState();
  if (!ts) {
    return interaction.editReply('No tournament state available.');
  }

  let player = await getPlayerByDiscordId(interaction.user.id);
  if (!player) {
    const link = await getLink(interaction.user.id);
    if (!link) {
      return interaction.editReply('Link your account first with `/link account <username>`.');
    }
    const { data: pData } = await supabase
      .from('players')
      .select('id,username')
      .ilike('username', link.platform_name)
      .single();
    if (!pData) {
      return interaction.editReply('Could not find your linked player profile.');
    }
    player = { id: pData.id, name: pData.username };
  }

  const { error } = await supabase
    .from('disputes')
    .insert({
      player_id: player.id,
      clash_number: ts.clashNumber,
      round: round,
      reason: reason,
      status: 'open',
      created_via: 'discord',
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[dispute] insert error:', error);
    return interaction.editReply('Failed to file dispute. Try again or contact an admin directly.');
  }

  return interaction.editReply('📋 Dispute filed for Clash #' + ts.clashNumber + ', Round ' + round + '. An admin will review shortly.');
}
```

- [ ] **Step 3: Adapt schema if needed**

Same as Task 31 — confirm column names match your migration.

- [ ] **Step 4: Syntax check**

```bash
node -e "import('./commands/dispute.js').then(function(m){ console.log('OK:', m.data.name); }).catch(function(e){ console.error('FAIL:', e.message); process.exit(1); });"
```

Expected: `OK: dispute`

- [ ] **Step 5: Commit**

```bash
git add discord-bot/commands/dispute.js
git commit -m "feat(discord): /dispute command for round disputes"
```

---

### Task 33: Ship `/tournament` command

**Files:**
- Create: `discord-bot/commands/tournament.js`

- [ ] **Step 1: Create tournament.js**

Create `discord-bot/commands/tournament.js` with:

```js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getTournamentState } from '../utils/data.js';
import { supabase } from '../utils/supabase.js';

export const data = new SlashCommandBuilder()
  .setName('tournament')
  .setDescription('Show the current TFT Clash tournament summary')
  .addIntegerOption(function(option) {
    return option
      .setName('clash')
      .setDescription('Clash number (defaults to current)')
      .setRequired(false)
      .setMinValue(1);
  });

export async function execute(interaction) {
  await interaction.deferReply();

  const ts = await getTournamentState();
  const requested = interaction.options.getInteger('clash');
  const clashNumber = requested || (ts ? ts.clashNumber : null);

  if (!clashNumber) {
    return interaction.editReply('No tournament data available.');
  }

  const { data: registrations } = await supabase
    .from('registrations')
    .select('status')
    .eq('clash_number', clashNumber);

  const total = (registrations || []).length;
  const checkedIn = (registrations || []).filter(function(r) { return r.status === 'checked_in'; }).length;

  const { data: standings } = await supabase
    .from('players')
    .select('username,pts,wins,top4s')
    .order('pts', { ascending: false })
    .limit(5);

  const topLines = (standings || [])
    .map(function(p, i) {
      const rank = i + 1;
      return '`#' + rank + '` **' + p.username + '** — ' + (p.pts || 0) + ' pts';
    })
    .join('\n');

  const phase = requested ? 'Historical' : (ts ? ts.phase : 'idle');
  const embed = new EmbedBuilder()
    .setTitle('TFT Clash #' + clashNumber)
    .setDescription('Phase: **' + phase + '**')
    .addFields(
      { name: 'Registered', value: String(total), inline: true },
      { name: 'Checked in', value: String(checkedIn), inline: true },
    );

  if (topLines) {
    embed.addFields({ name: 'Current top 5', value: topLines });
  }

  embed.setColor(0xFFCE78);
  embed.setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
```

- [ ] **Step 2: Syntax check**

```bash
node -e "import('./commands/tournament.js').then(function(m){ console.log('OK:', m.data.name); }).catch(function(e){ console.error('FAIL:', e.message); process.exit(1); });"
```

Expected: `OK: tournament`

- [ ] **Step 3: Commit**

```bash
git add discord-bot/commands/tournament.js
git commit -m "feat(discord): /tournament command shows summary + top 5"
```

---

### Task 34: Register new commands and smoke test

**Files:**
- Modify: `discord-bot/deploy-commands.js`
- Modify: `discord-bot/index.js` (if commands are loaded dynamically, no change needed — just verify)

- [ ] **Step 1: Read deploy-commands.js**

Use Read tool on `discord-bot/deploy-commands.js`. Find where existing commands are imported and registered.

- [ ] **Step 2: Add imports and registration for the 4 new commands**

If deploy-commands.js imports commands statically (e.g. `import * as checkin from './commands/checkin.js'`), add:
```js
import * as lobby from './commands/lobby.js';
import * as submit from './commands/submit.js';
import * as dispute from './commands/dispute.js';
import * as tournament from './commands/tournament.js';
```

Then add the four to the commands array used in the REST PUT call.

If deploy-commands.js already scans the `commands/` folder dynamically (e.g. using `fs.readdirSync`), no change is needed — the new files will be picked up automatically.

- [ ] **Step 3: Read index.js (the bot entry)**

Check how commands are loaded at runtime. Same logic — static imports need updates, dynamic discovery doesn't.

- [ ] **Step 4: Deploy commands to the test guild**

Only run against the test guild, not production. Check `.env.GUILD_ID`.

```bash
cd discord-bot
node deploy-commands.js
```

Expected: "Successfully reloaded N application (/) commands" where N is 17 (13 old + 4 new).

- [ ] **Step 5: Smoke test in live Discord**

Start the bot:
```bash
cd discord-bot
node index.js
```

In a test Discord channel:
1. Run `/clash` → current/next clash info returns
2. Run `/profile` → profile card returns
3. Run `/standings` → top 10 returns
4. Run `/tournament` → summary returns
5. Run `/lobby` → either lobby info or "not in a lobby" message
6. Post a regular message in `#general` → succeeds (permission smoke)
7. Try to post in `#announcements` → blocked (permission smoke)

If `/submit` and `/dispute` require an active round, skip the live test for those and rely on syntax check + next Sunday's clash.

- [ ] **Step 6: Verify production process target**

Check how the bot is expected to run in production. Options:
- Local VPS with `pm2` — run `pm2 status` to verify `tft-clash-bot` is online, `pm2 logs tft-clash-bot --lines 50` to verify no errors
- Railway / Fly.io / Render — check their dashboard for the service status
- Local dev machine only (current state) — **this is a launch blocker**

If there is no production target yet, do not pretend this step passed. Write a note in `docs/DISCORD-BOT-HOSTING.md` with:
- Current state: running on <local / nothing>
- Recommendation: cheapest stable option (Fly.io free tier or Railway hobby tier, ~$5/mo)
- Blocker until resolved

Flag this in the commit message so it's visible on git log.

- [ ] **Step 7: Commit**

```bash
git add discord-bot/deploy-commands.js
# If index.js was modified:
# git add discord-bot/index.js
# If hosting doc was added:
# git add docs/DISCORD-BOT-HOSTING.md
git commit -m "feat(discord): register lobby/submit/dispute/tournament commands"
```

---

## Phase 6 — Launch QA and security

### Task 35: Console.log sweep

**Files:**
- Modify: all files under `src/` and `discord-bot/` with active `console.log` calls

- [ ] **Step 1: Inventory console.log calls in src/**

```
Grep pattern: console\.log
Path: src/
Mode: content
```

Capture the list.

- [ ] **Step 2: For each match, decide: delete or keep**

- **Delete:** any `console.log` in production code paths (component renders, event handlers, lib functions)
- **Keep:** `console.error` in catch blocks (Sentry relies on these)
- **Keep:** `console.warn` in dev-gated branches (`if (import.meta.env.DEV)`)
- **Convert to comment or delete:** `console.log('tracking', x)` style instrumentation

For each file, use Edit to remove the line cleanly (don't leave a dangling semicolon or empty block).

- [ ] **Step 3: Inventory console.log in discord-bot/**

```
Grep pattern: console\.log
Path: discord-bot/
Mode: content
```

The bot uses `console.error` for DB errors (see checkin.js example) — keep those. Keep startup logs like `console.log('Bot ready as', client.user.tag)` in index.js since the bot has no other logging surface.

Delete only the `console.log('debug')` style leftovers.

- [ ] **Step 4: Verify clean grep**

```
Grep pattern: console\.log
Path: src/
Mode: count
```
Expected: 0 matches (or a very small number of dev-only branches).

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/ discord-bot/
git commit -m "chore: strip console.log from production code paths"
```

---

### Task 36: Security review via security-reviewer subagent

**Files:**
- No direct modifications — this task dispatches a subagent and applies its findings

- [ ] **Step 1: Dispatch the security-reviewer agent**

Use the Agent tool with `subagent_type: "security-reviewer"`. Prompt:

```
Review these files for security vulnerabilities ahead of public launch of tft-clash:

1. src/lib/paypal.js — subscription activation, donate URL generation
2. api/create-checkout.js, api/stripe-webhook.js, api/check-admin.js, api/ai-commentary.js, api/health.js — all HTTP endpoints
3. supabase/migrations/ — RLS policies on pending_results, disputes, user_subscriptions
4. src/lib/supabase.js — client config (verify anon key is public, service role is not exposed)
5. discord-bot/commands/submit.js — verify player_id is always derived from Discord user, never accepted from user input
6. discord-bot/commands/dispute.js — same check

Focus on:
- Secrets leaked in client-side code (VITE_ vars are bundled, anything without VITE_ is server-only)
- Missing input validation on API endpoints
- RLS policies that allow users to write to other users' rows
- SQL injection (parameterized queries only)
- Client-side "active" status manipulation (from memory: past incident)
- CSRF on state-changing endpoints

Report CRITICAL, HIGH, MEDIUM, LOW findings with file:line references. Recommend fixes inline.
```

- [ ] **Step 2: Apply CRITICAL and HIGH fixes**

For each finding:
- Read the affected file
- Apply the recommended fix as an Edit
- Verify build still passes after each fix

Triage MEDIUM and LOW findings — fix if trivial, file as follow-up if not.

- [ ] **Step 3: Commit fixes**

```bash
git add <affected files>
git commit -m "fix(security): address CRITICAL/HIGH findings from pre-launch review"
```

If no CRITICAL/HIGH findings, skip the commit and continue.

---

### Task 37: Environment variable audit

**Files:**
- No code modifications — operational task

- [ ] **Step 1: Produce the complete env var list for Vercel**

Read these files and extract every `import.meta.env.VITE_*` and every `process.env.*` reference:

```
Grep pattern: import\.meta\.env\.|process\.env\.
Path: src/
Mode: content
```

```
Grep pattern: process\.env\.
Path: api/
Mode: content
```

Build the complete list.

- [ ] **Step 2: Check each var is set in Vercel**

Run:
```bash
vercel env ls
```

(Requires Vercel CLI installed and logged in. If not, check via the Vercel web dashboard.)

Produce a diff: which vars are expected vs which are set.

- [ ] **Step 3: Set any missing vars**

For each missing var:
```bash
vercel env add VAR_NAME production
```

Prompt the user for values they don't want to hardcode (PayPal plan IDs, Anthropic API key, Supabase service role).

- [ ] **Step 4: Delete leftover STRIPE_* vars**

Per spec self-review: Stripe is removed from `src/` and `api/`. Any `STRIPE_*` vars in Vercel are dead. Delete them:
```bash
vercel env rm STRIPE_SECRET_KEY production
vercel env rm STRIPE_WEBHOOK_SECRET production
# etc for any others
```

- [ ] **Step 5: Check Supabase edge function secrets**

```bash
npx supabase secrets list
```

Verify:
- `GEMINI_API_KEY` is set (content-engine function)
- `ANTHROPIC_API_KEY` is set (if used in any edge function)
- Any other function-specific secrets

- [ ] **Step 6: Check Discord bot .env**

Verify the bot's `.env` file (wherever it runs — local dev, VPS, etc.) has:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `TIMEZONE`
- Supabase service role key for bot queries

- [ ] **Step 7: Trigger a Vercel redeploy if any vars were added**

Env var changes don't auto-deploy. Trigger a new deploy:
```bash
git commit --allow-empty -m "chore: trigger redeploy for env var updates"
git push
```

Or via dashboard: Deployments → redeploy latest.

- [ ] **Step 8: Document the final env var state**

Create a short note in the commit message or in `docs/ENV-VARS.md` listing which vars are set where. Do NOT commit actual secret values — just names and which environment they live in.

---

### Task 38: Golden path walkthrough

**Files:**
- No code modifications — verification task

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk through 13 steps on desktop**

Open a fresh incognito window. Go through:

1. Land on `/` as logged-out visitor — verify hero, countdown, leaderboard preview, sponsors (full-color), donate button, support section all render
2. Click "Join this week's tournament" or main CTA → Discord OAuth flow initiates
3. Complete signup, land on `/dashboard` — countdown visible, next clash card
4. Click "Register" for the active tournament → confirmation
5. (If clash is in check-in phase) Click "Check in" → confirmed
6. (If clash is in progress) View lobby assignment
7. Submit a placement on the results page
8. See results screen with copy/share buttons
9. Return to dashboard, verify leaderboard updated
10. Visit `/standings` → toggle Leaderboard → HoF → Leaderboard tabs, verify subRoute clears cleanly (Phase 0.1 fix)
11. Hover the #1 gold podium → verify trophy stays on top (Phase 0.2 fix)
12. Visit `/scrims` → try to add a 9th player on scrim tier (fake via dev override if needed), verify block + error message
13. Visit `/pricing` → verify scrim comparison row reads `- / - / 8 / 16 / 32`

- [ ] **Step 3: Walk through on mobile viewport**

Open DevTools → device toolbar → iPhone 12 Pro or similar. Repeat steps 1-13. Watch for:
- Text overflow on narrow screens
- Button touch targets (min 44px — enforced by new Btn but check)
- Hamburger nav behavior
- Podium podium layout stacks cleanly

- [ ] **Step 4: Log any failures**

For each failed step, read the file, diagnose, fix, commit with a `fix(...)` message. Re-run that step.

Re-walk steps 1-13 end-to-end at least once with zero failures before declaring done.

- [ ] **Step 5: Commit any fixes**

```bash
git add <affected files>
git commit -m "fix(launch-qa): <short description of issue fixed>"
```

---

### Task 39: Codex rescue pass on fragile subsystems

**Files:**
- No direct modifications — this task dispatches the Codex agent

- [ ] **Step 1: Identify fragile subsystems**

Candidates from the spec:
- Tournament state machine (`src/lib/tournament.js` + related screens)
- Submit-placement flow (new `submit.js` command + `pending_results` insert logic)
- Subscription webhook (`api/stripe-webhook.js` if it still exists, or whatever handles PayPal webhooks)

- [ ] **Step 2: Dispatch codex:codex-rescue**

Use the Agent tool with `subagent_type: "codex:codex-rescue"`. Prompt:

```
Second-opinion diagnosis pass ahead of tft-clash public launch. Focus on three subsystems:

1. Tournament state machine — src/lib/tournament.js. Verify the phase transitions (idle → registration → checkin → inprogress → results → idle) are safe under concurrent requests. Look for race conditions if two admins advance the phase simultaneously.

2. Submit-placement flow — discord-bot/commands/submit.js (new file this launch) and any API endpoint that also handles submissions. Verify there's no way for player A to submit a placement for player B. Verify the placement value is clamped to 1-8 server-side (Discord already clamps, but the web path may not).

3. PayPal subscription activation — src/lib/paypal.js activateSubscription function. The client writes 'pending', the webhook flips to 'active'. Verify no client-side code can flip status to 'active' directly. (Past incident: client-side active manipulation was a real bug.)

Report any root-cause issues found, with file:line references and recommended fixes.
```

- [ ] **Step 3: Apply any fixes Codex recommends**

For each finding, apply the fix as an Edit, build, verify.

- [ ] **Step 4: Commit**

```bash
git add <affected files>
git commit -m "fix(launch-qa): codex rescue pass findings"
```

If Codex reports no issues, skip the commit.

---

### Task 40: Final push and deploy

**Files:**
- No modifications

- [ ] **Step 1: Final build check**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 2: Final grep guard sweep**

Run all guards from `docs/DESIGN-SYSTEM.md`:

```
Grep pattern: rounded-\[
Path: src/
Mode: count
```
Expected: 0

```
Grep pattern: rounded-sm\b|rounded-2xl\b|rounded-3xl\b
Path: src/
Mode: count
```
Expected: 0

```
Grep pattern: font-condensed\b|font-nav\b|font-technical\b
Path: src/screens/
Mode: count
```
Expected: 0

```
Grep pattern: console\.log
Path: src/
Mode: count
```
Expected: 0 (or only dev-gated)

- [ ] **Step 3: Push to master**

```bash
git push
```

Expected: Clean push, Vercel auto-deploy kicks off.

- [ ] **Step 4: Watch Vercel deploy**

Run:
```bash
vercel --prod
```

Or watch via dashboard. Expected: Green build, deployed.

- [ ] **Step 5: Smoke test production URL**

Load the production URL in an incognito window. Quick sanity check on:
- Home loads
- Countdown runs
- Login flow works
- Sponsors render
- Donate link opens PayPal

If production-only env vars are missing and something's broken, fix and redeploy.

- [ ] **Step 6: Mark launch ready**

```bash
git commit --allow-empty -m "chore: launch push complete - ready for public launch"
git push
```

Update memory with launch-complete status (the memory system picks this up via the session summary).

---

## Implementation order

Tasks 1-40 in order. Each is commit-able; if anything derails, the prior task's commit is still shippable.

## Definition of done

- All 40 tasks committed and pushed
- Grep guards from Task 40 Step 2 all pass
- Dev-server walkthrough (Task 38) passes all 13 steps on desktop and mobile
- Security review (Task 36) shows zero CRITICAL or HIGH findings
- Vercel production build deploys green
- Discord bot process running and responding to slash commands

---

## Non-goals

- Riot API integration (blocked on external approval)
- Mobile native app
- Browser-based lobby voice chat
- Automated tournament scheduling
- Refactoring `App.jsx` legacy code beyond what's strictly required
- New features beyond what's listed here
