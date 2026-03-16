# TFT Clash — Contributing Guide

**Last Updated:** 2026-03-16

## Prerequisites

- **Node.js 18+** (check via `node --version`)
- **npm 9+** (bundled with Node)
- **Git** for version control

## Installation & Setup

```bash
# Clone the repository
git clone https://github.com/YimitKEQ/TFTClash.git
cd tft-clash

# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev
```

## Environment Variables

The project uses Supabase for auth and realtime state sync. Create a `.env` file in the root:

```
VITE_SUPABASE_URL=https://odaphvmwhxecocrhwpsb.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

These are already configured in the `.env` file — no setup needed for local dev.

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server on http://localhost:5173 |
| `npm run build` | Build optimized production bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run test:e2e` | Run Playwright end-to-end tests (headless) |
| `npm run test:e2e:headed` | Run E2E tests with browser GUI |
| `npm run test:e2e:report` | Open HTML report of last E2E test run |

## Project Structure

- **`src/App.jsx`** — Single-file React app (~7400 lines), all screens and components
- **`tests/e2e/`** — Playwright E2E test suite for critical user flows
- **`discord-bot/`** — Node.js Discord bot for tournament notifications
- **`docs/`** — Project documentation (TASKS.md, PRODUCTION.md, TOURNAMENT-SYSTEM.md, DESIGN.md)
- **`public/`** — Static assets (favicon, robots.txt, manifest)

## Editing App.jsx — Critical Rules

**BEFORE EDITING `src/App.jsx`, read these rules carefully:**

1. **NO IIFEs in JSX** — `{(()=>{...})()}` crashes the Babel renderer
   - Use helper functions defined outside JSX instead

2. **GCSS block (lines ~305–403) is a template literal** — do NOT convert or touch its structure
   - This is global CSS embedded as a string — treat as read-only

3. **Brace balance must stay at 0** after every edit
   - Count: `content.count('{') - content.count('}')`
   - If balance ≠ 0, the file won't parse

4. **No backtick string literals inside JS functions**
   - Use `'single'` or `"double"` quotes for strings

5. **No named function components defined inside another component's body**
   - Define all component functions at module level

6. **For multi-part edits**, use Python scripts or careful sequential `str_replace` to avoid failures

7. **Always verify brace balance** after every edit block completes

## E2E Testing

Run Playwright tests to verify critical user flows:

```bash
# Run all tests (headless)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# View test report
npm run test:e2e:report
```

Tests are in `tests/e2e/` and cover:
- Auth flows (signup, login)
- Tournament brackets
- Player profiles
- Leaderboard search
- Pricing tiers

## Product Identity (Reference)

- **Platform:** TFT Clash — weekly clashes, season, community platform
- **Tiers:** Player (free) / Pro ($4.99/mo) / Host ($19.99/mo)
- **Free to compete always** — no paywall on entry
- **Theme:** Dark — bg `#08080F`, panels `#111827`, accent purple `#9B72CF`, gold `#E8A838`, teal `#4ECDC4`
- **Fonts:** Playfair Display (headings), Barlow Condensed (labels)

## Deployment

The app is deployed to **Vercel** via GitHub push.

- **Repository:** https://github.com/YimitKEQ/TFTClash
- **Production:** https://tftclash.com (Vercel)
- **Database:** Supabase (auth, results, realtime sync)
- **Discord Bot:** Deployed separately (see `discord-bot/SETUP.md`)

For production checklist, see `docs/PRODUCTION.md`.

## Documentation

- **`docs/TASKS.md`** — Task backlog with line numbers for each component
- **`docs/TOURNAMENT-SYSTEM.md`** — Deep-dive on tournament formats, registration, check-in
- **`docs/DESIGN.md`** — Design system, color scheme, typography
- **`docs/PRODUCTION.md`** — Production deployment checklist
- **`CLAUDE.md`** — Developer rules and file map (read before editing App.jsx)

## Questions?

Contact Levitate (the project lead) or file an issue on GitHub.
