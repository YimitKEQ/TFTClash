# TFT Clash Launch Push — Design Spec

**Date:** 2026-04-13
**Status:** Approved, pending implementation
**Author:** Claude + Levitate

---

## Overview

Final pre-launch push to unify TFT Clash into a coherent, production-ready platform. Addresses visible bugs, design fragmentation, pricing/monetization gaps, Discord integration, and launch QA. Six sequential phases, roughly 12–16 hours of execution.

**Root problem:** The codebase has strong bones (clean modular screens, good Tailwind token system, solid backend) but fragmented execution at the surface layer. Different screens use different fonts, buttons, radii, and section patterns — the user cannot feel the system. Separately, two specific bugs break basic navigation and aesthetics, and several monetization hooks (donate, sponsors, scrim tiers) are miswired.

**Success criteria:**
- Every page feels like the same product (same fonts in the same lanes, one Btn, one Panel, one SectionHeader)
- The two known bugs are gone (StandingsScreen tab reset, Podium icon z-index)
- Scrim Pass caps at 8 players, Pro+Scrim at 16 — enforced in code and in pricing copy
- Donate button is always visible via hardcoded fallback URL
- Sponsors on homepage are prominent, full-color, click-through
- Discord `@Player` role can actually talk in community channels, missing slash commands shipped
- No console.log leaks, security review clean, env vars deployed in Vercel

---

## Phase 0 — Hotfix visible bugs

Two fixes that can ship as a standalone commit before anything else. Ships as the first commit so the user sees movement immediately.

### 0.1 StandingsScreen tab reset on re-entry

**File:** `src/App.jsx` around lines 196–222 (router-to-screen sync effect)

**Bug:** When the user navigates `/standings/hof` → leaves → returns to `/standings`, the router's direct match block sets `screen = 'standings'` but never clears `subRoute`. The StandingsScreen component reads `subRoute` from context, so it keeps showing the Hall of Fame (or Roster) tab even though the URL is back to the bare leaderboard route. Clicking the Leaderboard tab also fails for the same reason — it navigates to `/standings`, but `subRoute` stays at `'hof'`.

**Fix:** In the direct-match branch of the router effect, call `setSubRoute('')` whenever the matched path does not include a subroute segment. Implementation: extend the `if (mapped) { ... }` block to also reset `subRoute` to an empty string for any mapped screen that supports subroutes (standings, events). Keep it tight — no other behavior changes.

### 0.2 Podium first-place crown icon z-index + glyph

**File:** `src/screens/LeaderboardScreen.jsx` around lines 52–70 (PodiumCard first-place branch)

**Bug:** The `workspace_premium` icon at `-top-6` sits in DOM order *before* the scaled circle. The circle carries a `gold-glow-boss` class (radial shadow) and `group-hover:scale-105`. On hover, the circle's glow and transform paint over the earlier-in-DOM crown, visually sending it "behind."

**Fix:**
1. Add `z-20 relative` to the crown wrapper div so it stacks above the circle's stacking context.
2. Replace `workspace_premium` with a glyph that reads unambiguously as a crown/trophy in Material Symbols — `military_tech` (filled medal) or `emoji_events` (trophy cup). I'll pick `emoji_events` with `fill` — reads as "first place trophy" at podium size and doesn't get confused with a generic seal.
3. Verify on hover the icon stays in front by loading `/standings` in the dev server and hovering the gold card.

**Verification:** Dev server + manual hover. Screenshots not required for this — it's a binary does-it-stack-correctly check.

---

## Phase 1 — Design system codification

The font and color tokens already exist in `tailwind.config.js`. The problem is no one documented which token goes where, so every screen picks its own. Phase 1 codifies the rules. Phase 2 enforces them.

### 1.1 Font lanes (strict)

`tailwind.config.js` stays unchanged. These six tokens map to six strict roles:

