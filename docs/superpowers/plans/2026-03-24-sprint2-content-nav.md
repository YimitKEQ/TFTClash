# Sprint 2 — Content Integrity + Nav Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the platform's two nav surfaces into one system, improve home page priority, and scrub 18 fake feature claims + 5 dead buttons across 8 screens.

**Architecture:** Three independent work streams — (1) nav consolidation touching `Navbar.jsx`, `index.css`, `PageLayout.jsx`, `Sidebar.jsx`; (2) home page improvements in `HomeScreen.jsx`; (3) batch content audit touching 7 screens. No new DB tables, no new API calls, no new routes.

**Tech Stack:** React 18, React Router 6, Tailwind CSS 3, Material Symbols Outlined icons, `var` declarations + `function(){}` callbacks throughout (CLAUDE.md rules).

**Spec:** `docs/superpowers/specs/2026-03-24-sprint2-content-nav-design.md`

---

## File Map

| File | Change type |
|---|---|
| `src/components/layout/Navbar.jsx` | Modify — update desktop links, hamburger, drawer direction + items |
| `src/index.css` | Modify — drawer slides from right, hamburger visible on desktop |
| `src/components/layout/PageLayout.jsx` | Modify — remove Sidebar, remove ml-64 offset |
| `src/components/layout/Sidebar.jsx` | Modify — strip all nav links (keep file as stub) |
| `src/screens/HomeScreen.jsx` | Modify — fix FAB conditional + hero tagline |
| `src/screens/DashboardScreen.jsx` | Verify only — confirm section order, no change expected |
| `src/screens/EventsScreen.jsx` | Modify — remove anti-cheat |
| `src/screens/HofScreen.jsx` | Modify — fix "professional scrims" copy |
| `src/screens/MilestonesScreen.jsx` | Modify — mark cosmetic rewards "Coming Soon" |
| `src/screens/ChallengesScreen.jsx` | Modify — hide XP Log tab |
| `src/screens/ArchiveScreen.jsx` | Modify — remove dead DETAILS button |
| `src/screens/PricingScreen.jsx` | Modify — strip 10 fake rows, fix CTAs to "Coming Soon" |
| `src/screens/RulesScreen.jsx` | Modify — Discord button, remove masterclass, fix response time |
| `src/screens/FAQScreen.jsx` | Modify — fix fake entries, 24/7 claims, year |

---

## Task 1: Nav — Navbar.jsx + index.css

**Context:** `Navbar.jsx` already exists at `src/components/layout/Navbar.jsx`. It has a desktop top nav, a mobile bottom bar, and a left-side drawer. We're updating the desktop links to 4 primary routes, making the hamburger visible on desktop, changing the drawer to slide from the right, and updating drawer items to the new grouping.

**Files:**
- Modify: `src/components/layout/Navbar.jsx`
- Modify: `src/index.css`

---

- [ ] **Step 1: Update `DESKTOP_PRIMARY` in Navbar.jsx**

Find the `DESKTOP_PRIMARY` array (around line 252). Replace it entirely:

```js
var DESKTOP_PRIMARY = [
  clashItem ? {
    id: "clash",
    label: phase === "live" ? "\u25cf LIVE CLASH" : phase === "registration" ? "Clash - Register" : phase === "complete" ? "Clash - Results" : "Clash"
  } : { id: "clash", label: "Clash" },
  { id: "standings", label: "Standings" },
  { id: "hof", label: "Hall of Fame" },
  { id: "pricing", label: "Pricing" }
].filter(Boolean);
```

- [ ] **Step 2: Remove `DESKTOP_MORE`, `moreItems`, `desktopMoreActive` from Navbar.jsx**

Delete these three variable declarations (around lines 264-286):
- `var DESKTOP_MORE = [...]`
- `var moreItems = [...]`
- `var desktopMoreActive = ...`

- [ ] **Step 3: Update `DRAWER_ITEMS` in Navbar.jsx**

Find `var DRAWER_ITEMS = [...]` (around line 298). Replace the entire DRAWER_ITEMS definition block (including the `if (canScrims)`, `if (isAdmin)`, and `.concat(...)` calls) with:

