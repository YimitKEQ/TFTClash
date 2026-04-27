---
name: TFT Clash
description: The free competitive league for Teamfight Tactics. Weekly tournaments, season standings, permanent Hall of Fame.
colors:
  primary: "#ffc66b"
  primary-deep: "#e8a838"
  secondary: "#d9b9ff"
  secondary-deep: "#5c348d"
  tertiary: "#67e2d9"
  background: "#13131a"
  surface-container-lowest: "#0e0d15"
  surface-container-low: "#1b1b23"
  surface-container: "#1f1f27"
  surface-container-high: "#2a2931"
  surface-container-highest: "#34343c"
  on-surface: "#e4e1ec"
  on-surface-variant: "#d5c4af"
  outline: "#9d8e7c"
  outline-variant: "#504535"
  success: "#6ee7b7"
  warning: "#fb923c"
  error: "#ffb4ab"
  medal-gold: "#e8a838"
  medal-silver: "#c0c0c0"
  medal-bronze: "#cd7f32"
  discord-blurple: "#5865F2"
typography:
  display:
    fontFamily: "Russo One, sans-serif"
    fontWeight: 400
    letterSpacing: "0.01em"
    lineHeight: 1.05
  editorial:
    fontFamily: "Playfair Display, serif"
    fontWeight: 600
    fontStyle: "italic"
    lineHeight: 1.2
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 700
    letterSpacing: "0.18em"
    textTransform: "uppercase"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontWeight: 500
rounded:
  sharp: "2px"
  card: "4px"
  hero: "8px"
  pill: "12px"
  full: "9999px"
spacing:
  tight: "16px"
  default: "24px"
  spacious: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}/10"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary}/20"
    textColor: "{colors.primary}"
  button-secondary:
    backgroundColor: "{colors.surface-container-low}/40"
    textColor: "{colors.on-surface}/80"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}/60"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-destructive:
    backgroundColor: "{colors.error}/10"
    textColor: "{colors.error}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  panel-default:
    backgroundColor: "{colors.surface-container-low}"
    rounded: "{rounded.card}"
    padding: "{spacing.default}"
  panel-elevated:
    backgroundColor: "{colors.surface-container}"
    rounded: "{rounded.card}"
    padding: "{spacing.default}"
  pill-tab-active:
    backgroundColor: "{colors.primary}/10"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  pill-tab-inactive:
    backgroundColor: "{colors.surface-container-low}/40"
    textColor: "{colors.on-surface}/60"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "0"
    padding: "16px"
---

# Design System: TFT Clash

## 1. Overview

**Creative North Star: "The Arena"**

TFT Clash is the building where players show up each week to compete. The visual system has to feel like that arena: warm spotlight gold against deep matte black, mono numerics on a tournament scoreboard, condensed Barlow labels stamping every section like a fight card, with rare Playfair Display italic accents carrying the league's voice ("Competing is always free.").

It is **not a stats site** and it is **not a SaaS dashboard**. The two anti-references in PRODUCT.md set the floor: op.gg's spreadsheet density and Mobalytics's neon-on-dark gradient cliché are both forbidden. Where competitors stack data, TFT Clash uses Russo One headlines, mono numerals, and generous whitespace to make every screen feel curated. Where competitors lean on glassmorphism, gradient text, and side-stripe borders, TFT Clash leans on type scale and tonal layering.

The mood is **competitive but composed**: high-stakes legibility, no over-stimulation. Drama through scale and weight contrast, never through effects.

**Key Characteristics:**
- Warm amber-gold primary on a dark blue-black canvas. Lavender and teal as supporting accents, used sparingly.
- Five typefaces, strict lanes. Russo One for headlines, Playfair Display italic for editorial accents, Inter for prose, Barlow Condensed uppercase for labels, JetBrains Mono for every numeral.
- Tonal elevation, not shadow elevation. Material Design 3 surface-container scale handles depth.
- Pill buttons and pill tabs. Rectangular cards with 4px corner radius. Bottom-border-only inputs.
- Numerals always tabular. Scores, points, placements, timestamps, ranks all sit in `font-mono`.

## 2. Colors: The Saturday Arena Palette