| Token | Typeface | Use case | Never used for |
|---|---|---|---|
| `font-display` | Russo One 400 | TFT CLASH wordmark, countdown digits, hero numerals. Single-weight display face reserved for "this is the moment" typography. | Body, section headers, buttons, labels |
| `font-headline` | Space Grotesk 500–700 | All section titles, card titles, modal titles, page titles | Paragraphs, labels, numbers |
| `font-editorial` (alias: `font-serif`) | Playfair Display 400–700 italic | Hero-level italic accents only. Used in one or two spots per page max: "Competing is always free.", "Ranked Standings". Never for buttons, labels, or body. | Everything else |
| `font-body` | Inter 400–600 | All paragraph text, button labels, input text, card body, descriptions | Stats numerals, uppercase labels, hero headings |
| `font-label` (alias: `font-sans`, `font-condensed`, `font-sans-condensed`, `font-nav`, `font-technical`) | Barlow Condensed 400–700 | Uppercase eyebrows, tags, tab labels, tiny captions — anything with `tracking-widest uppercase` | Body paragraphs, large titles |
| `font-mono` (alias: `font-stats`) | JetBrains Mono 400–700 | All numerals in UI (stats, pts, placements, countdown digits, timestamps, ranks), code blocks | Prose, titles, labels |

**Decision:** Keeping all six typefaces. The complaint is not "too many fonts," it's "fonts used chaotically." Enforced lanes fix this. Russo One is preserved for the TFT CLASH wordmark because it carries gaming identity — Space Grotesk would look generic.

**Aliases are deprecated:** `font-sans`, `font-condensed`, `font-sans-condensed`, `font-nav`, `font-technical`, `font-stats` all resolve to their canonical parent. Phase 2 sweep normalizes every screen to use only the six canonical names. The aliases stay in `tailwind.config.js` for backward compatibility but are a smell; new code uses canonicals.

**ScrimsScreen is the worst offender** (84× `font-sans`, 63× `font-mono`, 54× `font-bold`, 13× `font-black`). It gets the full rewrite in Phase 2.

### 1.2 Radius scale (strict)

Replace the current ad-hoc mess (`rounded-[4px]`, `rounded-[20px]`, `rounded-xl`, `rounded-lg`, `rounded-sm`, `rounded-[2px]`) with exactly four values:

| Class | Px | Use |
|---|---|---|
| `rounded` | 4px | Inputs, small tags, table cells, tiny chips |
| `rounded-lg` | 8px | All cards, panels, modals, tiles |
| `rounded-xl` | 12px | Hero cards, spotlight blocks, featured sponsors |
| `rounded-full` | pill | Buttons, badges, avatars, status dots |

Delete every `rounded-[Npx]` literal. Delete every use of `rounded-sm`, `rounded-2xl`, `rounded-3xl`. If a place insists on an exotic radius, it's wrong.

### 1.3 Button system: one component, six variants

**File:** `src/components/ui/Btn.jsx`

Current Btn has 4 variants (primary, secondary, ghost, destructive) and 4 sizes. Expand to six variants and lock:

```
Variants: primary | secondary | ghost | destructive | tertiary | link
Sizes: sm | md | lg | xl
Props: icon (optional), iconPosition (left | right), loading (bool), disabled (bool)
Base: rounded-full, font-label font-bold uppercase tracking-widest, transition-all, min-h-[44px] touch target
```

- `primary` — gradient from-primary to-primary-container, on-primary text, hover:opacity-90
- `secondary` — bg-surface-container-high, on-surface text, border-outline-variant/15
- `ghost` — transparent, on-surface/60 text, hover:bg-white/5
- `destructive` — bg-error-container/20, error text, border-error/20
- `tertiary` — bg-tertiary/10, tertiary text, border-tertiary/30 (for Host / apply flows)
- `link` — no background, primary text, hover:underline underline-offset-4 (for "View All" style links)