```js
var communityItems = [
  { id: "archive", icon: "inventory_2", label: "Archive", section: "community" },
  { id: "results", icon: "assignment_turned_in", label: "Results", section: "community" },
  { id: "milestones", icon: "redeem", label: "Milestones", section: "community" },
  { id: "challenges", icon: "star", label: "Challenges", section: "community" }
];

if (canScrims) {
  communityItems = communityItems.concat([
    { id: "scrims", icon: "sports_esports", label: "Scrims", section: "community" }
  ]);
}

var adminItems = isAdmin ? [
  { id: "admin", icon: "shield", label: "Admin Panel", section: "admin" },
  { id: "host-dashboard", icon: "workspace_premium", label: "Host Dashboard", section: "admin" }
] : [];

var DRAWER_ITEMS = [
  { id: "clash", icon: "swords", label: "Clash", section: "main" },
  { id: "standings", icon: "bar_chart", label: "Standings", section: "main" },
  { id: "leaderboard", icon: "leaderboard", label: "Leaderboard", section: "main" },
  { id: "hof", icon: "emoji_events", label: "Hall of Fame", section: "main" }
].concat(communityItems).concat([
  { id: "account", icon: "person", label: currentUser ? ("Account - " + currentUser.username) : "Sign In / Sign Up", section: "account" },
  { id: "pricing", icon: "sell", label: "Pricing", section: "account" },
  { id: "rules", icon: "menu_book", label: "Rules", section: "account" },
  { id: "faq", icon: "help", label: "FAQ", section: "account" }
]).concat(adminItems);
```

- [ ] **Step 4: Update mobile `PRIMARY` bottom bar in Navbar.jsx**

Find `var PRIMARY = [...]` (around line 243). Replace it:

```js
var PRIMARY = [
  clashItem ? Object.assign({}, clashItem, { icon: "swords" }) : { id: "clash", icon: "swords", label: "Clash" },
  { id: "standings", icon: "bar_chart", label: "Standings" },
  { id: "hof", icon: "emoji_events", label: "HoF" },
  { id: "pricing", icon: "sell", label: "Pricing" },
  { id: "more", icon: "more_horiz", label: "More" }
].filter(Boolean);
```

- [ ] **Step 5: Move hamburger button to right of desktop links + make it always visible**

In the JSX, the hamburger is currently at the very start of the nav (before the logo) with class `mobile-hamburger` that hides it on desktop.

Find the hamburger button element:
```jsx
<button
  className="mobile-hamburger bg-transparent border-none p-2 mr-2 cursor-pointer text-[#C8D4E0] text-[22px] flex items-center justify-center"
  onClick={function() { setDrawer(function(d) { return !d; }); }}
>
  <Icon name="menu" size={22} />
</button>
```

**Delete** that button from its current position (before the logo).

Then find the "Right side actions" div (around line 521, `<div className="flex items-center gap-1.5 ml-auto shrink-0">`). Insert the hamburger button **before** the notifications bell:

```jsx
{/* Hamburger — opens drawer on all screen sizes */}
<button
  className="bg-transparent border border-[rgba(242,237,228,0.1)] rounded-lg p-1.5 cursor-pointer text-[#C8D4E0] hover:text-[#F2EDE4] flex items-center justify-center transition-colors duration-150"
  onClick={function() { setDrawer(function(d) { return !d; }); }}
>
  <Icon name="menu" size={20} />
</button>
```

- [ ] **Step 6: Remove "More" dropdown JSX from Navbar.jsx**

Find the "More dropdown" block in the desktop links section (around lines 484-517):
```jsx
{/* More dropdown */}
<div className="relative shrink-0">
  ...
</div>
```
Delete it entirely.

- [ ] **Step 7: Change drawer to slide from right in index.css**

Find the `.drawer` rule in `src/index.css` (around line 250):
```css
.drawer{position:fixed;left:0;top:0;bottom:0;width:280px;...border-right:1px solid rgba(232,168,56,.2);...box-shadow:4px 0 32px rgba(0,0,0,.6);...}
```

