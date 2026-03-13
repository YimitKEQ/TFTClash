# Requirements: TFT Clash

**Defined:** 2026-03-13
**Core Value:** Admin can run a complete clash end-to-end without touching code, and results persist permanently.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: Next.js app scaffold with Supabase project, DB schema, and environment configuration
- [ ] **FOUND-02**: App is deployed to Vercel with a custom domain and production Supabase environment

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in with Discord OAuth (one-click)
- [ ] **AUTH-03**: User session persists across browser refresh
- [ ] **AUTH-04**: Role-based access control enforced (player / pro / admin / host)

### Payments

- [ ] **PAY-01**: User can subscribe to Pro tier ($4.99/mo) via Stripe
- [ ] **PAY-02**: Organization can subscribe to Host tier ($19.99/mo) via Stripe
- [ ] **PAY-03**: Subscription status gates Pro and Host features throughout the app

### Clash Runner

- [ ] **CLASH-01**: Player can self-register for an upcoming clash from their account
- [ ] **CLASH-02**: Player can check in during the check-in window on clash night
- [ ] **CLASH-03**: Admin can generate 8-player lobbies from checked-in players (auto-assign)
- [ ] **CLASH-04**: Admin can run Swiss-style multi-round format (players re-sorted by CP after each round)
- [ ] **CLASH-05**: Admin can enter placements per player per lobby/round
- [ ] **CLASH-06**: Player can dispute a result; admin resolves by reviewing screenshot evidence
- [ ] **CLASH-07**: Admin can reseed/reshuffle lobbies before a round starts
- [ ] **CLASH-08**: Clash Points auto-calculated from placements (EMEA rulebook) and applied to season standings on clash completion

### Season & Profiles

- [ ] **SEASON-01**: Player has a persistent account with linked Riot ID and public profile
- [ ] **SEASON-02**: Career stats (points, wins, avg placement, top4s) calculated from real clash history
- [ ] **SEASON-03**: Season leaderboard shows live standings, updated automatically after each clash
- [ ] **SEASON-04**: Achievements unlock based on real career stats and clash history
- [ ] **SEASON-05**: Hall of Fame populated from real season data (season champion, notable records)

### Host Marketplace

- [ ] **HOST-01**: Organization can submit a host application with their tourney concept
- [ ] **HOST-02**: Admin can review, approve, and help configure a host account
- [ ] **HOST-03**: Host can configure their tourney: custom scoring rules, format, lobby size, branding (name, colors)
- [ ] **HOST-04**: Host can run their own tourneys independently via a host dashboard
- [ ] **HOST-05**: Host can optionally set Clash Points as a prize, awarding CP to their winners into the main season leaderboard

## v2 Requirements

### Communications

- **COMM-01**: Email notifications for clash registration confirmation
- **COMM-02**: Email reminders for check-in window opening
- **COMM-03**: Discord webhook notifications for clash results

### Advanced Host Features

- **HOST-V2-01**: Multi-admin support for a host org (multiple staff members)
- **HOST-V2-02**: Public host org page with their tourney history
- **HOST-V2-03**: Host analytics dashboard (participation trends, player retention)

### Player Social

- **SOCL-01**: Players can add clash notes / post-game thoughts to their profile
- **SOCL-02**: Season recap screen with personalized stats for each player

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Web-first; mobile is a future milestone |
| Riot API integration | Manual score entry keeps control in admin hands and avoids API dependency |
| Official Riot/Riot Games partnership | Community platform only |
| Real-time in-game overlay | Out of scope for tournament tracking tool |
| Video/streaming integration | Not core to the competitive platform value |
| Next.js scaffold (pre-selected) | Scaffold is implied by all other requirements, not a standalone user-facing feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| PAY-01 | Phase 2 | Pending |
| PAY-02 | Phase 2 | Pending |
| PAY-03 | Phase 2 | Pending |
| CLASH-01 | Phase 3 | Pending |
| CLASH-02 | Phase 3 | Pending |
| CLASH-03 | Phase 3 | Pending |
| CLASH-04 | Phase 3 | Pending |
| CLASH-05 | Phase 3 | Pending |
| CLASH-06 | Phase 3 | Pending |
| CLASH-07 | Phase 3 | Pending |
| CLASH-08 | Phase 3 | Pending |
| SEASON-01 | Phase 4 | Pending |
| SEASON-02 | Phase 4 | Pending |
| SEASON-03 | Phase 4 | Pending |
| SEASON-04 | Phase 4 | Pending |
| SEASON-05 | Phase 4 | Pending |
| HOST-01 | Phase 5 | Pending |
| HOST-02 | Phase 5 | Pending |
| HOST-03 | Phase 5 | Pending |
| HOST-04 | Phase 5 | Pending |
| HOST-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after initial definition*
