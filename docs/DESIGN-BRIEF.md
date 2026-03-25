# TFT Clash - Complete Design Brief

> Feed this document into any AI design tool (v0, Lovable, Bolt, Figma AI, etc.) to generate a full UI redesign.

---

## 1. PRODUCT IDENTITY

**What is TFT Clash?**
TFT Clash is a competitive tournament platform for Teamfight Tactics (TFT) - a strategy auto-battler game by Riot Games. Think of it as **FACEIT but specifically for TFT**. It organizes weekly "clashes" (tournaments), tracks seasonal rankings, and builds community around competitive play.

**Core Loop:**
1. Players sign up for free
2. Register for weekly clashes (8-player lobbies, 3-5 games per clash)
3. Earn points based on placement (1st = 8pts, 2nd = 7pts... 8th = 1pt)
4. Climb seasonal standings across tiers (Iron -> Bronze -> Silver -> Gold -> Platinum -> Emerald -> Diamond -> Master -> Grandmaster -> Challenger)
5. Chase the Season Champion title
6. Unlock milestones, complete challenges, earn XP

**Monetization (3 tiers):**
- **Player (Free):** Full competition access, basic profile, leaderboard, results
- **Pro ($4.99/mo):** Enhanced stats, pro badge, priority registration, career history, custom banner, comparison tool, weekly digest
- **Host ($19.99/mo):** Everything Pro + create branded tournaments, analytics, custom rules, player management

**Non-negotiable:** Free to compete, always. No paywall on tournament entry.

**Target Audience:** Competitive TFT friend groups and community organizers. The core users are a tight-knit group of ~15 players who clash weekly, but the platform is built to scale to hundreds.

**Season System:** Currently Season 1. Points accumulate across clashes. At season end, champion is crowned, Hall of Fame records are locked, and a new season begins.

---

## 2. DESIGN SYSTEM & VISUAL LANGUAGE

### 2.1 Color Palette

**Backgrounds (dark-on-dark layering, FACEIT-style depth):**
| Token | Hex | Usage |
|-------|-----|-------|
| bg-base | `#08080F` | Page background (deepest) |
| bg-surface | `#111827` | Panel/card background |
| bg-elevated | `#0D1117` | Elevated cards, inner boxes, stat cards |
| bg-overlay | `#0A0F1A` | Table headers, modal backdrops |
| bg-hover | `rgba(155,114,207,.08)` | Interactive hover states |

**Text hierarchy:**
| Token | Hex | Usage |
|-------|-----|-------|
| text-primary | `#F2EDE4` | Headings, names, key content |
| text-secondary | `#BECBD9` | Subtitles, descriptions, body text |
| text-tertiary | `#9AAABF` | Labels, captions, metadata |
| text-muted | `#C8D4E0` | Body paragraphs, explanations |

**Accent colors:**
| Token | Hex | Role |
|-------|-----|------|
| accent-gold | `#E8A838` | Primary accent. CTAs, points, 1st place, champion, gold tier. The "FACEIT orange" equivalent. |
| accent-purple | `#9B72CF` | Secondary accent. Brand identity, pro features, current user highlight, mystique. |
| accent-teal | `#4ECDC4` | Tertiary. Info states, completion, region tags, top-4 finishes. |
| accent-green | `#6EE7B7` | Success. Wins, positive trends, streaks, live status. |
| accent-red | `#F87171` | Danger/loss. Losses, errors, bans, negative trends. |
| accent-orange | `#FB923C` | Warning. Alerts, caution states. |
| accent-light-purple | `#C4B5FD` | Current user highlight, interactive purple states. |

**Rank tier colors:**
| Tier | Color |
|------|-------|
| Iron | `#5A6573` |
| Bronze | `#CD7F32` |
| Silver | `#C0C0C0` |
| Gold | `#E8A838` |
| Platinum | `#4ECDC4` |
| Emerald | `#52C47C` |
| Diamond | `#93B5F7` |
| Master | `#9B72CF` |
| Grandmaster | `#DC2626` |
| Challenger | `#F59E0B` |

**Borders:**
- Default: `1px solid rgba(242,237,228,.07)`
- Hover: `1px solid rgba(232,168,56,.3)` (gold glow)
- Active/selected: `1px solid rgba(155,114,207,.4)` (purple)
- Dividers: `rgba(242,237,228,.06)`

### 2.2 Typography

