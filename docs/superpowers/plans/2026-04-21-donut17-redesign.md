# Donut 17 Redesign + Meta Scrape Implementation Plan

**Goal:** Ship the hidden `/donut17` prep tool for TFT Set 17 ("Space Gods") with the Stitch-derived visual DNA (gold gradient, glass cards, editorial serif + condensed sans + mono trio) and an IA of 7 tabs: Opener Advisor, Synergy, Champions, Comp Lines, Gods, Items, Augments. Enrich data with a meta scraper covering metatft.com, tactics.tools, lolchess.gg, tftacademy.com on top of the existing Community Dragon PBE baseline.

**Architecture:**
- Route: `/donut17` hooked into the legacy `screen` state system. Renders **without** `PageLayout` so there is no main-site Navbar/Footer — Donut 17 brings its own TopNav + SideNav chrome. Isolation rule preserved: no `useApp`, no Supabase, no imports outside `src/donut17/`.
- Data: scraper produces static JSON committed to `src/donut17/data/`. Page consumes via direct `import` (vite inlines at build).
- Styling: reuses the main Tailwind config (tokens already match Stitch palette). A thin `theme.css` scoped by `.d17` adds gold-gradient and glass-card utility classes.

**Tech Stack:** React 18, Tailwind 3, Vite 5, vanilla JS (`var` / `function(){}` per project rule), Python 3 requests + BeautifulSoup for scraping.

---

## File Structure

```
src/donut17/
  Donut17Screen.jsx          -- Orchestrator: tab state, renders TopNav + SideNav + active tab
  theme.css                  -- .d17-scoped utilities (gradient, glass, scanline)
  layout/
    TopNav.jsx               -- Sticky top bar, DONUT 17 wordmark, quick search, avatar
    SideNav.jsx              -- Left rail, 7 tabs with active border accent
  tabs/
    OpenerAdvisor.jsx        -- HERO: unit picker --> scored comp suggestions
    SynergyGrid.jsx          -- Trait matrix x champions
    Champions.jsx            -- Grid with cost/trait/search filters
    CompLines.jsx            -- Tier list card grid
    Gods.jsx                 -- 9 altar cards with stage offerings
    Items.jsx                -- Combine chart + BIS
    Augments.jsx             -- Tier list, filter by silver/gold/prismatic
  lib/
    scoring.js               -- Opener scoring algo
    useActiveTab.js          -- Local hash-based tab state hook
    imgFallback.js           -- onerror handler for tactics.tools 404s
  data/
    champions.json traits.json items.json augments.json
    gods.json comp_lines.json synergy_grid.json
    meta.json                -- NEW: enriched tier/play-rate/placement data

scraper/
  scrape_all.py              -- existing (cdragon + static)
  scrape_meta.py             -- NEW: orchestrates sources/, writes meta.json
  sources/
    __init__.py
    base.py                  -- shared http helpers (UA headers, retry, NEXT_DATA extract)
    metatft.py               -- tier list + comp play rates
    tactics_tools.py         -- comp avg placement + unit stats
    lolchess.py              -- alt tier reference
    tftacademy.py            -- guide articles (optional)

docs/superpowers/plans/
  2026-04-21-donut17-redesign.md   -- this doc
```

---

## Execution Order

1. **Scaffold directories + theme.css** (1 commit)
2. **Layout shell** — TopNav + SideNav (1 commit)
3. **Donut17Screen orchestrator + Gods tab** (1 commit; Gods is the easiest polished tab and validates the shell end-to-end)
4. **Opener Advisor** (1 commit; hero feature)
5. **Champions + CompLines + Synergy + Items + Augments** (1 commit; remaining tabs)
6. **Route wire-up in App.jsx** (1 commit)
7. **Meta scraper + sources modules** (1 commit; ships the infra, at least one source fully implemented)
8. **Run cdragon scraper, smoke test, polish pass** (1 commit)

---

## Scoping Notes

- **Google Sheet** (`17nVCuj…`): Signed CSV export redirect 400'd. Awaiting raw data paste or CSV drop in repo. Scraper meta layer + static comp_lines.py cover the gap until then.
- **Meta sites**: realistic probe order — all four use Next.js or similar SPAs with `__NEXT_DATA__` JSON in page source. Implementation strategy: `fetch HTML → extract script#__NEXT_DATA__ → json.loads → project into meta.json schema`. Rate limit: 1s between requests per site. UA string mirrors a normal Chrome build.
- **No E2E for this route**: it's hidden, not indexed in sitemap, not linked from main nav. Manual smoke test only.
- **Test coverage**: this is a single-user prep tool on a hidden route with static imports. Skipping unit tests per YAGNI; visual verification covers it.

---

## Risks

- Meta sites may block scraping (cloudflare). Fallback: stub `meta.json` with empty arrays + log warnings; UI degrades gracefully (no tier badges shown if data missing).
- `__NEXT_DATA__` shape changes. Mitigation: each source module independent, any one breaking doesn't stop others.
- `tft17_` prefix on tactics.tools CDN might not be live yet for PBE assets. Mitigation: `imgFallback.js` swaps to a placeholder cost-colored tile on 404.
