# Donut17 UI/UX Overhaul - Design Spec

**Date:** 2026-04-01
**Direction:** Polished Hybrid (option C) - scannable cards with key stats, expandable detail sections, progressive disclosure

---

## Design Principles

1. **Progressive disclosure** - Key info visible on cards, details on expand/click
2. **Minimum 11px fonts** - No more 6-8px text anywhere
3. **Universal cost colors** - Gray(1)/Green(2)/Blue(3)/Purple(4)/Gold(5) borders + gradient fills on all champion icons
4. **Consistent spacing** - 6px between icons, 10-12px between sections, 16-24px between cards
5. **Tooltips on everything** - Every icon, badge, and trait gets hover info

---

## Global Changes (All Tabs)

### Navigation
- Sticky top bar (52px): Donut 17 brand (gradient text), set badge pill, horizontal tab buttons
- Active tab: bottom 2px gradient underline (purple-to-cyan)
- Remove left sidebar entirely - top nav only
- Tab icons as emoji or Material Symbols, not truncated text

### Color System (d17.js updates)
- Background: `#080611` (darker, more contrast)
- Surface: `#110e1c`
- Surface low: `#0d0b17`
- Surface high: `#1a1628`
- Border: `#1e1a30` (primary), `#2e2848` (hover)
- Text: `#eceef8` (primary), `#a8a3be` (secondary), `#8a85a0` (muted), `#6b6585` (dim), `#4a4565` (ghost)
- Cost 1: border `#6b7280`, text `#9ca3af`, bg gradient `#1f2937 -> #111827`
- Cost 2: border `#22c55e`, text `#4ade80`, bg gradient `#0a2e14 -> #0a1a10`
- Cost 3: border `#3b82f6`, text `#60a5fa`, bg gradient `#0c1e3e -> #0a1428`
- Cost 4: border `#a855f7`, text `#c084fc`, bg gradient `#1e0a3a -> #140a28`
- Cost 5: border `#eab308`, text `#facc15`, bg gradient `#2a2000 -> #1a1400`
- Tier S: gradient `#c9a21a -> #8a6d00`, glow `#c9a21a30`
- Tier A: gradient `#9b6dff -> #6a3fbf`, glow `#9b6dff30`
- Tier B: gradient `#4a90e8 -> #2d6bc4`, glow `#4a90e830`
- Tier C: gradient `#3dba6e -> #2a8a50`, glow `#3dba6e30`
- Augment Silver: `#c0c0c0`
- Augment Gold: `#f0cc00`
- Augment Prismatic: `#e879f9`
- Item AD: `#f87171`, AP: `#a78bfa`, Tank: `#4ade80`, Utility: `#7dc8ff`, Artifact: `#f0cc00`

### Hero Section (per tab)
- Full-width card: gradient background, 16px border-radius
- Title: Barlow Condensed 28px bold uppercase
- Subtitle: Inter 14px, muted color, max-width 600px
- Subtle radial glow in top-right corner

### Background
- Cosmic: radial gradients for subtle depth, `#080611` base

---

## Tab: Comp Lines

### Filter Bar
- Tier chips: S (gold), A (purple), B (blue), C (green) with glow on active
- Search box right-aligned, 200px, focus glow

### Comp Card (collapsed)
- Left: Tier badge (48x48 rounded square, gradient fill, bold letter)
- Center: comp name (16px bold) + strategy tag pill + description (13px muted)
- Champion row: 44px rounded icons with cost-color borders + gradient fills
- CARRY badge: absolute positioned top-right of carry icon, purple gradient
- BIS items: 28px icons after a vertical separator, with "BIS" label
- Trait pills: colored dot + trait name + bold count, semi-transparent background with matching border
- Right: Difficulty rating (stars)
- Bottom: Expand bar with "Stage plan, god pick, flex options" + chevron

### Comp Card (expanded)
- Stage timeline: horizontal cards (min-width 160px each) with numbered circles, stage title, unit icons (30px), strategy tip
- Connecting line behind stage numbers (2px subtle border)
- God section: 48px icon + god name (gold) + explanation text
- Flex units: 36px champion icons in a row

---

## Tab: Champions

### Filter Bar
- Cost chips: numbered 1-5 with cost colors, glow on active
- Search box
- Cards/Synergy view toggle

### Champion Card (collapsed)
- 56px portrait: rounded, cost-color border + gradient fill, cost number badge (bottom-right)
- Name (15px bold), trait pills, ability preview (11px muted, one line)
- Grid: auto-fill, minmax(280px, 1fr)

### Champion Card (expanded)
- Spans full grid width
- 64px portrait
- Stat bars in 3-column grid: label (10px uppercase), colored bar (6px), value
  - HP: green, AD: red, AS: gold, ARM: orange, MR: purple, RNG: cyan
- Ability section: dark card with ability name (13px bold purple), full description, scaling variables per star level
- BIS + alt items: two groups of 36px item icons
- "Appears In" comp links as pills

---

## Tab: Items

### Category Tabs
- Components, Combined, Artifacts, Emblems, Set 17
- Active: accent color border + tinted background

