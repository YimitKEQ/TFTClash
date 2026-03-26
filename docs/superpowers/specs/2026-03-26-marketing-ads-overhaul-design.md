# Marketing + Ads Overhaul — Design Spec
_Date: 2026-03-26_

## Goal

Sharpen marketing copy across the platform, add a tier-gated ad system (house ads now, AdSense-ready), and make "Ad-free" a visible Pro differentiator.

---

## 1. Copy Fixes

| File | Change |
|------|--------|
| `HomeScreen.jsx` tagline | "The ranked TFT league for you. Compete weekly, climb the ladder." |
| `HomeScreen.jsx` value chips | "Results every Saturday" → "Results every week" |
| `HomeScreen.jsx` PromotionFooter | General "weekly" language, no Saturday specifics |
| Other Saturday refs in HomeScreen | → "weekly" / "this week's clash" |
| `PricingScreen.jsx`, `SignUpScreen.jsx`, `index.html` | Already updated in yesterday's uncommitted changes — committed as-is |

**Copywriting principles applied:**
- Zero-Price Effect: "Free to compete, always" stays prominent
- Specificity: remove day-of-week lock-in so copy ages better
- Solo framing: "for you" not "for your crew" (solo competition, no team mechanic)

---

## 2. Ad System

### Architecture

New file: `src/components/shared/AdBanner.jsx`

Three top-level components (no nesting):

**`HouseAd({ size })`**
Pro upsell banner shown when no AdSense client is configured. Matches dark site theme. Copy: "Pro members lock their spot early, get full career stats, and see zero ads. $4.99/mo." with Upgrade CTA button.

**`AdsenseSlot({ size })`**
Renders `<ins class="adsbygoogle">` with `useEffect` push. Only used when `VITE_ADSENSE_CLIENT` env var is set. Supports `banner` (auto/responsive) and `rectangle` (300x250) sizes.

**`AdBanner({ size, className })`**
- Reads `userTier` from `useApp()`
- Returns `null` for `pro` or `host` tier (ad-free)
- Returns `AdsenseSlot` if `VITE_ADSENSE_CLIENT` is set, else `HouseAd`

### AdSense Activation

Commented script block added to `index.html` — user uncomments when AdSense account is approved. No code changes required.

```html
<!-- AdSense: uncomment when approved
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=REPLACE_ME" crossorigin="anonymous"></script>
-->
```

Set `.env` vars:
```
VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
VITE_ADSENSE_SLOT=XXXXXXXXXX
```

### Placements

| Screen | Position |
|--------|----------|
| `HomeScreen` | After value props chips, before SeasonStatsBar |
| `LeaderboardScreen` | After podium, before filters/search |
| `StandingsScreen` | Above tab content (Leaderboard tab default view) |

All use `size="banner"` (responsive horizontal).

---

## 3. Pro Plan Updates — `PricingScreen.jsx`

**Add to `PRO_FEATURES`** (position 2 — high perceived value):
```js
{ text: 'Ad-free - compete without interruptions', icon: 'block' }
```

**Add to `COMPARISON_ROWS`** (after priority registration):
```js
{ label: 'Ad-free browsing', player: false, pro: true, host: true, type: 'bool' }
```

---

## 4. Marketing Psychology Applied

| Principle | Applied Where |
|-----------|---------------|
| Zero-Price Effect | "Free to compete, always" chip + CTA label |
| Loss Aversion | House ad: "Pro members see zero ads" framing |
| Anchoring / Decoy | Pro tier shown between free and Host ($19.99) |
| Mental Accounting | "$4.99/mo" + "Founding member pricing locks in at launch" |
| Social Proof | Player count in PromotionFooter copy |
| Endowment Effect | Free account lets you "own" your profile/stats before upgrading |

---

## Files Changed

| File | Change Type |
|------|-------------|
| `src/components/shared/AdBanner.jsx` | New |
| `src/screens/HomeScreen.jsx` | Edit — tagline, chips, Saturday refs |
| `src/screens/LeaderboardScreen.jsx` | Edit — inject AdBanner |
| `src/screens/StandingsScreen.jsx` | Edit — inject AdBanner |
| `src/screens/PricingScreen.jsx` | Edit — Ad-free feature + comparison row |
| `index.html` | Edit — commented AdSense script block |
