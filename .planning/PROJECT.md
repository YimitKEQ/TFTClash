# TFT Clash

## What This Is

TFT Clash is a competitive tournament platform for Teamfight Tactics where players sign up, compete in weekly clashes, and accumulate Clash Points across a full TFT set season. It provides structured, community-driven competition outside the official circuit — with live standings, player profiles, career stats, achievements, and a Hall of Fame. A host marketplace lets organizations run their own branded tourneys on the platform for a monthly subscription.

## Core Value

Admin can run a complete clash end-to-end — from registration through lobbies, score entry, and final standings — without touching code, and results persist permanently.

## Requirements

### Validated

<!-- Existing in prototype — design, logic, and UX are proven -->

- ✓ Points system (EMEA rulebook: 1st=8, 2nd=7, ... 8th=1 pts) — existing
- ✓ Player profiles with career stats and clash history — existing
- ✓ Live standings/leaderboard with tiebreaker sorting — existing
- ✓ Bracket and lobby management UI — existing
- ✓ Hall of Fame screen — existing
- ✓ Achievement system (10+ achievements with unlock logic) — existing
- ✓ Season milestones and challenges screens — existing
- ✓ Results and clash report screens — existing
- ✓ Pricing tiers UI (Player free / Pro $4.99mo / Host $19.99mo) — existing
- ✓ Admin panel UI — existing
- ✓ Scrims screen — existing
- ✓ Rules and FAQ screens — existing
- ✓ Dark theme, color system, typography — existing
- ✓ Season champion and HoF system — existing

### Active

<!-- Needs to be built — the gap between prototype and real product -->

**Foundation**
- [ ] Next.js app scaffold (migrate from Babel-in-browser SPA)
- [ ] Supabase project with schema (players, clashes, lobbies, results, seasons, hosts)
- [ ] Email + password auth via Supabase Auth
- [ ] Discord OAuth login as alternative
- [ ] Role-based access control (player / pro / admin / host)
- [ ] Stripe integration for Pro ($4.99/mo) and Host ($19.99/mo) subscriptions

**Clash Runner**
- [ ] Player registration for an upcoming clash (self-sign-up + admin add)
- [ ] Check-in window (night-of confirmation)
- [ ] Automatic lobby generation (group registered players into 8-player lobbies)
- [ ] Swiss-style multi-round support (re-sort by points after each round)
- [ ] Score entry by admin per lobby/round
- [ ] Dispute flow: player flags result → admin reviews → screenshot upload → resolution
- [ ] Auto-reseed lobbies (admin can reshuffle before next round)
- [ ] Points auto-calculated and applied to season standings on clash completion
- [ ] Clash history persists permanently

**Season & Profiles**
- [ ] Persistent player accounts with Riot ID linking
- [ ] Career stats calculated from real clash history (not seed data)
- [ ] Season leaderboard updated live after each clash
- [ ] Achievements unlock based on real stats
- [ ] Hall of Fame populated from real season data

**Host Marketplace**
- [ ] Host application flow (org applies, admin reviews and approves)
- [ ] Host configuration: scoring rules, format, lobby size, branding (name, colors)
- [ ] Optional Clash Points prize bridge (host can award CP to winners)
- [ ] Host dashboard: manage their own tourneys independently
- [ ] Host tourneys isolated from main TFT Clash season by default
- [ ] Admin oversight: can view/edit all host tourneys

**Deployment**
- [ ] Vercel deployment with custom domain
- [ ] Supabase production environment
- [ ] Riot domain verification (riot.txt already exists)

### Out of Scope

- Mobile app — web-first, mobile is a future consideration
- Riot API integration — manual score entry keeps it simple and avoids API dependency
- Official Riot/Riot Games partnership — community platform only
- Real-time in-game overlay or live match tracking
- Video/streaming integration

## Context

The platform already has a working prototype (`src/App.jsx`, 5,764 lines) that serves as a pixel-perfect design reference and spec. Every screen, the full color system, game logic, and UX patterns are established. The rebuild in Next.js should migrate screen-by-screen using this prototype as a reference — not start from scratch visually.

The platform runs on a set cycle (currently TFT Set 16). A "season" maps to one TFT set. Weekly clashes award Clash Points; season standings lock when the set ends.

Current player base: primarily the Homies friend group (Levitate, Zounderkite, Uri, BingBing, Wiwi, Ole, Sybor, Ivdim, Vlad) + community testers. Goal is to grow to a broader TFT community with host orgs expanding reach.

Levitate (the operator/admin) will assist host orgs in initial setup; once configured, hosts run autonomously. All host configurations require admin approval before going live.

## Constraints

- **Tech stack**: Next.js + Supabase + Vercel — chosen for server-side auth, API routes, real-time subscriptions, and free-tier viability for a small community
- **Auth**: Supabase Auth handles email/password and Discord OAuth
- **Payments**: Stripe for subscription billing (Pro + Host tiers)
- **Prototype**: Existing `src/App.jsx` is reference, not production code — rebuild, don't patch
- **Score entry**: Manual (admin enters scores) — no Riot API dependency
- **Admin approval**: All host org configurations must be approved by Levitate before going live

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js over evolving the prototype | Bundler needed for Supabase regardless; Next.js adds server-side auth, API routes, real routing at minimal extra cost | — Pending |
| Supabase for DB + auth | Postgres + auth + realtime in one free-tier service; perfect scale for small community | — Pending |
| Manual score entry | Avoids Riot API dependency, keeps admin in control, enables dispute handling | — Pending |
| Host orgs isolated by default | Prevents confusion between main season and community tourneys | — Pending |
| Clash Points as optional host prize | Gives hosts a real incentive to drive participation into the main season | — Pending |

---
*Last updated: 2026-03-13 after initialization*