Replace it with:
```css
.drawer{position:fixed;right:0;top:0;bottom:0;width:240px;max-width:85vw;background:linear-gradient(180deg,#0E1826,#08101A);border-left:1px solid rgba(232,168,56,.2);z-index:195;animation:slide-drawer .22s ease;display:flex;flex-direction:column;padding:16px 0;box-shadow:-4px 0 32px rgba(0,0,0,.6);overflow-y:auto;}
```

- [ ] **Step 8: Update `slide-drawer` keyframe to slide from right in index.css**

Find:
```css
@keyframes slide-drawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}
```

Replace with:
```css
@keyframes slide-drawer{from{transform:translateX(100%)}to{transform:translateX(0)}}
```

- [ ] **Step 9: Verify drawer scrim exists**

In `Navbar.jsx`, find the drawer JSX block (around line 355). It should look like:
```jsx
{drawer && (
  <>
    <div className="drawer-overlay" onClick={function() { setDrawer(false); }} />
    <div className="drawer">...</div>
  </>
)}
```

The `.drawer-overlay` is defined in `index.css` as `position:fixed;inset:0;background:rgba(0,0,0,.7)`. This is the dark backdrop scrim — it already exists and already closes the drawer on click. No changes needed. If it is missing for any reason, add it as above before the `.drawer` div.

- [ ] **Step 10: Verify in browser**

Run `npm run dev`. Open http://localhost:5173 (or whichever port Vite picks).

- Desktop: top bar shows Clash, Standings, Hall of Fame, Pricing pills + hamburger icon on the right. No "More" dropdown.
- Click hamburger: drawer slides in from the RIGHT with 4 sections (Main, Community, Account, Admin if admin).
- Mobile: bottom bar shows Clash, Standings, HoF, Pricing, More. More opens the drawer.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/Navbar.jsx src/index.css
git commit -m "feat: update nav to 4 primary links, right-side drawer, desktop hamburger"
```

---

## Task 2: Nav — Hide Sidebar in PageLayout

**Context:** `PageLayout.jsx` conditionally renders `<Sidebar />` for logged-in users. Sidebar has nav links that duplicate the top nav. We're hiding the Sidebar entirely and removing the content offset it creates.

**Files:**
- Modify: `src/components/layout/PageLayout.jsx`
- Modify: `src/components/layout/Sidebar.jsx`

---

- [ ] **Step 1: Remove Sidebar from PageLayout.jsx**

Open `src/components/layout/PageLayout.jsx`. It currently reads:

```jsx
import { useAuth } from '../../hooks/useAuth'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import Footer from './Footer'

export default function PageLayout({ children, showSidebar = true, maxWidth = 'max-w-7xl' }) {
  const { isLoggedIn } = useAuth()
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
    </div>
  )
}
```

Replace the entire file with:

```jsx
import Navbar from './Navbar'
import Footer from './Footer'

