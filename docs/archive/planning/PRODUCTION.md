# TFT Clash — Production Readiness Checklist

## Current State
- Single-file React app (`src/App.jsx`) with mock/seed data
- Deployed on Vercel (static hosting)
- No backend, no real auth, no database

---

## Before Going Live

### Auth & User Data
- [ ] Replace mock `authState` with real auth (Supabase / Firebase / Clerk)
- [ ] Real user profiles stored in DB
- [ ] Session persistence across page reloads
- [ ] Email verification on signup

### Data Layer
- [ ] Replace SEED data with real DB reads
- [ ] Clash/match results stored + fetched from DB
- [ ] Admin panel writes to DB (not just local state)
- [ ] Leaderboard pulls live from DB

### Payments
- [ ] Stripe integration for Pro ($4.99/mo) and Host ($19.99/mo)
- [ ] Webhook handling for subscription events
- [ ] Gate Pro/Host features behind real subscription check

### Performance
- [ ] Split `App.jsx` into separate component files (it's 5000+ lines)
- [ ] Code splitting / lazy loading for screens
- [ ] Optimize bundle size

### SEO & Meta
- [ ] Add proper `<title>` and Open Graph meta tags
- [ ] `robots.txt` (already have `riot.txt` for Riot verification)
- [ ] Sitemap

### Security
- [ ] Admin panel behind real auth check (not just `isAdmin` state)
- [ ] Rate limiting on any API routes
- [ ] No secrets in client-side code

### Monitoring
- [ ] Error tracking (Sentry or similar)
- [ ] Analytics (Plausible / Posthog)

---

## Vercel Config

Current `vercel.json` has rewrite rules. Verify:
- [ ] All routes fallback to `index.html` for SPA routing
- [ ] `riot.txt` served correctly at `/.well-known/` or root
- [ ] Environment variables set in Vercel dashboard (not in code)

---

## Nice to Have Before Launch

- [ ] Custom domain
- [ ] Discord integration (notify when clash starts, results posted)
- [ ] Riot API integration (real match data instead of seed)
- [ ] Mobile-responsive polish pass