A warm gold (the spotlight) on a cool blue-black canvas (the arena), with rare lavender and teal accents reserved for non-primary signals.

### Primary
- **Spotlight Gold** (`#ffc66b`): The brand's anchor. Used for primary button text/border, active pill-tab fills, primary links, focus rings, and the "live now" highlight on the home countdown. Hex sits at OKLCH(82% 0.12 75) on the warm side, never neon.
- **Deep Amber** (`#e8a838`): The slightly heavier sibling of Spotlight Gold. Used for medal-gold callouts, the gold-glow effect on champion rows, and the gradient halo behind hero numerics. Treated as a secondary shade of the same hue family, never as a separate brand color.

### Secondary
- **Pale Lavender** (`#d9b9ff`): The cooled accent. Used at low opacity (`/10` to `/30`) for "me" highlights in standings rows, weekly-challenge card borders, and the input focus glow. Never used at full saturation as a fill.
- **Twilight Purple** (`#5c348d`): The deep counterpart, used as a container background for secondary buttons in legacy contexts. Rarely seen on screen.

### Tertiary
- **Mint Teal** (`#67e2d9`): The success-adjacent accent. Used for the "open" status pill, the top-4 placement badge border, and tertiary-variant buttons. Carries a "go ahead, you're clear" feel.

### Neutral
- **Arena Black** (`#13131a`): The canvas. The site background and the lowest surface plane. Cool blue-black, never pure `#000`.
- **Surface containers** (`#0e0d15` through `#34343c`): Five tonal steps for elevation, lowest to highest. The lowest (`surface-container-lowest`) goes under inputs and the deepest insets. The highest (`surface-container-highest`) sits under elevated panels and modals.
- **Warm Cream** (`#e4e1ec` for `on-surface`, `#d5c4af` for `on-surface-variant`): All body and meta text. The variant is warmer for muted labels (eyebrows, secondary captions).
- **Tan Outline** (`#9d8e7c` outline, `#504535` outline-variant): Border colors. The variant is the default panel border at very low opacity (`/10` to `/30`).

### Status
- **Success Mint** (`#6ee7b7`), **Warning Tangerine** (`#fb923c`), **Error Coral** (`#ffb4ab`). Each used only for state communication, never decoratively.

### Medals
- **Gold** (`#e8a838`), **Silver** (`#c0c0c0`), **Bronze** (`#cd7f32`). Pinned to placement: 1st, 2nd, 3rd. Always paired with the rank number, never used as a generic accent.

### Named Rules

**The Spotlight Gold Rule.** Spotlight Gold (`#ffc66b`) is the anchor. Any moment of celebration, focus, or primacy is in this hue family. Lavender and teal are supporting cast and never carry the lead.

**The 10% Tint Rule.** Most uses of Spotlight Gold are at `/10` opacity as a fill, with `/30` as a border. Solid gold fills are reserved for the Champion 1st-place podium tile and animated count-up numerals.

**The Status-Only Status Color Rule.** Success mint, warning tangerine, and error coral never appear in decorative gradients or hover effects. They communicate state. If you need a sparkle accent, use Spotlight Gold.

## 3. Typography: Five Lanes, Strict

**Display Font:** Russo One (one weight, 400)
**Editorial Font:** Playfair Display (italic only, 600-900)
**Body Font:** Inter (400-600)
**Label Font:** Barlow Condensed (400-700, always uppercase)
**Mono Font:** JetBrains Mono (400-700, every numeral)

**Character.** The pairing is broadcast-graphics meets editorial magazine. Russo One has the heavy condensed authority of an esports scorebug. Playfair Display italic interjects with magazine voice. Barlow Condensed uppercase is the eyebrow stamp. Inter is the workhorse. JetBrains Mono is the scoreboard.