**Action:** Every inline button in every screen is replaced with `<Btn>`. No more `className="w-full py-4 rounded-xl bg-gradient-to-br..."`. A grep after Phase 2 should find zero `<button className="...bg-primary...">` patterns outside Btn.jsx itself.

### 1.4 Panel: one card container

**File:** `src/components/ui/Panel.jsx`

Single responsibility: surface-container-low background, outline-variant/10 border, rounded-lg, p-6 default. Variants: `bare` (no padding), `tight` (p-4), `spacious` (p-8). Variants for surface elevation: `low` (default), `elevated` (surface-container), `highest` (surface-container-high).

Every screen that currently writes `<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6">` is rewritten to `<Panel>`. Grep guard after Phase 2 should find zero `bg-surface-container.*rounded.*border.*outline-variant` patterns outside Panel.jsx.

### 1.5 SectionHeader: one way to introduce a section

**New file:** `src/components/shared/SectionHeader.jsx`

Props: `eyebrow` (optional), `title`, `description` (optional), `action` (optional), `align` (left | center).

```
Eyebrow: font-label text-xs uppercase tracking-[0.2em] text-primary
Title: font-headline text-2xl sm:text-3xl text-on-surface
Description: font-body text-sm text-on-surface-variant
Action: right-aligned <Btn variant="link">
```

Replaces the 29 different section headers across screens. HomeScreen, PricingScreen, LeaderboardScreen, etc. all standardize on it.

### 1.6 Design doc artifact

Write `docs/DESIGN-SYSTEM.md` capturing all of the above, plus a short "how to add a new screen" checklist:
1. Wrap in `<PageLayout>` (with `<PageHeader>` if standalone)
2. Group content into `<Panel>` blocks
3. Section intros use `<SectionHeader>`
4. All buttons are `<Btn>`
5. Fonts: headline for titles, body for prose, label for eyebrows, mono for numbers
6. No inline `rounded-[Npx]`, no inline gradient backgrounds

This is the reference every future change points at. Commit as part of Phase 1.

---

## Phase 2 — Screen sweep

Enforce Phase 1 across the codebase. 29 screens total. Top-10 by user impact get the full rewrite; the remaining 19 get a lighter token-normalization pass.

### 2.1 Top 10 full sweep (in this order)

1. **HomeScreen** — reference implementation for new visitors. Must be flawless.
2. **DashboardScreen** — first screen every logged-in user sees.
3. **PricingScreen** — conversion surface.
4. **StandingsScreen + LeaderboardScreen + HofScreen** — most-visited logged-in surface.
5. **ScrimsScreen** — largest file (1740 lines), worst offender, also where scrim limits land (Phase 3).
6. **EventsScreen + TournamentsListScreen** — tournament discovery.
7. **PlayerProfileScreen** — public-facing, shared externally.
8. **AccountScreen** — where paying users land after checkout.
9. **SponsorsScreen** — sales surface, needs to look polished.
10. **RulesScreen + FAQScreen** — trust surfaces for new users.

Per-screen checklist:
- Replace every raw `<button>` with `<Btn>`
- Replace every raw card div with `<Panel>`
- Replace every section intro with `<SectionHeader>`
- Normalize fonts to the six canonical tokens (grep `font-sans`, `font-condensed`, etc., convert)
- Normalize border radii to the four canonical values
- Delete inline gradient backgrounds (move to `<Btn variant="primary">` or remove)
- Delete `style={{...}}` inline color overrides — use Tailwind token classes

### 2.2 Lighter pass (remaining 19 screens)

For each: grep-and-replace deprecated font aliases and radii, swap obvious buttons to `<Btn>`. No SectionHeader or Panel migration unless already broken. Screens included: ChallengesScreen, MilestonesScreen, ArchiveScreen, ClashReportScreen, GearScreen, SeasonRecapScreen, HostApplyScreen, HostDashboardScreen, FlashTournamentScreen, TournamentDetailScreen, BracketScreen, ResultsScreen, ContentEngineScreen, CommandCenterScreen, AdminScreen, StatsHubScreen, PrivacyScreen, TermsScreen, NotFoundScreen.

