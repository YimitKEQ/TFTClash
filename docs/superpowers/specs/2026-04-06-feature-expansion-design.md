# TFT Clash Feature Expansion - Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Author:** Claude + Levitate

---

## Overview

Four-phase feature expansion to transform TFT Clash from a manually-operated clash platform into a self-service, real-time competitive experience with Discord-native community features and viral social mechanics.

## Phase 1: Player Self-Reporting & Live Tournament View

### 1A: Self-Reporting Score System

**Goal:** Let the 8 players in each lobby submit their own placements, with conflict detection and admin override.

**Database:**

New table: `disputes`

```sql
CREATE TABLE disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id) NOT NULL,
  round int NOT NULL,
  lobby_number int NOT NULL,
  player_id uuid REFERENCES players(id) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',  -- open, resolved, dismissed
  admin_notes text,
  resolved_by uuid REFERENCES players(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

Existing table `pending_results` is used as-is. Add RLS policy:

```sql
-- Players can only insert their own results
CREATE POLICY "players_insert_own" ON pending_results
  FOR INSERT WITH CHECK (player_id = auth.uid());

-- Players can view results in their tournament
CREATE POLICY "players_view_tournament" ON pending_results
  FOR SELECT USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_registrations
      WHERE player_id = auth.uid()
    )
  );

-- Admins can do anything
CREATE POLICY "admin_full_access" ON pending_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('admin', 'host'))
  );
```

**UI Flow:**

1. Tournament phase is `in_progress`, round is active
2. Player sees their lobby assignment with the 8 players listed
3. Below the lobby: "Submit Your Placement" form with a dropdown (1-8)
4. Player selects placement, clicks Submit. Button disables, shows checkmark
5. Live counter shows "5/8 submitted" updating via Supabase Realtime
6. Once all 8 submit:
   - If no conflicts (all placements unique): round auto-locks, results display
   - If conflicts (duplicate placements): round flagged as "disputed", yellow banner shown
7. Dispute button available on each round - opens modal with text input for reason

**Conflict Detection Logic (in FlashTournamentScreen):**

```
After 8th submission:
  - Group placements by value
  - If any placement has >1 player: mark round as conflicted
  - Show warning: "Placement conflict detected - admin review pending"
  - Create auto-dispute entries for conflicting players
```

**Admin Override:**

- In TournamentTab / Command Center: "Disputes" section shows all open disputes
- Admin can view all 8 submissions, edit any placement, resolve dispute
- Admin can submit/change results at any time regardless of player submissions

**File changes:**
- `src/screens/FlashTournamentScreen.jsx` - Add self-reporting UI, realtime subscriptions
- `src/screens/admin/TournamentTab.jsx` - Add disputes panel
- `src/screens/ops/OpsTournaments.jsx` - Add disputes overview in Command Center

### 1B: Live Tournament View

**Goal:** Player-facing real-time experience during active tournaments.

**Implementation:**

New section in `FlashTournamentScreen` activated when `phase === 'in_progress'`:

1. **Lobby Assignment Card** - Your lobby number, your 8 opponents with ranks (RankBadge)
2. **Submission Status** - Real-time grid showing who has/hasn't submitted (green check / gray clock)
3. **Round Progress** - "Round 2 of 4" with progress bar
4. **Live Standings** - Running total points table, updates as results come in
5. **Round History** - Expandable cards for completed rounds showing all placements

**Realtime Subscriptions:**
- `pending_results` table filtered by `tournament_id` - triggers on INSERT/UPDATE
- `tournaments` table filtered by `id` - triggers on UPDATE (phase changes, round advances)

**File changes:**
- `src/screens/FlashTournamentScreen.jsx` - Major expansion with live view components

---

## Phase 2: Discord Bot Overhaul

### 2A: Fix Existing Bot

**URL Migration:**
- Replace all `tft-clash.vercel.app` references with `tftclash.com` in `discord-bot/utils/embeds.js`

**Dynamic Data:**
- `discord-bot/utils/data.js`: Replace hardcoded `NEXT_CLASH` and `SEASON` with live queries:
  - `getNextClash()` - queries `tournaments` for next upcoming by date
  - `getCurrentSeason()` - queries current season data
- Remove SEED fallback arrays

**Embed Updates:**
- Update all embeds to use new branding, correct URLs, dynamic data

### 2B: New Slash Commands

| Command | Description | Implementation |
|---------|-------------|----------------|
| `/lobby` | Show your current lobby assignment + opponents | Query `tournament_lobbies` + `pending_results` by discord_user_id |
| `/submit <placement>` | Submit placement from Discord | Insert into `pending_results`, same validation as web |
| `/dispute <round> <reason>` | File a dispute | Insert into `disputes` table |
| `/tournament [id]` | Show tournament details + standings | Query `tournaments` + `game_results` |

**File changes:**
- New files: `discord-bot/commands/lobby.js`, `discord-bot/commands/submit.js`, `discord-bot/commands/dispute.js`, `discord-bot/commands/tournament.js`
- Update: `discord-bot/index.js` to register new commands

### 2C: Auto Lobby Channels

**Flow:**
1. Admin advances tournament to a new round (or round auto-starts)
2. Bot receives event (via Supabase Realtime subscription or webhook call)
3. For each lobby, bot creates:
   - Text channel: `#lobby-{n}-round-{r}` under a "Tournament" category
   - Voice channel: `Lobby {n} Voice` (optional, same category)