### Hierarchy
- **Display** (Russo One 400, `clamp(2rem, 5vw, 3.5rem)`, line-height 1.05): Hero numerals (countdown digits, "1024 PTS"), section anchors ("STANDINGS", "BRACKET"), the wordmark.
- **Headline** (Playfair Display 600 italic, `clamp(1.5rem, 3vw, 2.25rem)`, line-height 1.2): One or two italic accents per page. "Competing is always free." Tournament hero titles. Reserved for editorial moments.
- **Title** (Russo One 400, 18-24px, line-height 1.1): Card titles, panel headers, table column heads when emphasis is needed.
- **Body** (Inter 400, 16px, line-height 1.6, max width 65-75ch): Paragraphs, button helpers, descriptions. Cap line length on prose.
- **Label** (Barlow Condensed 700, 11-14px, letter-spacing 0.18em, uppercase): Eyebrows, tags, button text, tab labels, status pills, table column heads when subordinate.
- **Mono** (JetBrains Mono 500, inherits size): Every numeral. Points totals, placements, percentages, timestamps, countdown, ranks. No exceptions.

### Named Rules

**The Mono-For-Every-Numeral Rule.** A score, a placement, a percentage, a date, a rank, a player count, a timer all sit in JetBrains Mono. This produces tabular alignment in tables and signals to screen readers that the value is numeric. If you find a numeral in `font-body` or `font-display`, the design has drifted.

**The Italic Frugality Rule.** Playfair Display italic appears at most twice per page, and never in interactive elements. Italics are load-bearing emotion, not decoration.

**The All-Caps Tracking Rule.** Anything in Barlow Condensed gets `tracking-widest` (0.18em letter-spacing). All-caps without tracking reads as shouting; all-caps with the right tracking reads as authority.

## 4. Elevation

The system is **flat by default with tonal layering**, not shadow-elevated. Material Design 3 surface-container scale (`surface-container-lowest` through `surface-container-highest`) carries depth through brightness, not shadow. Panels sit on the page like lit panels in a dark room rather than floating cards.

Shadows exist, but only as **highlight effects on celebrated content**: the gold-glow ring around the champion row, the medal halos for top-3 placements, the cta-glow-primary on the hero CTA. These are spotlights, not structural elevation.

### Shadow Vocabulary
- **Gold Glow** (`box-shadow: 0 0 30px rgba(253, 186, 73, 0.15)`): The ambient halo under the home CTA, champion-row hover state, and any first-place marker. Soft, warm, not hard-edged.
- **CTA Glow Primary** (`0 0 0 1px rgba(255, 198, 107, 0.35), 0 10px 40px rgba(232, 168, 56, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)`): The big call-to-action signature. Layered: hairline ring, ambient drop shadow, inner highlight. Hover deepens all three.
- **Medal Halos** (`halo-gold`, `halo-silver`, `halo-bronze`): A single 32-40px box-shadow in each medal hue, used on podium avatars and trophy markers.
- **Focus Ring** (Tailwind `focus-visible:ring-2 ring-primary ring-offset-2 ring-offset-surface`): Always Spotlight Gold, always 2px, always offset against the panel below.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat. Tonal contrast (`surface-container-low` over `background`) is how depth is read. Shadows on panels at rest are forbidden. Shadows appear as a response to state (hover lift, focus ring, champion glow) or to mark a first-place moment.

**The No-Glassmorphism Rule.** `backdrop-filter: blur(...)` and `rgba(255,255,255,0.04)` glass surfaces are forbidden as a default panel treatment. Legacy `.glass`, `.glass-panel`, `.glass-card`, `.panel-glass`, `.panel-elite` classes (still in `index.css`) reflect older redesigns and should not be reached for in new work. If a panel needs to feel layered, raise its `surface-container` step.

## 5. Components

### Buttons
- **Shape:** Always pill (`rounded-full`, 9999px). No square or lightly-rounded button variants exist.
- **Typography:** `font-label` (Barlow Condensed 700), uppercase, tracking-widest. Sizes from `text-xs` (sm) to `text-sm` (md/lg/xl). Never `font-body`.
- **Min height:** 44px (sm/md), 52px (lg), 56px (xl). Tap-target compliant.
- **Primary:** `bg-primary/10` fill, `border-primary/30` stroke, `text-primary` label, `shadow-sm shadow-primary/10`. Hover deepens to `bg-primary/20` and `border-primary/50`. Active scales to 0.98. **Crucially: not a solid gold fill.** The 10% tint is the canon.
- **Secondary:** `bg-surface-container-low/40` fill, `border-outline-variant/10` stroke, `text-on-surface/80` label.
- **Ghost:** Transparent, `text-on-surface/60`, hover `bg-white/5`. For low-emphasis actions.
- **Destructive:** Same shape, swapped to `error` token family.
- **Tertiary:** Same shape, swapped to `tertiary` (mint teal) token family.
- **Link:** Inline, `text-primary`, hover underline at 2px decoration. Inherits `font-label` uppercase tracking.
- **Focus:** 2px Spotlight Gold ring, `ring-offset-2`, against `surface` background.
- **Loading:** Inline 16px spinner in current color. Children stay rendered behind it.
- **Icons:** Material Symbols Outlined inline. 16px (`text-base`). Position left or right via `iconPosition` prop.

