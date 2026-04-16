# TFT Clash — Design System

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| `bg` | `#08080F` | App background |
| `panel` | `#111827` | Cards, panels |
| `purple` | `#9B72CF` | Primary accent, buttons, highlights |
| `gold` | `#E8A838` | Champion, 1st place, premium elements |
| `teal` | `#4ECDC4` | Secondary accent, stats, tags |
| `text` | `#E5E7EB` | Body text |
| `muted` | `#6B7280` | Secondary/disabled text |
| `border` | `#1F2937` | Panel borders |

## Typography

| Role | Font | Weight | Notes |
|------|------|--------|-------|
| Headings / titles | Playfair Display | 700 | Serif, premium feel |
| Labels / stats | Barlow Condensed | 400–600 | Condensed, data-dense |
| Code / IDs | System mono | 400 | Riot IDs, timestamps |

## Tier Badges

| Tier | Color |
|------|-------|
| Challenger | Gold `#E8A838` |
| Grandmaster | Red-gold |
| Master | Purple `#9B72CF` |
| Diamond | Teal `#4ECDC4` |
| Platinum | Teal lighter |
| Gold | Gold lighter |

## Achievement Tiers

| Tier | Visual |
|------|--------|
| Bronze | `#CD7F32` |
| Silver | `#C0C0C0` |
| Gold | `#E8A838` |
| Legendary | Purple glow + animated border |

## Component Conventions

- **Panel:** `bg #111827`, border `1px solid #1F2937`, `border-radius: 12px`
- **Buttons (primary):** Purple bg, white text, `border-radius: 8px`
- **Buttons (ghost):** Transparent, purple border + text
- **Hover effects:** `opacity: 0.85` or subtle glow `box-shadow: 0 0 12px rgba(155,114,207,0.4)`
- **Gold glow:** `box-shadow: 0 0 20px rgba(232,168,56,0.3)`
- **Card spacing:** 16–24px padding inside panels

## Layout

- Max content width: ~1200px centered
- Sidebar panels: ~320px
- Mobile: stack columns, full-width panels
- Hex background (HexBg component): always behind content, low opacity