| Role | Font | Weight | Size | Usage |
|------|------|--------|------|-------|
| Display/Hero | Russo One | 900 | clamp(36px, 7vw, 72px) | Hall of Fame title, champion names, hero text |
| Headings | Playfair Display | 700 | 20-28px | Screen titles, section headers |
| Labels/Badges | Barlow Condensed | 600-700 | 10-12px, uppercase, letter-spacing .08-.16em | Stat labels, tier names, section labels |
| Stats/Numbers | System Monospace | 700-800 | 14-28px | Points, placement numbers, countdown timers |
| Body | System UI (Inter) | 400-500 | 13-14px, line-height 1.5 | Descriptions, paragraphs |
| Buttons | System UI | 600-700 | 12-14px, letter-spacing .04em | All buttons |

**Key rule from FACEIT:** Labels should be uppercase with wide letter-spacing. Stats should be large monospace numbers. The font hierarchy creates instant scanability.

### 2.3 Spacing System

8px base grid:
- `4px` - tight gaps (badge internals, icon-to-text)
- `8px` - compact spacing (within stat cards, between tags)
- `10px` - default gap in grids
- `12px` - card internal padding (compact)
- `14-16px` - standard card padding
- `18-20px` - generous card padding (hero sections)
- `24px` - section gaps
- `32-40px` - major section separators

### 2.4 Border Radius

- `0-4px` - Data cards, stat boxes, table cells (sharp = competitive)
- `7-10px` - Panels, content cards
- `12-16px` - Feature cards, modals
- `20px` - Buttons, pills, badges
- `50%` - Avatars, dots, circular elements

### 2.5 Shadows & Effects

- No heavy drop shadows (FACEIT-style flat depth through background layering)
- Glow effects only for special states: `box-shadow: 0 0 20px rgba(232,168,56,.25)` for champion/gold elements
- Hover lift: `transform: translateY(-3px)` with `transition: all .2s ease`
- Backdrop blur on panels: `backdrop-filter: blur(20px)` with glass-morphism backgrounds
- Animations: 150-200ms max for transitions. Functional only, no decorative motion.

### 2.6 Max Content Width

- Primary: `960px` (main content wrap)
- Full-width sections: hero banners, featured event cards can break out
- Stat grids: typically 2-4 columns within the 960px constraint

---

## 3. COMPONENT LIBRARY

### 3.1 Panel (Primary Container)
The fundamental building block. Every content section lives in a Panel.
- Glass-morphism background: gradient from `rgba(14,22,40,.88)` to `rgba(8,12,24,.92)`
- 1px border with subtle white tint
- 16px border-radius
- Optional: glow state (gold top accent line), danger state (red border), color accent
- Hover state: lift -3px, border brightens
- Click state: cursor pointer when interactive

### 3.2 Btn (Button)
Variants:
- **Primary (Gold):** Gradient `#FFD060 -> #E8A838 -> #C4782A`, dark text `#07070E`, strong shadow. Used for main CTAs (Register, Submit, Sign Up).
- **Ghost:** Transparent bg, gold border + text. Used for secondary actions.
- **Purple:** Purple gradient bg, purple text. Used for Pro/premium actions.
- **Teal:** Teal bg. Used for info/completion actions.
- **Dark:** Dark gray bg, subtle border. Used for cancel/neutral actions.
- **Danger:** Red bg. Used for destructive actions (delete, ban).
- **Success:** Green teal. Used for confirm/positive actions.

Sizes: sm (6x13px), md (11x20px), lg (14x32px), xl (18x44px)
All buttons: 700 weight, .04em letter-spacing, rounded (20px radius)

### 3.3 Inp (Input Field)
- Dark bg `#0D1525`, lighter on focus `#0F1A2E`
- Purple border + glow on focus
- 46px height, 14px padding
- Monospace-friendly sizing for Riot IDs, numbers

### 3.4 Tag (Badge/Pill)
Small colored pill for metadata: rank tags, region tags, tier badges, status indicators.
- Color variants: gold, teal, purple, green, red, silver, bronze
- Size: sm (tiny inline) and md (standard)
- Font: 10px, bold, uppercase

### 3.5 Divider
Horizontal rule with optional centered label.
- Gradient lines left and right of label
- Label: 10px, uppercase, letter-spacing .14em, `#9AAABF`

### 3.6 Modal
Fullscreen overlay for focused interactions.
- Dark backdrop with blur
- Centered content panel
- Click-outside to close
- Smooth fade-in animation

### 3.7 Toast/Notification
Temporary feedback at bottom-right.
- Types: success (green), error (red), info (blue), warning (orange)
- Auto-dismiss after 3 seconds
- Compact, non-intrusive