### 2.3 Verification per commit

After each screen edit:
- Build passes (`npm run build`)
- Screen loads in dev server without white-screen
- Visual spot-check: does it look like the same product as HomeScreen?

One commit per screen in the top-10. One bulk commit for the lighter pass.

---

## Phase 3 — Scrim limits, pricing copy, donate, support-the-platform

### 3.1 Tier-based scrim player caps

**File:** `src/lib/constants.js` — `TIER_FEATURES`

Add a `maxScrimPlayers` number field to each tier:

```
free:   maxScrimPlayers: 0    (cannot create)
pro:    maxScrimPlayers: 0    (cannot create)
scrim:  maxScrimPlayers: 8    (one lobby)
bundle: maxScrimPlayers: 16   (two lobbies)
host:   maxScrimPlayers: 32   (four lobbies)
```

**File:** `src/lib/tiers.js`

Add helper `getMaxScrimPlayers(tier)` that returns the number from TIER_FEATURES, defaulting to 0 for unknown tiers.

**File:** `src/screens/ScrimsScreen.jsx`

In the scrim session creation flow, enforce the cap:
- Read `userTier` from `useApp()`
- Compute `maxPlayers = getMaxScrimPlayers(userTier)`
- Disable the "Create Session" button if `scrimRoster.length > maxPlayers`
- Show inline error: "Scrim Pass allows up to 8 players. Upgrade to Pro + Scrim for 16."
- Hard-cap the roster input so you cannot add a 9th player on Scrim Pass

### 3.2 Pricing page copy + comparison table

**File:** `src/screens/PricingScreen.jsx`

- `SCRIM_FEATURES` first bullet: change "Create scrim rooms (up to 32 players)" → "Create scrim rooms (up to 8 players, one lobby)"
- `BUNDLE_FEATURES` add: "Scrim rooms up to 16 players (two lobbies)"
- `COMPARISON_ROWS`: change `Max scrim players` row from `'32'` across the board to `'-'`, `'-'`, `'8'`, `'16'`, `'32'`
- `FAQ_ITEMS`: update the "What is a Scrim Pass?" answer to say "up to 8 players in one lobby. Upgrade to the Pro + Scrim bundle for two-lobby seeding at 16 players."

### 3.3 Donate fallback

**File:** `src/lib/paypal.js`

Change `getDonateUrl()`:

```
export function getDonateUrl() {
  var id = import.meta.env.VITE_PAYPAL_DONATE_ID || '';
  if (id) return 'https://www.paypal.com/donate/?hosted_button_id=' + encodeURIComponent(id);
  return 'https://paypal.me/monkelodie';  // fallback, always available
}
```

Now `getDonateUrl()` never returns null. Every existing donate UI in HomeScreen footer and PricingScreen donate section becomes visible immediately on deploy.

### 3.4 Support-the-platform section

**File:** `src/screens/HomeScreen.jsx`

Add a new section just above the final CTA for logged-out users, and as a subtle sidebar module for logged-in users:

```
<Panel variant="elevated" className="text-center">
  <SectionHeader
    eyebrow="Community Supported"
    title="Keep TFT Clash free forever"
    description="Running weekly tournaments costs real money. If you get value from competing here, a tip helps us keep the lights on, the servers fast, and the entry fee at zero."
    align="center"
  />
  <div className="mt-6 flex justify-center gap-3">
    <Btn variant="primary" onClick={...donate}>Donate via PayPal</Btn>
    <Btn variant="link" onClick={...navigate('/pricing')}>Or go Pro</Btn>
  </div>
</Panel>
```

Placed where it reads as "the platform is giving you something, here's how you can give back" — not intrusive, not paywall-adjacent. One on HomeScreen (before footer), one smaller variant on AccountScreen (sidebar card).

