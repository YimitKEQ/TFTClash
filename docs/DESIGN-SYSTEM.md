# TFT Clash Design System

Last updated: 2026-04-25

This is the authoritative reference for visual consistency across TFT Clash. Every new screen and every edit to an existing screen must conform to these rules. The rules exist because without them, every screen drifts and the product stops feeling like one product.

## Typography, five lanes, strict

| Token | Typeface | Use for | Never use for |
|---|---|---|---|
| `font-display` | Russo One 400 | TFT CLASH wordmark, hero numerals, countdown digits, section/card/page titles, all-caps brand callouts | Body, paragraphs, buttons |
| `font-editorial` | Playfair Display 400-700 italic | 1-2 italic accents per page max (e.g. "Competing is always free."), tournament hero titles | Buttons, labels, body |
| `font-body` | Inter 400-600 | Paragraphs, button labels, input text, card body, descriptions | Stat numerals, uppercase labels, hero headings |
| `font-label` | Barlow Condensed 400-700 | Uppercase eyebrows, tags, tab labels, anything with `uppercase tracking-widest` | Body, large titles |
| `font-mono` | JetBrains Mono 400-700 | All UI numerals (stats, pts, placements, countdown, timestamps, ranks) | Prose, titles, labels |

**Removed aliases** (do NOT add back): `font-headline` (collapsed into `font-display`), `font-serif` (use `font-editorial`), `font-sans` (use `font-label`), `font-condensed`, `font-sans-condensed`, `font-nav`, `font-technical`, `font-stats`. The rule is one canonical name per typeface.

## Border radius, four values, strict

| Class | Px | Use for |
|---|---|---|
| `rounded` | 4px | Inputs, small tags, table cells, tiny chips |
| `rounded-lg` | 8px | All cards, panels, modals, tiles |
| `rounded-xl` | 12px | Hero cards, spotlight blocks, featured sponsors |
| `rounded-full` | pill | Buttons, badges, avatars, status dots |

Never use `rounded-[Npx]`, `rounded-sm`, `rounded-2xl`, `rounded-3xl`. If you think you need an exotic radius, you don't.

## Buttons, always `<Btn>`

Import from `src/components/ui/Btn.jsx`. Never write a raw `<button className="...bg-primary...">`.

**Variants:** `primary | secondary | ghost | destructive | tertiary | link`
**Sizes:** `sm | md | lg | xl`
**Props:** `icon`, `iconPosition`, `loading`, `disabled`

```jsx
<Btn variant="primary" size="lg" icon="arrow_forward" iconPosition="right">
  Get Started
</Btn>
```

## Panels, always `<Panel>`

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

## Pill tabs, always `<PillTab>`

Import from `src/components/ui/PillTab.jsx` (re-exported from `src/components/ui`). Never write a raw `<button className="...rounded-full ... uppercase tracking-widest...">` for tab navigation.

This is the canonical look for any tab strip, filter bar, or category switcher across the site. Active tabs use a soft `bg-primary/10` fill with primary border + glow; inactive tabs are muted with hover lift.

**Props:** `active`, `onClick`, `icon`, `iconSize`, `iconPosition`, `children`, `className`
**Group wrapper:** `<PillTabGroup align="center | start | between">` provides the standard horizontal scroller with mobile padding.

```jsx
<PillTabGroup>
  {TABS.map(function(t) {
    return (
      <PillTab
        key={t.id}
        icon={t.icon}
        active={tab === t.id}
        onClick={function() { setTab(t.id) }}
      >
        {t.label}
      </PillTab>
    )
  })}
</PillTabGroup>
```

Use `<PillTab>` for any tab navigation, filter chips, or section switcher. Do not use `<Btn>` for tab toggles — `<Btn>` is for CTAs (Save, Submit, View All). Status pills (Active/Cancelled/Live) stay as `<Tag>`.

## Section headers, always `<SectionHeader>`

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
5. Fonts: `font-display` for titles + brand wordmarks, `font-body` for prose, `font-label` for eyebrows + tags + buttons, `font-mono` for numbers, `font-editorial` for sparing italic accents only
6. No inline `rounded-[Npx]`, no inline gradient backgrounds
7. No inline styles (`style={{...}}`) for colors, use Tailwind tokens

## Grep guards (CI-ready)

```bash
# Zero matches expected for these:
git grep -n 'rounded-\[' src/
git grep -nE 'rounded-sm\b' src/
git grep -nE 'rounded-2xl\b' src/
git grep -nE 'rounded-3xl\b' src/
git grep -nE 'font-sans\b' src/screens/
git grep -nE 'font-condensed\b' src/screens/
git grep -nE 'font-sans-condensed\b' src/screens/
git grep -nE 'font-sans-cond\b' src/screens/
git grep -nE 'font-technical\b' src/screens/
git grep -nE 'font-stats\b' src/screens/
git grep -nE 'font-nav\b' src/screens/

# Zero matches — these are not defined in tailwind.config.js and produce no CSS:
git grep -nE 'font-barlow\b' src/
git grep -nE 'font-playfair\b' src/

# Fewer than 5 matches (only justified inline buttons):
git grep -n '<button className' src/screens/

# Zero matches in production code (Sentry captures errors elsewhere):
git grep -nE 'console\.log' src/
```

Run these before every push. If the guards fail, fix the code, not the guards.