### Pill tabs
- **Shape:** Pill (`rounded-full`). Same family as buttons.
- **Typography:** `font-label` Barlow Condensed bold uppercase tracking-widest, `text-sm`.
- **Active state:** `bg-primary/10`, `border-primary/30`, `text-primary`, soft `shadow-primary/10` glow. Icon fills.
- **Inactive state:** `bg-surface-container-low/40`, `border-outline-variant/10`, `text-on-surface/60`. Icon outlined at 50% opacity.
- **Mobile behavior:** Wrapped in `<PillTabGroup>` which provides horizontal scroll with hidden scrollbar (`overflow-x-auto`) and edge padding.
- **Use:** Every tab strip, filter row, and category switcher across the site uses this. It is the single canonical tab pattern.

### Panels
- **Shape:** `rounded-lg` (4px corners). Square on the inside, gentle on the outside.
- **Background:** Tonal scale, picked by `elevation` prop:
  - `low` → `surface-container-lowest` (`#0e0d15`)
  - `default` → `surface-container-low` (`#1b1b23`)
  - `elevated` → `surface-container` (`#1f1f27`)
  - `highest` → `surface-container-high` (`#2a2931`)
- **Border:** `border-outline-variant/10`. Hairline at 10% opacity. Visible on closer inspection, invisible at first glance.
- **Padding:** `p-4` (tight), `p-6` (default), `p-8` (spacious). Standard rhythm.
- **Hover (optional):** No default hover state on Panel. Lift behavior is opt-in via `.card-lift` (`translateY(-2px)` plus border-color shift).
- **Banned variant:** Panel exposes a legacy `glass` prop and `accent="gold|purple|teal"` top-stripe prop. Both are deprecated for new work. Tonal elevation alone is sufficient.

### Inputs
- **Shape:** `rounded-none`. Square corners. The system's only deliberately un-rounded element.
- **Style:** Bottom-border only (`border-b border-outline-variant/60`). No top, left, or right border. Background `surface-container-lowest`. Padding `py-4 px-4`.
- **Label:** `font-label` uppercase tracking-widest, `text-xs`, `text-on-surface/70`. Sits 8px above the input with `ml-1` indent.
- **Focus:** `focus:ring-1 focus:ring-primary`, `focus:border-primary`. Bottom border becomes Spotlight Gold; a 1px ring matches.
- **Trailing icon:** Material Symbols Outlined at 50% opacity, right-aligned, vertically centered.

### Status pills
- **Shape:** Smaller pill (`rounded-pill` = 12px). Inline-flex, gap-4px.
- **Typography:** `font-label` (or `font-body` 700 for legacy), 10px, uppercase, tracking 0.08em.
- **Variants:** `live` (error tint background, coral text, coral border), `open` (mint tint, mint text), `upcoming` (gold tint, warm yellow text), `complete` (neutral surface, muted text). All four follow the same envelope: `bg-{role}/12`, `text-{role-light}`, `border-{role}/30`.
- **Use:** On tournament cards, lobby states, schedule entries.

### Tags
- **Shape:** `rounded-full`, very small.
- **Style:** `bg-{role}/10`, `border-{role}/20`, `text-{role}`. Always token-driven; no hex values inline.
- **Typography:** `font-label`, 10-11px, uppercase, tracking-widest.

