# Sprint 2 — Content Integrity + Nav Consolidation Design Spec
**Date:** 2026-03-24
**Status:** Approved by user

---

## 1. Goal

Fix three things that make the platform feel untrustworthy or broken:
1. **Nav**: two competing nav surfaces (top Navbar + left Sidebar) become one coherent system
2. **Home**: logged-out hero and logged-in dashboard priority order both need improvement
3. **Content**: 18 fake feature claims and 5 dead buttons across 6 screens removed or replaced

---

## 2. Scope

**In scope:** Navbar/Sidebar nav consolidation, right-side drawer, home page improvements (logged-in + logged-out), fake content removal across EventsScreen/PricingScreen/RulesScreen/FAQScreen/HofScreen/MilestonesScreen/ChallengesScreen, dead button fixes, mobile bottom tab bar for the 4 main routes.

**Out of scope:** Stripe payment wiring (buttons become "Coming Soon"), Discord bot, tournament engine changes, any new database tables or Supabase calls beyond what already exists.

---

## 3. Nav Consolidation

### 3.1 Pattern

**Top bar (always visible):** Logo left. Four primary route pills: `Clash · Standings · Hall of Fame · Pricing`. Hamburger icon right of pills. User avatar far right.

**Right-side drawer (manual open):** Triggered by hamburger. Slides in from the right at 240px width, floating over content with a dark scrim (`bg-black/40`) behind it. Clicking any link or the scrim closes it. Grouped into three sections:

| Section | Links |
|---|---|
| Main | Clash, Standings, Leaderboard, Hall of Fame |
| Community | Archive, Results, Milestones, Challenges, Scrims |
| Account | Profile/Account, Pricing, Rules, FAQ |

Admin-only items (Admin panel, Host Dashboard) appear in a fourth "Admin" section when `isAdmin` is true.

**Mobile:** Same top bar (logo + hamburger + avatar). Bottom tab bar with the same 4 primary routes (`Clash · Standings · HoF · Pricing`), tab icons use Material Symbols. Hamburger opens the same full-width drawer for secondary routes.

### 3.2 Implementation

**Remove from left Sidebar (`Sidebar.jsx`):** All nav `<Link>` elements. Keep the Sidebar component file — it may be used for admin contextual panels later — but strip all navigation links. The "Join Clash" button in Sidebar is removed (dead button, covered in Section 5).

**Update Navbar:** The legacy Navbar lives inside `App.jsx`. Extract it to `src/components/layout/Navbar.jsx` as a standalone component — this is Phase 1's first step. Add the four primary pills, the hamburger button, and the drawer state. Drawer is a controlled state (`showDrawer` bool) local to Navbar. Update `App.jsx` to import and render the new `<Navbar>` in place of the old inline code.

**Drawer component:** Define `NavDrawer` at module scope inside Navbar.jsx (or as a sibling file). Renders the grouped link list. Uses `useNavigate` to navigate and closes drawer on link click.

**Active state:** Pills and drawer items highlight the active route using `useLocation().pathname` matching.

**Code style:** `var` declarations, `function(){}` callbacks, Tailwind classes, `<Icon>` for Material Symbols.

---

## 4. Home Page Improvements

### 4.1 Logged-Out (HomeScreen)

Current state: generic hero text, minimal real content.

**New hero layout (top of screen):**
- Headline: `"The weekly TFT clash. Every Saturday night."`
- Subtext: Next clash date + countdown timer (reuse `CountdownTimer` component if tournament state is available, otherwise show day-of-week)
- Primary CTA: `"Sign Up Free"` → `/signup`
- Secondary: `"View Standings"` → `/standings`

**Below hero:**
- Leaderboard preview strip: top 3 players from `players` state, showing rank badge, name, and pts. Static/read-only, no auth required. Pulled from AppContext `players` array (already public-readable).
- One-liner value props: 3 horizontal chips — `"Free to enter · Always"`, `"EUW · EUNE · NA"`, `"Results every Saturday"` — factual only, no invented claims.

Remove any existing "anti-cheat", "24/7 support", or other fake feature claims that may appear on the logged-out home.

### 4.2 Logged-In (DashboardScreen)

**New section order:**
1. ClashCard (most important — registration / live state / results)
2. Current standings (top 5 or full list, already exists)
3. Recent activity feed (already exists)

If sections are already in this order, verify and leave as-is. If not, reorder the JSX. No new data fetching required.

---

## 5. Fake Content Removal

All changes below are text/UI edits only — no new DB columns, no new API calls.

### 5.1 EventsScreen

| Remove | Replace with |
|---|---|
| "Active Anticheat Enabled" badge | "Community moderated" |
| Any anti-cheat description copy | Remove entirely |

### 5.2 PricingScreen

The pricing table currently shows features that do not exist. Apply these changes:

| Remove | Replace with |
|---|---|
| "Custom Match Lobbies" row | Remove row |
| "24/7 Support" / "24/7 Live Support" | "Support via Discord" |
| "Pro Circuit Access" | Remove row |
| "Advanced Analytical HUD" | Remove row |
| "1.5x Tournament Reward Multiplier" | Remove row |
| "Priority Matchmaking Queue" | Remove row |
| "Custom Profile Banners + Tags" | Remove row |
| "Dedicated Discord Support Bot" | Remove row |
| "Global Servers" | "EUW · EUNE · NA" |
| "10 tournaments/month" free tier limit | Remove — no limits exist |
| "Become A Pro" button | "Coming Soon" non-interactive tag (see Section 5 dead buttons) |
| "Start Hosting" button | "Coming Soon" non-interactive tag |

Keep all rows that describe real features: joining clashes, season leaderboard, clash history, Discord community.

### 5.3 RulesScreen

| Remove | Replace with |
|---|---|
| "5-minute response time" copy | "Reach us on Discord" |
| "Rulebook Masterclass on Discord" card | Remove card entirely |
| "Open Support Ticket" button | "Join Discord" button (links to Discord invite URL — use `#` as href until real URL is provided, with `target="_blank"`) |

### 5.4 FAQScreen

| Remove | Replace with |
|---|---|
| "Open Support Ticket" / "priority ticketing" copy | Discord link text |
| "24/7" support claims | "via Discord" |
| "1.5x Tournament Reward Multiplier" FAQ entry | Remove entry |
| "Custom Profile Banners" FAQ entry | Remove entry |
| "2024 TFT CLASH" year reference | "2026 TFT CLASH" |

### 5.5 HofScreen

| Remove | Replace with |
|---|---|
| "professional scrims" | "competitive play" |

### 5.6 MilestonesScreen

| Remove | Replace with |
|---|---|
| Season Champion cosmetic reward description | Add `"Coming Soon"` tag alongside or replace copy with `"Cosmetic rewards — coming soon"` |

### 5.7 ChallengesScreen

| Remove | Replace with |
|---|---|
| XP Log tab | Hide the tab via conditional render — wrap the tab button and its panel in `{false && ...}` or a `showXpLog` flag set to `false`. No inline styles. XP history system not yet implemented. |

---

## 6. Dead Buttons

| Location | Dead element | Fix |
|---|---|---|
| RulesScreen | "OPEN SUPPORT TICKET" button | Replace with "Join Discord" → `<a href="#" target="_blank">` (placeholder URL) |
| ArchiveScreen | "DETAILS" button in minor tournament table | Remove button — ClashReport navigation not yet wired for archive entries |
| Sidebar | "Join Clash" button | Remove — Sidebar nav links are being stripped (Section 3.2) |
| PricingScreen | "Become A Pro" + "Start Hosting" | Replace with honest `"Coming Soon"` state: grey non-clickable tag, no button |
| HomeScreen | Logged-in FAB that shows sign-up flow | Conditional: if `currentUser` exists, show `"Go to Dashboard"` CTA linking to `/` (dashboard) instead of sign-up flow |

---

## 7. Code Style Rules (Non-Negotiable)

Every file touched must comply with CLAUDE.md:
- `var` declarations — no `const`/`let` in React components and app logic
- `function(){}` callbacks — no arrow functions
- No backtick string literals inside JS functions
- No named function components defined inside another component's body
- Tailwind CSS classes for all styling — no inline styles in new/modified code
- Material Symbols Outlined icons (`<Icon>`) in all new/modified screens
- `supabase.js` is exempt from these rules
- `Sel` component: define locally in any screen that needs a `<select>` element

---

## 8. Implementation Phases

**Phase 1 — Nav consolidation**
- Update Navbar: add primary pills, hamburger, drawer state, NavDrawer component
- Strip Sidebar nav links (keep file, remove Link elements)
- Add mobile bottom tab bar (render inside Navbar on mobile breakpoint)
- Verify active route highlighting works across all routes

**Phase 2 — Home page improvements**
- Update HomeScreen: new logged-out hero, leaderboard preview strip, factual value props
- Update DashboardScreen: verify/reorder sections to ClashCard → Standings → Activity
- Fix logged-in FAB showing sign-up flow

**Phase 3 — Fake content + dead buttons (batch)**
- EventsScreen: remove anti-cheat
- PricingScreen: strip fake rows, fix CTA buttons
- RulesScreen: replace support ticket, remove masterclass card, fix response time copy
- FAQScreen: fix support copy, remove fake FAQ entries, fix year
- HofScreen: fix "professional scrims" copy
- MilestonesScreen: add "Coming Soon" to cosmetic rewards
- ChallengesScreen: hide XP Log tab
- ArchiveScreen: remove dead DETAILS button