4. Bot sets permissions: only the 8 assigned players can see/join (matched via `players.discord_user_id`)
5. Bot posts lobby info embed in the text channel: opponents, round number, submit instructions
6. 30 minutes after round ends: channels auto-archive (move to archive category or delete)

**File changes:**
- New: `discord-bot/lobby-channels.js` - Channel creation/cleanup logic
- Update: `discord-bot/index.js` - Realtime subscription or HTTP endpoint for tournament events

### 2D: Tournament Event Feed

Bot posts rich embeds to `#tournament-feed`:
- Registration opens: tournament name, date, spots available, register link
- Round starts: round number, lobby assignments summary
- Round results: top placements, standings update
- Tournament complete: final podium, champion announcement

**File changes:**
- New: `discord-bot/tournament-feed.js` - Event formatting and posting

---

## Phase 3: Social Sharing & Waitlist

### 3A: Enhanced Social Sharing

**Share Card Redesign:**
- Post-match card includes: player name, rank badge, placement, points earned, season rank change
- Bold CTA footer: "Compete in the next clash - tftclash.com"
- TFT Clash watermark/branding

**Share Targets:**
- Twitter/X: Pre-filled tweet with stats + tftclash.com link
- Discord: Rich embed via webhook or copy-paste
- Download: PNG card with branding
- Copy: Plain text results with link

**Season Recap Card:**
- End-of-season shareable with full stats, rank achieved, highlight placement

**All URLs:** `tftclash.com` (never `.gg`, never `vercel.app`)

**File changes:**
- `src/screens/ResultsScreen.jsx` - Enhanced share cards
- `src/screens/SeasonRecapScreen.jsx` - Add share card
- `src/screens/FlashTournamentScreen.jsx` - Post-round share option

### 3B: Waitlist Visibility

**UI Elements:**
- Tournament detail page: "12/16 spots filled" progress bar
- When full: "You are #3 on the waitlist" with position indicator
- Toggle: "Notify me when a spot opens" checkbox

**Notification Flow:**
1. Player unregisters from full tournament
2. System checks waitlist (ordered by registration time)
3. Next waitlisted player gets:
   - Discord DM via bot (if discord_user_id linked)
   - In-app notification via `activity_feed` table
   - 15-minute window to confirm, then passes to next

**Database:**
- Add `waitlist_notify` boolean column to `tournament_registrations` (or use existing waitlist status)

**File changes:**
- `src/screens/FlashTournamentScreen.jsx` - Waitlist UI
- `src/screens/EventsScreen.jsx` - Waitlist position display
- `discord-bot/index.js` - DM notification on spot open

---

## Phase 4: PWA & Post-Clash Recap

### 4A: PWA Setup

**Files to create:**
- `public/manifest.json` - App name, icons, theme color, display: standalone
- `public/sw.js` - Service worker for offline shell caching
- Update `index.html` - Link manifest, register service worker

**Features:**
- Offline shell (app loads even without network, shows "connecting..." for data)
- Add-to-homescreen prompt after 2nd visit
- Push notifications (requires VAPID keys + notification permission):
  - Tournament reminders (24h, 1h before)
  - Lobby assignment notification
  - Waitlist spot opened
  - Round results available

### 4B: Personalized Post-Clash Recap

**After tournament completes, each player gets a recap:**
- Round-by-round placements with visual chart
- Total points earned
- Season rank movement (up/down arrow with delta)
- Comparison to lobby average
- "Best round" highlight
- Shareable as card (links to Phase 3 sharing)

**File changes:**
- New: `src/screens/ClashRecapScreen.jsx` (or section in FlashTournamentScreen)

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Lobby chat | Discord channels (not browser) | Zero hosting cost, players already on Discord, voice included, bot infra exists |
| Score submission | Supabase RLS + client insert | No custom API needed, RLS handles auth, Realtime handles live updates |
| Conflict detection | Client-side after 8th submit | Simple, immediate feedback, admin notified async |
| Waitlist notifications | Discord DM + activity_feed | Multi-channel reach, no email infrastructure needed |
| PWA push | Web Push API + VAPID | Standard, no third-party service needed |

## Non-Goals (Explicitly Out of Scope)

- Riot API integration (requires application approval)
- Browser-based voice/video chat
- Email notifications
- Mobile native app
- Automated tournament scheduling (stays manual for now)
- Spectator mode

## Implementation Order

1. Phase 1A: Self-reporting system (DB + UI)
2. Phase 1B: Live tournament view (Realtime subscriptions)
3. Phase 2A: Fix existing Discord bot
4. Phase 2B: New slash commands
5. Phase 2C: Auto lobby channels
6. Phase 2D: Tournament event feed
7. Phase 3A: Enhanced social sharing
8. Phase 3B: Waitlist visibility
9. Phase 4A: PWA setup
10. Phase 4B: Post-clash recap
