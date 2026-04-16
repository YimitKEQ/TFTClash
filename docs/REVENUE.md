# TFT Clash — Revenue Strategy

Last updated: 2026-04-16

Current primary: 5 PayPal subscription tiers (Free / Pro 4.99 / Scrim 6.99 / Bundle 8.99 / Host 19.99). Free-to-compete is locked — no paywall on the ladder. Everything below is additive.

---

## Tier 1 — Ship in the first 2 weeks post-launch

Low effort, leverages existing DB + PayPal integration.

### 1. One-time cosmetic packs (non-recurring)
Sell single-purchase flair: name colours, animated badges, card frames, profile banners, emote packs.
- Price points: 2.99 / 4.99 / 9.99
- Implementation: reuse PayPal one-time checkout (we already use subscriptions — add `create_order`), new `cosmetics` table (id, sku, price, asset_url, active), `user_cosmetics` join table, equip logic on PlayerProfile + Leaderboard.
- Margin: ~96% after PayPal fees.
- Why it works: competitive community loves identity signals; price is below psychological subscription threshold.

### 2. "Boost my lobby" tip jar
Voluntary contribution when a player wins a clash. "Buy the lobby a round" → splash effect on the result share card, "backed by {username}" tag on the weekly recap.
- One-time, 0.99–4.99
- Fully vanity — no gameplay advantage
- Weekly leaderboard of backers → repeat buys

### 3. Season Pass (cosmetic-only)
Per-season pass (3 months), 9.99. Unlocks a set of 12 weekly cosmetics you earn by participating.
- Free track + Paid track pattern, like FIFA FUT or Rocket League
- DB: `season_passes`, `season_pass_progress`
- Retention engine — players log in every week to not miss the pass

---

## Tier 2 — Ship in month 2-3

Requires a bit of ops work but fits the existing product.

### 4. Tournament entry fees (host-configured, platform takes cut)
Hosts already create tournaments. Let them charge entry, platform keeps 10-15%.
- DB: already has `entry_fee` column (migration 023) — wire PayPal order flow on registration
- Creates a flywheel for Host tier: the more tournaments a host runs, the more they earn, the more they pay us 19.99/mo for the tools
- Regulatory: skill-based comp is clean in most jurisdictions but double-check EU gambling rules; stay "competition with cash prize" not "gambling"

### 5. Prize pool sponsorship marketplace
Brands sponsor a weekly clash prize pool (Logitech, SteelSeries, Razer, small TFT content creators). Platform takes 20% commission, hosts see "sponsored by {brand}" badges.
- Build: `sponsorships` table, admin approval flow, sponsor branding asset upload
- Already have sponsor infrastructure (SponsorsScreen, SponsorShowcase component) — wire payments through

### 6. Creator affiliate program
Twitch/YouTube TFT creators get a unique `?ref=streamername` link. 20% lifetime revenue share on any subscription they refer.
- DB: `referrals` table, tracked on sign-up, paid monthly via PayPal
- Lowers CAC dramatically — creators distribute for you

---

## Tier 3 — Ship in month 4-6

Bigger bets, bigger revenue.

### 7. Clash Ops as-a-service (white label)
Sell the whole tournament engine to other TFT communities / guilds / esports orgs for 49-99/mo.
- Custom subdomain (yourorg.tftclash.com), custom branding, private leaderboards
- Build on existing multi-tenant foundation (host_profiles) — extend to full isolation
- B2B revenue is 5-10x consumer ARPU

### 8. API / data access tier
Data scientists, content creators, TFT tool builders want stats access. Paid API (29.99/mo for hobbyists, 199/mo for commercial).
- Build: rate-limited read-only API, Supabase REST endpoints with RLS
- Use `tournament_results`, `player_stats_v` as product surface
- Stripe-style metered billing

### 9. Coaching marketplace
Connect ladder players with coaches. Platform takes 15% of booked sessions.
- Pro+ tier coaches get a verified badge; unverified are community
- Calendar integration, Discord handoff, escrow via PayPal
- Leverages Pro tier's existing social graph

### 10. Offline/LAN event tooling
Sell physical event licenses (pop-up LAN café, college esports, gaming conventions) for 199-499/event.
- Local-first mode with sync-on-reconnect
- Branded whiteboard, projector-ready Broadcast Overlay (already built)
- High-touch, high-margin B2B

---

## Tier 4 — Only after strong traction (month 6+)

### 11. Physical merch
Hoodies, jerseys, stickers, trophy replicas. Use Printful/Printify to dropship. Margin thin, but social proof + brand moat.

### 12. In-person "finals" event
Ship the top 16 of the season to a physical EMEA final. Ticket sales + sponsor pool + Twitch broadcast rights. This is the long-term moat move — every player on the ladder is playing to qualify.

---

## Non-Revenue but Growth-Adjacent

### 13. Free tier upsell hooks
- Email digest: weekly clash recap delivered Sunday, promotes Pro scrims
- Clash result share card (already exists) → "Made with TFT Clash" footer drives signup
- Riot ID linking → when friends' IDs match, send "your friend X just clashed, see their placement" notification

### 14. Content engine
Already have ContentEngineScreen. Auto-generate 3 YouTube Shorts / TikTok / X posts per week from tournament results. Drive Pro signups via content funnel.

---

## Revenue Model Math (conservative)

Assume 1,000 MAU after 6 months, typical esports conversion = 3-5%.

| Source | Users | ARPU | Monthly |
|---|---|---|---|
| Pro @ 4.99 | 25 | 4.99 | 125 |
| Scrim @ 6.99 | 10 | 6.99 | 70 |
| Bundle @ 8.99 | 10 | 8.99 | 90 |
| Host @ 19.99 | 5 | 19.99 | 100 |
| Cosmetics (30% buy ~7) | 300 | 7 | 2,100 |
| Season Pass @ 9.99 | 80 | 3.33 | 266 |
| Tournament fees | — | — | 150 |
| **Total** | | | **~2,900/mo** |

10k MAU = ~29k/mo = ~350k ARR. Not enough for a team but enough to be worth running full-time as a founder with light help.

---

## What NOT to do

- Pay-to-win cosmetics, boosts, or priority queues. Breaks "free to compete" promise.
- Aggressive ads on the main product. Destroys the premium feel.
- Lootbox mechanics. Regulatory and optics nightmare.
- Crypto / NFT anything. Dead category, hostile to TFT playerbase.

---

## Decision Framework

Before adding a revenue line, check:
1. Does it break "free to compete always"?
2. Does it make the product worse for non-payers?
3. Does it increase or decrease community trust?

If yes to 1, 2, or 3 is "decrease" → reject.
