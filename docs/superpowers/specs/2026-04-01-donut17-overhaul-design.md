# Donut17 Full Overhaul — Design Spec
**Date:** 2026-04-01
**Status:** Approved

---

## Overview

Complete visual and functional overhaul of the `/donut17` Set 17 PBE prep tool. Direction: "Galaxy Atlas" — editorial splash cards, Barlow Condensed headers, deep space atmosphere, TFT official aesthetic fused with TFT Clash's dark gold/glass style.

---

## Design System

**New tokens (in d17.js):**
- Background: `#0b0813` (deeper purple-black vs current `#0c1018`)
- Surface: `#110e1c` / `#1a1628` / `#221d34`
- Border: `#2e2848` / `#3d3660`
- Lavender: `#c8b8ff` (keep), Sky: `#7dc8ff` (keep), Gold: `#f0cc00` (keep)
- New: Orange `#ff8c42` for stat highlights

**Typography:**
- Headlines: `Barlow Condensed` 800 weight, uppercase, tight letter-spacing (replacing Space Grotesk for headings only)
- Body: `Inter` (keep)
- Labels: `Inter` (keep)

**Components:**
- Comp cards: gradient splash header per comp color, tier badge top-right, strategy badge bottom-left, hex unit icons with carry highlight ring
- Hero banner per tab: eyebrow label + big title + stat strip
- Tier strip filter: S/A/B/C pill filters with colored letter badges

---

## Tab Structure (7 tabs, clean nav)

| Tab | Key | Change |
|-----|-----|--------|
| Opener Advisor | `opener` | Redesign header + cards |
| Team Builder | `builder` | Full drag-and-drop rebuild |
| Comp Lines | `comps` | New card layout + tier filter |
| Champions | `champs` | Keep + add Synergy Grid toggle |
| Items | `items` | Redesign header |
| Augments | `augments` | NEW — fix data, replace Set 13 |
| Gods | `gods` | Redesign header |

---

## TeamBuilder — Drag & Drop

**Interaction model:**
- Drag champion from pool → drop on empty hex = place
- Drag champion from pool → drop on occupied hex = swap (replace, old champ returns to pool)
- Drag champion on board → drop on empty hex = move
- Drag champion on board → drop on occupied hex = swap both
- Drag champion off board (to pool area or trash zone) = remove
- Click-to-place still works as fallback (click pool champ → pending → click hex)

**Implementation:**
- HTML5 Drag API: `draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`
- `dragState` object tracks: `{ source: "pool"|"board", key, hid }`
- Visual feedback: hex glows on dragover, dragged champ goes 50% opacity
- No external libraries — pure DOM drag events

**Board:** 4 rows × 7 cols, staggered hex layout (unchanged dimensions)

**Item assignment:** Click hex to select → click item in picker to assign (unchanged)

---

## Comp Lines — Tier System

Add `tier: "S"|"A"|"B"|"C"` to all 10 comps in `comp_lines.json`.

Tier assignments (initial):
- S: Dark Star Vertical
- A: N.O.V.A. Bastion, Anima Reroll, Channeler AP
- B: Stargazer Stack, Rogue Assassin, Space Groove 6
- C: Meeple 6 (situational), remaining comps

Tier filter strip: click to filter by tier. Multiple select supported.

---

## Augments Tab — New

Replace `augments.json` (currently broken Set 13 data) with Set 17 augments.

Data structure per augment:
```json
{
  "name": "string",
  "desc": "string",
  "tier": 1 | 2 | 3,
  "tierLabel": "Silver" | "Gold" | "Prismatic",
  "traits": ["TraitName"],
  "icon": "url"
}
```

Filter by: Silver / Gold / Prismatic / by Trait.
Display: grid of augment cards with icon, name, description, tier color.

---

## Champions Tab — Synergy Grid Toggle

Champions tab gets a view toggle: **Grid View** (current champion cards) vs **Synergy Grid** (trait matrix). Removes the standalone Synergy Grid tab.

---

## Data Changes

1. `d17.js` — new color tokens + add Barlow Condensed to `F.headline`
2. `comp_lines.json` — add `tier` field to all 10 comps
3. `augments.json` — full rebuild with Set 17 augment data
4. `Donut17Page.jsx` — update tab list (remove Grid, add Augments), new header/nav
5. `TeamBuilder.jsx` — full drag-and-drop rewrite
6. All tab files — apply new design system (headers, cards, colors)