---

## Phase 4 — Sponsors visibility upgrade

### 4.1 New SponsorShowcase component

**New file:** `src/components/shared/SponsorShowcase.jsx`

Props: `placement` (`homepage` | `leaderboard` | `dashboard` | `bracket`), `variant` (`strip` | `featured` | `grid`).

Renders:
- **Strip (default)**: Horizontal row, logos at `h-12`, full color (no grayscale, no opacity reduction), 24px gap, optional "Powered by" eyebrow in `font-label text-xs`. Clickable to sponsor URL, `rel="sponsored noopener"`.
- **Featured**: Single large sponsor block, `h-20` logo, tagline in `font-body text-sm`, CTA button linking to sponsor.
- **Grid**: 3-column grid for SponsorsScreen (unchanged semantics, just uses the shared component).

Pulls from `orgSponsors` context, filters by placement and `status === 'active'`.

### 4.2 Replace grayscale strips

**Files affected:**
- `src/screens/HomeScreen.jsx` lines 440–456 — replace with `<SponsorShowcase placement="homepage" variant="strip" />`
- `src/screens/LeaderboardScreen.jsx` lines 268–284 — replace with `<SponsorShowcase placement="leaderboard" variant="strip" />`
- `src/screens/DashboardScreen.jsx` — add `<SponsorShowcase placement="dashboard" variant="featured" />` above the fold, single sponsor only
- `src/screens/BracketScreen.jsx` — add `<SponsorShowcase placement="bracket" variant="strip" />` in the bracket header

Delete all `grayscale`, `opacity-40`, `opacity-50`, `hover:opacity-*` classes from sponsor markup. Logos render full-color at full size always.

### 4.3 Admin sponsor preview

**Location:** Admin sponsors management UI. AdminScreen is a single-file 7-tab panel (see project memory); locate the sponsors tab inside it rather than assuming a separate file.

Add a "Preview on Homepage" button next to each sponsor row that opens a modal showing exactly how it will render in the SponsorShowcase strip — pulls the live component so admins see the real thing before marking `status: 'active'`.

---

## Phase 5 — Discord audit and harden

### 5.1 Permission audit

**File:** `discord-bot/setup.js`

Read the full channel permission matrix. Verify for the community channels (`general`, `lfg`, `clips`, `meta-talk`, `bot-commands`):
- `@Player` role has `SendMessages: Allow`
- `@Player` role has `AddReactions: Allow`, `AttachFiles: Allow`, `EmbedLinks: Allow`
- `@everyone` has `ViewChannel: Deny` (gate by verification)

For read-only channels (`announcements`, `rules`, `results`, `standings`, `bracket`):
- `@Player` has `ViewChannel: Allow`, `SendMessages: Deny`
- `@Host` has `SendMessages: Allow`

For admin channels (`bot-logs`, host-only):
- `@Player` has `ViewChannel: Deny`
- `@Host` has full access

Fix any gaps by editing the `STRUCTURE` definition and re-running `node setup.js` against the live guild. Document which channels were fixed in the commit message.

### 5.2 Ship the four missing slash commands

From the approved 2026-04-06 spec, four commands were designed but never shipped. Add them now:

**New files:**
- `discord-bot/commands/lobby.js` — shows the caller's current lobby assignment + opponents for the active tournament. Queries `tournaments` + `tournament_rounds` + `lobby_players` joined via the Discord user's linked `players.id`.
- `discord-bot/commands/submit.js` — accepts a placement (1–8), inserts into `pending_results` with the caller's `player_id` and current round. Validates the caller is actually assigned to a lobby in the active round.
- `discord-bot/commands/dispute.js` — accepts `round` + `reason`, inserts into `disputes` table. Disputes table must exist (verify migration has been applied).
- `discord-bot/commands/tournament.js` — accepts optional `id`, shows tournament summary + current standings + round status.