### Navigation (top nav)
- **Position:** Sticky top, z-100. `bg-background/97` with `backdrop-filter: blur(20px)` (the one place glassmorphism is allowed, because it is a true overlay).
- **Border:** Hairline gold at the bottom (`border-bottom: 1px solid rgba(232,168,56,.15)`).
- **Active link:** Spotlight Gold text, with a 24x2px gold underline 1px below baseline, glowing at 8px Spotlight Gold.
- **Hover link:** Lifts to `text-on-surface` (full warm cream).
- **Mobile:** Hamburger drawer slides in from right, 240px wide, `slide-drawer` keyframe at 220ms.

### Signature: The Standings Row
- **Default:** Single horizontal row, mono numerals on the rank column, body text on the player name, `font-mono` Spotlight Gold on the points total.
- **Hover:** `translateX(4px)` slide right, `inset 4px 0 0` Spotlight Gold left highlight, `0 2px 20px rgba(232,168,56,.06)` ambient glow.
- **First place row:** `bg-primary/5`, gold rank-num text-shadow at 12px Spotlight Gold.
- **"Me" row (current user):** `bg-secondary/10`. (Note: the current implementation uses a 2px left border; per impeccable rules, this should migrate to a full border or a leading icon. See Don'ts.)

## 6. Do's and Don'ts

### Do:
- **Do** use `<Btn>`, `<Panel>`, `<PillTab>`, `<Inp>`, `<Icon>` from `src/components/ui/`. Never inline a raw `<button className="...bg-primary...">` or its peers.
- **Do** put every numeral in `font-mono`. Scores, points, placements, percentages, dates, timers, ranks.
- **Do** use one Playfair Display italic per page maximum, two if it earns it. The italic is the league's voice, not decoration.
- **Do** raise depth through `surface-container-low → container → container-high`. Tonal layering is the elevation strategy.
- **Do** use Spotlight Gold (`#ffc66b`) at `/10` fill and `/30` border. The 10% tint is the canon.
- **Do** keep button shapes pill. `rounded-full` is the only button radius.
- **Do** keep input corners square (`rounded-none`). The bottom-border-only treatment is signature.
- **Do** cap body line length at 65-75ch on prose surfaces.
- **Do** respect `prefers-reduced-motion`. The global `index.css` rule already disables animations under reduced motion; new components should not opt out.

### Don't:
- **Don't** clone op.gg's spreadsheet density. Tables in TFT Clash breathe, with `font-mono` columns aligned and `font-label` headers in tracking-widest. If a table feels like a stats site, raise its panel padding and pull the column count down.
- **Don't** clone Mobalytics's neon-on-dark gradient cliché. No multi-color border gradients on cards. No gradient-text headlines. No neon underglows on every panel.
- **Don't** use `background-clip: text` with a gradient (`gold-gradient-text`, `gold-shimmer`). Both classes still exist in `index.css` but are deprecated. Single solid color, weight contrast for emphasis.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe (e.g. `.standings-row-me` uses `border-left:2px solid #9B72CF`). Migrate to a full panel border, a background tint, or a leading icon. The side-stripe is banned by the impeccable shared design laws.
- **Don't** use `glass-panel`, `glass-card`, `panel-glass`, `panel-elite` from `index.css`. Glassmorphism is forbidden as a default panel treatment. The top-nav blur is the only allowed exception because it is a true overlay.
- **Don't** use the hero-metric template (giant gradient number plus tiny label plus three supporting stats). It is the SaaS cliché PRODUCT.md rejects.
- **Don't** add new font families. The five lanes are locked: `font-display`, `font-editorial`, `font-body`, `font-label`, `font-mono`. Aliases like `font-headline`, `font-serif`, `font-sans` were removed and must not be reintroduced.
- **Don't** use exotic radii: `rounded-2xl`, `rounded-3xl`, `rounded-[Npx]`, `rounded-sm`. The four canonical radii are `rounded` (2px), `rounded-lg` (4px), `rounded-xl` (8px), `rounded-full`. There is also `rounded-pill` (12px) for legacy status pills.
- **Don't** animate CSS layout properties (`width`, `height`, `padding`, `margin`). Use `transform` and `opacity`. The `card-lift` pattern uses `translateY(-2px)`, not a height shift.
- **Don't** add em dashes anywhere. Use commas, colons, semicolons, periods, or parentheses. Also not `--`.
- **Don't** ship placeholder buttons or "Coming soon" text without a dated commitment. Every interactive element works end-to-end.
