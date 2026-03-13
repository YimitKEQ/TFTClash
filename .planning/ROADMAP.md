# Roadmap: TFT Clash

## Overview

Rebuild the existing prototype into a production Next.js + Supabase application. Starting from a pixel-perfect prototype (`src/App.jsx`) that defines every screen, design token, and game rule, the rebuild adds a real database, real authentication, real payments, and a live clash runner. Five phases move from scaffold to a fully operational platform where an admin can run a complete clash end-to-end without touching code.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Auth** - Next.js + Supabase scaffold with real user authentication deployed to Vercel
- [ ] **Phase 2: Payments** - Stripe subscription billing for Pro and Host tiers with feature gating throughout the app
- [ ] **Phase 3: Clash Runner** - Complete end-to-end clash execution — registration, check-in, lobbies, scoring, disputes, and standings
- [ ] **Phase 4: Season and Profiles** - Live season leaderboard, persistent player profiles, real career stats, achievements, and Hall of Fame
- [ ] **Phase 5: Host Marketplace** - Host application flow, host dashboard, tourney configuration, and optional Clash Points prize bridge

## Phase Details

### Phase 1: Foundation and Auth
**Goal**: A deployed Next.js application where users can create accounts and log in, backed by Supabase with a real schema
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password and receive a confirmed account
  2. User can log in with Discord OAuth in one click without entering a password
  3. User session persists across browser refresh — no re-login required
  4. Role-based access is enforced: admin-only screens are inaccessible to player accounts
  5. The app is live at a custom domain on Vercel with a production Supabase database
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Next.js scaffold, Tailwind design tokens, shared layout, and UI primitives
- [ ] 01-02-PLAN.md — Supabase schema (profiles table, RLS), TypeScript types, and client helpers
- [ ] 01-03-PLAN.md — Auth pages (email/password + Discord OAuth), session middleware, and RBAC
- [ ] 01-04-PLAN.md — Vercel deployment config and live deployment verification

### Phase 2: Payments
**Goal**: Users can subscribe to Pro and Host tiers via Stripe, and the subscription status gates the correct features throughout the app
**Depends on**: Phase 1
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. Player can upgrade to Pro ($4.99/mo) via Stripe checkout and immediately access Pro features
  2. Organization can subscribe to Host tier ($19.99/mo) via Stripe checkout
  3. Pro-gated features are inaccessible to free players; Host-gated features are inaccessible to non-host accounts
  4. Subscription status persists across sessions and is not bypassable client-side
**Plans**: TBD

### Phase 3: Clash Runner
**Goal**: Admin can run a complete clash end-to-end — from player registration through lobby generation, score entry, disputes, and auto-calculated season standings
**Depends on**: Phase 1
**Requirements**: CLASH-01, CLASH-02, CLASH-03, CLASH-04, CLASH-05, CLASH-06, CLASH-07, CLASH-08
**Success Criteria** (what must be TRUE):
  1. Player can self-register for an upcoming clash from their account, and admin can also manually add players
  2. Player can check in during the check-in window on clash night, confirming their attendance
  3. Admin can generate 8-player lobbies automatically from checked-in players and reseed them before any round starts
  4. Admin can run Swiss-style multi-round format with players re-sorted by Clash Points after each round
  5. Admin can enter per-player placements per lobby/round, and Clash Points are auto-calculated from the EMEA rulebook and applied to season standings on clash completion
  6. Player can flag a disputed result; admin can review with screenshot evidence and resolve the dispute
**Plans**: TBD

### Phase 4: Season and Profiles
**Goal**: Live season data flows into every player-facing surface — profiles show real career stats, the leaderboard updates after each clash, achievements unlock from real history, and the Hall of Fame reflects the actual season champion
**Depends on**: Phase 3
**Requirements**: SEASON-01, SEASON-02, SEASON-03, SEASON-04, SEASON-05
**Success Criteria** (what must be TRUE):
  1. Player has a persistent public profile with a linked Riot ID visible to all users
  2. Career stats (points, wins, avg placement, top4s) are calculated from real clash history, not seed data
  3. Season leaderboard updates automatically after each clash completes, with tiebreakers applied per EMEA rulebook
  4. Achievements unlock based on real career stats and are visible on the player's profile
  5. Hall of Fame displays the actual season champion and notable records drawn from real season data
**Plans**: TBD

### Phase 5: Host Marketplace
**Goal**: External host organizations can apply, get approved, and independently run their own branded tourneys on the platform, with an optional bridge that awards Clash Points to their winners
**Depends on**: Phase 1
**Requirements**: HOST-01, HOST-02, HOST-03, HOST-04, HOST-05
**Success Criteria** (what must be TRUE):
  1. Organization can submit a host application describing their tourney concept; admin can review and approve it
  2. Host can configure their tourney with custom scoring rules, format, lobby size, and branding (name, colors)
  3. Host can run their own tourneys independently via a host dashboard without requiring admin involvement
  4. Host tourneys are isolated from the main TFT Clash season by default — no cross-contamination of standings
  5. Host can optionally enable Clash Points as a prize, awarding CP directly into the main season leaderboard for their winners
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Auth | 0/4 | Planning complete | - |
| 2. Payments | 0/TBD | Not started | - |
| 3. Clash Runner | 0/TBD | Not started | - |
| 4. Season and Profiles | 0/TBD | Not started | - |
| 5. Host Marketplace | 0/TBD | Not started | - |