### 3.8 Sparkline
Mini SVG line chart (40-280px wide, 14-40px tall).
- Smooth bezier curves
- Configurable color (usually purple `#9B72CF`)
- Used for: points trend, placement history, season trajectory
- Displays 8+ data points

### 3.9 FormDots
Row of small colored circles showing recent game placements.
- Gold dot = 1st place win
- Teal dot = top 4 finish
- Gray/muted dot = bottom 4 finish
- Shows last 3-5 games
- Tooltip on hover shows exact placement

### 3.10 StandingsTable
Sortable, interactive leaderboard table.
- Columns: Rank #, Player Name, Points, Avg Placement, Games, Wins (optional), Trend (sparkline + form dots)
- Top 3 rows get special styling (gold/silver/bronze left border, larger font)
- Current user row highlighted in purple
- Click any row to open player profile
- Hover: subtle background change
- Sortable column headers with arrow indicators

### 3.11 PlacementDistribution
Horizontal stacked bar chart showing how many times a player finished 1st, 2nd, 3rd... 8th.
- Colors: gold (1st), silver (2nd), bronze (3rd), purple (4th), teal (5th), then progressively muted
- Labels below showing ordinal numbers
- Proportional widths based on count

### 3.12 StatCard / InnerBox
Compact stat display unit used in grids.
- Dark elevated background (`#0D1117` or `rgba(255,255,255,.04)`)
- Large monospace stat number (20-28px, color-coded)
- Small uppercase label below (10px, `#BECBD9` or `#9AAABF`)
- Used in 2x2, 3x3, or 4-column grids

### 3.13 ShareBar
Social sharing actions.
- Buttons: Copy Link, Post to X/Twitter, Native Share
- Small, grouped horizontally
- Muted styling until hovered

---

## 4. NAVIGATION

### 4.1 Desktop Navbar (Top)
Fixed top bar, dark background, full width.

**Left:** Logo (TFT Clash icon + wordmark) with "S1" season badge
**Center:** Primary tabs - Home, Clash, Standings, Events, Profile
**Right:** Notification bell (with unread count badge), User avatar + name, Sign In/Up buttons (if guest)

**Active tab:** Gold bottom border or background tint
**Special states:**
- "LIVE CLASH" mode: animated gold glow on Clash tab, pulsing indicator
- Registration open: small "Register" badge on Clash tab
- Results ready: teal "Results" badge

**"More" dropdown** contains: Milestones, Challenges, Rules, FAQ, Pricing, Archive, Season Recap

### 4.2 Mobile Navigation
**Top:** Hamburger menu icon (left), Logo (center), Notifications + Avatar (right)
**Bottom tab bar:** 5 tabs - Home, Clash, Standings, Profile, More
**Drawer:** Full-screen slide-out with organized sections:
- Main (Home, Clash, Standings)
- Explore (Events, Leaderboard, Hall of Fame)
- Community (Milestones, Challenges, Archive, Rules, FAQ)
- Info (Pricing, Season Recap, Gear)
- Account (Profile, Settings, Logout)

### 4.3 Admin Access
Admin panel accessed via separate nav item (visible only to admins).
Sidebar navigation with grouped sections: Tournament, Management, Configure, System.

---

## 5. SCREENS - DETAILED SPECIFICATIONS

### 5.1 HomeScreen (Guest - Not Logged In)

**Purpose:** Convert visitors into registered users. Show the platform is active and competitive.

**Layout:** Single column, max-width 880px, centered.

**Section 1: Hero**
- TFT Clash logo (large)
- Tagline: "The competitive TFT platform. Weekly clashes. Seasonal glory."
- Two CTAs: "Sign Up Free" (gold, primary), "Learn More" (ghost)
- Subtle animated background (optional - stars/particles, very subtle)

**Section 2: Countdown to Next Clash** (if upcoming)
- "NEXT CLASH STARTS IN" label (uppercase, Barlow Condensed, gold)
- 4 countdown boxes: Days, Hours, Minutes, Seconds
- Each box: dark inner-box background, large monospace gold number (24px), small label below (10px)
- Clash name and date below countdown

**Section 3: Season Stats Bar**
- Horizontal row of 4 stats in a Panel:
  - Total Players | Total Games | Total Points Earned | Season Duration
  - Each: icon + large number + small label
  - Shows the platform is active

**Section 4: Season Champion Spotlight**
- Panel with gold glow border
- Champion name (large), rank badge, region tag
- Key stats: Points, Wins, Avg Placement
- "View Profile" link
- Trophy icon

**Section 5: Top 5 Leaderboard Preview**
- Compact StandingsTable showing top 5 players
- Each row: rank, name, points, sparkline, form dots
- "View Full Standings" link at bottom