export default function PageLayout({ children, showSidebar, maxWidth }) {
  var mw = maxWidth || 'max-w-7xl'
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-24 md:pb-12 px-4 md:px-8">
        <div className={mw + " mx-auto"}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
```

Note: `showSidebar` prop is kept in the signature (ignored) so existing callers like `<PageLayout showSidebar={false}>` don't break.

- [ ] **Step 2: Strip nav links from Sidebar.jsx**

Open `src/components/layout/Sidebar.jsx`. Remove all `<Link>` elements, nav link arrays (PLAY_LINKS, COMPETE_LINKS, ME_LINKS), the "Join Clash" button (lines ~109-116), and the footer section with Sign Out / Sign In buttons. The file is no longer imported by PageLayout (Step 1 removed the import), but keep it as a stub for future admin panel use:

```jsx
// Sidebar — nav links removed (Sprint 2). Kept as stub for future admin contextual panels.
export default function Sidebar() {
  return null
}
```

This is equivalent to the spec's "hidden class on the sidebar wrapper in layout" — the sidebar is hidden because it is never rendered.

- [ ] **Step 3: Verify in browser**

- No sidebar panel on any page (logged in or out)
- Content fills the full width — no `ml-64` offset on desktop
- All pages still load without errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/PageLayout.jsx src/components/layout/Sidebar.jsx
git commit -m "feat: hide sidebar, remove content offset — single nav surface"
```

---

## Task 3: HomeScreen — hero copy, value chips, secondary CTA, FAB fix

**Context:** HomeScreen already has a countdown timer, leaderboard preview, and sign-up CTA. Missing: "View Standings" secondary CTA, three factual value-prop chips, and the FAB navigates to signup even when already logged in.

The current hero has:
- `HeroCountdown` component (countdown + "Register Now" button) — when a clash is scheduled
- Fallback "Create Free Account" panel — when no clash is scheduled
- `SeasonStatsBar` (4 stat boxes)
- `LeaderboardPreview` (top 5 players)
- `PromotionFooter`

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

---

- [ ] **Step 1: Scan HomeScreen for fake claims**

Before making any changes, search `HomeScreen.jsx` for these strings: "anti-cheat", "anticheat", "24/7", "Anti-Cheat", "Anticheat". If any are found in rendered JSX (not comments), remove them. The `PromotionFooter`, `SeasonStatsBar`, and hero section are the most likely places. If nothing is found, proceed to Step 2.

- [ ] **Step 2: Fix hero tagline**

Find (around line 316):
```jsx
<p className="max-w-xl mx-auto text-on-surface-variant font-headline text-xl opacity-60">
  Weekly TFT Clash. Every Saturday.
</p>
```

Replace with:
```jsx
<p className="max-w-xl mx-auto text-on-surface-variant font-headline text-xl opacity-60">
  The weekly TFT clash. Every Saturday night.
</p>
```

- [ ] **Step 2: Update CTA button text in `HeroCountdown`**

Find the button in `HeroCountdown` (around line 62-66):
```jsx
<button ... onClick={onRegister}>
  Register Now
</button>
```
Change button text to `Sign Up Free`.

Find the fallback CTA panel (around line 332-338):
```jsx
Create Free Account
```
Change to `Sign Up Free`.

- [ ] **Step 3: Add "View Standings" secondary CTA to `HeroCountdown`**

Inside `HeroCountdown`, after the "Sign Up Free" primary button, add a secondary link:
```jsx
<a
  href="/standings"
  className="block text-center text-sm text-on-surface-variant underline-offset-2 hover:underline mt-1 cursor-pointer no-underline"
  onClick={function(e) { e.preventDefault(); onViewStandings && onViewStandings(); }}
>
  View Standings
</a>
```

In the fallback CTA panel, add the same secondary link after the primary button.

In the `HomeScreen` component, add a `handleViewStandings` function:
```js
function handleViewStandings() {
  navigate('/standings')
}
```

Pass it to `HeroCountdown` and the fallback panel: `onViewStandings={handleViewStandings}`.

Update `HeroCountdown`'s props to accept `onViewStandings`.

- [ ] **Step 4: Add value-prop chips below the hero section**

In the `HomeScreen` JSX return, after the `</section>` that closes the hero block (around line 342) and before `<SeasonStatsBar ...>`, add:

```jsx
{/* Value props */}
<div className="flex flex-wrap justify-center gap-3">
  {['Free to enter \u00b7 Always', 'EUW \u00b7 EUNE \u00b7 NA', 'Results every Saturday'].map(function(chip) {
    return (
      <span key={chip} className="px-4 py-1.5 rounded-full text-xs font-label tracking-widest uppercase border border-outline-variant/20 text-on-surface-variant bg-surface-container-low">
        {chip}
      </span>
    );
  })}
</div>
```

- [ ] **Step 5: Fix FAB to be conditional on login state**

Find the FAB (around lines 371-379). It currently has `style={{ boxShadow: ... }}` (inline style — violates CLAUDE.md). Replace the entire FAB:

```jsx
<button
  className="fixed bottom-8 right-8 z-50 w-16 h-16 rounded-xl flex items-center justify-center active:scale-95 transition-all group overflow-hidden border-0 cursor-pointer bg-gradient-to-br from-primary to-primary-fixed-dim shadow-[0_10px_30px_rgba(232,168,56,0.4)]"
  onClick={function() {
    if (currentUser) {
      navigate('/');
    } else {
      handleSignUp();
    }
  }}
>
  <span className="material-symbols-outlined text-on-primary-fixed group-hover:scale-110 transition-transform text-3xl">
    {currentUser ? 'dashboard' : 'add_circle'}
  </span>
</button>
```

Note: `shadow-[0_10px_30px_rgba(232,168,56,0.4)]` replaces the `style={{ boxShadow }}` inline style.

- [ ] **Step 6: Verify**

- Value prop chips visible below the hero on the logged-out home
- "Sign Up Free" text on primary CTA
- "View Standings" secondary link below primary CTA
- FAB: logged-out shows `add_circle` and opens signup. Logged-in shows `dashboard` icon and navigates to `/`.

- [ ] **Step 7: Commit**

```bash
git add src/screens/HomeScreen.jsx
git commit -m "feat: home hero chips, View Standings CTA, Sign Up Free text, fix logged-in FAB"
```

---

## Task 4: DashboardScreen — Verify section order

**Context:** Spec requires ClashCard first, then standings, then activity. Explore agent confirms ClashCard is already at line 1182 (first rendered), StandingsMini at ~1347, ActivityFeed below it. Verify this is correct and move on.

**Files:**
- Verify only: `src/screens/DashboardScreen.jsx`

---

- [ ] **Step 1: Open DashboardScreen.jsx and scan the JSX return block**

Confirm the rendering order in the return statement is: ClashCard → (announcements/stats) → standings → activity feed. If already in this order, no changes needed. If ClashCard is NOT first, move it to the top of the return block.

- [ ] **Step 2: Commit (only if changes were made)**

```bash
git add src/screens/DashboardScreen.jsx
git commit -m "fix: ensure ClashCard renders first in DashboardScreen"
```

---

## Task 5: Batch content — EventsScreen, HofScreen, MilestonesScreen, ChallengesScreen, ArchiveScreen

**Context:** Five screens with small isolated content fixes. All text/UI changes only. Batch them into one commit.

**Files:**
- Modify: `src/screens/EventsScreen.jsx` (line ~374-379)
- Modify: `src/screens/HofScreen.jsx` (line ~97)
- Modify: `src/screens/MilestonesScreen.jsx` (line ~154)
- Modify: `src/screens/ChallengesScreen.jsx` (lines ~156-170, 358-370)
- Modify: `src/screens/ArchiveScreen.jsx` (line ~286)

---

- [ ] **Step 1: EventsScreen — remove anti-cheat badge**

Find around line 374-379 in `EventsScreen.jsx`. Look for text containing "Active Anticheat Enabled", "monitored", or any `verified_user` icon alongside anti-cheat copy.

Remove the entire anti-cheat badge/section. If there is a container div that only held the anti-cheat badge, replace it with:
```jsx
<span className="text-xs text-[#9AAABF]">Community moderated</span>
```
If the badge is inside a larger features list, just remove the anti-cheat item.

- [ ] **Step 2: HofScreen — fix "professional scrims" copy**

Find around line 97 in `HofScreen.jsx`. Look for the string `"professional scrims"` inside a description field.

Change:
```
"professional scrims"  →  "competitive play"
```

- [ ] **Step 3: MilestonesScreen — mark cosmetic rewards "Coming Soon"**

Find around line 154 in `MilestonesScreen.jsx` where `{m.reward}` is rendered. Look at how rewards are displayed in the `MilestoneRow` component.

Wrap the reward display so it appends a "Coming Soon" tag for cosmetic rewards:
```jsx
<span className="text-xs text-[#9AAABF]">
  {m.reward}
  {' '}
  <span className="text-[10px] text-[#6B7280] border border-[rgba(107,114,128,0.3)] rounded px-1.5 py-0.5">
    Coming Soon
  </span>
</span>
```

If all milestones have rewards, apply this to all. If only some have cosmetic reward text, apply only to those with "cosmetic" or "reward" in the reward string.

- [ ] **Step 4: ChallengesScreen — hide XP Log tab**

Find the tab buttons section around line 156-170 in `ChallengesScreen.jsx`. Look for a tab with label "XP Log". Wrap that specific tab button in a conditional that never renders:

```jsx
{false && (
  <button ...>XP Log</button>
)}
```

Also find the XP Log content panel (around lines 358-370). Wrap it in the same `{false && (...)}` guard.

Make sure the default active tab is NOT "xp-log". If initial tab state is set to "xp-log", change it to "active".

- [ ] **Step 5: ArchiveScreen — remove dead DETAILS button**

Find around line 286 in `ArchiveScreen.jsx` the DETAILS button inside the minor tournament table row. Delete the button element entirely. The table row can exist without the button.

- [ ] **Step 6: Verify all 5 screens load without errors**

Navigate to `/events`, `/hall-of-fame`, `/milestones`, `/challenges`, `/archive` in the dev server. No crashes, no broken layouts.

- [ ] **Step 7: Commit**

```bash
git add src/screens/EventsScreen.jsx src/screens/HofScreen.jsx src/screens/MilestonesScreen.jsx src/screens/ChallengesScreen.jsx src/screens/ArchiveScreen.jsx
git commit -m "fix: remove fake content from Events/HoF/Milestones/Challenges/Archive"
```

---

## Task 6: PricingScreen — strip fake rows, fix CTAs

**Context:** PricingScreen has the most fake content. 10 feature rows need removing or rewriting, and both CTA buttons need replacing with "Coming Soon" states.

**Files:**
- Modify: `src/screens/PricingScreen.jsx`

---

- [ ] **Step 1: Read the full PricingScreen.jsx**

Read the file to understand the exact structure of the pricing tiers (lines ~144-274) and the feature comparison table (lines ~306-347). Note: the tiers are rendered as cards with feature lists. The table is a separate comparison grid.

- [ ] **Step 2: Remove fake feature rows from the pricing tier cards**

In each tier card (Player ~147-189, Pro ~192-235, Host ~238-274), scan for these strings and remove the containing list item / row:

- "Custom Match Lobbies" → remove row
- "24/7" anywhere → change to "Support via Discord"
- "Pro Circuit Access" → remove row
- "Advanced Analytical HUD" / "Analytics HUD" → remove row
- "1.5x Tournament Reward Multiplier" / "Reward Multiplier" → remove row
- "Priority Matchmaking Queue" → remove row
- "Custom Profile Banners" / "Profile Banners" / "Custom Tags" → remove row
- "Dedicated Discord Support Bot" / "Discord Bot" → remove row
- "Global Servers" → change text to "EUW · EUNE · NA"
- "10 tournaments/month" / "tournament limit" / "monthly limit" → remove row

- [ ] **Step 3: Remove fake rows from feature comparison table**

In the comparison table (lines ~306-347), apply the same removals as Step 2. Any row whose feature name matches the list above: delete the entire `<tr>` or equivalent row element.

- [ ] **Step 4: Replace "Become A Pro" button with Coming Soon**

Find the "Become A Pro" button (around line 232). Replace:
```jsx
<button onClick={handleBecomePro} ...>Become A Pro</button>
```
With:
```jsx
<div className="w-full py-2.5 text-center rounded-lg bg-[rgba(107,114,128,0.08)] border border-[rgba(107,114,128,0.2)] text-[#6B7280] text-xs font-semibold tracking-widest uppercase cursor-default select-none">
  Coming Soon
</div>
```

- [ ] **Step 5: Replace "Start Hosting" button with Coming Soon**

Find the "Start Hosting" button (around line 271). Apply the same replacement as Step 4.

- [ ] **Step 6: Verify pricing page**

Navigate to `/pricing`. Three tiers visible. Pro and Host tiers show only real features. No fake rows. Both CTA buttons show "Coming Soon" grey state. "Support via Discord" appears where 24/7 used to be. "EUW · EUNE · NA" appears where "Global Servers" used to be.

- [ ] **Step 7: Commit**

```bash
git add src/screens/PricingScreen.jsx
git commit -m "fix: remove 10 fake feature rows from PricingScreen, CTAs to Coming Soon"
```

---

## Task 7: RulesScreen + FAQScreen — fake copy + dead buttons

**Context:** RulesScreen has a dead "Open Support Ticket" button, fake "5-minute response" copy, and a non-existent "Rulebook Masterclass" card. FAQScreen has fake support claims, a "2024" year, and two fake FAQ entries. Both get Discord links.

**Files:**
- Modify: `src/screens/RulesScreen.jsx`
- Modify: `src/screens/FAQScreen.jsx`

---

- [ ] **Step 1: RulesScreen — replace "Open Support Ticket" with "Join Discord"**

Find around line 265 the "Open Support Ticket" button. Replace:
```jsx
<button onClick={...}>Open Support Ticket</button>
```
With:
```jsx
<a
  href="https://discord.gg/HJH3NQqqXH"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[rgba(103,226,217,0.08)] border border-[rgba(103,226,217,0.2)] text-[#67E2D9] text-sm font-semibold transition-colors hover:bg-[rgba(103,226,217,0.12)] no-underline"
>
  Join Discord
</a>
```

- [ ] **Step 2: RulesScreen — fix "5-minute response time" copy**

Find around lines 261-262 the text "Response time: ~5 minutes during active tournament windows" or similar. Replace with:
```
Reach us on Discord
```

- [ ] **Step 3: RulesScreen — remove "Rulebook Masterclass" card**

Find around lines 270-283 the "Rulebook Masterclass on Discord" card. Delete the entire card element (the containing div and all its children).

- [ ] **Step 4: FAQScreen — fix 24/7 support claims**

Scan `FAQScreen.jsx` for any rendered text containing "24/7". Change each occurrence to "via Discord". This may be in FAQ_DATA imported from constants, or hardcoded in the JSX. If it's in constants, update `src/lib/constants.js` instead.

- [ ] **Step 5: FAQScreen — fix "2024" year**

Find any occurrence of "2024 TFT CLASH" or just the year "2024" in the context of the platform name. Change to "2026".

- [ ] **Step 6: FAQScreen — remove fake FAQ entries**

Find and delete the following FAQ question entries (wherever they appear — JSX or constants):
- Any entry about "1.5x Tournament Reward Multiplier"
- Any entry about "Custom Profile Banners"
- Any entry about "priority ticketing" or "support tickets" — replace with Discord reference

If FAQ_DATA lives in `src/lib/constants.js`, edit that file. Make the minimum edits needed — remove the fake entries, update the support copy.

- [ ] **Step 7: Verify both screens**

- `/rules`: Discord button visible, no "5 minute response", no Masterclass card
- `/faq`: No 24/7 claims, no fake FAQ entries, year shows 2026

- [ ] **Step 8: Commit**

```bash
git add src/screens/RulesScreen.jsx src/screens/FAQScreen.jsx src/lib/constants.js
git commit -m "fix: replace dead support buttons with Discord links, remove fake FAQ entries"
```

---

## Final Verification

- [ ] Run `npm run build` — zero errors (pre-existing bundle size warnings are OK)
- [ ] Check all 4 desktop nav links work: `/clash` (or `/`), `/standings`, `/hall-of-fame`, `/pricing`
- [ ] Check hamburger opens right-side drawer on both desktop and mobile
- [ ] Check all 4 mobile bottom bar tabs work
- [ ] No sidebar visible on any page
- [ ] Home FAB navigates correctly (dashboard if logged in, signup if logged out)
- [ ] Pricing page: no fake rows, Coming Soon CTAs
- [ ] Rules page: Join Discord button, no Masterclass card
- [ ] FAQ page: year is 2026, no fake entries

```bash
npm run build
```
Expected: Build succeeds. Only pre-existing warnings (bundle size) allowed.