### Recipe Builder
- Dark card, centered layout
- Two 52px drop slots + plus sign + equals + 56px result slot with glow
- Slots show component abbreviation when filled

### Component Grid
- 5-column grid of tiles
- Each: 36px icon + name below (9px)

### Combined Item Rows
- Row layout: 40px type-colored icon (AD red, AP purple, Tank green, Utility cyan, Artifact gold) + name + tags + recipe (22px component icons with plus)
- Hover: border highlight + shadow

---

## Tab: Augments

### Tier Selector
- Three cards side by side: Silver, Gold, Prismatic
- Diamond icon + tier label + count
- Active: brighter border + glow + tinted background

### Trait Filters
- Horizontal pills, "All" default active
- Active: orange accent

### Augment Cards
- Left accent stripe (3px) matching tier color
- 44px icon with tier-colored border + gradient fill
- Name (13px bold), description (11px muted), trait pills
- Expandable: full description + "Works Well With" comp suggestions

---

## Tab: Opener Advisor

### Champion Picker
- Grouped by cost (cost-colored section headers)
- 40px champion icons, click to add to "My Units"
- Selected units shown in a bar above with remove option

### Trait Display
- Active traits shown as pills with breakpoint progress
- Breakpoints: filled dots for active, empty for remaining

### Comp Recommendations
- Sorted by match score (0-100%)
- Same card format as Comp Lines but with match percentage badge
- "BEST" badge on top match (subtle, not overwhelming)

---

## Tab: Team Builder

### Hex Board
- 4x7 hex grid, CSS clip-path hexagons at 52px
- Cost-colored borders on placed champions
- Item slots (3 per champion) shown as small circles below hex
- Star level indicator (1-3 stars above hex)
- Empty slots: subtle dashed border

### Champion Pool
- Right sidebar panel with search + cost filter
- 40px draggable champion tiles
- Drag feedback: scale(1.1) + shadow on drag start

### Trait Sidebar
- Left panel showing active traits
- TraitBadge with hex icon, trait name, breakpoint indicator (bronze/silver/gold/chromatic fill)
- Sorted by activation level

### Item Picker
- Tab panel: Combined, Components, Artifacts
- 34px icons in grid, click to assign to selected champion's slot

---

## Tab: Gods

### God Grid
- Large portrait cards (not tiny thumbnails)
- 120x90 portraits with gradient overlay and name at bottom
- Selected: accent border + glow

### God Detail Card
- 200px portrait with gradient overlay
- Name (18px bold), title
- Blessing section: dark card with blessing text
- Stage offerings: 3-column grid (Stage 2/3/4) with bullet lists
- Related comps as pills
- Tip text

---

## Shared Components

### ChampIcon (updated)
- Props: champ, size (default 44), showName, selected, onClick, overlay
- Rounded square (border-radius: size * 0.22)
- Cost-color border (2px) + gradient fill
- Optional cost badge (bottom-right)
- Optional CARRY badge (top-right)
- Hover: scale(1.12)

### ItemIcon (updated)
- Props: itemKey, size (default 28), showName, style
- Type-colored border + tinted background (AD/AP/Tank/Utility/Artifact)
- Abbreviation as fallback text

### TraitBadge (updated)
- Props: trait, count, showCount, compact, breakpoints
- Colored dot + name + bold count
- Semi-transparent tinted background with matching border
- Compact mode for inline use

### Tooltip system
- New shared component
- Dark surface card with arrow
- Shows on hover with 200ms delay
- Content: name, description, stats as needed

---

## Data Enhancements

### CommunityDragon Assets
- Use CommunityDragon CDN for higher-res champion faces, item icons, augment icons
- Base URL: `https://raw.communitydragon.org/latest/`
- Fallback to current Data Dragon URLs

### Cross-linking
- Champions link to comps they appear in
- Items link to champions that use them as BIS
- Augments link to comps they synergize with
- Comps link to champion detail and item detail

---

## Files to Modify

1. `src/donut17/d17.js` - Updated color tokens
2. `src/donut17/Donut17Page.jsx` - New top nav, remove sidebar
3. `src/donut17/tabs/CompLines.jsx` - Full redesign
4. `src/donut17/tabs/Champions.jsx` - Full redesign
5. `src/donut17/tabs/Items.jsx` - Full redesign
6. `src/donut17/tabs/Augments.jsx` - Full redesign
7. `src/donut17/tabs/OpenerAdvisor.jsx` - Redesign
8. `src/donut17/tabs/TeamBuilder.jsx` - Redesign (largest file)
9. `src/donut17/tabs/Gods.jsx` - Redesign
10. `src/donut17/ChampIcon.jsx` - Updated styling
11. `src/donut17/ItemIcon.jsx` - Updated styling
12. `src/donut17/TraitBadge.jsx` - Updated styling
13. New: `src/donut17/Tooltip.jsx` - Shared tooltip component

---

## Out of Scope

- Riot API integration (requires API key application, separate project)
- Mobile-specific layouts (improve responsive, but no dedicated mobile views)
- Real match data / win rates (would need backend aggregation)
- Export/share functionality (future feature)