**Section 6: How It Works**
- 4 steps in a responsive grid (2col mobile, 4col desktop):
  1. Sign Up (icon: user-plus) - "Create your free account"
  2. Register (icon: clipboard) - "Join the weekly clash"
  3. Compete (icon: swords) - "Battle in 8-player lobbies"
  4. Climb (icon: chart-line) - "Rise through the ranks"
- Each step: icon, title (12px bold), description (12px muted)

**Section 7: CTA Banner**
- "Ready to compete?" heading
- "Join [X] players already battling for Season 1 glory."
- "Sign Up Free" button (gold, large)

---

### 5.2 HomeScreen (Logged In - Dashboard)

**Purpose:** At-a-glance status of the player's competitive standing and next actions.

**Layout:** Max-width 880px. Two-column layout on desktop (60/40 split), single column on mobile.

**Top: Announcement Banner** (if active)
- Gold-tinted Panel with speakerphone icon
- Scrolling or static announcement text

**Zone 1: The Pulse (full width)**
Panel with player identity + clash status merged:
- Left: Avatar/initial, player name, tier badge, rank
- Center: Rank position (#X), Points total, pts-to-next-tier badge
- Right: Countdown to next clash (compact: "2D 14H 32M") with register/check-in button

**Zone 2: Left Column - Your Stats**
Panel: "Season Trajectory"
- Sparkline chart (points over time, purple line)
- Form dots (last 5 games)
- 2x2 stat grid: Season Points, Wins, Avg Placement, Top 4 Rate

Panel: "Last Clash" + "Active Streak"
- Side-by-side inner boxes
- Last Clash: ordinal placement (e.g., "3rd") + points earned
- Streak: consecutive top-4 count + type (wins or top 4s)

**Zone 3: Right Column - Community**
Panel: "Standings" (compact)
- Top 5 leaderboard with current user position highlighted
- "View All" link

Panel: "Activity" (if available)
- Recent milestones/achievements from other players
- Latest host announcements
- "Flash Tournament starting!" alerts

**Bottom: Quick Actions** (full width)
- Horizontal row of action buttons/links:
  - View Bracket, Submit Results, View Profile, Season Recap
  - Only show relevant ones based on current clash phase

---

### 5.3 StandingsScreen (Wrapper)

**Tabs:** Leaderboard | Hall of Fame | Roster
**Header:** "Standings" h1, "Season rankings, legends, and the full player roster" subtitle

---

### 5.4 LeaderboardScreen

**Purpose:** Complete ranked player listing with filtering, comparison, and multiple views.

**Section 1: Podium (Top 3)**
Three-card layout (center card taller for 1st place):
- 1st: Gold border glow, trophy icon, large name, all key stats, sparkline
- 2nd: Silver treatment, slightly smaller
- 3rd: Bronze treatment, same size as 2nd
- Each card: avatar/initial, name, rank+region tags, points (huge mono), stats grid (Avg, Wins, T4%), mini sparkline
- Clickable to open profile

**Section 2: Filters**
- Search input: "Search players..."
- Region dropdown: All, EUW, EUNE, NA, etc.
- View toggle: Season | Cards | Stats | Streaks

**Section 3: Full Leaderboard Table**
StandingsTable component with all players.
- Tier divider lines between rank tiers (e.g., line between Diamond and Master players)
- PRO/HOST badges inline with player names
- Current user row: purple left border + purple tint background + "(you)" label

**Section 4: Comparison Tool** (Pro feature)
- Select 2-3 players to compare side-by-side
- Stat comparison table with better stat highlighted
- Overlaid sparkline charts

---

### 5.5 PlayerProfileScreen

**Purpose:** Deep dive into any player's stats, history, and achievements.

**Header Bar:** Back button, Season Recap button, Challenges button, Download Card, Copy, Share, Compare

**Section 1: Profile Header**
- Banner area (custom image or rank-colored gradient)
- 64px avatar overlapping banner bottom edge
- Player name (Playfair Display, 22px)
- Rank badge + Region tag inline
- Bio text (if set)
- Social links: Twitch, Twitter, YouTube icons

**Section 2: Champion Banner** (only if season champion)
- Gold glow Panel, trophy animation, "Season 1 Champion" label

**Section 3: Stat Cards Grid** (3-column or 4-column)
Cards: Points, Wins, Avg Placement, Top4 Rate, Games, Win Streak, Best Haul, DNP Count
Each card: large colored number + small label

**Section 4: Placement Distribution**
Horizontal stacked bar chart (1st through 8th)
Ordinal labels below

**Section 5: Season Trajectory**
Full-width sparkline showing cumulative points over time

**Section 6: Career Stats Panel**
- Hot Streak / Cold Streak badges (if active)
- Average Placement dual display: Career AVP vs Per-Clash AVP
- Subtitle text explaining each metric

**Section 7: Tabs - Overview | Achievements | H2H | Clash History**
- **Clash History:** Reverse-chronological list of every clash participated in
  - Each entry: clash name, date, placement (large ordinal), points earned, bonus points
  - Color-coded: gold border for wins, teal for top 4, muted for bottom 4
  - "Champion" / "Top 4" / "Bot 4" label per entry

**Section 8: Downloadable Stats Card**
Canvas-rendered shareable image with key stats. "Download as PNG" button.

---

### 5.6 HofScreen (Hall of Fame)

**Purpose:** Celebrate champions and record holders. This should feel PRESTIGIOUS.

**Section 1: Page Header**
- "Hall of Fame" in Russo One, 72px, gold text-shadow
- "These records are permanent. Every name here earned their place."
- ShareBar

**Section 2: Reigning Champion Card**
- MASSIVE hero card, gold gradient border, animated glow
- 88px circular initial with gold ring
- "Season 1 Leader" label (gold, uppercase)
- Name in Russo One (huge)
- Rank + Region tags
- Stats grid: Points, Wins, Avg, Top4%, Games
- Gap-to-2nd indicator: "X points ahead of 2nd place"
- "View Profile" button

**Section 3: Challengers Column**
- Players ranked 2nd-4th
- Compact cards: name, rank, points, gap-to-1st
- Medal indicators (Silver, Bronze)
- Click to view profile

**Section 4: Record Holders Grid** (2-3 columns)
6 record categories, each in a Panel:
1. Season Points Leader (most total pts)
2. Win Machine (most wins)
3. Consistency King (best avg placement)
4. Hot Streak (longest consecutive top-4s)
5. Iron Presence (most games played)
6. Top4 Machine (highest top-4 rate %)

Each record card:
- Icon + record title
- Holder name + rank + record value
- Runner-up names (2nd, 3rd)

---

### 5.7 BracketScreen

**Purpose:** Live tournament management. Registration, check-in, lobby display, result submission.

**Phases (each has different UI):**

**Registration Phase:**
- "Registration Open" status badge (green)
- Player count: "X/24 registered"
- "Register" button (gold) or "Registered" status (green check)
- Registered player list (avatars + names)
- Countdown to check-in opening

**Check-in Phase:**
- "Check-in Open" status badge (yellow)
- "Check In" button (pulsing gold)
- Checked-in vs total count
- Timer: check-in closes in X minutes

**Live Phase:**
- "LIVE - Round X of Y" with animated indicator
- Seeding display: which algorithm was used
- "Find My Lobby" search input
- Lobbies grid (responsive, 1-2 columns):
  - Each lobby: "Lobby X" header, 8 player slots
  - Player names with status icons (checked-in, submitted, etc.)
  - Current user's lobby highlighted with purple border
  - "Submit Placements" button per lobby
  - Placement entry: 8 dropdowns (1-8), must be unique
  - "Self-submit" option for players to submit their own placement

**Results Phase:**
- Final standings table
- Winner banner with gold treatment
- Points earned per player
- "View Full Report" link to ClashReport

**Admin controls visible throughout:**
- Phase transition buttons
- Seeding algorithm selector (Rank-based, Snake, Anti-stack, Random)
- Finalize / Advance Round buttons
- Dispute counter badge

---

### 5.8 ResultsScreen / ClashReport

**Purpose:** Post-tournament recap with drama and narrative.

**Section 1: Winner Banner**
- Champion name, huge gold text, trophy icon, points earned
- Gold glow background

**Section 2: Podium** (top 3 side by side)
- Medal icons, names, points

**Section 3: Full Standings Table**
- All participants ranked by points
- Current user highlighted
- Point changes shown (+X green)

**Section 4: AI Commentary** (if enabled)
- Generated narrative about the clash
- Notable moments, upsets, streaks
- Multi-paragraph story format

**Section 5: Awards**
- Most Improved (teal card)
- Biggest Upset (red card)
- Streak awards

**Section 6: Share buttons**

---

### 5.9 MilestonesScreen

**Purpose:** Achievement system with unlockable badges.

**Tabs:** Achievements | Season Milestones | Achievement Leaders

**Achievements Tab:**
- Tier filter: All, Bronze, Silver, Gold, Legendary
- Grid of achievement cards (3-4 columns):
  - Each card: icon, title, description, unlock condition
  - Locked state: grayed out, semi-transparent
  - Unlocked state: glowing, color-coded by tier, date earned
  - Tier badge: Bronze `#CD7F32`, Silver `#C0C0C0`, Gold `#E8A838`, Legendary `#9B72CF`

**Season Milestones Tab:**
- Tier progression bars (Bronze -> Challenger)
- Current tier highlighted
- Goals checklist per tier

**Achievement Leaders Tab:**
- Leaderboard sorted by achievement count
- Player name, count, recent unlocks

---

### 5.10 ChallengesScreen

**Purpose:** Daily/weekly quests for XP progression.

**Section 1: XP Progress Bar**
- Current XP / Max XP
- Current rank name
- "Rank up in X more games"

**Section 2: Daily Challenges** (3 cards)
- Icon, title, progress bar, XP reward
- Active (green) or Completed (locked gray)
- Reset timer: "Resets in X hours"

**Section 3: Weekly Challenges**
- Same format, bigger rewards
- Reset timer: "Resets Monday"

**Section 4: Challenge History**
- Calendar heatmap showing completion by day
- Streak counter

---

### 5.11 ScrimsScreen

**Purpose:** Practice lobby management with stats tracking.

**Tabs:** Dashboard | Stats | H2H | Games

**Dashboard:** Active scrims list, create new scrim form (name, target games, roster picker)
**Stats:** Scrim leaderboard (avg placement, wins, games), sparklines per player
**H2H:** Head-to-head matrix grid (win/loss records between players, color-coded green/red)
**Games:** Chronological game log with filters (player, tag, date)

---

### 5.12 PricingScreen

**Layout:** 3-column card comparison (responsive to single column).

Per tier card:
- Tier name + icon
- Price ("Free" / "$4.99/mo" / "$19.99/mo")
- Feature list with checkmarks
- CTA button or "Current Plan" indicator
- Recommended badge on Pro tier

Bottom banner: "Free to compete, always." with teal accent

---

### 5.13 EventsScreen / FeaturedScreen

**Purpose:** Browse and register for hosted tournaments and community events.

**Hero:** Featured tournament with large image, overlay text, "Register Now" CTA
**Grid:** Tournament cards (2-3 columns)
- Each card: tournament name, host name, date, format, player cap, status badges (LIVE, UPCOMING, Registration Open)
- "Register" button or "Registered" status
- Prize pool badge (teal) if applicable

**Detail Modal:** Full tournament info, rules, prize structure, registered count, register CTA

---

### 5.14 AdminPanel

**Purpose:** Full tournament and platform management.

**Layout:** Sidebar navigation + main content area.

**Sidebar groups:**
- TOURNAMENT (gold): Dashboard, Round Control, Quick Clash, Flash Tournaments
- MANAGEMENT (purple): Players, Scores, Broadcast, Schedule, Featured
- CONFIGURE (teal): Season, Sponsors, Hosts, Scrims Access, Ticker
- SYSTEM (gray): Audit Log, Settings

**Key views:**
- Player management table with inline actions (edit, ban, note)
- Round control with phase transition buttons
- Broadcast composer
- Audit log with filterable action types

---

### 5.15 Auth Screens (Sign Up / Login)

**Sign Up:**
- "Create Your Account" heading
- Fields: Email, Username, Password, Confirm Password, Riot ID (optional), Region (dropdown), Bio (optional)
- Terms checkbox
- "Sign Up" gold button
- "Already have an account? Sign In" link

**Login:**
- "Welcome Back" heading
- Fields: Email, Password
- "Remember me" checkbox, "Forgot password?" link
- "Sign In" gold button
- "Don't have an account? Sign Up" link

---

### 5.16 AccountScreen

**Tabs:** Account | Milestones | Challenges

**Account Tab:**
- Profile picture upload
- Player link (connect to player profile)
- Riot ID + region + verification
- Bio, custom banner, accent color
- Social links (Twitch, Twitter, YouTube)
- Password change, logout, delete account

**Referral Panel:**
- Shareable invite link
- Referral count + rewards

---

### 5.17 SeasonRecapScreen

**Purpose:** Personalized season-end summary. Should feel celebratory and narrative.

- Player name (huge, serif)
- Season 1 badge, final rank + tier
- Key stats: points, games, wins, top-4 rate, avg placement
- Generated narrative paragraph about their season
- Achievements unlocked this season
- Notable moments (longest streak, biggest haul, most improved stat)
- "Season 2 starts in X days" teaser

---

### 5.18 HostApplyScreen / HostDashboardScreen

**Apply:** Application form (org name, reason, frequency, vision, format preference). Status display after submission.

**Dashboard:**
- Create tournament form
- Tournament list with status filters
- Branding customization (logo, colors, banner)
- Announcement posting

---

### 5.19 RulesScreen

- Quick facts grid (3 columns): key rules at a glance
- Search bar for filtering rules
- Accordion sections: Registration, Scoring, Tiebreakers, Disputes, Bans, Fair Play
- Points table: placement -> points mapping

---

### 5.20 FAQScreen

- Search bar
- Category tabs: Getting Started, During a Clash, Scoring & Rankings, Pro & Host Tiers
- Expandable Q&A items per category
- Clean, readable text hierarchy

---

## 6. FOOTER

**4-column grid layout:**
1. Platform: Home, Roster, Leaderboard, Hall of Fame, Archive
2. Community: Events, Rules, FAQ, Gear, Discord
3. Hosting: Pricing, Apply to Host, Host Dashboard
4. Legal: Privacy, Terms, "Built for the community"

**Sponsor strip:** Partner logos displayed above footer columns (if sponsors configured)
**Copyright:** "(c) 2026 TFT Clash - Season 1 - Free to compete, always."

---

## 7. DESIGN INSPIRATION & COMPETITIVE ANALYSIS

### 7.1 FACEIT (Primary Inspiration)

**What to steal:**
- **Dark-on-dark surface layering:** 3-4 shade levels create depth without shadows or gradients. Background -> Surface -> Elevated -> Inner Box.
- **Accent color discipline:** One strong brand color (for us: gold `#E8A838`) used sparingly for CTAs and key metrics. Most UI is grayscale. Color = signal, not decoration.
- **Uppercase labels with wide letter-spacing:** Creates "military/competitive" feel. All section headers, stat labels, badge text.
- **Dense, scannable stat cards:** Large bold number + small muted label. No fluff between them.
- **Level/rank badge system:** Numbered shields/badges with color progression from cool (low rank) to hot (high rank). Instant visual rank recognition.
- **Match history as compact rows:** Green left-border for wins, red for losses. All key stats visible at a glance on one line.
- **Minimal border-radius for data elements:** 0-4px keeps things sharp and competitive. Rounded corners are for buttons and pills, not data cards.
- **Monochrome base:** The dark gray palette makes the accent color pop dramatically.
- **Speed:** All transitions 150-200ms max. No decorative animations. Everything feels instant and responsive.
- **Information density:** Every pixel serves a data purpose. No decorative illustrations, no empty space for aesthetics.

**FACEIT's exact colors for reference:**
- Primary: `#FF5500` (orange) - our equivalent: `#E8A838` (gold)
- Background: `#141616` (charcoal) - our equivalent: `#08080F` (deep dark)
- Surface: `#1E2222` - our equivalent: `#111827`
- Elevated: `#232828` - our equivalent: `#0D1117`
- Borders: `#323838` - our equivalent: `rgba(242,237,228,.07)`
- Text primary: white
- Text secondary: `#8A8F98` gray
- Font: "Play" (geometric sans) - our equivalent: Barlow Condensed for labels, system UI for body

### 7.2 Start.gg (Tournament Bracket Inspiration)

**What to steal:**
- Tournament hierarchy navigation (Dashboard, Register, Events, Brackets, Standings, Schedule as tabs)
- Clean bracket visualization with progressive narrowing and connecting lines
- Material Design-influenced buttons (subtle shadow + hover elevation)
- Event card layout: game, entry fee, schedule, status badge, register CTA

**Start.gg uses a light theme** - we keep dark but adapt their bracket clarity and tournament flow patterns.

### 7.3 Other References

- **Battlefy:** Dark navy `#151B27` bg, similar depth layering, Roboto + Archivo fonts
- **CS2 Blog:** Purple accent `#8847FF`, Quantico font, modular card system
- **Leetify:** Rich font stack (different fonts for different data contexts)

### 7.4 Cross-Platform Patterns to Adopt

| Pattern | Implementation |
|---------|---------------|
| Win/Loss color coding | Green left-border or green text for wins, red for losses |
| Stat display hierarchy | Large number -> Small label -> Smallest context |
| Top 3 special treatment | Gold/Silver/Bronze accents, larger cards, medal icons |
| Current user highlight | Purple tint + left border + "(you)" label |
| Status badges | Colored pills: LIVE (green pulse), UPCOMING (teal), REGISTRATION OPEN (gold) |
| Progress bars | Thin colored bars for XP, tier progression, completion |
| Hover states | Subtle brightness increase + optional lift |
| Empty states | Centered icon + message + action button |

---

## 8. RESPONSIVE BREAKPOINTS

| Breakpoint | Layout | Notes |
|------------|--------|-------|
| < 480px | Single column, stacked cards, bottom tab nav | Touch targets min 44px, hamburger menu |
| 480-640px | Single column, 2-col stat grids | Cards full-width |
| 640-768px | 2-column layouts begin | Side-by-side panels |
| 768-1024px | 2-3 column grids | Sidebar visible on admin |
| > 1024px | Full desktop layout, 3-4 column grids | Max-width 960px content area |

---

## 9. KEY USER FLOWS

### 9.1 New Player Journey
Landing Page -> Sign Up -> Complete Profile (link Riot ID) -> Browse Standings -> Register for Clash -> Check In -> Compete -> View Results -> Check Standings -> Repeat

### 9.2 Weekly Clash Flow
Dashboard shows countdown -> Registration opens (register button appears) -> Check-in opens 60min before (check-in button) -> Tournament goes LIVE (bracket screen, find your lobby) -> Play games in TFT client -> Submit placements in-app -> Results posted -> Points added to standings

### 9.3 Host Flow
Browse Pricing -> Apply to Host -> Get approved -> Access Host Dashboard -> Create tournament -> Customize branding -> Players register -> Run event -> Post results

---

## 10. PLAYER DATA MODEL

For reference, these are the data fields a player has that the UI needs to display:

```
Player {
  id, name, rank (Iron-Challenger), region (EUW/EUNE/NA/etc),
  pts (season points), wins, games, plan (free/pro/host),
  riotId, bio, profilePic, bannerPic, accentColor,
  twitch, twitter, youtube,
  clashHistory: [{ clashId, placement, points, bonusPoints, date }],
  currentStreak, tiltStreak, bestHaul, dnpCount,
  achievements: [{ id, name, unlockedAt }],
  xp, xpRank
}

Computed Stats {
  avgPlacement, top4Rate, winRate, pointsPerGame,
  consistency grade, perClashAvp, variance,
  sparklineData (points trend), formDots (recent placements)
}
```

---

## 11. SEED DATA (Use for Mockups)

**Players (the "homies" - use these names in all mockups):**

| Name | Rank | Points | Wins | Games | Region |
|------|------|--------|------|-------|--------|
| Levitate | Challenger | 1024 | 16 | 42 | EUW |
| Zounderkite | Grandmaster | 891 | 12 | 38 | EUW |
| Uri | Diamond | 756 | 9 | 35 | EUW |
| BingBing | Diamond | 698 | 8 | 34 | EUW |
| Wiwi | Master | 645 | 7 | 30 | EUW |
| Ole | Platinum | 512 | 5 | 28 | EUW |
| Sybor | Gold | 423 | 4 | 25 | EUW |
| Ivdim | Gold | 389 | 3 | 22 | EUW |
| Vlad | Silver | 234 | 2 | 18 | EUW |

**Levitate is the Season 1 Champion.** Always show them at #1 in mockups.

**Filler players for larger views:** Dishsoap, k3soju, Setsuko, Mortdog, Robinsongz, Wrainbash, BunnyMuffins, Frodan, NightShark, CrystalFox, VoidWalker, StarForge, IronMask, DawnBreaker, GhostRider

**NEVER include these names:** Denial, Max, Ribenardo

---

## 12. CONTENT RULES

- **ZERO em dashes or en dashes** in any text. Use hyphens, commas, or rewrite.
- **No placeholder buttons.** Every button must have a real purpose and destination.
- **No decorative illustrations.** Icons only where functional.
- **Stats are the hero.** Numbers should be the most prominent visual element on any screen.
- **Competitive energy, not aggression.** The tone is "prove yourself" not "destroy enemies."
- **Community-first language.** "Compete with friends" not "dominate opponents."

---

## 13. SUMMARY - THE VIBE IN ONE PARAGRAPH

TFT Clash should feel like walking into a premium esports facility. Dark, focused, data-forward. The gold accent cuts through the darkness like stadium lights. Every screen should make players feel like their stats matter, their rank means something, and the competition is real. Think FACEIT's information density meets a sleek sports analytics dashboard. No wasted space, no decorative fluff - just clean panels, sharp typography, big numbers, and clear actions. The design should make a Challenger player feel prestigious and an Iron player feel motivated. When someone opens the app, they should immediately see where they stand, what's next, and feel the pull to compete.