Each command follows the existing pattern (`checkin.js`, `clash.js`, etc.): export `data` (SlashCommandBuilder) and `execute(interaction)`.

**Update `discord-bot/deploy-commands.js`:** Import and register the four new commands alongside the existing 13.

### 5.3 Smoke test

Run a non-host account (create a test Discord user, link via `/link`) and verify in a live Discord:
- `/clash` — returns current/next clash info
- `/profile` — returns player profile
- `/standings` — returns top 10
- `/lobby` — either returns lobby or "You're not in an active tournament"
- Can post a message in `#general` (permission smoke test)
- Cannot post in `#announcements` (read-only smoke test)

### 5.4 Process management

Verify `pm2 status` shows `tft-clash-bot` online. If running on a local dev machine, document whether production is expected to run from a VPS or as a Cloudflare Worker / similar. If no production target exists yet, flag it as a launch blocker and recommend the cheapest stable option (Fly.io / Railway / personal VPS).

---

## Phase 6 — Launch QA and security

### 6.1 Security review pass

Run the `security-reviewer` subagent over:
- `src/lib/paypal.js` (new donate fallback, subscription activation)
- `api/*.js` (all 5 endpoints — check-admin, create-checkout, stripe-webhook, ai-commentary, health)
- `supabase/migrations/` (RLS policies on pending_results, disputes, subscriptions)
- `src/lib/supabase.js` (client config, verify anon key is public and service role is not exposed)
- `discord-bot/commands/submit.js` (inserts into pending_results — verify it only allows the caller's own player_id)

Fix every CRITICAL and HIGH finding before launch. Triage MEDIUM and LOW.

### 6.2 Console.log sweep

Grep the entire `src/` and `discord-bot/` trees for `console.log`. Strip from production code paths. Allowed: `console.error` in catch blocks (Sentry captures these), `console.warn` in dev-gated branches.

### 6.3 Golden path walkthrough

Start the dev server. Walk through on desktop first, then mobile viewport:
1. Land on `/` as a logged-out visitor — hero + countdown + leaderboard preview + sponsors + donate
2. Click "Join this week's tournament" — signup flow via Discord OAuth
3. Logged in: land on dashboard, see next clash countdown
4. Register for the active tournament
5. Check in at clash time
6. See lobby assignment
7. Submit a placement
8. See results screen with copy/share
9. Return to dashboard, verify leaderboard updated
10. Visit `/standings` — toggle between Leaderboard and HoF tabs, verify Phase 0 fix held
11. Hover the #1 gold podium — verify crown icon stays on top
12. Visit `/scrims` — try to create a session with 9 players on free tier, verify block
13. Visit `/pricing` — verify scrim caps read 8/16/32

Any failure = fix before launch.

### 6.4 Environment variable audit

Produce a complete list of env vars the app and Discord bot expect, and verify each is set in Vercel (production) and Supabase (edge functions):

**Vercel:**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYPAL_CLIENT_ID`, `VITE_PAYPAL_PLAN_PRO`, `VITE_PAYPAL_PLAN_SCRIM`, `VITE_PAYPAL_PLAN_BUNDLE`, `VITE_PAYPAL_PLAN_HOST`, `VITE_PAYPAL_DONATE_ID` (optional, has fallback now)
- `VITE_SENTRY_DSN`
- `VITE_GA_ID` (if used)
- `SUPABASE_SERVICE_ROLE_KEY` (for API routes — server-only, never VITE_)
- `ANTHROPIC_API_KEY` (for ai-commentary endpoint)

Stripe is fully removed from `src/` and `api/` (confirmed by grep 2026-04-13). Delete any leftover `STRIPE_*` vars from Vercel during the audit — they are dead weight.

**Supabase Edge Functions:**
- `GEMINI_API_KEY` (content-engine function)
- Any other function-specific secrets

**Discord bot `.env` (wherever it runs):**
- `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `TIMEZONE`
- Supabase service role key for bot queries

### 6.5 Codex rescue pass

After everything above, run `codex:codex-rescue` on any subsystem that felt fragile during the QA walkthrough — likely candidates are the tournament state machine, the submit-placement flow, and the subscription webhook. Let Codex do a second-opinion diagnosis pass.

---

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Do design system before screen sweep | Yes | Sweep-first would burn effort rewriting screens that don't match the final system. Foundation first. |
| Keep all 6 font families | Yes | The complaint is "inconsistent usage," not "too many fonts." Strict lanes fix it. Russo One specifically carries gaming identity. |
| Donate fallback hardcoded | Yes | PayPal env var may never be set. Hardcoded fallback ensures the button always renders. Override via env var remains possible. |
| Scrim caps enforced client-side only | Yes for now | Server enforcement requires an edge function or RLS trigger. Ship client-side for launch; add server enforcement post-launch if abused. |
| One Btn component | Yes | No rolling your own. Grep guard after Phase 2. |
| Sponsors full-color, no grayscale | Yes | Current grayscale+opacity strip looks like an afterthought. Sponsors paid for visibility, deliver it. |
| Discord bot ships 4 new commands | Yes | Already designed in 2026-04-06 spec, just never built. Ship now to complete the spec. |

---

## Non-goals

- Riot API integration (blocked on application approval)
- Mobile native app
- Browser-based lobby voice chat (Discord handles it)
- Automated tournament scheduling (stays manual)
- Refactoring legacy `App.jsx` code beyond what's already extracted
- Changing the color palette (only typography and layout tokens are in scope)
- Migrating away from Russo One / Playfair / etc. (keep, just enforce lanes)
- New features beyond what's listed here (no feature creep — launch first, iterate second)

---

## Implementation order

1. **Phase 0** — Hotfix the two bugs (standalone commit, visible progress fast)
2. **Phase 1** — Design system codification + `docs/DESIGN-SYSTEM.md` (commit)
3. **Phase 2.1** — Top 10 screen sweep, one commit per screen
4. **Phase 2.2** — Lighter pass on remaining 19 screens (one bulk commit)
5. **Phase 3** — Scrim limits, pricing, donate, support section (commit)
6. **Phase 4** — Sponsors upgrade (commit)
7. **Phase 5** — Discord audit + missing commands (commit)
8. **Phase 6** — Security review + QA + env vars (commit any fixes)
9. **Final** — `codex:codex-rescue` on fragile subsystems, then push and confirm Vercel deploy

Each phase is independently commit-able. If anything derails, the prior phase is still shippable.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phase 2 screen sweep breaks a screen I don't notice | Medium | Build check after each commit, dev-server spot check, golden-path walk in Phase 6 catches anything missed |
| `disputes` table migration not yet applied in production | Medium | Verify via `mcp__supabase__list_tables` before shipping Phase 5 `/dispute` command |
| Discord bot production target not defined | High | Flag in Phase 5.4 as launch blocker; user decides hosting before launch |
| Sponsor URLs/logos in DB are stale or missing | Low | SponsorShowcase gracefully renders nothing if `orgSponsors` is empty |
| Font change breaks mobile layout on ScrimsScreen | Low | ScrimsScreen is the biggest file; test specifically on mobile viewport in Phase 6 |
| PayPal fallback link `paypal.me/monkelodie` is wrong | Low | User confirmed the URL directly |

---

## Definition of done

- All 6 phases committed and pushed
- `git grep font-sans src/screens/` returns zero matches (aliases sweep)
- `git grep 'rounded-\[' src/screens/` returns zero matches
- `git grep '<button className' src/screens/` returns fewer than 5 matches (only justified inline buttons remain)
- Dev-server walkthrough passes all 13 golden-path steps
- Security review shows no CRITICAL or HIGH findings
- Vercel production build deploys green
- User confirms visual consistency across the top 10 screens
